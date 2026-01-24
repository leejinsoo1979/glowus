/**
 * Podcast Studio Core Types
 * Production-grade Korean podcast generation pipeline
 * Designed to surpass NotebookLM in naturalness, pronunciation, and broadcast quality
 */

// ============================================================================
// Preset & Configuration Types
// ============================================================================

export type StylePreset = 'NEWS' | 'FRIENDLY' | 'DEEPDIVE'
export type BanterLevel = 0 | 1 | 2 | 3  // 0=없음, 1=절제, 2=보통, 3=활발

export interface PresetConfig {
  id: StylePreset
  name: string
  description: string
  defaults: {
    banterLevel: BanterLevel
    speakingRate: number      // 0.8-1.2
    humorFrequencyPer10Min: number    // 0-10
    laughFrequencyPer10Min: number    // 0-8
    strongReactionMax: number         // 0-2 per episode
    turnLengthTarget: { min: number; max: number }  // seconds
    sentenceLengthTarget: { min: number; max: number }  // characters
  }
}

// ============================================================================
// Source & Content Types
// ============================================================================

export interface SourceDocument {
  id: string
  type: 'text' | 'markdown' | 'pdf' | 'url' | 'summary'
  content: string
  title?: string
  metadata?: Record<string, unknown>
}

export interface OutlineSection {
  id: string
  type: 'opening' | 'keypoint' | 'example' | 'analogy' | 'caution' | 'counter' | 'recap' | 'closing'
  title: string
  keypoints: string[]
  examples?: string[]
  estimatedDurationSec: number
  order: number
}

export interface ContentOutline {
  documentId: string
  title: string
  totalEstimatedDurationSec: number
  sections: OutlineSection[]
  keyFacts: string[]
  numbers: Array<{ raw: string; context: string }>
  technicalTerms: string[]
  risks: string[]
}

// ============================================================================
// Interjection & Humor Types
// ============================================================================

export type InterjectionCategory =
  | 'surprise_wow'      // 우와, 와, 오호, 헐
  | 'approval_respect'  // 좋네요, 그건 인정, 납득
  | 'empathy'           // 맞아요, 그쵸, 완전 공감
  | 'thinking'          // 음, 잠깐만요, 정리하면
  | 'laugh_cue'         // (피식), (웃음) - TTS에서 낭독 안 함

export interface InterjectionEntry {
  id: string
  text: string
  category: InterjectionCategory
  intensity: 'weak' | 'medium' | 'strong'
  allowedSpeakers: Array<'HOST_A' | 'HOST_B' | 'GUEST'>
  maxUsagePerEpisode: number
  minTurnGap: number  // 최소 몇 턴 간격
  forbiddenSections?: Array<'opening' | 'keypoint' | 'closing'>
}

export type HumorType =
  | 'self_deprecating'  // 가벼운 자기디스
  | 'situational'       // 상황 유머
  | 'wordplay_lite'     // 약한 말장난 (에피소드당 0-2회)
  | 'relatable'         // 공감 유머
  | 'callback'          // 앞 농담 회수
  | 'host_dynamic'      // A는 진지, B는 받아치기

export interface HumorCue {
  id: string
  type: HumorType
  targetTurnIndex: number
  content?: string
  callbackRef?: string  // callback 유형일 때 참조하는 이전 농담 ID
}

export interface LaughCue {
  id: string
  type: 'light_chuckle' | 'soft_laugh' | 'big_laugh'
  insertAfterTurnIndex: number
  durationMs: number
  volumeOffsetDb: number  // -6 to -10 dB
}

export interface StrongReaction {
  text: string
  requiresFollowUp: boolean  // 반드시 근거/요약 문장이 뒤따라야 함
  allowedSpeakers: Array<'HOST_B'>  // Host B만 사용
  forbiddenBeforeSecond: number  // 오프닝 90초 이내 금지
}

// ============================================================================
// Script Types
// ============================================================================

export type Speaker = 'HOST_A' | 'HOST_B' | 'GUEST'

