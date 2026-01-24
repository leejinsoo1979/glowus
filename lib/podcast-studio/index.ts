/**
 * Podcast Studio
 * Production-Grade Korean Podcast Generation Pipeline
 *
 * v3.0 - NotebookLM 스타일 LLM 기반 대본 생성
 *
 * 주요 기능:
 * - LLM 기반 자연스러운 대화 생성 (템플릿 X)
 * - Nano Banana 이미지 생성 연동
 * - 차트/그래프 SVG 생성
 * - 오디오-슬라이드 타임라인 동기화
 * - 완벽한 한국어 발음 처리
 * - 방송 품질 오디오 출력
 *
 * @version 3.0.0
 * @license MIT
 */

// ============================================================================
// Core Types
// ============================================================================
export * from './core/types'

// ============================================================================
// Core Pipeline
// ============================================================================
export { PodcastPipeline, default as Pipeline } from './core/pipeline'

// ============================================================================
// Modules - Classic (Template-based)
// ============================================================================
export { Scriptwriter } from './modules/scriptwriter'
export { ChemistryEngine } from './modules/chemistry-engine'
export { KoreanNormalizer, createNormalizer } from './modules/korean-normalizer'
export { AudioProcessor } from './modules/audio-processor'
export { QAAnalyzer } from './modules/qa-analyzer'

// ============================================================================
// Modules - NotebookLM Style (LLM-based)
// ============================================================================
export {
  NotebookLMStyleGenerator,
  GeminiProvider,
  createNotebookLMGenerator,
  type DocumentContext,
  type GeneratedPodcast,
  type SlideData,
  type ChartData,
  type TimelineMarker,
  type NotebookLMTurnMeta,
  type ScriptValidationResult
} from './modules/notebooklm-style-generator'

// ============================================================================
// Modules - AI Scriptwriter
// ============================================================================
export {
  AIScriptwriter,
  GeminiScriptProvider,
  OpenAIScriptProvider,
  createAIScriptwriter
} from './modules/ai-scriptwriter'

// ============================================================================
// Modules - Chart Generator
// ============================================================================
export {
  generateChart,
  type ChartConfig,
  type ChartResult
} from './modules/chart-generator'

// ============================================================================
// Adapters
// ============================================================================
export { TTSAdapter, buildSSML } from './adapters/tts-adapter'

// ============================================================================
// Interjection Library
// ============================================================================
export {
  INTERJECTION_LIBRARY,
  STRONG_REACTIONS,
  FORBIDDEN_SLANG,
  getInterjectionsByCategory,
  getInterjectionsBySpeaker,
  getInterjectionsByIntensity,
  getInterjectionsBySection,
  canUseStrongReaction,
  detectForbiddenSlang,
  selectRandomInterjection
} from './modules/interjection-library'

// ============================================================================
// Quick Start
// ============================================================================

import { PodcastPipeline } from './core/pipeline'
import { createNotebookLMGenerator, type DocumentContext, type GeneratedPodcast } from './modules/notebooklm-style-generator'
import type { PipelineInput, StylePreset, BanterLevel } from './core/types'

// ============================================================================
// Quick Start - Classic Mode (Template-based)
// ============================================================================

/**
 * 템플릿 기반 팟캐스트 생성 (기존 방식)
 * @deprecated NotebookLM 스타일 generatePodcastLLM 사용 권장
 */
export async function generatePodcast(options: {
  content: string
  title?: string
  preset?: StylePreset
  banterLevel?: BanterLevel
  durationMinutes?: number
  outputDir?: string
  debug?: boolean
}) {
  const pipeline = new PodcastPipeline()

  const input: PipelineInput = {
    sources: [{
      id: 'main',
      type: 'text',
      content: options.content,
      title: options.title
    }],
    config: {
      version: '3.0.0',
      language: 'ko-KR',
      preset: options.preset || 'FRIENDLY',
      banterLevel: options.banterLevel ?? 2,
      targetDurationSec: (options.durationMinutes || 10) * 60,
      voiceCasting: {
        hostA: {
          id: 'host_a',
          name: 'Host A',
          provider: 'google',
          voiceId: 'ko-KR-Neural2-C',
          language: 'ko-KR',
          gender: 'male',
          personality: '차분하고 전문적인 진행자',
          role: 'stable_explainer',
          pitchOffset: 0,
          speakingRate: 1.0,
          characteristics: ['차분함', '전문성']
        },
        hostB: {
          id: 'host_b',
          name: 'Host B',
          provider: 'google',
          voiceId: 'ko-KR-Neural2-A',
          language: 'ko-KR',
          gender: 'female',
          personality: '활발하고 호기심 많은 보조 진행자',
          role: 'reactive_curious',
          pitchOffset: 0,
          speakingRate: 1.05,
          characteristics: ['활발함', '호기심']
        }
      },
      audioProcessing: {
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
      },
      qaThresholds: {
        pronunciation: { minScore: 80, oovThreshold: 5 },
        rhythm: { minScore: 75, pauseVarianceThreshold: 0.3 },
        repetition: { minScore: 80, maxRepeatedPhrases: 3 },
        humor: { minScore: 85, maxStrongReactions: 2 },
        artifacts: { minScore: 85, clippingThreshold: 0.01 },
        naturalness: { minScore: 75 },
        overall: { minScore: 78 }
      },
      maxRegenerationAttempts: 3,
      outputDir: options.outputDir || './output/podcast',
      debugMode: options.debug || false
    }
  }

  return pipeline.run(input)
}

