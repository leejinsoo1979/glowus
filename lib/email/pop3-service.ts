import Pop3Command from 'node-pop3'
import { simpleParser } from 'mailparser'
import type {
  EmailAccount,
  EmailMessage,
  EmailAddress,
  EmailAttachment,
} from '@/types/email'

interface ParsedEmail {
  uid: number
  messageId: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc: EmailAddress[]
  date: Date
  bodyText: string
  bodyHtml: string
  attachments: EmailAttachment[]
  inReplyTo?: string
  references: string[]
}

export class Pop3Service {
  private client: Pop3Command | null = null
  private account: EmailAccount
  private password: string

  constructor(account: EmailAccount, password: string) {
    this.account = account
    this.password = password
  }

  private async getClient(): Promise<Pop3Command> {
    if (!this.client) {
      this.client = new Pop3Command({
        host: this.account.imap_host, // Using imap_host field for POP3 host
        port: this.account.imap_port, // Using imap_port field for POP3 port
        tls: this.account.imap_secure,
        tlsOptions: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1' as any,
        },
        user: this.account.email_address,
        password: this.password,
      })
    }
    return this.client
  }

  async connect(): Promise<void> {
    await this.getClient()
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.QUIT()
      } catch {
        // Ignore quit errors
      }
      this.client = null
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const client = await this.getClient()
      // Try to get message count to verify connection
      await client.STAT()
      await this.disconnect()
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown POP3 error'
      console.error('POP3 connection test failed:', errorMessage, error)
      return { success: false, error: errorMessage }
    }
  }

  async fetchEmails(options: { limit?: number } = {}): Promise<ParsedEmail[]> {
    const { limit = 50 } = options
    const emails: ParsedEmail[] = []

    try {
      const client = await this.getClient()

      // Get list of messages
      const list = await client.LIST()

      if (!list || list.length === 0) {
        return emails
      }

      // Get the most recent messages (up to limit)
      const messagesToFetch = list.slice(-limit).reverse()

      for (const item of messagesToFetch) {
        try {
          const msgNum = typeof item === 'string' ? parseInt(item.split(' ')[0]) : (item as any)[0] || item
          const rawEmail = await client.RETR(msgNum)

          if (rawEmail) {
            const parsed = await this.parseMessage(rawEmail, msgNum)
            if (parsed) {
              emails.push(parsed)
            }
          }
        } catch (err) {
          console.error('Failed to fetch message:', err)
        }
      }

      return emails
    } catch (error) {
      console.error('Failed to fetch emails:', error)
      return emails
    }
  }

  private async parseMessage(rawEmail: string, msgNum: number): Promise<ParsedEmail | null> {
    try {
      const parsed = await simpleParser(rawEmail)

      // Parse addresses
      const parseAddresses = (
        addrs?: { value: Array<{ address?: string; name?: string }> } | Array<{ address?: string; name?: string }>
      ): EmailAddress[] => {
        if (!addrs) return []
        const addrArray = Array.isArray(addrs) ? addrs : addrs.value || []
        return addrArray
          .filter((a: any) => a.address)
          .map((a: any) => ({
            email: a.address!,
            name: a.name,
          }))
      }

      const attachments: EmailAttachment[] = []
      if (parsed.attachments) {
        for (const att of parsed.attachments) {
          attachments.push({
            filename: att.filename || 'unnamed',
            contentType: att.contentType,
            size: att.size,
            cid: att.cid,
          })
        }
      }

      const fromAddrs = parseAddresses(parsed.from as any)

      return {
        uid: msgNum,
        messageId: parsed.messageId || `pop3-${msgNum}-${Date.now()}`,
        subject: parsed.subject || '(No Subject)',
        from: fromAddrs[0] || { email: 'unknown' },
        to: parseAddresses(parsed.to as any),
        cc: parseAddresses(parsed.cc as any),
        date: parsed.date || new Date(),
        bodyText: parsed.text || '',
        bodyHtml: parsed.html || '',
        attachments,
        inReplyTo: parsed.inReplyTo as string | undefined,
        references: typeof parsed.references === 'string'
          ? parsed.references.split(/\s+/)
          : Array.isArray(parsed.references)
            ? parsed.references
            : [],
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
      return null
    }
  }
}

// Helper to convert ParsedEmail to database format
export function pop3EmailToDbFormat(
  parsed: ParsedEmail,
  accountId: string
): Omit<EmailMessage, 'id' | 'created_at' | 'updated_at'> {
  return {
    account_id: accountId,
    message_id: parsed.messageId,
    uid: parsed.uid,
    folder: 'INBOX',
    subject: parsed.subject,
    from_address: parsed.from.email,
    from_name: parsed.from.name,
    to_addresses: parsed.to,
    cc_addresses: parsed.cc,
    bcc_addresses: [],
    reply_to: undefined,
    body_text: parsed.bodyText,
    body_html: parsed.bodyHtml,
    snippet: parsed.bodyText.substring(0, 200),
    has_attachments: parsed.attachments.length > 0,
    attachments: parsed.attachments,
    thread_id: undefined,
    in_reply_to: parsed.inReplyTo,
    references_list: parsed.references,
    is_read: false,
    is_starred: false,
    is_draft: false,
    is_sent: false,
    is_spam: false,
    is_trash: false,
    ai_summary: undefined,
    ai_priority: undefined,
    ai_category: undefined,
    ai_sentiment: undefined,
    ai_action_required: false,
    ai_analyzed_at: undefined,
    sent_at: parsed.date.toISOString(),
    received_at: parsed.date.toISOString(),
  }
}
