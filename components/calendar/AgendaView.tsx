'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { CalendarEvent, EventColor } from '@/types/calendar'
import {
  format,
  parseISO,
  isSameDay,
  isToday,
  isTomorrow,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWithinInterval,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { MapPin, Video, Clock, Calendar, Users, Repeat } from 'lucide-react'

interface AgendaViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}

const getEventColor = (color: EventColor) => {
  const colors: Record<EventColor, { bg: string; text: string; dot: string; border: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', border: 'border-l-blue-500' },
    green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500', border: 'border-l-green-500' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500', border: 'border-l-purple-500' },
    red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500', border: 'border-l-red-500' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', border: 'border-l-orange-500' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500', border: 'border-l-yellow-500' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500', border: 'border-l-pink-500' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500', border: 'border-l-cyan-500' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500', border: 'border-l-indigo-500' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500', border: 'border-l-teal-500' },
  }
  return colors[color] || colors.blue
}

export function AgendaView({
  currentDate,
  events,
  onSelectEvent,
}: AgendaViewProps) {
  const { accentColor } = useThemeStore()

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' }
      case 'blue': return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
      case 'green': return { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400' }
      case 'orange': return { bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' }
      case 'pink': return { bg: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400' }
      case 'red': return { bg: 'bg-red-500', light: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' }
      case 'yellow': return { bg: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400' }
      case 'cyan': return { bg: 'bg-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400' }
      default: return { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
    }
  }

  const accent = getAccentClasses()

  const groupedEvents = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

    const grouped: { date: Date; events: CalendarEvent[] }[] = []

    days.forEach((day) => {
      const dayEvents = events.filter((event) => {
        const eventStart = parseISO(event.start_time)
        const eventEnd = parseISO(event.end_time)

        // Check if event starts on this day or spans this day
        return (
          isSameDay(eventStart, day) ||
          (event.all_day && isWithinInterval(day, { start: eventStart, end: eventEnd }))
        )
      })

      if (dayEvents.length > 0) {
        // Sort events: all-day first, then by start time
        const sorted = dayEvents.sort((a, b) => {
          if (a.all_day && !b.all_day) return -1
          if (!a.all_day && b.all_day) return 1
          return parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime()
        })
        grouped.push({ date: day, events: sorted })
      }
    })

    return grouped
  }, [events, currentDate])

  const getDayLabel = (date: Date): string => {
    if (isToday(date)) return '오늘'
    if (isTomorrow(date)) return '내일'
    return format(date, 'M월 d일 (EEEE)', { locale: ko })
  }

  if (groupedEvents.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-4", accent.light)}>
            <Calendar className={cn("w-8 h-8", accent.text)} />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
            일정이 없습니다
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            이번 달에는 예정된 일정이 없습니다
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        <AnimatePresence>
          {groupedEvents.map(({ date, events: dayEvents }, groupIndex) => {
            const isDayToday = isToday(date)

            return (
              <motion.div
                key={date.toISOString()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.05 }}
                className="p-4"
              >
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg",
                      isDayToday ? cn(accent.bg, "text-white") : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {format(date, 'd')}
                  </div>
                  <div>
                    <div
                      className={cn(
                        "font-semibold",
                        isDayToday ? accent.text : "text-zinc-900 dark:text-white"
                      )}
                    >
                      {getDayLabel(date)}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {dayEvents.length}개의 일정
                    </div>
                  </div>
                </div>

                {/* Events */}
                <div className="space-y-2 ml-15">
                  {dayEvents.map((event, eventIndex) => {
                    const colors = getEventColor(event.color)

                    return (
                      <motion.button
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: groupIndex * 0.05 + eventIndex * 0.02 }}
                        onClick={() => onSelectEvent(event)}
                        className={cn(
                          "w-full p-4 rounded-xl text-left border-l-4 transition-all hover:shadow-md",
                          colors.bg,
                          colors.border
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className={cn("font-semibold truncate", colors.text)}>
                              {event.title}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                              {event.all_day ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  종일
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                                </span>
                              )}

                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {event.location}
                                </span>
                              )}

                              {event.meeting_url && (
                                <span className="flex items-center gap-1">
                                  <Video className="w-4 h-4" />
                                  온라인
                                </span>
                              )}

                              {event.is_recurring && (
                                <span className="flex items-center gap-1">
                                  <Repeat className="w-4 h-4" />
                                  반복
                                </span>
                              )}

                              {event.attendees && event.attendees.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  {event.attendees.length}명
                                </span>
                              )}
                            </div>

                            {event.description && (
                              <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                {event.description}
                              </div>
                            )}
                          </div>

                          <div className={cn("w-3 h-3 rounded-full flex-shrink-0 mt-1.5", colors.dot)} />
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
