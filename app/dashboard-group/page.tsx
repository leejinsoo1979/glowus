'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore, accentColors as themeColors } from '@/stores/themeStore'
import {
  GitCommit,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  Zap,
  Target,
  BrainCircuit,
  Activity,
  Calendar,
  Layers,
  Search,
  UserPlus,
  Users,
  Bot,
  Loader2
} from 'lucide-react'

// 🔥 react-icons 제거 - lucide-react로 통일
const BsRobot = Bot
import { useRouter } from 'next/navigation'
import {
  TiltCard,
  AICoreWidget,
  ActivityHeatmap,
  EngagementOverview,
  TasksChart,
  ProductivityChart,
  CalendarWidget,
  TodoWidget,
  CodingTeamWidget,
  GitCommitsWidget,
  GanttWidget
} from '@/components/dashboard'
import { ActivityFeed } from '@/components/activity-feed'
import { ProactiveSuggestionPanel } from '@/components/proactive'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

// Types
interface DashboardMetrics {
  sprintProgress: number
  tasksCompleted: number
  tasksTotal: number
  commitCount: number
  riskIndex: number
  productivityScore: number
}

interface RecentTask {
  id: string
  description: string
  user_name: string
  created_at: string
  impact_level: 'high' | 'medium' | 'low'
}

interface TeamMember {
  id: string
  user: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }
  role: string
}

interface DeployedAgent {
  id: string
  name: string
  status: string
  avatar_url?: string
}

interface Commit {
  id: string
  description: string
  created_at: string
  user: {
    id: string
    name: string
    avatar_url?: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, currentStartup } = useAuthStore()
  const { accentColor } = useThemeStore()
  const [mounted, setMounted] = useState(false)

  // Data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Previous metrics for comparison
  const [prevProductivity, setPrevProductivity] = useState<number | null>(null)

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!currentStartup?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Parallel fetch all data
      const [dashboardRes, teamRes, agentsRes, commitsRes] = await Promise.all([
        fetch(`/api/dashboard?startup_id=${currentStartup.id}`),
        fetch(`/api/team-members?startup_id=${currentStartup.id}`),
        fetch(`/api/agents?startup_id=${currentStartup.id}`),
        fetch(`/api/commits?limit=5`)
      ])

      // Parse responses
      const [dashboardData, teamData, agentsData, commitsData] = await Promise.all([
        dashboardRes.json(),
        teamRes.json(),
        agentsRes.json(),
        commitsRes.json()
      ])

      // Set dashboard metrics
      if (dashboardData?.data) {
        const data = dashboardData.data
        // Store previous for comparison
        if (metrics?.productivityScore) {
          setPrevProductivity(metrics.productivityScore)
        }
        setMetrics(data.metrics)
        setRecentTasks(data.recentTasks || [])
      }

      // Set team members
      if (teamData?.data) {
        setTeamMembers(teamData.data)
      }

      // Set agents (array response)
      if (Array.isArray(agentsData)) {
        setAgents(agentsData)
      }

