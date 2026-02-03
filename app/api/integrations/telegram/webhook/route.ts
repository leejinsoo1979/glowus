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
import { saveAgentMemory } from '@/lib/memory/agent-memory-service'
import {
  loadAgentWorkContext,
  formatContextForPrompt,
  processAgentConversation,
} from '@/lib/agent/work-memory'
import { buildAgentContext } from '@/lib/memory/agent-os'
import { buildSkillsContext, type AgentSkill } from '@/lib/agent/shared-prompts'

/**
 * 디버그 메시지 표시 여부
 * false: 사용자에게 최종 응답만 표시 (프로덕션)
 * true: 에이전트 시작, LLM 응답 등 내부 상태 표시 (개발용)
 */
const SHOW_DEBUG_MESSAGES = false

/**
 * 🆕 사용자 호칭 변환 함수
 * user_title ID를 실제 호칭 텍스트로 변환
 */
function getUserTitleText(userTitle: string | null, userName?: string): string {
  const titleMap: Record<string, string> = {
    boss: '사장님',
    ceo: '대표님',
    director: '이사님',
    manager: '부장님',
    team_leader: '팀장님',
    senior: '선배님',
    name: userName ? `${userName}님` : '님',
  }

  if (!userTitle) return '님'  // 기본값
  if (titleMap[userTitle]) return titleMap[userTitle]
  return userTitle  // custom 값이면 그대로 사용
}

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

// 🆕 코딩 작업 대기 상태 (GlowUS 프로젝트 생성 질문 후 응답 대기)
interface PendingCodingTask {
  instruction: string
  projectName: string
  projectPath: string
  isExistingProject: boolean
  generatedPrompt: string
  timestamp: number
  telegramUserId: string
  agentId: string
}
const pendingCodingTasks = new Map<number, PendingCodingTask>()

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
 * 텔레그램 대화 히스토리에서 최근 대화 로드
 * telegram_chat_messages + telegram_chat_sessions 조인
 */
async function loadTelegramChatHistory(
  supabase: any,
  agentId: string,
  chatId: number,
  limit: number = 30
): Promise<Array<{ role: string; content: string; timestamp: string }>> {
  try {
    // 1. 해당 agent의 세션 찾기
    const { data: session } = await supabase
      .from('telegram_chat_sessions')
      .select('id')
      .eq('agent_id', agentId)
      .eq('chat_id', chatId)
      .single()

    if (!session) {
      console.log(`[TelegramHistory] No session found for agent ${agentId}, chat ${chatId}`)
      return []
    }

    // 2. 세션의 최근 메시지 조회
    const { data: messages, error } = await supabase
      .from('telegram_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[TelegramHistory] Error loading messages:', error)
      return []
    }

    const history = (messages || [])
      .reverse() // 시간순 정렬
      .map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: m.created_at
      }))

    console.log(`[TelegramHistory] Loaded ${history.length} messages for agent ${agentId}`)
    return history
  } catch (error) {
    console.error('[TelegramHistory] Error:', error)
    return []
  }
}

/**
 * 텔레그램 대화를 agent_memories 테이블에도 저장
 * Long-term Memory 시스템과 통합
 */
async function saveTelegramToAgentMemory(
  agentId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  chatId: number
): Promise<void> {
  try {
    await saveAgentMemory({
      agentId,
      memoryType: 'private',
      content: `[${role.toUpperCase()}] ${content}`,
      importance: role === 'user' ? 6 : 5, // 1-10 스케일, 사용자 메시지가 조금 더 중요
      relationshipId: userId,
      metadata: {
        role,
        source: 'telegram',
        chatId,
        originalContent: content,
        timestamp: new Date().toISOString()
      }
    })
    console.log(`[TelegramMemory] Saved ${role} message to agent_memories`)
  } catch (error) {
    console.warn('[TelegramMemory] Error saving to agent_memories:', error)
    // 실패해도 대화는 계속 진행
  }
}

/**
 * GlowUS 워크스페이스에 프로젝트 생성
 */
