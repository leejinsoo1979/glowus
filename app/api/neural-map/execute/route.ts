/**
 * NeuraMap Coding Agent API Route
 * Cursor/Claude Code 수준의 코딩 에이전트 실행 엔드포인트
 *
 * Features:
 * - SSE streaming for real-time updates
 * - Real tool execution (file system, terminal, git)
 * - Intelligent context gathering
 * - Agentic Loop: Plan → Modify → Verify → Commit
 */

import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { getGeminiClient } from '@/lib/llm/client'
import {
  handleToolCall,
  gatherContext,
  formatContextForLLM,
  CODING_TOOL_DEFINITIONS,
  type ToolCallResult,
} from '@/lib/neural-map/tools'
import type { AgentState, AgentPlan, AgentTask } from '@/lib/neural-map/types'

// ============================================
// Model Configuration
// ============================================

const DEFAULT_MODEL = 'gemini-2.0-flash-exp' // Gemini 2.0 Flash (빠르고 저렴)

// ============================================
// Constants & Configuration
// ============================================

const MAX_VERIFICATION_RETRIES = 3
const MAX_TOOL_RETRIES = 2
const RETRY_DELAY_MS = 500

// ============================================
// SSE Helper
// ============================================

function createSSEStream() {
  let controller: ReadableStreamDefaultController<Uint8Array>
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl
    },
  })

  const send = (type: string, data: unknown) => {
    const event = { type, data, timestamp: Date.now() }
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
  }

  const close = () => {
    try {
      controller.close()
    } catch {
      // Already closed
    }
  }

  return { stream, send, close }
}

// ============================================
// Helper Functions
// ============================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function executeToolWithRetry(
  toolCall: { name: string; args: Record<string, unknown>; projectPath: string },
  maxRetries: number = MAX_TOOL_RETRIES
): Promise<ToolCallResult> {
  let lastError: ToolCallResult | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await handleToolCall(toolCall)

    if (result.success) {
      return result
    }

    lastError = result

    // Don't retry on certain errors
    const errorStr = String(result.error || '')
    if (
      errorStr.includes('not found') ||
      errorStr.includes('permission denied') ||
      errorStr.includes('invalid path')
    ) {
      return result
    }

    if (attempt < maxRetries) {
      await delay(RETRY_DELAY_MS * (attempt + 1))
    }
  }

  return lastError!
}

// ============================================
// Tool Definitions for OpenAI-compatible API (Gemini)
// ============================================

const OPENAI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = CODING_TOOL_DEFINITIONS.map((def) => ({
  type: 'function' as const,
  function: {
    name: def.name.replace('.', '_'), // API doesn't like dots
    description: def.description,
    parameters: def.parameters as Record<string, unknown>,
  },
}))

// ============================================
// System Prompts
// ============================================

const CODING_AGENT_SYSTEM = `당신은 NeuraMap 코딩 에이전트입니다. Cursor와 Claude Code를 뛰어넘는 고급 AI 코딩 어시스턴트입니다.

## 사용 가능한 도구
- repo.search, repo.read, repo.symbols: 코드베이스 검색 및 분석
- repo.patch: 정밀한 코드 수정
- repo.run: 명령어, 빌드, 테스트 실행
- repo.git: Git 작업 관리
- repo.diagnostics: 오류 진단
- context.gather: 지능형 컨텍스트 수집

## 핵심 원칙
1. 컨텍스트 우선: 변경 전에 반드시 충분한 컨텍스트를 수집
2. 최소 변경: 문제 해결에 필요한 최소한의 변경만 수행
3. 모든 것을 검증: 수정 후 반드시 테스트 및 검증
4. 추론 설명: 사고 과정을 명확하게 설명

## 워크플로우 (에이전트 루프)
1. 계획(PLAN): 요청 이해, 컨텍스트 수집, 구조화된 계획 생성
2. 수정(MODIFY): 정밀한 코드 변경으로 계획 실행
3. 검증(VERIFY): 빌드, 린트, 테스트로 정확성 확인
4. 커밋(COMMIT): 의미 있는 메시지로 변경사항 커밋

## 출력 형식
- 코드는 언어 태그가 있는 코드 블록 사용
- 변경사항은 diff 형식으로 표시: \`\`\`diff
- 명확한 섹션으로 응답 구조화
- 파일 경로 표시: \`path/to/file.ts:lineNumber\`

## 중요 규칙
- 절대 파일 내용을 추측하지 말 것 - 반드시 repo.read 먼저 사용
- 변경 적용 전 반드시 diff 표시
- 수정 후 repo.diagnostics로 타입 에러 확인
- 각 변경의 이유를 설명

## 응답 언어
- 모든 설명과 응답은 한국어로 작성
- 이모지 사용 금지`

