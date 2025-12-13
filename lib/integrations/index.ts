/**
 * Integration Manager
 * 앱 연동 통합 관리 시스템
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { googleDriveClient } from './google-drive'
import { notionClient } from './notion'
import type {
  ProviderId,
  AppProvider,
  UserAppConnection,
  AgentAppConnection,
  SyncedResource,
  IntegrationClient,
  ListResourcesOptions,
  ContentFetchResult,
} from './types'

// 프로바이더별 클라이언트 매핑
const clients: Partial<Record<ProviderId, IntegrationClient>> = {
  google_drive: googleDriveClient,
  notion: notionClient,
  // slack, github는 기존 구현 사용
}

/**
 * 모든 프로바이더 목록 조회
 */
export async function getProviders(): Promise<AppProvider[]> {
  const adminClient = createAdminClient()
  const { data, error } = await (adminClient as any)
    .from('app_providers')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('[Integrations] Failed to get providers:', error)
    return []
  }

  return data || []
}

/**
 * 사용자의 앱 연결 목록 조회
 */
export async function getUserConnections(userId: string): Promise<UserAppConnection[]> {
  const adminClient = createAdminClient()
  const { data, error } = await (adminClient as any)
    .from('user_app_connections')
    .select('*, app_providers(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Integrations] Failed to get user connections:', error)
    return []
  }

  return data || []
}

/**
 * OAuth 인증 URL 생성
 */
export async function createAuthUrl(
  userId: string,
  providerId: ProviderId,
  redirectUri: string
): Promise<string | null> {
  const client = clients[providerId]
  if (!client) {
    console.error(`[Integrations] No client for provider: ${providerId}`)
    return null
  }

  // state 토큰 생성 및 저장
  const stateToken = crypto.randomUUID()
  const adminClient = createAdminClient()

  await (adminClient as any).from('oauth_states').insert({
    user_id: userId,
    provider_id: providerId,
    state_token: stateToken,
    redirect_uri: redirectUri,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10분
  })

  return client.getAuthUrl(stateToken, redirectUri)
}

/**
 * OAuth 콜백 처리
 */
export async function handleOAuthCallback(
  providerId: ProviderId,
  code: string,
  state: string
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const adminClient = createAdminClient()

  // state 토큰 검증
  const { data: stateData, error: stateError } = await (adminClient as any)
    .from('oauth_states')
    .select('*')
    .eq('state_token', state)
    .eq('provider_id', providerId)
    .single()

  if (stateError || !stateData) {
    return { success: false, error: 'Invalid state token' }
  }

  // state 만료 확인
  if (new Date(stateData.expires_at) < new Date()) {
    await (adminClient as any).from('oauth_states').delete().eq('id', stateData.id)
    return { success: false, error: 'State token expired' }
  }

  // state 삭제
  await (adminClient as any).from('oauth_states').delete().eq('id', stateData.id)

  // 클라이언트로 콜백 처리
  const client = clients[providerId]
  if (!client) {
    return { success: false, error: 'Provider not supported' }
  }

  const result = await client.handleCallback(code, stateData.redirect_uri || '')

  if (!result.success) {
    return { success: false, error: result.error }
  }

  // 연결 정보 저장/업데이트
  const connectionData = {
    user_id: stateData.user_id,
    provider_id: providerId,
    status: 'connected',
    access_token: result.account_info?.access_token,
    refresh_token: result.account_info?.refresh_token,
    token_expires_at: result.account_info?.expires_in
      ? new Date(Date.now() + result.account_info.expires_in * 1000).toISOString()
      : null,
    account_info: result.account_info,
    updated_at: new Date().toISOString(),
  }

  const { data: connection, error: connError } = await (adminClient as any)
    .from('user_app_connections')
    .upsert(connectionData, { onConflict: 'user_id,provider_id' })
    .select()
    .single()

  if (connError) {
    console.error('[Integrations] Failed to save connection:', connError)
    return { success: false, error: 'Failed to save connection' }
  }

  return { success: true, connectionId: connection.id }
}

/**
 * 앱 연결 해제
 */
export async function disconnectApp(
  userId: string,
  connectionId: string
): Promise<boolean> {
  const adminClient = createAdminClient()

  const { error } = await (adminClient as any)
    .from('user_app_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', userId)

  if (error) {
    console.error('[Integrations] Failed to disconnect:', error)
    return false
  }

  return true
}

/**
 * 에이전트에 앱 연결
 */
export async function connectAppToAgent(
  agentId: string,
  userConnectionId: string,
  options?: {
    allowedCapabilities?: string[]
    autoSync?: boolean
    syncConfig?: Record<string, any>
  }
): Promise<AgentAppConnection | null> {
  const adminClient = createAdminClient()

  const { data, error } = await (adminClient as any)
    .from('agent_app_connections')
    .upsert({
      agent_id: agentId,
      user_connection_id: userConnectionId,
      allowed_capabilities: options?.allowedCapabilities || [],
      auto_sync: options?.autoSync || false,
      sync_config: options?.syncConfig || {},
      is_active: true,
    }, { onConflict: 'agent_id,user_connection_id' })
    .select('*, user_app_connections(*, app_providers(*))')
    .single()

  if (error) {
    console.error('[Integrations] Failed to connect app to agent:', error)
    return null
  }

  return data
}

