// @ts-nocheck
// =====================================================
// 사업계획서 파이프라인 API (Production-Ready)
// Job Queue + Rate Limiting + 실시간 진행률
// =====================================================
//
// 🆕 양식 기반 완벽한 인터뷰 플로우:
//
// 1️⃣ 양식 로드 및 질문 생성
//    POST action: "load_template_questions"
//    → 공고문/양식에서 섹션 추출
//    → 각 섹션별 맞춤형 질문 생성 (AI)
//    → 응답: { template, questionsBySection, totalQuestions }
//
// 2️⃣ 섹션별 답변 및 콘텐츠 생성
//    POST action: "answer_section"
//    → 특정 섹션의 질문들에 답변 제출
//    → 해당 섹션 콘텐츠 즉시 생성 (placeholder 없이)
//    → 응답: { section, qualityScore }
//
// 3️⃣ 전체 섹션 일괄 생성 (선택적)
//    POST action: "generate_all_sections"
//    → 모든 질문 답변 완료 후
//    → 남은 섹션 일괄 생성
//    → 응답: { sections, completionPercentage }
//
// 4️⃣ 기존 파이프라인 계속 진행
//    POST stages: [6, 7, 8] (검증 → 최종 문서)
//
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createClientForApi, getAuthUser, createAdminClient } from '@/lib/supabase/server'
import {
  parseAnnouncementTemplate,
  collectCompanyData,
  extractFactCards,
  mapFactsToSections,
  generateSectionDrafts,
  validateSections,
  generateQuestions,
  checkDataSufficiency,
  generateInterviewQuestions,
  processInterviewAnswers,
  // 🆕 양식 기반 완벽한 인터뷰 시스템
  generateTemplateDrivenQuestions,
  generateSectionFromAnswers,
  generateAllSectionsFromInterview
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

    // Admin client로 사업계획서 조회 (RLS 우회)
    const adminSupabase = createAdminClient()
    const { data: plan } = await adminSupabase
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

    // 실행 로그 조회 (admin client 사용)
    const { data: logs } = await adminSupabase
      .from('pipeline_execution_logs')
      .select('*')
      .eq('plan_id', id)
      .order('stage')

    // Job 이력 조회
    const jobs = await getJobsByPlan(id)

    // 진행률 계산 (로그 기반)
    const completedStages = logs?.filter(l => l.status === 'completed').map(l => l.stage) || []
    const failedStages = logs?.filter(l => l.status === 'failed').map(l => l.stage) || []

    // 실행 중인 Job이 있으면 그 job의 stage_progress 우선 사용
    // 없으면 가장 최근 완료된 Job의 stage_progress 사용
    const runningJob = jobs.find(j => j.status === 'running')
    const latestCompletedJob = jobs.find(j => j.status === 'completed')
    const activeJob = runningJob || latestCompletedJob
    const jobStageProgress = activeJob?.stage_progress || {}

    return NextResponse.json({
      plan_id: id,
      current_stage: runningJob?.current_stage || plan.pipeline_stage,
      stage_name: PIPELINE_STAGES[runningJob?.current_stage || plan.pipeline_stage]?.name || '',
      status: runningJob ? 'running' : plan.pipeline_status,
      completion_percentage: runningJob?.progress || plan.completion_percentage,
      stages: PIPELINE_STAGES.map(stage => {
        // 실행 중인 Job의 stage_progress 우선 사용
        const jobStage = jobStageProgress[String(stage.stage)]
        if (jobStage) {
          return {
            ...stage,
            status: jobStage.status === 'completed' ? 'completed'
              : jobStage.status === 'failed' ? 'failed'
              : jobStage.status === 'skipped' ? 'skipped'
              : jobStage.status === 'running' ? 'processing'
              : 'pending',
            progress: jobStage.progress,
            message: jobStage.message,
            log: logs?.find(l => l.stage === stage.stage)
          }
        }
        // 실행 중인 Job이 없으면 로그 기반
        return {
          ...stage,
          status: completedStages.includes(stage.stage)
            ? 'completed'
            : failedStages.includes(stage.stage)
              ? 'failed'
              : 'pending',
          log: logs?.find(l => l.stage === stage.stage)
        }
      }),
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
    const supabase = await createClientForApi()
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

    // Admin client로 사업계획서 조회 (RLS 우회)
    const adminSupabase = createAdminClient()
    const { data: plan, error: planError } = await adminSupabase
      .from('business_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (planError || !plan) {
      console.error('[Pipeline] Plan query error:', planError)
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 템플릿 조회 (있는 경우 또는 기본 템플릿 사용) - admin client 사용
    let template = null
    if (plan.template_id) {
      const { data: templateData } = await adminSupabase
        .from('business_plan_templates')
        .select('*')
        .eq('id', plan.template_id)
        .single()
      template = templateData
    } else {
      // 기본 템플릿 사용
      const { data: defaultTemplate } = await adminSupabase
        .from('business_plan_templates')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single()
      template = defaultTemplate
    }
    // plan 객체에 template 추가
    plan.template = template

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

        // =========================================
        // 인터뷰 모드 관련 액션
        // =========================================
        case 'check_sufficiency':
          // 데이터 충족도 체크
          const templateSections = plan.template?.sections || []
          const sufficiency = await checkDataSufficiency(plan.company_id, templateSections)
          return NextResponse.json({
            success: true,
            ...sufficiency
          })

        case 'start_interview':
          // 인터뷰 모드 시작 (질문 생성)
          const interviewSections = plan.template?.sections || []
          const interviewQuestions = await generateInterviewQuestions(
            plan.company_id,
            id,
            interviewSections
          )
          return NextResponse.json({
            success: true,
            needsInterview: interviewQuestions.length > 0,
            questions: interviewQuestions,
            message: interviewQuestions.length > 0
              ? `사업계획서 작성을 위해 ${interviewQuestions.length}개의 질문에 답변해주세요.`
              : '데이터가 충분합니다. 파이프라인을 실행할 수 있습니다.'
          })

        case 'process_interview':
          // 인터뷰 답변 처리 → 팩트카드 생성
          if (!options.answers || !Array.isArray(options.answers)) {
            return NextResponse.json(
              { error: 'answers array is required. Format: [{questionId, answer}]' },
              { status: 400 }
            )
          }
          const createdFacts = await processInterviewAnswers(
            plan.company_id,
            id,
            options.answers
          )

          // 재충족도 체크
          const newSufficiency = await checkDataSufficiency(
            plan.company_id,
            plan.template?.sections || []
          )

          return NextResponse.json({
            success: true,
            factsCreated: createdFacts.length,
            newSufficiency,
            canProceed: newSufficiency.sufficient,
            message: newSufficiency.sufficient
              ? '데이터 수집 완료! 이제 사업계획서를 생성할 수 있습니다.'
              : `추가 정보가 필요합니다. 현재 충족도: ${newSufficiency.overallScore}%`
          })

        // =========================================
        // 🆕 양식 기반 완벽한 인터뷰 시스템
        // =========================================
        case 'load_template_questions':
          // 양식을 불러와서 각 섹션별 질문 생성
          const templateResult = await generateTemplateDrivenQuestions(id, {
            skipExistingData: options.skip_existing_data,
            maxQuestionsPerSection: options.max_questions_per_section || 5
          })

          if (!templateResult.success) {
            return NextResponse.json({ error: 'Failed to generate template questions' }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            template: {
              id: templateResult.template?.id,
              name: templateResult.template?.template_name,
              sections: templateResult.template?.sections?.length || 0
            },
            questionsBySection: templateResult.questionsBySection.map(s => ({
              sectionId: s.sectionId,
              sectionTitle: s.sectionTitle,
              guidelines: s.guidelines,
              evaluationWeight: s.evaluationWeight,
              questionCount: s.questions.length,
              questions: s.questions.map(q => ({
                id: q.id,
                question: q.question_text,
                type: q.question_type,
                required: q.is_required,
                context: q.context
              }))
            })),
            totalQuestions: templateResult.totalQuestions,
            message: `${templateResult.template?.template_name}에서 ${templateResult.questionsBySection.length}개 섹션, 총 ${templateResult.totalQuestions}개 질문이 생성되었습니다.`
          })

        case 'answer_section':
          // 특정 섹션의 질문에 답변하고 해당 섹션 콘텐츠 생성
          if (!options.section_id || !options.answers || !Array.isArray(options.answers)) {
            return NextResponse.json(
              { error: 'section_id and answers array required. Format: {section_id: "1", answers: [{questionId, answer}]}' },
              { status: 400 }
            )
          }

          const sectionResult = await generateSectionFromAnswers(
            id,
            options.section_id,
            options.answers
          )

          if (!sectionResult.success) {
            return NextResponse.json({ error: 'Failed to generate section content' }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            section: {
              id: sectionResult.section?.id,
              title: sectionResult.section?.section_title,
              content: sectionResult.section?.content,
              charCount: sectionResult.charCount
            },
            qualityScore: sectionResult.qualityScore,
            message: `"${sectionResult.section?.section_title}" 섹션이 생성되었습니다. (${sectionResult.charCount}자, 품질 ${sectionResult.qualityScore}점)`
          })

        case 'generate_all_sections':
          // 모든 답변 완료 후 전체 섹션 일괄 생성
          console.log('[Pipeline] generate_all_sections called for plan:', id)
          const allSectionsResult = await generateAllSectionsFromInterview(id)
          console.log('[Pipeline] generate_all_sections result:', JSON.stringify(allSectionsResult, null, 2))

          if (!allSectionsResult.success) {
            if (allSectionsResult.pendingQuestions > 0) {
              return NextResponse.json({
                success: false,
                error: 'pending_questions',
                pendingQuestions: allSectionsResult.pendingQuestions,
                message: `아직 답변하지 않은 질문이 ${allSectionsResult.pendingQuestions}개 있습니다.`
              }, { status: 400 })
            }
            return NextResponse.json({ error: 'Failed to generate sections' }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            sectionsGenerated: allSectionsResult.sections.length,
            sections: allSectionsResult.sections.map(s => ({
              id: s.id,
              title: s.section_title,
              charCount: s.char_count,
              status: s.validation_status
            })),
            completionPercentage: allSectionsResult.completionPercentage,
            message: `${allSectionsResult.sections.length}개 섹션이 생성되었습니다. 완성도: ${allSectionsResult.completionPercentage}%`
          })

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
