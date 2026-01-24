/**
 * Scriptwriter Module
 * 원문을 '라디오 대화체'로 변환하는 핵심 모듈
 *
 * 핵심 규칙:
 * 1. 원문을 그대로 읽지 않음 - 대화체로 재작성
 * 2. 구조: A(요점 1개) → B(리액션+질문) → A(예시/비유) → B(짧은 정리+전환)
 * 3. 문장 길이: 15~25자 중심
 * 4. 턴 길이: 8~12초 (약 3~5문장)
 * 5. 로봇 낭독처럼 들리면 실패
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  IScriptwriter,
  ContentOutline,
  OutlineSection,
  PipelineConfig,
  PipelineInput,
  ScriptDraft,
  ScriptTurn,
  ScriptSegment,
  ScriptSafety,
  Speaker,
  TurnIntent,
  Pace,
  StylePreset,
  BanterLevel
} from '../core/types'
import { detectForbiddenSlang } from './interjection-library'

// ============================================================================
// Constants & Presets
// ============================================================================

/** 스타일 프리셋별 설정 */
const STYLE_CONFIGS: Record<StylePreset, {
  turnStructure: string
  sentenceLength: { min: number; max: number }
  turnDuration: { min: number; max: number }
  formalityLevel: 'formal' | 'casual' | 'mixed'
  humorFrequency: number
}> = {
  NEWS: {
    turnStructure: 'ABAB',  // 빠른 교대
    sentenceLength: { min: 12, max: 20 },
    turnDuration: { min: 6, max: 10 },
    formalityLevel: 'mixed',
    humorFrequency: 0.1
  },
  FRIENDLY: {
    turnStructure: 'ABAB',
    sentenceLength: { min: 15, max: 25 },
    turnDuration: { min: 8, max: 12 },
    formalityLevel: 'casual',
    humorFrequency: 0.3
  },
  DEEPDIVE: {
    turnStructure: 'AABAB',  // A가 더 많이 설명
    sentenceLength: { min: 18, max: 30 },
    turnDuration: { min: 10, max: 15 },
    formalityLevel: 'mixed',
    humorFrequency: 0.15
  }
}

/** BanterLevel에 따른 리액션 빈도 */
const BANTER_CONFIGS: Record<BanterLevel, {
  reactionFrequency: number  // 0-1
  questionFrequency: number  // 0-1
  exampleFrequency: number   // 0-1
}> = {
  0: { reactionFrequency: 0.1, questionFrequency: 0.2, exampleFrequency: 0.3 },
  1: { reactionFrequency: 0.2, questionFrequency: 0.3, exampleFrequency: 0.4 },
  2: { reactionFrequency: 0.4, questionFrequency: 0.5, exampleFrequency: 0.5 },
  3: { reactionFrequency: 0.6, questionFrequency: 0.6, exampleFrequency: 0.6 }
}

/** 섹션 타입별 턴 인텐트 매핑 */
const SECTION_INTENT_MAP: Record<OutlineSection['type'], TurnIntent[]> = {
  opening: ['opener_hook', 'introduce_topic'],
  keypoint: ['explain_point', 'react', 'ask_question', 'give_example'],
  example: ['give_example', 'react', 'clarify'],
  analogy: ['give_example', 'react'],
  caution: ['counter', 'clarify', 'react'],
  counter: ['counter', 'react', 'clarify'],
  recap: ['summarize', 'transition'],
  closing: ['summarize', 'closing']
}

/**
 * 자연스러운 대화체 패턴
 * - 실제 라디오/팟캐스트 분석 기반
 * - 상투적 표현 배제
 * - 호스트 개성 반영
 */
