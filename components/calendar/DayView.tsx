'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { CalendarEvent, EventColor } from '@/types/calendar'
import {
  format,
  isSameDay,
  parseISO,
  differenceInMinutes,
  setHours,
  startOfDay,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { MapPin, Video, Clock } from 'lucide-react'

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onCreateEvent: (date: Date) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const getEventColor = (color: EventColor) => {
  const colors: Record<EventColor, { bg: string; text: string; border: string; bgSolid: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-l-blue-500', bgSolid: 'bg-blue-500' },
    green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', border: 'border-l-green-500', bgSolid: 'bg-green-500' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-l-purple-500', bgSolid: 'bg-purple-500' },
    red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', border: 'border-l-red-500', bgSolid: 'bg-red-500' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-l-orange-500', bgSolid: 'bg-orange-500' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-l-yellow-500', bgSolid: 'bg-yellow-500' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-l-pink-500', bgSolid: 'bg-pink-500' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-l-cyan-500', bgSolid: 'bg-cyan-500' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-l-indigo-500', bgSolid: 'bg-indigo-500' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-l-teal-500', bgSolid: 'bg-teal-500' },
  }
  return colors[color] || colors.blue
}

export function DayView({
  currentDate,
  events,
  onSelectEvent,
  onCreateEvent,
}: DayViewProps) {
  const { accentColor } = useThemeStore()

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-500/20' }
      case 'blue': return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-500/20' }
      case 'green': return { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-500/20' }
      case 'orange': return { bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-500/20' }
      case 'pink': return { bg: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-500/20' }
      case 'red': return { bg: 'bg-red-500', light: 'bg-red-100 dark:bg-red-500/20' }
      case 'yellow': return { bg: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-500/20' }
      case 'cyan': return { bg: 'bg-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-500/20' }
      default: return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-500/20' }
    }
  }

  const accent = getAccentClasses()

  const dayEvents = useMemo(() => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time)
      return isSameDay(eventStart, currentDate)
    })
  }, [events, currentDate])

  const allDayEvents = dayEvents.filter((e) => e.all_day)
  const timedEvents = dayEvents.filter((e) => !e.all_day)

  const calculateEventPosition = (event: CalendarEvent) => {
    const start = parseISO(event.start_time)
    const end = parseISO(event.end_time)
    const dayStart = startOfDay(start)

    const startMinutes = differenceInMinutes(start, dayStart)
    const durationMinutes = differenceInMinutes(end, start)

    const top = (startMinutes / 60) * 80 // 80px per hour
    const height = Math.max((durationMinutes / 60) * 80, 32) // minimum 32px

    return { top, height }
  }

  const handleTimeSlotClick = (hour: number) => {
    const clickedDate = setHours(currentDate, hour)
    onCreateEvent(clickedDate)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">종일 일정</div>
          <div className="space-y-2">
            {allDayEvents.map((event) => {
              const colors = getEventColor(event.color)
              return (
                <motion.button
                  key={event.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onSelectEvent(event)}
                  className={cn(
                    "w-full p-3 rounded-xl text-left border-l-4 transition-all hover:shadow-md",
                    colors.bg,
                    colors.border
                  )}
                >
                  <div className={cn("font-semibold", colors.text)}>{event.title}</div>
                  {event.location && (
                    <div className="flex items-center gap-1 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location}
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-y-auto max-h-[700px]">
        <div className="grid grid-cols-[80px_1fr]">
          {/* Time labels */}
          <div className="border-r border-zinc-200 dark:border-zinc-800">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-20 relative border-b border-zinc-100 dark:border-zinc-800/50"
              >
                <span className="absolute -top-2.5 right-3 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Event column */}
          <div className="relative">
            {/* Hour slots */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                onClick={() => handleTimeSlotClick(hour)}
                className="h-20 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
              >
                <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                    + 일정 추가
                  </div>
                </div>
              </div>
            ))}

            {/* Events */}
            <AnimatePresence>
              {timedEvents.map((event) => {
                const { top, height } = calculateEventPosition(event)
                const colors = getEventColor(event.color)

                return (
                  <motion.button
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectEvent(event)
                    }}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    className={cn(
                      "absolute left-3 right-3 p-3 rounded-xl text-left border-l-4 overflow-hidden transition-all hover:z-10 hover:shadow-lg",
                      colors.bg,
                      colors.border
                    )}
                  >
                    <div className={cn("font-semibold truncate", colors.text)}>
                      {event.title}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                      )}
                      {event.meeting_url && (
                        <span className="flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" />
                          온라인
                        </span>
                      )}
                    </div>
                    {height >= 80 && event.description && (
                      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {event.description}
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
