// @ts-nocheck
/**
 * Neural Map API - Single Map Routes
 * GET: 특정 뉴럴맵 전체 데이터 조회 (노드, 엣지, 클러스터 포함)
 * PATCH: 뉴럴맵 메타데이터 수정
 * DELETE: 뉴럴맵 삭제
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

// GET /api/neural-map/[mapId] - 뉴럴맵 전체 데이터 조회
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

    // 뉴럴맵 기본 정보 조회
    const { data: neuralMap, error: mapError } = await adminSupabase
      .from('neural_maps')
      .select('*')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single()

    if (mapError || !neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    // 병렬로 노드, 엣지, 클러스터, 파일 조회
    const [nodesRes, edgesRes, clustersRes, filesRes] = await Promise.all([
      adminSupabase
        .from('neural_nodes')
        .select('*')
        .eq('map_id', mapId)
        .order('created_at', { ascending: true }),
      adminSupabase
        .from('neural_edges')
        .select('*')
        .eq('map_id', mapId),
      adminSupabase
        .from('neural_clusters')
        .select('*')
        .eq('map_id', mapId),
      adminSupabase
        .from('neural_files')
        .select('*')
        .eq('map_id', mapId)
        .order('created_at', { ascending: false }),
    ])

    // 노드 데이터 변환
    const nodes = (nodesRes.data || []).map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      summary: node.summary,
      content: node.content,
      tags: node.tags || [],
      importance: node.importance,
      parentId: node.parent_id,
      clusterId: node.cluster_id,
      sourceRef: node.source_ref,
      color: node.color,
      expanded: node.expanded,
      pinned: node.pinned,
      position: node.position,
      stats: node.stats,
      createdAt: node.created_at,
      updatedAt: node.updated_at,
    }))

    // 엣지 데이터 변환
    const edges = (edgesRes.data || []).map((edge) => ({
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

    // 클러스터 데이터 변환
    const clusters = (clustersRes.data || []).map((cluster) => ({
      id: cluster.id,
      title: cluster.title,
      description: cluster.description,
      color: cluster.color,
      keywords: cluster.keywords || [],
      cohesion: cluster.cohesion,
      centerNodeId: cluster.center_node_id,
      createdAt: cluster.created_at,
    }))

    // 파일 데이터 변환
    const files = (filesRes.data || []).map((file) => ({
      id: file.id,
      mapId: file.map_id,
      name: file.name,
      type: file.type,
      url: file.url,
      size: file.size,
      createdAt: file.created_at,
    }))

    // NeuralGraph 형식으로 반환
    const graph = {
      version: '2.0',
      userId: userId,
      agentId: neuralMap.agent_id,
      rootNodeId: neuralMap.root_node_id,
      title: neuralMap.title,
      nodes,
      edges,
      clusters,
      viewState: neuralMap.view_state || {
        activeTab: 'radial',
        expandedNodeIds: [],
        pinnedNodeIds: [],
        selectedNodeIds: [],
        cameraPosition: { x: 0, y: 50, z: 200 },
        cameraTarget: { x: 0, y: 0, z: 0 },
      },
      themeId: neuralMap.theme_id,
      createdAt: neuralMap.created_at,
      updatedAt: neuralMap.updated_at,
    }

    return NextResponse.json({ graph, files })
  } catch (err) {
    console.error('Neural map GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/neural-map/[mapId] - 뉴럴맵 메타데이터 수정
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const body = await request.json()
    const { title, themeId, viewState } = body

    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (themeId !== undefined) updates.theme_id = themeId
    if (viewState !== undefined) updates.view_state = viewState

    const { data, error } = await adminSupabase
      .from('neural_maps')
      .update(updates)
      .eq('id', mapId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update neural map:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Neural map PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/neural-map/[mapId] - 뉴럴맵 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
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

    const { error } = await adminSupabase
      .from('neural_maps')
      .delete()
      .eq('id', mapId)
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to delete neural map:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Neural map DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
