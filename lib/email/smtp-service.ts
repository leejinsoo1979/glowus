import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { EmailAccount, EmailAddress, EmailAttachment } from '@/types/email'

interface SendEmailOptions {
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
  inReplyTo?: string
  references?: string[]
  attachments?: EmailAttachment[]
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export class SmtpService {
  private transporter: Transporter | null = null
  private account: EmailAccount

  constructor(account: EmailAccount, password: string) {
    this.account = account
    this.transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure, // true for 465, false for other ports
      auth: {
        user: account.email_address,
        pass: password,
      },
      tls: {
        // Do not fail on invalid certificates
        rejectUnauthorized: false,
      },
    })
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) return false

    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP connection test failed:', error)
      return false
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<SendResult> {
    if (!this.transporter) {
      return { success: false, error: 'SMTP transporter not initialized' }
    }

    try {
      // Format addresses
      const formatAddresses = (addresses: EmailAddress[]): string => {
        return addresses
          .map((addr) =>
            addr.name ? `"${addr.name}" <${addr.email}>` : addr.email
          )
          .join(', ')
      }

      // Build email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: this.account.display_name
          ? `"${this.account.display_name}" <${this.account.email_address}>`
          : this.account.email_address,
        to: formatAddresses(options.to),
        subject: options.subject,
        text: options.text,
        html: options.html,
      }

      // Optional fields
      if (options.cc && options.cc.length > 0) {
        mailOptions.cc = formatAddresses(options.cc)
      }

      if (options.bcc && options.bcc.length > 0) {
        mailOptions.bcc = formatAddresses(options.bcc)
      }

      if (options.replyTo) {
        mailOptions.replyTo = options.replyTo
      }

      // Threading headers
      if (options.inReplyTo) {
        mailOptions.inReplyTo = options.inReplyTo
      }

      if (options.references && options.references.length > 0) {
        mailOptions.references = options.references.join(' ')
      }

      // Attachments
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.cid,
        }))
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions)

      return {
        success: true,
        messageId: info.messageId,
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async sendReply(
    originalEmail: {
      messageId: string
      from: EmailAddress
      subject: string
      references?: string[]
    },
    replyOptions: {
      text?: string
      html?: string
      cc?: EmailAddress[]
      includeOriginalRecipients?: boolean
    }
  ): Promise<SendResult> {
    // Build references chain
    const references = [
      ...(originalEmail.references || []),
      originalEmail.messageId,
    ]

    // Build subject with Re: prefix if not already present
    const subject = originalEmail.subject.startsWith('Re:')
      ? originalEmail.subject
      : `Re: ${originalEmail.subject}`

    return this.sendEmail({
      to: [originalEmail.from],
      cc: replyOptions.cc,
      subject,
      text: replyOptions.text,
      html: replyOptions.html,
      inReplyTo: originalEmail.messageId,
      references,
    })
  }

  async sendForward(
    originalEmail: {
      subject: string
      from: EmailAddress
      date: Date
      bodyText?: string
      bodyHtml?: string
      attachments?: EmailAttachment[]
    },
    forwardTo: EmailAddress[],
    additionalMessage?: string
  ): Promise<SendResult> {
    // Build forwarded content
    const forwardHeader = `
---------- Forwarded message ---------
From: ${originalEmail.from.name ? `${originalEmail.from.name} <${originalEmail.from.email}>` : originalEmail.from.email}
Date: ${originalEmail.date.toLocaleString()}
Subject: ${originalEmail.subject}
`

    const text = additionalMessage
      ? `${additionalMessage}\n\n${forwardHeader}\n\n${originalEmail.bodyText || ''}`
      : `${forwardHeader}\n\n${originalEmail.bodyText || ''}`

    const html = additionalMessage
      ? `<p>${additionalMessage}</p><br><hr>${forwardHeader.replace(/\n/g, '<br>')}<br><br>${originalEmail.bodyHtml || originalEmail.bodyText || ''}`
      : `<hr>${forwardHeader.replace(/\n/g, '<br>')}<br><br>${originalEmail.bodyHtml || originalEmail.bodyText || ''}`

    // Build subject with Fwd: prefix
    const subject = originalEmail.subject.startsWith('Fwd:')
      ? originalEmail.subject
      : `Fwd: ${originalEmail.subject}`

    return this.sendEmail({
      to: forwardTo,
      subject,
      text,
      html,
      attachments: originalEmail.attachments,
    })
  }

  close(): void {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
    }
  }
}
