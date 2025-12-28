/**
 * Start Node: start
 * Workflow entry point
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
  console.log('[start] Agent started with input:', input.message)

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
  label: 'start',
  description: 'Workflow entry point',
}
