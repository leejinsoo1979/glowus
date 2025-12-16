import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import type { EmailMessage } from '@/types/email'

const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0.3,
})

const emailChatPrompt = PromptTemplate.fromTemplate(`
이메일 비서. 요청에 맞게만 답변.

=== 현재 화면 ===
{currentViewContext}

{selectedEmailContext}

=== 이메일 목록 ===
{emailList}

=== 사용자 요청 ===
{userMessage}

=== 답변 방식 ===

"번역" → 번역문만.

"요약" → 2-3줄.

"긴급" → 판단 + 이유 한 줄.

"답장필요" → 판단 + 이유 한 줄.

"분석" → 실질적이고 깊이있게 분석:

1. 이게 뭔 메일인가
   - 한 문장으로 핵심 설명

2. 발신자 신뢰도
   - 발신자 이메일 도메인이 정상인지
   - 스팸/피싱/사기 가능성 있는지
   - 실제 존재하는 회사인지

3. 구체적으로 뭘 요구하는가
   - 상대방이 원하는 게 정확히 뭔지
   - 금전 요구, 개인정보 요구, 링크 클릭 유도 등 위험 요소
   - 첨부파일이 있으면 주의사항

4. 내가 뭘 해야 하나
   - 무시해도 되는지
   - 답장해야 하면 뭐라고 해야 하는지 구체적으로
   - 주의해야 할 점

5. 비즈니스 관점 조언
   - 이 메일에 응하면 득/실이 뭔지
   - 사기 수법이면 어떤 유형인지 설명

그 외 → 질문에만 짧게 답변.
`)

