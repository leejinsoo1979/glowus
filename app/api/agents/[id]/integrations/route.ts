export const dynamic = 'force-dynamic'
/**
 * Agent Integrations API
 * 에이전트의 앱 연동 관리
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import {
  getProviders,
  getUserConnections,
  getAgentConnections,
  connectAppToAgent,
  createAuthUrl,
  listResources,
  syncResourceToKnowledge,
} from '@/lib/integrations'

// GET: 에이전트의 연동 목록 및 사용 가능한 프로바이더
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 에이전트 소유권 확인
    const adminClient = createAdminClient()
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('id, owner_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: '에이전트를 찾을 수 없습니다' }, { status: 404 })
    }

    // 프로바이더 목록
    const providers = await getProviders()

    // 사용자의 연결된 앱
    const userConnections = await getUserConnections(user.id)

    // 에이전트에 연결된 앱
    const agentConnections = await getAgentConnections(agentId)

    return NextResponse.json({
      providers,
      userConnections,
      agentConnections,
    })
  } catch (error) {
    console.error('Agent integrations GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '조회 실패' },
      { status: 500 }
    )
  }
}

// POST: 앱 연결 또는 OAuth 시작
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { action, providerId, userConnectionId, resourceId, resourceName, syncConfig, apiKey, webhookUrl, chatId } = body

    switch (action) {
      case 'connect_api_key': {
        // API Key 또는 Webhook 연결
        if (!providerId) {
          return NextResponse.json({ error: 'providerId 필요' }, { status: 400 })
        }

        const adminClient = createAdminClient()

        // 기존 연결 확인 또는 생성
        const connectionData: any = {
          user_id: user.id,
          provider_id: providerId,
          status: 'connected',
          account_info: {},
          updated_at: new Date().toISOString(),
        }

        // 프로바이더별 설정
        if (providerId === 'telegram-bot') {
          if (!apiKey) {
            return NextResponse.json({ error: '봇 토큰이 필요합니다' }, { status: 400 })
          }
          connectionData.api_key = apiKey
          connectionData.account_info = { chat_id: chatId, type: 'telegram_bot' }
        } else if (providerId === 'discord') {
          if (!webhookUrl) {
            return NextResponse.json({ error: 'Webhook URL이 필요합니다' }, { status: 400 })
          }
          connectionData.account_info = { webhook_url: webhookUrl, type: 'discord_webhook' }
        } else if (providerId === 'whatsapp') {
          if (!apiKey || !webhookUrl) {
            return NextResponse.json({ error: 'Phone Number ID와 Access Token이 필요합니다' }, { status: 400 })
          }
          connectionData.api_key = webhookUrl // Access Token
          connectionData.account_info = { phone_number_id: apiKey, type: 'whatsapp_business' }
        } else if (providerId === 'microsoft-teams') {
          if (!webhookUrl) {
            return NextResponse.json({ error: 'Webhook URL이 필요합니다' }, { status: 400 })
          }
          connectionData.account_info = { webhook_url: webhookUrl, type: 'teams_webhook' }
        }

        // user_app_connections에 저장
        const { data: connection, error: connError } = await (adminClient as any)
          .from('user_app_connections')
          .upsert(connectionData, { onConflict: 'user_id,provider_id' })
          .select()
          .single()

        if (connError) {
          console.error('API Key connection save error:', connError)
          return NextResponse.json({ error: '연결 저장 실패' }, { status: 500 })
        }

        // 에이전트에 자동 연결
        const agentConnection = await connectAppToAgent(agentId, connection.id)

        return NextResponse.json({
          success: true,
          connection,
          agentConnection,
        })
      }

      case 'start_oauth': {
        // OAuth 인증 시작
        if (!providerId) {
          return NextResponse.json({ error: 'providerId 필요' }, { status: 400 })
        }

        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/callback?provider=${providerId}`
        const authUrl = await createAuthUrl(user.id, providerId, redirectUri)

        if (!authUrl) {
          return NextResponse.json({ error: '지원하지 않는 프로바이더' }, { status: 400 })
        }

        return NextResponse.json({ authUrl })
      }

      case 'connect_to_agent': {
        // 기존 연결을 에이전트에 연결
        if (!userConnectionId) {
          return NextResponse.json({ error: 'userConnectionId 필요' }, { status: 400 })
        }

        const connection = await connectAppToAgent(agentId, userConnectionId, {
          autoSync: syncConfig?.autoSync,
          syncConfig,
        })

        if (!connection) {
          return NextResponse.json({ error: '연결 실패' }, { status: 500 })
        }

        return NextResponse.json({ success: true, connection })
      }

      case 'list_resources': {
        // 리소스 목록 조회
        if (!userConnectionId) {
          return NextResponse.json({ error: 'userConnectionId 필요' }, { status: 400 })
        }

        const { folderId, cursor, limit } = body
        const result = await listResources(userConnectionId, {
          folder_id: folderId,
          cursor,
          limit,
        })

        return NextResponse.json(result)
      }

      case 'sync_resource': {
        // 리소스를 지식베이스에 동기화
        if (!body.agentConnectionId || !resourceId || !resourceName) {
          return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
        }

        const result = await syncResourceToKnowledge(
          body.agentConnectionId,
          resourceId,
          resourceName
        )

        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Agent integrations POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '처리 실패' },
      { status: 500 }
    )
  }
}

// DELETE: 에이전트에서 앱 연결 해제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId 필요' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 에이전트-앱 연결 비활성화
    const { error } = await (adminClient as any)
      .from('agent_app_connections')
      .update({ is_active: false })
      .eq('id', connectionId)
      .eq('agent_id', agentId)

    if (error) {
      return NextResponse.json({ error: '연결 해제 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Agent integrations DELETE error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '삭제 실패' },
      { status: 500 }
    )
  }
}
