"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react"
import { useThemeStore } from "@/stores/themeStore"
import { cn } from "@/lib/utils"

interface CalendarEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  color: string
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"]

export function CalendarWidget() {
  const { accentColor } = useThemeStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 이번 달의 첫 날과 마지막 날
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const startingDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  // 이벤트 가져오기
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true)
      try {
        const startDate = new Date(year, month, 1).toISOString()
        const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

        const res = await fetch(`/api/calendar/events?start_date=${startDate}&end_date=${endDate}`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data)
        }
      } catch (error) {
        console.error("Failed to fetch events:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [year, month])

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    )
  }

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(event => event.start_time.startsWith(dateStr))
  }

  const selectedDayEvents = getEventsForDay(selectedDate.getDate())

  // 캘린더 그리드 생성
  const calendarDays = []

  // 빈 칸 (이전 달)
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }

  // 이번 달 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <span className="font-semibold text-zinc-700 dark:text-zinc-100">캘린더</span>
        </div>
        <button
          onClick={goToToday}
          className="text-xs px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
        >
          오늘
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-zinc-500" />
        </button>
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          {year}년 {month + 1}월
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={cn(
              "text-center text-[10px] font-medium py-1",
              i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-zinc-400"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const dayEvents = getEventsForDay(day)
          const hasEvents = dayEvents.length > 0
          const dayOfWeek = (startingDayOfWeek + day - 1) % 7

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(new Date(year, month, day))}
              className={cn(
                "aspect-square rounded-md text-xs font-medium relative transition-all",
                "hover:bg-zinc-100 dark:hover:bg-zinc-800",
                isToday(day) && "bg-accent text-white hover:bg-accent/90",
                isSelected(day) && !isToday(day) && "ring-2 ring-accent ring-offset-1 dark:ring-offset-zinc-900",
                !isToday(day) && !isSelected(day) && (
                  dayOfWeek === 0 ? "text-red-400" :
                  dayOfWeek === 6 ? "text-blue-400" :
                  "text-zinc-700 dark:text-zinc-300"
                )
              )}
            >
              {day}
              {hasEvents && !isToday(day) && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Day Events */}
      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-1 mb-2">
          <Clock className="w-3 h-3 text-zinc-400" />
          <span className="text-xs text-zinc-500">
            {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
          </span>
        </div>
        <div className="space-y-1.5 max-h-[80px] overflow-y-auto custom-scrollbar">
          {selectedDayEvents.length > 0 ? (
            selectedDayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-2 p-1.5 rounded-md bg-zinc-50 dark:bg-zinc-800/50"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color === 'blue' ? '#3b82f6' : event.color }}
                />
                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                  {event.title}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-zinc-400 text-center py-2">일정 없음</p>
          )}
        </div>
      </div>
    </div>
  )
}
