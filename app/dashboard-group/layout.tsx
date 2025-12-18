'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Header } from '@/components/nav/Header'
import { TwoLevelSidebar } from '@/components/nav/TwoLevelSidebar'
import { CommitModal } from '@/components/commits/CommitModal'
import { WorkHistorySidebar } from '@/components/tools/WorkHistorySidebar'
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
  const { sidebarOpen, emailSidebarWidth, isResizingEmail } = useUIStore()
  const [mounted, setMounted] = useState(false)
  const isFullWidthPage = pathname?.includes('/messenger') || pathname?.includes('/agent-builder') || pathname?.includes('/email') || pathname?.match(/\/project\/[^/]+$/) || pathname?.includes('/works/new') || pathname?.includes('/apps/ai-slides') || pathname?.includes('/apps/ai-sheet') || pathname?.includes('/apps/ai-docs') || pathname?.includes('/apps/ai-summary')

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

  // 2단계 사이드바: Level1(64px) + Level2(240px)
  // 이메일 페이지는 자체 레이아웃을 가지므로 Level1만 사용
  const isEmailPage = pathname?.includes('/email')
  const sidebarWidth = sidebarOpen ? (isEmailPage ? 64 : 304) : 64

  // Check if we are on the main dashboard page
  const isDashboardRoot = pathname === '/dashboard-group'

  return (
    <div className={cn("min-h-screen", isDashboardRoot ? "bg-transparent" : "bg-theme")}>
      <TwoLevelSidebar />
      <Header />
      <CommitModal />
      <WorkHistorySidebar />
      <main
        className={cn(
          "transition-all duration-300",
          isFullWidthPage ? "h-screen pt-16 flex flex-col" : "min-h-screen pt-16"
        )}
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        <div className={cn(
          isFullWidthPage ? "flex-1 overflow-hidden" : "p-8"
        )}>
          {children}
        </div>
      </main>
    </div>
  )
}
