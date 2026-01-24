/**
 * SSML Compiler for Radio-Grade TTS
 * 턴 단위 대본을 자연스러운 SSML로 컴파일
 *
 * 핵심 원칙:
 * 1. 호흡(break)으로 자연스러운 끊어읽기
 * 2. prosody로 감정/에너지 표현
 * 3. voice 태그로 화자 전환
 * 4. 문장 단위 <s> 태그로 운율 안정화
 */

import { normalizeText } from './normalizer'

// 화자 음성 설정
export interface VoiceConfig {
  name: string           // e.g., 'ko-KR-Neural2-C'
  languageCode: string   // e.g., 'ko-KR'
  pitch: number          // -20.0 ~ 20.0 semitones
  speakingRate: number   // 0.25 ~ 4.0
}

// 턴 데이터 구조
export interface Turn {
  id: string
  speaker: 'A' | 'B'
  text: string
  intent?: 'question' | 'answer' | 'reaction' | 'explanation' | 'joke' | 'emphasis'
  energy?: 0 | 1 | 2 | 3  // 0: 차분, 1: 보통, 2: 활기, 3: 흥분
  pauseHint?: 'short' | 'medium' | 'long'
  emphasisWords?: string[]
}

/**
 * 기본 음성 설정
 *
 * 한국어 TTS 음성 품질 순서:
 * 1. Chirp 3: HD - 최신 생성형 AI 모델, 가장 자연스럽고 감정 표현 풍부
 * 2. Journey - Chirp HD의 이전 이름
 * 3. Studio - 고품질
 * 4. Neural2 - 안정적
 *
 * Chirp 3: HD 음성 (27개):
 * - 여성: Aoede, Kore, Leda, Zephyr, Achernar, Autonoe, Callirrhoe, Despina, Erinome, Gacrux, Laomedeia, Pulcherrima, Sulafat, Vindemiatrix
 * - 남성: Charon, Puck, Fenrir, Orus, Achird, Algenib, Algieba, Alnilam, Enceladus, Iapetus, Rasalgethi, Sadachbia, Sadaltager, Schedar, Umbriel, Zubenelgenubi
 *
 * 형식: ko-KR-Chirp3-HD-[VoiceName]
 */
export const DEFAULT_VOICES: Record<'A' | 'B', VoiceConfig> = {
  A: {
    name: 'ko-KR-Chirp3-HD-Charon',  // Chirp 3 HD 남성
    languageCode: 'ko-KR',
    pitch: 1.5,           // 약간 높여서 활기있게
    speakingRate: 1.15    // 15% 빠르게
  },
  B: {
    name: 'ko-KR-Chirp3-HD-Aoede',  // Chirp 3 HD 여성
    languageCode: 'ko-KR',
    pitch: 2.0,           // 더 밝은 톤
    speakingRate: 1.2     // 20% 빠르게
  }
}

/**
 * Neural2 음성 설정 (Chirp 3 HD 실패 시 fallback)
 */
export const NEURAL2_VOICES: Record<'A' | 'B', VoiceConfig> = {
  A: {
    name: 'ko-KR-Neural2-C',  // Neural2 남성
    languageCode: 'ko-KR',
    pitch: 0,
    speakingRate: 1.0
  },
  B: {
    name: 'ko-KR-Neural2-A',  // Neural2 여성
    languageCode: 'ko-KR',
    pitch: 0,
    speakingRate: 1.0
  }
}

// 에너지 레벨에 따른 prosody 설정
const ENERGY_PROSODY: Record<number, { rate: string; pitch: string; volume: string }> = {
  0: { rate: '95%', pitch: '-1st', volume: 'soft' },      // 차분
  1: { rate: '100%', pitch: '0st', volume: 'medium' },    // 보통
  2: { rate: '105%', pitch: '+1st', volume: 'medium' },   // 활기
  3: { rate: '110%', pitch: '+2st', volume: 'loud' }      // 흥분
}

// 휴지 시간 설정
const PAUSE_DURATION: Record<string, string> = {
  short: '200ms',
  medium: '400ms',
  long: '700ms',
  sentence: '150ms',      // 문장 내 끊어읽기
  turn_start: '350ms',    // 턴 시작 전
  turn_end: '250ms',      // 턴 종료 후
  emphasis_before: '100ms', // 강조 단어 전
  emphasis_after: '80ms'    // 강조 단어 후
}

/**
 * 문장을 <s> 태그로 감싸고 적절한 휴지 삽입
 */
