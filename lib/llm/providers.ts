// LLM 제공자 목록
// ⚠️ Anthropic 제외 - Claude Code CLI (Max 플랜 OAuth)로만 사용
export const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'google', name: 'Google AI', models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'xai', name: 'xAI (Grok)', models: ['grok-4-1', 'grok-4-1-fast', 'grok-2-latest'] },
  { id: 'mistral', name: 'Mistral AI', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
] as const

export type LLMProviderId = typeof LLM_PROVIDERS[number]['id']
