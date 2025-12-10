'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import type { User, Team } from '@/types'

export function useAuth() {
  const router = useRouter()
  const { user, currentTeam, setUser, setCurrentTeam, setIsLoading, isLoading } = useAuthStore()

  useEffect(() => {
    const supabase = createClient()

    const getSession = async () => {
      setIsLoading(true)
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      if (!authUser) {
        setIsLoading(false)
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

        // Fetch user's team if founder
        if (profile.role === 'founder') {
          const { data: teamMember } = await supabase
            .from('team_members')
            .select('team:teams(*)')
            .eq('user_id', authUser.id)
            .single()

          if (teamMember?.team) {
            setCurrentTeam(teamMember.team as unknown as Team)
          }
        }
      }

      setIsLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          getSession()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setCurrentTeam(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [setUser, setCurrentTeam, setIsLoading])

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