const CONVERSATIONAL_PATTERNS = {
  // 요점 설명 패턴 (Host A) - 친근하고 명확하게
  explain: [
    // 직접적 설명
    '이게 뭐냐면요, {point}.',
    '사실 별거 아닌데요, {point}.',
    '한마디로? {point}.',
    // 청자 참여 유도
    '생각해보세요, {point}.',
    '재밌는 게 뭐냐면, {point}.',
    // 맥락 제공
    '왜 이게 중요하냐면, {point}.',
    '원래 이런 배경이 있어요. {point}.',
    // 자연스러운 전개
    '근데 여기서 포인트가, {point}.',
    '제가 이거 보고 놀랐거든요? {point}.',
    '이거 진짜 신기한 게, {point}.',
    // 대화체 억양
    '아 그리고요, {point}.',
    '솔직히 말하면, {point}.',
    // 리듬감
    '그래서? {point}.',
    '뭐가 다르냐면, {point}.',
    '포인트는 딱 하나예요. {point}.'
  ],
  // 리액션 패턴 (Host B) - 감정 풍부하게
  reaction: [
    // 놀람/감탄
    '엥 진짜요? 그러면 {summary}인 거예요?',
    '아아 그래서 {summary}였구나!',
    '헐 몰랐어요, {summary}라니.',
    // 호기심
    '잠깐, 근데 {question}?',
    '오오 그러면 혹시 {question}?',
    '아 궁금한 게요, {question}?',
    // 공감
    '맞아요 맞아요, 저도 {summary} 느꼈어요.',
    '그치 그치, {summary} 맞죠.',
    '인정이요, {summary}.',
    // 확인
    '다시 정리하면, {summary} 맞아요?',
    '그니까 결국 {summary}?',
    // 전환
    '오케이 알겠어요, 근데 {question}?',
    '아 이해했어요! 그러면 {question}?',
    // 호응
    '와 그건 몰랐네, {summary}라니.',
    '음 그렇구나, {summary}.',
    '흥미롭네요, {summary}.'
  ],
  // 예시/비유 패턴 (Host A) - 구체적이고 친숙하게
  example: [
    // 실생활 연결
    '우리 일상에서 보면요, {example} 있잖아요.',
    '쉽게 말해서, {example} 같은 거예요.',
    '예를 들어볼게요. {example}.',
    // 상상 유도
    '상상해보세요. {example}.',
    '{example} 떠올려보시면 딱이에요.',
    // 대비
    '반대로 {example} 생각해보면요.',
    '{example}랑 비교하면 확 와닿아요.',
    // 경험 기반
    '저도 {example} 겪어봤는데요.',
    '실제로 {example} 사례가 있어요.',
    // 추상→구체
    '좀 뜬구름 같죠? {example} 보시면 이해돼요.',
    '이게 좀 어려운데, {example} 생각해보세요.'
  ],
  // 정리/전환 패턴 (Host B) - 자연스럽게
  summary: [
    // 짧은 정리
    '아 그래서 {key}가 포인트네요.',
    '결국 {takeaway}.',
    '한줄요약: {takeaway}.',
    // 확인
    '정리하면 {takeaway}, 맞죠?',
    '그니까 {key}가 핵심?',
    // 전환 유도
    '오케이, 그러면 {next}도 궁금해지는데요?',
    '자자, 근데 {next}는요?',
    '알겠어요! {next}로 넘어가볼까요?',
    // 호응 + 전환
    '좋아요 좋아요, {transition}도 해주세요.',
    '와 재밌다, 근데 {next}도 있어요?',
    // 감탄 + 전환
    '오 대박, {key}였구나. {next}는요?'
  ],
  // 오프닝 훅 패턴 - 흥미 유발
  opener: [
    // 질문형
    '여러분 혹시 {hook} 알고 계세요?',
    '{question}— 생각해본 적 있어요?',
    '{topic} 왜 갑자기 핫해졌는지 아세요?',
    // 충격
    '충격적인 얘기 하나 할게요. {hook}.',
    '저 이거 알고 진짜 놀랐거든요? {hook}.',
    // 스토리형
    '제가 최근에 {hook} 경험했는데요.',
    '얼마 전에 {hook} 봤는데, 와...',
    // 직접적
    '{topic}. 오늘 이거 파헤쳐볼게요.',
    '자 오늘은요, {topic} 얘기해요.',
    // 공감형
    '{topic} 다들 궁금하시죠? 저도요.',
    '요즘 {topic} 얘기 많이 들리죠?'
  ],
  // 클로징 패턴 - 여운 있게
  closing: [
    // 요약
    '오늘 핵심은 이거였어요.',
    '기억할 건 딱 하나!',
    // 행동 유도
    '한번 직접 해보세요, 느낌이 달라요.',
    '오늘 내용 참고해서 한번 시도해보시면요.',
    // 감사/인사
    '들어주셔서 감사해요!',
    '오늘도 같이해서 좋았어요.',
    // 다음 예고
    '다음엔 더 재밌는 거 가져올게요.',
    '다음 주제도 기대해주세요!',
    // 피드백 요청
    '어땠어요? 피드백 남겨주세요.',
    '궁금한 거 있으면 댓글로요!'
  ],
  // 맞장구 패턴 (Host B 전용) - 짧고 자연스럽게
  backChannel: [
    '맞아요 맞아요.',
    '그치요.',
    '아 진짜요?',
    '헐.',
    '오오.',
    '그렇구나.',
    '인정.',
    '음음.',
    '아아.',
    '와.',
    '대박.'
  ],
  // 필러/연결어 - 자연스러운 흐름
  filler: [
    '근데요,',
    '아 그리고,',
    '참고로,',
    '그게 뭐냐면,',
    '솔직히,',
    '사실은요,',
    '재밌는 게,',
    '여기서 중요한 게,',
    '한 가지 더,',
    '덧붙이면,'
  ],
  // 전환 연결어
  transition_phrases: [
    '자 그러면,',
    '오케이,',
    '다음은요,',
    '이제,',
    '여기서,',
    '그럼,',
    '좋아요,',
    '자자,'
  ]
}

/** Pause 설정 (ms) */
const PAUSE_CONFIG = {
  beforeTurn: { min: 150, max: 450 },
  afterTurn: { min: 120, max: 220 },
  afterQuestion: { min: 300, max: 500 },
  beforeExample: { min: 200, max: 350 },
  beforeClosing: { min: 400, max: 600 }
}

// ============================================================================
// Utility Functions
// ============================================================================

