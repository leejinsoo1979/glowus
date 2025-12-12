'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlignLeft,
  Repeat,
  Bell,
  Users,
  Video,
  ChevronDown,
  Palette,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { Button } from '@/components/ui/Button'
import type { CalendarEvent, CreateEventData, EventColor, LocationType } from '@/types/calendar'
import { EVENT_COLORS, RECURRENCE_OPTIONS, REMINDER_OPTIONS } from '@/types/calendar'
import { format, addHours, setHours, setMinutes } from 'date-fns'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateEventData) => void
  onDelete?: (eventId: string) => void
  event?: CalendarEvent | null
  selectedDate?: Date | null
  isLoading?: boolean
}

const COLOR_OPTIONS: { value: EventColor; label: string }[] = [
  { value: 'blue', label: '파랑' },
  { value: 'green', label: '초록' },
  { value: 'purple', label: '보라' },
  { value: 'red', label: '빨강' },
  { value: 'orange', label: '주황' },
  { value: 'yellow', label: '노랑' },
  { value: 'pink', label: '분홍' },
  { value: 'cyan', label: '청록' },
  { value: 'indigo', label: '남색' },
  { value: 'teal', label: '청록' },
]

const LOCATION_TYPES: { value: LocationType; label: string; icon: typeof MapPin }[] = [
  { value: 'in_person', label: '오프라인', icon: MapPin },
  { value: 'online', label: '온라인', icon: Video },
  { value: 'hybrid', label: '하이브리드', icon: Users },
]

