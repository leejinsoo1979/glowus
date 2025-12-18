'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import type { Node, Edge } from 'reactflow'
import type { AgentNodeData, AgentType } from '@/lib/agent'
import { createAgentNode, validateAgent, exportAgentToJson, AGENT_TEMPLATES } from '@/lib/agent'
import { createClient } from '@/lib/supabase/client'
import { McpRealtimeBridge, getOrCreateSessionId, type McpMessage } from '@/lib/mcp/realtime-bridge'

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

/**
 * MCP Realtime Bridge Hook
 * Supabase Realtime을 사용하여 Agent Builder와 MCP Server를 연결합니다.
 * Vercel 배포 환경에서도 작동합니다.
 */
export function useMcpRealtimeBridge({
  nodes,
  edges,
  setNodes,
  setEdges,
  fitView,
  onLog,
}: McpBridgeOptions) {
  const bridgeRef = useRef<McpRealtimeBridge | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
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
    console.log(`[MCP Realtime] ${message}`)
    onLog?.(message)
  }, [onLog])

  // Supabase 클라이언트
  const supabase = useMemo(() => createClient(), [])

  /**
   * 자동 위치 계산
   */
  const calculateAutoPosition = useCallback(() => {
    const currentNodes = nodesRef.current
    if (currentNodes.length === 0) {
      return { x: 100, y: 200 }
    }

    const maxX = Math.max(...currentNodes.map((n) => n.position.x))
    const avgY =
      currentNodes.reduce((sum, n) => sum + n.position.y, 0) / currentNodes.length

    return { x: maxX + 200, y: avgY }
  }, [])

  /**
   * 캔버스 상태 전송
   */
  const sendCanvasState = useCallback(() => {
    if (bridgeRef.current?.connected) {
      bridgeRef.current.sendCanvasState(nodesRef.current, edgesRef.current)
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

          const autoPosition = position || calculateAutoPosition()

          const newNode = createAgentNode({
            type,
            position: autoPosition,
          })

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

          setTimeout(sendCanvasState, 100)
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

          setTimeout(sendCanvasState, 100)
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

          setTimeout(sendCanvasState, 100)
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

          setTimeout(sendCanvasState, 100)
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

          setTimeout(sendCanvasState, 100)
          break
        }

        case 'clear_canvas': {
          setNodes([])
          setEdges([])

          result = {
            success: true,
            message: '캔버스가 초기화되었습니다.',
          }

          setTimeout(sendCanvasState, 100)
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

          setTimeout(sendCanvasState, 100)
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
    if (bridgeRef.current?.connected) {
      bridgeRef.current.sendResponse(requestId, result)
    }
  }, [setNodes, setEdges, fitView, log, calculateAutoPosition, sendCanvasState])

  /**
   * 메시지 핸들러
   */
  const handleMessage = useCallback((msg: McpMessage) => {
    switch (msg.type) {
      case 'mcp-command':
        handleMcpCommand({
          requestId: msg.requestId!,
          command: msg.command!,
          params: msg.params || {},
        })
        break

      case 'mcp-connect':
        log('MCP 서버가 연결되었습니다')
        // MCP 서버에 현재 캔버스 상태 전송
        sendCanvasState()
        break
    }
  }, [handleMcpCommand, log, sendCanvasState])

  /**
   * 연결 관리
   */
  useEffect(() => {
    mountedRef.current = true
    const sid = getOrCreateSessionId()
    setSessionId(sid)

    const bridge = new McpRealtimeBridge({
      supabase,
      sessionId: sid,
      clientType: 'frontend',
      onMessage: handleMessage,
      onConnect: () => {
        if (mountedRef.current) {
          log(`연결됨 (세션: ${sid})`)
          setIsConnected(true)
          sendCanvasState()
        }
      },
      onDisconnect: () => {
        if (mountedRef.current) {
          log('연결 해제됨')
          setIsConnected(false)
        }
      },
      onError: (error) => {
        console.error('[MCP Realtime] Error:', error)
      },
    })

    bridgeRef.current = bridge
    bridge.connect()

    return () => {
      mountedRef.current = false
      bridge.disconnect()
      bridgeRef.current = null
    }
  }, [supabase, handleMessage, log, sendCanvasState])

  /**
   * 노드/엣지 변경 시 상태 동기화 (debounce)
   */
  const sendCanvasStateDebounced = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (sendCanvasStateDebounced.current) {
      clearTimeout(sendCanvasStateDebounced.current)
    }
    sendCanvasStateDebounced.current = setTimeout(() => {
      sendCanvasState()
    }, 500)

    return () => {
      if (sendCanvasStateDebounced.current) {
        clearTimeout(sendCanvasStateDebounced.current)
      }
    }
  }, [nodes, edges, sendCanvasState])

  /**
   * 수동 재연결
   */
  const reconnect = useCallback(() => {
    log('수동 재연결 시도...')
    if (bridgeRef.current) {
      bridgeRef.current.reconnect()
    }
  }, [log])

  /**
   * 연결 상태 주기적 확인
   */
  useEffect(() => {
    const checkConnection = setInterval(() => {
      if (bridgeRef.current && !bridgeRef.current.connected && mountedRef.current) {
        log('연결 상태 확인: 끊어짐 감지, 재연결 시도...')
        setIsConnected(false)
        bridgeRef.current.reconnect()
      }
    }, 10000) // 10초마다 확인

    return () => clearInterval(checkConnection)
  }, [log])

  return {
    isConnected,
    sessionId,
    sendCanvasState,
    reconnect,
  }
}
