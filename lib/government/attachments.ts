/**
 * 정부지원사업 첨부파일 처리 서비스
 * - 첨부파일 URL 추출
 * - Supabase Storage 업로드
 * - 메타데이터 관리
 */

import { createAdminClient } from '@/lib/supabase/server'

// 첨부파일 타입
export type AttachmentType = 'primary' | 'extra' | 'template' | 'template_pdf'

// 첨부파일 정보
export interface AttachmentInfo {
  name: string
  url: string
  type: AttachmentType
  size?: number
  mimeType?: string
}

// 저장된 첨부파일
export interface StoredAttachment extends AttachmentInfo {
  storagePath: string
  storageUrl: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  error?: string
}

// 기업마당 공고 상세 페이지에서 첨부파일 추출
export async function extractBizinfoAttachments(detailUrl: string): Promise<AttachmentInfo[]> {
  const attachments: AttachmentInfo[] = []

  try {
    // 상세 페이지 HTML 가져오기
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })

    if (!response.ok) {
      console.error(`[Attachments] 페이지 로드 실패: ${response.status}`)
      return attachments
    }

    const html = await response.text()

    // 첨부파일 링크 패턴들
    const patterns = [
      // 기업마당 일반 첨부파일
      /<a[^>]*href="([^"]*\/fileDownload[^"]*)"[^>]*>([^<]+)<\/a>/gi,
      // 직접 파일 링크
      /<a[^>]*href="([^"]*\.(pdf|hwp|docx?|xlsx?|zip)[^"]*)"[^>]*>([^<]+)<\/a>/gi,
      // data-file 속성
      /data-file="([^"]+)"/gi,
      // 모집공고 첨부
      /class="[^"]*attach[^"]*"[^>]*>[^<]*<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
    ]

    // 각 패턴으로 첨부파일 추출
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1]
        const name = match[2] || match[3] || extractFileName(url)

        // 중복 체크
        if (!attachments.some(a => a.url === url)) {
          // 파일 타입 결정
          const type = determineAttachmentType(name, url, html)

          attachments.push({
            name: cleanFileName(name),
            url: normalizeUrl(url, detailUrl),
            type
          })
        }
      }
    }

    // 사업계획서 양식 특별 처리
    const templatePatterns = [
      /사업계획서.*?href="([^"]+)"/gi,
      /양식.*?href="([^"]+)"/gi,
      /신청서.*?href="([^"]+)"/gi
    ]

    for (const pattern of templatePatterns) {
      let match
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1]
        const existingIndex = attachments.findIndex(a => a.url === url)
        if (existingIndex >= 0) {
          // 이미 있으면 타입을 template으로 변경
          if (url.toLowerCase().includes('.pdf')) {
            attachments[existingIndex].type = 'template_pdf'
          } else {
            attachments[existingIndex].type = 'template'
          }
        }
      }
    }

    console.log(`[Attachments] ${detailUrl}에서 ${attachments.length}개 첨부파일 발견`)
    return attachments

  } catch (error) {
    console.error('[Attachments] 첨부파일 추출 오류:', error)
    return attachments
  }
}

// 파일 타입 결정
function determineAttachmentType(name: string, url: string, context: string): AttachmentType {
  const lowerName = name.toLowerCase()
  const lowerUrl = url.toLowerCase()

  // 사업계획서 양식
  if (lowerName.includes('사업계획서') || lowerName.includes('양식') || lowerName.includes('신청서')) {
    return lowerUrl.includes('.pdf') ? 'template_pdf' : 'template'
  }

  // 모집공고
  if (lowerName.includes('모집') || lowerName.includes('공고') || lowerName.includes('안내')) {
    return 'primary'
  }

  // 기본값
  return 'extra'
}

// 파일명 추출
function extractFileName(url: string): string {
  try {
    const urlObj = new URL(url, 'https://example.com')
    const pathname = urlObj.pathname
    const segments = pathname.split('/')
    return segments[segments.length - 1] || 'unknown'
  } catch {
    return 'unknown'
  }
}

// 파일명 정리
function cleanFileName(name: string): string {
  return name
    .replace(/<[^>]*>/g, '')  // HTML 태그 제거
    .replace(/\s+/g, ' ')     // 연속 공백 정리
    .trim()
}

// URL 정규화
function normalizeUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith('http')) {
      return url
    }
    const base = new URL(baseUrl)
    return new URL(url, base.origin).toString()
  } catch {
    return url
  }
}

/**
 * 첨부파일 다운로드 및 Storage 업로드
 */
