/**
 * Agent Work Memory Service
 *
 * 에이전트가 업무 맥락을 기억하고 이해하기 위한 서비스
 * - 업무 수행 기록
 * - 받은 지시사항
 * - 피드백 및 학습
 * - 협업 이력
 * - 의사결정 근거
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type WorkMemoryType =
  | 'task'           // 업무 수행 기록
  | 'deliverable'    // 산출물 생성
  | 'instruction'    // 받은 지시사항
  | 'feedback'       // 받은 피드백
  | 'learning'       // 학습한 내용
  | 'collaboration'  // 협업 기록
  | 'context'        // 프로젝트/업무 맥락
  | 'preference'     // 사용자 선호도
  | 'mistake'        // 실수 및 교정
  | 'decision'       // 의사결정 근거
  | 'meeting'        // 회의 대화 기록

export interface WorkMemory {
  id: string
  agent_id: string
  user_id: string
  memory_type: WorkMemoryType
  title: string
  content: string
  summary?: string
  related_task_id?: string
  related_project_id?: string
  related_document_id?: string
  related_agent_ids?: string[]
  related_conversation_id?: string
  importance: number
  tags?: string[]
  metadata?: Record<string, any>
  occurred_at: string
  created_at: string
}

export interface ActiveContext {
  current_task_id?: string
  current_project_id?: string
  current_conversation_id?: string
  recent_instructions: string[]
  recent_topics: string[]
  pending_tasks: string[]
  user_preferences: Record<string, any>
  communication_style?: string
}

interface SaveWorkMemoryParams {
  agentId: string
  userId: string
  memoryType: WorkMemoryType
  title: string
  content: string
  summary?: string
  relatedTaskId?: string
  relatedProjectId?: string
  relatedDocumentId?: string
  relatedAgentIds?: string[]
  relatedConversationId?: string
  importance?: number
  tags?: string[]
  metadata?: Record<string, any>
}

// Lazy initialization to avoid build-time errors
let _supabase: ReturnType<typeof createAdminClient> | null = null
const getSupabase = () => {
  if (!_supabase) {
    _supabase = createAdminClient()
  }
  return _supabase
}

/**
 * 워크 메모리 저장
 */
