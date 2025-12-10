"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { KanbanTask } from "./KanbanBoard"
import { Calendar, MessageSquare, Paperclip, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface KanbanCardProps {
  task: KanbanTask
  accentColor: string
  isDragging?: boolean
}

const priorityConfig = {
  low: { label: "낮음", color: "bg-zinc-600 text-zinc-300" },
  medium: { label: "보통", color: "bg-yellow-500/20 text-yellow-400" },
  high: { label: "높음", color: "bg-orange-500/20 text-orange-400" },
  urgent: { label: "긴급", color: "bg-red-500/20 text-red-400" },
}

export function KanbanCard({ task, accentColor, isDragging = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priority = priorityConfig[task.priority]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

    if (days < 0) return { text: "기한 초과", isOverdue: true }
    if (days === 0) return { text: "오늘", isOverdue: false }
    if (days === 1) return { text: "내일", isOverdue: false }
    if (days <= 7) return { text: `${days}일 후`, isOverdue: false }
    return { text: date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" }), isOverdue: false }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-zinc-800 rounded-lg border border-zinc-700 p-4 cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-zinc-600 ${
        isDragging || isSortableDragging
          ? "opacity-90 shadow-2xl scale-105 rotate-2 z-50"
          : "hover:shadow-lg"
      }`}
    >
      {/* Priority Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${priority.color}`}>
          {priority.label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-100"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </div>

      {/* Title */}
      <h4 className="font-medium text-zinc-100 mb-2 line-clamp-2">{task.title}</h4>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-700">
        <div className="flex items-center gap-3">
          {task.dueDate && (
            <div
              className={`flex items-center gap-1 text-xs ${
                formatDate(task.dueDate).isOverdue ? "text-red-400" : "text-zinc-500"
              }`}
            >
              <Calendar className="h-3 w-3" />
              {formatDate(task.dueDate).text}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <MessageSquare className="h-3 w-3" />
            <span>3</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Paperclip className="h-3 w-3" />
            <span>2</span>
          </div>
        </div>

        {/* Assignee Avatar */}
        {task.assignee && (
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: accentColor }}
              title={task.assignee.name}
            >
              {task.assignee.name.charAt(0)}
            </div>
          </div>
        )}
      </div>

      {/* Drag indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: accentColor }}
      />
    </div>
  )
}
