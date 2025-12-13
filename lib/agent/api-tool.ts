/**
 * API Tool Converter
 * API 연결을 LangChain 도구로 변환
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import type {
  AgentApiConnection,
  ApiEndpoint,
  AuthConfig,
} from '@/types/api-connection'

// 암호 복호화
function decryptSecret(encrypted: string): string {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  } catch {
    return encrypted
  }
}

// 파라미터 스키마를 Zod로 변환
function paramToZodSchema(param: any): z.ZodTypeAny {
  let schema: z.ZodTypeAny

  switch (param.type) {
    case 'number':
      schema = z.number()
      break
    case 'boolean':
      schema = z.boolean()
      break
    case 'array':
      schema = z.array(z.any())
      break
    case 'object':
      schema = z.record(z.any())
      break
    default:
      schema = z.string()
  }

  if (!param.required) {
    schema = schema.optional()
  }

  if (param.description) {
    schema = schema.describe(param.description)
  }

  return schema
}

// 엔드포인트에서 Zod 스키마 생성
function createSchemaFromEndpoint(endpoint: ApiEndpoint): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {}

  if (endpoint.parameters) {
    for (const param of endpoint.parameters) {
      shape[param.name] = paramToZodSchema(param)
    }
  }

  // body가 필요한 메서드면 body 필드 추가
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    shape['body'] = z.record(z.any()).optional().describe('요청 본문 데이터')
  }

  return z.object(shape)
}

// 인증 헤더 생성
function buildAuthHeaders(
  authType: string,
  authConfig: AuthConfig
): Record<string, string> {
  const headers: Record<string, string> = {}

  switch (authType) {
    case 'api_key':
      if (authConfig.header_name && authConfig.key) {
        const prefix = authConfig.prefix || ''
        headers[authConfig.header_name] = `${prefix}${decryptSecret(authConfig.key)}`
      }
      // 네이버 API용 추가 헤더
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

  return headers
}

// URL 쿼리 파라미터에 인증 추가
function addAuthToQuery(
  params: URLSearchParams,
  authType: string,
  authConfig: AuthConfig
): void {
  if (authType === 'api_key' && authConfig.param_type === 'query') {
    if (authConfig.param_name && authConfig.key) {
      params.append(authConfig.param_name, decryptSecret(authConfig.key))
    }
  }
}

/**
 * API 연결의 단일 엔드포인트를 LangChain 도구로 변환
 */
export function createApiTool(
  connection: AgentApiConnection,
  endpoint: ApiEndpoint
): DynamicStructuredTool {
  const toolName = `api_${connection.id.substring(0, 8)}_${endpoint.id}`
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase()

  const description = `[${connection.name}] ${endpoint.name}${endpoint.description ? ': ' + endpoint.description : ''}`

  return new DynamicStructuredTool({
    name: toolName,
    description,
    schema: createSchemaFromEndpoint(endpoint),
    func: async (params: Record<string, any>) => {
      try {
        // URL 구성
        let url = `${connection.base_url}${endpoint.path}`
        const queryParams = new URLSearchParams()

        // 인증 정보를 쿼리에 추가
        addAuthToQuery(queryParams, connection.auth_type, connection.auth_config)

        // 파라미터 처리
        if (endpoint.parameters) {
          for (const param of endpoint.parameters) {
            const value = params[param.name] ?? param.default
            if (value !== undefined) {
              queryParams.append(param.name, String(value))
            }
          }
        }

        // 헤더 구성
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...connection.default_headers,
          ...buildAuthHeaders(connection.auth_type, connection.auth_config),
        }

        // 쿼리 스트링 추가
        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`
        }

        // API 호출
        const response = await fetch(url, {
          method: endpoint.method,
          headers,
          body: ['POST', 'PUT', 'PATCH'].includes(endpoint.method) && params.body
            ? JSON.stringify(params.body)
            : undefined,
        })

        // 응답 처리
        const contentType = response.headers.get('content-type') || ''
        let data: any

        if (contentType.includes('application/json')) {
          data = await response.json()
        } else if (contentType.includes('xml')) {
          data = await response.text()
        } else {
          data = await response.text()
        }

        if (!response.ok) {
          return JSON.stringify({
            error: `API 호출 실패: HTTP ${response.status}`,
            details: typeof data === 'string' ? data : JSON.stringify(data),
          })
        }

        return JSON.stringify({
          success: true,
          status: response.status,
          data,
        })
      } catch (error: any) {
        return JSON.stringify({
          error: `API 호출 중 오류 발생: ${error.message}`,
        })
      }
    },
  })
}

/**
 * API 연결의 모든 엔드포인트를 LangChain 도구로 변환
 */
export function createApiTools(connection: AgentApiConnection): DynamicStructuredTool[] {
  if (!connection.is_active || !connection.endpoints?.length) {
    return []
  }

  return connection.endpoints.map((endpoint) => createApiTool(connection, endpoint))
}

/**
 * 여러 API 연결을 모두 LangChain 도구로 변환
 */
export function createAllApiTools(connections: AgentApiConnection[]): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = []

  for (const connection of connections) {
    tools.push(...createApiTools(connection))
  }

  return tools
}

/**
 * 에이전트용 API 도구 설명 생성 (프롬프트에 포함)
 */
export function generateApiToolsDescription(connections: AgentApiConnection[]): string {
  if (!connections.length) {
    return ''
  }

  const descriptions: string[] = [
    '\n## 연결된 외부 API',
    '다음 API들을 사용하여 실시간 정보를 조회할 수 있습니다:\n',
  ]

  for (const conn of connections) {
    if (!conn.is_active) continue

    descriptions.push(`### ${conn.name}`)
    if (conn.description) {
      descriptions.push(conn.description)
    }

    if (conn.endpoints?.length) {
      descriptions.push('사용 가능한 기능:')
      for (const endpoint of conn.endpoints) {
        const toolName = `api_${conn.id.substring(0, 8)}_${endpoint.id}`
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .toLowerCase()
        descriptions.push(`- **${endpoint.name}** (${toolName}): ${endpoint.description || ''}`)

        if (endpoint.parameters?.length) {
          const requiredParams = endpoint.parameters.filter((p) => p.required)
          if (requiredParams.length) {
            descriptions.push(`  필수 파라미터: ${requiredParams.map((p) => p.name).join(', ')}`)
          }
        }
      }
    }
    descriptions.push('')
  }

  return descriptions.join('\n')
}
