import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailAIAgent } from '@/lib/email/email-ai-agent'

// GET /api/email/ai/summary - Get latest summary
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id') || undefined

  // Verify account ownership if account_id provided
  if (accountId) {
    const { data: account } = await (supabase as any)
      .from('email_accounts')
      .select('user_id')
      .eq('id', accountId)
      .single()

    if (!account || (account as any).user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }
  }

  const aiAgent = new EmailAIAgent()
  const summary = await aiAgent.getLatestSummary(user.id, accountId)

  if (!summary) {
    return NextResponse.json({ error: '요약이 없습니다.' }, { status: 404 })
  }

  return NextResponse.json(summary)
}

// POST /api/email/ai/summary - Generate new summary
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { account_id } = body

    // Verify account ownership if account_id provided
    if (account_id) {
      const { data: account } = await (supabase as any)
        .from('email_accounts')
        .select('user_id')
        .eq('id', account_id)
        .single()

      if (!account || (account as any).user_id !== user.id) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
      }
    }

    const aiAgent = new EmailAIAgent()
    const summary = await aiAgent.generateDailySummary(user.id, account_id)

    if (!summary) {
      return NextResponse.json({ error: '오늘 받은 이메일이 없습니다.' }, { status: 404 })
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('Failed to generate summary:', error)
    return NextResponse.json(
      { error: '요약 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
