/**
 * QA Analyzer Test Suite
 * 품질 분석 및 재생성 전략 테스트
 */

import { QAAnalyzer } from '../modules/qa-analyzer'
import type { EnrichedScript, FinalAudioResult, TTSSynthesisResult } from '../core/types'

describe('QAAnalyzer', () => {
  let analyzer: QAAnalyzer
  let mockScript: EnrichedScript
  let mockAudioResult: FinalAudioResult
  let mockSynthesisResults: TTSSynthesisResult[]

  beforeEach(() => {
    analyzer = new QAAnalyzer()

    mockScript = {
      id: 'script-1',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      preset: 'FRIENDLY',
      banterLevel: 2,
      targetDurationSec: 600,
      turns: [
        {
          id: 'turn-0',
          index: 0,
          speaker: 'HOST_A',
          rawText: '오늘은 AI에 대해 이야기해볼게요.',
          normalizedText: '오늘은 에이아이에 대해 이야기해볼게요.',
          sectionId: 'sec_opening',
          intent: 'opener_hook',
          emphasisWords: ['AI'],
          pace: 'normal',
          pauseMsBefore: 0,
          pauseMsAfter: 200
        },
        {
          id: 'turn-1',
          index: 1,
          speaker: 'HOST_B',
          rawText: '오 재밌겠네요!',
          sectionId: 'sec_opening',
          intent: 'react',
          emphasisWords: [],
          pace: 'fast',
          pauseMsBefore: 150,
          pauseMsAfter: 150,
          interjection: { text: '오', category: 'surprise_wow', position: 'start' }
        },
        {
          id: 'turn-2',
          index: 2,
          speaker: 'HOST_A',
          rawText: 'AI가 산업을 변화시키고 있습니다.',
          normalizedText: '에이아이가 산업을 변화시키고 있습니다.',
          sectionId: 'sec_keypoint_1',
          intent: 'explain_point',
          emphasisWords: ['AI', '산업'],
          pace: 'normal',
          pauseMsBefore: 200,
          pauseMsAfter: 200
        }
      ],
      segments: [],
      safety: {
        sensitiveTopicsDetected: [],
        forbiddenSlangDetected: [],
        redactions: [],
        warnings: []
      },
      outline: [],
      humorCues: [],
      laughCues: [],
      interjectionUsage: { '오': 1 },
      strongReactionCount: 0,
      callbackRefs: []
    }

    mockAudioResult = {
      buffer: Buffer.from('dummy'),
      format: 'mp3',
      durationMs: 30000,
      sampleRate: 24000,
      channels: 1,
      loudnessLUFS: -16,
      chapters: [],
      processingLog: {
        normalizationApplied: true,
        compressionApplied: true,
        deEsserApplied: true,
        laughsInserted: 0,
        crossfadesApplied: 2
      }
    }

    mockSynthesisResults = [
      {
        turnId: 'turn-0',
        audioBuffer: Buffer.from('audio'),
        durationMs: 5000,
        format: 'mp3',
        sampleRate: 24000,
        synthesisLog: {
          provider: 'google',
          voiceId: 'ko-KR-Neural2-C',
          requestTimeMs: 500,
          lexiconHits: [],
          retries: 0,
          warnings: []
        }
      },
      {
        turnId: 'turn-1',
        audioBuffer: Buffer.from('audio'),
        durationMs: 3000,
        format: 'mp3',
        sampleRate: 24000,
        synthesisLog: {
          provider: 'google',
          voiceId: 'ko-KR-Neural2-A',
          requestTimeMs: 400,
          lexiconHits: [],
          retries: 0,
          warnings: []
        }
      },
      {
        turnId: 'turn-2',
        audioBuffer: Buffer.from('audio'),
        durationMs: 6000,
        format: 'mp3',
        sampleRate: 24000,
        synthesisLog: {
          provider: 'google',
          voiceId: 'ko-KR-Neural2-C',
          requestTimeMs: 600,
          lexiconHits: [],
          retries: 0,
          warnings: []
        }
      }
    ]
  })

  // ===========================================================================
  // 1. 기본 분석
  // ===========================================================================
  describe('기본 분석', () => {
    test('QAReport 반환', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(report).toBeDefined()
      expect(report.id).toBeDefined()
      expect(report.timestamp).toBeDefined()
    })

    test('overallScore 포함', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.overallScore).toBe('number')
      expect(report.overallScore).toBeGreaterThanOrEqual(0)
      expect(report.overallScore).toBeLessThanOrEqual(100)
    })

    test('passed 불린 값', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.passed).toBe('boolean')
    })

    test('metrics 객체 포함', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(report.metrics.pronunciation).toBeDefined()
      expect(report.metrics.rhythm).toBeDefined()
      expect(report.metrics.repetition).toBeDefined()
      expect(report.metrics.humor).toBeDefined()
      expect(report.metrics.artifacts).toBeDefined()
      expect(report.metrics.naturalness).toBeDefined()
    })

    test('details 객체 포함', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(report.details.pronunciation).toBeDefined()
      expect(report.details.rhythm).toBeDefined()
      expect(report.details.repetition).toBeDefined()
      expect(report.details.humor).toBeDefined()
      expect(report.details.artifacts).toBeDefined()
    })
  })

  // ===========================================================================
  // 2. 발음 QA
  // ===========================================================================
  describe('발음 QA', () => {
    test('oovTokens 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.pronunciation.oovTokens)).toBe(true)
    })

    test('foreignWordRatio 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.pronunciation.foreignWordRatio).toBe('number')
    })

    test('numberErrors 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.pronunciation.numberErrors)).toBe(true)
    })

    test('score 범위', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(report.details.pronunciation.score).toBeGreaterThanOrEqual(0)
      expect(report.details.pronunciation.score).toBeLessThanOrEqual(100)
    })
  })

  // ===========================================================================
  // 3. 리듬 QA
  // ===========================================================================
  describe('리듬 QA', () => {
    test('pauseVariance 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.rhythm.pauseVariance).toBe('number')
    })

    test('uniformPauseDetected 불린', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.rhythm.uniformPauseDetected).toBe('boolean')
    })

    test('longSentences 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.rhythm.longSentences)).toBe(true)
    })

    test('turnLengthVariance 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.rhythm.turnLengthVariance).toBe('number')
    })
  })

  // ===========================================================================
  // 4. 반복 QA
  // ===========================================================================
  describe('반복 QA', () => {
    test('repeatedPhrases 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.repetition.repeatedPhrases)).toBe(true)
    })

    test('repeatedInterjections 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.repetition.repeatedInterjections)).toBe(true)
    })

    test('consecutiveSameStructure 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.repetition.consecutiveSameStructure).toBe('number')
    })
  })

  // ===========================================================================
  // 5. 유머 QA
  // ===========================================================================
  describe('유머 QA', () => {
    test('interjectionRepeats 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.humor.interjectionRepeats)).toBe(true)
    })

    test('strongReactionCount 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.humor.strongReactionCount).toBe('number')
    })

    test('openingHumorCount 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.humor.openingHumorCount).toBe('number')
    })

    test('forbiddenSlangDetected 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.humor.forbiddenSlangDetected)).toBe(true)
    })
  })

  // ===========================================================================
  // 6. 아티팩트 QA
  // ===========================================================================
  describe('아티팩트 QA', () => {
    test('clippingDetected 불린', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.artifacts.clippingDetected).toBe('boolean')
    })

    test('sibilanceIssues 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.artifacts.sibilanceIssues).toBe('number')
    })

    test('volumeJumps 숫자', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(typeof report.details.artifacts.volumeJumps).toBe('number')
    })

    test('silenceGaps 배열', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.details.artifacts.silenceGaps)).toBe(true)
    })
  })

  // ===========================================================================
  // 7. 재생성 판단
  // ===========================================================================
  describe('재생성 판단', () => {
    test('shouldRegenerate 기본', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      const shouldRegen = analyzer.shouldRegenerate(report)
      expect(typeof shouldRegen).toBe('boolean')
    })

    test('Critical 이슈 시 재생성', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      report.issues = [{ severity: 'critical', stage: 'script', description: '테스트' }]
      expect(analyzer.shouldRegenerate(report)).toBe(true)
    })

    test('낮은 점수 시 재생성', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      report.overallScore = 50
      expect(analyzer.shouldRegenerate(report)).toBe(true)
    })
  })

  // ===========================================================================
  // 8. 재생성 전략
  // ===========================================================================
  describe('재생성 전략', () => {
    test('getRegenerationStrategy 반환', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      const strategy = analyzer.getRegenerationStrategy(report)
      expect(strategy).toMatch(/re_normalize|adjust_script|regenerate_script|re_synthesize|full_regeneration/)
    })

    test('발음 점수 낮으면 re_normalize', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      report.metrics.pronunciation.score = 50
      const strategy = analyzer.getRegenerationStrategy(report)
      expect(strategy).toBe('re_normalize')
    })

    test('자연스러움 낮으면 full_regeneration', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      report.metrics.naturalness.score = 50
      const strategy = analyzer.getRegenerationStrategy(report)
      expect(strategy).toBe('full_regeneration')
    })
  })

  // ===========================================================================
  // 9. 턴 분석
  // ===========================================================================
  describe('턴 분석', () => {
    test('analyzeTurn 기본', () => {
      const turn = mockScript.turns[0]
      const result = analyzer.analyzeTurn(turn)
      expect(result.issues).toBeDefined()
      expect(result.suggestions).toBeDefined()
      expect(result.score).toBeDefined()
    })

    test('긴 문장 감지', () => {
      const longTurn = {
        ...mockScript.turns[0],
        rawText: '아'.repeat(50)  // 50자
      }
      const result = analyzer.analyzeTurn(longTurn)
      expect(result.issues.some(i => i.includes('너무 깁니다'))).toBe(true)
    })

    test('금지 슬랭 감지', () => {
      const slangTurn = {
        ...mockScript.turns[0],
        rawText: '이건 레전드네요'
      }
      const result = analyzer.analyzeTurn(slangTurn)
      expect(result.issues.some(i => i.includes('금지 슬랭'))).toBe(true)
    })
  })

  // ===========================================================================
  // 10. Issues 생성
  // ===========================================================================
  describe('Issues 생성', () => {
    test('issues 배열 반환', async () => {
      const report = await analyzer.analyze(mockScript, mockAudioResult, mockSynthesisResults)
      expect(Array.isArray(report.issues)).toBe(true)
    })

    test('issue 필드 확인', async () => {
      const scriptWithIssues = {
        ...mockScript,
        turns: [
          ...mockScript.turns,
          {
            id: 'turn-long',
            index: 3,
            speaker: 'HOST_A' as const,
            rawText: '아주 긴 문장입니다. '.repeat(10),
            sectionId: 'sec_keypoint_1',
            intent: 'explain_point' as const,
            emphasisWords: [],
            pace: 'normal' as const,
            pauseMsBefore: 200,
            pauseMsAfter: 200
          }
        ]
      }
      const report = await analyzer.analyze(scriptWithIssues, mockAudioResult, mockSynthesisResults)

      for (const issue of report.issues) {
        expect(issue.severity).toMatch(/critical|warning|info/)
        expect(issue.stage).toBeDefined()
        expect(issue.description).toBeDefined()
      }
    })
  })
})
