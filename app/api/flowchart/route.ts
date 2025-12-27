/**
 * Flowchart 제어 API
 * 에이전트가 Flowchart(ReactFlow)를 조작할 때 사용
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FlowchartNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: { label: string; [key: string]: unknown }
  style?: Record<string, unknown>
}

interface FlowchartEdge {
  id: string
  source: string
  target: string
  type?: string
  label?: string
  animated?: boolean
  style?: Record<string, unknown>
}

// Flowchart ID 생성 (프로젝트 경로 기반)
function generateFlowchartId(projectPath: string): string {
  return Buffer.from(encodeURIComponent(projectPath))
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 50)
}

// 노드 모양 → 타입 매핑
const SHAPE_TO_TYPE: Record<string, string> = {
  rectangle: 'process',
  round: 'terminal',
  diamond: 'decision',
  circle: 'circle',
  stadium: 'terminal',
}

// GET: Flowchart 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectPath = searchParams.get('projectPath')
    const flowchartId = searchParams.get('flowchartId')

    const id = flowchartId || (projectPath ? generateFlowchartId(projectPath) : null)

    if (!id) {
      return NextResponse.json(
        { error: 'projectPath 또는 flowchartId가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('flowcharts')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Supabase 타입 단언
    const flowchartData = data as { nodes?: FlowchartNode[]; edges?: FlowchartEdge[]; updated_at?: string } | null

    return NextResponse.json({
      success: true,
      flowchartId: id,
      nodes: flowchartData?.nodes || [],
      edges: flowchartData?.edges || [],
      updatedAt: flowchartData?.updated_at,
    })

  } catch (error: any) {
    console.error('[Flowchart API] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Flowchart 조회 실패' },
      { status: 500 }
    )
  }
}

// POST: Flowchart 노드/엣지 추가 또는 전체 업데이트
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectPath,
      flowchartId: providedId,
      action,
      // 노드 관련
      nodeId,
      label,
      shape,
      style,
      position,
      // 엣지 관련
      sourceId,
      targetId,
      edgeType,
      edgeLabel,
      // 전체 업데이트용
      nodes,
      edges,
    } = body

    const flowchartId = providedId || (projectPath ? generateFlowchartId(projectPath) : null)

    if (!flowchartId) {
      return NextResponse.json(
        { error: 'projectPath 또는 flowchartId가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 현재 데이터 조회
    const { data: existing } = await supabase
      .from('flowcharts')
      .select('*')
      .eq('id', flowchartId)
      .single()

    // Supabase 타입 단언
    const existingData = existing as { nodes?: FlowchartNode[]; edges?: FlowchartEdge[] } | null
    let currentNodes: FlowchartNode[] = existingData?.nodes || []
    let currentEdges: FlowchartEdge[] = existingData?.edges || []

    switch (action) {
      case 'create_node': {
        // 새 노드 생성
        const newNode: FlowchartNode = {
          id: nodeId || `node_${Date.now()}`,
          type: SHAPE_TO_TYPE[shape] || shape || 'process',
          position: position || { x: Math.random() * 500, y: Math.random() * 400 },
          data: { label: label || 'New Node' },
        }
        if (style) {
          newNode.style = typeof style === 'string'
            ? parseStyle(style)
            : style
        }
        currentNodes.push(newNode)
        break
      }

      case 'update_node': {
        // 노드 수정
        const idx = currentNodes.findIndex(n => n.id === nodeId)
        if (idx === -1) {
          return NextResponse.json(
            { error: `노드를 찾을 수 없습니다: ${nodeId}` },
            { status: 404 }
          )
        }
        if (label) currentNodes[idx].data.label = label
        if (shape) currentNodes[idx].type = SHAPE_TO_TYPE[shape] || shape
        if (position) currentNodes[idx].position = position
        if (style) {
          currentNodes[idx].style = typeof style === 'string'
            ? parseStyle(style)
            : style
        }
        break
      }

      case 'delete_node': {
        // 노드 삭제 (연결된 엣지도 삭제)
        currentNodes = currentNodes.filter(n => n.id !== nodeId)
        currentEdges = currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId)
        break
      }

      case 'create_edge': {
        // 새 엣지 생성
        if (!sourceId || !targetId) {
          return NextResponse.json(
            { error: 'sourceId와 targetId가 필요합니다.' },
            { status: 400 }
          )
        }
        const newEdge: FlowchartEdge = {
          id: `edge_${sourceId}_${targetId}_${Date.now()}`,
          source: sourceId,
          target: targetId,
          type: edgeType || 'smoothstep',
          animated: true,
        }
        if (edgeLabel) newEdge.label = edgeLabel
        currentEdges.push(newEdge)
        break
      }

      case 'delete_edge': {
        // 엣지 삭제
        currentEdges = currentEdges.filter(
          e => !(e.source === sourceId && e.target === targetId)
        )
        break
      }

      case 'update_full': {
        // 전체 업데이트
        if (nodes) currentNodes = nodes
        if (edges) currentEdges = edges
        break
      }

      default:
        return NextResponse.json(
          { error: `알 수 없는 action: ${action}` },
          { status: 400 }
        )
    }

    // DB에 저장 (Supabase 타입 단언)
    const { error } = await supabase
      .from('flowcharts')
      .upsert({
        id: flowchartId,
        project_path: projectPath,
        nodes: currentNodes,
        edges: currentEdges,
        updated_at: new Date().toISOString(),
      } as never)

    if (error) throw error

    return NextResponse.json({
      success: true,
      flowchartId,
      action,
      nodes: currentNodes,
      edges: currentEdges,
    })

  } catch (error: any) {
    console.error('[Flowchart API] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Flowchart 업데이트 실패' },
      { status: 500 }
    )
  }
}

// DELETE: 노드 또는 엣지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectPath = searchParams.get('projectPath')
    const flowchartId = searchParams.get('flowchartId')
    const nodeId = searchParams.get('nodeId')
    const sourceId = searchParams.get('sourceId')
    const targetId = searchParams.get('targetId')

    const id = flowchartId || (projectPath ? generateFlowchartId(projectPath) : null)

    if (!id) {
      return NextResponse.json(
        { error: 'projectPath 또는 flowchartId가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('flowcharts')
      .select('*')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json(
        { error: 'Flowchart를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Supabase 타입 단언
    const existingData = existing as { nodes?: FlowchartNode[]; edges?: FlowchartEdge[] }
    let nodes: FlowchartNode[] = existingData.nodes || []
    let edges: FlowchartEdge[] = existingData.edges || []

    if (nodeId) {
      // 노드 삭제
      nodes = nodes.filter(n => n.id !== nodeId)
      edges = edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    } else if (sourceId && targetId) {
      // 엣지 삭제
      edges = edges.filter(e => !(e.source === sourceId && e.target === targetId))
    } else {
      return NextResponse.json(
        { error: 'nodeId 또는 (sourceId, targetId)가 필요합니다.' },
        { status: 400 }
      )
    }

    // DB에 저장 (Supabase 타입 단언)
    const { error } = await supabase
      .from('flowcharts')
      .update({
        nodes,
        edges,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      flowchartId: id,
      deletedNode: nodeId || null,
      deletedEdge: (sourceId && targetId) ? `${sourceId} → ${targetId}` : null,
    })

  } catch (error: any) {
    console.error('[Flowchart API] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Flowchart 삭제 실패' },
      { status: 500 }
    )
  }
}

// CSS 스타일 문자열 파싱
function parseStyle(styleStr: string): Record<string, string> {
  const style: Record<string, string> = {}
  styleStr.split(';').forEach(pair => {
    const [key, value] = pair.split(':').map(s => s.trim())
    if (key && value) {
      // CSS 속성을 camelCase로 변환
      const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      style[camelKey] = value
    }
  })
  return style
}
