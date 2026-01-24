/**
 * QA Analyzer + Regeneration Loop
 * 품질 분석 및 자동 재생성 모듈
 *
 * 핵심 기능:
 * 1. 발음 QA: OOV 토큰, 외래어 비율, 숫자 오류
 * 2. 리듬 QA: 휴지 분산, 균일 휴지 감지, 긴 문장
 * 3. 반복 QA: 반복 문구, 반복 감탄사, 연속 동일 구조
 * 4. 유머 QA: 감탄사 반복, 강한 리액션, 금지 슬랭
 * 5. 아티팩트 QA: 클리핑, 치찰음, 볼륨 점프, 무음 구간
 * 6. 자연스러움 QA: 종합 점수
 * 7. 재생성 전략: 실패 원인에 따른 최적 재생성 방법 선택
 */

import type {
  IQAAnalyzer,
  EnrichedScript,
  FinalAudioResult,
  TTSSynthesisResult,
  QAReport,
  QAMetric,
  PronunciationQA,
  RhythmQA,
  RepetitionQA,
  HumorQA,
  ArtifactQA,
  QAThresholds,
  ScriptTurn
} from '../core/types'
import { detectForbiddenSlang } from './interjection-library'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_THRESHOLDS: QAThresholds = {
  pronunciation: { minScore: 80, oovThreshold: 5 },
  rhythm: { minScore: 75, pauseVarianceThreshold: 0.3 },
  repetition: { minScore: 80, maxRepeatedPhrases: 3 },
  humor: { minScore: 85, maxStrongReactions: 2 },
  artifacts: { minScore: 85, clippingThreshold: 0.01 },
  naturalness: { minScore: 75 },
  overall: { minScore: 78 }
}

/** 외래어/영어 패턴 */
const FOREIGN_WORD_PATTERN = /[a-zA-Z]{2,}/g

/** OOV 후보 패턴 (발음하기 어려운 조합) */
const OOV_PATTERNS = [
  /[ㄱ-ㅎㅏ-ㅣ]{3,}/,  // 자음/모음만 연속
  /\d{5,}/,            // 5자리 이상 숫자
  /[a-zA-Z]{10,}/,     // 10자 이상 영어
  /[^\w\s가-힣]{2,}/   // 특수문자 연속
]

/** 반복 문구 감지를 위한 최소 길이 */
const MIN_PHRASE_LENGTH = 4

/** 긴 문장 기준 (자) */
const LONG_SENTENCE_THRESHOLD = 40

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * 발음 QA 분석
 */
function analyzePronunciation(
  script: EnrichedScript,
  synthesisResults: TTSSynthesisResult[]
): PronunciationQA {
  const oovTokens: string[] = []
  let foreignWordCount = 0
  let totalWordCount = 0
  const numberErrors: string[] = []
  const lexiconMisses: string[] = []

  for (const turn of script.turns) {
    const text = turn.normalizedText || turn.rawText

    // OOV 패턴 감지
    for (const pattern of OOV_PATTERNS) {
      const matches = text.match(pattern)
      if (matches) {
        oovTokens.push(...matches)
      }
    }

    // 외래어 감지
    const foreignMatches = text.match(FOREIGN_WORD_PATTERN)
    if (foreignMatches) {
      foreignWordCount += foreignMatches.length
    }

    // 단어 수 계산
    totalWordCount += text.split(/\s+/).length

    // 숫자 오류 감지 (정규화 안 된 숫자)
    const numberMatches = text.match(/\d+[,.]\d+|\d{4,}/g)
    if (numberMatches) {
      // 정규화되지 않은 큰 숫자
      for (const num of numberMatches) {
        if (!turn.normalizationLog?.some(log => log.original === num)) {
          numberErrors.push(num)
        }
      }
    }

    // 렉시콘 미스 (synthesis 결과에서)
    const synthResult = synthesisResults.find(r => r.turnId === turn.id)
    if (synthResult?.synthesisLog.lexiconHits) {
      // 실제로는 렉시콘에서 찾지 못한 단어를 추적해야 함
    }
  }

  const foreignWordRatio = totalWordCount > 0
    ? foreignWordCount / totalWordCount
    : 0

  // 점수 계산
  let score = 100
  score -= oovTokens.length * 5  // OOV당 -5
  score -= numberErrors.length * 3  // 숫자 오류당 -3
  score -= foreignWordRatio > 0.2 ? 15 : foreignWordRatio * 50  // 외래어 비율 페널티
  score = Math.max(0, score)

  return {
    oovTokens: [...new Set(oovTokens)],
    foreignWordRatio,
    numberErrors: [...new Set(numberErrors)],
    lexiconMisses: [...new Set(lexiconMisses)],
    score
  }
}

