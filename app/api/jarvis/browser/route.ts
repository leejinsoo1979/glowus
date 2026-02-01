/**
 * Jarvis Browser Automation API
 * 스크립트 기반 브라우저 자동화 + AI 폴백
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  executeBrowserTask,
  findMatchingScript,
  saveLearnedScript,
} from '@/lib/jarvis/browser-automation'

/**
 * POST /api/jarvis/browser
 * 브라우저 작업 실행
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { instruction, forceAI } = body

    if (!instruction) {
      return NextResponse.json({ error: 'instruction이 필요합니다' }, { status: 400 })
    }

    // forceAI가 true면 스크립트 건너뛰고 바로 AI 폴백 필요 응답
    if (forceAI) {
      return NextResponse.json({
        success: false,
        needsAI: true,
        message: 'AI 모드로 실행합니다',
      })
    }

    // 브라우저 작업 실행 (스크립트 우선)
    const result = await executeBrowserTask(user.id, instruction)

    // 스크립트 없으면 AI 폴백 필요 표시
    if (result.error === 'NO_SCRIPT_FOUND') {
      return NextResponse.json({
        success: false,
        needsAI: true,
        message: '저장된 스크립트가 없습니다. AI로 실행하시겠습니까?',
        tokensEstimate: 15000, // 예상 토큰
      })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Jarvis Browser API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET /api/jarvis/browser
 * 저장된 스크립트 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')

    const adminClient = createAdminClient()

    let query = adminClient
      .from('browser_scripts')
      .select('id, site_domain, site_name, action_name, action_description, trigger_keywords, success_count, fail_count, is_public, created_at')
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .eq('is_active', true)
      .order('success_count', { ascending: false })

    if (domain) {
      query = query.eq('site_domain', domain)
    }

    const { data: scripts, error } = await query.limit(50)

    if (error) throw new Error(error.message)

    // 성공률 계산
    const scriptsWithStats = (scripts || []).map((s: any) => ({
      ...s,
      successRate: s.success_count + s.fail_count > 0
        ? Math.round((s.success_count / (s.success_count + s.fail_count)) * 100)
        : null,
    }))

    return NextResponse.json({ scripts: scriptsWithStats })
  } catch (error: any) {
    console.error('Jarvis Browser Scripts API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT /api/jarvis/browser
 * 새 스크립트 저장 (AI 학습 결과)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      siteDomain,
      actionName,
      actionDescription,
      triggerKeywords,
      scriptCode,
      variables,
    } = body

    if (!siteDomain || !actionName || !scriptCode) {
      return NextResponse.json({
        error: 'siteDomain, actionName, scriptCode가 필요합니다'
      }, { status: 400 })
    }

    const scriptId = await saveLearnedScript(
      user.id,
      siteDomain,
      actionName,
      actionDescription || '',
      triggerKeywords || [],
      scriptCode,
      variables || []
    )

    if (!scriptId) {
      return NextResponse.json({ error: '스크립트 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      scriptId,
      message: '스크립트 저장 완료',
    })
  } catch (error: any) {
    console.error('Jarvis Browser Save Script API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/jarvis/browser?id=xxx
 * 스크립트 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scriptId = searchParams.get('id')

    if (!scriptId) {
      return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('browser_scripts')
      .delete()
      .eq('id', scriptId)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, message: '스크립트 삭제 완료' })
  } catch (error: any) {
    console.error('Jarvis Browser Delete Script API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
