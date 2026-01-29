/**
 * Mission Control - Artifact View Mapper
 *
 * 아티팩트 타입을 Neural Map ViewTab으로 매핑하고
 * 뷰 전환 및 노드 하이라이팅을 관리합니다.
 */

import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { ViewTab } from '@/lib/neural-map/types'
import type { Artifact, TaskType, AgentRole } from './types'

// ============================================================================
// Types
// ============================================================================

export interface ViewSyncEvent {
  type: 'artifact_created' | 'task_completed' | 'node_created' | 'blueprint_updated'
  artifactType?: Artifact['type']
  taskType?: TaskType
  agentRole?: AgentRole
  nodeId?: string
  data?: Record<string, unknown>
}

export interface ViewSyncResult {
  targetTab: ViewTab
  shouldSwitch: boolean
  highlightNodeIds?: string[]
  scrollToNodeId?: string
}

// ============================================================================
// Artifact Type → ViewTab Mapping
// ============================================================================

const ARTIFACT_TO_VIEW_MAP: Record<Artifact['type'], ViewTab> = {
  blueprint: 'logic',      // Blueprint → Logic/Blueprint 탭
  schema: 'data',          // Schema → Data/ERD 탭
  diagram: 'mermaid',      // Diagram → Mermaid/Flowchart 탭
  code: 'map',             // Code → Neural Map 탭
  test: 'test',            // Test → Test 탭
  review: 'map',           // Review → Neural Map 탭
  document: 'data',        // Document → Data 탭
  log: 'map',              // Log → Neural Map 탭 (기본)
}

const TASK_TYPE_TO_VIEW_MAP: Record<TaskType, ViewTab> = {
  analyze: 'architecture', // 분석 → Architecture 탭
  plan: 'logic',           // 계획 → Logic/Blueprint 탭
  implement: 'map',        // 구현 → Neural Map 탭
  test: 'test',            // 테스트 → Test 탭
  review: 'map',           // 리뷰 → Neural Map 탭
}

const AGENT_ROLE_TO_VIEW_MAP: Record<AgentRole, ViewTab> = {
  orchestrator: 'architecture',  // Orchestrator → Architecture
  planner: 'logic',              // Planner → Logic/Blueprint
  implementer: 'map',            // Implementer → Neural Map
  tester: 'test',                // Tester → Test
  reviewer: 'map',               // Reviewer → Neural Map
}

// ============================================================================
// View Mapper Class
// ============================================================================

class ArtifactViewMapper {
  private listeners: Set<(event: ViewSyncEvent, result: ViewSyncResult) => void> = new Set()
  private lastSyncTime: number = 0
  private syncDebounceMs: number = 300

  /**
   * 아티팩트 생성 이벤트 처리 및 뷰 전환
   */
  async syncArtifactToView(
    artifact: Artifact,
    options?: {
      autoSwitch?: boolean
      highlight?: boolean
      scroll?: boolean
    }
  ): Promise<ViewSyncResult> {
    const { autoSwitch = true, highlight = true, scroll = true } = options || {}

    // 타겟 탭 결정
    const targetTab = this.determineTargetTab(artifact)

    // 메타데이터에서 nodeId 추출 (있는 경우)
    const nodeId = (artifact.metadata?.nodeId as string) || undefined

    const result: ViewSyncResult = {
      targetTab,
      shouldSwitch: autoSwitch,
      highlightNodeIds: nodeId ? [nodeId] : undefined,
      scrollToNodeId: scroll && nodeId ? nodeId : undefined,
    }

    // 뷰 전환 실행
    if (autoSwitch) {
      await this.switchToTab(targetTab)
    }

    // 노드 하이라이팅
    if (highlight && nodeId) {
      this.highlightNode(nodeId)
    }

    // 리스너 알림
    this.notifyListeners(
      {
        type: 'artifact_created',
        artifactType: artifact.type,
        nodeId,
        data: { artifact },
      },
      result
    )

    return result
  }

