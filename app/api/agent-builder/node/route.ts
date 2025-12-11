import { NextResponse } from 'next/server'

// 노드별 코드 저장소
const nodeCodeStore: Record<string, {
  code: string
  config: Record<string, any>
  updatedAt: number
  updatedBy: string
}> = {}

// GET: 특정 노드의 코드/설정 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')

  if (!nodeId) {
    return NextResponse.json(
      { success: false, error: 'nodeId가 필요합니다.' },
      { status: 400 }
    )
  }

  const nodeData = nodeCodeStore[nodeId]

  return NextResponse.json({
    success: true,
    data: nodeData || { code: '', config: {}, updatedAt: null, updatedBy: null },
    message: nodeData ? '노드 데이터를 찾았습니다.' : '저장된 데이터가 없습니다.',
  })
}

// POST: 노드 코드/설정 업데이트 (Claude Code에서 호출)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nodeId, code, config, updatedBy = 'claude-code' } = body

    if (!nodeId) {
      return NextResponse.json(
        { success: false, error: 'nodeId가 필요합니다.' },
        { status: 400 }
      )
    }

    nodeCodeStore[nodeId] = {
      code: code || nodeCodeStore[nodeId]?.code || '',
      config: { ...nodeCodeStore[nodeId]?.config, ...config },
      updatedAt: Date.now(),
      updatedBy,
    }

    return NextResponse.json({
      success: true,
      message: `노드 ${nodeId}가 업데이트되었습니다.`,
      data: nodeCodeStore[nodeId],
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '노드 업데이트 실패' },
      { status: 400 }
    )
  }
}

// DELETE: 노드 코드 삭제
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')

  if (!nodeId) {
    return NextResponse.json(
      { success: false, error: 'nodeId가 필요합니다.' },
      { status: 400 }
    )
  }

  delete nodeCodeStore[nodeId]

  return NextResponse.json({
    success: true,
    message: `노드 ${nodeId}가 삭제되었습니다.`,
  })
}
