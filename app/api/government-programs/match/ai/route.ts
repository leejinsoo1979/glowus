// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * AI 매칭 결과 타입 (요구사항 7.1)
 */
interface AIMatchResult {
  score: number
  action: 'apply' | 'watch' | 'skip'
  reasons: Array<{ title: string; detail: string }>
  risks: Array<{ title: string; detail: string }>
  next_actions: string[]
}

/**
 * AI 매칭 프롬프트 생성
 */
function buildMatchingPrompt(program: any, profile: any): string {
  const programInfo = `
## 지원사업 정보
- 사업명: ${program.title}
- 주관기관: ${program.organization || '미상'}
- 카테고리: ${program.category || '미분류'}
- 마감일: ${program.apply_end_date || '미정'}
- 지원대상: ${program.target || '전체'}
- 지역: ${program.region || '전국'}
- 지원내용: ${program.summary || program.description || '상세내용 없음'}
- 지원유형: ${program.support_type || '미분류'}
- 해시태그: ${(program.hashtags || []).join(', ') || '없음'}
`

  const profileInfo = `
## 회사 프로필
- 업종: ${profile.industry_category || '미입력'} (${profile.industry_code || ''})
- 세부업종: ${profile.industry_subcategory || '미입력'}
- 사업자유형: ${profile.entity_type || '미입력'}
- 창업단계: ${profile.startup_stage || '미입력'}
- 업력: ${profile.business_years || 0}년
- 직원수: ${profile.employee_count || '미입력'}명
- 연매출: ${profile.annual_revenue ? `${(profile.annual_revenue / 100000000).toFixed(1)}억원` : '미입력'}
- 지역: ${profile.region || '미입력'} ${profile.city || ''}
- 청년창업: ${profile.is_youth_startup ? '예' : '아니오'}
- 여성기업: ${profile.is_female_owned ? '예' : '아니오'}
- 사회적기업: ${profile.is_social_enterprise ? '예' : '아니오'}
- 수출기업: ${profile.is_export_business ? '예' : '아니오'}
- 기술인증: ${(profile.tech_certifications || []).join(', ') || '없음'}
- 관심분야: ${(profile.interested_categories || []).join(', ') || '미입력'}
- 사업내용: ${profile.business_description || '미입력'}
- 주요제품: ${profile.main_products || '미입력'}
- 핵심기술: ${profile.core_technologies || '미입력'}
`

  return `당신은 정부지원사업 적합도 분석 전문가입니다.

아래 회사 프로필과 지원사업 정보를 분석하여, 이 회사가 해당 지원사업에 얼마나 적합한지 평가해주세요.

${programInfo}

${profileInfo}

## 분석 기준
1. **자격요건 충족도**: 업종, 업력, 규모, 지역 등 기본 자격요건 충족 여부
2. **정책 방향 부합도**: 지원사업의 목적과 회사 사업 방향의 일치 정도
3. **경쟁력**: 우대조건 해당 여부 (청년/여성/사회적기업/기술인증 등)
4. **실현가능성**: 필요 서류, 사업계획서 작성 난이도, 마감일까지 시간

## 출력 형식 (JSON)
반드시 아래 형식으로만 응답하세요:

{
  "score": 0-100 사이 점수,
  "action": "apply" | "watch" | "skip",
  "reasons": [
    {"title": "근거 제목", "detail": "왜 적합/부적합한지 2-3문장으로 설명"}
  ],
  "risks": [
    {"title": "리스크 제목", "detail": "탈락 가능성 또는 보완 필요사항 설명"}
  ],
  "next_actions": [
    "다음 단계 액션 1",
    "다음 단계 액션 2"
  ]
}

## 점수 기준
- 80-100: 적극 지원 권장 (action: "apply")
- 60-79: 검토 후 지원 고려 (action: "watch")
- 0-59: 지원 비권장 (action: "skip")

## 주의사항
- reasons는 최소 2개, 최대 5개
- risks는 0개 가능, 있으면 반드시 보완 방법 포함
- next_actions는 구체적이고 실행 가능한 항목으로 2-4개
- 프로필 정보가 미입력인 경우 보수적으로 평가하되, risks에 "정보 부족" 명시

JSON만 출력하세요.`
}

/**
 * AI 응답 파싱
 */
