/**
 * Agent Memory Sync
 *
 * 에이전트의 장기기억(Supabase)과 Claude Code 워크스페이스 동기화
 *
 * 흐름:
 * 1. 세션 시작 시: Supabase → Claude Code 워크스페이스로 기억 로드
 * 2. 세션 종료 시: Claude Code에서 학습한 내용 → Supabase에 저장
 * 3. 실시간: 중요한 기억은 즉시 동기화
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildJarvisContext,
  getOrCreateUserProfile,
  getRecentConversations,
  searchRelevantMemories,
  saveConversationMessage,
  saveEpisode,
  type UserProfile,
  type ConversationMessage,
  type JarvisContext,
} from '@/lib/memory/jarvis-memory-manager'
import {
  getRecentPrivateMemories,
  searchAgentMemories,
} from '@/lib/memory/agent-memory-service'
import * as fs from 'fs/promises'
import * as path from 'path'

// ============================================
// Types
// ============================================

export interface AgentIdentity {
  id: string
  name: string
  description?: string
  persona?: string
  systemPrompt?: string
  skills?: string[]
  createdAt?: string
}

export interface MemorySyncConfig {
  workspacePath: string
  agentId: string
  agentName: string
  userId?: string  // 현재 대화 상대 (있으면)
}

export interface SyncResult {
  success: boolean
  claudeMdPath?: string
  memoriesPath?: string
  error?: string
}

// ============================================
// Constants
// ============================================

const MEMORIES_DIR = 'memories'
const CONTEXT_FILE = 'current-context.md'
const IDENTITY_FILE = 'identity.json'
const LEARNINGS_FILE = 'new-learnings.md'

// ============================================
// Core Functions
// ============================================

/**
 * 에이전트 정보 로드 (Supabase에서)
 */
export async function loadAgentIdentity(agentId: string): Promise<AgentIdentity | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('deployed_agents')
    .select('id, name, description, system_prompt, status, created_at')
    .eq('id', agentId)
    .single()

  if (error || !data) {
    console.error('[MemorySync] Agent not found:', agentId)
    return null
  }

  // 스킬 로드
  const { data: skills } = await (supabase as any)
    .from('agent_skills')
    .select('name')
    .eq('agent_id', agentId)
    .eq('enabled', true)

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    systemPrompt: data.system_prompt,
    skills: skills?.map((s: any) => s.name) || [],
    createdAt: data.created_at,
  }
}

/**
 * 에이전트의 핵심 기억 로드 (최근 + 중요)
 */
export async function loadAgentCoreMemories(
  agentId: string,
  limit: number = 50
): Promise<{
  recentMemories: any[]
  importantMemories: any[]
  userProfiles: any[]
}> {
  const supabase = createAdminClient()

  // 1. 최근 기억
  const recentMemories = await getRecentPrivateMemories(agentId, undefined, limit)

  // 2. 중요도 높은 기억 (importance >= 7)
  const { data: importantMemories } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('agent_id', agentId)
    .gte('importance', 7)
    .order('created_at', { ascending: false })
    .limit(30)

  // 3. 사용자 프로필들
  const { data: userProfiles } = await (supabase as any)
    .from('agent_user_profiles')
    .select('*')
    .eq('agent_id', agentId)
    .order('total_conversations', { ascending: false })
    .limit(20)

  return {
    recentMemories: recentMemories || [],
    importantMemories: importantMemories || [],
    userProfiles: userProfiles || [],
  }
}

/**
 * CLAUDE.md 생성 - 에이전트 아이덴티티 + 기억 주입
 */
