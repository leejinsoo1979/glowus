/**
 * Conversation-to-Task Parser
 * 대화 내용에서 Task를 자동 추출하는 유틸리티
 */

import type {
  TaskPriority,
  TaskStatus,
  CreateTaskRequest,
} from '@/types/task-hub'

// ============================================
// 타입 정의
// ============================================
export interface ParsedTask {
  title: string
  description?: string
  priority: TaskPriority
  due_date?: string
  assignee_hint?: string  // "@홍길동" 또는 "@agent-jarvis"
  assignee_type?: 'USER' | 'AGENT'
  tags: string[]
  confidence: number  // 0-1, 추출 신뢰도
}

export interface ConversationContext {
  speaker?: string
  timestamp?: string
  project_id?: string
  agent_id?: string
}

// ============================================
// 우선순위 키워드 매핑
// ============================================
const PRIORITY_KEYWORDS: Record<string, TaskPriority> = {
  // URGENT
  '급해': 'URGENT',
  '긴급': 'URGENT',
  '지금 당장': 'URGENT',
  '즉시': 'URGENT',
  'urgent': 'URGENT',
  'asap': 'URGENT',
  '빨리': 'URGENT',
  '시급': 'URGENT',

  // HIGH
  '중요': 'HIGH',
  '높은': 'HIGH',
  '우선': 'HIGH',
  'high': 'HIGH',
  'important': 'HIGH',
  '꼭': 'HIGH',

  // MEDIUM
  '보통': 'MEDIUM',
  'medium': 'MEDIUM',
  'normal': 'MEDIUM',

  // LOW
  '낮은': 'LOW',
  '나중에': 'LOW',
  '천천히': 'LOW',
  'low': 'LOW',
  '여유있게': 'LOW',
}

// ============================================
// Task 동사 패턴 (한국어 + 영어)
// ============================================
const TASK_VERB_PATTERNS = [
  // 한국어 명령형
  /(.+)(해\s*줘|해\s*주세요|해\s*줄래|하세요|해라|합시다|하자)/,
  /(.+)(만들어\s*줘|만들어\s*주세요|작성해\s*줘|작성해\s*주세요)/,
  /(.+)(확인해\s*줘|확인해\s*주세요|체크해\s*줘|검토해\s*줘)/,
  /(.+)(수정해\s*줘|수정해\s*주세요|고쳐\s*줘|변경해\s*줘)/,
  /(.+)(분석해\s*줘|분석해\s*주세요|조사해\s*줘|알아봐\s*줘)/,
  /(.+)(보내\s*줘|보내\s*주세요|전송해\s*줘|공유해\s*줘)/,
  /(.+)(정리해\s*줘|정리해\s*주세요|요약해\s*줘)/,

  // 영어 패턴
  /(?:please\s+)?(.+?)(?:\s+please)?$/i,
  /(?:can you|could you|would you)\s+(.+)/i,
  /(?:i need you to|i want you to)\s+(.+)/i,
]

// ============================================
// 마감일 패턴
// ============================================
const DUE_DATE_PATTERNS: Array<{ pattern: RegExp; getDays: (match?: RegExpMatchArray | null) => number }> = [
  { pattern: /오늘|today/i, getDays: () => 0 },
  { pattern: /내일|tomorrow/i, getDays: () => 1 },
  { pattern: /모레|day after tomorrow/i, getDays: () => 2 },
  { pattern: /이번\s*주|this week/i, getDays: () => 7 - new Date().getDay() },
  { pattern: /다음\s*주|next week/i, getDays: () => 7 + (7 - new Date().getDay()) },
  { pattern: /(\d+)\s*일\s*(?:안에|이내|내로)/i, getDays: (match) => match ? parseInt(match[1]) : 0 },
  { pattern: /(\d+)\s*(?:시간|hours?)/i, getDays: () => 0 },  // 같은 날
]

// ============================================
// 담당자 추출 패턴
// ============================================
const ASSIGNEE_PATTERN = /@([\w가-힣-]+)/g