export async function saveWorkMemory(params: SaveWorkMemoryParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await (getSupabase() as any)
      .from('agent_work_memory')
      .insert({
        agent_id: params.agentId,
        user_id: params.userId,
        memory_type: params.memoryType,
        title: params.title,
        content: params.content,
        summary: params.summary,
        related_task_id: params.relatedTaskId,
        related_project_id: params.relatedProjectId,
        related_document_id: params.relatedDocumentId,
        related_agent_ids: params.relatedAgentIds,
        related_conversation_id: params.relatedConversationId,
        importance: params.importance || 5,
        tags: params.tags,
        metadata: params.metadata || {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('[WorkMemory] Save error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (error) {
    console.error('[WorkMemory] Error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * 지시사항 저장
 */
export async function saveInstruction(params: {
  agentId: string
  userId: string
  instruction: string
  conversationId?: string
  projectId?: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'instruction',
    title: params.instruction.slice(0, 100),
    content: params.instruction,
    relatedConversationId: params.conversationId,
    relatedProjectId: params.projectId,
    importance: 7,
  })

  // 활성 컨텍스트 업데이트
  await updateActiveContext(params.agentId, params.userId, {
    addInstruction: params.instruction.slice(0, 200),
  })
}

/**
 * 태스크 수행 기록 저장
 */
export async function saveTaskExecution(params: {
  agentId: string
  userId: string
  taskId: string
  taskTitle: string
  result: string
  success: boolean
  projectId?: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'task',
    title: `${params.success ? '✅' : '❌'} ${params.taskTitle}`,
    content: params.result,
    relatedTaskId: params.taskId,
    relatedProjectId: params.projectId,
    importance: params.success ? 6 : 8, // 실패는 더 중요하게 기억
    tags: params.success ? ['완료'] : ['실패', '재시도필요'],
  })

  // 실패 시 실수로도 기록
  if (!params.success) {
    await saveWorkMemory({
      agentId: params.agentId,
      userId: params.userId,
      memoryType: 'mistake',
      title: `태스크 실패: ${params.taskTitle}`,
      content: params.result,
      relatedTaskId: params.taskId,
      importance: 8,
    })
  }
}

/**
 * 산출물 생성 기록 저장
 */
export async function saveDeliverable(params: {
  agentId: string
  userId: string
  documentId: string
  documentTitle: string
  summary: string
  projectId?: string
  taskId?: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'deliverable',
    title: `📄 ${params.documentTitle}`,
    content: params.summary,
    relatedDocumentId: params.documentId,
    relatedProjectId: params.projectId,
    relatedTaskId: params.taskId,
    importance: 7,
    tags: ['산출물'],
  })
}

/**
 * 피드백 저장
 */
export async function saveFeedback(params: {
  agentId: string
  userId: string
  feedback: string
  isPositive: boolean
  relatedTaskId?: string
  conversationId?: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'feedback',
    title: `${params.isPositive ? '👍' : '👎'} 피드백`,
    content: params.feedback,
    relatedTaskId: params.relatedTaskId,
    relatedConversationId: params.conversationId,
    importance: params.isPositive ? 5 : 9, // 부정적 피드백은 더 중요
    tags: params.isPositive ? ['칭찬'] : ['개선필요'],
  })

  // 부정적 피드백은 학습으로도 기록
  if (!params.isPositive) {
    await saveWorkMemory({
      agentId: params.agentId,
      userId: params.userId,
      memoryType: 'learning',
      title: '피드백에서 배운 점',
      content: `사용자 피드백: ${params.feedback}\n\n→ 다음에는 이 점을 개선해야 함`,
      importance: 8,
      tags: ['개선', '학습'],
    })
  }
}

/**
 * 협업 기록 저장
 */
export async function saveCollaboration(params: {
  agentId: string
  userId: string
  collaboratorAgentIds: string[]
  collaboratorNames: string[]
  description: string
  taskId?: string
  projectId?: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'collaboration',
    title: `🤝 ${params.collaboratorNames.join(', ')}와 협업`,
    content: params.description,
    relatedAgentIds: params.collaboratorAgentIds,
    relatedTaskId: params.taskId,
    relatedProjectId: params.projectId,
    importance: 6,
    tags: ['협업', ...params.collaboratorNames],
  })

  // 협업 관계 업데이트
  for (const collaboratorId of params.collaboratorAgentIds) {
    await updateAgentRelationship(params.agentId, collaboratorId, params.userId)
  }
}

/**
 * 의사결정 기록 저장
 */
export async function saveDecision(params: {
  agentId: string
  userId: string
  decision: string
  reasoning: string
  taskId?: string
  projectId?: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'decision',
    title: `🎯 ${params.decision.slice(0, 80)}`,
    content: `결정: ${params.decision}\n\n근거: ${params.reasoning}`,
    relatedTaskId: params.taskId,
    relatedProjectId: params.projectId,
    importance: 7,
    tags: ['의사결정'],
  })
}

/**
 * 사용자 선호도 저장
 */
export async function savePreference(params: {
  agentId: string
  userId: string
  preference: string
  category: string
}): Promise<void> {
  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'preference',
    title: `선호도: ${params.category}`,
    content: params.preference,
    importance: 6,
    tags: ['선호도', params.category],
  })

  // 활성 컨텍스트의 선호도도 업데이트
  await updateActiveContext(params.agentId, params.userId, {
    updatePreference: { [params.category]: params.preference },
  })
}

/**
 * 회의 대화 저장
 * 회의실에서 에이전트가 참여한 대화를 저장
 */