const PLAN_SYSTEM = `코딩 요청을 분석하여 구조화된 계획을 생성합니다.

사용자의 요청과 코드베이스 컨텍스트를 바탕으로 다음을 포함한 계획을 생성하세요:
1. 명확하고 실행 가능한 태스크
2. 영향을 받는 파일들
3. 각 태스크의 위험도 평가
4. 예상 복잡도

다음 JSON 형식으로 정확히 응답하세요:
{
  "understanding": "사용자 요청에 대한 간단한 요약",
  "tasks": [
    {
      "id": "task-1",
      "description": "수행할 작업 (한국어)",
      "files": ["path/to/file.ts"],
      "estimatedRisk": "low|medium|high",
      "requiredApproval": true|false,
      "reasoning": "이 태스크가 필요한 이유 (한국어)"
    }
  ],
  "commitMessage": "feat|fix|refactor: 짧은 설명",
  "dependencies": ["필요한 외부 의존성"],
  "warnings": ["주의할 잠재적 문제점 (한국어)"]
}

중요: 모든 description, reasoning, warnings는 한국어로 작성. 이모지 사용 금지.`

const AUTO_FIX_SYSTEM = `TypeScript 및 빌드 에러 수정 전문가입니다.

## 상황
이전 코드 변경으로 에러가 발생했습니다. 에러를 분석하고 수정해야 합니다.

## 에러 수정 전략
1. 에러 메시지를 주의 깊게 읽기 - 무엇이 문제인지 파악
2. 근본 원인 파악 - 증상이 아닌 원인을 찾기
3. 최소한의 변경 - 문제가 있는 부분만 수정
4. 타입 호환성 확인 - 타입이 일치하는지 확인

## 일반적인 에러 패턴과 해결책
- "Property X does not exist on type Y" -> 타입 정의 확인, 누락된 속성 추가
- "Type X is not assignable to type Y" -> 적절히 캐스팅하거나 타입 수정
- "Cannot find module X" -> import 경로 확인, 필요시 설치
- "Parameter X implicitly has an 'any' type" -> 명시적 타입 어노테이션 추가

## 중요
- repo.read로 현재 파일 상태 확인
- repo.patch로 수정 적용
- 한 번에 하나씩 수정하고 검증 후 다음으로
- 2번 시도 후에도 같은 에러가 지속되면 수정 불가로 보고

## 응답 언어
- 모든 설명은 한국어로 작성
- 이모지 사용 금지`

// ============================================
// Main Execution Handler
// ============================================

