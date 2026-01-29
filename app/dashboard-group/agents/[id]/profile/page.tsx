'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  User,
  BarChart3,
  Brain,
  Users,
  Loader2,
  Bot,
  MessageSquare,
  Heart,
  Clock,
  Target,
  TrendingUp,
  Star,
  Link2,
  Activity,
  FileText,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Users2,
  Zap,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AgentProfile, type AgentProfileData } from '@/components/agent/AgentProfile'
import { StatsRadar, StatsRadarPanel, type AgentStatsData } from '@/components/agent/StatsRadar'
import { BrainMapLayout } from '@/components/brain-map/BrainMapLayout'
import { createClient } from '@/lib/supabase/client'

// ============================================
// Types
// ============================================

type ProfileTab = 'overview' | 'stats' | 'brain' | 'relations' | 'activities'

interface TabConfig {
  id: ProfileTab
  label: string
  icon: React.ElementType
  description: string
}

interface AgentRelationship {
  id: string
  partner_type: 'user' | 'agent' | 'team'
  partner_id: string
  partner_name: string
  partner_avatar?: string
  rapport: number // 0-100
  interaction_count: number
  last_interaction?: string
  relationship_type: 'colleague' | 'supervisor' | 'subordinate' | 'collaborator'
}

// ============================================
// Constants
// ============================================

const TABS: TabConfig[] = [
  {
    id: 'overview',
    label: '개요',
    icon: User,
    description: '기본 정보 및 통계',
  },
  {
    id: 'activities',
    label: '활동',
    icon: Activity,
    description: '업무 활동 기록',
  },
  {
    id: 'stats',
    label: '능력치',
    icon: BarChart3,
    description: '능력치 분석 및 성장 추이',
  },
  {
    id: 'brain',
    label: '뇌 그래프',
    icon: Brain,
    description: '지식 네트워크 시각화',
  },
  {
    id: 'relations',
    label: '관계',
    icon: Users,
    description: '에이전트 관계 및 협업 현황',
  },
]

const RELATIONSHIP_TYPE_CONFIG = {
  colleague: { label: '동료', color: '#3b82f6' },
  supervisor: { label: '상위자', color: '#8b5cf6' },
  subordinate: { label: '하위자', color: '#22c55e' },
  collaborator: { label: '협업자', color: '#f59e0b' },
}

// 활동 로그 타입 설정
const ACTIVITY_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  conversation: { label: '대화', icon: MessageSquare, color: '#3b82f6' },
  task_work: { label: '작업', icon: CheckCircle, color: '#22c55e' },
  decision: { label: '의사결정', icon: Target, color: '#8b5cf6' },
  analysis: { label: '분석', icon: BarChart3, color: '#f59e0b' },
  learning: { label: '학습', icon: Lightbulb, color: '#06b6d4' },
  collaboration: { label: '협업', icon: Users2, color: '#ec4899' },
  error: { label: '오류', icon: AlertCircle, color: '#ef4444' },
  milestone: { label: '마일스톤', icon: Award, color: '#eab308' },
  tool_use: { label: '도구 사용', icon: Zap, color: '#10b981' },
}

interface AgentWorkLog {
  id: string
  log_type: string
  title: string
  content: string
  summary?: string
  importance: number
  tags: string[]
  metadata: Record<string, any>
  created_at: string
}

// ============================================
// Activity Log Item Component
// ============================================

