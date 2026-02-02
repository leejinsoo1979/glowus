/**
 * Jarvis GlowUS Control
 * GlowUS 앱 전체 제어 API
 */

import { createAdminClient } from '@/lib/supabase/admin'

// ============================================
// Types
// ============================================

export interface GlowUSState {
  currentPage: string
  userId: string
  activeAgentId?: string
  activeProjectId?: string
  openPanels: string[]
}

export interface SkillBuilderNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, any>
}

export interface SkillBuilderEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

// ============================================
// 페이지 네비게이션
// ============================================

const PAGE_ROUTES: Record<string, string> = {
  'dashboard': '/dashboard-group',
  'home': '/dashboard-group',
  'agents': '/dashboard-group/agents',
  'agent-builder': '/dashboard-group/agent-builder',
  'skill-builder': '/dashboard-group/agent-builder',
  'projects': '/dashboard-group/projects',
  'works': '/dashboard-group/works',
  'files': '/dashboard-group/files',
  'settings': '/dashboard-group/settings',
  'calendar': '/dashboard-group/calendar',
  'messenger': '/dashboard-group/messenger',
  'ai-docs': '/dashboard-group/apps/ai-docs',
  'ai-slides': '/dashboard-group/apps/ai-slides',
  'ai-sheet': '/dashboard-group/apps/ai-sheet',
  'ai-summary': '/dashboard-group/apps/ai-summary',
  'ai-blog': '/dashboard-group/apps/ai-blog',
  'image-gen': '/dashboard-group/apps/image-gen',
}

export function getPageRoute(pageName: string): string | null {
  const normalized = pageName.toLowerCase().replace(/\s+/g, '-')
  return PAGE_ROUTES[normalized] || null
}

export function getAvailablePages(): string[] {
  return Object.keys(PAGE_ROUTES)
}

// ============================================
// 에이전트 관리
// ============================================

