'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Github,
  MessageSquare,
  Calendar,
  Link2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
  Settings,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

interface Integration {
  id: string
  type: 'github' | 'slack' | 'google_calendar'
  name: string
  connected: boolean
  connected_at?: string
  metadata?: {
    username?: string
    team_name?: string
    email?: string
    webhook_url?: string
    repos?: string[]
    channels?: string[]
  }
}

const INTEGRATIONS = [
  {
    type: 'github' as const,
    name: 'GitHub',
    description: '커밋과 이슈를 자동으로 태스크로 동기화',
    icon: Github,
    color: 'bg-zinc-700',
    features: [
      '커밋 자동 동기화',
      '이슈 → 태스크 변환',
      'PR 상태 추적',
      '브랜치 활동 모니터링'
    ]
  },
  {
    type: 'slack' as const,
    name: 'Slack',
    description: '태스크 업데이트 및 리포트 알림 전송',
    icon: MessageSquare,
    color: 'bg-[#4A154B]',
    features: [
      '태스크 변경 알림',
      '리포트 자동 공유',
      'KPI 업데이트 알림',
      '팀 멘션 지원'
    ]
  },
  {
    type: 'google_calendar' as const,
    name: 'Google Calendar',
    description: '태스크 마감일을 캘린더와 동기화',
    icon: Calendar,
    color: 'bg-accent',
    features: [
      '마감일 자동 동기화',
      '일정 충돌 알림',
      '팀 캘린더 연동',
      '미팅 자동 생성'
    ]
  }
]

export default function IntegrationsPage() {
  const { currentStartup } = useAuthStore()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  useEffect(() => {
    if (currentStartup?.id) {
      fetchIntegrations()
    }
  }, [currentStartup?.id])

  const fetchIntegrations = async () => {
    if (!currentStartup?.id) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/integrations?startup_id=${currentStartup.id}`)
      if (res.ok) {
        const data = await res.json()
        setIntegrations(data)
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const connectIntegration = async (type: string) => {
    setConnecting(type)

    try {
      // OAuth 플로우 시작
      const res = await fetch(`/api/integrations/${type}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startup_id: currentStartup?.id })
      })

      if (res.ok) {
        const { auth_url } = await res.json()
        // OAuth 페이지로 리다이렉트
        window.location.href = auth_url
      } else {
        const error = await res.json()
        alert(error.error || '연결 실패')
      }
    } catch (error) {
      console.error('Failed to connect:', error)
      alert('연결 중 오류가 발생했습니다')
    } finally {
      setConnecting(null)
    }
  }

  const disconnectIntegration = async (id: string, type: string) => {
    if (!confirm('이 연동을 해제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/integrations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setIntegrations(prev => prev.filter(i => i.id !== id))
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const getIntegrationStatus = (type: string) => {
    return integrations.find(i => i.type === type)
  }

  if (!currentStartup) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Link2 className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
          <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>스타트업을 선택해주세요</h2>
          <p className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>통합을 설정하려면 먼저 스타트업을 선택하세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>통합 설정</h1>
        <p className={`mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>외부 서비스와 연동하여 워크플로우를 자동화하세요</p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {INTEGRATIONS.map((integration, idx) => {
          const status = getIntegrationStatus(integration.type)
          const isConnected = status?.connected

          return (
            <motion.div
              key={integration.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`rounded-xl overflow-hidden border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
            >
              {/* Header */}
              <div className={`${integration.color} p-6`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <integration.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{integration.name}</h3>
                      <p className="text-xs text-white/70">{integration.description}</p>
                    </div>
                  </div>
                  {isConnected ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-green-400">연결됨</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-zinc-500/20 rounded-full">
                      <XCircle className="w-3 h-3 text-zinc-400" />
                      <span className="text-xs text-zinc-400">미연결</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Features */}
                <div className="mb-6">
                  <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>주요 기능</p>
                  <ul className="space-y-2">
                    {integration.features.map((feature, i) => (
                      <li key={i} className={`flex items-center gap-2 text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <div className="w-1 h-1 bg-accent rounded-full" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Connected Info */}
                {isConnected && status?.metadata && (
                  <div className={`mb-4 p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                    <p className={`text-xs mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>연결 정보</p>
                    {status.metadata.username && (
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>@{status.metadata.username}</p>
                    )}
                    {status.metadata.team_name && (
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{status.metadata.team_name}</p>
                    )}
                    {status.metadata.email && (
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{status.metadata.email}</p>
                    )}
                    {status.connected_at && (
                      <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {new Date(status.connected_at).toLocaleDateString('ko-KR')}에 연결됨
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => fetchIntegrations()}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                        }`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        새로고침
                      </button>
                      <button
                        onClick={() => disconnectIntegration(status!.id, integration.type)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => connectIntegration(integration.type)}
                      disabled={connecting === integration.type}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                      {connecting === integration.type ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          연결 중...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4" />
                          연결하기
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Webhook Settings */}
      <div className={`mt-8 rounded-xl p-6 border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Webhook 설정</h3>
        <p className={`text-sm mb-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          외부 서비스에서 GlowUS로 이벤트를 전송할 수 있습니다
        </p>

        <div className={`rounded-lg p-4 ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
          <p className={`text-xs mb-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className={`flex-1 px-3 py-2 rounded text-sm font-mono overflow-x-auto ${isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-white text-zinc-700 border border-zinc-200'}`}>
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/{currentStartup?.id}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/${currentStartup?.id}`)
                alert('복사되었습니다')
              }}
              className={`px-3 py-2 rounded transition-colors text-sm ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'}`}
            >
              복사
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-400">
            💡 Webhook을 사용하려면 환경 변수에 <code className={`px-1 rounded ${isDark ? 'bg-zinc-800' : 'bg-amber-500/20'}`}>WEBHOOK_SECRET</code>을 설정하세요.
          </p>
        </div>
      </div>
    </div>
  )
}
