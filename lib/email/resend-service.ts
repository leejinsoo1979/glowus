import { Resend } from 'resend'
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

export class ResendService {
    private resend: Resend
    private account: EmailAccount

    constructor(account: EmailAccount) {
        this.account = account
        // Use env var or account specific key if available (though usually it's env var)
        const apiKey = process.env.RESEND_API_KEY || ''
        this.resend = new Resend(apiKey)
    }

    async sendEmail(options: SendEmailOptions): Promise<SendResult> {
        if (!process.env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY is missing')
            return { success: false, error: 'RESEND_API_KEY is missing configuration' }
        }

        try {
            // Format addresses string array for Resend
            const to = options.to.map(addr => addr.email)
            const cc = options.cc?.map(addr => addr.email)
            const bcc = options.bcc?.map(addr => addr.email)

            const from = this.account.display_name
                ? `${this.account.display_name} <${this.account.email_address}>`
                : this.account.email_address

            // Process attachments
            const attachments = options.attachments?.map(att => ({
                filename: att.filename,
                content: att.content instanceof Buffer ? att.content : Buffer.from(att.content || ''),
                contentType: att.contentType,
            }))

            const { data, error } = await this.resend.emails.send({
                from,
                to,
                cc,
                bcc,
                subject: options.subject,
                text: options.text,
                html: options.html,
                replyTo: options.replyTo,
                attachments,
                headers: {
                    ...(options.inReplyTo && { 'In-Reply-To': options.inReplyTo }),
                    ...(options.references && { 'References': options.references.join(' ') }),
                }
            } as any)

            if (error) {
                console.error('Resend API error:', error)
                return { success: false, error: error.message }
            }

            return {
                success: true,
                messageId: data?.id
            }

        } catch (err: any) {
            console.error('Resend service error:', err)
            return {
                success: false,
                error: err.message || 'Unknown error during email sending'
            }
        }
    }

    // Reply wrapper
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
        }
    ): Promise<SendResult> {
        const references = [
            ...(originalEmail.references || []),
            originalEmail.messageId,
        ]

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

    // Forward wrapper
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
}
