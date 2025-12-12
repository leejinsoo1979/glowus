'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useTeamStore, Team } from '@/stores/teamStore'
import { useThemeStore } from '@/stores/themeStore'
import { TeamCreateModal, TeamFormData } from '@/components/team/TeamCreateModal'
import {
  TiltCard,
  LiveMeshGradient,
} from '@/components/dashboard'
import {
  Users,
  Plus,
  Building2,
  MoreVertical,
  Trash2,
  ChevronRight,
  Target,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  UserPlus,
  FolderKanban,
  GitCommit,
  ArrowUpRight,
  Crown,
  Star,
  Trophy,
  Flame,
  BarChart3,
  MessageSquare,
  Bell,
  Settings,
  Sparkles,
} from 'lucide-react'

// Mock data for demo
const mockTeamMembers = [
  { id: '1', name: '김진수', role: 'CEO', avatar: null, initials: 'JK', status: 'online', commits: 127 },
  { id: '2', name: '이서연', role: 'CTO', avatar: null, initials: 'SY', status: 'online', commits: 89 },
  { id: '3', name: '박민호', role: 'Designer', avatar: null, initials: 'MH', status: 'away', commits: 45 },
  { id: '4', name: '최유진', role: 'Developer', avatar: null, initials: 'YJ', status: 'offline', commits: 67 },
  { id: '5', name: '정하늘', role: 'Developer', avatar: null, initials: 'HN', status: 'online', commits: 34 },
]

const mockProjects = [
  { id: '1', name: 'StartupShow MVP', progress: 78, status: 'active', tasks: 24, completed: 19 },
  { id: '2', name: '투자자 대시보드', progress: 45, status: 'active', tasks: 18, completed: 8 },
  { id: '3', name: '모바일 앱 v2', progress: 92, status: 'review', tasks: 12, completed: 11 },
]

const mockActivities = [
  { user: 'JK', action: '커밋', target: 'feat: 팀 대시보드 UI 개선', time: '2분 전', type: 'commit' },
  { user: 'SY', action: '완료', target: 'API 엔드포인트 리팩토링', time: '15분 전', type: 'complete' },
  { user: 'MH', action: '생성', target: '새로운 디자인 시스템 컴포넌트', time: '1시간 전', type: 'create' },
  { user: 'YJ', action: '리뷰', target: 'PR #142 - 인증 로직 수정', time: '2시간 전', type: 'review' },
]

