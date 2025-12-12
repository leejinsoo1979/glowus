// Email System Types

export type EmailProvider = 'gmail' | 'whois' | 'custom'
export type EmailPriority = 'urgent' | 'high' | 'normal' | 'low'
export type EmailSentiment = 'positive' | 'neutral' | 'negative'
export type DraftStatus = 'draft' | 'scheduled' | 'sent' | 'failed'
export type SummaryType = 'daily' | 'weekly' | 'custom'
export type AgentTaskType =
  | 'sync_inbox'
  | 'analyze_email'
  | 'generate_reply'
  | 'send_email'
  | 'generate_summary'
  | 'categorize_emails'
export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  cid?: string // Content-ID for inline attachments
  content?: Buffer | string
}

export interface EmailAccount {
  id: string
  user_id: string
  team_id?: string
  email_address: string
  display_name?: string
  provider: EmailProvider

  // IMAP settings
  imap_host: string
  imap_port: number
  imap_secure: boolean

  // SMTP settings
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean

  // Don't expose encrypted_password to client
  // OAuth tokens (only for Gmail)
  access_token?: string
  refresh_token?: string
  token_expires_at?: string

  // Status
  is_active: boolean
  last_sync_at?: string
  sync_error?: string

  created_at: string
  updated_at: string
}

export interface EmailMessage {
  id: string
  account_id: string
  message_id: string
  uid: number
  folder: string

  // Headers
  subject?: string
  from_address: string
  from_name?: string
  to_addresses: EmailAddress[]
  cc_addresses: EmailAddress[]
  bcc_addresses: EmailAddress[]
  reply_to?: string

  // Content
  body_text?: string
  body_html?: string
  snippet?: string

  // Attachments
  has_attachments: boolean
  attachments: EmailAttachment[]

  // Threading
  thread_id?: string
  in_reply_to?: string
  references_list: string[]

  // Status flags
  is_read: boolean
  is_starred: boolean
  is_draft: boolean
  is_sent: boolean
  is_spam: boolean
  is_trash: boolean

  // AI analysis
  ai_summary?: string
  ai_priority?: EmailPriority
  ai_category?: string
  ai_sentiment?: EmailSentiment
  ai_action_required: boolean
  ai_analyzed_at?: string

  // Timestamps
  sent_at?: string
  received_at?: string
  created_at: string
  updated_at: string
}

export interface EmailDraft {
  id: string
  account_id: string
  user_id: string

  // Reply context
  reply_to_message_id?: string
  is_reply: boolean
  is_forward: boolean

  // Content
  subject?: string
  to_addresses: EmailAddress[]
  cc_addresses: EmailAddress[]
  bcc_addresses: EmailAddress[]
  body_text?: string
  body_html?: string

  // AI generation
  ai_generated: boolean
  ai_prompt?: string
  ai_context?: string

  // Status
  status: DraftStatus
  scheduled_at?: string
  sent_at?: string
  error_message?: string

  created_at: string
  updated_at: string
}

export interface EmailSummaryHighlight {
  subject: string
  from: string
  priority: EmailPriority
  action?: string
}

export interface EmailActionItem {
  description: string
  email_id?: string
  due_date?: string
}

export interface EmailSummary {
  id: string
  user_id: string
  account_id?: string

  summary_type: SummaryType
  period_start: string
  period_end: string

  total_emails: number
  unread_count: number
  urgent_count: number

  summary_text: string
  key_highlights: EmailSummaryHighlight[]
  action_items: EmailActionItem[]
  categories_breakdown: Record<string, number>

  created_at: string
}

export interface EmailAgentTask {
  id: string
  user_id: string
  account_id: string

  task_type: AgentTaskType
  params: Record<string, unknown>

  status: AgentTaskStatus
  result?: Record<string, unknown>
  error_message?: string

  scheduled_at: string
  started_at?: string
  completed_at?: string

  created_at: string
}

// API Request/Response types
export interface AddEmailAccountRequest {
  email_address: string
  display_name?: string
  provider: EmailProvider
  password: string
  team_id?: string

  // Custom provider settings (optional)
  imap_host?: string
  imap_port?: number
  smtp_host?: string
  smtp_port?: number
}

export interface SyncEmailsRequest {
  account_id: string
  folder?: string
  limit?: number
  since?: string // ISO date
}

export interface SendEmailRequest {
  account_id: string
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  body_text?: string
  body_html?: string
  reply_to_message_id?: string
  attachments?: EmailAttachment[]
}

export interface GenerateReplyRequest {
  account_id: string
  message_id: string
  prompt?: string // Optional user instruction for AI
  tone?: 'formal' | 'casual' | 'professional'
  language?: 'ko' | 'en'
}

export interface GenerateSummaryRequest {
  account_id?: string // Optional, if not provided, summarize all accounts
  summary_type: SummaryType
  period_start?: string
  period_end?: string
}

// Provider-specific configurations
export const EMAIL_PROVIDER_CONFIGS: Record<EmailProvider, {
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
}> = {
  gmail: {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false }, // STARTTLS
  },
  whois: {
    imap: { host: 'mail.whoismail.net', port: 993, secure: true },
    smtp: { host: 'mail.whoismail.net', port: 587, secure: false },
  },
  custom: {
    imap: { host: '', port: 993, secure: true },
    smtp: { host: '', port: 587, secure: false },
  },
}
