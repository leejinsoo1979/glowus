'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Node, Edge } from 'reactflow'
import type { AgentNodeData, AgentType } from '@/lib/agent'
import { createAgentNode, validateAgent, exportAgentToJson, AGENT_TEMPLATES } from '@/lib/agent'

interface McpBridgeOptions {
  nodes: Node<AgentNodeData>[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node<AgentNodeData>[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  fitView?: () => void
  onLog?: (message: string) => void
}

interface McpCommand {
  requestId: number
  command: string
  params: Record<string, unknown>
}

const WS_URL = 'ws://localhost:3001'

// 모듈 레벨 변수 (React re-render에 영향 안 받음)
let globalReconnectAttempts = 0
let globalReconnectTimer: NodeJS.Timeout | null = null
let globalIsConnecting = false  // 연결 중복 방지
let globalWs: WebSocket | null = null  // 전역 WebSocket 인스턴스
const MAX_RECONNECT_ATTEMPTS = 3

/**
 * MCP Bridge Hook
 * Agent Builder와 MCP Server를 WebSocket으로 연결합니다.
 */
export function useMcpBridge({
  nodes,
  edges,
  setNodes,
  setEdges,
  fitView,
  onLog,
}: McpBridgeOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const mountedRef = useRef(true)

  // 노드/엣지 상태 ref (콜백에서 최신 상태 접근용)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)

  useEffect(() => {
    nodesRef.current = nodes
    edgesRef.current = edges
  }, [nodes, edges])

  const log = useCallback((message: string) => {
    if (!mountedRef.current) return
    console.log(`[MCP Bridge] ${message}`)
    onLog?.(message)
  }, [onLog])

  /**
   * 메시지 핸들러
   */
  const handleMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    switch (msg.type) {
      case 'mcp-command':
        handleMcpCommand(msg as unknown as McpCommand)
        break
    }
  }, [])

  /**
   * MCP 명령 처리
   */
  const handleMcpCommand = useCallback((cmd: McpCommand) => {
    const { requestId, command, params } = cmd
    log(`Received command: ${command}`)

    let result: unknown

    try {
      switch (command) {
        case 'create_node': {
          const { type, label, position, config } = params as {
            type: AgentType
            label?: string
            position?: { x: number; y: number }
            config?: Record<string, unknown>
          }

          // 자동 위치 계산 (기존 노드들 기준)
          const autoPosition = position || calculateAutoPosition()

          const newNode = createAgentNode({
            type,
            position: autoPosition,
          })

          // 라벨과 설정 적용
          if (label) {
            newNode.data.label = label
          }
          if (config) {
            Object.assign(newNode.data, config)
          }

          setNodes((nds) => [...nds, newNode])

          result = {
            success: true,
            nodeId: newNode.id,
            message: `노드 "${newNode.data.label}" (${type})가 생성되었습니다.`,
          }

          // 상태 변경 알림
          sendCanvasState()
          break
        }

        case 'update_node': {
          const { nodeId, label, config } = params as {
            nodeId: string
            label?: string
            config?: Record<string, unknown>
          }

          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === nodeId) {
                const updatedData = { ...node.data }
                if (label) updatedData.label = label
                if (config) Object.assign(updatedData, config)
                return { ...node, data: updatedData }
              }
              return node
            })
          )

          result = {
            success: true,
            message: `노드 "${nodeId}"가 수정되었습니다.`,
          }

          sendCanvasState()
          break
        }

        case 'delete_node': {
          const { nodeId } = params as { nodeId: string }

          setNodes((nds) => nds.filter((n) => n.id !== nodeId))
          setEdges((eds) =>
            eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
          )

          result = {
            success: true,
            message: `노드 "${nodeId}"가 삭제되었습니다.`,
          }

          sendCanvasState()
          break
        }