export type TurnIntent =
  | 'opener_hook'       // 오프닝 훅
  | 'introduce_topic'   // 주제 소개
  | 'explain_point'     // 요점 설명
  | 'ask_question'      // 질문 (되묻기)
  | 'give_example'      // 예시/비유
  | 'react'             // 리액션
  | 'summarize'         // 정리/요약
  | 'transition'        // 다음으로 전환
  | 'clarify'           // 부연 설명
  | 'counter'           // 반론/주의점
  | 'callback_joke'     // 앞 농담 회수
  | 'closing'           // 마무리

export type Pace = 'slow' | 'normal' | 'fast'

export interface ScriptTurn {
  id: string
  index: number
  speaker: Speaker
  rawText: string           // 원본 텍스트
  normalizedText?: string   // 정규화된 텍스트
  ssml?: string             // SSML 마크업
  sectionId: string         // 속한 섹션
  intent: TurnIntent
  emphasisWords: string[]
  pace: Pace
  pauseMsBefore: number     // 이 턴 앞 pause (150-450ms)
  pauseMsAfter: number      // 이 턴 뒤 pause (120-220ms)
  estimatedDurationMs?: number

  // Interjection/Humor metadata
  interjection?: {
    text: string
    category: InterjectionCategory
    position: 'start' | 'end'
  }
  laughCueId?: string
  humorTag?: HumorType
  isStrongReaction?: boolean

  // Debug/QA
  normalizationLog?: Array<{
    original: string
    normalized: string
    rule: string
  }>
  lexiconHits?: string[]
  retryCount?: number
}

export interface ScriptSegment {
  id: string
  title: string
  type: OutlineSection['type']
  startTurnIndex: number
  endTurnIndex: number
  targetDurationSec: number
  actualDurationSec?: number
}

export interface ScriptSafety {
  sensitiveTopicsDetected: string[]
  forbiddenSlangDetected: string[]
  redactions: Array<{
    original: string
    reason: string
  }>
  warnings: string[]
}

export interface ScriptDraft {
  id: string
  version: string
  createdAt: string
  preset: StylePreset
  banterLevel: BanterLevel
  targetDurationSec: number
  turns: ScriptTurn[]
  segments: ScriptSegment[]
  safety: ScriptSafety
  outline: string[]
}

export interface EnrichedScript extends ScriptDraft {
  humorCues: HumorCue[]
  laughCues: LaughCue[]
  interjectionUsage: Record<string, number>  // 감탄사별 사용 횟수
  strongReactionCount: number
  callbackRefs: Array<{ sourceTurnIndex: number; targetTurnIndex: number; joke: string }>
}

// ============================================================================
// Normalization Types
// ============================================================================

export interface NormalizationRule {
  id: string
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
  description: string
  priority: number
  category: 'number' | 'date' | 'time' | 'currency' | 'unit' | 'percent' | 'range' | 'acronym' | 'brand' | 'punctuation' | 'special' | 'english'
  testCases?: Array<{ input: string; expected: string }>
}

export interface NormalizationResult {
  original: string
  normalized: string
  tokenMap: Array<{
    original: string
    normalized: string
    rule: string
    position: { start: number; end: number }
  }>
  warnings: string[]
}

export interface LexiconEntry {
  term: string
  reading: string           // 한국어 발음
  variants?: string[]       // 대소문자/약어 변형
  category: 'brand' | 'acronym' | 'technical' | 'foreign' | 'custom'
  priority?: 'user' | 'project' | 'global'
  ssmlPhoneme?: string
  notes?: string
}

export interface LexiconConfig {
  version: string
  userOverrides: LexiconEntry[]
  projectLexicon: LexiconEntry[]
  globalLexicon: LexiconEntry[]
}

// ============================================================================
// Voice & TTS Types
// ============================================================================

export interface VoiceProfile {
  id: string
  name: string
  provider: 'google' | 'openai' | 'elevenlabs' | 'azure'
  voiceId: string
  language: string
  gender: 'male' | 'female' | 'neutral'
  personality: string
  role: 'stable_explainer' | 'reactive_curious' | 'expert_guest'
  pitchOffset: number
  speakingRate: number
  characteristics: string[]
  audioEffects?: {
    pitch: number
    speakingRate: number
    effectsProfile?: string
  }
}

export interface VoiceCasting {
  hostA: VoiceProfile
  hostB: VoiceProfile
  guest?: VoiceProfile
}