export async function POST(req: NextRequest) {
  const { input, imageDataUrl, state } = (await req.json()) as {
    input: string
    imageDataUrl?: string
    state: AgentState
  }

  // Handle approval signals
  if (input.startsWith('__APPROVAL__:')) {
    const status = input.split(':')[1]
    if (status === 'rejected') {
      return Response.json({ success: true, status: 'rejected' })
    }
    // Continue with approved plan
  }

  const { stream, send, close } = createSSEStream()

  // Process asynchronously
  ;(async () => {
    try {
      const client = getGeminiClient()
      const projectPath = state.metadata.projectPath || process.cwd()

      // ============================================
      // Phase 1: PLAN
      // ============================================
      if (input !== '__APPROVAL__:approved' || !state.plan) {
        send('stage_change', { stage: 'plan', previousStage: 'idle' })

        // Step 1.1: Gather context intelligently
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '[분석] 코드베이스 분석 및 컨텍스트 수집 중...',
          timestamp: Date.now(),
        })

        const contextWindow = await gatherContext({
          query: input,
          projectPath,
          currentFile: state.context.files[0]?.path,
          depth: 'medium',
          maxTokens: 80000,
        })

        const contextForLLM = formatContextForLLM(contextWindow)

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `[컨텍스트] 수집 완료: ${contextWindow.items.length}개 항목, ${contextWindow.totalTokens.toLocaleString()} 토큰 (${(contextWindow.utilization * 100).toFixed(1)}% 활용률)`,
          timestamp: Date.now(),
        })

        // Step 1.2: Generate plan with LLM
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '[계획] 요청 분석 및 실행 계획 생성 중...',
          timestamp: Date.now(),
        })

        const planMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: PLAN_SYSTEM,
          },
          {
            role: 'user',
            content: imageDataUrl
              ? [
                  {
                    type: 'image_url' as const,
                    image_url: {
                      url: imageDataUrl,
                    },
                  },
                  {
                    type: 'text' as const,
                    text: `User Request: ${input}\n\n${contextForLLM}`,
                  },
                ]
              : `User Request: ${input}\n\n${contextForLLM}`,
          },
        ]

        const planResponse = await client.chat.completions.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
          messages: planMessages,
        })

        const planContent = planResponse.choices[0]?.message?.content
        if (!planContent) {
          throw new Error('Unexpected response type')
        }

        // Parse plan
        const jsonMatch = planContent.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('Failed to parse plan')
        }

        const parsed = JSON.parse(jsonMatch[0])
        const tasks: AgentTask[] = parsed.tasks.map((t: any, i: number) => ({
          id: t.id || `task-${i + 1}`,
          description: t.description,
          status: 'pending' as const,
          files: t.files || [],
          estimatedRisk: t.estimatedRisk || 'low',
          requiredApproval: Boolean(t.requiredApproval),
        }))

        const plan: AgentPlan = {
          tasks,
          currentTaskIndex: 0,
          approvalStatus: 'pending',
          commitMessage: parsed.commitMessage || 'chore: Apply changes',
          files: tasks.flatMap((t) => t.files),
          generatedAt: Date.now(),
        }

        send('plan', plan)

        // Send plan summary
        const planSummary = `## 실행 계획

**요청 이해**: ${parsed.understanding}

### 태스크:
${tasks.map((t, i) => `${i + 1}. **${t.description}**
   - 파일: ${t.files.join(', ') || '미정'}
   - 위험도: ${t.estimatedRisk}
   ${t.requiredApproval ? '   - [주의] 승인 필요' : ''}`).join('\n')}

${parsed.warnings?.length ? `### 경고:\n${parsed.warnings.map((w: string) => `- ${w}`).join('\n')}` : ''}

