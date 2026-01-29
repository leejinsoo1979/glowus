/**
 * Mission Control - Orchestration Engine
 *
 * 멀티 에이전트 오케스트레이션의 핵심 엔진
 * - 사용자 요청 분석
 * - 태스크 분해 및 계획 수립
 * - 에이전트 할당 및 실행
 * - 결과 수집 및 통합
 */

import { useMissionControlStore } from './store'
import {
  Mission,
  MissionAnalysis,
  Task,
  TaskCreateInput,
  TaskType,
  AgentRole,
  Artifact,
  OrchestratorPlan,
  TaskPlanItem,
} from './types'
import { executeAction, AgentAction, ActionResult } from '@/lib/ai/agent-actions'
import type { ToolAction } from '@/lib/ai/super-agent-tools'
import {
  syncArtifactToView,
  syncTaskCompletionToView,
  syncActionToView,
} from './artifact-view-mapper'

// ============================================================================
// Constants
// ============================================================================

const ORCHESTRATOR_SYSTEM_PROMPT = `당신은 Mission Control의 Orchestrator입니다.
사용자의 요청을 분석하고 작업을 계획하는 역할을 합니다.

## 응답 형식
반드시 아래 JSON 형식으로만 응답하세요:

\`\`\`json
{
  "analysis": {
    "summary": "요청 요약 (1-2문장)",
    "requirements": ["요구사항1", "요구사항2"],
    "constraints": ["제약사항1", "제약사항2"],
    "acceptanceCriteria": ["수용기준1", "수용기준2"],
    "estimatedComplexity": "simple|medium|complex",
    "suggestedApproach": "접근 방식 설명"
  },
  "tasks": [
    {
      "tempId": "task-1",
      "type": "plan|implement|test|review",
      "agent": "planner|implementer|tester|reviewer",
      "title": "작업 제목",
      "description": "작업 상세 설명",
      "dependencies": [],
      "priority": "low|medium|high|critical"
    }
  ],
  "phases": [
    {
      "name": "Phase 이름",
      "description": "Phase 설명",
      "taskIds": ["task-1", "task-2"],
      "canParallelize": true
    }
  ],
  "actions": []
}
\`\`\`

## 사용 가능한 도구 (actions 배열에 추가)
분석 결과를 시각화하려면 다음 도구들을 사용하세요:

### Flowchart (코드 흐름도)
- flowchart_create_node: 노드 생성 { "type": "flowchart_create_node", "nodeId": "id", "label": "라벨", "shape": "rectangle|round|diamond" }
- flowchart_create_edge: 연결 생성 { "type": "flowchart_create_edge", "sourceId": "소스", "targetId": "타겟", "label": "라벨" }

### Blueprint (태스크 관리)
- blueprint_create_task: 태스크 생성 { "type": "blueprint_create_task", "title": "제목", "description": "설명", "status": "todo", "priority": "high" }

## 규칙
1. 항상 Planning 태스크부터 시작
2. Implementation은 Planning 이후
3. Testing은 Implementation 이후
4. Review는 Testing 이후 (또는 병렬 가능)
5. 복잡한 작업은 더 작은 단위로 분해
6. 병렬 가능한 작업은 같은 Phase에 배치
7. 중요: 분석 결과를 Flowchart/Blueprint에 시각화하세요!`

