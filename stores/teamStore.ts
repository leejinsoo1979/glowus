import { create } from 'zustand'

export interface Team {
  id: string
  name: string
  description?: string
  industry?: string
  work_style?: string
  website?: string
  logo_url?: string
  founder_id?: string
  is_open_call?: boolean
  is_public?: boolean
  created_at: string
  updated_at?: string
  memberCount?: number
  // UI에서 사용하는 추가 필드
  teamSize?: string
  userRole?: string
  founder?: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }
  team_members?: Array<{
    user: {
      id: string
      name: string
      email: string
      avatar_url?: string
    }
    role: string
  }>
}

interface TeamStore {
  teams: Team[]
  isLoading: boolean
  error: string | null

  // API 연동 함수들
  fetchTeams: () => Promise<void>
  createTeam: (data: CreateTeamData) => Promise<Team | null>
  deleteTeam: (id: string) => Promise<boolean>
  updateTeam: (id: string, data: Partial<Team>) => Promise<Team | null>

  // 로컬 상태 관리
  setTeams: (teams: Team[]) => void
  clearError: () => void
}

export interface CreateTeamData {
  name: string
  description?: string
  industry?: string
  work_style?: string
  website?: string
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  isLoading: false,
  error: null,

  fetchTeams: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/teams')
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '팀 목록을 불러오는데 실패했습니다')
      }
      const { data } = await res.json()

      // API 응답을 Team 형식으로 변환
      const teams: Team[] = (data || []).map((team: any) => ({
        ...team,
        memberCount: team.team_members?.length || 0,
      }))

      set({ teams, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        isLoading: false
      })
    }
  },

  createTeam: async (data: CreateTeamData) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          industry: data.industry,
          work_style: data.work_style || 'agile',
          website: data.website,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '팀 생성에 실패했습니다')
      }

      const { data: newTeam } = await res.json()

      // 새 팀을 목록에 추가
      const teamWithMemberCount: Team = {
        ...newTeam,
        memberCount: 1, // founder가 자동으로 추가되므로 1
      }

      set((state) => ({
        teams: [...state.teams, teamWithMemberCount],
        isLoading: false,
      }))

      return teamWithMemberCount
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        isLoading: false
      })
      return null
    }
  },

  deleteTeam: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '팀 삭제에 실패했습니다')
      }

      set((state) => ({
        teams: state.teams.filter((team) => team.id !== id),
        isLoading: false,
      }))

      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        isLoading: false
      })
      return false
    }
  },

  updateTeam: async (id: string, data: Partial<Team>) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '팀 수정에 실패했습니다')
      }

      const { data: updatedTeam } = await res.json()

      set((state) => ({
        teams: state.teams.map((team) =>
          team.id === id ? { ...team, ...updatedTeam } : team
        ),
        isLoading: false,
      }))

      return updatedTeam
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
        isLoading: false
      })
      return null
    }
  },

  setTeams: (teams: Team[]) => set({ teams }),
  clearError: () => set({ error: null }),
}))
