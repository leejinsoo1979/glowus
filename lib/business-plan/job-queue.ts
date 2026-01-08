// @ts-nocheck
// =====================================================
// 사업계획서 파이프라인 Job Queue 시스템
// 백그라운드 처리 + 실시간 진행률
// =====================================================

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseAnnouncementTemplate,
  collectCompanyData,
  extractFactCards,
  mapFactsToSections,
  generateSectionDrafts,
  validateSections,
  generateQuestions
} from './pipeline-service'
import { generateDocument } from './document-generator'
import { PIPELINE_STAGES, PipelineStage } from './types'

// Job 상태 타입
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface PipelineJob {
  id: string
  plan_id: string
  user_id: string
  company_id: string
  stages: PipelineStage[]
  current_stage: number
  status: JobStatus
  progress: number
  stage_progress: Record<number, { status: string; message: string; progress: number }>
  error?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

// 진행률 업데이트 브로드캐스트용 메모리 저장소
// 프로덕션에서는 Redis pub/sub 사용 권장
const jobProgressListeners: Map<string, Set<(data: any) => void>> = new Map()

// =====================================================
// Job 생성
// =====================================================

export async function createPipelineJob(
  planId: string,
  userId: string,
  stages?: PipelineStage[]
): Promise<PipelineJob> {
  const supabase = createAdminClient()

  // 기존 실행 중인 Job 확인
  const { data: existingJob } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .eq('plan_id', planId)
    .in('status', ['pending', 'running'])
    .single()

  if (existingJob) {
    throw new Error('이미 실행 중인 파이프라인이 있습니다')
  }

  // 플랜 정보 조회
  const { data: plan } = await supabase
    .from('business_plans')
    .select('company_id')
    .eq('id', planId)
    .single()

  if (!plan) {
    throw new Error('사업계획서를 찾을 수 없습니다')
  }

  // Job 생성
  const jobId = crypto.randomUUID()
  const stagesToRun = stages || ([1, 2, 3, 4, 5, 6, 7, 8] as PipelineStage[])

  const job: Omit<PipelineJob, 'id'> = {
    plan_id: planId,
    user_id: userId,
    company_id: plan.company_id,
    stages: stagesToRun,
    current_stage: 0,
    status: 'pending',
    progress: 0,
    stage_progress: {},
    created_at: new Date().toISOString()
  }

  const { data: createdJob, error } = await supabase
    .from('pipeline_jobs')
    .insert({ id: jobId, ...job })
    .select()
    .single()

  if (error) {
    throw new Error(`Job 생성 실패: ${error.message}`)
  }

  return createdJob as PipelineJob
}

// =====================================================
// Job 실행 (백그라운드)
// =====================================================

export async function executePipelineJob(jobId: string): Promise<void> {
  const supabase = createAdminClient()

  // Job 조회
  const { data: job, error: jobError } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    throw new Error('Job을 찾을 수 없습니다')
  }

  // 상태 업데이트: running
  await updateJobStatus(jobId, 'running', { started_at: new Date().toISOString() })

  // 플랜 정보 조회 (template 조인 없이 단순 조회)
  console.log('[JobQueue] Fetching plan with ID:', job.plan_id)
  const { data: plan, error: planError } = await supabase
    .from('business_plans')
    .select('*')
    .eq('id', job.plan_id)
    .single()

  console.log('[JobQueue] Plan query result:', { plan: !!plan, error: planError?.message })

  if (!plan) {
    console.error('[JobQueue] Plan not found! Error:', planError)
    await updateJobStatus(jobId, 'failed', { error: '사업계획서를 찾을 수 없습니다' })
    return
  }

  const totalStages = job.stages.length
  let completedStages = 0

  try {
    for (const stage of job.stages) {
      // 취소 확인
      const { data: currentJob } = await supabase
        .from('pipeline_jobs')
        .select('status')
        .eq('id', jobId)
        .single()

      if (currentJob?.status === 'cancelled') {
        broadcastProgress(jobId, { status: 'cancelled', message: '사용자에 의해 취소됨' })
        return
      }

      // 스테이지 시작 알림
      const stageName = PIPELINE_STAGES[stage]?.name || `Stage ${stage}`
      await updateStageProgress(jobId, stage, 'running', `${stageName} 처리 중...`, 0)

      try {
        // 스테이지 실행
        switch (stage) {
          case 1:
            if (plan.program_id) {
              await updateStageProgress(jobId, stage, 'running', '공고문 분석 중...', 30)
              const parsedTemplate = await parseAnnouncementTemplate(plan.program_id)

              // 중요: 파싱된 템플릿을 plan에 연결
              if (parsedTemplate?.id) {
                await supabase
                  .from('business_plans')
                  .update({ template_id: parsedTemplate.id })
                  .eq('id', job.plan_id)
                console.log(`[JobQueue] Stage 1: 템플릿 연결 완료 (template_id: ${parsedTemplate.id})`)
                await updateStageProgress(jobId, stage, 'completed', `공고문 분석 완료 (${parsedTemplate.sections?.length || 0}개 섹션)`, 100)
              } else {
                await updateStageProgress(jobId, stage, 'completed', '공고문 분석 완료', 100)
              }
            } else {
              await updateStageProgress(jobId, stage, 'skipped', '공고문 ID 없음', 100)
            }
            break

          case 2:
            await updateStageProgress(jobId, stage, 'running', '회사 데이터 수집 중...', 30)
            await collectCompanyData(plan.company_id, job.plan_id)
            await updateStageProgress(jobId, stage, 'completed', '데이터 수집 완료', 100)
            break

          case 3:
            await updateStageProgress(jobId, stage, 'running', '팩트카드 추출 중...', 30)
            await extractFactCards(plan.company_id, job.plan_id)
            await updateStageProgress(jobId, stage, 'completed', '팩트카드 추출 완료', 100)
            break

          case 4:
            await updateStageProgress(jobId, stage, 'running', '섹션-팩트 매핑 중...', 30)
            // 템플릿 ID 재조회
            const { data: updatedPlan } = await supabase
              .from('business_plans')
              .select('template_id')
              .eq('id', job.plan_id)
              .single()

            if (updatedPlan?.template_id) {
              await mapFactsToSections(job.plan_id, updatedPlan.template_id)
              await updateStageProgress(jobId, stage, 'completed', '매핑 완료', 100)
            } else {
              await updateStageProgress(jobId, stage, 'skipped', '템플릿 없음', 100)
            }
            break

          case 5:
            await updateStageProgress(jobId, stage, 'running', 'AI가 초안 작성 중...', 10)
            // 섹션별 진행률 업데이트
            const { data: sections } = await supabase
              .from('business_plan_sections')
              .select('id')
              .eq('plan_id', job.plan_id)

            await generateSectionDrafts(job.plan_id)
            await updateStageProgress(jobId, stage, 'completed', `${sections?.length || 0}개 섹션 작성 완료`, 100)
            break

          case 6:
            await updateStageProgress(jobId, stage, 'running', '검증 중...', 50)
            const validationResults = await validateSections(job.plan_id)
            const validCount = validationResults.filter(r => r.status === 'valid').length
            await updateStageProgress(
              jobId,
              stage,
              'completed',
              `검증 완료 (${validCount}/${validationResults.length} 통과)`,
              100
            )
            break

          case 7:
            await updateStageProgress(jobId, stage, 'running', '미확정 정보 질문 생성 중...', 50)
            const questions = await generateQuestions(job.plan_id)
            await updateStageProgress(
              jobId,
              stage,
              'completed',
              questions.length > 0 ? `${questions.length}개 질문 생성` : '미확정 정보 없음',
              100
            )
            break

          case 8:
            await updateStageProgress(jobId, stage, 'running', '문서 생성 중...', 30)
            const doc = await generateDocument(job.plan_id, 'docx')
            await updateStageProgress(jobId, stage, 'completed', `문서 생성 완료 (${Math.round(doc.size / 1024)}KB)`, 100)
            break
        }
      } catch (stageError: any) {
        console.error(`Stage ${stage} error:`, stageError)
        await updateStageProgress(jobId, stage, 'failed', stageError.message || '처리 실패', 0)
        throw stageError // 상위로 전파하여 Job 실패 처리
      }

      completedStages++
      const overallProgress = Math.round((completedStages / totalStages) * 100)

      // 현재 stage_progress 상태 조회
      const { data: currentJobData } = await supabase
        .from('pipeline_jobs')
        .select('stage_progress')
        .eq('id', jobId)
        .single()

      // 전체 진행률 업데이트
      await supabase
        .from('pipeline_jobs')
        .update({
          current_stage: stage,
          progress: overallProgress
        })
        .eq('id', jobId)

      // 전체 진행률과 함께 현재 stage_progress 상태도 브로드캐스트
      broadcastProgress(jobId, {
        stage,
        progress: overallProgress,
        status: 'running',
        stage_progress: currentJobData?.stage_progress || {},
        completed_stages: completedStages,
        total_stages: totalStages
      })
    }

    // 완료
    await updateJobStatus(jobId, 'completed', {
      completed_at: new Date().toISOString(),
      progress: 100
    })

    // 플랜 상태 업데이트
    await supabase
      .from('business_plans')
      .update({
        pipeline_status: 'completed',
        completion_percentage: 100
      })
      .eq('id', job.plan_id)

    broadcastProgress(jobId, { status: 'completed', progress: 100 })
  } catch (error: any) {
    console.error('Pipeline job failed:', error)

    await updateJobStatus(jobId, 'failed', {
      error: error.message || '알 수 없는 오류',
      completed_at: new Date().toISOString()
    })

    // 플랜 상태 업데이트
    await supabase
      .from('business_plans')
      .update({
        pipeline_status: 'failed'
      })
      .eq('id', job.plan_id)

    broadcastProgress(jobId, { status: 'failed', error: error.message })
  }
}

