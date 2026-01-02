// @ts-nocheck
/**
 * Telnyx AI 전화 API
 *
 * AI가 실제 전화를 걸어서 고품질 음성으로 대화
 * - Telnyx로 전화 연결 (28원/분)
 * - OpenAI TTS로 고품질 음성 (5원/분)
 * - Gemini로 대화 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import Telnyx from 'telnyx'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// API 클라이언트
const telnyx = process.env.TELNYX_API_KEY
  ? new Telnyx(process.env.TELNYX_API_KEY)
  : null

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

// 활성 통화 세션 저장
const activeCalls = new Map<string, CallSession>()

interface CallSession {
  callControlId: string
  phoneNumber: string
  status: 'initiated' | 'ringing' | 'answered' | 'ended'
  messages: Array<{ role: string; content: string }>
  systemPrompt: string
  createdAt: Date
}

interface CallRequest {
  to: string              // 전화번호
  message?: string        // 첫 인사말
  systemPrompt?: string   // AI 성격
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

/**
 * POST - 전화 걸기
 */
export async function POST(request: NextRequest) {
  try {
    const body: CallRequest = await request.json()
    const { to, message, systemPrompt, voice = 'nova' } = body

    // Telnyx 설정 확인
    if (!telnyx) {
      return NextResponse.json({
        success: false,
        error: 'Telnyx가 설정되지 않았습니다.',
        setup: {
          step1: 'https://telnyx.com 가입 (무료, $1 크레딧 제공)',
          step2: 'API Key 발급',
          step3: '전화번호 구매 (~$1/월)',
          step4: '.env.local에 추가:',
          env: [
            'TELNYX_API_KEY=your_api_key',
            'TELNYX_PHONE_NUMBER=+1234567890',
          ]
        }
      }, { status: 400 })
    }

    // 전화번호 포맷
    const formattedNumber = formatPhoneNumber(to)
    const fromNumber = process.env.TELNYX_PHONE_NUMBER

    if (!fromNumber) {
      return NextResponse.json({
        success: false,
        error: 'TELNYX_PHONE_NUMBER가 설정되지 않았습니다.'
      }, { status: 400 })
    }

    // 첫 인사말 음성 생성
    const greeting = message || '안녕하세요, GlowUS AI 어시스턴트입니다. 무엇을 도와드릴까요?'

    // 전화 걸기
    const call = await (telnyx as any).calls.create({
      connection_id: process.env.TELNYX_CONNECTION_ID,
      to: formattedNumber,
      from: fromNumber,
      webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/voice/telnyx-webhook`,
      webhook_url_method: 'POST',
    })

    // 세션 저장
    const session: CallSession = {
      callControlId: call.data.call_control_id,
      phoneNumber: formattedNumber,
      status: 'initiated',
      messages: [],
      systemPrompt: systemPrompt || '당신은 친절한 AI 전화 어시스턴트입니다. 한국어로 자연스럽게 대화하세요.',
      createdAt: new Date(),
    }
    activeCalls.set(call.data.call_control_id, session)

    return NextResponse.json({
      success: true,
      callId: call.data.call_control_id,
      to: formattedNumber,
      status: 'calling',
      message: '전화를 걸고 있습니다...',
      greeting,
    })

  } catch (error: any) {
    console.error('[Telnyx] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * GET - 설정 상태 확인
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const callId = searchParams.get('callId')

  // 통화 상태 조회
  if (callId) {
    const session = activeCalls.get(callId)
    if (!session) {
      return NextResponse.json({
        success: false,
        error: '통화를 찾을 수 없습니다'
      }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      call: {
        id: callId,
        to: session.phoneNumber,
        status: session.status,
        duration: Math.round((Date.now() - session.createdAt.getTime()) / 1000),
        messageCount: session.messages.length,
      }
    })
  }

  // 설정 상태
  return NextResponse.json({
    success: true,
    configured: !!telnyx,
    settings: {
      TELNYX_API_KEY: !!process.env.TELNYX_API_KEY,
      TELNYX_PHONE_NUMBER: !!process.env.TELNYX_PHONE_NUMBER,
      TELNYX_CONNECTION_ID: !!process.env.TELNYX_CONNECTION_ID,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      GOOGLE_API_KEY: !!process.env.GOOGLE_API_KEY,
    },
    pricing: {
      call: '$0.02/분 (28원)',
      tts: '$0.005/분 (7원)',
      ai: '$0.001/응답 (1원)',
      total: '~35원/분',
    },
    setup: !telnyx ? {
      url: 'https://telnyx.com',
      steps: [
        '1. 무료 가입 ($1 크레딧 제공)',
        '2. API Key 발급',
        '3. 전화번호 구매 (~$1/월)',
        '4. .env.local에 키 추가',
      ]
    } : null
  })
}

/**
 * 전화번호 포맷 (한국 → E.164)
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('010') || digits.startsWith('011')) {
    return `+82${digits.slice(1)}`
  }
  if (digits.startsWith('82')) {
    return `+${digits}`
  }
  if (phone.startsWith('+')) {
    return phone
  }

  return `+82${digits}`
}

/**
 * AI 응답 생성 (Gemini)
 */
async function generateAIResponse(
  userMessage: string,
  session: CallSession
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  session.messages.push({ role: 'user', content: userMessage })

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: session.systemPrompt }] },
      { role: 'model', parts: [{ text: '네, 알겠습니다.' }] },
      ...session.messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      })),
    ],
  })

  const result = await chat.sendMessage(userMessage)
  const response = result.response.text()

  session.messages.push({ role: 'assistant', content: response })

  return response
}

/**
 * TTS 음성 생성 (OpenAI)
 */
async function generateSpeech(
  text: string,
  voice: string = 'nova'
): Promise<Buffer> {
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: voice as any,
    input: text,
    response_format: 'mp3',
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer
}
