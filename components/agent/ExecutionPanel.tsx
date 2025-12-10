"use client"

import { useState } from "react"
import type { Node, Edge } from "reactflow"
import { Play, X, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { motion, AnimatePresence } from "framer-motion"

type ExecutionResult = {
    nodeId: string
    type: string
    output: any
    error?: string
}

type ExecutionPanelProps = {
    nodes: Node[]
    edges: Edge[]
    isOpen: boolean
    onClose: () => void
    onNodeStatusChange?: (nodeId: string, status: "idle" | "running" | "completed" | "error") => void
    onNodeOutputChange?: (nodeId: string, output: any) => void
}

export function ExecutionPanel({
    nodes,
    edges,
    isOpen,
    onClose,
    onNodeStatusChange,
    onNodeOutputChange,
}: ExecutionPanelProps) {
    const [isExecuting, setIsExecuting] = useState(false)
    const [executionLog, setExecutionLog] = useState<ExecutionResult[]>([])
    const [error, setError] = useState<string | null>(null)
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)

    const handleExecute = async () => {
        setIsExecuting(true)
        setExecutionLog([])
        setError(null)
        setCurrentNodeId(null)

        nodes.forEach((node) => {
            if (onNodeStatusChange) onNodeStatusChange(node.id, "idle")
            if (onNodeOutputChange) onNodeOutputChange(node.id, null)
        })

        try {
            const response = await fetch("/api/agent/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nodes, edges }),
            })

            if (!response.body) {
                throw new Error("No response body")
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
                    if (!line.trim()) continue

                    try {
                        const update = JSON.parse(line)

                        switch (update.type) {
                            case "node_start":
                                if (update.nodeId) {
                                    if (onNodeStatusChange) onNodeStatusChange(update.nodeId, "running")
                                    setCurrentNodeId(update.nodeId)
                                }
                                break

                            case "node_complete":
                                if (update.nodeId) {
                                    if (onNodeStatusChange) {
                                        onNodeStatusChange(update.nodeId, "completed")
                                    }
                                    if (onNodeOutputChange) {
                                        onNodeOutputChange(update.nodeId, update.output)
                                    }

                                    // Find node info for logging
                                    const node = nodes.find((n) => n.id === update.nodeId)
                                    setExecutionLog((prev) => [
                                        ...prev,
                                        {
                                            nodeId: update.nodeId,
                                            type: node?.type || "unknown",
                                            output: update.output,
                                        },
                                    ])
                                    setCurrentNodeId(null)
                                }
                                break

                            case "node_error":
                                if (update.nodeId) {
                                    if (onNodeStatusChange) onNodeStatusChange(update.nodeId, "error")
                                }
                                const errorNode = nodes.find((n) => n.id === update.nodeId)
                                setExecutionLog((prev) => [
                                    ...prev,
                                    {
                                        nodeId: update.nodeId || "unknown",
                                        type: errorNode?.type || "unknown",
                                        output: null,
                                        error: update.error,
                                    },
                                ])
                                setCurrentNodeId(null)
                                break

                            case "complete":
                                setCurrentNodeId(null)
                                break

                            case "error":
                                setError(update.error || "Execution failed")
                                break
                        }
                    } catch (parseError) {
                        console.error("Failed to parse update:", parseError)
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to execute workflow")
        } finally {
            setIsExecuting(false)
        }
    }

    const getNodeLabel = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId)
        if (!node) return nodeId
        // Custom label logic depending on node type
        return node.data.label || node.data.name || node.type
    }

    if (!isOpen) return null

    return (
        <div className="absolute right-0 top-0 z-20 h-full w-96 border-l border-zinc-800 bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
                <h2 className="text-sm font-semibold text-zinc-100">Agent Execution</h2>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex flex-col h-[calc(100%-57px)]">
                <div className="p-4 border-b border-zinc-800">
                    <Button
                        onClick={handleExecute}
                        disabled={isExecuting || nodes.length === 0}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Running...
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4" />
                                Run Agent
                            </>
                        )}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-red-400">Execution Error</p>
                                    <p className="text-xs text-red-400/80 mt-1">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {executionLog.length === 0 && !error && !isExecuting && (
                        <div className="text-center py-10 text-zinc-500">
                            <p className="text-sm">Ready to test your agent.</p>
                            <p className="text-xs mt-1">Click "Run Agent" to start.</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {executionLog.map((result, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`border rounded-lg p-3 ${result.error
                                        ? "border-red-500/20 bg-red-500/5"
                                        : "border-zinc-700 bg-zinc-800/50"
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    {result.error ? (
                                        <XCircle className="h-4 w-4 text-red-400 mt-0.5" />
                                    ) : (
                                        <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-zinc-200">
                                                {getNodeLabel(result.nodeId)}
                                            </span>
                                            <span className="text-[10px] uppercase text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                {result.type}
                                            </span>
                                        </div>

                                        {result.error ? (
                                            <p className="text-xs text-red-400 break-words">{result.error}</p>
                                        ) : (
                                            <div className="bg-zinc-950 rounded p-2 overflow-x-auto">
                                                <pre className="text-xs text-zinc-400 font-mono">
                                                    {typeof result.output === "string"
                                                        ? result.output
                                                        : JSON.stringify(result.output, null, 2)
                                                    }
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {currentNodeId && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="border border-violet-500/30 bg-violet-500/5 rounded-lg p-3"
                        >
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                                <span className="text-sm text-violet-200">
                                    Executing {getNodeLabel(currentNodeId)}...
                                </span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    )
}
