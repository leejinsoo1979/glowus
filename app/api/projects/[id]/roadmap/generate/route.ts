import { createClientForApi, getAuthUser, DEV_USER } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateRoadmap, calculateNodePositions } from '@/lib/langchain/roadmap-generator'

// POST /api/projects/[id]/roadmap/generate - AI로 로드맵 생성
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClientForApi()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = params.id
    const body = await request.json()
    const { customInstructions, clearExisting } = body

    // 프로젝트 정보 가져오기
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, description, status, deadline')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 기존 태스크 정보 가져오기 (참고용)
    const { data: existingTasks } = await supabase
      .from('project_tasks')
      .select('title, status')
      .eq('project_id', projectId)
      .limit(20)

    // 기존 로드맵 삭제 (옵션)
    if (clearExisting) {
      // 먼저 의존성 삭제
      const { data: existingNodes } = await (supabase as any)
        .from('roadmap_nodes')
        .select('id')
        .eq('project_id', projectId)

      if (existingNodes && existingNodes.length > 0) {
        const nodeIds = existingNodes.map((n: any) => n.id)
        await (supabase as any)
          .from('node_dependencies')
          .delete()
          .or(`source_node_id.in.(${nodeIds.join(',')}),target_node_id.in.(${nodeIds.join(',')})`)

        // 노드 삭제
        await (supabase as any)
          .from('roadmap_nodes')
          .delete()
          .eq('project_id', projectId)
      }
    }

    // AI로 로드맵 생성
    console.log('[AI Roadmap] Generating roadmap for project:', project.name)
    const generatedRoadmap = await generateRoadmap({
      projectName: project.name,
      projectDescription: project.description || '',
      deadline: project.deadline || undefined,
      existingTasks: existingTasks || [],
      customInstructions,
    })

    console.log('[AI Roadmap] Generated nodes:', generatedRoadmap.nodes.length)

    // 노드 위치 계산
    const positions = calculateNodePositions(generatedRoadmap.nodes)
    const positionMap = new Map(positions.map(p => [p.id, { x: p.x, y: p.y }]))

    // 노드 ID 매핑 (임시 ID -> 실제 DB ID)
    const idMapping = new Map<string, string>()

    // 노드 생성
    const createdNodes = []
    for (const node of generatedRoadmap.nodes) {
      const position = positionMap.get(node.id) || { x: 100, y: 100 }

      const insertData: any = {
        project_id: projectId,
        title: node.title,
        description: `[${node.phase}] ${node.description}`,
        goal: node.goal,
        position_x: position.x,
        position_y: position.y,
        agent_type: node.agent_type,
        automation_level: node.automation_level,
        priority: node.priority,
        estimated_hours: node.estimated_hours,
        status: 'pending',
      }

      if (!DEV_USER) {
        insertData.created_by = user.id
      }

      const { data: createdNode, error: nodeError } = await (supabase as any)
        .from('roadmap_nodes')
        .insert(insertData)
        .select()
        .single()

      if (nodeError) {
        console.error('[AI Roadmap] Node creation error:', nodeError)
        continue
      }

      idMapping.set(node.id, createdNode.id)
      createdNodes.push({
        tempId: node.id,
        node: createdNode,
        depends_on: node.depends_on,
      })
    }

    // 의존성(엣지) 생성
    const createdEdges = []
    for (const { tempId, node, depends_on } of createdNodes) {
      for (const depTempId of depends_on) {
        const sourceId = idMapping.get(depTempId)
        const targetId = node.id

        if (sourceId && targetId) {
          const { data: edge, error: edgeError } = await (supabase as any)
            .from('node_dependencies')
            .insert({
              source_node_id: sourceId,
              target_node_id: targetId,
              dependency_type: 'required',
            })
            .select()
            .single()

          if (!edgeError && edge) {
            createdEdges.push(edge)
          }
        }
      }
    }

    // React Flow 형식으로 변환
    const flowNodes = createdNodes.map(({ node }) => ({
      id: node.id,
      type: 'roadmapNode',
      position: { x: node.position_x, y: node.position_y },
      data: {
        ...node,
        label: node.title,
      },
    }))

    const flowEdges = createdEdges.map((edge: any) => ({
      id: edge.id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      type: 'smoothstep',
      animated: true,
      data: {
        dependency_type: edge.dependency_type,
      },
    }))

    console.log('[AI Roadmap] Created', flowNodes.length, 'nodes and', flowEdges.length, 'edges')

    return NextResponse.json({
      success: true,
      nodes: flowNodes,
      edges: flowEdges,
      summary: generatedRoadmap.summary,
      phases: generatedRoadmap.phases,
      totalEstimatedHours: generatedRoadmap.totalEstimatedHours,
    })
  } catch (error) {
    console.error('[AI Roadmap] Generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate roadmap', details: String(error) },
      { status: 500 }
    )
  }
}
