export const dynamic = 'force-dynamic'

/**
 * 공유 뷰어 API
 * GET/POST/PATCH/DELETE /api/chat/rooms/:roomId/viewer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { SharedMediaType } from '@/types/chat'

// 현재 공유 뷰어 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data, error } = await (supabase as any)
      .from('shared_viewer_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[Viewer API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || null)
  } catch (error) {
    console.error('[Viewer API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '뷰어 조회 실패' },
      { status: 500 }
    )
  }
}

// 새 파일 공유 시작
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { media_type, media_url, media_name, total_pages, duration } = body as {
      media_type: SharedMediaType
      media_url: string
      media_name: string
      total_pages?: number
      duration?: number
    }

    if (!media_type || !media_url || !media_name) {
      return NextResponse.json(
        { error: 'media_type, media_url, media_name이 필요합니다' },
        { status: 400 }
      )
    }

    // 기존 뷰어 상태 삭제 후 새로 생성
    await (supabase as any)
      .from('shared_viewer_state')
      .delete()
      .eq('room_id', roomId)

    const { data, error } = await (supabase as any)
      .from('shared_viewer_state')
      .insert({
        room_id: roomId,
        media_type,
        media_url,
        media_name,
        total_pages: total_pages || null,
        duration: duration || null,
        current_page: 1,
        current_time: 0,
        is_playing: false,
        zoom_level: 1.0,
        presenter_id: user.id,
        presenter_type: 'user',
      })
      .select()
      .single()

    if (error) {
      console.error('[Viewer API] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('[Viewer API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '뷰어 시작 실패' },
      { status: 500 }
    )
  }
}

// 뷰어 상태 업데이트 (페이지 변경, 재생/일시정지, 시간 이동 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { action, page, time, zoom } = body as {
      action: string
      page?: number
      time?: number
      zoom?: number
    }

    // 현재 상태 조회
    const { data: current } = await (supabase as any)
      .from('shared_viewer_state')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (!current) {
      return NextResponse.json({ error: '활성 뷰어가 없습니다' }, { status: 404 })
    }

    let updates: Record<string, any> = {}

    switch (action) {
      case 'page_change':
        if (page !== undefined) {
          updates.current_page = Math.max(1, Math.min(page, current.total_pages || page))
        }
        break

      case 'seek':
        if (time !== undefined) {
          updates.current_time = Math.max(0, Math.min(time, current.duration || time))
        }
        break

      case 'play':
        updates.is_playing = true
        break

      case 'pause':
        updates.is_playing = false
        break

      case 'zoom':
        if (zoom !== undefined) {
          updates.zoom_level = Math.max(0.5, Math.min(zoom, 3.0))
        }
        break

      case 'take_control':
        updates.presenter_id = user.id
        updates.presenter_type = 'user'
        break

      case 'release_control':
        updates.presenter_id = null
        updates.presenter_type = null
        break

      default:
        return NextResponse.json({ error: '알 수 없는 액션입니다' }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from('shared_viewer_state')
      .update(updates)
      .eq('room_id', roomId)
      .select()
      .single()

    if (error) {
      console.error('[Viewer API] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Viewer API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '뷰어 업데이트 실패' },
      { status: 500 }
    )
  }
}

// 공유 중지
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { error } = await (supabase as any)
      .from('shared_viewer_state')
      .delete()
      .eq('room_id', roomId)

    if (error) {
      console.error('[Viewer API] Delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Viewer API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '뷰어 종료 실패' },
      { status: 500 }
    )
  }
}
