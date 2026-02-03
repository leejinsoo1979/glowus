'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { SWRConfig } from 'swr'
import { Header } from '@/components/nav/Header'
import { AgentNotificationProvider } from '@/lib/contexts/AgentNotificationContext'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useGlowContextStore } from '@/stores/glowContextStore'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { User, Startup } from '@/types'

// 동적 임포트 - 초기 번들 크기 감소 (60MB → 예상 10-15MB)
const TwoLevelSidebar = dynamic(
  () => import('@/components/nav/TwoLevelSidebar').then(mod => ({ default: mod.TwoLevelSidebar })),
  { ssr: false }
)
const CommitModal = dynamic(
  () => import('@/components/commits/CommitModal').then(mod => ({ default: mod.CommitModal })),
  { ssr: false }
)
const GlobalAgentSidebar = dynamic(
  () => import('@/components/nav/GlobalAgentSidebar').then(mod => ({ default: mod.GlobalAgentSidebar })),
  { ssr: false }
)
const ElectronHeader = dynamic(
  () => import('@/components/nav/ElectronHeader').then(mod => ({ default: mod.ElectronHeader })),
  { ssr: false }
)
const LeftPanel = dynamic(
  () => import('@/components/nav/LeftPanel').then(mod => ({ default: mod.LeftPanel })),
  { ssr: false }
)
const AgentNotificationPopup = dynamic(
  () => import('@/components/notifications/AgentNotificationPopup').then(mod => ({ default: mod.AgentNotificationPopup })),
  { ssr: false }
)
const GovernmentProgramNotificationListener = dynamic(
  () => import('@/components/notifications/GovernmentProgramNotificationListener').then(mod => ({ default: mod.GovernmentProgramNotificationListener })),
  { ssr: false }
)

// SWR 전역 설정 - 데이터 캐싱으로 페이지 이동 속도 향상
const swrConfig = {
  revalidateOnFocus: false, // 탭 포커스 시 재요청 안 함
  revalidateOnReconnect: false, // 네트워크 재연결 시 재요청 안 함
  dedupingInterval: 30000, // 30초간 중복 요청 방지
  keepPreviousData: true, // 이전 데이터 유지 (빠른 페이지 전환)
  errorRetryCount: 2, // 에러 시 2회만 재시도
}