// POST /api/email/ai/chat - Chat with email AI
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { message, account_id, selected_email_id, visible_email_ids, current_folder } = body

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    // Verify account ownership
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

    // Get emails - only visible ones if provided
    let emailQuery = (supabase as any)
      .from('email_messages')
      .select('*, email_accounts!inner(user_id)')
      .eq('email_accounts.user_id', user.id)
      .order('received_at', { ascending: false })

    if (account_id) {
      emailQuery = emailQuery.eq('account_id', account_id)
    }

    // Filter by visible email IDs if provided (현재 화면에 보이는 메일들만)
    if (visible_email_ids && visible_email_ids.length > 0) {
      emailQuery = emailQuery.in('id', visible_email_ids)
    } else {
      emailQuery = emailQuery.eq('is_trash', false).limit(20)
    }

    const { data: emails, error: emailsError } = await emailQuery

    if (emailsError) {
      console.error('Failed to get emails:', emailsError)
      return NextResponse.json({ error: '이메일을 불러올 수 없습니다.' }, { status: 500 })
    }

    // Sort by visible_email_ids order if provided
    let visibleEmails = (emails || []) as EmailMessage[]
    if (visible_email_ids && visible_email_ids.length > 0) {
      const orderMap = new Map<string, number>(visible_email_ids.map((id: string, idx: number) => [id, idx]))
      visibleEmails.sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? 999
        const orderB = orderMap.get(b.id) ?? 999
        return orderA - orderB
      })
    }

    // Folder name mapping
    const folderNames: Record<string, string> = {
      inbox: '받은메일함',
      starred: '중요메일함',
      sent: '보낸메일함',
      trash: '휴지통',
      spam: '스팸함',
      drafts: '임시보관함',
      all: '전체메일',
      scheduled: '예약메일',
      attachments: '첨부파일 메일',
    }

    // Build current view context
    const currentViewContext = `현재 폴더: ${folderNames[current_folder] || current_folder || '받은메일함'}
현재 화면에 표시된 메일 수: ${visibleEmails.length}개
안읽은 메일: ${visibleEmails.filter(e => !e.is_read).length}개`

    // Format email list with content (현재 화면에 보이는 것만)
    const emailList = visibleEmails.map((email, i) => {
      const date = new Date(email.received_at || email.created_at)
      const dateStr = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      const tags: string[] = []
      if (!email.is_read) tags.push('[안읽음]')
      if (email.is_starred) tags.push('[중요]')
      if (email.has_attachments) tags.push('[첨부파일]')

      const bodyPreview = email.body_text?.substring(0, 500)?.replace(/\n+/g, ' ').trim() || ''
      const toAddresses = email.to_addresses ? (Array.isArray(email.to_addresses) ? email.to_addresses.map((t: { email?: string }) => t.email).join(', ') : '') : ''
      const ccAddresses = email.cc_addresses ? (Array.isArray(email.cc_addresses) ? email.cc_addresses.map((c: { email?: string }) => c.email).join(', ') : '') : ''

      return `[${i + 1}번] ${tags.join(' ')}
발신: ${email.from_name || '(이름 없음)'} <${email.from_address}>
수신: ${toAddresses || '(알 수 없음)'}${ccAddresses ? `\nCC: ${ccAddresses}` : ''}
제목: ${email.subject || '(제목 없음)'}
일시: ${dateStr}
내용: ${bodyPreview}${bodyPreview.length >= 500 ? '...(생략)' : ''}`
    }).join('\n\n')

    // Get selected email full content if provided
    let selectedEmailContext = ''
    if (selected_email_id) {
      const selectedEmail = visibleEmails.find(e => e.id === selected_email_id)
      if (selectedEmail) {
        const selToAddresses = selectedEmail.to_addresses ? (Array.isArray(selectedEmail.to_addresses) ? selectedEmail.to_addresses.map((t: { email?: string, name?: string }) => t.name ? `${t.name} <${t.email}>` : t.email).join(', ') : '') : ''
        const selCcAddresses = selectedEmail.cc_addresses ? (Array.isArray(selectedEmail.cc_addresses) ? selectedEmail.cc_addresses.map((c: { email?: string, name?: string }) => c.name ? `${c.name} <${c.email}>` : c.email).join(', ') : '') : ''
        const receivedDate = selectedEmail.received_at ? new Date(selectedEmail.received_at).toLocaleString('ko-KR', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', weekday: 'long'
        }) : ''

        selectedEmailContext = `
=== 현재 열람 중인 메일 (상세) ===
📧 발신자: ${selectedEmail.from_name || '(이름 없음)'} <${selectedEmail.from_address}>
📬 수신자: ${selToAddresses || '(알 수 없음)'}${selCcAddresses ? `\n📋 CC: ${selCcAddresses}` : ''}
📌 제목: ${selectedEmail.subject || '(제목 없음)'}
📅 수신일시: ${receivedDate}
${selectedEmail.has_attachments ? '📎 첨부파일: 있음' : ''}
${selectedEmail.is_starred ? '⭐ 중요 표시됨' : ''}
${!selectedEmail.is_read ? '🔵 읽지 않음' : ''}

━━━ 전체 본문 ━━━
${selectedEmail.body_text || '(내용 없음)'}
━━━━━━━━━━━━━━
${selectedEmail.ai_summary ? `\n📊 기존 AI 분석: ${selectedEmail.ai_summary}` : ''}`
      }
    }

    // Generate AI response
    const chain = emailChatPrompt.pipe(model)
    const result = await chain.invoke({
      currentViewContext,
      selectedEmailContext,
      emailList: emailList || '현재 화면에 메일이 없습니다.',
      userMessage: message,
    })

    const responseContent = typeof result.content === 'string' ? result.content : ''

    // Check if the response mentions an email number to show
    const showEmailMatch = responseContent.match(/(\d+)번\s*(메일|이메일)?.*?(보여|표시|확인)/) ||
                          message.match(/(\d+)\s*(번|번째)?\s*(메일|보여|읽|열|확인)/)

    let emailToShow: EmailMessage | null = null
    if (showEmailMatch) {
      const emailNum = parseInt(showEmailMatch[1])
      if (emailNum > 0 && emailNum <= visibleEmails.length) {
        emailToShow = visibleEmails[emailNum - 1]
      }
    }

    return NextResponse.json({
      response: responseContent,
      email_to_show: emailToShow?.id || null,
    })
  } catch (error) {
    console.error('Failed to process chat:', error)
    return NextResponse.json(
      { error: 'AI 응답 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
