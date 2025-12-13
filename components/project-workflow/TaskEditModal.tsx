'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectTaskWithAssignee, ProjectTaskStatus, ProjectTaskPriority } from '@/types/database'

interface TaskEditModalProps {
  task: ProjectTaskWithAssignee | null
  projectId: string
  defaultStatus?: ProjectTaskStatus
  onSave: (task: Partial<ProjectTaskWithAssignee>) => void
  onClose: () => void
}

const STATUS_OPTIONS: { value: ProjectTaskStatus; label: string }[] = [
  { value: 'TODO', label: '할 일' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'REVIEW', label: '검토' },
  { value: 'DONE', label: '완료' },
]

const PRIORITY_OPTIONS: { value: ProjectTaskPriority; label: string }[] = [
  { value: 'URGENT', label: '긴급' },
  { value: 'HIGH', label: '높음' },
  { value: 'MEDIUM', label: '중간' },
  { value: 'LOW', label: '낮음' },
]

export function TaskEditModal({ task, projectId, defaultStatus, onSave, onClose }: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || defaultStatus || 'TODO',
    priority: task?.priority || 'MEDIUM',
    estimated_hours: task?.estimated_hours || '',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    category: task?.category || '',
    tags: task?.tags?.join(', ') || '',
  })

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      alert('태스크 제목을 입력해주세요')
      return
    }

    setSaving(true)
    try {
      await onSave({
        id: task?.id,
        title: formData.title,
        description: formData.description || null,
        status: formData.status as ProjectTaskStatus,
        priority: formData.priority as ProjectTaskPriority,
        estimated_hours: formData.estimated_hours ? Number(formData.estimated_hours) : null,
        due_date: formData.due_date || null,
        category: formData.category || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            {task ? '태스크 편집' : '새 태스크'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              제목 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="태스크 제목"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder="태스크 설명"
              rows={3}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                상태
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProjectTaskStatus }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                우선순위
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as ProjectTaskPriority }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimated Hours & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                예상 시간 (시간)
              </label>
              <input
                type="number"
                value={formData.estimated_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="예: 4"
                min="0"
                step="0.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                마감일
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              카테고리
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="예: 기획, 디자인, 개발"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              태그 (쉼표로 구분)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="예: 프론트엔드, API, 리팩토링"
            />
          </div>

          {/* Agent Result (read-only) */}
          {task?.agent_result && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                🤖 에이전트 실행 결과
              </label>
              <div className="p-4 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800">
                {/* 실행 시간 */}
                {(task.agent_result as any).executed_at && (
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-violet-200 dark:border-violet-700">
                    <span className="text-xs text-violet-600 dark:text-violet-400">
                      ✅ 완료: {new Date((task.agent_result as any).executed_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                )}
                {/* 결과 내용 */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {(task.agent_result as any).output || '결과 없음'}
                  </div>
                </div>
                {/* 출처 */}
                {(task.agent_result as any).sources?.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-violet-200 dark:border-violet-700">
                    <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-2">📎 출처</p>
                    <ul className="space-y-1">
                      {(task.agent_result as any).sources.map((src: string, idx: number) => (
                        <li key={idx}>
                          <a
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                          >
                            {src}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agent Error (read-only) */}
          {task?.agent_error && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                에이전트 오류
              </label>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">{task.agent_error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-accent text-white hover:bg-accent/90 transition-colors',
                saving && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Save className="w-4 h-4" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
