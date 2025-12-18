'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { User, Team } from '@/types'

// Type helpers for Supabase queries
interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  avatar_url?: string
  company?: string
  bio?: string
  phone?: string
  created_at: string
  updated_at: string
}

interface TeamMemberWithTeam {
  team: Team | null
}

export function useAuth() {
  const router = useRouter()
  const { user, currentTeam, setUser, setCurrentTeam, setIsLoading, isLoading } = useAuthStore()

  // 중복 호출 및 RLS 에러 재시도 방지
  const fetchingRef = useRef(false)
  const teamFetchFailedRef = useRef(false)
  const initializedRef = useRef(false)

  useEffect(() => {
    // 이미 초기화된 경우 스킵
    if (initializedRef.current) return
    initializedRef.current = true

    const supabase = createClient()

    const getSession = async () => {
      // 이미 fetch 중이면 스킵
      if (fetchingRef.current) return
      fetchingRef.current = true

      setIsLoading(true)

      // DEV mode bypass - skip Supabase queries to avoid RLS recursion
      if (isDevMode()) {
        console.log('[useAuth] DEV mode: using mock user')
        setUser({
          id: DEV_USER.id,
          email: DEV_USER.email,
          name: DEV_USER.name,
          role: DEV_USER.role,
          avatar_url: DEV_USER.avatar_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as User)
        setIsLoading(false)
        fetchingRef.current = false
        return
      }

      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (!authUser) {
          setIsLoading(false)
          fetchingRef.current = false
          return
        }

        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single() as { data: UserProfile | null }

        if (profile) {
          setUser(profile as User)

          // Fetch user's team if founder (RLS 에러 발생 시 재시도 안함)
          if (profile.role === 'FOUNDER' && !teamFetchFailedRef.current) {
            try {
              const { data: teamMember, error: teamError } = await supabase
                .from('team_members')
                .select('team:teams(*)')
                .eq('user_id', authUser.id)
                .single() as { data: TeamMemberWithTeam | null, error: any }

              if (teamError) {
                console.warn('[useAuth] Failed to fetch team:', teamError.message)
                // RLS recursion 에러면 재시도 안함
                if (teamError.message?.includes('recursion') || teamError.code === '42P17') {
                  teamFetchFailedRef.current = true
                }
              } else if (teamMember?.team) {
                setCurrentTeam(teamMember.team)
              }
            } catch (err) {
              console.warn('[useAuth] Error fetching team:', err)
              teamFetchFailedRef.current = true
            }
          }
        }
      } catch (err) {
        console.error('[useAuth] Session error:', err)
      } finally {
        setIsLoading(false)
        fetchingRef.current = false
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && !fetchingRef.current) {
          // 로그인 시에만 재시도 플래그 리셋
          teamFetchFailedRef.current = false
          getSession()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setCurrentTeam(null)
          teamFetchFailedRef.current = false
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setCurrentTeam(null)
    router.push('/auth-group/login')
  }

  return {
    user,
    currentTeam,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  }
}
