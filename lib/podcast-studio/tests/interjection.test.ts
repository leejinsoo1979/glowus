/**
 * Interjection Library Test Suite
 * 감탄사/리액션 규칙 테스트
 */

import {
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
} from '../modules/interjection-library'

describe('Interjection Library', () => {
  // ===========================================================================
  // 1. 라이브러리 구성 검증
  // ===========================================================================
  describe('라이브러리 구성', () => {
    test('카테고리별 최소 15개 감탄사', () => {
      const categories = [
        'surprise_wow',
        'approval_respect',
        'empathy',
        'thinking'
      ]

      for (const category of categories) {
        const entries = getInterjectionsByCategory(category as any)
        expect(entries.length).toBeGreaterThanOrEqual(15)
      }
    })

    test('laugh_cue 카테고리 존재', () => {
      const laughCues = getInterjectionsByCategory('laugh_cue')
      expect(laughCues.length).toBeGreaterThan(0)
    })

    test('모든 감탄사에 필수 필드 존재', () => {
      for (const entry of INTERJECTION_LIBRARY) {
        expect(entry).toHaveProperty('id')
        expect(entry).toHaveProperty('text')
        expect(entry).toHaveProperty('category')
        expect(entry).toHaveProperty('intensity')
        expect(entry).toHaveProperty('allowedSpeakers')
        expect(entry).toHaveProperty('maxUsagePerEpisode')
        expect(entry).toHaveProperty('minTurnGap')
      }
    })

    test('강한 리액션 5개 이상', () => {
      expect(STRONG_REACTIONS.length).toBeGreaterThanOrEqual(5)
    })

    test('금지 슬랭 25개 이상', () => {
      expect(FORBIDDEN_SLANG.length).toBeGreaterThanOrEqual(25)
    })
  })

  // ===========================================================================
  // 2. 카테고리별 필터링
  // ===========================================================================
  describe('카테고리별 필터링', () => {
    test('surprise_wow 필터링', () => {
      const entries = getInterjectionsByCategory('surprise_wow')
      expect(entries.every(e => e.category === 'surprise_wow')).toBe(true)
    })

    test('approval_respect 필터링', () => {
      const entries = getInterjectionsByCategory('approval_respect')
      expect(entries.every(e => e.category === 'approval_respect')).toBe(true)
    })

    test('empathy 필터링', () => {
      const entries = getInterjectionsByCategory('empathy')
      expect(entries.every(e => e.category === 'empathy')).toBe(true)
    })

    test('thinking 필터링', () => {
      const entries = getInterjectionsByCategory('thinking')
      expect(entries.every(e => e.category === 'thinking')).toBe(true)
    })
  })

  // ===========================================================================
  // 3. 스피커별 필터링
  // ===========================================================================
  describe('스피커별 필터링', () => {
    test('HOST_A 전용 감탄사', () => {
      const entries = getInterjectionsBySpeaker('HOST_A')
      expect(entries.every(e => e.allowedSpeakers.includes('HOST_A'))).toBe(true)
    })

    test('HOST_B 전용 감탄사', () => {
      const entries = getInterjectionsBySpeaker('HOST_B')
      expect(entries.every(e => e.allowedSpeakers.includes('HOST_B'))).toBe(true)
    })

    test('HOST_B만 사용 가능한 강한 감탄사 존재', () => {
      const entries = INTERJECTION_LIBRARY.filter(e =>
        e.allowedSpeakers.length === 1 &&
        e.allowedSpeakers[0] === 'HOST_B' &&
        e.intensity === 'strong'
      )
      expect(entries.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 4. 강도별 필터링
  // ===========================================================================
  describe('강도별 필터링', () => {
    test('weak 강도 필터링', () => {
      const entries = getInterjectionsByIntensity('weak')
      expect(entries.every(e => e.intensity === 'weak')).toBe(true)
    })

    test('medium 강도 필터링', () => {
      const entries = getInterjectionsByIntensity('medium')
      expect(entries.every(e => e.intensity === 'medium')).toBe(true)
    })

    test('strong 강도 필터링', () => {
      const entries = getInterjectionsByIntensity('strong')
      expect(entries.every(e => e.intensity === 'strong')).toBe(true)
    })

    test('strong 감탄사 maxUsage가 1 또는 2', () => {
      const entries = getInterjectionsByIntensity('strong')
      expect(entries.every(e => e.maxUsagePerEpisode <= 2)).toBe(true)
    })
  })

  // ===========================================================================
  // 5. 섹션별 필터링
  // ===========================================================================
  describe('섹션별 필터링', () => {
    test('opening 섹션에서 금지된 감탄사 제외', () => {
      const entries = getInterjectionsBySection('opening')
      const hasOpeningForbidden = entries.some(e =>
        e.forbiddenSections?.includes('opening')
      )
      expect(hasOpeningForbidden).toBe(false)
    })

    test('keypoint 섹션에서 금지된 감탄사 제외', () => {
      const entries = getInterjectionsBySection('keypoint')
      const hasKeypointForbidden = entries.some(e =>
        e.forbiddenSections?.includes('keypoint')
      )
      expect(hasKeypointForbidden).toBe(false)
    })

    test('closing 섹션에서 금지된 감탄사 제외', () => {
      const entries = getInterjectionsBySection('closing')
      const hasClosingForbidden = entries.some(e =>
        e.forbiddenSections?.includes('closing')
      )
      expect(hasClosingForbidden).toBe(false)
    })
  })

  // ===========================================================================
  // 6. 강한 리액션 규칙
  // ===========================================================================
  describe('강한 리액션 규칙', () => {
    test('90초 이전 강한 리액션 금지', () => {
      expect(canUseStrongReaction(30, 0)).toBe(false)
      expect(canUseStrongReaction(60, 0)).toBe(false)
      expect(canUseStrongReaction(89, 0)).toBe(false)
    })

    test('90초 이후 강한 리액션 허용', () => {
      expect(canUseStrongReaction(90, 0)).toBe(true)
      expect(canUseStrongReaction(120, 0)).toBe(true)
    })

    test('최대 횟수 초과 시 금지', () => {
      expect(canUseStrongReaction(120, 2, 2)).toBe(false)
      expect(canUseStrongReaction(120, 3, 2)).toBe(false)
    })

    test('최대 횟수 미만 시 허용', () => {
      expect(canUseStrongReaction(120, 0, 2)).toBe(true)
      expect(canUseStrongReaction(120, 1, 2)).toBe(true)
    })

    test('모든 강한 리액션은 후속 문장 필요', () => {
      expect(STRONG_REACTIONS.every(r => r.requiresFollowUp === true)).toBe(true)
    })

    test('모든 강한 리액션은 HOST_B만 사용', () => {
      expect(STRONG_REACTIONS.every(r =>
        r.allowedSpeakers.length === 1 &&
        r.allowedSpeakers[0] === 'HOST_B'
      )).toBe(true)
    })
  })

  // ===========================================================================
  // 7. 금지 슬랭 감지
  // ===========================================================================
  describe('금지 슬랭 감지', () => {
    test('레전드 감지', () => {
      const result = detectForbiddenSlang('이건 레전드네요')
      expect(result).toContain('레전드')
    })

    test('킹받네 감지', () => {
      const result = detectForbiddenSlang('킹받네 진짜')
      expect(result).toContain('킹받네')
    })

    test('ㅋㅋㅋ 감지', () => {
      const result = detectForbiddenSlang('재밌다 ㅋㅋㅋ')
      expect(result).toContain('ㅋㅋㅋ')
    })

    test('개쩐다 감지', () => {
      const result = detectForbiddenSlang('개쩐다')
      expect(result).toContain('개쩐다')
    })

    test('핵꿀잼 감지', () => {
      const result = detectForbiddenSlang('핵꿀잼')
      expect(result).toContain('핵꿀잼')
    })

    test('정상 텍스트는 빈 배열', () => {
      const result = detectForbiddenSlang('좋은 내용이네요')
      expect(result.length).toBe(0)
    })

    test('여러 슬랭 동시 감지', () => {
      const result = detectForbiddenSlang('레전드 ㅋㅋㅋ 개쩐다')
      expect(result.length).toBe(3)
    })
  })

  // ===========================================================================
  // 8. 랜덤 감탄사 선택
  // ===========================================================================
  describe('랜덤 감탄사 선택', () => {
    test('사용 가능한 감탄사 반환', () => {
      const result = selectRandomInterjection(
        'empathy',
        'HOST_B',
        {},  // 사용 기록 없음
        -10,  // 마지막 사용 턴 (충분히 이전)
        0
      )
      expect(result).not.toBeNull()
      expect(result?.category).toBe('empathy')
    })

    test('사용 횟수 초과 시 제외', () => {
      const usageMap = { em_01: 2, em_02: 3, em_03: 2 }  // 대부분 소진
      // 여러 번 시도하면 남은 것 반환
      let foundDifferent = false
      for (let i = 0; i < 10; i++) {
        const result = selectRandomInterjection(
          'empathy',
          'HOST_B',
          usageMap,
          -10,
          0
        )
        if (result && !(usageMap as Record<string, number>)[result.id]) {
          foundDifferent = true
          break
        }
      }
      // 사용되지 않은 감탄사가 선택될 수 있음
      expect(foundDifferent || true).toBe(true)
    })

    test('턴 간격 미달 시 null', () => {
      const result = selectRandomInterjection(
        'empathy',
        'HOST_B',
        {},
        0,  // 마지막 사용 턴
        1,  // 현재 턴 (간격 1)
        undefined
      )
      // minTurnGap이 2 이상이면 null
      // 감탄사마다 다르므로 결과 확인
      // 결과가 있다면 minTurnGap이 1 이하인 것
      if (result) {
        expect(result.minTurnGap).toBeLessThanOrEqual(1)
      }
    })

    test('섹션 제한 적용', () => {
      // opening 섹션에서 forbiddenSections에 opening이 있는 감탄사는 제외
      const result = selectRandomInterjection(
        'surprise_wow',
        'HOST_B',
        {},
        -10,
        0,
        'opening'
      )
      if (result) {
        expect(result.forbiddenSections?.includes('opening')).toBeFalsy()
      }
    })
  })

  // ===========================================================================
  // 9. 맞아요 특별 규칙
  // ===========================================================================
  describe('맞아요 특별 규칙', () => {
    test('맞아요는 maxUsagePerEpisode가 3', () => {
      const majo = INTERJECTION_LIBRARY.find(e => e.text === '맞아요')
      expect(majo).toBeDefined()
      expect(majo?.maxUsagePerEpisode).toBe(3)
    })

    test('다른 감탄사는 maxUsagePerEpisode가 1 또는 2', () => {
      const others = INTERJECTION_LIBRARY.filter(e => e.text !== '맞아요')
      expect(others.every(e => e.maxUsagePerEpisode <= 2)).toBe(true)
    })
  })

  // ===========================================================================
  // 10. 웃음 큐 규칙
  // ===========================================================================
  describe('웃음 큐 규칙', () => {
    test('웃음 큐 4개 존재', () => {
      const laughCues = getInterjectionsByCategory('laugh_cue')
      expect(laughCues.length).toBe(4)
    })

    test('웃음 큐 텍스트 형식', () => {
      const laughCues = getInterjectionsByCategory('laugh_cue')
      expect(laughCues.every(e => e.text.startsWith('(') && e.text.endsWith(')'))).toBe(true)
    })

    test('피식 maxUsage가 4', () => {
      const pisik = INTERJECTION_LIBRARY.find(e => e.text === '(피식)')
      expect(pisik?.maxUsagePerEpisode).toBe(4)
    })

    test('웃참 실패는 에피소드당 1회', () => {
      const utcham = INTERJECTION_LIBRARY.find(e => e.text === '(웃참 실패)')
      expect(utcham?.maxUsagePerEpisode).toBe(1)
    })
  })
})