**커밋 메시지**: \`${plan.commitMessage}\`

---
*검토 후 **승인** 또는 **거부**를 클릭하세요.*`

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: planSummary,
          timestamp: Date.now(),
        })

        send('complete', { waitingForApproval: true, plan })
        close()
        return
      }

      // ============================================
      // Phase 2: MODIFY (Approved)
      // ============================================
      send('stage_change', { stage: 'modify', previousStage: 'plan' })

      const currentPlan = state.plan!
      const modifyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: CODING_AGENT_SYSTEM },
        ...state.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ]

      // Execute each task with agentic loop
      for (let taskIdx = currentPlan.currentTaskIndex; taskIdx < currentPlan.tasks.length; taskIdx++) {
        const task = currentPlan.tasks[taskIdx]

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `\n## [태스크 ${taskIdx + 1}/${currentPlan.tasks.length}] ${task.description}`,
          timestamp: Date.now(),
        })

        // Have LLM execute the task with tools
        const taskMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          ...modifyMessages,
          {
            role: 'user',
            content: `Execute Task ${taskIdx + 1}: ${task.description}\n\nFiles to modify: ${task.files.join(', ')}\n\nUse the available tools to read files, make changes, and verify your work.`,
          },
        ]

        let continueLoop = true
        while (continueLoop) {
          const taskResponse = await client.chat.completions.create({
            model: DEFAULT_MODEL,
            max_tokens: 8192,
            tools: OPENAI_TOOLS,
            messages: taskMessages,
          })

          const choice = taskResponse.choices[0]
          const message = choice?.message

          // Process text content
          if (message?.content) {
            send('message', {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: message.content,
              timestamp: Date.now(),
            })
          }

          // Process tool calls
          if (message?.tool_calls && message.tool_calls.length > 0) {
            // Add assistant message with tool calls
            taskMessages.push({
              role: 'assistant',
              content: message.content || null,
              tool_calls: message.tool_calls,
            })

            for (const toolCall of message.tool_calls) {
              const toolCallId = toolCall.id
              const fn = (toolCall as any).function
              const toolName = fn?.name?.replace('_', '.') || ''
              const toolArgs = JSON.parse(fn?.arguments || '{}')

              send('tool_call', {
                id: toolCallId,
                name: toolName,
                args: toolArgs,
              })

              const toolResult = await executeToolWithRetry({
                name: toolName,
                args: toolArgs,
                projectPath,
              })

              send('tool_result', {
                id: toolCallId,
                name: toolName,
                success: toolResult.success,
                result: toolResult.result,
                error: toolResult.error,
                executionTime: toolResult.executionTime,
              })

              // Add tool result to messages
              taskMessages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content: JSON.stringify(toolResult.result),
              })
            }
          } else {
            // No tool calls, add assistant message
            if (message?.content) {
              taskMessages.push({ role: 'assistant', content: message.content })
            }
          }

          // Check if we should continue the loop
          if (choice?.finish_reason === 'stop') {
            continueLoop = false
          } else if (choice?.finish_reason !== 'tool_calls') {
            continueLoop = false
          }
        }
      }

      // ============================================
      // Phase 3: VERIFY (with Auto-Fix Loop)
      // ============================================
      send('stage_change', { stage: 'verify', previousStage: 'modify' })

      let verificationAttempt = 0
      let verificationPassed = false
      let lastDiagnostics: any = null
      const fixMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: AUTO_FIX_SYSTEM },
      ]

      while (verificationAttempt < MAX_VERIFICATION_RETRIES && !verificationPassed) {
        verificationAttempt++

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: verificationAttempt === 1
            ? '## [검증] 빌드 및 타입 검사 실행 중...'
            : `## [재검증 ${verificationAttempt}/${MAX_VERIFICATION_RETRIES}] 수정 후 재검사 중...`,
          timestamp: Date.now(),
        })

        // Run TypeScript check
        const tscResult = await handleToolCall({
          name: 'repo.diagnostics',
          args: { source: 'typescript' },
          projectPath,
        })

        send('tool_result', {
          id: crypto.randomUUID(),
          name: 'repo.diagnostics',
          success: tscResult.success,
          result: tscResult.result,
          executionTime: tscResult.executionTime,
        })

        lastDiagnostics = tscResult.result as any
        const hasErrors = lastDiagnostics?.summary?.errors > 0

        if (!hasErrors) {
          verificationPassed = true
          break
        }

        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `[경고] 검증 결과 ${lastDiagnostics.summary.errors}개 에러 발견:\n\n${lastDiagnostics.items?.slice(0, 10).map((d: any) => `- \`${d.file}:${d.line}\` - ${d.message}`).join('\n')}`,
          timestamp: Date.now(),
        })

        // If not the last attempt, try to auto-fix
        if (verificationAttempt < MAX_VERIFICATION_RETRIES) {
          send('message', {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `## [자동 수정 ${verificationAttempt}차 시도]\n\n에러 분석 및 수정 적용 중...`,
            timestamp: Date.now(),
          })

          // Back to MODIFY stage for auto-fix
          send('stage_change', { stage: 'modify', previousStage: 'verify' })

          // Prepare error context for LLM
          const errorContext = lastDiagnostics.items?.slice(0, 15).map((d: any) =>
            `File: ${d.file}\nLine: ${d.line}\nColumn: ${d.column}\nError: ${d.message}\nCode: ${d.code}`
          ).join('\n\n---\n\n')

          const fixPrompt = `The following TypeScript errors occurred after our changes. Please fix them:

\`\`\`
${errorContext}
\`\`\`

Instructions:
1. Read the affected files to understand the context
2. Apply minimal fixes to resolve the errors
3. Focus on type errors and import issues first

Please fix these errors now using the available tools.`

          fixMessages.push({
            role: 'user',
            content: fixPrompt,
          })

          // Let LLM fix the errors
          let fixLoop = true
          while (fixLoop) {
            const fixResponse = await client.chat.completions.create({
              model: DEFAULT_MODEL,
              max_tokens: 8192,
              tools: OPENAI_TOOLS,
              messages: fixMessages,
            })

            const choice = fixResponse.choices[0]
            const message = choice?.message

            // Process text content
            if (message?.content) {
              send('message', {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: message.content,
                timestamp: Date.now(),
              })
            }

            // Process tool calls
            if (message?.tool_calls && message.tool_calls.length > 0) {
              fixMessages.push({
                role: 'assistant',
                content: message.content || null,
                tool_calls: message.tool_calls,
              })

              for (const toolCall of message.tool_calls) {
                const toolCallId = toolCall.id
                const fn = (toolCall as any).function
                const toolName = fn?.name?.replace('_', '.') || ''
                const toolArgs = JSON.parse(fn?.arguments || '{}')

                send('tool_call', {
                  id: toolCallId,
                  name: toolName,
                  args: toolArgs,
                })

                const toolResult = await executeToolWithRetry({
                  name: toolName,
                  args: toolArgs,
                  projectPath,
                })

                send('tool_result', {
                  id: toolCallId,
                  name: toolName,
                  success: toolResult.success,
                  result: toolResult.result,
                  error: toolResult.error,
                  executionTime: toolResult.executionTime,
                })

                fixMessages.push({
                  role: 'tool',
                  tool_call_id: toolCallId,
                  content: JSON.stringify(toolResult.result),
                })
              }
            } else if (message?.content) {
              fixMessages.push({ role: 'assistant', content: message.content })
            }

            if (choice?.finish_reason === 'stop' || choice?.finish_reason !== 'tool_calls') {
              fixLoop = false
            }
          }

          // Go back to verify
          send('stage_change', { stage: 'verify', previousStage: 'modify' })
        }
      }

      if (!verificationPassed) {
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `[실패] ${MAX_VERIFICATION_RETRIES}번 시도 후 자동 수정 실패.\n\n남은 에러:\n${lastDiagnostics.items?.slice(0, 5).map((d: any) => `- \`${d.file}:${d.line}\` - ${d.message}`).join('\n')}\n\n수동으로 검토 및 수정이 필요합니다.`,
          timestamp: Date.now(),
        })
        send('error', 'Auto-fix could not resolve all errors. Manual intervention required.')
        send('complete', { success: false, diagnostics: lastDiagnostics })
        close()
        return
      }

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `[성공] 검증 통과!${verificationAttempt > 1 ? ` (${verificationAttempt - 1}번 자동 수정 후)` : ''}\n\n- 에러: 0\n- 경고: ${lastDiagnostics?.summary?.warnings || 0}`,
        timestamp: Date.now(),
      })

      // ============================================
      // Phase 4: COMMIT
      // ============================================
      send('stage_change', { stage: 'commit', previousStage: 'verify' })

      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '## [커밋] Git 커밋 단계\n\nGit 커밋 생성 중...',
        timestamp: Date.now(),
      })

      // Git add
      const addResult = await handleToolCall({
        name: 'repo.git',
        args: { command: 'add', args: ['.'] },
        projectPath,
      })

      // Git commit
      const commitResult = await handleToolCall({
        name: 'repo.git',
        args: {
          command: 'commit',
          args: ['-m', currentPlan.commitMessage || 'chore: Apply changes'],
        },
        projectPath,
      })

      if (commitResult.success) {
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `[성공] 커밋 완료!\n\n\`\`\`\n${currentPlan.commitMessage}\n\`\`\``,
          timestamp: Date.now(),
        })
      } else {
        send('message', {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `[정보] 커밋할 변경사항이 없거나 건너뜀.\n\n${(commitResult.result as any)?.error || ''}`,
          timestamp: Date.now(),
        })
      }

      // ============================================
      // Complete
      // ============================================
      send('message', {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `\n---\n\n## [완료] 모든 태스크 완료!\n\n${currentPlan.tasks.map((t, i) => `- [x] 태스크 ${i + 1}: ${t.description}`).join('\n')}`,
        timestamp: Date.now(),
      })

      send('complete', { success: true })
    } catch (error) {
      console.error('Execution error:', error)
      send('error', error instanceof Error ? error.message : 'Unknown error')
      send('complete', { success: false })
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
