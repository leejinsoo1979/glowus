'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  Clock,
  Users,
  Play,
  Pause,
  Square,
  Share2,
  Settings,
  MoreHorizontal,
  Presentation,
  MessageSquare,
  Swords,
  Coffee
} from 'lucide-react'
import { cn } from '@/lib/utils'

type SessionMode = 'meeting' | 'presentation' | 'debate' | 'free'

interface SessionTopBarProps {
  title: string
  mode: SessionMode
  onModeChange: (mode: SessionMode) => void
  participantCount: number
  isTimerRunning?: boolean
  timerSeconds?: number
  onTimerToggle?: () => void
  onTimerReset?: () => void
  onShare?: () => void
  onSettings?: () => void
}

export function SessionTopBar({
  title,
  mode,
  onModeChange,
  participantCount,
  isTimerRunning = false,
  timerSeconds = 0,
  onTimerToggle,
  onTimerReset,
  onShare,
  onSettings
}: SessionTopBarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [showModeMenu, setShowModeMenu] = useState(false)

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const modes: { id: SessionMode; label: string; icon: typeof Presentation }[] = [
    { id: 'meeting', label: '회의', icon: Users },
    { id: 'presentation', label: '발표', icon: Presentation },
    { id: 'debate', label: '토론', icon: Swords },
    { id: 'free', label: '자유', icon: Coffee }
  ]

  const currentMode = modes.find(m => m.id === mode)
  const ModeIcon = currentMode?.icon || Users

  return (
    <>
      {/* Title */}
      <h1 className={cn(
        'text-sm font-medium truncate max-w-[200px]',
        isDark ? 'text-neutral-200' : 'text-neutral-800'
      )}>
        {title}
      </h1>

      {/* Mode Selector */}
      <div className="relative">
        <button
          onClick={() => setShowModeMenu(!showModeMenu)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            isDark
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          )}
        >
          <ModeIcon className="w-3.5 h-3.5" />
          {currentMode?.label}
        </button>

        {showModeMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowModeMenu(false)}
            />
            <div className={cn(
              'absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg z-50 min-w-[120px]',
              isDark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white border border-neutral-200'
            )}>
              {modes.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    onModeChange(m.id)
                    setShowModeMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors',
                    mode === m.id
                      ? isDark
                        ? 'bg-neutral-700 text-neutral-100'
                        : 'bg-neutral-100 text-neutral-900'
                      : isDark
                        ? 'text-neutral-300 hover:bg-neutral-700/50'
                        : 'text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  <m.icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Participant Count */}
      <div className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
        isDark ? 'bg-neutral-800/50 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
      )}>
        <Users className="w-3.5 h-3.5" />
        {participantCount}
      </div>

      {/* Timer */}
      <div className={cn(
        'flex items-center gap-1 rounded overflow-hidden',
        isDark ? 'bg-neutral-800' : 'bg-neutral-100'
      )}>
        <div className={cn(
          'px-2 py-1 text-xs font-mono',
          isDark ? 'text-neutral-300' : 'text-neutral-700'
        )}>
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          {formatTimer(timerSeconds)}
        </div>

        {onTimerToggle && (
          <button
            onClick={onTimerToggle}
            className={cn(
              'p-1.5 transition-colors',
              isDark
                ? 'hover:bg-neutral-700 text-neutral-400'
                : 'hover:bg-neutral-200 text-neutral-600'
            )}
          >
            {isTimerRunning ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </button>
        )}

        {onTimerReset && (
          <button
            onClick={onTimerReset}
            className={cn(
              'p-1.5 transition-colors',
              isDark
                ? 'hover:bg-neutral-700 text-neutral-400'
                : 'hover:bg-neutral-200 text-neutral-600'
            )}
          >
            <Square className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      {onShare && (
        <button
          onClick={onShare}
          className={cn(
            'p-1.5 rounded transition-colors',
            isDark
              ? 'hover:bg-neutral-800 text-neutral-400'
              : 'hover:bg-neutral-100 text-neutral-600'
          )}
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}

      {onSettings && (
        <button
          onClick={onSettings}
          className={cn(
            'p-1.5 rounded transition-colors',
            isDark
              ? 'hover:bg-neutral-800 text-neutral-400'
              : 'hover:bg-neutral-100 text-neutral-600'
          )}
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
    </>
  )
}
