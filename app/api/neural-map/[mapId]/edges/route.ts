// @ts-nocheck
/**
 * Neural Map Edges API
 * GET: 특정 맵의 엣지 목록 조회
 * POST: 새 엣지 생성
 * DELETE: 엣지 삭제
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

interface RouteParams {
  params: Promise<{ mapId: string }>
}

// GET /api/neural-map/[mapId]/edges
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    let userId: string
    if (DEV_MODE) {
      userId = DEV_USER_ID
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await adminSupabase
      .from('neural_maps')
      .select('id')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single()

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    const { data, error } = await adminSupabase
      .from('neural_edges')
      .select('*')
      .eq('map_id', mapId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 데이터 변환
    const edges = (data as unknown as Array<{
      id: string
      source_id: string
      target_id: string
      type: string
      weight: number
      label: string | null
      bidirectional: boolean
      evidence: unknown
      created_at: string
    }>).map((edge) => ({
      id: edge.id,
      source: edge.source_id,
      target: edge.target_id,
      sourceId: edge.source_id,
      targetId: edge.target_id,
      type: edge.type,
      weight: edge.weight,
      strength: edge.weight,
      label: edge.label,
      bidirectional: edge.bidirectional,
      evidence: edge.evidence,
      createdAt: edge.created_at,
    }))

    return NextResponse.json(edges)
  } catch (err) {
    console.error('Edges GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map/[mapId]/edges - 새 엣지 생성
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 맵 소유권 확인
    const { data: neuralMap } = await supabase
      .from('neural_maps')
      .select('id')
      .eq('id', mapId)
      .eq('user_id', user.id)
      .single()

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      sourceId,
      targetId,
      type,
      weight = 0.5,
      label,
      bidirectional = false,
      evidence,
    } = body

    if (!sourceId || !targetId || !type) {
      return NextResponse.json(
        { error: 'sourceId, targetId, and type are required' },
        { status: 400 }
      )
    }

    // 중복 엣지 확인
    const { data: existing } = await supabase
      .from('neural_edges')
      .select('id')
      .eq('map_id', mapId)
      .eq('source_id', sourceId)
      .eq('target_id', targetId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Edge already exists' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('neural_edges')
      .insert({
        map_id: mapId,
        source_id: sourceId,
        target_id: targetId,
        type,
        weight,
        label: label || null,
        bidirectional,
        evidence: evidence || null,
      } as unknown as never)
      .select()
      .single()

    if (error) {
      console.error('Failed to create edge:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 변환해서 반환
    const edgeData = data as unknown as {
      id: string
      source_id: string
      target_id: string
      type: string
      weight: number
      label: string | null
      bidirectional: boolean
      evidence: unknown
      created_at: string
    }
    const edge = {
      id: edgeData.id,
      source: edgeData.source_id,
      target: edgeData.target_id,
      sourceId: edgeData.source_id,
      targetId: edgeData.target_id,
      type: edgeData.type,
      weight: edgeData.weight,
      strength: edgeData.weight,
      label: edgeData.label,
      bidirectional: edgeData.bidirectional,
      evidence: edgeData.evidence,
      createdAt: edgeData.created_at,
    }

    return NextResponse.json(edge, { status: 201 })
  } catch (err) {
    console.error('Edges POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/neural-map/[mapId]/edges - 엣지 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const edgeId = searchParams.get('edgeId')

    if (!edgeId) {
      return NextResponse.json({ error: 'edgeId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('neural_edges')
      .delete()
      .eq('id', edgeId)
      .eq('map_id', mapId)

    if (error) {
      console.error('Failed to delete edge:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Edges DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
