'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Cloud,
  Database,
  MessageSquare,
  Zap,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Settings,
  ChevronRight,
  Globe,
  Key,
  X,
} from 'lucide-react'

interface ApiTool {
  id: string
  name: string
  description: string
  category: string
  provider: string
  auth_type: string
  base_url: string
  documentation_url: string
  required_fields: string[]
  is_active: boolean
}

interface AgentApiConnection {
  id: string
  agent_id: string
  name: string
  description: string
  provider_type: string
  base_url: string
  auth_type: string
  auth_config: Record<string, string>
  is_active: boolean
  created_at: string
}

interface AgentApiToolsPanelProps {
  agentId: string
  isDark?: boolean
}

const CATEGORY_ICONS: Record<string, any> = {
  search: Search,
  data: Database,
  productivity: Settings,
  communication: MessageSquare,
  ai: Zap,
}

const CATEGORY_COLORS: Record<string, string> = {
  search: 'from-blue-500 to-cyan-500',
  data: 'from-green-500 to-emerald-500',
  productivity: 'from-purple-500 to-violet-500',
  communication: 'from-pink-500 to-rose-500',
  ai: 'from-orange-500 to-amber-500',
}

const CATEGORY_NAMES: Record<string, string> = {
  search: '검색',
  data: '데이터',
  productivity: '생산성',
  communication: '커뮤니케이션',
  ai: 'AI 서비스',
}

