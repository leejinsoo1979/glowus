export const dynamic = 'force-dynamic'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import {
  generateSuperAgentResponseStream,
  SuperAgentMessage,
  StreamEvent,
} from '@/lib/ai/super-agent-chat'
import { getLLMConfigForAgent } from '@/lib/llm/user-keys'
import { checkCredits, deductCredits } from '@/lib/credits'
// 🧠 JARVIS Long-term Memory (RAG)
import {
  buildJarvisContext,
  saveConversationMessage,
  analyzeAndLearn,
} from '@/lib/memory/jarvis-memory-manager'
// 🔥 컨텍스트 빌더들 (기존 API 라우트와 동일)
import {
  loadAgentWorkContext,
  formatContextForPrompt,
} from '@/lib/agent/work-memory'
import { loadAndFormatCompanyContext } from '@/lib/context/company-context'
import {
  buildKnowledgeContext,
  formatKnowledgeForPrompt,
} from '@/lib/memory/agent-knowledge-service'
// 🤝 Agent OS - Relationship & Stats tracking
import { processConversation } from '@/lib/memory/agent-os'
import {
  buildContextPackForChat,
  wrapContextPackForSystemPrompt,
  extractKeywordsFromMessage,
} from '@/lib/neural-map/context-pack-service'

/**
 * SSE 스트리밍 채팅 엔드포인트
 * - 실시간으로 에이전트의 사고 과정, 도구 사용, 응답 표시
 * - 젠스파크/Manus 스타일 진행 상황 표시
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder()

  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', error: '인증이 필요합니다' })}\n\n`),
        {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    const body = await request.json()
    const { message, conversation_history = [], projectPath } = body

    if (!message || typeof message !== 'string') {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', error: '메시지가 필요합니다' })}\n\n`),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // 에이전트 조회
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', error: '에이전트를 찾을 수 없습니다' })}\n\n`),
        {
          status: 404,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // 에이전트 정체성 조회
    const { data: identity } = await (adminClient as any)
      .from('agent_identity')
      .select('*')
      .eq('agent_id', agentId)
      .single()

    // 사용자 프로필 조회
    const { data: userProfile } = await (adminClient as any)
      .from('users')
      .select('name, job_title')
      .eq('id', user.id)
      .single()

    // 사용자 LLM API 키 가져오기
    let userApiKey: string | undefined
    let useUserKey = false  // 사용자 키 사용 여부 (크레딧 차감 결정용)
    try {
      const provider = agent.llm_provider || 'grok'
      const llmConfig = await getLLMConfigForAgent(user.id, provider)
      userApiKey = llmConfig.apiKey
      useUserKey = llmConfig.useUserKey
      if (llmConfig.useUserKey) {
        console.log(`[StreamChat] Using user's ${provider} API key (no credits charged)`)
      }
    } catch (keyError) {
      console.warn('[StreamChat] Failed to fetch user LLM key:', keyError)
    }

    // 🔥 크레딧 확인 (사용자 키 사용 시 스킵)
    let creditCost = 0
    let creditAction = ''
    if (!useUserKey) {
      const provider = agent.llm_provider || 'grok'
      const model = agent.model || ''

      if (provider === 'grok' || model.includes('grok')) {
        creditCost = 1
        creditAction = 'chat_grok_fast'
      } else if (provider === 'openai' || model.includes('gpt-4')) {
        creditCost = 10
        creditAction = 'chat_gpt4o'
      } else if (provider === 'anthropic' || model.includes('claude')) {
        creditCost = 15
        creditAction = 'chat_claude'
      } else {
        creditCost = 3
        creditAction = 'chat_other'
      }

      const creditCheck = await checkCredits(user.id, creditCost)
      if (!creditCheck.canUse) {
        return new Response(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: '크레딧이 부족합니다',
            code: 'INSUFFICIENT_CREDITS',
            required: creditCost,
            balance: creditCheck.balance + creditCheck.dailyBalance,
            tier: creditCheck.tier,
          })}\n\n`),
          {
            status: 402,
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          }
        )
      }
      console.log(`[StreamChat] Credit check passed: ${creditCost} credits required`)
    }

    // 채팅 히스토리 변환
    const superAgentHistory: SuperAgentMessage[] = conversation_history.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })
    )

    const userName = userProfile?.name || user.email?.split('@')[0] || '사용자'

    // ========================================
    // 🔥 풍부한 컨텍스트 로드 (기존 API 라우트와 동일)
    // ========================================

    // 1. 에이전트 워크 컨텍스트 로드
    let workContextPrompt = ''
    try {
      const workContext = await loadAgentWorkContext(agentId, user.id)
      workContextPrompt = formatContextForPrompt(workContext)
      console.log(`[StreamChat] Work context loaded: ${workContextPrompt.length} chars`)
    } catch (contextError) {
      console.warn('[StreamChat] Work context load error:', contextError)
    }

    // 2. 회사 컨텍스트 로드
    let companyContextPrompt = ''
    try {
      companyContextPrompt = await loadAndFormatCompanyContext(agentId)
      if (companyContextPrompt) {
        console.log(`[StreamChat] Company context loaded: ${companyContextPrompt.length} chars`)
      }
    } catch (companyError) {
      console.warn('[StreamChat] Company context load error:', companyError)
    }

    // 3. 지식베이스 RAG 로드
    let knowledgeContextPrompt = ''
    try {
      const { context: knowledgeContext, sources } = await buildKnowledgeContext(
        agentId,
        message,
        { maxResults: 5, maxTokens: 3000 }
      )
      if (knowledgeContext) {
        knowledgeContextPrompt = formatKnowledgeForPrompt(knowledgeContext, sources)
        console.log(`[StreamChat] Knowledge context loaded: ${knowledgeContextPrompt.length} chars`)
      }
    } catch (knowledgeError) {
      console.warn('[StreamChat] Knowledge context load error:', knowledgeError)
    }

    // 4. Brain State (Context Pack) 로드
    let brainStatePrompt = ''
    try {
      const messageKeywords = extractKeywordsFromMessage(message)
      const contextPackResult = await buildContextPackForChat({
        userId: user.id,
        keywords: messageKeywords.length > 0 ? messageKeywords : undefined,
        stage: 'implementing',
        maxNeurons: 25,
      })
      if (contextPackResult.success && contextPackResult.formattedPrompt) {
        brainStatePrompt = wrapContextPackForSystemPrompt(contextPackResult.formattedPrompt)
        console.log(`[StreamChat] Brain State loaded: ${contextPackResult.totalNeurons} neurons`)
      }
    } catch (brainStateError) {
      console.warn('[StreamChat] Brain State load error:', brainStateError)
    }

    // 5. 🧠 JARVIS Long-term Memory (RAG) 로드
    let jarvisContextPrompt = ''
    try {
      const jarvisContext = await buildJarvisContext(agentId, user.id, message, {
        recentLimit: 10,
        ragLimit: 5,
        includeEpisodes: true,
      })
      jarvisContextPrompt = jarvisContext.formattedContext

      if (jarvisContext.userProfile) {
        console.log(`[StreamChat] JARVIS User: ${jarvisContext.userProfile.displayName || 'Unknown'}`)
        console.log(`[StreamChat] JARVIS Total conversations: ${jarvisContext.userProfile.totalConversations}`)
      }
      console.log(`[StreamChat] JARVIS context loaded: ${jarvisContextPrompt.length} chars`)
    } catch (jarvisError) {
      console.warn('[StreamChat] JARVIS context load error:', jarvisError)
    }

    // 전체 컨텍스트 병합 (기존 API 라우트와 동일 순서)
    const fullContextPrompt = [
      companyContextPrompt,
      knowledgeContextPrompt,
      brainStatePrompt,
      workContextPrompt,
      jarvisContextPrompt,  // 🧠 JARVIS 장기 기억 추가
    ].filter(Boolean).join('\n\n---\n\n')

    // SSE 스트리밍 응답
    const readable = new ReadableStream({
      async start(controller) {
        let finalResponse = ''
        let toolsUsed: string[] = []
        let streamSuccess = false

        try {
          const generator = generateSuperAgentResponseStream(
            { ...agent, identity, apiKey: userApiKey },
            message,
            superAgentHistory,
            {
              projectPath: projectPath || null,
              userName,
              userRole: userProfile?.job_title,
              workContext: fullContextPrompt || undefined,  // 🔥 풍부한 컨텍스트 전달!
              companyId: agent.company_id || null,
              userId: user.id,
              skipMemorySave: true,  // 🔥 API 라우트에서 메모리 저장하므로 중복 방지
            }
          )

          // 이벤트 스트리밍
          for await (const event of generator) {
            const data = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(data))

            // 최종 응답 추적
            if (event.type === 'text' && event.content) {
              finalResponse = event.content
            }

            // 도구 사용 추적
            if (event.type === 'tool_end' && event.tool?.name) {
              if (!toolsUsed.includes(event.tool.name)) {
                toolsUsed.push(event.tool.name)
              }
            }

            // done 이벤트면 종료
            if (event.type === 'done') {
              streamSuccess = true
              break
            }
            if (event.type === 'error') {
              break
            }
          }

          // 🔥 스트리밍 성공 시 후처리 (비동기)
          if (streamSuccess && finalResponse) {
            // 1. 크레딧 차감
            if (!useUserKey && creditCost > 0) {
              deductCredits(user.id, creditCost, { description: `에이전트 스트리밍 채팅: ${agent.name}` })
                .then(result => console.log(`[StreamChat] Credits charged: ${creditCost}, remaining: ${result.balance}`))
                .catch(err => console.error('[StreamChat] Credit deduction error:', err))
            }

            // 2. JARVIS 메모리 저장
            Promise.all([
              saveConversationMessage({
                agentId,
                userId: user.id,
                role: 'user',
                content: message,
                importance: 6,
                metadata: {},
              }),
              saveConversationMessage({
                agentId,
                userId: user.id,
                role: 'assistant',
                content: finalResponse,
                importance: 5,
                metadata: { toolsUsed, streamingMode: true },
              }),
              analyzeAndLearn(agentId, user.id, message, finalResponse),
            ]).catch(err => console.error('[StreamChat] JARVIS memory save error:', err))

            // 3. Agent OS - 관계 추적 및 학습
            processConversation({
              agentId,
              userId: user.id,
              messages: [
                { role: 'user', content: message },
                { role: 'assistant', content: finalResponse },
              ],
              wasHelpful: true,
            }).catch(err => console.error('[StreamChat] Agent OS error:', err))

            console.log(`[StreamChat] ✅ Stream completed, ${toolsUsed.length} tools used`)
          }

          controller.close()
        } catch (error: any) {
          console.error('[StreamChat] Error:', error)
          const errorEvent: StreamEvent = {
            type: 'error',
            error: error.message || '스트리밍 중 오류 발생',
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // nginx 버퍼링 비활성화
      },
    })
  } catch (error: any) {
    console.error('[StreamChat] Setup error:', error)
    return new Response(
      encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }
}
