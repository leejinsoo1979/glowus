// @ts-nocheck
// =====================================================
// 사업계획서 파이프라인 API (Production-Ready)
// Job Queue + Rate Limiting + 실시간 진행률
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import {
  parseAnnouncementTemplate,
  collectCompanyData,
  extractFactCards,
  mapFactsToSections,
  generateSectionDrafts,
  validateSections,
  generateQuestions
} from '@/lib/business-plan/pipeline-service'
import { generateDocument } from '@/lib/business-plan/document-generator'
import {
  createPipelineJob,
  executePipelineJob,
  getJob,
  getJobsByPlan,
  cancelJob,
  checkRateLimit
} from '@/lib/business-plan/job-queue'
import { PIPELINE_STAGES, PipelineStage } from '@/lib/business-plan/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5분 타임아웃

/**
 * GET: 파이프라인 상태 및 Job 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    // 특정 Job 조회
    if (jobId) {
      const job = await getJob(jobId)
      if (!job || job.plan_id !== id) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json({ job })
    }

    // 사업계획서 조회
    const { data: plan } = await supabase
      .from('business_plans')
      .select(`
        id,
        pipeline_stage,
        pipeline_status,
        completion_percentage,
        total_tokens_used,
        generation_cost,
        generated_document_url,
        generated_document_format,
        generated_at
      `)
      .eq('id', id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 실행 로그 조회
    const { data: logs } = await supabase
      .from('pipeline_execution_logs')
      .select('*')
      .eq('plan_id', id)
      .order('stage')

    // Job 이력 조회
    const jobs = await getJobsByPlan(id)

    // 진행률 계산
    const completedStages = logs?.filter(l => l.status === 'completed').map(l => l.stage) || []
    const failedStages = logs?.filter(l => l.status === 'failed').map(l => l.stage) || []

    return NextResponse.json({
      plan_id: id,
      current_stage: plan.pipeline_stage,
      stage_name: PIPELINE_STAGES[plan.pipeline_stage]?.name || '',
      status: plan.pipeline_status,
      completion_percentage: plan.completion_percentage,
      stages: PIPELINE_STAGES.map(stage => ({
        ...stage,
        status: completedStages.includes(stage.stage)
          ? 'completed'
          : failedStages.includes(stage.stage)
            ? 'failed'
            : 'pending',
        log: logs?.find(l => l.stage === stage.stage)
      })),
      total_tokens_used: plan.total_tokens_used,
      total_cost: plan.generation_cost,
      document: plan.generated_document_url ? {
        url: plan.generated_document_url,
        format: plan.generated_document_format,
        generated_at: plan.generated_at
      } : null,
      jobs: jobs.slice(0, 5) // 최근 5개 Job
    })
  } catch (error: any) {
    console.error('[Pipeline] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pipeline status' },
      { status: 500 }
    )
  }
}

/**
 * POST: 파이프라인 실행 (Job Queue 방식)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      stages,
      action,
      mode = 'async', // 'async' | 'sync' - async는 Job Queue 사용
      options = {}
    } = body

    // 사업계획서 조회
    const { data: plan } = await supabase
      .from('business_plans')
      .select('*, template:business_plan_templates(*)')
      .eq('id', id)
      .single()

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // =========================================
    // 단일 액션 실행 (동기)
    // =========================================
    if (action) {
      let result: any

      switch (action) {
        case 'parse_template':
          if (!plan.program_id) {
            return NextResponse.json({ error: 'program_id is required' }, { status: 400 })
          }
          result = await parseAnnouncementTemplate(plan.program_id, options.document_url)

          // 템플릿 ID 업데이트
          await supabase
            .from('business_plans')
            .update({ template_id: result.id })
            .eq('id', id)
          break

        case 'collect_data':
          result = await collectCompanyData(plan.company_id, id)
          break

        case 'extract_facts':
          result = await extractFactCards(plan.company_id, id, options.documents)
          break

        case 'map_facts':
          if (!plan.template_id) {
            return NextResponse.json({ error: 'Template not found. Run parse_template first.' }, { status: 400 })
          }
          await mapFactsToSections(id, plan.template_id)
          result = { success: true }
          break

        case 'generate_drafts':
          result = await generateSectionDrafts(id)
          break

        case 'validate':
          result = await validateSections(id)
          break

        case 'generate_questions':
          result = await generateQuestions(id)
          break

        case 'generate_document':
          const format = options.format || 'docx'
          result = await generateDocument(id, format, {
            includeTableOfContents: options.includeTableOfContents ?? true,
            includePageNumbers: options.includePageNumbers ?? true
          })
          // 버퍼는 제외하고 반환
          result = {
            filename: result.filename,
            mimeType: result.mimeType,
            size: result.size
          }
          break

        case 'cancel_job':
          if (!options.job_id) {
            return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
          }
          const cancelled = await cancelJob(options.job_id)
          return NextResponse.json({ success: cancelled })

        default:
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
      }

      return NextResponse.json({ success: true, result })
    }

    // =========================================
    // 전체 파이프라인 실행 (Job Queue)
    // =========================================

    // Rate Limit 체크
    const rateCheck = await checkRateLimit(user.id, plan.company_id)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      )
    }

    // Job 생성
    const job = await createPipelineJob(
      id,
      user.id,
      stages as PipelineStage[]
    )

    // 비동기 실행 (백그라운드)
    if (mode === 'async') {
      // 백그라운드에서 실행 (Promise를 await하지 않음)
      executePipelineJob(job.id).catch(err => {
        console.error('Background job error:', err)
      })

      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: 'started',
        message: '파이프라인이 백그라운드에서 실행 중입니다',
        stream_url: `/api/business-plans/${id}/stream?job_id=${job.id}`
      })
    }

    // 동기 실행 (기다림)
    await executePipelineJob(job.id)
    const completedJob = await getJob(job.id)

    return NextResponse.json({
      success: completedJob?.status === 'completed',
      job: completedJob
    })

  } catch (error: any) {
    console.error('[Pipeline] POST Error:', error)

    // 에러 타입별 처리
    if (error.message?.includes('이미 실행 중인')) {
      return NextResponse.json(
        { error: error.message, code: 'ALREADY_RUNNING' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to run pipeline' },
      { status: 500 }
    )
  }
}

/**
 * DELETE: Job 취소
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    // Job 확인
    const job = await getJob(jobId)
    if (!job || job.plan_id !== id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 취소
    const cancelled = await cancelJob(jobId)

    return NextResponse.json({
      success: cancelled,
      message: cancelled ? 'Job cancelled' : 'Failed to cancel job'
    })
  } catch (error: any) {
    console.error('[Pipeline] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
