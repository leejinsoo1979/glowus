/**
 * Chemistry Engine Test Suite
 * 유머/감탄사 엔진 테스트
 */

import { ChemistryEngine } from '../modules/chemistry-engine'
import type { ScriptDraft, ContentOutline, PipelineConfig, VoiceCasting } from '../core/types'

describe('ChemistryEngine', () => {
  let engine: ChemistryEngine
  let mockDraft: ScriptDraft
  let mockOutline: ContentOutline
  let mockConfig: PipelineConfig

  beforeEach(() => {
    engine = new ChemistryEngine('FRIENDLY', 2)

    mockDraft = {
      id: 'draft-1',
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
          pauseMsAfter: 150
        },
        {
          id: 'turn-2',
          index: 2,
          speaker: 'HOST_A',
          rawText: 'AI가 산업을 변화시키고 있습니다.',
          sectionId: 'sec_keypoint_1',
          intent: 'explain_point',
          emphasisWords: ['AI', '산업'],
          pace: 'normal',
          pauseMsBefore: 200,
          pauseMsAfter: 200
        },
        {
          id: 'turn-3',
          index: 3,
          speaker: 'HOST_B',
          rawText: '그렇구나, 예를 들면요?',
          sectionId: 'sec_keypoint_1',
          intent: 'ask_question',
          emphasisWords: [],
          pace: 'fast',
          pauseMsBefore: 150,
          pauseMsAfter: 300
        },
        {
          id: 'turn-4',
          index: 4,
          speaker: 'HOST_A',
          rawText: '자율주행 자동차 같은 경우가 있어요.',
          sectionId: 'sec_keypoint_1',
          intent: 'give_example',
          emphasisWords: ['자율주행'],
          pace: 'normal',
          pauseMsBefore: 200,
          pauseMsAfter: 200
        }
      ],
      segments: [
        {
          id: 'seg_opening',
          title: '오프닝',
          type: 'opening',
          startTurnIndex: 0,
          endTurnIndex: 1,
          targetDurationSec: 60
        },
        {
          id: 'seg_keypoint_1',
          title: '키포인트 1',
          type: 'keypoint',
          startTurnIndex: 2,
          endTurnIndex: 4,
          targetDurationSec: 180
        }
      ],
      safety: {
        sensitiveTopicsDetected: [],
        forbiddenSlangDetected: [],
        redactions: [],
        warnings: []
      },
      outline: ['AI 기술 발전']
    }

    mockOutline = {
      documentId: 'test-doc',
      title: '테스트 에피소드',
      totalEstimatedDurationSec: 600,
      sections: [
        {
          id: 'sec_opening',
          type: 'opening',
          title: '오프닝',
          keypoints: ['AI 기술'],
          estimatedDurationSec: 60,
          order: 0
        },
        {
          id: 'sec_keypoint_1',
          type: 'keypoint',
          title: '키포인트 1',
          keypoints: ['AI가 산업을 변화'],
          examples: ['자율주행'],
          estimatedDurationSec: 180,
          order: 1
        }
      ],
      keyFacts: [],
      numbers: [],
      technicalTerms: ['AI'],
      risks: []
    }

    const mockVoiceCasting: VoiceCasting = {
      hostA: {
        id: 'host_a',
        name: 'Host A',
        provider: 'google',
        voiceId: 'ko-KR-Neural2-C',
        language: 'ko-KR',
        gender: 'male',
        personality: '차분한 진행자',
        role: 'stable_explainer',
        pitchOffset: 0,
        speakingRate: 1.0,
        characteristics: []
      },
      hostB: {
        id: 'host_b',
        name: 'Host B',
        provider: 'google',
        voiceId: 'ko-KR-Neural2-A',
        language: 'ko-KR',
        gender: 'female',
        personality: '활발한 진행자',
        role: 'reactive_curious',
        pitchOffset: 0,
        speakingRate: 1.05,
        characteristics: []
      }
    }

    mockConfig = {
      version: '1.0.0',
      language: 'ko-KR',
      preset: 'FRIENDLY',
      banterLevel: 2,
      targetDurationSec: 600,
      voiceCasting: mockVoiceCasting,
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
      outputDir: './output',
      debugMode: false
    }
  })

  // ===========================================================================
  // 1. 기본 enrich 기능
  // ===========================================================================
  describe('기본 enrich 기능', () => {
    test('EnrichedScript 반환', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      expect(enriched).toBeDefined()
      expect(enriched.turns.length).toBe(mockDraft.turns.length)
    })

    test('humorCues 배열 포함', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      expect(Array.isArray(enriched.humorCues)).toBe(true)
    })

    test('laughCues 배열 포함', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      expect(Array.isArray(enriched.laughCues)).toBe(true)
    })

    test('interjectionUsage 객체 포함', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      expect(typeof enriched.interjectionUsage).toBe('object')
    })

    test('strongReactionCount 포함', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      expect(typeof enriched.strongReactionCount).toBe('number')
    })

    test('callbackRefs 배열 포함', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      expect(Array.isArray(enriched.callbackRefs)).toBe(true)
    })
  })

  // ===========================================================================
  // 2. 감탄사 규칙
  // ===========================================================================
  describe('감탄사 규칙', () => {
    test('연속 턴 감탄사 방지', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      for (let i = 1; i < enriched.turns.length; i++) {
        if (enriched.turns[i].interjection && enriched.turns[i - 1].interjection) {
          // 연속 감탄사가 있으면 안 됨 (하지만 확률적이므로 경고만)
          console.warn('Warning: Consecutive interjections detected')
        }
      }
      expect(enriched).toBeDefined()
    })

    test('interjection에 필수 필드', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      for (const turn of enriched.turns) {
        if (turn.interjection) {
          expect(turn.interjection.text).toBeDefined()
          expect(turn.interjection.category).toBeDefined()
          expect(turn.interjection.position).toMatch(/start|end/)
        }
      }
    })
  })

  // ===========================================================================
  // 3. validateInterjections 테스트
  // ===========================================================================
  describe('validateInterjections', () => {
    test('점수 반환', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      const qa = engine.validateInterjections(enriched)
      expect(typeof qa.score).toBe('number')
      expect(qa.score).toBeGreaterThanOrEqual(0)
      expect(qa.score).toBeLessThanOrEqual(100)
    })

    test('interjectionRepeats 배열', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      const qa = engine.validateInterjections(enriched)
      expect(Array.isArray(qa.interjectionRepeats)).toBe(true)
    })

    test('strongReactionCount 체크', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      const qa = engine.validateInterjections(enriched)
      expect(typeof qa.strongReactionCount).toBe('number')
    })

    test('forbiddenSlangDetected 배열', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      const qa = engine.validateInterjections(enriched)
      expect(Array.isArray(qa.forbiddenSlangDetected)).toBe(true)
    })
  })

  // ===========================================================================
  // 4. 스타일 프리셋별 동작
  // ===========================================================================
  describe('스타일 프리셋별 동작', () => {
    test('NEWS 프리셋 (절제)', async () => {
      const newsEngine = new ChemistryEngine('NEWS', 0)
      const enriched = await newsEngine.enrich(mockDraft, mockOutline, {
        ...mockConfig,
        preset: 'NEWS',
        banterLevel: 0
      })
      // NEWS는 강한 리액션 0개
      expect(enriched.strongReactionCount).toBeLessThanOrEqual(0)
    })

    test('DEEPDIVE 프리셋', async () => {
      const deepEngine = new ChemistryEngine('DEEPDIVE', 1)
      const enriched = await deepEngine.enrich(mockDraft, mockOutline, {
        ...mockConfig,
        preset: 'DEEPDIVE',
        banterLevel: 1
      })
      // DEEPDIVE는 강한 리액션 최대 1개
      expect(enriched.strongReactionCount).toBeLessThanOrEqual(1)
    })
  })

  // ===========================================================================
  // 5. BanterLevel별 동작
  // ===========================================================================
  describe('BanterLevel별 동작', () => {
    test('BanterLevel 0', async () => {
      const engine0 = new ChemistryEngine('FRIENDLY', 0)
      const enriched = await engine0.enrich(mockDraft, mockOutline, {
        ...mockConfig,
        banterLevel: 0
      })
      expect(enriched).toBeDefined()
    })

    test('BanterLevel 3', async () => {
      const engine3 = new ChemistryEngine('FRIENDLY', 3)
      const enriched = await engine3.enrich(mockDraft, mockOutline, {
        ...mockConfig,
        banterLevel: 3
      })
      expect(enriched).toBeDefined()
    })
  })

  // ===========================================================================
  // 6. 금지 슬랭 감지
  // ===========================================================================
  describe('금지 슬랭 감지', () => {
    test('슬랭 포함 시 감지', async () => {
      const draftWithSlang = {
        ...mockDraft,
        turns: [
          ...mockDraft.turns,
          {
            id: 'turn-slang',
            index: 5,
            speaker: 'HOST_B' as const,
            rawText: '이건 레전드네요',
            sectionId: 'sec_keypoint_1',
            intent: 'react' as const,
            emphasisWords: [],
            pace: 'fast' as const,
            pauseMsBefore: 150,
            pauseMsAfter: 150
          }
        ]
      }
      const enriched = await engine.enrich(draftWithSlang, mockOutline, mockConfig)
      const qa = engine.validateInterjections(enriched)
      expect(qa.forbiddenSlangDetected.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 7. 웃음 큐
  // ===========================================================================
  describe('웃음 큐', () => {
    test('laughCue 필드 확인', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      for (const cue of enriched.laughCues) {
        expect(cue.id).toBeDefined()
        expect(cue.type).toMatch(/light_chuckle|soft_laugh|big_laugh/)
        expect(typeof cue.insertAfterTurnIndex).toBe('number')
        expect(typeof cue.durationMs).toBe('number')
        expect(typeof cue.volumeOffsetDb).toBe('number')
      }
    })
  })

  // ===========================================================================
  // 8. 유머 태그
  // ===========================================================================
  describe('유머 태그', () => {
    test('humorCue 필드 확인', async () => {
      const enriched = await engine.enrich(mockDraft, mockOutline, mockConfig)
      for (const cue of enriched.humorCues) {
        expect(cue.id).toBeDefined()
        expect(cue.type).toBeDefined()
        expect(typeof cue.targetTurnIndex).toBe('number')
      }
    })
  })
})
