import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AgentConversation, AgentMessage } from '@/types/database'

// GET: List conversations for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')
    const isActive = searchParams.get('is_active')

    // Use type assertion since tables are not yet in Database type
    let query = (supabase as any)
      .from('agent_conversations')
      .select(`
        *,
        messages:agent_messages(
          id,
          content,
          sender_type,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (agentId) {
      query = query.contains('agent_ids', [agentId])
    }

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('대화 조회 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get last message for each conversation
    const conversationsWithLastMessage = (data as any[])?.map((conv: any) => ({
      ...conv,
      lastMessage: conv.messages?.[conv.messages.length - 1] || null,
      messageCount: conv.messages?.length || 0,
    }))

    return NextResponse.json(conversationsWithLastMessage)
  } catch (error) {
    console.error('대화 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Start a new conversation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { agent_ids, title, startup_id } = body

    if (!agent_ids || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return NextResponse.json(
        { error: '최소 하나의 에이전트가 필요합니다' },
        { status: 400 }
      )
    }

    // Verify all agents exist and belong to user
    const { data: agents, error: agentsError } = await (supabase as any)
      .from('deployed_agents')
      .select('id, name')
      .in('id', agent_ids)
      .eq('owner_id', user.id)

    if (agentsError) {
      return NextResponse.json({ error: agentsError.message }, { status: 500 })
    }

    if (!agents || agents.length !== agent_ids.length) {
      return NextResponse.json(
        { error: '일부 에이전트를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // Generate title if not provided
    const conversationTitle = title || `${agents.map((a: any) => a.name).join(', ')}와의 대화`

    const { data, error } = await (supabase as any)
      .from('agent_conversations')
      .insert({
        user_id: user.id,
        agent_ids,
        title: conversationTitle,
        startup_id: startup_id || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('대화 생성 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('대화 생성 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
