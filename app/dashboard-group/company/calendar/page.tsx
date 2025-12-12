'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users
} from 'lucide-react'

// 샘플 일정 데이터
const sampleEvents = [
  {
    id: '1',
    title: '팀 주간 회의',
    date: '2024-12-16',
    time: '10:00',
    duration: '1시간',
    location: '회의실 A',
    attendees: ['김대표', '이팀장', '박과장'],
    type: 'meeting',
    color: 'blue'
  },
  {
    id: '2',
    title: '투자자 미팅',
    date: '2024-12-18',
    time: '14:00',
    duration: '2시간',
    location: '본사 대회의실',
    attendees: ['김대표', '이사'],
    type: 'external',
    color: 'purple'
  },
  {
    id: '3',
    title: '제품 데모 발표',
    date: '2024-12-20',
    time: '15:00',
    duration: '1시간 30분',
    location: '온라인 (Zoom)',
    attendees: ['개발팀 전체'],
    type: 'presentation',
    color: 'green'
  },
  {
    id: '4',
    title: '연말 워크숍',
    date: '2024-12-27',
    time: '09:00',
    duration: '종일',
    location: '외부 연수원',
    attendees: ['전 직원'],
    type: 'event',
    color: 'orange'
  }
]

const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']
const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

export default function CalendarPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [currentDate, setCurrentDate] = useState(new Date(2024, 11, 1)) // 2024년 12월
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // 달력 생성
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const calendarDays: { day: number; isCurrentMonth: boolean; date: string }[] = []

  // 이전 달 날짜
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    calendarDays.push({
      day,
      isCurrentMonth: false,
      date: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    })
  }

  // 현재 달 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    })
  }

  // 다음 달 날짜 (6주 채우기)
  const remainingDays = 42 - calendarDays.length
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    calendarDays.push({
      day,
      isCurrentMonth: false,
      date: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    })
  }

  const getEventsForDate = (date: string) => {
    return sampleEvents.filter(event => event.date === date)
  }

  const getEventColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
      purple: isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
      green: isDark ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      orange: isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200'
    }
    return colors[color] || colors.blue
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const today = new Date()
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // 선택된 날짜의 일정
  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard-group/company')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              캘린더
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              일정을 확인하고 관리하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <Plus className="w-4 h-4" />
          일정 추가
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 캘린더 */}
        <div className={cn(
          'lg:col-span-2 rounded-xl border p-6',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className={cn('text-xl font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              {year}년 {months[month]}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                )}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMonth}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-2">
            {daysOfWeek.map((day, index) => (
              <div
                key={day}
                className={cn(
                  'text-center text-sm font-medium py-2',
                  index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : '',
                  isDark ? 'text-zinc-400' : 'text-zinc-500'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, index) => {
              const events = getEventsForDate(item.date)
              const isToday = item.date === todayString
              const isSelected = item.date === selectedDate
              const dayOfWeek = index % 7

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(item.date)}
                  className={cn(
                    'relative p-2 min-h-[80px] rounded-lg text-left transition-colors',
                    item.isCurrentMonth
                      ? isDark ? 'text-zinc-100' : 'text-zinc-900'
                      : isDark ? 'text-zinc-600' : 'text-zinc-400',
                    isSelected
                      ? isDark ? 'bg-zinc-800 ring-2 ring-accent' : 'bg-zinc-100 ring-2 ring-accent'
                      : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50',
                    dayOfWeek === 0 && item.isCurrentMonth ? 'text-red-500' : '',
                    dayOfWeek === 6 && item.isCurrentMonth ? 'text-blue-500' : ''
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-full text-sm',
                    isToday && 'bg-accent text-white font-bold'
                  )}>
                    {item.day}
                  </span>

                  {/* 일정 표시 */}
                  <div className="mt-1 space-y-1">
                    {events.slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate border',
                          getEventColor(event.color)
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className={cn(
                        'text-xs',
                        isDark ? 'text-zinc-500' : 'text-zinc-400'
                      )}>
                        +{events.length - 2}개 더
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택된 날짜의 일정 */}
        <div className={cn(
          'rounded-xl border p-6',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <h3 className={cn('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
            {selectedDate
              ? `${selectedDate.split('-')[1]}월 ${selectedDate.split('-')[2]}일 일정`
              : '날짜를 선택하세요'
            }
          </h3>

          {selectedDate ? (
            selectedEvents.length > 0 ? (
              <div className="space-y-4">
                {selectedEvents.map(event => (
                  <div
                    key={event.id}
                    className={cn(
                      'p-4 rounded-lg border',
                      isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
                    )}
                  >
                    <div className={cn(
                      'inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 border',
                      getEventColor(event.color)
                    )}>
                      {event.type === 'meeting' ? '회의' :
                       event.type === 'external' ? '외부' :
                       event.type === 'presentation' ? '발표' : '행사'}
                    </div>
                    <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                      {event.title}
                    </h4>

                    <div className="mt-3 space-y-2">
                      <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                        <Clock className="w-4 h-4" />
                        {event.time} ({event.duration})
                      </div>
                      <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                        <MapPin className="w-4 h-4" />
                        {event.location}
                      </div>
                      <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                        <Users className="w-4 h-4" />
                        {event.attendees.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn(
                'text-center py-8',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}>
                <p>등록된 일정이 없습니다</p>
                <button className={cn(
                  'mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                )}>
                  + 일정 추가하기
                </button>
              </div>
            )
          ) : (
            <div className={cn(
              'text-center py-8',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}>
              <p>캘린더에서 날짜를 선택하면</p>
              <p>해당 날짜의 일정을 확인할 수 있습니다</p>
            </div>
          )}

          {/* 이번 주 예정 일정 */}
          <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
            <h4 className={cn('text-sm font-semibold mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              예정된 일정
            </h4>
            <div className="space-y-2">
              {sampleEvents.slice(0, 3).map(event => (
                <div
                  key={event.id}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                    isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'
                  )}
                  onClick={() => setSelectedDate(event.date)}
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    event.color === 'blue' ? 'bg-blue-500' :
                    event.color === 'purple' ? 'bg-purple-500' :
                    event.color === 'green' ? 'bg-green-500' : 'bg-orange-500'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm truncate',
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    )}>
                      {event.title}
                    </p>
                    <p className={cn(
                      'text-xs',
                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                    )}>
                      {event.date.split('-')[1]}/{event.date.split('-')[2]} {event.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
