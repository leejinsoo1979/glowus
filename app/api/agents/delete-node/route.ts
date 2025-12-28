import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { folderName, projectPath, nodeId } = body

    if (!folderName || !nodeId) {
      return NextResponse.json(
        { error: '폴더명과 노드 ID가 필요합니다' },
        { status: 400 }
      )
    }

    const baseDir = projectPath || process.cwd()
    const agentDir = path.join(baseDir, 'agents', folderName)

    // 노드 파일 경로 (nodeId.ts)
    const nodeFile = path.join(agentDir, `${nodeId}.ts`)

    console.log('[API] Deleting node file:', nodeFile)

    // 파일 존재 확인 후 삭제
    try {
      await fs.access(nodeFile)
      await fs.unlink(nodeFile)
      console.log('[API] Node file deleted:', nodeFile)
    } catch (err) {
      // 파일이 없으면 무시 (이미 삭제되었거나 파일 없이 생성된 노드)
      console.log('[API] Node file not found (skipping):', nodeFile)
    }

    // agent.json 업데이트 (노드 제거)
    const agentJsonPath = path.join(agentDir, 'agent.json')
    try {
      const agentJsonContent = await fs.readFile(agentJsonPath, 'utf-8')
      const agentConfig = JSON.parse(agentJsonContent)

      // 노드 제거
      agentConfig.nodes = agentConfig.nodes.filter((n: any) => n.id !== nodeId)
      // 관련 엣지 제거
      agentConfig.edges = agentConfig.edges.filter(
        (e: any) => e.source !== nodeId && e.target !== nodeId
      )
      // 메타데이터 업데이트
      agentConfig.metadata = {
        nodeCount: agentConfig.nodes.length,
        edgeCount: agentConfig.edges.length
      }
      agentConfig.updatedAt = new Date().toISOString()

      await fs.writeFile(agentJsonPath, JSON.stringify(agentConfig, null, 2))
      console.log('[API] agent.json updated')
    } catch (err) {
      console.log('[API] Could not update agent.json:', err)
    }

    return NextResponse.json({
      success: true,
      deletedFile: `${nodeId}.ts`,
      nodeId
    })
  } catch (error: any) {
    console.error('[API] Delete node error:', error)
    return NextResponse.json(
      { error: error.message || '노드 삭제 실패' },
      { status: 500 }
    )
  }
}
