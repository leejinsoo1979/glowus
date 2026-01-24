/**
 * Chemistry Engine
 * 유머/감탄사/리액션 엔진 - 대본에 자연스러운 케미스트리 추가
 *
 * 핵심 규칙:
 * 1. 동일 감탄사는 에피소드당 최대 2회 (맞아요만 3회)
 * 2. 연속 턴에서 감탄사 사용 금지 (최소 1턴 간격)
 * 3. 강한 리액션은 에피소드당 0-2회, 오프닝 90초 내 금지
 * 4. 자연스러운 리듬: 과하지 않게, 로봇처럼 균일하지 않게
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  IChemistryEngine,
  ScriptDraft,
  EnrichedScript,
  ScriptTurn,
  ContentOutline,
  PipelineConfig,
  InterjectionEntry,
  InterjectionCategory,
  HumorCue,
  HumorType,
  LaughCue,
  HumorQA,
  StylePreset,
  BanterLevel
} from '../core/types'
import {
  INTERJECTION_LIBRARY,
  STRONG_REACTIONS,
  FORBIDDEN_SLANG,
  selectRandomInterjection,
  detectForbiddenSlang,
  canUseStrongReaction,
  getInterjectionsByCategory
} from './interjection-library'

// ============================================================================
// Types & Constants
// ============================================================================

interface InterjectionUsageState {
  usageCount: Record<string, number>  // 감탄사 ID → 사용 횟수
  lastUsedTurn: Record<string, number>  // 감탄사 ID → 마지막 사용 턴
  strongReactionCount: number
  lastInterjectionTurn: number  // 가장 최근에 감탄사가 사용된 턴
}

interface ChemistryConfig {
  interjectionFrequency: number  // 0-1, 감탄사 추가 확률
  humorFrequency: number         // 0-1, 유머 추가 확률
  laughFrequency: number         // 0-1, 웃음 큐 추가 확률
  strongReactionMax: number      // 에피소드당 최대 강한 리액션 수
  openingNoReactionSec: number   // 오프닝에서 강한 리액션 금지 시간
}

const CHEMISTRY_PRESETS: Record<StylePreset, ChemistryConfig> = {
  NEWS: {
    interjectionFrequency: 0.15,
    humorFrequency: 0.05,
    laughFrequency: 0.05,
    strongReactionMax: 0,
    openingNoReactionSec: 120
  },
  FRIENDLY: {
    interjectionFrequency: 0.3,
    humorFrequency: 0.15,
    laughFrequency: 0.1,
    strongReactionMax: 2,
    openingNoReactionSec: 90
  },
  DEEPDIVE: {
    interjectionFrequency: 0.2,
    humorFrequency: 0.1,
    laughFrequency: 0.08,
    strongReactionMax: 1,
    openingNoReactionSec: 120
  }
}

const BANTER_MULTIPLIERS: Record<BanterLevel, number> = {
  0: 0.3,
  1: 0.6,
  2: 1.0,
  3: 1.5
}

/** 감탄사 추가가 적합한 인텐트 */
const INTERJECTION_SUITABLE_INTENTS = [
  'react',
  'ask_question',
  'summarize',
  'transition'
]

/** 유머 추가가 적합한 인텐트 */
const HUMOR_SUITABLE_INTENTS = [
  'give_example',
  'react',
  'transition'
]

/** 웃음 큐 추가가 적합한 인텐트 */
const LAUGH_SUITABLE_INTENTS = [
  'react',
  'callback_joke'
]

// ============================================================================
// Utility Functions
// ============================================================================

/** 예상 경과 시간 계산 (초) */
function estimateElapsedTime(turns: ScriptTurn[], upToIndex: number): number {
  let elapsed = 0
  for (let i = 0; i <= upToIndex && i < turns.length; i++) {
    const turn = turns[i]
    // 한국어 평균 읽기 속도: 분당 300자
    const charCount = turn.rawText.replace(/\s/g, '').length
    const speakingTime = charCount / 5  // 초당 5자
    elapsed += speakingTime + (turn.pauseMsBefore / 1000) + (turn.pauseMsAfter / 1000)
  }
  return elapsed
}

/** 섹션 타입 추출 */
function getSectionType(
  turn: ScriptTurn,
  outline: ContentOutline
): 'opening' | 'keypoint' | 'example' | 'closing' | undefined {
  const section = outline.sections.find(s => s.id === turn.sectionId)
  if (!section) return undefined

  switch (section.type) {
    case 'opening':
      return 'opening'
    case 'keypoint':
      return 'keypoint'
    case 'example':
    case 'analogy':
      return 'example'
    case 'closing':
    case 'recap':
      return 'closing'
    default:
      return 'keypoint'
  }
}