/**
 * 리듬 QA 분석
 */
function analyzeRhythm(script: EnrichedScript): RhythmQA {
  const pauses: number[] = []
  const turnLengths: number[] = []
  const longSentences: Array<{ turnIndex: number; length: number }> = []

  for (const turn of script.turns) {
    pauses.push(turn.pauseMsBefore, turn.pauseMsAfter)

    const textLength = (turn.normalizedText || turn.rawText).replace(/\s/g, '').length
    turnLengths.push(textLength)

    if (textLength > LONG_SENTENCE_THRESHOLD) {
      longSentences.push({
        turnIndex: turn.index,
        length: textLength
      })
    }
  }

  // 휴지 분산 계산
  const pauseMean = pauses.reduce((a, b) => a + b, 0) / pauses.length
  const pauseVariance = pauses.reduce((sum, p) => sum + Math.pow(p - pauseMean, 2), 0) / pauses.length
  const normalizedPauseVariance = Math.sqrt(pauseVariance) / pauseMean

  // 균일 휴지 감지 (분산이 너무 낮으면 로봇처럼 들림)
  const uniformPauseDetected = normalizedPauseVariance < 0.1

  // 턴 길이 분산 계산
  const turnMean = turnLengths.reduce((a, b) => a + b, 0) / turnLengths.length
  const turnVariance = turnLengths.reduce((sum, t) => sum + Math.pow(t - turnMean, 2), 0) / turnLengths.length
  const turnLengthVariance = Math.sqrt(turnVariance) / turnMean

  // 점수 계산
  let score = 100
  score -= longSentences.length * 5  // 긴 문장당 -5
  if (uniformPauseDetected) score -= 20  // 균일 휴지 -20
  if (turnLengthVariance < 0.2) score -= 10  // 턴 길이 균일 -10
  score = Math.max(0, score)

  return {
    pauseVariance: normalizedPauseVariance,
    uniformPauseDetected,
    longSentences,
    turnLengthVariance,
    score
  }
}

/**
 * 반복 QA 분석
 */
