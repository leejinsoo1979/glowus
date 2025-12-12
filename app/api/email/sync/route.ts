import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailService } from '@/lib/email/email-service'

// POST /api/email/sync - Sync emails for an account
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { account_id, folder, limit, since } = body

    if (!account_id) {
      return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 })
    }

    // Verify ownership
    const { data: account } = await supabase
      .from('email_accounts')
      .select('user_id')
      .eq('id', account_id)
      .single()

    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const emailService = new EmailService()
    const result = await emailService.syncEmails(account_id, {
      folder,
      limit: limit || 50,
      since: since ? new Date(since) : undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ synced: result.synced })
  } catch (error) {
    console.error('Failed to sync emails:', error)
    return NextResponse.json(
      { error: '이메일 동기화에 실패했습니다.' },
      { status: 500 }
    )
  }
}
