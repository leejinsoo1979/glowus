export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Telegram Bot Webhook Handler
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Get bot token
 * 3. Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/integrations/telegram/webhook
 *
 * Message Format:
 * /agent <agent_name> <instruction>
 *
 * Example:
 * /agent CodeAssistant refactor homepage component
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Telegram Webhook] Received:', JSON.stringify(body, null, 2))

    // Telegram message structure
    const message = body.message
    if (!message || !message.text) {
      return NextResponse.json({ ok: true }) // Ignore non-text messages
    }

    const chatId = message.chat.id
    const text = message.text.trim()
    const username = message.from.username || message.from.first_name || 'User'

    // Command parsing: /agent <agent_name_or_id> <instruction>
    if (!text.startsWith('/agent ')) {
      await sendTelegramMessage(chatId,
        `❌ Invalid command format.\n\nUsage:\n/agent <agent_name> <instruction>\n\nExample:\n/agent CodeBot refactor the homepage`
      )
      return NextResponse.json({ ok: true })
    }

    const args = text.substring(7).trim() // Remove '/agent '
    const firstSpaceIndex = args.indexOf(' ')

    if (firstSpaceIndex === -1) {
      await sendTelegramMessage(chatId, '❌ Please provide an instruction after the agent name.')
      return NextResponse.json({ ok: true })
    }

    const agentNameOrId = args.substring(0, firstSpaceIndex).trim()
    const instruction = args.substring(firstSpaceIndex + 1).trim()

    if (!instruction) {
      await sendTelegramMessage(chatId, '❌ Instruction cannot be empty.')
      return NextResponse.json({ ok: true })
    }

    // Find agent by name or ID
    const adminClient = createAdminClient()
    const { data: agents, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .or(`id.eq.${agentNameOrId},name.ilike.%${agentNameOrId}%`)
      .limit(1)

    if (agentError || !agents || agents.length === 0) {
      await sendTelegramMessage(chatId,
        `❌ Agent "${agentNameOrId}" not found.\n\nPlease check the agent name or ID.`
      )
      return NextResponse.json({ ok: true })
    }

    const agent = agents[0]

    // Send confirmation message
    await sendTelegramMessage(chatId,
      `🤖 Agent "${agent.name}" is working on your request...\n\n📋 Instruction: ${instruction.substring(0, 200)}${instruction.length > 200 ? '...' : ''}`
    )

    // Execute agent (async, don't wait)
    executeAgentAsync(agent.id, instruction, chatId, username).catch(error => {
      console.error('[Telegram Webhook] Async execution error:', error)
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ ok: true }) // Always return ok to Telegram
  }
}

/**
 * Execute agent and send results back to Telegram
 */
async function executeAgentAsync(
  agentId: string,
  instruction: string,
  chatId: number,
  username: string
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Call internal execute API
    const response = await fetch(`${baseUrl}/api/agents/${agentId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        title: `Telegram request from @${username}`,
      }),
    })

    const result = await response.json()

    if (result.success) {
      const output = result.output || 'Task completed successfully'
      const toolsUsed = result.toolsUsed || []
      const sources = result.sources || []

      let message = `✅ Task Completed!\n\n`
      message += `📤 Output:\n${output.substring(0, 3000)}\n\n`

      if (toolsUsed.length > 0) {
        message += `🛠 Tools Used: ${toolsUsed.join(', ')}\n`
      }

      if (sources.length > 0) {
        message += `📚 Sources: ${sources.length} items\n`
      }

      await sendTelegramMessage(chatId, message)
    } else {
      await sendTelegramMessage(chatId,
        `❌ Execution failed:\n\n${result.error || 'Unknown error'}`
      )
    }
  } catch (error) {
    console.error('[Telegram Async Execution] Error:', error)
    await sendTelegramMessage(chatId,
      `❌ Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Send message to Telegram chat
 */
async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
    return
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Telegram] Send message failed:', error)
    }
  } catch (error) {
    console.error('[Telegram] Send message error:', error)
  }
}
