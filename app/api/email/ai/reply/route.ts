import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailAIAgent } from '@/lib/email/email-ai-agent'
import type { EmailMessage } from '@/types/email'

// 답장 유형별 프롬프트 매핑
const REPLY_TYPE_PROMPTS: Record<string, { prompt: string, tone: string }> = {
  positive: {
    prompt: '긍정적이고 수락하는 내용으로 답변해주세요. 요청을 받아들이고 협조하겠다는 의사를 명확히 전달하세요.',
    tone: 'casual',
  },
  negative: {
    prompt: '정중하게 거절하는 내용으로 답변해주세요. 아쉬움을 표현하면서도 어려운 상황을 설명하고, 가능하다면 대안을 제시하세요.',
    tone: 'professional',
  },
  question: {
    prompt: '추가 정보나 명확한 설명을 요청하는 내용으로 답변해주세요. 구체적으로 어떤 정보가 필요한지 질문하세요.',
    tone: 'professional',
  },
  schedule: {
    prompt: '일정 조율에 관한 내용으로 답변해주세요. 가능한 시간대를 제안하거나 일정 확인 요청을 하세요.',
    tone: 'professional',
  },
  thankyou: {
    prompt: '감사 인사를 전하는 내용으로 답변해주세요. 상대방의 도움이나 연락에 감사를 표현하세요.',
    tone: 'casual',
  },
  formal: {
    prompt: '공식적이고 격식체로 답변해주세요. 비즈니스 상황에 맞는 정중하고 전문적인 어조를 사용하세요.',
    tone: 'formal',
  },
}

// POST /api/email/ai/reply - Generate AI reply draft
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email_id, prompt, tone, language, reply_type } = body

    if (!email_id) {
      return NextResponse.json({ error: '이메일 ID가 필요합니다.' }, { status: 400 })
    }

    // Get email and verify ownership
    const { data: email, error: emailError } = await (supabase as any)
      .from('email_messages')
      .select('*, email_accounts!inner(user_id)')
      .eq('id', email_id)
      .single()

    if (emailError || !email) {
      return NextResponse.json({ error: '이메일을 찾을 수 없습니다.' }, { status: 404 })
    }

    if ((email as { email_accounts: { user_id: string } }).email_accounts.user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // Get reply type configuration if specified
    const replyConfig = reply_type ? REPLY_TYPE_PROMPTS[reply_type] : null

    const aiAgent = new EmailAIAgent()
    const reply = await aiAgent.generateReply(email as unknown as EmailMessage, {
      userPrompt: replyConfig?.prompt || prompt,
      tone: (replyConfig?.tone || tone || 'professional') as 'professional' | 'casual' | 'formal',
      language: language || 'ko',
    })

    // Save as draft
    const { data: draft, error: draftError } = await (supabase as any)
      .from('email_drafts')
      .insert({
        account_id: email.account_id,
        user_id: user.id,
        reply_to_message_id: email_id,
        is_reply: true,
        subject: reply.subject,
        to_addresses: [{ email: email.from_address, name: email.from_name }],
        body_text: reply.body_text,
        body_html: reply.body_html,
        ai_generated: true,
        ai_prompt: replyConfig?.prompt || prompt,
        ai_reply_type: reply_type || null,
        status: 'draft',
      })
      .select()
      .single()

    if (draftError) {
      console.error('Failed to save draft:', draftError)
    }

    return NextResponse.json({
      ...reply,
      draft_id: draft?.id,
    })
  } catch (error) {
    console.error('Failed to generate reply:', error)
    return NextResponse.json(
      { error: '답장 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
