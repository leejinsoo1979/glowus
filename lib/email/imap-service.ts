import { ImapFlow } from 'imapflow'
import type {
  EmailAccount,
  EmailMessage,
  EmailAddress,
  EmailAttachment,
} from '@/types/email'

interface FetchOptions {
  folder?: string
  limit?: number
  since?: Date
  markSeen?: boolean
}

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

export class ImapService {
  private client: ImapFlow | null = null
  private account: EmailAccount

  constructor(account: EmailAccount, password: string) {
    this.account = account
    this.client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_secure,
      auth: {
        user: account.email_address,
        pass: password,
      },
      logger: false,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1' as any,
      },
    })
  }

  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error('IMAP client not initialized')
    }
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout()
      this.client = null
    }
  }

  async listFolders(): Promise<string[]> {
    if (!this.client) throw new Error('Not connected')

    const folders: string[] = []
    const list = await this.client.list()

    for (const folder of list) {
      folders.push(folder.path)
    }

    return folders
  }

  async fetchEmails(options: FetchOptions = {}): Promise<ParsedEmail[]> {
    if (!this.client) throw new Error('Not connected')

    const {
      folder = 'INBOX',
      limit = 50,
      since,
      markSeen = false,
    } = options

    const lock = await this.client.getMailboxLock(folder)
    const emails: ParsedEmail[] = []

    try {
      // Build search criteria
      const searchCriteria: Record<string, unknown> = {}
      if (since) {
        searchCriteria.since = since
      }

      // Search for messages
      const mailboxExists = this.client.mailbox && typeof this.client.mailbox !== 'boolean' ? this.client.mailbox.exists : 0
      const messages = this.client.fetch(
        { seq: `${Math.max(1, mailboxExists - limit + 1)}:*` },
        {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: true,
          flags: true,
        }
      )

      for await (const message of messages) {
        if (emails.length >= limit) break

        const email = await this.parseMessage(message)
        if (email) {
          emails.push(email)
        }

        // Mark as seen if requested
        if (markSeen && message.uid) {
          await this.client.messageFlagsAdd({ uid: message.uid }, ['\\Seen'])
        }
      }
    } finally {
      lock.release()
    }

    return emails.reverse() // Most recent first
  }

  async fetchEmail(uid: number, folder: string = 'INBOX'): Promise<ParsedEmail | null> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)

    try {
      const message = await this.client.fetchOne(
        uid.toString() as any,
        {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: true,
          flags: true,
        }
      )

      if (!message) return null
      return this.parseMessage(message)
    } finally {
      lock.release()
    }
  }

  async markAsRead(uid: number, folder: string = 'INBOX'): Promise<void> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)
    try {
      await this.client.messageFlagsAdd({ uid }, ['\\Seen'])
    } finally {
      lock.release()
    }
  }

  async markAsUnread(uid: number, folder: string = 'INBOX'): Promise<void> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)
    try {
      await this.client.messageFlagsRemove({ uid }, ['\\Seen'])
    } finally {
      lock.release()
    }
  }

  async starMessage(uid: number, folder: string = 'INBOX'): Promise<void> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)
    try {
      await this.client.messageFlagsAdd({ uid }, ['\\Flagged'])
    } finally {
      lock.release()
    }
  }

  async unstarMessage(uid: number, folder: string = 'INBOX'): Promise<void> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)
    try {
      await this.client.messageFlagsRemove({ uid }, ['\\Flagged'])
    } finally {
      lock.release()
    }
  }

  async moveToTrash(uid: number, folder: string = 'INBOX'): Promise<void> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)
    try {
      await this.client.messageMove({ uid }, '[Gmail]/Trash')
    } catch {
      // Try alternative trash folder names
      try {
        await this.client.messageMove({ uid }, 'Trash')
      } catch {
        await this.client.messageFlagsAdd({ uid }, ['\\Deleted'])
      }
    } finally {
      lock.release()
    }
  }

  async deleteMessage(uid: number, folder: string = 'INBOX'): Promise<void> {
    if (!this.client) throw new Error('Not connected')

    const lock = await this.client.getMailboxLock(folder)
    try {
      await this.client.messageFlagsAdd({ uid }, ['\\Deleted'])
      await this.client.messageDelete({ uid })
    } finally {
      lock.release()
    }
  }

  private async parseMessage(message: {
    uid?: number
    envelope?: {
      messageId?: string
      subject?: string
      from?: Array<{ address?: string; name?: string }>
      to?: Array<{ address?: string; name?: string }>
      cc?: Array<{ address?: string; name?: string }>
      date?: Date
      inReplyTo?: string
      references?: string
    }
    source?: Buffer
  }): Promise<ParsedEmail | null> {
    if (!message.envelope) return null

    const envelope = message.envelope

    // Parse addresses
    const parseAddresses = (
      addrs?: Array<{ address?: string; name?: string }>
    ): EmailAddress[] => {
      if (!addrs) return []
      return addrs
        .filter((a) => a.address)
        .map((a) => ({
          email: a.address!,
          name: a.name,
        }))
    }

    // Parse body from source
    let bodyText = ''
    let bodyHtml = ''
    const attachments: EmailAttachment[] = []

    if (message.source) {
      const { simpleParser } = await import('mailparser')
      const parsed = await simpleParser(message.source)

      bodyText = parsed.text || ''
      bodyHtml = parsed.html || ''

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
    }

    return {
      uid: message.uid || 0,
      messageId: envelope.messageId || '',
      subject: envelope.subject || '(No Subject)',
      from: parseAddresses(envelope.from)[0] || { email: 'unknown' },
      to: parseAddresses(envelope.to),
      cc: parseAddresses(envelope.cc),
      date: envelope.date || new Date(),
      bodyText,
      bodyHtml,
      attachments,
      inReplyTo: envelope.inReplyTo,
      references: envelope.references?.split(/\s+/) || [],
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.connect()
      await this.disconnect()
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown IMAP error'
      console.error('IMAP connection test failed:', errorMessage, error)
      return { success: false, error: errorMessage }
    }
  }
}

// Helper to convert ParsedEmail to database format
export function parsedEmailToDbFormat(
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
