export const dynamic = 'force-dynamic'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailService } from '@/lib/email/email-service'
import type { EmailProvider } from '@/types/email'

// GET /api/email/accounts - Get all email accounts for current user
export async function GET() {
  const supabase = await createClient()
  const { user } = await getAuthUser(supabase)

  console.log('[Email Accounts] User:', user?.id, user?.email)

  if (!user) {
    console.log('[Email Accounts] Unauthorized - no user')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const emailService = new EmailService()
  const accounts = await emailService.getAccounts(user.id)
  console.log('[Email Accounts] Found accounts:', accounts.length)

  // Remove sensitive data
  const safeAccounts = accounts.map(account => ({
    ...account,
    encrypted_password: undefined,
    access_token: undefined,
    refresh_token: undefined,
  }))

  return NextResponse.json(safeAccounts)
}

// POST /api/email/accounts - Add new email account
export async function POST(request: Request) {
  const supabase = await createClient()
  const { user } = await getAuthUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email_address, password, provider, display_name, team_id, imap_host, imap_port, smtp_host, smtp_port } = body

    if (!email_address || !password || !provider) {
      return NextResponse.json(
        { error: '이메일 주소, 비밀번호, 제공자를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!['gmail', 'whois', 'custom'].includes(provider)) {
      return NextResponse.json(
        { error: '지원하지 않는 이메일 제공자입니다.' },
        { status: 400 }
      )
    }

    const emailService = new EmailService()
    const result = await emailService.addAccount(user.id, {
      email_address,
      password,
      provider: provider as EmailProvider,
      display_name,
      team_id,
      imap_host,
      imap_port,
      smtp_host,
      smtp_port,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Remove sensitive data from response
    const safeAccount = {
      ...result.account,
      encrypted_password: undefined,
    }

    return NextResponse.json(safeAccount, { status: 201 })
  } catch (error) {
    console.error('Failed to add email account:', error)
    return NextResponse.json(
      { error: '이메일 계정 추가에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/email/accounts - Delete email account
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { user } = await getAuthUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 })
    }

    // Verify ownership
    const { data: account } = await (supabase as any)
      .from('email_accounts')
      .select('user_id')
      .eq('id', accountId)
      .single()

    if (!account || (account as any).user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const emailService = new EmailService()
    const deleted = await emailService.deleteAccount(accountId)

    if (!deleted) {
      return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete email account:', error)
    return NextResponse.json(
      { error: '이메일 계정 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
