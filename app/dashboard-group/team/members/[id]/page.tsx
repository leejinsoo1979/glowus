'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  MessageCircle,
  Mail,
  Bot,
  Sparkles,
  Cpu,
  Zap,
  Settings,
  Play,
  Loader2,
  GitCommit,
  CheckCircle2,
  Clock,
  Flame,
  Activity,
  Wand2,
  Plug,  // 🔥 react-icons 제거
} from 'lucide-react'

// 🔥 react-icons → lucide-react 별칭
const PiPlugs = Plug
import { cn } from '@/lib/utils'
import { MemberProfileSidebar, MemberProfileData } from '@/components/team/MemberProfileSidebar'
import { MemberAboutSection, MemberAboutData } from '@/components/team/MemberAboutSection'
import { useThemeStore, accentColors } from '@/stores/themeStore'

interface AgentData {
  id: string
  name: string
  description: string
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT'
  capabilities: string[]
  avatar_url?: string
  system_prompt?: string
  model?: string
  temperature?: number
  workflow_nodes?: any[]
  workflow_edges?: any[]
  created_at: string
  updated_at?: string
}

// 로봇 아바타 URL 생성
function generateRobotAvatar(name: string): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=3B82F6,10B981,F59E0B,EF4444,8B5CF6,EC4899`
}

function getAgentAvatarUrl(agent: AgentData): string {
  if (!agent.avatar_url || agent.avatar_url.includes('ui-avatars.com')) {
    return generateRobotAvatar(agent.name)
  }
  return agent.avatar_url
}

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const memberId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isAgent, setIsAgent] = useState(false)
  const [agentData, setAgentData] = useState<AgentData | null>(null)
  const [memberData, setMemberData] = useState<{ profile: MemberProfileData; about: MemberAboutData } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      // 먼저 에이전트인지 확인
      try {
        const agentRes = await fetch(`/api/agents/${memberId}`)
        if (agentRes.ok) {
          const agent = await agentRes.json()
          setAgentData(agent)
          setIsAgent(true)
          setIsLoading(false)
          return
        }
      } catch (e) {
        // 에이전트가 아님, 멤버로 시도
      }

      // 멤버 데이터 조회 시도 (현재는 더미 데이터 사용)
      // TODO: 실제 멤버 API 구현 후 연동
      const dummyMember = getDummyMemberData(memberId)
      if (dummyMember) {
        setMemberData(dummyMember)
        setIsAgent(false)
      } else {
        setError('멤버를 찾을 수 없습니다')
      }

      setIsLoading(false)
    }

    fetchData()
  }, [memberId])

  // 에이전트가 기능 구현이 되어있는지 확인
  const isAgentImplemented = (agent: AgentData): boolean => {
    // workflow_nodes가 있고 start 노드 외에 다른 노드가 있으면 구현됨으로 간주
    if (!agent.workflow_nodes || agent.workflow_nodes.length <= 1) {
      return false
    }
    // system_prompt가 기본값이 아닌 경우
    if (agent.system_prompt && agent.system_prompt.length > 100) {
      return true
    }
    return agent.workflow_nodes.length > 2
  }

  // 테마 색상 가져오기
  const getAccentColor = () => mounted ? currentAccent.color : '#8b5cf6'

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className={cn(
            'text-2xl font-bold mb-4',
            isDark ? 'text-white' : 'text-zinc-900'
          )}>
            {error}
          </h1>
          <button
            onClick={() => router.back()}
            className="text-accent hover:underline"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  // 에이전트 프로필 렌더링
  if (isAgent && agentData) {
    const implemented = isAgentImplemented(agentData)
    const accentColorValue = getAccentColor()

    return (
      <div className="min-h-screen p-6">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">팀원 목록으로 돌아가기</span>
        </motion.button>

        {/* Agent Profile */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col lg:flex-row gap-6"
        >
          {/* Agent Sidebar */}
          <div className="w-full lg:w-[35%] lg:min-w-[320px] lg:max-w-[400px]">
            <div className={cn(
              "rounded-2xl border p-6",
              isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <div
                    className="w-28 h-28 rounded-2xl overflow-hidden ring-4 bg-zinc-100 dark:bg-zinc-800"
                    style={{ '--tw-ring-color': `${accentColorValue}33` } as React.CSSProperties}
                  >
                    <img
                      src={getAgentAvatarUrl(agentData)}
                      alt={agentData.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 w-8 h-8 rounded-lg flex items-center justify-center",
                    agentData.status === 'ACTIVE'
                      ? "bg-green-500"
                      : agentData.status === 'DRAFT'
                        ? "bg-yellow-500"
                        : "bg-zinc-500"
                  )}>
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>

                <h2 className={cn(
                  "text-2xl font-bold mb-1",
                  isDark ? "text-white" : "text-zinc-900"
                )}>
                  {agentData.name}
                </h2>

                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${accentColorValue}1a`,
                    color: accentColorValue
                  }}
                >
                  AI 에이전트
                </span>
              </div>

              {/* Status */}
              <div className={cn(
                "p-4 rounded-xl mb-4",
                isDark ? "bg-zinc-800" : "bg-zinc-100"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-500">상태</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    agentData.status === 'ACTIVE'
                      ? "bg-green-500/10 text-green-500"
                      : agentData.status === 'DRAFT'
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-zinc-500/10 text-zinc-500"
                  )}>
                    {agentData.status === 'ACTIVE' ? '활성' : agentData.status === 'DRAFT' ? '초안' : '비활성'}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-500">모델</span>
                  <span className={cn(
                    "text-sm font-medium",
                    isDark ? "text-white" : "text-zinc-900"
                  )}>
                    {agentData.model || 'GPT-4'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">생성일</span>
                  <span className={cn(
                    "text-sm",
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  )}>
                    {new Date(agentData.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>

              {/* Capabilities */}
              {agentData.capabilities && agentData.capabilities.length > 0 && (
                <div>
                  <h4 className={cn(
                    "text-sm font-medium mb-3",
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  )}>
                    능력
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {agentData.capabilities
                      .filter(cap => !cap.startsWith('team:'))
                      .map((cap, i) => (
                        <span
                          key={i}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-sm",
                            isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700"
                          )}
                        >
                          {cap}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className={cn(
              "rounded-2xl border overflow-hidden",
              isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              {/* 기능 미구현 상태 */}
              {!implemented ? (
                <div className="p-8 md:p-12">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center text-center"
                  >
                    {/* Animated Icon */}
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="w-32 h-32 rounded-3xl flex items-center justify-center mb-8 border-2 border-dashed"
                      style={{
                        background: `linear-gradient(to bottom right, ${accentColorValue}33, ${accentColorValue}1a, ${accentColorValue}33)`,
                        borderColor: `${accentColorValue}4d`
                      }}
                    >
                      <Wand2 className="w-16 h-16" style={{ color: accentColorValue }} />
                    </motion.div>

                    <h3 className={cn(
                      "text-3xl font-bold mb-4",
                      isDark ? "text-white" : "text-zinc-900"
                    )}>
                      에이전트에게 생명을 불어넣어주세요
                    </h3>

                    <p className={cn(
                      "text-lg mb-8 max-w-md",
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    )}>
                      아직 {agentData.name}의 워크플로우가 설정되지 않았습니다.
                      <br />
                      에이전트 빌더에서 능력을 부여해보세요.
                    </p>

                    {/* Features Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-8">
                      {[
                        { icon: Cpu, label: '워크플로우 설계', desc: '노드 기반 로직 구성' },
                        { icon: Sparkles, label: '프롬프트 설정', desc: 'AI 성격 및 역할 정의' },
                        { icon: Zap, label: '도구 연결', desc: 'API 및 기능 통합' },
                      ].map((feature, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                          className={cn(
                            "p-4 rounded-xl text-left",
                            isDark ? "bg-zinc-800/50" : "bg-zinc-50"
                          )}
                        >
                          <feature.icon
                            className="w-8 h-8 mb-2"
                            style={{ color: accentColorValue }}
                          />
                          <h4 className={cn(
                            "font-semibold mb-1",
                            isDark ? "text-white" : "text-zinc-900"
                          )}>
                            {feature.label}
                          </h4>
                          <p className="text-sm text-zinc-500">
                            {feature.desc}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    {/* Action Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push(`/agent-builder/${agentData.id}`)}
                      className="px-8 py-4 rounded-2xl font-semibold text-white flex items-center gap-3"
                      style={{
                        backgroundColor: accentColorValue,
                        boxShadow: `0 10px 25px -5px ${accentColorValue}40`
                      }}
                    >
                      <PiPlugs className="w-5 h-5" />
                      에이전트 빌더 열기
                    </motion.button>
                  </motion.div>
                </div>
              ) : (
                /* 기능 구현된 에이전트 */
                <div className="p-6 md:p-8">
                  {/* Description */}
                  <div className="mb-8">
                    <h3 className={cn(
                      "text-lg font-semibold mb-3",
                      isDark ? "text-white" : "text-zinc-900"
                    )}>
                      소개
                    </h3>
                    <p className={cn(
                      "leading-relaxed",
                      isDark ? "text-zinc-400" : "text-zinc-600"
                    )}>
                      {agentData.description || '설명이 없습니다.'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                      { icon: GitCommit, label: '처리한 작업', value: '0' },
                      { icon: CheckCircle2, label: '완료율', value: '-' },
                      { icon: Clock, label: '평균 응답', value: '-' },
                      { icon: Flame, label: '연속 활동', value: '0일' },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className={cn(
                          "p-4 rounded-xl",
                          isDark ? "bg-zinc-800" : "bg-zinc-100"
                        )}
                      >
                        <stat.icon
                          className="w-5 h-5 mb-2"
                          style={{ color: accentColorValue }}
                        />
                        <div className={cn(
                          "text-2xl font-bold",
                          isDark ? "text-white" : "text-zinc-900"
                        )}>
                          {stat.value}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className={cn(
                    "flex items-center gap-3 pt-6 border-t",
                    isDark ? "border-zinc-800" : "border-zinc-200"
                  )}>
                    <button
                      onClick={() => router.push(`/agent-builder/${agentData.id}`)}
                      className="flex-1 px-4 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: accentColorValue }}
                    >
                      <Settings className="w-5 h-5" />
                      설정 수정
                    </button>
                    <button className={cn(
                      "px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors",
                      isDark
                        ? "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    )}>
                      <MessageCircle className="w-5 h-5" />
                      대화하기
                    </button>
                    <button className={cn(
                      "px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors",
                      "bg-green-500 text-white hover:bg-green-600"
                    )}>
                      <Play className="w-5 h-5" />
                      실행
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  // 일반 멤버 프로필 렌더링
  if (memberData) {
    return (
      <div className="min-h-screen p-6">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">팀원 목록으로 돌아가기</span>
        </motion.button>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col lg:flex-row lg:items-stretch gap-6"
        >
          {/* Profile Sidebar */}
          <div className="w-full lg:w-[35%] lg:min-w-[320px] lg:max-w-[400px] lg:h-auto">
            <MemberProfileSidebar data={memberData.profile} className="lg:h-full" />
          </div>

          {/* Main Section */}
          <main className={cn(
            'flex-1 rounded-xl md:rounded-2xl border overflow-hidden',
            isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
          )}>
            <div className="p-6 md:p-8">
              <MemberAboutSection data={memberData.about} />

              {/* Action Buttons */}
              <div className={cn(
                'flex items-center gap-3 mt-8 pt-8 border-t',
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              )}>
                <button className={cn(
                  "flex-1 px-4 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2",
                  "bg-accent hover:opacity-90 transition-opacity"
                )}>
                  <MessageCircle className="w-5 h-5" />
                  메시지 보내기
                </button>
                <button className={cn(
                  "px-4 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors",
                  isDark
                    ? 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                    : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                )}>
                  <Mail className="w-5 h-5" />
                  이메일
                </button>
              </div>
            </div>
          </main>
        </motion.div>
      </div>
    )
  }

  return null
}

// 더미 멤버 데이터 (나중에 API로 대체)
function getDummyMemberData(memberId: string): { profile: MemberProfileData; about: MemberAboutData } | null {
  const dummyData: Record<string, { profile: MemberProfileData; about: MemberAboutData }> = {
    '1': {
      profile: {
        id: '1',
        name: '김진수',
        title: 'CEO',
        email: 'jinsu@example.com',
        phone: '010-1234-5678',
        location: '서울, 대한민국',
        joinedAt: '2024년 3월',
        isOnline: true,
        avatarGradient: 'from-violet-500 to-purple-600',
        social: {
          github: 'https://github.com',
          twitter: 'https://twitter.com',
          linkedin: 'https://linkedin.com',
        },
      },
      about: {
        bio: [
          '스타트업의 비전을 현실로 만드는 열정적인 창업가입니다.',
          '팀을 이끌며 지속 가능한 성장을 추구합니다.',
        ],
        role: 'admin',
        skills: ['리더십', '전략', '비즈니스', '투자 유치', '팀 빌딩'],
        stats: { commits: 156, tasksCompleted: 89, hoursWorked: 420, streak: 21 },
      },
    },
  }
  return dummyData[memberId] || null
}