function parseAIResponse(content: string): AIMatchResult {
  try {
    // JSON 블록 추출
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('JSON not found in response')
    }

    const result = JSON.parse(jsonMatch[0])

    // 유효성 검사
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
      result.score = 50
    }

    if (!['apply', 'watch', 'skip'].includes(result.action)) {
      result.action = result.score >= 70 ? 'apply' : result.score >= 50 ? 'watch' : 'skip'
    }

    if (!Array.isArray(result.reasons)) {
      result.reasons = []
    }

    if (!Array.isArray(result.risks)) {
      result.risks = []
    }

    if (!Array.isArray(result.next_actions)) {
      result.next_actions = []
    }

    return result as AIMatchResult
  } catch (error) {
    console.error('[AI Match] Parse error:', error)
    // 기본값 반환
    return {
      score: 50,
      action: 'watch',
      reasons: [{ title: '분석 오류', detail: 'AI 분석 중 오류가 발생했습니다. 수동 검토가 필요합니다.' }],
      risks: [{ title: '파싱 실패', detail: '매칭 결과를 해석하지 못했습니다.' }],
      next_actions: ['공고 내용을 직접 확인하세요', '프로필 정보를 업데이트하세요']
    }
  }
}

/**
 * POST: AI 기반 단일 프로그램 매칭 분석
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { program_id, force_refresh = false } = body

    if (!program_id) {
      return NextResponse.json(
        { error: 'program_id가 필요합니다.' },
        { status: 400 }
      )
    }

    // 캐시된 결과 확인 (force_refresh가 아닌 경우)
    if (!force_refresh) {
      const { data: cachedResult } = await adminSupabase
        .from('match_results')
        .select('*')
        .eq('user_id', user.id)
        .eq('program_id', program_id)
        .single()

      if (cachedResult) {
        // 24시간 이내 결과는 캐시 반환
        const cacheAge = Date.now() - new Date(cachedResult.created_at).getTime()
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return NextResponse.json({
            success: true,
            cached: true,
            result: {
              score: cachedResult.score,
              action: cachedResult.action,
              reasons: cachedResult.reasons,
              risks: cachedResult.risks,
              next_actions: cachedResult.next_actions
            },
            matched_at: cachedResult.created_at
          })
        }
      }
    }

    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: '회사 프로필을 먼저 생성해주세요.',
        redirect: '/dashboard-group/company/government-programs/profile'
      }, { status: 400 })
    }

    // 프로그램 조회
    const { data: program, error: programError } = await adminSupabase
      .from('government_programs')
      .select('*')
      .eq('id', program_id)
      .single()

    if (programError || !program) {
      return NextResponse.json(
        { error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // AI 매칭 분석 (OpenAI GPT-4o)
    const openai = new OpenAI()
    const prompt = buildMatchingPrompt(program, profile)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    })

    const aiContent = completion.choices[0]?.message?.content || ''
    const matchResult = parseAIResponse(aiContent)

    // 결과 저장 (match_results 테이블이 있는 경우)
    try {
      await adminSupabase
        .from('match_results')
        .upsert({
          user_id: user.id,
          program_id: program_id,
          company_profile_id: profile.id,
          profile_snapshot: {
            industry_category: profile.industry_category,
            entity_type: profile.entity_type,
            startup_stage: profile.startup_stage,
            region: profile.region,
            business_description: profile.business_description
          },
          score: matchResult.score,
          action: matchResult.action,
          reasons: matchResult.reasons,
          risks: matchResult.risks,
          next_actions: matchResult.next_actions,
          ai_model: 'gpt-4o',
          ai_prompt_version: 'v1'
        }, {
          onConflict: 'user_id,program_id'
        })
    } catch (saveError) {
      console.warn('[AI Match] Failed to save result (table may not exist):', saveError)
    }

    return NextResponse.json({
      success: true,
      cached: false,
      program: {
        id: program.id,
        title: program.title,
        organization: program.organization,
        apply_end_date: program.apply_end_date,
        category: program.category
      },
      result: matchResult,
      matched_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[AI Match] Error:', error)
    return NextResponse.json(
      { error: error.message || 'AI 매칭 분석 실패' },
      { status: 500 }
    )
  }
}

/**
 * GET: 여러 프로그램 일괄 AI 매칭
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const minScore = parseInt(searchParams.get('min_score') || '0')
    const action = searchParams.get('action') // apply, watch, skip

    // 저장된 매칭 결과 조회
    let query = adminSupabase
      .from('match_results')
      .select(`
        *,
        government_programs (
          id, title, organization, category,
          apply_end_date, apply_start_date,
          source, detail_url
        )
      `)
      .eq('user_id', user.id)
      .gte('score', minScore)
      .order('score', { ascending: false })
      .limit(limit)

    if (action) {
      query = query.eq('action', action)
    }

    const { data: results, error } = await query

    if (error) {
      // 테이블이 없는 경우 빈 배열 반환
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          results: [],
          message: 'match_results 테이블이 없습니다. 마이그레이션을 실행하세요.'
        })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      results: results || [],
      total: results?.length || 0
    })

  } catch (error: any) {
    console.error('[AI Match] GET Error:', error)
    return NextResponse.json(
      { error: error.message || '매칭 결과 조회 실패' },
      { status: 500 }
    )
  }
}
