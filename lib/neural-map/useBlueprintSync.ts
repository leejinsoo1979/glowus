'use client'

/**
 * useBlueprintSync Hook
 *
 * Blueprint(설계도) ↔ Agent 실시간 동기화
 * - Blueprint 조회
 * - 상태 업데이트
 * - 진행률 추적
 * - Git 연동
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNeuralMapStore } from './store'
import type {
  BlueprintNode,
  BlueprintStatus,
  BlueprintProgress,
} from './blueprint-sync'
import type { AgentPlan } from './types'

interface BlueprintSyncState {
  nodes: BlueprintNode[]
  plan: AgentPlan | null
  progress: BlueprintProgress | null
  isLoading: boolean
  error: string | null
}

interface UseBlueprintSyncReturn extends BlueprintSyncState {
  // 조회
  fetchBlueprint: () => Promise<void>

  // 상태 업데이트
  updateNodeStatus: (
    nodeId: string,
    status: BlueprintStatus,
    gitCommit?: string
  ) => Promise<void>

  // Blueprint 생성
  createFromPlan: (plan: AgentPlan) => Promise<void>

  // 다음 실행할 노드 가져오기
  getNextNode: () => BlueprintNode | null

  // 현재 진행 중인 노드
  getCurrentNode: () => BlueprintNode | null

  // 실시간 구독
  subscribeToUpdates: () => () => void
}

export function useBlueprintSync(): UseBlueprintSyncReturn {
  const mapId = useNeuralMapStore((s) => s.mapId)

  const [state, setState] = useState<BlueprintSyncState>({
    nodes: [],
    plan: null,
    progress: null,
    isLoading: false,
    error: null,
  })

  // 이벤트 소스 ref
  const eventSourceRef = useRef<EventSource | null>(null)

  // Blueprint 조회
  const fetchBlueprint = useCallback(async () => {
    if (!mapId) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`/api/neural-map/${mapId}/blueprint`)

      if (!response.ok) {
        throw new Error('Failed to fetch blueprint')
      }

      const data = await response.json()

      setState({
        nodes: data.nodes || [],
        plan: data.plan || null,
        progress: data.progress || null,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }, [mapId])

  // 노드 상태 업데이트
  const updateNodeStatus = useCallback(async (
    nodeId: string,
    status: BlueprintStatus,
    gitCommit?: string
  ) => {
    if (!mapId) return

    try {
      const response = await fetch(`/api/neural-map/${mapId}/blueprint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, status, gitCommit }),
      })

      if (!response.ok) {
        throw new Error('Failed to update node status')
      }

      const data = await response.json()

      // 로컬 상태 업데이트
      setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === nodeId ? { ...n, status, gitCommit } : n
        ),
        progress: data.progress || prev.progress,
      }))

      // 전역 이벤트 발생 (Dashboard, GitHub 연동용)
      window.dispatchEvent(new CustomEvent('blueprint-updated', {
        detail: { nodeId, status, progress: data.progress }
      }))
    } catch (error) {
      console.error('Failed to update node status:', error)
    }
  }, [mapId])

  // Plan에서 Blueprint 생성
  const createFromPlan = useCallback(async (plan: AgentPlan) => {
    if (!mapId) return

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const response = await fetch(`/api/neural-map/${mapId}/blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (!response.ok) {
        throw new Error('Failed to create blueprint')
      }

      const data = await response.json()

      setState(prev => ({
        ...prev,
        nodes: data.nodes || [],
        progress: data.progress || null,
        isLoading: false,
      }))

      // Blueprint 생성 완료 이벤트
      window.dispatchEvent(new CustomEvent('blueprint-created', {
        detail: { nodes: data.nodes, progress: data.progress }
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }, [mapId])

  // 다음 실행할 노드 가져오기
  const getNextNode = useCallback((): BlueprintNode | null => {
    const { nodes } = state

    // 진행 중인 노드가 있으면 그것 반환
    const doingNode = nodes.find(n => n.status === 'doing')
    if (doingNode) return doingNode

    // 없으면 첫 번째 todo 노드
    const todoNodes = nodes
      .filter(n => n.status === 'todo')
      .sort((a, b) => a.position - b.position)

    return todoNodes[0] || null
  }, [state])

  // 현재 진행 중인 노드
  const getCurrentNode = useCallback((): BlueprintNode | null => {
    return state.nodes.find(n => n.status === 'doing') || null
  }, [state])

  // 실시간 업데이트 구독 (SSE)
  const subscribeToUpdates = useCallback(() => {
    if (!mapId || eventSourceRef.current) {
      return () => {}
    }

    // SSE 연결 (향후 구현)
    // eventSourceRef.current = new EventSource(`/api/neural-map/${mapId}/blueprint/stream`)

    // 현재는 폴링으로 대체
    const intervalId = setInterval(() => {
      fetchBlueprint()
    }, 5000)

    return () => {
      clearInterval(intervalId)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [mapId, fetchBlueprint])

  // 초기 로드
  useEffect(() => {
    if (mapId) {
      fetchBlueprint()
    }
  }, [mapId, fetchBlueprint])

  return {
    ...state,
    fetchBlueprint,
    updateNodeStatus,
    createFromPlan,
    getNextNode,
    getCurrentNode,
    subscribeToUpdates,
  }
}

// Agent가 Blueprint를 읽고 실행하는 헬퍼
export async function executeWithBlueprint(
  mapId: string,
  onTaskStart: (node: BlueprintNode) => Promise<void>,
  onTaskComplete: (node: BlueprintNode, result: { success: boolean; gitCommit?: string }) => Promise<void>
): Promise<void> {
  // Blueprint 조회
  const response = await fetch(`/api/neural-map/${mapId}/blueprint`)
  if (!response.ok) {
    throw new Error('Failed to fetch blueprint')
  }

  const { nodes } = await response.json()

  // 순서대로 실행
  for (const node of nodes.sort((a: BlueprintNode, b: BlueprintNode) => a.position - b.position)) {
    if (node.status === 'done') continue

    // 상태를 "doing"으로 업데이트
    await fetch(`/api/neural-map/${mapId}/blueprint`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId: node.id, status: 'doing' }),
    })

    // task 시작 콜백
    await onTaskStart(node)

    try {
      // task 완료 콜백 (실제 실행)
      await onTaskComplete(node, { success: true })

      // 상태를 "done"으로 업데이트
      await fetch(`/api/neural-map/${mapId}/blueprint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: node.id, status: 'done' }),
      })
    } catch (error) {
      console.error('Task failed:', error)
      // 실패해도 다음으로 진행하지 않음 (중단)
      break
    }
  }
}
