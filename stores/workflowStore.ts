/**
 * Workflow Builder Store
 *
 * Jarvis가 워크플로우 빌더를 제어할 수 있도록 전역 상태 노출
 */

import { create } from 'zustand'
import { Node, Edge } from 'reactflow'
import type { NodeData } from '@/lib/workflow'
import { createNode } from '@/lib/workflow'

export interface WorkflowState {
  // 상태
  nodes: Node<NodeData>[]
  edges: Edge[]
  selectedNodeId: string | null
  isExecuting: boolean

  // 액션
  setNodes: (nodes: Node<NodeData>[]) => void
  setEdges: (edges: Edge[]) => void

  // 노드 조작
  addNode: (type: string, position?: { x: number; y: number }, config?: Partial<NodeData>) => string
  removeNode: (nodeId: string) => void
  updateNode: (nodeId: string, data: Partial<NodeData>) => void
  selectNode: (nodeId: string | null) => void

  // 엣지(연결) 조작
  connectNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void
  disconnectNodes: (sourceId: string, targetId: string) => void

  // 유틸리티
  getNode: (nodeId: string) => Node<NodeData> | undefined
  getNodesByType: (type: string) => Node<NodeData>[]
  clearAll: () => void

  // 실행
  setIsExecuting: (executing: boolean) => void
}

// 기본 위치 계산 (기존 노드들 기준)
function calculateNextPosition(nodes: Node<NodeData>[]): { x: number; y: number } {
  if (nodes.length === 0) {
    return { x: 300, y: 100 }
  }

  // 가장 아래에 있는 노드 찾기
  const maxY = Math.max(...nodes.map(n => n.position.y))
  const nodesAtMaxY = nodes.filter(n => n.position.y === maxY)
  const avgX = nodesAtMaxY.reduce((sum, n) => sum + n.position.x, 0) / nodesAtMaxY.length

  return { x: avgX, y: maxY + 150 }
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // 초기 상태
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isExecuting: false,

  // 기본 setter
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  // 노드 추가
  addNode: (type, position, config) => {
    const { nodes } = get()
    const pos = position || calculateNextPosition(nodes)

    const newNode = createNode({
      type,
      position: pos,
      data: config,
    })

    set({ nodes: [...nodes, newNode] })
    return newNode.id
  },

  // 노드 삭제
  removeNode: (nodeId) => {
    const { nodes, edges } = get()
    set({
      nodes: nodes.filter(n => n.id !== nodeId),
      edges: edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    })
  },

  // 노드 업데이트
  updateNode: (nodeId, data) => {
    const { nodes } = get()
    set({
      nodes: nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...data } }
          : n
      ),
    })
  },

  // 노드 선택
  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId })
  },

  // 노드 연결
  connectNodes: (sourceId, targetId, sourceHandle = 'output', targetHandle = 'input') => {
    const { edges, nodes } = get()

    // 노드 존재 확인
    const sourceNode = nodes.find(n => n.id === sourceId)
    const targetNode = nodes.find(n => n.id === targetId)
    if (!sourceNode || !targetNode) return

    // 이미 연결되어 있는지 확인
    const exists = edges.some(e =>
      e.source === sourceId &&
      e.target === targetId &&
      e.sourceHandle === sourceHandle &&
      e.targetHandle === targetHandle
    )
    if (exists) return

    const newEdge: Edge = {
      id: `e-${sourceId}-${targetId}-${Date.now()}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#52525b' },
    }

    set({ edges: [...edges, newEdge] })
  },

  // 노드 연결 해제
  disconnectNodes: (sourceId, targetId) => {
    const { edges } = get()
    set({
      edges: edges.filter(e => !(e.source === sourceId && e.target === targetId)),
    })
  },

  // 노드 조회
  getNode: (nodeId) => {
    return get().nodes.find(n => n.id === nodeId)
  },

  // 타입별 노드 조회
  getNodesByType: (type) => {
    return get().nodes.filter(n => n.type === type)
  },

  // 전체 삭제
  clearAll: () => {
    set({ nodes: [], edges: [], selectedNodeId: null })
  },

  // 실행 상태
  setIsExecuting: (executing) => {
    set({ isExecuting: executing })
  },
}))

// 전역 접근용 (Jarvis Control API에서 사용)
if (typeof window !== 'undefined') {
  (window as any).__workflowStore = useWorkflowStore
}
