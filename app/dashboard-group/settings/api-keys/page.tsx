'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Star,
  ExternalLink,
  Copy,
  CheckCircle,
  Sparkles,
  Bot,
  Zap,
} from 'lucide-react'

interface LLMKey {
  id: string
  provider: string
  display_name: string
  api_key: string
  is_default: boolean
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

interface LLMProvider {
  id: string
  name: string
  models: string[]
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'from-emerald-500 to-teal-600',
  anthropic: 'from-orange-500 to-amber-600',
  google: 'from-blue-500 to-indigo-600',
  xai: 'from-gray-600 to-gray-800',
  mistral: 'from-purple-500 to-violet-600',
  groq: 'from-pink-500 to-rose-600',
}

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🤖',
  anthropic: '🧠',
  google: '✨',
  xai: '⚡',
  mistral: '🌀',
  groq: '🚀',
}

const PROVIDER_DOCS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/app/apikey',
  xai: 'https://console.x.ai/',
  mistral: 'https://console.mistral.ai/api-keys/',
  groq: 'https://console.groq.com/keys',
}

export default function APIKeysSettingsPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [keys, setKeys] = useState<LLMKey[]>([])
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingKey, setEditingKey] = useState<LLMKey | null>(null)

  // Add form state
  const [newProvider, setNewProvider] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    fetchKeys()
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  const fetchKeys = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/user/llm-keys')
      if (res.ok) {
        const data = await res.json()
        setKeys(data.keys || [])
        setProviders(data.providers || [])
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddKey = async () => {
    if (!newProvider || !newApiKey) {
      setError('제공자와 API 키를 입력해주세요')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/user/llm-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          api_key: newApiKey,
          display_name: newDisplayName || `${newProvider} API Key`,
          is_default: isDefault,
        }),
      })

      if (res.ok) {
        await fetchKeys()
        setShowAddModal(false)
        resetForm()
      } else {
        const data = await res.json()
        setError(data.error || '키 추가 실패')
      }
    } catch (err) {
      setError('키 추가 중 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteKey = async (id: string) => {
    if (!confirm('이 API 키를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/user/llm-keys?id=${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete key:', err)
    }
  }

  const handleSetDefault = async (key: LLMKey) => {
    try {
      const res = await fetch('/api/user/llm-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: key.id,
          is_default: true,
        }),
      })

      if (res.ok) {
        await fetchKeys()
      }
    } catch (err) {
      console.error('Failed to set default:', err)
    }
  }

  const handleToggleActive = async (key: LLMKey) => {
    try {
      const res = await fetch('/api/user/llm-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: key.id,
          is_active: !key.is_active,
        }),
      })

      if (res.ok) {
        await fetchKeys()
      }
    } catch (err) {
      console.error('Failed to toggle active:', err)
    }
  }

  const resetForm = () => {
    setNewProvider('')
    setNewApiKey('')
    setNewDisplayName('')
    setIsDefault(false)
    setShowApiKey(false)
    setError(null)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const groupedKeys = providers.reduce((acc, provider) => {
    acc[provider.id] = keys.filter(k => k.provider === provider.id)
    return acc
  }, {} as Record<string, LLMKey[]>)

  if (!mounted) return null

  return (
    <div className={`min-h-screen p-6 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            <Key className="w-6 h-6" />
            AI API 키 관리
          </h1>
          <p className={`mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            에이전트가 사용할 LLM API 키를 관리합니다
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          API 키 추가
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && keys.length === 0 && (
        <div className={`text-center py-20 rounded-xl border-2 border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <Bot className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
          <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            API 키가 없습니다
          </h2>
          <p className={`mb-6 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            에이전트가 AI 모델을 사용하려면 API 키가 필요합니다
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            첫 번째 API 키 추가하기
          </button>
        </div>
      )}

      {/* Provider Cards */}
      {!isLoading && keys.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => {
            const providerKeys = groupedKeys[provider.id] || []
            const hasKeys = providerKeys.length > 0

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl overflow-hidden border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                }`}
              >
                {/* Provider Header */}
                <div className={`p-4 bg-gradient-to-r ${PROVIDER_COLORS[provider.id] || 'from-gray-500 to-gray-600'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{PROVIDER_ICONS[provider.id] || '🔑'}</span>
                      <div>
                        <h3 className="font-semibold text-white">{provider.name}</h3>
                        <p className="text-xs text-white/70">{provider.models.length}개 모델</p>
                      </div>
                    </div>
                    {hasKeys && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full">
                        <CheckCircle className="w-3 h-3 text-white" />
                        <span className="text-xs text-white">{providerKeys.length}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Keys List */}
                <div className="p-4">
                  {hasKeys ? (
                    <div className="space-y-3">
                      {providerKeys.map((key) => (
                        <div
                          key={key.id}
                          className={`p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'} ${
                            !key.is_active ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                {key.display_name}
                              </span>
                              {key.is_default && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-500 rounded text-xs">
                                  <Star className="w-3 h-3" />
                                  기본
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {!key.is_default && (
                                <button
                                  onClick={() => handleSetDefault(key)}
                                  className={`p-1.5 rounded hover:bg-zinc-700/50 transition-colors ${isDark ? 'text-zinc-400 hover:text-amber-400' : 'text-zinc-500 hover:text-amber-500'}`}
                                  title="기본으로 설정"
                                >
                                  <Star className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteKey(key.id)}
                                className={`p-1.5 rounded hover:bg-red-500/20 transition-colors ${isDark ? 'text-zinc-400 hover:text-red-400' : 'text-zinc-500 hover:text-red-500'}`}
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              {key.api_key}
                            </code>
                          </div>
                          {key.last_used_at && (
                            <p className={`text-xs mt-2 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                              마지막 사용: {new Date(key.last_used_at).toLocaleDateString('ko-KR')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className={`text-sm mb-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        등록된 키가 없습니다
                      </p>
                      <button
                        onClick={() => {
                          setNewProvider(provider.id)
                          setShowAddModal(true)
                        }}
                        className={`text-sm text-violet-500 hover:text-violet-400 flex items-center gap-1 mx-auto`}
                      >
                        <Plus className="w-4 h-4" />
                        키 추가
                      </button>
                    </div>
                  )}

                  {/* Get API Key Link */}
                  <a
                    href={PROVIDER_DOCS[provider.id] || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 mt-4 py-2 rounded-lg text-sm transition-colors ${
                      isDark
                        ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    API 키 발급받기
                  </a>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Add Key Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowAddModal(false)
              resetForm()
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl overflow-hidden ${
                isDark ? 'bg-zinc-900' : 'bg-white'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  새 API 키 추가
                </h2>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* Provider Select */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    AI 제공자
                  </label>
                  <select
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                        : 'bg-white border-zinc-300 text-zinc-900'
                    } focus:outline-none focus:ring-2 focus:ring-violet-500/50`}
                  >
                    <option value="">선택하세요</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {PROVIDER_ICONS[p.id]} {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Display Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    표시 이름 (선택)
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="예: 개인 OpenAI, 회사 Claude"
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    } focus:outline-none focus:ring-2 focus:ring-violet-500/50`}
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    API 키
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="sk-..."
                      className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm font-mono ${
                        isDark
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                          : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                      } focus:outline-none focus:ring-2 focus:ring-violet-500/50`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
                        isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-600'
                      }`}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Set as Default */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 text-violet-600 focus:ring-violet-500/50"
                  />
                  <span className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    이 제공자의 기본 키로 설정
                  </span>
                </label>

                {/* Provider Doc Link */}
                {newProvider && PROVIDER_DOCS[newProvider] && (
                  <a
                    href={PROVIDER_DOCS[newProvider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-violet-500 hover:text-violet-400"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {providers.find(p => p.id === newProvider)?.name} API 키 발급받기
                  </a>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex justify-end gap-3 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={handleAddKey}
                  disabled={isSaving || !newProvider || !newApiKey}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      저장
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
