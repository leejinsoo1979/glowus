'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle, Plus, Shield, Clock, TrendingDown,
  CheckCircle, XCircle, ArrowRight
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Risk {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'identified' | 'mitigating' | 'resolved' | 'accepted'
  category: string
  impact: string
  mitigation_plan: string | null
  due_date: string | null
  contract?: {
    id: string
    contract_name: string
  }
}

const SEVERITY_CONFIG = {
  low: { label: '낮음', color: '#10b981', bgColor: '#064e3b' },
  medium: { label: '중간', color: '#f59e0b', bgColor: '#451a03' },
  high: { label: '높음', color: '#f97316', bgColor: '#431407' },
  critical: { label: '심각', color: '#ef4444', bgColor: '#450a0a' },
}

const STATUS_CONFIG = {
  identified: { label: '식별됨', color: '#3b82f6', icon: AlertTriangle },
  mitigating: { label: '대응중', color: '#f59e0b', icon: Shield },
  resolved: { label: '해결됨', color: '#10b981', icon: CheckCircle },
  accepted: { label: '수용', color: '#71717a', icon: CheckCircle },
}

const CATEGORIES = ['일정', '예산', '기술', '인력', '외부환경', '기타']

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState<string>('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    category: '일정',
    impact: '',
    mitigation_plan: '',
    due_date: ''
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchRisks()
  }, [filterSeverity])

  const fetchRisks = async () => {
    try {
      // Mock data - in real app, fetch from API
      const mockRisks: Risk[] = [
        {
          id: '1',
          title: '핵심 개발자 이탈 위험',
          description: '프로젝트 리더가 다른 기회를 모색 중',
          severity: 'high',
          status: 'mitigating',
          category: '인력',
          impact: '개발 일정 2개월 지연 예상',
          mitigation_plan: '대체 인력 확보 및 기술 이전 진행 중',
          due_date: '2026-02-15',
        },
        {
          id: '2',
          title: '예산 초과 위험',
          description: '외주 개발비 증가로 예산 부족 우려',
          severity: 'medium',
          status: 'identified',
          category: '예산',
          impact: '예산 15% 초과 예상',
          mitigation_plan: null,
          due_date: null,
        },
        {
          id: '3',
          title: '기술 구현 난이도',
          description: 'AI 모델 정확도가 목표치 미달',
          severity: 'high',
          status: 'mitigating',
          category: '기술',
          impact: '성과지표 미달 가능성',
          mitigation_plan: '외부 전문가 자문 및 추가 연구 진행',
          due_date: '2026-01-31',
        },
      ]

      let filtered = mockRisks
      if (filterSeverity) {
        filtered = filtered.filter(r => r.severity === filterSeverity)
      }
      setRisks(filtered)
    } catch (error) {
      console.error('Failed to fetch risks:', error)
    } finally {
      setLoading(false)
    }
  }

  const createRisk = async () => {
    if (!formData.title) return

    try {
      const newRisk: Risk = {
        id: Date.now().toString(),
        ...formData,
        status: 'identified',
      }
      setRisks([newRisk, ...risks])
      setShowForm(false)
      setFormData({
        title: '',
        description: '',
        severity: 'medium',
        category: '일정',
        impact: '',
        mitigation_plan: '',
        due_date: ''
      })
    } catch (error) {
      console.error('Failed to create risk:', error)
    }
  }

  const getDaysRemaining = (dueDate: string | null) => {
    if (!dueDate) return null
    const due = new Date(dueDate)
    const today = new Date()
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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
            <AlertTriangle className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">위험 관리</h1>
            <p className="text-sm text-zinc-400">프로젝트 위험 요소를 관리합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          위험 등록
        </button>
      </div>

      {/* 심각도 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterSeverity('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterSeverity ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterSeverity(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterSeverity === key ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterSeverity === key ? { backgroundColor: config.bgColor, color: config.color } : {}}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(SEVERITY_CONFIG).map(([key, config], index) => {
          const count = risks.filter(r => r.severity === key && r.status !== 'resolved').length
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-5 h-5" style={{ color: config.color }} />
                <span className="text-2xl font-bold" style={{ color: config.color }}>
                  {count}
                </span>
              </div>
              <div className="text-sm text-zinc-400">{config.label} 위험</div>
            </motion.div>
          )
        })}
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">위험 등록</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">심각도</label>
              <select
                value={formData.severity}
                onChange={e => setFormData({ ...formData, severity: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">분류</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">대응 기한</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">위험 제목</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="위험 요소 제목"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">상세 설명</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">예상 영향</label>
            <input
              type="text"
              value={formData.impact}
              onChange={e => setFormData({ ...formData, impact: e.target.value })}
              placeholder="발생 시 예상되는 영향"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">대응 계획</label>
            <textarea
              value={formData.mitigation_plan}
              onChange={e => setFormData({ ...formData, mitigation_plan: e.target.value })}
              rows={2}
              placeholder="위험 완화를 위한 계획"
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
              onClick={createRisk}
              disabled={!formData.title}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              등록
            </button>
          </div>
        </motion.div>
      )}

      {/* 위험 목록 */}
      <div className="space-y-4">
        {risks.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>등록된 위험 요소가 없습니다</p>
          </div>
        ) : (
          risks.map((risk, index) => {
            const severityConfig = SEVERITY_CONFIG[risk.severity]
            const statusConfig = STATUS_CONFIG[risk.status]
            const StatusIcon = statusConfig.icon
            const daysRemaining = getDaysRemaining(risk.due_date)

            return (
              <motion.div
                key={risk.id}
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
                        style={{ backgroundColor: severityConfig.bgColor, color: severityConfig.color }}
                      >
                        {severityConfig.label}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"
                        style={{ backgroundColor: `${statusConfig.color}20`, color: statusConfig.color }}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">
                        {risk.category}
                      </span>
                      {daysRemaining !== null && daysRemaining <= 7 && risk.status !== 'resolved' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                          대응 D-{daysRemaining}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-1">{risk.title}</h3>
                    <p className="text-sm text-zinc-400 mb-3">{risk.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">예상 영향</div>
                        <div className="text-zinc-300">{risk.impact}</div>
                      </div>
                      {risk.mitigation_plan && (
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">대응 계획</div>
                          <div className="text-zinc-300">{risk.mitigation_plan}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {risk.status !== 'resolved' && (
                    <button
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
