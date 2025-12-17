
import { generateText, embed } from "ai"
import { openai } from "@ai-sdk/openai"
import type { Node, Edge } from "reactflow"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { ActivepiecesClient } from "@/lib/activepieces/client"

// Activepieces client (lazy initialization)
let _activepiecesClient: ActivepiecesClient | null = null
const getActivepiecesClient = () => {
    if (!_activepiecesClient) {
        _activepiecesClient = new ActivepiecesClient()
    }
    return _activepiecesClient
}

export const maxDuration = 60

// Supabase client for memory/RAG operations (lazy initialization)
let _supabase: ReturnType<typeof createClient> | null = null
const getSupabase = () => {
    if (!_supabase) {
        _supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
    }
    return _supabase
}

// OpenAI client for DALL-E (lazy initialization)
const getOpenAIClient = () => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not set')
    }
    return new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    })
}

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

// Variable interpolation for templates
function interpolateVariables(template: string, inputs: any[]): string {
    let result = template
    inputs.forEach((input, index) => {
        const placeholder = `$input${index + 1}`
        const value = typeof input === "string" ? input : JSON.stringify(input)
        result = result.replace(new RegExp(`\\${placeholder}`, "g"), value)
    })
    // Also support {{input1}}, {{input2}} syntax
    inputs.forEach((input, index) => {
        const placeholder = `{{input${index + 1}}}`
        const value = typeof input === "string" ? input : JSON.stringify(input)
        result = result.split(placeholder).join(value)
    })
    return result
}

// Safe JavaScript execution in sandbox
async function executeJavaScript(code: string, inputs: any[]): Promise<any> {
    try {
        // Create a safe context with limited globals
        const safeGlobals = {
            JSON,
            Math,
            Date,
            String,
            Number,
            Boolean,
            Array,
            Object,
            console: { log: () => {}, error: () => {}, warn: () => {} },
            inputs,
            input: inputs[0],
        }

        // Wrap code in async function to support await
        const wrappedCode = `
            return (async () => {
                ${code}
            })()
        `

        const fn = new Function(...Object.keys(safeGlobals), wrappedCode)
        const result = await fn(...Object.values(safeGlobals))
        return result
    } catch (error: any) {
        throw new Error(`JavaScript execution error: ${error.message}`)
    }
}

// Memory operations
async function saveToMemory(agentId: string, key: string, value: any): Promise<void> {
    await (getSupabase() as any).from("agent_memory").upsert({
        agent_id: agentId,
        memory_key: key,
        memory_value: value,
        updated_at: new Date().toISOString(),
    }, { onConflict: "agent_id,memory_key" })
}

async function loadFromMemory(agentId: string, key?: string): Promise<any> {
    if (key) {
        const { data } = await (getSupabase() as any)
            .from("agent_memory")
            .select("memory_value")
            .eq("agent_id", agentId)
            .eq("memory_key", key)
            .single()
        return data?.memory_value
    } else {
        const { data } = await (getSupabase() as any)
            .from("agent_memory")
            .select("memory_key, memory_value")
            .eq("agent_id", agentId)
        return data?.reduce((acc: any, item: any) => {
            acc[item.memory_key] = item.memory_value
            return acc
        }, {})
    }
}

// RAG vector search
async function ragSearch(query: string, collectionId: string, topK: number = 5): Promise<any[]> {
    // Generate embedding for query
    const embeddingResponse = await getOpenAIClient().embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // Search similar documents using pgvector
    const { data, error } = await (getSupabase() as any).rpc("match_documents", {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: topK,
        filter_collection: collectionId,
    })

    if (error) {
        console.error("RAG search error:", error)
        return []
    }

    return data || []
}

// Generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAIClient().embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    })
    return response.data[0].embedding
}

// Generate image with DALL-E
async function generateImage(prompt: string, size: string = "1024x1024"): Promise<string> {
    const response = await getOpenAIClient().images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: size as "1024x1024" | "1792x1024" | "1024x1792",
    })
    return response.data?.[0]?.url || ""
}

