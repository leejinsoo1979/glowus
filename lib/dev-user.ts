/**
 * Development Test User
 *
 * 개발 환경에서 인증 없이 테스트할 수 있는 가상 사용자
 * .env.local에 DEV_BYPASS_AUTH=true 설정 필요
 */

export const DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@startupshow.local',
  name: 'Dev Tester',
  role: 'founder' as const,
  avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DevTester&backgroundColor=3B82F6',
  company: 'StartupShow Dev',
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
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
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
