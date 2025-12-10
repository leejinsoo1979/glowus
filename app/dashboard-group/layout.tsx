'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/nav/Sidebar'
import { Header } from '@/components/nav/Header'
import { CommitModal } from '@/components/commits/CommitModal'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import type { User, Startup } from '@/types'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { sidebarOpen } = useUIStore()
  const { setUser, setCurrentStartup, setIsLoading, isLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    const getUser = async () => {
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
      const { data: startup } = await supabase
        .from('startups')
        .select('*')
        .eq('founder_id', authUser.id)
        .single()

      if (startup) {
        setCurrentStartup(startup as Startup)
      }

      setIsLoading(false)
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-theme-muted">로딩 중...</p>
        </div>
      </div>
    )
  }

  const pathname = usePathname()
  const isFullWidthPage = pathname?.includes('/messenger') || pathname?.includes('/agent-builder') || pathname?.includes('/email')

  return (
    <div className="min-h-screen bg-theme">
      <Sidebar />
      <Header />
      <CommitModal />
      <main
        className={`pt-16 min-h-screen transition-all duration-300 ${sidebarOpen ? 'pl-[280px]' : 'pl-20'
          }`}
      >
        <div className={isFullWidthPage ? "" : "p-8 pl-10"}>
          {children}
        </div>
      </main>
    </div>
  )
}