export async function generateClaudeMd(
  identity: AgentIdentity,
  memories: {
    recentMemories: any[]
    importantMemories: any[]
    userProfiles: any[]
  },
  currentContext?: JarvisContext
): string {
  const sections: string[] = []

  // 1. 에이전트 아이덴티티
  sections.push(`# ${identity.name}

## Identity
- **Agent ID**: ${identity.id}
- **Name**: ${identity.name}
- **Description**: ${identity.description || 'N/A'}
- **Created**: ${identity.createdAt ? new Date(identity.createdAt).toLocaleDateString('ko-KR') : 'N/A'}

## System Prompt
${identity.systemPrompt || '(No system prompt set)'}

## Skills
${identity.skills?.length ? identity.skills.map(s => `- ${s}`).join('\n') : '- No skills equipped'}
`)

  // 2. 중요한 사용자 정보
  if (memories.userProfiles.length > 0) {
    const profilesSection = memories.userProfiles.map(p => {
      const facts = p.important_facts || []
      return `### ${p.display_name || p.user_id}
- Relationship: ${p.relationship}
- Conversations: ${p.total_conversations}
- Trust Level: ${p.trust_level}
${facts.length > 0 ? `- Important Facts:\n${facts.map((f: string) => `  - ${f}`).join('\n')}` : ''}`
    }).join('\n\n')

    sections.push(`## People I Know
${profilesSection}`)
  }

  // 3. 중요한 기억 (핵심 지식)
  if (memories.importantMemories.length > 0) {
    const importantSection = memories.importantMemories.slice(0, 20).map(m => {
      const date = new Date(m.created_at).toLocaleDateString('ko-KR')
      const content = m.raw_content || m.content
      return `- [${date}] ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`
    }).join('\n')

    sections.push(`## Important Memories (High Priority)
${importantSection}`)
  }

  // 4. 최근 대화/작업 기억
  if (memories.recentMemories.length > 0) {
    const recentSection = memories.recentMemories.slice(0, 30).map(m => {
      const date = new Date(m.created_at).toLocaleDateString('ko-KR')
      const time = new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      const content = m.raw_content || m.content
      const role = m.metadata?.role || 'memory'
      return `- [${date} ${time}] (${role}) ${content.substring(0, 150)}${content.length > 150 ? '...' : ''}`
    }).join('\n')

    sections.push(`## Recent Memories
${recentSection}`)
  }

  // 5. 현재 대화 컨텍스트 (있으면)
  if (currentContext?.formattedContext) {
    sections.push(`## Current Conversation Context
${currentContext.formattedContext}`)
  }

  // 6. 작업 지침
  sections.push(`## Working Instructions

### Memory Sync
- When you learn something important about a user or task, write it to \`memories/new-learnings.md\`
- Format: \`[YYYY-MM-DD] Category: Content\`
- Categories: USER_INFO, TASK_COMPLETED, DECISION, LEARNING, ERROR_FIXED

### Communication
- I am ${identity.name}
- Maintain my personality and knowledge across all interactions
- Reference my memories when relevant to provide consistent, personalized responses

### Workspace
- \`/memories/\` - My long-term memories (synced with database)
- \`/tasks/\` - Current task queue
- \`/output/\` - Generated outputs
- \`/logs/\` - Execution logs
`)

  return sections.join('\n\n---\n\n')
}

/**
 * 세션 시작 시 호출: Supabase → 워크스페이스 동기화
 */
