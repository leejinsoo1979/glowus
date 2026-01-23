/**
 * 마이뉴런 데이터 동기화 서비스
 * GlowUS 데이터베이스에서 그래프 데이터를 가져와 변환
 */

import { createAdminClient } from '@/lib/supabase/server'
import type {
  MyNeuronsGraph,
  MyNeuronNode,
  MyNeuronEdge,
  MyNeuronType,
  NeuronStatus,
  NeuronPriority,
  MyNeuronEdgeType,
  BottleneckInsight,
} from './types'
import { createSelfNode, createEmptyGraph } from './types'
import { BOTTLENECK_THRESHOLDS } from './constants'

// ============================================
// 타입 정의
// ============================================

interface SyncResult {
  graph: MyNeuronsGraph
  bottlenecks: BottleneckInsight[]
  priorities: MyNeuronNode[]
}

interface RawProject {
  id: string
  name: string
  description?: string
  status?: string
  category_id?: string
  priority?: string
  progress?: number
  deadline?: string
  created_at: string
  updated_at?: string
  owner_id: string
}

interface RawTask {
  id: string
  title: string
  description?: string
  status?: string
  priority?: string
  deadline?: string
  progress?: number
  project_id?: string
  assigned_agent_id?: string
  created_at: string
  updated_at?: string
}

interface RawBusinessPlan {
  id: string
  title: string
  program_id?: string
  project_name?: string
  status?: string
  pipeline_stage?: string
  completion_percentage?: number
  created_at: string
  updated_at?: string
}

interface RawTeamMember {
  id: string
  name: string
  email?: string
  role?: string
  user_id: string
}

interface RawAgent {
  id: string
  name: string
  persona?: string
  status?: string
  created_at: string
}

interface RawObjective {
  id: string
  title: string
  description?: string
  status?: string
  progress?: number
  created_at: string
}

interface RawKeyResult {
  id: string
  title: string
  objective_id: string
  current_value?: number
  target_value?: number
  status?: string
}

interface RawProgram {
  id: string
  title: string
  status?: string
  deadline?: string
  support_type?: string
}

interface RawApplication {
  id: string
  program_id: string
  status?: string
  created_at: string
}

interface RawMilestone {
  id: string
  project_id?: string
  application_id?: string
  title: string
  due_date?: string
  status?: string
}

interface RawBudget {
  id: string
  project_id?: string
  application_id?: string
  name: string
  total_amount?: number
  spent_amount?: number
}

// ============================================
// 유틸리티 함수
// ============================================

function calculateDaysUntil(dateString?: string): number | undefined {
  if (!dateString) return undefined
  const deadline = new Date(dateString)
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function mapTaskStatus(status?: string): NeuronStatus {
  switch (status?.toLowerCase()) {
    case 'blocked':
    case 'stuck':
      return 'blocked'
    case 'in_progress':
    case 'ongoing':
      return 'active'
    case 'done':
    case 'completed':
      return 'completed'
    case 'waiting':
    case 'pending':
      return 'waiting'
    default:
      return 'active'
  }
}

function mapPriority(priority?: string): NeuronPriority {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'highest':
      return 'critical'
    case 'high':
      return 'high'
    case 'medium':
    case 'normal':
      return 'medium'
    case 'low':
    case 'lowest':
      return 'low'
    default:
      return 'medium'
  }
}

function calculateImportance(node: Partial<MyNeuronNode>): number {
  let score = 5

  // Priority 기반
  if (node.priority === 'critical') score += 4
  else if (node.priority === 'high') score += 2
  else if (node.priority === 'low') score -= 2

  // Status 기반
  if (node.status === 'blocked') score += 3
  if (node.status === 'urgent') score += 2

  // Deadline 기반
  if (node.daysUntilDeadline !== undefined) {
    if (node.daysUntilDeadline <= 3) score += 3
    else if (node.daysUntilDeadline <= 7) score += 1
  }

  return Math.max(1, Math.min(10, score))
}

// ============================================
// 노드 변환 함수
// ============================================

function transformProject(p: RawProject): MyNeuronNode {
  const daysUntil = calculateDaysUntil(p.deadline)
  const node: MyNeuronNode = {
    id: `project-${p.id}`,
    type: 'project',
    title: p.name,
    summary: p.description,
    status: mapTaskStatus(p.status),
    priority: mapPriority(p.priority),
    importance: 5,
    progress: p.progress,
    deadline: p.deadline,
    daysUntilDeadline: daysUntil,
    sourceTable: 'projects',
    sourceId: p.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { categoryId: p.category_id },
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }
  node.importance = calculateImportance(node)
  return node
}

