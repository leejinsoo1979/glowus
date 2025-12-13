import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UpdateApiConnectionRequest } from '@/types/api-connection'

// 암호화 함수
function encryptSecret(text: string): string {
  return Buffer.from(text).toString('base64')
}

function decryptSecret(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}

// GET - 단일 API 연결 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; apiId: string }> }
) {
  try {
    const { id: agentId, apiId } = await params
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 에이전트 소유권 확인 후 연결 조회
    const { data: connection, error } = await (supabase as any)
      .from('agent_api_connections')
      .select(`
        *,
        deployed_agents!inner(user_id)
      `)
      .eq('id', apiId)
      .eq('agent_id', agentId)
      .eq('deployed_agents.user_id', user.id)
      .single()

    if (error || !connection) {
      return NextResponse.json({ error: 'API connection not found' }, { status: 404 })
    }

    // 민감 정보 마스킹
    const masked = {
      ...connection,
      auth_config: maskAuthConfig(connection.auth_config),
      deployed_agents: undefined,
    }

    return NextResponse.json({ connection: masked })
  } catch (error) {
    console.error('Get API connection error:', error)
    return NextResponse.json(
      { error: 'Failed to get API connection' },
      { status: 500 }
    )
  }
}

// PATCH - API 연결 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; apiId: string }> }
) {
  try {
    const { id: agentId, apiId } = await params
    const supabase = createClient()
    const body: UpdateApiConnectionRequest = await request.json()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 소유권 확인
    const { data: existing } = await (supabase as any)
      .from('agent_api_connections')
      .select(`
        *,
        deployed_agents!inner(user_id)
      `)
      .eq('id', apiId)
      .eq('agent_id', agentId)
      .eq('deployed_agents.user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'API connection not found' }, { status: 404 })
    }

    // 업데이트 데이터 준비
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.base_url !== undefined) updateData.base_url = body.base_url
    if (body.auth_type !== undefined) updateData.auth_type = body.auth_type
    if (body.endpoints !== undefined) updateData.endpoints = body.endpoints
    if (body.default_headers !== undefined) updateData.default_headers = body.default_headers
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // 인증 정보 업데이트 (새 값이 있는 필드만)
    if (body.auth_config) {
      const existingConfig = existing.auth_config || {}
      const newConfig = { ...existingConfig }

      for (const [key, value] of Object.entries(body.auth_config)) {
        if (value !== undefined && value !== '********') {
          // 민감한 필드는 암호화
          const sensitiveFields = ['key', 'token', 'password', 'client_secret', 'access_token', 'refresh_token', 'secret']
          if (sensitiveFields.includes(key) && typeof value === 'string') {
            newConfig[key] = encryptSecret(value)
          } else {
            newConfig[key] = value
          }
        }
      }

      updateData.auth_config = newConfig
    }

    // 업데이트 실행
    const { data: connection, error } = await (supabase as any)
      .from('agent_api_connections')
      .update(updateData)
      .eq('id', apiId)
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
    console.error('Update API connection error:', error)
    return NextResponse.json(
      { error: 'Failed to update API connection' },
      { status: 500 }
    )
  }
}

// DELETE - API 연결 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; apiId: string }> }
) {
  try {
    const { id: agentId, apiId } = await params
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 소유권 확인
    const { data: existing } = await (supabase as any)
      .from('agent_api_connections')
      .select(`
        id,
        deployed_agents!inner(user_id)
      `)
      .eq('id', apiId)
      .eq('agent_id', agentId)
      .eq('deployed_agents.user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'API connection not found' }, { status: 404 })
    }

    // 삭제 실행
    const { error } = await (supabase as any)
      .from('agent_api_connections')
      .delete()
      .eq('id', apiId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete API connection error:', error)
    return NextResponse.json(
      { error: 'Failed to delete API connection' },
      { status: 500 }
    )
  }
}

// Helper: 인증 정보 마스킹
function maskAuthConfig(config: any): any {
  if (!config) return {}

  const masked = { ...config }
  const sensitiveFields = ['key', 'token', 'password', 'client_secret', 'access_token', 'refresh_token', 'secret']

  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '********'
    }
  }

  return masked
}
