import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 워크스페이스 히스토리 통합 API
// 모든 작업물을 한 곳에서 조회 (병렬 처리로 속도 최적화)

interface WorkspaceItem {
  id: string
  type: 'project' | 'agent_chat' | 'ai_app' | 'chat_room' | 'neural_map' | 'document'
  title: string
  description?: string
  icon?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''

    // 🚀 모든 쿼리를 병렬로 실행
    const [
      projectsResult,
      agentConvosResult,
      aiThreadsResult,
      chatRoomsResult,
      neuralMapsResult,
      documentsResult
    ] = await Promise.all([
      // 1. 프로젝트
      supabase
        .from('projects')
        .select('id, name, description, status, created_at, updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // 2. 에이전트 대화
      supabase
        .from('agent_conversations')
        .select('id, title, agent_ids, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // 3. AI 앱 스레드
      supabase
        .from('ai_threads')
        .select('id, title, thread_type, metadata, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // 4. 채팅방
      supabase
        .from('chat_rooms')
        .select('id, name, type, created_at, updated_at')
        .limit(limit),

      // 5. 뉴럴맵
      supabase
        .from('neural_maps')
        .select('id, title, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit),

      // 6. 문서
      supabase
        .from('project_documents')
        .select('id, title, doc_type, summary, created_at, updated_at')
        .eq('created_by_user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit)
    ])

    const items: WorkspaceItem[] = []
    const searchLower = search.toLowerCase()

    // 프로젝트 처리
    if (projectsResult.data) {
      for (const p of projectsResult.data) {
        if (!search || p.name?.toLowerCase().includes(searchLower)) {
          items.push({
            id: p.id,
            type: 'project',
            title: p.name || 'Untitled Project',
            description: p.description,
            icon: 'folder',
            metadata: { status: p.status },
            createdAt: p.created_at,
            updatedAt: p.updated_at || p.created_at,
          })
        }
      }
    }

    // 에이전트 대화 처리
    if (agentConvosResult.data) {
      for (const c of agentConvosResult.data) {
        if (!search || c.title?.toLowerCase().includes(searchLower)) {
          items.push({
            id: c.id,
            type: 'agent_chat',
            title: c.title || 'Agent Chat',
            icon: 'bot',
            metadata: { agentIds: c.agent_ids },
            createdAt: c.created_at,
            updatedAt: c.updated_at || c.created_at,
          })
        }
      }
    }

    // AI 앱 스레드 처리
    if (aiThreadsResult.data) {
      const iconMap: Record<string, string> = {
        glow_code: 'code',
        docs: 'file-text',
        slides: 'presentation',
        sheet: 'table',
        image: 'image',
        blog: 'book-open',
        summary: 'sparkles',
      }
      for (const t of aiThreadsResult.data) {
        if (!search || t.title?.toLowerCase().includes(searchLower)) {
          items.push({
            id: t.id,
            type: 'ai_app',
            title: t.title || 'New Chat',
            icon: iconMap[t.thread_type] || 'message-square',
            metadata: { threadType: t.thread_type, ...t.metadata },
            createdAt: t.created_at,
            updatedAt: t.updated_at || t.created_at,
          })
        }
      }
    }

    // 채팅방 처리
    if (chatRoomsResult.data) {
      for (const r of chatRoomsResult.data) {
        if (!search || r.name?.toLowerCase().includes(searchLower)) {
          items.push({
            id: r.id,
            type: 'chat_room',
            title: r.name || 'Chat Room',
            icon: r.type === 'meeting' ? 'users' : 'message-circle',
            metadata: { roomType: r.type },
            createdAt: r.created_at,
            updatedAt: r.updated_at || r.created_at,
          })
        }
      }
    }

    // 뉴럴맵 처리
    if (neuralMapsResult.data) {
      for (const m of neuralMapsResult.data) {
        if (!search || m.title?.toLowerCase().includes(searchLower)) {
          items.push({
            id: m.id,
            type: 'neural_map',
            title: m.title || 'Neural Map',
            icon: 'brain',
            createdAt: m.created_at,
            updatedAt: m.updated_at || m.created_at,
          })
        }
      }
    }

    // 문서 처리
    if (documentsResult.data) {
      for (const d of documentsResult.data) {
        if (!search || d.title?.toLowerCase().includes(searchLower)) {
          items.push({
            id: d.id,
            type: 'document',
            title: d.title || 'Untitled Document',
            description: d.summary,
            icon: 'file',
            metadata: { docType: d.doc_type },
            createdAt: d.created_at,
            updatedAt: d.updated_at || d.created_at,
          })
        }
      }
    }

    // 시간순 정렬 (최신순)
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    // limit 적용
    const limitedItems = items.slice(0, limit)

    return NextResponse.json({ items: limitedItems })
  } catch (error: any) {
    console.error('Workspace history error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