// ============================================================================
// Quick Start - NotebookLM Style (LLM-based) - 권장
// ============================================================================

/**
 * NotebookLM 스타일 팟캐스트 생성 (LLM 기반)
 *
 * @example
 * ```typescript
 * import { generatePodcastLLM } from '@/lib/podcast-studio'
 *
 * const result = await generatePodcastLLM({
 *   apiKey: process.env.GOOGLE_API_KEY!,
 *   document: {
 *     title: '몽골 스마트 농업 프로젝트',
 *     fullText: '문서 전체 내용...',
 *     keyFacts: ['핵심 팩트 1', '핵심 팩트 2'],
 *     technicalTerms: ['아쿠아포닉스', 'AI'],
 *     numbers: [{ value: '100만평', context: '농장 규모' }],
 *     sections: [...]
 *   },
 *   durationMinutes: 15
 * })
 *
 * console.log(result.script)    // 대본
 * console.log(result.slides)    // 슬라이드 (이미지, 차트 포함)
 * console.log(result.timeline)  // 타임라인
 * ```
 */
export async function generatePodcastLLM(options: {
  apiKey: string
  model?: string
  document: DocumentContext
  preset?: StylePreset
  banterLevel?: BanterLevel
  durationMinutes?: number
  nanoBananaUrl?: string
}): Promise<GeneratedPodcast> {
  const generator = createNotebookLMGenerator(
    options.apiKey,
    options.model,
    options.nanoBananaUrl
  )

  return generator.generatePodcast(options.document, {
    version: '3.0.0',
    language: 'ko-KR',
    preset: options.preset || 'FRIENDLY',
    banterLevel: options.banterLevel ?? 2,
    targetDurationSec: (options.durationMinutes || 10) * 60,
    voiceCasting: {
      hostA: {
        id: 'host_a',
        name: 'Host A',
        provider: 'google',
        voiceId: 'ko-KR-Neural2-C',
        language: 'ko-KR',
        gender: 'male',
        personality: '주제 전문가',
        role: 'stable_explainer',
        pitchOffset: 0,
        speakingRate: 1.0,
        characteristics: ['전문성', '깊이']
      },
      hostB: {
        id: 'host_b',
        name: 'Host B',
        provider: 'google',
        voiceId: 'ko-KR-Neural2-A',
        language: 'ko-KR',
        gender: 'female',
        personality: '호기심 많은 청취자 대변인',
        role: 'reactive_curious',
        pitchOffset: 0,
        speakingRate: 1.05,
        characteristics: ['호기심', '공감']
      }
    },
    audioProcessing: {
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
    },
    qaThresholds: {
      pronunciation: { minScore: 80, oovThreshold: 5 },
      rhythm: { minScore: 75, pauseVarianceThreshold: 0.3 },
      repetition: { minScore: 80, maxRepeatedPhrases: 3 },
      humor: { minScore: 85, maxStrongReactions: 2 },
      artifacts: { minScore: 85, clippingThreshold: 0.01 },
      naturalness: { minScore: 75 },
      overall: { minScore: 78 }
    },
    maxRegenerationAttempts: 3,
    outputDir: './output/podcast',
    debugMode: false
  })
}

// ============================================================================
// Version Info
// ============================================================================

export const VERSION = '3.0.0'
export const SUPPORTED_LANGUAGES = ['ko-KR'] as const
export const SUPPORTED_PRESETS: StylePreset[] = ['NEWS', 'FRIENDLY', 'DEEPDIVE']
export const MAX_DURATION_MINUTES = 60
