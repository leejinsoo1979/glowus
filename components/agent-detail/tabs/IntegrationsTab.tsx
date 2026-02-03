'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { getAppLogo } from '@/components/icons/app-logos'
import {
  FolderOpen,
  Link2,
  Loader2,
  Plus,
  X,
  ExternalLink,
  MessageCircle,
} from 'lucide-react'

// Types
interface AppProvider {
  id: string
  name: string
  description: string
  icon_url: string
  auth_type: 'oauth2' | 'api_key' | 'webhook'
  oauth_config?: Record<string, any>
  capabilities: Record<string, boolean>
}

interface UserConnection {
  id: string
  provider_id: string
  status: string
  account_info?: {
    name?: string
    email?: string
    avatar_url?: string
    team_name?: string
  }
  created_at: string
  app_providers?: AppProvider
}

interface AgentConnection {
  id: string
  agent_id: string
  user_connection_id: string
  is_active: boolean
  user_app_connections?: UserConnection
}

interface IntegrationsTabProps {
  agentId: string
  isDark: boolean
}

export function IntegrationsTab({ agentId, isDark }: IntegrationsTabProps) {
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<AppProvider[]>([])
  const [userConnections, setUserConnections] = useState<UserConnection[]>([])
  const [agentConnections, setAgentConnections] = useState<AgentConnection[]>([])
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<UserConnection | null>(null)
  const [resources, setResources] = useState<any[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [syncingResource, setSyncingResource] = useState<string | null>(null)

  // API Key / Webhook 모달 상태
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<AppProvider | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [webhookUrlInput, setWebhookUrlInput] = useState('')
  const [chatIdInput, setChatIdInput] = useState('')
  const [savingApiKey, setSavingApiKey] = useState(false)

  // 연결 해제 확인 모달
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [disconnectTargetId, setDisconnectTargetId] = useState<string | null>(null)
  const [disconnectTargetName, setDisconnectTargetName] = useState<string>('')
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    loadIntegrations()
  }, [agentId])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}/integrations`)
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers || [])
        setUserConnections(data.userConnections || [])
        setAgentConnections(data.agentConnections || [])
      }
    } catch (err) {
      console.error('Failed to load integrations:', err)
    } finally {
      setLoading(false)
    }
  }

  const startOAuth = async (providerId: string) => {
    try {
      setConnectingProvider(providerId)
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_oauth', providerId }),
      })

      if (res.ok) {
        const { authUrl } = await res.json()
        window.location.href = authUrl
      }
    } catch (err) {
      console.error('OAuth start failed:', err)
    } finally {
      setConnectingProvider(null)
    }
  }

  // API Key 또는 Webhook 연결 시작
  const startApiKeyConnect = (provider: AppProvider) => {
    setSelectedProvider(provider)
    setApiKeyInput('')
    setWebhookUrlInput('')
    setChatIdInput('')
    setShowApiKeyModal(true)
  }

  // API Key / Webhook 저장
  const saveApiKeyConnection = async () => {
    if (!selectedProvider) return

    try {
      setSavingApiKey(true)

      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect_api_key',
          providerId: selectedProvider.id,
          apiKey: apiKeyInput || undefined,
          webhookUrl: webhookUrlInput || undefined,
          chatId: chatIdInput || undefined,
        }),
      })

      if (res.ok) {
        setShowApiKeyModal(false)
        await loadIntegrations()
      } else {
        const error = await res.json()
        alert(error.error || '연결 실패')
      }
    } catch (err) {
      console.error('API Key connect failed:', err)
      alert('연결 중 오류가 발생했습니다')
    } finally {
      setSavingApiKey(false)
    }
  }

  // 프로바이더 연결 핸들러 (auth_type에 따라 분기)
  const handleProviderConnect = (provider: AppProvider) => {
    if (provider.auth_type === 'oauth2') {
      startOAuth(provider.id)
    } else {
      startApiKeyConnect(provider)
    }
  }

  const connectToAgent = async (userConnectionId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_to_agent', userConnectionId }),
      })

      if (res.ok) {
        await loadIntegrations()
      }
    } catch (err) {
      console.error('Connect to agent failed:', err)
    }
  }

  const openDisconnectModal = (connectionId: string, providerName: string) => {
    setDisconnectTargetId(connectionId)
    setDisconnectTargetName(providerName)
    setShowDisconnectModal(true)
  }

  const disconnectFromAgent = async () => {
    if (!disconnectTargetId) return

    try {
      setDisconnecting(true)
      const res = await fetch(`/api/agents/${agentId}/integrations?connectionId=${disconnectTargetId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await loadIntegrations()
        setShowDisconnectModal(false)
        setDisconnectTargetId(null)
      }
    } catch (err) {
      console.error('Disconnect failed:', err)
    } finally {
      setDisconnecting(false)
    }
  }

  const browseResources = async (connection: UserConnection) => {
    setSelectedConnection(connection)
    setShowResourceModal(true)
    setResourcesLoading(true)

    try {
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_resources',
          userConnectionId: connection.id,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResources(data.resources || [])
      }
    } catch (err) {
      console.error('Failed to load resources:', err)
    } finally {
      setResourcesLoading(false)
    }
  }

  const syncResource = async (resource: any) => {
    const agentConn = agentConnections.find(
      (c) => c.user_connection_id === selectedConnection?.id
    )
    if (!agentConn) {
      alert('먼저 이 앱을 에이전트에 연결해주세요')
      return
    }

    try {
      setSyncingResource(resource.id)
      const res = await fetch(`/api/agents/${agentId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_resource',
          agentConnectionId: agentConn.id,
          resourceId: resource.id,
          resourceName: resource.name,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          alert(`"${resource.name}"이(가) 지식베이스에 추가되었습니다!`)
        } else {
          alert(result.error || '동기화 실패')
        }
      }
    } catch (err) {
      console.error('Sync failed:', err)
      alert('동기화 중 오류가 발생했습니다')
    } finally {
      setSyncingResource(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const connectedProviderIds = userConnections.map((c) => c.provider_id)
  const agentConnectedIds = agentConnections.map((c) => c.user_connection_id)

  return (
    <div className="space-y-6">
      {/* 연결된 앱 */}
      <div>
        <h3 className={cn('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          연결된 앱
        </h3>

        {userConnections.length === 0 ? (
          <div
            className={cn(
              'text-center py-8 rounded-xl border-2 border-dashed',
              isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
            )}
          >
            <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>연결된 앱이 없습니다</p>
            <p className="text-sm mt-1">아래에서 앱을 연결해보세요</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {userConnections.map((conn) => {
              const isConnectedToAgent = agentConnectedIds.includes(conn.id)
              const provider = providers.find((p) => p.id === conn.provider_id)

              return (
                <div
                  key={conn.id}
                  className={cn(
                    'flex items-center justify-between p-4 rounded-xl border',
                    isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {getAppLogo(conn.provider_id, { size: 32 }) || <Link2 className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div>
                      <div className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {provider?.name || conn.provider_id}
                      </div>
                      <div className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {conn.account_info?.email ||
                          conn.account_info?.name ||
                          conn.account_info?.team_name ||
                          '연결됨'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnectedToAgent ? (
                      <>
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-500 rounded-full">
                          연결됨
                        </span>
                        {/* 메시징 앱: 웹 버전 열기 */}
                        {conn.provider_id === 'telegram-bot' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open('https://web.telegram.org', '_blank')}
                            className="text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            실행
                          </Button>
                        )}
                        {conn.provider_id === 'discord' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open('https://discord.com/app', '_blank')}
                            className="text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            실행
                          </Button>
                        )}
                        {conn.provider_id === 'whatsapp' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open('https://web.whatsapp.com', '_blank')}
                            className="text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            실행
                          </Button>
                        )}
                        {conn.provider_id === 'microsoft-teams' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open('https://teams.microsoft.com', '_blank')}
                            className="text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            실행
                          </Button>
                        )}
                        {conn.provider_id === 'slack' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open('https://app.slack.com', '_blank')}
                            className="text-blue-500"
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            실행
                          </Button>
                        )}
                        {/* 파일 탐색이 가능한 앱만 찾아보기 버튼 표시 */}
                        {!['telegram-bot', 'discord', 'whatsapp', 'microsoft-teams', 'slack'].includes(conn.provider_id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => browseResources(conn)}
                            className="text-blue-500"
                          >
                            <FolderOpen className="w-4 h-4 mr-1" />
                            찾아보기
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const agentConn = agentConnections.find(
                              (c) => c.user_connection_id === conn.id
                            )
                            if (agentConn) openDisconnectModal(agentConn.id, provider?.name || conn.provider_id)
                          }}
                          className="text-red-500"
                        >
                          해제
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => connectToAgent(conn.id)}
                        className="text-blue-500"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        에이전트에 연결
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 앱 추가 */}
      <div>
        <h3 className={cn('text-lg font-semibold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          앱 추가
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {providers.map((provider) => {
            const isConnected = connectedProviderIds.includes(provider.id)
            const isConnecting = connectingProvider === provider.id

            return (
              <button
                key={provider.id}
                onClick={() => !isConnected && !isConnecting && handleProviderConnect(provider)}
                disabled={isConnected || isConnecting}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                  isDark
                    ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                    : 'bg-white border-gray-200 hover:bg-gray-50',
                  isConnected && 'opacity-50 cursor-not-allowed',
                  isConnecting && 'animate-pulse'
                )}
              >
                <div className="w-10 h-10 flex items-center justify-center">
                  {getAppLogo(provider.id, { size: 40 }) || <Link2 className="w-8 h-8 text-gray-400" />}
                </div>
                <span className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                  {provider.name}
                </span>
                <div className="flex items-center gap-1">
                  {isConnected ? (
                    <span className="text-xs text-green-500">연결됨</span>
                  ) : isConnecting ? (
                    <span className="text-xs text-blue-500">연결 중...</span>
                  ) : (
                    <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      연결하기
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* API Key / Webhook 연결 모달 */}
      {showApiKeyModal && selectedProvider && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className={cn(
              'w-full max-w-sm rounded-2xl shadow-2xl',
              isDark ? 'bg-[#1a1a2e]' : 'bg-white'
            )}
          >
            {/* 헤더 */}
            <div className="relative p-6 pb-4">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className={cn(
                  'absolute top-4 right-4 p-1.5 rounded-full transition-colors',
                  isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                )}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 mb-3 flex items-center justify-center">
                  {getAppLogo(selectedProvider.id, { size: 56 })}
                </div>
                <h3 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  {selectedProvider.name} 연결
                </h3>
              </div>
            </div>

            {/* 폼 */}
            <div className="px-6 pb-2 space-y-4">
              {/* Telegram Bot */}
              {selectedProvider.id === 'telegram-bot' && (
                <>
                  <div>
                    <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      봇 토큰
                    </label>
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="@BotFather에서 발급받은 토큰"
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl text-sm transition-colors',
                        isDark
                          ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:bg-white/10'
                          : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Chat ID <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>(선택)</span>
                    </label>
                    <input
                      type="text"
                      value={chatIdInput}
                      onChange={(e) => setChatIdInput(e.target.value)}
                      placeholder="메시지를 보낼 채팅방 ID"
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl text-sm transition-colors',
                        isDark
                          ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:bg-white/10'
                          : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white'
                      )}
                    />
                  </div>
                </>
              )}

              {/* Discord Webhook */}
              {selectedProvider.id === 'discord' && (
                <div>
                  <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className={cn(
                      'w-full px-3 py-2.5 rounded-xl text-sm transition-colors',
                      isDark
                        ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:bg-white/10'
                        : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white'
                    )}
                  />
                  <p className={cn('text-xs mt-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    채널 설정 → 연동 → 웹후크
                  </p>
                </div>
              )}

              {/* WhatsApp */}
              {selectedProvider.id === 'whatsapp' && (
                <>
                  <div>
                    <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="123456789012345"
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl text-sm transition-colors',
                        isDark
                          ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:bg-white/10'
                          : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Access Token
                    </label>
                    <input
                      type="password"
                      value={webhookUrlInput}
                      onChange={(e) => setWebhookUrlInput(e.target.value)}
                      placeholder="EAAG..."
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl text-sm transition-colors',
                        isDark
                          ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:bg-white/10'
                          : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white'
                      )}
                    />
                  </div>
                </>
              )}

              {/* Microsoft Teams */}
              {selectedProvider.id === 'microsoft-teams' && (
                <div>
                  <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    placeholder="https://outlook.office.com/webhook/..."
                    className={cn(
                      'w-full px-3 py-2.5 rounded-xl text-sm transition-colors',
                      isDark
                        ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:bg-white/10'
                        : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white'
                    )}
                  />
                  <p className={cn('text-xs mt-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    Teams 채널 → 커넥터 → Incoming Webhook
                  </p>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="p-6 pt-4 space-y-2">
              <Button
                onClick={saveApiKeyConnection}
                disabled={savingApiKey || (
                  selectedProvider.id === 'telegram-bot' ? !apiKeyInput :
                  selectedProvider.id === 'discord' ? !webhookUrlInput :
                  selectedProvider.id === 'whatsapp' ? (!apiKeyInput || !webhookUrlInput) :
                  selectedProvider.id === 'microsoft-teams' ? !webhookUrlInput :
                  false
                )}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {savingApiKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '연결하기'
                )}
              </Button>

              {selectedProvider.oauth_config?.setup_url && (
                <a
                  href={selectedProvider.oauth_config.setup_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center justify-center gap-1.5 w-full py-2 text-xs rounded-xl transition-colors',
                    isDark ? 'text-gray-400 hover:text-gray-300 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <ExternalLink className="w-3 h-3" />
                  설정 가이드
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 연결 해제 확인 모달 */}
      {showDisconnectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div
            className={cn(
              'w-full max-w-xs rounded-2xl shadow-2xl p-6',
              isDark ? 'bg-[#1a1a2e]' : 'bg-white'
            )}
          >
            <div className="text-center">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
                isDark ? 'bg-red-500/20' : 'bg-red-100'
              )}>
                <X className="w-6 h-6 text-red-500" />
              </div>
              <h3 className={cn('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                연결을 해제할까요?
              </h3>
              <p className={cn('text-sm mb-6', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {disconnectTargetName} 연결이 해제됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDisconnectModal(false)
                  setDisconnectTargetId(null)
                }}
                className="flex-1"
                disabled={disconnecting}
              >
                취소
              </Button>
              <Button
                onClick={disconnectFromAgent}
                disabled={disconnecting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : '해제'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 리소스 브라우저 모달 */}
      {showResourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className={cn(
              'w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between p-4 border-b',
                isDark ? 'border-gray-700' : 'border-gray-200'
              )}
            >
              <h3 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                <span className="flex items-center gap-2">
                  {getAppLogo(selectedConnection?.provider_id || '', { size: 24 })} 파일 선택
                </span>
              </h3>
              <button
                onClick={() => setShowResourceModal(false)}
                className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {resourcesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : resources.length === 0 ? (
                <div className={cn('text-center py-8', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  파일을 찾을 수 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {resources.map((resource) => (
                    <div
                      key={resource.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {resource.type === 'folder'
                            ? '📁'
                            : resource.type === 'repo'
                              ? '📦'
                              : resource.type === 'page'
                                ? '📄'
                                : resource.type === 'channel'
                                  ? '💬'
                                  : '📄'}
                        </span>
                        <div>
                          <div className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            {resource.name}
                          </div>
                          {resource.metadata?.description && (
                            <div
                              className={cn(
                                'text-xs truncate max-w-[300px]',
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              )}
                            >
                              {resource.metadata.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {resource.type !== 'folder' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncResource(resource)}
                          disabled={syncingResource === resource.id}
                          className="text-blue-500"
                        >
                          {syncingResource === resource.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-1" />
                              지식베이스에 추가
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
