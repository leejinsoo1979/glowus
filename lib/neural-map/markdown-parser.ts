/**
 * Markdown [[wikilink]] Parser
 * Obsidian 스타일 위키링크 파싱
 */

// [[링크]] 또는 [[링크|표시텍스트]] 패턴 추출
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g

export interface ParsedLink {
  raw: string        // [[링크]] 전체 문자열
  target: string     // 링크 대상 (파일명 또는 노드 제목)
  alias?: string     // 표시 텍스트 (있는 경우)
}

/**
 * 마크다운 콘텐츠에서 [[위키링크]]를 파싱
 */
export function parseWikiLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = []
  const matches = content.matchAll(WIKILINK_REGEX)

  for (const match of matches) {
    const raw = match[0]
    const inner = match[1]

    // [[링크|별칭]] 형식 처리
    const pipeIndex = inner.indexOf('|')
    if (pipeIndex > -1) {
      links.push({
        raw,
        target: inner.substring(0, pipeIndex).trim(),
        alias: inner.substring(pipeIndex + 1).trim(),
      })
    } else {
      links.push({
        raw,
        target: inner.trim(),
      })
    }
  }

  // 중복 제거
  const uniqueTargets = new Set<string>()
  return links.filter(link => {
    if (uniqueTargets.has(link.target)) {
      return false
    }
    uniqueTargets.add(link.target)
    return true
  })
}

/**
 * 파일 내용에서 링크 대상 추출 (제목만)
 */
export function extractLinkTargets(content: string): string[] {
  const links = parseWikiLinks(content)
  return links.map(l => l.target)
}

/**
 * 마크다운 파일에서 제목 추출 (# 헤딩 또는 파일명)
 */
export function extractTitle(content: string, fallbackName: string): string {
  // 첫 번째 # 헤딩 찾기
  const headingMatch = content.match(/^#\s+(.+)$/m)
  if (headingMatch) {
    return headingMatch[1].trim()
  }

  // 없으면 파일명에서 확장자 제거
  return fallbackName.replace(/\.(md|markdown)$/i, '')
}
