/**
 * Markdown Parser
 * Obsidian 스타일 위키링크 & #태그 파싱
 */

// [[링크]] 또는 [[링크|표시텍스트]] 패턴 추출
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g

// #태그 패턴 (한글, 영문, 숫자, 언더스코어, 하이픈 지원)
// 코드블록이나 헤딩 안의 #은 제외
const TAG_REGEX = /(?:^|\s)#([a-zA-Z가-힣0-9_-]+)/g

export interface ParsedLink {
  raw: string        // [[링크]] 전체 문자열
  target: string     // 링크 대상 (파일명 또는 노드 제목)
  alias?: string     // 표시 텍스트 (있는 경우)
}

export interface ParsedTag {
  raw: string        // #태그 전체 문자열
  tag: string        // 태그명 (# 제외)
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

/**
 * 마크다운 콘텐츠에서 #태그를 파싱
 */
export function parseTags(content: string): ParsedTag[] {
  const tags: ParsedTag[] = []

  // 코드블록 제거 (```...``` 또는 `...`)
  const withoutCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')

  const matches = withoutCode.matchAll(TAG_REGEX)

  for (const match of matches) {
    tags.push({
      raw: match[0].trim(),
      tag: match[1],
    })
  }

  // 중복 제거
  const uniqueTags = new Set<string>()
  return tags.filter(t => {
    if (uniqueTags.has(t.tag)) {
      return false
    }
    uniqueTags.add(t.tag)
    return true
  })
}

/**
 * 태그명만 추출
 */
export function extractTags(content: string): string[] {
  const tags = parseTags(content)
  return tags.map(t => t.tag)
}

/**
 * YAML Frontmatter 파싱
 */
export interface Frontmatter {
  title?: string
  tags?: string[]
  date?: string
  [key: string]: any
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter | null; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: null, body: content }
  }

  const yamlContent = match[1]
  const body = content.slice(match[0].length)

  // 간단한 YAML 파싱 (key: value 형식만)
  const frontmatter: Frontmatter = {}
  const lines = yamlContent.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > -1) {
      const key = line.slice(0, colonIndex).trim()
      let value = line.slice(colonIndex + 1).trim()

      // 배열 처리 [tag1, tag2]
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/['"]/g, ''))
      } else {
        // 따옴표 제거
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '')
      }
    }
  }

  return { frontmatter, body }
}

/**
 * Daily Note 파일명 생성
 */
export function getDailyNoteFileName(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.md`
}

/**
 * Daily Note 기본 템플릿
 */
export function getDailyNoteTemplate(date: Date = new Date()): string {
  const dateStr = date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return `---
date: ${date.toISOString().split('T')[0]}
tags: [daily]
---

# ${dateStr}

## 📝 오늘의 할 일
- [ ]

## 💡 아이디어
-

## 📖 메모
-

## 🔗 관련 노트
-
`
}

/**
 * 노트 템플릿 목록
 */
export interface NoteTemplate {
  id: string
  name: string
  icon: string
  content: string
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: '빈 노트',
    icon: '📄',
    content: '',
  },
  {
    id: 'daily',
    name: 'Daily Note',
    icon: '📅',
    content: getDailyNoteTemplate(),
  },
  {
    id: 'meeting',
    name: '회의록',
    icon: '🤝',
    content: `---
tags: [meeting]
---

# 회의록

## 📋 기본 정보
- **일시**: ${new Date().toLocaleDateString('ko-KR')}
- **참석자**:
- **장소**:

## 📌 안건
1.

## 💬 논의 내용


## ✅ 결정 사항
- [ ]

## 📎 다음 단계
-
`,
  },
  {
    id: 'project',
    name: '프로젝트',
    icon: '🚀',
    content: `---
tags: [project]
---

# 프로젝트명

## 🎯 목표


## 📋 할 일
- [ ]
- [ ]
- [ ]

## 📝 진행 상황


## 🔗 관련 노트
- [[]]
`,
  },
  {
    id: 'idea',
    name: '아이디어',
    icon: '💡',
    content: `---
tags: [idea]
---

# 아이디어 제목

## 💭 핵심 아이디어


## 🤔 왜 이게 중요한가?


## 📝 세부 사항


## 🔗 관련 자료
-
`,
  },
  {
    id: 'zettel',
    name: 'Zettelkasten',
    icon: '🗃️',
    content: `---
tags: []
---

#

<!-- 하나의 아이디어만 작성하세요 -->



---
## 🔗 연결
- [[]]

## 📚 출처
-
`,
  },
]

/**
 * 백링크 찾기 - 특정 노트를 참조하는 다른 노트들
 */
export function findBacklinks(
  targetTitle: string,
  allFiles: Array<{ name: string; content?: string }>
): string[] {
  const backlinks: string[] = []
  const targetLower = targetTitle.toLowerCase().replace(/\.md$/i, '')

  for (const file of allFiles) {
    if (!file.content) continue

    const links = parseWikiLinks(file.content)
    const hasLink = links.some(
      link => link.target.toLowerCase() === targetLower
    )

    if (hasLink) {
      backlinks.push(file.name)
    }
  }

  return backlinks
}
