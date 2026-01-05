// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

export const dynamic = 'force-dynamic'

/**
 * GET: 지식베이스 전체 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section') // team, products, achievements, financials, market

    // 프로필 조회
    const { data: profile } = await adminSupabase
      .from('company_support_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    let result: any = { profile }

    // 섹션별 조회
    if (!section || section === 'all') {
      // 전체 조회
      const [team, products, achievements, financials, marketData, entries] = await Promise.all([
        adminSupabase
          .from('company_team_members')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('is_key_member', { ascending: false })
          .order('display_order'),
        adminSupabase
          .from('company_products')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('is_flagship', { ascending: false })
          .order('display_order'),
        adminSupabase
          .from('company_achievements')
          .select('*')
          .eq('user_id', user.id)
          .order('importance_level', { ascending: false })
          .order('date', { ascending: false }),
        adminSupabase
          .from('company_financials')
          .select('*')
          .eq('user_id', user.id)
          .order('fiscal_year', { ascending: false }),
        adminSupabase
          .from('company_market_data')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1),
        adminSupabase
          .from('company_knowledge_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
      ])

      result = {
        ...result,
        team_members: team.data || [],
        products: products.data || [],
        achievements: achievements.data || [],
        financials: financials.data || [],
        market_data: marketData.data?.[0] || null,
        knowledge_entries: entries.data || [],
        completeness: calculateCompleteness({
          profile: profile || {},
          team_members: team.data || [],
          products: products.data || [],
          achievements: achievements.data || [],
          financials: financials.data || [],
          market_data: marketData.data?.[0] || null
        })
      }
    } else {
      // 특정 섹션만 조회
      const tableMap: Record<string, string> = {
        team: 'company_team_members',
        products: 'company_products',
        achievements: 'company_achievements',
        financials: 'company_financials',
        market: 'company_market_data',
        entries: 'company_knowledge_entries'
      }

      const tableName = tableMap[section]
      if (tableName) {
        const { data, error } = await adminSupabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        result[section] = data
      }
    }

    return NextResponse.json({ success: true, ...result })

  } catch (error: any) {
    console.error('[KnowledgeBase GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST: 지식베이스 항목 추가
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data: itemData } = body

    if (!type || !itemData) {
      return NextResponse.json({ error: 'type과 data가 필요합니다.' }, { status: 400 })
    }

    const tableMap: Record<string, string> = {
      team: 'company_team_members',
      product: 'company_products',
      achievement: 'company_achievements',
      financial: 'company_financials',
      market: 'company_market_data',
      entry: 'company_knowledge_entries'
    }

    const tableName = tableMap[type]
    if (!tableName) {
      return NextResponse.json({ error: '잘못된 type입니다.' }, { status: 400 })
    }

    // 프로필에서 company_id 가져오기
    const { data: profile } = await adminSupabase
      .from('company_support_profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single()

    const insertData = {
      ...itemData,
      user_id: user.id,
      company_id: profile?.company_id || null
    }

    const { data, error } = await adminSupabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `${type} 항목이 추가되었습니다.`,
      data
    })

  } catch (error: any) {
    console.error('[KnowledgeBase POST] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT: 지식베이스 항목 수정
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, id, data: itemData } = body

    if (!type || !id || !itemData) {
      return NextResponse.json({ error: 'type, id, data가 필요합니다.' }, { status: 400 })
    }

    const tableMap: Record<string, string> = {
      team: 'company_team_members',
      product: 'company_products',
      achievement: 'company_achievements',
      financial: 'company_financials',
      market: 'company_market_data',
      entry: 'company_knowledge_entries'
    }

    const tableName = tableMap[type]
    if (!tableName) {
      return NextResponse.json({ error: '잘못된 type입니다.' }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from(tableName)
      .update(itemData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: `${type} 항목이 수정되었습니다.`,
      data
    })

  } catch (error: any) {
    console.error('[KnowledgeBase PUT] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE: 지식베이스 항목 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!type || !id) {
      return NextResponse.json({ error: 'type과 id가 필요합니다.' }, { status: 400 })
    }

    const tableMap: Record<string, string> = {
      team: 'company_team_members',
      product: 'company_products',
      achievement: 'company_achievements',
      financial: 'company_financials',
      market: 'company_market_data',
      entry: 'company_knowledge_entries'
    }

    const tableName = tableMap[type]
    if (!tableName) {
      return NextResponse.json({ error: '잘못된 type입니다.' }, { status: 400 })
    }

    // Soft delete (is_active = false)
    if (['team', 'product', 'entry'].includes(type)) {
      const { error } = await adminSupabase
        .from(tableName)
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    } else {
      // Hard delete
      const { error } = await adminSupabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: `${type} 항목이 삭제되었습니다.`
    })

  } catch (error: any) {
    console.error('[KnowledgeBase DELETE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 완성도 계산 함수
function calculateCompleteness(data: any): {
  score: number
  maxScore: number
  percentage: number
  details: any
} {
  let score = 0
  const maxScore = 100
  const details: any = {}

  // 프로필 기본 정보 (25점)
  if (data.profile?.business_description) {
    score += 10
    details.business_description = true
  }
  if (data.profile?.main_products) {
    score += 8
    details.main_products = true
  }
  if (data.profile?.core_technologies) {
    score += 7
    details.core_technologies = true
  }

  // 팀 정보 (20점)
  if (data.team_members?.length > 0) {
    score += 10
    details.has_team = true
    if (data.team_members.some((m: any) => m.is_key_member)) {
      score += 10
      details.has_key_members = true
    }
  }

  // 제품 정보 (20점)
  if (data.products?.length > 0) {
    score += 10
    details.has_products = true
    if (data.products.some((p: any) => p.is_flagship)) {
      score += 10
      details.has_flagship = true
    }
  }

  // 성과 정보 (10점)
  if (data.achievements?.length > 0) {
    score += 10
    details.has_achievements = true
  }

  // 재무 정보 (15점)
  if (data.financials?.length > 0) {
    score += 15
    details.has_financials = true
  }

  // 시장 데이터 (10점)
  if (data.market_data) {
    score += 10
    details.has_market_data = true
  }

  return {
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    details
  }
}
