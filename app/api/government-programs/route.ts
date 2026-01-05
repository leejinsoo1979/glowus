import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { fetchBizinfoPrograms, transformBizinfoProgram, scrapeBizinfoDetail } from '@/lib/government/bizinfo'
import { fetchKStartupPrograms, transformKStartupProgram, scrapeKStartupDetail } from '@/lib/government/kstartup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * 정부지원사업 목록 조회 API
 * GET /api/government-programs
 */
export async function GET(request: NextRequest) {
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

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id') // 단일 프로그램 조회용
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'active' | 'ended' | 'upcoming' | 'all'
    const source = searchParams.get('source')
    const supportType = searchParams.get('support_type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 단일 프로그램 조회 (id 파라미터가 있는 경우)
    if (id) {
      const { data, error: programError } = await supabase
        .from('government_programs')
        .select('*')
        .eq('id', id)
        .single()

      if (programError || !data) {
        return NextResponse.json(
          { error: '프로그램을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 타입 명시
      const program = data as any

      // Bizinfo 크롤링 조건 체크 (최우선)
      const isBizinfo = program.source === 'bizinfo' || program.detail_url?.includes('bizinfo.go.kr')
      const needsBizinfoCrawling = isBizinfo && (!program.content || !program.content.includes('bizinfo-original'))

      // K-Startup 구 포맷 체크
      const isOldFormat = program.source === 'kstartup' && program.content && !program.content.includes('k-startup-section')

      // 크롤링 필요 여부 판단
      const needsCrawling = (needsBizinfoCrawling || !program.content || isOldFormat) && program.detail_url

      if (needsCrawling) {
        try {
          let scrapedData = null

          // Bizinfo 크롤링
          if (needsBizinfoCrawling) {
            console.log(`[GovernmentPrograms] 기업마당 크롤링 시도 (ID: ${id})`)
            scrapedData = await scrapeBizinfoDetail(program.detail_url) as any
            console.log(`[GovernmentPrograms] 크롤링 결과: ${scrapedData ? '성공' : '실패'}, 길이: ${scrapedData?.content?.length || 0}`)
          }
          // K-Startup 페이지 크롤링
          else if (program.detail_url.includes('k-startup.go.kr')) {
            scrapedData = await scrapeKStartupDetail(program.detail_url) as any
          }

          if (scrapedData?.content) {
            // 응답에 반영
            program.content = scrapedData.content
            if (scrapedData.attachments) {
              program.attachments_primary = scrapedData.attachments
            }
            if (scrapedData.pdf_url) {
              program.pdf_url = scrapedData.pdf_url
            }

            // DB 캐시 (백그라운드) - content + attachments + pdf_url
            const adminSupabase = createAdminClient()
            const updateData: any = { content: scrapedData.content }
            if (scrapedData.attachments && scrapedData.attachments.length > 0) {
              updateData.attachments_primary = scrapedData.attachments
            }
            if (scrapedData.pdf_url) {
              updateData.pdf_url = scrapedData.pdf_url
            }

            // 1. 기본 정보 업데이트
            const updatePromise = (adminSupabase as any)
              .from('government_programs')
              .update(updateData)
              .eq('id', id)
              .then(() => console.log('[GovernmentPrograms] 스크래핑 캐시 저장 (첨부파일 ' + (scrapedData.attachments?.length || 0) + '개)'))

            // 2. 평가 기준 및 제출 서류 업데이트 (program_requirements)
            let reqPromise = Promise.resolve()
            if (scrapedData.evaluation_criteria || scrapedData.required_documents) {
              const reqData: any = {
                program_id: id,
                updated_at: new Date().toISOString()
              }

              if (scrapedData.evaluation_criteria) {
                reqData.evaluation_criteria = [{
                  category: "크롤링 추출 데이터",
                  weight: 0,
                  items: [scrapedData.evaluation_criteria]
                }]
              }

              if (scrapedData.required_documents) {
                reqData.required_documents = [{
                  name: "크롤링 추출 데이터",
                  description: scrapedData.required_documents,
                  required: true
                }]
              }

              // upsert program_requirements
              reqPromise = adminSupabase
                .from('program_requirements')
                .upsert(reqData, { onConflict: 'program_id' })
                .then(({ error }) => {
                  if (error) console.error('[GovernmentPrograms] 평가기준 저장 실패:', error)
                  else console.log('[GovernmentPrograms] 평가기준 저장 완료')
                }) as any
            }

            // 병렬 실행
            Promise.all([updatePromise, reqPromise]).catch(err => console.error(err))
          }
        } catch (scrapeError) {
          console.error('[GovernmentPrograms] 크롤링 오류:', scrapeError)
        }
      }

      return NextResponse.json({
        success: true,
        program,
        programs: [program] // 하위 호환성
      })
    }

    // DB 테이블 존재 확인
    const { error: tableError } = await supabase
      .from('government_programs')
      .select('id')
      .limit(1)

    // 테이블이 없으면 API에서 직접 데이터 가져오기
    if (tableError?.message?.includes('Could not find')) {
      console.log('[GovernmentPrograms] 테이블 없음 - API에서 직접 조회')

      // 기업마당 데이터
      const bizinfoRaw = await fetchBizinfoPrograms({ searchCount: 50 })
      const bizinfoPrograms = bizinfoRaw.map(p => {
        const transformed = transformBizinfoProgram(p)
        return {
          id: transformed.program_id,
          ...transformed
        }
      })

      // K-Startup 데이터
      const kstartupRaw = await fetchKStartupPrograms({ perPage: 50 })
      const kstartupPrograms = kstartupRaw.map(p => {
        const transformed = transformKStartupProgram(p)
        return {
          id: transformed.program_id,
          ...transformed
        }
      })

      // 합치기
      let programs = [...bizinfoPrograms, ...kstartupPrograms]

      // 필터 적용
      if (source && source !== 'all') {
        programs = programs.filter(p => p.source === source)
      }
      if (category) {
        programs = programs.filter(p => p.category === category)
      }
      if (supportType) {
        programs = programs.filter(p => p.support_type === supportType)
      }
      if (search) {
        const q = search.toLowerCase()
        programs = programs.filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.organization?.toLowerCase().includes(q)
        )
      }

      // 카테고리 통계
      const allPrograms = [...bizinfoPrograms, ...kstartupPrograms]
      const categoryStats: Record<string, number> = {}
      allPrograms.forEach(p => {
        const cat = p.category || '기타'
        categoryStats[cat] = (categoryStats[cat] || 0) + 1
      })

      return NextResponse.json({
        success: true,
        programs: programs.slice(offset, offset + limit),
        total: programs.length,
        categoryStats,
        sources: {
          bizinfo: bizinfoPrograms.length,
          kstartup: kstartupPrograms.length
        },
        pagination: {
          limit,
          offset,
          hasMore: programs.length > offset + limit
        }
      })
    }

    // DB에서 조회
    let query = supabase
      .from('government_programs')
      .select('*', { count: 'exact' })

    // 필터 적용
    if (category) {
      query = query.eq('category', category)
    }

    if (source) {
      query = query.eq('source', source)
    }

    if (supportType) {
      query = query.eq('support_type', supportType)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,organization.ilike.%${search}%`)
    }

    // 상태별 필터
    const today = new Date().toISOString().split('T')[0]
    if (status === 'active') {
      // 진행중: (마감일 >= 오늘 OR 마감일 null) AND (시작일 <= 오늘 OR 시작일 null)
      // null 날짜는 "알 수 없음"으로 간주하여 진행중에 포함
      query = query.or(`apply_end_date.gte.${today},apply_end_date.is.null`)
      query = query.or(`apply_start_date.lte.${today},apply_start_date.is.null`)
    } else if (status === 'upcoming') {
      // 예정: 시작일 > 오늘 (시작일이 있는 경우만)
      query = query.gt('apply_start_date', today)
    } else if (status === 'ended') {
      // 마감: 마감일 < 오늘 (마감일이 있는 경우만)
      query = query.lt('apply_end_date', today)
    }

    // 정렬 및 페이지네이션
    query = query
      .order('apply_end_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: programs, error, count } = await query

    if (error) {
      console.error('[GovernmentPrograms] DB 조회 오류:', error)
      throw error
    }

    // 카테고리별 통계
    const { data: stats } = await (supabase as any)
      .from('government_programs')
      .select('category') as { data: { category: string }[] | null }

    const categoryStats: Record<string, number> = {}
    stats?.forEach(item => {
      const cat = item.category || '기타'
      categoryStats[cat] = (categoryStats[cat] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      programs: programs || [],
      total: count || 0,
      categoryStats,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error: any) {
    console.error('[GovernmentPrograms] Error:', error)
    return NextResponse.json(
      { error: error.message || '데이터 조회 실패' },
      { status: 500 }
    )
  }
}
