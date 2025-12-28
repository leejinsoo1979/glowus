/**
 * Prompt Node: 입력
 * Input text or prompt
 */

export interface PromptInput {
  variables: Record<string, string>
}

export interface PromptOutput {
  prompt: string
  variables: Record<string, string>
}

export const template = `{{input}}`

export async function execute(input: PromptInput): Promise<PromptOutput> {
  let prompt = template

  // 변수 치환
  for (const [key, value] of Object.entries(input.variables)) {
    prompt = prompt.replace(new RegExp(`{{\s*${key}\s*}}`, 'g'), value)
  }

  console.log('[입력] 프롬프트 생성 완료')

  return {
    prompt,
    variables: input.variables,
  }
}

export const nodeConfig = {
  type: 'prompt',
  label: '입력',
  description: 'Input text or prompt',
}
