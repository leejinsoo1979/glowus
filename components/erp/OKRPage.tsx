'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Target,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Edit2,
  Trash2,
  TrendingUp,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Loader2
} from 'lucide-react'

interface KeyResult {
  id: string
  title: string
  description?: string
  metric_type: 'percentage' | 'number' | 'currency' | 'boolean'
  start_value: number
  target_value: number
  current_value: number
  unit?: string
  progress: number
  status: 'not_started' | 'on_track' | 'at_risk' | 'behind' | 'completed'
  weight: number
  owner?: { id: string; name: string; avatar_url?: string }
}

interface Objective {
  id: string
  title: string
  description?: string
  year: number
  quarter?: number
  period_type: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  progress: number
  priority: 'high' | 'medium' | 'low'
  owner?: { id: string; name: string; avatar_url?: string }
  department?: { id: string; name: string }
  key_results: KeyResult[]
  created_at: string
}

const statusConfig = {
  not_started: { label: '시작 전', color: 'bg-zinc-500', textColor: 'text-zinc-500' },
  on_track: { label: '순조로움', color: 'bg-green-500', textColor: 'text-green-500' },
  at_risk: { label: '주의', color: 'bg-yellow-500', textColor: 'text-yellow-500' },
  behind: { label: '지연', color: 'bg-red-500', textColor: 'text-red-500' },
  completed: { label: '완료', color: 'bg-blue-500', textColor: 'text-blue-500' }
}

