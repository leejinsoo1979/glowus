import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { EmailService } from '@/lib/email/email-service'
import type { EmailAddress } from '@/types/email'

// POST /api/email/send - Send an email
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { account_id, to, cc, bcc, subject, body_text, body_html, reply_to_message_id } = body

    if (!account_id) {
      return NextResponse.json({ error: '계정 ID가 필요합니다.' }, { status: 400 })
    }

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: '받는 사람이 필요합니다.' }, { status: 400 })
    }

    if (!subject) {
      return NextResponse.json({ error: '제목이 필요합니다.' }, { status: 400 })
    }

    if (!body_text && !body_html) {
      return NextResponse.json({ error: '내용이 필요합니다.' }, { status: 400 })
    }

    // Verify ownership
    const { data: account } = await (supabase as any)
      .from('email_accounts')
      .select('user_id')
      .eq('id', account_id)
      .single()

    if (!account || (account as any).user_id !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // Validate email addresses
    const validateAddresses = (addresses: EmailAddress[]): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return addresses.every(addr => emailRegex.test(addr.email))
    }

    if (!validateAddresses(to)) {
      return NextResponse.json({ error: '잘못된 이메일 주소가 있습니다.' }, { status: 400 })
    }

    if (cc && !validateAddresses(cc)) {
      return NextResponse.json({ error: '잘못된 참조 이메일 주소가 있습니다.' }, { status: 400 })
    }

    if (bcc && !validateAddresses(bcc)) {
      return NextResponse.json({ error: '잘못된 숨은 참조 이메일 주소가 있습니다.' }, { status: 400 })
    }

    const emailService = new EmailService()
    const result = await emailService.sendEmail({
      account_id,
      to,
      cc,
      bcc,
      subject,
      body_text,
      body_html,
      reply_to_message_id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || '발송에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
    return NextResponse.json(
      { error: '이메일 발송에 실패했습니다.' },
      { status: 500 }
    )
  }
}
