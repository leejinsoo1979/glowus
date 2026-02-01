/**
 * Jarvis 승인 관리 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  checkApprovalStatus,
} from '@/lib/jarvis'

// 대기 중인 승인 요청 목록
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (requestId) {
      // 특정 요청 상태 확인
      const approval = await checkApprovalStatus(requestId)
      return NextResponse.json({ approval })
    }

    // 대기 중인 요청 목록
    const approvals = await getPendingApprovals(user.id)
    return NextResponse.json({ approvals })
  } catch (error: any) {
    console.error('Jarvis Approval GET Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 승인/거부 처리
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, action, reason } = body

    if (!requestId) {
      return NextResponse.json({ error: 'requestId가 필요합니다' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action은 approve 또는 reject여야 합니다' }, { status: 400 })
    }

    // 요청이 해당 유저의 것인지 확인
    const approval = await checkApprovalStatus(requestId)
    if (!approval) {
      return NextResponse.json({ error: '승인 요청을 찾을 수 없습니다' }, { status: 404 })
    }
    if (approval.userId !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    if (action === 'approve') {
      await approveRequest(requestId)
      return NextResponse.json({ success: true, message: '승인되었습니다' })
    } else {
      await rejectRequest(requestId, reason)
      return NextResponse.json({ success: true, message: '거부되었습니다' })
    }
  } catch (error: any) {
    console.error('Jarvis Approval POST Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
