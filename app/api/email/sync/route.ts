import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { EmailService } from '@/lib/email/email-service'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// POST /api/email/sync - Sync emails for an account
export async function POST(request: Request) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } else {
    console.log('[DEV] Auth bypass enabled for: /api/email/sync')
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { account_id, folder, limit, since, syncAll } = body

    if (!account_id) {
      return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 })
    }

    // Verify ownership (skip in dev mode)
    const { data: account } = await (adminClient as any)
      .from('email_accounts')
      .select('user_id')
      .eq('id', account_id)
      .single()

    if (!isDevMode() && (!account || (account as any).user_id !== user.id)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    if (!account) {
      return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    const emailService = new EmailService()

    // Sync all folders (including spam, sent, etc.) or single folder
    if (syncAll) {
      const result = await emailService.syncAllFolders(account_id, {
        limit: limit || 30,
        since: since ? new Date(since) : undefined,
      })

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({
        synced: result.synced,
        folders: result.folders,
      })
    }

    // Single folder sync
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
