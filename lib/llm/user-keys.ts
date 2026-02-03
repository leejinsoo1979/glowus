import { createAdminClient } from '@/lib/supabase/admin'

// API 키 복호화
function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}

// Provider ID를 내부 provider 이름으로 매핑
// ⚠️ Anthropic 제외 - Claude Code CLI (Max 플랜 OAuth)로만 사용
const PROVIDER_MAPPING: Record<string, string> = {
  openai: 'openai',
  google: 'gemini',
  xai: 'grok',
  mistral: 'mistral',
  groq: 'groq',
  // 역방향 매핑도 추가
  grok: 'xai',
  gemini: 'google',
}

/**
 * 사용자의 LLM API 키를 가져옵니다.
 * 기본 키를 우선으로 반환하고, 없으면 첫 번째 활성화된 키를 반환합니다.
 */
export async function getUserLLMKey(
  userId: string,
  provider: string
): Promise<string | null> {
  try {
    const adminClient = createAdminClient()

    // provider 이름 정규화 (grok -> xai, gemini -> google)
    const normalizedProvider = PROVIDER_MAPPING[provider] || provider
    const dbProvider = PROVIDER_MAPPING[normalizedProvider] || normalizedProvider

    // 기본 키 우선 조회
    const { data: defaultKey } = await (adminClient as any)
      .from('user_llm_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', dbProvider)
      .eq('is_default', true)
      .eq('is_active', true)
      .single()

    if (defaultKey?.api_key) {
      // last_used_at 업데이트
      await (adminClient as any)
        .from('user_llm_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', dbProvider)
        .eq('is_default', true)

      return decryptApiKey(defaultKey.api_key)
    }

    // 기본 키가 없으면 활성화된 키 중 첫 번째 반환
    const { data: anyKey } = await (adminClient as any)
      .from('user_llm_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', dbProvider)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (anyKey?.api_key) {
      return decryptApiKey(anyKey.api_key)
    }

    return null
  } catch (error) {
    console.error(`[getUserLLMKey] Error fetching key for ${provider}:`, error)
    return null
  }
}

/**
 * 사용자의 모든 LLM API 키를 가져옵니다. (provider별)
 */
export async function getAllUserLLMKeys(
  userId: string
): Promise<Record<string, string>> {
  try {
    const adminClient = createAdminClient()

    const { data: keys, error } = await (adminClient as any)
      .from('user_llm_keys')
      .select('provider, api_key, is_default')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })

    if (error || !keys) {
      return {}
    }

    const result: Record<string, string> = {}

    // 각 provider별로 기본 키 또는 첫 번째 키 사용
    for (const key of keys) {
      const normalizedProvider = PROVIDER_MAPPING[key.provider] || key.provider
      if (!result[normalizedProvider]) {
        result[normalizedProvider] = decryptApiKey(key.api_key)
      }
    }

    return result
  } catch (error) {
    console.error('[getAllUserLLMKeys] Error:', error)
    return {}
  }
}

/**
 * 에이전트 실행에 사용할 LLM 설정을 가져옵니다.
 * 사용자 키가 있으면 사용하고, 없으면 환경변수 키 사용
 */
export async function getLLMConfigForAgent(
  userId: string,
  provider: string,
  model?: string
): Promise<{
  apiKey: string | undefined
  useUserKey: boolean
}> {
  // 사용자 키 조회
  const userKey = await getUserLLMKey(userId, provider)

  if (userKey) {
    return {
      apiKey: userKey,
      useUserKey: true,
    }
  }

  // 환경변수에서 기본 키 사용
  // ⚠️ Anthropic 제외 - Claude Code CLI (Max 플랜 OAuth)로만 사용
  const envKeyMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    grok: process.env.XAI_API_KEY,
    xai: process.env.XAI_API_KEY,
    gemini: process.env.GOOGLE_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    groq: process.env.GROQ_API_KEY,
  }

  return {
    apiKey: envKeyMap[provider],
    useUserKey: false,
  }
}
