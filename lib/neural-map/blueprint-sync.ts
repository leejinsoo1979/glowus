/**
 * Blueprint ↔ Agent Sync Utility
 *
 * "Coding Navigator" - GPS for Development
 *
 * Blueprint (설계도) = AI가 따라갈 로드맵
 * Agent = Blueprint를 읽고 실행하는 AI
 *
 * 흐름:
 * 1. 사용자가 Blueprint(LifeStreamView)에서 로드맵 생성
 * 2. Agent가 Blueprint 노드를 읽고 AgentPlan으로 변환
 * 3. Agent가 task 실행할 때마다 Blueprint 노드 상태 업데이트
 * 4. 진행 상황이 Dashboard와 GitHub에 동기화
 */

import type {
  NeuralNode,
  AgentPlan,
  AgentTask,
  TaskStatus,
  NodeType
} from './types'

// Blueprint 노드 타입 (로드맵용)
export type BlueprintNodeType = 'milestone' | 'feature' | 'fix' | 'decision' | 'release'
export type BlueprintStatus = 'done' | 'doing' | 'todo'

export interface BlueprintNode {
  id: string
  type: BlueprintNodeType
  title: string
  description?: string
  status: BlueprintStatus
  position: number // 순서
  taskId?: string // 연결된 AgentTask ID
  files?: string[] // 관련 파일
  estimatedHours?: number
  actualHours?: number
  gitCommit?: string // 완료 시 커밋 SHA
  gitBranch?: string
}

// TaskStatus → BlueprintStatus 변환
export function taskStatusToBlueprintStatus(status: TaskStatus): BlueprintStatus {
  switch (status) {
    case 'completed':
      return 'done'
    case 'in_progress':
      return 'doing'
    case 'pending':
    case 'failed':
    default:
      return 'todo'
  }
}

// BlueprintStatus → TaskStatus 변환
export function blueprintStatusToTaskStatus(status: BlueprintStatus): TaskStatus {
  switch (status) {
    case 'done':
      return 'completed'
    case 'doing':
      return 'in_progress'
    case 'todo':
    default:
      return 'pending'
  }
}

// NeuralNode → BlueprintNode 변환
export function neuralNodeToBlueprintNode(node: NeuralNode, position: number): BlueprintNode {
  // tags에서 status 추출
  const status: BlueprintStatus =
    node.tags?.includes('done') ? 'done' :
    node.tags?.includes('doing') ? 'doing' : 'todo'

  // tags에서 taskId 추출 (예: "task:abc123")
  const taskIdTag = node.tags?.find(t => t.startsWith('task:'))
  const taskId = taskIdTag?.split(':')[1]

  // tags에서 git 정보 추출
  const commitTag = node.tags?.find(t => t.startsWith('commit:'))
  const gitCommit = commitTag?.split(':')[1]

  const branchTag = node.tags?.find(t => t.startsWith('branch:'))
  const gitBranch = branchTag?.split(':')[1]

  return {
    id: node.id,
    type: (node.type as BlueprintNodeType) || 'feature',
    title: node.title,
    description: node.summary || node.content,
    status,
    position,
    taskId,
    files: node.tags?.filter(t => t.startsWith('file:')).map(t => t.split(':')[1]),
    gitCommit,
    gitBranch,
  }
}

// BlueprintNode → AgentTask 변환
export function blueprintNodeToAgentTask(node: BlueprintNode): AgentTask {
  return {
    id: node.taskId || node.id,
    description: `${node.title}${node.description ? ': ' + node.description : ''}`,
    status: blueprintStatusToTaskStatus(node.status),
    files: node.files || [],
    estimatedRisk: 'low',
    requiredApproval: node.type === 'release' || node.type === 'decision',
  }
}

// AgentTask → NeuralNode tags 생성
export function agentTaskToNodeTags(task: AgentTask, gitCommit?: string, gitBranch?: string): string[] {
  const tags: string[] = ['pipeline']

  // Status tag
  switch (task.status) {
    case 'completed':
      tags.push('done')
      break
    case 'in_progress':
      tags.push('doing')
      break
    default:
      tags.push('todo')
  }

  // Task ID tag
  tags.push(`task:${task.id}`)

  // File tags
  if (task.files?.length) {
    task.files.forEach(f => tags.push(`file:${f}`))
  }

  // Git tags
  if (gitCommit) tags.push(`commit:${gitCommit}`)
  if (gitBranch) tags.push(`branch:${gitBranch}`)

  return tags
}

// AgentPlan → BlueprintNode[] 변환
export function agentPlanToBlueprintNodes(plan: AgentPlan): BlueprintNode[] {
  return plan.tasks.map((task, index) => ({
    id: task.id,
    type: 'feature' as BlueprintNodeType,
    title: task.description.split(':')[0], // 첫 줄만 제목으로
    description: task.description,
    status: taskStatusToBlueprintStatus(task.status),
    position: index,
    taskId: task.id,
    files: task.files,
  }))
}

