/**
 * Interjection Library
 * 감탄사/리액션 라이브러리 - 카테고리별 최소 15개 이상
 *
 * 규칙:
 * - 동일 감탄사/추임새는 에피소드당 최대 2회 ("맞아요"만 3회 허용)
 * - 연속 턴에서 감탄사 사용 금지 (최소 1턴 간격)
 * - 강한 감탄사 연속 등장 시 자동 재작성 트리거
 */

import type { InterjectionEntry, InterjectionCategory, StrongReaction } from '../core/types'

// ============================================================================
// Interjection Library - 카테고리별 감탄사
// ============================================================================

export const INTERJECTION_LIBRARY: InterjectionEntry[] = [
  // -------------------------------------------------------------------------
  // A) Surprise/Wow (놀람/감탄)
  // -------------------------------------------------------------------------
  {
    id: 'sw_01',
    text: '우와',
    category: 'surprise_wow',
    intensity: 'medium',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'sw_02',
    text: '와…',
    category: 'surprise_wow',
    intensity: 'medium',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'sw_03',
    text: '오…',
    category: 'surprise_wow',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'sw_04',
    text: '오호',
    category: 'surprise_wow',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'sw_05',
    text: '헐',
    category: 'surprise_wow',
    intensity: 'strong',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 5,
    forbiddenSections: ['opening', 'keypoint']
  },
  {
    id: 'sw_06',
    text: '세상에',
    category: 'surprise_wow',
    intensity: 'medium',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 4
  },
  {
    id: 'sw_07',
    text: '이야',
    category: 'surprise_wow',
    intensity: 'weak',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'sw_08',
    text: '진짜요?',
    category: 'surprise_wow',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'sw_09',
    text: '말도 안 돼',
    category: 'surprise_wow',
    intensity: 'strong',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 5,
    forbiddenSections: ['opening']
  },
  {
    id: 'sw_10',
    text: '대박',
    category: 'surprise_wow',
    intensity: 'strong',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 5,
    forbiddenSections: ['opening', 'keypoint']
  },
  {
    id: 'sw_11',
    text: '어머',
    category: 'surprise_wow',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 4
  },
  {
    id: 'sw_12',
    text: '와 진짜?',
    category: 'surprise_wow',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'sw_13',
    text: '오 그래요?',
    category: 'surprise_wow',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'sw_14',
    text: '아 그렇구나',
    category: 'surprise_wow',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'sw_15',
    text: '흥미롭네요',
    category: 'surprise_wow',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },

  // -------------------------------------------------------------------------
  // B) Approval/Respect (인정/동의)
  // -------------------------------------------------------------------------
  {
    id: 'ar_01',
    text: '오케이',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'ar_02',
    text: '좋네요',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'ar_03',
    text: '그건 인정이죠',
    category: 'approval_respect',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 4
  },
  {
    id: 'ar_04',
    text: '납득',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'ar_05',
    text: '깔끔한데요',
    category: 'approval_respect',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 4
  },
  {
    id: 'ar_06',
    text: '센스 있다',
    category: 'approval_respect',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 5
  },
  {
    id: 'ar_07',
    text: '좋은 포인트예요',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'ar_08',
    text: '이건 확실해요',
    category: 'approval_respect',
    intensity: 'medium',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'ar_09',
    text: '그렇죠',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'ar_10',
    text: '맞는 말이에요',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'ar_11',
    text: '동감이에요',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'ar_12',
    text: '그 부분 중요하죠',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'ar_13',
    text: '핵심이네요',
    category: 'approval_respect',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 4
  },
  {
    id: 'ar_14',
    text: '그거 좋네요',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'ar_15',
    text: '일리가 있어요',
    category: 'approval_respect',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },

  // -------------------------------------------------------------------------
  // C) Empathy (공감)
  // -------------------------------------------------------------------------
  {
    id: 'em_01',
    text: '아… 그거 알죠',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'em_02',
    text: '맞아요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 3,  // 예외: 최대 3회 허용
    minTurnGap: 2
  },
  {
    id: 'em_03',
    text: '그쵸',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'em_04',
    text: '완전 공감',
    category: 'empathy',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 4
  },
  {
    id: 'em_05',
    text: '아 그 느낌',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'em_06',
    text: '그거 진짜 그래요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'em_07',
    text: '저도 그랬어요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'em_08',
    text: '많이들 그러시더라고요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'em_09',
    text: '그 마음 알아요',
    category: 'empathy',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 5
  },
  {
    id: 'em_10',
    text: '공감 가네요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'em_11',
    text: '그렇더라고요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'em_12',
    text: '네네',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'em_13',
    text: '아 맞아',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'em_14',
    text: '그런 경우 많죠',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'em_15',
    text: '다들 그래요',
    category: 'empathy',
    intensity: 'weak',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },

  // -------------------------------------------------------------------------
  // D) Thinking/Transition (생각/전환)
  // -------------------------------------------------------------------------
  {
    id: 'th_01',
    text: '음',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'th_02',
    text: '잠깐만요',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_03',
    text: '자, 그러면',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'th_04',
    text: '정리하면',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_05',
    text: '한 번만 더',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 5
  },
  {
    id: 'th_06',
    text: '다시 말하면',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_07',
    text: '포인트는',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'th_08',
    text: '아, 잠깐…',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_09',
    text: '그러니까',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'th_10',
    text: '여기서 중요한 건',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_11',
    text: '근데요',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 3
  },
  {
    id: 'th_12',
    text: '그래서',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 2,
    minTurnGap: 2
  },
  {
    id: 'th_13',
    text: '결국',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_14',
    text: '쉽게 말하면',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },
  {
    id: 'th_15',
    text: '정리해보면',
    category: 'thinking',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A'],
    maxUsagePerEpisode: 2,
    minTurnGap: 4
  },

  // -------------------------------------------------------------------------
  // E) Laugh Cues (웃음 큐 - TTS에서 낭독 안 함, 오디오로 처리)
  // -------------------------------------------------------------------------
  {
    id: 'lc_01',
    text: '(피식)',
    category: 'laugh_cue',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 4,
    minTurnGap: 3
  },
  {
    id: 'lc_02',
    text: '(웃음)',
    category: 'laugh_cue',
    intensity: 'medium',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 3,
    minTurnGap: 4
  },
  {
    id: 'lc_03',
    text: '(잠깐 웃음)',
    category: 'laugh_cue',
    intensity: 'weak',
    allowedSpeakers: ['HOST_A', 'HOST_B'],
    maxUsagePerEpisode: 3,
    minTurnGap: 3
  },
  {
    id: 'lc_04',
    text: '(웃참 실패)',
    category: 'laugh_cue',
    intensity: 'medium',
    allowedSpeakers: ['HOST_B'],
    maxUsagePerEpisode: 1,
    minTurnGap: 6
  }
]

