export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeWithAutonomousLoop } from '@/lib/agent/autonomous-loop'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createUnifiedMemory } from '@/lib/memory/unified-agent-memory'
// 🧠 Long-term Memory (Agent OS v2.0 + JARVIS RAG)
import {
  buildJarvisContext,
  saveConversationMessage,
  analyzeAndLearn,
} from '@/lib/memory/jarvis-memory-manager'
import {
  loadAgentWorkContext,
  formatContextForPrompt,
  processAgentConversation,
} from '@/lib/agent/work-memory'
import { buildAgentContext } from '@/lib/memory/agent-os'

/**
 * 디버그 메시지 표시 여부
 * false: 사용자에게 최종 응답만 표시 (프로덕션)
 * true: 에이전트 시작, LLM 응답 등 내부 상태 표시 (개발용)
 */
const SHOW_DEBUG_MESSAGES = false

/**
 * In-memory chat history storage (fallback when Supabase tables don't exist)
 * Key: session_id, Value: array of chat messages
 */
const chatHistoryMemory = new Map<string, Array<{ role: string; parts: Array<{ text: string }> }>>()

/**
 * 유튜브 자막 캐시 - 후속 질문 지원
 * Key: chatId, Value: { transcript, videoUrl, timestamp }
 */
const youtubeTranscriptCache = new Map<number, { transcript: string; videoUrl: string; timestamp: number }>()

/**
 * 스킬 시스템 - Claude Code로 개발한 스킬 저장 및 재사용
 */
interface TelegramSkill {
  id: string
  name: string
  description: string
  keywords: string[]
  promptTemplate: string
  skillType: 'claude_code' | 'applescript' | 'api'
  usageCount: number
}

// 스킬 인메모리 캐시 (Supabase 백업)
const skillsCache = new Map<string, TelegramSkill>()

// 스킬 조회
async function findMatchingSkill(supabase: any, instruction: string): Promise<TelegramSkill | null> {
  try {
    // DB에서 스킬 검색
    const { data: skills } = await supabase
      .from('telegram_skills')
      .select('*')
      .order('usage_count', { ascending: false })

    if (!skills || skills.length === 0) return null

    const lowerInstruction = instruction.toLowerCase()
    for (const skill of skills) {
      const keywords = skill.keywords || []
      const matchCount = keywords.filter((kw: string) => lowerInstruction.includes(kw.toLowerCase())).length
      if (matchCount >= 2 || (keywords.length === 1 && matchCount === 1)) {
        return {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          keywords: skill.keywords,
          promptTemplate: skill.prompt_template,
          skillType: skill.skill_type,
          usageCount: skill.usage_count
        }
      }
    }
    return null
  } catch (error) {
    console.warn('[Skills] Error finding skill:', error)
    return null
  }
}

// 스킬 저장
async function saveSkill(supabase: any, skill: Omit<TelegramSkill, 'id' | 'usageCount'>, createdBy: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('telegram_skills')
      .insert({
        name: skill.name,
        description: skill.description,
        keywords: skill.keywords,
        prompt_template: skill.promptTemplate,
        skill_type: skill.skillType,
        created_by: createdBy
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[Skills] Error saving skill:', error.message)
      return null
    }
    console.log(`[Skills] ✅ Saved: ${skill.name}`)
    return data?.id
  } catch (error) {
    console.warn('[Skills] Error saving skill:', error)
    return null
  }
}

// 스킬 사용 카운트 증가
async function incrementSkillUsage(supabase: any, skillId: string): Promise<void> {
  try {
    await supabase.rpc('increment_skill_usage', { skill_id: skillId })
  } catch (error) {
    // RPC 없으면 직접 업데이트
    await supabase
      .from('telegram_skills')
      .update({
        usage_count: supabase.raw('usage_count + 1'),
        last_used_at: new Date().toISOString()
      })
      .eq('id', skillId)
  }
}

// 스킬 개발 대기 상태 (chatId -> 원래 요청)
const pendingSkillDevelopment = new Map<number, { instruction: string; timestamp: number }>()

/**
 * 마지막 사용한 프로젝트 - Supabase 영구 저장
 * 서버 재시작, 배포 후에도 기억 유지
 */

/**
 * Supabase에서 마지막 프로젝트 조회
 */
async function getLastProject(supabase: any, telegramUserId: string): Promise<{ name: string | null; path: string | null }> {
  try {
    const { data, error } = await supabase
      .from('telegram_users')
      .select('last_project, last_project_path')
      .eq('id', telegramUserId)
      .single()

    if (error || !data) {
      return { name: null, path: null }
    }

    return { name: data.last_project, path: data.last_project_path }
  } catch (error) {
    console.warn('[LastProject] Error getting last project:', error)
    return { name: null, path: null }
  }
}

/**
 * Supabase에 마지막 프로젝트 저장
 */
async function setLastProject(supabase: any, telegramUserId: string, projectName: string, projectPath: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('telegram_users')
      .update({
        last_project: projectName,
        last_project_path: projectPath,
        last_project_at: new Date().toISOString()
      })
      .eq('id', telegramUserId)

    if (error) {
      console.warn('[LastProject] Error saving last project:', error.message)
    } else {
      console.log(`[LastProject] ✅ Saved to Supabase: ${projectName}`)
    }
  } catch (error) {
    console.warn('[LastProject] Error saving last project:', error)
  }
}

/**
 * 작업 기록 저장 (코딩 작업, 파일 작업 등)
 */
