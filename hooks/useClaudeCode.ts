/**
 * useClaudeCode Hook
 *
 * Reusable hook for apps to interact with Claude Code agent system.
 * Provides easy access to AI-powered task execution with tools.
 */

import { useState, useCallback, useRef } from 'react'

// ============================================
// Types
// ============================================

export type AgentRole = 'jeremy' | 'rachel' | 'amy' | 'antigravity'
export type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet' | 'gemini-1.5-pro'
export type ToolName = 'web_search' | 'youtube_transcript' | 'web_fetch' | 'image_search'

export interface ClaudeCodeOptions {
  agentRole?: AgentRole
  model?: ModelType
  tools?: ToolName[]
  systemPrompt?: string
  maxIterations?: number
}

export interface ClaudeCodeResult {
  success: boolean
  output?: string
  toolsUsed?: string[]
  iterations?: number
  error?: string
}

export interface UseClaudeCodeReturn {
  // State
  isLoading: boolean
  result: ClaudeCodeResult | null
  error: string | null

  // Actions
  execute: (task: string, context?: string) => Promise<ClaudeCodeResult>
  executeDocument: (prompt: string, format?: 'markdown' | 'richtext') => Promise<ClaudeCodeResult>
  executeCode: (description: string, language?: string, framework?: string) => Promise<ClaudeCodeResult>
  executeSearch: (query: string) => Promise<ClaudeCodeResult>
  executeYouTube: (videoUrl: string) => Promise<ClaudeCodeResult>
  executeAnalysis: (content: string, type?: 'summary' | 'sentiment' | 'keywords') => Promise<ClaudeCodeResult>
  reset: () => void
  abort: () => void
}

// ============================================
// Default Options
// ============================================

const DEFAULT_OPTIONS: Required<ClaudeCodeOptions> = {
  agentRole: 'amy',
  model: 'gpt-4o-mini',
  tools: ['web_search', 'youtube_transcript', 'image_search'],
  systemPrompt: '',
  maxIterations: 10,
}

// ============================================
// Hook Implementation
// ============================================

