export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import type { DeployedAgent } from '@/types/database'

// 업무지시 모드에서 사용 가능한 모델 목록
const TASK_MODE_MODELS = [
  { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', provider: 'xai' },
  { id: 'grok-4-1', name: 'Grok 4.1', provider: 'xai' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', provider: 'anthropic' },
]

// 특수 액션 타입 정의
type ActionType = 'project_create' | 'task_create' | 'general'

// 인텐트 감지 함수
function detectIntent(instruction: string): { actionType: ActionType; extractedData: any } {
  console.log('[detectIntent] Analyzing instruction:', instruction)

  // 프로젝트 생성 인텐트 감지 (한국어/영어)
  const projectCreatePatterns = [
    /프로젝트\s*(를|을)?\s*(만들|생성|추가|새로)/i,
    /새\s*(로운|)?\s*프로젝트/i,
    /프로젝트\s*하나\s*(만들|생성)/i,
    /프로젝트.*만들어/i,
    /프로젝트.*생성해/i,
    /create\s*project/i,
    /new\s*project/i,
  ]

  for (const pattern of projectCreatePatterns) {
    if (pattern.test(instruction)) {
      console.log('[detectIntent] Matched project_create pattern:', pattern)
      // 프로젝트명 추출 시도
      const nameMatch = instruction.match(/["']([^"']+)["']/) ||
                        instruction.match(/프로젝트\s*(?:이름은?|명은?)?\s*(.+?)(?:로|으로|라고|해|$)/)
      const suggestedName = nameMatch?.[1]?.trim() || null
      console.log('[detectIntent] Extracted name:', suggestedName)
      return {
        actionType: 'project_create',
        extractedData: {
          suggestedName
        }
      }
    }
  }

  console.log('[detectIntent] No special intent detected, using general')
  return { actionType: 'general', extractedData: null }
}

// POST: 업무 지시 분석 - 에이전트가 사용자의 불명확한 지시를 분석하고 정리
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { instruction, agent_id, task_model = 'grok-4-1-fast' } = body
    console.log('[TaskAnalyze] Request:', { instruction, agent_id, task_model })

    if (!instruction || !agent_id) {
      return NextResponse.json(
        { error: 'instruction과 agent_id가 필요합니다' },
        { status: 400 }
      )
    }

    // Get agent info
    const dbClient = isDevMode() ? adminClient : supabase
    const { data: agent, error: agentError } = await (dbClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: '에이전트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 인텐트 감지
    const { actionType, extractedData } = detectIntent(instruction)

    // 프로젝트 생성 인텐트인 경우 특별 처리
    if (actionType === 'project_create') {
      console.log('[TaskAnalyze] Detected project_create action, returning form fields')
      return NextResponse.json({
        action_type: 'project_create',
        confirmation_message: generateProjectCreateMessage(agent, extractedData?.suggestedName),
        extracted_data: extractedData,
        agent: {
          id: agent.id,
          name: agent.name,
          avatar_url: agent.avatar_url
        },
        requires_input: true,
        input_fields: [
          { name: 'name', label: '프로젝트 이름', type: 'text', required: true, placeholder: '예: 신규 마케팅 캠페인' },
          { name: 'description', label: '설명', type: 'textarea', required: false, placeholder: '프로젝트에 대한 간단한 설명' },
          { name: 'priority', label: '우선순위', type: 'select', required: false, options: [
            { value: 'low', label: '낮음' },
            { value: 'medium', label: '보통' },
            { value: 'high', label: '높음' },
            { value: 'urgent', label: '긴급' }
          ]},
          { name: 'deadline', label: '마감일', type: 'date', required: false }
        ]
      })
    }

    // 선택된 모델로 업무 분석 (업무지시 모드)
    const selectedModel = TASK_MODE_MODELS.find(m => m.id === task_model) || TASK_MODE_MODELS[0]

    let model
    if (selectedModel.provider === 'xai') {
      // Grok (XAI) - OpenAI compatible API
      model = new ChatOpenAI({
        modelName: selectedModel.id,
        temperature: 0.3,
        openAIApiKey: process.env.XAI_API_KEY,
        configuration: {
          baseURL: 'https://api.x.ai/v1',
        },
      })
    } else if (selectedModel.provider === 'google') {
      model = new ChatGoogleGenerativeAI({
        model: selectedModel.id,
        temperature: 0.3,
        apiKey: process.env.GOOGLE_API_KEY,
      })
    } else if (selectedModel.provider === 'anthropic') {
      // ⚠️ Anthropic API 사용 금지 - OpenAI로 fallback
      console.warn('[TaskAnalyze] Anthropic API 사용 금지 - OpenAI로 fallback')
      model = new ChatOpenAI({
        modelName: 'gpt-4o',
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      })
    } else {
      // OpenAI
      model = new ChatOpenAI({
        modelName: selectedModel.id,
        temperature: 0.3,
        openAIApiKey: process.env.OPENAI_API_KEY,
      })
    }

    console.log(`[TaskAnalyze] Using model: ${selectedModel.name} (${selectedModel.id})`)

    const analysisPrompt = `당신은 "${agent.name}"이라는 AI 에이전트입니다.
${agent.system_prompt ? `당신의 역할: ${agent.system_prompt}` : ''}

사용자가 다음과 같이 업무를 지시했습니다:
"${instruction}"

이 업무 지시를 분석하고 다음 JSON 형식으로 정리해주세요:

{
  "title": "업무 제목 (간단명료하게)",
  "summary": "업무 내용 요약 (1-2문장)",
  "steps": ["단계1", "단계2", "..."],
  "expected_output": "예상 결과물 설명",
  "estimated_time": "예상 소요 시간",
  "clarifications": ["불명확한 부분이 있다면 질문", "..."],
  "confidence": 0.0~1.0 사이의 이해도 점수
}

사용자가 대충 말해도 찰떡같이 알아듣고, 명확하게 정리해주세요.
JSON만 응답하세요.`

    const response = await model.invoke(analysisPrompt)
    const content = response.content as string

    // Parse JSON from response
    let analysis
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('JSON not found in response')
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError)
      // Fallback: create a basic analysis
      analysis = {
        title: instruction.slice(0, 50),
        summary: instruction,
        steps: ['지시 내용 수행'],
        expected_output: '업무 수행 결과',
        estimated_time: '미정',
        clarifications: [],
        confidence: 0.7
      }
    }

    // Generate a friendly confirmation message
    const confirmationMessage = generateConfirmationMessage(agent, analysis)

    return NextResponse.json({
      analysis,
      confirmation_message: confirmationMessage,
      agent: {
        id: agent.id,
        name: agent.name,
        avatar_url: agent.avatar_url
      }
    })
  } catch (error) {
    console.error('업무 분석 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

function generateConfirmationMessage(agent: DeployedAgent, analysis: any): string {
  let message = `알겠습니다! 말씀하신 내용을 정리해볼게요.\n\n`
  message += `📋 **${analysis.title}**\n\n`
  message += `${analysis.summary}\n\n`

  if (analysis.steps && analysis.steps.length > 0) {
    message += `**수행 단계:**\n`
    analysis.steps.forEach((step: string, i: number) => {
      message += `${i + 1}. ${step}\n`
    })
    message += `\n`
  }

  if (analysis.expected_output) {
    message += `**예상 결과물:** ${analysis.expected_output}\n`
  }

  if (analysis.estimated_time) {
    message += `**예상 소요 시간:** ${analysis.estimated_time}\n`
  }

  if (analysis.clarifications && analysis.clarifications.length > 0) {
    message += `\n⚠️ **확인이 필요한 부분:**\n`
    analysis.clarifications.forEach((q: string) => {
      message += `- ${q}\n`
    })
  }

  message += `\n이대로 진행할까요?`

  return message
}

// 프로젝트 생성 확인 메시지 생성
function generateProjectCreateMessage(agent: DeployedAgent, suggestedName?: string | null): string {
  let message = `네, 프로젝트를 생성해드릴게요!\n\n`

  if (suggestedName) {
    message += `말씀하신 "${suggestedName}" 프로젝트를 만들까요?\n\n`
  }

  message += `아래 세부사항을 입력해주시면 바로 생성해드리겠습니다.\n`
  message += `필수 항목은 프로젝트 이름만 있어요. 나머지는 선택사항입니다.`

  return message
}
