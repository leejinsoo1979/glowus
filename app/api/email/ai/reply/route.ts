import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailAIAgent } from '@/lib/email/email-ai-agent'
import type { EmailMessage } from '@/types/email'

// POST /api/email/ai/reply - Generate AI reply draft
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email_id, prompt, tone, language } = body

    if (!email_id) {
      return NextResponse.json({ error: '이메일 ID가 필요합니다.' }, { status: 400 })
    }

    // Get email and verify ownership
    const { data: email, error: emailError } = await supabase
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

    const aiAgent = new EmailAIAgent()
    const reply = await aiAgent.generateReply(email as unknown as EmailMessage, {
      userPrompt: prompt,
      tone: tone || 'professional',
      language: language || 'ko',
    })

    // Save as draft
    const { data: draft, error: draftError } = await supabase
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
        ai_prompt: prompt,
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