const priorityConfig = {
  high: { label: '높음', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: '보통', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: '낮음', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
}

export function OKRPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterQuarter, setFilterQuarter] = useState<number | null>(Math.ceil((new Date().getMonth() + 1) / 3))

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null)
  const [savingObjective, setSavingObjective] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    year: new Date().getFullYear(),
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
    priority: 'medium' as 'high' | 'medium' | 'low',
    key_results: [] as { title: string; target_value: number; unit: string }[]
  })

  const fetchObjectives = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('year', filterYear.toString())
      if (filterQuarter) {
        params.set('quarter', filterQuarter.toString())
      }

      const res = await fetch(`/api/okr/objectives?${params}`)
      if (res.ok) {
        const data = await res.json()
        setObjectives(data)
        // 기본적으로 모든 목표 펼치기
        setExpandedIds(new Set(data.map((o: Objective) => o.id)))
      }
    } catch (error) {
      console.error('Failed to fetch objectives:', error)
    } finally {
      setLoading(false)
    }
  }, [filterYear, filterQuarter])

  useEffect(() => {
    fetchObjectives()
  }, [fetchObjectives])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleAddObjective = () => {
    setEditingObjective(null)
    setFormData({
      title: '',
      description: '',
      year: filterYear,
      quarter: filterQuarter || Math.ceil((new Date().getMonth() + 1) / 3),
      priority: 'medium',
      key_results: [{ title: '', target_value: 100, unit: '%' }]
    })
    setShowAddModal(true)
  }

  const handleEditObjective = (objective: Objective) => {
    setEditingObjective(objective)
    setFormData({
      title: objective.title,
      description: objective.description || '',
      year: objective.year,
      quarter: objective.quarter || 1,
      priority: objective.priority,
      key_results: objective.key_results.map(kr => ({
        title: kr.title,
        target_value: kr.target_value,
        unit: kr.unit || '%'
      }))
    })
    setShowAddModal(true)
  }

  const handleSaveObjective = async () => {
    if (!formData.title.trim()) return

    setSavingObjective(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        year: formData.year,
        quarter: formData.quarter,
        priority: formData.priority,
        key_results: formData.key_results.filter(kr => kr.title.trim())
      }

      if (editingObjective) {
        // Update
        await fetch(`/api/okr/objectives/${editingObjective.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        // Create
        await fetch('/api/okr/objectives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      setShowAddModal(false)
      fetchObjectives()
    } catch (error) {
      console.error('Failed to save objective:', error)
    } finally {
      setSavingObjective(false)
    }
  }

  const handleDeleteObjective = async (id: string) => {
    if (!confirm('이 목표를 삭제하시겠습니까? 관련된 모든 핵심 결과도 함께 삭제됩니다.')) return

    try {
      await fetch(`/api/okr/objectives/${id}`, { method: 'DELETE' })
      fetchObjectives()
    } catch (error) {
      console.error('Failed to delete objective:', error)
    }
  }

  const handleUpdateKRValue = async (krId: string, newValue: number) => {
    try {
      await fetch(`/api/okr/key-results/${krId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_value: newValue })
      })
      fetchObjectives()
    } catch (error) {
      console.error('Failed to update KR:', error)
    }
  }

  const addKeyResultField = () => {
    setFormData(prev => ({
      ...prev,
      key_results: [...prev.key_results, { title: '', target_value: 100, unit: '%' }]
    }))
  }

  const removeKeyResultField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      key_results: prev.key_results.filter((_, i) => i !== index)
    }))
  }

  const filteredObjectives = objectives.filter(obj =>
    obj.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 전체 진행률 계산
  const overallProgress = objectives.length > 0
    ? objectives.reduce((sum, obj) => sum + obj.progress, 0) / objectives.length
    : 0

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard-group/company')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-accent/20' : 'bg-accent/10')}>
              <Target className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                OKR 관리
              </h1>
              <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                목표와 핵심 결과를 관리합니다
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleAddObjective}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          목표 추가
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
          <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>전체 진행률</div>
          <div className={cn('text-2xl font-bold mt-1', isDark ? 'text-white' : 'text-zinc-900')}>
            {overallProgress.toFixed(0)}%
          </div>
          <div className="mt-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
          <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>총 목표</div>
          <div className={cn('text-2xl font-bold mt-1', isDark ? 'text-white' : 'text-zinc-900')}>
            {objectives.length}
          </div>
        </div>
        <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
          <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>핵심 결과</div>
          <div className={cn('text-2xl font-bold mt-1', isDark ? 'text-white' : 'text-zinc-900')}>
            {objectives.reduce((sum, obj) => sum + obj.key_results.length, 0)}
          </div>
        </div>
        <div className={cn('p-4 rounded-xl border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
          <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>완료된 목표</div>
          <div className={cn('text-2xl font-bold mt-1', isDark ? 'text-white' : 'text-zinc-900')}>
            {objectives.filter(o => o.progress >= 100).length}
          </div>
        </div>
      </div>

      {/* 필터 바 */}
      <div className={cn(
        'flex items-center gap-4 p-4 rounded-xl border',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="flex-1 relative">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
          <input
            type="text"
            placeholder="목표 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg border text-sm',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            )}
          />
        </div>

        {/* 연도 선택 */}
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className={cn(
            'px-3 py-2 rounded-lg border text-sm',
            isDark
              ? 'bg-zinc-800 border-zinc-700 text-white'
              : 'bg-zinc-50 border-zinc-200 text-zinc-900'
          )}
        >
          {[2024, 2025, 2026].map(year => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>

        {/* 분기 선택 */}
        <select
          value={filterQuarter || ''}
          onChange={(e) => setFilterQuarter(e.target.value ? parseInt(e.target.value) : null)}
          className={cn(
            'px-3 py-2 rounded-lg border text-sm',
            isDark
              ? 'bg-zinc-800 border-zinc-700 text-white'
              : 'bg-zinc-50 border-zinc-200 text-zinc-900'
          )}
        >
          <option value="">전체 분기</option>
          <option value="1">Q1 (1-3월)</option>
          <option value="2">Q2 (4-6월)</option>
          <option value="3">Q3 (7-9월)</option>
          <option value="4">Q4 (10-12월)</option>
        </select>
      </div>

      {/* 목표 목록 */}
      <div className="space-y-4">
        {loading ? (
          <div className={cn('p-8 text-center rounded-xl border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            <p className={cn('mt-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>로딩 중...</p>
          </div>
        ) : filteredObjectives.length === 0 ? (
          <div className={cn('p-8 text-center rounded-xl border', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
            <Target className="w-12 h-12 mx-auto text-accent opacity-50" />
            <h3 className={cn('mt-4 font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              아직 목표가 없습니다
            </h3>
            <p className={cn('mt-1 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              첫 번째 OKR을 등록해보세요
            </p>
            <button
              onClick={handleAddObjective}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-accent text-white hover:bg-accent/90"
            >
              <Plus className="w-4 h-4" />
              목표 추가하기
            </button>
          </div>
        ) : (
          filteredObjectives.map(objective => (
            <div
              key={objective.id}
              className={cn(
                'rounded-xl border overflow-hidden',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              {/* 목표 헤더 */}
              <div
                className={cn(
                  'flex items-center gap-4 p-4 cursor-pointer transition-colors',
                  isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                )}
                onClick={() => toggleExpand(objective.id)}
              >
                <button className={cn('p-1 rounded', isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200')}>
                  {expandedIds.has(objective.id) ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn('font-semibold truncate', isDark ? 'text-white' : 'text-zinc-900')}>
                      {objective.title}
                    </h3>
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', priorityConfig[objective.priority].color)}>
                      {priorityConfig[objective.priority].label}
                    </span>
                  </div>
                  <div className={cn('flex items-center gap-3 mt-1 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {objective.year}년 Q{objective.quarter}
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      {objective.key_results.length} KRs
                    </span>
                    {objective.owner && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {objective.owner.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* 진행률 */}
                <div className="w-32">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>진행률</span>
                    <span className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                      {objective.progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        objective.progress >= 100 ? 'bg-green-500' :
                        objective.progress >= 70 ? 'bg-accent' :
                        objective.progress >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${Math.min(100, objective.progress)}%` }}
                    />
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEditObjective(objective)}
                    className={cn('p-2 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteObjective(objective.id)}
                    className={cn('p-2 rounded-lg transition-colors text-red-500', isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Key Results */}
              {expandedIds.has(objective.id) && objective.key_results.length > 0 && (
                <div className={cn('border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
                  {objective.key_results.map((kr, index) => (
                    <div
                      key={kr.id}
                      className={cn(
                        'flex items-center gap-4 px-4 py-3',
                        index > 0 && (isDark ? 'border-t border-zinc-800' : 'border-t border-zinc-100'),
                        isDark ? 'bg-zinc-950/50' : 'bg-zinc-50/50'
                      )}
                    >
                      <div className="w-8 flex justify-center">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          statusConfig[kr.status].color
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                          {kr.title}
                        </div>
                        <div className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {kr.current_value} / {kr.target_value} {kr.unit}
                        </div>
                      </div>
                      <div className="w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                            <div
                              className={cn('h-full transition-all duration-500', statusConfig[kr.status].color)}
                              style={{ width: `${Math.min(100, kr.progress)}%` }}
                            />
                          </div>
                          <span className={cn('text-sm font-medium w-12 text-right', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                            {kr.progress.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <input
                        type="number"
                        value={kr.current_value}
                        onChange={(e) => handleUpdateKRValue(kr.id, parseFloat(e.target.value) || 0)}
                        className={cn(
                          'w-20 px-2 py-1 text-sm text-center rounded border',
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 목표 추가/수정 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={cn(
            'w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl',
            isDark ? 'bg-zinc-900' : 'bg-white'
          )}>
            <div className={cn('flex items-center justify-between p-4 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
              <h2 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                {editingObjective ? '목표 수정' : '새 목표 추가'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className={cn('p-2 rounded-lg', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* 목표 제목 */}
              <div>
                <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  목표 (Objective)
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="예: 고객 만족도 향상"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border text-sm',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>

              {/* 설명 */}
              <div>
                <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  설명 (선택)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg border text-sm resize-none',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>

              {/* 기간 및 우선순위 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>연도</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-sm',
                      isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    )}
                  >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                  </select>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>분기</label>
                  <select
                    value={formData.quarter}
                    onChange={(e) => setFormData(prev => ({ ...prev, quarter: parseInt(e.target.value) }))}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-sm',
                      isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    )}
                  >
                    {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>우선순위</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-sm',
                      isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    )}
                  >
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>
                </div>
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                    핵심 결과 (Key Results)
                  </label>
                  <button
                    onClick={addKeyResultField}
                    className="text-sm text-accent hover:underline"
                  >
                    + KR 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.key_results.map((kr, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => {
                          const newKRs = [...formData.key_results]
                          newKRs[index].title = e.target.value
                          setFormData(prev => ({ ...prev, key_results: newKRs }))
                        }}
                        placeholder={`KR ${index + 1}: 예) NPS 점수 80점 달성`}
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg border text-sm',
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                        )}
                      />
                      <input
                        type="number"
                        value={kr.target_value}
                        onChange={(e) => {
                          const newKRs = [...formData.key_results]
                          newKRs[index].target_value = parseFloat(e.target.value) || 0
                          setFormData(prev => ({ ...prev, key_results: newKRs }))
                        }}
                        className={cn(
                          'w-20 px-2 py-2 rounded-lg border text-sm text-center',
                          isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        )}
                      />
                      <input
                        type="text"
                        value={kr.unit}
                        onChange={(e) => {
                          const newKRs = [...formData.key_results]
                          newKRs[index].unit = e.target.value
                          setFormData(prev => ({ ...prev, key_results: newKRs }))
                        }}
                        placeholder="단위"
                        className={cn(
                          'w-16 px-2 py-2 rounded-lg border text-sm text-center',
                          isDark ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        )}
                      />
                      {formData.key_results.length > 1 && (
                        <button
                          onClick={() => removeKeyResultField(index)}
                          className={cn('p-2 rounded-lg text-red-500', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={cn('flex justify-end gap-2 p-4 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
              <button
                onClick={() => setShowAddModal(false)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium',
                  isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                )}
              >
                취소
              </button>
              <button
                onClick={handleSaveObjective}
                disabled={savingObjective || !formData.title.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {savingObjective && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingObjective ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
