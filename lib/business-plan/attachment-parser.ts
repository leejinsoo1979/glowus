// @ts-nocheck
/**
 * 공고문 첨부파일 파싱 서비스
 * - PDF/HWP 다운로드
 * - 텍스트 추출
 * - AI로 사업계획서 양식 구조화
 * TODO: Supabase 타입 재생성 필요 (npx supabase gen types)
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini AI 클라이언트 (OpenAI 대체)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const getGeminiModel = () => genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

interface Attachment {
  url: string
  name: string
}

interface ParsedTemplate {
  sections: {
    section_id: string
    title: string
    required: boolean
    max_chars?: number
    guidelines?: string
    order: number
    evaluation_weight?: number
    subsections?: {
      id: string
      title: string
      description?: string
    }[]
  }[]
  evaluation_criteria?: {
    category: string
    weight: number
    description: string
  }[]
  total_pages?: number
  writing_guidelines?: string[]
}

/**
 * 첨부파일에서 사업계획서 양식 찾기
 */
export function findPlanTemplateAttachment(attachments: Attachment[]): Attachment | null {
  const keywords = ['사업계획서', '신청서', '양식', '서식', '작성']

  // 사업계획서 양식 파일 우선
  for (const att of attachments) {
    const name = att.name.toLowerCase()
    if (keywords.some(k => att.name.includes(k))) {
      // HWP나 HWPX, PDF 우선
      if (name.endsWith('.hwp') || name.endsWith('.hwpx') || name.endsWith('.pdf')) {
        return att
      }
    }
  }

  // 별첨1이나 서식 파일
  for (const att of attachments) {
    if (att.name.includes('별첨1') || att.name.includes('별첨 1')) {
      return att
    }
  }

  return null
}

/**
 * PDF에서 텍스트 추출 (unpdf 사용 - Node.js 호환)
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // unpdf - Node.js 호환 PDF 파싱
    const { extractText, getDocumentProxy } = await import('unpdf')

    const data = new Uint8Array(buffer)
    const pdf = await getDocumentProxy(data)
    const result = await extractText(pdf, { mergePages: true })

    return result.text
  } catch (error) {
    console.error('[AttachmentParser] PDF parse error:', error)
    throw new Error('PDF 텍스트 추출 실패: ' + (error as Error).message)
  }
}

/**
 * HWP/HWPX에서 텍스트 추출 (cfb + hwp.js 사용)
 */
