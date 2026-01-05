import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// 개발 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
// 개발용 UUID (실제 users 테이블에 있는 ID)
const DEV_USER_ID = process.env.DEV_USER_ID || '014524d9-d3ed-46ab-b0b5-80beb5f4b7b8'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie setting in Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Handle cookie removal in Server Component
          }
        },
      },
    }
  )
}

// 개발 모드에서 사용할 목 유저
export const DEV_USER = DEV_MODE ? {
  id: DEV_USER_ID,
  email: 'dev@glowus.dev',
  user_metadata: { name: 'Dev User' },
} : null

// 인증된 사용자 가져오기 (개발 모드 지원)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAuthUser(supabase: any) {
  if (DEV_MODE && DEV_USER) {
    return { user: DEV_USER as any, error: null }
  }
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// Admin 클라이언트 (Service Role Key 사용, RLS 우회)
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// 개발 모드에서는 Admin 클라이언트 사용
export async function createClientForApi() {
  if (DEV_MODE) {
    return createAdminClient()
  }
  return await createClient()
}
