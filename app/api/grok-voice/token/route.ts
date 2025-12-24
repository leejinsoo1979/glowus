import { NextResponse } from 'next/server'

// Grok Voice API ephemeral token 발급
export async function POST() {
  const apiKey = process.env.XAI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'XAI_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    // xAI ephemeral token API 호출
    const response = await fetch('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 1시간 유효
        expires_in: 3600,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[GrokVoice] Token error:', error)
      return NextResponse.json(
        { error: 'Failed to get ephemeral token' },
        { status: response.status }
      )
    }

    const data = await response.json()
    // xAI returns token in 'value' field, map to 'client_secret' for client compatibility
    return NextResponse.json({
      client_secret: data.value || data.client_secret,
      expires_at: data.expires_at,
    })
  } catch (error: any) {
    console.error('[GrokVoice] Token error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
