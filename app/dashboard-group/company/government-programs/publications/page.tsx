'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, Plus, Trash2, ExternalLink, Calendar,
  Users, Award, Tag
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Publication {
  id: string
  publication_type: string
  title: string
  authors: string[]
  journal_name: string | null
  volume: string | null
  issue: string | null
  pages: string | null
  published_date: string | null
  doi: string | null
  url: string | null
  impact_factor: number | null
  citation_count: number | null
  contract?: {
    id: string
    contract_name: string
  }
}

const PUBLICATION_TYPES = [
  { value: 'journal', label: '학술논문' },
  { value: 'conference', label: '학회발표' },
  { value: 'book', label: '저서' },
  { value: 'report', label: '연구보고서' },
  { value: 'other', label: '기타' },
]

export default function PublicationsPage() {
  const [publications, setPublications] = useState<Publication[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterType, setFilterType] = useState<string>('')
  const [formData, setFormData] = useState({
    publication_type: 'journal',
    title: '',
    authors: [''],
    journal_name: '',
    volume: '',
    issue: '',
    pages: '',
    published_date: '',
    doi: '',
    url: ''
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchPublications()
  }, [filterType])

  const fetchPublications = async () => {
    try {
      let url = '/api/government-programs/publications'
      if (filterType) url += `?publication_type=${filterType}`
      const res = await fetch(url)
      const data = await res.json()
      setPublications(data.publications || [])
    } catch (error) {
      console.error('Failed to fetch publications:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPublication = async () => {
    if (!formData.title) return

    try {
      const res = await fetch('/api/government-programs/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          authors: formData.authors.filter(a => a.trim())
        })
      })
      const data = await res.json()
      if (data.publication) {
        await fetchPublications()
        setShowForm(false)
        setFormData({
          publication_type: 'journal',
          title: '',
          authors: [''],
          journal_name: '',
          volume: '',
          issue: '',
          pages: '',
          published_date: '',
          doi: '',
          url: ''
        })
      }
    } catch (error) {
      console.error('Failed to create publication:', error)
    }
  }

  const deletePublication = async (id: string) => {
    try {
      await fetch(`/api/government-programs/publications?id=${id}`, { method: 'DELETE' })
      setPublications(publications.filter(p => p.id !== id))
    } catch (error) {
      console.error('Failed to delete publication:', error)
    }
  }

  const addAuthor = () => {
    setFormData({ ...formData, authors: [...formData.authors, ''] })
  }

  const updateAuthor = (index: number, value: string) => {
    const newAuthors = [...formData.authors]
    newAuthors[index] = value
    setFormData({ ...formData, authors: newAuthors })
  }

  const removeAuthor = (index: number) => {
    if (formData.authors.length > 1) {
      const newAuthors = formData.authors.filter((_, i) => i !== index)
      setFormData({ ...formData, authors: newAuthors })
    }
  }

  const getTypeLabel = (type: string) => {
    return PUBLICATION_TYPES.find(t => t.value === type)?.label || type
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
            <BookOpen className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">논문/발표</h1>
            <p className="text-sm text-zinc-400">연구성과 논문 및 발표 자료를 관리합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          논문 등록
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
        {PUBLICATION_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => setFilterType(type.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filterType === type.value ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
            style={filterType === type.value ? { backgroundColor: `${themeColor}20`, color: themeColor } : {}}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {PUBLICATION_TYPES.map((type, index) => {
          const count = publications.filter(p => p.publication_type === type.value).length
          return (
            <motion.div
              key={type.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center"
            >
              <div className="text-2xl font-bold" style={{ color: themeColor }}>
                {count}
              </div>
              <div className="text-sm text-zinc-400">{type.label}</div>
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
          <h3 className="text-lg font-semibold text-white">논문/발표 등록</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">유형</label>
              <select
                value={formData.publication_type}
                onChange={e => setFormData({ ...formData, publication_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {PUBLICATION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">게재일</label>
              <input
                type="date"
                value={formData.published_date}
                onChange={e => setFormData({ ...formData, published_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">제목</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="논문/발표 제목"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">저자</label>
            {formData.authors.map((author, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={author}
                  onChange={e => updateAuthor(index, e.target.value)}
                  placeholder="저자명"
                  className="flex-1 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
                />
                {formData.authors.length > 1 && (
                  <button
                    onClick={() => removeAuthor(index)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-red-500/20 hover:text-red-400"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addAuthor}
              className="text-sm text-zinc-400 hover:text-white"
            >
              + 저자 추가
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">학술지/학회명</label>
              <input
                type="text"
                value={formData.journal_name}
                onChange={e => setFormData({ ...formData, journal_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">권(Vol)</label>
              <input
                type="text"
                value={formData.volume}
                onChange={e => setFormData({ ...formData, volume: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">페이지</label>
              <input
                type="text"
                value={formData.pages}
                onChange={e => setFormData({ ...formData, pages: e.target.value })}
                placeholder="pp. 1-10"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">DOI</label>
              <input
                type="text"
                value={formData.doi}
                onChange={e => setFormData({ ...formData, doi: e.target.value })}
                placeholder="10.xxxx/xxxxx"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createPublication}
              disabled={!formData.title}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              등록
            </button>
          </div>
        </motion.div>
      )}

      {/* 논문 목록 */}
      <div className="space-y-4">
        {publications.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>등록된 논문/발표가 없습니다</p>
          </div>
        ) : (
          publications.map((pub, index) => (
            <motion.div
              key={pub.id}
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
                      {getTypeLabel(pub.publication_type)}
                    </span>
                    {pub.impact_factor && (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        IF: {pub.impact_factor}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2">{pub.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {pub.authors?.join(', ')}
                    </span>
                    {pub.journal_name && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-4 h-4" />
                        {pub.journal_name}
                        {pub.volume && ` Vol.${pub.volume}`}
                        {pub.pages && ` ${pub.pages}`}
                      </span>
                    )}
                    {pub.published_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {pub.published_date}
                      </span>
                    )}
                  </div>

                  {pub.doi && (
                    <div className="mt-2 text-sm text-zinc-500">
                      DOI: {pub.doi}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {pub.url && (
                    <a
                      href={pub.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => deletePublication(pub.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
