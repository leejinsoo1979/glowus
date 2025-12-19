export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

function decryptSecret(encrypted: string): string {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  } catch {
    return encrypted
  }
}

// POST - API 연결 테스트
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; apiId: string }> }
) {
  try {
    const { id: agentId, apiId } = await params
    const supabase = createClient()
    const body = await request.json()

    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = data.user
    }

    // API 연결 조회
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

    // 테스트할 엔드포인트 선택
    const endpointId = body.endpoint_id
    const testParams = body.parameters || {}

    const endpoints = connection.endpoints || []
    const endpoint = endpointId
      ? endpoints.find((e: any) => e.id === endpointId)
      : endpoints[0]

    if (!endpoint) {
      return NextResponse.json({ error: 'No endpoint to test' }, { status: 400 })
    }

    // URL 구성
    let url = `${connection.base_url}${endpoint.path}`

    // 쿼리 파라미터 추가
    const queryParams = new URLSearchParams()
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        const value = testParams[param.name] ?? param.default
        if (value !== undefined) {
          queryParams.append(param.name, String(value))
        }
      }
    }

    // 인증 헤더 구성
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...connection.default_headers,
    }

    const authConfig = connection.auth_config || {}

    switch (connection.auth_type) {
      case 'api_key':
        if (authConfig.param_type === 'query' && authConfig.param_name && authConfig.key) {
          queryParams.append(authConfig.param_name, decryptSecret(authConfig.key))
        } else if (authConfig.header_name && authConfig.key) {
          const prefix = authConfig.prefix || ''
          headers[authConfig.header_name] = `${prefix}${decryptSecret(authConfig.key)}`
        }
        // 네이버 API의 경우
        if (authConfig.header_name_secret && authConfig.secret) {
          headers[authConfig.header_name_secret] = decryptSecret(authConfig.secret)
        }
        break

      case 'bearer':
        if (authConfig.token) {
          headers['Authorization'] = `Bearer ${decryptSecret(authConfig.token)}`
        }
        break

      case 'basic':
        if (authConfig.username && authConfig.password) {
          const credentials = Buffer.from(
            `${authConfig.username}:${decryptSecret(authConfig.password)}`
          ).toString('base64')
          headers['Authorization'] = `Basic ${credentials}`
        }
        break
    }

    // 쿼리 스트링 추가
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`
    }

    // API 호출
    const startTime = Date.now()
    let response: Response
    let responseData: any

    try {
      response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: endpoint.method !== 'GET' ? JSON.stringify(body.body || {}) : undefined,
      })

      const responseTime = Date.now() - startTime

      // 응답 파싱
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        responseData = await response.json()
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        responseData = await response.text()
      } else {
        responseData = await response.text()
      }

      // 호출 로그 저장
      await (supabase as any).from('agent_api_logs').insert({
        connection_id: apiId,
        agent_id: agentId,
        endpoint_id: endpoint.id,
        method: endpoint.method,
        url: url.replace(/serviceKey=[^&]+/, 'serviceKey=***'),
        request_headers: maskHeaders(headers),
        request_body: body.body,
        status_code: response.status,
        response_body: typeof responseData === 'string'
          ? responseData.substring(0, 5000)
          : JSON.stringify(responseData).substring(0, 5000),
        response_time_ms: responseTime,
      })

      // last_used_at 업데이트
      await (supabase as any)
        .from('agent_api_connections')
        .update({
          last_used_at: new Date().toISOString(),
          last_error: response.ok ? null : `HTTP ${response.status}`,
        })
        .eq('id', apiId)

      return NextResponse.json({
        success: response.ok,
        status_code: response.status,
        response_time_ms: responseTime,
        response_preview: typeof responseData === 'string'
          ? responseData.substring(0, 1000)
          : JSON.stringify(responseData, null, 2).substring(0, 1000),
        data: responseData,
      })
    } catch (fetchError: any) {
      // 네트워크 에러 로그
      await (supabase as any).from('agent_api_logs').insert({
        connection_id: apiId,
        agent_id: agentId,
        endpoint_id: endpoint.id,
        method: endpoint.method,
        url: url.replace(/serviceKey=[^&]+/, 'serviceKey=***'),
        error_message: fetchError.message,
      })

      await (supabase as any)
        .from('agent_api_connections')
        .update({ last_error: fetchError.message })
        .eq('id', apiId)

      return NextResponse.json({
        success: false,
        error: fetchError.message,
      })
    }
  } catch (error) {
    console.error('Test API connection error:', error)
    return NextResponse.json(
      { error: 'Failed to test API connection' },
      { status: 500 }
    )
  }
}

// 헤더 마스킹
function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked = { ...headers }
  const sensitiveHeaders = ['authorization', 'x-api-key', 'x-naver-client-secret']

  for (const key of Object.keys(masked)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      masked[key] = '********'
    }
  }

  return masked
}