        case 'connect_nodes': {
          const { sourceId, targetId, sourceHandle, targetHandle } = params as {
            sourceId: string
            targetId: string
            sourceHandle?: string
            targetHandle?: string
          }

          const edgeId = `e-${sourceId}-${targetId}-${Date.now()}`
          const newEdge: Edge = {
            id: edgeId,
            source: sourceId,
            target: targetId,
            sourceHandle: sourceHandle || undefined,
            targetHandle: targetHandle || undefined,
            type: 'default',
            animated: false,
            style: { stroke: 'var(--edge-color)', strokeWidth: 1.5 },
          }

          setEdges((eds) => [...eds, newEdge])

          result = {
            success: true,
            edgeId,
            message: `노드 "${sourceId}"와 "${targetId}"가 연결되었습니다.`,
          }

          sendCanvasState()
          break
        }

        case 'disconnect_nodes': {
          const { sourceId, targetId } = params as {
            sourceId: string
            targetId: string
          }

          setEdges((eds) =>
            eds.filter((e) => !(e.source === sourceId && e.target === targetId))
          )

          result = {
            success: true,
            message: `노드 "${sourceId}"와 "${targetId}"의 연결이 해제되었습니다.`,
          }

          sendCanvasState()
          break
        }

        case 'clear_canvas': {
          setNodes([])
          setEdges([])

          result = {
            success: true,
            message: '캔버스가 초기화되었습니다.',
          }

          sendCanvasState()
          break
        }

        case 'load_template': {
          const { templateId } = params as { templateId: string }
          const template = AGENT_TEMPLATES.find((t) => t.id === templateId)

          if (template) {
            setNodes(template.nodes as Node<AgentNodeData>[])
            setEdges(template.edges as Edge[])
            fitView?.()

            result = {
              success: true,
              message: `템플릿 "${template.nameKo}"가 로드되었습니다.`,
              nodeCount: template.nodes.length,
              edgeCount: template.edges.length,
            }
          } else {
            result = {
              success: false,
              error: `템플릿 "${templateId}"를 찾을 수 없습니다.`,
            }
          }

          sendCanvasState()
          break
        }

        case 'validate_agent': {
          const validation = validateAgent(
            nodesRef.current as Node<AgentNodeData>[],
            edgesRef.current
          )

          result = {
            valid: validation.valid,
            errors: validation.errors,
            message: validation.valid
              ? '에이전트 설정이 유효합니다.'
              : `검증 실패: ${validation.errors.join(', ')}`,
          }
          break
        }

        case 'export_agent': {
          const { name } = params as { name?: string }
          const json = exportAgentToJson(
            nodesRef.current as Node<AgentNodeData>[],
            edgesRef.current,
            { name: name || 'My Agent' }
          )

          result = {
            success: true,
            json,
            message: '에이전트가 JSON으로 내보내졌습니다.',
          }
          break
        }

