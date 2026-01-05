'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Plus, Upload, Download, Trash2, Calendar,
  AlertCircle, CheckCircle, Clock, FolderOpen
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Document {
  id: string
  document_type: string
  document_name: string
  description: string | null
  file_url: string | null
  expiry_date: string | null
  status: string
  created_at: string
}

const DOCUMENT_TYPES = [
  { value: 'business_license', label: '사업자등록증' },
  { value: 'financial_statement', label: '재무제표' },
  { value: 'tax_certificate', label: '납세증명서' },
  { value: 'employment_certificate', label: '4대보험 가입증명서' },
  { value: 'patent_certificate', label: '특허/지식재산 증명서' },
  { value: 'company_intro', label: '회사소개서' },
  { value: 'other', label: '기타' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  valid: { label: '유효', color: '#10b981', bgColor: '#064e3b', icon: CheckCircle },
  expiring_soon: { label: '만료임박', color: '#f59e0b', bgColor: '#451a03', icon: AlertCircle },
  expired: { label: '만료', color: '#ef4444', bgColor: '#450a0a', icon: AlertCircle },
  pending: { label: '준비중', color: '#71717a', bgColor: '#27272a', icon: Clock },
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<string>('')
  const [formData, setFormData] = useState({
    document_type: 'business_license',
    document_name: '',
    description: '',
    expiry_date: ''
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchDocuments()
  }, [filterType])

  const fetchDocuments = async () => {
    try {
      let url = '/api/government-programs/documents'
      if (filterType) url += `?document_type=${filterType}`
      const res = await fetch(url)
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const createDocument = async () => {
    if (!formData.document_name) return

    try {
      const res = await fetch('/api/government-programs/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.document) {
        await fetchDocuments()
        setShowForm(false)
        setFormData({
          document_type: 'business_license',
          document_name: '',
          description: '',
          expiry_date: ''
        })
      }
    } catch (error) {
      console.error('Failed to create document:', error)
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      await fetch(`/api/government-programs/documents?id=${id}`, { method: 'DELETE' })
      setDocuments(documents.filter(d => d.id !== id))
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const getTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type
  }

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null
    const expiry = new Date(expiryDate)
    const today = new Date()
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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
            <FolderOpen className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">서류 보관함</h1>
            <p className="text-sm text-zinc-400">신청에 필요한 서류를 관리합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          서류 등록
        </button>
      </div>

      {/* 유형 필터 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !filterType ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'
          }`}
        >
          전체
        </button>
        {DOCUMENT_TYPES.map(type => (
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
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const count = documents.filter(d => d.status === key).length
          const Icon = config.icon
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5" style={{ color: config.color }} />
                <span className="text-2xl font-bold" style={{ color: config.color }}>
                  {count}
                </span>
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
          <h3 className="text-lg font-semibold text-white">서류 등록</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">서류 유형</label>
              <select
                value={formData.document_type}
                onChange={e => setFormData({ ...formData, document_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">만료일</label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">서류명</label>
            <input
              type="text"
              value={formData.document_name}
              onChange={e => setFormData({ ...formData, document_name: e.target.value })}
              placeholder="예: 2026년 사업자등록증"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">설명 (선택)</label>
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
              onClick={createDocument}
              disabled={!formData.document_name}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              등록
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>등록된 서류가 없습니다</p>
          </div>
        ) : (
          documents.map((doc, index) => {
            const statusConfig = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending
            const daysUntilExpiry = getDaysUntilExpiry(doc.expiry_date)
            const StatusIcon = statusConfig.icon

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: `${themeColor}20` }}
                    >
                      <FileText className="w-6 h-6" style={{ color: themeColor }} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                        >
                          {getTypeLabel(doc.document_type)}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"
                          style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-white mb-1">
                        {doc.document_name}
                      </h3>

                      {doc.description && (
                        <p className="text-sm text-zinc-400 mb-2">{doc.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          등록: {doc.created_at?.split('T')[0]}
                        </span>
                        {doc.expiry_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            만료: {doc.expiry_date}
                            {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
                              <span className={daysUntilExpiry <= 30 ? 'text-amber-400' : ''}>
                                (D-{daysUntilExpiry})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <Upload className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id)}
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