export async function listAgents(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('deployed_agents')
    .select('id, name, description, status, llm_provider, llm_model, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function getAgent(agentId: string, userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('deployed_agents')
    .select('*')
    .eq('id', agentId)
    .eq('owner_id', userId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createAgent(userId: string, params: {
  name: string
  description?: string
  llmProvider?: string
  llmModel?: string
  systemPrompt?: string
}) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('deployed_agents')
    .insert({
      owner_id: userId,
      name: params.name,
      description: params.description || '',
      llm_provider: params.llmProvider || 'openai',
      llm_model: params.llmModel || 'gpt-4o-mini',
      system_prompt: params.systemPrompt || '',
      status: 'ACTIVE',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateAgent(agentId: string, userId: string, params: {
  name?: string
  description?: string
  llmProvider?: string
  llmModel?: string
  systemPrompt?: string
  status?: string
}) {
  const supabase = createAdminClient()

  const updateData: any = {}
  if (params.name) updateData.name = params.name
  if (params.description !== undefined) updateData.description = params.description
  if (params.llmProvider) updateData.llm_provider = params.llmProvider
  if (params.llmModel) updateData.llm_model = params.llmModel
  if (params.systemPrompt !== undefined) updateData.system_prompt = params.systemPrompt
  if (params.status) updateData.status = params.status
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('deployed_agents')
    .update(updateData)
    .eq('id', agentId)
    .eq('owner_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteAgent(agentId: string, userId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('deployed_agents')
    .delete()
    .eq('id', agentId)
    .eq('owner_id', userId)

  if (error) throw new Error(error.message)
  return { success: true }
}

// ============================================
// 스킬 관리
// ============================================

export async function listSkills(agentId: string) {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('agent_skills')
    .select('id, name, description, enabled, skill_type, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function addSkill(agentId: string, params: {
  name: string
  description?: string
  skillType?: string
  config?: Record<string, any>
}) {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('agent_skills')
    .insert({
      agent_id: agentId,
      name: params.name,
      description: params.description || '',
      skill_type: params.skillType || 'custom',
      config: params.config || {},
      enabled: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function toggleSkill(skillId: string, enabled: boolean) {
  const supabase = createAdminClient()
  const { data, error } = await (supabase as any)
    .from('agent_skills')
    .update({ enabled })
    .eq('id', skillId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteSkill(skillId: string) {
  const supabase = createAdminClient()
  const { error } = await (supabase as any)
    .from('agent_skills')
    .delete()
    .eq('id', skillId)

  if (error) throw new Error(error.message)
  return { success: true }
}

// ============================================
// 프로젝트 관리
// ============================================

export async function listProjects(userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function getProject(projectId: string, userId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createProject(userId: string, params: {
  name: string
  description?: string
}) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: params.name,
      description: params.description || '',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateProject(projectId: string, userId: string, params: {
  name?: string
  description?: string
  status?: string
}) {
  const supabase = createAdminClient()

  const updateData: any = {}
  if (params.name) updateData.name = params.name
  if (params.description !== undefined) updateData.description = params.description
  if (params.status) updateData.status = params.status
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteProject(projectId: string, userId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return { success: true }
}

// ============================================
// 스킬 빌더 (노드 기반 워크플로우)
// ============================================

export async function getSkillBuilderState(agentId: string) {
  const supabase = createAdminClient()

  // 에이전트의 워크플로우 노드/엣지 조회
  const { data: agent } = await supabase
    .from('deployed_agents')
    .select('workflow_nodes, workflow_edges')
    .eq('id', agentId)
    .single()

  return {
    nodes: agent?.workflow_nodes || [],
    edges: agent?.workflow_edges || [],
  }
}

export async function addSkillBuilderNode(agentId: string, node: {
  type: string
  position?: { x: number; y: number }
  data?: Record<string, any>
}) {
  const supabase = createAdminClient()

  // 현재 상태 조회
  const { data: agent } = await supabase
    .from('deployed_agents')
    .select('workflow_nodes')
    .eq('id', agentId)
    .single()

  const nodes = agent?.workflow_nodes || []

  // 새 노드 추가
  const newNode: SkillBuilderNode = {
    id: `node-${Date.now()}`,
    type: node.type,
    position: node.position || { x: 100 + nodes.length * 50, y: 100 + nodes.length * 30 },
    data: node.data || { label: node.type },
  }

  nodes.push(newNode)

  // 저장
  const { error } = await supabase
    .from('deployed_agents')
    .update({ workflow_nodes: nodes })
    .eq('id', agentId)

  if (error) throw new Error(error.message)
  return newNode
}

export async function updateSkillBuilderNode(agentId: string, nodeId: string, updates: {
  position?: { x: number; y: number }
  data?: Record<string, any>
}) {
  const supabase = createAdminClient()

  const { data: agent } = await supabase
    .from('deployed_agents')
    .select('workflow_nodes')
    .eq('id', agentId)
    .single()

  const nodes = agent?.workflow_nodes || []
  const nodeIndex = nodes.findIndex((n: any) => n.id === nodeId)

  if (nodeIndex === -1) throw new Error('노드를 찾을 수 없습니다')

  if (updates.position) nodes[nodeIndex].position = updates.position
  if (updates.data) nodes[nodeIndex].data = { ...nodes[nodeIndex].data, ...updates.data }

  const { error } = await supabase
    .from('deployed_agents')
    .update({ workflow_nodes: nodes })
    .eq('id', agentId)

  if (error) throw new Error(error.message)
  return nodes[nodeIndex]
}

export async function deleteSkillBuilderNode(agentId: string, nodeId: string) {
  const supabase = createAdminClient()

  const { data: agent } = await supabase
    .from('deployed_agents')
    .select('workflow_nodes, workflow_edges')
    .eq('id', agentId)
    .single()

  const nodes = (agent?.workflow_nodes || []).filter((n: any) => n.id !== nodeId)
  const edges = (agent?.workflow_edges || []).filter(
    (e: any) => e.source !== nodeId && e.target !== nodeId
  )

  const { error } = await supabase
    .from('deployed_agents')
    .update({ workflow_nodes: nodes, workflow_edges: edges })
    .eq('id', agentId)

  if (error) throw new Error(error.message)
  return { success: true }
}

export async function connectSkillBuilderNodes(agentId: string, edge: {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}) {
  const supabase = createAdminClient()

  const { data: agent } = await supabase
    .from('deployed_agents')
    .select('workflow_edges')
    .eq('id', agentId)
    .single()

  const edges = agent?.workflow_edges || []

  const newEdge: SkillBuilderEdge = {
    id: `edge-${Date.now()}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  }

  edges.push(newEdge)

  const { error } = await supabase
    .from('deployed_agents')
    .update({ workflow_edges: edges })
    .eq('id', agentId)

  if (error) throw new Error(error.message)
  return newEdge
}

export async function disconnectSkillBuilderNodes(agentId: string, edgeId: string) {
  const supabase = createAdminClient()

  const { data: agent } = await supabase
    .from('deployed_agents')
    .select('workflow_edges')
    .eq('id', agentId)
    .single()

  const edges = (agent?.workflow_edges || []).filter((e: any) => e.id !== edgeId)

  const { error } = await supabase
    .from('deployed_agents')
    .update({ workflow_edges: edges })
    .eq('id', agentId)

  if (error) throw new Error(error.message)
  return { success: true }
}

// ============================================
// 에이전트 채팅
// ============================================

export async function sendChatToAgent(agentId: string, userId: string, message: string) {
  const supabase = createAdminClient()

  // 에이전트 조회
  const { data: agent, error: agentError } = await supabase
    .from('deployed_agents')
    .select('*')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) throw new Error('에이전트를 찾을 수 없습니다')

  // 채팅 메시지 저장
  const { data: chatMessage, error: chatError } = await (supabase as any)
    .from('chat_messages')
    .insert({
      agent_id: agentId,
      user_id: userId,
      role: 'user',
      content: message,
    })
    .select()
    .single()

  if (chatError) {
    console.warn('Chat message save failed:', chatError)
  }

  // 실제 LLM 호출은 별도 API에서 처리
  // 여기서는 메시지 저장만
  return {
    messageId: chatMessage?.id,
    agentId,
    message,
    status: 'sent',
  }
}

// ============================================
// 워크플로우 실행
// ============================================

export async function triggerWorkflow(agentId: string, userId: string, input?: Record<string, any>) {
  const supabase = createAdminClient()

  // 워크플로우 실행 기록 생성
  const { data, error } = await (supabase as any)
    .from('workflow_executions')
    .insert({
      agent_id: agentId,
      user_id: userId,
      input: input || {},
      status: 'PENDING',
    })
    .select()
    .single()

  if (error) {
    // 테이블 없으면 무시
    console.warn('Workflow execution log failed:', error)
  }

  return {
    executionId: data?.id,
    status: 'triggered',
    agentId,
  }
}

// ============================================
// 앱 상태 조회
// ============================================

export async function getGlowUSState(userId: string): Promise<{
  agentCount: number
  activeAgentCount: number
  projectCount: number
  skillCount: number
  agents: { total: number; active: number }
  projects: { total: number }
  skills: { total: number }
  recentActivity: any[]
}> {
  const supabase = createAdminClient()

  // 에이전트 통계
  const { count: agentTotal } = await supabase
    .from('deployed_agents')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)

  const { count: agentActive } = await supabase
    .from('deployed_agents')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('status', 'ACTIVE')

  // 프로젝트 통계
  const { count: projectTotal } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // 스킬 통계 (전체 에이전트)
  const { data: userAgents } = await supabase
    .from('deployed_agents')
    .select('id')
    .eq('owner_id', userId)

  let skillTotal = 0
  if (userAgents && userAgents.length > 0) {
    const agentIds = userAgents.map(a => a.id)
    const { count } = await (supabase as any)
      .from('agent_skills')
      .select('*', { count: 'exact', head: true })
      .in('agent_id', agentIds)
    skillTotal = count || 0
  }

  return {
    // 플랫 형식 (Telegram 호환)
    agentCount: agentTotal || 0,
    activeAgentCount: agentActive || 0,
    projectCount: projectTotal || 0,
    skillCount: skillTotal,
    // 중첩 형식 (상세 조회용)
    agents: { total: agentTotal || 0, active: agentActive || 0 },
    projects: { total: projectTotal || 0 },
    skills: { total: skillTotal },
    recentActivity: [], // TODO: 최근 활동 로그
  }
}

// ============================================
// 스킬 빌더 노드 타입 목록
// ============================================

export const SKILL_BUILDER_NODE_TYPES = [
  { type: 'start', name: 'Start', description: '워크플로우 시작점', category: '코어' },
  { type: 'prompt', name: 'Prompt', description: '텍스트 입력/프롬프트', category: '코어' },
  { type: 'text-model', name: 'Text Model', description: 'LLM으로 텍스트 생성', category: '코어' },
  { type: 'end', name: 'End', description: '워크플로우 종료', category: '코어' },
  { type: 'image-generation', name: 'Image Generation', description: '이미지 생성', category: '도구' },
  { type: 'http-request', name: 'HTTP Request', description: '외부 API 호출', category: '도구' },
  { type: 'javascript', name: 'JavaScript', description: '커스텀 JS 코드 실행', category: '도구' },
  { type: 'tool', name: 'Tool', description: '커스텀 함수 도구', category: '도구' },
  { type: 'condition', name: 'Condition', description: '조건 분기', category: '로직' },
  { type: 'loop', name: 'Loop', description: '반복 실행', category: '로직' },
  { type: 'input', name: 'Input', description: '사용자 입력', category: 'I/O' },
  { type: 'output', name: 'Output', description: '결과 출력', category: 'I/O' },
]

export function getNodeTypeInfo(nodeType: string) {
  return SKILL_BUILDER_NODE_TYPES.find(n => n.type === nodeType)
}
