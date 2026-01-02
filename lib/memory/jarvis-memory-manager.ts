/**
 * JARVIS Memory Manager
 *
 * Manus/Genspark 스타일의 Long-term Memory + RAG 시스템
 * 사용자별 대화 기억 및 컨텍스트 구성
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { OpenAIEmbeddings } from '@langchain/openai'
import {
  savePrivateMemory,
  searchAgentMemories,
  getRecentPrivateMemories,
  type AgentMemory,
  type AgentMemorySearchResult,
} from './agent-memory-service'

// ============================================
// Types
// ============================================

export interface UserProfile {
  userId: string
  displayName?: string
  relationship: 'owner' | 'admin' | 'team_member' | 'client' | 'user'
  preferences: {
    language: string
    communicationStyle: 'formal' | 'casual' | 'professional'
    responseLength: 'brief' | 'medium' | 'detailed'
  }
  importantFacts: string[]
  trustLevel: number
  totalConversations: number
  lastInteractionAt?: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface JarvisContext {
  // 사용자 정보
  userProfile: UserProfile | null

  // 대화 메모리
  recentConversations: ConversationMessage[]  // 최근 N개 대화
  relevantMemories: AgentMemorySearchResult[] // RAG 검색 결과

  // 에피소드 메모리
  relevantEpisodes: any[]  // 관련 중요 이벤트

  // 시스템 프롬프트용 포맷된 컨텍스트
  formattedContext: string
}

export interface SaveMessageParams {
  agentId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  importance?: number
  topics?: string[]
  metadata?: Record<string, any>
}

// ============================================
// Embeddings
// ============================================

let embeddings: OpenAIEmbeddings | null = null

function getEmbeddings(): OpenAIEmbeddings {
  if (!embeddings) {
    embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
      dimensions: 1536,
    })
  }
  return embeddings
}

// ============================================
// User Profile Management
// ============================================

/**
 * 사용자 프로필 조회 또는 생성
 */
export async function getOrCreateUserProfile(
  agentId: string,
  userId: string,
  defaultName?: string
): Promise<UserProfile> {
  const supabase = createAdminClient()

  try {
    // 기존 프로필 조회
    const { data: existing, error } = await supabase
      .from('agent_user_profiles')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .single()

    // 테이블이 없거나 에러인 경우 기본값 반환
    if (error) {
      console.warn('[JarvisMemory] Profile table not available:', error.code)
      return getDefaultProfile(userId, defaultName)
    }

    if (existing) {
      const profile = existing as any
      return {
        userId: profile.user_id,
        displayName: profile.display_name,
        relationship: profile.relationship,
        preferences: {
          language: profile.preferences?.language || 'ko',
          communicationStyle: profile.preferences?.communication_style || 'casual',
          responseLength: profile.preferences?.response_length || 'medium',
        },
        importantFacts: profile.important_facts || [],
        trustLevel: profile.trust_level,
        totalConversations: profile.total_conversations,
        lastInteractionAt: profile.last_interaction_at,
      }
    }

    // 새 프로필 생성
    const newProfile = {
      agent_id: agentId,
      user_id: userId,
      display_name: defaultName || null,
      relationship: 'user',
      preferences: {
        language: 'ko',
        communication_style: 'casual',
        response_length: 'medium',
      },
      important_facts: [],
      trust_level: 0.5,
      total_conversations: 0,
    }

    await (supabase
      .from('agent_user_profiles') as any)
      .insert(newProfile)

    return getDefaultProfile(userId, defaultName)
  } catch (err) {
    console.warn('[JarvisMemory] Profile error:', err)
    return getDefaultProfile(userId, defaultName)
  }
}

function getDefaultProfile(userId: string, displayName?: string): UserProfile {
  return {
    userId,
    displayName,
    relationship: 'user',
    preferences: {
      language: 'ko',
      communicationStyle: 'casual',
      responseLength: 'medium',
    },
    importantFacts: [],
    trustLevel: 0.5,
    totalConversations: 0,
  }
}

/**
 * 사용자 프로필 업데이트
 */
