// LLM Models & Provider Info - Client-safe exports (no OpenAI instances)

export type LLMProvider = 'openai' | 'grok' | 'gemini' | 'qwen' | 'ollama'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  temperature?: number
  maxTokens?: number
}

// 사용 가능한 모델 목록
export const AVAILABLE_MODELS = {
  grok: [
    { id: 'grok-3-mini', name: 'Grok 3 Mini', description: '경량 추론 모델 (저렴)', costTier: 'low', inputPrice: 0.30, outputPrice: 0.50 },
    { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast ⭐', description: '가성비 깡패 (추천)', costTier: 'medium', inputPrice: 1.00, outputPrice: 4.00 },
    { id: 'grok-2-1212', name: 'Grok 2', description: '131K 컨텍스트', costTier: 'medium', inputPrice: 2.00, outputPrice: 10.00 },
    { id: 'grok-3', name: 'Grok 3', description: '플래그십 모델', costTier: 'high', inputPrice: 3.00, outputPrice: 15.00 },
    { id: 'grok-4-0709', name: 'Grok 4', description: '최신 모델', costTier: 'high', inputPrice: 3.00, outputPrice: 15.00 },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '빠르고 저렴한 GPT-4', costTier: 'medium', inputPrice: 0.15, outputPrice: 0.60 },
    { id: 'gpt-4o', name: 'GPT-4o', description: '가장 강력한 모델', costTier: 'high', inputPrice: 5.00, outputPrice: 15.00 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '128K 컨텍스트', costTier: 'high', inputPrice: 10.00, outputPrice: 30.00 },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ⭐', description: '최신 플래시 (추천)', costTier: 'low', inputPrice: 0.15, outputPrice: 0.60 },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: '최저가 경량', costTier: 'low', inputPrice: 0.075, outputPrice: 0.30 },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '빠른 응답', costTier: 'low', inputPrice: 0.10, outputPrice: 0.40 },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '1M 컨텍스트', costTier: 'low', inputPrice: 0.075, outputPrice: 0.30 },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '고성능', costTier: 'medium', inputPrice: 1.25, outputPrice: 5.00 },
  ],
  qwen: [
    { id: 'qwen-turbo', name: 'Qwen Turbo', description: '빠른 응답', costTier: 'free', inputPrice: 0, outputPrice: 0 },
    { id: 'qwen-plus', name: 'Qwen Plus', description: '균형 잡힌 성능', costTier: 'free', inputPrice: 0, outputPrice: 0 },
    { id: 'qwen-max', name: 'Qwen Max', description: '최고 성능', costTier: 'free', inputPrice: 0, outputPrice: 0 },
  ],
  ollama: [
    { id: 'qwen2.5:3b', name: 'Qwen 2.5 3B', description: '로컬 경량 모델', costTier: 'free', inputPrice: 0, outputPrice: 0 },
    { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', description: '로컬 중형 모델', costTier: 'free', inputPrice: 0, outputPrice: 0 },
    { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: 'Meta 경량 모델', costTier: 'free', inputPrice: 0, outputPrice: 0 },
    { id: 'mistral:7b', name: 'Mistral 7B', description: '빠른 로컬 모델', costTier: 'free', inputPrice: 0, outputPrice: 0 },
  ],
} as const

// Provider 표시 정보
export const PROVIDER_INFO = {
  grok: { name: 'Grok (xAI)', icon: '🤖', description: '저렴하고 빠름', recommended: true },
  openai: { name: 'OpenAI', icon: '🧠', description: '고품질 응답', recommended: false },
  gemini: { name: 'Gemini (Google)', icon: '✨', description: '균형 잡힌 성능', recommended: false },
  qwen: { name: 'Qwen (Alibaba)', icon: '🌐', description: '무료 API', recommended: false },
  ollama: { name: 'Ollama (로컬)', icon: '💻', description: '무료, 프라이버시', recommended: false },
} as const

// Provider별 기본 모델
export function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'grok':
      return 'grok-3-mini'
    case 'openai':
      return 'gpt-4o-mini'
    case 'gemini':
      return 'gemini-2.0-flash-lite'
    case 'qwen':
      return 'qwen-turbo'
    case 'ollama':
      return 'qwen2.5:3b'
    default:
      return 'qwen2.5:3b'
  }
}

// Provider 사용 가능 여부 확인 (서버 전용 - 클라이언트에서는 항상 true 반환)
export function isProviderAvailable(provider: LLMProvider): boolean {
  if (typeof window !== 'undefined') {
    // 클라이언트에서는 항상 true (서버에서 실제 체크)
    return true
  }

  switch (provider) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'grok':
      return !!process.env.XAI_API_KEY
    case 'gemini':
      return !!process.env.GOOGLE_API_KEY
    case 'qwen':
      return !!process.env.DASHSCOPE_API_KEY
    case 'ollama':
      return true
    default:
      return false
  }
}
