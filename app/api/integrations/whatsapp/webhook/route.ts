export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeWithAutonomousLoop } from '@/lib/agent/autonomous-loop'

/**
 * WhatsApp Business API Webhook Handler
 *
 * Setup:
 * 1. Create WhatsApp Business Account
 * 2. Get API credentials (phone number ID, access token)
 * 3. Set webhook URL: https://your-domain.com/api/integrations/whatsapp/webhook
 * 4. Set verify token in webhook configuration
 *
 * Message Format:
 * agent:<agent_name> <instruction>
 *
 * Example:
 * agent:CodeBot refactor homepage
 */

// GET: Webhook verification (required by WhatsApp)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'glowus_webhook_token'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp] Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// POST: Handle incoming messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[WhatsApp Webhook] Received:', JSON.stringify(body, null, 2))

    // WhatsApp message structure
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value || !value.messages) {
      return NextResponse.json({ success: true }) // Acknowledge
    }

    const message = value.messages[0]
    const messageType = message.type

    // Only handle text messages
    if (messageType !== 'text') {
      return NextResponse.json({ success: true })
    }

    const from = message.from // Phone number
    const messageText = message.text.body.trim()
    const username = value.contacts?.[0]?.profile?.name || from

    // Command parsing: agent:<agent_name> <instruction>
    if (!messageText.toLowerCase().startsWith('agent:')) {
      await sendWhatsAppMessage(from,
        `❌ Invalid command format.\n\nUsage:\nagent:<agent_name> <instruction>\n\nExample:\nagent:CodeBot refactor homepage`
      )
      return NextResponse.json({ success: true })
    }

    const args = messageText.substring(6).trim() // Remove 'agent:'
    const firstSpaceIndex = args.indexOf(' ')

    if (firstSpaceIndex === -1) {
      await sendWhatsAppMessage(from, '❌ Please provide an instruction after the agent name.')
      return NextResponse.json({ success: true })
    }

    const agentNameOrId = args.substring(0, firstSpaceIndex).trim()
    const instruction = args.substring(firstSpaceIndex + 1).trim()

    if (!instruction) {
      await sendWhatsAppMessage(from, '❌ Instruction cannot be empty.')
      return NextResponse.json({ success: true })
    }

    // Find agent
    const adminClient = createAdminClient()
    const { data: agents, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .or(`id.eq.${agentNameOrId},name.ilike.%${agentNameOrId}%`)
      .limit(1)

    if (agentError || !agents || agents.length === 0) {
      await sendWhatsAppMessage(from,
        `❌ Agent "${agentNameOrId}" not found.\n\nPlease check the agent name or ID.`
      )
      return NextResponse.json({ success: true })
    }

    const agent = agents[0]

    // Send confirmation
    await sendWhatsAppMessage(from,
      `🤖 Agent "${agent.name}" is working on your request...\n\n📋 Instruction: ${instruction.substring(0, 200)}${instruction.length > 200 ? '...' : ''}`
    )

    // Execute agent with autonomous loop (async)
    executeAgentWithAutonomousLoop(agent.id, instruction, from, username).catch(error => {
      console.error('[WhatsApp Webhook] Async execution error:', error)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error)
    return NextResponse.json({ success: true })
  }
}

/**
 * Execute agent with autonomous loop and send results back to WhatsApp
 */
async function executeAgentWithAutonomousLoop(
  agentId: string,
  instruction: string,
  phoneNumber: string,
  username: string
) {
  try {
    const adminClient = createAdminClient()

    // Get agent
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      await sendWhatsAppMessage(phoneNumber, '❌ Agent not found')
      return
    }

    // Create virtual task
    const virtualTask = {
      id: `whatsapp-${Date.now()}`,
      title: `WhatsApp request from ${username}`,
      description: '',
      instructions: instruction,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString(),
    }

    // Execute with autonomous loop
    const result = await executeWithAutonomousLoop(agent, virtualTask as any, {
      maxIterations: 3,
      autoCommit: true,
      saveToNeuralMap: true,
    })

    // Send detailed progress report
    if (result.success) {
      let message = `✅ Task Completed Successfully!\n\n`

      // Show plan
      if (result.plan) {
        message += `📋 Plan:\n${result.plan.substring(0, 500)}${result.plan.length > 500 ? '...' : ''}\n\n`
      }

      // Show execution steps
      message += `🔄 Execution Steps (${result.executionSteps.length}):\n`
      result.executionSteps.forEach(step => {
        const emoji = step.phase === 'plan' ? '📋' :
                     step.phase === 'execute' ? '⚡' :
                     step.phase === 'verify' ? '✅' :
                     step.phase === 'fix' ? '🔧' : '💾'
        const status = step.success ? '✓' : '✗'
        message += `${emoji} ${step.step}. ${step.phase} ${status}\n`
      })
      message += '\n'

      // Show output
      message += `📤 Output:\n${result.output.substring(0, 2000)}${result.output.length > 2000 ? '...' : ''}\n\n`

      // Show commit
      if (result.finalCommit) {
        message += `💾 Committed: ${result.finalCommit}\n`
      }

      // Show Neural Map node
      if (result.neuralMapNodeId) {
        message += `🧠 Saved to Neural Map: ${result.neuralMapNodeId}\n`
      }

      await sendWhatsAppMessage(phoneNumber, message)
    } else {
      let message = `❌ Task Failed\n\n`

      // Show what went wrong
      message += `Error: ${result.error || 'Unknown error'}\n\n`

      // Show execution steps for debugging
      if (result.executionSteps.length > 0) {
        message += `🔄 Execution Steps:\n`
        result.executionSteps.forEach(step => {
          const emoji = step.phase === 'plan' ? '📋' :
                       step.phase === 'execute' ? '⚡' :
                       step.phase === 'verify' ? '✅' :
                       step.phase === 'fix' ? '🔧' : '💾'
          const status = step.success ? '✓' : '✗'
          message += `${emoji} ${step.step}. ${step.phase} ${status}`
          if (step.error) {
            message += ` (${step.error.substring(0, 50)})`
          }
          message += '\n'
        })
      }

      await sendWhatsAppMessage(phoneNumber, message)
    }
  } catch (error) {
    console.error('[WhatsApp Autonomous Execution] Error:', error)
    await sendWhatsAppMessage(phoneNumber,
      `❌ Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Send message via WhatsApp Business API
 */
async function sendWhatsAppMessage(to: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    console.error('[WhatsApp] Missing configuration (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)')
    return
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: text },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('[WhatsApp] Send message failed:', error)
    }
  } catch (error) {
    console.error('[WhatsApp] Send message error:', error)
  }
}
