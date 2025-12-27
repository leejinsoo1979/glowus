// Properties 타입 정의

export type PropertyType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'tags'
  | 'list'
  | 'link'
  | 'select'

export interface Property {
  key: string
  value: unknown
  type: PropertyType
}

export interface PropertySchema {
  key: string
  type: PropertyType
  options?: string[] // select 타입용 옵션
  defaultValue?: unknown
}

// AI 분석 결과
export interface PropertyAnalysis {
  key: string
  value: unknown
  type: PropertyType
  confidence: number // 0-1 신뢰도
  reason: string // 분석 근거
}

// Neural Map 연동용
export interface PropertyRelation {
  sourceId: string // 현재 문서 ID
  targetId: string // 연결된 문서 ID
  relationType: 'depends_on' | 'related' | 'parent' | 'child'
  weight: number // 가중치 0-1
}

// Agent 메모리용
export interface AgentMemoryEntry {
  id: string
  agentId: string
  type: 'conversation' | 'task' | 'execution' | 'meeting' | 'learning'
  content: string
  properties: Record<string, unknown>
  relations: PropertyRelation[]
  timestamp: Date
}

// 전역 Properties 통계
export interface PropertySummary {
  key: string
  values: string[]
  count: number
  documents: string[] // 이 키를 가진 문서 ID 목록
}

// 타입 감지 유틸리티
export function detectPropertyType(value: unknown): PropertyType {
  if (value === null || value === undefined) return 'text'
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) {
    // [[링크]] 형태 체크
    if (value.some(v => typeof v === 'string' && v.startsWith('[['))) {
      return 'link'
    }
    return 'tags'
  }
  if (typeof value === 'string') {
    // 날짜 형식 체크
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date'
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime'
    // [[링크]] 형태 체크
    if (value.startsWith('[[') && value.endsWith(']]')) return 'link'
  }
  return 'text'
}

// 타입별 기본값
export function getDefaultValue(type: PropertyType): unknown {
  switch (type) {
    case 'text': return ''
    case 'number': return 0
    case 'checkbox': return false
    case 'date': return new Date().toISOString().split('T')[0]
    case 'datetime': return new Date().toISOString().slice(0, 16)
    case 'tags': return []
    case 'list': return []
    case 'link': return '[[]]'  // 빈 링크 마커 - detectPropertyType이 감지
    case 'select': return ''
    default: return ''
  }
}

// 타입 라벨
export const propertyTypeLabels: Record<PropertyType, string> = {
  text: 'Text',
  number: 'Number',
  checkbox: 'Checkbox',
  date: 'Date',
  datetime: 'Date & time',
  tags: 'Tags',
  list: 'List',
  link: 'Link',
  select: 'Select'
}