// DEV 모드 체크 (클라이언트용)
const DEV_BYPASS_AUTH = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
const DEV_USER = {
  id: '014524d9-d3ed-46ab-b0b5-80beb5f4b7b8',  // 실제 사용자 ID (sbbc212@gmail.com)
  email: 'sbbc212@gmail.com',
  name: 'j제이',
  role: 'FOUNDER' as const,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, setUser, setCurrentStartup, setIsLoading, isLoading, _hasHydrated } = useAuthStore()
  // Include isResizingLevel2 for global resize fix
  const { sidebarOpen, emailSidebarWidth, isResizingEmail, agentSidebarOpen, toggleAgentSidebar, level2Width, isResizingLevel2, level2Collapsed } = useUIStore()
  const setCurrentPage = useGlowContextStore((s) => s.setCurrentPage)
  const [mounted, setMounted] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  // user가 persist에서 이미 로드되었으면 바로 렌더링
  const hasPersistedUser = _hasHydrated && !!user

  useEffect(() => {
    const checkElectron = () => {
      const isEl = typeof window !== 'undefined' &&
        (!!(window as any).electron ||
          navigator.userAgent.toLowerCase().includes('electron') ||
          (window as any).process?.versions?.electron ||
          document.documentElement.classList.contains('electron-app') ||
          window.location.search.includes('electron=true'));
      setIsElectron(isEl)
    }
    checkElectron()
  }, [])

  // 🌐 글로벌 AI Browser 패널 자동 열기 리스너
  // Neural Map 페이지가 아닌 곳에서도 브라우저 요청 시 자동으로 이동
  useEffect(() => {
    const electronApi = (window as any).electron?.aiBrowser
    if (!electronApi?.onOpenPanel) return

    const unsubscribe = electronApi.onOpenPanel(() => {
      console.log('[Dashboard Layout] 🌐 AI Browser requested panel open!')

      // Neural Map 페이지가 아니면 이동
      if (!pathname?.includes('/ai-coding')) {
        console.log('[Dashboard Layout] Navigating to Neural Map with browser tab...')
        router.push('/dashboard-group/ai-coding?tab=browser')
      }
    })

    return () => unsubscribe?.()
  }, [pathname, router])

  // ⚙️ 네이티브 메뉴 Preferences 리스너 (Cmd+,)
  useEffect(() => {
    const electronApi = (window as any).electron
    if (!electronApi?.onMenuEvent) return

    const unsubscribe = electronApi.onMenuEvent('menu:preferences', () => {
      console.log('[Dashboard Layout] ⚙️ Preferences menu clicked!')
      router.push('/dashboard-group/settings')
    })

    return () => unsubscribe?.()
  }, [router])
  // 페이지 변경 추적 (Claude Code 컨텍스트용)
  useEffect(() => {
    if (pathname) {
      // 페이지 타이틀 추출
      const pageMap: Record<string, string> = {
        '/dashboard-group': '대시보드',
        '/dashboard-group/ai-coding': 'AI 코딩 (Neural Map)',
        '/dashboard-group/apps/ai-slides': 'AI 슬라이드',
        '/dashboard-group/apps/ai-docs': 'AI 문서',
        '/dashboard-group/apps/ai-sheet': 'AI 시트',
        '/dashboard-group/messenger': '메신저',
        '/dashboard-group/calendar': '캘린더',
        '/dashboard-group/files': '파일',
        '/dashboard-group/works': '작업',
        '/dashboard-group/settings': '설정',
        '/dashboard-group/neurons': '뉴런',
        '/dashboard-group/agents': '에이전트',
        '/dashboard-group/task-hub': '태스크 허브',
        '/dashboard-group/connect': '연결',
      }
      const title = Object.entries(pageMap).find(([key]) => pathname.startsWith(key))?.[1] || pathname
      setCurrentPage(pathname, title)
    }
  }, [pathname, setCurrentPage])

  const isTaskHistoryPage = pathname?.includes('/task-history')
  const isCodingWorkspace = pathname?.includes('/works/coding')
  const isMeetingsPage = pathname?.includes('/messenger/meetings')
  const isWorkflowBuilderPage = pathname?.includes('/workflow-builder')
  const isFullWidthPage = (pathname?.includes('/messenger') && !isMeetingsPage) || pathname?.includes('/agent-builder') || pathname?.includes('/email') || pathname?.includes('/project') || pathname?.includes('/task-hub') || pathname?.includes('/works/new') || pathname?.includes('/apps/ai-slides') || pathname?.includes('/apps/ai-sheet') || pathname?.includes('/apps/ai-docs') || pathname?.includes('/apps/ai-summary') || pathname?.includes('/apps/ai-blog') || pathname?.includes('/apps/ai-studio') || pathname?.includes('/company/government-programs') || pathname?.includes('/ai-coding') || pathname?.includes('/neurons') || pathname?.includes('/gantt') || pathname?.includes('/agents/create') || isTaskHistoryPage || isCodingWorkspace || isWorkflowBuilderPage

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Get initial session - 병렬 처리로 로그인 속도 최적화
    const getUser = async () => {
      try {
        // DEV 모드: 인증 바이패스
        if (DEV_BYPASS_AUTH) {
          console.log('[DEV] Client auth bypass - using DEV_USER')
          setUser(DEV_USER as User)
          setIsLoading(false)
          return
        }

        // ⚡ 최적화: user가 이미 persist에서 로드되었으면 auth 검증만 하고 fetch 스킵
        if (hasPersistedUser) {
          console.log('[Auth] User loaded from persist, skipping fetch')
          setIsLoading(false)
          // 백그라운드에서 세션 유효성만 확인
          const { data: { user: authUser } } = await supabase.auth.getUser()
          if (!authUser) {
            // 세션 만료됨 - 로그아웃 처리
            setUser(null)
            setCurrentStartup(null)
            router.push('/auth-group/login')
          }
          return
        }

        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/auth-group/login')
          return
        }

        // 병렬로 프로필과 스타트업 동시 조회 (성능 최적화)
        const [profileResult, startupResult] = await Promise.all([
          supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single() as unknown as Promise<{ data: User | null; error: unknown }>,
          supabase
            .from('startups')
            .select('*')
            .eq('founder_id', authUser.id)
            .single() as unknown as Promise<{ data: Startup | null; error: unknown }>
        ])

        // 프로필 설정
        if (profileResult.data) {
          setUser(profileResult.data)
        } else {
          // Create profile from auth metadata
          setUser({
            id: authUser.id,
            email: authUser.email!,
            name: authUser.user_metadata.name || 'User',
            role: authUser.user_metadata.role || 'FOUNDER',
            company: authUser.user_metadata.company,
            created_at: authUser.created_at,
            updated_at: authUser.created_at,
          } as User)
        }

        // 스타트업 설정
        if (startupResult.data && !startupResult.error) {
          setCurrentStartup(startupResult.data)
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setCurrentStartup(null)
          router.push('/auth-group/login')
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, setUser, setCurrentStartup, setIsLoading])

  // Prevent hydration mismatch - show simple loading until mounted
  // ⚡ 최적화: zustand hydration 완료 후 user가 있으면 로딩 스킵
  const shouldShowLoading = !mounted || (!_hasHydrated) || (isLoading && !hasPersistedUser)
  if (shouldShowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 2단계 사이드바: Level1(64px) + Level2(동적)
  const isEmailPage = pathname?.includes('/email')
  const isNeuralMapPage = pathname?.includes('/ai-coding')
  const isNeuronsPage = pathname?.includes('/neurons')
  // Neural Map: 동적 level2Width 사용
  // Neurons: 64px만 (자체 파일트리 렌더링)
  // Coding Workspace: 64px (Level1만)
  // 기타: 304px (64 + 240)
  const sidebarWidth = sidebarOpen
    ? (isEmailPage ? 64 : (isNeuralMapPage ? 64 + (level2Collapsed ? 32 : level2Width) : (isNeuronsPage ? 64 : 304)))
    : 64

  // Check if we are on the main dashboard page
  const isDashboardRoot = pathname === '/dashboard-group'

  return (
    <SWRConfig value={swrConfig}>
      <AgentNotificationProvider>
        <div className={cn("h-screen flex flex-col", isDashboardRoot ? "bg-transparent" : "bg-theme")}>
        {isElectron ? <ElectronHeader /> : <Header />}
        <TwoLevelSidebar />
        <LeftPanel />
        <CommitModal />
        {/* neurons 페이지에서는 GlobalAgentSidebar 렌더링 안함 - 자체 마크다운 에디터 사용 */}
        {!isNeuronsPage && <GlobalAgentSidebar isOpen={agentSidebarOpen} onToggle={toggleAgentSidebar} />}
        {/* 정부지원사업 알림 리스너 */}
        <GovernmentProgramNotificationListener />
        {/* 에이전트 알림 팝업 */}
        <AgentNotificationPopup />
        <main
        className={cn(
          "flex flex-col",
          // Fix for resizing instability: block pointer events on main content (iframe/webview) when resizing sidebar
          (isResizingEmail || isResizingLevel2) && "pointer-events-none"
        )}
        style={{
          paddingLeft: `${sidebarWidth}px`,
          marginTop: '48px',
          minHeight: 'calc(100vh - 48px)',
          height: isFullWidthPage ? 'calc(100vh - 48px)' : undefined,
        }}
      >
        <div className={cn(
          isFullWidthPage ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto p-8"
        )}>
          {children}
        </div>
        </main>
      </div>
      </AgentNotificationProvider>
    </SWRConfig>
  )
}
