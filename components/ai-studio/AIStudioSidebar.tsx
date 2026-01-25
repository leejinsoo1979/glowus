'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import {
  Plus,
  MessageSquare,
  ChevronRight,
  Loader2,
  Clock,
  FileAudio,
  Video,
  FileText,
  Trash2,
  FolderOpen,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface StudioTask {
  id: string
  title: string
  description?: string
  type: string
  created_at: string
  metadata?: {
    type?: string
    hasSlides?: boolean
    hasAudio?: boolean
  }
}

interface AIStudioSidebarProps {
  isDark: boolean
  themeColor: string
}

export function AIStudioSidebar({ isDark, themeColor }: AIStudioSidebarProps) {
  const router = useRouter()
  const supabase = createClient()
  const { currentStartup } = useAuthStore()

  const [tasks, setTasks] = useState<StudioTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // 작업 목록 불러오기
  useEffect(() => {
    const fetchTasks = async () => {
      if (!currentStartup?.id) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('company_tasks')
          .select('id, title, description, created_at, metadata, tags')
          .eq('company_id', currentStartup.id)
          .contains('tags', ['ai-studio'])
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error

        const taskData = data as unknown as Array<{
          id: string
          title: string
          description?: string
          created_at: string
          metadata?: { type?: string; hasSlides?: boolean; hasAudio?: boolean }
          tags?: string[]
        }>

        setTasks(taskData?.map(task => ({
          id: task.id,
          title: task.title?.replace('[AI Studio] ', '') || '제목 없음',
          description: task.description,
          type: task.metadata?.type || 'unknown',
          created_at: task.created_at,
          metadata: task.metadata,
        })) || [])
      } catch (error) {
        console.error('Failed to fetch AI Studio tasks:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTasks()
  }, [currentStartup?.id, supabase])

  // 작업 삭제
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const { error } = await supabase
        .from('company_tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error

      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  // 타입별 아이콘
  const getTypeIcon = (type: string, metadata?: StudioTask['metadata']) => {
    if (metadata?.hasAudio || type === 'audio-overview') {
      return <FileAudio className="w-4 h-4 text-purple-400" />
    }
    if (metadata?.hasSlides || type === 'video-overview' || type === 'slides') {
      return <Video className="w-4 h-4 text-pink-400" />
    }
    return <FileText className="w-4 h-4 text-blue-400" />
  }

  // 오늘/어제/이번주/이전 그룹화
  const groupTasks = (tasks: StudioTask[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: { label: string; tasks: StudioTask[] }[] = [
      { label: '오늘', tasks: [] },
      { label: '어제', tasks: [] },
      { label: '지난 7일', tasks: [] },
      { label: '이전', tasks: [] },
    ]

    tasks.forEach(task => {
      const taskDate = new Date(task.created_at)
      if (taskDate >= today) {
        groups[0].tasks.push(task)
      } else if (taskDate >= yesterday) {
        groups[1].tasks.push(task)
      } else if (taskDate >= weekAgo) {
        groups[2].tasks.push(task)
      } else {
        groups[3].tasks.push(task)
      }
    })

    return groups.filter(g => g.tasks.length > 0)
  }

  const groupedTasks = groupTasks(tasks)

  return (
    <div className="h-full flex flex-col">
      {/* 새 프로젝트 버튼 */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={() => {
            setSelectedTaskId(null)
            router.push('/dashboard-group/ai-studio')
          }}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all',
            'bg-gradient-to-r hover:scale-[1.02] active:scale-[0.98]'
          )}
          style={{
            background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
            color: 'white'
          }}
        >
          <Plus className="w-5 h-5" />
          <span>새 프로젝트</span>
        </button>
      </div>

      {/* 작업 목록 헤더 */}
      <div className={cn(
        'px-4 py-2 flex items-center justify-between border-b',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wider',
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        )}>
          작업 목록
        </span>
        <span className={cn(
          'text-xs',
          isDark ? 'text-zinc-600' : 'text-zinc-400'
        )}>
          {tasks.length}개
        </span>
      </div>

      {/* 작업 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
          </div>
        ) : tasks.length === 0 ? (
          <div className={cn(
            'flex flex-col items-center justify-center py-12 px-4 text-center',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}>
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              <FolderOpen className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-sm font-medium mb-1">아직 작업이 없습니다</p>
            <p className="text-xs opacity-70">
              새 프로젝트를 시작해보세요
            </p>
          </div>
        ) : (
          <div className="py-2">
            {groupedTasks.map((group) => (
              <div key={group.label} className="mb-4">
                {/* 그룹 라벨 */}
                <div className={cn(
                  'px-4 py-1.5 text-xs font-medium',
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                )}>
                  {group.label}
                </div>

                {/* 작업 아이템들 */}
                <div className="space-y-0.5 px-2">
                  {group.tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group',
                        selectedTaskId === task.id
                          ? isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                          : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                      )}
                    >
                      {/* 아이콘 */}
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      )}>
                        {getTypeIcon(task.type, task.metadata)}
                      </div>

                      {/* 텍스트 */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isDark ? 'text-zinc-200' : 'text-zinc-800'
                        )}>
                          {task.title}
                        </p>
                        <p className={cn(
                          'text-xs truncate flex items-center gap-1',
                          isDark ? 'text-zinc-500' : 'text-zinc-400'
                        )}>
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(task.created_at), {
                            addSuffix: true,
                            locale: ko
                          })}
                        </p>
                      </div>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        className={cn(
                          'p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all',
                          isDark
                            ? 'hover:bg-zinc-700 text-zinc-500 hover:text-red-400'
                            : 'hover:bg-zinc-200 text-zinc-400 hover:text-red-500'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
