/**
 * Blueprint API - Agent 연동용
 *
 * GET: Blueprint 노드 목록 조회 (AgentPlan 형태로)
 * POST: AgentPlan에서 Blueprint 생성
 * PATCH: Blueprint 노드 상태 업데이트
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import {
  neuralNodeToBlueprintNode,
  blueprintNodesToAgentPlan,
  agentTaskToNodeTags,
  taskStatusToBlueprintStatus,
  calculateBlueprintProgress,
  type BlueprintNode,
  type BlueprintStatus,
} from '@/lib/neural-map/blueprint-sync'
import type { NeuralNode, AgentPlan, AgentTask } from '@/lib/neural-map/types'

const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

interface RouteParams {
  params: Promise<{ mapId: string }>
}

// GET /api/neural-map/[mapId]/blueprint
// Blueprint 노드들을 AgentPlan 형태로 반환
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
      .select('id, title')
      .eq('id', mapId)
      .eq('user_id', userId)
      .single() as { data: { id: string; title: string } | null }

    if (!neuralMap) {
      return NextResponse.json({ error: 'Neural map not found' }, { status: 404 })
    }

    // Blueprint 노드들 조회 (pipeline 태그가 있는 노드들)
    const { data, error } = await adminSupabase
      .from('neural_nodes')
      .select('*')
      .eq('map_id', mapId)
      .contains('tags', ['pipeline'])
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // NeuralNode → BlueprintNode 변환
    const nodes = (data || []) as unknown as NeuralNode[]
    const blueprintNodes: BlueprintNode[] = nodes.map((node, index) =>
      neuralNodeToBlueprintNode(node, index)
    )

    // AgentPlan 형태로 변환
    const plan = blueprintNodesToAgentPlan(blueprintNodes)

    // 진행률 계산
    const progress = calculateBlueprintProgress(blueprintNodes)

    return NextResponse.json({
      mapId,
      mapTitle: neuralMap.title,
      plan,
      nodes: blueprintNodes,
      progress,
    })
  } catch (err) {
    console.error('Blueprint GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/neural-map/[mapId]/blueprint
// AgentPlan에서 Blueprint 노드들 생성
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
    const { plan } = body as { plan: AgentPlan }

    if (!plan?.tasks?.length) {
      return NextResponse.json({ error: 'Plan with tasks is required' }, { status: 400 })
    }

    const createdNodes: BlueprintNode[] = []

    // 각 task에 대해 Blueprint 노드 생성
    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i]

      const { data, error } = await adminSupabase
        .from('neural_nodes')
        .insert({
          map_id: mapId,
          type: 'task',
          title: task.description.split(':')[0].trim().slice(0, 100),
          summary: task.description,
          tags: agentTaskToNodeTags(task),
          importance: 5,
          position: { x: i * 300, y: 0, z: 0 },
          expanded: false,
          pinned: false,
        } as unknown as never)
        .select()
        .single()

      if (error) {
        console.error('Failed to create blueprint node:', error)
        continue
      }

      const nodeData = data as unknown as NeuralNode
      createdNodes.push({
        id: nodeData.id,
        type: 'feature',
        title: nodeData.title,
        description: task.description,
        status: taskStatusToBlueprintStatus(task.status),
        position: i,
        taskId: task.id,
        files: task.files,
      })
    }

    // 시퀀스 엣지 생성 (노드들을 연결)
    for (let i = 0; i < createdNodes.length - 1; i++) {
      await adminSupabase
        .from('neural_edges')
        .insert({
          map_id: mapId,
          source_id: createdNodes[i].id,
          target_id: createdNodes[i + 1].id,
          type: 'sequence',
          weight: 1,
          bidirectional: false,
        } as unknown as never)
    }

    const progress = calculateBlueprintProgress(createdNodes)

    return NextResponse.json({
      success: true,
      nodes: createdNodes,
      progress,
    }, { status: 201 })
  } catch (err) {
    console.error('Blueprint POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/neural-map/[mapId]/blueprint
// Blueprint 노드 상태 업데이트
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { mapId } = await params
    const adminSupabase = createAdminClient()

    const body = await request.json()
    const { nodeId, status, gitCommit, gitBranch, actualHours } = body as {
      nodeId: string
      status?: BlueprintStatus
      gitCommit?: string
      gitBranch?: string
      actualHours?: number
    }

    if (!nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 })
    }

    // 현재 노드 가져오기
    const { data: currentNode, error: fetchError } = await adminSupabase
      .from('neural_nodes')
      .select('*')
      .eq('id', nodeId)
      .eq('map_id', mapId)
      .single()

    if (fetchError || !currentNode) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    const nodeData = currentNode as unknown as NeuralNode

    // 태그 업데이트
    let tags = [...(nodeData.tags || [])]

    // 상태 태그 업데이트
    if (status) {
      tags = tags.filter(t => !['done', 'doing', 'todo'].includes(t))
      tags.push(status)
    }

    // Git 커밋 태그 추가
    if (gitCommit) {
      tags = tags.filter(t => !t.startsWith('commit:'))
      tags.push(`commit:${gitCommit}`)
    }

    // Git 브랜치 태그 추가
    if (gitBranch) {
      tags = tags.filter(t => !t.startsWith('branch:'))
      tags.push(`branch:${gitBranch}`)
    }

    // 노드 업데이트
    const updateData: Record<string, unknown> = { tags }

    // 완료 시 실제 소요 시간 기록 (summary에 추가)
    if (status === 'done' && actualHours) {
      updateData.summary = `${nodeData.summary || ''}\n\n⏱️ 실제 소요: ${actualHours}h`
    }

    const { data, error } = await adminSupabase
      .from('neural_nodes')
      .update(updateData as unknown as never)
      .eq('id', nodeId)
      .eq('map_id', mapId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update blueprint node:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 전체 진행률 다시 계산
    const { data: allNodes } = await adminSupabase
      .from('neural_nodes')
      .select('*')
      .eq('map_id', mapId)
      .contains('tags', ['pipeline'])

    const blueprintNodes = ((allNodes || []) as unknown as NeuralNode[]).map((node, index) =>
      neuralNodeToBlueprintNode(node, index)
    )
    const progress = calculateBlueprintProgress(blueprintNodes)

    return NextResponse.json({
      success: true,
      node: data,
      progress,
    })
  } catch (err) {
    console.error('Blueprint PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