/** 문장 길이 체크 */
function checkSentenceLength(sentence: string, limits: { min: number; max: number }): {
  valid: boolean
  length: number
  suggestion?: string
} {
  const length = sentence.replace(/\s/g, '').length
  if (length < limits.min) {
    return { valid: false, length, suggestion: '문장이 너무 짧습니다. 내용을 보충하세요.' }
  }
  if (length > limits.max) {
    return { valid: false, length, suggestion: '문장이 너무 깁니다. 두 문장으로 나누세요.' }
  }
  return { valid: true, length }
}

/** 문장 분할 (15-25자 기준) */
function splitIntoSentences(text: string, targetLength: { min: number; max: number }): string[] {
  // 기본 구두점으로 분할
  const rawSentences = text.split(/(?<=[.?!요죠네다])\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const result: string[] = []

  for (const sentence of rawSentences) {
    const len = sentence.replace(/\s/g, '').length

    if (len <= targetLength.max) {
      result.push(sentence)
    } else {
      // 너무 긴 문장은 쉼표나 접속사로 분할
      const parts = sentence.split(/(?<=[,])\s*|(?=그리고|그래서|하지만|그런데|또한)/)
        .map(s => s.trim())
        .filter(s => s.length > 0)

      for (const part of parts) {
        result.push(part)
      }
    }
  }

  return result
}

/** 턴 길이 예측 (초 단위) */
function estimateTurnDuration(text: string, pace: Pace): number {
  const charCount = text.replace(/\s/g, '').length
  // 한국어: 분당 약 300-350음절
  const charsPerSecond = pace === 'slow' ? 4 : pace === 'fast' ? 6 : 5
  return charCount / charsPerSecond
}

/** 랜덤 선택 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 랜덤 범위 */
function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 페이스 결정 */
function determinePace(intent: TurnIntent): Pace {
  switch (intent) {
    case 'opener_hook':
    case 'react':
      return 'fast'
    case 'explain_point':
    case 'give_example':
    case 'summarize':
      return 'normal'
    case 'closing':
      return 'slow'
    default:
      return 'normal'
  }
}

/** Pause 결정 */
function determinePause(
  intent: TurnIntent,
  isFirst: boolean,
  isLast: boolean
): { before: number; after: number } {
  let before = randomRange(PAUSE_CONFIG.beforeTurn.min, PAUSE_CONFIG.beforeTurn.max)
  let after = randomRange(PAUSE_CONFIG.afterTurn.min, PAUSE_CONFIG.afterTurn.max)

  if (intent === 'ask_question') {
    after = randomRange(PAUSE_CONFIG.afterQuestion.min, PAUSE_CONFIG.afterQuestion.max)
  }
  if (intent === 'give_example') {
    before = randomRange(PAUSE_CONFIG.beforeExample.min, PAUSE_CONFIG.beforeExample.max)
  }
  if (intent === 'closing' || isLast) {
    before = randomRange(PAUSE_CONFIG.beforeClosing.min, PAUSE_CONFIG.beforeClosing.max)
  }
  if (isFirst) {
    before = 0
  }

  return { before, after }
}

/** 강조 단어 추출 */
function extractEmphasisWords(text: string): string[] {
  const emphasisMarkers = [
    /(?:정말|진짜|완전|매우|특히)\s*(\S+)/g,
    /(\S+)(?:이|가)\s*(?:핵심|중요|포인트)/g,
    /"([^"]+)"/g,  // 따옴표 안 텍스트
    /『([^』]+)』/g  // 겹따옴표 안 텍스트
  ]

  const words: string[] = []
  for (const pattern of emphasisMarkers) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        words.push(match[1])
      }
    }
  }

  return [...new Set(words)]
}

// ============================================================================
// Turn Generator
// ============================================================================

interface TurnGeneratorContext {
  sectionId: string
  sectionType: OutlineSection['type']
  keypoints: string[]
  examples: string[]
  currentIndex: number
  totalTurns: number
  styleConfig: typeof STYLE_CONFIGS['FRIENDLY']
  banterConfig: typeof BANTER_CONFIGS[2]
}

/** A→B→A→B 구조로 턴 생성 */
function generateTurnSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionType, keypoints, examples, styleConfig, banterConfig } = context

  // 섹션 타입에 따른 턴 시퀀스 결정
  switch (sectionType) {
    case 'opening':
      turns.push(...generateOpeningSequence(context))
      break
    case 'keypoint':
      turns.push(...generateKeypointSequence(context))
      break
    case 'example':
    case 'analogy':
      turns.push(...generateExampleSequence(context))
      break
    case 'caution':
    case 'counter':
      turns.push(...generateCounterSequence(context))
      break
    case 'recap':
      turns.push(...generateRecapSequence(context))
      break
    case 'closing':
      turns.push(...generateClosingSequence(context))
      break
    default:
      turns.push(...generateKeypointSequence(context))
  }

  return turns
}