export async function updateUserProfile(
  agentId: string,
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const supabase = createAdminClient()

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (updates.displayName !== undefined) {
    updateData.display_name = updates.displayName
  }
  if (updates.relationship !== undefined) {
    updateData.relationship = updates.relationship
  }
  if (updates.preferences !== undefined) {
    updateData.preferences = {
      language: updates.preferences.language,
      communication_style: updates.preferences.communicationStyle,
      response_length: updates.preferences.responseLength,
    }
  }
  if (updates.importantFacts !== undefined) {
    updateData.important_facts = updates.importantFacts
  }
  if (updates.trustLevel !== undefined) {
    updateData.trust_level = updates.trustLevel
  }

  await (supabase
    .from('agent_user_profiles') as any)
    .update(updateData)
    .eq('agent_id', agentId)
    .eq('user_id', userId)
}

/**
 * 중요 사실 추가
 */
export async function addImportantFact(
  agentId: string,
  userId: string,
  fact: string
): Promise<void> {
  const supabase = createAdminClient()

  // 기존 facts 조회
  const { data } = await (supabase
    .from('agent_user_profiles') as any)
    .select('important_facts')
    .eq('agent_id', agentId)
    .eq('user_id', userId)
    .single()

  const existingFacts = (data as any)?.important_facts || []

  // 중복 방지
  if (!existingFacts.includes(fact)) {
    await (supabase
      .from('agent_user_profiles') as any)
      .update({
        important_facts: [...existingFacts, fact],
        updated_at: new Date().toISOString(),
      })
      .eq('agent_id', agentId)
      .eq('user_id', userId)
  }
}

// ============================================
// Conversation Memory
// ============================================

/**
 * 대화 메시지 저장
 */
export async function saveConversationMessage(
  params: SaveMessageParams
): Promise<{ success: boolean; memoryId?: string }> {
  const { agentId, userId, role, content, importance, topics, metadata } = params

  // 기존 agent-memory-service 활용
  // userId를 relationshipId로 매핑 (직접 매핑 - 심플하게)
  const result = await savePrivateMemory({
    agentId,
    relationshipId: userId,  // user_id를 relationship_id로 사용
    content: `[${role.toUpperCase()}] ${content}`,
    importance: importance ?? (role === 'user' ? 6 : 5),
    tags: topics || [],
    metadata: {
      ...metadata,
      role,
      originalContent: content,
      savedAt: new Date().toISOString(),
    },
  })

  return { success: result.success, memoryId: result.id }
}

/**
 * 최근 대화 조회
 */
export async function getRecentConversations(
  agentId: string,
  userId: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  const memories = await getRecentPrivateMemories(agentId, userId, limit)

  return memories
    .map(m => ({
      role: (m.metadata?.role || 'user') as 'user' | 'assistant',
      content: m.metadata?.originalContent || m.raw_content.replace(/^\[(USER|ASSISTANT)\] /, ''),
      timestamp: m.created_at,
      metadata: m.metadata,
    }))
    .reverse()  // 시간순 정렬
}

// ============================================
// RAG Search
// ============================================

/**
 * 관련 메모리 RAG 검색
 */
export async function searchRelevantMemories(
  agentId: string,
  userId: string,
  query: string,
  options: {
    limit?: number
    threshold?: number
    includeOtherUsers?: boolean
  } = {}
): Promise<AgentMemorySearchResult[]> {
  const { limit = 10, threshold = 0.7, includeOtherUsers = false } = options

  // 시맨틱 검색
  const results = await searchAgentMemories({
    agentId,
    query,
    memoryTypes: ['private'],
    relationshipId: includeOtherUsers ? undefined : userId,
    useSemanticSearch: true,
    similarityThreshold: threshold,
    limit,
  })

  return results
}

/**
 * 에피소드 메모리 검색 (중요 이벤트)
 */