// =====================================================
// 상태 업데이트 헬퍼
// =====================================================

async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  extra: Partial<PipelineJob> = {}
): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('pipeline_jobs')
    .update({ status, ...extra })
    .eq('id', jobId)

  broadcastProgress(jobId, { status, ...extra })
}

async function updateStageProgress(
  jobId: string,
  stage: number,
  status: string,
  message: string,
  progress: number
): Promise<void> {
  const supabase = createAdminClient()

  // 현재 stage_progress 조회
  const { data: job } = await supabase
    .from('pipeline_jobs')
    .select('stage_progress')
    .eq('id', jobId)
    .single()

  const stageProgress = job?.stage_progress || {}
  stageProgress[stage] = { status, message, progress }

  await supabase
    .from('pipeline_jobs')
    .update({ stage_progress: stageProgress })
    .eq('id', jobId)

  broadcastProgress(jobId, {
    type: 'stage_progress',
    stage,
    status,
    message,
    progress
  })
}

// =====================================================
// 실시간 진행률 브로드캐스트
// =====================================================

function broadcastProgress(jobId: string, data: any): void {
  const listeners = jobProgressListeners.get(jobId)
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(data)
      } catch (e) {
        console.error('Broadcast error:', e)
      }
    })
  }
}

export function subscribeToJobProgress(jobId: string, callback: (data: any) => void): () => void {
  if (!jobProgressListeners.has(jobId)) {
    jobProgressListeners.set(jobId, new Set())
  }

  jobProgressListeners.get(jobId)!.add(callback)

  // Unsubscribe function
  return () => {
    const listeners = jobProgressListeners.get(jobId)
    if (listeners) {
      listeners.delete(callback)
      if (listeners.size === 0) {
        jobProgressListeners.delete(jobId)
      }
    }
  }
}