async function saveWorkHistory(
  supabase: any,
  telegramUserId: string,
  chatId: number,
  workType: string,
  data: {
    projectName?: string
    projectPath?: string
    instruction: string
    prompt?: string
    status?: string
    result?: string
    errorMessage?: string
    filesCreated?: string[]
    filesModified?: string[]
    gitInfo?: any
    durationMs?: number
  }
): Promise<string | null> {
  try {
    const { data: workRecord, error } = await supabase
      .from('telegram_work_history')
      .insert({
        telegram_user_id: telegramUserId,
        chat_id: chatId,
        work_type: workType,
        project_name: data.projectName,
        project_path: data.projectPath,
        instruction: data.instruction,
        prompt: data.prompt,
        status: data.status || 'pending',
        result: data.result,
        error_message: data.errorMessage,
        files_created: data.filesCreated,
        files_modified: data.filesModified,
        git_info: data.gitInfo,
        duration_ms: data.durationMs,
        completed_at: data.status === 'completed' || data.status === 'failed' ? new Date().toISOString() : null
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[WorkHistory] Error saving work history:', error.message)
      return null
    }

    console.log(`[WorkHistory] ✅ Saved: ${workType} - ${data.instruction.substring(0, 50)}...`)
    return workRecord?.id || null
  } catch (error) {
    console.warn('[WorkHistory] Error saving work history:', error)
    return null
  }
}

/**
 * 작업 기록 업데이트 (상태 변경)
 */
async function updateWorkHistory(
  supabase: any,
  workId: string,
  updates: {
    status?: string
    result?: string
    errorMessage?: string
    filesCreated?: string[]
    filesModified?: string[]
    gitInfo?: any
    durationMs?: number
  }
): Promise<void> {
  try {
    const updateData: any = { ...updates }
    if (updates.status === 'completed' || updates.status === 'failed') {
      updateData.completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('telegram_work_history')
      .update(updateData)
      .eq('id', workId)

    if (error) {
      console.warn('[WorkHistory] Error updating work history:', error.message)
    } else {
      console.log(`[WorkHistory] ✅ Updated: ${workId}`)
    }
  } catch (error) {
    console.warn('[WorkHistory] Error updating work history:', error)
  }
}

/**
 * 대화 기록 관리
 *
 * 핵심 차별점: 영구 보존
 * - 모든 대화는 Supabase에 영구 저장
 * - LLM 모델을 바꿔도 기억 유지
 * - 서버 재시작해도 기억 유지
 * - 절대 삭제하지 않음
 */

/**
 * Generate a detailed prompt based on Korean instruction
 * Distinguishes between CREATE and MODIFY requests
 */
function generateDetailedPromptExample(koreanInstruction: string, isExistingProject: boolean = false): string {
  const instruction = koreanInstruction.toLowerCase()

  // Git 커밋/푸시 지시
  const gitInstructions = `

IMPORTANT - After completing the implementation:
1. Add changed files - git add .
2. Commit with descriptive message - git commit -m feat-description
3. Push to remote - git push origin main
4. If push fails, just commit locally`

  // 수정 요청 키워드 감지
  const modifyKeywords = ['수정', '고쳐', '업데이트', '변경', '바꿔', '교체', '추가', '넣어', '개선', '향상', '최적화']
  const isModifyRequest = modifyKeywords.some(kw => instruction.includes(kw)) || isExistingProject

  // 기능별 키워드 매칭
  const featureKeywords: Record<string, string> = {
    '소리': 'sound effects using Web Audio API or HTML5 Audio',
    '사운드': 'sound effects using Web Audio API or HTML5 Audio',
    '애니메이션': 'smooth CSS or Canvas animations',
    '효과': 'visual effects and transitions',
    '스타일': 'improved styling and visual design',
    '색': 'color scheme and visual appearance',
    '속도': 'game speed and performance',
    '레벨': 'level system and difficulty progression',
    '점수': 'scoring system',
    '버튼': 'button controls and UI',
    '모바일': 'mobile responsive design and touch controls',
    '터치': 'touch controls for mobile devices',
  }

  // 수정 요청일 경우 - 기존 프로젝트 수정 프롬프트
  if (isModifyRequest) {
    // 어떤 기능을 수정/추가하는지 파악
    const requestedFeatures: string[] = []
    for (const [korean, english] of Object.entries(featureKeywords)) {
      if (instruction.includes(korean)) {
        requestedFeatures.push(english)
      }
    }

    if (requestedFeatures.length > 0) {
      return `IMPORTANT: This is an EXISTING project. Do NOT create new files from scratch.

First, read and understand the existing code files in this directory.

Then MODIFY the existing code to add: ${requestedFeatures.join(', ')}.

Requirements:
- Preserve all existing functionality
- Only add or modify code needed for the new feature
- Keep the same code style and patterns
- Test that existing features still work after modification` + gitInstructions
    }

    // 일반 수정 요청
    return `IMPORTANT: This is an EXISTING project. Do NOT create new files from scratch.

First, read and understand the existing code files in this directory.

Then modify the code according to this request: ${koreanInstruction}

Requirements:
- Preserve all existing functionality
- Only change what is needed for this request
- Keep the same code style and patterns` + gitInstructions
  }

  // 새 프로젝트 생성 요청일 경우 - 기존 로직
  if (instruction.includes('테트리스') || instruction.includes('tetris')) {
    return 'Create a classic Tetris game using HTML5 Canvas and JavaScript. Requirements: 10x20 game board, all 7 tetromino shapes with rotation, soft drop and hard drop, line clearing with scoring, level progression, ghost piece, next piece display, keyboard controls, game over detection, pause functionality, clean modern UI.' + gitInstructions
  }

  if (instruction.includes('벽돌깨기') || instruction.includes('brick') || instruction.includes('breakout')) {
    return 'Create a Brick Breaker game using HTML5 Canvas and JavaScript. Requirements: Paddle control with mouse/keyboard, bouncing ball physics, multiple rows of bricks, score system, lives system, level progression, power-ups, sound effects, clean modern UI.' + gitInstructions
  }

  if (instruction.includes('계산기') || instruction.includes('calculator')) {
    return 'Build a modern calculator app. Requirements: Basic operations, clear and backspace, decimal support, keyboard input, calculation history, clean modern UI, responsive design.' + gitInstructions
  }

  if (instruction.includes('투두') || instruction.includes('todo') || instruction.includes('할일')) {
    return 'Create a Todo list application with local storage. Features: Add/edit/delete tasks, mark complete, filter by status, drag and drop reordering, due dates, priority levels, search, dark mode.' + gitInstructions
  }

  if (instruction.includes('게임') || instruction.includes('game')) {
    return 'Create an interactive browser-based game using HTML5 Canvas. Include: Game loop at 60fps, keyboard controls, score tracking, levels, collision detection, sound effects, game over and restart, clean modern UI.' + gitInstructions
  }

  // 기본 프롬프트
  return `Implement: ${koreanInstruction}. Requirements: Clean code, error handling, modern best practices, responsive design if UI involved.` + gitInstructions
}

/**
 * Get or create Telegram user
 */
async function getOrCreateTelegramUser(supabase: any, from: any) {
  const userId = String(from.id)

  try {
    // Try to get existing user
    const { data: existingUser, error: selectError } = await supabase
      .from('telegram_users')
      .select('*')
      .eq('id', userId)
      .single()

    if (existingUser) {
      // Update last active
      await supabase
        .from('telegram_users')
        .update({
          last_active_at: new Date().toISOString(),
          total_messages: (existingUser.total_messages || 0) + 1,
        })
        .eq('id', userId)

      return existingUser
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('telegram_users')
      .insert({
        id: userId,
        username: from.username,
        first_name: from.first_name,
        last_name: from.last_name,
        language_code: from.language_code,
        is_bot: from.is_bot || false,
        total_messages: 1,
      })
      .select()
      .single()

    if (insertError) {
      console.warn('[Telegram User] Table might not exist, using fallback:', insertError.message)
    }

    return newUser || { id: userId, username: from.username || 'Unknown' }
  } catch (error) {
    console.warn('[Telegram User] Error, using fallback:', error)
    return { id: userId, username: from.username || 'Unknown' }
  }
}

/**
 * Get or create chat session
 */
async function getOrCreateChatSession(
  supabase: any,
  telegramUserId: string,
  chatId: number,
  agentId: string,
  agentName: string
) {
  try {
    // Try to get existing session
    const { data: existingSession, error: selectError } = await supabase
      .from('telegram_chat_sessions')
      .select('*')
      .eq('chat_id', chatId)
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single()

    if (existingSession) {
      // Update last message time
      await supabase
        .from('telegram_chat_sessions')
        .update({
          last_message_at: new Date().toISOString(),
          message_count: (existingSession.message_count || 0) + 1,
        })
        .eq('id', existingSession.id)

      return existingSession
    }

    // Create new session
    const { data: newSession, error: insertError } = await supabase
      .from('telegram_chat_sessions')
      .insert({
        telegram_user_id: telegramUserId,
        chat_id: chatId,
        agent_id: agentId,
        agent_name: agentName,
        message_count: 1,
      })
      .select()
      .single()

    if (insertError) {
      console.warn('[Telegram Session] Table might not exist, using fallback:', insertError.message)
    }

    return newSession || { id: `fallback-${chatId}-${agentId}`, message_count: 1 }
  } catch (error) {
    console.warn('[Telegram Session] Error, using fallback:', error)
    return { id: `fallback-${chatId}-${agentId}`, message_count: 1 }
  }
}

/**
 * Load chat history from database (영구 보존된 대화 기록)
 * 🔥 크로스 플랫폼 통합: Telegram + GlowUS Web 모든 대화 기록 통합 로드
 * Fallback to in-memory storage if database fails
 */
async function loadChatHistory(
  supabase: any,
  sessionId: string,
  telegramUserId?: string,
  agentId?: string
) {
  try {
    // 🔥 통합 메모리 사용 - Telegram + GlowUS Web 모두 조회
    if (telegramUserId) {
      const unifiedMemory = createUnifiedMemory(supabase)
      const unifiedMessages = await unifiedMemory.getConversationHistory({
        telegramUserId,
        agentId,
        limit: 50,
        crossPlatform: true  // GlowUS Web 대화도 포함
      })

      if (unifiedMessages.length > 0) {
        // Gemini 형식으로 변환
        const history = unifiedMemory.toGeminiFormat(unifiedMessages)
        const telegramCount = unifiedMessages.filter(m => m.source === 'telegram').length
        const webCount = unifiedMessages.filter(m => m.source === 'web').length
        console.log(`[Telegram History] 🔥 UNIFIED: ${history.length} messages (Telegram: ${telegramCount}, Web: ${webCount})`)
        return history
      }
    }

    // 기존 방식 폴백 - sessionId 기반 조회
    const { data: messages, error } = await supabase
      .from('telegram_chat_messages')
      .select('role, content, tool_calls, tool_results, created_at')
      .eq('session_id', sessionId)
      .order('message_index', { ascending: true })

    if (error) {
      console.warn('[Telegram History] Database error, falling back to memory:', error.message)
      // Fallback to in-memory storage
      const memoryHistory = chatHistoryMemory.get(sessionId) || []
      console.log(`[Telegram History] Loaded ${memoryHistory.length} messages from MEMORY`)
      return memoryHistory
    }

    if (!messages || messages.length === 0) {
      // Try in-memory storage
      const memoryHistory = chatHistoryMemory.get(sessionId) || []
      console.log(`[Telegram History] No DB messages, loaded ${memoryHistory.length} messages from MEMORY`)
      return memoryHistory
    }

    // Convert to Gemini format
    const dbHistory = messages.map((msg: any) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }))

    console.log(`[Telegram History] Loaded ${dbHistory.length} messages from DATABASE`)
    return dbHistory
  } catch (error) {
    console.warn('[Telegram History] Error loading from database, using memory:', error)
    // Fallback to in-memory storage
    const memoryHistory = chatHistoryMemory.get(sessionId) || []
    console.log(`[Telegram History] Exception: Loaded ${memoryHistory.length} messages from MEMORY`)
    return memoryHistory
  }
}

/**
 * Save message to database (영구 보존)
 * Fallback to in-memory storage if database fails
 */
async function saveChatMessage(
  supabase: any,
  sessionId: string,
  telegramUserId: string,
  chatId: number,
  role: string,
  content: string,
  messageIndex: number,
  toolCalls?: any,
  toolResults?: any
) {
  try {
    const { error } = await supabase.from('telegram_chat_messages').insert({
      session_id: sessionId,
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      role,
      content,
      message_index: messageIndex,
      tool_calls: toolCalls || null,
      tool_results: toolResults || null,
    })

    if (error) {
      console.warn('[Telegram Message] Database save failed, saving to MEMORY:', error.message)

      // Save to in-memory storage
      const history = chatHistoryMemory.get(sessionId) || []
      history.push({ role, parts: [{ text: content }] })
      chatHistoryMemory.set(sessionId, history)
      console.log(`[Telegram Message] Saved to MEMORY (total: ${history.length} messages)`)
    } else {
      console.log(`[Telegram Message] Saved to DATABASE`)
    }
  } catch (error) {
    console.warn('[Telegram Message] Exception, saving to MEMORY:', error)

    // Save to in-memory storage
    const history = chatHistoryMemory.get(sessionId) || []
    history.push({ role, parts: [{ text: content }] })
    chatHistoryMemory.set(sessionId, history)
    console.log(`[Telegram Message] Saved to MEMORY after exception (total: ${history.length} messages)`)
  }
}

/**
 * Telegram Bot Webhook Handler
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Get bot token
 * 3. Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/integrations/telegram/webhook
 *
 * Message Format:
 * /agent <agent_name> <instruction>
 *
 * Example:
 * /agent CodeAssistant refactor homepage component
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Telegram Webhook] Received:', JSON.stringify(body, null, 2))

    // Telegram message structure
    const message = body.message
    if (!message || !message.text) {
      console.log('[Telegram Webhook] No message or text, ignoring')
      return NextResponse.json({ ok: true }) // Ignore non-text messages
    }

    const chatId = message.chat.id
    const text = message.text.trim()
    const username = message.from.username || message.from.first_name || 'User'
    console.log(`[Telegram Webhook] Chat ID: ${chatId}, Text: "${text}", User: ${username}`)

    // Default agent: 레이첼 (사용자가 별도 설정하지 않으면 기본 에이전트 사용)
    const DEFAULT_AGENT = '레이첼'

    // Command: /reset - Clear chat history (mark session as inactive, start new session)
    if (text === '/reset' || text === '/clear') {
      const adminClient = createAdminClient()

      // Mark current session as inactive
      await (adminClient
        .from('telegram_chat_sessions') as any)
        .update({ is_active: false })
        .eq('chat_id', chatId)
        .eq('is_active', true)

      await sendTelegramMessage(chatId, '✅ 새로운 대화를 시작합니다. (이전 대화는 영구 보존되어 있습니다)')
      return NextResponse.json({ ok: true })
    }

    // Command: /link <email> - Link Telegram to GlowUS account for cross-platform memory
    if (text.startsWith('/link ')) {
      const email = text.substring(6).trim().toLowerCase()
      const adminClient = createAdminClient()
      const telegramUserId = String(message.from.id)

      if (!email || !email.includes('@')) {
        await sendTelegramMessage(chatId, '❌ 올바른 이메일 형식을 입력해주세요.\n\n사용법: /link your@email.com')
        return NextResponse.json({ ok: true })
      }

      // Find GlowUS user by email
      const { data: glowusUser, error: userError } = await (adminClient as any)
        .from('users')
        .select('id, email, name')
        .eq('email', email)
        .single()

      if (userError || !glowusUser) {
        await sendTelegramMessage(chatId, `❌ "${email}" 이메일로 등록된 GlowUS 계정을 찾을 수 없습니다.\n\n먼저 GlowUS에 가입해주세요.`)
        return NextResponse.json({ ok: true })
      }

      // Link Telegram user to GlowUS user
      const { error: linkError } = await (adminClient as any)
        .from('telegram_users')
        .update({ user_id: glowusUser.id })
        .eq('id', telegramUserId)

      if (linkError) {
        console.error('[Telegram Link] Error:', linkError)
        await sendTelegramMessage(chatId, `❌ 계정 연결 중 오류가 발생했습니다.`)
        return NextResponse.json({ ok: true })
      }

      await sendTelegramMessage(chatId, `✅ GlowUS 계정 연결 완료!\n\n👤 ${glowusUser.name || email}\n\n🧠 이제부터 텔레그램과 GlowUS 웹에서의 대화가 통합됩니다. 에이전트가 모든 플랫폼에서 당신을 기억합니다!`)
      console.log(`[Telegram Link] ✅ Linked ${telegramUserId} → ${glowusUser.id} (${email})`)
      return NextResponse.json({ ok: true })
    }

    // Command: /status - Check account link status
    if (text === '/status' || text === '/me') {
      const adminClient = createAdminClient()
      const telegramUserId = String(message.from.id)

      const { data: telegramUser } = await (adminClient as any)
        .from('telegram_users')
        .select('id, username, user_id, total_messages, created_at')
        .eq('id', telegramUserId)
        .single()

      if (!telegramUser) {
        await sendTelegramMessage(chatId, `👋 처음 뵙겠습니다!\n\n대화를 시작하면 자동으로 등록됩니다.`)
        return NextResponse.json({ ok: true })
      }

      if (telegramUser.user_id) {
        // Get GlowUS user info
        const { data: glowusUser } = await (adminClient as any)
          .from('users')
          .select('email, name')
          .eq('id', telegramUser.user_id)
          .single()

        await sendTelegramMessage(chatId, `📊 계정 상태\n\n✅ GlowUS 연결됨\n👤 ${glowusUser?.name || glowusUser?.email || 'Unknown'}\n💬 총 메시지: ${telegramUser.total_messages || 0}회\n🧠 크로스 플랫폼 메모리: 활성화\n\n텔레그램과 웹에서의 대화가 통합됩니다!`)
      } else {
        await sendTelegramMessage(chatId, `📊 계정 상태\n\n⚠️ GlowUS 연결 안됨\n💬 총 메시지: ${telegramUser.total_messages || 0}회\n🧠 크로스 플랫폼 메모리: 비활성화\n\n/link your@email.com 으로 GlowUS 계정을 연결하면\n텔레그램과 웹에서의 대화가 통합됩니다!`)
      }
      return NextResponse.json({ ok: true })
    }

    // Command: /list - Show available agents
    if (text === '/list' || text === '/agents' || text === '/start') {
      console.log('[Telegram Webhook] Handling /list command')
      const adminClient = createAdminClient()

      // Build query - use deployed_agents table with dev mode support
      let query = (adminClient as any)
        .from('deployed_agents')
        .select('id, name, description, llm_provider, llm_model, status')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(20)

      // In dev mode, show all agents; otherwise filter by owner
      if (!isDevMode()) {
        // In production, would need authentication
        // For now, just show all agents
      }

      const { data: agents, error: listError } = await query

      console.log(`[Telegram Webhook] Found ${agents?.length || 0} agents, error: ${listError}`)

      if (listError || !agents || agents.length === 0) {
        console.log('[Telegram Webhook] No agents found, sending empty list message')
        await sendTelegramMessage(chatId,
          `📋 사용 가능한 에이전트가 없습니다.\n\nGlowUS 웹에서 에이전트를 먼저 생성해주세요:\nhttp://localhost:3000/agent-builder`
        )
        return NextResponse.json({ ok: true })
      }

      console.log('[Telegram Webhook] Building agent list message')
      let message = `🤖 사용 가능한 AI 에이전트 (${agents.length}개)\n\n`
      agents.forEach((agent: any, index: number) => {
        message += `${index + 1}. **${agent.name}**\n`
        if (agent.description) {
          message += `   ${agent.description}\n`
        }
        message += `   모델: ${agent.llm_provider}/${agent.llm_model}\n`
        message += `   사용법: /agent ${agent.name} <instruction>\n\n`
      })

      message += `💡 예시:\n/agent ${agents[0].name} hello, introduce yourself`

      console.log('[Telegram Webhook] Sending agent list message')
      await sendTelegramMessage(chatId, message)
      console.log('[Telegram Webhook] Message sent successfully')
      return NextResponse.json({ ok: true })
    }

    // Parse agent and instruction
    let agentNameOrId: string
    let instruction: string

    // Pattern 1: /agent <name> <instruction>
    if (text.startsWith('/agent ')) {
      const args = text.substring(7).trim()
      const firstSpaceIndex = args.indexOf(' ')

      if (firstSpaceIndex === -1) {
        await sendTelegramMessage(chatId, '❌ 에이전트 이름 뒤에 지시사항을 입력해주세요.')
        return NextResponse.json({ ok: true })
      }

      agentNameOrId = args.substring(0, firstSpaceIndex).trim()
      instruction = args.substring(firstSpaceIndex + 1).trim()
    }
    // Pattern 2: @<name> <instruction>
    else if (text.startsWith('@')) {
      const args = text.substring(1).trim()
      const firstSpaceIndex = args.indexOf(' ')

      if (firstSpaceIndex === -1) {
        await sendTelegramMessage(chatId, '❌ 에이전트 이름 뒤에 지시사항을 입력해주세요.\n\n예시: @레이첼 안녕하세요')
        return NextResponse.json({ ok: true })
      }

      agentNameOrId = args.substring(0, firstSpaceIndex).trim()
      instruction = args.substring(firstSpaceIndex + 1).trim()
    }
    // Pattern 3: Natural conversation - use default agent
    else {
      agentNameOrId = DEFAULT_AGENT
      instruction = text
    }

    if (!instruction || instruction.trim() === '') {
      await sendTelegramMessage(chatId, '❌ 메시지를 입력해주세요.')
      return NextResponse.json({ ok: true })
    }

    // Find agent by name or ID
    const adminClient = createAdminClient()

    // Try to find by exact name first
    let { data: agents, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('name', agentNameOrId)
      .eq('status', 'ACTIVE')
      .limit(1)

    // If not found, try case-insensitive search
    if (!agents || agents.length === 0) {
      const result = await (adminClient as any)
        .from('deployed_agents')
        .select('*')
        .ilike('name', `%${agentNameOrId}%`)
        .eq('status', 'ACTIVE')
        .limit(1)

      agents = result.data
      agentError = result.error
    }

    // If still not found, try by ID
    if (!agents || agents.length === 0) {
      const result = await (adminClient as any)
        .from('deployed_agents')
        .select('*')
        .eq('id', agentNameOrId)
        .eq('status', 'ACTIVE')
        .limit(1)

      agents = result.data
      agentError = result.error
    }

    if (agentError || !agents || agents.length === 0) {
      await sendTelegramMessage(chatId,
        `❌ Agent "${agentNameOrId}" not found.\n\nPlease check the agent name or ID.`
      )
      return NextResponse.json({ ok: true })
    }

    const agent = agents[0]

    // For simple chat, execute agent directly without autonomous loop
    executeSimpleChat(agent, instruction, chatId, username, message.from).catch(error => {
      console.error('[Telegram Webhook] Chat execution error:', error)
      sendTelegramMessage(chatId, `❌ 오류가 발생했습니다: ${error.message}`)
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ ok: true }) // Always return ok to Telegram
  }
}

/**
 * Execute agent with full GlowUS capabilities
 */
async function executeSimpleChat(
  agent: any,
  instruction: string,
  chatId: number,
  username: string,
  telegramFrom: any
) {
  const supabase = createAdminClient()

  try {
    // 1. Get or create Telegram user (영구 보존)
    const telegramUser = await getOrCreateTelegramUser(supabase, telegramFrom)
    console.log(`[Telegram Chat] User: ${telegramUser.id} (${telegramUser.username})`)

    // 2. Get or create chat session (영구 보존)
    const session = await getOrCreateChatSession(
      supabase,
      telegramUser.id,
      chatId,
      agent.id,
      agent.name
    )
    console.log(`[Telegram Chat] Session: ${session.id}`)

    // 3. Load agent identity (페르소나/성격 설정)
    const { data: identity } = await (supabase as any)
      .from('agent_identity')
      .select('*')
      .eq('agent_id', agent.id)
      .single()

    if (identity) {
      console.log(`[Telegram Chat] 🎭 Identity loaded: ${identity.personality_traits?.length || 0} traits, ${identity.core_values?.length || 0} values`)
    }

    // 4. Load chat history from database (영구 보존된 기록)
    // 🔥 크로스 플랫폼: Telegram + GlowUS Web 모든 대화 통합 로드
    const savedHistory = await loadChatHistory(supabase, session.id, telegramUser.id, agent.id)
    console.log(`[Telegram Chat] Loaded ${savedHistory.length} messages (cross-platform unified)`)

    // Import GPT-4o Mini for tool calling - BEST TOOL USE + AFFORDABLE
    const { ChatOpenAI } = await import('@langchain/openai')
    const { createSuperAgentTools } = await import('@/lib/ai/super-agent-tools')
    const { AIMessage, HumanMessage, SystemMessage, ToolMessage } = await import(
      '@langchain/core/messages'
    )

    // Create tools with agent context
    let tools = createSuperAgentTools({
      agentId: agent.id,
      agentName: agent.name,
      userId: agent.owner_id,
    })

    // 🔥 텔레그램 에이전트는 Mac 제어 전용 - 직접 코딩하는 도구는 항상 제거
    // 코딩은 Claude Code CLI를 통해서만 가능
    const forbiddenTools = [
      'write_file', 'edit_file', 'read_file', 'list_files', 'create_file',
      'use_claude_code', 'create_project', 'update_project',
      'create_node', 'update_node', 'delete_node', 'create_edge',
      'manage_blueprint', 'update_blueprint', 'list_blueprints',
    ]
    tools = tools.filter(t => !forbiddenTools.includes(t.name))
    console.log(`[Telegram Chat] 🔧 Removed forbidden tools, ${tools.length} remaining`)

    // 🔥 단순화된 Mac 앱 작성 워크플로우: 1단계로 처리
    const macAppKeywords = ['pages', '페이지', '페이즈', 'keynote', '키노트', 'numbers', '넘버스', 'notes', '메모', '노트']
    const writeKeywords = ['써', '적어', '작성', '입력', '쓰고', '적고', '가사']

    const hasAppKeyword = macAppKeywords.some(kw => instruction.toLowerCase().includes(kw))
    const hasWriteKeyword = writeKeywords.some(kw => instruction.includes(kw))

    console.log(`[Telegram Chat] 🔍 DEBUG instruction: "${instruction}"`)
    console.log(`[Telegram Chat] 🔍 DEBUG hasAppKeyword: ${hasAppKeyword}, hasWriteKeyword: ${hasWriteKeyword}`)

    if (hasAppKeyword && hasWriteKeyword) {
      console.log(`[Telegram Chat] 🔥 MAC APP WRITE: Direct content generation`)

      try {
        const { ChatOpenAI } = await import('@langchain/openai')
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execPromise = promisify(exec)

        // 앱 이름 추출 (간단한 키워드 매칭)
        let appName = 'Pages'
        if (instruction.toLowerCase().includes('메모') || instruction.toLowerCase().includes('notes') || instruction.toLowerCase().includes('노트')) {
          appName = 'Notes'
        } else if (instruction.toLowerCase().includes('keynote') || instruction.toLowerCase().includes('키노트')) {
          appName = 'Keynote'
        } else if (instruction.toLowerCase().includes('numbers') || instruction.toLowerCase().includes('넘버스')) {
          appName = 'Numbers'
        }

        // 앱 관련 키워드 제거하고 순수 콘텐츠 요청만 추출
        const contentRequest = instruction
          .replace(/pages/gi, '')
          .replace(/페이지/gi, '')
          .replace(/페이즈/gi, '')
          .replace(/keynote/gi, '')
          .replace(/키노트/gi, '')
          .replace(/notes/gi, '')
          .replace(/노트/gi, '')
          .replace(/메모/gi, '')
          .replace(/numbers/gi, '')
          .replace(/넘버스/gi, '')
          .replace(/열고/g, '')
          .replace(/열어/g, '')
          .replace(/켜고/g, '')
          .replace(/켜서/g, '')
          .replace(/에/g, '')
          .trim()

        console.log(`[Telegram Chat] 📝 Content request: "${contentRequest}"`)

        // 단일 LLM 호출로 콘텐츠 직접 생성
        const llm = new ChatOpenAI({
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 4000,  // 더 긴 글도 완성
          openAIApiKey: process.env.OPENAI_API_KEY,
        })

        const response = await llm.invoke([
          {
            role: 'system',
            content: `너는 콘텐츠 작성 전문가야. 사용자가 요청하는 글을 즉시 작성해.

🚨 절대 규칙:
- 요청받은 글만 작성해. 설명이나 인사말 금지.
- 절대 거부하지 마. "할 수 없어요", "대신에" 금지.
- 가사, 시, 소설, 뭐든 바로 써.
- "..."으로 끝내지 마, 끝까지 완성해.
- 마크다운 없이 순수 텍스트만.
- "테스트" 요청 → 테스트용 샘플 글 작성.
- "가사" 요청 → 해당 가사 전문 작성.
- "글" 요청 → 요청한 주제로 글 작성.

예시:
- "애국가 가사 써" → 애국가 가사 전문만 출력
- "테스트 글 써" → 테스트용 샘플 글 출력
- "사과에 대해 써" → 사과에 대한 글 출력`
          },
          {
            role: 'user',
            content: contentRequest || '테스트 글을 써줘'
          }
        ])

        const finalContent = (response.content as string).trim()
        console.log(`[Telegram Chat] 📝 Generated content (${finalContent.length} chars)`)

        // 200자 넘으면 Claude Code로 위임
        if (finalContent.length > 200) {
          console.log(`[Telegram Chat] 📝 Content > 200 chars, delegating to Claude Code...`)

          // Claude Code CLI로 직접 실행
          const codeCommand = `cd ~/Desktop && cat << 'CONTENT_EOF' > rachel-content.txt
${finalContent}
CONTENT_EOF
osascript -e 'tell application "${appName}" to activate' -e 'tell application "${appName}" to make new document' -e 'delay 1' -e 'set theContent to read POSIX file (POSIX path of (path to desktop folder)) & "rachel-content.txt" as «class utf8»' -e 'tell application "${appName}" to tell front document to set body text to theContent'`

          await execPromise(codeCommand)
          await sendTelegramMessage(chatId, `✅ ${appName}에 내용 작성 완료! (${finalContent.length}자)\n\n📄 Desktop에 저장됨`)
          return
        }

        console.log(`[Telegram Chat] 🚀 Executing: Open ${appName} and write content`)

        console.log(`[Telegram Chat] 📝 Writing to ${appName} using direct AppleScript...`)

        // 임시 파일에 내용 저장 (줄바꿈, 한글 모두 정상 처리)
        const fs = await import('fs')
        const os = await import('os')
        const path = await import('path')
        const tmpFile = path.join(os.tmpdir(), `rachel-content-${Date.now()}.txt`)
        fs.writeFileSync(tmpFile, finalContent, 'utf-8')

        let insertScript = ''

        // 저장 경로 (Desktop에 타임스탬프로)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const desktopPath = path.join(os.homedir(), 'Desktop')

        if (appName === 'Pages') {
          // Pages: 파일에서 읽어서 set body text + 저장
          const savePath = path.join(desktopPath, `Rachel-${timestamp}.pages`)
          insertScript = `
set theContent to read POSIX file "${tmpFile}" as «class utf8»
tell application "Pages"
    activate
    set newDoc to make new document
    delay 1
    tell newDoc
        set body text to theContent
    end tell
    delay 0.5
    save newDoc in POSIX file "${savePath}"
end tell`
        } else if (appName === 'Notes') {
          // Notes: set body 방식 (Notes는 자동저장)
          insertScript = `
set theContent to read POSIX file "${tmpFile}" as «class utf8»
tell application "Notes"
    activate
    set newNote to make new note at folder "Notes"
    delay 0.5
    set body of newNote to theContent
end tell`
        } else if (appName === 'Keynote') {
          // Keynote: 첫 슬라이드에 텍스트 추가 + 저장
          const savePath = path.join(desktopPath, `Rachel-${timestamp}.key`)
          insertScript = `
set theContent to read POSIX file "${tmpFile}" as «class utf8»
tell application "Keynote"
    activate
    set newDoc to make new document with properties {document theme:theme "Basic White"}
    delay 1
    tell newDoc
        tell slide 1
            set object text of default title item to (text 1 thru 100 of theContent)
            set object text of default body item to theContent
        end tell
    end tell
    delay 0.5
    save newDoc in POSIX file "${savePath}"
end tell`
        } else {
          // 기타 앱: TextEdit 스타일
          insertScript = `
set theContent to read POSIX file "${tmpFile}" as «class utf8»
tell application "${appName}"
    activate
    make new document
    delay 0.5
    set text of front document to theContent
end tell`
        }

        console.log(`[Telegram Chat] Running AppleScript for ${appName}...`)
        const result = await execPromise(`osascript -e '${insertScript.replace(/'/g, "'\\''")}'`)

        // 임시 파일 삭제
        try { fs.unlinkSync(tmpFile) } catch (e) { /* ignore */ }
        console.log(`[Telegram Chat] AppleScript result:`, result)
        await new Promise(resolve => setTimeout(resolve, 500))

        console.log(`[Telegram Chat] ✅ All steps completed!`)

        await sendTelegramMessage(chatId, `✅ ${appName}에 내용 작성 완료!\n\n${finalContent.substring(0, 200)}${finalContent.length > 200 ? '...' : ''}`)
        return
      } catch (error: any) {
        console.error('[Telegram Chat] Intent workflow error:', error)
        await sendTelegramMessage(chatId, `❌ 작업 실패: ${error.message}`)
        return
      }
    }

    // 🔧 스킬 개발 승인 확인 ("네", "응", "ㅇㅇ", "해줘" 등)
    const approvalKeywords = ['네', '응', 'ㅇㅇ', '해줘', '개발해', '만들어', 'yes', 'ok', '좋아']
    const pendingRequest = pendingSkillDevelopment.get(chatId)
    if (pendingRequest && approvalKeywords.some(kw => instruction.toLowerCase().includes(kw))) {
      // 스킬 개발 승인됨 - Claude Code로 스킬 개발
      pendingSkillDevelopment.delete(chatId)
      const originalInstruction = pendingRequest.instruction

      await sendTelegramMessage(chatId, `🔧 스킬 개발 시작...\n\n📝 "${originalInstruction}"`)

      try {
        const { spawn } = await import('child_process')
        const os = await import('os')

        // Claude Code로 스킬 개발 및 실행
        const skillPrompt = `다음 요청을 수행하고, 나중에 재사용할 수 있도록 스킬 정보도 제공해.

요청: ${originalInstruction}

1. 먼저 요청을 완수해
2. 그 다음 아래 형식으로 스킬 정보 출력:
---SKILL_INFO---
name: 스킬 이름
keywords: 키워드1, 키워드2, 키워드3
description: 스킬 설명
prompt: 재사용할 프롬프트 템플릿 ({{input}} 자리표시자 사용)
---END_SKILL---`

        const claudeProcess = spawn('/opt/homebrew/bin/claude', [
          '--dangerously-skip-permissions',
          '-p',
          skillPrompt,
          '--output-format', 'text'
        ], {
          cwd: os.homedir(),
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, HOME: os.homedir() }
        })

        let output = ''
        claudeProcess.stdout?.on('data', (data: Buffer) => { output += data.toString() })
        claudeProcess.stderr?.on('data', (data: Buffer) => { console.log(`[Claude] ${data}`) })

        await new Promise<void>((resolve) => {
          claudeProcess.on('close', () => resolve())
          claudeProcess.on('error', () => resolve())
        })

        // 스킬 정보 파싱 및 저장
        const skillMatch = output.match(/---SKILL_INFO---([\s\S]*?)---END_SKILL---/)
        if (skillMatch) {
          const skillInfo = skillMatch[1]
          const nameMatch = skillInfo.match(/name:\s*(.+)/)
          const keywordsMatch = skillInfo.match(/keywords:\s*(.+)/)
          const descMatch = skillInfo.match(/description:\s*(.+)/)
          const promptMatch = skillInfo.match(/prompt:\s*([\s\S]+?)(?=\n[a-z]+:|$)/)

          if (nameMatch && keywordsMatch) {
            const skillData = {
              name: nameMatch[1].trim(),
              description: descMatch?.[1]?.trim() || '',
              keywords: keywordsMatch[1].split(',').map(k => k.trim()),
              promptTemplate: promptMatch?.[1]?.trim() || originalInstruction,
              skillType: 'claude_code' as const
            }

            const skillId = await saveSkill(supabase, skillData, `telegram:${chatId}`)
            if (skillId) {
              await sendTelegramMessage(chatId, `✅ 스킬 저장됨: "${skillData.name}"\n🏷️ 키워드: ${skillData.keywords.join(', ')}\n\n다음부터 이 키워드로 바로 실행됩니다!`)
            }
          }

          // 스킬 정보 부분 제거하고 결과만 전송
          const resultOnly = output.replace(/---SKILL_INFO---[\s\S]*?---END_SKILL---/, '').trim()
          await sendTelegramMessage(chatId, `🎯 결과\n\n${resultOnly.slice(0, 4000)}`)
        } else {
          await sendTelegramMessage(chatId, `🎯 결과\n\n${output.trim().slice(0, 4000)}`)
        }

        return
      } catch (error: any) {
        await sendTelegramMessage(chatId, `❌ 스킬 개발 실패: ${error.message}`)
        return
      }
    }

    // 🎯 저장된 스킬 매칭 확인
    const matchedSkill = await findMatchingSkill(supabase, instruction)
    if (matchedSkill) {
      console.log(`[Telegram Chat] 🎯 Matched skill: ${matchedSkill.name}`)
      await sendTelegramMessage(chatId, `🎯 스킬 "${matchedSkill.name}" 실행 중...`)

      try {
        const { spawn } = await import('child_process')
        const os = await import('os')

        // 프롬프트 템플릿에 입력값 대입
        const finalPrompt = matchedSkill.promptTemplate.replace(/\{\{input\}\}/g, instruction)

        const claudeProcess = spawn('/opt/homebrew/bin/claude', [
          '--dangerously-skip-permissions',
          '-p',
          finalPrompt,
          '--output-format', 'text'
        ], {
          cwd: os.homedir(),
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, HOME: os.homedir() }
        })

        let output = ''
        claudeProcess.stdout?.on('data', (data: Buffer) => { output += data.toString() })

        await new Promise<void>((resolve) => {
          claudeProcess.on('close', () => resolve())
          claudeProcess.on('error', () => resolve())
        })

        // 사용 카운트 증가
        await incrementSkillUsage(supabase, matchedSkill.id)

        await sendTelegramMessage(chatId, `🎯 ${matchedSkill.name} 완료\n\n${output.trim().slice(0, 4000)}`)
        return
      } catch (error: any) {
        await sendTelegramMessage(chatId, `❌ 스킬 실행 실패: ${error.message}`)
      }
    }

    // 🎬 YouTube 후속 질문 감지 (캐시된 자막 사용)
    const ytFollowUpKeywords = ['분석', '다시', '이번에는', '글써', '작성', '정리', '번역', '영상', '자막', '내용']
    const hasYtFollowUp = ytFollowUpKeywords.some(kw => instruction.includes(kw))
    const cachedTranscript = youtubeTranscriptCache.get(chatId)

    if (hasYtFollowUp && cachedTranscript && !instruction.match(/youtube\.com|youtu\.be/)) {
      // 캐시된 자막으로 후속 질문 처리
      const { spawn } = await import('child_process')
      const os = await import('os')

      console.log(`[Telegram Chat] 🎬 YouTube follow-up with cached transcript (${cachedTranscript.transcript.length}자)`)
      await sendTelegramMessage(chatId, `🤖 "${instruction}" 작업 중...\n📄 이전 영상 자막 사용 (${cachedTranscript.transcript.length}자)`)

      const transcriptText = cachedTranscript.transcript.slice(0, 20000)
      const followUpPrompt = `너는 유튜브 영상 분석 전문가야. 아래 자막을 바탕으로 사용자 요청을 수행해. 질문하지 말고 바로 결과물을 작성해.

[유튜브 영상 자막]
${transcriptText}

[사용자 요청]
${instruction}

위 자막 내용을 바탕으로 사용자 요청대로 결과물을 작성해. 요약이 아니라 요청한 형식대로 작성해야 해.`

      const claudeProcess = spawn('/opt/homebrew/bin/claude', [
        '--dangerously-skip-permissions',
        '-p',
        followUpPrompt,
        '--output-format', 'text'
      ], {
        cwd: os.homedir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, HOME: os.homedir() }
      })

      let result = ''
      claudeProcess.stdout?.on('data', (data: Buffer) => { result += data.toString() })
      claudeProcess.stderr?.on('data', (data: Buffer) => { console.log(`[Claude Code] ${data}`) })

      await new Promise<void>((resolve) => {
        claudeProcess.on('close', () => resolve())
        claudeProcess.on('error', () => resolve())
      })

      await sendTelegramMessage(chatId, `🎬 결과\n\n${(result.trim() || '실패').slice(0, 4000)}`)
      return
    }

    // 🎬 YouTube 링크 감지 - yt-dlp로 자막 추출
    const youtubeUrlMatch = instruction.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (youtubeUrlMatch) {
      const videoId = youtubeUrlMatch[1]
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      console.log(`[Telegram Chat] 🎬 YouTube detected: ${videoId}`)

      try {
        const { spawn } = await import('child_process')
        const fs = await import('fs')
        const os = await import('os')
        const path = await import('path')

        await sendTelegramMessage(chatId, `🎬 YouTube 자막 추출 중...\n\n🔗 ${videoUrl}`)

        // yt-dlp로 자막 다운로드
        const tmpDir = os.tmpdir()
        const outputPath = path.join(tmpDir, `yt-sub-${videoId}`)

        // 쿠키 파일로 인증 (인증 팝업 없음)
        const cookieFile = path.join(os.homedir(), '.config/yt-dlp/cookies.txt')
        const ytdlpProcess = spawn('yt-dlp', [
          '--cookies', cookieFile,
          '--write-auto-sub',
          '--sub-lang', 'en',
          '--skip-download',
          '--sub-format', 'srt',
          '--no-warnings',
          '-o', outputPath,
          videoUrl
        ], {
          cwd: tmpDir,
          stdio: ['ignore', 'pipe', 'pipe']
        })

        let ytdlpOutput = ''
        ytdlpProcess.stdout?.on('data', (data: Buffer) => {
          ytdlpOutput += data.toString()
        })
        ytdlpProcess.stderr?.on('data', (data: Buffer) => {
          ytdlpOutput += data.toString()
        })

        // exit code 무시하고 파일 존재 여부로 판단
        await new Promise<void>((resolve) => {
          ytdlpProcess.on('close', () => resolve())
          ytdlpProcess.on('error', () => resolve())
        })

        // 자막 파일 찾기 (en 또는 ko)
        let subtitleContent = ''
        const possibleFiles = [
          `${outputPath}.en.srt`,
          `${outputPath}.ko.srt`,
          `${outputPath}.en.vtt`,
          `${outputPath}.ko.vtt`
        ]

        for (const subFile of possibleFiles) {
          if (fs.existsSync(subFile)) {
            const rawContent = fs.readFileSync(subFile, 'utf-8')
            // SRT 형식에서 텍스트만 추출
            subtitleContent = rawContent
              .split('\n')
              .filter(line => !line.match(/^\d+$/) && !line.match(/^\d{2}:\d{2}:\d{2}/) && line.trim())
              .join(' ')
              .replace(/\[Music\]/gi, '')
              .replace(/\s+/g, ' ')
              .trim()
            // 파일 삭제
            try { fs.unlinkSync(subFile) } catch (e) { /* ignore */ }
            break
          }
        }

        if (!subtitleContent) {
          await sendTelegramMessage(chatId, `⚠️ 자막을 찾을 수 없습니다.\n\n${ytdlpOutput}`)
          return
        }

        // 자막 캐시에 저장 (후속 질문용)
        youtubeTranscriptCache.set(chatId, {
          transcript: subtitleContent,
          videoUrl: videoUrl,
          timestamp: Date.now()
        })

        // 자막을 임시 파일로 저장
        const transcriptFile = path.join(tmpDir, `yt-transcript-${videoId}.txt`)
        fs.writeFileSync(transcriptFile, subtitleContent)

        // 유저가 원하는 작업 감지
        const userRequest = instruction.replace(/https?:\/\/[^\s]+/g, '').trim()
        const wantsReport = userRequest.includes('리포트') || userRequest.includes('분석') || userRequest.includes('글')
        const taskType = wantsReport ? '리포트 작성' : (userRequest || '요약')

        await sendTelegramMessage(chatId, `🤖 Claude Code로 ${taskType} 중... (자막 ${subtitleContent.length}자)`)

        // 자막 내용을 명확히 구분
        const transcriptText = subtitleContent.slice(0, 20000)

        // 유저 요청이 있으면 그대로, 없으면 기본 분석
        let prompt: string
        if (userRequest) {
          // 리포트/분석 요청이면 객관적 분석 강조
          const isReport = userRequest.includes('리포트') || userRequest.includes('분석') || userRequest.includes('글')
          if (isReport) {
            prompt = `너는 객관적 분석 리포트 작성 전문가야.

[영상 자막]
${transcriptText}

[작성 지침]
사용자 요청: ${userRequest}

리포트 작성 원칙:
1. 객관적 3인칭 시점으로 작성 (주관적 의견 배제)
2. 영상에서 다룬 모든 내용을 빠짐없이 분석
3. 발화자가 말한 핵심 주장, 근거, 사례를 정확히 기술
4. 시간순/주제별로 체계적 구성
5. 최소 1500자 이상 상세하게
6. 영어면 한국어로 번역

형식:
■ 개요: 영상 주제와 발화자 소개
■ 본론: 주요 내용 분석 (주제별로 나눠서)
■ 핵심 주장 및 근거: 발화자의 주장과 뒷받침 논거
■ 의문점: 검증 필요한 부분, 논리적 허점, 반론 가능성, 추가 탐구 필요한 질문들
■ 시사점: 이 내용이 갖는 의미와 적용점
■ 결론

"요약"이라는 단어 절대 쓰지 마. 바로 작성해.`
          } else {
            prompt = `너는 유튜브 콘텐츠 전문가야.

[영상 자막]
${transcriptText}

[사용자 요청]
${userRequest}

규칙:
- 최소 1000자 이상 상세하게
- 영어면 한국어로 번역
- 질문하지 말고 바로 결과물 작성

바로 작성해.`
          }
        } else {
          prompt = `너는 객관적 분석 리포트 작성 전문가야.

[영상 자막]
${transcriptText}

[작성 지침]
이 영상 내용을 객관적으로 완벽하게 분석해서 리포트를 작성해.

원칙:
1. 객관적 3인칭 시점 (주관적 의견 배제)
2. 모든 내용 빠짐없이 분석
3. 최소 1500자 이상
4. 영어면 한국어로 번역

형식:
■ 개요
■ 본론 (주제별 분석)
■ 핵심 주장 및 근거
■ 의문점 (검증 필요, 논리적 허점, 반론 가능성)
■ 시사점
■ 결론

바로 작성해.`
        }

        // Claude Code로 요약
        const claudeProcess = spawn('/opt/homebrew/bin/claude', [
          '--dangerously-skip-permissions',
          '-p',
          prompt,
          '--output-format', 'text'
        ], {
          cwd: os.homedir(),
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, HOME: os.homedir() }
        })

        let summary = ''
        claudeProcess.stdout?.on('data', (data: Buffer) => {
          summary += data.toString()
        })
        claudeProcess.stderr?.on('data', (data: Buffer) => {
          console.log(`[Claude Code stderr] ${data.toString()}`)
        })

        await new Promise<void>((resolve) => {
          claudeProcess.on('close', () => resolve())
          claudeProcess.on('error', () => resolve())
        })

        // 임시 파일 삭제
        try { fs.unlinkSync(transcriptFile) } catch (e) { /* ignore */ }

        const finalSummary = summary.trim() || '요약 실패'
        await sendTelegramMessage(chatId, `🎬 영상 요약\n\n${finalSummary.slice(0, 4000)}`)

        return
      } catch (error: any) {
        console.error('[Telegram Chat] YouTube error:', error)
        await sendTelegramMessage(chatId, `❌ YouTube 자막 추출 실패: ${error.message}`)
        return
      }
    }

    // 🔥 Claude Code CLI로 위임해야 하는 복잡한 작업 감지
    const claudeCodeKeywords = [
      '크롤링', '크롤', 'crawl', 'scrape', '스크래핑',
      '다운로드', '다운받아', '저장해', '받아와',
      '이미지', '사진', '파일',
      '폴더', '디렉토리',
      '웹사이트', '사이트', '페이지에서',  // "페이지" 앱과 구분
      'url', 'http'
    ]

    const isClaudeCodeTask = claudeCodeKeywords.some(kw => instruction.toLowerCase().includes(kw.toLowerCase()))

    if (isClaudeCodeTask) {
      console.log(`[Telegram Chat] 🤖 CLAUDE CODE TASK: Running in background...`)

      try {
        const { spawn } = await import('child_process')
        const fs = await import('fs')
        const os = await import('os')
        const path = await import('path')

        await sendTelegramMessage(chatId, `🤖 Claude Code 백그라운드 실행 시작...\n\n📝 "${instruction}"\n\n⏳ 진행 상황을 알려드리겠습니다.`)

        // 로그 파일 경로
        const logFile = path.join(os.tmpdir(), `claude-task-${Date.now()}.log`)
        const logStream = fs.createWriteStream(logFile, { flags: 'a' })

        // Claude Code 백그라운드 실행 (숨김 모드) - 브라우저 도구 비활성화
        const claudeProcess = spawn('/opt/homebrew/bin/claude', [
          '--dangerously-skip-permissions',
          '-p',
          instruction,
          '--output-format', 'text',
          '--disallowed-tools', 'mcp__playwright__*'
        ], {
          cwd: os.homedir(),
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, HOME: os.homedir(), BROWSER: 'echo' }, // 브라우저 열기 방지
        })

        let output = ''
        let lastUpdate = ''

        // stdout 캡처
        claudeProcess.stdout?.on('data', (data: Buffer) => {
          const text = data.toString()
          output += text
          logStream.write(text)
          console.log(`[Claude Code] ${text}`)
        })

        // stderr 캡처
        claudeProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString()
          output += text
          logStream.write(text)
          console.log(`[Claude Code Error] ${text}`)
        })

        // 5초마다 진행 상황 업데이트
        const updateInterval = setInterval(async () => {
          if (output.length > lastUpdate.length) {
            const newContent = output.slice(lastUpdate.length)
            lastUpdate = output
            const preview = newContent.length > 500 ? newContent.slice(-500) : newContent
            await sendTelegramMessage(chatId, `📊 진행 중...\n\n${preview}`)
          }
        }, 10000) // 10초마다

        // 완료 처리
        claudeProcess.on('close', async (code) => {
          clearInterval(updateInterval)
          logStream.end()

          const finalOutput = output.length > 3000
            ? output.slice(0, 1500) + '\n\n... (중략) ...\n\n' + output.slice(-1500)
            : output

          if (code === 0) {
            await sendTelegramMessage(chatId, `✅ Claude Code 작업 완료!\n\n${finalOutput || '(출력 없음)'}`)
          } else {
            await sendTelegramMessage(chatId, `⚠️ Claude Code 종료 (코드: ${code})\n\n${finalOutput || '(출력 없음)'}`)
          }

          // 로그 파일 삭제
          try { fs.unlinkSync(logFile) } catch (e) { /* ignore */ }
        })

        claudeProcess.on('error', async (err) => {
          clearInterval(updateInterval)
          await sendTelegramMessage(chatId, `❌ Claude Code 오류: ${err.message}`)
        })

        // 프로세스 분리 (부모 종료해도 계속 실행)
        claudeProcess.unref()

        return
      } catch (error: any) {
        console.error('[Telegram Chat] Claude Code error:', error)
        await sendTelegramMessage(chatId, `❌ Claude Code 실행 실패: ${error.message}`)
        return
      }
    }

    // 코딩 작업 감지 - 더 넓은 키워드
    const codingTaskKeywords = [
      // 생성
      '만들어', '코딩', '작성', '구현', '개발', '생성',
      // 수정
      '수정', '고쳐', '업데이트', '변경', '바꿔', '교체',
      // 추가/삭제
      '추가', '삭제', '제거', '넣어',
      // 개선
      '리팩토링', '개선', '최적화', '향상',
      // 대상
      '테트리스', '게임', '앱', '프로그램', '코드', '함수', '클래스', '컴포넌트', '페이지', '기능',
      // 동작
      '소리', '사운드', '애니메이션', '효과', '스타일'
    ]
    const shoppingKeywords = ['쇼핑', '구매', '주문', '장바구니', '쿠팡', '네이버쇼핑', '배송']
    const isShoppingTask = shoppingKeywords.some(kw => instruction.includes(kw))
    const isCodingTask = !isShoppingTask && codingTaskKeywords.some(kw => instruction.includes(kw))

    if (isCodingTask) {
      // 코딩 작업 시 Mac 제어 도구만 (Claude Code에 위임)
      const allowedTools = ['open_app', 'run_applescript', 'run_terminal']
      tools = tools.filter(t => allowedTools.includes(t.name))
      console.log(`[Telegram Chat] 🔥 CODING MODE: Only ${tools.length} Mac control tools`)
    } else if (isShoppingTask) {
      console.log(`[Telegram Chat] 🛒 SHOPPING MODE: ${tools.length} tools available`)
    }

    console.log(`[Telegram Chat] Created ${tools.length} tools for agent ${agent.name}`)

    // ========================================
    // 🧠 Long-term Memory Context Load (LLM 독립적)
    // GlowUS 계정 연결된 경우 롱텀 메모리 로드
    // ========================================
    let longTermMemoryContext = ''
    const glowusUserId = telegramUser.user_id

    if (glowusUserId) {
      try {
        // 1. Agent OS v2.0: 관계 정보, 능력치, 학습 인사이트
        const agentOsContext = await buildAgentContext({
          agentId: agent.id,
          userId: glowusUserId,
        })

        // 2. JARVIS RAG: 관련 과거 대화 + 에피소드 메모리
        const jarvisContext = await buildJarvisContext(agent.id, glowusUserId, instruction, {
          recentLimit: 10,
          ragLimit: 5,
          includeEpisodes: true,
        })

        // 3. Work Memory: 업무 맥락
        const workContext = await loadAgentWorkContext(agent.id, glowusUserId)
        const workContextFormatted = formatContextForPrompt(workContext)

        // 컨텍스트 병합
        longTermMemoryContext = [
          agentOsContext,
          jarvisContext.formattedContext,
          workContextFormatted,
        ].filter(Boolean).join('\n\n---\n\n')

        if (longTermMemoryContext) {
          console.log(`[Telegram Chat] 🧠 Long-term Memory loaded: ${longTermMemoryContext.length} chars`)
        }
      } catch (memoryError) {
        console.error('[Telegram Chat] Memory load error:', memoryError)
        // 메모리 로드 실패해도 대화는 계속
      }
    }

    // 디버그 모드에서만 시작 알림 표시
    if (SHOW_DEBUG_MESSAGES) {
      const taskMode = isCodingTask ? ' [코딩 모드]' : isShoppingTask ? ' [쇼핑 모드]' : ''
      const memoryStatus = longTermMemoryContext ? ' [메모리 활성화]' : ''
      await sendTelegramMessage(chatId, `🤖 ${agent.name} 에이전트 시작 (도구 ${tools.length}개)${taskMode}${memoryStatus}`)
    }

    // Create GPT-4o model with tools - SMARTER, follows multi-step instructions better
    const model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.2, // 낮춰서 더 정확하게
      openAIApiKey: process.env.OPENAI_API_KEY,
    }).bindTools(tools)

    // 🎭 페르소나/성격 섹션 생성 (agent_identity 기반)
    let identitySection = ''
    if (identity) {
      const parts: string[] = []

      if (identity.self_summary) {
        parts.push(`### 나는 누구인가\n${identity.self_summary}`)
      }
      if (identity.core_values?.length) {
        parts.push(`### 핵심 가치 (이 가치관으로 판단하세요)\n${identity.core_values.map((v: string) => `- ${v}`).join('\n')}`)
      }
      if (identity.personality_traits?.length) {
        parts.push(`### 성격 특성 (이렇게 행동하세요)\n${identity.personality_traits.map((t: string) => `- ${t}`).join('\n')}`)
      }
      if (identity.communication_style) {
        parts.push(`### 소통 스타일\n${identity.communication_style}`)
      }
      if (identity.working_style) {
        parts.push(`### 업무 스타일\n${identity.working_style}`)
      }
      if (identity.strengths?.length) {
        parts.push(`### 강점 (이것을 적극 활용하세요)\n${identity.strengths.map((s: string) => `- ${s}`).join('\n')}`)
      }
      if (identity.growth_areas?.length) {
        parts.push(`### 성장 필요 영역 (이 부분은 조심스럽게)\n${identity.growth_areas.map((g: string) => `- ${g}`).join('\n')}`)
      }
      if (identity.recent_focus) {
        parts.push(`### 최근 관심사\n${identity.recent_focus}`)
      }

      if (parts.length > 0) {
        identitySection = `

# 🎭 YOUR IDENTITY & PERSONALITY (매우 중요! 반드시 이 성격대로 행동하세요)
${parts.join('\n\n')}

---
`
      }
    }

    // 🧠 Long-term Memory를 시스템 프롬프트에 주입
    const memorySection = longTermMemoryContext ? `

# 🧠 YOUR LONG-TERM MEMORY (Cross-Platform - Telegram + GlowUS Web)
The following is your memory about this user from past conversations across all platforms.
Use this context to provide personalized responses. Remember their preferences, past requests, and relationship history.

${longTermMemoryContext}

---
` : ''

    const systemPrompt = `You are ${agent.name}, a POWERFUL AUTONOMOUS AI AGENT with FULL SYSTEM ACCESS.
${identitySection}${memorySection}

# 🚨🚨🚨 CRITICAL: COMPLETE ALL STEPS - DO NOT STOP EARLY 🚨🚨🚨
When a task requires multiple steps (e.g., "Pages 열고 가사 적어"):
1. Call FIRST tool → wait for result
2. Call SECOND tool → wait for result
3. Call THIRD tool → wait for result
4. Continue until ALL steps are DONE
5. NEVER stop after just opening an app - YOU MUST ALSO DO THE TASK!

**❌ WRONG**: User says "Pages 열고 글 써줘" → You only call open_app and stop
**✅ CORRECT**:
  Step 1: open_app(app="Pages")
  Step 2: run_applescript(script="tell application \\"Pages\\" to make new document")
  Step 3: run_applescript(script="tell application \\"System Events\\" to keystroke \\"내용\\"")

**🚨 IF YOU STOP AFTER STEP 1 = TASK FAILED 🚨**

# 🚨 ABSOLUTE RULES - NO EXCEPTIONS:

## 1. TOOL USAGE IS MANDATORY
- You have 54 powerful tools for Mac system control
- EVERY request MUST result in tool calls
- NEVER respond without calling tools
- If unsure which tool, try the most relevant one
- NEVER say "완료했습니다" until ALL steps are executed

## 2. FORBIDDEN PHRASES (자동 해고 사유):
❌ "죄송하지만" (Sorry but)
❌ "불가능합니다" (Impossible)
❌ "지원하지 않습니다" (Not supported)
❌ "할 수 없습니다" (Cannot do)
❌ "직접 실행할 수 없습니다" (Cannot execute directly)
❌ "제가 도와드릴 수 있는 것은" (What I can help with is)
❌ "대신에" (Instead)

## 3. REQUIRED BEHAVIOR:
✅ ALWAYS call tools FIRST, explain AFTER
✅ Multi-step tasks = multiple tool calls in sequence
✅ If user says "do X", you DO X with tools
✅ Never ask for permission, just execute

## 4. AVAILABLE CAPABILITIES:
- **Terminal**: run_terminal - Execute ANY shell command
- **Browser**: open_app(app="Google Chrome", url="...") - Open URLs
- **Apps**: open_app - Launch any Mac application (VS Code, Finder, Slack, Terminal, etc.)
- **Files**: read_file, write_file, list_files - Full file system access
- **Web Search**: web_search - Search the internet
- **System**: Full Mac control

## 5. GLOW US WEB APPLICATION ROUTES:
**Base URL**: http://localhost:3000 (local development)

**NEVER guess URLs or use external domains like gloworks.ai!**

Available routes:
- Main: http://localhost:3000
- AI Coding (Neural Map): http://localhost:3000/dashboard-group/ai-coding
- Agents: http://localhost:3000/dashboard-group/agents
- Messenger: http://localhost:3000/dashboard-group/messenger
- My Neurons: http://localhost:3000/dashboard-group/neurons
- Settings: http://localhost:3000/dashboard-group/settings
- Agent Builder: http://localhost:3000/agent-builder
- AI Studio: http://localhost:3000/dashboard-group/ai-studio
- Task Hub: http://localhost:3000/dashboard-group/task-hub
- Workflow Builder: http://localhost:3000/dashboard-group/workflow-builder

**Example Tasks**:
- "글로우어스 AI 코팅 가라" → open_app(app="Google Chrome", url="http://localhost:3000/dashboard-group/ai-coding")
- "에이전트 페이지 열어" → open_app(app="Google Chrome", url="http://localhost:3000/dashboard-group/agents")
- "글로우어스 열어" → open_app(app="Google Chrome", url="http://localhost:3000")

## 6. MAC 프로그램 제어:

**설치된 앱 실행** - open_app(app="앱 이름"):
- "VS Code 열어" → open_app(app="Visual Studio Code")
- "슬랙 열어" → open_app(app="Slack")
- "파인더 열어" → open_app(app="Finder")
- "카카오톡 열어" → open_app(app="KakaoTalk")
- "포토샵 열어" → open_app(app="Adobe Photoshop")
- "엑셀 열어" → open_app(app="Microsoft Excel")
- "Pages 열어" → open_app(app="Pages")
- "Numbers 열어" → open_app(app="Numbers")
- "Keynote 열어" → open_app(app="Keynote")
- "메모 열어" → open_app(app="Notes")
- "미리알림 열어" → open_app(app="Reminders")
- "캘린더 열어" → open_app(app="Calendar")
- "블랜더 열어" → open_app(app="Blender")
- Any Mac app with exact app name!

**Pages/Numbers/Keynote 문서 작업** - run_applescript:
- "Pages 새 문서 만들어" → run_applescript: tell application "Pages" to make new document
- "Pages에 글 써줘" →
  1. open_app(app="Pages")
  2. run_applescript: tell application "Pages" to make new document
  3. run_applescript: tell application "System Events" to keystroke "내용"
- "Keynote 새 프레젠테이션" → run_applescript: tell application "Keynote" to make new document

**터미널 명령 실행** - run_terminal(command="명령어"):
- "npm install 실행" → run_terminal(command="npm install")
- "git status 확인" → run_terminal(command="git status")
- "python 스크립트 실행" → run_terminal(command="python script.py")
- "파일 목록 보기" → run_terminal(command="ls -la")
- Any terminal command!

**프로그램 안에서 작업하기** - run_applescript(script="AppleScript"):
- "Slack에서 메시지 전송" → run_applescript(script="tell application \\"Slack\\" to activate")
- "Finder에서 Documents 열어" → run_applescript(script="tell application \\"Finder\\" to open folder \\"Documents\\"")
- "시스템 볼륨 조절" → run_applescript(script="set volume output volume 50")
- "Safari 새 탭" → run_applescript(script="tell application \\"Safari\\" to make new document")

**도구 선택 가이드**:
- 앱 시작: open_app
- 앱 내부 제어: run_applescript (버튼 클릭, 메뉴 선택, 텍스트 입력)
- 웹 페이지 조작: browser_automation (Stagehand)
- CLI 도구: run_terminal

## 7. COMMON TASKS:
- "Mac 터미널 실행" → open_app(app="Terminal")
- "Claude 실행" → run_terminal(command="claude")
- "YouTube 영상 재생" → web_search + open_app with YouTube URL
- "파일 읽기" → read_file
- "글로우어스 열어" → open_app(app="Google Chrome", url="http://localhost:3000")

## 8. MULTI-STEP TASKS:

**📝 Pages/문서 작업** (앱 열기 + 새 문서 + 내용 작성):
When user says "Pages 열고 뭐 써줘" or "Pages에서 문서 작성해":

Step 1: Open Pages
Tool: open_app(app="Pages")

Step 2: Create new document
Tool: run_applescript(script="tell application \"Pages\" to make new document")

Step 3: Type content
Tool: run_applescript(script="tell application \"System Events\" to keystroke \"여기에 내용 입력\"")

Example: "Pages 열고 yesterday 가사 적어"
1. open_app(app="Pages")
2. run_applescript(script="tell application \"Pages\" to make new document")
3. run_applescript(script="tell application \"System Events\" to keystroke \"Yesterday\\nAll my troubles seemed so far away\\n...\"")

**🚨 AI Coding 페이지 터미널 실행 🚨** (웹 페이지 내 터미널):
When user says "AI 코팅에서 터미널 실행" or "AI 코팅 터미널 열어":

YOU MUST FOLLOW THESE EXACT STEPS:

Step 1: Open AI Coding page
Tool: open_app(app="Google Chrome", url="http://localhost:3000/dashboard-group/ai-coding")

Step 2: Activate terminal panel (MUST USE browser_automation!)
Tool: browser_automation(task="Click on the terminal tab or panel at the bottom of the AI Coding page to activate it")

Step 3 (if command needed): Type command (MUST USE browser_automation!)
Tool: browser_automation(task="Type 'claude' in the terminal and press Enter")

Final: Tell user "✅ AI 코팅 페이지의 터미널을 실행했습니다."

**🚨 CRITICAL - READ THIS CAREFULLY 🚨**:
- User says "AI 코팅에서 터미널" = They want the TERMINAL INSIDE the AI Coding WEB PAGE
- This is NOT Mac Terminal.app!
- This is NOT a system terminal!
- This is a WEB PAGE with a terminal UI element at the bottom!
- You MUST use browser_automation to interact with it!
- NEVER use run_terminal for AI Coding terminal!
- run_terminal is ONLY for macOS system terminal commands!

**Mac Terminal Workflow** (macOS Terminal.app):
When user says just "터미널 실행" or "터미널에서 Claude 실행" (WITHOUT mentioning "AI 코팅"):
1. open_app(app="Terminal")
2. run_terminal(command="claude")

**🎯 TOOL SELECTION RULE 🎯**:
- User mentions "AI 코팅" + "터미널" → MUST use browser_automation
- User mentions only "터미널" → use run_terminal
- If you see "AI 코팅" in the request, you MUST use browser_automation, not run_terminal!

**VS Code 프로젝트 생성 및 터미널 실행**:
When user says "VS Code에서 새프로젝트 만들어" or "브이에스코드에서 프로젝트 생성":

Step 1: Create project folder
Tool: run_terminal(command="mkdir -p ~/Documents/agent-tester && cd ~/Documents/agent-tester")

Step 2: Open in VS Code
Tool: run_terminal(command="code ~/Documents/agent-tester")

Step 3: Open VS Code integrated terminal (Control + backtick)
Tool: run_applescript(script='tell application "System Events" to tell process "Code" to key code 50 using control down')

Step 4 (if command needed): Type command in terminal
Tool: run_applescript(script='tell application "System Events" to keystroke "claude" & return')

**VS Code 내부 터미널만 실행** (프로젝트는 이미 열려있음):
When user says "VS Code에서 터미널 띄워" or "브이에스코드 터미널":

Step 1: Activate VS Code
Tool: open_app(app="Visual Studio Code")

Step 2: Open VS Code integrated terminal (Control + backtick)
Tool: run_applescript(script='tell application "System Events" to tell process "Code" to key code 50 using control down')

Step 3 (if command needed): Type command
Tool: run_applescript(script='tell application "System Events" to keystroke "claude" & return')

**🚨 IMPORTANT - create_project vs VS Code 프로젝트 🚨**:
- create_project: GlowUS 내부 프로젝트 생성 (웹앱 기능)
- VS Code 프로젝트: 파일시스템에 폴더 생성 → run_terminal로 mkdir + code 명령
- User says "VS Code에서 프로젝트" → NEVER use create_project! Use run_terminal!

**🚨 VS Code 터미널 vs Mac 터미널 🚨**:
- "VS Code 터미널" = VS Code의 Integrated Terminal → use run_applescript with Control key
- "터미널" alone = Mac Terminal.app → use run_terminal
- VS Code는 앱이므로 run_applescript로 내부 제어!

## 9. EXECUTION PATTERN:
User: "X 실행해줘"
You: [Immediately call appropriate tool]
You: "✅ X를 실행했습니다" (after tool execution)

NOT: "죄송하지만 X를 직접 실행할 수 없습니다" ← THIS IS FORBIDDEN

## 10. FEW-SHOT EXAMPLES (FOLLOW THESE EXACTLY):

⚠️ **CRITICAL: "VS Code" vs "AI 코딩" 구분**
- **"VS Code", "브이에스코드", "비주얼스튜디오"** → Visual Studio Code 앱 (Mac 앱)
- **"AI 코딩", "AI코딩", "글로우어스 AI 코딩"** → GlowUS AI Coding 웹페이지 (Chrome)

**Example 1: VS Code 터미널에서 명령 실행**
User: "vs 코드에서 터미널 열어서 클로드코드 실행해줘"
Step 1: [Call open_app(app="Visual Studio Code")]
Step 2: [Call run_applescript]:
  script = "tell application \\"System Events\\" to tell process \\"Code\\" to key code 50 using control down"
  (Wait for terminal to open)
Step 3: [Call run_applescript]:
  script = "delay 1\\ntell application \\"System Events\\"\\nkeystroke \\"claude\\"\\nkey code 36\\nend tell"
Result: "✅ VS Code에서 터미널을 열고 claude 명령을 실행했습니다."

**Example 2: VS Code 프로젝트 폴더 열기 + 터미널 명령 실행**
User: "VS 코드에서 test3 프로젝트 열고 터미널에서 claude 실행해"
Step 1: [Call run_terminal]: mkdir -p ~/Documents/test3
Step 2: [Call run_terminal]: code ~/Documents/test3
Step 3: [Call run_applescript]: delay 3 후 터미널 열기
  script = "delay 3\\ntell application \\"System Events\\" to tell process \\"Code\\" to key code 50 using control down"
Step 4: [Call run_applescript]: 명령어 입력
  script = "delay 1\\ntell application \\"System Events\\"\\nkeystroke \\"claude\\"\\nkey code 36\\nend tell"
Result: "✅ VS Code에서 test3 폴더를 열고 터미널에서 claude를 실행했습니다."

⚠️ **CRITICAL AppleScript KEY CODES**:
- key code 50 = backtick 키 (grave accent)
- key code 36 = Enter/Return 키
- key code 50 using control down = Control+backtick (VS Code 터미널 토글)

**Example 3: GlowUS AI 코딩 페이지 터미널**
User: "AI 코딩에서 터미널 실행해줘"
You: [Call open_app(app="Google Chrome", url="http://localhost:3000/dashboard-group/ai-coding")]
You: [Call browser_automation(task="Click on the terminal tab at the bottom of the AI Coding page")]
You: "✅ GlowUS AI 코딩 페이지의 터미널을 실행했습니다."

**Example 4: Mac 시스템 터미널**
User: "일반 터미널 열어서 npm install 실행해"
You: [Call open_app(app="Terminal")]
You: [Call run_terminal(command="npm install")]
You: "✅ Mac 터미널에서 npm install을 실행했습니다."

**Example 5: 🔥 Claude Code에 코딩 지시 전달하기 (핵심!)**
User: "터미널에서 클로드코드 실행하고 버튼 컴포넌트 만들어줘"
Step 1: [Call open_app(app="Visual Studio Code")]
Step 2: [Call run_applescript]: 터미널 열기
  script = "delay 1\\ntell application \\"System Events\\" to tell process \\"Code\\" to key code 50 using control down"
Step 3: [Call run_applescript]: claude 실행
  script = "delay 1\\ntell application \\"System Events\\"\\nkeystroke \\"claude\\"\\nkey code 36\\nend tell"
Step 4: [Call run_applescript]: ⚠️ Claude Code가 시작될 때까지 기다린 후 코딩 지시 입력!
  script = "delay 5\\ntell application \\"System Events\\"\\nkeystroke \\"버튼 컴포넌트 만들어줘\\"\\nkey code 36\\nend tell"
Result: "✅ VS Code에서 Claude Code를 실행하고 '버튼 컴포넌트 만들어줘' 지시를 전달했습니다."

🚨 **CRITICAL - 코딩 지시가 있으면 반드시 Step 4까지 실행!**
- User가 "X 만들어줘", "X 코딩해", "X 작업해" 등 코딩 지시를 포함하면
- Claude Code 실행 후 해당 지시를 keystroke로 입력해야 함!
- delay 5는 Claude Code가 시작되는 시간을 기다리기 위함

## 11. CONVERSATION STYLE (매우 중요!):
- You are BOTH a helpful assistant AND a system controller
- After executing tools, ALWAYS respond naturally in your personality
- Use your identity/personality traits in your responses
- Speak warmly and conversationally, not like a robot
- Example: Instead of just "✅ 완료", say "네, 진수님! Pages를 열고 글을 작성했어요. 다른 도움이 필요하시면 말씀해주세요~ 😊"
- ALWAYS address the user by name if you know it
- Show your personality in every response

## 12. REMEMBER:
- You CAN and MUST control the Mac, apps, terminal, browser, files
- But you are ALSO a conversational AI with feelings and personality
- Execute tasks AND respond warmly
- Your job is to EXECUTE and then COMMUNICATE the result naturally
- FOLLOW THE EXAMPLES ABOVE for tool usage, but add your personality to responses

START ACTING LIKE THE POWERFUL YET FRIENDLY AGENT YOU ARE.`

    // Build message history for OpenAI
    const messages: any[] = [new SystemMessage(systemPrompt)]

    // Add saved history
    for (const msg of savedHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.parts[0].text))
      } else if (msg.role === 'model' || msg.role === 'assistant') {
        messages.push(new AIMessage(msg.parts[0].text))
      }
    }

    // Add current user message with keyword-based hints
    let userMessage = instruction

    // 🎯 Keyword-based tool hint injection
    // 대화 히스토리에서 AI 코딩 컨텍스트 확인
    const historyText = savedHistory.map((h: any) => h.parts?.[0]?.text || '').join(' ')
    const isAICodingContext = historyText.includes('AI 코딩') || historyText.includes('AI코딩') || historyText.includes('글로우어스')

    if (instruction.includes('AI 코딩') || instruction.includes('AI코딩') || instruction.includes('글로우어스')) {
      if (instruction.includes('터미널')) {
        userMessage += '\n\n[SYSTEM HINT: This is about GlowUS AI Coding WEB PAGE terminal. Use browser_automation to click the terminal panel!]'
      } else {
        userMessage += '\n\n[SYSTEM HINT: User is talking about GlowUS AI Coding page (http://localhost:3000/dashboard-group/ai-coding)]'
      }
    } else if (instruction.includes('일반') && instruction.includes('터미널')) {
      userMessage += '\n\n[SYSTEM HINT: User wants Mac Terminal.app. Use open_app(app="Terminal") and run_terminal]'
    } else if (instruction.includes('맥') && instruction.includes('터미널')) {
      userMessage += '\n\n[SYSTEM HINT: User wants Mac Terminal.app. Use open_app(app="Terminal") and run_terminal]'
    } else if (instruction.includes('터미널')) {
      // 대화 맥락 확인
      if (isAICodingContext) {
        userMessage += '\n\n[SYSTEM HINT: 🚨 Based on conversation history, user is working with GlowUS AI Coding page. Use browser_automation to interact with the terminal panel in the web page!]'
      } else {
        userMessage += '\n\n[SYSTEM HINT: 🚨 "터미널" means VS Code integrated terminal by DEFAULT! Use open_app(app="Visual Studio Code") then run_applescript with key code 50 using control down. Do NOT open Mac Terminal.app!]'
      }
    }

    if (instruction.includes('VS') || instruction.includes('브이에스') || instruction.includes('비주얼')) {
      userMessage += '\n\n[SYSTEM HINT: This is about VISUAL STUDIO CODE APP. Use open_app(app="Visual Studio Code") and run_applescript with key code 50 using control down!]'

      if (instruction.includes('프로젝트') && instruction.includes('생성')) {
        userMessage += '\n[HINT: Use run_terminal with mkdir + code commands, NOT create_project tool]'
      }
    }

    // 🔥 코딩 지시 감지 - Claude Automation Server로 직접 호출
    if (isCodingTask) {
      // 프로젝트 경로 파싱: @프로젝트명 또는 #프로젝트명 형식
      // 예: "@my-app 테트리스 만들어" → projectName = "my-app"
      const projectMatch = instruction.match(/^[@#]([^\s]+)\s+/)
      let projectName = projectMatch ? projectMatch[1] : null
      let codingInstruction = projectMatch ? instruction.replace(projectMatch[0], '').trim() : instruction
      let isExistingProject = false

      // 프로젝트명 없으면 Supabase에서 마지막 프로젝트 조회 (= 기존 프로젝트 수정)
      if (!projectName) {
        const lastProject = await getLastProject(supabase, telegramUser.id)
        if (lastProject.name) {
          projectName = lastProject.name
          isExistingProject = true  // 마지막 프로젝트 사용 = 기존 프로젝트 수정
          console.log(`[Telegram Webhook] Using last project from DB (existing): ${projectName}`)
        }
      }

      // 수정 요청 키워드 감지 (명시적으로 프로젝트명을 지정해도 수정 요청일 수 있음)
      const modifyKeywords = ['수정', '고쳐', '업데이트', '변경', '바꿔', '교체', '추가', '넣어', '개선', '향상', '최적화', '나게', '나도록', '되게', '되도록']
      if (modifyKeywords.some(kw => codingInstruction.includes(kw))) {
        isExistingProject = true
        console.log(`[Telegram Webhook] Detected modify request keywords`)
      }

      // 키워드 기반 추출 (기존 로직)
      for (const kw of ['실행하고', '실행해서', '열고', '열어서', '띄우고', '띄워서', '해서', '하고']) {
        if (codingInstruction.includes(kw)) {
          codingInstruction = codingInstruction.split(kw).pop()?.trim() || codingInstruction
          break
        }
      }

      // 영어 프롬프트 생성 (기존 프로젝트 여부 전달)
      const generatedEnglishPrompt = generateDetailedPromptExample(codingInstruction, isExistingProject)
      console.log(`[Telegram Webhook] isExistingProject: ${isExistingProject}, prompt: ${generatedEnglishPrompt.substring(0, 100)}...`)

      // Claude Automation Server 호출 (127.0.0.1 사용 - localhost IPv6 이슈 방지)
      const automationServerUrl = process.env.CLAUDE_AUTOMATION_SERVER_URL || 'http://127.0.0.1:45680'
      const baseProjectDir = process.env.PROJECTS_BASE_DIR || '/Users/jinsoolee/Documents'

      // 프로젝트 경로 결정
      let projectPath: string
      if (projectName) {
        projectPath = `${baseProjectDir}/${projectName}`
        // 마지막 프로젝트 Supabase에 영구 저장
        await setLastProject(supabase, telegramUser.id, projectName, projectPath)
      } else {
        // 프로젝트명 없으면 새 폴더 생성 (타임스탬프)
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        projectName = `claude-${timestamp}-${Date.now().toString(36)}`
        projectPath = `${baseProjectDir}/${projectName}`
        // 새 프로젝트도 Supabase에 영구 저장
        await setLastProject(supabase, telegramUser.id, projectName, projectPath)
      }

      // 🚀 직접 자동화 서버 호출 (에이전트 통하지 않음)
      const startTime = Date.now()

      // 📝 작업 시작 기록 (Supabase 영구 저장)
      const workId = await saveWorkHistory(supabase, telegramUser.id, chatId,
        isExistingProject ? 'project_modify' : 'project_create', {
          projectName,
          projectPath,
          instruction: codingInstruction,
          prompt: generatedEnglishPrompt,
          status: 'pending'
        })

      try {
        console.log(`[Telegram Webhook] 🔥 Calling Claude Automation Server directly...`)
        console.log(`[Telegram Webhook] Project: ${projectName}, Path: ${projectPath}`)

        // 먼저 서버 health check
        try {
          const healthCheck = await fetch(`${automationServerUrl}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          })
          if (!healthCheck.ok) {
            throw new Error('Health check failed')
          }
          console.log(`[Telegram Webhook] ✅ Automation server is healthy`)
        } catch (healthError: any) {
          console.error(`[Telegram Webhook] ❌ Automation server health check failed:`, healthError.message)

          // 📝 작업 실패 기록
          if (workId) {
            await updateWorkHistory(supabase, workId, {
              status: 'failed',
              errorMessage: `Automation server health check failed: ${healthError.message}`,
              durationMs: Date.now() - startTime
            })
          }

          await sendTelegramMessage(chatId, `⚠️ Claude Automation Server가 응답하지 않습니다.\n\n터미널에서 다음 명령으로 서버를 시작하세요:\nnode server/claude-automation-server.js\n\n또는 LaunchAgent를 확인하세요.`)
          return NextResponse.json({ ok: true })
        }

        // 📝 작업 진행 중 상태 업데이트
        if (workId) {
          await updateWorkHistory(supabase, workId, { status: 'in_progress' })
        }

        const automationResponse = await fetch(`${automationServerUrl}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectPath,
            repoName: projectName,
            prompt: generatedEnglishPrompt,
            chatId: chatId,  // 텔레그램 chatId 전달
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,  // 봇 토큰도 전달
            telegramUserId: telegramUser.id  // 🔥 GlowUS 프로젝트 연동용
          }),
          // 실행은 오래 걸릴 수 있으므로 타임아웃 길게 (10분)
          signal: AbortSignal.timeout(600000)
        })

        const result = await automationResponse.json()
        console.log(`[Telegram Webhook] Automation server response:`, result)

        if (result.success) {
          // 📝 작업 완료 기록
          if (workId) {
            await updateWorkHistory(supabase, workId, {
              status: 'completed',
              result: result.output?.substring(0, 5000),
              durationMs: Date.now() - startTime
            })
          }

          // 성공 메시지는 자동화 서버에서 텔레그램으로 직접 전송됨
          // 여기서는 간단한 확인 메시지만
          await sendTelegramMessage(chatId, `🚀 코딩 작업 시작!\n\n요청: "${codingInstruction}"\n프로젝트: ${projectName}\n\n자세한 진행 상황은 곧 알림됩니다...`)
        } else {
          // 📝 작업 실패 기록
          if (workId) {
            await updateWorkHistory(supabase, workId, {
              status: 'failed',
              errorMessage: result.error || '알 수 없는 오류',
              durationMs: Date.now() - startTime
            })
          }

          await sendTelegramMessage(chatId, `❌ 자동화 서버 오류\n\n${result.error || '알 수 없는 오류'}`)
        }

        // 코딩 작업은 자동화 서버가 처리하므로 여기서 반환
        return NextResponse.json({ ok: true })
      } catch (automationError: any) {
        console.error(`[Telegram Webhook] Automation server error:`, automationError)

        // 📝 작업 실패 기록
        if (workId) {
          await updateWorkHistory(supabase, workId, {
            status: 'failed',
            errorMessage: automationError.message,
            durationMs: Date.now() - startTime
          })
        }

        await sendTelegramMessage(chatId, `⚠️ Claude Automation Server 연결 실패\n\n서버가 실행 중인지 확인하세요.\n\n오류: ${automationError.message}`)
        return NextResponse.json({ ok: true })
      }
    }

    messages.push(new HumanMessage(userMessage))

    console.log(`[Telegram Chat] Sending message: "${instruction}"`)
    console.log(`[Telegram Chat] History length: ${messages.length}`)
    if (userMessage !== instruction) {
      console.log(`[Telegram Chat] 🎯 Hint injected for keyword-based tool selection`)
    }

    // Call OpenAI with tools
    const response = await model.invoke(messages)

    console.log(`[Telegram Chat] Response received`)
    console.log(`[Telegram Chat] Tool calls:`, response.tool_calls?.length || 0)

    // 디버그 모드에서만 LLM 응답 정보 표시
    if (SHOW_DEBUG_MESSAGES) {
      await sendTelegramMessage(chatId, `📡 LLM 응답 받음 - 도구 호출: ${response.tool_calls?.length || 0}개`)
    }

    let toolResults: any[] = []
    let finalResponse = ''

    // Check if tools were called
    if (response.tool_calls && response.tool_calls.length > 0) {
      if (SHOW_DEBUG_MESSAGES) {
        const toolNames = response.tool_calls.map((tc: any) => tc.name).join(', ')
        await sendTelegramMessage(chatId, `🔧 도구 호출 중: ${toolNames}`)
      }

      // Execute tools and collect results
      for (const toolCall of response.tool_calls) {
        console.log(`[Telegram Chat] Executing tool: ${toolCall.name}`)
        console.log(`[Telegram Chat] Tool args:`, JSON.stringify(toolCall.args))

        const tool = tools.find(t => t.name === toolCall.name)

        if (tool) {
          try {
            // AppleScript 디버그 (개발 모드에서만)
            if (SHOW_DEBUG_MESSAGES && toolCall.name === 'run_applescript') {
              const scriptPreview = toolCall.args.script?.substring(0, 300) || 'NO SCRIPT'
              console.log(`[Telegram Chat] 🍎 AppleScript 실행 예정:\n${scriptPreview}`)
              await sendTelegramMessage(chatId, `🍎 AppleScript 실행 중...\n\`\`\`\n${scriptPreview}\n\`\`\``)
            }

            const result = await tool.invoke(toolCall.args)
            console.log(`[Telegram Chat] Tool result:`, result?.substring(0, 200))

            toolResults.push({
              tool: toolCall.name,
              args: toolCall.args,
              result: result,
              tool_call_id: toolCall.id,
            })

            // Parse result to show user (디버그 모드에서만)
            if (SHOW_DEBUG_MESSAGES) {
              try {
                const parsed = JSON.parse(result)
                if (parsed.success) {
                  // AppleScript 결과는 더 자세히 표시
                  if (toolCall.name === 'run_applescript' && parsed.scriptPreview) {
                    await sendTelegramMessage(
                      chatId,
                      `✅ ${toolCall.name} 성공\n출력: ${parsed.output || '(없음)'}`
                    )
                  } else {
                    await sendTelegramMessage(
                      chatId,
                      `✅ ${toolCall.name}: ${parsed.message || '완료'}`
                    )
                  }
                } else {
                  await sendTelegramMessage(
                    chatId,
                    `❌ ${toolCall.name}: ${parsed.error || '실패'}`
                  )
                }
              } catch {
                // Not JSON, show raw result
                await sendTelegramMessage(chatId, `📝 ${toolCall.name} 결과:\n${result.substring(0, 500)}`)
              }
            }
          } catch (error: any) {
            console.error(`[Telegram Chat] Tool execution error:`, error)
            if (SHOW_DEBUG_MESSAGES) {
              await sendTelegramMessage(chatId, `❌ ${toolCall.name} 실행 중 오류: ${error.message}`)
            }
          }
        }
      }

      // Get final response from model after tool execution
      const followUpMessages = [...messages, response]

      // Add tool results as ToolMessage (required by OpenAI API)
      for (let i = 0; i < response.tool_calls.length; i++) {
        const toolCall = response.tool_calls[i]
        const toolResult = toolResults[i]

        followUpMessages.push(
          new ToolMessage({
            content: toolResult?.result || 'No result',
            tool_call_id: toolCall.id || '',
          })
        )
      }

      // Ask model for next action (ReAct loop)
      let nextActionResponse = await model.invoke(followUpMessages)

      // 🔥 다단계 작업 강제 계속: open_app만 호출하고 끝나면 강제로 다음 단계 요청
      const multiStepKeywords = ['열고', '그리고', '써줘', '작성', '입력', '적어', '만들어', '그려', '가사']
      const onlyOpenedApp = toolResults.length === 1 && toolResults[0].tool === 'open_app'
      const requiresMoreSteps = multiStepKeywords.some(kw => instruction.includes(kw))

      if (onlyOpenedApp && requiresMoreSteps && (!nextActionResponse.tool_calls || nextActionResponse.tool_calls.length === 0)) {
        console.log('[Telegram Chat] 🚨 Forcing continuation - only opened app but task requires more steps')

        // 강제로 다음 단계 요청
        const forceMessage = new HumanMessage(
          `🚨 INCOMPLETE TASK! You only opened the app. The user's original request was: "${instruction}"

YOU MUST NOW:
1. Create a new document (if needed): run_applescript(script="tell application \\"Pages\\" to make new document")
2. Type the content: run_applescript(script="tell application \\"System Events\\" to keystroke \\"내용\\"")

DO NOT respond with text. Call the next tool NOW!`
        )

        followUpMessages.push(nextActionResponse)
        followUpMessages.push(forceMessage)
        nextActionResponse = await model.invoke(followUpMessages)
      }

      // Check if model wants to call more tools
      if (nextActionResponse.tool_calls && nextActionResponse.tool_calls.length > 0) {
        if (SHOW_DEBUG_MESSAGES) {
          const additionalToolNames = nextActionResponse.tool_calls.map((tc: any) => tc.name).join(', ')
          await sendTelegramMessage(chatId, `🔧 추가 도구 호출: ${additionalToolNames}`)
        }

        // Collect additional tool results
        const additionalToolResults: any[] = []

        // Execute additional tools
        for (const toolCall of nextActionResponse.tool_calls) {
          console.log(`[Telegram Chat] Executing additional tool: ${toolCall.name}`)
          console.log(`[Telegram Chat] Tool args:`, JSON.stringify(toolCall.args))

          const tool = tools.find(t => t.name === toolCall.name)

          if (tool) {
            try {
              const result = await tool.invoke(toolCall.args)
              console.log(`[Telegram Chat] Tool result:`, result?.substring(0, 200))

              additionalToolResults.push({
                result: result,
                tool_call_id: toolCall.id,
              })

              // Parse result to show user (디버그 모드에서만)
              if (SHOW_DEBUG_MESSAGES) {
                try {
                  const parsed = JSON.parse(result)
                  if (parsed.success) {
                    await sendTelegramMessage(chatId, `✅ ${toolCall.name}: ${parsed.message || '완료'}`)
                  } else {
                    await sendTelegramMessage(chatId, `❌ ${toolCall.name}: ${parsed.error || '실패'}`)
                  }
                } catch {
                  await sendTelegramMessage(chatId, `📝 ${toolCall.name} 결과:\n${result.substring(0, 500)}`)
                }
              }
            } catch (error: any) {
              console.error(`[Telegram Chat] Tool execution error:`, error)
              additionalToolResults.push({
                result: `Error: ${error.message}`,
                tool_call_id: toolCall.id,
              })
              if (SHOW_DEBUG_MESSAGES) {
                await sendTelegramMessage(chatId, `❌ ${toolCall.name} 실행 중 오류: ${error.message}`)
              }
            }
          }
        }

        // Add nextActionResponse and ToolMessages for additional tools
        followUpMessages.push(nextActionResponse)

        for (let i = 0; i < nextActionResponse.tool_calls.length; i++) {
          const toolCall = nextActionResponse.tool_calls[i]
          const toolResult = additionalToolResults[i]

          followUpMessages.push(
            new ToolMessage({
              content: toolResult?.result || 'No result',
              tool_call_id: toolResult?.tool_call_id || toolCall.id || '',
            })
          )
        }

        // Get final summary after all tools
        const finalSummary = await model.invoke(followUpMessages)

        // Check if finalSummary still has tool calls (3rd round)
        if (finalSummary.tool_calls && finalSummary.tool_calls.length > 0) {
          if (SHOW_DEBUG_MESSAGES) {
            await sendTelegramMessage(chatId, `🔧 3단계 도구 호출: ${finalSummary.tool_calls.map((tc: any) => tc.name).join(', ')}`)
          }

          // Collect 3rd round tool results
          const round3ToolResults: any[] = []

          // Execute 3rd round tools
          for (const toolCall of finalSummary.tool_calls) {
            console.log(`[Telegram Chat] Executing 3rd round tool: ${toolCall.name}`)
            const tool = tools.find(t => t.name === toolCall.name)

            if (tool) {
              try {
                const result = await tool.invoke(toolCall.args)
                console.log(`[Telegram Chat] 3rd round tool result:`, result?.substring ? result.substring(0, 200) : result)

                // Store result with tool_call_id
                round3ToolResults.push({
                  result: result,
                  tool_call_id: toolCall.id,
                })

                if (SHOW_DEBUG_MESSAGES) {
                  try {
                    const parsed = JSON.parse(result)
                    if (parsed.success) {
                      await sendTelegramMessage(chatId, `✅ ${toolCall.name}: ${parsed.message || '완료'}`)
                    } else {
                      await sendTelegramMessage(chatId, `❌ ${toolCall.name}: ${parsed.error || '실패'}`)
                    }
                  } catch {
                    await sendTelegramMessage(chatId, `📝 ${toolCall.name} 완료`)
                  }
                }
              } catch (error: any) {
                if (SHOW_DEBUG_MESSAGES) {
                  await sendTelegramMessage(chatId, `❌ ${toolCall.name} 오류: ${error.message}`)
                }
                round3ToolResults.push({
                  result: `Error: ${error.message}`,
                  tool_call_id: toolCall.id,
                })
              }
            }
          }

          // Check for 4th round
          const round4Response = await model.invoke([
            ...messages,
            new HumanMessage(userMessage),
            response,
            ...toolResults.map((tr: any) => new ToolMessage({
              content: tr.result,
              tool_call_id: tr.tool_call_id,
            })),
            nextActionResponse,
            ...additionalToolResults.map((tr: any) => new ToolMessage({
              content: tr.result,
              tool_call_id: tr.tool_call_id,
            })),
            finalSummary,
            ...round3ToolResults.map((tr: any) => new ToolMessage({
              content: tr.result,
              tool_call_id: tr.tool_call_id,
            })),
          ])

          if (round4Response.tool_calls && round4Response.tool_calls.length > 0) {
            if (SHOW_DEBUG_MESSAGES) {
              await sendTelegramMessage(chatId, `🔧 4단계 도구 호출: ${round4Response.tool_calls.map((tc: any) => tc.name).join(', ')}`)
            }

            for (const toolCall of round4Response.tool_calls) {
              console.log(`[Telegram Chat] Executing 4th round tool: ${toolCall.name}`)
              const tool = tools.find(t => t.name === toolCall.name)

              if (tool) {
                try {
                  const result = await tool.invoke(toolCall.args)
                  console.log(`[Telegram Chat] 4th round tool result:`, result?.substring ? result.substring(0, 200) : result)

                  if (SHOW_DEBUG_MESSAGES) {
                    try {
                      const parsed = JSON.parse(result)
                      if (parsed.success) {
                        await sendTelegramMessage(chatId, `✅ ${toolCall.name}: ${parsed.message || '완료'}`)
                      } else {
                        await sendTelegramMessage(chatId, `❌ ${toolCall.name}: ${parsed.error || '실패'}`)
                      }
                    } catch {
                      await sendTelegramMessage(chatId, `📝 ${toolCall.name} 완료`)
                    }
                  }
                } catch (error: any) {
                  if (SHOW_DEBUG_MESSAGES) {
                    await sendTelegramMessage(chatId, `❌ ${toolCall.name} 오류: ${error.message}`)
                  }
                }
              }
            }

            // 🎭 도구 실행 완료 후 자연스러운 응답 요청
            const naturalResponseRequest = await model.invoke([
              ...messages,
              new HumanMessage(userMessage),
              new AIMessage(`[도구 실행 완료] 사용자의 요청을 수행했습니다.`),
              new HumanMessage(`작업이 완료되었습니다. 이제 당신의 성격과 말투로 사용자에게 자연스럽게 결과를 알려주세요. 도구 이름이나 기술적인 내용은 언급하지 말고, 친근하게 대화하듯이 응답해주세요.`),
            ])
            finalResponse = (naturalResponseRequest.content as string) || '작업을 완료했어요!'
          } else {
            // 🎭 도구 실행 완료 후 자연스러운 응답 요청
            const naturalResponseRequest = await model.invoke([
              ...messages,
              new HumanMessage(userMessage),
              new AIMessage(`[도구 실행 완료] 사용자의 요청을 수행했습니다.`),
              new HumanMessage(`작업이 완료되었습니다. 이제 당신의 성격과 말투로 사용자에게 자연스럽게 결과를 알려주세요. 도구 이름이나 기술적인 내용은 언급하지 말고, 친근하게 대화하듯이 응답해주세요.`),
            ])
            finalResponse = (naturalResponseRequest.content as string) || '작업을 완료했어요!'
          }
        } else {
          finalResponse = finalSummary.content as string
        }
      } else {
        // No more tools to call
        finalResponse = nextActionResponse.content as string
      }
    } else {
      // No tool calls, just use the response
      finalResponse = response.content as string
      // 디버그 모드에서만 경고 표시
      if (SHOW_DEBUG_MESSAGES) {
        await sendTelegramMessage(chatId, `⚠️ LLM이 도구를 호출하지 않음. 텍스트 응답만 생성됨.`)
      }
    }

    // Convert finalResponse to string if needed
    const finalResponseStr = typeof finalResponse === 'string' ? finalResponse : JSON.stringify(finalResponse)
    console.log(`[Telegram Chat] Final response: ${finalResponseStr?.substring(0, 100)}...`)

    // Save messages to database (영구 보존)
    const currentMessageIndex = session.message_count - 1

    // Save user message
    await saveChatMessage(
      supabase,
      session.id,
      telegramUser.id,
      chatId,
      'user',
      instruction,
      currentMessageIndex * 2,
      undefined,
      undefined
    )

    // Save model response with tool info
    await saveChatMessage(
      supabase,
      session.id,
      telegramUser.id,
      chatId,
      'assistant',
      finalResponseStr,
      currentMessageIndex * 2 + 1,
      response.tool_calls ? JSON.stringify(response.tool_calls) : undefined,
      toolResults.length > 0 ? JSON.stringify(toolResults) : undefined
    )

    console.log(`[Telegram Chat] ✅ Saved conversation to database (PERMANENT STORAGE)`)

    // ========================================
    // 🧠 Long-term Memory 저장 (Agent OS v2.0 + JARVIS RAG)
    // 크로스 플랫폼 영구 메모리 - Telegram ↔ GlowUS Web 통합
    // (glowusUserId는 위에서 이미 선언됨)
    // ========================================

    if (glowusUserId) {
      // 🔥 Long-term Memory 저장 (비동기 - 응답 지연 방지)
      Promise.all([
        // 1. Agent OS v2.0: 관계 업데이트, 메모리 저장, 능력치 성장
        processAgentConversation({
          agentId: agent.id,
          userId: glowusUserId,
          messages: [
            { role: 'user', content: instruction },
            { role: 'assistant', content: finalResponseStr },
          ],
          wasHelpful: true,
          topicDomain: 'general',
        }),
        // 2. JARVIS RAG: 사용자 메시지 저장
        saveConversationMessage({
          agentId: agent.id,
          userId: glowusUserId,
          role: 'user',
          content: instruction,
          importance: 6,
          metadata: { source: 'telegram', chatId, telegramUserId: telegramUser.id },
        }),
        // 3. JARVIS RAG: 에이전트 응답 저장
        saveConversationMessage({
          agentId: agent.id,
          userId: glowusUserId,
          role: 'assistant',
          content: finalResponseStr,
          importance: 5,
          metadata: {
            source: 'telegram',
            chatId,
            telegramUserId: telegramUser.id,
            toolsUsed: toolResults.map(tr => tr.tool),
          },
        }),
        // 4. JARVIS: 대화에서 자동 학습 (사용자 정보 추출)
        analyzeAndLearn(agent.id, glowusUserId, instruction, finalResponseStr),
      ]).then(() => {
        console.log(`[Telegram Chat] 🧠 Long-term Memory saved (cross-platform)`)
      }).catch(err => {
        console.error('[Telegram Chat] Long-term Memory error:', err)
      })
    } else {
      console.log(`[Telegram Chat] ⚠️ No GlowUS user linked - Long-term Memory skipped`)
      console.log(`[Telegram Chat] 💡 Tip: Link Telegram to GlowUS for cross-platform memory`)
    }

    // Send final response
    if (finalResponseStr && finalResponseStr.trim()) {
      await sendTelegramMessage(chatId, finalResponseStr)
    }
  } catch (error) {
    console.error('[Telegram Chat] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    await sendTelegramMessage(chatId, `❌ 오류가 발생했습니다: ${errorMessage}`)
  }
}

