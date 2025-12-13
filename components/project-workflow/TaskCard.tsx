'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import {
  Clock,
  User,
  Bot,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  UserPlus,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectTaskWithAssignee, ProjectTaskPriority } from '@/types/database'

interface TaskCardProps {
  task: ProjectTaskWithAssignee
  index: number
  onEdit?: (task: ProjectTaskWithAssignee) => void
  onDelete?: (taskId: string) => void
  onAssign?: (task: ProjectTaskWithAssignee) => void
  onExecute?: (task: ProjectTaskWithAssignee) => void
}

const priorityConfig: Record<ProjectTaskPriority, { color: string; bg: string; label: string }> = {
  URGENT: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: '긴급' },
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: '높음' },
  MEDIUM: { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: '중간' },
  LOW: { color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800', label: '낮음' },
}

export function TaskCard({ task, index, onEdit, onDelete, onAssign, onExecute }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM

  const assignee = task.assignee_type === 'human' ? task.assignee_user : task.assignee_agent
  const isAgentAssigned = task.assignee_type === 'agent'
  const isAgentExecuting = task.agent_executed_at && !task.agent_result && !task.agent_error
  const hasAgentResult = !!task.agent_result
  const hasAgentError = !!task.agent_error

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 mb-2',
            'hover:border-accent/50 transition-all cursor-pointer group',
            snapshot.isDragging && 'shadow-lg ring-2 ring-accent/30'
          )}
          onClick={() => onEdit?.(task)}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex-1 pr-2">
              {task.title}
            </h4>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4 text-zinc-500" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[140px] z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      onEdit?.(task)
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Edit2 className="w-4 h-4" /> 편집
                  </button>
                  <button
                    onClick={() => {
                      onAssign?.(task)
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <UserPlus className="w-4 h-4" /> 할당
                  </button>
                  {isAgentAssigned && !hasAgentResult && !isAgentExecuting && (
                    <button
                      onClick={() => {
                        onExecute?.(task)
                        setShowMenu(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <Play className="w-4 h-4" /> 실행
                    </button>
                  )}
                  <hr className="my-1 border-zinc-200 dark:border-zinc-700" />
                  <button
                    onClick={() => {
                      onDelete?.(task.id)
                      setShowMenu(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <Trash2 className="w-4 h-4" /> 삭제
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-3">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', priority.bg, priority.color)}>
              {priority.label}
            </span>
            {task.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                {task.category}
              </span>
            )}
            {task.tags?.slice(0, 2).map((tag, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                {tag}
              </span>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs">
            {/* Assignee */}
            <div className="flex items-center gap-2">
              {assignee ? (
                <div className="flex items-center gap-1.5">
                  {isAgentAssigned ? (
                    <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                      <Bot className="w-3 h-3 text-accent" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-600 flex items-center justify-center overflow-hidden">
                      {(task.assignee_user as { avatar_url?: string })?.avatar_url ? (
                        <img
                          src={(task.assignee_user as { avatar_url: string }).avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-3 h-3 text-zinc-500" />
                      )}
                    </div>
                  )}
                  <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[80px]">
                    {(assignee as { name?: string }).name || '할당됨'}
                  </span>
                </div>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500">미할당</span>
              )}

              {/* Agent execution status */}
              {isAgentAssigned && (
                <>
                  {isAgentExecuting && (
                    <Loader2 className="w-3 h-3 text-accent animate-spin" />
                  )}
                  {hasAgentResult && (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  )}
                  {hasAgentError && (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  )}
                </>
              )}
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-2 text-zinc-400">
              {task.estimated_hours && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {task.estimated_hours}h
                </span>
              )}
              {task.due_date && (
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  )
}