function transformTask(t: RawTask): MyNeuronNode {
  const daysUntil = calculateDaysUntil(t.deadline)
  let status = mapTaskStatus(t.status)

  // 마감일 기반 긴급 상태
  if (daysUntil !== undefined && daysUntil <= BOTTLENECK_THRESHOLDS.deadlineDaysUrgent) {
    if (status !== 'completed') status = 'urgent'
  }

  const node: MyNeuronNode = {
    id: `task-${t.id}`,
    type: 'task',
    title: t.title,
    summary: t.description,
    status,
    priority: mapPriority(t.priority),
    importance: 5,
    deadline: t.deadline,
    daysUntilDeadline: daysUntil,
    progress: t.progress,
    sourceTable: 'unified_tasks',
    sourceId: t.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { projectId: t.project_id, agentId: t.assigned_agent_id },
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }
  node.importance = calculateImportance(node)
  return node
}

function transformBusinessPlan(bp: RawBusinessPlan): MyNeuronNode {
  const node: MyNeuronNode = {
    id: `doc-${bp.id}`,
    type: 'doc',
    title: bp.title || bp.project_name || '사업계획서',
    summary: bp.pipeline_stage ? `단계: ${bp.pipeline_stage}` : undefined,
    status: mapTaskStatus(bp.status),
    priority: 'medium',
    importance: 6,
    progress: bp.completion_percentage,
    sourceTable: 'business_plans',
    sourceId: bp.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { programId: bp.program_id, pipelineStage: bp.pipeline_stage },
    createdAt: bp.created_at,
    updatedAt: bp.updated_at,
  }
  return node
}

function transformTeamMember(tm: RawTeamMember): MyNeuronNode {
  return {
    id: `person-${tm.id}`,
    type: 'person',
    title: tm.name,
    summary: tm.role,
    status: 'active',
    priority: 'medium',
    importance: 5,
    sourceTable: 'team_members',
    sourceId: tm.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { email: tm.email, role: tm.role },
  }
}

function transformAgent(a: RawAgent): MyNeuronNode {
  return {
    id: `agent-${a.id}`,
    type: 'agent',
    title: a.name,
    summary: a.persona,
    status: a.status === 'active' ? 'active' : 'waiting',
    priority: 'medium',
    importance: 5,
    sourceTable: 'deployed_agents',
    sourceId: a.id,
    position: { x: 0, y: 0, z: 0 },
    meta: {},
    createdAt: a.created_at,
  }
}

function transformObjective(o: RawObjective): MyNeuronNode {
  const node: MyNeuronNode = {
    id: `objective-${o.id}`,
    type: 'objective',
    title: o.title,
    summary: o.description,
    status: mapTaskStatus(o.status),
    priority: 'high',
    importance: 7,
    progress: o.progress,
    sourceTable: 'objectives',
    sourceId: o.id,
    position: { x: 0, y: 0, z: 0 },
    meta: {},
    createdAt: o.created_at,
  }
  return node
}

function transformKeyResult(kr: RawKeyResult): MyNeuronNode {
  const progress =
    kr.target_value && kr.current_value
      ? Math.round((kr.current_value / kr.target_value) * 100)
      : undefined

  return {
    id: `kr-${kr.id}`,
    type: 'key_result',
    title: kr.title,
    status: mapTaskStatus(kr.status),
    priority: 'medium',
    importance: 6,
    progress,
    sourceTable: 'key_results',
    sourceId: kr.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { objectiveId: kr.objective_id, currentValue: kr.current_value, targetValue: kr.target_value },
  }
}

function transformProgram(p: RawProgram): MyNeuronNode {
  const daysUntil = calculateDaysUntil(p.deadline)
  return {
    id: `program-${p.id}`,
    type: 'program',
    title: p.title,
    status: mapTaskStatus(p.status),
    priority: daysUntil && daysUntil <= 7 ? 'high' : 'medium',
    importance: 6,
    deadline: p.deadline,
    daysUntilDeadline: daysUntil,
    sourceTable: 'government_programs',
    sourceId: p.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { supportType: p.support_type },
  }
}