export async function searchEpisodes(
  agentId: string,
  query: string,
  limit: number = 5
): Promise<any[]> {
  const supabase = createAdminClient()

  try {
    // 먼저 테이블 존재 여부 확인
    const { error: tableError } = await supabase
      .from('agent_episodes')
      .select('id')
      .limit(1)

    if (tableError?.code === 'PGRST205') {
      // 테이블이 없으면 빈 배열 반환 (마이그레이션 필요)
      console.warn('[JarvisMemory] Episodes table not available')
      return []
    }

    // 임베딩 생성
    const embedder = getEmbeddings()
    const queryEmbedding = await embedder.embedQuery(query)

    // RPC 함수로 검색
    const { data, error } = await (supabase.rpc as any)('search_agent_episodes', {
      p_query_embedding: queryEmbedding,
      p_agent_id: agentId,
      p_match_count: limit,
      p_match_threshold: 0.6,
    })

    if (error) {
      console.warn('[JarvisMemory] Episode search failed:', error.code)
      return []
    }

    return data || []
  } catch (error) {
    console.warn('[JarvisMemory] Episode search error:', error)
    return []
  }
}

// ============================================
// Context Building (핵심!)
// ============================================

/**
 * JARVIS 컨텍스트 구성
 *
 * 사용자 메시지를 받아서 RAG 기반 컨텍스트 생성
 */
export async function buildJarvisContext(
  agentId: string,
  userId: string,
  currentMessage: string,
  options: {
    recentLimit?: number
    ragLimit?: number
    includeEpisodes?: boolean
  } = {}
): Promise<JarvisContext> {
  const {
    recentLimit = 10,
    ragLimit = 5,
    includeEpisodes = true,
  } = options

  // 병렬로 데이터 수집
  const [
    userProfile,
    recentConversations,
    relevantMemories,
    relevantEpisodes,
  ] = await Promise.all([
    getOrCreateUserProfile(agentId, userId),
    getRecentConversations(agentId, userId, recentLimit),
    searchRelevantMemories(agentId, userId, currentMessage, { limit: ragLimit }),
    includeEpisodes ? searchEpisodes(agentId, currentMessage, 3) : Promise.resolve([]),
  ])

  // 포맷된 컨텍스트 생성
  const formattedContext = formatContextForPrompt({
    userProfile,
    recentConversations,
    relevantMemories,
    relevantEpisodes,
  })

  return {
    userProfile,
    recentConversations,
    relevantMemories,
    relevantEpisodes,
    formattedContext,
  }
}

/**
 * 시스템 프롬프트용 컨텍스트 포맷팅
 */
function formatContextForPrompt(params: {
  userProfile: UserProfile | null
  recentConversations: ConversationMessage[]
  relevantMemories: AgentMemorySearchResult[]
  relevantEpisodes: any[]
}): string {
  const { userProfile, recentConversations, relevantMemories, relevantEpisodes } = params

  const sections: string[] = []

  // 1. 사용자 정보
  if (userProfile) {
    const userSection = `## 현재 대화 상대 정보
- 이름: ${userProfile.displayName || '(미설정)'}
- 관계: ${translateRelationship(userProfile.relationship)}
- 선호 언어: ${userProfile.preferences.language}
- 소통 스타일: ${translateStyle(userProfile.preferences.communicationStyle)}
- 총 대화 횟수: ${userProfile.totalConversations}회
${userProfile.importantFacts.length > 0 ? `- 기억할 사항:\n${userProfile.importantFacts.map(f => `  • ${f}`).join('\n')}` : ''}`
    sections.push(userSection)
  }

  // 2. 관련 과거 대화 (RAG)
  if (relevantMemories.length > 0) {
    const memoriesSection = `## 관련 과거 대화 (이 사용자와)
${relevantMemories.map(m => {
  const date = new Date(m.created_at).toLocaleDateString('ko-KR')
  const content = m.metadata?.originalContent || m.raw_content
  const role = m.metadata?.role || 'unknown'
  return `[${date}] ${role === 'user' ? '사용자' : '나'}: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`
}).join('\n')}`
    sections.push(memoriesSection)
  }

  // 3. 중요 이벤트/에피소드
  if (relevantEpisodes.length > 0) {
    const episodesSection = `## 관련 중요 이벤트
${relevantEpisodes.map(e => {
  const date = new Date(e.occurred_at).toLocaleDateString('ko-KR')
  return `[${date}] ${e.title}: ${e.summary || ''}`
}).join('\n')}`
    sections.push(episodesSection)
  }

  // 4. 최근 대화 컨텍스트
  if (recentConversations.length > 0) {
    const recentSection = `## 최근 대화 흐름
${recentConversations.slice(-5).map(c => {
  return `${c.role === 'user' ? '사용자' : '나'}: ${c.content.substring(0, 300)}${c.content.length > 300 ? '...' : ''}`
}).join('\n')}`
    sections.push(recentSection)
  }

  return sections.join('\n\n')
}

