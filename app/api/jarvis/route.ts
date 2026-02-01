/**
 * Jarvis 메인 API 엔드포인트
 * 도구 실행 및 명령 처리
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { executeTool, getToolByName } from '@/lib/jarvis'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { toolName, args, approvalId } = body

    if (!toolName) {
      return NextResponse.json({ error: 'toolName이 필요합니다' }, { status: 400 })
    }

    // 도구 존재 확인
    const tool = getToolByName(toolName)
    if (!tool) {
      return NextResponse.json({ error: `알 수 없는 도구: ${toolName}` }, { status: 400 })
    }

    // 도구 실행
    const result = await executeTool(user.id, toolName, args || {}, approvalId)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Jarvis API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
