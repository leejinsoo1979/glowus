/**
 * Context Pack - AI가 실제로 자료를 "보는" 컨텍스트 주입 시스템
 *
 * 에이전트 호출 시 현재 뷰어의 포커스 상태를 기반으로
 * 이미지/텍스트 컨텍스트를 함께 전달합니다.
 */

import type { Artifact, ViewerFocus } from '@/components/session-room/ViewerPanel'
import type { Evidence } from '@/components/session-room/ChatPanel/EvidenceTag'

export interface ContextPack {
  // 현재 활성 아티팩트 정보
  artifact: {
    id: string
    type: 'pdf' | 'image' | 'video'
    name: string
    url: string
  } | null

  // 포커스 위치
  focus: {
    page?: number
    region?: { x: number; y: number; w: number; h: number }
    timestamp?: number
  } | null

  // 이미지 데이터 (base64 또는 URL)
  images: {
    current: string | null      // 현재 페이지/프레임
    context?: string[]          // 주변 페이지/프레임 (선택)
  }

  // 텍스트 데이터 (PDF 추출)
  text: {
    current: string | null      // 현재 페이지 텍스트
    context?: string[]          // 주변 페이지 텍스트
  }

  // 메타데이터
  meta: {
    totalPages?: number
    duration?: number           // 비디오 길이 (초)
    extractedAt: string
  }
}

/**
 * 현재 세션 상태에서 Context Pack 생성
 */
export async function buildContextPack(
  artifacts: Artifact[],
  focus: ViewerFocus | null,
  options: {
    includeContextPages?: boolean  // 주변 페이지 포함 여부
    contextPageCount?: number      // 주변 페이지 수 (기본 1)
    extractText?: boolean          // 텍스트 추출 여부
  } = {}
): Promise<ContextPack> {
  const {
    includeContextPages = false,
    contextPageCount = 1,
    extractText = true
  } = options

  // 기본 빈 컨텍스트
  const pack: ContextPack = {
    artifact: null,
    focus: null,
    images: { current: null },
    text: { current: null },
    meta: { extractedAt: new Date().toISOString() }
  }

  if (!focus) return pack

  // 현재 포커스된 아티팩트 찾기
  const artifact = artifacts.find(a => a.id === focus.artifactId)
  if (!artifact) return pack

  pack.artifact = {
    id: artifact.id,
    type: artifact.type,
    name: artifact.name,
    url: artifact.url
  }

  pack.focus = {
    page: focus.page,
    region: focus.region,
    timestamp: focus.timestamp
  }

  // 타입별 처리
  if (artifact.type === 'pdf') {
    // PDF: 현재 페이지 이미지 캡처
    pack.images.current = artifact.url // 실제로는 페이지 이미지 URL
    pack.meta.totalPages = undefined // TODO: PDF에서 추출

    if (extractText) {
      // TODO: PDF 텍스트 추출 API 호출
      pack.text.current = `[PDF Page ${focus.page || 1} content]`
    }
  } else if (artifact.type === 'image') {
    pack.images.current = artifact.url
  } else if (artifact.type === 'video') {
    // 비디오: 현재 타임스탬프 프레임
    pack.images.current = artifact.url // 실제로는 프레임 캡처 URL
    pack.meta.duration = undefined // TODO: 비디오에서 추출
  }

  return pack
}

/**
 * Context Pack을 프롬프트에 주입
 */
export function injectContextToPrompt(
  basePrompt: string,
  pack: ContextPack,
  mode: 'meeting' | 'presentation' | 'debate' | 'free'
): string {
  const contextLines: string[] = []

  // 아티팩트 정보 추가
  if (pack.artifact) {
    contextLines.push(`## 현재 자료`)
    contextLines.push(`- 파일: ${pack.artifact.name}`)
    contextLines.push(`- 유형: ${pack.artifact.type}`)

    if (pack.focus?.page) {
      contextLines.push(`- 현재 페이지: ${pack.focus.page}${pack.meta.totalPages ? ` / ${pack.meta.totalPages}` : ''}`)
    }

    if (pack.focus?.timestamp !== undefined) {
      const mins = Math.floor(pack.focus.timestamp / 60)
      const secs = Math.floor(pack.focus.timestamp % 60)
      contextLines.push(`- 현재 타임스탬프: ${mins}:${secs.toString().padStart(2, '0')}`)
    }

    if (pack.focus?.region) {
      contextLines.push(`- 선택 영역: (${Math.round(pack.focus.region.x * 100)}%, ${Math.round(pack.focus.region.y * 100)}%)`)
    }
  }

  // 텍스트 컨텐츠 추가
  if (pack.text.current) {
    contextLines.push(`\n## 현재 페이지 내용`)
    contextLines.push(pack.text.current)
  }

  // 모드별 지시사항
  contextLines.push(`\n## 응답 규칙`)
  contextLines.push(`- 자료를 근거로 답변하세요`)
  contextLines.push(`- 근거 없이 "확인했다", "봤다"라고 말하지 마세요`)
  contextLines.push(`- 근거를 명시할 때는 [Evidence: 파일명 p.페이지] 또는 [Evidence: 파일명 MM:SS] 형식을 사용하세요`)

  if (mode === 'debate') {
    contextLines.push(`- 주장에는 반드시 근거를 포함하세요`)
    contextLines.push(`- 상대 주장의 약점을 근거 기반으로 지적하세요`)
  } else if (mode === 'presentation') {
    contextLines.push(`- 발표 내용을 요약하고 핵심을 추출하세요`)
    contextLines.push(`- 질문 시 페이지/시점을 명시하세요`)
  } else if (mode === 'meeting') {
    contextLines.push(`- 의사결정에 필요한 근거를 제시하세요`)
    contextLines.push(`- 리스크나 우려사항도 근거 기반으로 제시하세요`)
  }

  return `${basePrompt}\n\n${contextLines.join('\n')}`
}

