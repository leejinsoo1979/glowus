import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDevUserIfEnabled } from '@/lib/dev-user'

// GET: 초대 가능한 사용자 및 에이전트 목록
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()

    const devUser = getDevUserIfEnabled()
    let user: any = null

    if (devUser) {
      user = devUser
    } else {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = authUser
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const type = searchParams.get('type') // 'user', 'agent', or 'all'

    // 현재 채팅방 참여자 ID 목록 (제외용)
    let existingUserIds: string[] = []
    let existingAgentIds: string[] = []

    if (roomId) {
      const { data: participants } = await (adminClient as any)
        .from('chat_participants')
        .select('user_id, agent_id')
        .eq('room_id', roomId)

      existingUserIds = participants?.filter((p: any) => p.user_id).map((p: any) => p.user_id) || []
      existingAgentIds = participants?.filter((p: any) => p.agent_id).map((p: any) => p.agent_id) || []
    }

    const result: { users: any[]; agents: any[] } = { users: [], agents: [] }

    // 사용자 목록 (본인 제외)
    if (!type || type === 'user' || type === 'all') {
      let userQuery = (adminClient as any)
        .from('users')
        .select('id, name, email, avatar_url, role')
        .neq('id', user.id)
        .order('name')

      if (existingUserIds.length > 0) {
        userQuery = userQuery.not('id', 'in', `(${existingUserIds.join(',')})`)
      }

      const { data: users, error: userError } = await userQuery

      if (!userError) {
        result.users = users || []
      }
    }

    // 에이전트 목록
    if (!type || type === 'agent' || type === 'all') {
      let agentQuery = (adminClient as any)
        .from('deployed_agents')
        .select('id, name, description, status')
        .eq('status', 'ACTIVE')
        .order('name')

      if (existingAgentIds.length > 0) {
        agentQuery = agentQuery.not('id', 'in', `(${existingAgentIds.join(',')})`)
      }

      const { data: agents, error: agentError } = await agentQuery

      if (!agentError) {
        result.agents = agents || []
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get invitables error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
