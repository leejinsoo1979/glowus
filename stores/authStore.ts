import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Startup, Team } from '@/types'

// DEV 모드 체크 (클라이언트에서만)
const DEV_BYPASS_AUTH = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

interface AuthState {
  user: User | null
  currentStartup: Startup | null
  currentTeam: Team | null
  isLoading: boolean
  _hasHydrated: boolean  // hydration 완료 여부
  setUser: (user: User | null) => void
  updateUser: (updates: Partial<User>) => void
  setCurrentStartup: (startup: Startup | null) => void
  setCurrentTeam: (team: Team | null) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      currentStartup: null,
      currentTeam: null,
      // DEV 모드에서는 인증 로딩 건너뛰기
      isLoading: !DEV_BYPASS_AUTH,
      _hasHydrated: false,
      setUser: (user) => set({ user }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
      setCurrentStartup: (startup) => set({ currentStartup: startup }),
      setCurrentTeam: (team) => set({ currentTeam: team }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      logout: () => set({ user: null, currentStartup: null, currentTeam: null }),
    }),
    {
      name: 'auth-storage',
      // user도 persist해서 페이지 이동 시 재로딩 방지
      partialize: (state) => ({
        user: state.user,
        currentStartup: state.currentStartup,
        currentTeam: state.currentTeam
      }),
      // hydration 완료 시 isLoading을 false로 (user가 있으면)
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true
          // persist에서 user가 복원되었으면 로딩 완료
          if (state.user) {
            state.isLoading = false
          }
        }
      },
    }
  )
)
