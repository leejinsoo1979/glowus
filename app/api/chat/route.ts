import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, model = 'grok-beta' } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'XAI API key not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Chat API] Grok error:', error)
      return NextResponse.json({ error: 'Failed to get response from Grok' }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    return NextResponse.json({
      content,
      model: data.model,
      usage: data.usage,
    })
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