function translateRelationship(rel: string): string {
  const map: Record<string, string> = {
    owner: '오너 (최고 신뢰)',
    admin: '관리자',
    team_member: '팀원',
    client: '클라이언트',
    user: '일반 사용자',
  }
  return map[rel] || rel
}

function translateStyle(style: string): string {
  const map: Record<string, string> = {
    formal: '격식체',
    casual: '친근한',
    professional: '전문적',
  }
  return map[style] || style
}

// ============================================
// Episode Memory (중요 이벤트 기록)
// ============================================

/**
 * 에피소드(중요 이벤트) 저장
 */
export async function saveEpisode(params: {
  agentId: string
  title: string
  summary: string
  eventType: 'project_start' | 'project_complete' | 'milestone' | 'decision' | 'problem_solved' | 'learning' | 'user_feedback' | 'general'
  participants?: string[]
  importance?: number
  tags?: string[]
  relatedData?: Record<string, any>
}): Promise<{ success: boolean; id?: string }> {
  const supabase = createAdminClient()

  try {
    // 임베딩 생성
    const embedder = getEmbeddings()
    const embedding = await embedder.embedQuery(`${params.title} ${params.summary}`)

    const { data, error } = await (supabase
      .from('agent_episodes') as any)
      .insert({
        agent_id: params.agentId,
        title: params.title,
        summary: params.summary,
        event_type: params.eventType,
        participants: params.participants || [],
        importance: params.importance ?? 0.7,
        tags: params.tags || [],
        related_data: params.relatedData || {},
        embedding,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[JarvisMemory] Episode save failed:', error)
      return { success: false }
    }

    return { success: true, id: data?.id }
  } catch (error) {
    console.error('[JarvisMemory] Episode save error:', error)
    return { success: false }
  }
}

// ============================================
// Memory Analysis (자동 학습)
// ============================================

/**
 * 대화에서 중요 정보 추출 및 프로필 업데이트
 * (LLM을 사용해서 자동으로 사용자 정보 학습)
 */
export async function analyzeAndLearn(
  agentId: string,
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  // TODO: LLM을 사용해서 대화에서 중요 정보 추출
  // 예: "나는 프론트엔드 개발자야" → importantFacts에 추가
  // 예: "반말로 해줘" → preferences.communicationStyle 업데이트

  // 간단한 패턴 매칭 (기본 버전)
  const patterns = [
    { regex: /제\s?이름은?\s*(.+?)(?:야|예요|입니다|이에요)/i, field: 'displayName' },
    { regex: /나는?\s*(.+?)\s*개발자/i, field: 'fact', value: (m: string) => `${m} 개발자` },
    { regex: /반말|편하게/i, field: 'style', value: 'casual' },
    { regex: /존댓말|격식/i, field: 'style', value: 'formal' },
  ]

  for (const pattern of patterns) {
    const match = userMessage.match(pattern.regex)
    if (match) {
      if (pattern.field === 'displayName' && match[1]) {
        await updateUserProfile(agentId, userId, { displayName: match[1].trim() })
      } else if (pattern.field === 'fact' && pattern.value) {
        const fact = typeof pattern.value === 'function' ? pattern.value(match[1]) : pattern.value
        await addImportantFact(agentId, userId, fact)
      } else if (pattern.field === 'style' && pattern.value) {
        const style = pattern.value as 'casual' | 'formal' | 'professional'
        const profile = await getOrCreateUserProfile(agentId, userId)
        await updateUserProfile(agentId, userId, {
          preferences: { ...profile.preferences, communicationStyle: style }
        })
      }
    }
  }
}

// ============================================
// Export
// ============================================

export default {
  // Profile
  getOrCreateUserProfile,
  updateUserProfile,
  addImportantFact,

  // Conversation
  saveConversationMessage,
  getRecentConversations,

  // RAG Search
  searchRelevantMemories,
  searchEpisodes,

  // Context Building
  buildJarvisContext,

  // Episodes
  saveEpisode,

  // Learning
  analyzeAndLearn,
}