async function extractTextFromHWP(buffer: Buffer): Promise<string> {
  try {
    const cfb = await import('cfb')

    // CFB 컨테이너 파싱
    const container = cfb.read(buffer, { type: 'buffer' })

    // 1. PrvText (미리보기 텍스트) 추출 시도 - 가장 안정적
    const prvTextEntry = cfb.find(container, '/PrvText')
    if (prvTextEntry && prvTextEntry.content) {
      const decoder = new TextDecoder('utf-16le')
      const text = decoder.decode(prvTextEntry.content as any)
      console.log('[AttachmentParser] HWP PrvText extracted:', text.length, 'chars')

      if (text.length > 100) {
        // < > 태그 제거하고 정리
        const cleanText = text
          .replace(/<([^>]+)>/g, '\n$1\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        return cleanText
      }
    }

    // 2. hwp.js로 본문 파싱 시도
    const HWP = await import('hwp.js')
    const doc = HWP.parse(buffer, { type: 'buffer' } as any)

    let text = ''

    if (doc.sections) {
      for (const section of doc.sections) {
        if (section.content) {
          for (const paragraph of section.content) {
            if (paragraph.content && Array.isArray(paragraph.content)) {
              for (const charInfo of paragraph.content) {
                if (charInfo.type === 0 && typeof charInfo.value === 'number') {
                  if (charInfo.value >= 32 && charInfo.value < 0xFFFF) {
                    text += String.fromCharCode(charInfo.value)
                  }
                } else if (charInfo.type === 2) {
                  if (charInfo.value === 2 || charInfo.value === 10 || charInfo.value === 13) {
                    text += '\n'
                  }
                }
              }
            }
            text += '\n'
          }
        }
      }
    }

    text = text.replace(/\n{3,}/g, '\n\n').trim()

    console.log('[AttachmentParser] HWP body extracted:', text.length, 'chars')
    return text

  } catch (error) {
    console.error('[AttachmentParser] HWP parse error:', error)
    throw new Error('HWP 텍스트 추출 실패: ' + (error as Error).message)
  }
}

/**
 * 파일 다운로드
 */
async function downloadFile(url: string): Promise<Buffer> {
  console.log('[AttachmentParser] Downloading:', url)

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`파일 다운로드 실패: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * AI로 텍스트에서 사업계획서 양식 구조 추출
 */
async function extractTemplateWithAI(text: string, programTitle: string): Promise<ParsedTemplate> {
  const model = getGeminiModel()

  // 텍스트가 너무 길면 잘라서 처리
  const maxLength = 30000
  const truncatedText = text.length > maxLength
    ? text.substring(0, maxLength) + '\n...(이하 생략)...'
    : text

  // DIPS 등 주요 사업 양식에 대한 사전 지식
  const isDIPS = programTitle.includes('초격차') || programTitle.includes('DIPS')
  const knownProgramContext = isDIPS ? `
이 문서는 DIPS(초격차 스타트업 프로젝트) 사업계획서입니다.
DIPS 사업계획서의 표준 구조:
1. 신청현황 (정부지원사업비 2억원, 자기부담사업비 0.88억원+)
2. 신청 분야 (AI/반도체/양자/보안·네트워크/로보틱스/모빌리티/바이오/콘텐츠/방위/에너지)
3. 기업 일반현황 (대표자 정보, 기업 정보)
4. 창업아이템 개요 (아이템명, 핵심 내용)
5. 기술성 (핵심기술, 기술개발 내용, 기술 차별성, 지식재산권)
6. 시장성 (목표시장, 시장규모, 경쟁사 분석, 시장 진입 전략)
7. 사업성 (비즈니스 모델, 수익구조, 마케팅 전략)
8. 대표자 및 팀 역량 (경력, 전문성, 핵심인력)
9. 사업비 계획 (정부지원금 + 자기부담금 상세 내역)
10. 추진일정 (분기별/월별 마일스톤)

이 표준 구조를 기반으로 문서의 실제 내용을 분석하세요.` : ''

  const response = await model.generateContent(`당신은 정부지원사업 사업계획서 양식 분석 전문가입니다.
사업계획서 양식 문서에서 작성해야 할 항목들을 구조화된 형태로 추출합니다.

중요 규칙:
1. 공고문 요약이 아니라, 신청자가 작성해야 하는 사업계획서 항목을 추출
2. 각 섹션의 제목, 작성 가이드, 글자 수 제한 등을 정확히 파악
3. 평가항목과 배점도 추출
4. 문서에 명시적으로 없어도, 해당 사업의 표준 양식 구조를 참고하여 보완
${knownProgramContext}

응답은 반드시 유효한 JSON 형식이어야 합니다.

다음은 "${programTitle}" 사업의 사업계획서 양식입니다.

이 문서에서 사업계획서 작성 항목들을 추출해주세요.
문서에 일부 내용만 있더라도, 해당 사업의 표준 양식 구조를 참고하여 완전한 구조를 제공하세요.

문서 내용:
${truncatedText}

다음 JSON 형식으로 응답해주세요:
{
  "sections": [
    {
      "section_id": "1",
      "title": "섹션 제목",
      "required": true,
      "max_chars": 3000,
      "guidelines": "작성 가이드라인 또는 유의사항",
      "order": 1,
      "evaluation_weight": 20,
      "subsections": [
        {"id": "1-1", "title": "세부항목", "description": "작성 내용 설명"}
      ]
    }
  ],
  "evaluation_criteria": [
    {"category": "평가항목", "weight": 30, "description": "평가 기준"}
  ],
  "writing_guidelines": ["작성 시 유의사항1", "유의사항2"],
  "total_pages": 30,
  "funding_info": {
    "government_support": "2억원",
    "self_funding": "0.88억원 (30% 이상)"
  }
}`)

  const content = response.response.text() || '{}'

  // JSON 파싱 (마크다운 코드블록 제거)
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '')
  }

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('[AttachmentParser] JSON parse error:', e)
    console.error('Raw content:', content)
    return { sections: [] }
  }
}

/**
 * 공고 첨부파일에서 사업계획서 양식 파싱
 */
export async function parseAttachmentTemplate(
  programId: string,
  options?: { forceRefresh?: boolean }
): Promise<{
  success: boolean
  template?: ParsedTemplate
  templateId?: string
  error?: string
}> {
  const supabase = createAdminClient()

  try {
    // 1. 프로그램 정보 조회
    const { data: program, error: programError } = await supabase
      .from('government_programs')
      .select('id, title, attachments_primary, attachments_extra')
      .eq('id', programId)
      .single()

    if (programError || !program) {
      return { success: false, error: '프로그램을 찾을 수 없습니다' }
    }

    // 2. 기존 파싱된 템플릿 확인
    if (!options?.forceRefresh) {
      const { data: existingTemplate } = await supabase
        .from('business_plan_templates')
        .select('id, template_name, sections')
        .eq('program_id', programId)
        .eq('parsing_status', 'completed')
        .single()

      if (existingTemplate) {
        return {
          success: true,
          templateId: existingTemplate.id,
          template: { sections: existingTemplate.sections || [] }
        }
      }
    }

    // 3. 첨부파일에서 사업계획서 양식 찾기
    const allAttachments = [
      ...(program.attachments_primary || []),
      ...(program.attachments_extra || [])
    ]

    const templateAttachment = findPlanTemplateAttachment(allAttachments)

    // 사업계획서 양식 → 공고문 PDF → 아무 PDF 순으로 찾기
    let targetAttachment = templateAttachment

    if (!targetAttachment) {
      // 공고문 PDF 시도
      const announcementPdf = allAttachments.find(a =>
        a.name.endsWith('.pdf') && (a.name.includes('공고') || a.name.includes('모집'))
      )

      if (announcementPdf) {
        console.log('[AttachmentParser] Using announcement PDF:', announcementPdf.name)
        targetAttachment = announcementPdf
      } else {
        // 아무 PDF라도 찾기
        const anyPdf = allAttachments.find(a => a.name.toLowerCase().endsWith('.pdf'))
        if (anyPdf) {
          console.log('[AttachmentParser] Using any available PDF:', anyPdf.name)
          targetAttachment = anyPdf
        }
      }
    }

    if (!targetAttachment) {
      return { success: false, error: '파싱 가능한 첨부파일이 없습니다' }
    }

    console.log('[AttachmentParser] Parsing attachment:', targetAttachment.name)

    // 4. 파일 다운로드
    const fileBuffer = await downloadFile(targetAttachment.url)

    // 5. 텍스트 추출
    let text: string

    if (targetAttachment.name.toLowerCase().endsWith('.pdf')) {
      text = await extractTextFromPDF(fileBuffer)
    } else if (targetAttachment.name.toLowerCase().match(/\.hwpx?$/)) {
      // HWP/HWPX 직접 파싱
      try {
        text = await extractTextFromHWP(fileBuffer)
        console.log('[AttachmentParser] Successfully parsed HWP:', targetAttachment.name)
      } catch (hwpError) {
        console.error('[AttachmentParser] HWP parsing failed, trying PDF fallback:', hwpError)

        // HWP 파싱 실패 시 PDF 버전 시도
        const pdfVersion = allAttachments.find(a =>
          a.name.replace(/\.hwpx?$/, '') === targetAttachment.name.replace(/\.hwpx?$/, '') &&
          a.name.endsWith('.pdf')
        )

        if (pdfVersion) {
          const pdfBuffer = await downloadFile(pdfVersion.url)
          text = await extractTextFromPDF(pdfBuffer)
        } else {
          // 공고문 PDF로 대체
          const announcementPdf = allAttachments.find(a =>
            a.name.endsWith('.pdf') && (a.name.includes('공고') || a.name.includes('모집'))
          )

          if (announcementPdf) {
            console.log('[AttachmentParser] Using announcement PDF:', announcementPdf.name)
            const pdfBuffer = await downloadFile(announcementPdf.url)
            text = await extractTextFromPDF(pdfBuffer)
          } else {
            return { success: false, error: 'HWP 파싱 실패 및 PDF 대체 불가' }
          }
        }
      }
    } else {
      return { success: false, error: '지원하지 않는 파일 형식입니다' }
    }

    if (!text || text.length < 100) {
      return { success: false, error: '텍스트 추출 결과가 너무 짧습니다' }
    }

    console.log('[AttachmentParser] Extracted text length:', text.length)

    // 6. AI로 구조 추출
    const parsedTemplate = await extractTemplateWithAI(text, program.title)

    if (!parsedTemplate.sections?.length) {
      return { success: false, error: '양식 구조를 추출할 수 없습니다' }
    }

    console.log('[AttachmentParser] Parsed sections:', parsedTemplate.sections.length)

    // 7. 템플릿 저장 (기존 확인 후 update 또는 insert)
    const templateData = {
      program_id: programId,
      name: `${program.title} 양식`,
      template_name: `${program.title} 양식`,
      description: `${program.title} 공고문에서 추출된 사업계획서 양식`,
      sections: parsedTemplate.sections,
      section_structure: parsedTemplate.sections,
      evaluation_criteria: parsedTemplate.evaluation_criteria,
      writing_guidelines: parsedTemplate.writing_guidelines,
      parsing_status: 'completed',
      is_active: true,
      source_file: targetAttachment.name,
      source_url: targetAttachment.url,
      updated_at: new Date().toISOString()
    }

    // 기존 템플릿 확인
    const { data: existingTemplate } = await supabase
      .from('business_plan_templates')
      .select('id')
      .eq('program_id', programId)
      .single()

    let savedTemplate: { id: string } | null = null
    let saveError: any = null

    if (existingTemplate) {
      // 업데이트
      const result = await supabase
        .from('business_plan_templates')
        .update(templateData)
        .eq('id', existingTemplate.id)
        .select('id')
        .single()
      savedTemplate = result.data
      saveError = result.error
    } else {
      // 새로 생성
      const result = await supabase
        .from('business_plan_templates')
        .insert(templateData)
        .select('id')
        .single()
      savedTemplate = result.data
      saveError = result.error
    }

    if (saveError) {
      console.error('[AttachmentParser] Save error:', saveError)
      return { success: false, error: '템플릿 저장 실패: ' + saveError.message }
    }

    return {
      success: true,
      templateId: savedTemplate?.id,
      template: parsedTemplate
    }

  } catch (error: any) {
    console.error('[AttachmentParser] Error:', error)
    return { success: false, error: error.message || '파싱 중 오류 발생' }
  }
}

/**
 * 프로그램의 사업계획서 템플릿 가져오기 (없으면 파싱)
 */
export async function getOrParseTemplate(programId: string): Promise<{
  success: boolean
  template?: any
  templateId?: string
  error?: string
}> {
  const supabase = createAdminClient()

  // 기존 템플릿 확인
  const { data: existing } = await supabase
    .from('business_plan_templates')
    .select('*')
    .eq('program_id', programId)
    .eq('parsing_status', 'completed')
    .single()

  if (existing) {
    return {
      success: true,
      templateId: existing.id,
      template: existing
    }
  }

  // 없으면 파싱
  return parseAttachmentTemplate(programId)
}

/**
 * 모든 첨부파일 텍스트 추출 (공고문, 사업계획서 양식, 기타 참고자료 전부)
 */
export async function parseAllAttachments(programId: string): Promise<{
  success: boolean
  documents: {
    name: string
    type: 'announcement' | 'template' | 'reference'
    text: string
  }[]
  error?: string
}> {
  const supabase = createAdminClient()

  try {
    // 1. 프로그램 정보 조회
    const { data: program, error: programError } = await supabase
      .from('government_programs')
      .select('id, title, attachments_primary, attachments_extra')
      .eq('id', programId)
      .single()

    if (programError || !program) {
      return { success: false, documents: [], error: '프로그램을 찾을 수 없습니다' }
    }

    const allAttachments = [
      ...(program.attachments_primary || []),
      ...(program.attachments_extra || [])
    ]

    if (allAttachments.length === 0) {
      return { success: false, documents: [], error: '첨부파일이 없습니다' }
    }

    console.log('[AttachmentParser] Parsing all attachments:', allAttachments.length)

    const documents: { name: string; type: 'announcement' | 'template' | 'reference'; text: string }[] = []

    // 2. 모든 첨부파일 파싱
    for (const attachment of allAttachments) {
      const name = attachment.name.toLowerCase()

      // 파싱 가능한 파일만 (PDF, HWP, HWPX)
      if (!name.endsWith('.pdf') && !name.match(/\.hwpx?$/)) {
        console.log('[AttachmentParser] Skipping unsupported file:', attachment.name)
        continue
      }

      try {
        console.log('[AttachmentParser] Downloading:', attachment.name)
        const buffer = await downloadFile(attachment.url)

        let text = ''

        if (name.endsWith('.pdf')) {
          text = await extractTextFromPDF(buffer)
        } else if (name.match(/\.hwpx?$/)) {
          try {
            text = await extractTextFromHWP(buffer)
          } catch (hwpErr) {
            console.error('[AttachmentParser] HWP parsing failed for:', attachment.name, hwpErr)
            continue
          }
        }

        if (text && text.length > 50) {
          // 파일 타입 분류
          let type: 'announcement' | 'template' | 'reference' = 'reference'

          if (attachment.name.includes('공고') || attachment.name.includes('모집')) {
            type = 'announcement'
          } else if (
            attachment.name.includes('사업계획서') ||
            attachment.name.includes('신청서') ||
            attachment.name.includes('별첨1')
          ) {
            type = 'template'
          }

          documents.push({
            name: attachment.name,
            type,
            text
          })

          console.log(`[AttachmentParser] Parsed ${attachment.name}: ${text.length} chars (${type})`)
        }
      } catch (err) {
        console.error('[AttachmentParser] Failed to parse:', attachment.name, err)
      }
    }

    return {
      success: true,
      documents
    }

  } catch (error: any) {
    console.error('[AttachmentParser] parseAllAttachments error:', error)
    return { success: false, documents: [], error: error.message }
  }
}

/**
 * 사업계획서 양식 구조 추출 (별첨1 등에서)
 */
export async function extractBusinessPlanStructure(programId: string): Promise<{
  success: boolean
  structure?: {
    sections: {
      id: string
      title: string
      description?: string
      required: boolean
      order: number
      maxLength?: number
      subsections?: { id: string; title: string; description?: string }[]
    }[]
    evaluationCriteria?: { name: string; weight: number; description: string }[]
    writingGuidelines?: string[]
  }
  sourceDocument?: string
  error?: string
}> {
  // 1. 모든 첨부파일 파싱
  const { success, documents, error } = await parseAllAttachments(programId)

  if (!success || documents.length === 0) {
    return { success: false, error: error || '첨부파일 파싱 실패' }
  }

  // 2. 사업계획서 양식 문서 찾기
  const templateDoc = documents.find(d => d.type === 'template')

  if (!templateDoc) {
    return { success: false, error: '사업계획서 양식을 찾을 수 없습니다' }
  }

  // 3. 공고문도 참고
  const announcementDoc = documents.find(d => d.type === 'announcement')

  // 4. AI로 구조 추출 (Gemini 2.5 Flash)
  const model = getGeminiModel()

  const combinedText = `
=== 사업계획서 양식 (${templateDoc.name}) ===
${templateDoc.text.substring(0, 20000)}

${announcementDoc ? `
=== 공고문 참고 (${announcementDoc.name}) ===
${announcementDoc.text.substring(0, 10000)}
` : ''}
`

  const response = await model.generateContent(`당신은 정부지원사업 사업계획서 양식 분석 전문가입니다.
사업계획서 양식 문서에서 실제로 작성해야 할 항목들을 정확하게 추출합니다.

중요:
- 공고문 요약이 아니라, 신청자가 작성해야 하는 사업계획서 항목을 추출하세요
- 각 섹션의 제목, 작성 가이드, 글자 수 제한 등을 정확히 파악하세요
- 평가항목과 배점도 있으면 추출하세요

다음 문서에서 사업계획서 양식 구조를 추출해주세요.

${combinedText}

다음 JSON 형식으로 응답해주세요:
{
  "sections": [
    {
      "id": "1",
      "title": "섹션 제목 (예: 창업아이템 개요)",
      "description": "이 섹션에서 작성해야 할 내용 설명",
      "required": true,
      "order": 1,
      "maxLength": 3000,
      "subsections": [
        {"id": "1-1", "title": "세부항목", "description": "작성 내용"}
      ]
    }
  ],
  "evaluationCriteria": [
    {"name": "평가항목명", "weight": 30, "description": "평가 기준"}
  ],
  "writingGuidelines": ["작성 시 유의사항1", "유의사항2"]
}

실제 문서에 있는 항목만 추출하고, 없는 항목은 생략하세요.`)

  const content = response.response.text() || '{}'

  // JSON 파싱
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '')
  }

  try {
    const structure = JSON.parse(jsonStr)
    return {
      success: true,
      structure,
      sourceDocument: templateDoc.name
    }
  } catch (e) {
    console.error('[AttachmentParser] JSON parse error:', e)
    return { success: false, error: 'AI 응답 파싱 실패' }
  }
}