      // Set commits
      if (commitsData?.data) {
        setCommits(commitsData.data)
      }

    } catch (err) {
      console.error('Dashboard data fetch error:', err)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentStartup?.id, metrics?.productivityScore])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      fetchDashboardData()
    }
  }, [mounted, fetchDashboardData])

  if (!mounted) return null

  // Get accent color hex for dynamic styling
  const accentColorHex = themeColors.find(c => c.id === accentColor)?.color || '#3b82f6'

  // --- Theme Helpers ---
  const getAccentText = () => {
    switch (accentColor) {
      case 'purple': return 'text-purple-600 dark:text-purple-400'
      case 'blue': return 'text-blue-600 dark:text-blue-400'
      case 'green': return 'text-green-600 dark:text-green-400'
      case 'orange': return 'text-orange-600 dark:text-orange-400'
      case 'pink': return 'text-pink-600 dark:text-pink-400'
      case 'red': return 'text-red-600 dark:text-red-400'
      case 'yellow': return 'text-yellow-600 dark:text-yellow-400'
      case 'cyan': return 'text-cyan-600 dark:text-cyan-400'
      default: return 'text-blue-600 dark:text-blue-400'
    }
  }

  // --- Layout Animation ---
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 100 } }
  }

  return (
    <div className="relative min-h-screen text-zinc-900 dark:text-white p-6 font-sans selection:bg-accent/20">

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs text-red-500 hover:text-red-600"
          >
            닫기
          </button>
        </motion.div>
      )}

      {/* --- HUD Header --- */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-end mb-10 pb-4 border-b border-zinc-200 dark:border-white/5"
      >
        <div>
          <h1 className="text-6xl font-thin tracking-tighter mb-2">
            HELLO, <span className={cn("font-bold", getAccentText())}>{user?.name || 'USER'}</span>
          </h1>
          <div className="flex items-center gap-3 text-zinc-500 dark:text-white/50 text-sm tracking-widest font-mono">
            <span className="flex items-center gap-1"><BrainCircuit className="w-3 h-3" /> SYSTEM ONLINE</span>
            <span>::</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="hidden md:flex gap-4">
          <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur transition-all border border-zinc-200 dark:border-white/10">
            <Search className="w-4 h-4 text-zinc-600 dark:text-white/70" />
          </button>
          <button
            onClick={() => router.push('/agent-builder/new')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 hover:bg-accent/20 backdrop-blur transition-all border border-accent/20 hover:border-accent/40"
            title="AI 에이전트"
          >
            <BsRobot className="w-4 h-4 text-accent" />
          </button>
          <button className="flex items-center justify-center w-10 h-10 rounded-full bg-white/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 backdrop-blur transition-all border border-zinc-200 dark:border-white/10">
            <Layers className="w-4 h-4 text-zinc-600 dark:text-white/70" />
          </button>
        </div>
      </motion.div>

      {/* --- Bento Grid --- */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-12 gap-6"
      >
        {/* Row 1: Calendar + Urgent Tasks + Stats */}
        <motion.div variants={item} className="col-span-12 md:col-span-3 h-[380px]">
          <TiltCard className="h-full p-4">
            <CalendarWidget />
          </TiltCard>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-3 h-[380px]">
          <TiltCard className="h-full p-4">
            <TodoWidget />
          </TiltCard>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-6 h-[380px]">
          <div className="grid grid-rows-2 gap-6 h-full">
            {/* Sprint + Productivity */}
            <div className="grid grid-cols-2 gap-6">
              <TiltCard className="h-full p-5 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-32 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all" />
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-zinc-500 dark:text-white/60">SPRINT PROGRESS</span>
                    <Target className="w-4 h-4 text-zinc-400 dark:text-white/40" />
                  </div>
                  <div>
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                        <span className="text-sm text-zinc-400">로딩 중...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-4xl font-bold tracking-tighter text-zinc-900 dark:text-white">
                          {metrics?.sprintProgress ?? 0}%
                        </div>
                        <div className="h-1 w-full bg-zinc-200 dark:bg-white/10 rounded-full mt-3 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${metrics?.sprintProgress ?? 0}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: accentColorHex }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-zinc-400">
                          <span>{metrics?.tasksCompleted ?? 0} 완료</span>
                          <span>{metrics?.tasksTotal ?? 0} 전체</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </TiltCard>
              <TiltCard className="h-full p-5 flex flex-col justify-between">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-zinc-500 dark:text-white/60">PRODUCTIVITY</span>
                  <Zap className={cn("w-4 h-4", getAccentText())} />
                </div>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                    <span className="text-sm text-zinc-400">로딩 중...</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-3">
                    <span className={cn("text-4xl font-bold tracking-tighter", getAccentText())}>
                      {metrics?.productivityScore ?? 0}
                    </span>
                    {prevProductivity !== null && metrics?.productivityScore !== undefined && (
                      <span className={cn(
                        "text-sm mb-1.5 flex items-center",
                        metrics.productivityScore >= prevProductivity
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}>
                        {metrics.productivityScore >= prevProductivity ? (
                          <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 mr-0.5" />
                        )}
                        {Math.abs(metrics.productivityScore - prevProductivity)}%
                      </span>
                    )}
                  </div>
                )}
              </TiltCard>
            </div>
            {/* Team Card */}
            <TiltCard
              className="h-full p-5 flex flex-col justify-between cursor-pointer group hover:border-accent/50 transition-all"
              onClick={() => router.push('/dashboard-group/team/members/new')}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    "bg-accent/10 group-hover:bg-accent/20"
                  )}>
                    <Users className={cn("w-4 h-4", getAccentText())} />
                  </div>
                  <span className="font-medium tracking-tight text-zinc-700 dark:text-white">팀원</span>
                </div>
                <span className="text-xs font-mono text-zinc-400 dark:text-white/40">
                  {loading ? '...' : `${teamMembers.length + 1} MEMBERS`}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex -space-x-2">
                  {/* Current user (founder) */}
                  <div className="w-8 h-8 rounded-full bg-accent/20 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-accent">
                    {user?.name?.slice(0, 2).toUpperCase() || 'ME'}
                  </div>
                  {/* Team members */}
                  {teamMembers.slice(0, 4).map((member) => (
                    <div
                      key={member.id}
                      className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-white/70 overflow-hidden"
                      title={member.user?.name || '팀원'}
                    >
                      {member.user?.avatar_url ? (
                        <img src={member.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        member.user?.name?.slice(0, 2).toUpperCase() || '?'
                      )}
                    </div>
                  ))}
                  {/* More indicator */}
                  {teamMembers.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/20 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-white/70">
                      +{teamMembers.length - 4}
                    </div>
                  )}
                </div>
                <button
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    "bg-accent/10 hover:bg-accent/20 group-hover:scale-110",
                    "border-2 border-dashed border-accent/30 hover:border-accent/50"
                  )}
                >
                  <UserPlus className={cn("w-4 h-4", getAccentText())} />
                </button>
              </div>
              <div className="mt-2 pt-3 border-t border-zinc-100 dark:border-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-white/50">+ 팀원 생성</span>
                  <ArrowUpRight className="w-4 h-4 text-zinc-400 dark:text-white/30 group-hover:text-accent transition-colors" />
                </div>
              </div>
            </TiltCard>
          </div>
        </motion.div>

        {/* Row 1.5: Gantt Timeline */}
        <motion.div variants={item} className="col-span-12 h-[350px]">
          <TiltCard className="h-full p-5">
            <GanttWidget />
          </TiltCard>
        </motion.div>

        {/* Row 2: Recent Pushes + Commit Heatmap */}
        <motion.div variants={item} className="col-span-12 md:col-span-3 h-[380px]">
          <TiltCard className="h-full p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitCommit className="w-5 h-5 text-zinc-500 dark:text-white/50" />
                <span className="font-medium tracking-tight text-zinc-700 dark:text-white">RECENT ACTIVITY</span>
              </div>
              {metrics?.commitCount !== undefined && (
                <span className="text-xs font-mono text-zinc-400 dark:text-white/40">
                  이번주 {metrics.commitCount}
                </span>
              )}
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  <span className="text-sm text-zinc-400">로딩 중...</span>
                </div>
              ) : recentTasks.length > 0 ? (
                recentTasks.map((task) => (
                  <div key={task.id} className="flex gap-3 items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-zinc-900",
                      task.impact_level === 'high'
                        ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                        : task.impact_level === 'medium'
                          ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                          : "bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-white/70"
                    )}>
                      {task.user_name?.slice(0, 2).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800 dark:text-white/80 truncate">{task.description}</p>
                      <p className="text-xs text-zinc-400 dark:text-white/30 font-mono">
                        {task.user_name} • {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>
                ))
              ) : commits.length > 0 ? (
                commits.map((commit) => (
                  <div key={commit.id} className="flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-white/70 overflow-hidden">
                      {commit.user?.avatar_url ? (
                        <img src={commit.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        commit.user?.name?.slice(0, 2).toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-800 dark:text-white/80 truncate">{commit.description}</p>
                      <p className="text-xs text-zinc-400 dark:text-white/30 font-mono">
                        {commit.user?.name} • {formatDistanceToNow(new Date(commit.created_at), { addSuffix: true, locale: ko })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Activity className="w-8 h-8 text-zinc-300 dark:text-white/20 mb-2" />
                  <p className="text-sm text-zinc-400 dark:text-white/40">아직 활동이 없습니다</p>
                  <p className="text-xs text-zinc-300 dark:text-white/20 mt-1">태스크를 생성해보세요</p>
                </div>
              )}
            </div>
          </TiltCard>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-9 h-[380px]">
          <TiltCard className="h-full p-5">
            <ActivityHeatmap />
          </TiltCard>
        </motion.div>

        {/* Row 3: Coding Team Agents + Charts */}
        <motion.div variants={item} className="col-span-12 md:col-span-3 h-[400px]">
          <TiltCard className="h-full p-5">
            <CodingTeamWidget />
          </TiltCard>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-4 h-[400px]">
          <TiltCard className="h-full p-5">
            <ProductivityChart />
          </TiltCard>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-5 h-[400px]">
          <TiltCard className="h-full p-5">
            <EngagementOverview />
          </TiltCard>
        </motion.div>

        {/* Row 4: Git Commits */}
        <motion.div variants={item} className="col-span-12 md:col-span-6 h-[400px] relative z-0 overflow-hidden">
          <div className="h-full overflow-y-auto rounded-2xl">
            <GitCommitsWidget />
          </div>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-6 h-[400px] relative z-0">
          <TiltCard className="h-full p-5">
            <TasksChart />
          </TiltCard>
        </motion.div>

        {/* Row 5: Proactive AI Suggestions + Telegram Activity Feed */}
        <motion.div variants={item} className="col-span-12 md:col-span-4 h-[450px] relative z-0">
          <TiltCard className="h-full overflow-hidden">
            <ProactiveSuggestionPanel maxItems={5} sortBy="priority" />
          </TiltCard>
        </motion.div>

        <motion.div variants={item} className="col-span-12 md:col-span-8 h-[450px] relative z-0">
          <TiltCard className="h-full p-5 flex flex-col overflow-hidden">
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-medium tracking-tight text-zinc-800 dark:text-white">
                텔레그램 작업 기록
              </h3>
              <span className="text-xs text-zinc-400 font-mono">ACTIVITY FEED</span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <ActivityFeed limit={10} />
            </div>
          </TiltCard>
        </motion.div>

      </motion.div>
    </div>
  )
}
