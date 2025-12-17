/**
 * Memory Summary API - 일간/주간/월간 요약 엔드포인트
 *
 * GET: 요약 조회
 * POST: 요약 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createMemoryAnalysisService } from '@/lib/memory'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'daily' | 'weekly' | 'monthly'
    const date = searchParams.get('date') // YYYY-MM-DD for daily
    const year = searchParams.get('year')
    const week = searchParams.get('week')
    const month = searchParams.get('month')

    if (!type) {
      return NextResponse.json(
        { error: 'type 파라미터가 필요합니다. (daily, weekly, monthly)' },
        { status: 400 }
      )
    }

    const analysisService = createMemoryAnalysisService(supabase, user.id)

    let summary

    switch (type) {
      case 'daily':
        if (!date) {
          return NextResponse.json(
            { error: 'daily 타입은 date 파라미터가 필요합니다.' },
            { status: 400 }
          )
        }
        summary = await analysisService.getDailySummary(date)
        break

      case 'weekly':
        if (!year || !week) {
          return NextResponse.json(
            { error: 'weekly 타입은 year, week 파라미터가 필요합니다.' },
            { status: 400 }
          )
        }
        summary = await analysisService.getWeeklySummary(
          parseInt(year, 10),
          parseInt(week, 10)
        )
        break

      case 'monthly':
        if (!year || !month) {
          return NextResponse.json(
            { error: 'monthly 타입은 year, month 파라미터가 필요합니다.' },
            { status: 400 }
          )
        }
        summary = await analysisService.getMonthlySummary(
          parseInt(year, 10),
          parseInt(month, 10)
        )
        break

      default:
        return NextResponse.json({ error: '잘못된 type 값입니다.' }, { status: 400 })
    }

    if (!summary) {
      return NextResponse.json(
        { error: '해당 기간의 요약이 없습니다. POST로 생성해주세요.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error('Memory summary GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, date, year, week, month } = body as {
      type: 'daily' | 'weekly' | 'monthly'
      date?: string
      year?: number
      week?: number
      month?: number
    }

    if (!type) {
      return NextResponse.json(
        { error: 'type 필드가 필요합니다. (daily, weekly, monthly)' },
        { status: 400 }
      )
    }

    const analysisService = createMemoryAnalysisService(supabase, user.id)

    let summary

    switch (type) {
      case 'daily':
        if (!date) {
          return NextResponse.json(
            { error: 'daily 타입은 date 필드가 필요합니다.' },
            { status: 400 }
          )
        }
        summary = await analysisService.generateDailySummary(date)
        break

      case 'weekly':
        if (!year || !week) {
          return NextResponse.json(
            { error: 'weekly 타입은 year, week 필드가 필요합니다.' },
            { status: 400 }
          )
        }
        summary = await analysisService.generateWeeklySummary(year, week)
        break

      case 'monthly':
        if (!year || !month) {
          return NextResponse.json(
            { error: 'monthly 타입은 year, month 필드가 필요합니다.' },
            { status: 400 }
          )
        }
        summary = await analysisService.generateMonthlySummary(year, month)
        break

      default:
        return NextResponse.json({ error: '잘못된 type 값입니다.' }, { status: 400 })
    }

    return NextResponse.json(
      {
        success: true,
        data: summary,
        message: `${type} 요약이 생성되었습니다.`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Memory summary POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
