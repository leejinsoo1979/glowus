/**
 * Podcast Studio Main Pipeline
 * 전체 팟캐스트 생성 파이프라인 통합 모듈
 *
 * 7단계 파이프라인:
 * 1. Config & Presets - 설정 및 보이스 캐스팅
 * 2. Source Ingestion - 원본 문서 → ContentOutline
 * 3. Scriptwriting - ContentOutline → ScriptDraft (라디오 대화체)
 * 4. Chemistry Engine - ScriptDraft → EnrichedScript (유머/감탄사)
 * 5. Normalization - 한국어 텍스트 정규화
 * 6. Synthesis - TTS 턴 단위 합성
 * 7. Post-Production - 오디오 처리 및 QA
 */

import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type {
  IPipeline,
  PipelineInput,
  PipelineOutput,
  PipelineConfig,
  ContentOutline,
  ScriptDraft,
  EnrichedScript,
  ScriptTurn,
  AudioSegment,
  TTSSynthesisResult,
  FinalAudioResult,
  QAReport,
  DebugBundle,
  VoiceCasting,
  VoiceProfile,
  AudioProcessingConfig,
  QAThresholds,
  LaughClip
} from './types'
import { Scriptwriter } from '../modules/scriptwriter'
import { ChemistryEngine } from '../modules/chemistry-engine'
import { KoreanNormalizer } from '../modules/korean-normalizer'
import { TTSAdapter } from '../adapters/tts-adapter'
import { AudioProcessor } from '../modules/audio-processor'
import { QAAnalyzer } from '../modules/qa-analyzer'

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_VOICE_CASTING: VoiceCasting = {
  hostA: {
    id: 'host_a',
    name: 'Host A',
    provider: 'google',
    voiceId: 'ko-KR-Neural2-C',  // 차분한 남성
    language: 'ko-KR',
    gender: 'male',
    personality: '차분하고 전문적인 진행자',
    role: 'stable_explainer',
    pitchOffset: 0,
    speakingRate: 1.0,
    characteristics: ['차분함', '전문성', '명확한 전달']
  },
  hostB: {
    id: 'host_b',
    name: 'Host B',
    provider: 'google',
    voiceId: 'ko-KR-Neural2-A',  // 활발한 여성
    language: 'ko-KR',
    gender: 'female',
    personality: '활발하고 호기심 많은 보조 진행자',
    role: 'reactive_curious',
    pitchOffset: 0,
    speakingRate: 1.05,
    characteristics: ['활발함', '호기심', '공감 능력']
  }
}

const DEFAULT_AUDIO_CONFIG: AudioProcessingConfig = {
  targetLoudnessLUFS: -16,
  loudnessToleranceDB: 2,
  compressorEnabled: true,
  compressorThreshold: -20,
  compressorRatio: 3,
  deEsserEnabled: true,
  deEsserFrequency: 6000,
  crossfadeMs: 40,
  roomToneEnabled: true,
  roomToneLevel: -45
}

const DEFAULT_QA_THRESHOLDS: QAThresholds = {
  pronunciation: { minScore: 80, oovThreshold: 5 },
  rhythm: { minScore: 75, pauseVarianceThreshold: 0.3 },
  repetition: { minScore: 80, maxRepeatedPhrases: 3 },
  humor: { minScore: 85, maxStrongReactions: 2 },
  artifacts: { minScore: 85, clippingThreshold: 0.01 },
  naturalness: { minScore: 75 },
  overall: { minScore: 78 }
}

/** 기본 웃음 클립 */
const DEFAULT_LAUGH_CLIPS: LaughClip[] = [
  { id: 'light_chuckle', type: 'light_chuckle', filePath: '', durationMs: 800, defaultVolumeDb: -8 },
  { id: 'soft_laugh', type: 'soft_laugh', filePath: '', durationMs: 1200, defaultVolumeDb: -7 },
  { id: 'big_laugh', type: 'big_laugh', filePath: '', durationMs: 2000, defaultVolumeDb: -6 }
]

// ============================================================================
// Source Ingester
// ============================================================================

/**
 * 원본 문서를 ContentOutline으로 변환
 */