export function EventModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  event,
  selectedDate,
  isLoading = false,
}: EventModalProps) {
  const { accentColor } = useThemeStore()
  const isEditing = !!event

  const getDefaultStartTime = () => {
    const date = selectedDate || new Date()
    const now = new Date()
    const startHour = Math.ceil(now.getHours() + 1)
    return setMinutes(setHours(date, startHour), 0)
  }

  const getDefaultEndTime = () => {
    return addHours(getDefaultStartTime(), 1)
  }

  const [formData, setFormData] = useState<CreateEventData>({
    title: '',
    description: '',
    location: '',
    location_type: 'in_person',
    meeting_url: '',
    start_time: format(getDefaultStartTime(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(getDefaultEndTime(), "yyyy-MM-dd'T'HH:mm"),
    all_day: false,
    timezone: 'Asia/Seoul',
    is_recurring: false,
    recurrence_rule: '',
    color: 'blue',
    reminder_minutes: [30],
  })

  const [showColorPicker, setShowColorPicker] = useState(false)

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || '',
        location: event.location || '',
        location_type: event.location_type || 'in_person',
        meeting_url: event.meeting_url || '',
        start_time: event.start_time.slice(0, 16),
        end_time: event.end_time.slice(0, 16),
        all_day: event.all_day,
        timezone: event.timezone,
        is_recurring: event.is_recurring,
        recurrence_rule: event.recurrence_rule || '',
        color: event.color,
        reminder_minutes: event.reminders?.map(r => r.minutes_before) || [30],
      })
    } else if (selectedDate) {
      const startTime = getDefaultStartTime()
      const endTime = getDefaultEndTime()
      setFormData(prev => ({
        ...prev,
        start_time: format(startTime, "yyyy-MM-dd'T'HH:mm"),
        end_time: format(endTime, "yyyy-MM-dd'T'HH:mm"),
      }))
    }
  }, [event, selectedDate, isOpen])

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || isLoading) return

    onSubmit({
      ...formData,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString(),
    })
  }

  const handleClose = () => {
    if (isLoading) return
    setFormData({
      title: '',
      description: '',
      location: '',
      location_type: 'in_person',
      meeting_url: '',
      start_time: format(getDefaultStartTime(), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(getDefaultEndTime(), "yyyy-MM-dd'T'HH:mm"),
      all_day: false,
      timezone: 'Asia/Seoul',
      is_recurring: false,
      recurrence_rule: '',
      color: 'blue',
      reminder_minutes: [30],
    })
    setShowColorPicker(false)
    onClose()
  }

  const handleDelete = () => {
    if (event && onDelete) {
      onDelete(event.id)
    }
  }

  const toggleReminder = (minutes: number) => {
    setFormData(prev => ({
      ...prev,
      reminder_minutes: prev.reminder_minutes?.includes(minutes)
        ? prev.reminder_minutes.filter(m => m !== minutes)
        : [...(prev.reminder_minutes || []), minutes],
    }))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", accent.light)}>
                    <Calendar className={cn("w-6 h-6", accent.text)} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      {isEditing ? '일정 수정' : '새 일정'}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {isEditing ? '일정 정보를 수정하세요' : '일정 정보를 입력하세요'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 -m-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 space-y-4 overflow-y-auto flex-1">
                {/* Title with Color */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    제목 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="일정 제목"
                      required
                      autoFocus
                      className="flex-1 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                    />
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                      >
                        <div className={cn("w-6 h-6 rounded-full", EVENT_COLORS[formData.color || 'blue'].bg)} />
                      </button>
                      {showColorPicker && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="absolute right-0 top-full mt-2 p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-10"
                        >
                          <div className="grid grid-cols-5 gap-2">
                            {COLOR_OPTIONS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, color: color.value })
                                  setShowColorPicker(false)
                                }}
                                className={cn(
                                  "w-8 h-8 rounded-full transition-all",
                                  EVENT_COLORS[color.value].bg,
                                  formData.color === color.value && "ring-2 ring-offset-2 ring-zinc-400 dark:ring-offset-zinc-800"
                                )}
                                title={color.label}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* All Day Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    하루 종일
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, all_day: !formData.all_day })}
                    className={cn(
                      "w-12 h-7 rounded-full transition-all relative",
                      formData.all_day ? accent.bg : "bg-zinc-200 dark:bg-zinc-700"
                    )}
                  >
                    <motion.div
                      className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm"
                      animate={{ left: formData.all_day ? 'calc(100% - 24px)' : '4px' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                      시작
                    </label>
                    <input
                      type={formData.all_day ? 'date' : 'datetime-local'}
                      value={formData.all_day ? formData.start_time.split('T')[0] : formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: formData.all_day ? `${e.target.value}T00:00` : e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                      종료
                    </label>
                    <input
                      type={formData.all_day ? 'date' : 'datetime-local'}
                      value={formData.all_day ? formData.end_time.split('T')[0] : formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: formData.all_day ? `${e.target.value}T23:59` : e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                    />
                  </div>
                </div>

                {/* Location Type */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    장소 유형
                  </label>
                  <div className="flex gap-2">
                    {LOCATION_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, location_type: type.value })}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                          formData.location_type === type.value
                            ? cn(accent.bg, "text-white")
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location / Meeting URL */}
                {formData.location_type === 'online' || formData.location_type === 'hybrid' ? (
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                      <Video className="w-4 h-4 inline mr-1.5" />
                      미팅 URL
                    </label>
                    <input
                      type="url"
                      value={formData.meeting_url}
                      onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                      placeholder="https://zoom.us/j/..."
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                    />
                  </div>
                ) : null}

                {formData.location_type === 'in_person' || formData.location_type === 'hybrid' ? (
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                      <MapPin className="w-4 h-4 inline mr-1.5" />
                      장소
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="위치를 입력하세요"
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                    />
                  </div>
                ) : null}

                {/* Recurrence */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    <Repeat className="w-4 h-4 inline mr-1.5" />
                    반복
                  </label>
                  <div className="relative">
                    <select
                      value={formData.recurrence_rule}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrence_rule: e.target.value,
                        is_recurring: !!e.target.value,
                      })}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all appearance-none cursor-pointer"
                    >
                      {RECURRENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Reminders */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                    <Bell className="w-4 h-4 inline mr-1.5" />
                    알림
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {REMINDER_OPTIONS.slice(0, 6).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleReminder(option.value)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                          formData.reminder_minutes?.includes(option.value)
                            ? cn(accent.bg, "text-white")
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="pb-2">
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    <AlignLeft className="w-4 h-4 inline mr-1.5" />
                    설명 <span className="text-zinc-400 font-normal">(선택)</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="일정에 대한 설명을 입력하세요"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-5 mt-2 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between gap-3 flex-shrink-0">
                <div>
                  {isEditing && onDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="px-4 py-2.5 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      삭제
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !formData.title.trim()}
                    className={cn(
                      "px-6 py-2.5 rounded-xl font-medium text-white transition-all",
                      "flex items-center justify-center gap-2 min-w-[100px]",
                      accent.bg, accent.hover,
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      isEditing ? '저장' : '생성'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