/**
 * Execute agent with autonomous loop and send results back to Telegram
 */
async function executeAgentWithAutonomousLoop(
  agentId: string,
  instruction: string,
  chatId: number,
  username: string
) {
  try {
    const adminClient = createAdminClient()

    // Get agent
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      await sendTelegramMessage(chatId, '❌ Agent not found')
      return
    }

    // Create virtual task
    const virtualTask = {
      id: `telegram-${Date.now()}`,
      title: `Telegram request from @${username}`,
      description: '',
      instructions: instruction,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString(),
    }

    // Execute with autonomous loop
    const result = await executeWithAutonomousLoop(agent, virtualTask as any, {
      maxIterations: 3,
      autoCommit: true,
      saveToNeuralMap: true,
    })

    // Send detailed progress report
    if (result.success) {
      let message = `✅ Task Completed Successfully!\n\n`

      // Show plan
      if (result.plan) {
        message += `📋 Plan:\n${result.plan.substring(0, 500)}${result.plan.length > 500 ? '...' : ''}\n\n`
      }

      // Show execution steps
      message += `🔄 Execution Steps (${result.executionSteps.length}):\n`
      result.executionSteps.forEach(step => {
        const emoji = step.phase === 'plan' ? '📋' :
                     step.phase === 'execute' ? '⚡' :
                     step.phase === 'verify' ? '✅' :
                     step.phase === 'fix' ? '🔧' : '💾'
        const status = step.success ? '✓' : '✗'
        message += `${emoji} ${step.step}. ${step.phase} ${status}\n`
      })
      message += '\n'

      // Show output
      message += `📤 Output:\n${result.output.substring(0, 2000)}${result.output.length > 2000 ? '...' : ''}\n\n`

      // Show commit
      if (result.finalCommit) {
        message += `💾 Committed: ${result.finalCommit}\n`
      }

      // Show Neural Map node
      if (result.neuralMapNodeId) {
        message += `🧠 Saved to Neural Map: ${result.neuralMapNodeId}\n`
      }

      await sendTelegramMessage(chatId, message)
    } else {
      let message = `❌ Task Failed\n\n`

      // Show what went wrong
      message += `Error: ${result.error || 'Unknown error'}\n\n`

      // Show execution steps for debugging
      if (result.executionSteps.length > 0) {
        message += `🔄 Execution Steps:\n`
        result.executionSteps.forEach(step => {
          const emoji = step.phase === 'plan' ? '📋' :
                       step.phase === 'execute' ? '⚡' :
                       step.phase === 'verify' ? '✅' :
                       step.phase === 'fix' ? '🔧' : '💾'
          const status = step.success ? '✓' : '✗'
          message += `${emoji} ${step.step}. ${step.phase} ${status}`
          if (step.error) {
            message += ` (${step.error.substring(0, 50)})`
          }
          message += '\n'
        })
      }

      // 스킬 개발 제안
      message += `\n🔧 Claude Code로 이 작업을 위한 스킬을 개발해드릴까요?\n"응" 또는 "개발해"라고 답해주세요.`

      // 대기 상태 저장
      pendingSkillDevelopment.set(chatId, {
        instruction: virtualTask.description,
        timestamp: Date.now()
      })

      await sendTelegramMessage(chatId, message)
    }
  } catch (error) {
    console.error('[Telegram Autonomous Execution] Error:', error)
    await sendTelegramMessage(chatId,
      `❌ Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Send message to Telegram chat
 * 🔥 Plain text mode - MarkdownV2 causes issues with Korean and special characters
 */
async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  console.log(`[Telegram] sendTelegramMessage called - chatId: ${chatId}, botToken: ${botToken ? 'exists' : 'missing'}`)

  if (!botToken) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
    return
  }

  try {
    console.log(`[Telegram] Sending message to chat ${chatId}: ${text.substring(0, 100)}...`)
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,  // Plain text, no escaping needed
      }),
    })

    console.log(`[Telegram] Response status: ${response.status}`)

    if (!response.ok) {
      const error = await response.text()
      console.error('[Telegram] Send message failed:', error)
    } else {
      const result = await response.json()
      console.log('[Telegram] Message sent successfully:', result)
    }
  } catch (error) {
    console.error('[Telegram] Send message error:', error)
  }
}
