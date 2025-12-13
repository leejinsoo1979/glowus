/**
 * Agent API Connection Types
 * 에이전트가 연결하는 외부 API 타입 정의
 */

export type AuthType = 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2'
export type ProviderType = 'preset' | 'custom' | 'openapi'
export type ApiCategory = 'government' | 'startup' | 'finance' | 'weather' | 'news' | 'search' | 'social' | 'other'

export interface ApiParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description?: string
  default?: any
  enum?: string[]
}

export interface ApiEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  description?: string
  parameters?: ApiParameter[]
  request_body_schema?: Record<string, any>
  response_format?: 'json' | 'xml' | 'text'
}

export interface AuthConfig {
  // API Key
  header_name?: string
  param_name?: string
  param_type?: 'query' | 'header'
  prefix?: string
  key?: string // encrypted

  // Bearer
  token?: string // encrypted

  // Basic
  username?: string
  password?: string // encrypted

  // OAuth2
  client_id?: string
  client_secret?: string // encrypted
  token_url?: string
  access_token?: string // encrypted
  refresh_token?: string // encrypted
  expires_at?: string

  // Naver specific
  header_name_secret?: string
  secret?: string // encrypted
}

export interface AgentApiConnection {
  id: string
  agent_id: string
  name: string
  description?: string
  provider_type: ProviderType
  base_url: string
  auth_type: AuthType
  auth_config: AuthConfig
  endpoints: ApiEndpoint[]
  default_headers: Record<string, string>
  is_active: boolean
  last_used_at?: string
  last_error?: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface PublicApiPreset {
  id: string
  name: string
  description?: string
  category: ApiCategory
  logo_url?: string
  base_url: string
  auth_type: AuthType
  auth_config_template: AuthConfig
  endpoints: ApiEndpoint[]
  default_headers: Record<string, string>
  setup_guide?: string
  api_key_url?: string
  documentation_url?: string
  is_active: boolean
}

export interface ApiCallLog {
  id: string
  connection_id: string
  agent_id: string
  endpoint_id?: string
  method: string
  url: string
  request_headers?: Record<string, string>
  request_body?: any
  status_code?: number
  response_headers?: Record<string, string>
  response_body?: any
  response_time_ms?: number
  error_message?: string
  created_at: string
}

// Request/Response types for API routes
export interface CreateApiConnectionRequest {
  agent_id: string
  name: string
  description?: string
  provider_type: ProviderType
  preset_id?: string // 프리셋 사용 시
  base_url: string
  auth_type: AuthType
  auth_config: AuthConfig
  endpoints: ApiEndpoint[]
  default_headers?: Record<string, string>
}

export interface UpdateApiConnectionRequest {
  name?: string
  description?: string
  base_url?: string
  auth_type?: AuthType
  auth_config?: AuthConfig
  endpoints?: ApiEndpoint[]
  default_headers?: Record<string, string>
  is_active?: boolean
}

export interface TestApiConnectionRequest {
  connection_id?: string
  // OR direct test
  base_url?: string
  auth_type?: AuthType
  auth_config?: AuthConfig
  endpoint?: ApiEndpoint
  test_params?: Record<string, any>
}

export interface TestApiConnectionResponse {
  success: boolean
  status_code?: number
  response_time_ms?: number
  response_preview?: string
  error?: string
}

export interface CallApiRequest {
  connection_id: string
  endpoint_id: string
  parameters?: Record<string, any>
  body?: any
}

export interface CallApiResponse {
  success: boolean
  data?: any
  status_code?: number
  response_time_ms?: number
  error?: string
}
