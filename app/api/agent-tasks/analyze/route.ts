import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { ChatOpenAI } from '@langchain/openai'
import type { DeployedAgent } from '@/types/database'

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
    const { instruction, agent_id } = body

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

    // Use OpenAI to analyze the instruction
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

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
