// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// 타입 정의
interface ProjectData {
  id: string
  user_id: string
  company_id: string | null
  title: string
  type: string
  status: string
  content: string
  sources: unknown[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// GET - 프로젝트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const projectId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 특정 프로젝트 조회 (전체 데이터 포함)
    if (projectId) {
      const { data, error } = await supabase
        .from('ai_studio_sessions')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('[AI Studio API] GET project error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data })
    }

    // 프로젝트 목록 조회 (요약 정보만)
    const { data, error } = await supabase
      .from('ai_studio_sessions')
      .select('id, title, created_at, updated_at, metadata')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[AI Studio API] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[AI Studio API] GET exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - 프로젝트 저장 (전체 상태)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      user_id,
      company_id,
      project_id,  // 기존 프로젝트 업데이트 시
      title,
      sources,           // 전체 소스 배열
      generated_contents, // 생성된 콘텐츠 배열
      audio_overviews,   // 오디오 배열
      chat_messages,     // 채팅 기록
      metadata
    } = body

    if (!user_id || !title) {
      return NextResponse.json({ error: 'user_id, title required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 기존 프로젝트 업데이트
    if (project_id) {
      const { data, error } = await supabase
        .from('ai_studio_sessions')
        .update({
          title,
          type: 'project',
          content: JSON.stringify({
            sources: sources || [],
            generated_contents: generated_contents || [],
            audio_overviews: audio_overviews || [],
            chat_messages: chat_messages || []
          }),
          sources: sources || [],
          metadata: {
            ...metadata,
            sources_count: sources?.length || 0,
            contents_count: generated_contents?.length || 0
          }
        } as any)
        .eq('id', project_id)
        .eq('user_id', user_id)
        .select()
        .single()

      if (error) {
        console.error('[AI Studio API] UPDATE error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const result = data as ProjectData
      console.log('[AI Studio API] Project updated:', result.id, title)
      return NextResponse.json({ data: result })
    }

    // 새 프로젝트 생성
    const { data, error } = await supabase
      .from('ai_studio_sessions')
      .insert({
        user_id,
        company_id: company_id || null,
        title,
        type: 'project',
        status: 'active',
        content: JSON.stringify({
          sources: sources || [],
          generated_contents: generated_contents || [],
          audio_overviews: audio_overviews || [],
          chat_messages: chat_messages || []
        }),
        sources: sources || [],
        metadata: {
          ...metadata,
          sources_count: sources?.length || 0,
          contents_count: generated_contents?.length || 0
        }
      } as any)
      .select()
      .single()

    if (error) {
      console.error('[AI Studio API] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as ProjectData
    console.log('[AI Studio API] Project created:', result.id, title)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[AI Studio API] POST exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - 프로젝트 업데이트 (부분 업데이트)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, project_id, ...updates } = body

    if (!user_id || !project_id) {
      return NextResponse.json({ error: 'user_id, project_id required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 현재 프로젝트 데이터 가져오기
    const { data: currentData, error: fetchError } = await supabase
      .from('ai_studio_sessions')
      .select('*')
      .eq('id', project_id)
      .eq('user_id', user_id)
      .single()

    if (fetchError) {
      console.error('[AI Studio API] PUT fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const current = currentData as ProjectData

    // content JSON 파싱
    let contentData: Record<string, unknown> = {}
    try {
      contentData = current.content ? JSON.parse(current.content) : {}
    } catch {
      contentData = {}
    }

    // 업데이트할 필드 병합
    const newContentData: Record<string, unknown> = {
      ...contentData,
      ...(updates.sources !== undefined && { sources: updates.sources }),
      ...(updates.generated_contents !== undefined && { generated_contents: updates.generated_contents }),
      ...(updates.audio_overviews !== undefined && { audio_overviews: updates.audio_overviews }),
      ...(updates.chat_messages !== undefined && { chat_messages: updates.chat_messages })
    }

    const { data, error } = await supabase
      .from('ai_studio_sessions')
      .update({
        ...(updates.title && { title: updates.title }),
        content: JSON.stringify(newContentData),
        sources: (newContentData.sources as unknown[]) || [],
        metadata: {
          ...current.metadata,
          sources_count: (newContentData.sources as unknown[])?.length || 0,
          contents_count: (newContentData.generated_contents as unknown[])?.length || 0
        }
      } as any)
      .eq('id', project_id)
      .eq('user_id', user_id)
      .select()
      .single()

    if (error) {
      console.error('[AI Studio API] PUT error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = data as ProjectData
    console.log('[AI Studio API] Project updated:', result.id)
    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[AI Studio API] PUT exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - 프로젝트 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('id')
    const userId = searchParams.get('user_id')

    if (!projectId || !userId) {
      return NextResponse.json({ error: 'id and user_id required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('ai_studio_sessions')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId)

    if (error) {
      console.error('[AI Studio API] DELETE error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AI Studio API] DELETE exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