export interface TTSSynthesisRequest {
  turnId: string
  text: string           // 정규화된 텍스트
  ssml?: string
  voice: VoiceProfile
  pauseMsBefore: number
  pauseMsAfter: number
  emphasisWords: string[]
  pace: Pace
  outputFormat: 'wav' | 'mp3'
  sampleRate: 22050 | 24000 | 44100 | 48000
}

export interface TTSSynthesisResult {
  turnId: string
  audioBuffer: Buffer
  durationMs: number
  format: 'wav' | 'mp3'
  sampleRate: number
  synthesisLog: {
    provider: string
    voiceId: string
    requestTimeMs: number
    lexiconHits: string[]
    retries: number
    warnings: string[]
  }
}

// ============================================================================
// Audio Processing Types
// ============================================================================

export interface AudioProcessingConfig {
  targetLoudnessLUFS: number      // -16 for podcasts
  loudnessToleranceDB: number     // ±2
  compressorEnabled: boolean
  compressorThreshold: number     // -20 dB
  compressorRatio: number         // 3:1
  deEsserEnabled: boolean
  deEsserFrequency: number        // 5000-8000 Hz
  crossfadeMs: number             // 20-60ms
  roomToneEnabled: boolean        // 완전 무음 방지
  roomToneLevel: number           // -50 to -40 dB
}

export interface LaughClip {
  id: string
  type: LaughCue['type']
  filePath: string
  durationMs: number
  defaultVolumeDb: number
}

export interface AudioSegment {
  turnId: string
  buffer: Buffer
  startMs: number
  endMs: number
  speaker: Speaker
  crossfadeMs?: number
}

export interface ChapterMarker {
  id: string
  title: string
  startMs: number
  endMs: number
  sectionType: OutlineSection['type']
}

export interface FinalAudioResult {
  buffer: Buffer
  format: 'wav' | 'mp3'
  durationMs: number
  sampleRate: number
  channels: number
  loudnessLUFS: number
  chapters: ChapterMarker[]
  processingLog: {
    normalizationApplied: boolean
    compressionApplied: boolean
    deEsserApplied: boolean
    laughsInserted: number
    crossfadesApplied: number
  }
}

// ============================================================================
// QA & Validation Types
// ============================================================================

export interface QAMetric {
  name: string
  score: number           // 0-100
  passed: boolean
  threshold: number
  details: string
  suggestions?: string[]
}

export interface PronunciationQA {
  oovTokens: string[]           // Out-of-vocabulary
  foreignWordRatio: number
  numberErrors: string[]
  lexiconMisses: string[]
  score: number
}

export interface RhythmQA {
  pauseVariance: number
  uniformPauseDetected: boolean
  longSentences: Array<{ turnIndex: number; length: number }>
  turnLengthVariance: number
  score: number
}

export interface RepetitionQA {
  repeatedPhrases: Array<{ phrase: string; count: number }>
  repeatedInterjections: Array<{ text: string; count: number }>
  consecutiveSameStructure: number
  score: number
}

export interface HumorQA {
  interjectionRepeats: Array<{ text: string; count: number; maxAllowed: number }>
  strongReactionCount: number
  openingHumorCount: number
  forbiddenSlangDetected: string[]
  score: number
}

export interface ArtifactQA {
  clippingDetected: boolean
  sibilanceIssues: number
  volumeJumps: number
  silenceGaps: Array<{ startMs: number; durationMs: number }>
  score: number
}

export interface QAThresholds {
  pronunciation: { minScore: number; oovThreshold: number }
  rhythm: { minScore: number; pauseVarianceThreshold: number }
  repetition: { minScore: number; maxRepeatedPhrases: number }
  humor: { minScore: number; maxStrongReactions: number }
  artifacts: { minScore: number; clippingThreshold: number }
  naturalness: { minScore: number }
  overall: { minScore: number }
}

export interface QAReport {
  id: string
  timestamp: string
  overallScore: number
  passed: boolean
  metrics: {
    pronunciation: QAMetric
    rhythm: QAMetric
    repetition: QAMetric
    humor: QAMetric
    artifacts: QAMetric
    naturalness: QAMetric
  }
  details: {
    pronunciation: PronunciationQA
    rhythm: RhythmQA
    repetition: RepetitionQA
    humor: HumorQA
    artifacts: ArtifactQA
  }
  issues: Array<{
    severity: 'critical' | 'warning' | 'info'
    stage: 'normalization' | 'lexicon' | 'script' | 'synthesis' | 'postprocess'
    description: string
    turnId?: string
    suggestion?: string
  }>
  regenerationRequired: boolean
  regenerationStrategy?: 're_normalize' | 'adjust_script' | 'regenerate_script' | 're_synthesize' | 'full_regeneration'
}

