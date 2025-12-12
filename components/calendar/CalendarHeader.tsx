'use client'

import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  LayoutGrid,
  List,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { Button } from '@/components/ui/Button'
import type { CalendarView } from '@/types/calendar'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import { ko } from 'date-fns/locale'

interface CalendarHeaderProps {
  currentDate: Date
  view: CalendarView
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarView) => void
  onAddEvent: () => void
  onToday: () => void
}

export function CalendarHeader({
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onAddEvent,
  onToday,
}: CalendarHeaderProps) {
  const { accentColor } = useThemeStore()

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', light: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' }
      case 'blue': return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
      case 'green': return { bg: 'bg-green-500', hover: 'hover:bg-green-600', light: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400' }
      case 'orange': return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', light: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' }
      case 'pink': return { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', light: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400' }
      case 'red': return { bg: 'bg-red-500', hover: 'hover:bg-red-600', light: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' }
      case 'yellow': return { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', light: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400' }
      case 'cyan': return { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', light: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400' }
      default: return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
    }
  }

  const accent = getAccentClasses()

  const getDateRangeText = () => {
    switch (view) {
      case 'day':
        return format(currentDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })
      case 'week': {
        const start = startOfWeek(currentDate, { weekStartsOn: 0 })
        const end = endOfWeek(currentDate, { weekStartsOn: 0 })
        return `${format(start, 'M월 d일', { locale: ko })} - ${format(end, 'M월 d일', { locale: ko })}`
      }
      case 'month':
        return format(currentDate, 'yyyy년 M월', { locale: ko })
      case 'agenda':
        return format(currentDate, 'yyyy년 M월', { locale: ko })
      default:
        return format(currentDate, 'yyyy년 M월', { locale: ko })
    }
  }

  const navigatePrev = () => {
    const newDate = new Date(currentDate)
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() - 1)
        break
      case 'week':
        newDate.setDate(newDate.getDate() - 7)
        break
      case 'month':
      case 'agenda':
        newDate.setMonth(newDate.getMonth() - 1)
        break
    }
    onDateChange(newDate)
  }

  const navigateNext = () => {
    const newDate = new Date(currentDate)
    switch (view) {
      case 'day':
        newDate.setDate(newDate.getDate() + 1)
        break
      case 'week':
        newDate.setDate(newDate.getDate() + 7)
        break
      case 'month':
      case 'agenda':
        newDate.setMonth(newDate.getMonth() + 1)
        break
    }
    onDateChange(newDate)
  }

  const views: { id: CalendarView; icon: typeof LayoutGrid; label: string }[] = [
    { id: 'month', icon: LayoutGrid, label: '월' },
    { id: 'week', icon: CalendarDays, label: '주' },
    { id: 'day', icon: Calendar, label: '일' },
    { id: 'agenda', icon: List, label: '목록' },
  ]

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Left: Navigation */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={navigatePrev}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={navigateNext}
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <motion.h2
          key={getDateRangeText()}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold text-zinc-900 dark:text-white"
        >
          {getDateRangeText()}
        </motion.h2>

        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          오늘
        </button>
      </div>

      {/* Right: View Switcher & Add Button */}
      <div className="flex items-center gap-3">
        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === v.id
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <v.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>

        {/* Add Event Button */}
        <Button
          variant="accent"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={onAddEvent}
        >
          일정 추가
        </Button>
      </div>
    </div>
  )
}
