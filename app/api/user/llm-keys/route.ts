import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// LLM 제공자 목록
export const LLM_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-opus-4-5-20251101', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'] },
  { id: 'google', name: 'Google AI', models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'xai', name: 'xAI (Grok)', models: ['grok-4-1', 'grok-4-1-fast', 'grok-2-latest'] },
  { id: 'mistral', name: 'Mistral AI', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
  { id: 'groq', name: 'Groq', models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'] },
] as const

// API 키 암호화 (실제 환경에서는 더 강력한 암호화 사용)
function encryptApiKey(key: string): string {
  return Buffer.from(key).toString('base64')
}

function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '********'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

// GET - 사용자의 LLM 키 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: keys, error } = await (supabase as any)
      .from('user_llm_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('provider', { ascending: true })
      .order('is_default', { ascending: false })

    if (error) {
      console.error('Failed to fetch LLM keys:', error)
      return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
    }

    // API 키 마스킹
    const maskedKeys = (keys || []).map((key: any) => ({
      ...key,
      api_key: maskApiKey(decryptApiKey(key.api_key)),
    }))

    return NextResponse.json({
      keys: maskedKeys,
      providers: LLM_PROVIDERS,
    })
  } catch (error) {
    console.error('Get LLM keys error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - 새 LLM 키 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { provider, api_key, display_name, is_default } = body

    if (!provider || !api_key) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 })
    }

    // 유효한 제공자인지 확인
    if (!LLM_PROVIDERS.find(p => p.id === provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // is_default가 true면 다른 같은 제공자의 기본 키 해제
    if (is_default) {
      await (supabase as any)
        .from('user_llm_keys')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('provider', provider)
    }

    // 새 키 추가
    const { data: newKey, error } = await (supabase as any)
      .from('user_llm_keys')
      .insert({
        user_id: user.id,
        provider,
        api_key: encryptApiKey(api_key),
        display_name: display_name || `${provider} API Key`,
        is_default: is_default || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add LLM key:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: '같은 이름의 키가 이미 존재합니다' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to add key' }, { status: 500 })
    }

    return NextResponse.json({
      key: {
        ...newKey,
        api_key: maskApiKey(api_key),
      },
    })
  } catch (error) {
    console.error('Add LLM key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - LLM 키 수정
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, display_name, is_default, is_active, api_key } = body

    if (!id) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    // 기존 키 확인
    const { data: existingKey } = await (supabase as any)
      .from('user_llm_keys')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existingKey) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    // is_default가 true면 다른 같은 제공자의 기본 키 해제
    if (is_default) {
      await (supabase as any)
        .from('user_llm_keys')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('provider', existingKey.provider)
    }

    // 업데이트할 데이터
    const updateData: any = {}
    if (display_name !== undefined) updateData.display_name = display_name
    if (is_default !== undefined) updateData.is_default = is_default
    if (is_active !== undefined) updateData.is_active = is_active
    if (api_key) updateData.api_key = encryptApiKey(api_key)

    const { data: updatedKey, error } = await (supabase as any)
      .from('user_llm_keys')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update LLM key:', error)
      return NextResponse.json({ error: 'Failed to update key' }, { status: 500 })
    }

    return NextResponse.json({
      key: {
        ...updatedKey,
        api_key: maskApiKey(decryptApiKey(updatedKey.api_key)),
      },
    })
  } catch (error) {
    console.error('Update LLM key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - LLM 키 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    const { error } = await (supabase as any)
      .from('user_llm_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete LLM key:', error)
      return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete LLM key error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