        default:
          result = {
            success: false,
            error: `알 수 없는 명령: ${command}`,
          }
      }
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // 응답 전송
    sendResponse(requestId, result)
  }, [setNodes, setEdges, fitView, log])

  /**
   * 자동 위치 계산
   */
  const calculateAutoPosition = useCallback(() => {
    const currentNodes = nodesRef.current
    if (currentNodes.length === 0) {
      return { x: 100, y: 200 }
    }

    // 가장 오른쪽 노드 기준으로 오른쪽에 배치
    const maxX = Math.max(...currentNodes.map((n) => n.position.x))
    const avgY =
      currentNodes.reduce((sum, n) => sum + n.position.y, 0) / currentNodes.length

    return { x: maxX + 200, y: avgY }
  }, [])

  /**
   * 캔버스 상태 전송
   */
  const sendCanvasState = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'canvas-state',
        nodes: nodesRef.current,
        edges: edgesRef.current,
      }))
    }
  }, [])

  /**
   * MCP 응답 전송
   */
  const sendResponse = useCallback((requestId: number, result: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mcp-response',
        requestId,
        result,
      }))
    }
  }, [])

  /**
   * 노드/엣지 변경 시 상태 동기화 (debounce 적용)
   */
  const sendCanvasStateDebounced = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // MCP 명령으로 인한 변경은 이미 sendCanvasState를 호출하므로 스킵
    // 사용자 직접 조작에 의한 변경만 동기화 (debounce로 과도한 전송 방지)
    if (sendCanvasStateDebounced.current) {
      clearTimeout(sendCanvasStateDebounced.current)
    }
    sendCanvasStateDebounced.current = setTimeout(() => {
      sendCanvasState()
    }, 500) // 500ms debounce

    return () => {
      if (sendCanvasStateDebounced.current) {
        clearTimeout(sendCanvasStateDebounced.current)
      }
    }
  }, [nodes, edges, sendCanvasState])

  /**
   * WebSocket 연결
   */
  const connect = useCallback(() => {
    if (!mountedRef.current) return

    // 이미 연결된 전역 WebSocket이 있으면 재사용
    if (globalWs?.readyState === WebSocket.OPEN) {
      wsRef.current = globalWs
      setIsConnected(true)
      return
    }

    // 이미 연결 중이면 스킵
    if (globalIsConnecting) {
      return
    }

    if (globalReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log(`최대 재연결 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달. 터미널 서버 실행 필요: node server/terminal-server.js`)
      return
    }

    try {
      globalIsConnecting = true
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        globalIsConnecting = false
        if (!mountedRef.current) {
          ws.close()
          globalWs = null
          return
        }
        log('WebSocket connected')
        globalReconnectAttempts = 0 // 연결 성공 시 재시도 횟수 초기화
        globalWs = ws
        wsRef.current = ws
        setIsConnected(true)
        // 프론트엔드 클라이언트로 등록
        ws.send(JSON.stringify({ type: 'frontend-connect' }))
        // 초기 상태 전송
        sendCanvasState()
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(event.data)
          handleMessage(msg)
        } catch (e) {
          console.error('[MCP Bridge] Failed to parse message:', e)
        }
      }

      ws.onclose = () => {
        globalIsConnecting = false
        globalWs = null
        if (!mountedRef.current) return
        log('WebSocket disconnected')
        setIsConnected(false)
        wsRef.current = null
        scheduleReconnect()
      }

      ws.onerror = (err) => {
        globalIsConnecting = false
        if (!mountedRef.current) return
        console.error('[MCP Bridge] WebSocket error:', err)
      }

      wsRef.current = ws
    } catch (e) {
      globalIsConnecting = false
      console.error('[MCP Bridge] Failed to connect:', e)
      scheduleReconnect()
    }
  }, [log, handleMessage, sendCanvasState])

  /**
   * 재연결 스케줄링
   */
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (globalReconnectTimer) return
    if (globalReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log(`최대 재연결 횟수(${MAX_RECONNECT_ATTEMPTS})에 도달`)
      return
    }

    globalReconnectAttempts++
    log(`재연결 시도 ${globalReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`)

    globalReconnectTimer = setTimeout(() => {
      globalReconnectTimer = null
      if (mountedRef.current) {
        connect()
      }
    }, 3000)
  }, [log, connect])

  /**
   * 연결 관리
   */
  useEffect(() => {
    mountedRef.current = true

    // 이미 연결된 WebSocket이 있으면 재사용
    if (globalWs?.readyState === WebSocket.OPEN) {
      wsRef.current = globalWs
      setIsConnected(true)
    } else {
      // 새 연결 시도
      connect()
    }

    return () => {
      mountedRef.current = false
      // 재연결 타이머만 정리 (WebSocket은 전역으로 유지)
      if (globalReconnectTimer) {
        clearTimeout(globalReconnectTimer)
        globalReconnectTimer = null
      }
      wsRef.current = null
      // 전역 WebSocket은 닫지 않음 (다른 인스턴스가 사용할 수 있음)
    }
  }, [connect])

  return {
    isConnected,
    sendCanvasState,
  }
}