async function createGlowUSProject(
  supabase: any,
  userId: string,
  agentId: string,
  projectName: string,
  projectPath: string,
  githubUrl?: string
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    // 1. 프로젝트 생성
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: projectName,
        description: `텔레그램에서 생성된 프로젝트`,
        owner_id: userId,
        status: 'active',
        local_path: projectPath,
        github_url: githubUrl || null,
        metadata: {
          source: 'telegram',
          created_by_agent: agentId,
          created_at: new Date().toISOString()
        }
      })
      .select('id')
      .single()

    if (projectError) {
      console.error('[GlowUS Project] Error creating project:', projectError)
      return { success: false, error: projectError.message }
    }

    console.log(`[GlowUS Project] ✅ Created project: ${projectName} (${project.id})`)

    // 2. 에이전트 작업 로그 기록
    await supabase
      .from('agent_work_logs')
      .insert({
        agent_id: agentId,
        user_id: userId,
        work_type: 'project_create',
        title: `프로젝트 생성: ${projectName}`,
        description: `텔레그램을 통해 ${projectName} 프로젝트를 생성했습니다.`,
        status: 'completed',
        metadata: {
          project_id: project.id,
          project_path: projectPath,
          github_url: githubUrl
        }
      })

    return { success: true, projectId: project.id }
  } catch (error: any) {
    console.error('[GlowUS Project] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 코딩 작업 완료 후 GlowUS 프로젝트에 커밋 정보 동기화
 */
async function syncCodingResultToGlowUS(
  supabase: any,
  projectId: string,
  agentId: string,
  result: {
    output?: string
    filesCreated?: string[]
    filesModified?: string[]
    gitInfo?: { commitHash?: string; branch?: string; repoUrl?: string }
  }
): Promise<void> {
  try {
    // 1. 프로젝트 업데이트 (GitHub URL 등)
    if (result.gitInfo?.repoUrl) {
      await supabase
        .from('projects')
        .update({
          github_url: result.gitInfo.repoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
    }

    // 2. 커밋 기록 저장 (agent_commits 테이블이 있으면)
    if (result.gitInfo?.commitHash) {
      try {
        await supabase
          .from('agent_commits')
          .insert({
            agent_id: agentId,
            project_id: projectId,
            commit_hash: result.gitInfo.commitHash,
            branch: result.gitInfo.branch || 'main',
            message: result.output?.substring(0, 500) || 'Coding task completed',
            files_changed: [...(result.filesCreated || []), ...(result.filesModified || [])],
            created_at: new Date().toISOString()
          })
      } catch (commitError) {
        // 테이블이 없을 수 있음 - 무시
        console.warn('[GlowUS Sync] agent_commits table might not exist:', commitError)
      }
    }

    console.log(`[GlowUS Sync] ✅ Synced coding result to project ${projectId}`)
  } catch (error) {
    console.error('[GlowUS Sync] Error:', error)
  }
}

/**
 * 코딩 작업 실행 함수 (GlowUS 프로젝트 생성 여부 포함)
 */
async function executeCodingTask(
  supabase: any,
  chatId: number,
  task: PendingCodingTask,
  telegramUser: any,
  createGlowUSProject: boolean,
  agent: any
): Promise<void> {
  const automationServerUrl = process.env.CLAUDE_AUTOMATION_SERVER_URL || 'http://127.0.0.1:45680'
  const startTime = Date.now()

  // 마지막 프로젝트 저장
  await setLastProject(supabase, task.telegramUserId, task.projectName, task.projectPath)

  // 작업 기록 시작
  const workId = await saveWorkHistory(supabase, task.telegramUserId, chatId,
    task.isExistingProject ? 'project_modify' : 'project_create', {
      projectName: task.projectName,
      projectPath: task.projectPath,
      instruction: task.instruction,
      prompt: task.generatedPrompt,
      status: 'pending'
    })

  let glowusProjectId: string | undefined

  try {
    // 1. GlowUS 프로젝트 생성 (요청한 경우)
    if (createGlowUSProject && telegramUser.user_id) {
      const projectResult = await createGlowUSProjectFn(
        supabase,
        telegramUser.user_id,
        task.agentId,
        task.projectName,
        task.projectPath
      )
      if (projectResult.success) {
        glowusProjectId = projectResult.projectId
        await sendTelegramMessage(chatId, `✅ GlowUS 프로젝트 생성 완료! (ID: ${glowusProjectId?.substring(0, 8)}...)`)
      } else {
        await sendTelegramMessage(chatId, `⚠️ GlowUS 프로젝트 생성 실패: ${projectResult.error}\n\n코딩 작업은 계속 진행합니다.`)
      }
    }

    // 2. 서버 health check
    try {
      const healthCheck = await fetch(`${automationServerUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      if (!healthCheck.ok) throw new Error('Health check failed')
    } catch (healthError: any) {
      if (workId) {
        await updateWorkHistory(supabase, workId, {
          status: 'failed',
          errorMessage: `Automation server health check failed: ${healthError.message}`,
          durationMs: Date.now() - startTime
        })
      }
      await sendTelegramMessage(chatId, `⚠️ Claude Automation Server가 응답하지 않습니다.\n\n터미널에서 서버를 시작하세요:\nnode server/claude-automation-server.js`)
      return
    }

    // 3. 작업 진행 중 상태 업데이트
    if (workId) {
      await updateWorkHistory(supabase, workId, { status: 'in_progress' })
    }

    // 4. 자동화 서버 호출
    const automationResponse = await fetch(`${automationServerUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: task.projectPath,
        repoName: task.projectName,
        prompt: task.generatedPrompt,
        chatId,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramUserId: task.telegramUserId,
        glowusProjectId  // GlowUS 프로젝트 ID 전달
      }),
      signal: AbortSignal.timeout(600000)
    })

    const result = await automationResponse.json()

    if (result.success) {
      if (workId) {
        await updateWorkHistory(supabase, workId, {
          status: 'completed',
          result: result.output?.substring(0, 5000),
          durationMs: Date.now() - startTime
        })
      }

      // 5. GlowUS 프로젝트 동기화
      if (glowusProjectId && result.gitInfo) {
        await syncCodingResultToGlowUS(supabase, glowusProjectId, task.agentId, result)
      }

      await sendTelegramMessage(chatId,
        `🚀 코딩 작업 시작!\n\n` +
        `요청: "${task.instruction}"\n` +
        `프로젝트: ${task.projectName}\n` +
        (glowusProjectId ? `📊 GlowUS 연동: 활성화\n` : '') +
        `\n자세한 진행 상황은 곧 알림됩니다...`
      )
    } else {
      if (workId) {
        await updateWorkHistory(supabase, workId, {
          status: 'failed',
          errorMessage: result.error || '알 수 없는 오류',
          durationMs: Date.now() - startTime
        })
      }
      await sendTelegramMessage(chatId, `❌ 자동화 서버 오류\n\n${result.error || '알 수 없는 오류'}`)
    }
  } catch (error: any) {
    if (workId) {
      await updateWorkHistory(supabase, workId, {
        status: 'failed',
        errorMessage: error.message,
        durationMs: Date.now() - startTime
      })
    }
    await sendTelegramMessage(chatId, `⚠️ Claude Automation Server 연결 실패\n\n오류: ${error.message}`)
  }
}

// createGlowUSProject 함수명 중복 방지를 위한 별칭
const createGlowUSProjectFn = createGlowUSProject

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

    // Command: /pc - 로컬 PC 제어 (Jarvis Local Server)
    if (text.startsWith('/pc ') || text === '/pc') {
      const adminClient = createAdminClient()
      const telegramUserId = String(message.from.id)

      // GlowUS 계정 연결 확인
      const { data: telegramUser } = await (adminClient as any)
        .from('telegram_users')
        .select('user_id')
        .eq('id', telegramUserId)
        .single()

      if (!telegramUser?.user_id) {
        await sendTelegramMessage(chatId, `❌ GlowUS 계정 연결이 필요합니다.\n\n/link your@email.com 으로 먼저 연결해주세요.`)
        return NextResponse.json({ ok: true })
      }

      const pcCommand = text === '/pc' ? 'help' : text.substring(4).trim()
      const pcResult = await handlePCCommand(pcCommand, telegramUser.user_id, chatId)
      await sendTelegramMessage(chatId, pcResult)
      return NextResponse.json({ ok: true })
    }

    // Command: /browser or /브라우저 - 브라우저 자동화
    if (text.startsWith('/browser ') || text === '/browser' || text.startsWith('/브라우저 ') || text === '/브라우저') {
      const adminClient = createAdminClient()
      const telegramUserId = String(message.from.id)

      // GlowUS 계정 연결 확인
      const { data: telegramUser } = await (adminClient as any)
        .from('telegram_users')
        .select('user_id')
        .eq('id', telegramUserId)
        .single()

      if (!telegramUser?.user_id) {
        await sendTelegramMessage(chatId, `❌ GlowUS 계정 연결이 필요합니다.\n\n/link your@email.com 으로 먼저 연결해주세요.`)
        return NextResponse.json({ ok: true })
      }

      const browserInstruction = text.replace(/^\/(browser|브라우저)\s*/, '').trim()

      if (!browserInstruction || browserInstruction === 'help') {
        await sendTelegramMessage(chatId, `🌐 브라우저 자동화 명령어

사용법: /browser <지시>

예시:
/browser 쿠팡에서 에어팟 장바구니 담아
/browser 네이버에서 날씨 검색해
/browser 유튜브에서 뉴진스 틀어
/browser 구글에서 맛집 검색

💡 자주 쓰는 작업은 자동으로 스크립트로 저장되어 토큰을 절약합니다.

⚠️ 맥북에서 jarvis-local-server가 실행 중이어야 합니다.`)
        return NextResponse.json({ ok: true })
      }

      const browserResult = await handleBrowserCommand(browserInstruction, telegramUser.user_id, chatId)
      await sendTelegramMessage(chatId, browserResult)
      return NextResponse.json({ ok: true })
    }

    // Command: /jarvis - GlowUS 제어 (Jarvis 시스템)
    if (text.startsWith('/jarvis ') || text === '/jarvis') {
      const adminClient = createAdminClient()
      const telegramUserId = String(message.from.id)

      // GlowUS 계정 연결 확인
      const { data: telegramUser } = await (adminClient as any)
        .from('telegram_users')
        .select('user_id')
        .eq('id', telegramUserId)
        .single()

      if (!telegramUser?.user_id) {
        await sendTelegramMessage(chatId, `❌ GlowUS 계정 연결이 필요합니다.\n\n/link your@email.com 으로 먼저 연결해주세요.`)
        return NextResponse.json({ ok: true })
      }

      const userId = telegramUser.user_id
      const jarvisCommand = text === '/jarvis' ? 'help' : text.substring(8).trim()

      // Jarvis 명령 처리
      const jarvisResult = await handleJarvisCommand(jarvisCommand, userId, chatId)
      await sendTelegramMessage(chatId, jarvisResult)
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

    // ========================================
    // 🧠 LLM 기반 의도 분류 (Intent Classification)
    // 하드코딩 대신 LLM이 메시지 의도를 판단
    // ========================================
    type MessageIntent = 'chat' | 'self_inquiry' | 'coding' | 'shopping' | 'mac_control' | 'file_task'

    async function classifyIntent(message: string, agentName: string): Promise<{ intent: MessageIntent; confidence: number; reason: string }> {
      const classificationPrompt = `You are an intent classifier for an AI agent named "${agentName}".
Analyze the user message and classify it into ONE of these categories:

1. **self_inquiry** - Questions about the AI agent itself (${agentName}), its status, updates, capabilities, memory, or what it has done
   Examples: "오늘 업데이트 뭐야?", "뭐 바뀌었어?", "최근 변경사항", "너 뭐했어?", "업데이트된거 알려줘", "${agentName} 뭐해?", "넌 뭐야?", "너 뭐할 수 있어?"
   Key signals: 너, 뭐했어, 업데이트, 변경, 바뀐거, 할 수 있어, 기능, 상태

2. **chat** - General conversation, greetings, questions about EXTERNAL things (news, weather, other people, products, world events)
   Examples: "안녕", "날씨 어때?", "뉴스 알려줘", "BTS 뭐해?", "아이폰 16 나왔어?"

3. **coding** - Requests to write, modify, create, or fix code/programs/apps
   Examples: "테트리스 만들어줘", "버그 고쳐줘", "함수 추가해", "리팩토링해줘"

4. **shopping** - Shopping, purchasing, orders, product search
   Examples: "쿠팡에서 검색해줘", "장바구니에 담아", "주문해줘"

5. **mac_control** - Control Mac apps, open programs, run scripts
   Examples: "사파리 열어", "음악 틀어줘", "볼륨 올려"

6. **file_task** - File operations, downloads, web scraping
   Examples: "이미지 다운로드해", "크롤링해줘", "파일 저장해"

IMPORTANT: If the question is about "updates", "changes", "what happened", "status" WITHOUT specifying an external subject, it's likely asking about the AI agent (self_inquiry).

User message: "${message}"

Respond in JSON format only:
{"intent": "chat|self_inquiry|coding|shopping|mac_control|file_task", "confidence": 0.0-1.0, "reason": "brief explanation"}`;

      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: classificationPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
        })

        const responseText = result.response.text().trim()
        // JSON 파싱 (```json 블록 제거)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          console.log(`[Intent] Classified as "${parsed.intent}" (${(parsed.confidence * 100).toFixed(0)}%): ${parsed.reason}`)
          return parsed
        }
      } catch (error) {
        console.error('[Intent] Classification failed:', error)
      }

      // 분류 실패 시 기본값: chat
      return { intent: 'chat', confidence: 0.5, reason: 'classification failed, defaulting to chat' }
    }

    const { intent: messageIntent, confidence: intentConfidence } = await classifyIntent(instruction, agent.name)

    // 의도에 따른 도구 필터링
    if (messageIntent === 'coding' && intentConfidence >= 0.7) {
      // 코딩 작업 시 Mac 제어 도구만 (Claude Code에 위임)
      const allowedTools = ['open_app', 'run_applescript', 'run_terminal']
      tools = tools.filter(t => allowedTools.includes(t.name))
      console.log(`[Telegram Chat] 🔥 CODING MODE: Only ${tools.length} Mac control tools`)
    } else if (messageIntent === 'self_inquiry') {
      // 자기 자신에 대한 질문 - 웹 검색 도구 제거, 메모리에서 답변하도록
      tools = tools.filter(t => t.name !== 'web_search' && t.name !== 'tavily_search')
      console.log(`[Telegram Chat] 🧠 SELF-INQUIRY MODE: Answer from memory, no web search`)
    } else if (messageIntent === 'shopping') {
      console.log(`[Telegram Chat] 🛒 SHOPPING MODE: ${tools.length} tools available`)
    } else if (messageIntent === 'chat') {
      console.log(`[Telegram Chat] 💬 CHAT MODE: General conversation`)
    }

    console.log(`[Telegram Chat] Created ${tools.length} tools for agent ${agent.name}`)

    // ========================================
    // 🧠 Long-term Memory Context Load (LLM 독립적)
    // GlowUS 계정 연결된 경우 롱텀 메모리 로드
    // + 텔레그램 대화 히스토리도 함께 로드
    // ========================================
    let longTermMemoryContext = ''
    const glowusUserId = telegramUser.user_id

    // 텔레그램 대화 히스토리 로드 (항상)
    const telegramHistory = await loadTelegramChatHistory(supabase, agent.id, chatId, 30)
    let telegramHistoryContext = ''
    if (telegramHistory.length > 0) {
      telegramHistoryContext = `## 📱 텔레그램 대화 기록 (최근 ${telegramHistory.length}개)
${telegramHistory.map(m => {
  const date = new Date(m.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const roleLabel = m.role === 'user' ? '사용자' : '나'
  return `- [${date}] ${roleLabel}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`
}).join('\n')}`
      console.log(`[Telegram Chat] 📱 Telegram history loaded: ${telegramHistory.length} messages`)
    }

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

        // 컨텍스트 병합 (텔레그램 히스토리 포함)
        longTermMemoryContext = [
          telegramHistoryContext,  // 텔레그램 대화 기록 먼저
          agentOsContext,
          jarvisContext.formattedContext,
          workContextFormatted,
        ].filter(Boolean).join('\n\n---\n\n')

        if (longTermMemoryContext) {
          console.log(`[Telegram Chat] 🧠 Long-term Memory loaded: ${longTermMemoryContext.length} chars`)
        }
      } catch (memoryError) {
        console.error('[Telegram Chat] Memory load error:', memoryError)
        // 메모리 로드 실패해도 텔레그램 히스토리는 사용
        longTermMemoryContext = telegramHistoryContext
      }
    } else {
      // GlowUS 계정 없어도 텔레그램 히스토리는 로드
      longTermMemoryContext = telegramHistoryContext
    }

    // 🎯 에이전트 스킬 로드 (Supabase에서 장착된 스킬 가져오기)
    let skillsContext = ''
    try {
      const { data: skills } = await supabase
        .from('agent_skills')
        .select('id, name, description, content, enabled, files, metadata')
        .eq('agent_id', agent.id)
        .eq('enabled', true)

      if (skills && skills.length > 0) {
        skillsContext = buildSkillsContext(skills as AgentSkill[])
        console.log(`[Telegram Chat] 🎯 Skills loaded: ${skills.length} enabled skills for ${agent.name}`)
      }
    } catch (skillError) {
      console.warn('[Telegram Chat] Failed to load agent skills:', skillError)
    }

    // 디버그 모드에서만 시작 알림 표시
    if (SHOW_DEBUG_MESSAGES) {
      const taskMode = messageIntent === 'coding' ? ' [코딩 모드]' : messageIntent === 'shopping' ? ' [쇼핑 모드]' : ` [${messageIntent}]`
      const memoryStatus = longTermMemoryContext ? ' [메모리 활성화]' : ''
      const skillsStatus = skillsContext ? ' [스킬 활성화]' : ''
      await sendTelegramMessage(chatId, `🤖 ${agent.name} 에이전트 시작 (도구 ${tools.length}개)${taskMode}${memoryStatus}${skillsStatus}`)
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

    // 🎯 스킬 섹션 생성
    const skillsSection = skillsContext ? `
${skillsContext}
---
` : ''

    // 🆕 사용자 호칭 계산
    const userTitle = getUserTitleText(agent.user_title, telegramUser.first_name || telegramUser.username)

    const systemPrompt = `You are ${agent.name}, a POWERFUL AUTONOMOUS AI AGENT with FULL SYSTEM ACCESS.
${identitySection}${memorySection}${skillsSection}

# 📛 HOW TO ADDRESS THE USER
**ALWAYS call the user "${userTitle}"**. This is their preferred title.
Examples: "네, ${userTitle}!", "${userTitle}, 완료했습니다!", "${userTitle}께서 요청하신..."

# 🧠 SELF-AWARENESS: QUESTIONS ABOUT YOURSELF
**YOUR NAME IS "${agent.name}"**. When user asks about "${agent.name}" or "너", they are asking about YOU.

${messageIntent === 'self_inquiry' ? `
## 🚨 CURRENT MODE: SELF-INQUIRY (자기 자신에 대한 질문)
The user is asking about YOU. DO NOT use any tools. Answer DIRECTLY from your memory above.

**HOW TO ANSWER:**
1. Look at your LONG-TERM MEMORY section above
2. Summarize what you remember (recent conversations, tasks, requests)
3. If memory is empty, say "최근 기억된 대화나 작업이 없습니다"
4. NEVER say "업데이트가 없습니다" if you have memory content above

**EXAMPLE GOOD ANSWER:**
"최근 기억을 확인해보니:
- [날짜] 유튜브 영상 분석 및 PPT 제작 요청을 받았습니다
- [날짜] 텔레그램 지시 내용에 대해 대화했습니다
- [날짜] 여러 번 인사를 나눴습니다"
` : `
## Questions about yourself - NEVER use web_search:
- "${agent.name} 업데이트", "${agent.name} 뭐했어", "너 뭐 바뀌었어" → Answer from YOUR MEMORY above
- "오늘 뭐했어?", "최근 변경사항", "업데이트된거" → Check your LONG-TERM MEMORY section
- "넌 뭐야?", "너 누구야?" → Answer from YOUR IDENTITY section

## When to use web_search:
- Questions about external things (news, weather, other people, products)
- NOT questions about yourself or your capabilities
`}
---

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

# 🚨 ABSOLUTE RULES:

## 1. TOOL USAGE RULES
${messageIntent === 'self_inquiry' ? `
**⚠️ SELF-INQUIRY MODE: DO NOT USE TOOLS**
- This is a question about yourself - answer from memory ONLY
- NO tool calls needed - just respond with text
- Read your LONG-TERM MEMORY section and summarize it
` : `
- You have 54 powerful tools for Mac system control
- EVERY ACTION request MUST result in tool calls
- If unsure which tool, try the most relevant one
- NEVER say "완료했습니다" until ALL steps are executed
`}

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
- Example: Instead of just "✅ 완료", say "네, ${userTitle}! Pages를 열고 글을 작성했어요. 다른 도움이 필요하시면 말씀해주세요~ 😊"
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

    // 🆕 코딩 작업 대기 중인 응답 처리 (GlowUS 프로젝트 생성 여부)
    const pendingTask = pendingCodingTasks.get(chatId)
    if (pendingTask) {
      const lowerInstruction = instruction.toLowerCase()
      const affirmativeKeywords = ['응', '네', 'ㅇㅇ', '해줘', '만들어', '생성해', 'yes', 'ok', '좋아', '그래']
      const negativeKeywords = ['아니', '노', 'ㄴㄴ', '안해', '필요없', 'no', '괜찮', '됐어']

      const isAffirmative = affirmativeKeywords.some(kw => lowerInstruction.includes(kw))
      const isNegative = negativeKeywords.some(kw => lowerInstruction.includes(kw))

      if (isAffirmative || isNegative) {
        // 대기 상태 제거
        pendingCodingTasks.delete(chatId)

        // 코딩 작업 실행 (GlowUS 프로젝트 생성 여부 전달)
        await executeCodingTask(
          supabase,
          chatId,
          pendingTask,
          telegramUser,
          isAffirmative, // createGlowUSProject
          agent
        )
        return NextResponse.json({ ok: true })
      }

      // 10분 지났으면 대기 상태 제거
      if (Date.now() - pendingTask.timestamp > 10 * 60 * 1000) {
        pendingCodingTasks.delete(chatId)
      }
    }

    // 🔥 코딩 지시 감지 - Claude Automation Server로 직접 호출
    if (messageIntent === 'coding' && intentConfidence >= 0.7) {
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

      // 프로젝트 경로 결정
      const baseProjectDir = process.env.PROJECTS_BASE_DIR || '/Users/jinsoolee/Documents'
      let projectPath: string
      if (projectName) {
        projectPath = `${baseProjectDir}/${projectName}`
      } else {
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        projectName = `claude-${timestamp}-${Date.now().toString(36)}`
        projectPath = `${baseProjectDir}/${projectName}`
      }

      // 🆕 코딩 작업 실행 처리
      const pendingTask: PendingCodingTask = {
        instruction: codingInstruction,
        projectName,
        projectPath,
        isExistingProject,
        generatedPrompt: generatedEnglishPrompt,
        timestamp: Date.now(),
        telegramUserId: telegramUser.id,
        agentId: agent.id
      }

      // 새 프로젝트이고 GlowUS 계정이 연동된 경우: 사용자에게 질문
      if (!isExistingProject && glowusUserId) {
        pendingCodingTasks.set(chatId, pendingTask)

        await sendTelegramMessage(chatId,
          `📁 "${projectName}" 프로젝트를 만들게요.\n\n` +
          `GlowUS 워크스페이스에도 프로젝트를 생성할까요?\n\n` +
          `✅ 생성하면: 대시보드에서 보기, 커밋 기록 추적, Neural Map 연동\n` +
          `❌ 안하면: GitHub에만 저장\n\n` +
          `(응/아니)`
        )
        return NextResponse.json({ ok: true })
      }

      // 기존 프로젝트 수정이거나 GlowUS 미연동: 바로 실행 (GlowUS 프로젝트 생성 안함)
      console.log(`[Telegram Webhook] 🔥 Executing coding task directly (isExisting: ${isExistingProject}, glowusLinked: ${!!glowusUserId})`)
      await executeCodingTask(supabase, chatId, pendingTask, telegramUser, false, agent)
      return NextResponse.json({ ok: true })
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
        // 5. agent_memories 테이블에도 저장 (user 메시지)
        saveTelegramToAgentMemory(agent.id, glowusUserId, 'user', instruction, chatId),
        // 6. agent_memories 테이블에도 저장 (assistant 응답)
        saveTelegramToAgentMemory(agent.id, glowusUserId, 'assistant', finalResponseStr, chatId),
      ]).then(() => {
        console.log(`[Telegram Chat] 🧠 Long-term Memory saved (cross-platform + agent_memories)`)
      }).catch(err => {
        console.error('[Telegram Chat] Long-term Memory error:', err)
      })
    } else {
      // GlowUS 연결 없어도 agent_memories에는 저장 (telegram_user.id 사용)
      Promise.all([
        saveTelegramToAgentMemory(agent.id, telegramUser.id, 'user', instruction, chatId),
        saveTelegramToAgentMemory(agent.id, telegramUser.id, 'assistant', finalResponseStr, chatId),
      ]).then(() => {
        console.log(`[Telegram Chat] 🧠 agent_memories saved (telegram user only)`)
      }).catch(err => {
        console.error('[Telegram Chat] agent_memories error:', err)
      })
      console.log(`[Telegram Chat] ⚠️ No GlowUS user linked - using telegram user ID for memory`)
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

/**
 * Jarvis 명령 처리 - GlowUS 제어 (Control API 통합)
 */
async function handleJarvisCommand(command: string, userId: string, chatId: number): Promise<string> {
  const adminClient = createAdminClient()
  const args = command.split(' ')
  const action = args[0].toLowerCase()

  // GlowUS Control API 호출 헬퍼
  const callControlAPI = async (apiAction: string, params: Record<string, any> = {}) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/jarvis/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: apiAction, params, _userId: userId }),
    })
    return res.json()
  }

  try {
    switch (action) {
      case 'help':
      case '':
        return `🤖 Jarvis GlowUS 제어 명령어

📋 에이전트 관리:
/jarvis agents - 내 에이전트 목록
/jarvis agent create <이름> - 새 에이전트 생성
/jarvis agent delete <이름> - 에이전트 삭제

📁 프로젝트 관리:
/jarvis projects - 내 프로젝트 목록
/jarvis project create <이름> - 새 프로젝트 생성
/jarvis project delete <이름> - 프로젝트 삭제

🔧 스킬 관리:
/jarvis skills <에이전트> - 에이전트 스킬 목록
/jarvis skill add <에이전트> <스킬명> - 스킬 추가
/jarvis skill toggle <스킬ID> <on|off> - 스킬 활성화/비활성화

🧩 스킬 빌더:
/jarvis nodes <에이전트> - 스킬 빌더 노드 목록
/jarvis node add <에이전트> <타입> - 노드 추가
/jarvis node connect <에이전트> <소스ID> <타겟ID> - 노드 연결
/jarvis nodetypes - 사용 가능한 노드 타입

🗺️ 네비게이션:
/jarvis goto <페이지> - 페이지 이동
/jarvis pages - 이동 가능한 페이지 목록

💬 채팅:
/jarvis chat <에이전트> <메시지> - 에이전트에게 메시지 전송

📊 상태:
/jarvis status - 시스템 상태`

      // === 에이전트 목록 ===
      case 'agents':
        const { data: agents, error: agentsError } = await adminClient
          .from('deployed_agents')
          .select('id, name, description, status, llm_model')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })

        if (agentsError) throw new Error(agentsError.message)
        if (!agents || agents.length === 0) {
          return '📋 에이전트가 없습니다.\n\n/jarvis agent create <이름> 으로 생성하세요.'
        }

        let agentList = `🤖 내 에이전트 (${agents.length}개)\n\n`
        agents.forEach((a: any, i: number) => {
          const status = a.status === 'ACTIVE' ? '✅' : '⏸️'
          agentList += `${i + 1}. ${status} ${a.name}\n`
          if (a.description) agentList += `   ${a.description}\n`
          agentList += `   모델: ${a.llm_model || 'gpt-4o-mini'}\n\n`
        })
        return agentList

      // === 에이전트 생성 ===
      case 'agent':
        const agentAction = args[1]?.toLowerCase()
        const agentName = args.slice(2).join(' ')

        if (agentAction === 'create') {
          if (!agentName) return '❌ 에이전트 이름을 입력하세요.\n\n/jarvis agent create <이름>'

          const { data: newAgent, error: createError } = await adminClient
            .from('deployed_agents')
            .insert({
              owner_id: userId,
              name: agentName,
              description: '',
              llm_provider: 'openai',
              llm_model: 'gpt-4o-mini',
              status: 'ACTIVE',
            })
            .select()
            .single()

          if (createError) throw new Error(createError.message)
          return `✅ 에이전트 "${agentName}" 생성 완료!\n\nID: ${newAgent.id}`
        }

        if (agentAction === 'delete') {
          if (!agentName) return '❌ 에이전트 이름을 입력하세요.\n\n/jarvis agent delete <이름>'

          const { error: deleteError } = await adminClient
            .from('deployed_agents')
            .delete()
            .eq('name', agentName)
            .eq('owner_id', userId)

          if (deleteError) throw new Error(deleteError.message)
          return `✅ 에이전트 "${agentName}" 삭제 완료`
        }

        return '❌ 알 수 없는 명령입니다.\n\n사용법:\n/jarvis agent create <이름>\n/jarvis agent delete <이름>'

      // === 프로젝트 목록 ===
      case 'projects':
        const { data: projects, error: projectsError } = await adminClient
          .from('projects')
          .select('id, name, description, status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (projectsError) throw new Error(projectsError.message)
        if (!projects || projects.length === 0) {
          return '📁 프로젝트가 없습니다.\n\n/jarvis project create <이름> 으로 생성하세요.'
        }

        let projectList = `📁 내 프로젝트 (${projects.length}개)\n\n`
        projects.forEach((p: any, i: number) => {
          projectList += `${i + 1}. ${p.name}\n`
          if (p.description) projectList += `   ${p.description}\n`
          projectList += '\n'
        })
        return projectList

      // === 프로젝트 생성/삭제 ===
      case 'project':
        const projectAction = args[1]?.toLowerCase()
        const projectName = args.slice(2).join(' ')

        if (projectAction === 'create') {
          if (!projectName) return '❌ 프로젝트 이름을 입력하세요.\n\n/jarvis project create <이름>'

          const { data: newProject, error: createProjError } = await adminClient
            .from('projects')
            .insert({
              user_id: userId,
              name: projectName,
              description: '',
            })
            .select()
            .single()

          if (createProjError) throw new Error(createProjError.message)
          return `✅ 프로젝트 "${projectName}" 생성 완료!\n\nID: ${newProject.id}`
        }

        if (projectAction === 'delete') {
          if (!projectName) return '❌ 프로젝트 이름을 입력하세요.\n\n/jarvis project delete <이름>'

          const { error: deleteProjError } = await adminClient
            .from('projects')
            .delete()
            .eq('name', projectName)
            .eq('user_id', userId)

          if (deleteProjError) throw new Error(deleteProjError.message)
          return `✅ 프로젝트 "${projectName}" 삭제 완료`
        }

        return '❌ 알 수 없는 명령입니다.\n\n사용법:\n/jarvis project create <이름>\n/jarvis project delete <이름>'

      // === 스킬 목록 ===
      case 'skills':
        const targetAgent = args.slice(1).join(' ')
        if (!targetAgent) return '❌ 에이전트 이름을 입력하세요.\n\n/jarvis skills <에이전트이름>'

        // 에이전트 찾기
        const { data: foundAgent } = await adminClient
          .from('deployed_agents')
          .select('id, name')
          .eq('name', targetAgent)
          .eq('owner_id', userId)
          .single()

        if (!foundAgent) return `❌ 에이전트 "${targetAgent}"를 찾을 수 없습니다.`

        // 스킬 조회
        const { data: skills } = await (adminClient as any)
          .from('agent_skills')
          .select('id, name, description, enabled')
          .eq('agent_id', foundAgent.id)

        if (!skills || skills.length === 0) {
          return `🔧 "${foundAgent.name}" 에이전트에 장착된 스킬이 없습니다.`
        }

        let skillList = `🔧 ${foundAgent.name}의 스킬 (${skills.length}개)\n\n`
        skills.forEach((s: any, i: number) => {
          const status = s.enabled ? '✅' : '⏸️'
          skillList += `${i + 1}. ${status} ${s.name}\n`
          if (s.description) skillList += `   ${s.description}\n`
        })
        return skillList

      // === 시스템 상태 ===
      case 'status':
        const stateResult = await callControlAPI('getState')
        if (stateResult.error) {
          // 폴백: 직접 조회
          const { count: agentCount } = await adminClient
            .from('deployed_agents')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', userId)

          const { count: projectCount } = await adminClient
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)

          return `📊 GlowUS 상태

🤖 에이전트: ${agentCount || 0}개
📁 프로젝트: ${projectCount || 0}개
🔌 Jarvis: 온라인
⏰ 시간: ${new Date().toLocaleString('ko-KR')}`
        }

        return `📊 GlowUS 상태

🤖 에이전트: ${stateResult.agentCount || 0}개 (활성: ${stateResult.activeAgentCount || 0})
📁 프로젝트: ${stateResult.projectCount || 0}개
🔌 Jarvis: 온라인
⏰ 시간: ${new Date().toLocaleString('ko-KR')}`

      // === 스킬 추가/토글 ===
      case 'skill':
        const skillAction = args[1]?.toLowerCase()

        if (skillAction === 'add') {
          const skillAgentName = args[2]
          const skillName = args.slice(3).join(' ')
          if (!skillAgentName || !skillName) {
            return '❌ 사용법: /jarvis skill add <에이전트> <스킬명>'
          }

          // 에이전트 ID 찾기
          const { data: foundSkillAgent } = await adminClient
            .from('deployed_agents')
            .select('id')
            .eq('name', skillAgentName)
            .eq('owner_id', userId)
            .single()

          if (!foundSkillAgent) return `❌ 에이전트 "${skillAgentName}"를 찾을 수 없습니다.`

          const addResult = await callControlAPI('addSkill', {
            agentId: foundSkillAgent.id,
            name: skillName
          })

          if (addResult.error) return `❌ 스킬 추가 실패: ${addResult.error}`
          return `✅ "${skillAgentName}"에 스킬 "${skillName}" 추가 완료!`
        }

        if (skillAction === 'toggle') {
          const skillId = args[2]
          const enabled = args[3]?.toLowerCase() === 'on'
          if (!skillId) return '❌ 사용법: /jarvis skill toggle <스킬ID> <on|off>'

          const toggleResult = await callControlAPI('toggleSkill', {
            skillId,
            enabled
          })

          if (toggleResult.error) return `❌ 스킬 토글 실패: ${toggleResult.error}`
          return `✅ 스킬 ${enabled ? '활성화' : '비활성화'} 완료!`
        }

        return '❌ 사용법:\n/jarvis skill add <에이전트> <스킬명>\n/jarvis skill toggle <스킬ID> <on|off>'

      // === 스킬 빌더 노드 목록 ===
      case 'nodes':
        const nodeAgentName = args.slice(1).join(' ')
        if (!nodeAgentName) return '❌ 에이전트 이름을 입력하세요.\n\n/jarvis nodes <에이전트이름>'

        const { data: nodeAgent } = await adminClient
          .from('deployed_agents')
          .select('id, name')
          .eq('name', nodeAgentName)
          .eq('owner_id', userId)
          .single()

        if (!nodeAgent) return `❌ 에이전트 "${nodeAgentName}"를 찾을 수 없습니다.`

        const builderState = await callControlAPI('getSkillBuilderState', { agentId: nodeAgent.id })
        if (builderState.error) return `❌ 스킬 빌더 조회 실패: ${builderState.error}`

        const nodes = builderState.nodes || []
        if (nodes.length === 0) {
          return `🧩 "${nodeAgent.name}" 스킬 빌더에 노드가 없습니다.\n\n/jarvis node add ${nodeAgentName} <타입> 으로 추가하세요.`
        }

        let nodeList = `🧩 ${nodeAgent.name} 스킬 빌더 노드 (${nodes.length}개)\n\n`
        nodes.forEach((n: any, i: number) => {
          nodeList += `${i + 1}. [${n.type}] ${n.data?.label || n.id}\n`
        })
        return nodeList

      // === 노드 추가/연결 ===
      case 'node':
        const nodeAction = args[1]?.toLowerCase()

        if (nodeAction === 'add') {
          const addNodeAgentName = args[2]
          const nodeType = args[3]
          if (!addNodeAgentName || !nodeType) {
            return '❌ 사용법: /jarvis node add <에이전트> <타입>\n\n/jarvis nodetypes 로 사용 가능한 타입 확인'
          }

          const { data: addNodeAgent } = await adminClient
            .from('deployed_agents')
            .select('id')
            .eq('name', addNodeAgentName)
            .eq('owner_id', userId)
            .single()

          if (!addNodeAgent) return `❌ 에이전트 "${addNodeAgentName}"를 찾을 수 없습니다.`

          const addNodeResult = await callControlAPI('addNode', {
            agentId: addNodeAgent.id,
            type: nodeType
          })

          if (addNodeResult.error) return `❌ 노드 추가 실패: ${addNodeResult.error}`
          return `✅ [${nodeType}] 노드 추가 완료!\n\nID: ${addNodeResult.node?.id}`
        }

        if (nodeAction === 'connect') {
          const connectAgentName = args[2]
          const sourceId = args[3]
          const targetId = args[4]
          if (!connectAgentName || !sourceId || !targetId) {
            return '❌ 사용법: /jarvis node connect <에이전트> <소스ID> <타겟ID>'
          }

          const { data: connectAgent } = await adminClient
            .from('deployed_agents')
            .select('id')
            .eq('name', connectAgentName)
            .eq('owner_id', userId)
            .single()

          if (!connectAgent) return `❌ 에이전트 "${connectAgentName}"를 찾을 수 없습니다.`

          const connectResult = await callControlAPI('connectNodes', {
            agentId: connectAgent.id,
            source: sourceId,
            target: targetId
          })

          if (connectResult.error) return `❌ 노드 연결 실패: ${connectResult.error}`
          return `✅ 노드 연결 완료!\n\n${sourceId} → ${targetId}`
        }

        return '❌ 사용법:\n/jarvis node add <에이전트> <타입>\n/jarvis node connect <에이전트> <소스ID> <타겟ID>'

      // === 노드 타입 목록 ===
      case 'nodetypes':
        const nodeTypesResult = await callControlAPI('getNodeTypes')
        if (nodeTypesResult.error) {
          return `🧩 사용 가능한 노드 타입:

📥 trigger - 트리거 (시작점)
🤖 llm - LLM 호출
🔧 tool - 도구 실행
⚡ action - 액션 실행
🔀 condition - 조건 분기
📤 output - 출력`
        }

        const types = nodeTypesResult.nodeTypes || []
        let typeList = `🧩 사용 가능한 노드 타입 (${types.length}개)\n\n`
        types.forEach((t: any) => {
          typeList += `• ${t.type}: ${t.label}\n`
        })
        return typeList

      // === 네비게이션 ===
      case 'goto':
        const pageName = args.slice(1).join(' ')
        if (!pageName) return '❌ 페이지 이름을 입력하세요.\n\n/jarvis pages 로 이동 가능한 페이지 확인'

        const navResult = await callControlAPI('navigate', { page: pageName })
        if (navResult.error) return `❌ ${navResult.error}\n\n사용 가능: ${navResult.availablePages?.join(', ')}`

        return `✅ ${pageName} 페이지로 이동합니다.\n\n경로: ${navResult.route}`

      // === 페이지 목록 ===
      case 'pages':
        const pagesResult = await callControlAPI('getPages')
        if (pagesResult.error) return `❌ 페이지 목록 조회 실패: ${pagesResult.error}`

        const pages = pagesResult.pages || []
        let pageList = `🗺️ 이동 가능한 페이지 (${pages.length}개)\n\n`
        pages.forEach((p: string, i: number) => {
          pageList += `${i + 1}. ${p}\n`
        })
        pageList += '\n/jarvis goto <페이지> 로 이동하세요.'
        return pageList

      // === 에이전트에게 채팅 전송 ===
      case 'chat':
        const chatAgentName = args[1]
        const chatMessage = args.slice(2).join(' ')
        if (!chatAgentName || !chatMessage) {
          return '❌ 사용법: /jarvis chat <에이전트> <메시지>'
        }

        const { data: chatAgent } = await adminClient
          .from('deployed_agents')
          .select('id, name')
          .eq('name', chatAgentName)
          .eq('owner_id', userId)
          .single()

        if (!chatAgent) return `❌ 에이전트 "${chatAgentName}"를 찾을 수 없습니다.`

        const chatResult = await callControlAPI('sendChat', {
          agentId: chatAgent.id,
          message: chatMessage
        })

        if (chatResult.error) return `❌ 메시지 전송 실패: ${chatResult.error}`
        return `💬 "${chatAgent.name}"에게 메시지 전송 완료!\n\n응답: ${chatResult.response || '(응답 대기 중)'}`

      default:
        return `❌ 알 수 없는 명령: ${action}\n\n/jarvis help 로 사용법을 확인하세요.`
    }
  } catch (error: any) {
    console.error('[Jarvis Telegram] Error:', error)
    return `❌ 오류 발생: ${error.message}`
  }
}

/**
 * PC 제어 명령 처리 - 로컬 Jarvis 서버 호출
 */
async function handlePCCommand(command: string, userId: string, chatId: number): Promise<string> {
  const JARVIS_LOCAL_URL = process.env.JARVIS_LOCAL_URL || 'http://localhost:3099'
  const JARVIS_API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-local-secret-change-me'

  const args = command.split(' ')
  const action = args[0].toLowerCase()

  // 도움말
  if (action === 'help' || action === '') {
    return `🖥️ PC 제어 명령어 (Jarvis Local)

📂 파일 관리:
/pc search <경로> <검색어> - 파일 검색
/pc list <경로> - 폴더 내용 보기
/pc read <파일경로> - 파일 읽기

🚀 앱 제어:
/pc open <앱이름> - 앱 실행
/pc close <앱이름> - 앱 종료
/pc apps - 실행 중인 앱 목록

📋 시스템:
/pc info - 시스템 정보
/pc screenshot - 스크린샷 촬영
/pc url <URL> - URL 열기

🔧 기타:
/pc clipboard - 클립보드 내용
/pc notify <제목> <메시지> - 알림 보내기

⚠️ 맥북에서 jarvis-local-server가 실행 중이어야 합니다.
npm run jarvis:local`
  }

  // 로컬 서버 호출 헬퍼
  async function callLocalServer(tool: string, toolArgs: Record<string, any> = {}): Promise<any> {
    try {
      const response = await fetch(`${JARVIS_LOCAL_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JARVIS_API_SECRET}`,
        },
        body: JSON.stringify({ tool, args: toolArgs }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`서버 오류: ${error}`)
      }

      return await response.json()
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
        throw new Error('로컬 Jarvis 서버가 실행되지 않았습니다.\n\n맥북에서 실행:\nnpm run jarvis:local')
      }
      throw err
    }
  }

  try {
    switch (action) {
      // === 파일 검색 ===
      case 'search':
        const searchPath = args[1] || '~/Downloads'
        const searchQuery = args.slice(2).join(' ')
        if (!searchQuery) return '❌ 검색어를 입력하세요.\n\n/pc search <경로> <검색어>'

        const expandedPath = searchPath.replace('~', '/Users/' + (process.env.USER || 'user'))
        const searchResult = await callLocalServer('search_files', {
          path: expandedPath,
          query: searchQuery,
          recursive: true,
        })

        if (searchResult.count === 0) {
          return `🔍 "${searchQuery}" 검색 결과 없음\n경로: ${searchPath}`
        }

        let searchMsg = `🔍 "${searchQuery}" 검색 결과 (${searchResult.count}개)\n\n`
        searchResult.results.slice(0, 10).forEach((f: string, i: number) => {
          searchMsg += `${i + 1}. ${f}\n`
        })
        if (searchResult.count > 10) {
          searchMsg += `\n... 외 ${searchResult.count - 10}개`
        }
        return searchMsg

      // === 폴더 목록 ===
      case 'list':
      case 'ls':
        const listPath = args[1] || '~'
        const expandedListPath = listPath.replace('~', '/Users/' + (process.env.USER || 'user'))
        const listResult = await callLocalServer('list_directory', { path: expandedListPath })

        if (!listResult.items || listResult.items.length === 0) {
          return `📂 빈 폴더: ${listPath}`
        }

        let listMsg = `📂 ${listPath} (${listResult.items.length}개)\n\n`
        listResult.items.slice(0, 20).forEach((item: any) => {
          const icon = item.type === 'directory' ? '📁' : '📄'
          listMsg += `${icon} ${item.name}\n`
        })
        if (listResult.items.length > 20) {
          listMsg += `\n... 외 ${listResult.items.length - 20}개`
        }
        return listMsg

      // === 파일 읽기 ===
      case 'read':
      case 'cat':
        const readPath = args.slice(1).join(' ')
        if (!readPath) return '❌ 파일 경로를 입력하세요.\n\n/pc read <파일경로>'

        const expandedReadPath = readPath.replace('~', '/Users/' + (process.env.USER || 'user'))
        const readResult = await callLocalServer('read_file', { path: expandedReadPath })

        if (!readResult.success) {
          return `❌ 파일 읽기 실패: ${readResult.error}`
        }

        const content = readResult.content.substring(0, 3000)
        return `📄 ${readPath}\n\n${content}${readResult.content.length > 3000 ? '\n\n... (내용 생략)' : ''}`

      // === 앱 실행 ===
      case 'open':
        const appToOpen = args.slice(1).join(' ')
        if (!appToOpen) return '❌ 앱 이름을 입력하세요.\n\n/pc open <앱이름>\n예: /pc open Safari'

        const openResult = await callLocalServer('launch_app', { appName: appToOpen })
        return openResult.success ? `🚀 ${appToOpen} 실행 완료` : `❌ 실행 실패: ${openResult.error}`

      // === 앱 종료 ===
      case 'close':
      case 'kill':
        const appToClose = args.slice(1).join(' ')
        if (!appToClose) return '❌ 앱 이름을 입력하세요.\n\n/pc close <앱이름>'

        const closeResult = await callLocalServer('kill_app', { appName: appToClose })
        return closeResult.success ? `⏹️ ${appToClose} 종료 완료` : `❌ 종료 실패: ${closeResult.error}`

      // === 실행 중인 앱 ===
      case 'apps':
        const appsResult = await callLocalServer('list_running_apps', {})
        const appList = appsResult.apps?.filter((a: string) => !a.startsWith('/') && a.length > 0) || []

        if (appList.length === 0) {
          return '📱 실행 중인 앱 없음'
        }

        return `📱 실행 중인 앱 (${appList.length}개)\n\n${appList.slice(0, 20).join('\n')}`

      // === 시스템 정보 ===
      case 'info':
        const infoResult = await callLocalServer('get_system_info', {})
        return `🖥️ 시스템 정보

💻 호스트: ${infoResult.hostname}
👤 사용자: ${infoResult.username}
🖥️ 플랫폼: ${infoResult.platform} (${infoResult.arch})
🧠 CPU: ${infoResult.cpus}코어
💾 메모리: ${infoResult.freeMemory} / ${infoResult.totalMemory}
⏱️ 가동시간: ${infoResult.uptime}`

      // === 스크린샷 ===
      case 'screenshot':
      case 'ss':
        const ssResult = await callLocalServer('take_screenshot', {})
        return ssResult.success ? `📸 스크린샷 저장: ${ssResult.path}` : `❌ 실패: ${ssResult.error}`

      // === URL 열기 ===
      case 'url':
        const url = args[1]
        if (!url) return '❌ URL을 입력하세요.\n\n/pc url <URL>'

        const urlResult = await callLocalServer('open_url', { url })
        return urlResult.success ? `🌐 URL 열기: ${url}` : `❌ 실패: ${urlResult.error}`

      // === 클립보드 ===
      case 'clipboard':
      case 'clip':
        const clipResult = await callLocalServer('get_clipboard', {})
        if (!clipResult.success) return `❌ 클립보드 읽기 실패`

        const clipContent = clipResult.content?.substring(0, 1000) || '(비어있음)'
        return `📋 클립보드:\n\n${clipContent}`

      // === 알림 ===
      case 'notify':
        const notifyTitle = args[1] || 'Jarvis'
        const notifyMessage = args.slice(2).join(' ') || '알림'

        const notifyResult = await callLocalServer('send_notification', {
          title: notifyTitle,
          message: notifyMessage,
        })
        return notifyResult.success ? `🔔 알림 전송 완료` : `❌ 실패: ${notifyResult.error}`

      // === 핑 ===
      case 'ping':
        const pingResult = await callLocalServer('ping', {})
        return pingResult.success ? `✅ Jarvis Local 서버 온라인\n⏰ ${pingResult.timestamp}` : `❌ 오프라인`

      default:
        return `❌ 알 수 없는 명령: ${action}\n\n/pc help 로 사용법을 확인하세요.`
    }
  } catch (error: any) {
    console.error('[PC Command] Error:', error)
    return `❌ 오류: ${error.message}`
  }
}

/**
 * 브라우저 자동화 명령 처리
 * 스크립트 우선, 없으면 AI 폴백 안내
 */
async function handleBrowserCommand(instruction: string, userId: string, chatId: number): Promise<string> {
  const JARVIS_LOCAL_URL = process.env.JARVIS_LOCAL_URL || 'http://localhost:3099'
  const JARVIS_API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-local-secret-change-me'

  try {
    // 1. 저장된 스크립트 찾기
    const adminClient = createAdminClient()

    // 도메인 추출
    const domainMap: Record<string, string[]> = {
      'coupang.com': ['쿠팡', 'coupang'],
      'naver.com': ['네이버', 'naver'],
      'google.com': ['구글', 'google'],
      'youtube.com': ['유튜브', 'youtube'],
      'gmarket.com': ['지마켓', 'gmarket'],
      '11st.co.kr': ['11번가', '11st'],
    }

    let domain: string | null = null
    const lowerInstruction = instruction.toLowerCase()
    for (const [d, keywords] of Object.entries(domainMap)) {
      if (keywords.some(k => lowerInstruction.includes(k))) {
        domain = d
        break
      }
    }

    if (!domain) {
      return `❌ 지원하는 사이트를 찾을 수 없습니다.

현재 지원 사이트:
• 쿠팡 (coupang.com)
• 네이버 (naver.com)
• 구글 (google.com)
• 유튜브 (youtube.com)
• 지마켓 (gmarket.com)
• 11번가 (11st.co.kr)

예시: /browser 쿠팡에서 에어팟 검색해`
    }

    // 2. 스크립트 조회
    const { data: scripts } = await (adminClient as any)
      .from('browser_scripts')
      .select('*')
      .eq('site_domain', domain)
      .eq('is_active', true)
      .or(`user_id.eq.${userId},is_public.eq.true`)
      .order('success_count', { ascending: false })
      .limit(1)

    if (!scripts || scripts.length === 0) {
      return `⚠️ "${domain}"에 대한 저장된 스크립트가 없습니다.

🤖 AI로 실행하시겠습니까? (토큰 약 15,000 소모)

GlowUS 웹에서 AI 브라우저 모드를 사용하거나,
스크립트를 먼저 등록해주세요.`
    }

    const script = scripts[0]

    // 3. 변수 추출
    const variables: Record<string, any> = {}
    const scriptVars = script.variables || []

    for (const v of scriptVars) {
      if (v.name === 'productName' || v.name === 'query') {
        // "에어팟을 장바구니에 담아" → "에어팟"
        const patterns = [
          /(.+?)을?\s*(장바구니|카트|담|구매|검색|찾)/,
          /에서\s+(.+?)\s*(검색|찾|틀어|재생)/,
          /(.+?)\s*(틀어|재생|봐)/,
        ]

        for (const pattern of patterns) {
          const match = instruction.match(pattern)
          if (match) {
            variables[v.name] = match[1].trim()
            break
          }
        }

        // 패턴 실패시 주요 단어 추출
        if (!variables[v.name]) {
          const words = instruction.split(/\s+/)
          const stopWords = ['에서', '을', '를', '좀', '해줘', '해', '담아', '검색', '찾아', '틀어', '재생', '쿠팡', '네이버', '구글', '유튜브']
          const nouns = words.filter(w => !stopWords.some(s => w.includes(s)) && w.length > 1)
          if (nouns.length > 0) {
            variables[v.name] = nouns[0]
          }
        }
      }

      if (v.name === 'sortByPrice') {
        variables[v.name] = instruction.includes('최저가') || instruction.includes('싼')
      }

      // 기본값 적용
      if (variables[v.name] === undefined && v.default !== undefined) {
        variables[v.name] = v.default
      }
    }

    // 필수 변수 체크
    const missingRequired = scriptVars
      .filter((v: any) => v.required && !variables[v.name])
      .map((v: any) => v.name)

    if (missingRequired.length > 0) {
      return `❌ 필수 정보가 부족합니다: ${missingRequired.join(', ')}

예시: /browser ${domain.split('.')[0]}에서 [검색어] 검색해`
    }

    // 4. 로컬 서버에서 스크립트 실행
    console.log(`[Browser] 🚀 Executing script: ${script.site_name}/${script.action_name}`)
    console.log(`[Browser] 📝 Variables:`, variables)

    const response = await fetch(`${JARVIS_LOCAL_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JARVIS_API_SECRET}`,
      },
      body: JSON.stringify({
        tool: 'run_browser_script',
        args: {
          scriptCode: script.script_code,
          variables,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`서버 오류: ${error}`)
    }

    const result = await response.json()

    // 5. 통계 업데이트
    if (result.success) {
      await (adminClient as any)
        .from('browser_scripts')
        .update({
          success_count: script.success_count + 1,
          last_success_at: new Date().toISOString(),
        })
        .eq('id', script.id)

      return `✅ ${script.site_name} - ${script.action_description || script.action_name}

${result.message || '작업 완료'}

📊 스크립트 사용 (토큰 절약!)
⏱️ 실행 시간: ${result.executionTimeMs || 0}ms`
    } else {
      await (adminClient as any)
        .from('browser_scripts')
        .update({
          fail_count: script.fail_count + 1,
          last_fail_at: new Date().toISOString(),
          last_fail_reason: result.error,
        })
        .eq('id', script.id)

      return `❌ 스크립트 실행 실패

오류: ${result.error}

💡 사이트 구조가 변경되었을 수 있습니다.
AI 모드로 다시 시도하시겠습니까?`
    }

  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      return `❌ 로컬 Jarvis 서버에 연결할 수 없습니다.

맥북에서 실행:
npm run jarvis:local

그리고 ngrok으로 외부 접속 열기:
ngrok http 3099`
    }

    console.error('[Browser Command] Error:', error)
    return `❌ 오류: ${error.message}`
  }
}
