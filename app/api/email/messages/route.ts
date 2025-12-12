import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailService } from '@/lib/email/email-service'

// GET /api/email/messages - Get emails for an account
export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  const folder = searchParams.get('folder') || undefined
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const search = searchParams.get('search') || undefined

  if (!accountId) {
    return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 })
  }

  // Verify ownership
  const { data: account } = await supabase
    .from('email_accounts')
    .select('user_id')
    .eq('id', accountId)
    .single()

  if (!account || account.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const emailService = new EmailService()
  const emails = await emailService.getEmails(accountId, {
    folder,
    limit,
    offset,
    unreadOnly,
    search,
  })

  return NextResponse.json(emails)
}

// PATCH /api/email/messages - Update email (read, star, trash)
export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email_id, action, value } = body

    if (!email_id || !action) {
      return NextResponse.json(
        { error: '이메일 ID와 액션이 필요합니다.' },
        { status: 400 }
      )
    }

    // Verify ownership through account
    const { data: email } = await supabase
      .from('email_messages')
      .select('account_id')
      .eq('id', email_id)
      .single()

    if (!email) {
      return NextResponse.json({ error: '이메일을 찾을 수 없습니다.' }, { status: 404 })
    }

    const { data: account } = await supabase
      .from('email_accounts')
      .select('user_id')
      .eq('id', email.account_id)
      .single()

    if (!account || account.user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const emailService = new EmailService()
    let success = false

    switch (action) {
      case 'read':
        success = await emailService.markAsRead(email_id, value !== false)
        break
      case 'star':
        success = await emailService.starEmail(email_id, value !== false)
        break
      case 'trash':
        success = await emailService.moveToTrash(email_id)
        break
      case 'delete':
        success = await emailService.deleteEmail(email_id)
        break
      default:
        return NextResponse.json({ error: '알 수 없는 액션입니다.' }, { status: 400 })
    }

    if (!success) {
      return NextResponse.json({ error: '업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update email:', error)
    return NextResponse.json(
      { error: '이메일 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}
