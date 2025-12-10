'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Startup, StartupStage, CreateStartupInput } from '@/types/database'
import {
  Building2,
  Plus,
  Edit3,
  Trash2,
  Globe,
  Users,
  TrendingUp,
  Calendar,
  DollarSign,
  Loader2,
  X,
  Check,
  AlertCircle,
} from 'lucide-react'

const STAGES: { value: StartupStage; label: string; color: string }[] = [
  { value: 'IDEA', label: '아이디어', color: 'bg-zinc-700 text-zinc-300' },
  { value: 'MVP', label: 'MVP', color: 'bg-accent/20 text-accent' },
  { value: 'EARLY', label: '초기', color: 'bg-green-500/20 text-green-400' },
  { value: 'GROWTH', label: '성장', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'SCALE', label: '스케일업', color: 'bg-orange-500/20 text-orange-400' },
]

const INDUSTRIES = [
  'AI/ML', 'SaaS', 'Fintech', 'E-commerce', 'Healthcare', 'EdTech',
  'Gaming', 'Logistics', 'Real Estate', 'Food & Beverage', 'Other'
]

export default function StartupPage() {
  const { user } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [startups, setStartups] = useState<Startup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingStartup, setEditingStartup] = useState<Startup | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true

  const [formData, setFormData] = useState<CreateStartupInput>({
    name: '',
    description: '',
    industry: '',
    stage: 'IDEA',
    website: '',
    monthly_revenue: 0,
    monthly_burn: 0,
    employee_count: 1,
  })

  const fetchStartups = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/startups')
      const result = await response.json()

      if (result.data) {
        setStartups(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch startups:', err)
      setError('스타트업 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStartups()
  }, [fetchStartups])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const url = editingStartup
        ? `/api/startups/${editingStartup.id}`
        : '/api/startups'
      const method = editingStartup ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.')
      }

      await fetchStartups()
      handleCloseModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

    try {
      const response = await fetch(`/api/startups/${id}`, { method: 'DELETE' })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '삭제에 실패했습니다.')
      }

      await fetchStartups()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    }
  }

  const handleEdit = (startup: Startup) => {
    setEditingStartup(startup)
    setFormData({
      name: startup.name,
      description: startup.description || '',
      industry: startup.industry,
      stage: startup.stage,
      website: startup.website || '',
      monthly_revenue: startup.monthly_revenue,
      monthly_burn: startup.monthly_burn,
      employee_count: startup.employee_count,
    })
    setShowCreateModal(true)
  }

  const handleCloseModal = () => {
    setShowCreateModal(false)
    setEditingStartup(null)
    setFormData({
      name: '',
      description: '',
      industry: '',
      stage: 'IDEA',
      website: '',
      monthly_revenue: 0,
      monthly_burn: 0,
      employee_count: 1,
    })
    setError(null)
  }

  const getStageInfo = (stage: StartupStage) => {
    return STAGES.find(s => s.value === stage) || STAGES[0]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          <p className={isDark ? 'text-zinc-500' : 'text-zinc-600'}>스타트업 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>스타트업 관리</h1>
          <p className={`mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>스타트업 정보를 관리하세요</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
          스타트업 추가
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-danger-400" />
          <p className="text-danger-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-danger-500" />
          </button>
        </motion.div>
      )}

      {/* Startup List */}
      {startups.length === 0 ? (
        <Card variant="default" className="py-16">
          <div className="text-center space-y-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <Building2 className={`w-8 h-8 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>등록된 스타트업이 없습니다</h3>
              <p className={`mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>첫 번째 스타트업을 추가해보세요</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
              스타트업 추가
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {startups.map((startup, index) => {
            const stageInfo = getStageInfo(startup.stage)
            return (
              <motion.div
                key={startup.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="interactive" className="h-full flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-lg">
                          {startup.name.charAt(0)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{startup.name}</CardTitle>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-xs font-medium ${stageInfo.color}`}>
                            {stageInfo.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-4">
                    {startup.description && (
                      <p className={`text-sm line-clamp-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{startup.description}</p>
                    )}

                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        <Building2 className="w-4 h-4" />
                        <span>{startup.industry}</span>
                      </div>
                      {startup.website && (
                        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          <Globe className="w-4 h-4" />
                          <a href={startup.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline truncate">
                            {startup.website}
                          </a>
                        </div>
                      )}
                      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        <Users className="w-4 h-4" />
                        <span>{startup.employee_count}명</span>
                      </div>
                    </div>

                    <div className={`pt-3 border-t grid grid-cols-2 gap-3 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                      <div>
                        <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>월 매출</p>
                        <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                          {formatCurrency(startup.monthly_revenue)}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>월 지출</p>
                        <p className={`text-sm font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                          {formatCurrency(startup.monthly_burn)}
                        </p>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Edit3 className="w-4 h-4" />}
                      onClick={() => handleEdit(startup)}
                    >
                      수정
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-danger-600 hover:bg-danger-50"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={() => handleDelete(startup.id)}
                    >
                      삭제
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
          >
            <motion.div
              className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${
                isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
              }`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className={`p-6 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                    {editingStartup ? '스타트업 수정' : '새 스타트업 추가'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
                  >
                    <X className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <Input
                  label="스타트업 이름"
                  placeholder="예: GlowUS"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>산업 분야</label>
                  <select
                    className={`w-full h-11 px-4 rounded-xl text-sm focus:outline-none focus-accent ${
                      isDark
                        ? 'bg-zinc-800 border border-zinc-700 text-zinc-100'
                        : 'bg-zinc-50 border border-zinc-300 text-zinc-900'
                    }`}
                    value={formData.industry}
                    onChange={e => setFormData({ ...formData, industry: e.target.value })}
                    required
                  >
                    <option value="">선택하세요</option>
                    {INDUSTRIES.map(industry => (
                      <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>성장 단계</label>
                  <div className="grid grid-cols-5 gap-2">
                    {STAGES.map(stage => (
                      <button
                        key={stage.value}
                        type="button"
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          formData.stage === stage.value
                            ? 'bg-accent text-white'
                            : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                        onClick={() => setFormData({ ...formData, stage: stage.value })}
                      >
                        {stage.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="웹사이트"
                  placeholder="https://example.com"
                  type="url"
                  value={formData.website}
                  onChange={e => setFormData({ ...formData, website: e.target.value })}
                />

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>소개</label>
                  <textarea
                    className={`w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus-accent resize-none ${
                      isDark
                        ? 'bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500'
                        : 'bg-zinc-50 border border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                    rows={3}
                    placeholder="스타트업에 대해 간단히 소개해주세요"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="월 매출 (원)"
                    type="number"
                    placeholder="0"
                    value={formData.monthly_revenue}
                    onChange={e => setFormData({ ...formData, monthly_revenue: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    label="월 지출 (원)"
                    type="number"
                    placeholder="0"
                    value={formData.monthly_burn}
                    onChange={e => setFormData({ ...formData, monthly_burn: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    label="직원 수"
                    type="number"
                    placeholder="1"
                    min={1}
                    value={formData.employee_count}
                    onChange={e => setFormData({ ...formData, employee_count: parseInt(e.target.value) || 1 })}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                    <p className="text-sm text-danger-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={handleCloseModal}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={isSubmitting}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    {editingStartup ? '수정하기' : '추가하기'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
