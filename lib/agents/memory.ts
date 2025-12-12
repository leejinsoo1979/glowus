// Agent Memory System
// 에이전트가 사람처럼 일하고, 기록하고, 기억하는 시스템

// Ollama 로컬 LLM 호출 헬퍼
async function callOllama(prompt: string, json = false): Promise<string> {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-r1:7b',
      prompt,
      stream: false,
      format: json ? 'json' : undefined,
    }),
  })
  const data = await res.json()
  return data.response || ''
}

// =====================================================
// Types
// =====================================================

export type LogType =
  | 'conversation'
  | 'task_work'
  | 'decision'
  | 'analysis'
  | 'learning'
  | 'collaboration'
  | 'error'
  | 'milestone'

export type CommitType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'milestone'

export type KnowledgeType =
  | 'project'
  | 'team'
  | 'domain'
  | 'preference'
  | 'procedure'
  | 'decision_rule'
  | 'lesson_learned'

export interface WorkLog {
  id?: string
  agentId: string
  logType: LogType
  title: string
  content: string
  summary?: string
  roomId?: string
  taskId?: string
  projectId?: string
  relatedAgentIds?: string[]
  importance?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export interface AgentCommit {
  id?: string
  agentId: string
  commitType: CommitType
  periodStart: Date
  periodEnd: Date
  title: string
  summary: string
  stats?: {
    conversations?: number
    tasks_completed?: number
    decisions_made?: number
    collaborations?: number
    key_topics?: string[]
  }
  logIds?: string[]
  learnings?: string[]
  insights?: string[]
}

export interface AgentKnowledge {
  id?: string
  agentId: string
  knowledgeType: KnowledgeType
  subject: string
  content: string
  projectId?: string
  teamId?: string
  confidence?: number
  tags?: string[]
}

export interface AgentIdentity {
  agentId: string
  coreValues: string[]
  personalityTraits: string[]
  communicationStyle?: string
  expertiseAreas?: Array<{
    area: string
    level: number
    experienceCount: number
  }>
  workingStyle?: string
  strengths?: string[]
  growthAreas?: string[]
  selfSummary?: string
  recentFocus?: string
}

export interface ContextSnapshot {
  agentId: string
  contextType: 'room' | 'project' | 'global'
  roomId?: string
  projectId?: string
  contextSummary: string
  keyFacts: string[]
  recentDecisions: string[]
  pendingItems: string[]
}

// =====================================================
// Memory Service Class
// =====================================================

export class AgentMemoryService {
  private supabase: any

  constructor(supabase: any) {
    this.supabase = supabase
  }

  // -------------------------------------------------
  // 1. 업무 로그 기록
  // -------------------------------------------------

