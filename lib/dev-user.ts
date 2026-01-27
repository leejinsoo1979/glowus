/**
 * Development Test User
 *
 * 개발 환경에서 인증 없이 테스트할 수 있는 가상 사용자
 * .env.local에 DEV_BYPASS_AUTH=true 설정 필요
 */

export const DEV_USER = {
  id: '014524d9-d3ed-46ab-b0b5-80beb5f4b7b8',  // 실제 사용자 ID (sbbc212@gmail.com)
  email: 'sbbc212@gmail.com',
  name: '진수',
  role: '대표',
  avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DevTester&backgroundColor=3B82F6',
  company: 'GlowUS',
  created_at: new Date().toISOString(),
}

export const DEV_STARTUP = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Dev Startup',
  founder_id: DEV_USER.id,
  description: '개발 테스트용 스타트업',
  created_at: new Date().toISOString(),
}

export const DEV_TEAM = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Dev Team',
  startup_id: DEV_STARTUP.id,
  created_at: new Date().toISOString(),
}

/**
 * 개발 모드 활성화 여부 확인
 * 클라이언트: NEXT_PUBLIC_DEV_BYPASS_AUTH 사용
 * 서버: DEV_BYPASS_AUTH 사용
 */
export function isDevMode(): boolean {
  const isClient = typeof window !== 'undefined'
  const devBypass = isClient
    ? process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH
    : process.env.DEV_BYPASS_AUTH
  return process.env.NODE_ENV === 'development' && devBypass === 'true'
}

/**
 * 개발 모드일 때 가상 사용자 반환
 */
export function getDevUserIfEnabled() {
  if (isDevMode()) {
    return DEV_USER
  }
  return null
}

// Alias for backward compatibility
export const getDevUser = getDevUserIfEnabled
