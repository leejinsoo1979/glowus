/**
 * Jarvis 도구 목록 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ALL_TOOLS, getToolsByCategory } from '@/lib/jarvis'
import type { ToolCategory } from '@/lib/jarvis'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as ToolCategory | null

    let tools = category ? getToolsByCategory(category) : ALL_TOOLS

    // 간단한 형태로 반환
    const result = tools.map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      riskLevel: t.riskLevel,
      requiresApproval: t.requiresApproval,
    }))

    return NextResponse.json({ tools: result })
  } catch (error: any) {
    console.error('Jarvis Tools API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
