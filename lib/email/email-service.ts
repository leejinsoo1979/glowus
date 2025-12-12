import { createClient } from '@/lib/supabase/server'
import { ImapService, parsedEmailToDbFormat } from './imap-service'
import { SmtpService } from './smtp-service'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import type {
  EmailAccount,
  EmailMessage,
  EmailProvider,
  EMAIL_PROVIDER_CONFIGS,
  SendEmailRequest,
} from '@/types/email'

// Encryption helpers
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || 'startupshow-email-key-32bytes!!'
const ALGORITHM = 'aes-256-gcm'

function encrypt(text: string): string {
  const iv = randomBytes(16)
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// Provider configurations
const PROVIDER_CONFIGS: Record<EmailProvider, {
  imap: { host: string; port: number; secure: boolean }
  smtp: { host: string; port: number; secure: boolean }
}> = {
  gmail: {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false },
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

export class EmailService {
  private supabase: ReturnType<typeof createClient>

  constructor() {
    this.supabase = createClient()
  }

  // Account Management
  async addAccount(
    userId: string,
    data: {
      email_address: string
      password: string
      provider: EmailProvider
      display_name?: string
      team_id?: string
      imap_host?: string
      imap_port?: number
      smtp_host?: string
      smtp_port?: number
    }
  ): Promise<{ account?: EmailAccount; error?: string }> {
    const config = PROVIDER_CONFIGS[data.provider]

    const imapHost = data.imap_host || config.imap.host
    const imapPort = data.imap_port || config.imap.port
    const smtpHost = data.smtp_host || config.smtp.host
    const smtpPort = data.smtp_port || config.smtp.port

    // Test IMAP connection first
    const testAccount: EmailAccount = {
      id: '',
      user_id: userId,
      email_address: data.email_address,
      provider: data.provider,
      imap_host: imapHost,
      imap_port: imapPort,
      imap_secure: config.imap.secure,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: config.smtp.secure,
      is_active: true,
      created_at: '',
      updated_at: '',
    }

    const imapService = new ImapService(testAccount, data.password)
    const imapOk = await imapService.testConnection()

    if (!imapOk) {
      return { error: 'IMAP 연결 실패. 이메일 주소와 비밀번호를 확인하세요.' }
    }

    // Test SMTP connection
    const smtpService = new SmtpService(testAccount, data.password)
    const smtpOk = await smtpService.testConnection()
    smtpService.close()

    if (!smtpOk) {
      return { error: 'SMTP 연결 실패. 이메일 설정을 확인하세요.' }
    }

    // Encrypt password and save
    const encryptedPassword = encrypt(data.password)

    const { data: account, error } = await this.supabase
      .from('email_accounts')
      .insert({
        user_id: userId,
        email_address: data.email_address,
        display_name: data.display_name,
        provider: data.provider,
        team_id: data.team_id,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_secure: config.imap.secure,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: config.smtp.secure,
        encrypted_password: encryptedPassword,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return { error: error.message }
    }

    return { account: account as EmailAccount }
  }

  async getAccounts(userId: string): Promise<EmailAccount[]> {
    const { data, error } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to get accounts:', error)
      return []
    }

    return data as EmailAccount[]
  }

  async getAccount(accountId: string): Promise<EmailAccount | null> {
    const { data, error } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (error) {
      return null
    }

    return data as EmailAccount
  }

  async deleteAccount(accountId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('email_accounts')
      .delete()
      .eq('id', accountId)

    return !error
  }

  // Email Sync
  async syncEmails(
    accountId: string,
    options: { folder?: string; limit?: number; since?: Date } = {}
  ): Promise<{ synced: number; error?: string }> {
    // Get account with password
    const { data: account, error: accountError } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (accountError || !account) {
      return { synced: 0, error: 'Account not found' }
    }

    const password = decrypt(account.encrypted_password)
    const imapService = new ImapService(account as EmailAccount, password)

    try {
      await imapService.connect()

      const emails = await imapService.fetchEmails({
        folder: options.folder || 'INBOX',
        limit: options.limit || 50,
        since: options.since,
      })

      await imapService.disconnect()

      // Upsert emails to database
      let synced = 0
      for (const email of emails) {
        const dbEmail = parsedEmailToDbFormat(email, accountId)

        const { error } = await this.supabase
          .from('email_messages')
          .upsert(dbEmail, {
            onConflict: 'account_id,message_id',
          })

        if (!error) synced++
      }

      // Update last sync time
      await this.supabase
        .from('email_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('id', accountId)

      return { synced }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed'

      // Update sync error
      await this.supabase
        .from('email_accounts')
        .update({ sync_error: errorMessage })
        .eq('id', accountId)

      return { synced: 0, error: errorMessage }
    }
  }

  // Get emails from database
  async getEmails(
    accountId: string,
    options: {
      folder?: string
      limit?: number
      offset?: number
      unreadOnly?: boolean
      search?: string
    } = {}
  ): Promise<EmailMessage[]> {
    let query = this.supabase
      .from('email_messages')
      .select('*')
      .eq('account_id', accountId)
      .order('received_at', { ascending: false })

    if (options.folder) {
      query = query.eq('folder', options.folder)
    }

    if (options.unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (options.search) {
      query = query.or(
        `subject.ilike.%${options.search}%,body_text.ilike.%${options.search}%,from_address.ilike.%${options.search}%`
      )
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get emails:', error)
      return []
    }

    return data as EmailMessage[]
  }

  async getEmail(emailId: string): Promise<EmailMessage | null> {
    const { data, error } = await this.supabase
      .from('email_messages')
      .select('*')
      .eq('id', emailId)
      .single()

    if (error) return null
    return data as EmailMessage
  }

  // Send email
  async sendEmail(request: SendEmailRequest): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Get account with password
    const { data: account, error: accountError } = await this.supabase
      .from('email_accounts')
      .select('*')
      .eq('id', request.account_id)
      .single()

    if (accountError || !account) {
      return { success: false, error: 'Account not found' }
    }

    const password = decrypt(account.encrypted_password)
    const smtpService = new SmtpService(account as EmailAccount, password)

    try {
      const result = await smtpService.sendEmail({
        to: request.to,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        text: request.body_text,
        html: request.body_html,
        attachments: request.attachments,
      })

      smtpService.close()

      if (result.success) {
        // Save sent email to database
        await this.supabase.from('email_messages').insert({
          account_id: request.account_id,
          message_id: result.messageId,
          uid: 0,
          folder: 'Sent',
          subject: request.subject,
          from_address: account.email_address,
          from_name: account.display_name,
          to_addresses: request.to,
          cc_addresses: request.cc || [],
          bcc_addresses: request.bcc || [],
          body_text: request.body_text,
          body_html: request.body_html,
          is_sent: true,
          is_read: true,
          sent_at: new Date().toISOString(),
          received_at: new Date().toISOString(),
        })
      }

      return result
    } catch (error) {
      smtpService.close()
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      }
    }
  }

  // Mark email as read/unread
  async markAsRead(emailId: string, read: boolean = true): Promise<boolean> {
    const { error } = await this.supabase
      .from('email_messages')
      .update({ is_read: read })
      .eq('id', emailId)

    return !error
  }

  // Star/unstar email
  async starEmail(emailId: string, starred: boolean = true): Promise<boolean> {
    const { error } = await this.supabase
      .from('email_messages')
      .update({ is_starred: starred })
      .eq('id', emailId)

    return !error
  }

  // Move to trash
  async moveToTrash(emailId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('email_messages')
      .update({ is_trash: true })
      .eq('id', emailId)

    return !error
  }

  // Delete permanently
  async deleteEmail(emailId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('email_messages')
      .delete()
      .eq('id', emailId)

    return !error
  }

  // Get email stats
  async getStats(accountId: string): Promise<{
    total: number
    unread: number
    starred: number
    trash: number
  }> {
    const { data: total } = await this.supabase
      .from('email_messages')
      .select('id', { count: 'exact' })
      .eq('account_id', accountId)
      .eq('is_trash', false)

    const { data: unread } = await this.supabase
      .from('email_messages')
      .select('id', { count: 'exact' })
      .eq('account_id', accountId)
      .eq('is_read', false)
      .eq('is_trash', false)

    const { data: starred } = await this.supabase
      .from('email_messages')
      .select('id', { count: 'exact' })
      .eq('account_id', accountId)
      .eq('is_starred', true)

    const { data: trash } = await this.supabase
      .from('email_messages')
      .select('id', { count: 'exact' })
      .eq('account_id', accountId)
      .eq('is_trash', true)

    return {
      total: total?.length || 0,
      unread: unread?.length || 0,
      starred: starred?.length || 0,
      trash: trash?.length || 0,
    }
  }
}

// Export singleton for API routes
export const emailService = new EmailService()
