'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardCheck, Plus, Check, Circle, Trash2,
  ChevronDown, ChevronRight, FileText
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface ChecklistItem {
  name: string
  description: string
  required: boolean
  completed: boolean
  completed_at: string | null
  order: number
}

interface Checklist {
  id: string
  name: string
  items: ChecklistItem[]
  status: string
  program?: { id: string; title: string }
  template?: { id: string; name: string; program_type: string }
  created_at: string
}

interface Template {
  id: string
  program_type: string
  name: string
  items: any[]
}

export default function ChecklistPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const { themeColor } = useThemeStore()

  useEffect(() => {
    Promise.all([fetchChecklists(), fetchTemplates()])
  }, [])

  const fetchChecklists = async () => {
    try {
      const res = await fetch('/api/government-programs/checklists')
      const data = await res.json()
      setChecklists(data.checklists || [])
    } catch (error) {
      console.error('Failed to fetch checklists:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/government-programs/checklists?templates=true')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const createChecklist = async () => {
    if (!newName.trim()) return

    try {
      const res = await fetch('/api/government-programs/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          template_id: selectedTemplate || undefined
        })
      })
      const data = await res.json()
      if (data.checklist) {
        setChecklists([data.checklist, ...checklists])
        setShowForm(false)
        setNewName('')
        setSelectedTemplate('')
      }
    } catch (error) {
      console.error('Failed to create checklist:', error)
    }
  }

  const toggleItem = async (checklistId: string, itemIndex: number) => {
    const checklist = checklists.find(c => c.id === checklistId)
    if (!checklist) return

    const updatedItems = [...checklist.items]
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      completed: !updatedItems[itemIndex].completed,
      completed_at: !updatedItems[itemIndex].completed ? new Date().toISOString() : null
    }

    try {
      const res = await fetch('/api/government-programs/checklists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: checklistId, items: updatedItems })
      })
      const data = await res.json()
      if (data.checklist) {
        setChecklists(checklists.map(c => c.id === checklistId ? data.checklist : c))
      }
    } catch (error) {
      console.error('Failed to update checklist:', error)
    }
  }

  const deleteChecklist = async (id: string) => {
    try {
      await fetch(`/api/government-programs/checklists?id=${id}`, { method: 'DELETE' })
      setChecklists(checklists.filter(c => c.id !== id))
    } catch (error) {
      console.error('Failed to delete checklist:', error)
    }
  }

  const getProgress = (items: ChecklistItem[]) => {
    if (!items?.length) return 0
    const completed = items.filter(i => i.completed).length
    return Math.round((completed / items.length) * 100)
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
            <ClipboardCheck className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">신청 요건 체크리스트</h1>
            <p className="text-sm text-zinc-400">지원사업 신청 전 준비사항을 점검합니다</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: themeColor, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          체크리스트 추가
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">새 체크리스트 만들기</h3>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">체크리스트 이름</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="예: 2026년 TIPS 신청 준비"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">템플릿 선택 (선택사항)</label>
            <select
              value={selectedTemplate}
              onChange={e => setSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            >
              <option value="">템플릿 없이 시작</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createChecklist}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              만들기
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {checklists.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <ClipboardCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>체크리스트가 없습니다</p>
            <p className="text-sm mt-2">템플릿을 사용해서 쉽게 시작하세요</p>
          </div>
        ) : (
          checklists.map((checklist, index) => {
            const progress = getProgress(checklist.items)
            const isExpanded = expandedId === checklist.id

            return (
              <motion.div
                key={checklist.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden"
              >
                <div
                  className="p-5 cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : checklist.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                      )}
                      <div>
                        <h3 className="font-medium text-white">{checklist.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                          {checklist.template && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {checklist.template.name}
                            </span>
                          )}
                          <span>{checklist.items?.length || 0}개 항목</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-zinc-400">진행률</span>
                          <span style={{ color: themeColor }}>{progress}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${progress}%`, backgroundColor: themeColor }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChecklist(checklist.id)
                        }}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && checklist.items?.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-zinc-800"
                  >
                    <div className="p-5 space-y-3">
                      {checklist.items
                        .sort((a, b) => a.order - b.order)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                              item.completed ? 'bg-emerald-500/10' : 'bg-zinc-800/50 hover:bg-zinc-800'
                            }`}
                          >
                            <button
                              onClick={() => toggleItem(checklist.id, idx)}
                              className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                item.completed
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-zinc-600 hover:border-zinc-500'
                              }`}
                            >
                              {item.completed && <Check className="w-3 h-3" />}
                            </button>
                            <div className="flex-1">
                              <div className={`font-medium ${item.completed ? 'text-zinc-500 line-through' : 'text-white'}`}>
                                {item.name}
                                {item.required && (
                                  <span className="ml-2 text-xs text-red-400">필수</span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-zinc-500 mt-0.5">{item.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
