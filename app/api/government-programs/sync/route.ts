import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  fetchBizinfoPrograms,
  transformBizinfoProgram,
  BIZINFO_CATEGORIES,
  type BizinfoCategory
} from '@/lib/government/bizinfo'

/**
 * 정부지원사업 데이터 동기화 API
 * POST /api/government-programs/sync
 *
 * 기업마당 API에서 데이터를 가져와 DB에 저장
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { category, fullSync = false } = body

    console.log('[GovernmentPrograms] 동기화 시작:', { category, fullSync })

    let allPrograms: any[] = []

    if (fullSync) {
      // 전체 분야 동기화
      for (const catId of Object.keys(BIZINFO_CATEGORIES) as BizinfoCategory[]) {
        const programs = await fetchBizinfoPrograms({
          category: catId,
          searchCount: 100
        })
        allPrograms.push(...programs)

        // Rate limiting 방지
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } else if (category) {
      // 특정 분야만
      const programs = await fetchBizinfoPrograms({
        category: category as BizinfoCategory,
        searchCount: 200
      })
      allPrograms.push(...programs)
    } else {
      // 기본: 최신 100건
      const programs = await fetchBizinfoPrograms({
        searchCount: 100
      })
      allPrograms.push(...programs)
    }

    console.log(`[GovernmentPrograms] ${allPrograms.length}개 공고 수집`)

    // DB에 저장 (upsert)
    const transformedPrograms = allPrograms.map(transformBizinfoProgram)

    let insertedCount = 0
    let updatedCount = 0
    const newProgramIds: string[] = []

    for (const program of transformedPrograms) {
      // 기존 데이터 확인
      const { data: existing } = await supabase
        .from('government_programs')
        .select('id')
        .eq('program_id', program.program_id)
        .single()

      if (existing) {
        // 업데이트
        const { error } = await supabase
          .from('government_programs')
          .update({
            ...program,
            updated_at: new Date().toISOString()
          })
          .eq('program_id', program.program_id)

        if (!error) updatedCount++
      } else {
        // 새로 삽입
        const { data: inserted, error } = await supabase
          .from('government_programs')
          .insert(program)
          .select('id')
          .single()

        if (!error && inserted) {
          insertedCount++
          newProgramIds.push(inserted.id)
        }
      }
    }

    console.log(`[GovernmentPrograms] 동기화 완료: 신규 ${insertedCount}, 업데이트 ${updatedCount}`)

    // 새 공고가 있으면 구독자에게 알림 생성
    if (newProgramIds.length > 0) {
      await createNotificationsForNewPrograms(supabase, newProgramIds)
    }

    return NextResponse.json({
      success: true,
      message: `동기화 완료: 신규 ${insertedCount}건, 업데이트 ${updatedCount}건`,
      stats: {
        fetched: allPrograms.length,
        inserted: insertedCount,
        updated: updatedCount,
        newProgramIds
      }
    })

  } catch (error: any) {
    console.error('[GovernmentPrograms] Sync error:', error)
    return NextResponse.json(
      { error: error.message || '동기화 실패' },
      { status: 500 }
    )
  }
}

/**
 * 새 공고에 대해 구독자 알림 생성
 */
async function createNotificationsForNewPrograms(
  supabase: any,
  programIds: string[]
) {
  try {
    // 새 공고 정보 가져오기
    const { data: programs } = await supabase
      .from('government_programs')
      .select('id, category, hashtags')
      .in('id', programIds)

    if (!programs?.length) return

    // 모든 구독자 가져오기
    const { data: subscribers } = await supabase
      .from('government_program_subscriptions')
      .select('user_id, categories, keywords')
      .eq('push_enabled', true)

    if (!subscribers?.length) return

    // 각 공고에 대해 관련 구독자에게 알림 생성
    const notifications: any[] = []

    for (const program of programs) {
      for (const subscriber of subscribers) {
        // 카테고리 매칭 체크
        const categoryMatch =
          !subscriber.categories?.length ||
          subscriber.categories.includes(program.category)

        // 키워드 매칭 체크
        const keywordMatch =
          !subscriber.keywords?.length ||
          subscriber.keywords.some((kw: string) =>
            program.hashtags?.some((tag: string) =>
              tag.toLowerCase().includes(kw.toLowerCase())
            )
          )

        if (categoryMatch || keywordMatch) {
          notifications.push({
            user_id: subscriber.user_id,
            program_id: program.id,
            is_read: false,
            notified_at: new Date().toISOString()
          })
        }
      }
    }

    // 알림 일괄 삽입
    if (notifications.length > 0) {
      await supabase
        .from('government_program_notifications')
        .upsert(notifications, { onConflict: 'user_id,program_id' })

      console.log(`[GovernmentPrograms] ${notifications.length}개 알림 생성`)
    }
  } catch (error) {
    console.error('[GovernmentPrograms] 알림 생성 오류:', error)
  }
}
