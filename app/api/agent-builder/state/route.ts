import { NextResponse } from 'next/server'

// 전역 상태 저장소
let currentAgentState: {
  nodes: any[]
  edges: any[]
  selectedNode: any | null
  timestamp: number
} = {
  nodes: [],
  edges: [],
  selectedNode: null,
  timestamp: Date.now(),
}

// 노드별 코드 저장소 (Claude Code가 업데이트한 코드)
const nodeCodeUpdates: Record<string, {
  code: string
  config: Record<string, any>
  updatedAt: number
}> = {}

// GET: 현재 에이전트 빌더 상태 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  // Claude Code 친화적인 포맷
  if (format === 'claude') {
    const selected = currentAgentState.selectedNode

    if (!selected) {
      return NextResponse.json({
        success: true,
        message: '선택된 노드가 없습니다. 에이전트 빌더에서 노드를 클릭하세요.',
        instructions: '노드를 클릭하면 해당 노드의 코드를 수정할 수 있습니다.',
        currentNodes: currentAgentState.nodes.map(n => ({
          id: n.id,
          type: n.type,
          label: n.data?.label,
        })),
      })
    }

    // 선택된 노드의 업데이트된 코드가 있으면 포함
    const pendingUpdate = nodeCodeUpdates[selected.id]

    return NextResponse.json({
      success: true,
      selectedNode: {
        id: selected.id,
        type: selected.type,
        label: selected.data?.label,
        description: selected.data?.description,
        currentCode: selected.data?.code || '',
        currentConfig: {
          model: selected.data?.model,
          temperature: selected.data?.temperature,
          systemPrompt: selected.data?.systemPrompt,
          tools: selected.data?.tools,
          inputType: selected.data?.inputType,
          outputFormat: selected.data?.outputFormat,
          // 기타 설정들
          ...selected.data,
        },
        pendingUpdate: pendingUpdate || null,
      },
      instructions: {
        updateCode: 'POST /api/agent-builder/state 로 code 필드와 함께 nodeId를 보내세요.',
        example: {
          method: 'POST',
          body: {
            action: 'updateNodeCode',
            nodeId: selected.id,
            code: '// 여기에 노드 로직 작성',
            config: { temperature: 0.7 },
          },
        },
      },
      totalNodes: currentAgentState.nodes.length,
      totalEdges: currentAgentState.edges.length,
    })
  }

  // 기본 포맷
  return NextResponse.json({
    success: true,
    data: currentAgentState,
    pendingUpdates: nodeCodeUpdates,
    message: '현재 에이전트 빌더 상태입니다.',
  })
}

// POST: 에이전트 빌더 상태 업데이트 또는 노드 코드 업데이트
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Claude Code가 노드 코드를 업데이트하는 경우
    if (body.action === 'updateNodeCode') {
      const { nodeId, code, config } = body

      if (!nodeId) {
        return NextResponse.json(
          { success: false, error: 'nodeId가 필요합니다.' },
          { status: 400 }
        )
      }

      nodeCodeUpdates[nodeId] = {
        code: code || '',
        config: config || {},
        updatedAt: Date.now(),
      }

      return NextResponse.json({
        success: true,
        message: `노드 ${nodeId}의 코드가 업데이트되었습니다. UI에서 "적용" 버튼을 클릭하면 반영됩니다.`,
        data: nodeCodeUpdates[nodeId],
      })
    }

    // UI에서 상태를 동기화하는 경우
    currentAgentState = {
      nodes: body.nodes || [],
      edges: body.edges || [],
      selectedNode: body.selectedNode || null,
      timestamp: Date.now(),
    }

    return NextResponse.json({
      success: true,
      message: '에이전트 상태가 업데이트되었습니다.',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '상태 업데이트 실패' },
      { status: 400 }
    )
  }
}

// 펜딩 업데이트 조회 (UI에서 폴링)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { nodeId } = body

    if (nodeId && nodeCodeUpdates[nodeId]) {
      const update = nodeCodeUpdates[nodeId]
      // 업데이트 적용 후 삭제
      delete nodeCodeUpdates[nodeId]

      return NextResponse.json({
        success: true,
        hasUpdate: true,
        data: update,
      })
    }

    return NextResponse.json({
      success: true,
      hasUpdate: false,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '업데이트 확인 실패' },
      { status: 400 }
    )
  }
}