/** 카테고리 결정 (인텐트 기반) */
function determineInterjectionCategory(intent: ScriptTurn['intent']): InterjectionCategory {
  switch (intent) {
    case 'react':
      return Math.random() > 0.5 ? 'surprise_wow' : 'empathy'
    case 'ask_question':
      return 'thinking'
    case 'summarize':
    case 'transition':
      return 'approval_respect'
    default:
      return 'empathy'
  }
}

/** 유머 타입 결정 */
function determineHumorType(
  turn: ScriptTurn,
  prevTurns: ScriptTurn[]
): HumorType | null {
  // 앞에 유머가 있으면 callback 고려
  const hasRecentHumor = prevTurns.slice(-5).some(t => t.humorTag)
  if (hasRecentHumor && Math.random() < 0.3) {
    return 'callback'
  }

  // Host 다이나믹
  if (turn.speaker === 'HOST_B' && turn.intent === 'react') {
    return 'host_dynamic'
  }

  // 예시 턴에서 상황 유머
  if (turn.intent === 'give_example') {
    return 'situational'
  }

  // 기본: 공감 유머
  if (Math.random() < 0.5) {
    return 'relatable'
  }

  return null
}

/** 웃음 큐 결정 */
function determineLaughType(
  intensity: 'weak' | 'medium' | 'strong'
): LaughCue['type'] {
  switch (intensity) {
    case 'weak':
      return 'light_chuckle'
    case 'medium':
      return 'soft_laugh'
    case 'strong':
      return 'big_laugh'
    default:
      return 'soft_laugh'
  }
}

// ============================================================================
// Chemistry Engine Implementation
// ============================================================================

export class ChemistryEngine implements IChemistryEngine {
  private config: ChemistryConfig
  private multiplier: number

  constructor(preset: StylePreset = 'FRIENDLY', banterLevel: BanterLevel = 2) {
    this.config = CHEMISTRY_PRESETS[preset]
    this.multiplier = BANTER_MULTIPLIERS[banterLevel]
  }

