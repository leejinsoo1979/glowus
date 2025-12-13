import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { createClient } from '@/lib/supabase/server'
import type { EmailMessage, EmailPriority, EmailSentiment, EmailSummary, EmailSummaryHighlight, EmailActionItem } from '@/types/email'

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
})

// Email analysis prompt
const analyzeEmailPrompt = PromptTemplate.fromTemplate(`
당신은 이메일 분석 전문가입니다. 다음 이메일을 분석해주세요.

발신자: {from}
제목: {subject}
내용:
{body}

다음 형식으로 JSON 응답해주세요 (마크다운 없이 순수 JSON만):
{{
  "summary": "2-3문장으로 이메일 내용 요약",
  "priority": "urgent|high|normal|low 중 하나",
  "category": "meeting|invoice|newsletter|personal|work|inquiry|notification|spam 중 하나",
  "sentiment": "positive|neutral|negative 중 하나",
  "action_required": true|false,
  "suggested_action": "필요한 조치 (action_required가 true인 경우)"
}}
`)

// Reply generation prompt
const generateReplyPrompt = PromptTemplate.fromTemplate(`
당신은 전문적인 비서입니다. 다음 이메일에 대한 답장을 작성해주세요.

원본 이메일:
발신자: {from}
제목: {subject}
내용:
{body}

사용자 지시사항: {userPrompt}

답장 톤: {tone}
언어: {language}

다음 형식으로 JSON 응답해주세요 (마크다운 없이 순수 JSON만):
{{
  "subject": "답장 제목 (Re: 포함)",
  "body_text": "답장 본문 (텍스트)",
  "body_html": "답장 본문 (HTML 형식)"
}}
`)

// Daily summary prompt
const dailySummaryPrompt = PromptTemplate.fromTemplate(`
당신은 이메일 요약 전문가입니다. 다음 이메일들을 분석하고 일일 요약을 작성해주세요.

이메일 목록:
{emails}

다음 형식으로 JSON 응답해주세요 (마크다운 없이 순수 JSON만):
{{
  "summary_text": "전체적인 이메일 현황 요약 (3-5문장)",
  "key_highlights": [
    {{"subject": "제목", "from": "발신자", "priority": "urgent|high|normal|low", "action": "필요한 조치"}}
  ],
  "action_items": [
    {{"description": "조치 설명", "email_id": "이메일ID (있는 경우)", "due_date": "마감일 (있는 경우)"}}
  ],
  "categories_breakdown": {{"meeting": 0, "invoice": 0, "work": 0, "personal": 0}}
}}
`)

export class EmailAIAgent {
  private _supabase: ReturnType<typeof createClient> | null = null

  private get supabase(): ReturnType<typeof createClient> {
    if (!this._supabase) {
      this._supabase = createClient()
    }
    return this._supabase
  }

  // Analyze a single email
  async analyzeEmail(email: EmailMessage): Promise<{
    summary: string
    priority: EmailPriority
    category: string
    sentiment: EmailSentiment
    action_required: boolean
    suggested_action?: string
  }> {
    try {
      const chain = analyzeEmailPrompt.pipe(model)
      const result = await chain.invoke({
        from: email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address,
        subject: email.subject || '(제목 없음)',
        body: email.body_text?.substring(0, 2000) || '',
      })

      const content = typeof result.content === 'string' ? result.content : ''
      const parsed = JSON.parse(content)

      // Update email in database with AI analysis
      await (this.supabase as any)
        .from('email_messages')
        .update({
          ai_summary: parsed.summary,
          ai_priority: parsed.priority,
          ai_category: parsed.category,
          ai_sentiment: parsed.sentiment,
          ai_action_required: parsed.action_required,
          ai_analyzed_at: new Date().toISOString(),
        })
        .eq('id', email.id)

      return parsed
    } catch (error) {
      console.error('Failed to analyze email:', error)
      return {
        summary: '',
        priority: 'normal',
        category: 'work',
        sentiment: 'neutral',
        action_required: false,
      }
    }
  }

  // Analyze multiple emails in batch
  async analyzeEmails(accountId: string, limit: number = 10): Promise<number> {
    // Get unanalyzed emails
    const { data: emails, error } = await (this.supabase as any)
      .from('email_messages')
      .select('*')
      .eq('account_id', accountId)
      .is('ai_analyzed_at', null)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error || !emails) {
      console.error('Failed to get emails for analysis:', error)
      return 0
    }

