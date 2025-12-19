// @ts-nocheck
/**
 * Neural Map Nodes API
 * GET: 특정 맵의 노드 목록 조회
 * POST: 새 노드 생성
 * PATCH: 노드 수정
 * DELETE: 노드 삭제
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

// GET /api/neural-map/[mapId]/nodes
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
      .from('neural_nodes')
      .select('*')
      .eq('map_id', mapId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 타입 정의
    type NodeRow = {
      id: string
      type: string
      title: string
      summary: string | null
      content: string | null
      tags: string[] | null
      importance: number
      parent_id: string | null
      cluster_id: string | null
      source_ref: unknown
      color: string | null
      expanded: boolean
      pinned: boolean
      position: unknown
      stats: unknown
      created_at: string
      updated_at: string
    }

    // 데이터 변환
    const nodes = (data as unknown as NodeRow[]).map((node) => ({
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

    return NextResponse.json(nodes)
  } catch (err) {
    console.error('Nodes GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map/[mapId]/nodes - 새 노드 생성
export async function POST(request: Request, { params }: RouteParams) {
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

    const body = await request.json()
    const {
      type,
      title,
      summary,
      content,
      tags,
      importance,
      parentId,
      clusterId,
      sourceRef,
      color,
      position,
    } = body

    if (!type || !title) {
      return NextResponse.json({ error: 'type and title are required' }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from('neural_nodes')
      .insert({
        map_id: mapId,
        type,
        title,
        summary: summary || null,
        content: content || null,
        tags: tags || [],
        importance: importance || 5,
        parent_id: parentId || null,
        cluster_id: clusterId || null,
        source_ref: sourceRef || null,
        color: color || null,
        position: position || { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50, z: Math.random() * 100 - 50 },
        expanded: false,
        pinned: false,
      } as unknown as never)
      .select()
      .single()

    if (error) {
      console.error('Failed to create node:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 타입 정의
    type NodeRow = {
      id: string
      type: string
      title: string
      summary: string | null
      content: string | null
      tags: string[] | null
      importance: number
      parent_id: string | null
      cluster_id: string | null
      source_ref: unknown
      color: string | null
      expanded: boolean
      pinned: boolean
      position: unknown
      stats: unknown
      created_at: string
      updated_at: string
    }

    // 변환해서 반환
    const nodeData = data as unknown as NodeRow
    const node = {
      id: nodeData.id,
      type: nodeData.type,
      title: nodeData.title,
      summary: nodeData.summary,
      content: nodeData.content,
      tags: nodeData.tags || [],
      importance: nodeData.importance,
      parentId: nodeData.parent_id,
      clusterId: nodeData.cluster_id,
      sourceRef: nodeData.source_ref,
      color: nodeData.color,
      expanded: nodeData.expanded,
      pinned: nodeData.pinned,
      position: nodeData.position,
      stats: nodeData.stats,
      createdAt: nodeData.created_at,
      updatedAt: nodeData.updated_at,
    }

    return NextResponse.json(node, { status: 201 })
  } catch (err) {
    console.error('Nodes POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/neural-map/[mapId]/nodes - 노드 수정
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const adminSupabase = createAdminClient()

    const body = await request.json()
    const { nodeId, ...updates } = body

    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 })
    }

    // 스네이크 케이스로 변환
    const dbUpdates: Record<string, unknown> = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.type !== undefined) dbUpdates.type = updates.type
    if (updates.summary !== undefined) dbUpdates.summary = updates.summary
    if (updates.content !== undefined) dbUpdates.content = updates.content
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags
    if (updates.importance !== undefined) dbUpdates.importance = updates.importance
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId
    if (updates.clusterId !== undefined) dbUpdates.cluster_id = updates.clusterId
    if (updates.sourceRef !== undefined) dbUpdates.source_ref = updates.sourceRef
    if (updates.color !== undefined) dbUpdates.color = updates.color
    if (updates.expanded !== undefined) dbUpdates.expanded = updates.expanded
    if (updates.pinned !== undefined) dbUpdates.pinned = updates.pinned
    if (updates.position !== undefined) dbUpdates.position = updates.position

    const { data, error } = await adminSupabase
      .from('neural_nodes')
      .update(dbUpdates as unknown as never)
      .eq('id', nodeId)
      .eq('map_id', mapId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update node:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 타입 정의
    type NodeRow = {
      id: string
      type: string
      title: string
      summary: string | null
      content: string | null
      tags: string[] | null
      importance: number
      parent_id: string | null
      cluster_id: string | null
      source_ref: unknown
      color: string | null
      expanded: boolean
      pinned: boolean
      position: unknown
      stats: unknown
      created_at: string
      updated_at: string
    }

    // 변환해서 반환
    const nodeData = data as unknown as NodeRow
    const node = {
      id: nodeData.id,
      type: nodeData.type,
      title: nodeData.title,
      summary: nodeData.summary,
      content: nodeData.content,
      tags: nodeData.tags || [],
      importance: nodeData.importance,
      parentId: nodeData.parent_id,
      clusterId: nodeData.cluster_id,
      sourceRef: nodeData.source_ref,
      color: nodeData.color,
      expanded: nodeData.expanded,
      pinned: nodeData.pinned,
      position: nodeData.position,
      stats: nodeData.stats,
      createdAt: nodeData.created_at,
      updatedAt: nodeData.updated_at,
    }

    return NextResponse.json(node)
  } catch (err) {
    console.error('Nodes PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/neural-map/[mapId]/nodes - 노드 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const adminSupabase = createAdminClient()

    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')

    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 })
    }

    // Self 노드는 삭제 불가
    const { data: node } = await adminSupabase
      .from('neural_nodes')
      .select('type')
      .eq('id', nodeId)
      .eq('map_id', mapId)
      .single()

    if (node?.type === 'self') {
      return NextResponse.json({ error: 'Cannot delete self node' }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from('neural_nodes')
      .delete()
      .eq('id', nodeId)
      .eq('map_id', mapId)

    if (error) {
      console.error('Failed to delete node:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Nodes DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
