// @ts-nocheck
// =====================================================
// SSE 실시간 파이프라인 진행률 스트림
// =====================================================

import { NextRequest } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { subscribeToJobProgress, getJob } from '@/lib/business-plan/job-queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params
  const supabase = await createClient()
  const { user, error: authError } = await getAuthUser(supabase)

  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Job ID 가져오기 (URL 파라미터)
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('job_id')

  if (!jobId) {
    return new Response('job_id is required', { status: 400 })
  }

  // Job 확인
  const job = await getJob(jobId)
  if (!job || job.plan_id !== planId) {
    return new Response('Job not found', { status: 404 })
  }

  // SSE 스트림 생성
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // 초기 상태 전송
      const initialData = JSON.stringify({
        type: 'init',
        job_id: jobId,
        status: job.status,
        progress: job.progress,
        current_stage: job.current_stage,
        stage_progress: job.stage_progress
      })
      controller.enqueue(encoder.encode(`data: ${initialData}\n\n`))

      // 이미 완료된 경우
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        const finalData = JSON.stringify({
          type: 'complete',
          status: job.status,
          progress: job.progress,
          error: job.error
        })
        controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
        controller.close()
        return
      }

      // 진행률 구독
      const unsubscribe = subscribeToJobProgress(jobId, (data) => {
        try {
          const eventData = JSON.stringify(data)
          controller.enqueue(encoder.encode(`data: ${eventData}\n\n`))

          // 완료/실패 시 스트림 종료
          if (['completed', 'failed', 'cancelled'].includes(data.status)) {
            setTimeout(() => {
              unsubscribe()
              controller.close()
            }, 1000)
          }
        } catch (e) {
          // 연결 끊김
          unsubscribe()
        }
      })

      // 연결 유지를 위한 heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch (e) {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 30000)

      // 타임아웃 (10분)
      setTimeout(() => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch (e) {
          // already closed
        }
      }, 600000)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
