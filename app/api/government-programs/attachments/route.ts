import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  processAllAttachments,
  getProgramsWithoutAttachments,
  extractBizinfoAttachments
} from '@/lib/government/attachments'

/**
 * GET /api/government-programs/attachments
 * 첨부파일 현황 조회
 *
 * Query params:
 * - program_id: 특정 프로그램의 첨부파일
 * - pending: true면 첨부파일 미수집 프로그램 목록
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const programId = searchParams.get('program_id')
  const pending = searchParams.get('pending') === 'true'

  const supabase = createAdminClient()

  try {
    // 특정 프로그램의 첨부파일 조회
    if (programId) {
      const { data: attachments, error } = await supabase
        .from('program_attachments')
        .select('*')
        .eq('program_id', programId)
        .order('file_type')

      if (error) throw error

      return NextResponse.json({
        success: true,
        programId,
        attachments: attachments || [],
        count: attachments?.length || 0
      })
    }

    // 첨부파일 미수집 프로그램 목록
    if (pending) {
      const programs = await getProgramsWithoutAttachments(100)

      return NextResponse.json({
        success: true,
        programs,
        count: programs.length
      })
    }

    // 전체 통계
    const { data: stats } = await supabase
      .from('attachment_stats')
      .select('*')
      .single()

    const { count: programsWithAttachments } = await supabase
      .from('government_programs')
      .select('*', { count: 'exact', head: true })
      .not('attachments_fetched_at', 'is', null)

    const { count: totalPrograms } = await supabase
      .from('government_programs')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      stats: {
        ...(stats || {}),
        programsWithAttachments,
        totalPrograms,
        pendingPrograms: (totalPrograms || 0) - (programsWithAttachments || 0)
      }
    })

  } catch (error: any) {
    console.error('[Attachments API] 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || '조회 실패' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/government-programs/attachments
 * 첨부파일 수집 실행
 *
 * Body:
 * - program_id: 특정 프로그램 처리 (선택)
 * - batch_size: 일괄 처리 개수 (기본 10)
 * - preview: true면 URL만 추출 (다운로드 안함)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { program_id, batch_size = 10, preview = false } = body

    const supabase = createAdminClient()

    // 특정 프로그램 처리
    if (program_id) {
      const { data: program } = await supabase
        .from('government_programs')
        .select('id, title, detail_url')
        .eq('id', program_id)
        .single() as { data: { id: string; title: string; detail_url: string } | null }

      if (!program || !program.detail_url) {
        return NextResponse.json(
          { error: '프로그램을 찾을 수 없거나 상세 URL이 없습니다.' },
          { status: 404 }
        )
      }

      // 미리보기 모드
      if (preview) {
        const attachments = await extractBizinfoAttachments(program.detail_url)
        return NextResponse.json({
          success: true,
          preview: true,
          program: { id: program.id, title: program.title },
          attachments,
          count: attachments.length
        })
      }

      // 실제 처리
      const result = await processAllAttachments(program.id, program.detail_url)

      return NextResponse.json({
        ...result,
        program: { id: program.id, title: program.title }
      })
    }

    // 일괄 처리
    const programs = await getProgramsWithoutAttachments(batch_size)

    if (programs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 프로그램이 없습니다.',
        processed: 0
      })
    }

    const results = []

    for (const program of programs) {
      if (!program.detail_url) continue

      try {
        if (preview) {
          const attachments = await extractBizinfoAttachments(program.detail_url)
          results.push({
            programId: program.id,
            title: program.title,
            attachments: attachments.length,
            status: 'preview'
          })
        } else {
          const result = await processAllAttachments(program.id, program.detail_url)
          results.push({
            programId: program.id,
            title: program.title,
            ...result.summary,
            status: result.success ? 'completed' : 'partial'
          })
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error: any) {
        results.push({
          programId: program.id,
          title: program.title,
          status: 'failed',
          error: error.message
        })
      }
    }

    const completed = results.filter(r => r.status === 'completed').length
    const failed = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      preview,
      processed: results.length,
      completed,
      failed,
      results
    })

  } catch (error: any) {
    console.error('[Attachments API] 처리 오류:', error)
    return NextResponse.json(
      { error: error.message || '처리 실패' },
      { status: 500 }
    )
  }
}