export function useClaudeCode(options: ClaudeCodeOptions = {}): UseClaudeCodeReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ClaudeCodeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  /**
   * Execute a task with Claude Code
   */
  const execute = useCallback(async (
    task: string,
    context?: string
  ): Promise<ClaudeCodeResult> => {
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/claude-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          context,
          agentRole: mergedOptions.agentRole,
          model: mergedOptions.model,
          tools: mergedOptions.tools,
          systemPrompt: mergedOptions.systemPrompt,
          maxIterations: mergedOptions.maxIterations,
        }),
        signal: abortControllerRef.current.signal,
      })

      const data: ClaudeCodeResult = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Execution failed')
      }

      setResult(data)
      return data

    } catch (err: any) {
      if (err.name === 'AbortError') {
        const abortResult: ClaudeCodeResult = {
          success: false,
          error: 'Request aborted',
        }
        setResult(abortResult)
        return abortResult
      }

      const errorMessage = err.message || 'Unknown error'
      setError(errorMessage)

      const errorResult: ClaudeCodeResult = {
        success: false,
        error: errorMessage,
      }
      setResult(errorResult)
      return errorResult

    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [mergedOptions])

  /**
   * Execute document generation
   */
  const executeDocument = useCallback(async (
    prompt: string,
    format: 'markdown' | 'richtext' = 'markdown'
  ): Promise<ClaudeCodeResult> => {
    const systemPrompt = format === 'markdown'
      ? `당신은 전문 문서 작성 AI입니다. 마크다운 형식으로 깔끔하고 구조화된 문서를 작성합니다.
규칙:
- 적절한 헤딩(#, ##, ###) 사용
- 코드 블록, 표, 목록 등 마크다운 기능 활용
- 한국어로 작성
- 전문적이고 명확한 톤 유지`
      : `당신은 전문 문서 작성 AI입니다. HTML 형식으로 깔끔하고 구조화된 문서를 작성합니다.
규칙:
- 적절한 HTML 태그 사용 (h1, h2, p, ul, ol 등)
- 인라인 스타일 최소화
- 한국어로 작성
- 전문적이고 명확한 톤 유지`

    return execute(prompt, undefined)
  }, [execute])

  /**
   * Execute code generation
   */
  const executeCode = useCallback(async (
    description: string,
    language: string = 'typescript',
    framework: string = 'react'
  ): Promise<ClaudeCodeResult> => {
    const task = `다음 요구사항에 맞는 ${language} 코드를 생성해주세요:

요구사항: ${description}
언어: ${language}
프레임워크: ${framework}

코드를 완전하고 실행 가능한 형태로 작성해주세요.
필요한 import 문과 타입 정의를 포함해주세요.`

    return execute(task)
  }, [execute])

  /**
   * Execute web search
   */
  const executeSearch = useCallback(async (query: string): Promise<ClaudeCodeResult> => {
    const task = `다음 주제에 대해 웹 검색을 수행하고 결과를 요약해주세요:

검색어: ${query}

검색 결과를 바탕으로:
1. 주요 정보를 요약해주세요
2. 관련 소스 URL을 제공해주세요
3. 추가로 알아볼 만한 관련 주제를 제안해주세요`

    return execute(task)
  }, [execute])

  /**
   * Execute YouTube transcript analysis
   */
  const executeYouTube = useCallback(async (videoUrl: string): Promise<ClaudeCodeResult> => {
    const task = `다음 YouTube 영상의 자막을 분석해주세요:

영상 URL: ${videoUrl}

분석 항목:
1. 영상 내용 요약 (3-5문장)
2. 주요 키워드 추출
3. 핵심 포인트 목록
4. 영상에서 언급된 중요 정보나 링크`

    return execute(task)
  }, [execute])

  /**
   * Execute content analysis
   */
  const executeAnalysis = useCallback(async (
    content: string,
    type: 'summary' | 'sentiment' | 'keywords' = 'summary'
  ): Promise<ClaudeCodeResult> => {
    const analysisPrompts = {
      summary: '다음 콘텐츠를 요약해주세요. 핵심 내용과 주요 포인트를 추출해주세요.',
      sentiment: '다음 콘텐츠의 감정을 분석해주세요. 긍정/부정/중립 여부와 그 근거를 설명해주세요.',
      keywords: '다음 콘텐츠에서 핵심 키워드를 추출해주세요. 각 키워드의 중요도와 맥락을 설명해주세요.',
    }

    const task = `${analysisPrompts[type]}

분석할 콘텐츠:
---
${content}
---`

    return execute(task)
  }, [execute])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false)
    setResult(null)
    setError(null)
  }, [])

  /**
   * Abort current request
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return {
    isLoading,
    result,
    error,
    execute,
    executeDocument,
    executeCode,
    executeSearch,
    executeYouTube,
    executeAnalysis,
    reset,
    abort,
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if Claude Code API is available
 */
export async function checkClaudeCodeHealth(): Promise<{
  available: boolean
  tools: string[]
  models: string[]
}> {
  try {
    const response = await fetch('/api/claude-code')
    const data = await response.json()

    return {
      available: data.status === 'ok',
      tools: [...(data.availableTools || []), ...(data.internalTools || [])],
      models: data.models || [],
    }
  } catch {
    return {
      available: false,
      tools: [],
      models: [],
    }
  }
}

/**
 * Create a pre-configured Claude Code hook for specific use cases
 */
export function createClaudeCodeHook(defaultOptions: ClaudeCodeOptions) {
  return function useConfiguredClaudeCode(overrideOptions?: ClaudeCodeOptions) {
    return useClaudeCode({ ...defaultOptions, ...overrideOptions })
  }
}

// Pre-configured hooks for common use cases
export const useDocumentAgent = createClaudeCodeHook({
  agentRole: 'amy',
  model: 'gpt-4o-mini',
  tools: ['web_search'],
})

export const useResearchAgent = createClaudeCodeHook({
  agentRole: 'rachel',
  model: 'gpt-4o',
  tools: ['web_search', 'youtube_transcript', 'web_fetch'],
})

export const useCodingAgent = createClaudeCodeHook({
  agentRole: 'jeremy',
  model: 'gpt-4o',
  tools: ['web_search'],
})

export default useClaudeCode
