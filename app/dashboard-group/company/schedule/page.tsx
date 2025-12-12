'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Filter,
  Calendar
} from 'lucide-react'

const scheduleData = [
  {
    id: '1',
    title: '주간 팀 미팅',
    description: '이번 주 업무 진행 상황 공유',
    date: '2024-12-16',
    time: '10:00 - 11:00',
    status: 'upcoming',
    priority: 'high',
    category: '회의'
  },
  {
    id: '2',
    title: '투자자 IR 자료 준비',
    description: '시리즈 A 투자 유치를 위한 IR 덱 작성',
    date: '2024-12-16',
    time: '14:00 - 17:00',
    status: 'in_progress',
    priority: 'urgent',
    category: '업무'
  },
  {
    id: '3',
    title: '신규 입사자 온보딩',
    description: '개발팀 신규 입사자 교육',
    date: '2024-12-17',
    time: '09:00 - 12:00',
    status: 'upcoming',
    priority: 'medium',
    category: '교육'
  },
  {
    id: '4',
    title: '분기 실적 보고',
    description: 'Q4 실적 리뷰 및 내년 계획 수립',
    date: '2024-12-18',
    time: '15:00 - 16:30',
    status: 'upcoming',
    priority: 'high',
    category: '보고'
  },
  {
    id: '5',
    title: '제품 데모 발표',
    description: '신규 기능 데모 및 피드백 수집',
    date: '2024-12-20',
    time: '15:00 - 16:00',
    status: 'upcoming',
    priority: 'medium',
    category: '발표'
  },
  {
    id: '6',
    title: '연말 회식',
    description: '전 직원 연말 회식',
    date: '2024-12-27',
    time: '18:00 - 21:00',
    status: 'upcoming',
    priority: 'low',
    category: '행사'
  }
]

export default function SchedulePage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [filter, setFilter] = useState<string>('all')

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500" />
      default:
        return <Circle className="w-5 h-5 text-zinc-400" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200'
      case 'high':
        return isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200'
      case 'medium':
        return isDark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return isDark ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
    }
  }

  const filteredSchedule = filter === 'all'
    ? scheduleData
    : scheduleData.filter(s => s.category === filter)

  const categories = ['all', ...Array.from(new Set(scheduleData.map(s => s.category)))]

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
              일정 관리
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              예정된 일정을 확인하고 관리하세요
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

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Filter className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === cat
                ? 'bg-accent text-white'
                : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            )}
          >
            {cat === 'all' ? '전체' : cat}
          </button>
        ))}
      </div>

      {/* 일정 목록 */}
      <div className="space-y-4">
        {filteredSchedule.map(schedule => (
          <div
            key={schedule.id}
            className={cn(
              'p-4 rounded-xl border transition-colors',
              isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="pt-1">
                {getStatusIcon(schedule.status)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    {schedule.title}
                  </h3>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium border',
                    getPriorityColor(schedule.priority)
                  )}>
                    {schedule.priority === 'urgent' ? '긴급' :
                     schedule.priority === 'high' ? '높음' :
                     schedule.priority === 'medium' ? '보통' : '낮음'}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                  )}>
                    {schedule.category}
                  </span>
                </div>
                <p className={cn('text-sm mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  {schedule.description}
                </p>
                <div className={cn('flex items-center gap-4 text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {schedule.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {schedule.time}
                  </span>
                </div>
              </div>
              <button className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              )}>
                상세보기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
