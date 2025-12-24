import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    console.error('[VoicePreview API] XAI_API_KEY not configured')
    return NextResponse.json({ error: 'XAI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const { voice, text } = await request.json()
    console.log('[VoicePreview API] Creating session for voice:', voice || 'sol')

    // Get ephemeral token (same as /api/grok-voice/token)
    const tokenRes = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_in: 300, // 5 minutes for preview
      }),
    })

    if (!tokenRes.ok) {
      const error = await tokenRes.text()
      console.error('[VoicePreview API] Failed to get token:', tokenRes.status, error)
      return NextResponse.json({ error: 'Failed to get voice token', details: error }, { status: tokenRes.status })
    }

    const tokenData = await tokenRes.json()
    console.log('[VoicePreview API] Token obtained, expires_at:', tokenData.expires_at)

    // xAI returns token in 'value' field, not 'client_secret'
    const clientSecret = tokenData.value || tokenData.client_secret

    if (!clientSecret) {
      console.error('[VoicePreview API] No token in response:', tokenData)
      return NextResponse.json({ error: 'No token in API response' }, { status: 500 })
    }

    // Return token info for client-side WebSocket connection
    return NextResponse.json({
      client_secret: clientSecret,
      voice: voice || 'sol',
      text: text || '반갑습니다. 주인님',
    })
  } catch (error: any) {
    console.error('[VoicePreview API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
