'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Crown,
  Compass,
  Code2,
  TestTube,
  Eye,
  Activity,
  FileCode,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowUpRight,
} from 'lucide-react'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

// 5 코딩팀 에이전트 정의
const CODING_AGENTS = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    nameKo: '오케스트레이터',
    description: '작업 분배 및 조율',
    icon: Crown,
    color: '#f59e0b', // amber
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'planner',
    name: 'Planner',
    nameKo: '플래너',
    description: '설계 및 아키텍처',
    icon: Compass,
    color: '#8b5cf6', // purple
    bgColor: 'rgba(139, 92, 246, 0.1)',
  },
  {
    id: 'implementer',
    name: 'Implementer',
    nameKo: '구현자',
    description: '코드 작성',
    icon: Code2,
    color: '#10b981', // emerald
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  {
    id: 'tester',
    name: 'Tester',
    nameKo: '테스터',
    description: '테스트 및 QA',
    icon: TestTube,
    color: '#3b82f6', // blue
    bgColor: 'rgba(59, 130, 246, 0.1)',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    nameKo: '리뷰어',
    description: '코드 리뷰',
    icon: Eye,
    color: '#ec4899', // pink
    bgColor: 'rgba(236, 72, 153, 0.1)',
  },
]

interface AgentStats {
  agent_role: string
  total_tasks: number
  total_files_created: number
  total_files_modified: number
  total_nodes_created: number
  total_actions: number
  successful_tasks: number
  avg_duration_ms: number
  last_active_at: string | null
}

export function CodingTeamWidget() {
  const { accentColor } = useThemeStore()
  const [stats, setStats] = useState<AgentStats[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/coding-team/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats || [])
      }
    } catch (err) {
      console.error('Failed to fetch coding team stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const getAgentStats = (agentId: string): AgentStats | null => {
    return stats.find(s => s.agent_role === agentId) || null
  }

  const getTotalContributions = () => {
    return stats.reduce((sum, s) => sum + (s.total_tasks || 0), 0)
  }

  const getTopContributor = () => {
    if (stats.length === 0) return null
    const sorted = [...stats].sort((a, b) => (b.total_tasks || 0) - (a.total_tasks || 0))
    return sorted[0]
  }

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '활동 없음'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return '방금 전'
    if (diffMin < 60) return `${diffMin}분 전`
    if (diffHour < 24) return `${diffHour}시간 전`
    return `${diffDay}일 전`
  }

  const topContributor = getTopContributor()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: mounted ? `${currentAccent.color}20` : '#8b5cf620' }}
          >
            <Activity
              className="w-4 h-4"
              style={{ color: mounted ? currentAccent.color : '#8b5cf6' }}
            />
          </div>
          <span className="font-medium tracking-tight text-zinc-700 dark:text-white">
            코딩팀 에이전트
          </span>
        </div>
        <span className="text-xs font-mono text-zinc-400 dark:text-white/40">
          {loading ? '...' : `${getTotalContributions()} TASKS`}
        </span>
      </div>

      {/* Agent List */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
            <span className="text-sm text-zinc-400">로딩 중...</span>
          </div>
        ) : (
          CODING_AGENTS.map((agent, index) => {
            const agentStats = getAgentStats(agent.id)
            const Icon = agent.icon
            const hasActivity = agentStats && agentStats.total_tasks > 0
            const isTopContributor = topContributor?.agent_role === agent.id

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-xl transition-all",
                  "hover:bg-zinc-50 dark:hover:bg-white/5",
                  isTopContributor && "ring-1 ring-amber-400/50 bg-amber-50/50 dark:bg-amber-500/5"
                )}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: agent.bgColor }}
                >
                  <Icon className="w-4 h-4" style={{ color: agent.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-zinc-800 dark:text-white truncate">
                      {agent.nameKo}
                    </span>
                    {isTopContributor && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                        TOP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    {hasActivity ? (
                      <>
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          {agentStats.total_tasks} 작업
                        </span>
                        {agentStats.total_files_created > 0 && (
                          <span className="flex items-center gap-0.5">
                            <FileCode className="w-3 h-3" />
                            {agentStats.total_files_created}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-600">
                        {agent.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Contribution Bar */}
                <div className="w-16 flex flex-col items-end gap-1">
                  {hasActivity ? (
                    <>
                      <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, (agentStats.total_tasks / Math.max(1, getTotalContributions())) * 100 * 5)}%`
                          }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: agent.color }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTimeAgo(agentStats.last_active_at)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
                      기여 없음
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500 dark:text-white/50">Neural Map에서 사용</span>
          <ArrowUpRight className="w-4 h-4 text-zinc-400 dark:text-white/30" />
        </div>
      </div>
    </div>
  )
}
