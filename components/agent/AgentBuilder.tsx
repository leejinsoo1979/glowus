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
import {
  createAgentNode,
  validateAgent,
  exportAgentToJson,
  importAgentFromJson,
  AGENT_TEMPLATES,
} from "@/lib/agent"
import type { AgentNodeData, AgentType } from "@/lib/agent"
import { TerminalPanel, TerminalPanelRef } from "@/components/editor"
import { useMcpBridge } from "@/hooks/useMcpBridge"
import { Logo } from "@/components/ui"

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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  // 위자드 상태
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [creationType, setCreationType] = useState<'custom' | 'ai' | null>(null)
  const [agentDescription, setAgentDescription] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  // 배포 모달 상태
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployAgentName, setDeployAgentName] = useState("")
  const [deployAgentDescription, setDeployAgentDescription] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)
  // 상호작용 설정
  const [deployInteractionMode, setDeployInteractionMode] = useState<'solo' | 'sequential' | 'debate' | 'collaborate' | 'supervisor'>('solo')
  const [deployLlmProvider, setDeployLlmProvider] = useState<'openai' | 'qwen'>('openai')
  const [deployLlmModel, setDeployLlmModel] = useState('gpt-4')
  const [deploySpeakOrder, setDeploySpeakOrder] = useState(0)
  // 편집 모드 상태
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [isLoadingAgent, setIsLoadingAgent] = useState(false)
  const terminalRef = useRef<TerminalPanelRef>(null)
  const { project, fitView, zoomIn, zoomOut } = useReactFlow()
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

  // MCP Bridge - Claude Code에서 노드 조작 가능하게 함
  const { isConnected: isMcpConnected } = useMcpBridge({
    nodes,
    edges,
    setNodes,
    setEdges,
    fitView,
    onLog: (message) => {
      console.log('[MCP]', message)
      // 터미널에도 출력
      if (terminalRef.current) {
        terminalRef.current.write(`\r\n\x1b[35m[MCP]\x1b[0m ${message}`)
      }
    },
  })

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
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData("application/agentflow") as AgentType
      if (!type || !reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode = createAgentNode({ type, position })
      setNodes((nds) => [...nds, newNode])
    },
    [project, setNodes]
  )

  const onDragStart = useCallback((event: React.DragEvent, nodeType: AgentType) => {
    event.dataTransfer.setData("application/agentflow", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }, [])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<AgentNodeData>) => {
      setSelectedNode(node)
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

  // 에이전트 배포 핸들러
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
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "배포 실패")
      }

      setDeploySuccess(true)
      setTimeout(() => {
        setShowDeployModal(false)
        setDeploySuccess(false)
        setDeployAgentName("")
        setDeployAgentDescription("")
        setDeployInteractionMode('solo')
        setDeployLlmProvider('openai')
        setDeployLlmModel('gpt-4')
        setDeploySpeakOrder(0)
      }, 2000)
    } catch (error) {
      alert(error instanceof Error ? error.message : "배포 중 오류가 발생했습니다")
    } finally {
      setIsDeploying(false)
    }
  }, [nodes, edges, deployAgentName, deployAgentDescription, deployInteractionMode, deployLlmProvider, deployLlmModel, deploySpeakOrder])

  const router = useRouter()

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Builder Header - Minimalistic for Focus */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Logo size="sm" href={undefined} animated={false} />
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">A.I Agent Builder</h1>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTerminal(!showTerminal)}
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
          <Button
            onClick={() => setShowDeployModal(true)}
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs font-semibold px-4 min-w-[80px] !rounded-md"
          >
            <Rocket className="w-3 h-3 mr-2" />
            Deploy
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
          onCreateAgent={() => setShowCreateModal(true)}
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
          <TerminalPanel
            ref={terminalRef}
            isOpen={showTerminal}
            onToggle={() => setShowTerminal(!showTerminal)}
            onClose={() => setShowTerminal(false)}
            height={terminalHeight}
            onHeightChange={setTerminalHeight}
          />
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

      {/* 에이전트 생성 위자드 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-[420px] shadow-xl">
            {/* 스텝 인디케이터 */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${wizardStep >= step
                      ? 'bg-accent text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
                    }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-8 h-0.5 mx-1 ${wizardStep > step ? 'bg-accent' : 'bg-zinc-200 dark:bg-zinc-700'
                      }`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: 이름 입력 */}
            {wizardStep === 1 && (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">에이전트 이름</h3>
                <p className="text-sm text-zinc-500 mb-4">에이전트의 이름을 입력해주세요</p>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="예: 고객 서비스 봇"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newAgentName.trim()) {
                      setWizardStep(2)
                    } else if (e.key === 'Escape') {
                      setShowCreateModal(false)
                      setNewAgentName('')
                      setWizardStep(1)
                    }
                  }}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-accent/50"
                  autoFocus
                />
              </>
            )}

            {/* Step 2: 생성 방식 선택 */}
            {wizardStep === 2 && (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">생성 방식 선택</h3>
                <p className="text-sm text-zinc-500 mb-4">에이전트를 어떻게 만들까요?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setCreationType('custom')
                      setAgentName(newAgentName.trim())
                      setNodes([createAgentNode({ type: "start", position: { x: 250, y: 200 } })])
                      setEdges([])
                      setShowCreateModal(false)
                      setNewAgentName('')
                      setWizardStep(1)
                      setCreationType(null)
                    }}
                    className="flex flex-col items-center gap-3 p-4 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-accent hover:bg-accent/5 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-accent/10">
                      <Hammer className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-accent" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-zinc-900 dark:text-white">커스텀</div>
                      <div className="text-xs text-zinc-500 mt-1">직접 노드 배치</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setCreationType('ai')
                      setWizardStep(3)
                    }}
                    className="flex flex-col items-center gap-3 p-4 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-accent hover:bg-accent/5 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-accent/10">
                      <Sparkles className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-accent" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-zinc-900 dark:text-white">AI 생성</div>
                      <div className="text-xs text-zinc-500 mt-1">자동 워크플로우</div>
                    </div>
                  </button>
                </div>
              </>
            )}

            {/* Step 3: AI 생성 설명 입력 */}
            {wizardStep === 3 && (
              <>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">어떤 에이전트가 필요하세요?</h3>
                <p className="text-sm text-zinc-500 mb-4">원하는 기능을 자유롭게 설명해주세요</p>
                <textarea
                  value={agentDescription}
                  onChange={(e) => setAgentDescription(e.target.value)}
                  placeholder="예: 고객 문의가 들어오면 감정을 분석하고, 부정적인 경우 담당자에게 알림을 보내고, 긍정적인 경우 자동으로 응답하는 에이전트"
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-accent/50 resize-none h-32"
                  autoFocus
                  disabled={isGenerating}
                />
                {isGenerating && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-accent">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    AI가 워크플로우를 생성하고 있습니다...
                  </div>
                )}
              </>
            )}

            {/* 버튼 영역 */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => {
                  if (wizardStep === 1) {
                    setShowCreateModal(false)
                    setNewAgentName('')
                    setAgentDescription('')
                    setCreationType(null)
                  } else {
                    setWizardStep((prev) => (prev > 1 ? prev - 1 : prev) as 1 | 2 | 3)
                  }
                }}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                disabled={isGenerating}
              >
                {wizardStep === 1 ? '취소' : '이전'}
              </button>

              {wizardStep === 1 && (
                <button
                  onClick={() => setWizardStep(2)}
                  disabled={!newAgentName.trim()}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  다음 <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {wizardStep === 3 && (
                <button
                  onClick={async () => {
                    if (!agentDescription.trim()) return
                    setIsGenerating(true)
                    try {
                      const response = await fetch('/api/agent/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: newAgentName.trim(),
                          description: agentDescription.trim()
                        }),
                      })
                      const data = await response.json()
                      if (data.nodes && data.edges) {
                        setAgentName(newAgentName.trim())
                        setNodes(data.nodes)
                        setEdges(data.edges)
                        setTimeout(() => fitView({ padding: 0.2 }), 100)
                      }
                    } catch (error) {
                      console.error('AI 생성 실패:', error)
                    } finally {
                      setIsGenerating(false)
                      setShowCreateModal(false)
                      setNewAgentName('')
                      setAgentDescription('')
                      setWizardStep(1)
                      setCreationType(null)
                    }
                  }}
                  disabled={!agentDescription.trim() || isGenerating}
                  className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? '생성 중...' : 'AI로 생성'}
                </button>
              )}
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
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">배포 완료!</h3>
                <p className="text-sm text-zinc-500">에이전트가 팀에 추가되었습니다</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">에이전트 배포</h3>
                    <p className="text-sm text-zinc-500">팀에 AI 에이전트를 추가합니다</p>
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
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          LLM 제공자
                        </label>
                        <select
                          value={deployLlmProvider}
                          onChange={(e) => {
                            const provider = e.target.value as typeof deployLlmProvider
                            setDeployLlmProvider(provider)
                            // 제공자 변경 시 기본 모델로 변경
                            setDeployLlmModel(provider === 'openai' ? 'gpt-4' : 'qwen-max')
                          }}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="qwen">Qwen (Alibaba)</option>
                        </select>
                      </div>

                      {/* LLM 모델 */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                          모델
                        </label>
                        <select
                          value={deployLlmModel}
                          onChange={(e) => setDeployLlmModel(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                        >
                          {deployLlmProvider === 'openai' ? (
                            <>
                              <option value="gpt-4">GPT-4</option>
                              <option value="gpt-4-turbo">GPT-4 Turbo</option>
                              <option value="gpt-4o">GPT-4o</option>
                              <option value="gpt-4o-mini">GPT-4o Mini</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            </>
                          ) : (
                            <>
                              <option value="qwen-max">Qwen Max</option>
                              <option value="qwen-plus">Qwen Plus</option>
                              <option value="qwen-turbo">Qwen Turbo</option>
                              <option value="qwen3-235b-a22b">Qwen3 235B</option>
                            </>
                          )}
                        </select>
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
                        배포 중...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        배포하기
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
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
