'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { formatRelativeTime } from '@/lib/utils'
import type { Task, TaskStatus, TaskPriority, CreateTaskInput } from '@/types/database'
import {
  ListTodo,
  Plus,
  Edit3,
  Trash2,
  Clock,
  User,
  Filter,
  Loader2,
  X,
  Check,
  AlertCircle,
  CheckCircle2,
  Circle,
  Timer,
  AlertTriangle,
} from 'lucide-react'

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  TODO: { label: '할 일', color: 'bg-gray-100 text-gray-700', icon: <Circle className="w-4 h-4" /> },
  IN_PROGRESS: { label: '진행 중', color: 'bg-blue-100 text-blue-700', icon: <Timer className="w-4 h-4" /> },
  DONE: { label: '완료', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
  BLOCKED: { label: '차단됨', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-4 h-4" /> },
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: '낮음', color: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: '보통', color: 'bg-yellow-100 text-yellow-700' },
  HIGH: { label: '높음', color: 'bg-orange-100 text-orange-700' },
  URGENT: { label: '긴급', color: 'bg-red-100 text-red-700' },
}

const CATEGORIES = ['개발', '디자인', '마케팅', '기획', '운영', '기타']

interface TaskWithAuthor extends Task {
  author?: { id: string; name: string; email: string; avatar_url?: string }
  startup?: { id: string; name: string }
}