export async function saveMeetingMessage(params: {
  agentId: string
  userId: string
  roomId: string
  roomName: string
  userMessage: string
  agentResponse: string
  participantNames: string[]
}): Promise<void> {
  const content = `[회의: ${params.roomName}]
참여자: ${params.participantNames.join(', ')}

사용자: ${params.userMessage}

내 응답: ${params.agentResponse}`

  await saveWorkMemory({
    agentId: params.agentId,
    userId: params.userId,
    memoryType: 'meeting',
    title: `회의 대화 - ${params.roomName}`,
    content,
    importance: 6,
    tags: ['회의', params.roomName],
    metadata: {
      roomId: params.roomId,
      roomName: params.roomName,
      participantNames: params.participantNames,
    },
  })
}

/**
 * 활성 컨텍스트 조회
 */
export async function getActiveContext(agentId: string, userId: string): Promise<ActiveContext | null> {
  const { data, error } = await (getSupabase() as any)
    .from('agent_active_context')
    .select('*')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    current_task_id: data.current_task_id,
    current_project_id: data.current_project_id,
    current_conversation_id: data.current_conversation_id,
    recent_instructions: data.recent_instructions || [],
    recent_topics: data.recent_topics || [],
    pending_tasks: data.pending_tasks || [],
    user_preferences: data.user_preferences || {},
    communication_style: data.communication_style,
  }
}

/**
 * 활성 컨텍스트 업데이트
 */
export async function updateActiveContext(
  agentId: string,
  userId: string,
  updates: {
    currentTaskId?: string
    currentProjectId?: string
    currentConversationId?: string
    addInstruction?: string
    addTopic?: string
    addPendingTask?: string
    removePendingTask?: string
    updatePreference?: Record<string, any>
    communicationStyle?: string
  }
): Promise<void> {
  // 현재 컨텍스트 조회
  let context = await getActiveContext(agentId, userId)

  if (!context) {
    // 없으면 새로 생성
    context = {
      recent_instructions: [],
      recent_topics: [],
      pending_tasks: [],
      user_preferences: {},
    }
  }

  // 업데이트 적용
  const newContext: Record<string, any> = {
    agent_id: agentId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }

  if (updates.currentTaskId !== undefined) {
    newContext.current_task_id = updates.currentTaskId
  }
  if (updates.currentProjectId !== undefined) {
    newContext.current_project_id = updates.currentProjectId
  }
  if (updates.currentConversationId !== undefined) {
    newContext.current_conversation_id = updates.currentConversationId
  }
  if (updates.addInstruction) {
    const instructions = [updates.addInstruction, ...context.recent_instructions].slice(0, 10)
    newContext.recent_instructions = instructions
  }
  if (updates.addTopic) {
    const topics = [updates.addTopic, ...context.recent_topics].slice(0, 20)
    newContext.recent_topics = Array.from(new Set(topics)) // 중복 제거
  }
  if (updates.addPendingTask) {
    newContext.pending_tasks = [...context.pending_tasks, updates.addPendingTask]
  }
  if (updates.removePendingTask) {
    newContext.pending_tasks = context.pending_tasks.filter(t => t !== updates.removePendingTask)
  }
  if (updates.updatePreference) {
    newContext.user_preferences = { ...context.user_preferences, ...updates.updatePreference }
  }
  if (updates.communicationStyle) {
    newContext.communication_style = updates.communicationStyle
  }

  await (getSupabase() as any)
    .from('agent_active_context')
    .upsert(newContext, { onConflict: 'agent_id,user_id' })
}

/**
 * 에이전트 관계 업데이트
 */
