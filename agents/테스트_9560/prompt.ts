/**
 * Prompt Node: prompt
 * 프롬프트 템플릿 처리
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

  console.log('[prompt] 프롬프트 생성 완료')

  return {
    prompt,
    variables: input.variables,
  }
}

export const nodeConfig = {
  type: 'prompt',
  label: 'prompt',
  description: '',
}
