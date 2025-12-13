import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// GET: 내 모든 대화 목록 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  let user: any = isDevMode() ? DEV_USER : null
  if (!user) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 대화 목록 조회 (최근 메시지 순)
    const { data: conversations, error } = await (adminClient as any)
      .from('agent_conversations')
      .select(`
        id,
        agent_id,
        last_message_at,
        created_at
      `)
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Get conversations error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 에이전트 정보 추가
    const conversationsWithAgent = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        const { data: agent } = await (adminClient as any)
          .from('deployed_agents')
          .select('id, name, avatar_url, description')
          .eq('id', conv.agent_id)
          .single()

        // 마지막 메시지 가져오기
        const { data: lastMessage } = await (adminClient as any)
          .from('agent_chat_messages')
          .select('content, role, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...conv,
          agent,
          lastMessage,
        }
      })
    )

    return NextResponse.json({ data: conversationsWithAgent })
  } catch (error) {
    console.error('GET /api/conversations error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
