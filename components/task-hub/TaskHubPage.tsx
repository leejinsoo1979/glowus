'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Zap,
  TrendingUp,
  CalendarDays,
  Users,
  Bot,
  ChevronDown,
  Sparkles,
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
import { useThemeStore } from '@/stores/themeStore'

// 테마 색상 목록
const accentColors = [
  { id: 'indigo', color: '#6366f1' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'sky', color: '#0ea5e9' },
  { id: 'cyan', color: '#06b6d4' },
  { id: 'teal', color: '#14b8a6' },
  { id: 'green', color: '#22c55e' },
  { id: 'emerald', color: '#10b981' },
  { id: 'orange', color: '#f97316' },
  { id: 'rose', color: '#f43f5e' },
  { id: 'pink', color: '#ec4899' },
]

interface TaskHubPageProps {
  companyId?: string
  projectId?: string
  projects?: Array<{ id: string; name: string }>
  agents?: Array<{ id: string; name: string }>
  users?: Array<{ id: string; name: string; email: string }>
}

// Glass Card Component
const GlassCard = ({ children, className = '', hover = true }: { children: React.ReactNode; className?: string; hover?: boolean }) => (
  <div className={cn(
    'bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl',
    hover && 'hover:bg-white/8 hover:border-white/15 transition-all duration-300',
    className
  )}>
    {children}
  </div>
)

// Stat Card Component
const StatCard = ({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  percentage,
}: {
  icon: any;
  label: string;
  value: number | string;
  subtext?: string;
  color: string;
  percentage?: number;
}) => (
  <GlassCard className="p-4 flex items-center gap-4">
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center"
      style={{ backgroundColor: `${color}20` }}
    >
      <Icon className="w-6 h-6" style={{ color }} />
    </div>
    <div className="flex-1">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {percentage !== undefined && (
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            percentage >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          )}>
            {percentage >= 0 ? '+' : ''}{percentage}%
          </span>
        )}
      </div>
      {subtext && <p className="text-xs text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  </GlassCard>
)

// Quick Filter Button
const QuickFilterButton = ({
  active,
  onClick,
  children,
  color
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
      active
        ? 'text-white shadow-lg'
        : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
    )}
    style={active ? { backgroundColor: color || '#6366f1' } : {}}
  >
    {children}
  </button>
)

export function TaskHubPage({
  companyId,
  projectId,
  projects = [],
  agents = [],
  users = [],
}: TaskHubPageProps) {
  const { accentColor } = useThemeStore()
  const themeColor = accentColors.find(c => c.id === accentColor)?.color || '#6366f1'

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

  // 통계 계산
  const stats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter(t => t.status === 'DONE').length
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const todo = tasks.filter(t => t.status === 'TODO').length
    const highPriority = tasks.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length
    const overdue = tasks.filter(t => {
      if (!t.due_date) return false
      return new Date(t.due_date) < new Date() && t.status !== 'DONE'
    }).length

    // 이번 주 완료율 (간단히 계산)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, inProgress, todo, highPriority, overdue, completionRate }
  }, [tasks])

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

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header Section */}
      <div className="px-6 pt-6 pb-4">
        {/* Title Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)`,
                boxShadow: `0 4px 20px ${themeColor}40`
              }}
            >
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(to right, ${themeColor}, ${themeColor}cc)` }}
              >
                Task Hub
              </h1>
              <p className="text-sm text-zinc-500">프로젝트 태스크를 효율적으로 관리하세요</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTasks()}
              className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group"
              disabled={isLoading}
            >
              <RefreshCw className={cn(
                'w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors',
                isLoading && 'animate-spin'
              )} />
            </button>

            <button
              onClick={() => handleCreateTask()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all duration-200 hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                boxShadow: `0 4px 15px ${themeColor}40`
              }}
            >
              <Plus className="w-4 h-4" />
              새 태스크
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <StatCard
            icon={Circle}
            label="전체 태스크"
            value={stats.total}
            subtext={`${stats.completionRate}% 완료`}
            color={themeColor}
          />
          <StatCard
            icon={Clock}
            label="진행 중"
            value={stats.inProgress}
            subtext={`${stats.todo}개 대기 중`}
            color="#f59e0b"
          />
          <StatCard
            icon={CheckCircle2}
            label="완료"
            value={stats.completed}
            percentage={12}
            color="#22c55e"
          />
          <StatCard
            icon={AlertCircle}
            label="마감 임박"
            value={stats.overdue}
            subtext="기한 초과"
            color="#ef4444"
          />
          <StatCard
            icon={Sparkles}
            label="우선순위 높음"
            value={stats.highPriority}
            subtext="긴급/높음"
            color="#f97316"
          />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          {/* Left: View Toggle & Filters */}
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center bg-white/5 rounded-xl p-1">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  view === 'kanban'
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  view === 'list'
                    ? 'bg-white/10 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                )}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <QuickFilterButton
                active={!filters.status && !filters.priority}
                onClick={() => setFilters({ status: undefined, priority: undefined })}
                color={themeColor}
              >
                전체
              </QuickFilterButton>
              <QuickFilterButton
                active={filters.status === 'IN_PROGRESS'}
                onClick={() => setFilters({ status: filters.status === 'IN_PROGRESS' ? undefined : 'IN_PROGRESS' })}
                color="#f59e0b"
              >
                🔄 진행 중
              </QuickFilterButton>
              <QuickFilterButton
                active={filters.priority === 'URGENT'}
                onClick={() => setFilters({ priority: filters.priority === 'URGENT' ? undefined : 'URGENT' })}
                color="#ef4444"
              >
                🔥 긴급
              </QuickFilterButton>
              <QuickFilterButton
                active={filters.priority === 'HIGH'}
                onClick={() => setFilters({ priority: filters.priority === 'HIGH' ? undefined : 'HIGH' })}
                color="#f97316"
              >
                ⚡ 높음
              </QuickFilterButton>
            </div>

            {/* More Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all',
                showFilters
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              )}
            >
              <Filter className="w-4 h-4" />
              필터
              <ChevronDown className={cn('w-3 h-3 transition-transform', showFilters && 'rotate-180')} />
            </button>
          </div>

          {/* Right: Search */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="태스크 검색..."
              className="w-72 pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all"
            />
          </form>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="px-6 pb-4">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center gap-6">
              {/* 상태 필터 */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-400">상태</span>
                <div className="flex gap-1.5">
                  {TASK_STATUS_COLUMNS.slice(0, 5).map(status => (
                    <button
                      key={status.id}
                      onClick={() => {
                        if (filters.status === status.id) {
                          setFilters({ status: undefined })
                        } else {
                          setFilters({ status: status.id })
                        }
                      }}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-lg transition-all duration-200',
                        filters.status === status.id
                          ? 'text-white shadow-lg'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      )}
                      style={filters.status === status.id ? { backgroundColor: status.color } : {}}
                    >
                      {status.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-px h-8 bg-white/10" />

              {/* 우선순위 필터 */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-400">우선순위</span>
                <div className="flex gap-1.5">
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
                        'px-2.5 py-1 text-xs rounded-lg transition-all duration-200',
                        filters.priority === priority.id
                          ? 'text-white shadow-lg'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10'
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
                <>
                  <div className="w-px h-8 bg-white/10" />
                  <button
                    onClick={() => {
                      setFilters({ status: undefined, priority: undefined, search: undefined })
                      setSearchQuery('')
                    }}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    초기화
                  </button>
                </>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-6 mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <GlassCard className="h-full overflow-hidden" hover={false}>
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
        </GlassCard>
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