/** 오프닝 시퀀스 - 진짜 팟캐스트처럼 */
function generateOpeningSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionId, keypoints, banterConfig } = context
  const topic = keypoints[0] || '오늘 주제'

  // 오프닝 스타일 랜덤 선택
  const openingStyle = Math.random()

  if (openingStyle < 0.33) {
    // 스타일 1: 질문으로 시작
    turns.push({
      speaker: 'HOST_A',
      rawText: `여러분 혹시 ${topic} 들어보셨어요?`,
      sectionId,
      intent: 'opener_hook',
      emphasisWords: [topic],
      pace: 'normal',
      pauseMsBefore: 0,
      pauseMsAfter: randomRange(350, 500)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: `저 그거 진짜 궁금했어요! 뭔지 알려주세요.`,
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(100, 200),
      pauseMsAfter: randomRange(150, 250)
    })
  } else if (openingStyle < 0.66) {
    // 스타일 2: 티저로 시작
    turns.push({
      speaker: 'HOST_A',
      rawText: `오늘 진짜 재밌는 거 준비했어요. ${topic}인데요.`,
      sectionId,
      intent: 'opener_hook',
      emphasisWords: [topic],
      pace: 'normal',
      pauseMsBefore: 0,
      pauseMsAfter: randomRange(200, 300)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: `오 뭔데요? 기대되는데.`,
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(250, 400)
    })
    // A가 간단히 부연
    turns.push({
      speaker: 'HOST_A',
      rawText: `요즘 ${topic} 이야기 많이 들리잖아요. 오늘 제대로 파볼게요.`,
      sectionId,
      intent: 'introduce_topic',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(100, 200),
      pauseMsAfter: randomRange(200, 350)
    })
  } else {
    // 스타일 3: 직접 도입
    const hook = keypoints[1] || `${topic}가 왜 중요한지`
    turns.push({
      speaker: 'HOST_A',
      rawText: `자 오늘은요, ${topic} 이야기해볼 건데요.`,
      sectionId,
      intent: 'opener_hook',
      emphasisWords: [topic],
      pace: 'normal',
      pauseMsBefore: 0,
      pauseMsAfter: randomRange(150, 250)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: `좋아요! ${hook} 저도 알고 싶었어요.`,
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(100, 180),
      pauseMsAfter: randomRange(200, 300)
    })
  }

  return turns
}

/** 키포인트 시퀀스 - 자연스러운 대화 흐름 */
function generateKeypointSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionId, keypoints, examples, banterConfig } = context

  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i]
    const example = examples[i % examples.length] || ''
    const isFirst = i === 0
    const isLast = i === keypoints.length - 1

    // 다양한 대화 패턴 중 하나 선택
    const pattern = Math.random()

    if (pattern < 0.25) {
      // 패턴 1: A 설명 → B 짧은 호응 → A 부연 → B 질문
      generatePattern1(turns, sectionId, keypoint, example, isFirst, banterConfig)
    } else if (pattern < 0.5) {
      // 패턴 2: A 질문형 도입 → B 궁금 → A 핵심 설명 → B 감탄
      generatePattern2(turns, sectionId, keypoint, example, isFirst, banterConfig)
    } else if (pattern < 0.75) {
      // 패턴 3: A 예시 먼저 → B 반응 → A 핵심 연결
      generatePattern3(turns, sectionId, keypoint, example, isFirst, banterConfig)
    } else {
      // 패턴 4: 대화형 - A B 빠른 교차
      generatePattern4(turns, sectionId, keypoint, example, isFirst, banterConfig)
    }

    // 마지막 키포인트면 정리
    if (isLast) {
      const summaryTexts = [
        `아 그래서 결국 ${keypoint.slice(0, 12)}가 핵심이네요.`,
        `정리하면 ${keypoint.slice(0, 12)}, 맞죠?`,
        `오케이, ${keypoint.slice(0, 12)} 기억할게요!`
      ]
      turns.push({
        speaker: 'HOST_B',
        rawText: randomChoice(summaryTexts),
        sectionId,
        intent: 'summarize',
        emphasisWords: [],
        pace: 'normal',
        pauseMsBefore: randomRange(200, 350),
        pauseMsAfter: randomRange(200, 350)
      })
    }
  }

  return turns
}

