import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { JsonOutputParser } from '@langchain/core/output_parsers'

interface RoadmapGenerationInput {
  projectName: string
  projectDescription: string
  projectType?: string
  deadline?: string
  existingTasks?: Array<{ title: string; status: string }>
  teamSize?: number
  customInstructions?: string
}

interface GeneratedRoadmapNode {
  id: string // temporary ID for reference
  title: string
  description: string
  goal: string
  phase: string // planning, development, testing, deployment, etc.
  agent_type: 'planner' | 'designer' | 'developer' | 'qa' | 'content' | 'research' | 'data' | 'general'
  automation_level: 'full' | 'assisted' | 'manual'
  priority: number // 0-100
  estimated_hours: number
  depends_on: string[] // IDs of dependent nodes
}

export interface GeneratedRoadmap {
  nodes: GeneratedRoadmapNode[]
  summary: string
  phases: string[]
  totalEstimatedHours: number
}

const ROADMAP_GENERATION_PROMPT = `당신은 프로젝트 설계 전문가입니다. 주어진 프로젝트 정보를 바탕으로 AI 에이전트 기반 로드맵을 설계해주세요.

## 프로젝트 정보
- 이름: {projectName}
- 설명: {projectDescription}
- 타입: {projectType}
- 마감일: {deadline}
- 팀 규모: {teamSize}명
{existingTasksInfo}
{customInstructions}

## 요구사항
1. 프로젝트를 완료하기 위한 논리적인 단계(노드)를 설계하세요
2. 각 노드는 AI 에이전트가 수행하거나 지원할 수 있는 작업이어야 합니다
3. 노드 간의 의존성(depends_on)을 올바르게 설정하세요
4. 단계별로 phase를 구분하세요 (planning, design, development, testing, deployment, maintenance)
5. 자동화 수준(automation_level)을 적절히 설정하세요:
   - full: AI가 완전히 자동으로 수행
   - assisted: AI가 지원하고 사람이 검토
   - manual: 사람이 직접 수행
6. 5-10개의 핵심 노드로 구성하세요

## 출력 형식 (JSON)
{{
  "nodes": [
    {{
      "id": "node_1",
      "title": "노드 제목",
      "description": "상세 설명",
      "goal": "이 단계의 목표",
      "phase": "planning",
      "agent_type": "research",
      "automation_level": "assisted",
      "priority": 90,
      "estimated_hours": 8,
      "depends_on": []
    }},
    {{
      "id": "node_2",
      "title": "다음 노드",
      "description": "설명",
      "goal": "목표",
      "phase": "development",
      "agent_type": "development",
      "automation_level": "assisted",
      "priority": 80,
      "estimated_hours": 16,
      "depends_on": ["node_1"]
    }}
  ],
  "summary": "로드맵 요약 설명",
  "phases": ["planning", "development", "testing", "deployment"],
  "totalEstimatedHours": 100
}}

## 주의사항
- id는 "node_1", "node_2" 형식으로 고유하게 생성하세요
- depends_on은 이 노드가 시작되기 전에 완료되어야 하는 노드의 id 배열입니다
- agent_type은 다음 중 하나만 사용: "planner"(기획), "designer"(디자인), "developer"(개발), "qa"(테스트), "content"(콘텐츠), "research"(리서치), "data"(데이터분석), "general"(범용)
- priority는 0-100 사이 값 (높을수록 중요)
- phase는 프로젝트 단계를 나타냅니다

JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`

export async function generateRoadmap(input: RoadmapGenerationInput): Promise<GeneratedRoadmap> {
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    apiKey: process.env.OPENAI_API_KEY,
  })

  const prompt = PromptTemplate.fromTemplate(ROADMAP_GENERATION_PROMPT)
  const parser = new JsonOutputParser<GeneratedRoadmap>()

  const chain = prompt.pipe(model).pipe(parser)

  // Format existing tasks info if available
  let existingTasksInfo = ''
  if (input.existingTasks && input.existingTasks.length > 0) {
    existingTasksInfo = `\n## 기존 태스크\n${input.existingTasks.map(t => `- ${t.title} (${t.status})`).join('\n')}`
  }

  const result = await chain.invoke({
    projectName: input.projectName,
    projectDescription: input.projectDescription || '설명 없음',
    projectType: input.projectType || '일반 프로젝트',
    deadline: input.deadline || '미정',
    teamSize: input.teamSize || 1,
    existingTasksInfo,
    customInstructions: input.customInstructions
      ? `\n## 추가 지침\n${input.customInstructions}`
      : '',
  })

  // Validate and normalize the result
  const validAgentTypes = ['planner', 'designer', 'developer', 'qa', 'content', 'research', 'data', 'general']
  const validAutomationLevels = ['full', 'assisted', 'manual']

  const normalizedNodes: GeneratedRoadmapNode[] = result.nodes.map((node, index) => ({
    id: node.id || `node_${index + 1}`,
    title: node.title,
    description: node.description || '',
    goal: node.goal || '',
    phase: node.phase || 'development',
    agent_type: validAgentTypes.includes(node.agent_type) ? node.agent_type : 'general',
    automation_level: validAutomationLevels.includes(node.automation_level) ? node.automation_level : 'assisted',
    priority: typeof node.priority === 'number' ? Math.min(100, Math.max(0, node.priority)) : 50,
    estimated_hours: node.estimated_hours || 8,
    depends_on: Array.isArray(node.depends_on) ? node.depends_on : [],
  })) as GeneratedRoadmapNode[]

  return {
    nodes: normalizedNodes,
    summary: result.summary || '',
    phases: result.phases || ['planning', 'development', 'testing', 'deployment'],
    totalEstimatedHours: result.totalEstimatedHours || normalizedNodes.reduce((sum, n) => sum + n.estimated_hours, 0),
  }
}

// Calculate positions for nodes based on their dependencies
export function calculateNodePositions(nodes: GeneratedRoadmapNode[]): Array<{ id: string; x: number; y: number }> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const positions: Array<{ id: string; x: number; y: number }> = []
  const levels: Map<string, number> = new Map()

  // Calculate level for each node (based on dependency depth)
  function getLevel(nodeId: string, visited: Set<string> = new Set()): number {
    if (visited.has(nodeId)) return 0
    if (levels.has(nodeId)) return levels.get(nodeId)!

    visited.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (!node || node.depends_on.length === 0) {
      levels.set(nodeId, 0)
      return 0
    }

    const maxDependencyLevel = Math.max(
      ...node.depends_on.map(depId => getLevel(depId, visited) + 1)
    )
    levels.set(nodeId, maxDependencyLevel)
    return maxDependencyLevel
  }

  // Calculate levels for all nodes
  nodes.forEach(n => getLevel(n.id))

  // Group nodes by level
  const nodesByLevel: Map<number, string[]> = new Map()
  nodes.forEach(n => {
    const level = levels.get(n.id) || 0
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, [])
    }
    nodesByLevel.get(level)!.push(n.id)
  })

  // Assign positions
  const horizontalSpacing = 300
  const verticalSpacing = 150
  const startX = 100
  const startY = 100

  nodesByLevel.forEach((nodeIds, level) => {
    const totalHeight = (nodeIds.length - 1) * verticalSpacing
    const startYForLevel = startY + (nodes.length * verticalSpacing / 2) / 2 - totalHeight / 2

    nodeIds.forEach((nodeId, index) => {
      positions.push({
        id: nodeId,
        x: startX + level * horizontalSpacing,
        y: startYForLevel + index * verticalSpacing,
      })
    })
  })

  return positions
}
