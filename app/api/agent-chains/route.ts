import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { startChainExecution } from '@/lib/agent/chain-orchestrator'

// GET: List all agent chains
export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: chains, error } = await (adminClient as any)
      .from('agent_chains')
      .select(`
        *,
        start_agent:start_agent_id(id, name, avatar_url, capabilities)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(chains)
  } catch (error) {
    console.error('Get chains error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: Create a new chain or start chain execution
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // 체인 실행 시작
    if (action === 'execute') {
      const { chain_id, initial_input } = body

      if (!chain_id || !initial_input) {
        return NextResponse.json(
          { error: 'chain_id와 initial_input이 필요합니다' },
          { status: 400 }
        )
      }

      const result = await startChainExecution(chain_id, initial_input)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        chain_run_id: result.chainRunId,
      })
    }

    // 새 체인 생성
    const { name, description, start_agent_id } = body

    if (!name) {
      return NextResponse.json({ error: '체인 이름이 필요합니다' }, { status: 400 })
    }

    const { data: chain, error } = await (adminClient as any)
      .from('agent_chains')
      .insert({
        name,
        description,
        start_agent_id,
        created_by: user.id,
      })
      .select(`
        *,
        start_agent:start_agent_id(id, name, avatar_url)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(chain, { status: 201 })
  } catch (error) {
    console.error('Create chain error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