// 🔥 모든 에이전트가 사용할 수 있는 도구 목록
const AVAILABLE_TOOLS = `
## 사용 가능한 도구 (actions 배열에 JSON 추가)
작업 결과를 시각화하려면 반드시 다음 도구들을 사용하세요!

### Flowchart (코드 흐름도) - 의존성, 흐름 시각화
- { "type": "flowchart_create_node", "nodeId": "unique-id", "label": "노드 이름", "shape": "rectangle|round|diamond|circle" }
- { "type": "flowchart_create_edge", "sourceId": "소스ID", "targetId": "타겟ID", "label": "관계 설명" }

### Blueprint (태스크 보드) - 작업 단계 관리
- { "type": "blueprint_create_task", "title": "제목", "description": "설명", "status": "todo|in_progress|review|done", "priority": "low|medium|high|urgent" }
- { "type": "blueprint_update_task", "taskId": "id", "status": "in_progress", "progress": 50 }

### Neural Map (지식 그래프) - 개념/관계 시각화
- { "type": "create_node", "nodeType": "concept|project|doc|idea|task", "title": "제목", "content": "내용" }
- { "type": "create_edge", "sourceNodeId": "소스", "targetNodeId": "타겟", "label": "관계", "edgeType": "references|imports|causes" }

### 파일 생성
- { "type": "create_file", "path": "경로/파일명.ts", "content": "파일 내용" }

## 중요: actions 배열에 도구를 넣으면 자동으로 실행됩니다!
`

const AGENT_SYSTEM_PROMPTS: Record<AgentRole, string> = {
  orchestrator: ORCHESTRATOR_SYSTEM_PROMPT,
  planner: `당신은 Mission Control의 Planner입니다.
아키텍처 설계, 데이터 흐름 정의, 인터페이스 설계를 담당합니다.

## 응답 형식 (반드시 JSON으로!)
\`\`\`json
{
  "content": "설계 내용 (Markdown)",
  "actions": [
    // 🔥 설계 결과를 Flowchart에 시각화!
    { "type": "flowchart_create_node", "nodeId": "module-1", "label": "모듈명", "shape": "rectangle" },
    { "type": "flowchart_create_edge", "sourceId": "module-1", "targetId": "module-2", "label": "의존성" }
  ]
}
\`\`\`

${AVAILABLE_TOOLS}

## 작업
1. 아키텍처 설계 → Flowchart 노드로 모듈 생성
2. 데이터 흐름 → Flowchart 엣지로 연결
3. 인터페이스 정의 → Neural Map에 concept 노드로 생성
4. 작업 단계 → Blueprint 태스크로 생성`,

  implementer: `당신은 Mission Control의 Implementer입니다.
실제 코드를 작성하는 역할을 합니다.

## 응답 형식 (반드시 JSON으로!)
\`\`\`json
{
  "content": "구현 설명",
  "actions": [
    // 🔥 코드를 파일로 생성!
    { "type": "create_file", "path": "src/components/Example.tsx", "content": "코드 내용" },
    // 🔥 구현 진행 상황을 Blueprint에 업데이트!
    { "type": "blueprint_update_task", "taskId": "task-id", "status": "done", "progress": 100 }
  ]
}
\`\`\`

${AVAILABLE_TOOLS}

## 규칙
1. 코드는 반드시 create_file 액션으로 파일 생성
2. 작업 완료 후 blueprint_update_task로 상태 업데이트
3. 완전하고 실행 가능한 TypeScript 코드 작성`,

  tester: `당신은 Mission Control의 Tester입니다.
테스트 케이스 작성 및 품질 검증을 담당합니다.

## 응답 형식 (반드시 JSON으로!)
\`\`\`json
{
  "content": "테스트 분석 결과",
  "actions": [
    // 🔥 테스트 파일 생성!
    { "type": "create_file", "path": "src/__tests__/example.test.ts", "content": "테스트 코드" },
    // 🔥 테스트 케이스를 Blueprint에 추가!
    { "type": "blueprint_create_task", "title": "테스트: 케이스명", "status": "todo", "priority": "high" }
  ]
}
\`\`\`

${AVAILABLE_TOOLS}

## 작업
1. 단위 테스트 코드 → create_file로 테스트 파일 생성
2. 테스트 케이스 목록 → Blueprint 태스크로 생성
3. 발견된 이슈 → Blueprint에 high priority로 추가`,

  reviewer: `당신은 Mission Control의 Reviewer입니다.
코드 품질, 보안, 성능을 검토합니다.

## 응답 형식 (반드시 JSON으로!)
\`\`\`json
{
  "content": "검토 결과 (Markdown)",
  "verdict": "APPROVE|REQUEST_CHANGES|REJECT",
  "actions": [
    // 🔥 발견된 이슈를 Blueprint 태스크로!
    { "type": "blueprint_create_task", "title": "수정 필요: 이슈명", "description": "상세 설명", "status": "todo", "priority": "high" },
    // 🔥 코드 구조를 Flowchart로 분석!
    { "type": "flowchart_create_node", "nodeId": "issue-1", "label": "보안 취약점", "shape": "diamond" }
  ]
}
\`\`\`

${AVAILABLE_TOOLS}

## 검토 항목
1. 코드 품질 → 이슈 발견 시 Blueprint 태스크 생성
2. 보안 취약점 → Flowchart에 diamond 노드로 표시
3. 성능 이슈 → Blueprint에 urgent priority로 추가`,
}