/** 패턴 1: 설명 → 호응 → 부연 → 질문 */
function generatePattern1(
  turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[],
  sectionId: string,
  keypoint: string,
  example: string,
  isFirst: boolean,
  banterConfig: typeof BANTER_CONFIGS[2]
): void {
  // A: 핵심 설명
  const filler = isFirst ? '' : randomChoice(CONVERSATIONAL_PATTERNS.filler) + ' '
  const explainTexts = [
    `${filler}이게 뭐냐면요, ${keypoint}.`,
    `${filler}한마디로 ${keypoint}예요.`,
    `${filler}재밌는 게 뭐냐면, ${keypoint}.`
  ]
  turns.push({
    speaker: 'HOST_A',
    rawText: randomChoice(explainTexts),
    sectionId,
    intent: 'explain_point',
    emphasisWords: extractEmphasisWords(keypoint),
    pace: 'normal',
    pauseMsBefore: isFirst ? randomRange(100, 200) : randomRange(200, 350),
    pauseMsAfter: randomRange(150, 280)
  })

  // B: 짧은 호응 (확률적)
  if (Math.random() < banterConfig.reactionFrequency) {
    turns.push({
      speaker: 'HOST_B',
      rawText: randomChoice(CONVERSATIONAL_PATTERNS.backChannel),
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(50, 120),
      pauseMsAfter: randomRange(100, 200)
    })
  }

  // A: 예시로 부연 (있을 때)
  if (example && Math.random() < banterConfig.exampleFrequency) {
    const exampleTexts = [
      `쉽게 말해서, ${example} 같은 거예요.`,
      `예를 들면 ${example} 있잖아요.`,
      `${example} 생각하면 딱이에요.`
    ]
    turns.push({
      speaker: 'HOST_A',
      rawText: randomChoice(exampleTexts),
      sectionId,
      intent: 'give_example',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(200, 350)
    })

    // B: 질문
    if (Math.random() < banterConfig.questionFrequency) {
      const questions = [
        '오 그러면 실제로 많이 쓰여요?',
        '아아 그렇구나, 근데 주의할 점은요?',
        '헐 그래요? 더 알려주세요!'
      ]
      turns.push({
        speaker: 'HOST_B',
        rawText: randomChoice(questions),
        sectionId,
        intent: 'ask_question',
        emphasisWords: [],
        pace: 'fast',
        pauseMsBefore: randomRange(100, 200),
        pauseMsAfter: randomRange(300, 450)
      })
    }
  }
}

/** 패턴 2: 질문 도입 → 궁금 → 설명 → 감탄 */
function generatePattern2(
  turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[],
  sectionId: string,
  keypoint: string,
  example: string,
  isFirst: boolean,
  banterConfig: typeof BANTER_CONFIGS[2]
): void {
  // A: 질문형 도입
  const leadTexts = [
    `여기서 중요한 게 뭔지 아세요?`,
    `근데 이게 왜 중요할까요?`,
    `자, 여기서 핵심이 뭐냐면요.`
  ]
  turns.push({
    speaker: 'HOST_A',
    rawText: randomChoice(leadTexts),
    sectionId,
    intent: 'explain_point',
    emphasisWords: [],
    pace: 'normal',
    pauseMsBefore: isFirst ? randomRange(100, 200) : randomRange(200, 350),
    pauseMsAfter: randomRange(350, 500)
  })

  // B: 궁금
  turns.push({
    speaker: 'HOST_B',
    rawText: randomChoice(['뭔데요?', '궁금해요!', '알려주세요!']),
    sectionId,
    intent: 'ask_question',
    emphasisWords: [],
    pace: 'fast',
    pauseMsBefore: randomRange(80, 150),
    pauseMsAfter: randomRange(150, 250)
  })

  // A: 핵심 설명
  turns.push({
    speaker: 'HOST_A',
    rawText: `${keypoint}${example ? `. ${example} 보면 알 수 있어요` : ''}`,
    sectionId,
    intent: 'explain_point',
    emphasisWords: extractEmphasisWords(keypoint),
    pace: 'normal',
    pauseMsBefore: randomRange(100, 180),
    pauseMsAfter: randomRange(200, 350)
  })

  // B: 감탄
  if (Math.random() < banterConfig.reactionFrequency) {
    const reactions = [
      '오 그렇구나!',
      '아아 이해됐어요!',
      '와 신기하네요.',
      '헐 그래요?'
    ]
    turns.push({
      speaker: 'HOST_B',
      rawText: randomChoice(reactions),
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(150, 280)
    })
  }
}

/** 패턴 3: 예시 먼저 → 반응 → 핵심 연결 */
function generatePattern3(
  turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[],
  sectionId: string,
  keypoint: string,
  example: string,
  isFirst: boolean,
  banterConfig: typeof BANTER_CONFIGS[2]
): void {
  const effectiveExample = example || '실생활에서 자주 보는 것'

  // A: 예시로 시작
  const exampleTexts = [
    `${effectiveExample} 아시죠?`,
    `${effectiveExample} 생각해보세요.`,
    `${effectiveExample} 있잖아요.`
  ]
  turns.push({
    speaker: 'HOST_A',
    rawText: randomChoice(exampleTexts),
    sectionId,
    intent: 'give_example',
    emphasisWords: [],
    pace: 'normal',
    pauseMsBefore: isFirst ? randomRange(100, 200) : randomRange(200, 350),
    pauseMsAfter: randomRange(250, 400)
  })

  // B: 아는 척/반응
  turns.push({
    speaker: 'HOST_B',
    rawText: randomChoice(['네네, 알아요!', '아 그거요?', '음 알죠!']),
    sectionId,
    intent: 'react',
    emphasisWords: [],
    pace: 'fast',
    pauseMsBefore: randomRange(80, 150),
    pauseMsAfter: randomRange(100, 200)
  })

  // A: 핵심 연결
  turns.push({
    speaker: 'HOST_A',
    rawText: `그거랑 같은 원리예요. ${keypoint}.`,
    sectionId,
    intent: 'explain_point',
    emphasisWords: extractEmphasisWords(keypoint),
    pace: 'normal',
    pauseMsBefore: randomRange(80, 150),
    pauseMsAfter: randomRange(200, 350)
  })

  // B: 이해 반응
  if (Math.random() < banterConfig.reactionFrequency) {
    turns.push({
      speaker: 'HOST_B',
      rawText: randomChoice(['아아 그래서!', '오 그렇구나!', '아 연결되네요!']),
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(150, 280)
    })
  }
}

