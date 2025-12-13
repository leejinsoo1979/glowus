/**
 * App Integration Types
 * 앱 연동 시스템 타입 정의
 */

export type ProviderId =
  | 'google_drive'
  | 'notion'
  | 'slack'
  | 'github'
  | 'linear'
  | 'confluence'
  | 'dropbox'

export type AuthType = 'oauth2' | 'api_key' | 'webhook'
export type ConnectionStatus = 'connected' | 'disconnected' | 'expired' | 'error'
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error'
export type ResourceType = 'file' | 'folder' | 'page' | 'channel' | 'repo' | 'issue' | 'database'

export interface AppProvider {
  id: ProviderId
  name: string
  description: string
  icon_url: string
  auth_type: AuthType
  oauth_config: OAuthConfig
  capabilities: Record<string, boolean>
  is_active: boolean
}

export interface OAuthConfig {
  auth_url: string
  token_url: string
  scopes?: string[]
  client_id?: string
}

export interface UserAppConnection {
  id: string
  user_id: string
  provider_id: ProviderId
  status: ConnectionStatus
  access_token?: string
  refresh_token?: string
  token_expires_at?: string
  api_key?: string
  account_info?: {
    email?: string
    name?: string
    avatar_url?: string
    [key: string]: any
  }
  permissions?: string[]
  settings?: Record<string, any>
  last_synced_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface AgentAppConnection {
  id: string
  agent_id: string
  user_connection_id: string
  allowed_capabilities: string[]
  auto_sync: boolean
  sync_config?: {
    folders?: string[]
    file_types?: string[]
    channels?: string[]
    repos?: string[]
    [key: string]: any
  }
  is_active: boolean
  created_at: string
  // Joined data
  provider?: AppProvider
  user_connection?: UserAppConnection
}

export interface SyncedResource {
  id: string
  agent_connection_id: string
  resource_type: ResourceType
  resource_id: string
  resource_name: string
  resource_path?: string
  resource_url?: string
  mime_type?: string
  size_bytes?: number
  metadata?: Record<string, any>
  sync_status: SyncStatus
  last_synced_at?: string
  content_hash?: string
  knowledge_document_id?: string
  created_at: string
  updated_at: string
}

export interface OAuthState {
  id: string
  user_id: string
  provider_id: ProviderId
  state_token: string
  redirect_uri?: string
  metadata?: Record<string, any>
  expires_at: string
}

// OAuth 콜백 결과
export interface OAuthCallbackResult {
  success: boolean
  connection_id?: string
  account_info?: UserAppConnection['account_info']
  error?: string
}

// 리소스 목록 결과
export interface ResourceListResult {
  resources: ExternalResource[]
  next_cursor?: string
  has_more: boolean
}

// 외부 서비스의 리소스
export interface ExternalResource {
  id: string
  name: string
  type: ResourceType
  path?: string
  url?: string
  mime_type?: string
  size?: number
  modified_at?: string
  metadata?: Record<string, any>
}

// 콘텐츠 가져오기 결과
export interface ContentFetchResult {
  content: string
  title: string
  mime_type?: string
  metadata?: Record<string, any>
}

// Provider 클라이언트 인터페이스
export interface IntegrationClient {
  providerId: ProviderId

  // 인증
  getAuthUrl(state: string, redirectUri: string): string
  handleCallback(code: string, redirectUri: string): Promise<OAuthCallbackResult>
  refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }>

  // 리소스 작업
  listResources(accessToken: string, options?: ListResourcesOptions): Promise<ResourceListResult>
  getContent(accessToken: string, resourceId: string): Promise<ContentFetchResult>

  // 계정 정보
  getAccountInfo(accessToken: string): Promise<UserAppConnection['account_info']>
}

export interface ListResourcesOptions {
  folder_id?: string
  cursor?: string
  limit?: number
  file_types?: string[]
  query?: string
}
