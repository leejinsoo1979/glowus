import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailAIAgent } from '@/lib/email/email-ai-agent'
import type { EmailMessage } from '@/types/email'

// POST /api/email/ai/analyze - Analyze email(s) with AI
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email_id, account_id, batch } = body

    const aiAgent = new EmailAIAgent()

    // Single email analysis
    if (email_id) {
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

      const result = await aiAgent.analyzeEmail(email as unknown as EmailMessage)
      return NextResponse.json(result)
    }

    // Batch analysis for account
    if (account_id && batch) {
      // Verify account ownership
      const { data: account } = await supabase
        .from('email_accounts')
        .select('user_id')
        .eq('id', account_id)
        .single()

      if (!account || account.user_id !== user.id) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }

      const analyzed = await aiAgent.analyzeEmails(account_id, batch)
      return NextResponse.json({ analyzed })
    }

    return NextResponse.json({ error: 'email_id 또는 account_id가 필요합니다.' }, { status: 400 })
  } catch (error) {
    console.error('Failed to analyze email:', error)
    return NextResponse.json(
      { error: '이메일 분석에 실패했습니다.' },
      { status: 500 }
    )
  }
}