  /**
   * 태스크 완료 시 뷰 동기화
   */
  async syncTaskCompletion(
    taskType: TaskType,
    agentRole: AgentRole,
    artifactIds?: string[],
    nodeIds?: string[]
  ): Promise<ViewSyncResult> {
    // 태스크 타입에 따른 타겟 탭
    const targetTab = TASK_TYPE_TO_VIEW_MAP[taskType] || 'map'

    const result: ViewSyncResult = {
      targetTab,
      shouldSwitch: true,
      highlightNodeIds: nodeIds,
      scrollToNodeId: nodeIds?.[0],
    }

    // Debounce를 통한 빠른 연속 호출 방지
    const now = Date.now()
    if (now - this.lastSyncTime < this.syncDebounceMs) {
      result.shouldSwitch = false
      return result
    }
    this.lastSyncTime = now

    // 뷰 전환
    await this.switchToTab(targetTab)

    // 노드 하이라이팅
    if (nodeIds && nodeIds.length > 0) {
      this.highlightNodes(nodeIds)
    }

    // 리스너 알림
    this.notifyListeners(
      {
        type: 'task_completed',
        taskType,
        agentRole,
        data: { artifactIds, nodeIds },
      },
      result
    )

    return result
  }

  /**
   * 특정 액션 타입에 따른 뷰 전환
   */
  async syncActionToView(
    actionType: string,
    nodeId?: string
  ): Promise<ViewSyncResult> {
    const targetTab = this.getTabForAction(actionType)

    const result: ViewSyncResult = {
      targetTab,
      shouldSwitch: true,
      highlightNodeIds: nodeId ? [nodeId] : undefined,
      scrollToNodeId: nodeId,
    }

    await this.switchToTab(targetTab)

    if (nodeId) {
      this.highlightNode(nodeId)
    }

    this.notifyListeners(
      {
        type: 'node_created',
        nodeId,
        data: { actionType },
      },
      result
    )

    return result
  }

  /**
   * 액션 타입 → ViewTab 매핑
   */
  private getTabForAction(actionType: string): ViewTab {
    const actionToTabMap: Record<string, ViewTab> = {
      // Neural Map 노드 관련
      create_node: 'map',
      update_node: 'map',
      delete_node: 'map',
      create_edge: 'map',
      delete_edge: 'map',

      // Blueprint 관련
      blueprint_create_task: 'logic',
      blueprint_update_task: 'logic',
      blueprint_delete_task: 'logic',
      blueprint_get_tasks: 'logic',

      // Flowchart 관련
      flowchart_create_node: 'mermaid',
      flowchart_update_node: 'mermaid',
      flowchart_delete_node: 'mermaid',
      flowchart_create_edge: 'mermaid',
      flowchart_delete_edge: 'mermaid',

      // 파일 관련
      write_file: 'map',
      edit_file: 'map',
      create_file_with_node: 'map',

      // 기타
      call_agent: 'architecture',
      get_agent_status: 'architecture',
    }

    return actionToTabMap[actionType] || 'map'
  }

  /**
   * 아티팩트에서 타겟 탭 결정
   */
  private determineTargetTab(artifact: Artifact): ViewTab {
    // 1. 아티팩트 타입 기반
    const tabFromType = ARTIFACT_TO_VIEW_MAP[artifact.type]
    if (tabFromType) return tabFromType

    // 2. 파일 경로 기반 (코드 파일인 경우)
    if (artifact.filePath) {
      if (artifact.filePath.endsWith('.test.ts') || artifact.filePath.endsWith('.test.tsx')) {
        return 'test'
      }
      if (artifact.filePath.includes('/schema') || artifact.filePath.includes('/types')) {
        return 'data'
      }
    }

    // 3. 기본값
    return 'map'
  }

  /**
   * 탭 전환 실행
   */
  private async switchToTab(tab: ViewTab): Promise<void> {
    try {
      const store = useNeuralMapStore.getState()
      if (store.activeTab !== tab) {
        store.setActiveTab(tab)
        console.log(`[ArtifactViewMapper] Switched to tab: ${tab}`)
      }
    } catch (error) {
      console.error('[ArtifactViewMapper] Failed to switch tab:', error)
    }
  }

