'use client'

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { CalendarEvent, EventColor } from '@/types/calendar'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachHourOfInterval,
  format,
  isSameDay,
  isToday,
  parseISO,
  differenceInMinutes,
  setHours,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { ko } from 'date-fns/locale'

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  selectedDate: Date | null
  onSelectDate: (date: Date) => void
  onSelectEvent: (event: CalendarEvent) => void
  onCreateEvent: (date: Date) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

const getEventColor = (color: EventColor) => {
  const colors: Record<EventColor, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-l-blue-500' },
    green: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-300', border: 'border-l-green-500' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-l-purple-500' },
    red: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-300', border: 'border-l-red-500' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-l-orange-500' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-l-yellow-500' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-l-pink-500' },
    cyan: { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-l-cyan-500' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-l-indigo-500' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-l-teal-500' },
  }
  return colors[color] || colors.blue
}

export function WeekView({
  currentDate,
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
  onCreateEvent,
}: WeekViewProps) {
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

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 })
    const end = endOfWeek(currentDate, { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentDate])

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time)
      return isSameDay(eventStart, day)
    })
  }

  const getAllDayEvents = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time)
      return event.all_day && isSameDay(eventStart, day)
    })
  }

  const getTimedEvents = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventStart = parseISO(event.start_time)
      return !event.all_day && isSameDay(eventStart, day)
    })
  }

  const calculateEventPosition = (event: CalendarEvent) => {
    const start = parseISO(event.start_time)
    const end = parseISO(event.end_time)
    const dayStart = startOfDay(start)

    const startMinutes = differenceInMinutes(start, dayStart)
    const durationMinutes = differenceInMinutes(end, start)

    const top = (startMinutes / 60) * 64 // 64px per hour
    const height = Math.max((durationMinutes / 60) * 64, 24) // minimum 24px

    return { top, height }
  }

  const handleTimeSlotClick = (day: Date, hour: number) => {
    const clickedDate = setHours(day, hour)
    onCreateEvent(clickedDate)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header - Days */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800">
        <div className="py-3 border-r border-zinc-200 dark:border-zinc-800" />
        {weekDays.map((day, index) => {
          const isDayToday = isToday(day)
          const isSelected = selectedDate && isSameDay(day, selectedDate)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "py-3 text-center border-r border-zinc-200 dark:border-zinc-800 last:border-r-0 transition-colors",
                isSelected && "bg-zinc-50 dark:bg-zinc-800/50"
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium mb-1",
                  index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-zinc-500 dark:text-zinc-400"
                )}
              >
                {format(day, 'EEE', { locale: ko })}
              </div>
              <div
                className={cn(
                  "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors",
                  isDayToday && cn(accent.bg, "text-white"),
                  !isDayToday && "text-zinc-900 dark:text-white"
                )}
              >
                {format(day, 'd')}
              </div>
            </button>
          )
        })}
      </div>

      {/* All-day events */}
      {weekDays.some((day) => getAllDayEvents(day).length > 0) && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800">
          <div className="py-2 px-2 text-xs text-zinc-400 dark:text-zinc-500 text-right border-r border-zinc-200 dark:border-zinc-800">
            종일
          </div>
          {weekDays.map((day) => {
            const allDayEvents = getAllDayEvents(day)
            return (
              <div
                key={day.toISOString()}
                className="p-1 min-h-[40px] border-r border-zinc-200 dark:border-zinc-800 last:border-r-0"
              >
                {allDayEvents.map((event) => {
                  const colors = getEventColor(event.color)
                  return (
                    <motion.button
                      key={event.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => onSelectEvent(event)}
                      className={cn(
                        "w-full px-2 py-1 rounded-md text-xs font-medium truncate text-left border-l-2 transition-all hover:scale-[1.02]",
                        colors.bg,
                        colors.text,
                        colors.border
                      )}
                    >
                      {event.title}
                    </motion.button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Time grid */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Time labels */}
          <div className="border-r border-zinc-200 dark:border-zinc-800">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-16 relative border-b border-zinc-100 dark:border-zinc-800/50"
              >
                <span className="absolute -top-2.5 right-2 text-xs text-zinc-400 dark:text-zinc-500">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const timedEvents = getTimedEvents(day)
            const isSelected = selectedDate && isSameDay(day, selectedDate)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-r border-zinc-200 dark:border-zinc-800 last:border-r-0",
                  isSelected && "bg-zinc-50/50 dark:bg-zinc-800/30"
                )}
              >
                {/* Hour slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => handleTimeSlotClick(day, hour)}
                    className="h-16 border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                  >
                    <div className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs text-zinc-400 dark:text-zinc-500">+ 일정 추가</div>
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
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectEvent(event)
                        }}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        className={cn(
                          "absolute left-1 right-1 px-2 py-1 rounded-md text-left border-l-2 overflow-hidden transition-all hover:z-10 hover:shadow-md",
                          colors.bg,
                          colors.border
                        )}
                      >
                        <div className={cn("text-xs font-semibold truncate", colors.text)}>
                          {event.title}
                        </div>
                        {height >= 40 && (
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                            {format(parseISO(event.start_time), 'HH:mm')} - {format(parseISO(event.end_time), 'HH:mm')}
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