    let analyzed = 0
    for (const email of emails) {
      await this.analyzeEmail(email as EmailMessage)
      analyzed++
    }

    return analyzed
  }

  // Generate reply draft
  async generateReply(
    email: EmailMessage,
    options: {
      userPrompt?: string
      tone?: 'formal' | 'casual' | 'professional'
      language?: 'ko' | 'en'
    } = {}
  ): Promise<{
    subject: string
    body_text: string
    body_html: string
  }> {
    const { userPrompt = '적절하게 답장해주세요', tone = 'professional', language = 'ko' } = options

    try {
      const chain = generateReplyPrompt.pipe(model)
      const result = await chain.invoke({
        from: email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address,
        subject: email.subject || '(제목 없음)',
        body: email.body_text?.substring(0, 2000) || '',
        userPrompt,
        tone: tone === 'formal' ? '공식적인' : tone === 'casual' ? '친근한' : '전문적인',
        language: language === 'ko' ? '한국어' : 'English',
      })

      const content = typeof result.content === 'string' ? result.content : ''
      return JSON.parse(content)
    } catch (error) {
      console.error('Failed to generate reply:', error)
      return {
        subject: `Re: ${email.subject || ''}`,
        body_text: '',
        body_html: '',
      }
    }
  }

  // Generate daily summary
  async generateDailySummary(
    userId: string,
    accountId?: string
  ): Promise<EmailSummary | null> {
    try {
      // Get today's emails
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let query = (this.supabase as any)
        .from('email_messages')
        .select('*')
        .gte('received_at', today.toISOString())
        .eq('is_trash', false)
        .order('received_at', { ascending: false })
        .limit(50)

      if (accountId) {
        query = query.eq('account_id', accountId)
      }

      const { data: emails, error } = await query

      if (error || !emails || emails.length === 0) {
        return null
      }

      // Format emails for prompt
      const emailsList = emails.map((e: any, i: number) =>
        `${i + 1}. [ID: ${e.id}] 발신자: ${e.from_name || e.from_address}, 제목: ${e.subject || '(제목 없음)'}, 읽음: ${e.is_read ? '예' : '아니오'}`
      ).join('\n')

      const chain = dailySummaryPrompt.pipe(model)
      const result = await chain.invoke({
        emails: emailsList,
      })

      const content = typeof result.content === 'string' ? result.content : ''
      const parsed = JSON.parse(content)

      // Calculate counts
      const unreadCount = emails.filter((e: any) => !e.is_read).length
      const urgentCount = emails.filter((e: any) => e.ai_priority === 'urgent' || e.ai_priority === 'high').length

      // Save summary to database
      const summaryData = {
        user_id: userId,
        account_id: accountId || null,
        summary_type: 'daily' as const,
        period_start: today.toISOString(),
        period_end: new Date().toISOString(),
        total_emails: emails.length,
        unread_count: unreadCount,
        urgent_count: urgentCount,
        summary_text: parsed.summary_text,
        key_highlights: parsed.key_highlights,
        action_items: parsed.action_items,
        categories_breakdown: parsed.categories_breakdown,
      }

      const { data: summary, error: insertError } = await (this.supabase as any)
        .from('email_summaries')
        .insert(summaryData)
        .select()
        .single()

      if (insertError) {
        console.error('Failed to save summary:', insertError)
        return {
          id: '',
          ...summaryData,
          created_at: new Date().toISOString(),
        } as EmailSummary
      }

      return summary as EmailSummary
    } catch (error) {
      console.error('Failed to generate daily summary:', error)
      return null
    }
  }

  // Get latest summary
  async getLatestSummary(userId: string, accountId?: string): Promise<EmailSummary | null> {
    let query = (this.supabase as any)
      .from('email_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data, error } = await query.single()

    if (error || !data) {
      return null
    }

    return data as EmailSummary
  }

  // Auto-categorize unread emails
  async autoCategorize(accountId: string): Promise<number> {
    // Get uncategorized emails
    const { data: emails, error } = await (this.supabase as any)
      .from('email_messages')
      .select('*')
      .eq('account_id', accountId)
      .is('ai_category', null)
      .eq('is_trash', false)
      .limit(20)

    if (error || !emails) {
      return 0
    }

    let categorized = 0
    for (const email of emails) {
      await this.analyzeEmail(email as EmailMessage)
      categorized++
    }

    return categorized
  }
}

// Export singleton
export const emailAIAgent = new EmailAIAgent()