/**
 * 에이전트 응답에서 Evidence 태그 추출
 */
export function extractEvidenceFromResponse(
  content: string,
  artifacts: Artifact[]
): Evidence[] {
  const evidences: Evidence[] = []

  // [Evidence: docName p.X] 또는 [Evidence: docName p.X region(x,y,w,h)]
  const pdfPattern = /\[Evidence:\s*([^\]]+?)\s+p\.(\d+)(?:\s+region\(([0-9.,]+)\))?\]/gi

  // [Evidence: videoName MM:SS] 또는 [Evidence: videoName HH:MM:SS]
  const videoPattern = /\[Evidence:\s*([^\]]+?)\s+(\d+):(\d+)(?::(\d+))?\]/gi

  // [Evidence: imageName region(x,y,w,h)]
  const imagePattern = /\[Evidence:\s*([^\]]+?)\s+region\(([0-9.,]+)\)\]/gi

  // PDF 패턴 매칭
  let match
  while ((match = pdfPattern.exec(content)) !== null) {
    const [, name, page, regionStr] = match

    // 아티팩트 찾기
    const artifact = artifacts.find(a =>
      a.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(a.name.toLowerCase())
    )

    const evidence: Evidence = {
      type: 'pdf',
      artifactId: artifact?.id || name.toLowerCase().replace(/\s+/g, '-'),
      artifactName: artifact?.name || name,
      page: parseInt(page)
    }

    if (regionStr) {
      const [x, y, w, h] = regionStr.split(',').map(Number)
      evidence.region = { x, y, w, h }
    }

    evidences.push(evidence)
  }

  // 비디오 패턴 매칭
  while ((match = videoPattern.exec(content)) !== null) {
    const [, name, part1, part2, part3] = match

    let timestamp: number
    if (part3) {
      // HH:MM:SS
      timestamp = parseInt(part1) * 3600 + parseInt(part2) * 60 + parseInt(part3)
    } else {
      // MM:SS
      timestamp = parseInt(part1) * 60 + parseInt(part2)
    }

    const artifact = artifacts.find(a =>
      a.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(a.name.toLowerCase())
    )

    evidences.push({
      type: 'video',
      artifactId: artifact?.id || name.toLowerCase().replace(/\s+/g, '-'),
      artifactName: artifact?.name || name,
      timestamp
    })
  }

  // 이미지 패턴 매칭 (PDF 패턴에서 페이지 없는 경우)
  while ((match = imagePattern.exec(content)) !== null) {
    const [, name, regionStr] = match
    const [x, y, w, h] = regionStr.split(',').map(Number)

    const artifact = artifacts.find(a =>
      a.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(a.name.toLowerCase())
    )

    evidences.push({
      type: 'image',
      artifactId: artifact?.id || name.toLowerCase().replace(/\s+/g, '-'),
      artifactName: artifact?.name || name,
      region: { x, y, w, h }
    })
  }

  return evidences
}

/**
 * 에이전트 응답 검증 (Pretend 방지)
 *
 * "확인했다", "봤다" 등의 표현이 있는데 Evidence가 없으면 경고
 */
export function validateAgentResponse(
  content: string,
  evidences: Evidence[]
): {
  isValid: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  // 확인/검토 표현 패턴
  const claimPatterns = [
    /확인했/,
    /봤습니다/,
    /검토했/,
    /분석했/,
    /살펴봤/,
    /보면\s/,
    /따르면/,
    /나와\s*있/,
    /명시되어/
  ]

  const hasClaim = claimPatterns.some(pattern => pattern.test(content))

  if (hasClaim && evidences.length === 0) {
    warnings.push('근거 없이 확인/검토했다고 주장함')
  }

  // 페이지/시점 언급이 있는데 Evidence 형식이 아닌 경우
  const informalPageRef = /(\d+)페이지|페이지\s*(\d+)|p\.\s*(\d+)/gi
  const informalTimeRef = /(\d+)분\s*(\d+)초|(\d+):(\d+)/g

  if (informalPageRef.test(content) || informalTimeRef.test(content)) {
    const hasProperEvidence = evidences.length > 0
    if (!hasProperEvidence) {
      warnings.push('비정형 참조 발견 - Evidence 태그로 변환 필요')
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  }
}
