/**
 * Twilio AI 전화 API
 *
 * AI가 실제 전화를 걸어서 대화합니다.
 * - Twilio로 전화 연결
 * - Gemini로 실시간 대화
 * - TTS/STT 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhone = process.env.TWILIO_PHONE_NUMBER

// Twilio 클라이언트
const client = accountSid && authToken ? twilio(accountSid, authToken) : null

interface CallRequest {
  to: string           // 전화번호 (예: +821012345678)
  message?: string     // AI가 할 첫 인사말
  voice?: string       // 음성 (man, woman, alice, etc.)
  language?: string    // 언어 (ko-KR, en-US, etc.)
}

/**
 * POST - 전화 걸기
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio 설정 확인
    if (!client || !twilioPhone) {
      return NextResponse.json({
        success: false,
        error: 'Twilio가 설정되지 않았습니다.',
        setup: {
          required: [
            'TWILIO_ACCOUNT_SID',
            'TWILIO_AUTH_TOKEN',
            'TWILIO_PHONE_NUMBER'
          ],
          guide: 'https://console.twilio.com 에서 계정을 만들고 .env.local에 추가하세요.'
        }
      }, { status: 400 })
    }

    const body: CallRequest = await request.json()
    const { to, message, voice = 'alice', language = 'ko-KR' } = body

    // 전화번호 포맷팅
    const formattedNumber = formatPhoneNumber(to)

    // 웹훅 URL (Vercel 또는 ngrok 필요)
    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://glowus.vercel.app'

    // 전화 걸기
    const call = await client.calls.create({
      to: formattedNumber,
      from: twilioPhone,
      twiml: generateTwiML(message || '안녕하세요, GlowUS AI 어시스턴트입니다.', voice, language),
      // 또는 웹훅 사용:
      // url: `${webhookUrl}/api/voice/twilio-webhook`,
      statusCallback: `${webhookUrl}/api/voice/twilio-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    })

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      to: formattedNumber,
      message: '전화를 걸고 있습니다...'
    })

  } catch (error: any) {
    console.error('[Twilio] Call error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET - 통화 상태 조회
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const callSid = searchParams.get('callSid')

  if (!client) {
    return NextResponse.json({
      success: false,
      error: 'Twilio가 설정되지 않았습니다.',
      setup: {
        TWILIO_ACCOUNT_SID: !!accountSid,
        TWILIO_AUTH_TOKEN: !!authToken,
        TWILIO_PHONE_NUMBER: !!twilioPhone,
      }
    })
  }

  if (!callSid) {
    // 설정 상태 반환
    return NextResponse.json({
      success: true,
      configured: true,
      twilioPhone: twilioPhone?.replace(/\d(?=\d{4})/g, '*'),
    })
  }

  try {
    const call = await client.calls(callSid).fetch()

    return NextResponse.json({
      success: true,
      call: {
        sid: call.sid,
        status: call.status,
        duration: call.duration,
        direction: call.direction,
        from: call.from,
        to: call.to,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * 전화번호 포맷팅 (한국 번호 → E.164 형식)
 */
function formatPhoneNumber(phone: string): string {
  // 숫자만 추출
  const digits = phone.replace(/\D/g, '')

  // 한국 번호 처리
  if (digits.startsWith('010') || digits.startsWith('011')) {
    return `+82${digits.slice(1)}`
  }
  if (digits.startsWith('82')) {
    return `+${digits}`
  }
  if (digits.startsWith('+')) {
    return phone
  }

  // 기본: 한국 번호로 가정
  return `+82${digits}`
}

/**
 * TwiML 생성 (Twilio Markup Language)
 */
function generateTwiML(message: string, voice: string, language: string): string {
  return `
    <Response>
      <Say voice="${voice}" language="${language}">
        ${message}
      </Say>
      <Gather input="speech" language="${language}" timeout="5" speechTimeout="auto">
        <Say voice="${voice}" language="${language}">
          무엇을 도와드릴까요?
        </Say>
      </Gather>
      <Say voice="${voice}" language="${language}">
        응답이 없어서 전화를 끊겠습니다. 안녕히 계세요.
      </Say>
    </Response>
  `.trim()
}
