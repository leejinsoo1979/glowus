'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Archive, Search, FolderOpen, FileText, Download,
  Calendar, Tag, Filter, ChevronRight
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface ArchiveItem {
  id: string
  title: string
  type: 'report' | 'document' | 'evidence' | 'meeting' | 'other'
  category: string
  file_url: string | null
  file_size: number | null
  created_at: string
  tags: string[]
  contract?: {
    id: string
    contract_name: string
  }
}

const TYPE_CONFIG = {
  report: { label: '보고서', color: '#3b82f6' },
  document: { label: '문서', color: '#10b981' },
  evidence: { label: '증빙', color: '#f59e0b' },
  meeting: { label: '회의록', color: '#8b5cf6' },
  other: { label: '기타', color: '#71717a' },
}

export default function ArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchArchive()
  }, [filterType])

  const fetchArchive = async () => {
    try {
      // Mock data - in real app, fetch from API
      const mockItems: ArchiveItem[] = [
        {
          id: '1',
          title: '2025년 4분기 중간보고서',
          type: 'report',
          category: '정기보고',
          file_url: '/files/report-q4.pdf',
          file_size: 2456000,
          created_at: '2025-12-15T10:00:00Z',
          tags: ['중간보고', '연구개발', '2025'],
          contract: { id: '1', contract_name: 'AI 기술개발 과제' }
        },
        {
          id: '2',
          title: '기술개발 회의록 - 12월',
          type: 'meeting',
          category: '회의',
          file_url: '/files/meeting-dec.pdf',
          file_size: 156000,
          created_at: '2025-12-20T14:00:00Z',
          tags: ['회의록', '개발', '12월'],
          contract: { id: '1', contract_name: 'AI 기술개발 과제' }
        },
        {
          id: '3',
          title: '외주개발 계약서',
          type: 'document',
          category: '계약',
          file_url: '/files/contract.pdf',
          file_size: 890000,
          created_at: '2025-11-01T09:00:00Z',
          tags: ['계약', '외주', '개발'],
          contract: { id: '1', contract_name: 'AI 기술개발 과제' }
        },
        {
          id: '4',
          title: '장비 구매 영수증',
          type: 'evidence',
          category: '증빙',
          file_url: '/files/receipt.pdf',
          file_size: 234000,
          created_at: '2025-10-15T11:00:00Z',
          tags: ['증빙', '장비', '구매'],
          contract: { id: '1', contract_name: 'AI 기술개발 과제' }
        },
      ]

      let filtered = mockItems
      if (filterType) {
        filtered = filtered.filter(item => item.type === filterType)
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        filtered = filtered.filter(item =>
          item.title.toLowerCase().includes(term) ||
          item.tags.some(tag => tag.toLowerCase().includes(term))
        )
      }
      setItems(filtered)
    } catch (error) {
      console.error('Failed to fetch archive:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
          <Archive className="w-6 h-6" style={{ color: themeColor }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">자료 보관함</h1>
          <p className="text-sm text-zinc-400">과제 관련 문서와 자료를 보관합니다</p>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && fetchArchive()}
            placeholder="문서명, 태그로 검색..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-white placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
          />
        </div>
        <button
          onClick={() => fetchArchive()}
          className="px-6 py-3 rounded-xl text-white"
          style={{ backgroundColor: themeColor }}
        >
          검색
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
        {Object.entries(TYPE_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilterType(key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterType === key ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterType === key ? { backgroundColor: `${config.color}20`, color: config.color } : {}}
          >
            {config.label}
          </button>
        ))}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(TYPE_CONFIG).map(([key, config], index) => {
          const count = items.filter(item => item.type === key).length
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
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

      {/* 파일 목록 */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>보관된 자료가 없습니다</p>
          </div>
        ) : (
          items.map((item, index) => {
            const typeConfig = TYPE_CONFIG[item.type]

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${typeConfig.color}20` }}
                  >
                    <FileText className="w-6 h-6" style={{ color: typeConfig.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
                      >
                        {typeConfig.label}
                      </span>
                      <span className="text-xs text-zinc-500">{item.category}</span>
                    </div>
                    <h3 className="text-white font-medium truncate">{item.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-zinc-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.created_at.split('T')[0]}
                      </span>
                      <span>{formatFileSize(item.file_size)}</span>
                      {item.contract && (
                        <span className="truncate">{item.contract.contract_name}</span>
                      )}
                    </div>
                    {item.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Tag className="w-3.5 h-3.5 text-zinc-600" />
                        {item.tags.map((tag, idx) => (
                          <span key={idx} className="text-xs text-zinc-500">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.file_url && (
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <button className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
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