// =====================================================
// Job 조회
// =====================================================

export async function getJob(jobId: string): Promise<PipelineJob | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error) return null
  return data as PipelineJob
}

export async function getJobsByPlan(planId: string): Promise<PipelineJob[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return []
  return data as PipelineJob[]
}

// =====================================================
// Job 취소
// =====================================================

export async function cancelJob(jobId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('pipeline_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId)
    .in('status', ['pending', 'running'])

  return !error
}

// =====================================================
// Rate Limiting
// =====================================================

const RATE_LIMITS = {
  JOBS_PER_HOUR: 100,   // 개발용 증가
  JOBS_PER_DAY: 500,    // 개발용 증가
  CONCURRENT_JOBS: 10   // 개발용 증가
}

export async function checkRateLimit(userId: string, companyId: string): Promise<{ allowed: boolean; reason?: string }> {
  const supabase = createAdminClient()

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // 시간당 제한
  const { count: hourlyCount } = await supabase
    .from('pipeline_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', oneHourAgo.toISOString())

  if ((hourlyCount || 0) >= RATE_LIMITS.JOBS_PER_HOUR) {
    return { allowed: false, reason: `시간당 ${RATE_LIMITS.JOBS_PER_HOUR}회 제한 초과` }
  }

  // 일일 제한
  const { count: dailyCount } = await supabase
    .from('pipeline_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', oneDayAgo.toISOString())

  if ((dailyCount || 0) >= RATE_LIMITS.JOBS_PER_DAY) {
    return { allowed: false, reason: `일일 ${RATE_LIMITS.JOBS_PER_DAY}회 제한 초과` }
  }

  // 동시 실행 제한
  const { count: runningCount } = await supabase
    .from('pipeline_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('status', ['pending', 'running'])

  if ((runningCount || 0) >= RATE_LIMITS.CONCURRENT_JOBS) {
    return { allowed: false, reason: `동시 실행 ${RATE_LIMITS.CONCURRENT_JOBS}개 제한` }
  }

  return { allowed: true }
}