export default function TasksPage() {
  const { user } = useAuthStore()
  const [tasks, setTasks] = useState<TaskWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskWithAuthor | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [startups, setStartups] = useState<{ id: string; name: string }[]>([])

  const [formData, setFormData] = useState<CreateTaskInput>({
    startup_id: '',
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    category: '',
    estimated_hours: undefined,
    due_date: '',
  })

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (filterStatus !== 'ALL') {
        params.append('status', filterStatus)
      }

      const response = await fetch(`/api/tasks?${params}`)
      const result = await response.json()

      if (result.data) {
        setTasks(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      setError('태스크 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [filterStatus])

  const fetchStartups = useCallback(async () => {
    try {
      const response = await fetch('/api/startups')
      const result = await response.json()
      if (result.data) {
        setStartups(result.data.map((s: any) => ({ id: s.id, name: s.name })))
        if (result.data.length > 0 && !formData.startup_id) {
          setFormData(prev => ({ ...prev, startup_id: result.data[0].id }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch startups:', err)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchStartups()
  }, [fetchTasks, fetchStartups])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks'
      const method = editingTask ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '저장에 실패했습니다.')
      }

      await fetchTasks()
      handleCloseModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('상태 변경에 실패했습니다.')
      }

      await fetchTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '삭제에 실패했습니다.')
      }

      await fetchTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    }
  }

  const handleEdit = (task: TaskWithAuthor) => {
    setEditingTask(task)
    setFormData({
      startup_id: task.startup_id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      category: task.category || '',
      estimated_hours: task.estimated_hours || undefined,
      due_date: task.due_date || '',
    })
    setShowCreateModal(true)
  }

  const handleCloseModal = () => {
    setShowCreateModal(false)
    setEditingTask(null)
    setFormData({
      startup_id: startups[0]?.id || '',
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      category: '',
      estimated_hours: undefined,
      due_date: '',
    })
    setError(null)
  }

  const groupedTasks = {
    TODO: tasks.filter(t => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
    DONE: tasks.filter(t => t.status === 'DONE'),
    BLOCKED: tasks.filter(t => t.status === 'BLOCKED'),
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />
          <p className="text-gray-500">태스크를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">태스크 관리</h1>
          <p className="text-gray-500 mt-1">팀의 업무를 추적하고 관리하세요</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          disabled={startups.length === 0}
        >
          태스크 추가
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === 'ALL' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilterStatus('ALL')}
          >
            전체
          </button>
          {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(status => (
            <button
              key={status}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setFilterStatus(status)}
            >
              {STATUS_CONFIG[status].label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-danger-500" />
          <p className="text-danger-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-danger-500" />
          </button>
        </motion.div>
      )}

      {/* No Startup Warning */}
      {startups.length === 0 && (
        <Card variant="default" className="py-8">
          <div className="text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-warning-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">스타트업을 먼저 등록하세요</h3>
            <p className="text-gray-500">태스크를 생성하려면 먼저 스타트업을 등록해야 합니다.</p>
            <Button variant="outline" onClick={() => window.location.href = '/dashboard-group/startup'}>
              스타트업 등록하기
            </Button>
          </div>
        </Card>
      )}

      {/* Kanban Board */}
      {filterStatus === 'ALL' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(groupedTasks) as TaskStatus[]).map(status => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${STATUS_CONFIG[status].color}`}>
                    {STATUS_CONFIG[status].icon}
                  </span>
                  <h3 className="font-semibold text-gray-900">{STATUS_CONFIG[status].label}</h3>
                </div>
                <span className="text-sm text-gray-400">{groupedTasks[status].length}</span>
              </div>

              <div className="space-y-3 min-h-[200px]">
                {groupedTasks[status].map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              expanded
            />
          ))}
          {tasks.length === 0 && (
            <Card variant="default" className="py-12">
              <div className="text-center space-y-3">
                <ListTodo className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-gray-500">해당 상태의 태스크가 없습니다.</p>
              </div>
            </Card>
          )}
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingTask ? '태스크 수정' : '새 태스크 추가'}
                  </h2>
                  <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {!editingTask && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">스타트업</label>
                    <select
                      className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500"
                      value={formData.startup_id}
                      onChange={e => setFormData({ ...formData, startup_id: e.target.value })}
                      required
                    >
                      {startups.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  label="제목"
                  placeholder="태스크 제목을 입력하세요"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
                  <textarea
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 resize-none"
                    rows={3}
                    placeholder="태스크에 대한 상세 설명"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
                    <select
                      className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    >
                      {(Object.keys(STATUS_CONFIG) as TaskStatus[]).map(status => (
                        <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">우선순위</label>
                    <select
                      className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    >
                      {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map(priority => (
                        <option key={priority} value={priority}>{PRIORITY_CONFIG[priority].label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
                    <select
                      className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="">선택 안함</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <Input
                    label="예상 시간 (h)"
                    type="number"
                    placeholder="0"
                    min={0}
                    value={formData.estimated_hours || ''}
                    onChange={e => setFormData({ ...formData, estimated_hours: parseInt(e.target.value) || undefined })}
                  />
                </div>

                <Input
                  label="마감일"
                  type="date"
                  value={formData.due_date}
                  onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                />

                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                    <p className="text-sm text-danger-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={handleCloseModal}>
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" isLoading={isSubmitting} leftIcon={<Check className="w-4 h-4" />}>
                    {editingTask ? '수정하기' : '추가하기'}
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

// Task Card Component
function TaskCard({
  task,
  index,
  onEdit,
  onDelete,
  onStatusChange,
  expanded = false,
}: {
  task: TaskWithAuthor
  index: number
  onEdit: (task: TaskWithAuthor) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
  expanded?: boolean
}) {
  const priorityConfig = PRIORITY_CONFIG[task.priority]
  const statusConfig = STATUS_CONFIG[task.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card variant="default" className="p-4 hover:shadow-md transition-shadow cursor-pointer group">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2">
              {task.title}
            </h4>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="p-1.5 hover:bg-danger-50 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5 text-danger-400" />
              </button>
            </div>
          </div>

          {task.description && expanded && (
            <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
            {task.category && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {task.category}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{task.author?.name || '알 수 없음'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(task.created_at)}</span>
            </div>
          </div>

          {expanded && (
            <div className="pt-2 border-t border-gray-100 flex gap-2">
              {(Object.keys(STATUS_CONFIG) as TaskStatus[])
                .filter(s => s !== task.status)
                .map(status => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(task.id, status)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${STATUS_CONFIG[status].color} hover:opacity-80`}
                  >
                    {STATUS_CONFIG[status].label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}
