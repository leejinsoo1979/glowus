// @ts-nocheck
/**
 * Neural Map API - Main Routes
 * GET: 사용자의 모든 뉴럴맵 조회
 * POST: 새 뉴럴맵 생성
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/neural-map - 사용자의 뉴럴맵 목록 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('neural_maps')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch neural maps:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Neural map GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map - 새 뉴럴맵 생성 (Self 노드 포함)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title = 'My Neural Map', agentId } = body

    // 1. 뉴럴맵 생성
    const { data: neuralMap, error: mapError } = await supabase
      .from('neural_maps')
      .insert({
        user_id: user.id,
        agent_id: agentId || null,
        title,
        theme_id: 'cosmic-dark',
        view_state: {
          activeTab: 'radial',
          expandedNodeIds: [],
          pinnedNodeIds: [],
          selectedNodeIds: [],
          cameraPosition: { x: 0, y: 50, z: 200 },
          cameraTarget: { x: 0, y: 0, z: 0 },
        },
      })
      .select()
      .single()

    if (mapError) {
      console.error('Failed to create neural map:', mapError)
      return NextResponse.json({ error: mapError.message }, { status: 500 })
    }

    // 2. Self 노드 생성
    const { data: selfNode, error: nodeError } = await supabase
      .from('neural_nodes')
      .insert({
        map_id: neuralMap.id,
        type: 'self',
        title: 'SELF',
        summary: '나의 중심 노드',
        importance: 10,
        expanded: true,
        pinned: true,
        position: { x: 0, y: 0, z: 0 },
      })
      .select()
      .single()

    if (nodeError) {
      console.error('Failed to create self node:', nodeError)
      // 롤백: 맵 삭제
      await supabase.from('neural_maps').delete().eq('id', neuralMap.id)
      return NextResponse.json({ error: nodeError.message }, { status: 500 })
    }

    // 3. root_node_id 업데이트
    const { error: updateError } = await supabase
      .from('neural_maps')
      .update({ root_node_id: selfNode.id })
      .eq('id', neuralMap.id)

    if (updateError) {
      console.error('Failed to update root_node_id:', updateError)
    }

    return NextResponse.json({
      ...neuralMap,
      root_node_id: selfNode.id,
    }, { status: 201 })
  } catch (err) {
    console.error('Neural map POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
