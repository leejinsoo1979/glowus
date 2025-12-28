/**
 * Start Node: 시작
 * 에이전트 실행 시작점
 */

export interface StartInput {
  message: string
  context?: Record<string, unknown>
}

export interface StartOutput {
  message: string
  timestamp: number
  metadata: Record<string, unknown>
}

export async function execute(input: StartInput): Promise<StartOutput> {
  console.log('[시작] Agent started with input:', input.message)

  return {
    message: input.message,
    timestamp: Date.now(),
    metadata: {
      inputType: 'text',
      ...input.context,
    },
  }
}

export const nodeConfig = {
  type: 'start',
  label: '시작',
  description: '',
}
