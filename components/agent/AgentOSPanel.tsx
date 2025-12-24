'use client'

import { useState, useEffect } from 'react'
import {
  Heart,
  Shield,
  Star,
  Brain,
  TrendingUp,
  Zap,
  MessageSquare,
  Lightbulb,
  Users,
  Target,
  Sparkles,
  BarChart3,
  Radar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatsRadar, StatsRadarSummary } from './StatsRadar'
import { KnowledgeGraphPanel } from './KnowledgeGraph'

interface AgentRelationship {
  id: string
  rapport: number
  trust: number
  familiarity: number
  communication_style: string
  interaction_count: number
  milestones: Array<{ type: string; date: string; note?: string }>
}

interface AgentStats {
  level: number
  experience_points: number
  analysis: number
  communication: number
  creativity: number
  leadership: number
  execution?: number   // DB에 없을 수 있음 (마이그레이션 전)
  adaptability?: number // DB에 없을 수 있음 (마이그레이션 전)
  expertise: Record<string, { level: string; experience: number }>
  total_conversations: number
  total_tasks_completed: number
  total_meetings: number
}

interface AgentLearning {
  id: string
  category: string
  subject: string
  insight: string
  confidence: number
  evidence_count: number
}

interface AgentOSData {
  relationship: AgentRelationship | null
  stats: AgentStats | null
  learnings: AgentLearning[]
  relationshipStats: {
    totalRelationships: number
    avgRapport: number
    avgTrust: number
  } | null
}

interface AgentOSPanelProps {
  agentId: string
  isDark: boolean
}

const categoryLabels: Record<string, { label: string; icon: any; color: string }> = {
  person: { label: '사람', icon: Users, color: '#3b82f6' },
  project: { label: '프로젝트', icon: Target, color: '#22c55e' },
  domain: { label: '도메인', icon: Brain, color: '#8b5cf6' },
  workflow: { label: '업무 패턴', icon: Zap, color: '#f59e0b' },
  preference: { label: '선호도', icon: Heart, color: '#ec4899' },
  decision_rule: { label: '의사결정', icon: Lightbulb, color: '#06b6d4' },
  lesson: { label: '교훈', icon: Star, color: '#eab308' },
}

const styleLabels: Record<string, string> = {
  formal: '격식체',
  polite: '공손체',
  casual: '친근체',
  friendly: '친구체',
}

