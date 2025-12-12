'use client'

import { GitCommit, CheckCircle2, Clock, TrendingUp, Shield } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export interface MemberAboutData {
  bio?: string[]
  role: 'admin' | 'member' | 'viewer'
  skills?: string[]
  stats?: {
    commits: number
    tasksCompleted: number
    hoursWorked: number
    streak: number
  }
  recentActivity?: {
    action: string
    target: string
    time: string
  }[]
}

interface MemberAboutSectionProps {
  data: MemberAboutData
}

export function MemberAboutSection({ data }: MemberAboutSectionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', label: '관리자' }
      case 'member':
        return { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: '멤버' }
      case 'viewer':
        return { bg: 'bg-zinc-100 dark:bg-zinc-500/20', text: 'text-zinc-700 dark:text-zinc-400', label: '뷰어' }
      default:
        return { bg: 'bg-zinc-100 dark:bg-zinc-500/20', text: 'text-zinc-700 dark:text-zinc-400', label: role }
    }
  }

  const roleBadge = getRoleBadge(data.role)

  // Default stats if not provided
  const stats = data.stats || {
    commits: Math.floor(Math.random() * 100) + 20,
    tasksCompleted: Math.floor(Math.random() * 50) + 10,
    hoursWorked: Math.floor(Math.random() * 200) + 100,
    streak: Math.floor(Math.random() * 14) + 1,
  }

  // Default activity if not provided
  const recentActivity = data.recentActivity || [
    { action: '커밋', target: 'feat: 새로운 기능 추가', time: '2시간 전' },
    { action: '완료', target: '버그 수정 태스크', time: '5시간 전' },
    { action: '리뷰', target: 'PR #42 코드 리뷰', time: '어제' },
  ]

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Role Badge */}
      <div className="flex items-center gap-3">
        <span className={cn(
          "px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2",
          roleBadge.bg, roleBadge.text
        )}>
          <Shield className="w-4 h-4" />
          {roleBadge.label}
        </span>
      </div>

      {/* About Me */}
      {data.bio && data.bio.length > 0 && (
        <div>
          <h2 className={cn(
            'text-2xl md:text-3xl font-bold mb-4',
            isDark ? 'text-white' : 'text-zinc-900'
          )}>
            소개
          </h2>
          <div className="w-10 h-1 bg-accent rounded-full mb-6" />
          <div className={cn(
            'space-y-4 text-sm md:text-base leading-relaxed',
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          )}>
            {data.bio.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div>
        <h3 className={cn(
          'text-xl md:text-2xl font-bold mb-6',
          isDark ? 'text-white' : 'text-zinc-900'
        )}>
          활동 통계
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border text-center',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}>
            <GitCommit className="w-6 h-6 mx-auto mb-2 text-accent" />
            <p className="text-2xl md:text-3xl font-bold text-accent mb-1">{stats.commits}</p>
            <p className={cn(
              'text-xs md:text-sm',
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            )}>
              커밋
            </p>
          </div>
          <div className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border text-center',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}>
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl md:text-3xl font-bold text-green-500 mb-1">{stats.tasksCompleted}</p>
            <p className={cn(
              'text-xs md:text-sm',
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            )}>
              완료 태스크
            </p>
          </div>
          <div className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border text-center',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}>
            <Clock className="w-6 h-6 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl md:text-3xl font-bold text-orange-500 mb-1">{stats.hoursWorked}h</p>
            <p className={cn(
              'text-xs md:text-sm',
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            )}>
              작업 시간
            </p>
          </div>
          <div className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border text-center',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}>
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl md:text-3xl font-bold text-purple-500 mb-1">{stats.streak}일</p>
            <p className={cn(
              'text-xs md:text-sm',
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            )}>
              연속 활동
            </p>
          </div>
        </div>
      </div>

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div>
          <h3 className={cn(
            'text-xl md:text-2xl font-bold mb-6',
            isDark ? 'text-white' : 'text-zinc-900'
          )}>
            스킬
          </h3>
          <div className="flex flex-wrap gap-3">
            {data.skills.map((skill, index) => (
              <span
                key={index}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                  isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                )}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className={cn(
          'text-xl md:text-2xl font-bold mb-6',
          isDark ? 'text-white' : 'text-zinc-900'
        )}>
          최근 활동
        </h3>
        <div className="space-y-3">
          {recentActivity.map((activity, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border transition-colors',
                isDark
                  ? 'bg-zinc-800/50 border-zinc-800 hover:border-zinc-700'
                  : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold",
                "bg-accent/10 text-accent"
              )}>
                {activity.action.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-medium truncate',
                  isDark ? 'text-zinc-200' : 'text-zinc-800'
                )}>
                  {activity.target}
                </p>
                <p className={cn(
                  'text-sm',
                  isDark ? 'text-zinc-500' : 'text-zinc-500'
                )}>
                  {activity.action}
                </p>
              </div>
              <span className={cn(
                'text-sm flex-shrink-0',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}>
                {activity.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
