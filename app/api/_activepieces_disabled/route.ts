export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { activepieces } from '@/lib/activepieces/client'

/**
 * Activepieces API Proxy
 *
 * Agent Builder에서 Activepieces 기능을 사용하기 위한 API
 */

// GET: 플로우 목록 또는 헬스 체크
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'health':
        const isHealthy = await activepieces.healthCheck()
        return NextResponse.json({ healthy: isHealthy })

      case 'flows':
        const flows = await activepieces.listFlows()
        return NextResponse.json({ flows })

      case 'pieces':
        const pieces = await activepieces.listPieces()
        return NextResponse.json({ pieces })

      case 'flow':
        const flowId = searchParams.get('flowId')
        if (!flowId) {
          return NextResponse.json({ error: 'flowId required' }, { status: 400 })
        }
        const flow = await activepieces.getFlow(flowId)
        return NextResponse.json({ flow })

      case 'run-status':
        const runId = searchParams.get('runId')
        if (!runId) {
          return NextResponse.json({ error: 'runId required' }, { status: 400 })
        }
        const runStatus = await activepieces.getFlowRun(runId)
        return NextResponse.json({ run: runStatus })

      default:
        // 기본: 헬스 체크 + 플로우 수
        const healthy = await activepieces.healthCheck()
        let flowCount = 0
        if (healthy) {
          try {
            const allFlows = await activepieces.listFlows()
            flowCount = allFlows.length
          } catch {
            // 플로우 조회 실패해도 괜찮음
          }
        }
        return NextResponse.json({
          status: healthy ? 'connected' : 'disconnected',
          url: process.env.ACTIVEPIECES_URL || 'http://localhost:8080',
          flowCount,
        })
    }
  } catch (error) {
    console.error('Activepieces API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 플로우 실행
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, flowId, inputs, webhookUrl, payload, waitForCompletion = true } = body

    switch (action) {
      case 'trigger':
        // 플로우 트리거 (Manual)
        if (!flowId) {
          return NextResponse.json({ error: 'flowId required' }, { status: 400 })
        }

        const run = await activepieces.runFlow(flowId, inputs)

        if (waitForCompletion) {
          const completedRun = await activepieces.waitForCompletion(run.id, 60000)
          return NextResponse.json({
            success: completedRun.status === 'SUCCEEDED',
            run: completedRun,
          })
        }

        return NextResponse.json({ runId: run.id, status: 'RUNNING' })

      case 'webhook':
        // 웹훅 트리거
        if (!webhookUrl) {
          return NextResponse.json({ error: 'webhookUrl required' }, { status: 400 })
        }

        const webhookResult = await activepieces.triggerWebhook(webhookUrl, payload || {})
        return NextResponse.json({ success: true, result: webhookResult })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Activepieces Trigger Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Trigger failed' },
      { status: 500 }
    )
  }
}