  /**
   * ScriptDraft를 EnrichedScript로 변환
   * - 감탄사 추가
   * - 유머 태그
   * - 웃음 큐
   * - 강한 리액션 (조건부)
   */
  async enrich(
    draft: ScriptDraft,
    outline: ContentOutline,
    config: PipelineConfig
  ): Promise<EnrichedScript> {
    // 설정 업데이트
    this.config = CHEMISTRY_PRESETS[config.preset]
    this.multiplier = BANTER_MULTIPLIERS[config.banterLevel]

    // 상태 초기화
    const state: InterjectionUsageState = {
      usageCount: {},
      lastUsedTurn: {},
      strongReactionCount: 0,
      lastInterjectionTurn: -10  // 충분히 큰 간격으로 시작
    }

    const enrichedTurns: ScriptTurn[] = []
    const humorCues: HumorCue[] = []
    const laughCues: LaughCue[] = []
    const callbackRefs: Array<{ sourceTurnIndex: number; targetTurnIndex: number; joke: string }> = []

    // 각 턴 처리
    for (let i = 0; i < draft.turns.length; i++) {
      const turn = { ...draft.turns[i] }
      const prevTurns = enrichedTurns.slice()
      const elapsedSec = estimateElapsedTime(draft.turns, i)
      const sectionType = getSectionType(turn, outline)

      // 1. 감탄사 추가 고려
      if (this.shouldAddInterjection(turn, state, elapsedSec, sectionType)) {
        const interjection = this.selectInterjection(turn, state, sectionType)
        if (interjection) {
          turn.interjection = {
            text: interjection.text,
            category: interjection.category,
            position: this.determinePosition(turn)
          }
          state.usageCount[interjection.id] = (state.usageCount[interjection.id] || 0) + 1
          state.lastUsedTurn[interjection.id] = i
          state.lastInterjectionTurn = i
        }
      }

      // 2. 강한 리액션 고려 (Host B only)
      if (this.shouldAddStrongReaction(turn, state, elapsedSec, config)) {
        const strongReaction = this.selectStrongReaction(elapsedSec)
        if (strongReaction) {
          turn.isStrongReaction = true
          // 강한 리액션 텍스트를 턴 앞에 추가
          turn.rawText = `${strongReaction.text} ${turn.rawText}`
          state.strongReactionCount++
        }
      }

      // 3. 유머 태그 추가 고려
      if (this.shouldAddHumor(turn, prevTurns)) {
        const humorType = determineHumorType(turn, prevTurns)
        if (humorType) {
          turn.humorTag = humorType

          // HumorCue 생성
          humorCues.push({
            id: uuidv4(),
            type: humorType,
            targetTurnIndex: i,
            callbackRef: humorType === 'callback' ? this.findCallbackRef(prevTurns) : undefined
          })

          // Callback 참조 추적
          if (humorType === 'callback') {
            const sourceTurn = prevTurns.slice(-5).find(t => t.humorTag)
            if (sourceTurn) {
              callbackRefs.push({
                sourceTurnIndex: sourceTurn.index,
                targetTurnIndex: i,
                joke: sourceTurn.rawText.slice(0, 30)
              })
            }
          }
        }
      }

      // 4. 웃음 큐 추가 고려
      if (this.shouldAddLaugh(turn, prevTurns)) {
        const laughType = determineLaughType(
          turn.humorTag ? 'medium' : 'weak'
        )
        laughCues.push({
          id: uuidv4(),
          type: laughType,
          insertAfterTurnIndex: i,
          durationMs: laughType === 'light_chuckle' ? 800 : laughType === 'soft_laugh' ? 1200 : 2000,
          volumeOffsetDb: -8
        })
        turn.laughCueId = laughCues[laughCues.length - 1].id
      }

      enrichedTurns.push(turn)
    }

    // 사용량 통계 생성
    const interjectionUsage: Record<string, number> = {}
    for (const turn of enrichedTurns) {
      if (turn.interjection) {
        const text = turn.interjection.text
        interjectionUsage[text] = (interjectionUsage[text] || 0) + 1
      }
    }

    const enrichedScript: EnrichedScript = {
      ...draft,
      turns: enrichedTurns,
      humorCues,
      laughCues,
      interjectionUsage,
      strongReactionCount: state.strongReactionCount,
      callbackRefs
    }

    return enrichedScript
  }