// AI-based router (intent classification)
async function classifyIntent(input: string, routes: { name: string; description: string }[]): Promise<string> {
    const routeDescriptions = routes.map((r, i) => `${i + 1}. ${r.name}: ${r.description}`).join("\n")

    const result = await generateText({
        model: openai("gpt-4o-mini"),
        prompt: `사용자 입력을 분석하여 가장 적합한 라우트를 선택하세요.

사용자 입력: "${input}"

가능한 라우트:
${routeDescriptions}

가장 적합한 라우트의 이름만 정확히 반환하세요. 설명 없이 라우트 이름만 반환합니다.`,
        temperature: 0,
    })

    return result.text.trim()
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
                        const nodeType = node.type || "default"
                        const agentId = node.data?.agentId || "default-agent"

                        switch (nodeType) {
                            // ===== START/INPUT NODES =====
                            case "start":
                            case "input":
                                output = node.data?.initialInput || inputs[0] || "Agent started"
                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break

                            // ===== END/OUTPUT NODES =====
                            case "end":
                            case "output":
                                output = inputs.length > 0 ? inputs[0] : null
                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output: { finalOutput: output },
                                })
                                break

                            // ===== PROMPT NODE (Template Processing) =====
                            case "prompt": {
                                const template = node.data?.template || node.data?.prompt || ""
                                const variables = node.data?.variables || {}

                                // Interpolate with inputs
                                let processedPrompt = interpolateVariables(template, inputs)

                                // Also interpolate named variables {{varName}}
                                Object.entries(variables).forEach(([key, value]) => {
                                    processedPrompt = processedPrompt.split(`{{${key}}}`).join(String(value))
                                })

                                // If systemPrompt exists, combine
                                if (node.data?.systemPrompt) {
                                    output = {
                                        systemPrompt: node.data.systemPrompt,
                                        userPrompt: processedPrompt,
                                        combined: `${node.data.systemPrompt}\n\n${processedPrompt}`,
                                    }
                                } else {
                                    output = processedPrompt
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== LLM NODE (AI Text Generation) =====
                            case "llm": {
                                let prompt = ""
                                let systemPrompt = node.data?.systemPrompt || ""

                                // Handle different input types
                                if (inputs.length > 0) {
                                    const firstInput = inputs[0]
                                    if (typeof firstInput === "object" && firstInput.combined) {
                                        prompt = firstInput.combined
                                    } else if (typeof firstInput === "object" && firstInput.userPrompt) {
                                        systemPrompt = firstInput.systemPrompt || systemPrompt
                                        prompt = firstInput.userPrompt
                                    } else {
                                        prompt = String(firstInput)
                                    }
                                } else {
                                    prompt = node.data?.prompt || ""
                                }

                                if (process.env.OPENAI_API_KEY) {
                                    const messages: any[] = []
                                    if (systemPrompt) {
                                        messages.push({ role: "system", content: systemPrompt })
                                    }
                                    messages.push({ role: "user", content: prompt })

                                    const textResult = await generateText({
                                        model: openai(node.data?.model || "gpt-4o"),
                                        messages,
                                        temperature: node.data?.temperature || 0.7,
                                        maxOutputTokens: node.data?.maxTokens || 2000,
                                    })
                                    output = textResult.text
                                } else {
                                    output = `[Mock LLM] ${prompt.substring(0, 100)}...`
                                    await new Promise(resolve => setTimeout(resolve, 500))
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output: { text: output, model: node.data?.model || "gpt-4o" },
                                })
                                break
                            }

                            // ===== ROUTER NODE (AI Intent Classification) =====
                            case "router": {
                                const inputStr = inputs.length > 0 ? String(inputs[0]) : ""
                                const routes = node.data?.routes || []
                                const useAI = node.data?.useAI !== false

                                if (useAI && routes.length > 0 && process.env.OPENAI_API_KEY) {
                                    // AI-based intent classification
                                    const selectedRoute = await classifyIntent(inputStr, routes)
                                    output = {
                                        selectedRoute,
                                        input: inputStr,
                                        allRoutes: routes.map((r: any) => r.name),
                                    }
                                } else {
                                    // Keyword-based fallback
                                    let result = "default"
                                    if (node.data?.keywords) {
                                        const keywords = node.data.keywords.split(",").map((k: string) => k.trim())
                                        const matched = keywords.find((k: string) => inputStr.toLowerCase().includes(k.toLowerCase()))
                                        if (matched) result = matched
                                    }
                                    output = result
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== JAVASCRIPT NODE (Sandboxed Code Execution) =====
                            case "javascript":
                            case "function": {
                                const code = node.data?.code || node.data?.function || "return input"
                                output = await executeJavaScript(code, inputs)

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== MEMORY NODE (Context Storage/Retrieval) =====
                            case "memory": {
                                const operation = node.data?.operation || "load"
                                const memoryKey = node.data?.key || "context"
                                const memoryAgentId = node.data?.agentId || agentId

                                if (operation === "save") {
                                    const valueToSave = inputs[0] || node.data?.value
                                    await saveToMemory(memoryAgentId, memoryKey, valueToSave)
                                    output = { saved: true, key: memoryKey, value: valueToSave }
                                } else if (operation === "load") {
                                    const loadedValue = await loadFromMemory(memoryAgentId, memoryKey)
                                    output = loadedValue || node.data?.defaultValue || null
                                } else if (operation === "loadAll") {
                                    output = await loadFromMemory(memoryAgentId)
                                } else if (operation === "append") {
                                    const existing = await loadFromMemory(memoryAgentId, memoryKey)
                                    const newValue = inputs[0]
                                    const appended = Array.isArray(existing)
                                        ? [...existing, newValue]
                                        : existing
                                        ? [existing, newValue]
                                        : [newValue]
                                    await saveToMemory(memoryAgentId, memoryKey, appended)
                                    output = { appended: true, key: memoryKey, value: appended }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== RAG NODE (Vector Search) =====
                            case "rag": {
                                const query = inputs[0] || node.data?.query || ""
                                const collectionId = node.data?.collectionId || "default"
                                const topK = node.data?.topK || 5

                                if (process.env.OPENAI_API_KEY) {
                                    const searchResults = await ragSearch(String(query), collectionId, topK)

                                    // Format results as context
                                    const context = searchResults
                                        .map((r: any) => r.content || r.text || "")
                                        .filter(Boolean)
                                        .join("\n\n---\n\n")

                                    output = {
                                        query,
                                        results: searchResults,
                                        context,
                                        count: searchResults.length,
                                    }
                                } else {
                                    output = {
                                        query,
                                        results: [],
                                        context: "[Mock RAG] No results",
                                        count: 0,
                                    }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== EMBEDDING NODE (Vector Generation) =====
                            case "embedding": {
                                const textToEmbed = inputs[0] || node.data?.text || ""

                                if (process.env.OPENAI_API_KEY) {
                                    const embedding = await generateEmbedding(String(textToEmbed))
                                    output = {
                                        text: textToEmbed,
                                        embedding,
                                        dimensions: embedding.length,
                                    }
                                } else {
                                    output = {
                                        text: textToEmbed,
                                        embedding: new Array(1536).fill(0),
                                        dimensions: 1536,
                                        mock: true,
                                    }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== IMAGE GENERATION NODE (DALL-E) =====
                            case "image_generation": {
                                const imagePrompt = inputs[0] || node.data?.prompt || ""
                                const size = node.data?.size || "1024x1024"

                                if (process.env.OPENAI_API_KEY) {
                                    const imageUrl = await generateImage(String(imagePrompt), size)
                                    output = {
                                        prompt: imagePrompt,
                                        imageUrl,
                                        size,
                                    }
                                } else {
                                    output = {
                                        prompt: imagePrompt,
                                        imageUrl: "https://via.placeholder.com/1024",
                                        size,
                                        mock: true,
                                    }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== TOOL NODE (HTTP/API Call) =====
                            case "tool":
                            case "custom_tool": {
                                let url = node.data?.url || ""
                                const method = node.data?.method || "GET"

                                if (inputs.length > 0) {
                                    url = interpolateVariables(url, inputs)
                                }

                                const headers: Record<string, string> = {
                                    "Content-Type": "application/json",
                                }
                                if (node.data?.headers) {
                                    try {
                                        Object.assign(headers, JSON.parse(node.data.headers))
                                    } catch (e) {
                                        // Invalid JSON, ignore
                                    }
                                }

                                let body = node.data?.body || ""
                                if (body && inputs.length > 0) {
                                    body = interpolateVariables(body, inputs)
                                }

                                if (url) {
                                    try {
                                        const fetchOptions: RequestInit = { method, headers }
                                        if (method !== "GET" && method !== "HEAD" && body) {
                                            fetchOptions.body = body
                                        }
                                        const response = await fetch(url, fetchOptions)
                                        const contentType = response.headers.get("content-type")
                                        if (contentType?.includes("application/json")) {
                                            output = await response.json()
                                        } else {
                                            output = await response.text()
                                        }
                                    } catch (fetchError: any) {
                                        throw new Error(`Tool execution failed: ${fetchError.message}`)
                                    }
                                } else {
                                    output = { message: "Tool executed", inputs }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== ACTIVEPIECES NODE (Automation Flows) =====
                            case "activepieces": {
                                const triggerType = node.data?.activepiecesTriggerType || "manual"
                                const flowId = node.data?.activepiecesFlowId
                                const webhookUrl = node.data?.activepiecesWebhookUrl
                                const waitForCompletion = node.data?.activepiecesWaitForCompletion !== false
                                const flowInputs = node.data?.activepiecesInputs || {}

                                // Merge node inputs with configured inputs
                                const payload = {
                                    ...flowInputs,
                                    ...(inputs[0] && typeof inputs[0] === 'object' ? inputs[0] : { input: inputs[0] }),
                                }

                                try {
                                    if (triggerType === "webhook" && webhookUrl) {
                                        // Webhook trigger
                                        output = await getActivepiecesClient().triggerWebhook(webhookUrl, payload)
                                    } else if (flowId) {
                                        // Manual trigger with Flow ID
                                        const run = await getActivepiecesClient().runFlow(flowId, payload)

                                        if (waitForCompletion) {
                                            // Wait for flow to complete
                                            const completedRun = await getActivepiecesClient().waitForCompletion(run.id, 55000)
                                            output = {
                                                runId: completedRun.id,
                                                status: completedRun.status,
                                                output: completedRun.output,
                                                error: completedRun.error,
                                            }
                                        } else {
                                            // Return immediately
                                            output = {
                                                runId: run.id,
                                                status: run.status,
                                                message: "Flow triggered (async)",
                                            }
                                        }
                                    } else {
                                        throw new Error("Activepieces: Flow ID or Webhook URL required")
                                    }
                                } catch (apError: any) {
                                    // Check if Activepieces is running
                                    const isHealthy = await getActivepiecesClient().healthCheck()
                                    if (!isHealthy) {
                                        throw new Error("Activepieces is not running. Start with: cd docker/activepieces && docker-compose up -d")
                                    }
                                    throw new Error(`Activepieces error: ${apError.message}`)
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== CHAIN NODE (Sequential Processing) =====
                            case "chain": {
                                // Chain combines multiple inputs sequentially
                                const chainSteps = node.data?.steps || []
                                let chainResult = inputs[0]

                                for (const step of chainSteps) {
                                    if (step.type === "transform") {
                                        chainResult = await executeJavaScript(step.code, [chainResult])
                                    } else if (step.type === "llm") {
                                        const stepResult = await generateText({
                                            model: openai(step.model || "gpt-4o-mini"),
                                            prompt: `${step.prompt}\n\nInput: ${JSON.stringify(chainResult)}`,
                                            temperature: step.temperature || 0.7,
                                        })
                                        chainResult = stepResult.text
                                    }
                                }

                                output = chainResult

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== EVALUATOR NODE (Result Validation) =====
                            case "evaluator": {
                                const criteria = node.data?.criteria || "quality"
                                const inputToEvaluate = inputs[0]

                                if (process.env.OPENAI_API_KEY) {
                                    const evalResult = await generateText({
                                        model: openai("gpt-4o-mini"),
                                        prompt: `다음 내용을 "${criteria}" 기준으로 1-10점 척도로 평가하세요.

평가 대상:
${JSON.stringify(inputToEvaluate, null, 2)}

다음 JSON 형식으로만 응답하세요:
{"score": 숫자, "reasoning": "평가 이유", "suggestions": ["개선 제안1", "개선 제안2"]}`,
                                        temperature: 0,
                                    })

                                    try {
                                        output = JSON.parse(evalResult.text)
                                    } catch {
                                        output = { score: 5, reasoning: evalResult.text, suggestions: [] }
                                    }
                                } else {
                                    output = { score: 7, reasoning: "Mock evaluation", suggestions: [], mock: true }
                                }

                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
                                break
                            }

                            // ===== DEFAULT (Unknown Node Type) =====
                            default:
                                output = {
                                    message: `Unknown node type: ${nodeType}`,
                                    inputs,
                                    passthrough: inputs[0] || null,
                                }
                                executionLog.push({
                                    nodeId,
                                    type: nodeType,
                                    output,
                                })
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
