'use client'

import { useState, useCallback } from 'react'
import {
  LayoutGrid,
  List,
  Calendar,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { KanbanBoard } from './board'
import { ListView } from './views/ListView'
import { TaskModal } from './modals/TaskModal'
import { useTaskHub } from './hooks/useTaskHub'
import type {
  TaskWithDetails,
  TaskStatus,
  TaskViewType,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '@/types/task-hub'
import { TASK_STATUS_COLUMNS, TASK_PRIORITIES } from '@/types/task-hub'
import { cn } from '@/lib/utils'

interface TaskHubPageProps {
  companyId?: string
  projectId?: string
  projects?: Array<{ id: string; name: string }>
  agents?: Array<{ id: string; name: string }>
  users?: Array<{ id: string; name: string; email: string }>
}

export function TaskHubPage({
  companyId,
  projectId,
  projects = [],
  agents = [],
  users = [],
}: TaskHubPageProps) {
  const {
    tasks,
    isLoading,
    error,
    view,
    filters,
    selectedTask,
    setView,
    setFilters,
    selectTask,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
  } = useTaskHub({ companyId, projectId })

  // 모달 상태
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTask, setModalTask] = useState<TaskWithDetails | null>(null)
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>('TODO')

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // 새 Task 생성 모달 열기
  const handleCreateTask = useCallback((status: TaskStatus = 'TODO') => {
    setModalTask(null)
    setModalInitialStatus(status)
    setIsModalOpen(true)
  }, [])

  // Task 편집 모달 열기
  const handleEditTask = useCallback((task: TaskWithDetails) => {
    setModalTask(task)
    setIsModalOpen(true)
  }, [])

  // 모달 저장
  const handleSaveTask = useCallback(async (data: CreateTaskRequest | UpdateTaskRequest) => {
    if (modalTask) {
      await updateTask(modalTask.id, data as UpdateTaskRequest)
    } else {
      await createTask(data as CreateTaskRequest)
    }
  }, [modalTask, createTask, updateTask])

  // 상태 변경 (ListView에서)
  const handleStatusChange = useCallback((taskId: string, newStatus: TaskStatus) => {
    updateTask(taskId, { status: newStatus })
  }, [updateTask])

  // 검색 처리
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ search: searchQuery })
  }, [searchQuery, setFilters])

  // 뷰 아이콘 컴포넌트
  const ViewIcon = ({ type }: { type: TaskViewType }) => {
    switch (type) {
      case 'kanban': return <LayoutGrid className="w-4 h-4" />
      case 'list': return <List className="w-4 h-4" />
      case 'calendar': return <Calendar className="w-4 h-4" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
            Task Hub
          </h1>

          {/* 뷰 전환 */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            {(['kanban', 'list'] as TaskViewType[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  view === v
                    ? 'bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                )}
              >
                <ViewIcon type={v} />
                {v === 'kanban' ? 'Kanban' : 'List'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 검색 */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Task 검색..."
              className="w-64 pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg text-sm focus:ring-2 focus:ring-accent"
            />
          </form>

          {/* 필터 버튼 */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors',
              showFilters
                ? 'bg-accent text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            )}
          >
            <Filter className="w-4 h-4" />
            필터
          </button>

          {/* 새로고침 */}
          <button
            onClick={() => fetchTasks()}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-4 h-4 text-zinc-600 dark:text-zinc-400', isLoading && 'animate-spin')} />
          </button>

          {/* Task 추가 버튼 */}
          <button
            onClick={() => handleCreateTask()}
            className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Task
          </button>
        </div>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          {/* 상태 필터 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">상태:</span>
            <div className="flex gap-1">
              {TASK_STATUS_COLUMNS.slice(0, 5).map(status => (
                <button
                  key={status.id}
                  onClick={() => {
                    const current = filters.status
                    if (current === status.id) {
                      setFilters({ status: undefined })
                    } else {
                      setFilters({ status: status.id })
                    }
                  }}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    filters.status === status.id
                      ? 'text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                  )}
                  style={filters.status === status.id ? { backgroundColor: status.color } : {}}
                >
                  {status.name}
                </button>
              ))}
            </div>
          </div>

          {/* 우선순위 필터 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">우선순위:</span>
            <div className="flex gap-1">
              {TASK_PRIORITIES.filter(p => p.id !== 'NONE').map(priority => (
                <button
                  key={priority.id}
                  onClick={() => {
                    if (filters.priority === priority.id) {
                      setFilters({ priority: undefined })
                    } else {
                      setFilters({ priority: priority.id })
                    }
                  }}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    filters.priority === priority.id
                      ? 'text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                  )}
                  style={filters.priority === priority.id ? { backgroundColor: priority.color } : {}}
                >
                  {priority.icon} {priority.name}
                </button>
              ))}
            </div>
          </div>

          {/* 필터 초기화 */}
          {(filters.status || filters.priority || filters.search) && (
            <button
              onClick={() => {
                setFilters({ status: undefined, priority: undefined, search: undefined })
                setSearchQuery('')
              }}
              className="text-xs text-accent hover:underline"
            >
              필터 초기화
            </button>
          )}
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? (
          <KanbanBoard
            tasks={tasks}
            onTaskMove={moveTask}
            onTaskClick={handleEditTask}
            onTaskCreate={handleCreateTask}
            isLoading={isLoading}
          />
        ) : (
          <ListView
            tasks={tasks}
            onTaskClick={handleEditTask}
            onStatusChange={handleStatusChange}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Task 생성/편집 모달 */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        task={modalTask}
        initialStatus={modalInitialStatus}
        projects={projects}
        agents={agents}
        users={users}
      />
    </div>
  )
}