function transformApplication(app: RawApplication, programTitle?: string): MyNeuronNode {
  return {
    id: `application-${app.id}`,
    type: 'application',
    title: programTitle || '지원서',
    status: mapTaskStatus(app.status),
    priority: 'medium',
    importance: 6,
    sourceTable: 'program_applications',
    sourceId: app.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { programId: app.program_id },
    createdAt: app.created_at,
  }
}

function transformMilestone(m: RawMilestone): MyNeuronNode {
  const daysUntil = calculateDaysUntil(m.due_date)
  let status = mapTaskStatus(m.status)
  if (daysUntil !== undefined && daysUntil <= 3 && status !== 'completed') {
    status = 'urgent'
  }

  return {
    id: `milestone-${m.id}`,
    type: 'milestone',
    title: m.title,
    status,
    priority: daysUntil && daysUntil <= 7 ? 'high' : 'medium',
    importance: 7,
    deadline: m.due_date,
    daysUntilDeadline: daysUntil,
    sourceTable: 'project_milestones',
    sourceId: m.id,
    position: { x: 0, y: 0, z: 0 },
    meta: { projectId: m.project_id, applicationId: m.application_id },
  }
}

function transformBudget(b: RawBudget): MyNeuronNode {
  const usagePercent = b.total_amount && b.spent_amount
    ? Math.round((b.spent_amount / b.total_amount) * 100)
    : 0

  let status: NeuronStatus = 'active'
  if (usagePercent >= BOTTLENECK_THRESHOLDS.budgetCriticalPercent) {
    status = 'blocked'
  } else if (usagePercent >= BOTTLENECK_THRESHOLDS.budgetWarningPercent) {
    status = 'attention'
  }

  return {
    id: `budget-${b.id}`,
    type: 'budget',
    title: b.name,
    status,
    priority: status === 'blocked' ? 'critical' : 'medium',
    importance: status === 'blocked' ? 8 : 5,
    progress: 100 - usagePercent, // 남은 예산 %
    sourceTable: 'project_budgets',
    sourceId: b.id,
    position: { x: 0, y: 0, z: 0 },
    meta: {
      projectId: b.project_id,
      applicationId: b.application_id,
      totalAmount: b.total_amount,
      spentAmount: b.spent_amount,
      usagePercent,
    },
  }
}

// ============================================
// 엣지 생성 함수
// ============================================

function createEdge(
  sourceId: string,
  targetId: string,
  type: MyNeuronEdgeType,
  weight = 1
): MyNeuronEdge {
  return {
    id: `${sourceId}-${type}-${targetId}`,
    source: sourceId,
    target: targetId,
    type,
    weight,
    animated: type === 'blocks' || type === 'depends_on',
  }
}

