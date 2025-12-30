/**
 * Context Pack API
 *
 * POST /api/neural-map/[mapId]/context-pack
 * - StateQuery를 받아서 ContextPack 생성
 *
 * GET /api/neural-map/[mapId]/context-pack?projectId=xxx&taskId=yyy
 * - Query params로 간단하게 Context Pack 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { StateBuilder, formatContextPackForAI } from '@/lib/neural-map/state-builder'
import type { StateQuery, ContextPackOptions, NeuralGraph } from '@/lib/neural-map/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  try {
    const { mapId } = await params
    const body = await request.json()
    const { query, options, format } = body as {
      query: StateQuery
      options?: ContextPackOptions
      format?: 'json' | 'ai'
    }

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Neural Map 조회
    const { data: map, error: mapError } = await supabase
      .from('neural_maps')
      .select('*')
      .eq('id', mapId)
      .single()

    if (mapError || !map) {
      return NextResponse.json(
        { error: 'Neural map not found' },
        { status: 404 }
      )
    }

    // Graph 데이터 파싱
    const mapData = map as { graph_data?: NeuralGraph }
    const graph = (mapData.graph_data || { nodes: [], edges: [], clusters: [] }) as NeuralGraph

    // State Builder로 Context Pack 생성
    const builder = new StateBuilder(graph)
    const pack = builder.buildContextPack(query, options)

    // 포맷에 따라 반환
    if (format === 'ai') {
      const aiPrompt = formatContextPackForAI(pack)
      return NextResponse.json({
        pack,
        aiPrompt,
      })
    }

    return NextResponse.json(pack)
  } catch (error) {
    console.error('Context pack generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate context pack' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  try {
    const { mapId } = await params
    const { searchParams } = new URL(request.url)

    // Query params에서 StateQuery 구성
    const query: StateQuery = {
      projectId: searchParams.get('projectId') || undefined,
      taskId: searchParams.get('taskId') || undefined,
      role: searchParams.get('role') || undefined,
      stage: (searchParams.get('stage') as StateQuery['stage']) || undefined,
      keywords: searchParams.get('keywords')?.split(',') || undefined,
    }

    // constraints 파싱
    type ConstraintsType = NonNullable<StateQuery['constraints']>
    const time = searchParams.get('time') as ConstraintsType['time']
    const cost = searchParams.get('cost') as ConstraintsType['cost']
    const quality = searchParams.get('quality') as ConstraintsType['quality']

    if (time || cost || quality) {
      query.constraints = { time, cost, quality }
    }

    const format = searchParams.get('format') as 'json' | 'ai' | null

    const supabase = await createClient()

    // Neural Map 조회
    const { data: map, error: mapError } = await supabase
      .from('neural_maps')
      .select('*')
      .eq('id', mapId)
      .single()

    if (mapError || !map) {
      return NextResponse.json(
        { error: 'Neural map not found' },
        { status: 404 }
      )
    }

    // Graph 데이터 파싱
    const mapData = map as { graph_data?: NeuralGraph }
    const graph = (mapData.graph_data || { nodes: [], edges: [], clusters: [] }) as NeuralGraph

    // State Builder로 Context Pack 생성
    const builder = new StateBuilder(graph)
    const pack = builder.buildContextPack(query)

    // 포맷에 따라 반환
    if (format === 'ai') {
      const aiPrompt = formatContextPackForAI(pack)
      return NextResponse.json({
        pack,
        aiPrompt,
      })
    }

    return NextResponse.json(pack)
  } catch (error) {
    console.error('Context pack generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate context pack' },
      { status: 500 }
    )
  }
}