  /**
   * 감탄사 규칙 검증
   */
  validateInterjections(script: EnrichedScript): HumorQA {
    const qa: HumorQA = {
      interjectionRepeats: [],
      strongReactionCount: script.strongReactionCount,
      openingHumorCount: 0,
      forbiddenSlangDetected: [],
      score: 100
    }

    // 1. 감탄사 반복 체크
    for (const [text, count] of Object.entries(script.interjectionUsage)) {
      const entry = INTERJECTION_LIBRARY.find(e => e.text === text)
      const maxAllowed = entry?.maxUsagePerEpisode || 2
      if (count > maxAllowed) {
        qa.interjectionRepeats.push({
          text,
          count,
          maxAllowed
        })
        qa.score -= 10
      }
    }

    // 2. 강한 리액션 체크
    if (script.strongReactionCount > 2) {
      qa.score -= 20
    }

    // 3. 오프닝 유머 체크
    const openingTurns = script.turns.filter(t => {
      const elapsedSec = estimateElapsedTime(script.turns, t.index)
      return elapsedSec < 90
    })
    qa.openingHumorCount = openingTurns.filter(t => t.humorTag || t.isStrongReaction).length
    if (qa.openingHumorCount > 1) {
      qa.score -= 15
    }

    // 4. 금지 슬랭 체크
    for (const turn of script.turns) {
      const slang = detectForbiddenSlang(turn.rawText)
      if (slang.length > 0) {
        qa.forbiddenSlangDetected.push(...slang)
        qa.score -= 5 * slang.length
      }
    }
    qa.forbiddenSlangDetected = [...new Set(qa.forbiddenSlangDetected)]

    // 5. 연속 턴 감탄사 체크
    for (let i = 1; i < script.turns.length; i++) {
      if (script.turns[i].interjection && script.turns[i - 1].interjection) {
        qa.score -= 10  // 연속 사용 페널티
      }
    }

    qa.score = Math.max(0, qa.score)
    return qa
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /** 감탄사 추가 여부 결정 */
  private shouldAddInterjection(
    turn: ScriptTurn,
    state: InterjectionUsageState,
    elapsedSec: number,
    sectionType?: 'opening' | 'keypoint' | 'example' | 'closing'
  ): boolean {
    // Host B가 주로 감탄사 사용
    if (turn.speaker !== 'HOST_B') {
      return Math.random() < 0.1  // Host A도 가끔 사용
    }

    // 적합한 인텐트인지 체크
    if (!INTERJECTION_SUITABLE_INTENTS.includes(turn.intent)) {
      return false
    }

    // 연속 턴 감탄사 방지 (최소 1턴 간격)
    if (turn.index - state.lastInterjectionTurn < 2) {
      return false
    }

    // 오프닝에서는 자제
    if (sectionType === 'opening' && elapsedSec < 30) {
      return false
    }

    // 클로징에서는 자제
    if (sectionType === 'closing') {
      return Math.random() < 0.1
    }

    // 확률 계산
    const baseProb = this.config.interjectionFrequency * this.multiplier
    return Math.random() < baseProb
  }

  /** 감탄사 선택 */
  private selectInterjection(
    turn: ScriptTurn,
    state: InterjectionUsageState,
    sectionType?: 'opening' | 'keypoint' | 'example' | 'closing'
  ): InterjectionEntry | null {
    const category = determineInterjectionCategory(turn.intent)

    return selectRandomInterjection(
      category,
      turn.speaker as 'HOST_A' | 'HOST_B' | 'GUEST',
      state.usageCount,
      state.lastInterjectionTurn,
      turn.index,
      sectionType
    )
  }

  /** 감탄사 위치 결정 */
  private determinePosition(turn: ScriptTurn): 'start' | 'end' {
    // 질문이나 리액션은 시작에
    if (['react', 'ask_question'].includes(turn.intent)) {
      return 'start'
    }
    // 정리/전환은 끝에
    if (['summarize', 'transition'].includes(turn.intent)) {
      return Math.random() > 0.5 ? 'end' : 'start'
    }
    return 'start'
  }

  /** 강한 리액션 추가 여부 결정 */
  private shouldAddStrongReaction(
    turn: ScriptTurn,
    state: InterjectionUsageState,
    elapsedSec: number,
    config: PipelineConfig
  ): boolean {
    // Host B만 사용
    if (turn.speaker !== 'HOST_B') return false

    // 최대 횟수 체크
    if (state.strongReactionCount >= this.config.strongReactionMax) return false

    // 오프닝 금지 시간 체크
    if (elapsedSec < this.config.openingNoReactionSec) return false

    // react 인텐트만
    if (turn.intent !== 'react') return false

    // 낮은 확률로 추가
    return Math.random() < 0.05 * this.multiplier
  }

  /** 강한 리액션 선택 */
  private selectStrongReaction(elapsedSec: number): typeof STRONG_REACTIONS[0] | null {
    const available = STRONG_REACTIONS.filter(r => elapsedSec >= r.forbiddenBeforeSecond)
    if (available.length === 0) return null
    return available[Math.floor(Math.random() * available.length)]
  }

  /** 유머 추가 여부 결정 */
  private shouldAddHumor(turn: ScriptTurn, prevTurns: ScriptTurn[]): boolean {
    // 적합한 인텐트인지
    if (!HUMOR_SUITABLE_INTENTS.includes(turn.intent)) return false

    // 너무 자주 유머가 나오지 않도록
    const recentHumorCount = prevTurns.slice(-5).filter(t => t.humorTag).length
    if (recentHumorCount >= 2) return false

    // 확률 계산
    const prob = this.config.humorFrequency * this.multiplier
    return Math.random() < prob
  }

  /** 웃음 큐 추가 여부 결정 */
  private shouldAddLaugh(turn: ScriptTurn, prevTurns: ScriptTurn[]): boolean {
    // 유머가 있는 턴 다음에만
    if (!turn.humorTag) return false

    // 적합한 인텐트인지
    if (!LAUGH_SUITABLE_INTENTS.includes(turn.intent)) return false

    // 너무 자주 웃음이 나오지 않도록
    const recentLaughCount = prevTurns.slice(-3).filter(t => t.laughCueId).length
    if (recentLaughCount >= 1) return false

    // 확률 계산
    const prob = this.config.laughFrequency * this.multiplier
    return Math.random() < prob
  }

  /** Callback 참조 찾기 */
  private findCallbackRef(prevTurns: ScriptTurn[]): string | undefined {
    const humorTurn = prevTurns.slice(-10).find(t => t.humorTag)
    return humorTurn?.id
  }
}

// ============================================================================
// Export
// ============================================================================

export default ChemistryEngine
