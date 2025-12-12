'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { CalendarEvent, CalendarDay, EventColor, EVENT_COLORS } from '@/types/calendar'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  isWeekend,
  parseISO,
} from 'date-fns'
import { ko } from 'date-fns/locale'

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  onSelectEvent: (event: CalendarEvent) => void
  onCreateEvent: (date: Date) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const getEventColor = (color: EventColor) => {
  const colors: Record<EventColor, { bg: string; text: string; dot: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
    green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
    red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  }
  return colors[color] || colors.blue
}

export function MonthView({
  currentDate,
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
  onCreateEvent,
}: MonthViewProps) {
  const { accentColor } = useThemeStore()

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', ring: 'ring-purple-500' }
      case 'blue': return { bg: 'bg-blue-500', ring: 'ring-blue-500' }
      case 'green': return { bg: 'bg-green-500', ring: 'ring-green-500' }
      case 'orange': return { bg: 'bg-orange-500', ring: 'ring-orange-500' }
      case 'pink': return { bg: 'bg-pink-500', ring: 'ring-pink-500' }
      case 'red': return { bg: 'bg-red-500', ring: 'ring-red-500' }
      case 'yellow': return { bg: 'bg-yellow-500', ring: 'ring-yellow-500' }
      case 'cyan': return { bg: 'bg-cyan-500', ring: 'ring-cyan-500' }
      default: return { bg: 'bg-blue-500', ring: 'ring-blue-500' }
    }
  }

  const accent = getAccentClasses()

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentDate])

  // Get events for a specific day
  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time)
      const eventEnd = parseISO(event.end_time)

      if (event.all_day) {
        return isSameDay(eventStart, day) || (day >= eventStart && day <= eventEnd)
      }

      return isSameDay(eventStart, day)
    })
  }

  // Split into weeks
  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7))
    }
    return result
  }, [calendarDays])

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={cn(
              "py-3 text-center text-sm font-semibold",
              index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 divide-x divide-zinc-100 dark:divide-zinc-800">
            {week.map((day, dayIndex) => {
              const dayEvents = getEventsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const isDayToday = isToday(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isDayWeekend = isWeekend(day)

              return (
                <motion.button
                  key={day.toISOString()}
                  onClick={() => onSelectDate(day)}
                  onDoubleClick={() => onCreateEvent(day)}
                  className={cn(
                    "relative min-h-[120px] p-2 text-left transition-all group",
                    isCurrentMonth
                      ? "bg-white dark:bg-zinc-900"
                      : "bg-zinc-50 dark:bg-zinc-900/50",
                    isSelected && cn("ring-2 ring-inset", accent.ring),
                    !isSelected && "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  )}
                >
                  {/* Day Number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors",
                        isDayToday && cn(accent.bg, "text-white"),
                        !isDayToday && isCurrentMonth && (
                          dayIndex === 0 ? "text-red-500" :
                          dayIndex === 6 ? "text-blue-500" :
                          "text-zinc-900 dark:text-white"
                        ),
                        !isDayToday && !isCurrentMonth && "text-zinc-400 dark:text-zinc-600"
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    <AnimatePresence>
                      {dayEvents.slice(0, 3).map((event, i) => {
                        const colors = getEventColor(event.color)
                        return (
                          <motion.div
                            key={event.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectEvent(event)
                            }}
                            className={cn(
                              "px-2 py-1 rounded-md text-xs font-medium truncate cursor-pointer transition-all hover:scale-[1.02]",
                              colors.bg,
                              colors.text
                            )}
                          >
                            {!event.all_day && (
                              <span className="opacity-70 mr-1">
                                {format(parseISO(event.start_time), 'HH:mm')}
                              </span>
                            )}
                            {event.title}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>

                    {dayEvents.length > 3 && (
                      <div className="text-xs text-zinc-400 dark:text-zinc-500 px-2">
                        +{dayEvents.length - 3}개 더
                      </div>
                    )}
                  </div>

                  {/* Hover indicator for empty days */}
                  {dayEvents.length === 0 && isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <span className="text-zinc-400 text-lg">+</span>
                      </div>
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
