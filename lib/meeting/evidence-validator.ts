/**
 * Evidence Validator - Session Room v2
 *
 * 에이전트가 공유 자료를 "봤다/확인했다"고 주장할 때
 * 반드시 Evidence 태그가 포함되어 있는지 검증합니다.
 *
 * Evidence 형식:
 * - [Evidence: 문서명 p.N "인용문"]
 * - [Evidence: 문서명 p.N region(x,y,w,h)]
 * - [Evidence: 문서명 HH:MM:SS]
 */

export interface ValidationResult {
  valid: boolean
  reason?: string
  action?: 'regenerate' | 'warn' | 'pass'
  claimsFound?: string[]
  evidenceFound?: string[]
}

export interface SharedContentInfo {
  mediaType: 'pdf' | 'image' | 'video' | null
  mediaName?: string
  currentPage?: number
  playbackTime?: number
  // Selection 지원 (v2)
  selection?: {
    type: 'text' | 'region'
    text?: string
    region?: { x: number; y: number; width: number; height: number }
    page?: number
  } | null
  annotations?: Array<{
    type: 'highlight' | 'note' | 'pointer' | 'drawing'
    page?: number
    text?: string
    region?: { x: number; y: number; width: number; height: number }
  }>
  highlightRegions?: Array<{
    page?: number
    region: { x: number; y: number; width: number; height: number }
    label?: string
  }>
}

// "봤다/확인했다" 등의 표현 패턴 (한국어)
const CLAIM_PATTERNS = [
  /봤/g,
  /확인했/g,
  /읽었/g,
  /보니/g,
  /살펴보/g,
  /검토/g,
  /분석해\s*보/g,
  /살펴본/g,
  /확인해\s*보/g,
  /보면/g,
  /보시면/g,
  /나와\s*있/g,
  /나타나/g,
  /표시되/g,
  /기재되/g,
  /명시되/g,
  /적혀\s*있/g,
]

// Evidence 태그 패턴
const EVIDENCE_PATTERN = /\[Evidence:\s*([^\]]+)\]/gi
const EVIDENCE_ALT_PATTERNS = [
  /\[근거:\s*([^\]]+)\]/gi,
  /\(출처:\s*([^)]+)\)/gi,
  /\(p\.\s*\d+\)/gi,
  /\(페이지\s*\d+\)/gi,
  /페이지\s*\d+에서?/gi,
  /p\.\s*\d+/gi,
]

/**
 * 에이전트 응답에서 Evidence 검증
 */
export function validateEvidence(
  response: string,
  sharedContent: SharedContentInfo | null
): ValidationResult {
  // 공유 자료가 없으면 검증 불필요
  if (!sharedContent || !sharedContent.mediaType) {
    return { valid: true, action: 'pass' }
  }

  // 1. "봤다/확인했다" 표현 검출
  const claimsFound: string[] = []
  for (const pattern of CLAIM_PATTERNS) {
    const matches = response.match(pattern)
    if (matches) {
      claimsFound.push(...matches)
    }
  }

  const hasClaims = claimsFound.length > 0

  // 2. Evidence 태그 검출
  const evidenceMatches = Array.from(response.matchAll(EVIDENCE_PATTERN))
  const evidenceFound: string[] = evidenceMatches.map(m => m[1])

  // 대체 패턴도 검사 (유연하게)
  let hasAltEvidence = false
  for (const pattern of EVIDENCE_ALT_PATTERNS) {
    if (pattern.test(response)) {
      hasAltEvidence = true
      break
    }
  }

  // 3. 검증 로직
  if (hasClaims && evidenceFound.length === 0 && !hasAltEvidence) {
    return {
      valid: false,
      reason: '근거 없이 "봤다/확인했다" 표현 사용',
      action: 'regenerate',
      claimsFound,
      evidenceFound,
    }
  }

  // Evidence가 있지만 공유 자료와 매칭되지 않는 경우 경고
  if (evidenceFound.length > 0 && sharedContent.mediaName) {
    const hasMatchingEvidence = evidenceFound.some(ev =>
      ev.toLowerCase().includes(sharedContent.mediaName!.toLowerCase().split('.')[0])
    )
    if (!hasMatchingEvidence) {
      return {
        valid: true,
        reason: 'Evidence가 현재 공유 자료와 일치하지 않을 수 있음',
        action: 'warn',
        claimsFound,
        evidenceFound,
      }
    }
  }

  return {
    valid: true,
    action: 'pass',
    claimsFound,
    evidenceFound,
  }
}

