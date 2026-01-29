'use client'

import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ProactiveSuggestionCard } from './ProactiveSuggestionCard'
import type { ProactiveSuggestion, SuggestionPriority, SuggestionType } from '@/lib/proactive/types'
import {
  useMissionControlStore,
  selectActiveSuggestions,
} from '@/lib/mission-control/store'
import { subscribeToProactiveEvents, unsubscribeFromProactiveEvents } from '@/lib/proactive/realtime-subscription'
import { Inbox, Filter, SortAsc } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface ProactiveSuggestionListProps {
  agentId?: string
  suggestions?: ProactiveSuggestion[]
  filterType?: SuggestionType
  filterPriority?: SuggestionPriority
  maxItems?: number
  compact?: boolean
  showEmpty?: boolean
  sortBy?: 'createdAt' | 'priority' | 'confidence'
  onAccept?: (id: string, executeAction?: boolean) => void
  onDismiss?: (id: string, reason?: string) => void
  className?: string
}

// ============================================================================
// Helpers
// ============================================================================

const priorityOrder: Record<SuggestionPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function sortSuggestions(
  suggestions: ProactiveSuggestion[],
  sortBy: 'createdAt' | 'priority' | 'confidence'
): ProactiveSuggestion[] {
  return [...suggestions].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      case 'confidence':
        return b.confidenceScore - a.confidenceScore
      case 'createdAt':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
  })
}

// ============================================================================
// Component
// ============================================================================

export function ProactiveSuggestionList({
  agentId,
  suggestions: externalSuggestions,
  filterType,
  filterPriority,
  maxItems,
  compact = false,
  showEmpty = true,
  sortBy = 'createdAt',
  onAccept,
  onDismiss,
  className,
}: ProactiveSuggestionListProps) {
  // Store state
  const storeSuggestions = useMissionControlStore(selectActiveSuggestions)
  const addSuggestion = useMissionControlStore((s) => s.addProactiveSuggestion)
  const acceptSuggestion = useMissionControlStore((s) => s.acceptSuggestion)
  const dismissSuggestion = useMissionControlStore((s) => s.dismissSuggestion)

  // Use external suggestions if provided, otherwise use store
  const baseSuggestions = externalSuggestions ?? storeSuggestions

  // Real-time subscription
  useEffect(() => {
    if (!agentId) return

    const subscription = subscribeToProactiveEvents(agentId, {
      onNewSuggestion: (suggestion) => {
        console.log('[SuggestionList] New suggestion received:', suggestion.id)
        addSuggestion(suggestion)
      },
      onSuggestionUpdate: (suggestion) => {
        console.log('[SuggestionList] Suggestion updated:', suggestion.id)
        // Update handled by store if using internal state
      },
      onError: (error) => {
        console.error('[SuggestionList] Realtime error:', error)
      },
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [agentId, addSuggestion])

  // Filter and sort suggestions
  const displaySuggestions = useMemo(() => {
    let filtered = baseSuggestions

    // Apply type filter
    if (filterType) {
      filtered = filtered.filter((s) => s.suggestionType === filterType)
    }

    // Apply priority filter
    if (filterPriority) {
      filtered = filtered.filter((s) => s.priority === filterPriority)
    }

    // Sort
    filtered = sortSuggestions(filtered, sortBy)

    // Limit
    if (maxItems) {
      filtered = filtered.slice(0, maxItems)
    }

    return filtered
  }, [baseSuggestions, filterType, filterPriority, sortBy, maxItems])

  // Handlers
  const handleAccept = async (id: string, executeAction = false) => {
    if (onAccept) {
      await onAccept(id, executeAction)
    } else {
      // Default: call API and update store
      try {
        const response = await fetch(`/api/proactive/suggestions/${id}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ executeAction }),
        })
        if (response.ok) {
          acceptSuggestion(id)
        }
      } catch (error) {
        console.error('[SuggestionList] Accept failed:', error)
      }
    }
  }

  const handleDismiss = async (id: string, reason?: string) => {
    if (onDismiss) {
      await onDismiss(id, reason)
    } else {
      // Default: call API and update store
      try {
        const response = await fetch(`/api/proactive/suggestions/${id}/dismiss`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        })
        if (response.ok) {
          dismissSuggestion(id)
        }
      } catch (error) {
        console.error('[SuggestionList] Dismiss failed:', error)
      }
    }
  }

  // Empty state
  if (displaySuggestions.length === 0) {
    if (!showEmpty) return null

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'flex flex-col items-center justify-center py-12',
          'text-zinc-400 dark:text-zinc-500',
          className
        )}
      >
        <Inbox className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-sm">새로운 제안이 없습니다</p>
        <p className="text-xs mt-1 opacity-75">에이전트가 패턴을 학습하면 제안이 생성됩니다</p>
      </motion.div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <AnimatePresence mode="popLayout">
        {displaySuggestions.map((suggestion) => (
          <ProactiveSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
            compact={compact}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

// ============================================================================
// With Header Component
// ============================================================================

interface ProactiveSuggestionPanelProps extends ProactiveSuggestionListProps {
  title?: string
  onFilterChange?: (filter: { type?: SuggestionType; priority?: SuggestionPriority }) => void
}

export function ProactiveSuggestionPanel({
  title = '능동적 제안',
  ...listProps
}: ProactiveSuggestionPanelProps) {
  const pendingCount = useMissionControlStore(
    (s) => s.proactiveSuggestions.filter((s) => s.status === 'pending' || s.status === 'delivered').length
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
            <SortAsc className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        <ProactiveSuggestionList {...listProps} />
      </div>
    </div>
  )
}

export default ProactiveSuggestionList