  /**
   * 업무 로그 저장
   * 에이전트의 모든 활동을 기록
   */
  async logWork(log: WorkLog): Promise<string | null> {
    try {
      // 임베딩 생성
      const textToEmbed = `${log.title}\n${log.content}`
      const embedding = await this.createEmbedding(textToEmbed)

      // AI로 요약 생성 (긴 내용일 경우)
      let summary = log.summary
      if (!summary && log.content.length > 500) {
        summary = await this.generateSummary(log.content)
      }

      const { data, error } = await this.supabase
        .from('agent_work_logs')
        .insert({
          agent_id: log.agentId,
          log_type: log.logType,
          title: log.title,
          content: log.content,
          summary,
          room_id: log.roomId || null,
          task_id: log.taskId || null,
          project_id: log.projectId || null,
          related_agent_ids: log.relatedAgentIds || [],
          importance: log.importance || 5,
          tags: log.tags || [],
          metadata: log.metadata || {},
          embedding,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Failed to log work:', error)
        return null
      }

      return data?.id
    } catch (error) {
      console.error('Work log error:', error)
      return null
    }
  }

  /**
   * 대화 참여 기록
   */
  async logConversation(
    agentId: string,
    roomId: string,
    userMessage: string,
    agentResponse: string,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    return this.logWork({
      agentId,
      logType: 'conversation',
      title: `대화 참여: ${userMessage.slice(0, 50)}...`,
      content: `사용자: ${userMessage}\n\n에이전트 응답: ${agentResponse}`,
      roomId,
      importance: 5,
      metadata: {
        ...metadata,
        user_message_length: userMessage.length,
        response_length: agentResponse.length,
      },
    })
  }

  /**
   * 의사결정 기록
   */
  async logDecision(
    agentId: string,
    decision: string,
    reasoning: string,
    context?: { roomId?: string; taskId?: string; projectId?: string }
  ): Promise<string | null> {
    return this.logWork({
      agentId,
      logType: 'decision',
      title: `의사결정: ${decision.slice(0, 50)}`,
      content: `결정: ${decision}\n\n이유: ${reasoning}`,
      ...context,
      importance: 7,
      tags: ['decision'],
    })
  }

  /**
   * 다른 에이전트와의 협업 기록
   */
  async logCollaboration(
    agentId: string,
    otherAgentIds: string[],
    topic: string,
    summary: string,
    roomId?: string
  ): Promise<string | null> {
    return this.logWork({
      agentId,
      logType: 'collaboration',
      title: `협업: ${topic}`,
      content: summary,
      roomId,
      relatedAgentIds: otherAgentIds,
      importance: 6,
      tags: ['collaboration'],
    })
  }

  // -------------------------------------------------
  // 2. 커밋 시스템 (자동 요약)
  // -------------------------------------------------

  /**
   * 기간별 업무 커밋 생성
   */
  async createCommit(
    agentId: string,
    commitType: CommitType,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AgentCommit | null> {
    try {
      // 해당 기간의 로그 조회
      const { data: logs, error: logsError } = await this.supabase
        .from('agent_work_logs')
        .select('*')
        .eq('agent_id', agentId)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString())
        .order('created_at', { ascending: true })

      if (logsError || !logs?.length) {
        console.log('No logs to commit')
        return null
      }

      // 통계 계산
      const stats = this.calculateStats(logs)

      // AI로 커밋 메시지 생성
      const commitContent = await this.generateCommitMessage(logs, stats, commitType)

      // 커밋 저장
      const { data: commit, error: commitError } = await this.supabase
        .from('agent_commits')
        .insert({
          agent_id: agentId,
          commit_type: commitType,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          title: commitContent.title,
          summary: commitContent.summary,
          stats,
          log_ids: logs.map((l: any) => l.id),
          learnings: commitContent.learnings,
          insights: commitContent.insights,
          embedding: await this.createEmbedding(commitContent.summary),
        })
        .select()
        .single()

      if (commitError) {
        console.error('Failed to create commit:', commitError)
        return null
      }

      return commit
    } catch (error) {
      console.error('Commit creation error:', error)
      return null
    }
  }

  /**
   * 일간 커밋 생성
   */
  async createDailyCommit(agentId: string, date?: Date): Promise<AgentCommit | null> {
    const targetDate = date || new Date()
    const periodStart = new Date(targetDate)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(targetDate)
    periodEnd.setHours(23, 59, 59, 999)

    return this.createCommit(agentId, 'daily', periodStart, periodEnd)
  }

  // -------------------------------------------------
  // 3. 지식 관리
  // -------------------------------------------------

  /**
   * 지식 저장
   */
  async saveKnowledge(knowledge: AgentKnowledge): Promise<string | null> {
    try {
      const embedding = await this.createEmbedding(`${knowledge.subject}\n${knowledge.content}`)

      const { data, error } = await this.supabase
        .from('agent_knowledge')
        .insert({
          agent_id: knowledge.agentId,
          knowledge_type: knowledge.knowledgeType,
          subject: knowledge.subject,
          content: knowledge.content,
          project_id: knowledge.projectId || null,
          team_id: knowledge.teamId || null,
          confidence: knowledge.confidence || 0.8,
          tags: knowledge.tags || [],
          embedding,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Failed to save knowledge:', error)
        return null
      }

      return data?.id
    } catch (error) {
      console.error('Knowledge save error:', error)
      return null
    }
  }

  /**
   * 대화에서 지식 추출 및 저장
   */
  async extractAndSaveKnowledge(
    agentId: string,
    conversation: string,
    context?: { projectId?: string; teamId?: string }
  ): Promise<void> {
    try {
      const prompt = `다음 대화에서 중요한 지식이나 정보를 추출하세요.
각 지식은 나중에 참고할 수 있도록 명확하게 정리해주세요.

대화:
${conversation}

다음 JSON 형식으로 응답하세요:
{
  "knowledge": [
    {
      "type": "project|team|domain|preference|procedure|decision_rule|lesson_learned",
      "subject": "주제",
      "content": "내용",
      "confidence": 0.8,
      "tags": ["태그1", "태그2"]
    }
  ]
}

지식이 없으면 빈 배열을 반환하세요.`

      const response = await callOllama(prompt, true)
      const result = JSON.parse(response || '{"knowledge": []}')

      for (const k of result.knowledge || []) {
        await this.saveKnowledge({
          agentId,
          knowledgeType: k.type,
          subject: k.subject,
          content: k.content,
          confidence: k.confidence,
          tags: k.tags,
          ...context,
        })
      }
    } catch (error) {
      console.error('Knowledge extraction error:', error)
    }
  }

  // -------------------------------------------------
  // 4. 컨텍스트 로드 (응답 시 사용)
  // -------------------------------------------------

  /**
   * 에이전트의 전체 컨텍스트 로드
   */
  async loadFullContext(
    agentId: string,
    options?: {
      roomId?: string
      projectId?: string
      query?: string
      maxTokens?: number
    }
  ): Promise<{
    identity: AgentIdentity | null
    recentLogs: any[]
    relevantKnowledge: any[]
    recentCommits: any[]
    contextSummary: string
  }> {
    // 각 단계별로 에러를 개별 처리하여 DB 테이블이 없어도 동작하도록 함
    let identity: AgentIdentity | null = null
    let recentLogs: any[] = []
    let relevantKnowledge: any[] = []
    let recentCommits: any[] = []

    // 1. 정체성 로드 (테이블 없어도 무시)
    try {
      identity = await this.loadIdentity(agentId)
    } catch (err) {
      console.warn('Identity table not available:', err)
    }

    // 2. 최근 로그 로드 (테이블 없어도 무시)
    try {
      recentLogs = await this.loadRecentLogs(agentId, {
        roomId: options?.roomId,
        limit: 20,
      })
    } catch (err) {
      console.warn('Work logs table not available:', err)
    }

    // 3. 관련 지식 검색 (테이블 없어도 무시)
    try {
      if (options?.query) {
        relevantKnowledge = await this.searchKnowledge(agentId, options.query, 5)
      }
    } catch (err) {
      console.warn('Knowledge table not available:', err)
    }

    // 4. 최근 커밋 로드 (테이블 없어도 무시)
    try {
      recentCommits = await this.loadRecentCommits(agentId, 3)
    } catch (err) {
      console.warn('Commits table not available:', err)
    }

    // 5. 컨텍스트 요약 생성
    const contextSummary = this.buildContextSummary(
      identity,
      recentLogs,
      relevantKnowledge,
      recentCommits
    )

    return {
      identity,
      recentLogs,
      relevantKnowledge,
      recentCommits,
      contextSummary,
    }
  }

  /**
   * 정체성 로드
   */
  async loadIdentity(agentId: string): Promise<AgentIdentity | null> {
    const { data, error } = await this.supabase
      .from('agent_identity')
      .select('*')
      .eq('agent_id', agentId)
      .single()

    if (error || !data) return null

    return {
      agentId: data.agent_id,
      coreValues: data.core_values,
      personalityTraits: data.personality_traits,
      communicationStyle: data.communication_style,
      expertiseAreas: data.expertise_areas,
      workingStyle: data.working_style,
      strengths: data.strengths,
      growthAreas: data.growth_areas,
      selfSummary: data.self_summary,
      recentFocus: data.recent_focus,
    }
  }

  /**
   * 최근 로그 로드
   */
  async loadRecentLogs(
    agentId: string,
    options?: { roomId?: string; limit?: number }
  ): Promise<any[]> {
    let query = this.supabase
      .from('agent_work_logs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(options?.limit || 20)

    if (options?.roomId) {
      query = query.eq('room_id', options.roomId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to load logs:', error)
      return []
    }

    return data || []
  }

  /**
   * 시맨틱 지식 검색
   */
  async searchKnowledge(
    agentId: string,
    query: string,
    limit: number = 5
  ): Promise<any[]> {
    try {
      const embedding = await this.createEmbedding(query)

      const { data, error } = await this.supabase.rpc('match_agent_knowledge', {
        agent_id_input: agentId,
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit,
      })

      if (error) {
        console.error('Knowledge search error:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Knowledge search failed:', error)
      return []
    }
  }

  /**
   * 최근 커밋 로드
   */
  async loadRecentCommits(agentId: string, limit: number = 5): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('agent_commits')
      .select('*')
      .eq('agent_id', agentId)
      .order('period_end', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to load commits:', error)
      return []
    }

    return data || []
  }

  // -------------------------------------------------
  // 5. 정체성 관리
  // -------------------------------------------------

  /**
   * 정체성 초기화 (에이전트 생성 시)
   */
  async initializeIdentity(
    agentId: string,
    agentName: string,
    description: string,
    systemPrompt: string
  ): Promise<boolean> {
    try {
      // AI로 정체성 추출
      const prompt = `다음 AI 에이전트의 정체성을 분석하세요.

이름: ${agentName}
설명: ${description}
시스템 프롬프트: ${systemPrompt}

다음 JSON 형식으로 응답하세요:
{
  "core_values": ["핵심 가치 1", "핵심 가치 2"],
  "personality_traits": ["성격 특성 1", "성격 특성 2"],
  "communication_style": "소통 스타일 설명",
  "strengths": ["강점 1", "강점 2"],
  "self_summary": "나는 이런 에이전트입니다 (1-2문장)"
}`

      const response = await callOllama(prompt, true)
      const identity = JSON.parse(response || '{}')

      const { error } = await this.supabase
        .from('agent_identity')
        .insert({
          agent_id: agentId,
          core_values: identity.core_values || ['전문성', '협업'],
          personality_traits: identity.personality_traits || ['친절함', '정확성'],
          communication_style: identity.communication_style || '명확하고 친근한 소통',
          strengths: identity.strengths || [],
          self_summary: identity.self_summary || `저는 ${agentName}입니다.`,
        })

      if (error) {
        console.error('Failed to initialize identity:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Identity initialization error:', error)
      return false
    }
  }

  /**
   * 경험 기반 정체성 업데이트
   */
  async updateIdentityFromExperience(agentId: string): Promise<void> {
    try {
      // 최근 커밋에서 성장 추출
      const recentCommits = await this.loadRecentCommits(agentId, 10)

      if (!recentCommits.length) return

      // 통계 집계
      const totalStats = recentCommits.reduce(
        (acc, commit) => {
          const stats = commit.stats || {}
          return {
            conversations: acc.conversations + (stats.conversations || 0),
            tasks_completed: acc.tasks_completed + (stats.tasks_completed || 0),
            decisions_made: acc.decisions_made + (stats.decisions_made || 0),
          }
        },
        { conversations: 0, tasks_completed: 0, decisions_made: 0 }
      )

      // 정체성 업데이트
      await this.supabase
        .from('agent_identity')
        .update({
          total_conversations: totalStats.conversations,
          total_tasks_completed: totalStats.tasks_completed,
          total_decisions_made: totalStats.decisions_made,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', agentId)
    } catch (error) {
      console.error('Identity update error:', error)
    }
  }

  // -------------------------------------------------
  // Helper Methods
  // -------------------------------------------------

  /**
   * 임베딩 생성 (Ollama 미지원 - 빈 배열 반환)
   */
  private async createEmbedding(text: string): Promise<number[]> {
    // Ollama는 임베딩 미지원, 빈 배열 반환
    return []
  }

  /**
   * 요약 생성
   */
  private async generateSummary(content: string): Promise<string> {
    try {
      const prompt = `주어진 내용을 한국어로 간단명료하게 1-2문장으로 요약하세요.\n\n${content}`
      const response = await callOllama(prompt)
      return response || content.slice(0, 200) + '...'
    } catch (error) {
      console.error('Summary generation error:', error)
      return content.slice(0, 200) + '...'
    }
  }

  /**
   * 통계 계산
   */
  private calculateStats(logs: any[]): any {
    const stats = {
      conversations: 0,
      tasks_completed: 0,
      decisions_made: 0,
      collaborations: 0,
      key_topics: [] as string[],
    }

    const topicCount = new Map<string, number>()

    for (const log of logs) {
      switch (log.log_type) {
        case 'conversation':
          stats.conversations++
          break
        case 'task_work':
          stats.tasks_completed++
          break
        case 'decision':
          stats.decisions_made++
          break
        case 'collaboration':
          stats.collaborations++
          break
      }

      // 태그에서 주요 토픽 추출
      for (const tag of log.tags || []) {
        topicCount.set(tag, (topicCount.get(tag) || 0) + 1)
      }
    }

    // 상위 5개 토픽
    stats.key_topics = Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic)

    return stats
  }

  /**
   * 커밋 메시지 생성
   */
  private async generateCommitMessage(
    logs: any[],
    stats: any,
    commitType: CommitType
  ): Promise<{
    title: string
    summary: string
    learnings: string[]
    insights: string[]
  }> {
    const periodLabel = {
      hourly: '지난 시간',
      daily: '오늘',
      weekly: '이번 주',
      monthly: '이번 달',
      milestone: '이 이정표',
    }[commitType]

    const logSummaries = logs
      .map((l) => `- [${l.log_type}] ${l.title}`)
      .slice(0, 20)
      .join('\n')

    const prompt = `다음은 AI 에이전트의 ${periodLabel} 업무 기록입니다.

통계:
- 대화: ${stats.conversations}건
- 완료 태스크: ${stats.tasks_completed}건
- 의사결정: ${stats.decisions_made}건
- 협업: ${stats.collaborations}건

주요 활동:
${logSummaries}

다음 JSON 형식으로 커밋 메시지를 작성하세요:
{
  "title": "간단한 한 줄 요약 (git commit 메시지처럼)",
  "summary": "상세 요약 (2-3문단)",
  "learnings": ["배운 것 1", "배운 것 2"],
  "insights": ["인사이트 1", "인사이트 2"]
}`

    const response = await callOllama(prompt, true)
    return JSON.parse(response || '{}')
  }

  /**
   * 컨텍스트 요약 빌드
   */
  private buildContextSummary(
    identity: AgentIdentity | null,
    recentLogs: any[],
    relevantKnowledge: any[],
    recentCommits: any[]
  ): string {
    let summary = ''

    // 정체성
    if (identity) {
      summary += `## 나의 정체성\n`
      summary += `${identity.selfSummary || ''}\n`
      if (identity.recentFocus) {
        summary += `최근 집중: ${identity.recentFocus}\n`
      }
      summary += '\n'
    }

    // 최근 활동
    if (recentLogs.length > 0) {
      summary += `## 최근 활동 (${recentLogs.length}건)\n`
      for (const log of recentLogs.slice(0, 5)) {
        summary += `- ${log.title}\n`
      }
      summary += '\n'
    }

    // 관련 지식
    if (relevantKnowledge.length > 0) {
      summary += `## 관련 지식\n`
      for (const k of relevantKnowledge) {
        summary += `- ${k.subject}: ${k.content.slice(0, 100)}...\n`
      }
      summary += '\n'
    }

    // 최근 커밋
    if (recentCommits.length > 0) {
      summary += `## 업무 요약\n`
      for (const commit of recentCommits.slice(0, 2)) {
        summary += `- ${commit.title}\n`
      }
    }

    return summary
  }
}

// 싱글톤 인스턴스 생성용
let memoryServiceInstance: AgentMemoryService | null = null

export function getMemoryService(supabase: any): AgentMemoryService {
  if (!memoryServiceInstance) {
    memoryServiceInstance = new AgentMemoryService(supabase)
  }
  return memoryServiceInstance
}