/**
 * 재생성 프롬프트 생성
 */
export function getRegenerationPrompt(
  validationResult: ValidationResult,
  sharedContent: SharedContentInfo
): string {
  let evidenceFormat = '[Evidence: 문서명]'

  if (sharedContent.mediaType === 'pdf') {
    evidenceFormat = `[Evidence: ${sharedContent.mediaName || '문서명'} p.${sharedContent.currentPage || 'N'} "인용문"]`
  } else if (sharedContent.mediaType === 'image') {
    evidenceFormat = `[Evidence: ${sharedContent.mediaName || '이미지명'}]`
  } else if (sharedContent.mediaType === 'video') {
    const time = sharedContent.playbackTime || 0
    const formatted = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
    evidenceFormat = `[Evidence: ${sharedContent.mediaName || '영상명'} ${formatted}]`
  }

  return `⚠️ 이전 답변이 거부되었습니다.
이유: ${validationResult.reason}

규칙:
- 자료를 언급할 때는 반드시 ${evidenceFormat} 형식으로 근거를 포함하세요
- 근거가 없으면 "해당 자료를 확인해야 합니다" 또는 "p.N을 봐주세요"라고 말하세요
- 추측이나 가정은 명시적으로 "~로 보입니다", "~일 것 같습니다"로 표현하세요

다시 답변해주세요. 반드시 Evidence 태그를 포함하세요.`
}

/**
 * 응답에서 Evidence 태그 추출 및 파싱
 */
export interface ParsedEvidence {
  raw: string
  docName: string
  page?: number
  timestamp?: number
  quote?: string
  region?: { x: number; y: number; w: number; h: number }
}

export function parseEvidenceTags(response: string): ParsedEvidence[] {
  const evidences: ParsedEvidence[] = []
  const matches = Array.from(response.matchAll(EVIDENCE_PATTERN))

  for (const match of matches) {
    const raw = match[0]
    const content = match[1]

    const evidence: ParsedEvidence = {
      raw,
      docName: content,
    }

    // 페이지 추출: "문서명 p.3" 또는 "문서명 p.3 "인용""
    const pageMatch = content.match(/(.+?)\s+p\.(\d+)(?:\s+"([^"]+)")?/)
    if (pageMatch) {
      evidence.docName = pageMatch[1].trim()
      evidence.page = parseInt(pageMatch[2])
      if (pageMatch[3]) {
        evidence.quote = pageMatch[3]
      }
    }

    // 타임스탬프 추출: "영상명 1:23" 또는 "영상명 01:23:45"
    const timeMatch = content.match(/(.+?)\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (timeMatch) {
      evidence.docName = timeMatch[1].trim()
      const hours = timeMatch[4] ? parseInt(timeMatch[2]) : 0
      const minutes = timeMatch[4] ? parseInt(timeMatch[3]) : parseInt(timeMatch[2])
      const seconds = timeMatch[4] ? parseInt(timeMatch[4]) : parseInt(timeMatch[3])
      evidence.timestamp = hours * 3600 + minutes * 60 + seconds
    }

    // region 추출: "문서명 p.N region(x,y,w,h)"
    const regionMatch = content.match(/region\((\d+),(\d+),(\d+),(\d+)\)/)
    if (regionMatch) {
      evidence.region = {
        x: parseInt(regionMatch[1]),
        y: parseInt(regionMatch[2]),
        w: parseInt(regionMatch[3]),
        h: parseInt(regionMatch[4]),
      }
    }

    evidences.push(evidence)
  }

  return evidences
}

/**
 * Evidence 태그를 클릭 가능한 형식으로 변환 (UI용)
 */
export function formatEvidenceForDisplay(evidence: ParsedEvidence): {
  display: string
  jumpTo: { docName: string; page?: number; timestamp?: number; region?: any }
} {
  let display = evidence.docName

  if (evidence.page) {
    display += ` p.${evidence.page}`
    if (evidence.quote) {
      display += ` "${evidence.quote.slice(0, 30)}${evidence.quote.length > 30 ? '...' : ''}"`
    }
  }

  if (evidence.timestamp !== undefined) {
    const mins = Math.floor(evidence.timestamp / 60)
    const secs = evidence.timestamp % 60
    display += ` ${mins}:${String(secs).padStart(2, '0')}`
  }

  return {
    display,
    jumpTo: {
      docName: evidence.docName,
      page: evidence.page,
      timestamp: evidence.timestamp,
      region: evidence.region,
    },
  }
}
