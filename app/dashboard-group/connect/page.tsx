'use client'

import { useState } from 'react'
import { Plus, Key, CheckCircle, XCircle, ExternalLink, Link2 } from 'lucide-react'

// 🔥 react-icons 제거 - lucide-react로 통일
const GrConnect = Link2
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// 기본 커넥터 목록
const defaultConnectors = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, DALL-E, Whisper API 연동',
    icon: '🤖',
    category: 'AI',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: '메시지 전송, 채널 관리',
    icon: '💬',
    category: 'Communication',
    fields: [{ key: 'botToken', label: 'Bot Token', type: 'password' }],
  },
  {
    id: 'notion',
    name: 'Notion',
    description: '페이지, 데이터베이스 연동',
    icon: '📝',
    category: 'Productivity',
    fields: [{ key: 'apiKey', label: 'Integration Token', type: 'password' }],
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gmail, Drive, Calendar, Sheets',
    icon: '🔵',
    category: 'Productivity',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '저장소, 이슈, PR 관리',
    icon: '🐙',
    category: 'Development',
    fields: [{ key: 'token', label: 'Personal Access Token', type: 'password' }],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: '봇 메시지, 서버 관리',
    icon: '🎮',
    category: 'Communication',
    fields: [{ key: 'botToken', label: 'Bot Token', type: 'password' }],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude API 연동',
    icon: '🧠',
    category: 'AI',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'password' }],
  },
  {
    id: 'custom',
    name: 'Custom API',
    description: '사용자 정의 REST API',
    icon: '🔧',
    category: 'Custom',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'text' },
      { key: 'apiKey', label: 'API Key (optional)', type: 'password' },
    ],
  },
]

export default function ConnectPage() {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null)
  const [connectedServices, setConnectedServices] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<Record<string, string>>({})

  const handleConnect = (connectorId: string) => {
    // TODO: 실제 연결 로직 구현
    setConnectedServices(prev => new Set([...prev, connectorId]))
    setSelectedConnector(null)
    setFormData({})
  }

  const handleDisconnect = (connectorId: string) => {
    setConnectedServices(prev => {
      const next = new Set(prev)
      next.delete(connectorId)
      return next
    })
  }

  const categories = [...new Set(defaultConnectors.map(c => c.category))]

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-600/20 rounded-xl">
          <GrConnect className="w-8 h-8 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">커넥트</h1>
          <p className="text-zinc-400">외부 서비스와 API를 연결하세요</p>
        </div>
      </div>

      {/* Connected Services Summary */}
      {connectedServices.size > 0 && (
        <div className="mb-8 p-4 bg-green-900/20 border border-green-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="font-medium text-green-400">
              {connectedServices.size}개 서비스 연결됨
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[...connectedServices].map(id => {
              const connector = defaultConnectors.find(c => c.id === id)
              return connector ? (
                <span key={id} className="px-3 py-1 bg-green-900/30 rounded-full text-sm">
                  {connector.icon} {connector.name}
                </span>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Connectors by Category */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-300 mb-4">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {defaultConnectors
              .filter(c => c.category === category)
              .map(connector => {
                const isConnected = connectedServices.has(connector.id)
                const isSelected = selectedConnector === connector.id

                return (
                  <div
                    key={connector.id}
                    className={cn(
                      'p-4 rounded-xl border transition-all cursor-pointer',
                      isConnected
                        ? 'bg-green-900/20 border-green-700'
                        : isSelected
                        ? 'bg-indigo-900/30 border-indigo-600'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    )}
                    onClick={() => !isConnected && setSelectedConnector(connector.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-3xl">{connector.icon}</span>
                      {isConnected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDisconnect(connector.id)
                          }}
                          className="p-1.5 bg-red-600/20 hover:bg-red-600/40 rounded-lg transition"
                        >
                          <XCircle className="w-4 h-4 text-red-400" />
                        </button>
                      ) : (
                        <Key className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                    <h3 className="font-semibold mb-1">{connector.name}</h3>
                    <p className="text-sm text-zinc-400 mb-3">{connector.description}</p>

                    {isConnected ? (
                      <div className="flex items-center gap-1 text-sm text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        연결됨
                      </div>
                    ) : isSelected ? (
                      <div className="space-y-3 mt-4 pt-4 border-t border-zinc-700">
                        {connector.fields.map(field => (
                          <div key={field.key}>
                            <label className="block text-xs text-zinc-400 mb-1">
                              {field.label}
                            </label>
                            <input
                              type={field.type}
                              value={formData[field.key] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                [field.key]: e.target.value
                              }))}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                              placeholder={`Enter ${field.label}`}
                            />
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleConnect(connector.id)
                            }}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                          >
                            연결
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedConnector(null)
                              setFormData({})
                            }}
                            className="bg-zinc-700 hover:bg-zinc-600"
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedConnector(connector.id)
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        연결하기
                      </Button>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