/** 패턴 4: 빠른 대화형 교차 */
function generatePattern4(
  turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[],
  sectionId: string,
  keypoint: string,
  example: string,
  isFirst: boolean,
  banterConfig: typeof BANTER_CONFIGS[2]
): void {
  // A: 짧은 도입
  turns.push({
    speaker: 'HOST_A',
    rawText: '자 이 부분 중요해요.',
    sectionId,
    intent: 'explain_point',
    emphasisWords: [],
    pace: 'normal',
    pauseMsBefore: isFirst ? randomRange(100, 200) : randomRange(200, 350),
    pauseMsAfter: randomRange(150, 250)
  })

  // B: 집중
  turns.push({
    speaker: 'HOST_B',
    rawText: '네!',
    sectionId,
    intent: 'react',
    emphasisWords: [],
    pace: 'fast',
    pauseMsBefore: randomRange(50, 100),
    pauseMsAfter: randomRange(80, 150)
  })

  // A: 핵심
  turns.push({
    speaker: 'HOST_A',
    rawText: keypoint + '.',
    sectionId,
    intent: 'explain_point',
    emphasisWords: extractEmphasisWords(keypoint),
    pace: 'normal',
    pauseMsBefore: randomRange(50, 120),
    pauseMsAfter: randomRange(200, 350)
  })

  // B: 되묻기
  turns.push({
    speaker: 'HOST_B',
    rawText: `${keypoint.slice(0, 8)}요?`,
    sectionId,
    intent: 'ask_question',
    emphasisWords: [],
    pace: 'fast',
    pauseMsBefore: randomRange(80, 150),
    pauseMsAfter: randomRange(200, 350)
  })

  // A: 확인 + 예시
  const confirmText = example
    ? `네, 맞아요. ${example} 같은 경우예요.`
    : `네, 그래요. 이게 포인트예요.`
  turns.push({
    speaker: 'HOST_A',
    rawText: confirmText,
    sectionId,
    intent: 'clarify',
    emphasisWords: [],
    pace: 'normal',
    pauseMsBefore: randomRange(80, 150),
    pauseMsAfter: randomRange(200, 350)
  })
}

/** 예시 시퀀스 */
function generateExampleSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionId, examples, keypoints } = context

  for (const example of examples) {
    // Host A: 예시 설명
    const exampleText = `실제 사례를 보면요, ${example} 같은 경우가 있어요.`
    turns.push({
      speaker: 'HOST_A',
      rawText: exampleText,
      sectionId,
      intent: 'give_example',
      emphasisWords: extractEmphasisWords(exampleText),
      pace: 'normal',
      pauseMsBefore: randomRange(200, 300),
      pauseMsAfter: randomRange(150, 250)
    })

    // Host B: 리액션
    const reactionText = '오 그렇구나, 그럼 실제로 많이 쓰이나요?'
    turns.push({
      speaker: 'HOST_B',
      rawText: reactionText,
      sectionId,
      intent: 'ask_question',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(150, 250),
      pauseMsAfter: randomRange(300, 450)
    })
  }

  return turns
}

/** 주의점/반론 시퀀스 */
function generateCounterSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionId, keypoints } = context

  // Host A: 주의점 제시
  const cautionText = `근데 여기서 주의할 점이 있어요. ${keypoints[0] || '조심해야 할 부분'}이에요.`
  turns.push({
    speaker: 'HOST_A',
    rawText: cautionText,
    sectionId,
    intent: 'counter',
    emphasisWords: ['주의'],
    pace: 'normal',
    pauseMsBefore: randomRange(250, 400),
    pauseMsAfter: randomRange(200, 300)
  })

  // Host B: 확인
  const confirmText = '아, 그 부분 중요하네요. 놓치기 쉬운 포인트예요.'
  turns.push({
    speaker: 'HOST_B',
    rawText: confirmText,
    sectionId,
    intent: 'react',
    emphasisWords: ['중요'],
    pace: 'normal',
    pauseMsBefore: randomRange(150, 250),
    pauseMsAfter: randomRange(150, 250)
  })

  return turns
}

/** 요약 시퀀스 */
function generateRecapSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionId, keypoints } = context

  // Host A: 핵심 정리
  const recapText = `자, 지금까지 내용 정리해볼게요. ${keypoints.slice(0, 2).join(', ')} 이렇게 봤는데요.`
  turns.push({
    speaker: 'HOST_A',
    rawText: recapText,
    sectionId,
    intent: 'summarize',
    emphasisWords: extractEmphasisWords(recapText),
    pace: 'normal',
    pauseMsBefore: randomRange(300, 450),
    pauseMsAfter: randomRange(200, 300)
  })

  // Host B: 확인 + 전환
  const transitionText = '깔끔하네요! 그럼 다음으로 넘어가볼까요?'
  turns.push({
    speaker: 'HOST_B',
    rawText: transitionText,
    sectionId,
    intent: 'transition',
    emphasisWords: [],
    pace: 'fast',
    pauseMsBefore: randomRange(150, 250),
    pauseMsAfter: randomRange(250, 400)
  })

  return turns
}

