'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Plus, Trash2, ExternalLink, Calendar,
  FileText, Award, Tag
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Patent {
  id: string
  patent_type: string
  title: string
  description: string | null
  application_number: string | null
  application_date: string | null
  registration_number: string | null
  registration_date: string | null
  status: string
  inventors: string[]
  applicant: string | null
  contract?: {
    id: string
    contract_name: string
    program?: { id: string; title: string }
  }
}

const PATENT_TYPES = [
  { value: 'patent', label: '특허' },
  { value: 'utility_model', label: '실용신안' },
  { value: 'design', label: '디자인' },
  { value: 'trademark', label: '상표' },
  { value: 'copyright', label: '저작권' },
  { value: 'trade_secret', label: '영업비밀' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '준비중', color: '#71717a', bgColor: '#27272a' },
  applied: { label: '출원', color: '#3b82f6', bgColor: '#1e3a5f' },
  registered: { label: '등록', color: '#10b981', bgColor: '#064e3b' },
  rejected: { label: '거절', color: '#ef4444', bgColor: '#450a0a' },
  expired: { label: '만료', color: '#6b7280', bgColor: '#1f2937' },
}

export default function PatentsPage() {
  const [patents, setPatents] = useState<Patent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<string>('')
  const [formData, setFormData] = useState({
    patent_type: 'patent',
    title: '',
    description: '',
    application_number: '',
    application_date: '',
    inventors: [''],
    applicant: ''
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchPatents()
  }, [filterType])

  const fetchPatents = async () => {
    try {
      let url = '/api/government-programs/patents'
      if (filterType) url += `?patent_type=${filterType}`
      const res = await fetch(url)
      const data = await res.json()
      setPatents(data.patents || [])
    } catch (error) {
      console.error('Failed to fetch patents:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPatent = async () => {
    if (!formData.title) return

    try {
      const res = await fetch('/api/government-programs/patents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          inventors: formData.inventors.filter(i => i.trim())
        })
      })
      const data = await res.json()
      if (data.patent) {
        await fetchPatents()
        setShowForm(false)
        setFormData({
          patent_type: 'patent',
          title: '',
          description: '',
          application_number: '',
          application_date: '',
          inventors: [''],
          applicant: ''
        })
      }
    } catch (error) {
      console.error('Failed to create patent:', error)
    }
  }

  const deletePatent = async (id: string) => {
    try {
      await fetch(`/api/government-programs/patents?id=${id}`, { method: 'DELETE' })
      setPatents(patents.filter(p => p.id !== id))
    } catch (error) {
      console.error('Failed to delete patent:', error)
    }
  }

  const addInventor = () => {
    setFormData({ ...formData, inventors: [...formData.inventors, ''] })
  }

  const updateInventor = (index: number, value: string) => {
    const newInventors = [...formData.inventors]
    newInventors[index] = value
    setFormData({ ...formData, inventors: newInventors })
  }

  const removeInventor = (index: number) => {
    if (formData.inventors.length > 1) {
      const newInventors = formData.inventors.filter((_, i) => i !== index)
      setFormData({ ...formData, inventors: newInventors })
    }
  }

  const getTypeLabel = (type: string) => {
    return PATENT_TYPES.find(t => t.value === type)?.label || type
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
            <ShieldCheck className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">특허/IP 관리</h1>
            <p className="text-sm text-zinc-400">지식재산권을 관리합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          IP 등록
        </button>
      </div>

      {/* 유형 필터 */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterType ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {PATENT_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => setFilterType(type.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterType === type.value
                ? 'text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
            style={filterType === type.value ? { backgroundColor: `${themeColor}20`, color: themeColor } : {}}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = patents.filter(p => p.status === key).length
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center"
            >
              <div className="text-2xl font-bold" style={{ color: config.color }}>
                {count}
              </div>
              <div className="text-sm text-zinc-400">{config.label}</div>
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
          <h3 className="text-lg font-semibold text-white">새 IP 등록</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">유형</label>
              <select
                value={formData.patent_type}
                onChange={e => setFormData({ ...formData, patent_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {PATENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">출원인</label>
              <input
                type="text"
                value={formData.applicant}
                onChange={e => setFormData({ ...formData, applicant: e.target.value })}
                placeholder="출원인 (회사명)"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">명칭</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="발명의 명칭"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">출원번호</label>
              <input
                type="text"
                value={formData.application_number}
                onChange={e => setFormData({ ...formData, application_number: e.target.value })}
                placeholder="10-2026-0000000"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">출원일</label>
              <input
                type="date"
                value={formData.application_date}
                onChange={e => setFormData({ ...formData, application_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">발명자</label>
            {formData.inventors.map((inventor, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={inventor}
                  onChange={e => updateInventor(index, e.target.value)}
                  placeholder="발명자 이름"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                />
                {formData.inventors.length > 1 && (
                  <button
                    onClick={() => removeInventor(index)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addInventor}
              className="text-sm text-zinc-400 hover:text-white"
            >
              + 발명자 추가
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createPatent}
              disabled={!formData.title}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              등록
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {patents.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>등록된 IP가 없습니다</p>
          </div>
        ) : (
          patents.map((patent, index) => {
            const statusConfig = STATUS_CONFIG[patent.status] || STATUS_CONFIG.pending

            return (
              <motion.div
                key={patent.id}
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
                        style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                      >
                        {getTypeLabel(patent.patent_type)}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {patent.title}
                    </h3>

                    {patent.description && (
                      <p className="text-sm text-zinc-400 mb-3">{patent.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                      {patent.application_number && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {patent.application_number}
                        </span>
                      )}
                      {patent.application_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          출원: {patent.application_date}
                        </span>
                      )}
                      {patent.registration_number && (
                        <span className="flex items-center gap-1">
                          <Award className="w-4 h-4 text-emerald-400" />
                          등록: {patent.registration_number}
                        </span>
                      )}
                      {patent.inventors?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-4 h-4" />
                          발명자: {patent.inventors.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deletePatent(patent.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors ml-4"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