// ============================================
// 태그 추출 패턴
// ============================================
const TAG_PATTERN = /#([\w가-힣]+)/g

// ============================================
// 메인 파서 함수
// ============================================
export function parseTaskFromMessage(
  message: string,
  context?: ConversationContext
): ParsedTask | null {
  if (!message || message.trim().length < 3) {
    return null
  }

  const normalizedMessage = message.trim()
  let confidence = 0

  // 1. Task 동사 패턴 확인
  let extractedTitle = ''
  for (const pattern of TASK_VERB_PATTERNS) {
    const match = normalizedMessage.match(pattern)
    if (match) {
      extractedTitle = match[1]?.trim() || normalizedMessage
      confidence += 0.3
      break
    }
  }

  if (!extractedTitle) {
    // 패턴 매칭 실패 시 전체 메시지 사용
    extractedTitle = normalizedMessage
    confidence += 0.1
  }

  // 2. 우선순위 추출
  let priority: TaskPriority = 'MEDIUM'
  for (const [keyword, p] of Object.entries(PRIORITY_KEYWORDS)) {
    if (normalizedMessage.toLowerCase().includes(keyword.toLowerCase())) {
      priority = p
      confidence += 0.1
      break
    }
  }

  // 3. 마감일 추출
  let due_date: string | undefined
  for (const { pattern, getDays } of DUE_DATE_PATTERNS) {
    const match = normalizedMessage.match(pattern)
    if (match) {
      const days = getDays(match as any)
      const date = new Date()
      date.setDate(date.getDate() + days)
      due_date = date.toISOString().split('T')[0]
      confidence += 0.15
      break
    }
  }

  // 4. 담당자 추출
  let assignee_hint: string | undefined
  let assignee_type: 'USER' | 'AGENT' | undefined
  const assigneeMatch = normalizedMessage.match(ASSIGNEE_PATTERN)
  if (assigneeMatch && assigneeMatch.length > 0) {
    const assignee = assigneeMatch[0].substring(1)  // @ 제거
    assignee_hint = assignee

    // agent- 접두사로 Agent 구분
    if (assignee.toLowerCase().startsWith('agent-') || assignee.toLowerCase().startsWith('에이전트-')) {
      assignee_type = 'AGENT'
    } else {
      assignee_type = 'USER'
    }
    confidence += 0.1
  }

  // 5. 태그 추출
  const tags: string[] = []
  const tagMatches = normalizedMessage.matchAll(TAG_PATTERN)
  for (const match of tagMatches) {
    tags.push(match[1])
  }
  if (tags.length > 0) {
    confidence += 0.05
  }

  // 6. 제목에서 메타 정보 제거
  let cleanTitle = extractedTitle
    .replace(ASSIGNEE_PATTERN, '')
    .replace(TAG_PATTERN, '')
    .replace(/오늘|내일|모레|이번\s*주|다음\s*주/g, '')
    .replace(/급해|긴급|중요|urgent|asap/gi, '')
    .trim()

  // 제목이 너무 짧으면 원본 사용
  if (cleanTitle.length < 3) {
    cleanTitle = extractedTitle
  }

  // 신뢰도가 너무 낮으면 null 반환
  if (confidence < 0.2) {
    return null
  }

  return {
    title: cleanTitle,
    priority,
    due_date,
    assignee_hint,
    assignee_type,
    tags,
    confidence: Math.min(confidence, 1),
  }
}

// ============================================
// 여러 메시지에서 Task 추출
// ============================================
export function parseTasksFromConversation(
  messages: Array<{ content: string; role: string }>,
  context?: ConversationContext
): ParsedTask[] {
  const tasks: ParsedTask[] = []

  for (const message of messages) {
    // 사용자 메시지에서만 Task 추출 (Agent 응답은 제외)
    if (message.role === 'user' || message.role === 'human') {
      const parsed = parseTaskFromMessage(message.content, context)
      if (parsed && parsed.confidence >= 0.3) {
        tasks.push(parsed)
      }
    }
  }

  // 중복 제거 (제목 유사도 기반)
  const uniqueTasks = tasks.reduce((acc, task) => {
    const isDuplicate = acc.some(t =>
      calculateSimilarity(t.title, task.title) > 0.7
    )
    if (!isDuplicate) {
      acc.push(task)
    }
    return acc
  }, [] as ParsedTask[])

  return uniqueTasks
}