/** 클로징 시퀀스 - 여운 있게 */
function generateClosingSequence(
  context: TurnGeneratorContext
): Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] {
  const turns: Omit<ScriptTurn, 'id' | 'index' | 'normalizedText' | 'ssml'>[] = []
  const { sectionId, keypoints } = context
  const topic = keypoints[0] || '오늘 주제'

  // 클로징 스타일 랜덤
  const closingStyle = Math.random()

  if (closingStyle < 0.33) {
    // 스타일 1: 요약형
    turns.push({
      speaker: 'HOST_A',
      rawText: `자, 오늘 ${topic} 알아봤는데요.`,
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(400, 600),
      pauseMsAfter: randomRange(150, 250)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: '저 이거 진짜 유익했어요!',
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(100, 180),
      pauseMsAfter: randomRange(150, 250)
    })
    turns.push({
      speaker: 'HOST_A',
      rawText: '도움이 되셨으면 좋겠어요. 다음에 또 재밌는 거 가져올게요!',
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'slow',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(200, 350)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: '네, 다음에 또 만나요!',
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'slow',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: 0
    })
  } else if (closingStyle < 0.66) {
    // 스타일 2: 피드백 요청형
    turns.push({
      speaker: 'HOST_A',
      rawText: `오늘 ${topic} 어떠셨어요?`,
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(400, 600),
      pauseMsAfter: randomRange(300, 450)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: '저는 진짜 재밌었어요! 여러분도 그랬으면 좋겠네요.',
      sectionId,
      intent: 'react',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(100, 180),
      pauseMsAfter: randomRange(150, 250)
    })
    turns.push({
      speaker: 'HOST_A',
      rawText: '궁금한 거 있으면 댓글로 남겨주세요!',
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(200, 350)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: '그럼 다음에 봐요, 안녕!',
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'slow',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: 0
    })
  } else {
    // 스타일 3: 간결형
    turns.push({
      speaker: 'HOST_A',
      rawText: `오늘 ${topic} 핵심만 짚어봤어요.`,
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(400, 600),
      pauseMsAfter: randomRange(150, 250)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: '다음엔 뭐 할 거예요?',
      sectionId,
      intent: 'ask_question',
      emphasisWords: [],
      pace: 'fast',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: randomRange(250, 400)
    })
    turns.push({
      speaker: 'HOST_A',
      rawText: '음, 비밀! 기대해주세요.',
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(100, 180),
      pauseMsAfter: randomRange(150, 250)
    })
    turns.push({
      speaker: 'HOST_B',
      rawText: '에이, 알려주세요! 아 그럼 다음에 또 만나요!',
      sectionId,
      intent: 'closing',
      emphasisWords: [],
      pace: 'normal',
      pauseMsBefore: randomRange(80, 150),
      pauseMsAfter: 0
    })
  }

  return turns
}

// ============================================================================
// Script Safety Check
// ============================================================================

function checkScriptSafety(turns: ScriptTurn[]): ScriptSafety {
  const safety: ScriptSafety = {
    sensitiveTopicsDetected: [],
    forbiddenSlangDetected: [],
    redactions: [],
    warnings: []
  }

  for (const turn of turns) {
    // 금지 슬랭 체크
    const slangFound = detectForbiddenSlang(turn.rawText)
    if (slangFound.length > 0) {
      safety.forbiddenSlangDetected.push(...slangFound)
      safety.warnings.push(`Turn ${turn.index}: 금지 슬랭 감지 - ${slangFound.join(', ')}`)
    }

    // 민감 주제 체크 (간단한 키워드 기반)
    const sensitiveKeywords = ['정치', '종교', '성별', '인종', '혐오', '차별']
    for (const keyword of sensitiveKeywords) {
      if (turn.rawText.includes(keyword)) {
        safety.sensitiveTopicsDetected.push(keyword)
        safety.warnings.push(`Turn ${turn.index}: 민감 주제 감지 - ${keyword}`)
      }
    }
  }

  // 중복 제거
  safety.forbiddenSlangDetected = [...new Set(safety.forbiddenSlangDetected)]
  safety.sensitiveTopicsDetected = [...new Set(safety.sensitiveTopicsDetected)]

  return safety
}

// ============================================================================
// Segment Builder
// ============================================================================

function buildSegments(
  turns: ScriptTurn[],
  outline: ContentOutline
): ScriptSegment[] {
  const segments: ScriptSegment[] = []

  for (const section of outline.sections) {
    const sectionTurns = turns.filter(t => t.sectionId === section.id)
    if (sectionTurns.length === 0) continue

    const startIndex = sectionTurns[0].index
    const endIndex = sectionTurns[sectionTurns.length - 1].index

    // 예상 duration 계산
    const totalDuration = sectionTurns.reduce((sum, turn) => {
      return sum + estimateTurnDuration(turn.rawText, turn.pace)
    }, 0)

    segments.push({
      id: `seg_${section.id}`,
      title: section.title,
      type: section.type,
      startTurnIndex: startIndex,
      endTurnIndex: endIndex,
      targetDurationSec: section.estimatedDurationSec,
      actualDurationSec: totalDuration
    })
  }

  return segments
}