// ============================================================================
// Strong Reactions - 조건부 허용 (에피소드당 0-2회)
// ============================================================================

export const STRONG_REACTIONS: StrongReaction[] = [
  {
    text: '우와 이건 진짜 미쳤네요~',
    requiresFollowUp: true,
    allowedSpeakers: ['HOST_B'],
    forbiddenBeforeSecond: 90
  },
  {
    text: '와… 이건 좀 충격인데요',
    requiresFollowUp: true,
    allowedSpeakers: ['HOST_B'],
    forbiddenBeforeSecond: 90
  },
  {
    text: '이거 진짜 판이 바뀌는 포인트예요',
    requiresFollowUp: true,
    allowedSpeakers: ['HOST_B'],
    forbiddenBeforeSecond: 90
  },
  {
    text: '대박인데요',
    requiresFollowUp: true,
    allowedSpeakers: ['HOST_B'],
    forbiddenBeforeSecond: 90
  },
  {
    text: '와 진짜요?',
    requiresFollowUp: true,
    allowedSpeakers: ['HOST_B'],
    forbiddenBeforeSecond: 60
  }
]

// ============================================================================
// Forbidden Slang List - 금지 밈/슬랭
// ============================================================================

export const FORBIDDEN_SLANG: string[] = [
  '레전드',
  '찢었다',
  '킹받네',
  '미친 텐션',
  '역대급',
  '개쩐다',
  'ㅋㅋㅋ',
  'ㅎㅎㅎ',
  '존맛',
  '핵꿀잼',
  '갓',
  '실화냐',
  '어쩔티비',
  '무야호',
  '오지고 지리고',
  '쌉가능',
  '존버',
  '갑분싸',
  '꿀잼',
  '노잼',
  '뇌절',
  '쩐다',
  '개꿀',
  '오지다',
  '찐이다'
]

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 카테고리별 감탄사 필터링
 */
