"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Flag,
  Plus,
  Bot,
  Video,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  type: "deadline" | "meeting" | "milestone" | "sprint" | "task"
  description?: string
  attendees?: string[]
}

interface CalendarSectionProps {
  projectId: string
  project: {
    name: string
    deadline?: string | null
  }
}

const eventTypeConfig = {
  deadline: { label: "마감", color: "#EF4444", icon: Flag },
  meeting: { label: "미팅", color: "#3B82F6", icon: Video },
  milestone: { label: "마일스톤", color: "#8B5CF6", icon: Flag },
  sprint: { label: "스프린트", color: "#10B981", icon: Clock },
  task: { label: "태스크", color: "#F59E0B", icon: FileText },
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"]
const MONTHS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
]

export function CalendarSection({ projectId, project }: CalendarSectionProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [projectId, currentDate])

  const fetchEvents = async () => {
    try {
      // TODO: Replace with actual API call
      const sampleEvents: CalendarEvent[] = [
        {
          id: "1",
          title: "스프린트 2 시작",
          date: getDateString(new Date()),
          type: "sprint",
        },
        {
          id: "2",
          title: "팀 주간 미팅",
          date: getDateString(addDays(new Date(), 1)),
          time: "10:00",
          type: "meeting",
          attendees: ["김개발", "이디자인", "박기획"],
        },
        {
          id: "3",
          title: "UI 디자인 완료",
          date: getDateString(addDays(new Date(), 3)),
          type: "deadline",
        },
        {
          id: "4",
          title: "베타 버전 릴리스",
          date: getDateString(addDays(new Date(), 7)),
          type: "milestone",
        },
        {
          id: "5",
          title: "투자자 미팅",
          date: getDateString(addDays(new Date(), 10)),
          time: "14:00",
          type: "meeting",
          attendees: ["VC 담당자"],
        },
        {
          id: "6",
          title: "API 문서 작성",
          date: getDateString(addDays(new Date(), 5)),
          type: "task",
        },
      ]
      setEvents(sampleEvents)
    } catch (error) {
      console.error("Events fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDateString = (date: Date) => {
    return date.toISOString().split("T")[0]
  }

  const addDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const calendarDays = useMemo(() => getDaysInMonth(currentDate), [currentDate])

  const getEventsForDate = (date: Date) => {
    const dateStr = getDateString(date)
    return events.filter((e) => e.date === dateStr)
  }

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  const isSelected = (date: Date) => {
    if (!selectedDate) return false
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []

  // Upcoming events (next 7 days)
  const upcomingEvents = events
    .filter((e) => {
      const eventDate = new Date(e.date)
      const today = new Date()
      const nextWeek = addDays(today, 7)
      return eventDate >= today && eventDate <= nextWeek
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">일정 관리</h2>
          <p className="text-sm text-zinc-500 mt-1">프로젝트 일정 및 마감일 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            오늘
          </Button>
          <Button variant="default" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            일정 추가
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">
              {currentDate.getFullYear()}년 {MONTHS[currentDate.getMonth()]}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevMonth}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((day, idx) => (
              <div
                key={day}
                className={`text-center text-sm font-medium py-2 ${
                  idx === 0 ? "text-red-400" : idx === 6 ? "text-blue-400" : "text-zinc-500"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, idx) => {
              if (!date) {
                return <div key={`empty-${idx}`} className="h-24" />
              }

              const dayEvents = getEventsForDate(date)
              const dayOfWeek = date.getDay()

              return (
                <motion.button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  className={`h-24 p-2 rounded-lg text-left transition-all ${
                    isSelected(date)
                      ? "bg-zinc-700 ring-2 ring-blue-500"
                      : isToday(date)
                      ? "bg-zinc-800"
                      : "hover:bg-zinc-800/50"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isToday(date)
                        ? "text-blue-400"
                        : dayOfWeek === 0
                        ? "text-red-400"
                        : dayOfWeek === 6
                        ? "text-blue-400"
                        : "text-zinc-300"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs px-1.5 py-0.5 rounded truncate"
                        style={{
                          backgroundColor: `${eventTypeConfig[event.type].color}20`,
                          color: eventTypeConfig[event.type].color,
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-zinc-500 px-1">+{dayEvents.length - 2}개 더</div>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Selected Date Events */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-zinc-400" />
              {selectedDate
                ? selectedDate.toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })
                : "날짜를 선택하세요"}
            </h3>
            {selectedDate && selectedDateEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => {
                  const EventIcon = eventTypeConfig[event.type].icon

                  return (
                    <div
                      key={event.id}
                      className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${eventTypeConfig[event.type].color}20` }}
                        >
                          <EventIcon
                            className="w-4 h-4"
                            style={{ color: eventTypeConfig[event.type].color }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm">{event.title}</div>
                          {event.time && (
                            <div className="text-xs text-zinc-500 mt-0.5">{event.time}</div>
                          )}
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-zinc-400">
                              <Users className="w-3 h-3" />
                              {event.attendees.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                {selectedDate ? "이 날에는 일정이 없습니다" : "캘린더에서 날짜를 선택하세요"}
              </p>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              다가오는 일정
            </h3>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const EventIcon = eventTypeConfig[event.type].icon
                  const eventDate = new Date(event.date)
                  const daysUntil = Math.ceil(
                    (eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  )

                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${eventTypeConfig[event.type].color}20` }}
                      >
                        <EventIcon
                          className="w-4 h-4"
                          style={{ color: eventTypeConfig[event.type].color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{event.title}</div>
                        <div className="text-xs text-zinc-500">
                          {eventDate.toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                          {event.time && ` ${event.time}`}
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          daysUntil <= 1
                            ? "bg-red-500/20 text-red-400"
                            : daysUntil <= 3
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-zinc-700 text-zinc-400"
                        }`}
                      >
                        {daysUntil === 0 ? "오늘" : daysUntil === 1 ? "내일" : `D-${daysUntil}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">예정된 일정이 없습니다</p>
            )}
          </div>

          {/* Event Type Legend */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="font-semibold text-white mb-3 text-sm">일정 유형</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(eventTypeConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-zinc-400">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
