'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ExternalLink,
  X,
  Copy,
  Check,
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
  source?: 'user' | 'system'
}

interface LLMProvider {
  id: string
  name: string
  models: string[]
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
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Add form state
  const [newProvider, setNewProvider] = useState('')
  const [newApiKey, setNewApiKey] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          display_name: newDisplayName || `${providers.find(p => p.id === newProvider)?.name} Key`,
          is_default: true,
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

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const resetForm = () => {
    setNewProvider('')
    setNewApiKey('')
    setNewDisplayName('')
    setShowApiKey(false)
    setError(null)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  // All keys (user + system)
  const allKeys = keys

  if (!mounted) return null

  return (
    <div className={`min-h-screen p-8 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-xl font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
              API Keys
            </h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
              에이전트가 사용할 LLM API 키를 관리합니다
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            API 키 추가
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
          </div>
        )}

        {/* Table */}
        {!isLoading && (
          <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
            {/* Table Header */}
            <div className={`grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium uppercase tracking-wider ${
              isDark ? 'bg-zinc-900/80 text-zinc-500 border-b border-zinc-800' : 'bg-zinc-100 text-zinc-500 border-b border-zinc-200'
            }`}>
              <div className="col-span-2">제공자</div>
              <div className="col-span-4">지원 모델</div>
              <div className="col-span-3">키</div>
              <div className="col-span-2">상태</div>
              <div className="col-span-1 text-right">작업</div>
            </div>

            {/* Table Body */}
            {allKeys.length === 0 ? (
              <div className={`px-4 py-12 text-center ${isDark ? 'bg-zinc-900/30' : 'bg-white'}`}>
                <p className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  등록된 API 키가 없습니다
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className={`mt-3 text-sm font-medium ${isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-900'}`}
                >
                  첫 번째 키 추가하기 →
                </button>
              </div>
            ) : (
              <div className={isDark ? 'bg-zinc-900/30' : 'bg-white'}>
                {allKeys.map((key, index) => (
                  <div
                    key={key.id}
                    className={`grid grid-cols-12 gap-4 px-4 py-3 items-center ${
                      index !== allKeys.length - 1 ? (isDark ? 'border-b border-zinc-800/50' : 'border-b border-zinc-100') : ''
                    }`}
                  >
                    {/* Provider */}
                    <div className="col-span-2">
                      <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        {providers.find(p => p.id === key.provider)?.name || key.provider}
                      </span>
                    </div>

                    {/* Models */}
                    <div className="col-span-4">
                      <div className="flex flex-wrap gap-1">
                        {providers.find(p => p.id === key.provider)?.models.slice(0, 3).map((model) => (
                          <span
                            key={model}
                            className={`text-[11px] px-1.5 py-0.5 rounded ${
                              isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {model}
                          </span>
                        ))}
                        {(providers.find(p => p.id === key.provider)?.models.length || 0) > 3 && (
                          <span className={`text-[11px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            +{(providers.find(p => p.id === key.provider)?.models.length || 0) - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Key */}
                    <div className="col-span-3 flex items-center gap-2">
                      <code className={`text-xs font-mono ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {key.api_key}
                      </code>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      {key.source === 'system' ? (
                        <span className={`inline-flex items-center text-xs px-2 py-1 rounded ${
                          isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                        }`}>
                          시스템 (.env)
                        </span>
                      ) : (
                        <span className={`inline-flex items-center text-xs px-2 py-1 rounded ${
                          isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          사용자 등록
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end gap-1">
                      {key.source === 'user' && (
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDark
                              ? 'text-zinc-600 hover:text-red-400 hover:bg-zinc-800'
                              : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-100'
                          }`}
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-zinc-900/30 border border-zinc-800' : 'bg-zinc-100 border border-zinc-200'}`}>
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            본인의 API 키를 등록하면 크레딧 차감 없이 에이전트를 사용할 수 있습니다.
          </p>
        </div>

        {/* Quick Links */}
        <div className="mt-4">
          <p className={`text-xs mb-2 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            API 키 발급
          </p>
          <div className="flex flex-wrap gap-2">
            {providers.map(p => (
              <a
                key={p.id}
                href={PROVIDER_DOCS[p.id]}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  isDark
                    ? 'text-zinc-500 hover:text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200'
                }`}
              >
                {p.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Add Key Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
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
                isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
              }`}
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <h2 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  API 키 추가
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className={`p-1 rounded-lg transition-colors ${
                    isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 space-y-4">
                {error && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'
                  }`}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Provider Select */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    제공자
                  </label>
                  <select
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
                        : 'bg-white border-zinc-300 text-zinc-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500`}
                  >
                    <option value="">선택하세요</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Display Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    이름
                  </label>
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="예: Production Key, Test Key"
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600'
                        : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500`}
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
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600'
                          : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded ${
                        isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Provider Doc Link */}
                {newProvider && PROVIDER_DOCS[newProvider] && (
                  <a
                    href={PROVIDER_DOCS[newProvider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-xs ${
                      isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    {providers.find(p => p.id === newProvider)?.name}에서 키 발급받기
                  </a>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`flex justify-end gap-2 p-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100'
                  }`}
                >
                  취소
                </button>
                <button
                  onClick={handleAddKey}
                  disabled={isSaving || !newProvider || !newApiKey}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-white'
                      : 'bg-zinc-900 text-white hover:bg-zinc-800'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '저장'
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