function ActivityLogItem({
  log,
  isDark,
}: {
  log: AgentWorkLog
  isDark: boolean
}) {
  const config = ACTIVITY_TYPE_CONFIG[log.log_type] || ACTIVITY_TYPE_CONFIG.task_work
  const Icon = config.icon

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all hover:scale-[1.01]',
        isDark
          ? 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
          : 'bg-white border-zinc-200 hover:border-zinc-300'
      )}
    >
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${config.color}20`,
                color: config.color,
              }}
            >
              {config.label}
            </span>
            {log.importance >= 8 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-medium">
                중요
              </span>
            )}
          </div>

          <h4
            className={cn(
              'font-medium mb-1',
              isDark ? 'text-white' : 'text-zinc-900'
            )}
          >
            {log.title}
          </h4>

          <p
            className={cn(
              'text-sm line-clamp-2',
              isDark ? 'text-zinc-400' : 'text-zinc-600'
            )}
          >
            {log.summary || log.content}
          </p>

          {/* 태그 */}
          {log.tags && log.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {log.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
                  )}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 시간 */}
          <div className="flex items-center gap-1 mt-2">
            <Clock
              className={cn('w-3 h-3', isDark ? 'text-zinc-500' : 'text-zinc-400')}
            />
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {new Date(log.created_at).toLocaleString('ko-KR', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Activities Tab Content
// ============================================

function ActivitiesTab({
  agentId,
  isDark,
}: {
  agentId: string
  isDark: boolean
}) {
  const [logs, setLogs] = useState<AgentWorkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
          .from('agent_work_logs')
          .select('*')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false })
          .limit(50)

        if (data && data.length > 0) {
          setLogs(data as AgentWorkLog[])
        } else {
          // 데이터가 없으면 빈 배열
          setLogs([])
        }
      } catch (error) {
        console.error('Failed to fetch activity logs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [agentId])

  const filteredLogs = logs.filter(
    (l) => filter === 'all' || l.log_type === filter
  )

  // 활동 타입별 개수
  const typeCounts = logs.reduce((acc, log) => {
    acc[log.log_type] = (acc[log.log_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filterButtons = [
    { id: 'all', label: '전체', count: logs.length },
    ...Object.entries(ACTIVITY_TYPE_CONFIG)
      .filter(([key]) => typeCounts[key])
      .map(([key, config]) => ({
        id: key,
        label: config.label,
        count: typeCounts[key] || 0,
      })),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 필터 버튼 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
              filter === btn.id
                ? 'bg-accent text-white'
                : isDark
                ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            )}
          >
            {btn.label}
            <span
              className={cn(
                'ml-1.5 text-xs',
                filter === btn.id
                  ? 'text-white/70'
                  : isDark
                  ? 'text-zinc-500'
                  : 'text-zinc-400'
              )}
            >
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      {/* 활동 통계 */}
      <div
        className={cn(
          'grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
        )}
      >
        <div className="text-center">
          <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {logs.length}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            총 활동
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold text-green-500')}>
            {typeCounts['task_work'] || 0}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            작업 완료
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold text-blue-500')}>
            {typeCounts['tool_use'] || 0}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            도구 사용
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold text-amber-500')}>
            {logs.filter((l) => l.importance >= 8).length}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            중요 활동
          </p>
        </div>
      </div>

      {/* 활동 목록 */}
      {filteredLogs.length > 0 ? (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <ActivityLogItem key={log.id} log={log} isDark={isDark} />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            'text-center py-12',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}
        >
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>활동 기록이 없습니다</p>
          <p className="text-sm mt-2">에이전트가 작업을 수행하면 여기에 기록됩니다.</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Relationship Card Component
// ============================================

function RelationshipCard({
  relationship,
  isDark,
}: {
  relationship: AgentRelationship
  isDark: boolean
}) {
  const typeConfig = RELATIONSHIP_TYPE_CONFIG[relationship.relationship_type]
  const rapportColor =
    relationship.rapport >= 70
      ? '#22c55e'
      : relationship.rapport >= 40
      ? '#f59e0b'
      : '#ef4444'

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer',
        isDark
          ? 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
          : 'bg-white border-zinc-200 hover:border-zinc-300'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
            relationship.partner_type === 'agent'
              ? 'bg-gradient-to-br from-violet-500 to-purple-600'
              : relationship.partner_type === 'team'
              ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
              : 'bg-gradient-to-br from-green-500 to-emerald-600'
          )}
        >
          {relationship.partner_avatar ? (
            <img
              src={relationship.partner_avatar}
              alt={relationship.partner_name}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : relationship.partner_type === 'agent' ? (
            <Bot className="w-6 h-6 text-white" />
          ) : relationship.partner_type === 'team' ? (
            <Users className="w-6 h-6 text-white" />
          ) : (
            <User className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={cn(
                'font-medium truncate',
                isDark ? 'text-white' : 'text-zinc-900'
              )}
            >
              {relationship.partner_name}
            </h4>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${typeConfig.color}20`,
                color: typeConfig.color,
              }}
            >
              {typeConfig.label}
            </span>
          </div>

          {/* Rapport Bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                친밀도
              </span>
              <span style={{ color: rapportColor }}>{relationship.rapport}%</span>
            </div>
            <div
              className={cn(
                'h-1.5 rounded-full overflow-hidden',
                isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${relationship.rapport}%`,
                  backgroundColor: rapportColor,
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <MessageSquare
                className={cn('w-3.5 h-3.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}
              />
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                {relationship.interaction_count}회 상호작용
              </span>
            </div>
            {relationship.last_interaction && (
              <div className="flex items-center gap-1">
                <Clock
                  className={cn('w-3.5 h-3.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}
                />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
                  {new Date(relationship.last_interaction).toLocaleDateString('ko-KR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Relations Tab Content
// ============================================

function RelationsTab({
  agentId,
  isDark,
}: {
  agentId: string
  isDark: boolean
}) {
  const [relationships, setRelationships] = useState<AgentRelationship[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'user' | 'agent' | 'team'>('all')

  useEffect(() => {
    const fetchRelationships = async () => {
      try {
        setLoading(true)
        const supabase = createClient()

        // 관계 데이터 조회
        const { data: relations } = await supabase
          .from('agent_relationships')
          .select('*')
          .eq('agent_id', agentId)
          .order('rapport', { ascending: false })

        if (relations && relations.length > 0) {
          // 파트너 정보 가져오기
          const enrichedRelations = await Promise.all(
            relations.map(async (rel: any) => {
              let partnerName = '알 수 없음'
              let partnerAvatar: string | undefined

              if (rel.partner_type === 'agent') {
                const { data: agent } = await supabase
                  .from('deployed_agents')
                  .select('name, avatar_url')
                  .eq('id', rel.partner_id)
                  .single() as { data: { name: string; avatar_url?: string } | null }
                if (agent) {
                  partnerName = agent.name
                  partnerAvatar = agent.avatar_url
                }
              } else if (rel.partner_type === 'user') {
                const { data: user } = await supabase
                  .from('users')
                  .select('name, avatar_url')
                  .eq('id', rel.partner_id)
                  .single() as { data: { name: string; avatar_url?: string } | null }
                if (user) {
                  partnerName = user.name
                  partnerAvatar = user.avatar_url
                }
              } else if (rel.partner_type === 'team') {
                const { data: team } = await supabase
                  .from('teams')
                  .select('name, logo_url')
                  .eq('id', rel.partner_id)
                  .single() as { data: { name: string; logo_url?: string } | null }
                if (team) {
                  partnerName = team.name
                  partnerAvatar = team.logo_url
                }
              }

              return {
                id: rel.id,
                partner_type: rel.partner_type,
                partner_id: rel.partner_id,
                partner_name: partnerName,
                partner_avatar: partnerAvatar,
                rapport: rel.rapport || 50,
                interaction_count: rel.interaction_count || 0,
                last_interaction: rel.last_interaction,
                relationship_type: rel.relationship_type || 'collaborator',
              }
            })
          )
          setRelationships(enrichedRelations)
        } else {
          // 관계 데이터가 없으면 빈 배열 (대화 시 자동 생성됨)
          setRelationships([])
        }
      } catch (error) {
        console.error('Failed to fetch relationships:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRelationships()
  }, [agentId])

  const filteredRelations = relationships.filter(
    (r) => filter === 'all' || r.partner_type === filter
  )

  const filterButtons = [
    { id: 'all' as const, label: '전체', count: relationships.length },
    { id: 'user' as const, label: '사용자', count: relationships.filter((r) => r.partner_type === 'user').length },
    { id: 'agent' as const, label: '에이전트', count: relationships.filter((r) => r.partner_type === 'agent').length },
    { id: 'team' as const, label: '팀', count: relationships.filter((r) => r.partner_type === 'team').length },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 필터 버튼 */}
      <div className="flex items-center gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            onClick={() => setFilter(btn.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === btn.id
                ? 'bg-accent text-white'
                : isDark
                ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            )}
          >
            {btn.label}
            <span
              className={cn(
                'ml-1.5 text-xs',
                filter === btn.id
                  ? 'text-white/70'
                  : isDark
                  ? 'text-zinc-500'
                  : 'text-zinc-400'
              )}
            >
              {btn.count}
            </span>
          </button>
        ))}
      </div>

      {/* 관계 통계 */}
      <div
        className={cn(
          'grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
        )}
      >
        <div className="text-center">
          <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {relationships.length}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            총 관계
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold text-green-500')}>
            {relationships.filter((r) => r.rapport >= 70).length}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            높은 친밀도
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {relationships.reduce((sum, r) => sum + r.interaction_count, 0)}
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            총 상호작용
          </p>
        </div>
        <div className="text-center">
          <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {relationships.length > 0
              ? Math.round(
                  relationships.reduce((sum, r) => sum + r.rapport, 0) /
                    relationships.length
                )
              : 0}
            %
          </p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            평균 친밀도
          </p>
        </div>
      </div>

      {/* 관계 목록 */}
      {filteredRelations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRelations.map((relationship) => (
            <RelationshipCard
              key={relationship.id}
              relationship={relationship}
              isDark={isDark}
            />
          ))}
        </div>
      ) : (
        <div
          className={cn(
            'text-center py-12',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}
        >
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>관계 데이터가 없습니다</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Stats Tab Content
// ============================================

function StatsTab({
  agentId,
  isDark,
}: {
  agentId: string
  isDark: boolean
}) {
  const [stats, setStats] = useState<AgentStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/agents/${agentId}/profile`)
        if (res.ok) {
          const data = await res.json()
          setStats(data.abilities)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [agentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={cn('text-center py-12', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        능력치 데이터를 불러올 수 없습니다
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 레이더 차트 패널 */}
      <StatsRadarPanel
        stats={stats}
        isDark={isDark}
        title="능력치 분석"
      />

      {/* 상세 능력치 바 */}
      <div
        className={cn(
          'p-6 rounded-2xl border',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
        )}
      >
        <h3
          className={cn(
            'font-semibold mb-6',
            isDark ? 'text-white' : 'text-zinc-900'
          )}
        >
          상세 능력치
        </h3>
        <div className="space-y-4">
          {[
            { key: 'analysis', label: '분석력', color: '#3b82f6' },
            { key: 'communication', label: '소통력', color: '#22c55e' },
            { key: 'creativity', label: '창의력', color: '#8b5cf6' },
            { key: 'leadership', label: '리더십', color: '#f59e0b' },
            { key: 'execution', label: '실행력', color: '#ef4444' },
            { key: 'adaptability', label: '적응력', color: '#06b6d4' },
          ].map((stat) => (
            <div key={stat.key}>
              <div className="flex items-center justify-between mb-2">
                <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                  {stat.label}
                </span>
                <span
                  className="font-bold"
                  style={{ color: stat.color }}
                >
                  {stats[stat.key as keyof AgentStatsData]}
                </span>
              </div>
              <div
                className={cn(
                  'h-3 rounded-full overflow-hidden',
                  isDark ? 'bg-zinc-700' : 'bg-zinc-200'
                )}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${stats[stat.key as keyof AgentStatsData] || 0}%`,
                    backgroundColor: stat.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 레벨 & 경험치 */}
      <div
        className={cn(
          'p-6 rounded-2xl border',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              현재 레벨
            </span>
            <p className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              Lv.{stats.level || 1}
            </p>
          </div>
          <div className="text-right">
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              경험치
            </span>
            <p className={cn('text-2xl font-bold text-amber-500')}>
              {stats.experience_points || 0} XP
            </p>
          </div>
        </div>
        <div
          className={cn(
            'h-4 rounded-full overflow-hidden',
            isDark ? 'bg-zinc-700' : 'bg-zinc-200'
          )}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
            style={{ width: `${((stats.experience_points || 0) % 1000) / 10}%` }}
          />
        </div>
        <p className={cn('text-xs mt-2 text-right', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          다음 레벨까지 {1000 - ((stats.experience_points || 0) % 1000)} XP
        </p>
      </div>
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export default function AgentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
  const [agentName, setAgentName] = useState('')
  const [loading, setLoading] = useState(true)

  const agentId = params?.id as string
  const isDark = theme === 'dark'

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('deployed_agents')
          .select('name')
          .eq('id', agentId)
          .single() as { data: { name: string } | null }
        if (data) {
          setAgentName(data.name)
        }
      } catch (error) {
        console.error('Failed to fetch agent:', error)
      } finally {
        setLoading(false)
      }
    }
    if (agentId) {
      fetchAgent()
    }
  }, [agentId])

  if (loading) {
    return (
      <div
        className={cn(
          'min-h-screen flex items-center justify-center',
          isDark ? 'bg-zinc-900' : 'bg-zinc-50'
        )}
      >
        <Loader2 className="w-10 h-10 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-zinc-900' : 'bg-zinc-50')}>
      {/* 헤더 */}
      <header
        className={cn(
          'sticky top-0 z-50 border-b backdrop-blur-xl',
          isDark
            ? 'bg-zinc-900/80 border-zinc-800'
            : 'bg-white/80 border-zinc-200'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 뒤로가기 */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard-group/agents/${agentId}`)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </Button>
              <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
              <div>
                <h1
                  className={cn(
                    'text-lg font-bold',
                    isDark ? 'text-white' : 'text-zinc-900'
                  )}
                >
                  {agentName} 프로필
                </h1>
                <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  상세 정보 및 분석
                </p>
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex items-center gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-accent text-accent'
                      : cn(
                          'border-transparent',
                          isDark
                            ? 'text-zinc-400 hover:text-zinc-200'
                            : 'text-zinc-500 hover:text-zinc-700'
                        )
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <AgentProfile agentId={agentId} isDark={isDark} />
        )}

        {activeTab === 'stats' && (
          <StatsTab agentId={agentId} isDark={isDark} />
        )}

        {activeTab === 'brain' && (
          <div className="h-[calc(100vh-180px)]">
            <BrainMapLayout
              agentId={agentId}
              isDark={isDark}
            />
          </div>
        )}

        {activeTab === 'activities' && (
          <ActivitiesTab agentId={agentId} isDark={isDark} />
        )}

        {activeTab === 'relations' && (
          <RelationsTab agentId={agentId} isDark={isDark} />
        )}
      </main>
    </div>
  )
}
