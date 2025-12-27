// @ts-nocheck
/**
 * Neural Map API - Main Routes
 * GET: 사용자의 모든 뉴럴맵 조회
 * POST: 새 뉴럴맵 생성
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/neural-map - 사용자의 뉴럴맵 목록 조회
// ?project_id=xxx 로 특정 프로젝트의 맵만 조회 가능
export async function GET(request: Request) {
  try {
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

    // 🔥 project_id 쿼리 파라미터 확인
    const url = new URL(request.url)
    const projectId = url.searchParams.get('project_id')

    // 🔥 project_id 컬럼이 없을 수 있으므로 먼저 project_id로 시도하고 실패하면 전체 조회
    let data: any[] | null = null
    let error: any = null

    if (projectId) {
      // project_id로 필터링 시도
      const result = await adminSupabase
        .from('neural_maps')
        .select('*')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false })

      if (result.error?.message?.includes('project_id')) {
        // project_id 컬럼이 없으면 전체 조회 (빈 배열 반환으로 새 맵 생성 유도)
        console.log('[NeuralMap] project_id column not found, returning empty for new project')
        data = []
        error = null
      } else {
        data = result.data
        error = result.error
      }
    } else {
      // project_id 없으면 전체 조회
      const result = await adminSupabase
        .from('neural_maps')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('Failed to fetch neural maps:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Neural map GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map - 새 뉴럴맵 생성 (Self 노드 포함)
export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    const { title = 'My Neural Map', agentId, project_id } = body

    // 1. 뉴럴맵 생성 (project_id 컬럼이 없을 수 있음)
    let neuralMap: any = null
    let mapError: any = null

    // 먼저 project_id 포함해서 시도
    const insertData: any = {
      user_id: userId,
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
    }

    // project_id가 있으면 추가 (컬럼 없으면 실패 후 재시도)
    if (project_id) {
      insertData.project_id = project_id
    }

    let result = await adminSupabase
      .from('neural_maps')
      .insert(insertData)
      .select()
      .single()

    // project_id 컬럼이 없어서 실패하면 project_id 없이 재시도
    if (result.error?.message?.includes('project_id')) {
      console.log('[NeuralMap] project_id column not found, creating without it')
      delete insertData.project_id
      result = await adminSupabase
        .from('neural_maps')
        .insert(insertData)
        .select()
        .single()
    }

    neuralMap = result.data
    mapError = result.error

    if (mapError) {
      console.error('Failed to create neural map:', mapError)
      return NextResponse.json({ error: mapError.message }, { status: 500 })
    }

    // 2. Self 노드 생성
    const { data: selfNode, error: nodeError } = await adminSupabase
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
      await adminSupabase.from('neural_maps').delete().eq('id', neuralMap.id)
      return NextResponse.json({ error: nodeError.message }, { status: 500 })
    }

    // 3. root_node_id 업데이트
    const { error: updateError } = await adminSupabase
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