function analyzeRepetition(script: EnrichedScript): RepetitionQA {
  const phraseCount: Record<string, number> = {}
  const interjectionCount: Record<string, number> = {}
  let consecutiveSameStructure = 0

  // 문구 반복 감지
  for (const turn of script.turns) {
    const text = turn.normalizedText || turn.rawText
    const words = text.split(/\s+/)

    // N-gram 추출 (3-5 단어)
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const phrase = words.slice(i, i + n).join(' ')
        if (phrase.length >= MIN_PHRASE_LENGTH) {
          phraseCount[phrase] = (phraseCount[phrase] || 0) + 1
        }
      }
    }

    // 감탄사 반복 카운트
    if (turn.interjection) {
      const text = turn.interjection.text
      interjectionCount[text] = (interjectionCount[text] || 0) + 1
    }
  }

  // 연속 동일 구조 감지
  let prevIntent: string | null = null
  let currentStreak = 1
  for (const turn of script.turns) {
    const intent = turn.intent
    if (intent === prevIntent) {
      currentStreak++
      if (currentStreak > consecutiveSameStructure) {
        consecutiveSameStructure = currentStreak
      }
    } else {
      currentStreak = 1
    }
    prevIntent = intent
  }

  // 반복된 문구 필터링 (2회 이상)
  const repeatedPhrases = Object.entries(phraseCount)
    .filter(([_, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // 반복된 감탄사 필터링 (2회 초과)
  const repeatedInterjections = Object.entries(interjectionCount)
    .filter(([_, count]) => count > 2)
    .map(([text, count]) => ({ text, count }))

  // 점수 계산
  let score = 100
  score -= repeatedPhrases.length * 3  // 반복 문구당 -3
  score -= repeatedInterjections.length * 5  // 감탄사 과다 사용 -5
  score -= Math.max(0, consecutiveSameStructure - 2) * 5  // 연속 구조 -5
  score = Math.max(0, score)

  return {
    repeatedPhrases,
    repeatedInterjections,
    consecutiveSameStructure,
    score
  }
}

/**
 * 유머 QA 분석
 */
function analyzeHumor(script: EnrichedScript): HumorQA {
  const interjectionRepeats: Array<{ text: string; count: number; maxAllowed: number }> = []
  const forbiddenSlangDetected: string[] = []
  let openingHumorCount = 0

  // 감탄사 사용 분석
  for (const [text, count] of Object.entries(script.interjectionUsage)) {
    // 맞아요는 3회, 나머지는 2회 제한
    const maxAllowed = text === '맞아요' ? 3 : 2
    if (count > maxAllowed) {
      interjectionRepeats.push({ text, count, maxAllowed })
    }
  }

  // 금지 슬랭 감지
  for (const turn of script.turns) {
    const slang = detectForbiddenSlang(turn.rawText)
    if (slang.length > 0) {
      forbiddenSlangDetected.push(...slang)
    }
  }

  // 오프닝 유머 카운트 (첫 90초)
  let elapsedSec = 0
  for (const turn of script.turns) {
    const charCount = (turn.normalizedText || turn.rawText).replace(/\s/g, '').length
    const turnDuration = charCount / 5 + (turn.pauseMsBefore + turn.pauseMsAfter) / 1000

    if (elapsedSec < 90) {
      if (turn.humorTag || turn.isStrongReaction) {
        openingHumorCount++
      }
    }

    elapsedSec += turnDuration
    if (elapsedSec >= 90) break
  }

  // 점수 계산
  let score = 100
  score -= interjectionRepeats.length * 10  // 감탄사 과다 사용 -10
  score -= script.strongReactionCount > 2 ? 20 : 0  // 강한 리액션 과다 -20
  score -= openingHumorCount > 1 ? 15 : 0  // 오프닝 유머 과다 -15
  score -= forbiddenSlangDetected.length * 10  // 금지 슬랭 -10
  score = Math.max(0, score)

  return {
    interjectionRepeats,
    strongReactionCount: script.strongReactionCount,
    openingHumorCount,
    forbiddenSlangDetected: [...new Set(forbiddenSlangDetected)],
    score
  }
}

/**
 * 아티팩트 QA 분석 (오디오 기반)
 */
function analyzeArtifacts(
  audioResult: FinalAudioResult,
  synthesisResults: TTSSynthesisResult[]
): ArtifactQA {
  // 실제로는 오디오 버퍼 분석이 필요
  // 여기서는 간단한 휴리스틱 사용

  let clippingDetected = false
  let sibilanceIssues = 0
  let volumeJumps = 0
  const silenceGaps: Array<{ startMs: number; durationMs: number }> = []

  // 라우드니스 체크
  if (audioResult.loudnessLUFS < -20 || audioResult.loudnessLUFS > -14) {
    volumeJumps++
  }

  // 합성 결과에서 경고 수집
  for (const result of synthesisResults) {
    if (result.synthesisLog.warnings.length > 0) {
      for (const warning of result.synthesisLog.warnings) {
        if (warning.includes('clipping')) clippingDetected = true
        if (warning.includes('sibilance')) sibilanceIssues++
      }
    }
  }

  // 점수 계산
  let score = 100
  if (clippingDetected) score -= 30
  score -= sibilanceIssues * 5
  score -= volumeJumps * 10
  score -= silenceGaps.length * 5
  score = Math.max(0, score)

  return {
    clippingDetected,
    sibilanceIssues,
    volumeJumps,
    silenceGaps,
    score
  }
}

/**
 * 자연스러움 종합 점수 계산
 */
function calculateNaturalnessScore(
  pronunciationQA: PronunciationQA,
  rhythmQA: RhythmQA,
  repetitionQA: RepetitionQA,
  humorQA: HumorQA,
  artifactQA: ArtifactQA
): number {
  // 가중 평균
  const weights = {
    pronunciation: 0.25,
    rhythm: 0.25,
    repetition: 0.2,
    humor: 0.15,
    artifacts: 0.15
  }

  const score =
    pronunciationQA.score * weights.pronunciation +
    rhythmQA.score * weights.rhythm +
    repetitionQA.score * weights.repetition +
    humorQA.score * weights.humor +
    artifactQA.score * weights.artifacts

  return Math.round(score)
}

/**
 * QAMetric 생성 헬퍼
 */
function createMetric(
  name: string,
  score: number,
  threshold: number,
  details: string,
  suggestions?: string[]
): QAMetric {
  return {
    name,
    score,
    passed: score >= threshold,
    threshold,
    details,
    suggestions
  }
}

// ============================================================================
// QA Analyzer Implementation
// ============================================================================

export class QAAnalyzer implements IQAAnalyzer {
  private thresholds: QAThresholds

  constructor(thresholds?: Partial<QAThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds }
  }

  /**
   * 전체 QA 분석 수행
   */
  async analyze(
    script: EnrichedScript,
    audioResult: FinalAudioResult,
    synthesisResults: TTSSynthesisResult[]
  ): Promise<QAReport> {
    // 각 카테고리 분석
    const pronunciationQA = analyzePronunciation(script, synthesisResults)
    const rhythmQA = analyzeRhythm(script)
    const repetitionQA = analyzeRepetition(script)
    const humorQA = analyzeHumor(script)
    const artifactQA = analyzeArtifacts(audioResult, synthesisResults)

    // 자연스러움 점수
    const naturalnessScore = calculateNaturalnessScore(
      pronunciationQA,
      rhythmQA,
      repetitionQA,
      humorQA,
      artifactQA
    )

    // 전체 점수
    const overallScore = Math.round(
      (pronunciationQA.score + rhythmQA.score + repetitionQA.score +
        humorQA.score + artifactQA.score + naturalnessScore) / 6
    )

    // 이슈 수집
    const issues: QAReport['issues'] = []

    // 발음 이슈
    if (pronunciationQA.oovTokens.length > 0) {
      issues.push({
        severity: 'warning',
        stage: 'normalization',
        description: `OOV 토큰 감지: ${pronunciationQA.oovTokens.join(', ')}`,
        suggestion: '렉시콘에 해당 단어 추가 필요'
      })
    }
    if (pronunciationQA.numberErrors.length > 0) {
      issues.push({
        severity: 'warning',
        stage: 'normalization',
        description: `정규화되지 않은 숫자: ${pronunciationQA.numberErrors.join(', ')}`,
        suggestion: '숫자 정규화 규칙 확인'
      })
    }

    // 리듬 이슈
    if (rhythmQA.uniformPauseDetected) {
      issues.push({
        severity: 'warning',
        stage: 'script',
        description: '휴지가 너무 균일함 (로봇처럼 들릴 수 있음)',
        suggestion: '휴지 분산 증가 필요'
      })
    }
    for (const longSentence of rhythmQA.longSentences) {
      issues.push({
        severity: 'info',
        stage: 'script',
        description: `긴 문장 (턴 ${longSentence.turnIndex}): ${longSentence.length}자`,
        turnId: script.turns[longSentence.turnIndex]?.id,
        suggestion: '문장 분할 권장'
      })
    }

    // 반복 이슈
    if (repetitionQA.repeatedPhrases.length > 3) {
      issues.push({
        severity: 'warning',
        stage: 'script',
        description: `반복 문구 과다: ${repetitionQA.repeatedPhrases.slice(0, 3).map(p => p.phrase).join(', ')}`,
        suggestion: '다양한 표현 사용 필요'
      })
    }
    if (repetitionQA.consecutiveSameStructure > 3) {
      issues.push({
        severity: 'warning',
        stage: 'script',
        description: `연속 동일 구조: ${repetitionQA.consecutiveSameStructure}회`,
        suggestion: '턴 구조 다양화 필요'
      })
    }

    // 유머 이슈
    for (const repeat of humorQA.interjectionRepeats) {
      issues.push({
        severity: 'warning',
        stage: 'script',
        description: `감탄사 과다 사용: "${repeat.text}" (${repeat.count}회, 최대 ${repeat.maxAllowed}회)`,
        suggestion: '다른 감탄사로 대체'
      })
    }
    if (humorQA.forbiddenSlangDetected.length > 0) {
      issues.push({
        severity: 'critical',
        stage: 'script',
        description: `금지 슬랭 감지: ${humorQA.forbiddenSlangDetected.join(', ')}`,
        suggestion: '해당 표현 제거 또는 순화'
      })
    }
    if (humorQA.strongReactionCount > 2) {
      issues.push({
        severity: 'warning',
        stage: 'script',
        description: `강한 리액션 과다: ${humorQA.strongReactionCount}회 (최대 2회)`,
        suggestion: '강한 리액션 수 줄이기'
      })
    }

    // 아티팩트 이슈
    if (artifactQA.clippingDetected) {
      issues.push({
        severity: 'critical',
        stage: 'postprocess',
        description: '오디오 클리핑 감지',
        suggestion: '볼륨 레벨 조정 필요'
      })
    }
    if (artifactQA.sibilanceIssues > 0) {
      issues.push({
        severity: 'warning',
        stage: 'synthesis',
        description: `치찰음 이슈: ${artifactQA.sibilanceIssues}건`,
        suggestion: '디에서 설정 조정'
      })
    }

    // 메트릭 생성
    const metrics = {
      pronunciation: createMetric(
        'pronunciation',
        pronunciationQA.score,
        this.thresholds.pronunciation.minScore,
        `OOV: ${pronunciationQA.oovTokens.length}, 외래어 비율: ${(pronunciationQA.foreignWordRatio * 100).toFixed(1)}%`
      ),
      rhythm: createMetric(
        'rhythm',
        rhythmQA.score,
        this.thresholds.rhythm.minScore,
        `휴지 분산: ${rhythmQA.pauseVariance.toFixed(2)}, 긴 문장: ${rhythmQA.longSentences.length}개`
      ),
      repetition: createMetric(
        'repetition',
        repetitionQA.score,
        this.thresholds.repetition.minScore,
        `반복 문구: ${repetitionQA.repeatedPhrases.length}개, 연속 구조: ${repetitionQA.consecutiveSameStructure}`
      ),
      humor: createMetric(
        'humor',
        humorQA.score,
        this.thresholds.humor.minScore,
        `강한 리액션: ${humorQA.strongReactionCount}, 오프닝 유머: ${humorQA.openingHumorCount}`
      ),
      artifacts: createMetric(
        'artifacts',
        artifactQA.score,
        this.thresholds.artifacts.minScore,
        `클리핑: ${artifactQA.clippingDetected ? '있음' : '없음'}, 치찰음: ${artifactQA.sibilanceIssues}`
      ),
      naturalness: createMetric(
        'naturalness',
        naturalnessScore,
        this.thresholds.naturalness.minScore,
        '종합 자연스러움 점수'
      )
    }

    // 통과 여부
    const passed = overallScore >= this.thresholds.overall.minScore &&
      issues.filter(i => i.severity === 'critical').length === 0

    // 재생성 필요 여부 및 전략
    const regenerationRequired = !passed
    const regenerationStrategy = regenerationRequired
      ? this.getRegenerationStrategy({
          id: '',
          timestamp: '',
          overallScore,
          passed,
          metrics,
          details: { pronunciation: pronunciationQA, rhythm: rhythmQA, repetition: repetitionQA, humor: humorQA, artifacts: artifactQA },
          issues,
          regenerationRequired,
        })
      : undefined

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      overallScore,
      passed,
      metrics,
      details: {
        pronunciation: pronunciationQA,
        rhythm: rhythmQA,
        repetition: repetitionQA,
        humor: humorQA,
        artifacts: artifactQA
      },
      issues,
      regenerationRequired,
      regenerationStrategy
    }
  }

  /**
   * 재생성 필요 여부 판단
   */
  shouldRegenerate(report: QAReport): boolean {
    // Critical 이슈가 있으면 재생성
    if (report.issues.some(i => i.severity === 'critical')) {
      return true
    }

    // 전체 점수가 임계값 미달이면 재생성
    if (report.overallScore < this.thresholds.overall.minScore) {
      return true
    }

    return false
  }

  /**
   * 재생성 전략 결정
   */
  getRegenerationStrategy(report: QAReport): QAReport['regenerationStrategy'] {
    const criticalIssues = report.issues.filter(i => i.severity === 'critical')

    // 클리핑: 오디오 재처리
    if (criticalIssues.some(i => i.description.includes('클리핑'))) {
      return 're_synthesize'
    }

    // 금지 슬랭: 대본 조정
    if (criticalIssues.some(i => i.description.includes('슬랭'))) {
      return 'adjust_script'
    }

    // 발음 점수 낮음: 정규화 재실행
    if (report.metrics.pronunciation.score < 70) {
      return 're_normalize'
    }

    // 리듬/반복/유머 점수 낮음: 대본 재생성
    if (report.metrics.rhythm.score < 60 ||
        report.metrics.repetition.score < 60 ||
        report.metrics.humor.score < 60) {
      return 'regenerate_script'
    }

    // 자연스러움 낮음: 전체 재생성
    if (report.metrics.naturalness.score < 60) {
      return 'full_regeneration'
    }

    // 기본: 대본 조정
    return 'adjust_script'
  }

  /**
   * 특정 턴에 대한 세부 QA
   */
  analyzeTurn(turn: ScriptTurn): {
    issues: string[]
    suggestions: string[]
    score: number
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    const text = turn.normalizedText || turn.rawText

    // 문장 길이 체크
    const length = text.replace(/\s/g, '').length
    if (length > 40) {
      issues.push(`문장이 너무 깁니다 (${length}자)`)
      suggestions.push('15-25자 문장으로 분할하세요')
      score -= 10
    }

    // 금지 슬랭 체크
    const slang = detectForbiddenSlang(text)
    if (slang.length > 0) {
      issues.push(`금지 슬랭: ${slang.join(', ')}`)
      suggestions.push('슬랭을 순화된 표현으로 대체하세요')
      score -= 20
    }

    // OOV 패턴 체크
    for (const pattern of OOV_PATTERNS) {
      if (pattern.test(text)) {
        issues.push('발음하기 어려운 패턴 포함')
        suggestions.push('렉시콘 추가 또는 표현 변경')
        score -= 5
      }
    }

    // 강조 단어 체크
    if (turn.emphasisWords.length > 3) {
      issues.push('강조 단어가 너무 많음')
      suggestions.push('핵심 1-2개만 강조하세요')
      score -= 5
    }

    return {
      issues,
      suggestions,
      score: Math.max(0, score)
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default QAAnalyzer