// ============================================================================
// Types
// ============================================================================

interface AgentCallOptions {
  missionId: string
  taskId?: string
  role: AgentRole
  instruction: string
  context?: string
  artifacts?: Artifact[]
  model?: string
  stream?: boolean
  onProgress?: (message: string) => void
}

interface AgentResponse {
  response: string
  artifacts?: Artifact[]
  toolsUsed?: string[]
  actions?: ToolAction[] // 🔥 도구 실행 결과 액션
  tokenUsage: {
    input: number
    output: number
    total: number
  }
}

// ============================================================================
// Orchestration Engine Class
// ============================================================================

export class OrchestrationEngine {
  private store = useMissionControlStore.getState
  private abortController: AbortController | null = null

  /**
   * 미션 시작 - 전체 워크플로우의 진입점
   */
  async startMission(userRequest: string): Promise<Mission> {
    const store = this.store()

    try {
      // 1. 미션 생성
      const mission = store.createMission(userRequest)
      store.setLoading(true)
      store.setMissionStatus('analyzing')

      // 2. Orchestrator로 요청 분석 및 계획 수립
      const plan = await this.analyzeAndPlan(mission, userRequest)

      // 3. 분석 결과 저장
      store.setMissionAnalysis(plan.analysis)

      // 4. 태스크 생성
      const tasks = this.createTasksFromPlan(mission.id, plan)
      store.setMissionStatus('executing')

      // 5. 태스크 실행 시작
      await this.executeTasks(mission.id)

      // 6. 완료 처리
      store.completeMission()

      return this.store().currentMission!
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      store.failMission(errorMessage)
      throw error
    } finally {
      store.setLoading(false)
    }
  }