// BlueprintNode[] → AgentPlan 변환
export function blueprintNodesToAgentPlan(nodes: BlueprintNode[]): AgentPlan {
  const tasks = nodes
    .sort((a, b) => a.position - b.position)
    .map(node => blueprintNodeToAgentTask(node))

  // 현재 진행 중인 task index 찾기
  const currentTaskIndex = tasks.findIndex(t => t.status === 'in_progress')

  // 진행 중인게 없으면 첫 번째 pending task
  const pendingIndex = currentTaskIndex >= 0
    ? currentTaskIndex
    : tasks.findIndex(t => t.status === 'pending')

  return {
    tasks,
    currentTaskIndex: Math.max(0, pendingIndex),
    approvalStatus: 'pending',
    files: tasks.flatMap(t => t.files || []),
    generatedAt: Date.now(),
  }
}

// Blueprint 진행률 계산
export interface BlueprintProgress {
  total: number
  done: number
  doing: number
  todo: number
  percentage: number
  estimatedHoursRemaining?: number
}

export function calculateBlueprintProgress(nodes: BlueprintNode[]): BlueprintProgress {
  const total = nodes.length
  const done = nodes.filter(n => n.status === 'done').length
  const doing = nodes.filter(n => n.status === 'doing').length
  const todo = nodes.filter(n => n.status === 'todo').length

  const percentage = total > 0 ? Math.round((done / total) * 100) : 0

  // 남은 예상 시간 계산
  const remainingNodes = nodes.filter(n => n.status !== 'done')
  const estimatedHoursRemaining = remainingNodes.reduce(
    (sum, n) => sum + (n.estimatedHours || 1),
    0
  )

  return {
    total,
    done,
    doing,
    todo,
    percentage,
    estimatedHoursRemaining,
  }
}

// API 요청 헬퍼
export async function syncBlueprintToServer(
  mapId: string,
  nodes: BlueprintNode[]
): Promise<void> {
  // 기존 Blueprint 노드들 업데이트
  for (const node of nodes) {
    const tags = agentTaskToNodeTags(
      blueprintNodeToAgentTask(node),
      node.gitCommit,
      node.gitBranch
    )

    await fetch(`/api/neural-map/${mapId}/nodes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: node.id,
        tags,
        summary: node.description,
      }),
    })
  }
}

// Blueprint 노드 상태 업데이트
export async function updateBlueprintNodeStatus(
  mapId: string,
  nodeId: string,
  status: BlueprintStatus,
  gitCommit?: string
): Promise<void> {
  // 현재 노드 태그 가져오기
  const response = await fetch(`/api/neural-map/${mapId}/nodes`)
  const nodes = await response.json()
  const node = nodes.find((n: NeuralNode) => n.id === nodeId)

  if (!node) return

  // 태그 업데이트
  let tags = (node.tags || []).filter(
    (t: string) => !['done', 'doing', 'todo'].includes(t) && !t.startsWith('commit:')
  )
  tags.push(status)
  if (gitCommit) tags.push(`commit:${gitCommit}`)

  await fetch(`/api/neural-map/${mapId}/nodes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, tags }),
  })
}

// AgentPlan에서 Blueprint 노드 생성
export async function createBlueprintFromPlan(
  mapId: string,
  plan: AgentPlan
): Promise<BlueprintNode[]> {
  const blueprintNodes: BlueprintNode[] = []

  for (let i = 0; i < plan.tasks.length; i++) {
    const task = plan.tasks[i]

    // Blueprint 노드 생성
    const response = await fetch(`/api/neural-map/${mapId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'task', // NeuralNode type
        title: task.description.split(':')[0].trim(),
        summary: task.description,
        tags: agentTaskToNodeTags(task),
        position: { x: i * 300, y: 0, z: 0 }, // 수평 배치
      }),
    })

    if (response.ok) {
      const node = await response.json()
      blueprintNodes.push({
        id: node.id,
        type: 'feature',
        title: node.title,
        description: task.description,
        status: taskStatusToBlueprintStatus(task.status),
        position: i,
        taskId: task.id,
        files: task.files,
      })
    }
  }

  // 노드들을 sequence 엣지로 연결
  for (let i = 0; i < blueprintNodes.length - 1; i++) {
    await fetch(`/api/neural-map/${mapId}/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: blueprintNodes[i].id,
        target: blueprintNodes[i + 1].id,
        type: 'sequence',
        weight: 1,
        bidirectional: false,
      }),
    })
  }

  return blueprintNodes
}

// GitHub 동기화를 위한 진행상황 포맷
export function formatProgressForGitHub(
  projectName: string,
  progress: BlueprintProgress,
  currentTask?: BlueprintNode
): string {
  const progressBar = '█'.repeat(Math.floor(progress.percentage / 10)) +
                      '░'.repeat(10 - Math.floor(progress.percentage / 10))

  let message = `## 🚀 ${projectName} Progress\n\n`
  message += `[${progressBar}] ${progress.percentage}%\n\n`
  message += `- ✅ Done: ${progress.done}/${progress.total}\n`
  message += `- 🔄 In Progress: ${progress.doing}\n`
  message += `- ⏳ Todo: ${progress.todo}\n`

  if (currentTask) {
    message += `\n### Current: ${currentTask.title}\n`
    if (currentTask.description) {
      message += `> ${currentTask.description}\n`
    }
  }

  if (progress.estimatedHoursRemaining) {
    message += `\n⏱️ Estimated: ${progress.estimatedHoursRemaining}h remaining\n`
  }

  return message
}