async function ingestSources(
  sources: PipelineInput['sources'],
  targetDurationSec: number
): Promise<ContentOutline> {
  // 모든 소스 내용 합치기
  let combinedContent = ''
  for (const source of sources) {
    combinedContent += source.content + '\n\n'
  }

  // 간단한 섹션 분석 (실제로는 LLM 사용 권장)
  const paragraphs = combinedContent.split(/\n\n+/).filter(p => p.trim())
  const sections = []

  // 오프닝 섹션
  sections.push({
    id: 'sec_opening',
    type: 'opening' as const,
    title: '오프닝',
    keypoints: [paragraphs[0]?.slice(0, 100) || '오늘의 주제'],
    estimatedDurationSec: Math.floor(targetDurationSec * 0.1),
    order: 0
  })

  // 키포인트 섹션들
  const mainParagraphs = paragraphs.slice(1, -1)
  const keypointCount = Math.min(mainParagraphs.length, 3)
  const keypointDuration = Math.floor(targetDurationSec * 0.7 / keypointCount)

  for (let i = 0; i < keypointCount; i++) {
    sections.push({
      id: `sec_keypoint_${i}`,
      type: 'keypoint' as const,
      title: `핵심 포인트 ${i + 1}`,
      keypoints: [mainParagraphs[i]?.slice(0, 200) || `포인트 ${i + 1}`],
      examples: [`예시 ${i + 1}`],
      estimatedDurationSec: keypointDuration,
      order: i + 1
    })
  }

  // 클로징 섹션
  sections.push({
    id: 'sec_closing',
    type: 'closing' as const,
    title: '마무리',
    keypoints: [paragraphs[paragraphs.length - 1]?.slice(0, 100) || '마무리'],
    estimatedDurationSec: Math.floor(targetDurationSec * 0.1),
    order: sections.length
  })

  // 키팩트 추출 (간단히)
  const keyFacts = paragraphs
    .slice(0, 5)
    .map(p => p.slice(0, 50))
    .filter(f => f.length > 10)

  // 숫자 추출
  const numbers: Array<{ raw: string; context: string }> = []
  const numberPattern = /\d+(?:[,\.]\d+)?(?:%|원|달러|만|억|조)?/g
  for (const para of paragraphs) {
    let match
    while ((match = numberPattern.exec(para)) !== null) {
      numbers.push({
        raw: match[0],
        context: para.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20)
      })
    }
  }

  // 기술 용어 추출 (간단히)
  const technicalTerms = combinedContent.match(/[A-Z]{2,}|[가-힣]+(?:API|SDK|TTS)/g) || []

  return {
    documentId: sources[0]?.id || uuidv4(),
    title: sources[0]?.title || '팟캐스트 에피소드',
    totalEstimatedDurationSec: targetDurationSec,
    sections,
    keyFacts,
    numbers,
    technicalTerms: [...new Set(technicalTerms)],
    risks: []
  }
}

// ============================================================================
// Pipeline Implementation
// ============================================================================

export class PodcastPipeline implements IPipeline {
  private scriptwriter: Scriptwriter
  private chemistryEngine: ChemistryEngine
  private normalizer: KoreanNormalizer
  private ttsAdapter: TTSAdapter
  private audioProcessor: AudioProcessor
  private qaAnalyzer: QAAnalyzer

  private debugBundle: DebugBundle | null = null
  private processingTimeline: DebugBundle['processingTimeline'] = []

  constructor() {
    this.scriptwriter = new Scriptwriter()
    this.chemistryEngine = new ChemistryEngine()
    this.normalizer = new KoreanNormalizer()
    this.ttsAdapter = new TTSAdapter()
    this.audioProcessor = new AudioProcessor()
    this.qaAnalyzer = new QAAnalyzer()
  }

