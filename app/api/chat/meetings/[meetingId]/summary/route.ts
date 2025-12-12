import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

// POST: AI 회의 요약 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

    const devUser = getDevUserIfEnabled()
    let user: any = devUser

    if (!devUser) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    const { meetingId } = params

    // 회의록 조회
    const { data: meeting, error: meetingError } = await (adminClient as any)
      .from('meeting_records')
      .select('*')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // 이미 요약이 있으면 반환
    if (meeting.summary) {
      return NextResponse.json(meeting)
    }

    // 회의 기간 동안의 모든 메시지 조회
    const { data: messages, error: msgError } = await (adminClient as any)
      .from('chat_messages')
      .select(`
        id,
        content,
        message_type,
        sender_type,
        sender_id,
        metadata,
        created_at
      `)
      .eq('room_id', meeting.room_id)
      .gte('created_at', meeting.started_at)
      .lte('created_at', meeting.ended_at)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('[Meeting Summary] Message query error:', msgError)
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages found for this meeting' }, { status: 400 })
    }

    // 사용자 및 에이전트 정보 조회
    const userIds = Array.from(new Set(messages.filter((m: any) => m.sender_type === 'user').map((m: any) => m.sender_id))) as string[]
    const agentIds = Array.from(new Set(messages.filter((m: any) => m.sender_type === 'agent').map((m: any) => m.sender_id))) as string[]

    // 사용자 이름 조회
    const { data: users } = await (adminClient as any)
      .from('users')
      .select('id, name')
      .in('id', userIds)

    // 에이전트 이름 조회
    const { data: agents } = await (adminClient as any)
      .from('deployed_agents')
      .select('id, name')
      .in('id', agentIds)

    const userMap = new Map((users || []).map((u: any) => [u.id, u.name]))
    const agentMap = new Map((agents || []).map((a: any) => [a.id, a.name]))

    // 대화 내용 포맷팅
    const formattedMessages = messages
      .filter((m: any) => m.message_type === 'text' || m.message_type === 'agent')
      .map((m: any) => {
        const senderName = m.sender_type === 'user'
          ? userMap.get(m.sender_id) || '사용자'
          : agentMap.get(m.sender_id) || 'AI 에이전트'
        const time = new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        return `[${time}] ${senderName}: ${m.content}`
      })
      .join('\n')

    // OpenAI API로 요약 생성
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    const systemPrompt = `당신은 회의 내용을 분석하고 요약하는 전문가입니다.
다음 회의 대화 내용을 분석하여 JSON 형식으로 요약해주세요.

응답 형식:
{
  "summary": "회의 전체 요약 (2-3문장)",
  "key_points": ["주요 논의 사항 1", "주요 논의 사항 2", ...],
  "action_items": ["해야 할 일 1", "해야 할 일 2", ...],
  "decisions": ["결정 사항 1", "결정 사항 2", ...]
}

주의사항:
- 한국어로 작성해주세요
- 핵심적인 내용만 간결하게 요약해주세요
- 액션 아이템이 없으면 빈 배열로 반환해주세요
- 결정 사항이 없으면 빈 배열로 반환해주세요
- JSON 형식만 반환하고 다른 텍스트는 포함하지 마세요`

    const humanPrompt = `회의 주제: ${meeting.topic || '자유 토론'}
참여자: 사용자 ${meeting.participant_count}명, AI 에이전트 ${meeting.agent_count}명
회의 시간: ${meeting.duration_minutes}분

대화 내용:
${formattedMessages.slice(-200).join('\n')}

위 회의 내용을 분석하여 JSON 형식으로 요약해주세요.`

    console.log(`[Meeting Summary] Generating summary for meeting ${meetingId}...`)

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ])

    let summaryData
    try {
      const content = response.content as string
      // JSON 추출 (```json ... ``` 형식 처리)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('[Meeting Summary] Parse error:', parseError)
      summaryData = {
        summary: response.content as string,
        key_points: [],
        action_items: [],
        decisions: [],
      }
    }

    // 회의록 업데이트
    const { data: updatedMeeting, error: updateError } = await (adminClient as any)
      .from('meeting_records')
      .update({
        summary: summaryData.summary,
        key_points: summaryData.key_points || [],
        action_items: summaryData.action_items || [],
        decisions: summaryData.decisions || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)
      .select()
      .single()

    if (updateError) {
      console.error('[Meeting Summary] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[Meeting Summary] Summary generated for meeting ${meetingId}`)

    return NextResponse.json(updatedMeeting)
  } catch (error) {
    console.error('[Meeting Summary] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
