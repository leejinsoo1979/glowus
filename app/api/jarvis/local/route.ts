/**
 * Jarvis Local Proxy API
 * Vercel에서 로컬 맥북의 jarvis-local-server로 명령 전달
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createApprovalRequest, checkApprovalStatus, getToolByName, requiresApproval } from '@/lib/jarvis'

// 로컬 서버 URL (ngrok 또는 Cloudflare Tunnel)
const JARVIS_LOCAL_URL = process.env.JARVIS_LOCAL_URL || 'http://localhost:3099'
const JARVIS_API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-local-secret-change-me'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { tool, args, approvalId } = body

    if (!tool) {
      return NextResponse.json({ error: 'tool이 필요합니다' }, { status: 400 })
    }

    // 승인 필요 여부 확인
    if (requiresApproval(tool) && !approvalId) {
      // 승인 요청 생성
      const request = await createApprovalRequest(user.id, tool, args || {})
      return NextResponse.json({
        success: false,
        requiresApproval: true,
        approvalId: request.id,
        message: '승인이 필요합니다',
      })
    }

    // 승인 ID가 있으면 상태 확인
    if (approvalId) {
      const approval = await checkApprovalStatus(approvalId)
      if (!approval) {
        return NextResponse.json({ success: false, error: '승인 요청을 찾을 수 없습니다' })
      }
      if (approval.status === 'REJECTED') {
        return NextResponse.json({ success: false, error: `거부됨: ${approval.rejectedReason}` })
      }
      if (approval.status === 'PENDING') {
        return NextResponse.json({ success: false, error: '아직 승인 대기 중입니다' })
      }
      if (approval.status === 'EXPIRED') {
        return NextResponse.json({ success: false, error: '승인 요청이 만료되었습니다' })
      }
    }

    // 로컬 서버에 명령 전달
    const response = await fetch(`${JARVIS_LOCAL_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JARVIS_API_SECRET}`,
      },
      body: JSON.stringify({ tool, args }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({
        success: false,
        error: `로컬 서버 오류: ${error}`
      }, { status: response.status })
    }

    const result = await response.json()
    return NextResponse.json({ success: true, ...result })

  } catch (error: any) {
    // 로컬 서버 연결 실패
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json({
        success: false,
        error: '로컬 Jarvis 서버가 실행되지 않았습니다. 맥북에서 `npm run jarvis:local`을 실행하세요.',
        code: 'LOCAL_SERVER_OFFLINE'
      }, { status: 503 })
    }

    console.error('Jarvis Local Proxy Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// 로컬 서버 상태 확인
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${JARVIS_LOCAL_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${JARVIS_API_SECRET}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ online: false, error: 'Health check failed' })
    }

    const data = await response.json()
    return NextResponse.json({ online: true, ...data })

  } catch (error: any) {
    return NextResponse.json({
      online: false,
      error: '로컬 서버에 연결할 수 없습니다',
      code: 'LOCAL_SERVER_OFFLINE'
    })
  }
}