export async function syncMemoriesToWorkspace(config: MemorySyncConfig): Promise<SyncResult> {
  const { workspacePath, agentId, agentName, userId } = config

  try {
    // 1. 에이전트 정보 로드
    const identity = await loadAgentIdentity(agentId)
    if (!identity) {
      return { success: false, error: '에이전트를 찾을 수 없습니다' }
    }

    // 2. 기억 로드
    const memories = await loadAgentCoreMemories(agentId)

    // 3. 현재 대화 컨텍스트 (userId가 있으면)
    let currentContext: JarvisContext | undefined
    if (userId) {
      currentContext = await buildJarvisContext(agentId, userId, '', {
        recentLimit: 10,
        ragLimit: 5,
      })
    }

    // 4. CLAUDE.md 생성
    const claudeMdContent = await generateClaudeMd(identity, memories, currentContext)
    const claudeMdPath = path.join(workspacePath, 'CLAUDE.md')
    await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8')

    // 5. memories 디렉토리 생성
    const memoriesPath = path.join(workspacePath, MEMORIES_DIR)
    await fs.mkdir(memoriesPath, { recursive: true })

    // 6. identity.json 저장
    const identityPath = path.join(workspacePath, IDENTITY_FILE)
    await fs.writeFile(identityPath, JSON.stringify(identity, null, 2), 'utf-8')

    // 7. new-learnings.md 템플릿 생성 (없으면)
    const learningsPath = path.join(memoriesPath, LEARNINGS_FILE)
    try {
      await fs.access(learningsPath)
    } catch {
      await fs.writeFile(learningsPath, `# New Learnings

Write new learnings here. They will be synced to long-term memory.

Format:
\`\`\`
[${new Date().toISOString().split('T')[0]}] CATEGORY: Content
\`\`\`

Categories: USER_INFO, TASK_COMPLETED, DECISION, LEARNING, ERROR_FIXED, IMPORTANT

---

`, 'utf-8')
    }

    console.log(`[MemorySync] ✅ Synced memories to workspace: ${workspacePath}`)
    console.log(`[MemorySync]   - ${memories.recentMemories.length} recent memories`)
    console.log(`[MemorySync]   - ${memories.importantMemories.length} important memories`)
    console.log(`[MemorySync]   - ${memories.userProfiles.length} user profiles`)

    return {
      success: true,
      claudeMdPath,
      memoriesPath,
    }

  } catch (error: any) {
    console.error('[MemorySync] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 세션 종료 시 호출: 워크스페이스 → Supabase 동기화
 */
export async function syncWorkspaceToMemories(config: MemorySyncConfig): Promise<SyncResult> {
  const { workspacePath, agentId, agentName } = config

  try {
    // 1. new-learnings.md 읽기
    const learningsPath = path.join(workspacePath, MEMORIES_DIR, LEARNINGS_FILE)
    let learningsContent = ''
    try {
      learningsContent = await fs.readFile(learningsPath, 'utf-8')
    } catch {
      // 파일 없으면 스킵
      return { success: true }
    }

    // 2. 새 학습 내용 파싱
    const learningPattern = /\[(\d{4}-\d{2}-\d{2})\]\s*(\w+):\s*(.+)/g
    const newLearnings: Array<{ date: string; category: string; content: string }> = []
    let match

    while ((match = learningPattern.exec(learningsContent)) !== null) {
      newLearnings.push({
        date: match[1],
        category: match[2],
        content: match[3].trim(),
      })
    }

    if (newLearnings.length === 0) {
      return { success: true }
    }

    console.log(`[MemorySync] Found ${newLearnings.length} new learnings to sync`)

    // 3. Supabase에 저장
    for (const learning of newLearnings) {
      const importance = getCategoryImportance(learning.category)

      // 메모리로 저장
      await saveConversationMessage({
        agentId,
        userId: 'system', // 시스템 학습
        role: 'assistant',
        content: `[${learning.category}] ${learning.content}`,
        importance,
        topics: [learning.category.toLowerCase()],
        metadata: {
          source: 'claude_code_session',
          category: learning.category,
          learnedAt: learning.date,
        },
      })

      // 중요도 높으면 에피소드로도 저장
      if (importance >= 8) {
        await saveEpisode({
          agentId,
          title: `${learning.category}: ${learning.content.substring(0, 50)}`,
          summary: learning.content,
          eventType: mapCategoryToEventType(learning.category),
          importance: importance / 10,
          tags: [learning.category.toLowerCase()],
        })
      }
    }

    // 4. 처리된 학습 내용 클리어 (선택적)
    // await fs.writeFile(learningsPath, getEmptyLearningsTemplate(), 'utf-8')

    console.log(`[MemorySync] ✅ Synced ${newLearnings.length} learnings to database`)

    return { success: true }

  } catch (error: any) {
    console.error('[MemorySync] Sync to DB error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 실시간 동기화: 특정 기억을 즉시 저장
 */
export async function syncMemoryImmediately(
  agentId: string,
  content: string,
  category: string = 'LEARNING',
  userId?: string
): Promise<{ success: boolean }> {
  try {
    const importance = getCategoryImportance(category)

    await saveConversationMessage({
      agentId,
      userId: userId || 'system',
      role: 'assistant',
      content: `[${category}] ${content}`,
      importance,
      topics: [category.toLowerCase()],
      metadata: {
        source: 'realtime_sync',
        category,
        syncedAt: new Date().toISOString(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[MemorySync] Immediate sync error:', error)
    return { success: false }
  }
}

/**
 * 현재 대화 컨텍스트 업데이트 (CLAUDE.md에 추가)
 */
export async function updateCurrentContext(
  workspacePath: string,
  agentId: string,
  userId: string,
  currentMessage: string
): Promise<void> {
  try {
    const context = await buildJarvisContext(agentId, userId, currentMessage, {
      recentLimit: 10,
      ragLimit: 5,
    })

    const contextPath = path.join(workspacePath, MEMORIES_DIR, CONTEXT_FILE)
    await fs.writeFile(contextPath, `# Current Conversation Context

Last Updated: ${new Date().toISOString()}

${context.formattedContext}
`, 'utf-8')

  } catch (error) {
    console.error('[MemorySync] Context update error:', error)
  }
}

// ============================================
// Helper Functions
// ============================================

function getCategoryImportance(category: string): number {
  const importanceMap: Record<string, number> = {
    'IMPORTANT': 9,
    'USER_INFO': 8,
    'DECISION': 8,
    'ERROR_FIXED': 7,
    'TASK_COMPLETED': 6,
    'LEARNING': 6,
    'DEFAULT': 5,
  }
  return importanceMap[category.toUpperCase()] || importanceMap['DEFAULT']
}

function mapCategoryToEventType(category: string): 'project_start' | 'project_complete' | 'milestone' | 'decision' | 'problem_solved' | 'learning' | 'user_feedback' | 'general' {
  const map: Record<string, any> = {
    'TASK_COMPLETED': 'project_complete',
    'DECISION': 'decision',
    'ERROR_FIXED': 'problem_solved',
    'LEARNING': 'learning',
    'USER_INFO': 'user_feedback',
    'IMPORTANT': 'milestone',
  }
  return map[category.toUpperCase()] || 'general'
}

function getEmptyLearningsTemplate(): string {
  return `# New Learnings

Write new learnings here. They will be synced to long-term memory.

Format:
\`\`\`
[${new Date().toISOString().split('T')[0]}] CATEGORY: Content
\`\`\`

Categories: USER_INFO, TASK_COMPLETED, DECISION, LEARNING, ERROR_FIXED, IMPORTANT

---

`
}

// ============================================
// Export
// ============================================

export default {
  loadAgentIdentity,
  loadAgentCoreMemories,
  generateClaudeMd,
  syncMemoriesToWorkspace,
  syncWorkspaceToMemories,
  syncMemoryImmediately,
  updateCurrentContext,
}