export default function TeamPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore()
  const { teams, addTeam, removeTeam } = useTeamStore()
  const [mounted, setMounted] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    // 첫 번째 팀을 기본 선택
    if (teams.length > 0) {
      setSelectedTeam(teams[0])
    }
  }, [teams])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  const getAccentClasses = () => {
    const colors: Record<string, { bg: string; bgLight: string; text: string; border: string; gradient: string }> = {
      purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30', gradient: 'from-purple-500/20 via-purple-500/5 to-transparent' },
      blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30', gradient: 'from-blue-500/20 via-blue-500/5 to-transparent' },
      green: { bg: 'bg-green-500', bgLight: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30', gradient: 'from-green-500/20 via-green-500/5 to-transparent' },
      orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/30', gradient: 'from-orange-500/20 via-orange-500/5 to-transparent' },
      pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-500/10', text: 'text-pink-500', border: 'border-pink-500/30', gradient: 'from-pink-500/20 via-pink-500/5 to-transparent' },
      red: { bg: 'bg-red-500', bgLight: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30', gradient: 'from-red-500/20 via-red-500/5 to-transparent' },
      yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/10', text: 'text-yellow-500', border: 'border-yellow-500/30', gradient: 'from-yellow-500/20 via-yellow-500/5 to-transparent' },
      cyan: { bg: 'bg-cyan-500', bgLight: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30', gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent' },
    }
    return colors[accentColor] || colors.blue
  }

  const accent = getAccentClasses()

  const handleCreateTeam = (data: TeamFormData) => {
    addTeam(data)
    setIsModalOpen(false)
  }

  const handleDeleteTeam = (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('정말 이 팀을 삭제하시겠습니까?')) {
      removeTeam(teamId)
      setMenuOpenId(null)
      if (selectedTeam?.id === teamId) {
        setSelectedTeam(teams.find(t => t.id !== teamId) || null)
      }
    }
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100 } },
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      default: return 'bg-zinc-400'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'commit': return <GitCommit className="w-3.5 h-3.5" />
      case 'complete': return <CheckCircle2 className="w-3.5 h-3.5" />
      case 'create': return <Plus className="w-3.5 h-3.5" />
      case 'review': return <MessageSquare className="w-3.5 h-3.5" />
      default: return <Activity className="w-3.5 h-3.5" />
    }
  }

  if (!mounted) return null

  // 팀이 없을 때 Empty State
  if (teams.length === 0) {
    return (
      <div className="relative min-h-screen p-6">
        <LiveMeshGradient />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center min-h-[70vh]"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className={cn(
              "w-32 h-32 rounded-3xl flex items-center justify-center mb-8",
              "bg-gradient-to-br", accent.gradient,
              "border-2 border-dashed", accent.border
            )}
          >
            <Users className={cn("w-16 h-16", accent.text)} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-bold tracking-tight mb-4 text-zinc-900 dark:text-white"
          >
            팀을 시작하세요
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-zinc-500 dark:text-white/50 text-center max-w-md mb-8"
          >
            팀을 생성하고 멤버를 초대하여 함께 프로젝트를 관리하세요.
            실시간 협업과 진행 상황 추적이 가능합니다.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "px-8 py-4 rounded-2xl font-semibold text-white",
              "flex items-center gap-3 shadow-lg",
              accent.bg,
              "hover:opacity-90 transition-all"
            )}
          >
            <Plus className="w-5 h-5" />
            첫 번째 팀 만들기
          </motion.button>
        </motion.div>

        <TeamCreateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateTeam}
        />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen p-6">
      <LiveMeshGradient />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-end mb-8 pb-4 border-b border-zinc-200 dark:border-white/5"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", accent.bgLight)}>
              <Building2 className={cn("w-5 h-5", accent.text)} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {selectedTeam?.name || '팀 대시보드'}
            </h1>
          </div>
          <p className="text-zinc-500 dark:text-white/50 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {mockTeamMembers.length}명
            </span>
            <span className="text-zinc-300 dark:text-white/20">•</span>
            <span className="flex items-center gap-1">
              <FolderKanban className="w-4 h-4" />
              {mockProjects.length}개 프로젝트
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Team Selector */}
          {teams.length > 1 && (
            <select
              value={selectedTeam?.id || ''}
              onChange={(e) => setSelectedTeam(teams.find(t => t.id === e.target.value) || null)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                isDark
                  ? "bg-zinc-800 border-zinc-700 text-white"
                  : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "px-4 py-2 rounded-xl font-medium text-white flex items-center gap-2",
              accent.bg
            )}
          >
            <Plus className="w-4 h-4" />
            새 팀
          </motion.button>
        </div>
      </motion.div>

      {/* Bento Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 auto-rows-[160px] gap-5"
      >
        {/* 1. Team Stats Overview */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2 row-span-2">
          <TiltCard className="h-full p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-zinc-700 dark:text-white flex items-center gap-2">
                <Trophy className={cn("w-5 h-5", accent.text)} />
                팀 성과
              </h3>
              <span className="text-xs font-mono text-zinc-400 dark:text-white/40">이번 주</span>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className={cn("p-4 rounded-2xl", isDark ? "bg-white/5" : "bg-zinc-50")}>
                <div className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">127</div>
                <div className="text-xs text-zinc-500 dark:text-white/50 flex items-center gap-1">
                  <GitCommit className="w-3 h-3" /> 커밋
                </div>
              </div>
              <div className={cn("p-4 rounded-2xl", isDark ? "bg-white/5" : "bg-zinc-50")}>
                <div className="text-3xl font-bold text-green-500 mb-1">24</div>
                <div className="text-xs text-zinc-500 dark:text-white/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 완료
                </div>
              </div>
              <div className={cn("p-4 rounded-2xl", isDark ? "bg-white/5" : "bg-zinc-50")}>
                <div className="text-3xl font-bold text-orange-500 mb-1">8</div>
                <div className="text-xs text-zinc-500 dark:text-white/50 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 진행중
                </div>
              </div>
              <div className={cn("p-4 rounded-2xl", isDark ? "bg-white/5" : "bg-zinc-50")}>
                <div className={cn("text-3xl font-bold mb-1", accent.text)}>94%</div>
                <div className="text-xs text-zinc-500 dark:text-white/50 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> 효율
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>

        {/* 2. Team Members */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2 row-span-2">
          <TiltCard className="h-full p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-700 dark:text-white flex items-center gap-2">
                <Users className={cn("w-5 h-5", accent.text)} />
                팀원
              </h3>
              <button
                onClick={() => router.push('/dashboard-group/team/members/new')}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  accent.bgLight, "hover:opacity-80"
                )}
              >
                <UserPlus className={cn("w-4 h-4", accent.text)} />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {mockTeamMembers.map((member, i) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer group",
                    isDark ? "hover:bg-white/5" : "hover:bg-zinc-50"
                  )}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                      isDark ? "bg-zinc-700 text-white" : "bg-zinc-100 text-zinc-700"
                    )}>
                      {member.initials}
                    </div>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2",
                      isDark ? "border-zinc-900" : "border-white",
                      getStatusColor(member.status)
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white truncate">
                        {member.name}
                      </span>
                      {member.role === 'CEO' && (
                        <Crown className="w-3.5 h-3.5 text-yellow-500" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-white/50">{member.role}</span>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-sm font-semibold", accent.text)}>{member.commits}</div>
                    <div className="text-[10px] text-zinc-400 dark:text-white/30">커밋</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </TiltCard>
        </motion.div>

        {/* 3. Sprint Progress */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2">
          <TiltCard className="h-full p-5 relative overflow-hidden group">
            <div className={cn("absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl transition-all", accent.bgLight, "group-hover:scale-150")} />
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 dark:text-white/60">스프린트 진행률</span>
                <Target className={cn("w-4 h-4", accent.text)} />
              </div>
              <div>
                <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">78%</div>
                <div className={cn("h-2 w-full rounded-full mt-3 overflow-hidden", isDark ? "bg-white/10" : "bg-zinc-200")}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '78%' }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={cn("h-full rounded-full", accent.bg)}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-zinc-400 dark:text-white/40">
                  <span>D-5</span>
                  <span>19/24 완료</span>
                </div>
              </div>
            </div>
          </TiltCard>
        </motion.div>

        {/* 4. Productivity Score */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-2">
          <TiltCard className="h-full p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500 dark:text-white/60">생산성 점수</span>
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex items-end gap-3">
              <span className={cn("text-4xl font-bold tracking-tight", accent.text)}>94</span>
              <span className="text-sm text-green-500 mb-1.5 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-0.5" /> +12%
              </span>
            </div>
            <div className="flex gap-1 mt-2">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-colors",
                    i < 9 ? accent.bg : isDark ? "bg-white/10" : "bg-zinc-200"
                  )}
                />
              ))}
            </div>
          </TiltCard>
        </motion.div>

        {/* 5. Active Projects */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-3 row-span-2">
          <TiltCard className="h-full p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-700 dark:text-white flex items-center gap-2">
                <FolderKanban className={cn("w-5 h-5", accent.text)} />
                진행 중인 프로젝트
              </h3>
              <button className="text-xs text-zinc-400 dark:text-white/40 hover:text-zinc-600 dark:hover:text-white/60">
                전체 보기 →
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {mockProjects.map((project, i) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "p-4 rounded-2xl transition-colors cursor-pointer group",
                    isDark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-50 hover:bg-zinc-100"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-zinc-900 dark:text-white group-hover:text-accent transition-colors">
                      {project.name}
                    </h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-medium",
                      project.status === 'active'
                        ? "bg-green-500/10 text-green-500"
                        : "bg-yellow-500/10 text-yellow-500"
                    )}>
                      {project.status === 'active' ? '진행중' : '리뷰중'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-zinc-200")}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progress}%` }}
                          transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                          className={cn("h-full rounded-full", accent.bg)}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-zinc-400 dark:text-white/40">
                    <span>{project.completed}/{project.tasks} 태스크</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
            </div>
          </TiltCard>
        </motion.div>

        {/* 6. Recent Activity */}
        <motion.div variants={item} className="md:col-span-2 lg:col-span-3 row-span-2">
          <TiltCard className="h-full p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-700 dark:text-white flex items-center gap-2">
                <Activity className={cn("w-5 h-5", accent.text)} />
                최근 활동
              </h3>
              <span className="relative flex h-2 w-2">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", accent.bg)} />
                <span className={cn("relative inline-flex rounded-full h-2 w-2", accent.bg)} />
              </span>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto">
              {mockActivities.map((activity, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                    isDark ? "bg-zinc-700 text-white" : "bg-zinc-100 text-zinc-700"
                  )}>
                    {activity.user}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1",
                        accent.bgLight, accent.text
                      )}>
                        {getActivityIcon(activity.type)}
                        {activity.action}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-white/80 truncate mt-1">
                      {activity.target}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-white/30 mt-0.5">{activity.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </TiltCard>
        </motion.div>

        {/* 7. Quick Actions */}
        <motion.div variants={item} className="md:col-span-4 lg:col-span-6">
          <TiltCard className="h-full p-5">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-4">
                <Sparkles className={cn("w-6 h-6", accent.text)} />
                <span className="font-medium text-zinc-700 dark:text-white">빠른 액션</span>
              </div>
              <div className="flex items-center gap-3">
                {[
                  { icon: UserPlus, label: '팀원 초대', href: '/dashboard-group/team/members/new' },
                  { icon: FolderKanban, label: '프로젝트 생성', href: '/dashboard-group/projects/new' },
                  { icon: Calendar, label: '미팅 예약', href: '/dashboard-group/calendar' },
                  { icon: MessageSquare, label: '팀 채팅', href: '/dashboard-group/messenger' },
                  { icon: Settings, label: '팀 설정', href: '/dashboard-group/team/settings' },
                ].map((action, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push(action.href)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors",
                      isDark
                        ? "bg-white/5 hover:bg-white/10 text-white/80"
                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                    )}
                  >
                    <action.icon className="w-4 h-4" />
                    {action.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </motion.div>

      {/* Team Create Modal */}
      <TeamCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTeam}
      />

      {/* Click outside to close menu */}
      {menuOpenId && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setMenuOpenId(null)}
        />
      )}
    </div>
  )
}