function buildEdges(nodes: MyNeuronNode[], selfId: string): MyNeuronEdge[] {
  const edges: MyNeuronEdge[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  for (const node of nodes) {
    // Self → Project: owns
    if (node.type === 'project') {
      edges.push(createEdge(selfId, node.id, 'owns', 2))
    }

    // Task → Project: belongs_to
    if (node.type === 'task' && node.meta?.projectId) {
      const projectNodeId = `project-${node.meta.projectId}`
      if (nodeMap.has(projectNodeId)) {
        edges.push(createEdge(node.id, projectNodeId, 'belongs_to'))
      }
    }

    // Task → Agent: assigned_to
    if (node.type === 'task' && node.meta?.agentId) {
      const agentNodeId = `agent-${node.meta.agentId}`
      if (nodeMap.has(agentNodeId)) {
        edges.push(createEdge(node.id, agentNodeId, 'assigned_to'))
      }
    }

    // KeyResult → Objective: measures
    if (node.type === 'key_result' && node.meta?.objectiveId) {
      const objNodeId = `objective-${node.meta.objectiveId}`
      if (nodeMap.has(objNodeId)) {
        edges.push(createEdge(node.id, objNodeId, 'measures'))
      }
    }

    // Self → Objective: owns
    if (node.type === 'objective') {
      edges.push(createEdge(selfId, node.id, 'targets', 2))
    }

    // Application → Program: targets
    if (node.type === 'application' && node.meta?.programId) {
      const programNodeId = `program-${node.meta.programId}`
      if (nodeMap.has(programNodeId)) {
        edges.push(createEdge(node.id, programNodeId, 'targets'))
      }
    }

    // Milestone → Project/Application: belongs_to
    if (node.type === 'milestone') {
      if (node.meta?.projectId) {
        const projectNodeId = `project-${node.meta.projectId}`
        if (nodeMap.has(projectNodeId)) {
          edges.push(createEdge(node.id, projectNodeId, 'belongs_to'))
        }
      }
      if (node.meta?.applicationId) {
        const appNodeId = `application-${node.meta.applicationId}`
        if (nodeMap.has(appNodeId)) {
          edges.push(createEdge(node.id, appNodeId, 'belongs_to'))
        }
      }
    }

    // Budget → Project/Application: belongs_to
    if (node.type === 'budget') {
      if (node.meta?.projectId) {
        const projectNodeId = `project-${node.meta.projectId}`
        if (nodeMap.has(projectNodeId)) {
          edges.push(createEdge(node.id, projectNodeId, 'belongs_to'))
        }
      }
    }

    // Doc (BusinessPlan) → Self: owns
    if (node.type === 'doc') {
      edges.push(createEdge(selfId, node.id, 'owns'))
    }

    // Agent → Self: belongs_to
    if (node.type === 'agent') {
      edges.push(createEdge(node.id, selfId, 'belongs_to'))
    }

    // Person → Self: participates
    if (node.type === 'person') {
      edges.push(createEdge(node.id, selfId, 'participates'))
    }
  }

  return edges
}

// ============================================
// 병목 감지
// ============================================

function detectBottlenecks(nodes: MyNeuronNode[]): BottleneckInsight[] {
  const bottlenecks: BottleneckInsight[] = []

  for (const node of nodes) {
    // 1. Blocked tasks
    if (node.status === 'blocked') {
      bottlenecks.push({
        id: `bottleneck-${node.id}`,
        nodeId: node.id,
        type: 'blocked',
        severity: 'critical',
        message: `${node.title}이(가) 막혀있습니다`,
        suggestion: '원인을 파악하고 해결책을 찾아보세요',
        detectedAt: new Date().toISOString(),
      })
    }

    // 2. Urgent deadlines
    if (
      node.daysUntilDeadline !== undefined &&
      node.daysUntilDeadline <= BOTTLENECK_THRESHOLDS.deadlineDaysUrgent &&
      node.status !== 'completed'
    ) {
      bottlenecks.push({
        id: `bottleneck-deadline-${node.id}`,
        nodeId: node.id,
        type: 'deadline',
        severity: 'critical',
        message: `${node.title} 마감이 ${node.daysUntilDeadline}일 남았습니다`,
        suggestion: '우선순위를 높이고 집중하세요',
        detectedAt: new Date().toISOString(),
      })
    } else if (
      node.daysUntilDeadline !== undefined &&
      node.daysUntilDeadline <= BOTTLENECK_THRESHOLDS.deadlineDaysWarning &&
      node.status !== 'completed'
    ) {
      bottlenecks.push({
        id: `bottleneck-deadline-${node.id}`,
        nodeId: node.id,
        type: 'deadline',
        severity: 'warning',
        message: `${node.title} 마감이 ${node.daysUntilDeadline}일 남았습니다`,
        suggestion: '진행 상황을 점검하세요',
        detectedAt: new Date().toISOString(),
      })
    }

    // 3. Budget overrun
    const usagePercent = (node.meta?.usagePercent as number) || 0
    if (node.type === 'budget' && usagePercent >= BOTTLENECK_THRESHOLDS.budgetCriticalPercent) {
      bottlenecks.push({
        id: `bottleneck-budget-${node.id}`,
        nodeId: node.id,
        type: 'resource',
        severity: 'critical',
        message: `${node.title} 예산을 초과했습니다 (${usagePercent}%)`,
        suggestion: '추가 예산을 확보하거나 지출을 줄이세요',
        detectedAt: new Date().toISOString(),
      })
    } else if (node.type === 'budget' && usagePercent >= BOTTLENECK_THRESHOLDS.budgetWarningPercent) {
      bottlenecks.push({
        id: `bottleneck-budget-${node.id}`,
        nodeId: node.id,
        type: 'resource',
        severity: 'warning',
        message: `${node.title} 예산의 ${usagePercent}%를 사용했습니다`,
        suggestion: '남은 예산을 확인하세요',
        detectedAt: new Date().toISOString(),
      })
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  bottlenecks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return bottlenecks
}

// ============================================
// 우선순위 계산
// ============================================

function calculatePriorities(nodes: MyNeuronNode[]): MyNeuronNode[] {
  return nodes
    .filter((n) => n.type !== 'self')
    .sort((a, b) => {
      // 1. Importance
      if (b.importance !== a.importance) return b.importance - a.importance
      // 2. Priority enum
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      // 3. Deadline
      if (a.daysUntilDeadline !== undefined && b.daysUntilDeadline !== undefined) {
        return a.daysUntilDeadline - b.daysUntilDeadline
      }
      if (a.daysUntilDeadline !== undefined) return -1
      if (b.daysUntilDeadline !== undefined) return 1
      return 0
    })
    .slice(0, 20) // Top 20
}

// ============================================
// 메인 동기화 함수
// ============================================

export async function syncMyNeuronsGraph(
  userId: string,
  userName: string
): Promise<SyncResult> {
  const supabase = createAdminClient()
  const nodes: MyNeuronNode[] = []

  // Self 노드 생성
  const selfNode = createSelfNode(userId, userName)
  nodes.push(selfNode)

  // ============================================
  // Phase 1: 독립적인 쿼리들 병렬 실행 (성능 최적화)
  // ============================================
  const [
    projectsResult,
    tasksResult,
    businessPlansResult,
    teamMembersResult,
    agentsResult,
    objectivesResult,
    bookmarksResult,
    applicationsResult,
  ] = await Promise.all([
    // 1. Projects
    supabase
      .from('projects')
      .select('id, name, description, status, category_id, priority, progress, deadline, created_at, updated_at, owner_id')
      .eq('owner_id', userId)
      .limit(50),
    // 2. Tasks
    supabase
      .from('unified_tasks')
      .select('id, title, description, status, priority, deadline, progress, project_id, assigned_agent_id, created_at, updated_at')
      .eq('user_id', userId)
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(100),
    // 3. Business Plans
    supabase
      .from('business_plans')
      .select('id, title, program_id, project_name, status, pipeline_stage, completion_percentage, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    // 4. Team Members
    supabase
      .from('team_members')
      .select('id, name, email, role, user_id')
      .eq('user_id', userId)
      .limit(30),
    // 5. Deployed Agents
    supabase
      .from('deployed_agents')
      .select('id, name, persona, status, created_at')
      .eq('user_id', userId)
      .limit(20),
    // 6. Objectives
    supabase
      .from('objectives')
      .select('id, title, description, status, progress, created_at')
      .eq('user_id', userId)
      .limit(20),
    // 7. Program Bookmarks
    supabase
      .from('program_bookmarks')
      .select('program_id')
      .eq('user_id', userId)
      .limit(20),
    // 8. Applications
    supabase
      .from('program_applications')
      .select('id, program_id, status, created_at')
      .eq('user_id', userId)
      .limit(20),
  ])

  // Phase 1 결과 처리
  const projects = projectsResult.data as RawProject[] | null
  const tasks = tasksResult.data as RawTask[] | null
  const businessPlans = businessPlansResult.data as RawBusinessPlan[] | null
  const teamMembers = teamMembersResult.data as RawTeamMember[] | null
  const agents = agentsResult.data as RawAgent[] | null
  const objectives = objectivesResult.data as RawObjective[] | null
  const bookmarks = bookmarksResult.data as { program_id: string }[] | null
  const applications = applicationsResult.data as RawApplication[] | null

  if (projects) nodes.push(...projects.map(transformProject))
  if (tasks) nodes.push(...tasks.map(transformTask))
  if (businessPlans) nodes.push(...businessPlans.map(transformBusinessPlan))
  if (teamMembers) nodes.push(...teamMembers.map(transformTeamMember))
  if (agents) nodes.push(...agents.map(transformAgent))
  if (objectives) nodes.push(...objectives.map(transformObjective))

  // ============================================
  // Phase 2: 의존성 있는 쿼리들 병렬 실행
  // ============================================
  const objectiveIds = objectives?.map((o) => o.id) || []
  const projectIds = projects?.map((p) => p.id) || []
  const bookmarkProgramIds = bookmarks?.map((b) => b.program_id) || []
  const appProgramIds = [...new Set(applications?.map((a) => a.program_id) || [])]

  // Key Results (objectives 의존)
  if (objectiveIds.length > 0) {
    const { data: keyResults } = await supabase
      .from('key_results')
      .select('id, title, objective_id, current_value, target_value, status')
      .in('objective_id', objectiveIds)
      .limit(50)
    if (keyResults) nodes.push(...keyResults.map(transformKeyResult))
  }

  // Phase 2: 나머지 쿼리들 병렬 실행
  const phase2Results = await Promise.all([
    // Government Programs (bookmarks 의존)
    bookmarkProgramIds.length > 0
      ? supabase
          .from('government_programs')
          .select('id, title, status, deadline, support_type')
          .in('id', bookmarkProgramIds)
      : Promise.resolve({ data: null }),
    // Application Program Titles
    appProgramIds.length > 0
      ? supabase
          .from('government_programs')
          .select('id, title')
          .in('id', appProgramIds)
      : Promise.resolve({ data: null }),
    // Milestones
    projectIds.length > 0
      ? supabase
          .from('project_milestones')
          .select('id, project_id, application_id, title, due_date, status')
          .in('project_id', projectIds)
          .limit(50)
      : Promise.resolve({ data: null }),
    // Budgets
    projectIds.length > 0
      ? supabase
          .from('project_budgets')
          .select('id, project_id, application_id, name, total_amount, spent_amount')
          .in('project_id', projectIds)
          .limit(30)
      : Promise.resolve({ data: null }),
  ])

  const [programsResult, appProgramsResult, milestonesResult, budgetsResult] = phase2Results

  // Government Programs
  if (programsResult.data) {
    nodes.push(...programsResult.data.map(transformProgram))
  }

  // Program Title Map for Applications
  let programTitleMap = new Map<string, string>()
  if (appProgramsResult.data) {
    programTitleMap = new Map(
      appProgramsResult.data.map((p: { id: string; title: string }) => [p.id, p.title])
    )
  }

  // Milestones
  if (milestonesResult.data) {
    nodes.push(...milestonesResult.data.map(transformMilestone))
  }

  // Budgets
  if (budgetsResult.data) {
    nodes.push(...budgetsResult.data.map(transformBudget))
  }

  // Applications 노드 추가 (programTitleMap 사용)
  if (applications) {
    nodes.push(
      ...applications.map((a) => transformApplication(a, programTitleMap.get(a.program_id)))
    )
  }

  // 엣지 생성
  const edges = buildEdges(nodes, selfNode.id)

  // 병목 감지
  const bottlenecks = detectBottlenecks(nodes)

  // 우선순위 계산
  const priorities = calculatePriorities(nodes)

  // 통계 계산
  const stats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    blockedTasks: nodes.filter((n) => n.status === 'blocked').length,
    urgentItems: nodes.filter((n) => n.status === 'urgent').length,
    completedToday: 0, // TODO: 오늘 완료된 항목 계산
    activeProjects: nodes.filter((n) => n.type === 'project' && n.status === 'active').length,
    pendingApplications: nodes.filter((n) => n.type === 'application' && n.status !== 'completed').length,
  }

  // 그래프 생성
  const graph = createEmptyGraph(userId, userName)
  graph.nodes = nodes
  graph.edges = edges
  graph.stats = stats
  graph.lastSyncAt = new Date().toISOString()

  return { graph, bottlenecks, priorities }
}

// ============================================
// 부분 동기화 함수 (특정 테이블만)
// ============================================

export async function syncTable(
  userId: string,
  tableName: string
): Promise<MyNeuronNode[]> {
  const supabase = createAdminClient()
  const nodes: MyNeuronNode[] = []

  switch (tableName) {
    case 'projects': {
      const { data } = await supabase
        .from('projects')
        .select('id, name, description, status, category, created_at, updated_at, user_id')
        .eq('user_id', userId)
      if (data) nodes.push(...data.map(transformProject))
      break
    }
    case 'unified_tasks': {
      const { data } = await supabase
        .from('unified_tasks')
        .select('id, title, description, status, priority, deadline, progress, project_id, assigned_agent_id, created_at, updated_at')
        .eq('user_id', userId)
        .neq('status', 'done')
      if (data) nodes.push(...data.map(transformTask))
      break
    }
    // 추가 테이블은 필요에 따라...
  }

  return nodes
}
