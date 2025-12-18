'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@/types'

const PROFILE_KEY = ['user-profile']

export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: async (): Promise<UserProfile | null> => {
      const res = await fetch('/api/users/profile')
      if (!res.ok) {
        if (res.status === 401) return null
        throw new Error('Failed to fetch profile')
      }
      return res.json()
    },
    staleTime: 1000 * 60 * 5, // 5분
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<UserProfile>): Promise<UserProfile> => {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update profile')
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(PROFILE_KEY, data)
    },
  })
}
