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
import { useWorkflowStore } from "@/stores/workflowStore"
import { motion, AnimatePresence } from "framer-motion"
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
  XCircle,
  Loader2,
  Terminal,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { NodeLibrary } from "./NodeLibrary"
import { NodeConfigPanel } from "./NodeConfigPanel"
import {
  TriggerNode,
  InputNode,
  OutputNode,
  ProcessNode,
  ConditionalNode,
  CodeNode,
  AINode,
  DelayNode,
  HttpNode,
  NotificationNode,
} from "./nodes"
import {
  createNode,
  validateWorkflow,
  exportWorkflowToJson,
  importWorkflowFromJson,
} from "@/lib/workflow"
import type { NodeData } from "@/lib/workflow"

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  input: InputNode,
  output: OutputNode,
  process: ProcessNode,
  conditional: ConditionalNode,
  code: CodeNode,
  ai: AINode,
  delay: DelayNode,
  http: HttpNode,
  notification: NotificationNode,
}

const initialNodes: Node<NodeData>[] = [
  createNode({ type: "trigger", position: { x: 300, y: 50 } }),
]

const initialEdges: Edge[] = []

// 노드 실행 상태 타입
type NodeExecutionStatus = "pending" | "running" | "completed" | "failed"

interface ExecutionLog {
  nodeId: string
  nodeName: string
  status: NodeExecutionStatus
  message?: string
  result?: unknown
  timestamp: string
}

function WorkflowBuilderInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: string[]
  } | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const { project, fitView, zoomIn, zoomOut } = useReactFlow()

  // Jarvis 제어를 위해 전역 스토어와 동기화 - 액션만 가져오기 (안정적 참조)
  const storeSetNodes = useWorkflowStore((s) => s.setNodes)
  const storeSetEdges = useWorkflowStore((s) => s.setEdges)
  const storeSelectNode = useWorkflowStore((s) => s.selectNode)
  const storeSetIsExecuting = useWorkflowStore((s) => s.setIsExecuting)

  // 로컬 상태 → 스토어 동기화
  useEffect(() => {
    storeSetNodes(nodes)
  }, [nodes, storeSetNodes])

  useEffect(() => {
    storeSetEdges(edges)
  }, [edges, storeSetEdges])

  useEffect(() => {
    storeSelectNode(selectedNode?.id || null)
  }, [selectedNode, storeSelectNode])

  useEffect(() => {
    storeSetIsExecuting(isExecuting)
  }, [isExecuting, storeSetIsExecuting])

  // 스토어 → 로컬 상태 동기화 (Jarvis 제어 수신)
  useEffect(() => {
    const unsubscribe = useWorkflowStore.subscribe((state, prevState) => {
      // 노드 변경 감지 (Jarvis에서 추가/삭제/수정)
      if (state.nodes !== prevState.nodes && state.nodes !== nodes) {
        setNodes(state.nodes)
      }
      // 엣지 변경 감지
      if (state.edges !== prevState.edges && state.edges !== edges) {
        setEdges(state.edges as Edge[])
      }
    })
    return () => unsubscribe()
  }, [nodes, edges, setNodes, setEdges])

  // 🔥 실행 상태 관리
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeExecutionStatus>>({})
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([])
  const [showLogPanel, setShowLogPanel] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // History for undo/redo
  const [history, setHistory] = useState<{ nodes: Node<NodeData>[]; edges: Edge[] }[]>([])
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

  // 노드 스타일 업데이트 (실행 상태에 따라)
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const status = nodeStatuses[node.id]
        let className = ""
        let style = { ...node.style }

        switch (status) {
          case "running":
            className = "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900 animate-pulse"
            style = { ...style, boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" }
            break
          case "completed":
            className = "ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-900"
            style = { ...style, boxShadow: "0 0 20px rgba(34, 197, 94, 0.3)" }
            break
          case "failed":
            className = "ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-900"
            style = { ...style, boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)" }
            break
          default:
            className = ""
            style = { ...node.style, boxShadow: undefined }
        }

        return { ...node, className, style }
      })
    )
  }, [nodeStatuses, setNodes])

  // 엣지 애니메이션 업데이트
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        const sourceStatus = nodeStatuses[edge.source]
        const targetStatus = nodeStatuses[edge.target]

        // 소스가 완료되고 타겟이 실행 중이면 강조
        const isActive = sourceStatus === "completed" && targetStatus === "running"

        return {
          ...edge,
          animated: isActive || edge.animated,
          style: {
            ...edge.style,
            stroke: isActive ? "#22c55e" : "#52525b",
            strokeWidth: isActive ? 2 : 1,
          },
        }
      })
    )
  }, [nodeStatuses, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#52525b" },
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

      const type = event.dataTransfer.getData("application/reactflow")
      if (!type || !reactFlowWrapper.current) return

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })

      const newNode = createNode({ type, position })
      setNodes((nds) => [...nds, newNode])
    },
    [project, setNodes]
  )

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType)
    event.dataTransfer.effectAllowed = "move"
  }, [])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      setSelectedNode(node)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<NodeData>) => {
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
    const result = validateWorkflow(nodes, edges)
    setValidationResult(result)
    setTimeout(() => setValidationResult(null), 5000)
  }, [nodes, edges])

  const handleSave = useCallback(() => {
    const json = exportWorkflowToJson(nodes, edges)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `workflow-${Date.now()}.json`
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
        const result = importWorkflowFromJson(ev.target?.result as string)
        if (result) {
          setNodes(result.nodes)
          setEdges(result.edges as Edge[])
          fitView()
        } else {
          alert("유효하지 않은 워크플로우 파일입니다.")
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [setNodes, setEdges, fitView])

  // 🔥 실제 워크플로우 실행
  const handleExecute = useCallback(async () => {
    const validation = validateWorkflow(nodes, edges)
    if (!validation.valid) {
      setValidationResult(validation)
      return
    }

    // 상태 초기화
    setIsExecuting(true)
    setNodeStatuses({})
    setExecutionLogs([])
    setShowLogPanel(true)

    // 모든 노드를 pending으로 설정
    const initialStatuses: Record<string, NodeExecutionStatus> = {}
    nodes.forEach((node) => {
      initialStatuses[node.id] = "pending"
    })
    setNodeStatuses(initialStatuses)

    try {
      // SSE 연결
      const response = await fetch("/api/workflow/execute/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          inputs: {},
        }),
      })

      if (!response.body) {
        throw new Error("스트림을 받을 수 없습니다")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6))
              handleSSEEvent(event)
            } catch {
              // JSON 파싱 실패 무시
            }
          }
        }
      }
    } catch (error) {
      console.error("Workflow execution error:", error)
      setValidationResult({
        valid: false,
        errors: [error instanceof Error ? error.message : "실행 중 오류 발생"],
      })
    } finally {
      setIsExecuting(false)
    }
  }, [nodes, edges])

  // SSE 이벤트 처리
  const handleSSEEvent = useCallback((event: {
    type: string
    executionId: string
    nodeId?: string
    data?: unknown
    timestamp: string
  }) => {
    const nodeId = event.nodeId
    const data = event.data as Record<string, unknown> | undefined

    switch (event.type) {
      case "workflow_started":
        setExecutionLogs((prev) => [
          ...prev,
          {
            nodeId: "workflow",
            nodeName: "워크플로우",
            status: "running",
            message: `워크플로우 시작 (${(data?.stepCount || 0)}개 노드)`,
            timestamp: event.timestamp,
          },
        ])
        break

      case "node_started":
        if (nodeId) {
          setNodeStatuses((prev) => ({ ...prev, [nodeId]: "running" }))
          setExecutionLogs((prev) => [
            ...prev,
            {
              nodeId,
              nodeName: (data?.name as string) || nodeId,
              status: "running",
              message: `실행 시작`,
              timestamp: event.timestamp,
            },
          ])
        }
        break

      case "node_completed":
        if (nodeId) {
          setNodeStatuses((prev) => ({ ...prev, [nodeId]: "completed" }))
          setExecutionLogs((prev) => [
            ...prev,
            {
              nodeId,
              nodeName: nodeId,
              status: "completed",
              message: `완료 (${(data?.duration as number) || 0}ms)`,
              result: data?.result,
              timestamp: event.timestamp,
            },
          ])
        }
        break

      case "node_failed":
        if (nodeId) {
          setNodeStatuses((prev) => ({ ...prev, [nodeId]: "failed" }))
          setExecutionLogs((prev) => [
            ...prev,
            {
              nodeId,
              nodeName: nodeId,
              status: "failed",
              message: (data?.error as string) || "오류 발생",
              timestamp: event.timestamp,
            },
          ])
        }
        break

      case "log":
        if (nodeId) {
          setExecutionLogs((prev) => [
            ...prev,
            {
              nodeId,
              nodeName: nodeId,
              status: "running",
              message: (data?.message as string) || "",
              timestamp: event.timestamp,
            },
          ])
        }
        break

      case "workflow_completed":
        setExecutionLogs((prev) => [
          ...prev,
          {
            nodeId: "workflow",
            nodeName: "워크플로우",
            status: "completed",
            message: `완료! ${(data?.stepsExecuted || 0)}개 노드 실행됨`,
            result: data?.outputs,
            timestamp: event.timestamp,
          },
        ])
        setValidationResult({ valid: true, errors: [] })
        setTimeout(() => setValidationResult(null), 5000)
        break

      case "workflow_failed":
        setExecutionLogs((prev) => [
          ...prev,
          {
            nodeId: "workflow",
            nodeName: "워크플로우",
            status: "failed",
            message: (data?.error as string) || "워크플로우 실행 실패",
            timestamp: event.timestamp,
          },
        ])
        setValidationResult({
          valid: false,
          errors: [(data?.error as string) || "워크플로우 실행 실패"],
        })
        break
    }
  }, [])

  // 실행 상태 초기화
  const handleResetExecution = useCallback(() => {
    setNodeStatuses({})
    setExecutionLogs([])
    setShowLogPanel(false)
  }, [])

  return (
    <div className="flex h-full bg-zinc-950">
      {/* Node Library */}
      <NodeLibrary onDragStart={onDragStart} />

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
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
          snapToGrid
          snapGrid={[20, 20]}
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            style: { stroke: "#52525b" },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
          <Controls
            className="!bg-zinc-800 !border-zinc-700 !rounded-lg [&>button]:!bg-zinc-800 [&>button]:!border-zinc-700 [&>button]:!text-zinc-400 [&>button:hover]:!bg-zinc-700"
            showInteractive={false}
          />
          <MiniMap
            className="!bg-zinc-800 !border-zinc-700 !rounded-lg"
            nodeColor={(node) => {
              // 실행 상태에 따른 색상
              const status = nodeStatuses[node.id]
              if (status === "running") return "#3b82f6"
              if (status === "completed") return "#22c55e"
              if (status === "failed") return "#ef4444"

              switch (node.type) {
                case "trigger":
                  return "#22c55e"
                case "input":
                  return "var(--accent-color)"
                case "output":
                  return "#10b981"
                case "process":
                  return "#8b5cf6"
                case "conditional":
                  return "#f59e0b"
                case "code":
                  return "#6b7280"
                case "ai":
                  return "#ec4899"
                case "delay":
                  return "#64748b"
                case "http":
                  return "#06b6d4"
                case "notification":
                  return "#f97316"
                default:
                  return "#3f3f46"
              }
            }}
            maskColor="rgba(0,0,0,0.7)"
          />

          {/* Toolbar */}
          <Panel position="top-right" className="flex gap-2">
            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="실행 취소"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="다시 실행"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={() => zoomIn()} title="확대">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => zoomOut()} title="축소">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fitView()} title="화면에 맞춤">
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={handleSave} title="저장">
                <Save className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLoad} title="불러오기">
                <Upload className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCanvas}
                className="text-red-400 hover:text-red-300"
                title="모두 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleValidate}
                title="검증"
              >
                검증
              </Button>
              {Object.keys(nodeStatuses).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetExecution}
                  title="초기화"
                  className="text-zinc-400"
                >
                  초기화
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogPanel(!showLogPanel)}
                title="로그"
                className={showLogPanel ? "bg-zinc-700" : ""}
              >
                <Terminal className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleExecute}
                disabled={isExecuting}
                className="bg-accent hover:bg-accent/90 text-white"
                size="sm"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    실행 중...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    실행
                  </>
                )}
              </Button>
            </div>
          </Panel>

          {/* Validation Result Toast */}
          {validationResult && (
            <Panel position="bottom-center">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
                  validationResult.valid
                    ? "bg-green-500/20 border border-green-500/30 text-green-400"
                    : "bg-red-500/20 border border-red-500/30 text-red-400"
                }`}
              >
                {validationResult.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>워크플로우가 유효합니다!</span>
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

        {/* 🔥 실행 로그 패널 */}
        <AnimatePresence>
          {showLogPanel && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col z-10"
            >
              <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300">실행 로그</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowLogPanel(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {executionLogs.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    워크플로우를 실행하면 로그가 표시됩니다
                  </p>
                ) : (
                  executionLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs ${
                        log.status === "completed"
                          ? "bg-green-500/10 border border-green-500/20"
                          : log.status === "failed"
                          ? "bg-red-500/10 border border-red-500/20"
                          : log.status === "running"
                          ? "bg-blue-500/10 border border-blue-500/20"
                          : "bg-zinc-800 border border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {log.status === "completed" && (
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                        )}
                        {log.status === "failed" && (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                        {log.status === "running" && (
                          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                        )}
                        <span className="font-medium text-zinc-300">
                          {log.nodeName}
                        </span>
                        <span className="text-zinc-500 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-zinc-400">{log.message}</p>
                      {log.result !== undefined && (
                        <details className="mt-1">
                          <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                            결과 보기
                          </summary>
                          <pre className="mt-1 p-2 bg-zinc-950 rounded text-[10px] overflow-x-auto">
                            {typeof log.result === 'string'
                              ? log.result
                              : JSON.stringify(log.result, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Config Panel */}
      <NodeConfigPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onUpdate={handleNodeUpdate}
        onDelete={handleNodeDelete}
      />
    </div>
  )
}

export function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  )
}
