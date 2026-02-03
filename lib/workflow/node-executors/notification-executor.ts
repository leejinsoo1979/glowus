/**
 * Notification Node Executor
 * Email, Slack, Webhook 알림 발송
 */

import { sendMessage, sendWebhook as sendSlackWebhook } from '@/lib/integrations/slack'
import type { NodeExecutionContext, NodeExecutionResult } from './index'

export interface NotificationNodeConfig {
  // 알림 유형
  type: 'email' | 'slack' | 'webhook'

  // 공통
  message: string
  title?: string

  // Email 설정
  email?: {
    to: string | string[]
    cc?: string[]
    bcc?: string[]
    subject?: string
    html?: boolean
  }

  // Slack 설정
  slack?: {
    channel: string
    accessToken?: string
    webhookUrl?: string
    blocks?: unknown[]
  }

  // Webhook 설정
  webhook?: {
    url: string
    method?: 'POST' | 'PUT'
    headers?: Record<string, string>
    payload?: unknown
  }

  // 변수 (메시지 템플릿에서 사용)
  variables?: Record<string, unknown>
}

// 템플릿 변수 치환
function interpolateTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    if (value === undefined || value === null) {
      return match
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  })
}

// Email 발송
async function sendEmail(
  config: NotificationNodeConfig,
  variables: Record<string, unknown>,
  logs: string[]
): Promise<NodeExecutionResult> {
  if (!config.email) {
    return {
      success: false,
      error: 'Email 설정이 없습니다',
      logs,
    }
  }

  // Resend API 키 확인
  if (!process.env.RESEND_API_KEY) {
    logs.push('[Email] RESEND_API_KEY 환경변수가 설정되지 않음')
    return {
      success: false,
      error: 'RESEND_API_KEY가 설정되지 않았습니다',
      logs,
    }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const to = Array.isArray(config.email.to) ? config.email.to : [config.email.to]
    const subject = config.email.subject
      ? interpolateTemplate(config.email.subject, variables)
      : config.title
        ? interpolateTemplate(config.title, variables)
        : 'GlowUS 알림'
    const message = interpolateTemplate(config.message, variables)

    logs.push(`[Email] Sending to: ${to.join(', ')}`)
    logs.push(`[Email] Subject: ${subject}`)

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'GlowUS <noreply@glowus.com>',
      to,
      cc: config.email.cc,
      bcc: config.email.bcc,
      subject,
      ...(config.email.html ? { html: message } : { text: message }),
    })

    if (error) {
      logs.push(`[Email] Error: ${error.message}`)
      return {
        success: false,
        error: `Email 발송 실패: ${error.message}`,
        logs,
      }
    }

    logs.push(`[Email] Sent successfully: ${data?.id}`)

    return {
      success: true,
      result: {
        type: 'email',
        messageId: data?.id,
        to,
        subject,
      },
      logs,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logs.push(`[Email] Error: ${errorMessage}`)
    return {
      success: false,
      error: `Email 발송 실패: ${errorMessage}`,
      logs,
    }
  }
}

// Slack 발송
async function sendSlackMessage(
  config: NotificationNodeConfig,
  variables: Record<string, unknown>,
  logs: string[]
): Promise<NodeExecutionResult> {
  if (!config.slack) {
    return {
      success: false,
      error: 'Slack 설정이 없습니다',
      logs,
    }
  }

  try {
    const message = interpolateTemplate(config.message, variables)
    const title = config.title ? interpolateTemplate(config.title, variables) : undefined

    // Webhook URL 사용
    if (config.slack.webhookUrl) {
      logs.push(`[Slack] Sending via webhook to: ${config.slack.channel}`)

      await sendSlackWebhook(config.slack.webhookUrl, {
        channel: config.slack.channel,
        text: message,
        blocks: config.slack.blocks ? config.slack.blocks as any : title ? [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
        ] : undefined,
      })

      logs.push('[Slack] Sent successfully via webhook')

      return {
        success: true,
        result: {
          type: 'slack',
          channel: config.slack.channel,
          method: 'webhook',
        },
        logs,
      }
    }

    // Access Token 사용
    if (config.slack.accessToken) {
      logs.push(`[Slack] Sending via API to: ${config.slack.channel}`)

      const result = await sendMessage(config.slack.accessToken, {
        channel: config.slack.channel,
        text: message,
        blocks: config.slack.blocks ? config.slack.blocks as any : title ? [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message,
            },
          },
        ] : undefined,
      })

      logs.push(`[Slack] Sent successfully: ${result.ts}`)

      return {
        success: true,
        result: {
          type: 'slack',
          channel: result.channel,
          ts: result.ts,
          method: 'api',
        },
        logs,
      }
    }

    return {
      success: false,
      error: 'Slack webhookUrl 또는 accessToken이 필요합니다',
      logs,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logs.push(`[Slack] Error: ${errorMessage}`)
    return {
      success: false,
      error: `Slack 발송 실패: ${errorMessage}`,
      logs,
    }
  }
}

// Webhook 발송
async function sendWebhook(
  config: NotificationNodeConfig,
  variables: Record<string, unknown>,
  logs: string[]
): Promise<NodeExecutionResult> {
  if (!config.webhook) {
    return {
      success: false,
      error: 'Webhook 설정이 없습니다',
      logs,
    }
  }

  try {
    const url = interpolateTemplate(config.webhook.url, variables)
    const message = interpolateTemplate(config.message, variables)
    const title = config.title ? interpolateTemplate(config.title, variables) : undefined
    const method = config.webhook.method || 'POST'

    // 페이로드 구성
    const payload = config.webhook.payload
      ? JSON.parse(interpolateTemplate(JSON.stringify(config.webhook.payload), variables))
      : {
          title,
          message,
          timestamp: new Date().toISOString(),
          source: 'GlowUS Workflow',
        }

    logs.push(`[Webhook] ${method} ${url}`)

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config.webhook.headers,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logs.push(`[Webhook] Error: ${response.status} ${response.statusText}`)
      return {
        success: false,
        error: `Webhook 실패: ${response.status} ${response.statusText}`,
        result: {
          status: response.status,
          body: errorText,
        },
        logs,
      }
    }

    let responseData: unknown
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      responseData = await response.json()
    } else {
      responseData = await response.text()
    }

    logs.push(`[Webhook] Sent successfully: ${response.status}`)

    return {
      success: true,
      result: {
        type: 'webhook',
        status: response.status,
        response: responseData,
      },
      logs,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logs.push(`[Webhook] Error: ${errorMessage}`)
    return {
      success: false,
      error: `Webhook 발송 실패: ${errorMessage}`,
      logs,
    }
  }
}

export async function executeNotificationNode(
  config: NotificationNodeConfig,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const logs: string[] = []

  // 변수 병합
  const allVariables: Record<string, unknown> = {
    ...context.previousResults,
    ...context.inputs,
    ...config.variables,
  }

  logs.push(`[Notification] Type: ${config.type}`)

  switch (config.type) {
    case 'email':
      return sendEmail(config, allVariables, logs)

    case 'slack':
      return sendSlackMessage(config, allVariables, logs)

    case 'webhook':
      return sendWebhook(config, allVariables, logs)

    default:
      return {
        success: false,
        error: `지원하지 않는 알림 유형: ${config.type}`,
        logs,
      }
  }
}