  /**
   * 전체 파이프라인 실행
   */
  async run(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = Date.now()
    const config = this.initializeConfig(input.config)

    // 출력 디렉토리 생성
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true })
    }

    let regenerationAttempts = 0
    let finalScript: EnrichedScript | null = null
    let finalAudioResult: FinalAudioResult | null = null
    let qaReport: QAReport | null = null
    let synthesisResults: TTSSynthesisResult[] = []

    try {
      // =====================================================================
      // Stage 1: Source Ingestion
      // =====================================================================
      this.logStage('source_ingestion', true)
      const outline = await ingestSources(input.sources, config.targetDurationSec)
      this.logStage('source_ingestion', false)

      // =====================================================================
      // Main Loop: Generate → QA → Regenerate
      // =====================================================================
      do {
        // ===================================================================
        // Stage 2: Scriptwriting
        // ===================================================================
        this.logStage('scriptwriting', true)
        const scriptDraft = await this.scriptwriter.generateDraft(
          outline,
          config,
          input.metadata
        )
        this.logStage('scriptwriting', false)

        // ===================================================================
        // Stage 3: Chemistry Engine
        // ===================================================================
        this.logStage('chemistry', true)
        finalScript = await this.chemistryEngine.enrich(scriptDraft, outline, config)
        this.logStage('chemistry', false)

        // ===================================================================
        // Stage 4: Normalization
        // ===================================================================
        this.logStage('normalization', true)
        finalScript = await this.normalizeScript(finalScript)
        this.logStage('normalization', false)

        // ===================================================================
        // Stage 5: TTS Synthesis
        // ===================================================================
        this.logStage('synthesis', true)
        synthesisResults = await this.synthesizeScript(finalScript, config)
        this.logStage('synthesis', false)

        // ===================================================================
        // Stage 6: Audio Post-Production
        // ===================================================================
        this.logStage('postproduction', true)
        finalAudioResult = await this.processAudio(
          finalScript,
          synthesisResults,
          config
        )
        this.logStage('postproduction', false)

        // ===================================================================
        // Stage 7: QA Analysis
        // ===================================================================
        this.logStage('qa', true)
        qaReport = await this.qaAnalyzer.analyze(
          finalScript,
          finalAudioResult,
          synthesisResults
        )
        this.logStage('qa', false)

        // 재생성 필요 여부 체크
        if (this.qaAnalyzer.shouldRegenerate(qaReport)) {
          regenerationAttempts++
          console.log(`[Pipeline] QA failed (score: ${qaReport.overallScore}), regenerating... (attempt ${regenerationAttempts})`)

          // 재생성 전략에 따라 처리
          if (qaReport.regenerationStrategy === 're_normalize') {
            // 정규화만 다시
            finalScript = await this.normalizeScript(finalScript)
          } else if (qaReport.regenerationStrategy === 'adjust_script') {
            // 대본 조정
            await this.adjustScript(finalScript, qaReport)
          }
          // 나머지 전략은 루프에서 전체 재생성
        } else {
          break
        }
      } while (regenerationAttempts < config.maxRegenerationAttempts)

      // =====================================================================
      // Export Results
      // =====================================================================
      if (!finalScript || !finalAudioResult || !qaReport) {
        throw new Error('Pipeline failed to generate output')
      }

      const output = await this.exportResults(
        finalScript,
        finalAudioResult,
        qaReport,
        synthesisResults,
        config,
        regenerationAttempts,
        startTime
      )

      return output

    } catch (error) {
      console.error('[Pipeline] Error:', error)
      throw error
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /** 설정 초기화 */
  private initializeConfig(partial: PipelineConfig): PipelineConfig {
    return {
      version: partial.version || '1.0.0',
      language: partial.language || 'ko-KR',
      preset: partial.preset || 'FRIENDLY',
      banterLevel: partial.banterLevel ?? 2,
      targetDurationSec: partial.targetDurationSec || 600,
      voiceCasting: partial.voiceCasting || DEFAULT_VOICE_CASTING,
      audioProcessing: { ...DEFAULT_AUDIO_CONFIG, ...partial.audioProcessing },
      qaThresholds: { ...DEFAULT_QA_THRESHOLDS, ...partial.qaThresholds },
      maxRegenerationAttempts: partial.maxRegenerationAttempts ?? 3,
      outputDir: partial.outputDir || './output',
      debugMode: partial.debugMode ?? false,
      seed: partial.seed
    }
  }

  /** 스크립트 정규화 */
  private async normalizeScript(script: EnrichedScript): Promise<EnrichedScript> {
    const normalizedTurns: ScriptTurn[] = []

    for (const turn of script.turns) {
      const result = this.normalizer.normalize(turn.rawText)
      normalizedTurns.push({
        ...turn,
        normalizedText: result.normalized,
        normalizationLog: result.tokenMap.map(t => ({
          original: t.original,
          normalized: t.normalized,
          rule: t.rule
        }))
      })
    }

    return {
      ...script,
      turns: normalizedTurns
    }
  }

  /** TTS 합성 */
  private async synthesizeScript(
    script: EnrichedScript,
    config: PipelineConfig
  ): Promise<TTSSynthesisResult[]> {
    const results: TTSSynthesisResult[] = []
    const { hostA, hostB } = config.voiceCasting

    for (const turn of script.turns) {
      const voice = turn.speaker === 'HOST_A' ? hostA : hostB
      const request = this.ttsAdapter.createRequestFromTurn(turn, voice)
      const result = await this.ttsAdapter.synthesizeTurn(request)
      results.push(result)
    }

    return results
  }

  /** 오디오 후처리 */
  private async processAudio(
    script: EnrichedScript,
    synthesisResults: TTSSynthesisResult[],
    config: PipelineConfig
  ): Promise<FinalAudioResult> {
    // AudioSegment 변환
    const segments: AudioSegment[] = synthesisResults.map((result, index) => ({
      turnId: result.turnId,
      buffer: result.audioBuffer,
      startMs: 0,  // 연결 시 계산
      endMs: result.durationMs,
      speaker: script.turns[index].speaker
    }))

    // 전체 처리
    return await this.audioProcessor.processFull(
      segments,
      script.laughCues,
      DEFAULT_LAUGH_CLIPS,
      script.segments,
      config.audioProcessing
    )
  }

  /** 대본 조정 (QA 결과 기반) */
  private async adjustScript(
    script: EnrichedScript,
    qaReport: QAReport
  ): Promise<void> {
    // 금지 슬랭 제거
    for (const slang of qaReport.details.humor.forbiddenSlangDetected) {
      for (const turn of script.turns) {
        turn.rawText = turn.rawText.replace(new RegExp(slang, 'g'), '')
      }
    }

    // 과다 사용 감탄사 제거
    for (const repeat of qaReport.details.humor.interjectionRepeats) {
      let count = 0
      for (const turn of script.turns) {
        if (turn.interjection?.text === repeat.text) {
          count++
          if (count > repeat.maxAllowed) {
            delete turn.interjection
          }
        }
      }
    }
  }

  /** 결과 내보내기 */
  private async exportResults(
    script: EnrichedScript,
    audioResult: FinalAudioResult,
    qaReport: QAReport,
    synthesisResults: TTSSynthesisResult[],
    config: PipelineConfig,
    regenerationAttempts: number,
    startTime: number
  ): Promise<PipelineOutput> {
    const sessionId = uuidv4().slice(0, 8)
    const outputDir = config.outputDir

    // 1. 오디오 파일
    const audioPath = path.join(outputDir, `podcast_${sessionId}.mp3`)
    await this.audioProcessor.export(audioResult.buffer, 'mp3', audioPath)

    // 2. 트랜스크립트
    const transcriptPath = path.join(outputDir, `transcript_${sessionId}.txt`)
    const transcript = script.turns
      .map(t => `[${t.speaker}] ${t.normalizedText || t.rawText}`)
      .join('\n\n')
    fs.writeFileSync(transcriptPath, transcript)

    // 3. 스크립트 JSON
    const scriptPath = path.join(outputDir, `script_${sessionId}.json`)
    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2))

    // 4. 챕터 JSON
    const chaptersPath = path.join(outputDir, `chapters_${sessionId}.json`)
    fs.writeFileSync(chaptersPath, JSON.stringify(audioResult.chapters, null, 2))

    // 5. QA 리포트
    const qaPath = path.join(outputDir, `qa_report_${sessionId}.json`)
    fs.writeFileSync(qaPath, JSON.stringify(qaReport, null, 2))

    // 6. 디버그 번들 (옵션)
    let debugPath: string | undefined
    if (config.debugMode) {
      debugPath = path.join(outputDir, `debug_bundle_${sessionId}.json`)
      const debugBundle = {
        processingTimeline: this.processingTimeline,
        qaReports: [qaReport],
        synthesisLogs: synthesisResults.map(r => r.synthesisLog)
      }
      fs.writeFileSync(debugPath, JSON.stringify(debugBundle, null, 2))
    }

    // 통계 계산
    const processingTimeMs = Date.now() - startTime
    const lexiconHits = synthesisResults.reduce(
      (sum, r) => sum + r.synthesisLog.lexiconHits.length, 0
    )
    const normalizationChanges = script.turns.reduce(
      (sum, t) => sum + (t.normalizationLog?.length || 0), 0
    )

    return {
      success: qaReport.passed,
      finalAudioPath: audioPath,
      transcriptPath,
      scriptJsonPath: scriptPath,
      chaptersPath,
      qaReportPath: qaPath,
      debugBundlePath: debugPath,
      stats: {
        totalDurationMs: audioResult.durationMs,
        turnsCount: script.turns.length,
        regenerationAttempts,
        processingTimeMs,
        lexiconHits,
        normalizationChanges,
        laughsInserted: audioResult.processingLog.laughsInserted
      }
    }
  }

  /** 스테이지 로깅 */
  private logStage(stage: string, start: boolean): void {
    const time = Date.now()
    if (start) {
      this.processingTimeline.push({
        stage,
        startTime: time,
        endTime: 0,
        success: false
      })
      console.log(`[Pipeline] Starting: ${stage}`)
    } else {
      const entry = this.processingTimeline.find(
        e => e.stage === stage && e.endTime === 0
      )
      if (entry) {
        entry.endTime = time
        entry.success = true
      }
      console.log(`[Pipeline] Completed: ${stage} (${time - (entry?.startTime || time)}ms)`)
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default PodcastPipeline