  /**
   * 미션 중단
   */
  abortMission() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.store().cancelMission()
  }

  /**
   * Step 1: Orchestrator가 요청 분석 및 계획 수립
   */
  private async analyzeAndPlan(mission: Mission, userRequest: string): Promise<OrchestratorPlan> {
    const store = this.store()

    // Orchestrator 상태 업데이트
    store.setAgentStatus('orchestrator', 'thinking', '요청을 분석하고 있습니다...')

    try {
      const response = await this.callAgent({
        missionId: mission.id,
        role: 'orchestrator',
        instruction: `다음 사용자 요청을 분석하고 작업 계획을 수립하세요:\n\n${userRequest}`,
        onProgress: (msg) => {
          store.setAgentStatus('orchestrator', 'thinking', msg)
        },
      })

      // JSON 파싱
      const plan = this.parseOrchestratorResponse(response.response)

      store.setAgentStatus('orchestrator', 'idle', '분석 완료')
      return plan
    } catch (error) {
      store.setAgentError('orchestrator', '분석 실패')
      throw error
    }
  }

  /**
   * Orchestrator 응답 파싱
   */
  private parseOrchestratorResponse(response: string): OrchestratorPlan {
    // JSON 블록 추출
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    const jsonStr = jsonMatch ? jsonMatch[1] : response

    try {
      const parsed = JSON.parse(jsonStr)

      return {
        analysis: {
          summary: parsed.analysis?.summary || '분석 완료',
          requirements: parsed.analysis?.requirements || [],
          constraints: parsed.analysis?.constraints || [],
          acceptanceCriteria: parsed.analysis?.acceptanceCriteria || [],
          estimatedComplexity: parsed.analysis?.estimatedComplexity || 'medium',
          suggestedApproach: parsed.analysis?.suggestedApproach || '',
        },
        tasks: parsed.tasks || [],
        phases: parsed.phases || [],
        estimatedDuration: parsed.estimatedDuration || 'Unknown',
        estimatedCost: parsed.estimatedCost || 0,
      }
    } catch (e) {
      // 파싱 실패 시 기본 계획 생성
      console.error('Failed to parse orchestrator response:', e)
      return this.createDefaultPlan()
    }
  }

  /**
   * 기본 계획 생성 (파싱 실패 시)
   */
  private createDefaultPlan(): OrchestratorPlan {
    return {
      analysis: {
        summary: '요청을 처리합니다',
        requirements: [],
        constraints: [],
        acceptanceCriteria: [],
        estimatedComplexity: 'medium',
        suggestedApproach: '단계별 접근',
      },
      tasks: [
        {
          tempId: 'task-1',
          type: 'plan',
          agent: 'planner',
          title: '설계',
          description: '아키텍처 및 구조 설계',
          dependencies: [],
          priority: 'high',
        },
        {
          tempId: 'task-2',
          type: 'implement',
          agent: 'implementer',
          title: '구현',
          description: '코드 구현',
          dependencies: ['task-1'],
          priority: 'high',
        },
        {
          tempId: 'task-3',
          type: 'test',
          agent: 'tester',
          title: '테스트',
          description: '테스트 작성 및 실행',
          dependencies: ['task-2'],
          priority: 'medium',
        },
        {
          tempId: 'task-4',
          type: 'review',
          agent: 'reviewer',
          title: '리뷰',
          description: '코드 리뷰',
          dependencies: ['task-3'],
          priority: 'medium',
        },
      ],
      phases: [
        { name: 'Planning', description: '설계 단계', taskIds: ['task-1'], canParallelize: false },
        { name: 'Implementation', description: '구현 단계', taskIds: ['task-2'], canParallelize: false },
        { name: 'Verification', description: '검증 단계', taskIds: ['task-3', 'task-4'], canParallelize: true },
      ],
      estimatedDuration: '30분',
      estimatedCost: 0.1,
    }
  }

  /**
   * 계획에서 태스크 생성
   */
  private createTasksFromPlan(missionId: string, plan: OrchestratorPlan): Task[] {
    const store = this.store()
    const tempIdToRealId: Record<string, string> = {}

    // 첫 번째 패스: 태스크 생성 (의존성 없이)
    const taskInputs: TaskCreateInput[] = plan.tasks.map((taskPlan) => ({
      type: taskPlan.type as TaskType,
      assignedAgent: taskPlan.agent as AgentRole,
      title: taskPlan.title,
      description: taskPlan.description,
      input: taskPlan.description,
      priority: taskPlan.priority,
      dependencies: [], // 나중에 업데이트
    }))

    const tasks = store.addTasks(taskInputs)

    // tempId → realId 매핑
    plan.tasks.forEach((taskPlan, index) => {
      tempIdToRealId[taskPlan.tempId] = tasks[index].id
    })

    // 두 번째 패스: 의존성 업데이트
    plan.tasks.forEach((taskPlan, index) => {
      if (taskPlan.dependencies.length > 0) {
        const realDependencies = taskPlan.dependencies
          .map((tempId) => tempIdToRealId[tempId])
          .filter(Boolean)

        store.updateTask(tasks[index].id, { dependencies: realDependencies })
      }
    })

    return tasks
  }

  /**
   * 태스크 실행 - 의존성 기반 병렬 처리
   */
  private async executeTasks(missionId: string): Promise<void> {
    const store = this.store()
    this.abortController = new AbortController()

    while (true) {
      // 중단 체크
      if (this.abortController.signal.aborted) {
        break
      }

      // 실행 가능한 태스크 조회
      const readyTasks = store.getReadyTasks()

      // 남은 태스크 체크
      const pendingTasks = store.getPendingTasks()
      const mission = store.currentMission

      if (readyTasks.length === 0 && pendingTasks.length === 0) {
        // 모든 태스크 완료
        break
      }

      if (readyTasks.length === 0 && pendingTasks.length > 0) {
        // 대기 중인 태스크가 있지만 실행 가능한 것이 없음 (의존성 대기)
        await this.sleep(500)
        continue
      }

      // 동시 실행 가능한 태스크 수 제한
      const maxConcurrent = store.settings.maxConcurrentTasks
      const activeAgents = store.getActiveAgents()
      const availableSlots = maxConcurrent - activeAgents.length

      if (availableSlots <= 0) {
        await this.sleep(500)
        continue
      }

      // 실행할 태스크 선택
      const tasksToRun = readyTasks.slice(0, availableSlots)

      // 병렬 실행
      await Promise.all(tasksToRun.map((task) => this.executeTask(task)))
    }
  }

  /**
   * 개별 태스크 실행
   */
  private async executeTask(task: Task): Promise<void> {
    const store = this.store()
    const mission = store.currentMission
    if (!mission) return

    try {
      // 태스크 상태 업데이트
      store.setTaskStatus(task.id, 'in_progress')
      store.setAgentStatus(task.assignedAgent, 'working', `${task.title} 작업 중...`)
      store.setAgentTask(task.assignedAgent, task.id)

      // 컨텍스트 구성
      const context = this.buildTaskContext(mission, task)

      // 에이전트 호출
      const response = await this.callAgent({
        missionId: mission.id,
        taskId: task.id,
        role: task.assignedAgent,
        instruction: task.input,
        context,
        artifacts: mission.artifacts,
        onProgress: (msg) => {
          store.setAgentStatus(task.assignedAgent, 'working', msg)
        },
      })

      // 🔥 에이전트 응답에서 actions 파싱 및 실행
      const parsedResponse = this.parseAgentResponse(response.response)
      const actionResults = await this.executeAgentActions(parsedResponse.actions, task.assignedAgent)

      // 실행 결과 로깅
      if (actionResults.length > 0) {
        console.log(`[Orchestrator] ${task.assignedAgent} 에이전트가 ${actionResults.length}개 액션 실행:`,
          actionResults.map(r => `${r.action.type}: ${r.success ? '✅' : '❌'}`).join(', '))
      }

      // 산출물 생성 (content + 액션 실행 결과)
      const artifactIds: string[] = []
      let mainArtifact: Artifact | null = null
      const artifactContent = parsedResponse.content || response.response
      if (artifactContent) {
        mainArtifact = store.addArtifact({
          missionId: mission.id,
          taskId: task.id,
          createdBy: task.assignedAgent,
          type: this.getArtifactType(task.type),
          title: task.title,
          content: artifactContent,
        })
        artifactIds.push(mainArtifact.id)

        // 🔥 뷰 동기화 - 아티팩트 타입에 맞는 탭으로 전환 & 하이라이팅
        try {
          await syncArtifactToView(mainArtifact, {
            autoSwitch: true,
            highlight: true,
            scroll: true,
          })
          console.log(`[Orchestrator] 뷰 동기화 완료: ${mainArtifact.type} → 해당 탭`)
        } catch (viewSyncError) {
          console.warn('[Orchestrator] 뷰 동기화 실패:', viewSyncError)
        }
      }

      // 액션 실행 결과도 별도 산출물로 저장
      if (actionResults.length > 0) {
        const actionSummary = actionResults.map(r =>
          `${r.success ? '✅' : '❌'} ${r.action.type}${r.error ? ` (오류: ${r.error})` : ''}`
        ).join('\n')

        const actionArtifact = store.addArtifact({
          missionId: mission.id,
          taskId: task.id,
          createdBy: task.assignedAgent,
          type: 'log',
          title: `${task.title} - 실행 결과`,
          content: `## 실행된 액션\n\n${actionSummary}`,
        })
        artifactIds.push(actionArtifact.id)
      }

      // 태스크 완료
      store.completeTask(task.id, artifactContent, artifactIds)
      store.setAgentStatus(task.assignedAgent, 'idle', '작업 완료')
      store.setAgentTask(task.assignedAgent, undefined)

      // 🔥 태스크 완료 시 뷰 동기화 - 태스크 타입에 맞는 탭으로
      try {
        // 메타데이터에서 nodeId 추출 (있는 경우)
        const nodeId = (mainArtifact?.metadata?.nodeId as string) || undefined
        await syncTaskCompletionToView(
          task.type,
          task.assignedAgent,
          artifactIds,
          nodeId ? [nodeId] : undefined
        )
      } catch (viewSyncError) {
        console.warn('[Orchestrator] 태스크 완료 뷰 동기화 실패:', viewSyncError)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      store.failTask(task.id, errorMessage)
      store.setAgentError(task.assignedAgent, errorMessage)
      store.setAgentTask(task.assignedAgent, undefined)
    }
  }

  /**
   * 🔥 에이전트 응답에서 JSON 파싱 (content + actions)
   */
  private parseAgentResponse(response: string): { content: string; actions: AgentAction[] } {
    // JSON 블록 추출 시도
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        return {
          content: parsed.content || '',
          actions: parsed.actions || [],
        }
      } catch (e) {
        console.warn('[Orchestrator] JSON 파싱 실패, 원본 텍스트 사용:', e)
      }
    }

    // JSON 파싱 실패 시 전체 응답을 content로
    return {
      content: response,
      actions: [],
    }
  }

  /**
   * 🔥 에이전트 액션 실행
   */
  private async executeAgentActions(actions: AgentAction[], agentRole: AgentRole): Promise<ActionResult[]> {
    if (!actions || actions.length === 0) {
      return []
    }

    const store = this.store()
    const results: ActionResult[] = []

    for (const action of actions) {
      try {
        store.setAgentStatus(agentRole, 'working', `액션 실행: ${action.type}`)

        // 🔥 실제 액션 실행!
        const result = await executeAction(action)
        results.push(result)

        if (result.success) {
          console.log(`[Orchestrator] ✅ ${action.type} 성공:`, result.result)

          // 🔥 액션 실행 후 뷰 동기화 - 액션 타입에 맞는 탭으로 전환
          try {
            const nodeId = (action as any).nodeId || (result.result as any)?.nodeId
            await syncActionToView(action.type, nodeId)
          } catch (viewSyncError) {
            // 뷰 동기화 실패는 치명적이지 않으므로 경고만 출력
            console.warn(`[Orchestrator] 액션 뷰 동기화 실패:`, viewSyncError)
          }
        } else {
          console.warn(`[Orchestrator] ❌ ${action.type} 실패:`, result.error)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
        console.error(`[Orchestrator] ${action.type} 실행 중 예외:`, error)
        results.push({
          action,
          success: false,
          error: errorMessage,
        })
      }
    }

    return results
  }

  /**
   * 태스크 컨텍스트 구성
   */
  private buildTaskContext(mission: Mission, task: Task): string {
    const parts: string[] = []

    // 미션 정보
    parts.push(`## 미션\n${mission.userRequest}`)

    // 분석 결과
    if (mission.analysis) {
      parts.push(`## 분석 결과\n${mission.analysis.summary}`)
      if (mission.analysis.requirements.length > 0) {
        parts.push(`### 요구사항\n${mission.analysis.requirements.map((r) => `- ${r}`).join('\n')}`)
      }
    }

    // 이전 태스크 결과물
    const dependencyArtifacts = task.dependencies
      .map((depId) => {
        const depTask = mission.tasks.find((t) => t.id === depId)
        if (!depTask) return null
        const artifacts = mission.artifacts.filter((a) => a.taskId === depId)
        if (artifacts.length === 0) return null
        return {
          task: depTask,
          artifacts,
        }
      })
      .filter(Boolean)

    if (dependencyArtifacts.length > 0) {
      parts.push('## 이전 작업 결과')
      dependencyArtifacts.forEach((dep) => {
        if (!dep) return
        parts.push(`### ${dep.task.title}`)
        dep.artifacts.forEach((artifact) => {
          parts.push(`\n${artifact.content}\n`)
        })
      })
    }

    return parts.join('\n\n')
  }

  /**
   * 에이전트 호출 (API)
   */
  private async callAgent(options: AgentCallOptions): Promise<AgentResponse> {
    const { missionId, taskId, role, instruction, context, artifacts, onProgress } = options

    const systemPrompt = AGENT_SYSTEM_PROMPTS[role]
    // DeepSeek API 키가 없으므로 Gemini로 fallback
    const settingsModel = this.store().settings.defaultModel
    const model = options.model ||
      (settingsModel.startsWith('deepseek') ? 'gemini-2.0-flash-exp' : settingsModel)

    // API 호출 - agentMode로 도구 호출 활성화
    const response = await fetch('/api/mission-control/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId,
        taskId,
        agentRole: role,
        systemPrompt,
        instruction,
        context,
        model,
        // 🔥 Tool Calling 활성화
        agentMode: true,
        projectPath: this.store().settings.linkedMapId ? `/neural-map/${this.store().settings.linkedMapId}` : undefined,
        workContext: `Mission Control Orchestration - Task: ${taskId}`,
      }),
      signal: this.abortController?.signal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `API error: ${response.status}`)
    }

    const data = await response.json()

    // 🔥 도구 실행 결과 로깅
    if (data.toolsUsed && data.toolsUsed.length > 0) {
      console.log(`[Orchestrator] ${role} 에이전트가 ${data.toolsUsed.length}개 도구 사용:`, data.toolsUsed)
    }
    if (data.actions && data.actions.length > 0) {
      console.log(`[Orchestrator] ${role} 에이전트가 ${data.actions.length}개 액션 생성`)
    }

    return {
      response: data.response || data.message || '',
      artifacts: data.artifacts,
      toolsUsed: data.toolsUsed,
      actions: data.actions, // 🔥 도구 실행 액션
      tokenUsage: data.tokenUsage || { input: 0, output: 0, total: 0 },
    }
  }

  /**
   * 태스크 타입에서 산출물 타입 결정
   */
  private getArtifactType(taskType: TaskType): Artifact['type'] {
    const mapping: Record<TaskType, Artifact['type']> = {
      analyze: 'document',
      plan: 'blueprint',
      implement: 'code',
      test: 'test',
      review: 'review',
    }
    return mapping[taskType] || 'document'
  }

  /**
   * 유틸리티: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let orchestrationEngine: OrchestrationEngine | null = null

export function getOrchestrationEngine(): OrchestrationEngine {
  if (!orchestrationEngine) {
    orchestrationEngine = new OrchestrationEngine()
  }
  return orchestrationEngine
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function startMission(userRequest: string): Promise<Mission> {
  return getOrchestrationEngine().startMission(userRequest)
}

export function abortMission(): void {
  getOrchestrationEngine().abortMission()
}