// ============================================
// 문자열 유사도 계산 (Levenshtein 기반)
// ============================================
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1.0

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2[i - 1] === str1[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

// ============================================
// ParsedTask를 CreateTaskRequest로 변환
// ============================================
export function convertToTaskRequest(
  parsed: ParsedTask,
  options: {
    company_id?: string
    project_id?: string
    created_by: string
    created_by_type: 'USER' | 'AGENT'
    source_id?: string
  }
): CreateTaskRequest {
  return {
    title: parsed.title,
    description: parsed.description,
    status: 'TODO',
    priority: parsed.priority,
    type: 'AGENT',
    company_id: options.company_id,
    project_id: options.project_id,
    due_date: parsed.due_date,
    tags: parsed.tags,
    source: 'CONVERSATION',
    source_id: options.source_id,
    metadata: {
      parsed_confidence: parsed.confidence,
      assignee_hint: parsed.assignee_hint,
      created_by_type: options.created_by_type,
    },
  }
}

// ============================================
// Quick Add 파서 (간단한 형식)
// ============================================
export function parseQuickAdd(input: string): ParsedTask | null {
  if (!input || input.trim().length < 2) {
    return null
  }

  const normalizedInput = input.trim()
  let title = normalizedInput
  let priority: TaskPriority = 'NONE'
  let due_date: string | undefined
  let assignee_hint: string | undefined
  let assignee_type: 'USER' | 'AGENT' | undefined
  const tags: string[] = []

  // #urgent, #high 등 우선순위 태그
  const priorityTagMatch = normalizedInput.match(/#(urgent|high|medium|low|긴급|중요|보통|낮음)/i)
  if (priorityTagMatch) {
    const tag = priorityTagMatch[1].toLowerCase()
    if (tag === 'urgent' || tag === '긴급') priority = 'URGENT'
    else if (tag === 'high' || tag === '중요') priority = 'HIGH'
    else if (tag === 'medium' || tag === '보통') priority = 'MEDIUM'
    else if (tag === 'low' || tag === '낮음') priority = 'LOW'
    title = title.replace(priorityTagMatch[0], '').trim()
  }

  // 날짜 추출
  for (const { pattern, getDays } of DUE_DATE_PATTERNS) {
    const match = normalizedInput.match(pattern)
    if (match) {
      const days = getDays(match as any)
      const date = new Date()
      date.setDate(date.getDate() + days)
      due_date = date.toISOString().split('T')[0]
      title = title.replace(match[0], '').trim()
      break
    }
  }

  // 담당자 추출
  const assigneeMatch = normalizedInput.match(/@([\w가-힣-]+)/)
  if (assigneeMatch) {
    assignee_hint = assigneeMatch[1]
    assignee_type = assignee_hint.toLowerCase().startsWith('agent-') ? 'AGENT' : 'USER'
    title = title.replace(assigneeMatch[0], '').trim()
  }

  // 일반 태그 추출
  const tagMatches = title.matchAll(/#([\w가-힣]+)/g)
  for (const match of tagMatches) {
    if (!['urgent', 'high', 'medium', 'low', '긴급', '중요', '보통', '낮음'].includes(match[1].toLowerCase())) {
      tags.push(match[1])
    }
    title = title.replace(match[0], '').trim()
  }

  // 빈 제목 체크
  if (!title || title.length < 2) {
    return null
  }

  return {
    title,
    priority,
    due_date,
    assignee_hint,
    assignee_type,
    tags,
    confidence: 0.9,  // Quick Add는 명시적이므로 높은 신뢰도
  }
}
