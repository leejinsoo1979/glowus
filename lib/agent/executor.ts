import { ChatOpenAI } from '@langchain/openai'
import { ChatOllama } from '@langchain/ollama'
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { getToolsByNames, getAllToolNames, MCPToolName, ALL_TOOLS } from './tools'
import { loadAgentApiConnections, createAllApiTools, generateApiToolsDescription } from './api-tool'
import { getRAGContext, hasKnowledge } from '@/lib/rag/retriever'
import { getDefaultModel } from '@/lib/llm/models'
import type { LLMProvider } from '@/lib/llm/models'
import type { DeployedAgent, AgentTask } from '@/types/database'

export interface ExecutionResult {
  success: boolean
  output: string
  sources: string[]
  toolsUsed: string[]
  error?: string
}

/**
 * Execute an agent task with MCP tools using tool calling
 */
export async function executeAgentWithTools(
  agent: DeployedAgent,
  task: AgentTask
): Promise<ExecutionResult> {
  try {
    // Determine which tools the agent can use
    const agentCapabilities = agent.capabilities || []
    const enabledTools: MCPToolName[] = []

    // Helper function to check if any capability matches (case-insensitive, supports Korean)
    const hasCapability = (...keywords: string[]) => {
      return agentCapabilities.some(cap => {
        const capLower = cap.toLowerCase()
        return keywords.some(kw => capLower.includes(kw.toLowerCase()))
      })
    }

    // Map capabilities to tools (supports English and Korean capability names)
    if (hasCapability('web_search', 'research', '검색', '리서치', '조사')) {
      enabledTools.push('web_search')
    }
    if (hasCapability('youtube', 'youtube_transcript', '유튜브', 'yt', '동영상', '영상 분석')) {
      enabledTools.push('youtube_transcript')
    }
    if (hasCapability('web_fetch', 'web_browse', '웹', '크롤링', '스크래핑')) {
      enabledTools.push('web_fetch')
    }

    // If no specific tools enabled, enable all by default
    const mcpTools = enabledTools.length > 0
      ? getToolsByNames(enabledTools)
      : getToolsByNames(getAllToolNames())

    // Load API connections and create API tools
    const apiConnections = await loadAgentApiConnections(agent.id)
    const apiTools = createAllApiTools(apiConnections)
    const apiToolsDescription = generateApiToolsDescription(apiConnections)

    // Combine MCP tools and API tools
    const tools: DynamicStructuredTool[] = [...mcpTools, ...apiTools]

    console.log(`Agent "${agent.name}" executing with tools:`, tools.map(t => t.name))
    if (apiTools.length > 0) {
      console.log(`  - API tools: ${apiTools.map(t => t.name).join(', ')}`)
    }

    // 🔥 RAG 지식베이스 컨텍스트 가져오기
    let ragContextText = ''
    let ragSources: string[] = []
    const agentHasKnowledge = await hasKnowledge(agent.id)
    if (agentHasKnowledge) {
      console.log(`  - Agent has knowledge base, fetching relevant context...`)
      const ragResult = await getRAGContext(agent.id, task.instructions)
      if (ragResult && ragResult.contextText) {
        ragContextText = ragResult.contextText
        ragSources = ragResult.sourcesUsed || []
        console.log(`  - RAG context retrieved (${ragContextText.length} chars, ${ragSources.length} sources)`)
      }
    }

    // 🔥 에이전트의 LLM 설정 사용
    const provider = (agent.llm_provider || 'openai') as LLMProvider
    let model = agent.model || getDefaultModel(provider)

    // Create LLM with tool support based on provider
    let llm: any
    switch (provider) {
      case 'grok':
        llm = new ChatOpenAI({
          modelName: model,
          temperature: agent.temperature || 0.3,
          apiKey: process.env.XAI_API_KEY,
          configuration: { baseURL: 'https://api.x.ai/v1' },
        })
        break
      case 'gemini':
        llm = new ChatOpenAI({
          modelName: model,
          temperature: agent.temperature || 0.3,
          apiKey: process.env.GOOGLE_API_KEY,
          configuration: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' },
        })
        break
      case 'ollama':
        llm = new ChatOllama({
          model: model,
          temperature: agent.temperature || 0.3,
          baseUrl: 'http://localhost:11434',
        })
        break
      default:
        // OpenAI or fallback
        if (model.startsWith('gpt-4') && !model.includes('gpt-4o')) {
          model = 'gpt-4o-mini'
        }
        llm = new ChatOpenAI({
          modelName: model,
          temperature: agent.temperature || 0.3,
          openAIApiKey: process.env.OPENAI_API_KEY,
        })
    }

    console.log(`  - LLM: ${provider}/${model}`)

    // Bind tools to LLM
    const llmWithTools = llm.bindTools(tools)

    // Create system prompt with RAG context
    const knowledgeSection = ragContextText ? `
## 📚 내 지식베이스
다음은 업무와 관련된 내가 알고 있는 정보입니다. 이 정보를 최우선으로 활용하세요:

${ragContextText}

---
` : ''

    const systemPrompt = `${agent.system_prompt || `당신은 ${agent.name}입니다.`}
${knowledgeSection}
## 🔧 사용 가능한 도구
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}
${apiToolsDescription}

## 📋 현재 업무
- 제목: ${task.title}
- 설명: ${task.description || '없음'}
- 지시사항: ${task.instructions}

## ⚠️ 중요 지침
1. **지식베이스 최우선**: 위에 지식베이스가 있으면 그 정보를 가장 먼저 활용하세요!
2. 필요한 정보를 얻기 위해 적절한 도구를 사용하세요.
3. YouTube URL이 있으면 youtube_transcript 도구를 사용해 자막을 가져오세요.
4. 웹 검색이 필요하면 web_search 도구를 사용하세요.
5. 외부 API가 연결되어 있으면 해당 API 도구를 적극 활용하세요.
6. 모든 답변은 지식베이스 또는 도구에서 얻은 실제 데이터를 기반으로 하세요.
7. 출처를 반드시 명시하세요 (지식베이스 출처 포함).
8. 절대로 정보를 지어내지 마세요.`

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(task.instructions),
    ]

    const sources: string[] = [...ragSources]  // RAG 출처 먼저 추가
    const toolsUsed: string[] = ragContextText ? ['knowledge_base'] : []  // 지식베이스 사용 시 기록

    // Run agent loop with tool calling
    let iterations = 0
    const maxIterations = 5

    while (iterations < maxIterations) {
      iterations++

      const response = await llmWithTools.invoke(messages)

      // Check if there are tool calls
      const toolCalls = response.tool_calls || []

      if (toolCalls.length === 0) {
        // No more tool calls, we have the final answer
        let output = typeof response.content === 'string'
          ? response.content
          : '작업을 완료했습니다.'

        // Append sources
        if (sources.length > 0) {
          output += '\n\n---\n📎 출처:\n'
          const uniqueSources = Array.from(new Set(sources))
          uniqueSources.forEach((src, idx) => {
            output += `${idx + 1}. ${src}\n`
          })
        }

        // Append tools used
        if (toolsUsed.length > 0) {
          output += `\n🔧 사용한 도구: ${toolsUsed.join(', ')}`
        }

        return {
          success: true,
          output,
          sources: Array.from(new Set(sources)),
          toolsUsed,
        }
      }

      // Process tool calls
      messages.push(response as AIMessage)

      for (const toolCall of toolCalls) {
        const toolName = toolCall.name
        const toolArgs = toolCall.args as Record<string, unknown>

        console.log(`Calling tool: ${toolName}`, toolArgs)

        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName)
        }

        // Execute the tool - first check ALL_TOOLS (MCP tools), then check dynamically created tools
        let tool = ALL_TOOLS[toolName as MCPToolName]
        if (!tool) {
          // Look for the tool in the combined tools array (includes API tools)
          tool = tools.find(t => t.name === toolName) as any
        }

        let toolResult = ''

        if (tool) {
          try {
            // Execute the tool using func
            toolResult = await tool.func(toolArgs as any)

            // Try to extract sources from tool result
            try {
              const parsed = JSON.parse(toolResult)
              if (parsed.sources) {
                sources.push(...parsed.sources)
              }
              if (parsed.url) {
                sources.push(parsed.url)
              }
              if (parsed.videoUrl) {
                sources.push(parsed.videoUrl)
              }
              // API 도구에서 data에 URL이 있으면 추가
              if (parsed.data?.url) {
                sources.push(parsed.data.url)
              }
            } catch {
              // Not JSON, skip
            }
          } catch (error) {
            toolResult = JSON.stringify({ error: `도구 실행 오류: ${error}` })
          }
        } else {
          toolResult = JSON.stringify({ error: `알 수 없는 도구: ${toolName}` })
        }

        // Add tool result as ToolMessage with tool_call_id
        messages.push(new ToolMessage({
          content: toolResult,
          tool_call_id: toolCall.id || `call_${toolName}_${Date.now()}`,
          name: toolName,
        }))
      }
    }

    // Max iterations reached
    return {
      success: true,
      output: '작업을 완료했지만 최대 반복 횟수에 도달했습니다.',
      sources: Array.from(new Set(sources)),
      toolsUsed,
    }
  } catch (error) {
    console.error('Agent execution error:', error)
    return {
      success: false,
      output: '',
      sources: [],
      toolsUsed: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    }
  }
}
