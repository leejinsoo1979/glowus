import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, BaseMessage } from '@langchain/core/messages'
import { getToolsByNames, getAllToolNames, MCPToolName, ALL_TOOLS } from './tools'
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

    // Map capabilities to tools
    if (agentCapabilities.includes('web_search') || agentCapabilities.includes('research')) {
      enabledTools.push('web_search')
    }
    if (agentCapabilities.includes('youtube') || agentCapabilities.includes('youtube_transcript')) {
      enabledTools.push('youtube_transcript')
    }
    if (agentCapabilities.includes('web_fetch') || agentCapabilities.includes('web_browse')) {
      enabledTools.push('web_fetch')
    }

    // If no specific tools enabled, enable all by default
    const tools = enabledTools.length > 0
      ? getToolsByNames(enabledTools)
      : getToolsByNames(getAllToolNames())

    console.log(`Agent "${agent.name}" executing with tools:`, tools.map(t => t.name))

    // Get safe model
    let model = agent.model || 'gpt-4o-mini'
    if (model.startsWith('gpt-4') && !model.includes('gpt-4o')) {
      model = 'gpt-4o-mini'
    }

    // Create LLM with tool support
    const llm = new ChatOpenAI({
      modelName: model,
      temperature: agent.temperature || 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    // Bind tools to LLM
    const llmWithTools = llm.bindTools(tools)

    // Create system prompt
    const systemPrompt = `${agent.system_prompt || `당신은 ${agent.name}입니다.`}

당신은 다음 도구들을 사용할 수 있습니다:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

현재 업무:
- 제목: ${task.title}
- 설명: ${task.description || '없음'}

중요 지침:
1. 필요한 정보를 얻기 위해 적절한 도구를 사용하세요.
2. YouTube URL이 있으면 youtube_transcript 도구를 사용해 자막을 가져오세요.
3. 웹 검색이 필요하면 web_search 도구를 사용하세요.
4. 모든 답변은 도구에서 얻은 실제 데이터를 기반으로 하세요.
5. 출처를 반드시 명시하세요.
6. 절대로 정보를 지어내지 마세요.`

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(task.instructions),
    ]

    const sources: string[] = []
    const toolsUsed: string[] = []

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
        const toolName = toolCall.name as MCPToolName
        const toolArgs = toolCall.args as Record<string, unknown>

        console.log(`Calling tool: ${toolName}`, toolArgs)

        if (!toolsUsed.includes(toolName)) {
          toolsUsed.push(toolName)
        }

        // Execute the tool
        const tool = ALL_TOOLS[toolName]
        let toolResult = ''

        if (tool) {
          try {
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