/**
 * 에이전트의 앱 연결 목록 조회
 */
export async function getAgentConnections(agentId: string): Promise<AgentAppConnection[]> {
  const adminClient = createAdminClient()

  const { data, error } = await (adminClient as any)
    .from('agent_app_connections')
    .select(`
      *,
      user_app_connections (
        *,
        app_providers (*)
      )
    `)
    .eq('agent_id', agentId)
    .eq('is_active', true)

  if (error) {
    console.error('[Integrations] Failed to get agent connections:', error)
    return []
  }

  return data || []
}

/**
 * 리소스 목록 조회 (파일, 폴더, 채널 등)
 */
export async function listResources(
  connectionId: string,
  options?: ListResourcesOptions
): Promise<{ resources: any[]; nextCursor?: string; hasMore: boolean }> {
  const adminClient = createAdminClient()

  // 연결 정보 조회
  const { data: connection, error } = await (adminClient as any)
    .from('user_app_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !connection) {
    throw new Error('Connection not found')
  }

  // 토큰 갱신 필요 시 갱신
  const accessToken = await ensureValidToken(connection)

  const client = clients[connection.provider_id as ProviderId]
  if (!client) {
    throw new Error('Provider not supported')
  }

  const result = await client.listResources(accessToken, options)

  return {
    resources: result.resources,
    nextCursor: result.next_cursor,
    hasMore: result.has_more,
  }
}

/**
 * 리소스 콘텐츠 가져오기
 */
export async function getResourceContent(
  connectionId: string,
  resourceId: string
): Promise<ContentFetchResult> {
  const adminClient = createAdminClient()

  const { data: connection, error } = await (adminClient as any)
    .from('user_app_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (error || !connection) {
    throw new Error('Connection not found')
  }

  const accessToken = await ensureValidToken(connection)

  const client = clients[connection.provider_id as ProviderId]
  if (!client) {
    throw new Error('Provider not supported')
  }

  return client.getContent(accessToken, resourceId)
}

/**
 * 토큰 갱신 확인 및 갱신
 */
async function ensureValidToken(connection: UserAppConnection): Promise<string> {
  // 토큰 만료 확인
  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000) // 5분 여유
  ) {
    // 토큰 갱신 시도
    const client = clients[connection.provider_id as ProviderId]
    if (client && connection.refresh_token) {
      try {
        const newTokens = await client.refreshToken(connection.refresh_token)

        // 새 토큰 저장
        const adminClient = createAdminClient()
        await (adminClient as any)
          .from('user_app_connections')
          .update({
            access_token: newTokens.access_token,
            token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id)

        return newTokens.access_token
      } catch (err) {
        console.error('[Integrations] Token refresh failed:', err)
        // 갱신 실패 시 상태 업데이트
        const adminClient = createAdminClient()
        await (adminClient as any)
          .from('user_app_connections')
          .update({ status: 'expired' })
          .eq('id', connection.id)
        throw new Error('Token expired')
      }
    }
  }

  return connection.access_token!
}

/**
 * 리소스를 지식베이스에 동기화
 */
export async function syncResourceToKnowledge(
  agentConnectionId: string,
  resourceId: string,
  resourceName: string
): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const adminClient = createAdminClient()

  // 에이전트 연결 정보 조회
  const { data: agentConn, error: agentConnError } = await (adminClient as any)
    .from('agent_app_connections')
    .select(`
      *,
      user_app_connections (*)
    `)
    .eq('id', agentConnectionId)
    .single()

  if (agentConnError || !agentConn) {
    return { success: false, error: 'Agent connection not found' }
  }

  try {
    // 리소스 콘텐츠 가져오기
    const content = await getResourceContent(agentConn.user_connection_id, resourceId)

    // 지식베이스에 추가 (기존 RAG 시스템 사용)
    const { processDocument } = await import('@/lib/rag/processor')

    // 에이전트 ID 추출
    const { data: agentData } = await (adminClient as any)
      .from('agent_app_connections')
      .select('agent_id')
      .eq('id', agentConnectionId)
      .single()

    const result = await processDocument(content.content, {
      agentId: agentData.agent_id,
      title: content.title,
      source: resourceName,
      sourceType: 'text',
      metadata: {
        synced_from: agentConn.user_app_connections.provider_id,
        resource_id: resourceId,
        synced_at: new Date().toISOString(),
      },
    })

    if (!result.success) {
      return { success: false, error: result.error }
    }

    // synced_resources 테이블에 기록
    await (adminClient as any).from('synced_resources').upsert({
      agent_connection_id: agentConnectionId,
      resource_type: 'file',
      resource_id: resourceId,
      resource_name: resourceName,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      knowledge_document_id: result.documentId,
    }, { onConflict: 'agent_connection_id,resource_id' })

    return { success: true, documentId: result.documentId }
  } catch (err) {
    console.error('[Integrations] Sync to knowledge failed:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Sync failed' }
  }
}

// Export types
export type {
  ProviderId,
  AppProvider,
  UserAppConnection,
  AgentAppConnection,
  SyncedResource,
} from './types'
