/**
 * Start Node
 * 워크플로우 시작점
 */

export interface StartInput {
  message?: string
  [key: string]: unknown
}

export interface StartOutput {
  startedAt: string
  input: StartInput
}

export async function execute(input: StartInput): Promise<StartOutput> {
  console.log('[Start] 워크플로우 시작:', input)

  return {
    startedAt: new Date().toISOString(),
    input,
  }
}