// ============================================================================
// Pipeline Types
// ============================================================================

export interface PipelineConfig {
  seed?: number
  version: string
  language: 'ko-KR' | 'en-US'
  preset: StylePreset
  banterLevel: BanterLevel
  targetDurationSec: number
  voiceCasting: VoiceCasting
  audioProcessing: AudioProcessingConfig
  qaThresholds: QAThresholds
  maxRegenerationAttempts: number
  outputDir: string
  debugMode: boolean
}

export interface PipelineInput {
  sources: SourceDocument[]
  config: PipelineConfig
  userLexiconOverride?: LexiconEntry[]
  metadata?: {
    topic?: string
    audience?: string
    tone?: string
  }
}

export interface PipelineOutput {
  success: boolean
  finalAudioPath: string
  transcriptPath: string
  scriptJsonPath: string
  chaptersPath: string
  qaReportPath: string
  debugBundlePath?: string
  stats: {
    totalDurationMs: number
    turnsCount: number
    regenerationAttempts: number
    processingTimeMs: number
    lexiconHits: number
    normalizationChanges: number
    laughsInserted: number
  }
}

// ============================================================================
// Module Interfaces
// ============================================================================

export interface ISourceIngester {
  ingest(documents: SourceDocument[]): Promise<ContentOutline>
}

export interface IScriptwriter {
  generateDraft(
    outline: ContentOutline,
    config: PipelineConfig,
    metadata?: PipelineInput['metadata']
  ): Promise<ScriptDraft>
}

export interface IChemistryEngine {
  enrich(
    draft: ScriptDraft,
    outline: ContentOutline,
    config: PipelineConfig
  ): Promise<EnrichedScript>

  validateInterjections(script: EnrichedScript): HumorQA
}

export interface INormalizer {
  normalize(text: string): NormalizationResult
  addRule(rule: NormalizationRule): void
  loadLexicon(entries: LexiconEntry[]): void
  getTestCases(): Array<{ input: string; expected: string; rule: string }>
}

export interface ISSMLBuilder {
  build(turn: ScriptTurn, voice: VoiceProfile): string
}

export interface ITTSAdapter {
  synthesizeTurn(request: TTSSynthesisRequest): Promise<TTSSynthesisResult>
  getProviderName(): string
  estimateDuration(text: string, pace: Pace): number
}

export interface IAudioProcessor {
  concatenate(segments: AudioSegment[], config: AudioProcessingConfig): Promise<Buffer>
  insertLaughs(buffer: Buffer, laughCues: LaughCue[], laughClips: LaughClip[]): Promise<Buffer>
  normalize(buffer: Buffer, config: AudioProcessingConfig): Promise<Buffer>
  export(buffer: Buffer, format: 'wav' | 'mp3', path: string): Promise<void>
  generateChapters(segments: ScriptSegment[], turnDurations: number[]): ChapterMarker[]
}

export interface IQAAnalyzer {
  analyze(
    script: EnrichedScript,
    audioResult: FinalAudioResult,
    synthesisResults: TTSSynthesisResult[]
  ): Promise<QAReport>

  shouldRegenerate(report: QAReport): boolean
  getRegenerationStrategy(report: QAReport): QAReport['regenerationStrategy']
}

export interface IPipeline {
  run(input: PipelineInput): Promise<PipelineOutput>
}

// ============================================================================
// Debug & Logging Types
// ============================================================================

export interface DebugBundle {
  outline: ContentOutline
  scriptDraft: ScriptDraft
  enrichedScript: EnrichedScript
  normalizationResults: NormalizationResult[]
  synthesisLogs: TTSSynthesisResult['synthesisLog'][]
  qaReports: QAReport[]
  processingTimeline: Array<{
    stage: string
    startTime: number
    endTime: number
    success: boolean
    error?: string
  }>
}
