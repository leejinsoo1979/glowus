import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Team } from '@/types'

interface AuthState {
  user: User | null
  currentTeam: Team | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setCurrentTeam: (team: Team | null) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentTeam: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setCurrentTeam: (team) => set({ currentTeam: team }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null, currentTeam: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ currentTeam: state.currentTeam }),
    }
  )
)
