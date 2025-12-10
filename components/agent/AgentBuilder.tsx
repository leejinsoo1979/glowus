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
import { motion } from "framer-motion"
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
  ArrowLeft,
  Moon,
  Sun,
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

function AgentBuilderInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(null)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: string[]
  } | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [showExecutionPanel, setShowExecutionPanel] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const { project, fitView, zoomIn, zoomOut } = useReactFlow()
  const { theme, setTheme } = useTheme()

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
    setShowExecutionPanel(true)
  }, [nodes, edges])

  const handleCopyJson = useCallback(() => {
    const json = exportAgentToJson(nodes, edges, { name: "My Agent" })
    navigator.clipboard.writeText(json)
    alert("JSON이 클립보드에 복사되었습니다!")
  }, [nodes, edges])

  const router = useRouter()

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Builder Header - Minimalistic for Focus */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10 shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard-group/agents")}
            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">AI Agent Builder</h1>
              <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">Visual workflow designer for AI SDK</p>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 p-0 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 mr-2"
            title="테마 변경"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={handleLoad} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs transition-colors">
            <span className="mr-2">↑</span> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs transition-colors">
            <span className="mr-2">↓</span> Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyJson} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 h-8 text-xs transition-colors">
            <span className="mr-2">&lt;/&gt;</span> Export Code
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-white h-8 text-xs font-semibold px-4 min-w-[80px] shadow-sm"
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
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Node Library */}
        <AgentNodeLibrary onDragStart={onDragStart} />

        {/* Canvas */}
        <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200" ref={reactFlowWrapper}>
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
              <div className="flex gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 shadow-sm transition-colors">
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

              <div className="flex gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 shadow-sm transition-colors">
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

              <div className="flex gap-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-1 shadow-sm transition-colors">
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
                  className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="모두 삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Panel>

            {/* Templates Panel */}
            {showTemplates && (
              <Panel position="top-center" className="mt-14">
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 min-w-[400px] max-w-[600px] shadow-xl"
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
                        className="p-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg text-left transition-colors"
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
                </motion.div>
              </Panel>
            )}

            {/* Validation Result Toast */}
            {validationResult && (
              <Panel position="bottom-center">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-md ${validationResult.valid
                    ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                    } `}
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
                </motion.div>
              </Panel>
            )}
          </ReactFlow>
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
            // Optional: Visualize status on nodes in ReactFlow
            // This would require a custom node capability to show status
          }}
        />
      </div>
    </div>
  )
}

export function AgentBuilder() {
  return (
    <ReactFlowProvider>
      <AgentBuilderInner />
    </ReactFlowProvider>
  )
}
