'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent, StatCard } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { formatRelativeTime } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  GitCommit,
  Target,
  Zap,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Activity,
  Clock,
  Loader2,
} from 'lucide-react'

interface RecentCommit {
  id: string
  description: string
  user_name: string
  created_at: string
  impact_level?: string
}

interface Task {
  id: string
  title: string
  status: string
  priority: string
  assignee_name?: string
}

interface DashboardData {
  metrics: {
    sprintProgress: number
    tasksCompleted: number
    tasksTotal: number
    commitCount: number
    riskIndex: number
    productivityScore: number
  }
  recentTasks: RecentCommit[]
  urgentTasks: Task[]
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    sprintProgress: 0,
    tasksCompleted: 0,
    tasksTotal: 0,
    commitCount: 0,
    riskIndex: 0,
    productivityScore: 0,
  })
  const [recentCommits, setRecentCommits] = useState<RecentCommit[]>([])
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([])

  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/dashboard')
      const result = await response.json()

      if (result.data) {
        setMetrics(result.data.metrics)
        setRecentCommits(result.data.recentTasks || [])
        setUrgentTasks(result.data.urgentTasks || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      // 에러 시 목업 데이터 사용
      setMetrics({
        sprintProgress: 65,
        tasksCompleted: 12,
        tasksTotal: 20,
        commitCount: 34,
        riskIndex: 15,
        productivityScore: 82,
      })
      setRecentCommits([
        { id: '1', description: '사용자 인증 로직 개선', user_name: '김개발', created_at: new Date(Date.now() - 3600000).toISOString(), impact_level: 'high' },
        { id: '2', description: 'API 응답 속도 최적화', user_name: '이엔지', created_at: new Date(Date.now() - 7200000).toISOString(), impact_level: 'medium' },
      ])
      setUrgentTasks([
        { id: '1', title: '결제 시스템 연동', status: 'in_progress', priority: 'urgent', assignee_name: '김개발' },
        { id: '2', title: '투자자 대시보드 UI', status: 'todo', priority: 'high', assignee_name: '박프론트' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const getImpactBadge = (impact?: string) => {
    switch (impact) {
      case 'high':
        return { bg: 'bg-danger-500/20', text: 'text-danger-400', label: '높음' }
      case 'medium':
        return { bg: 'bg-warning-500/20', text: 'text-warning-400', label: '중간' }
      default:
        return { bg: 'bg-zinc-700', text: 'text-zinc-400', label: '낮음' }
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: 'bg-danger-500/20', text: 'text-danger-400', label: '긴급', dot: 'bg-danger-500' }
      case 'high':
        return { bg: 'bg-warning-500/20', text: 'text-warning-400', label: '높음', dot: 'bg-warning-500' }
      default:
        return { bg: 'bg-zinc-700', text: 'text-zinc-400', label: '보통', dot: 'bg-zinc-500' }
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return '좋은 아침이에요'
    if (hour < 18) return '좋은 오후에요'
    return '좋은 저녁이에요'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />
          <p className="text-zinc-500">대시보드 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">
            {getGreeting()}, <span className="text-gradient">{user?.name || '사용자'}</span>님
          </h1>
          <p className="text-zinc-500 mt-2 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            오늘의 팀 현황을 확인하세요
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="스프린트 진행률"
          value={`${metrics.sprintProgress}%`}
          change={12}
          changeLabel="지난주 대비"
          icon={<Target className="w-6 h-6" />}
          trend="up"
        />
        <StatCard
          title="완료된 태스크"
          value={`${metrics.tasksCompleted}/${metrics.tasksTotal}`}
          change={8}
          changeLabel="지난주 대비"
          icon={<CheckCircle2 className="w-6 h-6" />}
          trend="up"
        />
        <StatCard
          title="이번 주 커밋"
          value={metrics.commitCount}
          change={-5}
          changeLabel="지난주 대비"
          icon={<GitCommit className="w-6 h-6" />}
          trend="down"
        />
        <StatCard
          title="생산성 점수"
          value={metrics.productivityScore}
          change={3}
          changeLabel="지난주 대비"
          icon={<Zap className="w-6 h-6" />}
          trend="up"
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Commits */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card variant="default" className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
                  <GitCommit className="w-5 h-5 text-white" />
                </div>
                <CardTitle>최근 커밋</CardTitle>
              </div>
              <button className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 font-medium group">
                전체 보기
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentCommits.map((commit, index) => {
                const badge = getImpactBadge(commit.impact_level)
                return (
                  <motion.div
                    key={commit.id}
                    className="flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-zinc-700 to-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:from-primary-500/20 group-hover:to-primary-600/20 transition-colors">
                      <GitCommit className="w-5 h-5 text-zinc-400 group-hover:text-primary-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-100 group-hover:text-primary-400 transition-colors">
                        {commit.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs font-medium text-zinc-400">{commit.user_name}</span>
                        <span className="text-xs text-zinc-600">•</span>
                        <span className="text-xs text-zinc-500">
                          {formatRelativeTime(commit.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </motion.div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Urgent Tasks */}
        <motion.div variants={item}>
          <Card variant="default" className="h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warning-400 to-warning-500 flex items-center justify-center shadow-lg shadow-warning-500/25">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <CardTitle>긴급 태스크</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {urgentTasks.map((task, index) => {
                const badge = getPriorityBadge(task.priority)
                return (
                  <motion.div
                    key={task.id}
                    className="p-4 border border-zinc-800 rounded-xl hover:border-zinc-700 hover:bg-zinc-800/50 transition-all cursor-pointer group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${badge.dot}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-100 group-hover:text-primary-400 transition-colors">
                          {task.title}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs text-zinc-500">{task.assignee_name}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* AI Insights */}
      <motion.div variants={item}>
        <Card variant="gradient" className="border-2 border-primary-500/20 overflow-hidden relative">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <CardContent className="py-6 relative">
            <div className="flex items-start gap-5">
              <motion.div
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/30"
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Sparkles className="w-7 h-7 text-white" />
              </motion.div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-100 mb-2 flex items-center gap-2">
                  AI 인사이트
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary-500/20 text-primary-400 rounded-full">
                    New
                  </span>
                </h3>
                <p className="text-zinc-400 leading-relaxed">
                  이번 스프린트에서 <span className="font-semibold text-zinc-100">결제 시스템 연동</span> 태스크가 예상보다 지연되고 있습니다.
                  현재 진행 속도를 감안하면 마감일까지 완료하기 어려울 수 있습니다.
                  <span className="font-semibold text-primary-400"> 추가 리소스 배치를 고려해보세요.</span>
                </p>
                <div className="flex gap-3 mt-4">
                  <button className="px-4 py-2 text-sm font-semibold text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 rounded-lg transition-colors">
                    자세히 보기 →
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
                    다음에 보기
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
