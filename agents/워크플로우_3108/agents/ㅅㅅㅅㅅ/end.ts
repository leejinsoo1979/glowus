/**
 * End Node
 * 워크플로우 종료점
 */

export interface EndInput {
  [key: string]: unknown
}

export interface EndOutput {
  completedAt: string
  result: EndInput
}

export async function execute(input: EndInput): Promise<EndOutput> {
  console.log('[End] 워크플로우 완료:', input)

  return {
    completedAt: new Date().toISOString(),
    result: input,
  }
}
