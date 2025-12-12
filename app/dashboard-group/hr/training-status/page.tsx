'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  GraduationCap,
  Clock,
  CheckCircle2,
  Play,
  Users
} from 'lucide-react'

const trainingData = [
  {
    id: '1',
    title: '신입사원 온보딩 교육',
    category: '필수',
    instructor: '김인사',
    duration: '8시간',
    participants: 5,
    completed: 3,
    status: 'in_progress',
    deadline: '2024-12-20'
  },
  {
    id: '2',
    title: '정보보안 교육',
    category: '필수',
    instructor: '박보안',
    duration: '4시간',
    participants: 25,
    completed: 25,
    status: 'completed',
    deadline: '2024-12-15'
  },
  {
    id: '3',
    title: 'AWS 클라우드 실습',
    category: '기술',
    instructor: '외부 강사',
    duration: '16시간',
    participants: 8,
    completed: 0,
    status: 'upcoming',
    deadline: '2024-12-28'
  },
  {
    id: '4',
    title: '리더십 교육',
    category: '관리',
    instructor: '최리더',
    duration: '6시간',
    participants: 4,
    completed: 2,
    status: 'in_progress',
    deadline: '2024-12-22'
  },
  {
    id: '5',
    title: '성희롱 예방 교육',
    category: '법정필수',
    instructor: '온라인',
    duration: '1시간',
    participants: 30,
    completed: 28,
    status: 'in_progress',
    deadline: '2024-12-31'
  }
]

export default function TrainingStatusPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
      case 'in_progress':
        return isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
      default:
        return isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case '필수':
      case '법정필수':
        return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200'
      case '기술':
        return isDark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'
      case '관리':
        return isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200'
      default:
        return isDark ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' : 'bg-zinc-100 text-zinc-600 border-zinc-200'
    }
  }

  const totalParticipants = trainingData.reduce((sum, t) => sum + t.participants, 0)
  const totalCompleted = trainingData.reduce((sum, t) => sum + t.completed, 0)
  const completionRate = Math.round((totalCompleted / totalParticipants) * 100)

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
              교육 현황
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              직원 교육 프로그램을 관리하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <Plus className="w-4 h-4" />
          교육 추가
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
              <GraduationCap className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>총 교육</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{trainingData.length}개</p>
            </div>
          </div>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-green-500/20' : 'bg-green-100')}>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>완료율</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{completionRate}%</p>
            </div>
          </div>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-purple-500/20' : 'bg-purple-100')}>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>총 수강</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{totalParticipants}명</p>
            </div>
          </div>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-orange-500/20' : 'bg-orange-100')}>
              <Play className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>진행중</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {trainingData.filter(t => t.status === 'in_progress').length}개
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 교육 목록 */}
      <div className="space-y-4">
        {trainingData.map(training => (
          <div
            key={training.id}
            className={cn(
              'p-4 rounded-xl border transition-colors',
              isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    {training.title}
                  </h3>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium border',
                    getCategoryColor(training.category)
                  )}>
                    {training.category}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    getStatusColor(training.status)
                  )}>
                    {training.status === 'completed' ? '완료' : training.status === 'in_progress' ? '진행중' : '예정'}
                  </span>
                </div>
                <div className={cn('flex items-center gap-4 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  <span>강사: {training.instructor}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {training.duration}
                  </span>
                  <span>마감: {training.deadline}</span>
                </div>
              </div>
              <div className="text-right">
                <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>수강 현황</p>
                <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  {training.completed}/{training.participants}
                </p>
                <div className={cn('w-24 h-2 rounded-full mt-1', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(training.completed / training.participants) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