function wrapSentences(text: string): string {
  // 문장 분리 (마침표, 물음표, 느낌표 기준)
  const sentences = text.split(/(?<=[.!?。])\s*/).filter(s => s.trim())

  if (sentences.length === 0) {
    return `<s>${text}</s>`
  }

  return sentences.map((sentence, idx) => {
    const trimmed = sentence.trim()
    if (!trimmed) return ''

    // 마지막 문장이 아니면 짧은 휴지 추가
    const pause = idx < sentences.length - 1
      ? `<break time="${PAUSE_DURATION.sentence}"/>`
      : ''

    return `<s>${trimmed}</s>${pause}`
  }).join('')
}

/**
 * 강조 단어에 emphasis 태그 적용
 */
function applyEmphasis(text: string, emphasisWords: string[]): string {
  let result = text

  for (const word of emphasisWords) {
    // 이미 SSML 태그 안에 있는지 확인
    const regex = new RegExp(`(?<!<[^>]*)\\b(${word})\\b(?![^<]*>)`, 'g')
    result = result.replace(regex, (match) => {
      return `<break time="${PAUSE_DURATION.emphasis_before}"/><emphasis level="moderate">${match}</emphasis><break time="${PAUSE_DURATION.emphasis_after}"/>`
    })
  }

  return result
}

/**
 * 의도에 따른 prosody 조정
 */
function getIntentProsody(intent?: Turn['intent']): string {
  switch (intent) {
    case 'question':
      return 'pitch="+1st"'  // 질문은 끝이 올라감
    case 'emphasis':
      return 'rate="95%" volume="loud"'  // 강조는 천천히, 크게
    case 'joke':
      return 'rate="105%" pitch="+0.5st"'  // 농담은 약간 빠르고 가볍게
    case 'reaction':
      return 'rate="110%"'  // 리액션은 빠르게
    default:
      return ''
  }
}

/**
 * 단일 턴을 SSML로 컴파일
 * Neural2 호환: 단순화된 SSML만 사용 (중첩 prosody 금지)
 */
export function compileTurn(
  turn: Turn,
  _voices: Record<'A' | 'B', VoiceConfig> = DEFAULT_VOICES,
  _isFirst: boolean = false
): string {
  // 텍스트 정규화
  let text = normalizeText(turn.text)

  // 문장 단위로 분리
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim())

  const processedSentences = sentences.map((sentence, idx) => {
    let s = sentence.trim()

    // === 쉼표: 자연스러운 호흡 ===
    s = s.replace(/,\s*/g, ', <break time="200ms"/>')

    // === 말줄임표: 생각하는 느낌 ===
    s = s.replace(/\.{2,}/g, ' <break time="400ms"/> ')

    // === 문장 사이 호흡 ===
    if (idx > 0) {
      s = '<break time="300ms"/>' + s
    }

    return s
  })

  const finalText = processedSentences.join(' ')

  // 단순한 SSML (Neural2 호환)
  return `<speak>${finalText}</speak>`
}

/**
 * 여러 턴을 하나의 SSML로 컴파일 (단일 API 호출용)
 * Neural2 호환: 단순화된 SSML
 */
export function compileMultipleTurns(
  turns: Turn[],
  _voices: Record<'A' | 'B', VoiceConfig> = DEFAULT_VOICES
): string {
  let ssml = '<speak>'

  turns.forEach((turn, idx) => {
    // 턴 시작 전 휴지
    if (idx > 0) {
      const pauseDuration = turn.pauseHint
        ? PAUSE_DURATION[turn.pauseHint]
        : PAUSE_DURATION.turn_start
      ssml += `<break time="${pauseDuration}"/>`
    }

    // 텍스트 처리 (단순화)
    const processedText = normalizeText(turn.text)
      .replace(/,\s*/g, ', <break time="150ms"/>')
      .replace(/\.{2,}/g, ' <break time="300ms"/> ')

    ssml += processedText

    // 턴 종료 휴지
    ssml += `<break time="${PAUSE_DURATION.turn_end}"/>`
  })

  ssml += '</speak>'

  return ssml
}

/**
 * 간단한 텍스트를 SSML로 변환 (화자 정보 없이)
 * Neural2 호환: 단순화된 SSML
 */
export function compileSimple(
  text: string,
  _options: {
    voice?: VoiceConfig
    energy?: 0 | 1 | 2 | 3
    pauseBefore?: string
    pauseAfter?: string
  } = {}
): string {
  // 텍스트 처리 (단순화)
  const processedText = normalizeText(text)
    .replace(/,\s*/g, ', <break time="150ms"/>')
    .replace(/\.{2,}/g, ' <break time="300ms"/> ')

  return `<speak>${processedText}</speak>`
}

export default {
  compileTurn,
  compileMultipleTurns,
  compileSimple,
  DEFAULT_VOICES,
  PAUSE_DURATION
}
