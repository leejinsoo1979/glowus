// LLM Models & Provider Info - Client-safe exports (no OpenAI instances)

export type LLMProvider = 'anthropic' | 'openai' | 'grok' | 'gemini' | 'qwen' | 'ollama'

export interface LLMConfig {
  provider: LLMProvider
  model: string
  temperature?: number
  maxTokens?: number
}

// 사용 가능한 모델 목록
export const AVAILABLE_MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '최신 소넷 (추천)', costTier: 'medium', inputPrice: 3.00, outputPrice: 15.00, vision: true },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', description: '균형 잡힌 성능', costTier: 'medium', inputPrice: 3.00, outputPrice: 15.00, vision: true },
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', description: '빠르고 저렴', costTier: 'low', inputPrice: 0.80, outputPrice: 4.00, vision: true },
    { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', description: '최고 성능', costTier: 'high', inputPrice: 15.00, outputPrice: 75.00, vision: true },
  ],
  grok: [
    { id: 'grok-3-mini', name: 'Grok 3 Mini', description: '경량 추론 모델 (저렴)', costTier: 'low', inputPrice: 0.30, outputPrice: 0.50, vision: false },
    { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', description: '가성비 깡패 (추천)', costTier: 'medium', inputPrice: 1.00, outputPrice: 4.00, vision: false },
    { id: 'grok-2-1212', name: 'Grok 2', description: '131K 컨텍스트', costTier: 'medium', inputPrice: 2.00, outputPrice: 10.00, vision: false },
    { id: 'grok-3', name: 'Grok 3', description: '플래그십 모델', costTier: 'high', inputPrice: 3.00, outputPrice: 15.00, vision: false },
    { id: 'grok-4-0709', name: 'Grok 4', description: '최신 모델', costTier: 'high', inputPrice: 3.00, outputPrice: 15.00, vision: false },
    // Vision-capable models
    { id: 'grok-2-vision-latest', name: 'Grok 2 Vision', description: '이미지 분석 지원', costTier: 'medium', inputPrice: 2.00, outputPrice: 10.00, vision: true },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '빠르고 저렴한 GPT-4', costTier: 'medium', inputPrice: 0.15, outputPrice: 0.60, vision: true },
    { id: 'gpt-4o', name: 'GPT-4o', description: '가장 강력한 모델', costTier: 'high', inputPrice: 5.00, outputPrice: 15.00, vision: true },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '128K 컨텍스트', costTier: 'high', inputPrice: 10.00, outputPrice: 30.00, vision: true },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '최신 플래시 (추천)', costTier: 'low', inputPrice: 0.15, outputPrice: 0.60, vision: true },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: '최저가 경량', costTier: 'low', inputPrice: 0.075, outputPrice: 0.30, vision: true },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '빠른 응답', costTier: 'low', inputPrice: 0.10, outputPrice: 0.40, vision: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '1M 컨텍스트', costTier: 'low', inputPrice: 0.075, outputPrice: 0.30, vision: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '고성능', costTier: 'medium', inputPrice: 1.25, outputPrice: 5.00, vision: true },
  ],
  qwen: [
    { id: 'qwen-turbo', name: 'Qwen Turbo', description: '빠른 응답', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'qwen-plus', name: 'Qwen Plus', description: '균형 잡힌 성능', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'qwen-max', name: 'Qwen Max', description: '최고 성능', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'qwen-vl-max', name: 'Qwen VL Max', description: '이미지 분석 지원', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: true },
  ],
  ollama: [
    { id: 'qwen2.5:3b', name: 'Qwen 2.5 3B', description: '로컬 경량 모델', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', description: '로컬 중형 모델', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: 'Meta 경량 모델', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'mistral:7b', name: 'Mistral 7B', description: '빠른 로컬 모델', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: false },
    { id: 'llava:7b', name: 'LLaVA 7B', description: '로컬 비전 모델', costTier: 'free', inputPrice: 0, outputPrice: 0, vision: true },
  ],
} as const

// Provider 표시 정보
export const PROVIDER_INFO = {
  anthropic: { name: 'Claude (Anthropic)', icon: 'A', description: '안전하고 강력함', recommended: true },
  grok: { name: 'Grok (xAI)', icon: 'G', description: '저렴하고 빠름', recommended: true },
  openai: { name: 'OpenAI', icon: 'O', description: '고품질 응답', recommended: false },
  gemini: { name: 'Gemini (Google)', icon: 'Ge', description: '균형 잡힌 성능', recommended: false },
  qwen: { name: 'Qwen (Alibaba)', icon: 'Q', description: '무료 API', recommended: false },
  ollama: { name: 'Ollama (로컬)', icon: 'OL', description: '무료, 프라이버시', recommended: false },
} as const

// Provider별 기본 모델
export function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
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
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
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

// 모델이 비전(이미지) 지원하는지 확인
export function isVisionModel(provider: LLMProvider, model: string): boolean {
  const models = AVAILABLE_MODELS[provider]
  const modelInfo = models.find((m) => m.id === model)
  return modelInfo?.vision ?? false
}

// Provider별 비전 모델 가져오기
export function getVisionModel(provider: LLMProvider): string | null {
  const models = AVAILABLE_MODELS[provider]
  const visionModel = models.find((m) => m.vision === true)
  return visionModel?.id ?? null
}

// Provider별 비전 모델 매핑 (fallback 순서)
export const VISION_MODEL_FALLBACK: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  grok: 'grok-2-vision-latest',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  qwen: 'qwen-vl-max',
  ollama: 'llava:7b',
}
