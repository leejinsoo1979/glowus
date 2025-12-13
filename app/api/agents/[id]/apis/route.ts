import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = createClient()

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 에이전트 소유권 확인
    const { data: agent } = await (supabase as any)
      .from('deployed_agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // API 연결 목록 조회
    const { data: connections, error } = await (supabase as any)
      .from('agent_api_connections')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // 민감한 정보 마스킹
    const maskedConnections = (connections || []).map((conn: AgentApiConnection) => ({
      ...conn,
      auth_config: maskAuthConfig(conn.auth_config),
    }))

    return NextResponse.json({ connections: maskedConnections })
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
    const supabase = createClient()
    const body: CreateApiConnectionRequest = await request.json()

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 에이전트 소유권 확인
    const { data: agent } = await (supabase as any)
      .from('deployed_agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
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
      const { data: preset } = await (supabase as any)
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

    // API 연결 생성
    const { data: connection, error } = await (supabase as any)
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
