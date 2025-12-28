/**
 * End Node: 종료
 * 에이전트 실행 종료점
 */

export interface EndInput {
  result: unknown
  metadata?: Record<string, unknown>
}

export interface EndOutput {
  success: boolean
  result: unknown
  executionTime: number
}

let startTime = Date.now()

export function setStartTime(time: number) {
  startTime = time
}

export async function execute(input: EndInput): Promise<EndOutput> {
  const executionTime = Date.now() - startTime

  console.log('[종료] Agent completed in', executionTime, 'ms')

  return {
    success: true,
    result: input.result,
    executionTime,
  }
}

export const nodeConfig = {
  type: 'end',
  label: '종료',
  description: '',
  outputType: 'text',
  outputFormat: '',
}