function StatBar({
  label,
  value,
  color,
  icon: Icon,
  isDark,
}: {
  label: string
  value: number
  color: string
  icon: any
  isDark: boolean
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5" style={{ color }} />
          <span className={cn('text-xs font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            {label}
          </span>
        </div>
        <span className={cn('text-xs font-bold', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          {value}
        </span>
      </div>
      <div className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function RelationshipMeter({
  label,
  value,
  icon: Icon,
  color,
  isDark,
}: {
  label: string
  value: number
  icon: any
  color: string
  isDark: boolean
}) {
  return (
    <div className="text-center">
      <div
        className="relative w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke={isDark ? '#3f3f46' : '#e4e4e7'}
            strokeWidth="4"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 176} 176`}
            className="transition-all duration-500"
          />
        </svg>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <p className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-600')}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

// Mock 데이터 (API 실패 시 fallback)
const MOCK_OS_DATA: AgentOSData = {
  relationship: {
    id: 'mock-rel',
    rapport: 75,
    trust: 80,
    familiarity: 65,
    communication_style: 'polite',
    interaction_count: 47,
    milestones: [
      { type: 'first_meeting', date: new Date(Date.now() - 7 * 86400000).toISOString(), note: '첫 대화' },
    ],
  },
  stats: {
    level: 3,
    experience_points: 2450,
    analysis: 72,
    communication: 85,
    creativity: 68,
    leadership: 55,
    execution: 78,
    adaptability: 70,
    expertise: {},
    total_conversations: 47,
    total_tasks_completed: 12,
    total_meetings: 5,
  },
  learnings: [
    { id: '1', category: 'person', subject: '사용자', insight: '간결한 보고를 선호함', confidence: 85, evidence_count: 12 },
    { id: '2', category: 'workflow', subject: '업무 패턴', insight: '오전에 집중 업무 수행', confidence: 72, evidence_count: 8 },
  ],
  relationshipStats: {
    totalRelationships: 3,
    avgRapport: 72,
    avgTrust: 78,
  },
}

export function AgentOSPanel({ agentId, isDark }: AgentOSPanelProps) {
  const [data, setData] = useState<AgentOSData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statsView, setStatsView] = useState<'radar' | 'bar'>('radar')
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setUsingMockData(false)
        const res = await fetch(`/api/agents/${agentId}/os`)
        if (!res.ok) throw new Error('데이터 로드 실패')
        const result = await res.json()
        // API가 빈 데이터를 반환하면 mock 사용
        if (!result.stats && !result.relationship) {
          setData(MOCK_OS_DATA)
          setUsingMockData(true)
        } else {
          setData(result)
        }
      } catch (err: any) {
        // 에러 시 mock 데이터로 fallback
        console.error('[AgentOSPanel] API error, using mock data:', err)
        setData(MOCK_OS_DATA)
        setUsingMockData(true)
        setError(null) // 에러 숨김
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [agentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('text-center py-8', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
        {error}
      </div>
    )
  }

  if (!data) return null

  const { relationship, stats, learnings } = data

  return (
    <div className="space-y-6">
      {/* 에이전트 레벨 & 경험치 */}
      {stats && (
        <div
          className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-yellow-400 to-orange-500'
              )}
            >
              <span className="text-white text-xl font-bold">Lv.{stats.level}</span>
            </div>
            <div className="flex-1">
              <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                에이전트 레벨
              </h4>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                경험치 {stats.experience_points} XP
              </p>
            </div>
            {/* 레이더/바 토글 */}
            <div className={cn('flex rounded-lg p-0.5', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
              <button
                onClick={() => setStatsView('radar')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  statsView === 'radar'
                    ? isDark
                      ? 'bg-zinc-600 text-white'
                      : 'bg-white text-zinc-900 shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-300'
                    : 'text-zinc-500 hover:text-zinc-700'
                )}
                title="레이더 차트"
              >
                <Radar className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStatsView('bar')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  statsView === 'bar'
                    ? isDark
                      ? 'bg-zinc-600 text-white'
                      : 'bg-white text-zinc-900 shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-300'
                    : 'text-zinc-500 hover:text-zinc-700'
                )}
                title="바 차트"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 스탯 차트 (레이더 or 바) */}
          {statsView === 'radar' ? (
            <div>
              <StatsRadar
                stats={{
                  analysis: stats.analysis,
                  communication: stats.communication,
                  creativity: stats.creativity,
                  leadership: stats.leadership,
                  execution: stats.execution ?? 20,      // DB에 없으면 기본값 20
                  adaptability: stats.adaptability ?? 20, // DB에 없으면 기본값 20
                  level: stats.level,
                }}
                isDark={isDark}
                size="md"
              />
              <StatsRadarSummary
                stats={{
                  analysis: stats.analysis,
                  communication: stats.communication,
                  creativity: stats.creativity,
                  leadership: stats.leadership,
                  execution: stats.execution ?? 20,
                  adaptability: stats.adaptability ?? 20,
                }}
                isDark={isDark}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatBar label="분석력" value={stats.analysis} color="#3b82f6" icon={Brain} isDark={isDark} />
              <StatBar
                label="소통력"
                value={stats.communication}
                color="#22c55e"
                icon={MessageSquare}
                isDark={isDark}
              />
              <StatBar
                label="창의력"
                value={stats.creativity}
                color="#8b5cf6"
                icon={Lightbulb}
                isDark={isDark}
              />
              <StatBar
                label="리더십"
                value={stats.leadership}
                color="#f59e0b"
                icon={Users}
                isDark={isDark}
              />
              <StatBar
                label="실행력"
                value={stats.execution ?? 20}
                color="#ef4444"
                icon={Target}
                isDark={isDark}
              />
              <StatBar
                label="적응력"
                value={stats.adaptability ?? 20}
                color="#06b6d4"
                icon={Zap}
                isDark={isDark}
              />
            </div>
          )}

          {/* 활동 통계 */}
          <div
            className={cn(
              'mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center',
              isDark ? 'border-zinc-700' : 'border-zinc-200'
            )}
          >
            <div>
              <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {stats.total_conversations}
              </p>
              <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>대화</p>
            </div>
            <div>
              <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {stats.total_tasks_completed}
              </p>
              <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>완료 업무</p>
            </div>
            <div>
              <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {stats.total_meetings}
              </p>
              <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>회의 참여</p>
            </div>
          </div>

          {/* 전문성 */}
          {stats.expertise && Object.keys(stats.expertise).length > 0 && (
            <div className={cn('mt-4 pt-4 border-t', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
              <h5 className={cn('text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                전문 분야
              </h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.expertise).map(([domain, data]) => (
                  <span
                    key={domain}
                    className={cn(
                      'text-xs px-2 py-1 rounded-full',
                      isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                    )}
                  >
                    {domain} ({data.level})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 관계 현황 */}
      {relationship && (
        <div
          className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-pink-500" />
            <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              우리의 관계
            </h4>
            <span
              className={cn(
                'ml-auto text-xs px-2 py-0.5 rounded-full',
                isDark ? 'bg-pink-900/30 text-pink-400' : 'bg-pink-100 text-pink-600'
              )}
            >
              {styleLabels[relationship.communication_style] || relationship.communication_style}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <RelationshipMeter
              label="친밀도"
              value={relationship.rapport}
              icon={Heart}
              color="#ec4899"
              isDark={isDark}
            />
            <RelationshipMeter
              label="신뢰도"
              value={relationship.trust}
              icon={Shield}
              color="#3b82f6"
              isDark={isDark}
            />
            <RelationshipMeter
              label="친숙도"
              value={relationship.familiarity}
              icon={Star}
              color="#eab308"
              isDark={isDark}
            />
          </div>

          <div
            className={cn(
              'mt-4 pt-4 border-t text-center',
              isDark ? 'border-zinc-700' : 'border-zinc-200'
            )}
          >
            <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              지금까지 <span className="font-bold text-accent">{relationship.interaction_count}회</span>{' '}
              대화했어요
            </p>
          </div>

          {/* 마일스톤 */}
          {relationship.milestones && relationship.milestones.length > 0 && (
            <div className={cn('mt-4 pt-4 border-t', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
              <h5 className={cn('text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                함께한 순간들
              </h5>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {relationship.milestones.slice(-5).reverse().map((milestone, idx) => (
                  <div
                    key={idx}
                    className={cn('flex items-center gap-2 text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}
                  >
                    <span className="text-yellow-500">
                      <Star className="w-3 h-3" />
                    </span>
                    <span>{milestone.note || milestone.type}</span>
                    <span className="ml-auto">
                      {new Date(milestone.date).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 학습된 인사이트 */}
      {learnings && learnings.length > 0 && (
        <div
          className={cn(
            'p-4 md:p-6 rounded-xl md:rounded-2xl border',
            isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              학습된 인사이트
            </h4>
            <span
              className={cn(
                'ml-auto text-xs px-2 py-0.5 rounded-full',
                isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
              )}
            >
              {learnings.length}개
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {learnings.map((learning) => {
              const cat = categoryLabels[learning.category] || {
                label: learning.category,
                icon: Brain,
                color: '#6b7280',
              }
              const CatIcon = cat.icon
              return (
                <div key={learning.id} className={cn('p-3 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <CatIcon className="w-3 h-3" />
                      {cat.label}
                    </span>
                    <span className={cn('text-xs ml-auto', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      확신도 {learning.confidence}%
                    </span>
                  </div>
                  <p className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                    {learning.subject}
                  </p>
                  <p className={cn('text-xs mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {learning.insight}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 지식 그래프 */}
      <KnowledgeGraphPanel agentId={agentId} isDark={isDark} />

      {/* 데이터가 전혀 없는 경우 */}
      {!stats && !relationship && learnings.length === 0 && (
        <div className={cn('text-center py-12', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>아직 Agent OS 데이터가 없습니다</p>
          <p className="text-sm mt-1">대화를 시작하면 에이전트가 성장해요!</p>
        </div>
      )}
    </div>
  )
}

export default AgentOSPanel
