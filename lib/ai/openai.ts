import OpenAI from 'openai'

// OpenAI 클라이언트 초기화 (lazy)
let _openai: OpenAI | null = null

export const getOpenAI = () => {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return _openai
}

// Backward compatibility
export const openai = {
  get chat() {
    return getOpenAI().chat
  },
  get completions() {
    return getOpenAI().completions
  },
  get embeddings() {
    return getOpenAI().embeddings
  },
  get images() {
    return getOpenAI().images
  },
}

// 모델 설정
export const AI_CONFIG = {
  model: 'gpt-4-turbo-preview',
  temperature: 0.3,
  maxTokens: 2000,
}

// 응답 타입
export interface AIResponse<T> {
  success: boolean
  data?: T
  error?: string
}