async function updateAgentRelationship(agentId: string, relatedAgentId: string, userId: string): Promise<void> {
  const { data: existing } = await (getSupabase() as any)
    .from('agent_relationships')
    .select('id, collaboration_count')
    .eq('agent_id', agentId)
    .eq('related_agent_id', relatedAgentId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    await (getSupabase() as any)
      .from('agent_relationships')
      .update({
        collaboration_count: existing.collaboration_count + 1,
        last_collaboration: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await (getSupabase() as any)
      .from('agent_relationships')
      .insert({
        agent_id: agentId,
        related_agent_id: relatedAgentId,
        user_id: userId,
        relationship_type: 'collaborator',
        collaboration_count: 1,
        last_collaboration: new Date().toISOString(),
      })
  }
}

/**
 * 에이전트 업무 컨텍스트 로드 (채팅 시 사용)
 * 에이전트가 대화 시작 전에 알아야 할 모든 맥락을 로드
 */
export async function loadAgentWorkContext(agentId: string, userId: string): Promise<{
  activeContext: ActiveContext | null
  recentMemories: WorkMemory[]
  importantMemories: WorkMemory[]
  pendingTasks: any[]
  meetingHistory: any[]
}> {
  // 1. 활성 컨텍스트
  const activeContext = await getActiveContext(agentId, userId)

  // 2. 최근 24시간 메모리
  const { data: recentMemories } = await (getSupabase() as any)
    .from('agent_work_memory')
    .select('*')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(20)

  // 3. 중요한 메모리 (importance >= 8)
  const { data: importantMemories } = await (getSupabase() as any)
    .from('agent_work_memory')
    .select('*')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .gte('importance', 8)
    .order('occurred_at', { ascending: false })
    .limit(10)

  // 4. 미완료 태스크
  const { data: pendingTasks } = await (getSupabase() as any)
    .from('agent_tasks')
    .select('id, title, description, status, priority')
    .eq('agent_id', agentId)
    .in('status', ['pending', 'in_progress'])
    .order('priority', { ascending: false })
    .limit(5)

  // 5. 회의실 대화 기록 (에이전트가 참여한 방의 최근 대화)
  let meetingHistory: any[] = []
  try {
    // 5-1. 에이전트가 참여한 채팅방 조회
    const { data: participantRooms } = await (getSupabase() as any)
      .from('chat_participants')
      .select('room_id, chat_rooms(id, name, type)')
      .eq('agent_id', agentId)
      .limit(10)

    if (participantRooms && participantRooms.length > 0) {
      const roomIds = participantRooms.map((p: any) => p.room_id)
      const roomNameMap: Record<string, string> = {}
      participantRooms.forEach((p: any) => {
        if (p.chat_rooms) {
          roomNameMap[p.room_id] = p.chat_rooms.name || '채팅방'
        }
      })

      // 5-2. 해당 방들의 최근 메시지 조회 (사용자 메시지와 자신의 응답)
      const { data: messages } = await (getSupabase() as any)
        .from('chat_messages')
        .select('room_id, sender_type, sender_user_id, sender_agent_id, content, created_at')
        .in('room_id', roomIds)
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // 48시간
        .order('created_at', { ascending: false })
        .limit(50)

      if (messages && messages.length > 0) {
        // 방별로 그룹화
        const messagesByRoom: Record<string, any[]> = {}
        for (const msg of messages) {
          if (!messagesByRoom[msg.room_id]) {
            messagesByRoom[msg.room_id] = []
          }
          messagesByRoom[msg.room_id].push(msg)
        }

        // 각 방의 대화를 요약
        for (const [roomId, roomMessages] of Object.entries(messagesByRoom)) {
          const roomName = roomNameMap[roomId] || '채팅방'
          // 최근 10개 메시지만 사용
          const recentMsgs = (roomMessages as any[]).slice(0, 10).reverse()

          meetingHistory.push({
            roomId,
            roomName,
            messages: recentMsgs.map((m: any) => ({
              role: m.sender_type,
              content: m.content,
              isMe: m.sender_agent_id === agentId,
              timestamp: m.created_at,
            })),
          })
        }
      }
    }
  } catch (meetingError) {
    console.error('[WorkMemory] Meeting history load error:', meetingError)
  }

  return {
    activeContext,
    recentMemories: recentMemories || [],
    importantMemories: importantMemories || [],
    pendingTasks: pendingTasks || [],
    meetingHistory,
  }
}

/**
 * 컨텍스트를 프롬프트용 텍스트로 변환
 */
export function formatContextForPrompt(context: {
  activeContext: ActiveContext | null
  recentMemories: WorkMemory[]
  importantMemories: WorkMemory[]
  pendingTasks: any[]
  meetingHistory?: any[]
}): string {
  const parts: string[] = []

  // 회의실 대화 기록 (가장 먼저 - 중요한 컨텍스트)
  if (context.meetingHistory && context.meetingHistory.length > 0) {
    const meetingParts: string[] = []
    for (const room of context.meetingHistory) {
      const msgs = room.messages.slice(-5) // 최근 5개만
      if (msgs.length > 0) {
        const msgTexts = msgs.map((m: any) => {
          const speaker = m.isMe ? '나' : (m.role === 'user' ? '사용자' : '다른 에이전트')
          return `  - ${speaker}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`
        }).join('\n')
        meetingParts.push(`### ${room.roomName}\n${msgTexts}`)
      }
    }
    if (meetingParts.length > 0) {
      parts.push(`## 🗣️ 최근 회의실 대화\n${meetingParts.join('\n\n')}`)
    }
  }

  // 활성 컨텍스트
  if (context.activeContext) {
    const ac = context.activeContext
    if (ac.recent_instructions.length > 0) {
      parts.push(`## 최근 받은 지시\n${ac.recent_instructions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`)
    }
    if (ac.pending_tasks.length > 0) {
      parts.push(`## 아직 안 끝난 일\n${ac.pending_tasks.map(t => `- ${t}`).join('\n')}`)
    }
    if (Object.keys(ac.user_preferences).length > 0) {
      parts.push(`## 사용자 선호도\n${JSON.stringify(ac.user_preferences, null, 2)}`)
    }
  }

  // 미완료 태스크
  if (context.pendingTasks.length > 0) {
    parts.push(`## 진행 중인 태스크\n${context.pendingTasks.map(t => `- [${t.status}] ${t.title}`).join('\n')}`)
  }

  // 최근 메모리
  if (context.recentMemories.length > 0) {
    const memoryTexts = context.recentMemories.slice(0, 10).map(m => {
      const time = new Date(m.occurred_at).toLocaleString('ko-KR')
      return `- [${m.memory_type}] ${m.title} (${time})`
    })
    parts.push(`## 최근 업무 기록\n${memoryTexts.join('\n')}`)
  }

  // 중요 메모리
  if (context.importantMemories.length > 0) {
    const importantTexts = context.importantMemories
      .filter(m => !context.recentMemories.find(r => r.id === m.id))
      .slice(0, 5)
      .map(m => `- ⚠️ ${m.title}: ${m.content.slice(0, 100)}`)
    if (importantTexts.length > 0) {
      parts.push(`## 꼭 기억해야 할 것\n${importantTexts.join('\n')}`)
    }
  }

  return parts.join('\n\n')
}

/**
 * 관련 메모리 검색
 */
export async function searchRelevantMemories(
  agentId: string,
  userId: string,
  query: string,
  limit: number = 10
): Promise<WorkMemory[]> {
  const { data, error } = await (getSupabase() as any)
    .rpc('search_agent_work_memory', {
      p_agent_id: agentId,
      p_user_id: userId,
      p_query: query,
      p_limit: limit,
    })

  if (error) {
    console.error('[WorkMemory] Search error:', error)
    return []
  }

  return data || []
}

export default {
  saveWorkMemory,
  saveInstruction,
  saveTaskExecution,
  saveDeliverable,
  saveFeedback,
  saveCollaboration,
  saveDecision,
  savePreference,
  saveMeetingMessage,
  getActiveContext,
  updateActiveContext,
  loadAgentWorkContext,
  formatContextForPrompt,
  searchRelevantMemories,
}
