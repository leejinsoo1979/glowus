'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  Plus,
  Loader2,
  Clock,
  Trash2,
  FolderOpen,
  Folder,
  FileText,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface StudioProject {
  id: string
  title: string
  created_at: string
  updated_at: string
  metadata?: {
    sources_count?: number
    contents_count?: number
  }
}

interface AIStudioSidebarProps {
  isDark: boolean
  themeColor: string
}

export function AIStudioSidebar({ isDark, themeColor }: AIStudioSidebarProps) {
  const router = useRouter()
  const { user } = useAuthStore()

  const [projects, setProjects] = useState<StudioProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // 프로젝트 목록 불러오기 (API 사용)
  const fetchProjects = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/ai-studio/sessions?user_id=${user.id}`)
      const result = await response.json()

      if (result.error) throw new Error(result.error)

      setProjects(result.data || [])
    } catch (error) {
      console.error('Failed to fetch AI Studio projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchProjects()

    // 프로젝트 저장 이벤트 리스닝
    const handleProjectSaved = () => {
      fetchProjects()
    }
    window.addEventListener('ai-studio-session-saved', handleProjectSaved)

    return () => {
      window.removeEventListener('ai-studio-session-saved', handleProjectSaved)
    }
  }, [fetchProjects])

  // 프로젝트 삭제 (API 사용)
  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const response = await fetch(`/api/ai-studio/sessions?id=${projectId}&user_id=${user?.id}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.error) throw new Error(result.error)

      setProjects(prev => prev.filter(p => p.id !== projectId))
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null)
        // 새 프로젝트 시작 이벤트 발생
        window.dispatchEvent(new CustomEvent('ai-studio-new-project'))
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  // 프로젝트 클릭 - 전체 상태 복원
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    // 프로젝트 로드 이벤트 발생
    window.dispatchEvent(new CustomEvent('ai-studio-load-project', {
      detail: { projectId }
    }))
  }

  // 오늘/어제/이번주/이전 그룹화
  const groupProjects = (projects: StudioProject[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: { label: string; projects: StudioProject[] }[] = [
      { label: '오늘', projects: [] },
      { label: '어제', projects: [] },
      { label: '지난 7일', projects: [] },
      { label: '이전', projects: [] },
    ]

    projects.forEach(project => {
      const projectDate = new Date(project.updated_at || project.created_at)
      if (projectDate >= today) {
        groups[0].projects.push(project)
      } else if (projectDate >= yesterday) {
        groups[1].projects.push(project)
      } else if (projectDate >= weekAgo) {
        groups[2].projects.push(project)
      } else {
        groups[3].projects.push(project)
      }
    })

    return groups.filter(g => g.projects.length > 0)
  }

  const groupedProjects = groupProjects(projects)

  return (
    <div className="h-full flex flex-col">
      {/* 새 프로젝트 버튼 */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={() => {
            setSelectedProjectId(null)
            window.dispatchEvent(new CustomEvent('ai-studio-new-project'))
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

      {/* 프로젝트 목록 헤더 */}
      <div className={cn(
        'px-4 py-2 flex items-center justify-between border-b',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wider',
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        )}>
          프로젝트
        </span>
        <span className={cn(
          'text-xs',
          isDark ? 'text-zinc-600' : 'text-zinc-400'
        )}>
          {projects.length}개
        </span>
      </div>

      {/* 프로젝트 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
          </div>
        ) : projects.length === 0 ? (
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
            <p className="text-sm font-medium mb-1">아직 프로젝트가 없습니다</p>
            <p className="text-xs opacity-70">
              새 프로젝트를 시작해보세요
            </p>
          </div>
        ) : (
          <div className="py-2">
            {groupedProjects.map((group) => (
              <div key={group.label} className="mb-4">
                {/* 그룹 라벨 */}
                <div className={cn(
                  'px-4 py-1.5 text-xs font-medium',
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                )}>
                  {group.label}
                </div>

                {/* 프로젝트 아이템들 */}
                <div className="space-y-0.5 px-2">
                  {group.projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group',
                        selectedProjectId === project.id
                          ? isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                          : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                      )}
                    >
                      {/* 폴더 아이콘 */}
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        selectedProjectId === project.id
                          ? ''
                          : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      )}
                      style={selectedProjectId === project.id ? { backgroundColor: `${themeColor}20` } : undefined}
                      >
                        <Folder
                          className="w-4 h-4"
                          style={{ color: selectedProjectId === project.id ? themeColor : undefined }}
                        />
                      </div>

                      {/* 텍스트 */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isDark ? 'text-zinc-200' : 'text-zinc-800'
                        )}>
                          {project.title}
                        </p>
                        <p className={cn(
                          'text-xs truncate flex items-center gap-2',
                          isDark ? 'text-zinc-500' : 'text-zinc-400'
                        )}>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {project.metadata?.sources_count || 0}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(project.updated_at || project.created_at), {
                              addSuffix: true,
                              locale: ko
                            })}
                          </span>
                        </p>
                      </div>

                      {/* 삭제 버튼 */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDeleteProject(project.id, e as unknown as React.MouseEvent)}
                        className={cn(
                          'p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer',
                          isDark
                            ? 'hover:bg-zinc-700 text-zinc-500 hover:text-red-400'
                            : 'hover:bg-zinc-200 text-zinc-400 hover:text-red-500'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </div>
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
