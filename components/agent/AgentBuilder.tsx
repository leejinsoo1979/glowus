"use client"

import { useCallback, useState, useRef, useEffect } from "react"
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow"
import "reactflow/dist/style.css"
import { useTheme } from "next-themes"
import {
  Save,
  Upload,
  Play,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  FileJson,
  Copy,
  Moon,
  Sun,
  Hammer,
  Terminal,
  ArrowRight,
  Rocket,
  Bot,
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { useNeuralMapStore } from "@/lib/neural-map/store"
import { AgentNodeLibrary } from "./AgentNodeLibrary"
import { AgentConfigPanel } from "./AgentConfigPanel"
import { ExecutionPanel } from "./ExecutionPanel"
import { InputNode, OutputNode, MemoryNode, RouterNode, ToolNode, LLMNode, ChainNode, EvaluatorNode, FunctionNode, RAGNode } from "./nodes"
import { ImageGenerationNode } from "./nodes/ImageGenerationNode"
import { JavaScriptNode } from "./nodes/JavaScriptNode"
import { EmbeddingNode } from "./nodes/EmbeddingNode"
import { CustomToolNode } from "./nodes/CustomToolNode"
import { StartNode } from "./nodes/StartNode"
import { EndNode } from "./nodes/EndNode"
import { PromptNode } from "./nodes/PromptNode"
import { ActivepiecesNode } from "./nodes/ActivepiecesNode"
import {
  createAgentNode,
  validateAgent,
  exportAgentToJson,
  importAgentFromJson,
  AGENT_TEMPLATES,
} from "@/lib/agent"
import { AVAILABLE_MODELS, PROVIDER_INFO, LLMProvider, getDefaultModel } from "@/lib/llm/models"
import type { AgentNodeData, AgentType } from "@/lib/agent"
import { TerminalPanel, TerminalPanelRef } from "@/components/editor"
import { useMcpRealtimeBridge } from "@/hooks/useMcpRealtimeBridge"
import { useMcpBridge } from "@/hooks/useMcpBridge"
import { Logo } from "@/components/ui"
import { Clipboard, Check, Wifi, WifiOff, X } from "lucide-react"

const nodeTypes: NodeTypes = {
  llm: LLMNode,
  router: RouterNode,
  memory: MemoryNode,
  tool: ToolNode,
  rag: RAGNode,
  input: InputNode,
  output: OutputNode,
  chain: ChainNode,
  evaluator: EvaluatorNode,
  function: FunctionNode,
  start: StartNode,
  prompt: PromptNode,
  end: EndNode,
  image_generation: ImageGenerationNode,
  javascript: JavaScriptNode,
  embedding: EmbeddingNode,
  custom_tool: CustomToolNode,
  activepieces: ActivepiecesNode,
}

const initialNodes: Node<AgentNodeData>[] = [
  createAgentNode({ type: "input", position: { x: 100, y: 200 } }),
]

const initialEdges: Edge[] = []

interface AgentBuilderInnerProps {
  agentId?: string
}

function AgentBuilderInner({ agentId }: AgentBuilderInnerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // 🆕 Neural Map 프로젝트 연결
  const linkedProjectId = useNeuralMapStore((state) => state.linkedProjectId)
  const projectPath = useNeuralMapStore((state) => state.projectPath)  // 🆕 프로젝트 경로
  const activeTerminalId = useNeuralMapStore((state) => state.activeTerminalId) // 터미널 ID
  const setStoreAgentFolder = useNeuralMapStore((state) => state.setCurrentAgentFolder)
  const storeAgentFolder = useNeuralMapStore((state) => state.currentAgentFolder)

  // 🔍 DEBUG: Store 값 모니터링
  useEffect(() => {
    console.log('[AgentBuilder] 🔍 Store values:', {
      storeAgentFolder,
      projectPath,
      linkedProjectId
    })
  }, [storeAgentFolder, projectPath, linkedProjectId])

  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(null)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: string[]
  } | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(200)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showExecutionPanel, setShowExecutionPanel] = useState(false)
  const [agentName, setAgentName] = useState<string>("")
  // 새 에이전트 생성 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)
  // 배포 모달 상태
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployAgentName, setDeployAgentName] = useState("")
  const [deployAgentDescription, setDeployAgentDescription] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)
  // 상호작용 설정
  const [deployInteractionMode, setDeployInteractionMode] = useState<'solo' | 'sequential' | 'debate' | 'collaborate' | 'supervisor'>('solo')
  const [deployLlmProvider, setDeployLlmProvider] = useState<LLMProvider>('grok')
  const [deployLlmModel, setDeployLlmModel] = useState('grok-4-0709-fast')
  const [deploySpeakOrder, setDeploySpeakOrder] = useState(0)
  // 편집 모드 상태
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [isLoadingAgent, setIsLoadingAgent] = useState(false)
  const terminalRef = useRef<TerminalPanelRef>(null)
  // 최신 값을 참조하기 위한 refs (useCallback 내에서 사용)
  const activeTerminalIdRef = useRef(activeTerminalId)
  activeTerminalIdRef.current = activeTerminalId
  // 🆕 현재 편집 중인 에이전트 폴더 정보 (파일 생성용)
  const [currentAgentFolder, setCurrentAgentFolder] = useState<string | null>(null)
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null)
  // 에이전트 목록 새로고침 트리거
  const [agentListRefresh, setAgentListRefresh] = useState(0)
  const { project, fitView, zoomIn, zoomOut } = useReactFlow()

  // MCP 로그 콜백 (memoized - 재연결 방지)
  const handleMcpLog = useCallback((message: string) => {
    console.log('[MCP]', message)
    if (terminalRef.current) {
      terminalRef.current.write(`\r\n\x1b[35m[MCP]\x1b[0m ${message}`)
    }
  }, [])
  const { theme, setTheme } = useTheme()

  // 에이전트 ID가 있으면 에이전트 데이터 로드
  useEffect(() => {
    if (agentId) {
      setIsLoadingAgent(true)
      fetch(`/api/agents/${agentId}`)
        .then(res => res.json())
        .then(data => {
          if (data && !data.error) {
            setEditingAgentId(agentId)
            setAgentName(data.name || '')
            setDeployAgentName(data.name || '')
            setDeployAgentDescription(data.description || '')
            // LLM 제공자/모델 로드
            if (data.llm_provider) {
              setDeployLlmProvider(data.llm_provider as LLMProvider)
            }
            if (data.model) {
              setDeployLlmModel(data.model)
            }
            if (data.interaction_mode) {
              setDeployInteractionMode(data.interaction_mode)
            }
            if (data.speak_order !== undefined) {
              setDeploySpeakOrder(data.speak_order)
            }

            // 워크플로우 노드와 엣지 로드 (position 검증)
            if (data.workflow_nodes && data.workflow_nodes.length > 0) {
              // 노드에 position이 없으면 기본값 추가
              const validatedNodes = data.workflow_nodes.map((node: any, index: number) => ({
                ...node,
                position: node.position && typeof node.position.x === 'number'
                  ? node.position
                  : { x: 100 + (index * 200), y: 100 + (index * 100) }
              }))
              setNodes(validatedNodes)
            }
            if (data.workflow_edges && data.workflow_edges.length > 0) {
              setEdges(data.workflow_edges)
            }

            // 화면에 맞춤
            setTimeout(() => fitView({ padding: 0.2 }), 100)
          }
        })
        .catch(err => {
          console.error('에이전트 로드 실패:', err)
        })
        .finally(() => {
          setIsLoadingAgent(false)
        })
    }
  }, [agentId, setNodes, setEdges, fitView])

  // MCP Bridge - Claude Code에서 노드 조작 가능하게 함 (Supabase Realtime 사용)
  const { isConnected: isMcpConnected, isMcpServerConnected, sessionId: mcpSessionId } = useMcpRealtimeBridge({
    nodes,
    edges,
    setNodes,
    setEdges,
    fitView,
    onLog: handleMcpLog,
  })

  // 🔥 WebSocket MCP Bridge - 로컬 터미널에서 Claude Code가 노드 제어 가능하게 함
  const { isConnected: isWsMcpConnected } = useMcpBridge({
    nodes,
    edges,
    setNodes,
    setEdges,
    fitView,
    onLog: handleMcpLog,
  })

  // MCP 연결 알림 토스트
  const [mcpToast, setMcpToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' } | null>(null)
  const prevMcpServerConnected = useRef(isMcpServerConnected)

  useEffect(() => {
    if (isMcpServerConnected && !prevMcpServerConnected.current) {
      // MCP Server 연결됨
      setMcpToast({ show: true, message: 'Claude Code MCP 연결 성공!', type: 'success' })
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[42m\x1b[30m ✓ MCP 연결 성공 \x1b[0m Claude Code가 Agent Builder에 연결되었습니다.`)
      }
      setTimeout(() => setMcpToast(null), 4000)
    } else if (!isMcpServerConnected && prevMcpServerConnected.current) {
      // MCP Server 연결 해제됨
      setMcpToast({ show: true, message: 'Claude Code MCP 연결 해제됨', type: 'info' })
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[43m\x1b[30m ⚠ MCP 연결 해제 \x1b[0m Claude Code 연결이 종료되었습니다.`)
      }
      setTimeout(() => setMcpToast(null), 3000)
    }
    prevMcpServerConnected.current = isMcpServerConnected
  }, [isMcpServerConnected])

  // 세션 ID 복사 상태
  const [sessionIdCopied, setSessionIdCopied] = useState(false)

  const handleCopySessionId = useCallback(() => {
    if (mcpSessionId) {
      navigator.clipboard.writeText(mcpSessionId)
      setSessionIdCopied(true)
      setTimeout(() => setSessionIdCopied(false), 2000)
    }
  }, [mcpSessionId])

  // History for undo/redo
  const [history, setHistory] = useState<{ nodes: Node<AgentNodeData>[]; edges: Edge[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Save to history on changes
  useEffect(() => {
    const newHistoryItem = { nodes: [...nodes], edges: [...edges] }
    if (historyIndex === -1 || JSON.stringify(history[historyIndex]) !== JSON.stringify(newHistoryItem)) {
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(newHistoryItem)
      if (newHistory.length > 50) newHistory.shift()
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // 에이전트 폴더 로드 핸들러 (BroadcastChannel useEffect보다 먼저 정의)
  const handleLoadAgent = useCallback(async (folderName: string, projectPathParam?: string, selectFile?: string) => {
    console.log('[AgentBuilder] handleLoadAgent called:', { folderName, projectPathParam, selectFile })
    setIsLoadingAgent(true)
    try {
      // projectPath가 있으면 API에 전달
      const pathParam = projectPathParam ? `&projectPath=${encodeURIComponent(projectPathParam)}` : ''
      const response = await fetch(`/api/agents/load-folder?folder=${encodeURIComponent(folderName)}${pathParam}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '에이전트 로드 실패')
      }

      const data = await response.json()
      console.log('[AgentBuilder] Agent loaded:', data, 'selectFile:', selectFile)

      // 클릭한 파일에 해당하는 노드 ID 찾기
      let selectedNodeId: string | null = null
      if (selectFile) {
        const matchingNode = (data.nodes || []).find((n: any) => n.file === selectFile)
        if (matchingNode) {
          selectedNodeId = matchingNode.id
          console.log('[AgentBuilder] Found matching node for file:', selectFile, '→', selectedNodeId)
        }
      }

      // API 노드 형식을 ReactFlow 형식으로 변환 (선택 상태 포함)
      const reactFlowNodes = (data.nodes || []).map((node: any) => ({
        id: node.id,
        type: node.type,
        position: node.position || { x: 0, y: 0 },
        selected: node.id === selectedNodeId, // 클릭한 파일의 노드 선택
        data: {
          label: node.config?.label || node.type,
          file: node.file, // 파일명 저장 (동기화용)
          ...node.config,
        },
      }))

      // API 엣지 형식을 ReactFlow 형식으로 변환
      const reactFlowEdges = (data.edges || []).map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'default',
        animated: edge.animated || false,
      }))

      // 캔버스에 노드/엣지 설정
      setAgentName(data.name || folderName)
      setNodes(reactFlowNodes)
      setEdges(reactFlowEdges)
      setEditingAgentId(null)
      // 🆕 현재 에이전트 폴더 정보 저장 (노드 추가 시 파일 생성용)
      setCurrentAgentFolder(folderName)
      setCurrentProjectPath(projectPathParam || null)
      // store에도 저장 (persist됨)
      setStoreAgentFolder(folderName)

      // 🆕 에이전트 로드 시 무조건 터미널에 cd 명령 전송
      if (projectPathParam) {
        const agentPath = `${projectPathParam}/agents/${folderName}`
        const electronApi = (window as any).electron?.terminal
        if (electronApi) {
          // 1.5초 후 cd 명령 전송 (터미널 초기화 대기)
          setTimeout(() => {
            const terminalId = activeTerminalIdRef.current || '1'
            electronApi.write(terminalId, `cd "${agentPath}" && clear\n`)
            console.log('[AgentBuilder] Agent loaded, sent cd to terminal', terminalId, ':', agentPath)
          }, 1500)
        }
      }

      // 선택된 노드가 있으면 해당 노드로 포커스 이동
      if (selectedNodeId) {
        setTimeout(() => {
          const selectedNode = reactFlowNodes.find((n: any) => n.id === selectedNodeId)
          if (selectedNode) {
            fitView({
              nodes: [{ id: selectedNodeId }],
              padding: 0.5,
              duration: 300
            })
          }
        }, 150)
      } else {
        setTimeout(() => fitView({ padding: 0.2 }), 100)
      }

      // 터미널에 알림
      if (terminalRef.current) {
        const selectedInfo = selectedNodeId ? ` [선택: ${selectFile}]` : ''
        terminalRef.current.write(`\r\n\x1b[36m[Agent]\x1b[0m 에이전트 "${data.name || folderName}" 로드됨 (노드: ${reactFlowNodes.length}, 엣지: ${reactFlowEdges.length})${selectedInfo}`)
      }
    } catch (error: any) {
      console.error('[AgentBuilder] Load agent error:', error)
      alert(error.message || '에이전트 로드 중 오류가 발생했습니다')
    } finally {
      setIsLoadingAgent(false)
    }
  }, [setNodes, setEdges, fitView])

  // 🔥 Orchestrator 채팅에서 BroadcastChannel 메시지 수신
  useEffect(() => {
    const channel = new BroadcastChannel('agent-builder')
    const responseChannel = new BroadcastChannel('agent-builder-response')

    channel.onmessage = (event) => {
      const { type, payload } = event.data
      console.log('[AgentBuilder] Received message:', type, payload)

      switch (type) {
        case 'CREATE_NODE': {
          const position = payload.position || { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 }
          const newNode = createAgentNode({
            type: payload.nodeType,
            position,
          })
          // 라벨 설정
          if (payload.label) {
            newNode.data.label = payload.label
          }
          // config 설정
          if (payload.config) {
            newNode.data = { ...newNode.data, ...payload.config }
          }
          setNodes((nds) => [...nds, newNode])
          setTimeout(() => fitView({ padding: 0.2 }), 100)
          break
        }

        case 'CONNECT_NODES': {
          const newEdge: Edge = {
            id: `e-${payload.sourceNodeId}-${payload.targetNodeId}-${Date.now()}`,
            source: payload.sourceNodeId,
            target: payload.targetNodeId,
            sourceHandle: payload.sourceHandle,
            type: 'default',
            animated: false,
            style: { stroke: 'var(--edge-color)', strokeWidth: 1.5 },
            label: payload.label,
          }
          setEdges((eds) => [...eds, newEdge])
          break
        }

        case 'DELETE_NODE': {
          setNodes((nds) => nds.filter((n) => n.id !== payload.nodeId))
          setEdges((eds) => eds.filter((e) => e.source !== payload.nodeId && e.target !== payload.nodeId))
          break
        }

        case 'UPDATE_NODE': {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === payload.nodeId
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      ...(payload.label && { label: payload.label }),
                      ...(payload.config && payload.config),
                    },
                  }
                : node
            )
          )
          break
        }

        case 'GENERATE_WORKFLOW': {
          // 새 워크플로우 생성 - 기존 노드/엣지 교체
          const newNodes = payload.nodes.map((n: any) =>
            createAgentNode({
              type: n.type,
              position: n.position,
            })
          ).map((node: Node, i: number) => {
            // ID 매핑을 위해 원래 ID 유지
            const originalNode = payload.nodes[i]
            return {
              ...node,
              id: originalNode.id,
              data: {
                ...node.data,
                label: originalNode.label,
                ...(originalNode.config || {}),
              },
            }
          })

          const newEdges = payload.edges.map((e: any) => ({
            id: `e-${e.source}-${e.target}-${Date.now()}`,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            type: 'default',
            animated: false,
            style: { stroke: 'var(--edge-color)', strokeWidth: 1.5 },
            label: e.label,
          }))

          setAgentName(payload.name || '')
          setNodes(newNodes)
          setEdges(newEdges)
          setTimeout(() => fitView({ padding: 0.2 }), 100)
          break
        }

        case 'GET_WORKFLOW': {
          // 현재 워크플로우 데이터 응답
          responseChannel.postMessage({
            type: 'WORKFLOW_DATA',
            payload: {
              name: agentName,
              nodes: nodes.map((n) => ({
                id: n.id,
                type: n.type,
                label: n.data.label,
                position: n.position,
                config: payload.includeConfig ? n.data : undefined,
              })),
              edges: edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                label: e.label,
              })),
            },
          })
          break
        }

        case 'DEPLOY': {
          // 배포 모달 열기
          setDeployAgentName(payload.name || agentName || '')
          setDeployAgentDescription(payload.description || '')
          if (payload.llmProvider) {
            setDeployLlmProvider(payload.llmProvider)
          }
          if (payload.llmModel) {
            setDeployLlmModel(payload.llmModel)
          }
          setShowDeployModal(true)
          break
        }

        case 'CLEAR': {
          setAgentName('')
          setNodes([createAgentNode({ type: 'start', position: { x: 250, y: 200 } })])
          setEdges([])
          setEditingAgentId(null)
          setTimeout(() => fitView({ padding: 0.2 }), 100)
          break
        }

        case 'LOAD_AGENT': {
          // 파일 트리에서 에이전트 클릭 시 로드 (projectPath + selectFile 포함)
          if (payload.folderName) {
            handleLoadAgent(payload.folderName, payload.projectPath, payload.selectFile)
          }
          break
        }
      }
    }

    return () => {
      channel.close()
      responseChannel.close()
    }
  }, [setNodes, setEdges, fitView, nodes, edges, agentName, handleLoadAgent])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "default",
            animated: false,
            style: { stroke: "var(--edge-color)", strokeWidth: 1.5 },
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData("application/agentflow") as AgentType
      if (!type || !reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      // 고유 노드 ID 생성
      const nodeId = `n${Date.now()}`
      const label = type.charAt(0).toUpperCase() + type.slice(1)

      // 🆕 에이전트 폴더가 있으면 파일도 생성
      if (currentAgentFolder && currentProjectPath) {
        try {
          const response = await fetch('/api/agents/add-node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folderName: currentAgentFolder,
              projectPath: currentProjectPath,
              nodeType: type,
              nodeId,
              position,
              label
            })
          })

          if (response.ok) {
            const data = await response.json()
            console.log('[AgentBuilder] Node file created:', data.fileName)

            // 파일 정보가 포함된 노드 생성
            const newNode = createAgentNode({ type, position })
            newNode.id = nodeId
            newNode.data = {
              ...newNode.data,
              label,
              file: data.fileName  // 파일명 연결
            }
            setNodes((nds) => [...nds, newNode])

            // 파일트리 리스캔 트리거
            const rescanChannel = new BroadcastChannel('neural-map-rescan')
            rescanChannel.postMessage({ type: 'RESCAN_FILES' })
            rescanChannel.close()

            // 터미널에 알림
            if (terminalRef.current) {
              terminalRef.current.write(`\r\n\x1b[32m[Agent]\x1b[0m 노드 추가됨: ${label} → ${data.fileName}`)
            }
          } else {
            console.error('[AgentBuilder] Failed to create node file')
            // 파일 생성 실패해도 노드는 추가
            const newNode = createAgentNode({ type, position })
            setNodes((nds) => [...nds, newNode])
          }
        } catch (error) {
          console.error('[AgentBuilder] Error creating node:', error)
          const newNode = createAgentNode({ type, position })
          setNodes((nds) => [...nds, newNode])
        }
      } else {
        // 에이전트 폴더 없으면 노드만 추가 (파일 없음)
        const newNode = createAgentNode({ type, position })
        setNodes((nds) => [...nds, newNode])
      }
    },
    [project, setNodes, currentAgentFolder, currentProjectPath]
  )

  // 🆕 노드 삭제 시 파일도 삭제
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      if (!currentAgentFolder || !currentProjectPath) return

      for (const node of deletedNodes) {
        try {
          const response = await fetch('/api/agents/delete-node', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folderName: currentAgentFolder,
              projectPath: currentProjectPath,
              nodeId: node.id
            })
          })

          if (response.ok) {
            const data = await response.json()
            console.log('[AgentBuilder] Node file deleted:', data.deletedFile)

            // 터미널에 알림
            if (terminalRef.current) {
              terminalRef.current.write(`\r\n\x1b[33m[Agent]\x1b[0m 노드 삭제됨: ${node.data?.label || node.id} → ${data.deletedFile}`)
            }
          }
        } catch (error) {
          console.error('[AgentBuilder] Error deleting node file:', error)
        }
      }

      // 파일트리 리스캔 트리거
      const rescanChannel = new BroadcastChannel('neural-map-rescan')
      rescanChannel.postMessage({ type: 'RESCAN_FILES' })
      rescanChannel.close()
    },
    [currentAgentFolder, currentProjectPath]
  )

  const onDragStart = useCallback((event: React.DragEvent, nodeType: AgentType) => {
    event.dataTransfer.setData("application/agentflow", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }, [])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<AgentNodeData>) => {
      setSelectedNode(node)

      // 🔄 파일트리와 동기화 - 노드에 연결된 파일 강조
      const fileName = node.data?.file
      if (fileName) {
        console.log('[AgentBuilder] Node clicked, syncing file:', fileName)
        const channel = new BroadcastChannel('agent-file-sync')
        channel.postMessage({ type: 'SELECT_FILE', payload: { fileName } })
        channel.close()
      }
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<AgentNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...data } }
            : node
        )
      )
      setSelectedNode((prev) =>
        prev?.id === nodeId
          ? { ...prev, data: { ...prev.data, ...data } }
          : prev
      )
    },
    [setNodes]
  )

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId))
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      )
      setSelectedNode(null)
    },
    [setNodes, setEdges]
  )

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setNodes(prevState.nodes)
      setEdges(prevState.edges)
      setHistoryIndex(historyIndex - 1)
    }
  }, [history, historyIndex, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setNodes(nextState.nodes)
      setEdges(nextState.edges)
      setHistoryIndex(historyIndex + 1)
    }
  }, [history, historyIndex, setNodes, setEdges])

  const handleClearCanvas = useCallback(() => {
    if (confirm("모든 노드를 삭제하시겠습니까?")) {
      setNodes([])
      setEdges([])
      setSelectedNode(null)
    }
  }, [setNodes, setEdges])

  const handleValidate = useCallback(() => {
    const result = validateAgent(nodes, edges)
    setValidationResult(result)
    setTimeout(() => setValidationResult(null), 5000)
  }, [nodes, edges])

  const handleSave = useCallback(() => {
    const json = exportAgentToJson(nodes, edges, { name: "My Agent" })
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `agent-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  const handleLoad = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = importAgentFromJson(ev.target?.result as string)
        if (result) {
          setNodes(result.nodes)
          setEdges(result.edges as Edge[])
          fitView()
        } else {
          alert("유효하지 않은 에이전트 파일입니다.")
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [setNodes, setEdges, fitView])

  const handleLoadTemplate = useCallback(
    (templateId: string) => {
      const template = AGENT_TEMPLATES.find((t) => t.id === templateId)
      if (template) {
        setNodes(template.nodes)
        setEdges(template.edges as Edge[])
        fitView()
        setShowTemplates(false)
      }
    },
    [setNodes, setEdges, fitView]
  )

  const handleExecute = useCallback(() => {
    const validation = validateAgent(nodes, edges)
    if (!validation.valid) {
      setValidationResult(validation)
      return
    }

    // Open execution panel instead of simple mock execution
    setShowTerminal(true)
    setShowExecutionPanel(true)
  }, [nodes, edges])

  const handleCopyJson = useCallback(() => {
    const json = exportAgentToJson(nodes, edges, { name: "My Agent" })
    navigator.clipboard.writeText(json)
    alert("JSON이 클립보드에 복사되었습니다!")
  }, [nodes, edges])

  // 새 에이전트 생성 핸들러
  const handleCreateAgent = useCallback(async () => {
    if (!newAgentName.trim()) {
      alert("에이전트 이름을 입력해주세요")
      return
    }

    // 폴더명 = 사용자가 입력한 이름 그대로 사용 (공백만 하이픈으로)
    const folderName = newAgentName.trim().replace(/\s+/g, '-')

    setIsCreatingAgent(true)
    try {
      // agents 폴더에 에이전트 생성 (프로젝트 경로가 있으면 해당 프로젝트 내에 생성)
      const response = await fetch('/api/agents/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          folderName,
          projectPath: projectPath || undefined,  // 프로젝트 경로 전달
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '에이전트 생성 실패')
      }

      const result = await response.json()
      console.log('[AgentBuilder] Agent created:', result)

      // 캔버스 초기화 - Start 노드로 시작
      setAgentName(newAgentName.trim())
      setNodes([createAgentNode({ type: "start", position: { x: 250, y: 200 } })])
      setEdges([])
      setEditingAgentId(null)
      setShowCreateModal(false)
      setNewAgentName("")

      // 🔧 FIX: 노드 배치 시 파일 생성되도록 폴더/경로 설정
      setCurrentAgentFolder(result.folderName || folderName)
      setCurrentProjectPath(result.projectPath || projectPath || null)

      setTimeout(() => fitView({ padding: 0.2 }), 100)

      // 터미널에 알림
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[32m[Agent]\x1b[0m 에이전트 "${newAgentName}" 폴더 생성됨: agents/${folderName}`)
      }

      // 에이전트 목록 새로고침
      setAgentListRefresh(prev => prev + 1)

      // 파일 트리 패널에도 알림 (BroadcastChannel)
      const refreshChannel = new BroadcastChannel('agent-folder-refresh')
      refreshChannel.postMessage({ type: 'REFRESH' })
      refreshChannel.close()

      // 🆕 Neural Map 파일 리스캔 트리거 (파일 트리 업데이트)
      const rescanChannel = new BroadcastChannel('neural-map-rescan')
      rescanChannel.postMessage({ type: 'RESCAN_FILES' })
      rescanChannel.close()
    } catch (error: any) {
      console.error('[AgentBuilder] Create agent error:', error)
      alert(error.message || '에이전트 생성 중 오류가 발생했습니다')
    } finally {
      setIsCreatingAgent(false)
    }
  }, [newAgentName, setNodes, setEdges, fitView])

  // 에이전트 배포/업데이트 핸들러
  const handleDeploy = useCallback(async () => {
    if (!deployAgentName.trim()) {
      alert("에이전트 이름을 입력해주세요")
      return
    }

    // 검증
    const validation = validateAgent(nodes, edges)
    if (!validation.valid) {
      alert(`배포 전 오류를 수정해주세요:\n${validation.errors.join("\n")}`)
      return
    }

    setIsDeploying(true)
    try {
      const workflowData = {
        name: deployAgentName.trim(),
        description: deployAgentDescription.trim() || null,
        interaction_mode: deployInteractionMode,
        llm_provider: deployLlmProvider,
        llm_model: deployLlmModel,
        speak_order: deploySpeakOrder,
        workflow_nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        workflow_edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      }

      // 기존 에이전트 편집 시 PATCH, 새 에이전트 시 POST
      const isUpdate = !!editingAgentId
      const url = isUpdate ? `/api/agents/${editingAgentId}` : "/api/agents"
      const method = isUpdate ? "PATCH" : "POST"

      // 🆕 프로젝트 연결된 경우 project_id 추가
      const requestData = {
        ...workflowData,
        ...(linkedProjectId && !isUpdate ? { project_id: linkedProjectId } : {}),
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || (isUpdate ? "업데이트 실패" : "배포 실패"))
      }

      const savedAgent = await response.json()

      // 새로 생성한 경우 editingAgentId 설정
      if (!isUpdate && savedAgent.id) {
        setEditingAgentId(savedAgent.id)
      }

      // 에이전트 폴더 생성 (코드 파일로 저장)
      // 🆕 projectPath가 있으면 해당 프로젝트 내에 에이전트 폴더 생성
      try {
        const folderResponse = await fetch('/api/agents/folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: deployAgentName.trim(),
            description: deployAgentDescription.trim() || '',
            nodes: workflowData.workflow_nodes,
            edges: workflowData.workflow_edges,
            metadata: {
              agentId: savedAgent.id,
              llmProvider: deployLlmProvider,
              llmModel: deployLlmModel,
              interactionMode: deployInteractionMode,
            },
            projectPath: projectPath || undefined,  // 🆕 프로젝트 경로 전달
          }),
        })

        if (folderResponse.ok) {
          const folderResult = await folderResponse.json()
          console.log('[AgentBuilder] 폴더 생성 완료:', folderResult.folderPath)
          if (terminalRef.current) {
            terminalRef.current.write(`\r\n\x1b[32m[폴더 생성]\x1b[0m ${folderResult.folderPath}`)
            terminalRef.current.write(`\r\n\x1b[36m파일 ${folderResult.files?.length || 0}개 생성됨\x1b[0m`)
          }
        } else {
          console.warn('[AgentBuilder] 폴더 생성 실패:', await folderResponse.text())
        }
      } catch (folderError) {
        console.warn('[AgentBuilder] 폴더 생성 중 오류:', folderError)
        // 폴더 생성 실패해도 배포는 성공으로 처리
      }

      // 🆕 Neural Map 동기화는 /api/agents POST에서 자동으로 처리됨 (project_id 기반)
      if (linkedProjectId && !isUpdate) {
        console.log('[AgentBuilder] Agent will be added to Neural Map for project:', linkedProjectId)
        if (terminalRef.current) {
          terminalRef.current.write(`\r\n\x1b[35m[Neural Map]\x1b[0m 프로젝트에 에이전트 노드 추가됨`)
        }
        // 동기화 실패해도 배포는 성공으로 처리
      }

      setDeploySuccess(true)

      // 🔄 Header의 agentName 업데이트
      setAgentName(deployAgentName.trim())

      // 🔄 파일 트리 에이전트 목록 새로고침 (이름 변경 반영)
      const refreshChannel = new BroadcastChannel('agent-folder-refresh')
      refreshChannel.postMessage({ type: 'REFRESH' })
      refreshChannel.close()

      setTimeout(() => {
        setShowDeployModal(false)
        setDeploySuccess(false)
        // 편집 모드일 때는 입력값 유지
        if (!isUpdate) {
          setDeployAgentName("")
          setDeployAgentDescription("")
          setDeployInteractionMode('solo')
          setDeployLlmProvider('grok')
          setDeployLlmModel('grok-4-0709-fast')
          setDeploySpeakOrder(0)
        }
      }, 2000)
    } catch (error) {
      alert(error instanceof Error ? error.message : "배포 중 오류가 발생했습니다")
    } finally {
      setIsDeploying(false)
    }
  }, [nodes, edges, deployAgentName, deployAgentDescription, deployInteractionMode, deployLlmProvider, deployLlmModel, deploySpeakOrder, editingAgentId, setAgentName])

  // 워크플로우 빠른 저장 (편집 모드에서만 사용)
  const [isSaving, setIsSaving] = useState(false)
  const handleSaveWorkflow = useCallback(async () => {
    if (!editingAgentId) {
      // 새 에이전트는 Deploy 모달로 이동
      setShowDeployModal(true)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/agents/${editingAgentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          workflow_edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "저장 실패")
      }

      // 저장 성공 피드백
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[32m[저장 완료]\x1b[0m 워크플로우가 저장되었습니다.`)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다")
    } finally {
      setIsSaving(false)
    }
  }, [editingAgentId, nodes, edges])

  const router = useRouter()

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Builder Header - Minimalistic for Focus */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Logo size="sm" href={undefined} animated={false} />
          {/* 편집 중인 에이전트 이름 표시 */}
          {(editingAgentId || currentAgentFolder) && agentName && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-purple-500">{agentName}</span>
              </div>
            </>
          )}
          {isLoadingAgent && (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                <span className="text-sm text-zinc-500">로딩 중...</span>
              </div>
            </>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 p-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mr-2 !rounded-md"
            title="테마 변경"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={handleLoad} className="bg-white dark:bg-zinc-900 border-zinc-300/50 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs !rounded-md">
            <span className="mr-2">↑</span> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} className="bg-white dark:bg-zinc-900 border-zinc-300/50 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs !rounded-md">
            <span className="mr-2">↓</span> Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyJson} className="bg-white dark:bg-zinc-900 border-zinc-300/50 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs !rounded-md">
            <span className="mr-2">&lt;/&gt;</span> Export Code
          </Button>
          {/* WebSocket MCP 연결 상태 - 로컬 터미널 Claude Code 연결 */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
            isWsMcpConnected
              ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
              : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
          }`} title={isWsMcpConnected ? 'WebSocket MCP 연결됨 (localhost:3001)' : 'WebSocket MCP 연결 대기 중'}>
            {isWsMcpConnected ? (
              <Wifi className="w-3 h-3 text-blue-500 animate-pulse" />
            ) : (
              <WifiOff className="w-3 h-3 text-zinc-400" />
            )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">WS</span>
          </div>
          {/* MCP 세션 정보 - Claude Code MCP Server 연결 시 초록불 */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
            isMcpServerConnected
              ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700'
              : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
          }`}>
            {isMcpServerConnected ? (
              <Wifi className="w-3 h-3 text-emerald-500 animate-pulse" />
            ) : isMcpConnected ? (
              <Wifi className="w-3 h-3 text-zinc-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-zinc-400" />
            )}
            <span className="text-xs text-zinc-500 dark:text-zinc-400">MCP:</span>
            <code className="text-xs font-mono text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate" title={mcpSessionId}>
              {mcpSessionId ? mcpSessionId.substring(0, 16) + '...' : '연결 중...'}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopySessionId}
              disabled={!mcpSessionId}
              className="h-5 w-5 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              title="세션 ID 복사"
            >
              {sessionIdCopied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Clipboard className="w-3 h-3 text-zinc-400" />
              )}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const newShowTerminal = !showTerminal
              setShowTerminal(newShowTerminal)
              // 터미널을 열 때 에이전트 폴더로 cd (store 값 우선 + localStorage fallback)
              let agentFolder = currentAgentFolder || storeAgentFolder || agentName
              let agentProjectPath = currentProjectPath || projectPath

              // 🔥 localStorage fallback
              if (!agentFolder || !agentProjectPath) {
                try {
                  const stored = localStorage.getItem('neural-map-storage')
                  if (stored) {
                    const parsed = JSON.parse(stored)
                    const state = parsed?.state || {}
                    if (!agentFolder && state.currentAgentFolder) {
                      agentFolder = state.currentAgentFolder
                    }
                    if (!agentProjectPath && state.projectPath) {
                      agentProjectPath = state.projectPath
                    }
                  }
                } catch (e) { /* ignore */ }
              }

              if (newShowTerminal && agentFolder && agentProjectPath) {
                const agentPath = `${agentProjectPath}/agents/${agentFolder}`
                const electronApi = (window as any).electron?.terminal
                if (electronApi) {
                  setTimeout(() => {
                    const terminalId = activeTerminalId || '1'
                    electronApi.write(terminalId, `cd "${agentPath}" && clear\n`)
                    console.log('[AgentBuilder] Terminal opened, sent cd to', terminalId, ':', agentPath)
                  }, 1000)
                }
              }
            }}
            className={`bg-white dark:bg-zinc-900 border-zinc-300/50 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs !rounded-md ${showTerminal ? 'bg-zinc-100 dark:bg-zinc-800' : ''}`}
          >
            <Terminal className="w-3 h-3 mr-2" />
            Terminal
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-white h-8 text-xs font-semibold px-4 min-w-[80px] shadow-sm !rounded-md"
          >
            {isExecuting ? (
              <>
                <Sparkles className="w-3 h-3 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <span className="mr-2">▶</span> Run
              </>
            )}
          </Button>
          <Button
            onClick={handleSave}
            variant="outline"
            size="sm"
            className="border-accent/50 text-accent hover:bg-accent/10 h-8 text-xs font-semibold px-4 min-w-[80px] !rounded-md"
          >
            <Hammer className="w-3 h-3 mr-2" />
            Build
          </Button>
          {/* 편집 모드일 때 저장 버튼 표시 */}
          {editingAgentId && (
            <Button
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              size="sm"
              className="bg-blue-500 hover:bg-blue-600 text-white h-8 text-xs font-semibold px-4 min-w-[80px] !rounded-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-2" />
                  저장
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => setShowDeployModal(true)}
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs font-semibold px-4 min-w-[80px] !rounded-md"
          >
            <Rocket className="w-3 h-3 mr-2" />
            {editingAgentId ? '설정' : 'Deploy'}
          </Button>
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard-group/agents")}
            className="bg-white dark:bg-zinc-900 border-zinc-300/50 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs !rounded-md"
          >
            나가기
            <ArrowRight className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Node Library */}
        <AgentNodeLibrary
          onDragStart={onDragStart}
          onCreateAgent={() => {
            // 새 에이전트 생성 모달 열기
            setNewAgentName("")
            setShowCreateModal(true)
          }}
          onLoadAgent={handleLoadAgent}
          refreshTrigger={agentListRefresh}
        />

        {/* Canvas + Terminal 영역 */}
        <div className="flex-1 flex flex-col min-w-0" style={{ transition: 'none', animation: 'none' }}>
          {/* Canvas */}
          <div className="flex-1 relative bg-zinc-100 dark:bg-zinc-950 min-h-0" ref={reactFlowWrapper} style={{ transition: 'none' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodesDelete={onNodesDelete}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              snapToGrid
              snapGrid={[20, 20]}
              nodesDraggable={true}
              nodesConnectable={true}
              elementsSelectable={true}
              deleteKeyCode={['Backspace', 'Delete']}
              panOnDrag={true}
              panOnScroll={true}
              zoomOnScroll={true}
              autoPanOnConnect={true}
              autoPanOnNodeDrag={true}
              selectionOnDrag={false}
              defaultEdgeOptions={{
                type: "default",
                animated: false,
                style: { stroke: "var(--edge-color)", strokeWidth: 1.5 },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={12}
                size={1}
                color={theme === 'dark' ? "#52525b" : "#e4e4e7"}
              />
              <Controls
                className="!bg-white dark:!bg-zinc-800 !border-zinc-200 dark:!border-zinc-700 !rounded-lg !shadow-sm [&>button]:!bg-white dark:[&>button]:!bg-zinc-800 [&>button]:!border-zinc-200 dark:[&>button]:!border-zinc-700 [&>button]:!text-zinc-600 dark:[&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-50 dark:[&>button:hover]:!bg-zinc-700"
                showInteractive={false}
              />
              <MiniMap
                zoomable
                pannable
                inversePan
                className="!bg-white dark:!bg-zinc-800 !border-zinc-200 dark:!border-zinc-700 !rounded-lg !shadow-sm"
                nodeColor={(node) => {
                  const colors: Record<string, string> = {
                    llm: "#8b5cf6",
                    router: "#a855f7",
                    memory: "#06b6d4",
                    tool: "#ec4899",
                    rag: "#10b981",
                    input: "var(--accent-color)",
                    output: "#22c55e",
                    chain: "#6366f1",
                    evaluator: "#f97316",
                    function: "#64748b",
                  }
                  return colors[node.type || ""] || (theme === 'dark' ? "#3f3f46" : "#e4e4e7")
                }}
                maskColor={theme === 'dark' ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)"}
              />

              {/* Toolbar */}
              <Panel position="top-right" className="flex gap-2">
                <div className="flex gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 shadow-sm ">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    title="실행 취소"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    title="다시 실행"
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 shadow-sm ">
                  <Button variant="ghost" size="sm" onClick={() => zoomIn()} title="확대" className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => zoomOut()} title="축소" className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => fitView()} title="화면에 맞춤" className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 shadow-sm ">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTemplates(!showTemplates)}
                    title="템플릿"
                    className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <FileJson className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleValidate}
                    title="검증"
                    className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCanvas}
                    className="text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    title="모두 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Panel>

              {/* Templates Panel */}
              {showTemplates && (
                <Panel position="top-center" className="mt-14">
                  <div
                    className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 min-w-[400px] max-w-[600px] shadow-xl"
                    style={{ transition: 'none', animation: 'none' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                        에이전트 템플릿
                      </h3>
                      <button
                        onClick={() => setShowTemplates(false)}
                        className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {AGENT_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleLoadTemplate(template.id)}
                          className="p-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg text-left "
                        >
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {template.nameKo}
                          </div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {template.descriptionKo}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </Panel>
              )}

              {/* Validation Result Toast */}
              {validationResult && (
                <Panel position="bottom-center">
                  <div
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-md ${validationResult.valid
                      ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                      : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                      } `}
                    style={{ transition: 'none', animation: 'none' }}
                  >
                    {validationResult.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>에이전트 설정이 유효합니다!</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <div>
                          {validationResult.errors.map((error, i) => (
                            <div key={i}>{error}</div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>

          {/* Terminal Panel - 캔버스 하단 */}
          {(() => {
            // store의 값 우선 사용 + localStorage fallback (hydration 전에도 작동)
            let agentFolder = currentAgentFolder || storeAgentFolder || agentName
            let agentProjectPath = currentProjectPath || projectPath

            // 🔥 localStorage fallback - zustand hydration 전에도 작동하도록
            if (!agentFolder || !agentProjectPath) {
              try {
                const stored = localStorage.getItem('neural-map-storage')
                if (stored) {
                  const parsed = JSON.parse(stored)
                  const state = parsed?.state || {}
                  if (!agentFolder && state.currentAgentFolder) {
                    agentFolder = state.currentAgentFolder
                  }
                  if (!agentProjectPath && state.projectPath) {
                    agentProjectPath = state.projectPath
                  }
                }
              } catch (e) {
                // localStorage 읽기 실패 무시
              }
            }

            const terminalCwd = agentFolder && agentProjectPath
              ? `${agentProjectPath}/agents/${agentFolder}`
              : undefined
            console.log('[AgentBuilder] Terminal cwd:', terminalCwd, { agentFolder, storeAgentFolder, agentProjectPath, agentName, projectPath })
            return (
              <TerminalPanel
                ref={terminalRef}
                isOpen={showTerminal}
                onToggle={() => setShowTerminal(!showTerminal)}
                onClose={() => setShowTerminal(false)}
                height={terminalHeight}
                onHeightChange={setTerminalHeight}
                cwd={terminalCwd}
              />
            )
          })()}
        </div>

        {/* Config Panel */}
        <AgentConfigPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
          onUpdate={handleNodeUpdate}
        />

        {/* Execution Panel */}
        <ExecutionPanel
          nodes={nodes}
          edges={edges}
          isOpen={showExecutionPanel}
          onClose={() => setShowExecutionPanel(false)}
          onNodeStatusChange={(nodeId, status) => {
            // Visualize status on nodes in ReactFlow
          }}
          onLog={(type, message) => {
            // Stream logs to terminal (RESTORATION)
            if (terminalRef.current) {
              let formattedMsg = ''
              if (type === 'info') formattedMsg = `\r\n\x1b[36m[INFO]\x1b[0m ${message}`
              else if (type === 'output') formattedMsg = `\r\n\x1b[32m[OUTPUT]\x1b[0m ${message}`
              else if (type === 'error') formattedMsg = `\r\n\x1b[31m[ERROR]\x1b[0m ${message}`
              else formattedMsg = `\r\n${message}`

              terminalRef.current.write(formattedMsg)
            }
          }}
        />

      </div>

      {/* 새 에이전트 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-[380px] shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  새 에이전트 생성
                </h3>
                <p className="text-sm text-zinc-500">
                  agents/ 폴더에 에이전트를 생성합니다
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  에이전트 이름 *
                </label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newAgentName.trim()) {
                      handleCreateAgent()
                    } else if (e.key === 'Escape') {
                      setShowCreateModal(false)
                    }
                  }}
                  placeholder="예: CustomerSupportAgent"
                  className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="text-xs text-zinc-500 mt-1">
                  폴더명: agents/{newAgentName.trim().replace(/\s+/g, '-') || '...'}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateAgent}
                  disabled={!newAgentName.trim() || isCreatingAgent}
                  className="flex-1 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isCreatingAgent ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    '생성'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에이전트 배포 모달 */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-[420px] shadow-xl">
            {deploySuccess ? (
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {editingAgentId ? '업데이트 완료!' : '배포 완료!'}
                </h3>
                <p className="text-sm text-zinc-500">
                  {editingAgentId ? '에이전트 설정이 업데이트되었습니다' : '에이전트가 팀에 추가되었습니다'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                      {editingAgentId ? '에이전트 설정' : '에이전트 배포'}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {editingAgentId ? '에이전트 설정을 수정합니다' : '팀에 AI 에이전트를 추가합니다'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      에이전트 이름 *
                    </label>
                    <input
                      type="text"
                      value={deployAgentName}
                      onChange={(e) => setDeployAgentName(e.target.value)}
                      placeholder="예: 마케팅 분석 봇"
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/50"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      설명 (선택)
                    </label>
                    <textarea
                      value={deployAgentDescription}
                      onChange={(e) => setDeployAgentDescription(e.target.value)}
                      placeholder="이 에이전트가 하는 일을 설명해주세요"
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none h-20"
                    />
                  </div>

                  {/* 상호작용 설정 섹션 */}
                  <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">상호작용 설정</h4>

                    <div className="grid grid-cols-2 gap-3">
                      {/* 상호작용 모드 */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          상호작용 모드
                        </label>
                        <select
                          value={deployInteractionMode}
                          onChange={(e) => setDeployInteractionMode(e.target.value as typeof deployInteractionMode)}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="solo">단독 (Solo)</option>
                          <option value="sequential">순차 (Sequential)</option>
                          <option value="debate">토론 (Debate)</option>
                          <option value="collaborate">협업 (Collaborate)</option>
                          <option value="supervisor">감독자 (Supervisor)</option>
                        </select>
                      </div>

                      {/* LLM 제공자 */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                          AI 모델 제공자
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {(Object.keys(PROVIDER_INFO) as LLMProvider[]).map((provider) => {
                            const info = PROVIDER_INFO[provider]
                            return (
                              <button
                                key={provider}
                                type="button"
                                onClick={() => {
                                  setDeployLlmProvider(provider)
                                  setDeployLlmModel(getDefaultModel(provider))
                                }}
                                className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all ${
                                  deployLlmProvider === provider
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                }`}
                              >
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{info.name.split(' ')[0]}</span>
                                {info.recommended && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">추천</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                          {PROVIDER_INFO[deployLlmProvider]?.description}
                        </p>
                      </div>

                      {/* LLM 모델 */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          모델 선택
                        </label>
                        <select
                          value={deployLlmModel}
                          onChange={(e) => setDeployLlmModel(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          {AVAILABLE_MODELS[deployLlmProvider]?.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name} - {model.description}
                              {model.costTier !== 'free' && ` ($${model.inputPrice}/$${model.outputPrice})`}
                              {model.costTier === 'free' && ' (무료)'}
                            </option>
                          ))}
                        </select>
                        {/* 선택된 모델 가격 정보 */}
                        {(() => {
                          const selectedModel = AVAILABLE_MODELS[deployLlmProvider]?.find(m => m.id === deployLlmModel)
                          if (!selectedModel) return null
                          return (
                            <div className="mt-2 p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-500 dark:text-zinc-400">비용 등급:</span>
                                <span className={`px-2 py-0.5 rounded-full ${
                                  selectedModel.costTier === 'free' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                  selectedModel.costTier === 'low' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                  selectedModel.costTier === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                                  'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                }`}>
                                  {selectedModel.costTier === 'free' ? '무료' :
                                   selectedModel.costTier === 'low' ? '저렴' :
                                   selectedModel.costTier === 'medium' ? '보통' : '고가'}
                                </span>
                              </div>
                              {selectedModel.costTier !== 'free' && (
                                <div className="flex items-center justify-between text-xs mt-1">
                                  <span className="text-zinc-500 dark:text-zinc-400">가격 (1M 토큰당):</span>
                                  <span className="text-zinc-700 dark:text-zinc-300">
                                    입력 ${selectedModel.inputPrice} / 출력 ${selectedModel.outputPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      {/* 발언 순서 (순차 모드일 때만) */}
                      {deployInteractionMode === 'sequential' && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                            발언 순서
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={deploySpeakOrder}
                            onChange={(e) => setDeploySpeakOrder(parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        </div>
                      )}
                    </div>

                    {/* 모드 설명 */}
                    <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                      {deployInteractionMode === 'solo' && '에이전트가 독립적으로 응답합니다.'}
                      {deployInteractionMode === 'sequential' && '에이전트들이 순서대로 응답합니다.'}
                      {deployInteractionMode === 'debate' && '에이전트들이 서로 토론하며 결론을 도출합니다.'}
                      {deployInteractionMode === 'collaborate' && '에이전트들이 역할을 분담하여 협업합니다.'}
                      {deployInteractionMode === 'supervisor' && '감독자 에이전트가 다른 에이전트들을 조율합니다.'}
                    </p>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                      <Bot className="w-4 h-4" />
                      <span>워크플로우 노드: {nodes.length}개</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => {
                      setShowDeployModal(false)
                      setDeployAgentName("")
                      setDeployAgentDescription("")
                    }}
                    className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    disabled={isDeploying}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={!deployAgentName.trim() || isDeploying}
                    className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {editingAgentId ? '업데이트 중...' : '배포 중...'}
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        {editingAgentId ? '업데이트' : '배포하기'}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MCP 연결 토스트 알림 */}
      {mcpToast && (
        <div className={`fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300 ${
          mcpToast.type === 'success'
            ? 'bg-emerald-500'
            : 'bg-amber-500'
        } text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3`}>
          {mcpToast.type === 'success' ? (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <WifiOff className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-semibold">{mcpToast.message}</p>
            <p className="text-sm text-white/80">
              {mcpToast.type === 'success'
                ? 'Claude Code에서 노드를 제어할 수 있습니다'
                : '다시 연결하려면 Claude Code에서 connect 명령을 실행하세요'
              }
            </p>
          </div>
          <button
            onClick={() => setMcpToast(null)}
            className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

interface AgentBuilderProps {
  agentId?: string
}

export function AgentBuilder({ agentId }: AgentBuilderProps) {
  return (
    <ReactFlowProvider>
      <AgentBuilderInner agentId={agentId} />
    </ReactFlowProvider>
  )
}
