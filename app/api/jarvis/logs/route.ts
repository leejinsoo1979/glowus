/**
 * Jarvis 실행 로그 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getExecutionLogs } from '@/lib/jarvis'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const logs = await getExecutionLogs(user.id, limit)

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error('Jarvis Logs API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
