'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Header } from '@/components/nav/Header'
import { TwoLevelSidebar } from '@/components/nav/TwoLevelSidebar'
import { CommitModal } from '@/components/commits/CommitModal'
import { GlobalAgentSidebar } from '@/components/nav/GlobalAgentSidebar'
import { ElectronHeader } from '@/components/nav/ElectronHeader'
import { AgentNotificationProvider } from '@/lib/contexts/AgentNotificationContext'
import { AgentNotificationPopup } from '@/components/notifications/AgentNotificationPopup'
import { MainAssistantButton } from '@/components/notifications/MainAssistantButton'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils' // Added for conditional classes
import type { User, Startup } from '@/types'

// DEV 모드 체크 (클라이언트용)
const DEV_BYPASS_AUTH = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'
const DEV_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@glowus.local',
  name: 'Dev Tester',
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
  const { setUser, setCurrentStartup, setIsLoading, isLoading } = useAuthStore()
  // Include isResizingLevel2 for global resize fix
  const { sidebarOpen, emailSidebarWidth, isResizingEmail, agentSidebarOpen, toggleAgentSidebar, level2Width, isResizingLevel2, level2Collapsed } = useUIStore()
  const [mounted, setMounted] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

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
      if (!pathname?.includes('/neural-map')) {
        console.log('[Dashboard Layout] Navigating to Neural Map with browser tab...')
        router.push('/dashboard-group/neural-map?tab=browser')
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
  const isFullWidthPage = pathname?.includes('/messenger') || pathname?.includes('/agent-builder') || pathname?.includes('/email') || pathname?.includes('/project') || pathname?.includes('/task-hub') || pathname?.includes('/works/new') || pathname?.includes('/apps/ai-slides') || pathname?.includes('/apps/ai-sheet') || pathname?.includes('/apps/ai-docs') || pathname?.includes('/apps/ai-summary') || pathname?.includes('/apps/ai-blog') || pathname?.includes('/apps/government-programs') || pathname?.includes('/neural-map') || pathname?.includes('/gantt')

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    const getUser = async () => {
      try {
        // DEV 모드: 인증 바이패스
        if (DEV_BYPASS_AUTH) {
          console.log('[DEV] Client auth bypass - using DEV_USER')
          setUser(DEV_USER as User)
          setIsLoading(false)
          return
        }

        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/auth-group/login')
          return
        }

        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        if (profile) {
          setUser(profile as User)
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

        // Fetch user's startup
        try {
          const { data: startup, error: startupError } = await supabase
            .from('startups')
            .select('*')
            .eq('founder_id', authUser.id)
            .single()

          if (startup && !startupError) {
            setCurrentStartup(startup as Startup)
          }
        } catch (startupErr) {
          console.warn('Startup fetch failed:', startupErr)
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
  }, [router, setUser, setCurrentStartup, setIsLoading])

  // Prevent hydration mismatch - show simple loading until mounted
  if (!mounted || isLoading) {
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
  const isNeuralMapPage = pathname?.includes('/neural-map')
  // Neural Map은 동적 level2Width 사용 (level2Collapsed 시 32px만 표시)
  const sidebarWidth = sidebarOpen
    ? (isEmailPage ? 64 : (isNeuralMapPage ? 64 + (level2Collapsed ? 32 : level2Width) : 304))
    : 64

  // Check if we are on the main dashboard page
  const isDashboardRoot = pathname === '/dashboard-group'

  return (
    <AgentNotificationProvider>
      <div className={cn("h-screen flex flex-col", isDashboardRoot ? "bg-transparent" : "bg-theme")}>
        {isElectron ? <ElectronHeader /> : <Header />}
        <TwoLevelSidebar />
        <CommitModal />
        <GlobalAgentSidebar isOpen={agentSidebarOpen} onToggle={toggleAgentSidebar} />
        {/* 우측하단 에이전트 비서 임시 비활성화 */}
        {/* <AgentNotificationPopup /> */}
        {/* <MainAssistantButton /> */}
        <main
        className={cn(
          (isFullWidthPage || isElectron) ? "flex flex-col" : "pt-16",
          // Fix for resizing instability: block pointer events on main content (iframe/webview) when resizing sidebar
          (isResizingEmail || isResizingLevel2) && "pointer-events-none"
        )}
        style={{
          paddingLeft: `${sidebarWidth}px`,
          marginTop: isElectron ? '48px' : 'var(--title-bar-height, 0px)',
          minHeight: `calc(100vh - ${isElectron ? '48px' : 'var(--title-bar-height, 0px)'})`,
          height: isFullWidthPage ? `calc(100vh - ${isElectron ? '48px' : 'var(--title-bar-height, 0px)'})` : undefined,
          paddingTop: isElectron ? 0 : (isFullWidthPage ? 0 : undefined)
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
  )
}
