/**
 * Scriptwriter Test Suite
 * 대본 생성 규칙 테스트
 */

import { Scriptwriter } from '../modules/scriptwriter'
import type { ContentOutline, PipelineConfig, VoiceCasting } from '../core/types'

describe('Scriptwriter', () => {
  let scriptwriter: Scriptwriter
  let mockOutline: ContentOutline
  let mockConfig: PipelineConfig

  beforeEach(() => {
    scriptwriter = new Scriptwriter(12345)

    mockOutline = {
      documentId: 'test-doc',
      title: '테스트 에피소드',
      totalEstimatedDurationSec: 600,
      sections: [
        {
          id: 'sec_opening',
          type: 'opening',
          title: '오프닝',
          keypoints: ['AI 기술의 발전'],
          estimatedDurationSec: 60,
          order: 0
        },
        {
          id: 'sec_keypoint_1',
          type: 'keypoint',
          title: '핵심 포인트 1',
          keypoints: ['AI가 산업을 변화시키고 있습니다', '다양한 분야에서 활용됩니다'],
          examples: ['자율주행 자동차', '의료 진단'],
          estimatedDurationSec: 180,
          order: 1
        },
        {
          id: 'sec_closing',
          type: 'closing',
          title: '마무리',
          keypoints: ['오늘 배운 내용 정리'],
          estimatedDurationSec: 60,
          order: 2
        }
      ],
      keyFacts: ['AI 기술이 빠르게 발전', '산업 전반에 영향'],
      numbers: [],
      technicalTerms: ['AI', '머신러닝'],
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
  // 1. 기본 대본 생성
  // ===========================================================================
  describe('기본 대본 생성', () => {
    test('대본 초안 생성', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft).toBeDefined()
      expect(draft.id).toBeDefined()
      expect(draft.turns.length).toBeGreaterThan(0)
    })

    test('턴에 필수 필드 포함', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      for (const turn of draft.turns) {
        expect(turn.id).toBeDefined()
        expect(turn.index).toBeDefined()
        expect(turn.speaker).toMatch(/HOST_A|HOST_B/)
        expect(turn.rawText).toBeDefined()
        expect(turn.sectionId).toBeDefined()
        expect(turn.intent).toBeDefined()
        expect(turn.pace).toMatch(/slow|normal|fast/)
        expect(typeof turn.pauseMsBefore).toBe('number')
        expect(typeof turn.pauseMsAfter).toBe('number')
      }
    })

    test('세그먼트 생성', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft.segments.length).toBeGreaterThan(0)
    })

    test('안전성 검사 포함', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft.safety).toBeDefined()
      expect(draft.safety.forbiddenSlangDetected).toBeDefined()
      expect(draft.safety.sensitiveTopicsDetected).toBeDefined()
    })
  })

  // ===========================================================================
  // 2. 턴 구조 검증
  // ===========================================================================
  describe('턴 구조 검증', () => {
    test('A→B 교대 패턴', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      // 완벽한 교대가 아닐 수 있지만, 양쪽 모두 등장해야 함
      const hasHostA = draft.turns.some(t => t.speaker === 'HOST_A')
      const hasHostB = draft.turns.some(t => t.speaker === 'HOST_B')
      expect(hasHostA).toBe(true)
      expect(hasHostB).toBe(true)
    })

    test('오프닝에 opener_hook 또는 introduce_topic', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      const openingTurns = draft.turns.filter(t => t.sectionId === 'sec_opening')
      const hasOpenerIntent = openingTurns.some(t =>
        t.intent === 'opener_hook' || t.intent === 'introduce_topic'
      )
      expect(hasOpenerIntent).toBe(true)
    })

    test('클로징에 closing 인텐트', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      const closingTurns = draft.turns.filter(t => t.sectionId === 'sec_closing')
      const hasClosingIntent = closingTurns.some(t => t.intent === 'closing')
      expect(hasClosingIntent).toBe(true)
    })

    test('키포인트에 explain_point 인텐트', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      const keypointTurns = draft.turns.filter(t =>
        t.sectionId.includes('keypoint')
      )
      const hasExplainIntent = keypointTurns.some(t => t.intent === 'explain_point')
      expect(hasExplainIntent).toBe(true)
    })
  })

  // ===========================================================================
  // 3. 휴지(Pause) 규칙
  // ===========================================================================
  describe('휴지 규칙', () => {
    test('pauseMsBefore 범위 (0-600ms)', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      for (const turn of draft.turns) {
        expect(turn.pauseMsBefore).toBeGreaterThanOrEqual(0)
        expect(turn.pauseMsBefore).toBeLessThanOrEqual(600)
      }
    })

    test('pauseMsAfter 범위 (0-500ms)', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      for (const turn of draft.turns) {
        expect(turn.pauseMsAfter).toBeGreaterThanOrEqual(0)
        expect(turn.pauseMsAfter).toBeLessThanOrEqual(500)
      }
    })

    test('첫 턴 pauseMsBefore는 0', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft.turns[0].pauseMsBefore).toBe(0)
    })
  })

  // ===========================================================================
  // 4. 스타일 프리셋
  // ===========================================================================
  describe('스타일 프리셋', () => {
    test('NEWS 프리셋', async () => {
      const config = { ...mockConfig, preset: 'NEWS' as const }
      const draft = await scriptwriter.generateDraft(mockOutline, config)
      expect(draft.preset).toBe('NEWS')
    })

    test('FRIENDLY 프리셋', async () => {
      const config = { ...mockConfig, preset: 'FRIENDLY' as const }
      const draft = await scriptwriter.generateDraft(mockOutline, config)
      expect(draft.preset).toBe('FRIENDLY')
    })

    test('DEEPDIVE 프리셋', async () => {
      const config = { ...mockConfig, preset: 'DEEPDIVE' as const }
      const draft = await scriptwriter.generateDraft(mockOutline, config)
      expect(draft.preset).toBe('DEEPDIVE')
    })
  })

  // ===========================================================================
  // 5. BanterLevel 영향
  // ===========================================================================
  describe('BanterLevel 영향', () => {
    test('BanterLevel 0 (절제)', async () => {
      const config = { ...mockConfig, banterLevel: 0 as const }
      const draft = await scriptwriter.generateDraft(mockOutline, config)
      expect(draft.banterLevel).toBe(0)
    })

    test('BanterLevel 3 (활발)', async () => {
      const config = { ...mockConfig, banterLevel: 3 as const }
      const draft = await scriptwriter.generateDraft(mockOutline, config)
      expect(draft.banterLevel).toBe(3)
    })
  })

  // ===========================================================================
  // 6. 강조 단어 추출
  // ===========================================================================
  describe('강조 단어 추출', () => {
    test('emphasisWords 배열 존재', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      for (const turn of draft.turns) {
        expect(Array.isArray(turn.emphasisWords)).toBe(true)
      }
    })
  })

  // ===========================================================================
  // 7. 턴 재생성
  // ===========================================================================
  describe('턴 재생성', () => {
    test('too_long 이유로 재생성', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      const turn = draft.turns[0]
      const regenerated = await scriptwriter.regenerateTurn(
        { ...turn, rawText: '아주 긴 텍스트'.repeat(20) },
        'too_long',
        {}
      )
      expect(regenerated.rawText.length).toBeLessThan(turn.rawText.length * 20)
      expect(regenerated.retryCount).toBe(1)
    })

    test('forbidden_slang 이유로 재생성', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      const turn = { ...draft.turns[0], rawText: '이건 레전드야' }
      const regenerated = await scriptwriter.regenerateTurn(
        turn,
        'forbidden_slang',
        {}
      )
      expect(regenerated.rawText).not.toContain('레전드')
    })

    test('retryCount 증가', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      const turn = { ...draft.turns[0], retryCount: 2 }
      const regenerated = await scriptwriter.regenerateTurn(
        turn,
        'repetitive',
        {}
      )
      expect(regenerated.retryCount).toBe(3)
    })
  })

  // ===========================================================================
  // 8. 메타데이터
  // ===========================================================================
  describe('메타데이터', () => {
    test('version 포함', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft.version).toBeDefined()
    })

    test('createdAt 포함', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft.createdAt).toBeDefined()
      expect(new Date(draft.createdAt)).toBeInstanceOf(Date)
    })

    test('targetDurationSec 포함', async () => {
      const draft = await scriptwriter.generateDraft(mockOutline, mockConfig)
      expect(draft.targetDurationSec).toBe(600)
    })
  })
})