export async function downloadAndStoreAttachment(
  programId: string,
  attachment: AttachmentInfo
): Promise<StoredAttachment> {
  const supabase = createAdminClient()
  const result: StoredAttachment = {
    ...attachment,
    storagePath: '',
    storageUrl: '',
    status: 'downloading'
  }

  try {
    // 파일 다운로드
    console.log(`[Attachments] 다운로드 시작: ${attachment.name}`)
    const response = await fetch(attachment.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*'
      }
    })

    if (!response.ok) {
      throw new Error(`다운로드 실패: ${response.status}`)
    }

    const blob = await response.blob()
    const buffer = Buffer.from(await blob.arrayBuffer())

    // 저장 경로 생성
    const ext = attachment.name.split('.').pop() || 'bin'
    const timestamp = Date.now()
    const storagePath = `government-programs/${programId}/${attachment.type}_${timestamp}.${ext}`

    // Supabase Storage 업로드
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(storagePath, buffer, {
        contentType: blob.type || 'application/octet-stream',
        upsert: true
      })

    if (uploadError) {
      throw new Error(`업로드 실패: ${uploadError.message}`)
    }

    // Public URL 가져오기
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(storagePath)

    result.storagePath = storagePath
    result.storageUrl = urlData.publicUrl
    result.size = buffer.length
    result.mimeType = blob.type
    result.status = 'completed'

    console.log(`[Attachments] 업로드 완료: ${storagePath} (${buffer.length} bytes)`)

  } catch (error: any) {
    console.error(`[Attachments] 처리 실패: ${attachment.name}`, error)
    result.status = 'failed'
    result.error = error.message
  }

  return result
}

/**
 * 프로그램의 모든 첨부파일 처리
 */
export async function processAllAttachments(
  programId: string,
  detailUrl: string
): Promise<{
  success: boolean
  attachments: StoredAttachment[]
  summary: {
    total: number
    completed: number
    failed: number
  }
}> {
  const supabase = createAdminClient()

  // 1. 첨부파일 URL 추출
  const attachmentInfos = await extractBizinfoAttachments(detailUrl)

  if (attachmentInfos.length === 0) {
    return {
      success: true,
      attachments: [],
      summary: { total: 0, completed: 0, failed: 0 }
    }
  }

  // 2. 각 첨부파일 다운로드 & 저장
  const results: StoredAttachment[] = []

  for (const info of attachmentInfos) {
    const result = await downloadAndStoreAttachment(programId, info)
    results.push(result)

    // DB에 메타데이터 저장
    await (supabase as any)
      .from('program_attachments')
      .insert({
        program_id: programId,
        file_name: result.name,
        file_type: result.type,
        original_url: result.url,
        storage_path: result.storagePath || null,
        file_size: result.size || null,
        mime_type: result.mimeType || null,
        status: result.status,
        error_message: result.error || null
      })

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // 3. 프로그램 테이블 업데이트
  const primaryAttachments = results
    .filter(a => a.type === 'primary' && a.status === 'completed')
    .map(a => ({ name: a.name, url: a.storageUrl, originalUrl: a.url }))

  const extraAttachments = results
    .filter(a => a.type === 'extra' && a.status === 'completed')
    .map(a => ({ name: a.name, url: a.storageUrl, originalUrl: a.url }))

  const templateFile = results.find(a => a.type === 'template' && a.status === 'completed')
  const templatePdf = results.find(a => a.type === 'template_pdf' && a.status === 'completed')

  await (supabase as any)
    .from('government_programs')
    .update({
      attachments_primary: primaryAttachments,
      attachments_extra: extraAttachments,
      plan_template_url: templateFile?.storageUrl || null,
      plan_template_pdf_url: templatePdf?.storageUrl || null,
      attachments_fetched_at: new Date().toISOString()
    })
    .eq('id', programId)

  const completed = results.filter(r => r.status === 'completed').length
  const failed = results.filter(r => r.status === 'failed').length

  return {
    success: failed === 0,
    attachments: results,
    summary: {
      total: results.length,
      completed,
      failed
    }
  }
}

/**
 * 첨부파일이 없는 프로그램 목록 조회
 */
export async function getProgramsWithoutAttachments(limit = 50): Promise<Array<{
  id: string
  title: string
  detail_url: string
}>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('government_programs')
    .select('id, title, detail_url')
    .is('attachments_fetched_at', null)
    .not('detail_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[Attachments] 프로그램 조회 오류:', error)
    return []
  }

  return data || []
}
