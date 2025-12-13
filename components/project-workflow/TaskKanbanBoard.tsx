'use client'

import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { Plus, Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskCard } from './TaskCard'
import { TaskEditModal } from './TaskEditModal'
import { TaskAssignModal } from './TaskAssignModal'
import type { ProjectTaskWithAssignee, ProjectTaskStatus } from '@/types/database'

interface TaskKanbanBoardProps {
  projectId: string
  className?: string
}

interface Column {
  id: ProjectTaskStatus
  title: string
  color: string
}

const COLUMNS: Column[] = [
  { id: 'TODO', title: '할 일', color: 'border-zinc-400' },
  { id: 'IN_PROGRESS', title: '진행 중', color: 'border-blue-500' },
  { id: 'REVIEW', title: '검토', color: 'border-yellow-500' },
  { id: 'DONE', title: '완료', color: 'border-green-500' },
]

export function TaskKanbanBoard({ projectId, className }: TaskKanbanBoardProps) {
  const [tasks, setTasks] = useState<ProjectTaskWithAssignee[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [editingTask, setEditingTask] = useState<ProjectTaskWithAssignee | null>(null)
  const [assigningTask, setAssigningTask] = useState<ProjectTaskWithAssignee | null>(null)
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState<ProjectTaskStatus>('TODO')

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Generate workflow with AI
  const handleGenerateWorkflow = async () => {
    if (generating) return

    const confirmed = tasks.length > 0
      ? window.confirm('기존 태스크를 유지하고 새 워크플로우를 추가할까요? (취소를 누르면 기존 태스크를 삭제합니다)')
      : true

    setGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clear_existing: tasks.length > 0 && !confirmed,
        }),
      })

      if (res.ok) {
        await fetchTasks()
      } else {
        const error = await res.json()
        alert(error.error || '워크플로우 생성에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to generate workflow:', error)
      alert('워크플로우 생성에 실패했습니다')
    } finally {
      setGenerating(false)
    }
  }

  // Handle drag end
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const taskId = draggableId
    const newStatus = destination.droppableId as ProjectTaskStatus

    // Optimistic update
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId)
      if (!task) return prev

      return prev.map(t =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    })

    // Update on server
    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (error) {
      console.error('Failed to update task status:', error)
      fetchTasks() // Revert on error
    }
  }

  // Handle task delete
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('이 태스크를 삭제할까요?')) return

    setTasks(prev => prev.filter(t => t.id !== taskId))

    try {
      await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error('Failed to delete task:', error)
      fetchTasks()
    }
  }

  // Handle task save (create/update)
  const handleSaveTask = async (task: Partial<ProjectTaskWithAssignee>) => {
    try {
      if (task.id) {
        // Update
        const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        })
        if (res.ok) {
          const updated = await res.json()
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
        }
      } else {
        // Create
        const res = await fetch(`/api/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...task,
            status: newTaskColumn,
          }),
        })
        if (res.ok) {
          const created = await res.json()
          setTasks(prev => [...prev, created])
        }
      }
    } catch (error) {
      console.error('Failed to save task:', error)
    }

    setEditingTask(null)
    setShowNewTaskModal(false)
  }

  // Handle task assign
  const handleAssignTask = async (taskId: string, assigneeType: 'human' | 'agent', assigneeId: string, autoExecute?: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignee_type: assigneeType,
          assignee_user_id: assigneeType === 'human' ? assigneeId : undefined,
          assignee_agent_id: assigneeType === 'agent' ? assigneeId : undefined,
          auto_execute: autoExecute,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      }
    } catch (error) {
      console.error('Failed to assign task:', error)
    }

    setAssigningTask(null)
  }

  // Handle agent execute
  const handleExecuteTask = async (task: ProjectTaskWithAssignee) => {
    if (!task.assignee_agent_id) return

    try {
      await fetch(`/api/projects/${projectId}/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignee_type: 'agent',
          assignee_agent_id: task.assignee_agent_id,
          auto_execute: true,
        }),
      })

      // Update local state to show executing
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, agent_executed_at: new Date().toISOString() } : t
      ))
    } catch (error) {
      console.error('Failed to execute task:', error)
    }
  }

  // Group tasks by status
  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = tasks.filter(t => t.status === col.id).sort((a, b) => a.position - b.position)
    return acc
  }, {} as Record<ProjectTaskStatus, ProjectTaskWithAssignee[]>)

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">태스크 보드</h2>
          <span className="text-sm text-zinc-500">({tasks.length}개)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTasks}
            className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            title="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleGenerateWorkflow}
            disabled={generating}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
              'hover:from-purple-600 hover:to-pink-600',
              generating && 'opacity-50 cursor-not-allowed'
            )}
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            AI 워크플로우 생성
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map(column => (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded-xl"
            >
              {/* Column Header */}
              <div className={cn('px-3 py-2 border-b-2', column.color)}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-zinc-700 dark:text-zinc-300">{column.title}</h3>
                  <span className="text-sm text-zinc-500 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                    {tasksByStatus[column.id]?.length || 0}
                  </span>
                </div>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 p-2 overflow-y-auto min-h-[200px]',
                      snapshot.isDraggingOver && 'bg-accent/5'
                    )}
                  >
                    {tasksByStatus[column.id]?.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onEdit={setEditingTask}
                        onDelete={handleDeleteTask}
                        onAssign={setAssigningTask}
                        onExecute={handleExecuteTask}
                      />
                    ))}
                    {provided.placeholder}

                    {/* Add Task Button */}
                    <button
                      onClick={() => {
                        setNewTaskColumn(column.id)
                        setShowNewTaskModal(true)
                      }}
                      className={cn(
                        'w-full p-2 mt-1 rounded-lg border-2 border-dashed',
                        'border-zinc-300 dark:border-zinc-700',
                        'text-zinc-500 hover:text-accent hover:border-accent',
                        'transition-colors flex items-center justify-center gap-1'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">태스크 추가</span>
                    </button>
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Edit Modal */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projectId={projectId}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <TaskEditModal
          task={null}
          projectId={projectId}
          defaultStatus={newTaskColumn}
          onSave={handleSaveTask}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}

      {/* Assign Modal */}
      {assigningTask && (
        <TaskAssignModal
          task={assigningTask}
          projectId={projectId}
          onAssign={handleAssignTask}
          onClose={() => setAssigningTask(null)}
        />
      )}
    </div>
  )
}
