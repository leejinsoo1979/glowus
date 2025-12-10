"use client"

import { useState, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { KanbanColumn } from "./KanbanColumn"
import { KanbanCard } from "./KanbanCard"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { Plus, Filter, Search } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export interface KanbanTask {
  id: string
  title: string
  description?: string
  priority: "low" | "medium" | "high" | "urgent"
  assignee?: {
    id: string
    name: string
    avatar?: string
  }
  dueDate?: string
  tags?: string[]
  columnId: string
}

export interface KanbanColumnType {
  id: string
  title: string
  color: string
  tasks: KanbanTask[]
}

interface KanbanBoardProps {
  initialColumns?: KanbanColumnType[]
  onTaskMove?: (taskId: string, fromColumn: string, toColumn: string) => void
  onTaskUpdate?: (task: KanbanTask) => void
}

const defaultColumns: KanbanColumnType[] = [
  {
    id: "todo",
    title: "할 일",
    color: "#71717a",
    tasks: [
      {
        id: "task-1",
        title: "사용자 인증 플로우 설계",
        description: "OAuth 2.0 기반 소셜 로그인 구현",
        priority: "high",
        assignee: { id: "1", name: "김철수" },
        dueDate: "2024-12-15",
        tags: ["백엔드", "인증"],
        columnId: "todo",
      },
      {
        id: "task-2",
        title: "대시보드 UI 리팩토링",
        description: "컴포넌트 구조 개선 및 성능 최적화",
        priority: "medium",
        assignee: { id: "2", name: "이영희" },
        tags: ["프론트엔드", "UI"],
        columnId: "todo",
      },
    ],
  },
  {
    id: "in_progress",
    title: "진행 중",
    color: "var(--accent-color)",
    tasks: [
      {
        id: "task-3",
        title: "결제 시스템 연동",
        description: "Stripe API 연동 및 결제 플로우 구현",
        priority: "urgent",
        assignee: { id: "1", name: "김철수" },
        dueDate: "2024-12-10",
        tags: ["백엔드", "결제"],
        columnId: "in_progress",
      },
    ],
  },
  {
    id: "review",
    title: "검토",
    color: "#f59e0b",
    tasks: [
      {
        id: "task-4",
        title: "API 문서화",
        description: "Swagger/OpenAPI 스펙 작성",
        priority: "low",
        assignee: { id: "3", name: "박민수" },
        tags: ["문서화"],
        columnId: "review",
      },
    ],
  },
  {
    id: "done",
    title: "완료",
    color: "#22c55e",
    tasks: [
      {
        id: "task-5",
        title: "프로젝트 초기 설정",
        description: "Next.js, TypeScript, Tailwind 설정",
        priority: "medium",
        assignee: { id: "2", name: "이영희" },
        tags: ["설정"],
        columnId: "done",
      },
    ],
  },
]

export function KanbanBoard({
  initialColumns = defaultColumns,
  onTaskMove,
  onTaskUpdate,
}: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumnType[]>(initialColumns)
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findColumn = (taskId: string) => {
    return columns.find((col) => col.tasks.some((task) => task.id === taskId))
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const column = findColumn(active.id as string)
    if (column) {
      const task = column.tasks.find((t) => t.id === active.id)
      if (task) setActiveTask(task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeColumn = findColumn(activeId)
    const overColumn = columns.find((col) => col.id === overId) || findColumn(overId)

    if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return

    setColumns((prev) => {
      const activeTaskIndex = activeColumn.tasks.findIndex((t) => t.id === activeId)
      const activeTaskItem = { ...activeColumn.tasks[activeTaskIndex], columnId: overColumn.id }

      return prev.map((col) => {
        if (col.id === activeColumn.id) {
          return {
            ...col,
            tasks: col.tasks.filter((t) => t.id !== activeId),
          }
        }
        if (col.id === overColumn.id) {
          const overTaskIndex = col.tasks.findIndex((t) => t.id === overId)
          const newTasks = [...col.tasks]
          if (overTaskIndex >= 0) {
            newTasks.splice(overTaskIndex, 0, activeTaskItem)
          } else {
            newTasks.push(activeTaskItem)
          }
          return { ...col, tasks: newTasks }
        }
        return col
      })
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeColumn = findColumn(activeId)
    const overColumn = columns.find((col) => col.id === overId) || findColumn(overId)

    if (!activeColumn || !overColumn) return

    if (activeColumn.id === overColumn.id) {
      const oldIndex = activeColumn.tasks.findIndex((t) => t.id === activeId)
      const newIndex = activeColumn.tasks.findIndex((t) => t.id === overId)

      if (oldIndex !== newIndex) {
        setColumns((prev) =>
          prev.map((col) => {
            if (col.id === activeColumn.id) {
              return {
                ...col,
                tasks: arrayMove(col.tasks, oldIndex, newIndex),
              }
            }
            return col
          })
        )
      }
    }

    if (onTaskMove && activeColumn.id !== overColumn.id) {
      onTaskMove(activeId, activeColumn.id, overColumn.id)
    }
  }

  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
  }))

  const totalTasks = columns.reduce((acc, col) => acc + col.tasks.length, 0)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">칸반 보드</h2>
          <p className="text-sm text-zinc-500">총 {totalTasks}개의 태스크</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="태스크 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            className="gap-2"
            style={{
              backgroundColor: mounted ? currentAccent.color : "var(--accent-color)",
            }}
          >
            <Plus className="h-4 w-4" />
            태스크 추가
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {filteredColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              accentColor={mounted ? currentAccent.color : "var(--accent-color)"}
            >
              <SortableContext
                items={column.tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {column.tasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    accentColor={mounted ? currentAccent.color : "var(--accent-color)"}
                  />
                ))}
              </SortableContext>
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <KanbanCard
              task={activeTask}
              accentColor={mounted ? currentAccent.color : "var(--accent-color)"}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