// ============================================================================
// Scriptwriter Implementation
// ============================================================================

export class Scriptwriter implements IScriptwriter {
  private seed: number

  constructor(seed?: number) {
    this.seed = seed ?? Date.now()
  }

  /**
   * 대본 초안 생성
   * ContentOutline → ScriptDraft
   */
  async generateDraft(
    outline: ContentOutline,
    config: PipelineConfig,
    metadata?: PipelineInput['metadata']
  ): Promise<ScriptDraft> {
    const styleConfig = STYLE_CONFIGS[config.preset]
    const banterConfig = BANTER_CONFIGS[config.banterLevel]

    const allTurns: ScriptTurn[] = []
    let turnIndex = 0

    // 각 섹션별로 턴 생성
    for (const section of outline.sections) {
      const context: TurnGeneratorContext = {
        sectionId: section.id,
        sectionType: section.type,
        keypoints: section.keypoints,
        examples: section.examples || [],
        currentIndex: turnIndex,
        totalTurns: 0,  // 추후 계산
        styleConfig,
        banterConfig
      }

      const sectionTurns = generateTurnSequence(context)

      // 턴에 ID와 인덱스 추가
      for (const turn of sectionTurns) {
        allTurns.push({
          ...turn,
          id: uuidv4(),
          index: turnIndex++
        } as ScriptTurn)
      }
    }

    // 문장 길이 검증 및 조정
    for (const turn of allTurns) {
      const sentences = splitIntoSentences(turn.rawText, styleConfig.sentenceLength)
      if (sentences.length > 1) {
        // 문장이 분할된 경우 재구성
        turn.rawText = sentences.join(' ')
      }
    }

    // 안전성 검사
    const safety = checkScriptSafety(allTurns)

    // 세그먼트 빌드
    const segments = buildSegments(allTurns, outline)

    // 전체 예상 시간 계산
    const totalDuration = allTurns.reduce((sum, turn) => {
      return sum + estimateTurnDuration(turn.rawText, turn.pace) +
        (turn.pauseMsBefore / 1000) + (turn.pauseMsAfter / 1000)
    }, 0)

    const draft: ScriptDraft = {
      id: uuidv4(),
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      preset: config.preset,
      banterLevel: config.banterLevel,
      targetDurationSec: config.targetDurationSec,
      turns: allTurns,
      segments,
      safety,
      outline: outline.keyFacts
    }

    return draft
  }

  /**
   * 턴 재생성 (QA 실패 시)
   */
  async regenerateTurn(
    turn: ScriptTurn,
    reason: string,
    context: { prevTurn?: ScriptTurn; nextTurn?: ScriptTurn }
  ): Promise<ScriptTurn> {
    // 원본 유지하면서 재생성 시도
    const newTurn: ScriptTurn = {
      ...turn,
      retryCount: (turn.retryCount || 0) + 1
    }

    // reason에 따라 다른 재생성 전략
    if (reason.includes('too_long')) {
      // 문장 길이 문제: 분할
      const sentences = splitIntoSentences(turn.rawText, { min: 15, max: 25 })
      newTurn.rawText = sentences.slice(0, 2).join(' ')  // 앞 2문장만
    } else if (reason.includes('forbidden_slang')) {
      // 슬랭 문제: 순화
      newTurn.rawText = this.sanitizeSlang(turn.rawText)
    } else if (reason.includes('repetitive')) {
      // 반복 문제: 변형
      newTurn.rawText = this.paraphrase(turn.rawText)
    }

    return newTurn
  }

  /** 슬랭 순화 */
  private sanitizeSlang(text: string): string {
    const slangMap: Record<string, string> = {
      '레전드': '정말 대단한',
      '찢었다': '정말 잘했다',
      '킹받네': '화가 나네요',
      '미친 텐션': '엄청난 열정',
      '역대급': '정말 대단한',
      '개쩐다': '정말 좋다',
      '대박': '와'
    }

    let result = text
    for (const [slang, replacement] of Object.entries(slangMap)) {
      result = result.replace(new RegExp(slang, 'g'), replacement)
    }
    return result
  }

  /** 텍스트 변형 (반복 방지) */
  private paraphrase(text: string): string {
    // 간단한 변형 규칙
    const paraphraseMap: Record<string, string[]> = {
      '정말': ['진짜', '완전'],
      '좋아요': ['괜찮네요', '맘에 드네요'],
      '그래서': ['그러니까', '따라서'],
      '네': ['맞아요', '그렇죠']
    }

    let result = text
    for (const [word, alternatives] of Object.entries(paraphraseMap)) {
      if (result.includes(word)) {
        result = result.replace(word, randomChoice(alternatives))
        break  // 한 번만 변형
      }
    }
    return result
  }
}

// ============================================================================
// Export
// ============================================================================

export default Scriptwriter
