import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type {
  AgentApiConnection,
  CreateApiConnectionRequest,
  PublicApiPreset,
} from '@/types/api-connection'

// 암호화 함수 (실제 환경에서는 더 강력한 암호화 사용)
function encryptSecret(text: string): string {
  // 실제로는 AES-256-GCM 등 사용
  return Buffer.from(text).toString('base64')
}

// GET - 에이전트의 API 연결 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인 (dev 모드 지원)
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = data.user
    }

    // 에이전트 존재 확인 (소유권 체크 제거 - 모든 에이전트의 API 연결 조회 가능)
    const { data: agent } = await (adminClient as any)
      .from('deployed_agents')
      .select('id, name')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // API 연결 목록 조회 (adminClient 사용)
    const { data: connections, error } = await (adminClient as any)
      .from('agent_api_connections')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('API connections fetch error:', error)
      throw error
    }

    // API 카탈로그도 조회 (사용 가능한 도구 목록)
    const { data: catalog } = await (adminClient as any)
      .from('api_tool_catalog')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })

    // 민감한 정보 마스킹
    const maskedConnections = (connections || []).map((conn: AgentApiConnection) => ({
      ...conn,
      auth_config: maskAuthConfig(conn.auth_config),
    }))

    console.log(`[API] Agent ${agentId} has ${maskedConnections.length} API connections`)

    return NextResponse.json({
      connections: maskedConnections,
      catalog: catalog || [],
      agent: { id: agent.id, name: agent.name }
    })
  } catch (error) {
    console.error('Get API connections error:', error)
    return NextResponse.json(
      { error: 'Failed to get API connections' },
      { status: 500 }
    )
  }
}

// POST - 새 API 연결 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const body: CreateApiConnectionRequest = await request.json()

    // 인증 확인 (dev 모드 지원)
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = data.user
    }

    // 에이전트 소유권 확인
    const { data: agent } = await (adminClient as any)
      .from('deployed_agents')
      .select('id, user_id')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // 소유자만 API 연결 추가 가능
    if (agent.user_id !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // 프리셋 사용 시 템플릿 로드
    let connectionData = {
      agent_id: agentId,
      name: body.name,
      description: body.description,
      provider_type: body.provider_type,
      base_url: body.base_url,
      auth_type: body.auth_type,
      auth_config: encryptAuthConfig(body.auth_config),
      endpoints: body.endpoints,
      default_headers: body.default_headers || {},
    }

    if (body.preset_id && body.provider_type === 'preset') {
      const { data: preset } = await (adminClient as any)
        .from('public_api_presets')
        .select('*')
        .eq('id', body.preset_id)
        .single()

      if (preset) {
        connectionData = {
          ...connectionData,
          base_url: preset.base_url,
          auth_type: preset.auth_type,
          endpoints: preset.endpoints,
          default_headers: preset.default_headers || {},
        }
      }
    }

    // API 연결 생성 (adminClient 사용)
    const { data: connection, error } = await (adminClient as any)
      .from('agent_api_connections')
      .insert(connectionData)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      connection: {
        ...connection,
        auth_config: maskAuthConfig(connection.auth_config),
      },
    })
  } catch (error) {
    console.error('Create API connection error:', error)
    return NextResponse.json(
      { error: 'Failed to create API connection' },
      { status: 500 }
    )
  }
}

// Helper: 인증 정보 암호화
function encryptAuthConfig(config: any): any {
  if (!config) return {}

  const encrypted = { ...config }

  // 민감한 필드 암호화
  const sensitiveFields = ['key', 'token', 'password', 'client_secret', 'access_token', 'refresh_token', 'secret']
  for (const field of sensitiveFields) {
    if (encrypted[field]) {
      encrypted[field] = encryptSecret(encrypted[field])
    }
  }

  return encrypted
}

// Helper: 인증 정보 마스킹
function maskAuthConfig(config: any): any {
  if (!config) return {}

  const masked = { ...config }

  // 민감한 필드 마스킹
  const sensitiveFields = ['key', 'token', 'password', 'client_secret', 'access_token', 'refresh_token', 'secret']
  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '********'
    }
  }

  return masked
}
