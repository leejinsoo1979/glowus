'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Milestone as MilestoneIcon, Plus, Calendar, Check, Clock,
  AlertTriangle, ChevronRight, Target, Trash2
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Milestone {
  id: string
  name: string
  description: string | null
  target_date: string
  completed_date: string | null
  status: string
  progress: number
  deliverables: any[]
  contract?: {
    id: string
    contract_name: string
    program?: { id: string; title: string }
  }
}

interface Contract {
  id: string
  contract_name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '대기', color: '#71717a', bgColor: '#27272a' },
  in_progress: { label: '진행중', color: '#3b82f6', bgColor: '#1e3a5f' },
  completed: { label: '완료', color: '#10b981', bgColor: '#064e3b' },
  delayed: { label: '지연', color: '#f59e0b', bgColor: '#451a03' },
  at_risk: { label: '위험', color: '#ef4444', bgColor: '#450a0a' },
}

export default function MilestonesPage() {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [formData, setFormData] = useState({
    contract_id: '',
    name: '',
    description: '',
    target_date: '',
    deliverables: [] as string[]
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    Promise.all([fetchMilestones(), fetchContracts()])
  }, [filterStatus])

  const fetchMilestones = async () => {
    try {
      let url = '/api/government-programs/milestones'
      if (filterStatus) url += `?status=${filterStatus}`
      const res = await fetch(url)
      const data = await res.json()
      setMilestones(data.milestones || [])
    } catch (error) {
      console.error('Failed to fetch milestones:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContracts = async () => {
    try {
      const res = await fetch('/api/government-programs/contracts?status=active')
      const data = await res.json()
      setContracts(data.contracts || [])
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    }
  }

  const createMilestone = async () => {
    if (!formData.contract_id || !formData.name || !formData.target_date) return

    try {
      const res = await fetch('/api/government-programs/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.milestone) {
        await fetchMilestones()
        setShowForm(false)
        setFormData({
          contract_id: '',
          name: '',
          description: '',
          target_date: '',
          deliverables: []
        })
      }
    } catch (error) {
      console.error('Failed to create milestone:', error)
    }
  }

  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    try {
      const res = await fetch('/api/government-programs/milestones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      })
      const data = await res.json()
      if (data.milestone) {
        setMilestones(milestones.map(m => m.id === id ? { ...m, ...data.milestone } : m))
      }
    } catch (error) {
      console.error('Failed to update milestone:', error)
    }
  }

  const deleteMilestone = async (id: string) => {
    try {
      await fetch(`/api/government-programs/milestones?id=${id}`, { method: 'DELETE' })
      setMilestones(milestones.filter(m => m.id !== id))
    } catch (error) {
      console.error('Failed to delete milestone:', error)
    }
  }

  const getDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate)
    const today = new Date()
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: themeColor }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
            <MilestoneIcon className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">마일스톤</h1>
            <p className="text-sm text-zinc-400">과제 마일스톤을 관리합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          마일스톤 추가
        </button>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterStatus('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterStatus ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterStatus === key ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterStatus === key ? { backgroundColor: config.bgColor, color: config.color } : {}}
          >
            {config.label}
          </button>
        ))}
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">새 마일스톤 추가</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">협약 과제</label>
              <select
                value={formData.contract_id}
                onChange={e => setFormData({ ...formData, contract_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="">과제 선택</option>
                {contracts.map(c => (
                  <option key={c.id} value={c.id}>{c.contract_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">목표일</label>
              <input
                type="date"
                value={formData.target_date}
                onChange={e => setFormData({ ...formData, target_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">마일스톤 이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 1차년도 중간점검"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">설명</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createMilestone}
              disabled={!formData.contract_id || !formData.name || !formData.target_date}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              추가
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {milestones.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <MilestoneIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>마일스톤이 없습니다</p>
          </div>
        ) : (
          milestones.map((milestone, index) => {
            const daysRemaining = getDaysRemaining(milestone.target_date)
            const statusConfig = STATUS_CONFIG[milestone.status] || STATUS_CONFIG.pending

            return (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                      {milestone.contract?.program && (
                        <span className="text-sm text-zinc-500">
                          {milestone.contract.program.title}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {milestone.name}
                    </h3>

                    {milestone.description && (
                      <p className="text-sm text-zinc-400 mb-3">{milestone.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Calendar className="w-4 h-4" />
                        {milestone.target_date}
                      </span>
                      {milestone.status !== 'completed' && (
                        <span className={`flex items-center gap-1 ${
                          daysRemaining < 0 ? 'text-red-400' :
                          daysRemaining <= 7 ? 'text-amber-400' : 'text-zinc-400'
                        }`}>
                          <Clock className="w-4 h-4" />
                          {daysRemaining < 0 ? `${Math.abs(daysRemaining)}일 초과` : `D-${daysRemaining}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-zinc-400">
                        <Target className="w-4 h-4" />
                        진행률 {milestone.progress}%
                      </span>
                    </div>

                    {/* 진행률 바 */}
                    <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${milestone.progress}%`,
                          backgroundColor: statusConfig.color
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {milestone.status !== 'completed' && (
                      <button
                        onClick={() => updateMilestone(milestone.id, { status: 'completed' })}
                        className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        title="완료 처리"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMilestone(milestone.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
