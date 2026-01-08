import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

// 기본 캐시 설정: 30초간 캐시, 백그라운드에서 재검증
export function useCachedFetch<T>(url: string | null, options?: {
  refreshInterval?: number  // 자동 새로고침 간격 (ms)
  revalidateOnFocus?: boolean  // 탭 포커스 시 재검증
  dedupingInterval?: number  // 중복 요청 방지 간격 (ms)
}) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    url,
    fetcher,
    {
      revalidateOnFocus: options?.revalidateOnFocus ?? false,
      dedupingInterval: options?.dedupingInterval ?? 30000, // 30초
      refreshInterval: options?.refreshInterval,
    }
  )

  return {
    data,
    error,
    isLoading,
    refresh: mutate,  // 수동 새로고침
  }
}

// 에이전트 목록 (30초 캐시)
export function useAgents() {
  return useCachedFetch<any[]>('/api/agents')
}

// 에이전트 그룹 (30초 캐시)
export function useAgentGroups() {
  return useCachedFetch<any[]>('/api/agent-groups')
}

// 프로젝트 목록 (30초 캐시)
export function useProjects() {
  return useCachedFetch<any[]>('/api/projects')
}

// 캘린더 이벤트 (10초 캐시 - 좀 더 자주 업데이트)
export function useCalendarEvents(startDate?: string, endDate?: string) {
  const url = startDate && endDate
    ? `/api/calendar/events?start=${startDate}&end=${endDate}`
    : null
  return useCachedFetch<any[]>(url, { dedupingInterval: 10000 })
}

// 팀 목록 (1분 캐시)
export function useTeams() {
  return useCachedFetch<any[]>('/api/teams', { dedupingInterval: 60000 })
}

// 정부지원사업 (5분 캐시 - 자주 안 바뀜)
export function useGovernmentPrograms() {
  return useCachedFetch<any[]>('/api/government-programs', { dedupingInterval: 300000 })
}

// 채팅방 목록 (30초 캐시)
export function useChatRooms() {
  return useCachedFetch<any[]>('/api/chat/rooms')
}

// ERP 대시보드 (1분 캐시)
export function useERPDashboard() {
  return useCachedFetch<any>('/api/erp/dashboard', { dedupingInterval: 60000 })
}

// 결재 통계 (1분 캐시)
export function useApprovalStats() {
  return useCachedFetch<any>('/api/erp/approval/stats', { dedupingInterval: 60000 })
}

// 구글 캘린더 이벤트 (30초 캐시)
export function useGoogleCalendarEvents(timeMin?: string, timeMax?: string) {
  const url = timeMin && timeMax
    ? `/api/google-calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`
    : null
  return useCachedFetch<any>(url)
}

// 에이전트 상세 (30초 캐시)
export function useAgentDetail(agentId: string | null) {
  return useCachedFetch<any>(agentId ? `/api/agents/${agentId}` : null)
}

// 프로젝트 상세 (30초 캐시)
export function useProjectDetail(projectId: string | null) {
  return useCachedFetch<any>(projectId ? `/api/projects/${projectId}` : null)
}

// 정부지원사업 매칭 (1분 캐시)
export function useGovernmentMatches(minScore = 50, limit = 50) {
  return useCachedFetch<any>(`/api/government-programs/match?min_score=${minScore}&limit=${limit}`, { dedupingInterval: 60000 })
}

// 정부지원사업 북마크 (30초 캐시)
export function useGovernmentBookmarks() {
  return useCachedFetch<any>('/api/government-programs/bookmarks')
}

// 기업 프로필 (5분 캐시)
export function useCompanyProfile() {
  return useCachedFetch<any>('/api/company-profile', { dedupingInterval: 300000 })
}

// 정부지원사업 통계 (5분 캐시)
export function useGovernmentProgramStats() {
  return useCachedFetch<any>('/api/government-programs/stats', { dedupingInterval: 300000 })
}

// 워크 (작업) 목록 (30초 캐시)
export function useWorks() {
  return useCachedFetch<any[]>('/api/works')
}

// 간트 차트 데이터 (30초 캐시)
export function useGanttData() {
  return useCachedFetch<any>('/api/gantt')
}

// 메모리 (대화 기록) 목록 (30초 캐시)
export function useMemories(agentId?: string) {
  const url = agentId ? `/api/memory?agent_id=${agentId}` : '/api/memory'
  return useCachedFetch<any[]>(url)
}