  /**
   * 단일 노드 하이라이팅
   */
  private highlightNode(nodeId: string): void {
    try {
      const store = useNeuralMapStore.getState()
      store.selectNode(nodeId)
      console.log(`[ArtifactViewMapper] Highlighted node: ${nodeId}`)
    } catch (error) {
      console.error('[ArtifactViewMapper] Failed to highlight node:', error)
    }
  }

  /**
   * 다중 노드 하이라이팅
   */
  private highlightNodes(nodeIds: string[]): void {
    try {
      const store = useNeuralMapStore.getState()
      // 첫 번째 노드 선택
      if (nodeIds.length > 0) {
        store.selectNode(nodeIds[0])
      }
      console.log(`[ArtifactViewMapper] Highlighted ${nodeIds.length} nodes`)
    } catch (error) {
      console.error('[ArtifactViewMapper] Failed to highlight nodes:', error)
    }
  }

  /**
   * 리스너 등록
   */
  addListener(callback: (event: ViewSyncEvent, result: ViewSyncResult) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * 리스너 알림
   */
  private notifyListeners(event: ViewSyncEvent, result: ViewSyncResult): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event, result)
      } catch (error) {
        console.error('[ArtifactViewMapper] Listener error:', error)
      }
    })
  }

  /**
   * 에이전트 역할에 따른 기본 탭 가져오기
   */
  getDefaultTabForAgent(role: AgentRole): ViewTab {
    return AGENT_ROLE_TO_VIEW_MAP[role] || 'map'
  }

  /**
   * 전역 window 콜백 설정 (클라이언트 사이드에서 사용)
   */
  setupGlobalCallbacks(): void {
    if (typeof window === 'undefined') return

    // Mission Control에서 호출할 수 있는 전역 콜백
    ;(window as any).__missionControlViewSync = {
      switchTab: (tab: ViewTab) => this.switchToTab(tab),
      highlightNode: (nodeId: string) => this.highlightNode(nodeId),
      syncArtifact: (artifact: Artifact) => this.syncArtifactToView(artifact),
      syncTaskCompletion: (
        taskType: TaskType,
        agentRole: AgentRole,
        artifactIds?: string[],
        nodeIds?: string[]
      ) => this.syncTaskCompletion(taskType, agentRole, artifactIds, nodeIds),
      syncAction: (actionType: string, nodeId?: string) =>
        this.syncActionToView(actionType, nodeId),
    }

    console.log('[ArtifactViewMapper] Global callbacks registered')
  }

  /**
   * 전역 콜백 정리
   */
  cleanupGlobalCallbacks(): void {
    if (typeof window === 'undefined') return
    delete (window as any).__missionControlViewSync
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let viewMapperInstance: ArtifactViewMapper | null = null

export function getArtifactViewMapper(): ArtifactViewMapper {
  if (!viewMapperInstance) {
    viewMapperInstance = new ArtifactViewMapper()
  }
  return viewMapperInstance
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 아티팩트 생성 후 뷰 동기화
 */
export async function syncArtifactToView(
  artifact: Artifact,
  options?: {
    autoSwitch?: boolean
    highlight?: boolean
    scroll?: boolean
  }
): Promise<ViewSyncResult> {
  return getArtifactViewMapper().syncArtifactToView(artifact, options)
}

/**
 * 태스크 완료 후 뷰 동기화
 */
export async function syncTaskCompletionToView(
  taskType: TaskType,
  agentRole: AgentRole,
  artifactIds?: string[],
  nodeIds?: string[]
): Promise<ViewSyncResult> {
  return getArtifactViewMapper().syncTaskCompletion(taskType, agentRole, artifactIds, nodeIds)
}

/**
 * 액션 실행 후 뷰 동기화
 */
export async function syncActionToView(
  actionType: string,
  nodeId?: string
): Promise<ViewSyncResult> {
  return getArtifactViewMapper().syncActionToView(actionType, nodeId)
}

/**
 * 전역 콜백 초기화 (페이지 마운트 시 호출)
 */
export function initializeViewSyncCallbacks(): void {
  getArtifactViewMapper().setupGlobalCallbacks()
}

/**
 * 전역 콜백 정리 (페이지 언마운트 시 호출)
 */
export function cleanupViewSyncCallbacks(): void {
  getArtifactViewMapper().cleanupGlobalCallbacks()
}
