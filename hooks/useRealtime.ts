'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

type RealtimeTable = 'commits' | 'tasks' | 'projects' | 'summaries'

interface UseRealtimeOptions {
  table: RealtimeTable
  teamId?: string
  queryKey: string[]
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}

export function useRealtime({
  table,
  teamId,
  queryKey,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeOptions) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: teamId ? `team_id=eq.${teamId}` : undefined,
        },
        (payload) => {
          // Invalidate relevant query
          queryClient.invalidateQueries({ queryKey })

          // Call specific handlers
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new)
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new)
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload.old)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, teamId, queryKey, queryClient, onInsert, onUpdate, onDelete])
}
