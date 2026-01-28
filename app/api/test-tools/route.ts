import { NextResponse } from 'next/server'
import { createSuperAgentTools } from '@/lib/ai/super-agent-tools'

export async function GET() {
  try {
    const tools = createSuperAgentTools({
      agentId: 'test-agent',
      agentName: 'Test Agent',
      userId: 'test-user',
    })

    // Find open_app tool
    const openAppTool = tools.find(t => t.name === 'open_app')

    if (!openAppTool) {
      return NextResponse.json({ error: 'open_app tool not found' })
    }

    // Test calling the tool
    const result = await openAppTool.invoke({ app: 'Google Chrome' })

    return NextResponse.json({
      success: true,
      toolName: openAppTool.name,
      result: JSON.parse(result),
      totalTools: tools.length,
      toolNames: tools.map(t => t.name),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack })
  }
}
