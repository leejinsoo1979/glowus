import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 개발 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'

// 인증이 필요한 경로
const protectedRoutes = ['/dashboard-group']
// 인증된 사용자가 접근하면 안되는 경로 (이미 로그인한 경우)
const authRoutes = ['/auth-group/login', '/auth-group/signup']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const userAgent = request.headers.get('user-agent') || ''
  // Electron environment detection (assuming standard Electron UA or custom one)
  const isElectron = userAgent.includes('Electron') || userAgent.includes('GlowUS')

  // 🔓 개발 모드: 인증 바이패스 (DEV_BYPASS_AUTH=true)
  if (DEV_MODE) {
    console.log('[DEV] Auth bypass enabled for:', pathname)
    // Electron에서 루트 경로면 대시보드로 바로 이동
    if (isElectron && pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard-group', request.url))
    }
    return response
  }

  // 🖥️ Electron App: Root path redirects directly to app entry
  if (isElectron && pathname === '/') {
    // If logged in, go to dashboard. If not, go to login. Skip landing page.
    const destination = user ? '/dashboard-group' : '/auth-group/login'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  // 보호된 경로에 인증 없이 접근 시 로그인 페이지로 리다이렉트
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !user) {
    const redirectUrl = new URL('/auth-group/login', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 이미 로그인한 사용자가 인증 페이지에 접근 시 대시보드로 리다이렉트
  if (authRoutes.some(route => pathname.startsWith(route)) && user) {
    return NextResponse.redirect(new URL('/dashboard-group', request.url))
  }

  return response
}
