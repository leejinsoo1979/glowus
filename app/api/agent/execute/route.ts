
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Node, Edge } from "reactflow"

export const maxDuration = 30

type ExecutionResult = {
    nodeId: string
    type: string
    output: any
    error?: string
}

type StreamUpdate = {
    type: "node_start" | "node_complete" | "node_error" | "complete" | "error"
    nodeId?: string
    nodeType?: string
    output?: any
    error?: string
    executionLog?: ExecutionResult[]
}

function interpolateVariables(template: string, inputs: any[]): string {
    let result = template
    inputs.forEach((input, index) => {
        const placeholder = `$input${index + 1}`
        const value = typeof input === "string" ? input : JSON.stringify(input)
        result = result.replace(new RegExp(`\\${placeholder}`, "g"), value)
    })
    return result
}

export async function POST(req: Request) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            const sendUpdate = (update: StreamUpdate) => {
                controller.enqueue(encoder.encode(JSON.stringify(update) + "\n"))
            }

            try {
                const { nodes, edges }: { nodes: Node[]; edges: Edge[] } = await req.json()

                // Build execution graph
                const nodeMap = new Map(nodes.map((node) => [node.id, node]))
                const results = new Map<string, any>()
                const executionLog: ExecutionResult[] = []

                // Find nodes with no incoming edges (entry points)
                const incomingEdges = new Set(edges.map((e) => e.target))
                const entryNodes = nodes.filter((node) => !incomingEdges.has(node.id))

                // Execute nodes in topological order
                const executeNode = async (nodeId: string): Promise<any> => {
                    // Return cached result if already executed
                    if (results.has(nodeId)) {
                        return results.get(nodeId)
                    }

                    const node = nodeMap.get(nodeId)
                    if (!node) {
                        throw new Error(`Node ${nodeId} not found`)
                    }

                    const inputEdges = edges
                        .filter((e) => e.target === nodeId)
                        .sort((a, b) => {
                            const nodeA = nodeMap.get(a.source)
                            const nodeB = nodeMap.get(b.source)
                            return (nodeA?.position.x || 0) - (nodeB?.position.x || 0)
                        })

                    let hasValidInput = inputEdges.length === 0 // Nodes with no inputs are valid (entry nodes)

                    for (const edge of inputEdges) {
                        const sourceNode = nodeMap.get(edge.source)

                        if (sourceNode?.type === "conditional") {
                            // Check if the conditional has been evaluated
                            if (results.has(edge.source)) {
                                const conditionResult = results.get(edge.source)
                                const expectedHandle = conditionResult ? "true" : "false"

                                // If this edge's sourceHandle matches the condition result, it's a valid input
                                if (!edge.sourceHandle || edge.sourceHandle === expectedHandle) {
                                    hasValidInput = true
                                    break
                                }
                            }
                        } else {
                            // For non-conditional inputs, check if the source node has executed successfully
                            // First execute the source node to get its result
                            const sourceResult = await executeNode(edge.source)
                            // Only consider it valid input if the source node actually produced output
                            if (sourceResult !== null) {
                                hasValidInput = true
                                break
                            }
                        }
                    }

                    // If no valid inputs, skip this node
                    if (!hasValidInput) {
                        results.set(nodeId, null)
                        return null
                    }

                    sendUpdate({
                        type: "node_start",
                        nodeId,
                        nodeType: node.type,
                    })

                    const inputs: any[] = []
                    for (const edge of inputEdges) {
                        // Only collect inputs from valid paths
                        const sourceNode = nodeMap.get(edge.source)
                        let shouldIncludeInput = true

                        if (sourceNode?.type === "conditional" && results.has(edge.source)) {
                            const conditionResult = results.get(edge.source)
                            const expectedHandle = conditionResult ? "true" : "false"

                            if (edge.sourceHandle && edge.sourceHandle !== expectedHandle) {
                                shouldIncludeInput = false
                            }
                        }

                        if (shouldIncludeInput) {
                            const inputResult = await executeNode(edge.source)
                            // Only add non-null inputs (skip inputs from skipped branches)
                            if (inputResult !== null) {
                                inputs.push(inputResult)
                            }
                        }
                    }

                    // Skip this node only if it has no valid inputs at all
                    // (all inputs were null or from invalid conditional paths)
                    if (inputEdges.length > 0 && inputs.length === 0) {
                        results.set(nodeId, null)
                        return null
                    }

                    let output: any

                    try {
                        switch (node.type) {
                            case "input": // start/input node
                                output = "Agent started"
                                executionLog.push({
                                    nodeId,
                                    type: node.type ?? "default",
                                    output,
                                })
                                break

                            case "output": // end/output node
                                const endInput = inputs.length > 0 ? inputs[0] : null
                                output = endInput
                                executionLog.push({
                                    nodeId,
                                    type: node.type ?? "default",
                                    output: {
                                        finalOutput: output,
                                    },
                                })
                                break

                            case "router": // conditional/router
                                const conditionCode = node.data.condition || "true"
                                const conditionInputs = inputs

                                try {
                                    // Safe evaluation logic here or simple comparison
                                    // For demo, assuming condition is a simple JS expression using inputs
                                    let result = false
                                    // Basic router logic: check if input contains keywords or matches regex
                                    const inputStr = JSON.stringify(conditionInputs)
                                    if (node.data.keywords) {
                                        const keywords = node.data.keywords.split(',').map((k: string) => k.trim())
                                        result = keywords.some((k: string) => inputStr.includes(k))
                                    } else {
                                        // Default to true if no keywords specific
                                        result = true
                                    }

                                    output = result
                                } catch (condError: any) {
                                    throw new Error(`Router evaluation error: ${condError.message}`)
                                }

                                executionLog.push({
                                    nodeId,
                                    type: node.type ?? "default",
                                    output: {
                                        condition: conditionCode,
                                        result: output,
                                        inputs: conditionInputs,
                                    },
                                })
                                break

                            case "tool": // tool/http request
                                let url = node.data.url || ""
                                const method = node.data.method || "GET"

                                // Interpolate variables in URL
                                if (inputs.length > 0) {
                                    url = interpolateVariables(url, inputs)
                                }

                                const headers: Record<string, string> = {}
                                if (node.data.headers) {
                                    try {
                                        Object.assign(headers, JSON.parse(node.data.headers))
                                    } catch (e) {
                                        console.error("Invalid headers JSON")
                                    }
                                }

                                let body = node.data.body || ""
                                if (body && inputs.length > 0) {
                                    body = interpolateVariables(body, inputs)
                                }

                                const fetchOptions: RequestInit = {
                                    method,
                                    headers,
                                }

                                if (method !== "GET" && method !== "HEAD" && body) {
                                    fetchOptions.body = body
                                }

                                // If it's a real tool node, it might not be just HTTP
                                // For now mapping Tool Node to HTTP-like capability if URL present
                                if (url) {
                                    try {
                                        const response = await fetch(url, fetchOptions)
                                        const data = await response.json()
                                        output = data
                                    } catch (fetchError: any) {
                                        throw new Error(`Tool execution failed: ${fetchError.message}`)
                                    }
                                } else {
                                    output = { message: "Tool executed (Mock)", inputs }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: node.type ?? "default",
                                    output,
                                })
                                break

                            case "llm": // text model
                                const prompt = inputs.length > 0 ? String(inputs[0]) : node.data.prompt || ""

                                if (process.env.OPENAI_API_KEY) {
                                    const textResult = await generateText({
                                        model: openai(node.data.model || "gpt-4o"),
                                        prompt,
                                        temperature: node.data.temperature || 0.7,
                                        maxOutputTokens: node.data.maxTokens || 2000,
                                    })
                                    output = textResult.text
                                } else {
                                    // Mock response if no key
                                    output = `[Mock LLM Response] Processed: ${prompt.substring(0, 50)}...`
                                    await new Promise(resolve => setTimeout(resolve, 1000))
                                }

                                executionLog.push({
                                    nodeId,
                                    type: node.type ?? "default",
                                    output: {
                                        text: output,
                                    },
                                })
                                break

                            default:
                                output = { message: `Executed node type: ${node.type}`, inputs }
                        }

                        results.set(nodeId, output)

                        sendUpdate({
                            type: "node_complete",
                            nodeId,
                            nodeType: node.type,
                            output,
                        })

                        return output
                    } catch (error: any) {
                        const errorMessage = error.message || "Unknown error"
                        executionLog.push({
                            nodeId,
                            type: node.type ?? "default",
                            output: null,
                            error: errorMessage,
                        })

                        sendUpdate({
                            type: "node_error",
                            nodeId,
                            nodeType: node.type,
                            error: errorMessage,
                        })

                        throw error
                    }
                }

                // Execute all entry nodes
                const finalResults: any[] = []
                for (const entryNode of entryNodes) {
                    const result = await executeNode(entryNode.id)
                    finalResults.push(result)

                    // Also execute all downstream nodes
                    const processDownstream = async (nodeId: string) => {
                        const outgoingEdges = edges.filter((e) => e.source === nodeId)

                        // The skip logic in executeNode will handle conditional branching
                        for (const edge of outgoingEdges) {
                            await executeNode(edge.target)
                            await processDownstream(edge.target)
                        }
                    }
                    await processDownstream(entryNode.id)
                }

                sendUpdate({
                    type: "complete",
                    executionLog,
                })

                controller.close()
            } catch (error: any) {
                sendUpdate({
                    type: "error",
                    error: error.message || "Execution failed",
                })
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
        },
    })
}