export function AgentApiToolsPanel({ agentId, isDark = true }: AgentApiToolsPanelProps) {
  const [tools, setTools] = useState<ApiTool[]>([])
  const [connections, setConnections] = useState<AgentApiConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ApiTool | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Form state
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [agentId])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // Fetch available tools
      const toolsRes = await fetch('/api/tools/catalog')
      if (toolsRes.ok) {
        const toolsData = await toolsRes.json()
        setTools(toolsData.tools || [])
      }

      // Fetch agent's existing connections
      const connectionsRes = await fetch(`/api/agents/${agentId}/apis`)
      if (connectionsRes.ok) {
        const connectionsData = await connectionsRes.json()
        setConnections(connectionsData.connections || [])
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTool = async () => {
    if (!selectedTool) return

    setIsSaving(true)
    setError(null)

    try {
      const authConfig: Record<string, string> = {}
      selectedTool.required_fields.forEach((field) => {
        if (formValues[field]) {
          authConfig[field] = formValues[field]
        }
      })

      const res = await fetch(`/api/agents/${agentId}/apis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTool.name,
          description: selectedTool.description,
          provider_type: selectedTool.provider,
          base_url: selectedTool.base_url,
          auth_type: selectedTool.auth_type,
          auth_config: authConfig,
        }),
      })

      if (res.ok) {
        await fetchData()
        setShowAddModal(false)
        setSelectedTool(null)
        setFormValues({})
      } else {
        const data = await res.json()
        setError(data.error || '도구 추가 실패')
      }
    } catch (err) {
      setError('도구 추가 중 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('이 API 연결을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/agents/${agentId}/apis/${connectionId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setConnections((prev) => prev.filter((c) => c.id !== connectionId))
      }
    } catch (err) {
      console.error('Failed to delete connection:', err)
    }
  }

  const categories = Array.from(new Set(tools.map((t) => t.category)))
  const filteredTools = selectedCategory
    ? tools.filter((t) => t.category === selectedCategory)
    : tools

  const connectedToolIds = connections.map((c) => c.provider_type)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
            API 도구
          </h3>
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            에이전트가 사용할 수 있는 외부 API를 연결합니다
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          도구 추가
        </button>
      </div>

      {/* Connected Tools */}
      {connections.length > 0 ? (
        <div className="space-y-3">
          {connections.map((conn) => {
            const tool = tools.find((t) => t.provider === conn.provider_type)
            const CategoryIcon = CATEGORY_ICONS[tool?.category || 'ai'] || Zap

            return (
              <div
                key={conn.id}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg bg-gradient-to-br ${
                      CATEGORY_COLORS[tool?.category || 'ai'] || 'from-gray-500 to-gray-600'
                    }`}
                  >
                    <CategoryIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                      {conn.name}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {conn.description || tool?.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      conn.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}
                  >
                    {conn.is_active ? '활성' : '비활성'}
                  </span>
                  <button
                    onClick={() => handleDeleteConnection(conn.id)}
                    className={`p-2 rounded-lg hover:bg-red-500/20 transition-colors ${
                      isDark ? 'text-zinc-400 hover:text-red-400' : 'text-zinc-500 hover:text-red-500'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className={`text-center py-12 rounded-xl border-2 border-dashed ${
            isDark ? 'border-zinc-800' : 'border-zinc-200'
          }`}
        >
          <Globe className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
          <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            연결된 API 도구가 없습니다
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-sm text-violet-500 hover:text-violet-400"
          >
            도구 추가하기
          </button>
        </div>
      )}

      {/* Add Tool Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowAddModal(false)
              setSelectedTool(null)
              setFormValues({})
              setError(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg max-h-[80vh] overflow-hidden rounded-xl ${
                isDark ? 'bg-zinc-900' : 'bg-white'
              }`}
            >
              {/* Modal Header */}
              <div
                className={`p-4 border-b flex items-center justify-between ${
                  isDark ? 'border-zinc-800' : 'border-zinc-200'
                }`}
              >
                <h2
                  className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}
                >
                  {selectedTool ? selectedTool.name : 'API 도구 추가'}
                </h2>
                <button
                  onClick={() => {
                    if (selectedTool) {
                      setSelectedTool(null)
                      setFormValues({})
                    } else {
                      setShowAddModal(false)
                    }
                  }}
                  className={`p-1 rounded ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="overflow-y-auto max-h-[60vh]">
                {selectedTool ? (
                  // Tool Configuration Form
                  <div className="p-4 space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}

                    <div
                      className={`p-4 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}
                    >
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {selectedTool.description}
                      </p>
                      {selectedTool.documentation_url && (
                        <a
                          href={selectedTool.documentation_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-2 text-sm text-violet-500 hover:text-violet-400"
                        >
                          <ExternalLink className="w-3 h-3" />
                          문서 보기
                        </a>
                      )}
                    </div>

                    {/* Required Fields */}
                    {selectedTool.required_fields.map((field) => (
                      <div key={field}>
                        <label
                          className={`block text-sm font-medium mb-2 ${
                            isDark ? 'text-zinc-300' : 'text-zinc-700'
                          }`}
                        >
                          {field === 'api_key' ? 'API 키' : field}
                        </label>
                        <div className="relative">
                          <Key
                            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                              isDark ? 'text-zinc-500' : 'text-zinc-400'
                            }`}
                          />
                          <input
                            type={field.includes('key') || field.includes('secret') ? 'password' : 'text'}
                            value={formValues[field] || ''}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [field]: e.target.value }))
                            }
                            placeholder={`${field}를 입력하세요`}
                            className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm ${
                              isDark
                                ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                                : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                            } focus:outline-none focus:ring-2 focus:ring-violet-500/50`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Tool Selection
                  <div className="p-4">
                    {/* Category Filter */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          selectedCategory === null
                            ? 'bg-violet-600 text-white'
                            : isDark
                            ? 'bg-zinc-800 text-zinc-300'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        전체
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            selectedCategory === cat
                              ? 'bg-violet-600 text-white'
                              : isDark
                              ? 'bg-zinc-800 text-zinc-300'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {CATEGORY_NAMES[cat] || cat}
                        </button>
                      ))}
                    </div>

                    {/* Tools List */}
                    <div className="space-y-2">
                      {filteredTools.map((tool) => {
                        const CategoryIcon = CATEGORY_ICONS[tool.category] || Zap
                        const isConnected = connectedToolIds.includes(tool.provider)

                        return (
                          <button
                            key={tool.id}
                            onClick={() => !isConnected && setSelectedTool(tool)}
                            disabled={isConnected}
                            className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                              isConnected
                                ? 'opacity-50 cursor-not-allowed'
                                : isDark
                                ? 'hover:bg-zinc-800'
                                : 'hover:bg-zinc-50'
                            } ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-50/50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-lg bg-gradient-to-br ${
                                  CATEGORY_COLORS[tool.category] || 'from-gray-500 to-gray-600'
                                }`}
                              >
                                <CategoryIcon className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p
                                  className={`font-medium text-sm ${
                                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                                  }`}
                                >
                                  {tool.name}
                                </p>
                                <p
                                  className={`text-xs ${
                                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                                  }`}
                                >
                                  {tool.description}
                                </p>
                              </div>
                            </div>
                            {isConnected ? (
                              <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                                연결됨
                              </span>
                            ) : (
                              <ChevronRight
                                className={`w-4 h-4 ${
                                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                                }`}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {selectedTool && (
                <div
                  className={`p-4 border-t flex justify-end gap-3 ${
                    isDark ? 'border-zinc-800' : 'border-zinc-200'
                  }`}
                >
                  <button
                    onClick={() => {
                      setSelectedTool(null)
                      setFormValues({})
                      setError(null)
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      isDark
                        ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    뒤로
                  </button>
                  <button
                    onClick={handleAddTool}
                    disabled={
                      isSaving ||
                      selectedTool.required_fields.some((f) => !formValues[f])
                    }
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
                        연결
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