export function getInterjectionsByCategory(category: InterjectionCategory): InterjectionEntry[] {
  return INTERJECTION_LIBRARY.filter(entry => entry.category === category)
}

/**
 * 스피커별 사용 가능한 감탄사
 */
export function getInterjectionsBySpeaker(speaker: 'HOST_A' | 'HOST_B' | 'GUEST'): InterjectionEntry[] {
  return INTERJECTION_LIBRARY.filter(entry => entry.allowedSpeakers.includes(speaker))
}

/**
 * 강도별 감탄사 필터링
 */
export function getInterjectionsByIntensity(intensity: 'weak' | 'medium' | 'strong'): InterjectionEntry[] {
  return INTERJECTION_LIBRARY.filter(entry => entry.intensity === intensity)
}

/**
 * 섹션에서 사용 가능한 감탄사 필터링
 */
export function getInterjectionsBySection(
  section: 'opening' | 'keypoint' | 'example' | 'closing'
): InterjectionEntry[] {
  return INTERJECTION_LIBRARY.filter(entry => {
    if (!entry.forbiddenSections) return true
    return !entry.forbiddenSections.includes(section as 'opening' | 'keypoint' | 'closing')
  })
}

/**
 * 강한 리액션 사용 가능 여부 체크
 */
export function canUseStrongReaction(
  elapsedSeconds: number,
  usedCount: number,
  maxAllowed: number = 2
): boolean {
  if (usedCount >= maxAllowed) return false
  // 90초 이전에는 강한 리액션 금지
  return elapsedSeconds >= 90
}

/**
 * 금지 슬랭 감지
 */
export function detectForbiddenSlang(text: string): string[] {
  return FORBIDDEN_SLANG.filter(slang => text.includes(slang))
}

/**
 * 랜덤 감탄사 선택 (규칙 준수)
 */
export function selectRandomInterjection(
  category: InterjectionCategory,
  speaker: 'HOST_A' | 'HOST_B' | 'GUEST',
  usageMap: Record<string, number>,
  lastUsedTurnIndex: number,
  currentTurnIndex: number,
  section?: 'opening' | 'keypoint' | 'example' | 'closing'
): InterjectionEntry | null {
  const candidates = INTERJECTION_LIBRARY.filter(entry => {
    // 카테고리 체크
    if (entry.category !== category) return false

    // 스피커 체크
    if (!entry.allowedSpeakers.includes(speaker)) return false

    // 사용 횟수 체크
    const used = usageMap[entry.id] || 0
    if (used >= entry.maxUsagePerEpisode) return false

    // 턴 간격 체크
    if (currentTurnIndex - lastUsedTurnIndex < entry.minTurnGap) return false

    // 섹션 제한 체크
    if (section && entry.forbiddenSections?.includes(section as 'opening' | 'keypoint' | 'closing')) {
      return false
    }

    return true
  })

  if (candidates.length === 0) return null

  // 랜덤 선택
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export default {
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
}
