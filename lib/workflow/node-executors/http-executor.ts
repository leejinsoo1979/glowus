/**
 * HTTP Node Executor
 * HTTP 요청을 수행하고 응답을 처리
 */

import type { NodeExecutionContext, NodeExecutionResult } from './index'

export interface HTTPNodeConfig {
  // 요청 설정
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string

  // 헤더
  headers?: Record<string, string> | string

  // 본문
  body?: unknown | string

  // 인증
  auth?: {
    type: 'none' | 'bearer' | 'apiKey' | 'basic'
    token?: string
    apiKey?: string
    apiKeyHeader?: string
    username?: string
    password?: string
  }

  // 옵션
  timeout?: number // ms
  followRedirects?: boolean
  validateSSL?: boolean

  // 응답 처리
  responseType?: 'json' | 'text' | 'blob'
  extractPath?: string // JSONPath 스타일 경로 (예: "data.items[0].name")
}

// URL 템플릿 변수 치환
function interpolateUrl(
  url: string,
  variables: Record<string, unknown>
): string {
  return url.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    if (value === undefined || value === null) {
      return match
    }
    return encodeURIComponent(String(value))
  })
}

// 문자열 템플릿 변수 치환
function interpolateString(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key]
    if (value === undefined || value === null) {
      return match
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  })
}

// JSONPath 스타일 경로로 값 추출
function extractValue(obj: unknown, path: string): unknown {
  if (!path) return obj

  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }

    // 배열 인덱스 처리 (예: items[0])
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/)
    if (arrayMatch) {
      const [, key, index] = arrayMatch
      current = (current as Record<string, unknown>)[key]
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)]
      } else {
        return undefined
      }
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }

  return current
}

// 헤더 파싱
function parseHeaders(headers: Record<string, string> | string | undefined): Record<string, string> {
  if (!headers) return {}

  if (typeof headers === 'string') {
    try {
      return JSON.parse(headers)
    } catch {
      // key: value 형식 파싱
      const result: Record<string, string> = {}
      headers.split('\n').forEach((line) => {
        const [key, ...valueParts] = line.split(':')
        if (key && valueParts.length > 0) {
          result[key.trim()] = valueParts.join(':').trim()
        }
      })
      return result
    }
  }

  return headers
}

export async function executeHTTPNode(
  config: HTTPNodeConfig,
  context: NodeExecutionContext
): Promise<NodeExecutionResult> {
  const logs: string[] = []

  try {
    // 1. 변수 병합
    const allVariables: Record<string, unknown> = {
      ...context.previousResults,
      ...context.inputs,
    }

    // 2. URL 처리
    const url = interpolateUrl(config.url, allVariables)
    logs.push(`[HTTP] ${config.method} ${url}`)

    // 3. 헤더 구성
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...parseHeaders(config.headers),
    }

    // 4. 인증 처리
    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          if (config.auth.token) {
            headers['Authorization'] = `Bearer ${config.auth.token}`
          }
          break
        case 'apiKey':
          if (config.auth.apiKey) {
            const headerName = config.auth.apiKeyHeader || 'X-API-Key'
            headers[headerName] = config.auth.apiKey
          }
          break
        case 'basic':
          if (config.auth.username && config.auth.password) {
            const credentials = Buffer.from(
              `${config.auth.username}:${config.auth.password}`
            ).toString('base64')
            headers['Authorization'] = `Basic ${credentials}`
          }
          break
      }
    }

    // 5. 본문 처리
    let body: string | undefined

    if (config.method !== 'GET' && config.body) {
      if (typeof config.body === 'string') {
        body = interpolateString(config.body, allVariables)
      } else {
        // 객체인 경우 변수 치환 후 JSON 문자열화
        const bodyStr = JSON.stringify(config.body)
        body = interpolateString(bodyStr, allVariables)
      }
      logs.push(`[HTTP] Body: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}`)
    }

    // 6. 타임아웃 설정
    const timeout = config.timeout || 30000

    // 7. HTTP 요청 실행
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const startTime = Date.now()

    const response = await fetch(url, {
      method: config.method,
      headers,
      body,
      signal: controller.signal,
      redirect: config.followRedirects === false ? 'manual' : 'follow',
    })

    clearTimeout(timeoutId)

    const duration = Date.now() - startTime
    logs.push(`[HTTP] Status: ${response.status} (${duration}ms)`)

    // 8. 응답 처리
    let responseData: unknown

    const contentType = response.headers.get('content-type') || ''

    if (config.responseType === 'text' || contentType.includes('text/')) {
      responseData = await response.text()
    } else if (config.responseType === 'blob' || contentType.includes('octet-stream')) {
      const blob = await response.blob()
      responseData = {
        type: blob.type,
        size: blob.size,
        // Base64 인코딩은 필요한 경우에만
      }
    } else {
      // 기본: JSON
      const text = await response.text()
      try {
        responseData = JSON.parse(text)
      } catch {
        responseData = text
      }
    }

    // 9. 경로 추출 (extractPath가 지정된 경우)
    if (config.extractPath && typeof responseData === 'object') {
      responseData = extractValue(responseData, config.extractPath)
      logs.push(`[HTTP] Extracted path: ${config.extractPath}`)
    }

    // 10. 응답 상태 확인
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP 오류: ${response.status} ${response.statusText}`,
        result: {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          headers: Object.fromEntries(response.headers.entries()),
        },
        logs,
      }
    }

    return {
      success: true,
      result: {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries()),
        duration,
      },
      logs,
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes('aborted')) {
      logs.push(`[HTTP] Timeout after ${config.timeout || 30000}ms`)
      return {
        success: false,
        error: `HTTP 요청 타임아웃 (${config.timeout || 30000}ms)`,
        logs,
      }
    }

    logs.push(`[HTTP] Error: ${errorMessage}`)
    return {
      success: false,
      error: `HTTP 노드 실행 실패: ${errorMessage}`,
      logs,
    }
  }
}
