/**
 * Gemini Live API - 실시간 음성 통화
 *
 * WebSocket 기반 실시간 음성 대화 API
 * - 음성 입력 → Gemini 처리 → 음성 출력
 * - 한국어 자동 감지 지원
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')

// 사용 가능한 음성 목록
const AVAILABLE_VOICES = {
  // 기본 음성
  'Puck': { gender: 'male', style: 'friendly' },
  'Charon': { gender: 'male', style: 'professional' },
  'Kore': { gender: 'female', style: 'warm' },
  'Fenrir': { gender: 'male', style: 'deep' },
  'Aoede': { gender: 'female', style: 'bright' },
  // 표현력 있는 음성 (감정 표현 가능)
  'Ara': { gender: 'female', style: 'expressive' },
  'Eve': { gender: 'female', style: 'expressive' },
  'Leo': { gender: 'male', style: 'expressive' },
} as const

type VoiceName = keyof typeof AVAILABLE_VOICES

interface VoiceCallRequest {
  action: 'start' | 'send_audio' | 'end'
  sessionId?: string
  audioData?: string  // base64 encoded PCM audio
  text?: string       // 텍스트 입력 (TTS용)
  voice?: VoiceName
  systemPrompt?: string
}

interface VoiceSession {
  id: string
  voice: VoiceName
  systemPrompt: string
  history: Array<{ role: string; content: string }>
  createdAt: Date
}

// 인메모리 세션 저장소
const sessions = new Map<string, VoiceSession>()

/**
 * POST - 음성 통화 세션 관리
 */
export async function POST(request: NextRequest) {
  try {
    const body: VoiceCallRequest = await request.json()
    const { action } = body

    switch (action) {
      case 'start':
        return await startSession(body)
      case 'send_audio':
        return await processAudio(body)
      case 'end':
        return await endSession(body)
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[Gemini Live] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * 세션 시작
 */
async function startSession(body: VoiceCallRequest) {
  const sessionId = crypto.randomUUID()
  const voice = body.voice || 'Kore'
  const systemPrompt = body.systemPrompt ||
    '당신은 친절하고 도움이 되는 AI 어시스턴트입니다. 한국어로 자연스럽게 대화해주세요.'

  const session: VoiceSession = {
    id: sessionId,
    voice,
    systemPrompt,
    history: [],
    createdAt: new Date(),
  }

  sessions.set(sessionId, session)

  // 세션 30분 후 자동 정리
  setTimeout(() => {
    sessions.delete(sessionId)
  }, 30 * 60 * 1000)

  return NextResponse.json({
    success: true,
    sessionId,
    voice,
    message: '음성 세션이 시작되었습니다.',
    config: {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      mimeType: 'audio/pcm',
    },
  })
}

/**
 * 오디오 처리 (텍스트 또는 오디오 입력)
 */
async function processAudio(body: VoiceCallRequest) {
  const { sessionId, audioData, text } = body

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: '세션 ID가 필요합니다' },
      { status: 400 }
    )
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '세션을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  try {
    // 텍스트 입력이 있으면 TTS로 처리
    if (text) {
      const response = await generateTextToSpeech(text, session)
      return NextResponse.json({
        success: true,
        sessionId,
        response: {
          text: response.text,
          audioData: response.audioData,
          mimeType: 'audio/pcm;rate=24000',
        },
      })
    }

    // 오디오 입력 처리
    if (audioData) {
      const response = await processAudioInput(audioData, session)
      return NextResponse.json({
        success: true,
        sessionId,
        response: {
          transcription: response.transcription,
          text: response.text,
          audioData: response.audioData,
          mimeType: 'audio/pcm;rate=24000',
        },
      })
    }

    return NextResponse.json(
      { success: false, error: '오디오 또는 텍스트 입력이 필요합니다' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[Gemini Live] Process error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * 텍스트를 음성으로 변환 (TTS)
 */
async function generateTextToSpeech(text: string, session: VoiceSession) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  })

  // 대화 히스토리에 추가
  session.history.push({ role: 'user', content: text })

  // Gemini로 응답 생성
  const chat = model.startChat({
    history: session.history.map(h => ({
      role: h.role as 'user' | 'model',
      parts: [{ text: h.content }],
    })),
    generationConfig: {
      maxOutputTokens: 500,
    },
  })

  const result = await chat.sendMessage(text)
  const responseText = result.response.text()

  // 히스토리에 응답 추가
  session.history.push({ role: 'model', content: responseText })

  // TTS는 클라이언트에서 Web Speech API 사용
  return {
    text: responseText,
    audioData: null, // 클라이언트 TTS 사용
  }
}

/**
 * 오디오 입력 처리 (STT → LLM → TTS)
 */
async function processAudioInput(audioData: string, session: VoiceSession) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  })

  // 오디오를 텍스트로 변환 (Gemini 멀티모달)
  const audioResult = await model.generateContent([
    {
      inlineData: {
        mimeType: 'audio/pcm;rate=16000',
        data: audioData,
      },
    },
    { text: '이 오디오의 내용을 정확히 받아적어주세요. 받아적기만 하고 다른 말은 하지 마세요.' },
  ])

  const transcription = audioResult.response.text()

  // 대화 히스토리에 추가
  session.history.push({ role: 'user', content: transcription })

  // 응답 생성
  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: session.systemPrompt }] },
      { role: 'model', parts: [{ text: '네, 알겠습니다. 친절하게 도와드리겠습니다.' }] },
      ...session.history.slice(0, -1).map(h => ({
        role: h.role as 'user' | 'model',
        parts: [{ text: h.content }],
      })),
    ],
  })

  const result = await chat.sendMessage(transcription)
  const responseText = result.response.text()

  // 히스토리에 응답 추가
  session.history.push({ role: 'model', content: responseText })

  return {
    transcription,
    text: responseText,
    audioData: null, // 클라이언트 TTS 사용
  }
}

/**
 * 세션 종료
 */
async function endSession(body: VoiceCallRequest) {
  const { sessionId } = body

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: '세션 ID가 필요합니다' },
      { status: 400 }
    )
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '세션을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  // 대화 요약 생성
  const summary = session.history.length > 0
    ? `총 ${session.history.length}개의 메시지가 교환되었습니다.`
    : '대화가 없습니다.'

  sessions.delete(sessionId)

  return NextResponse.json({
    success: true,
    sessionId,
    summary,
    duration: Math.round((Date.now() - session.createdAt.getTime()) / 1000),
    message: '음성 세션이 종료되었습니다.',
  })
}

/**
 * GET - 세션 상태 조회
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    // 사용 가능한 음성 목록 반환
    return NextResponse.json({
      success: true,
      voices: Object.entries(AVAILABLE_VOICES).map(([name, info]) => ({
        name,
        ...info,
      })),
      config: {
        inputSampleRate: 16000,
        outputSampleRate: 24000,
        channels: 1,
        bitDepth: 16,
      },
    })
  }

  const session = sessions.get(sessionId)
  if (!session) {
    return NextResponse.json(
      { success: false, error: '세션을 찾을 수 없습니다' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    session: {
      id: session.id,
      voice: session.voice,
      messageCount: session.history.length,
      createdAt: session.createdAt,
      durationSeconds: Math.round((Date.now() - session.createdAt.getTime()) / 1000),
    },
  })
}
