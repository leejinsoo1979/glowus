'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/uiStore'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import useSWR from 'swr'
import {
  X,
  Search,
  Trash2,
  Loader2,
  Code,
  FileText,
  Presentation,
  Bot,
  Sparkles,
  Table,
  Image,
  BookOpen,
  MessageSquare,
  Folder,
  Brain,
  File,
  Users,
  MessageCircle,
} from 'lucide-react'

// API fetcher
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

// 워크스페이스 아이템 타입
interface WorkspaceItem {
  id: string
  type: 'project' | 'agent_chat' | 'ai_app' | 'chat_room' | 'neural_map' | 'document'
  title: string
  description?: string
  icon?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 아이콘 매핑
const ICON_MAP: Record<string, typeof MessageSquare> = {
  // AI 앱 타입
  code: Code,
  'file-text': FileText,
  presentation: Presentation,
  table: Table,
  image: Image,
  'book-open': BookOpen,
  sparkles: Sparkles,
  'message-square': MessageSquare,
  // 기타 타입
  folder: Folder,
  bot: Bot,
  brain: Brain,
  file: File,
  users: Users,
  'message-circle': MessageCircle,
}

function getIcon(iconName?: string) {
  return ICON_MAP[iconName || 'message-square'] || MessageSquare
}

// 타입별 라벨
const TYPE_LABELS: Record<string, string> = {
  project: '프로젝트',
  agent_chat: '에이전트',
  ai_app: 'AI 앱',
  chat_room: '채팅',
  neural_map: '뉴럴맵',
  document: '문서',
}

// 날짜별 그룹핑 헬퍼
function getDateGroup(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'Previous 7 Days'
  if (diffDays <= 30) return 'Previous 30 Days'

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

// 아이템을 날짜별로 그룹핑
function groupItemsByDate(items: WorkspaceItem[]): Record<string, WorkspaceItem[]> {
  const groups: Record<string, WorkspaceItem[]> = {}
  const sorted = [...items].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  sorted.forEach(item => {
    const group = getDateGroup(item.updatedAt)
    if (!groups[group]) groups[group] = []
    groups[group].push(item)
  })

  return groups
}

export function LeftPanel() {
  const router = useRouter()
  const { leftPanelOpen, setLeftPanelOpen } = useUIStore()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark' || resolvedTheme === undefined

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // 워크스페이스 히스토리 가져오기
  const { data, error, mutate, isLoading } = useSWR<{ items: WorkspaceItem[] }>(
    leftPanelOpen ? `/api/workspace/history?limit=100${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  const items = data?.items || []

  // 타입 필터링
  const filteredItems = useMemo(() => {
    if (!selectedType) return items
    return items.filter(item => item.type === selectedType)
  }, [items, selectedType])

  // 그룹핑
  const groupedItems = useMemo(() => groupItemsByDate(filteredItems), [filteredItems])
  const groupOrder = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days']

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && leftPanelOpen) {
        setLeftPanelOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [leftPanelOpen, setLeftPanelOpen])

  // 아이템 클릭 시 해당 페이지로 이동
  const handleItemClick = useCallback((item: WorkspaceItem) => {
    setLeftPanelOpen(false)

    switch (item.type) {
      case 'project':
        // 🔥 프로젝트를 AI Coding 페이지에서 열기
        router.push(`/dashboard-group/ai-coding?projectId=${item.id}`)
        break
      case 'agent_chat':
        router.push(`/dashboard-group/messenger?conversation=${item.id}`)
        break
      case 'ai_app':
        const threadType = item.metadata?.threadType
        if (threadType === 'glow_code') {
          router.push(`/dashboard-group/works`)
        } else if (threadType === 'docs') {
          router.push(`/dashboard-group/apps/ai-docs`)
        } else if (threadType === 'slides') {
          router.push(`/dashboard-group/apps/ai-slides`)
        } else if (threadType === 'sheet') {
          router.push(`/dashboard-group/apps/ai-sheet`)
        } else if (threadType === 'image') {
          router.push(`/dashboard-group/apps/image-gen`)
        } else if (threadType === 'blog') {
          router.push(`/dashboard-group/apps/ai-blog`)
        } else if (threadType === 'summary') {
          router.push(`/dashboard-group/apps/ai-summary`)
        }
        break
      case 'chat_room':
        router.push(`/dashboard-group/messenger?room=${item.id}`)
        break
      case 'neural_map':
        // 뉴럴맵은 My Neurons 페이지에서 열기
        router.push(`/dashboard-group/neurons?mapId=${item.id}`)
        break
      case 'document':
        router.push(`/dashboard-group/files?doc=${item.id}`)
        break
    }
  }, [router, setLeftPanelOpen])

  // 타입별 개수 계산
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(item => {
      counts[item.type] = (counts[item.type] || 0) + 1
    })
    return counts
  }, [items])

  return (
    <AnimatePresence>
      {leftPanelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[150]"
            onClick={() => setLeftPanelOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed top-0 left-0 h-full w-80 z-[151] flex flex-col",
              isDark ? "bg-zinc-900" : "bg-white"
            )}
          >
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 border-b",
              isDark ? "border-white/10" : "border-zinc-200"
            )}>
              <h2 className={cn(
                "text-sm font-semibold",
                isDark ? "text-white" : "text-zinc-900"
              )}>
                작업 히스토리
              </h2>
              <button
                onClick={() => setLeftPanelOpen(false)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-zinc-100 text-zinc-500"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg",
                isDark ? "bg-white/5" : "bg-zinc-100"
              )}>
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500",
                    isDark ? "text-white" : "text-zinc-900"
                  )}
                />
              </div>
            </div>

            {/* Type Filter Chips */}
            <div className="px-3 py-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedType(null)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                  selectedType === null
                    ? "bg-accent text-white"
                    : isDark ? "bg-white/10 text-zinc-400 hover:bg-white/15" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                전체 ({items.length})
              </button>
              {Object.entries(typeCounts).map(([type, count]) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(selectedType === type ? null : type)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    selectedType === type
                      ? "bg-accent text-white"
                      : isDark ? "bg-white/10 text-zinc-400 hover:bg-white/15" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  )}
                >
                  {TYPE_LABELS[type] || type} ({count})
                </button>
              ))}
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : error ? (
                <div className={cn(
                  "flex flex-col items-center justify-center h-32 text-center px-4",
                  isDark ? "text-zinc-500" : "text-zinc-400"
                )}>
                  <p className="text-sm">데이터를 불러올 수 없습니다</p>
                  <button
                    onClick={() => mutate()}
                    className="mt-2 text-xs text-accent hover:underline"
                  >
                    다시 시도
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className={cn(
                  "flex flex-col items-center justify-center h-full text-center px-4",
                  isDark ? "text-zinc-500" : "text-zinc-400"
                )}>
                  <Folder className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? '검색 결과가 없습니다' : '작업 기록이 없습니다'}
                  </p>
                  <p className="text-xs mt-1">
                    {searchQuery ? '다른 검색어를 시도해보세요' : '프로젝트나 AI 앱에서 작업을 시작하세요'}
                  </p>
                </div>
              ) : (
                <>
                  {[...groupOrder, ...Object.keys(groupedItems).filter(g => !groupOrder.includes(g))].map(group => {
                    const groupItems = groupedItems[group]
                    if (!groupItems || groupItems.length === 0) return null

                    return (
                      <div key={group} className="mb-4">
                        <div className={cn(
                          "flex items-center gap-2 px-2 py-1.5 text-xs font-medium",
                          isDark ? "text-zinc-500" : "text-zinc-400"
                        )}>
                          {group}
                        </div>

                        <div className="space-y-0.5">
                          {groupItems.map((item) => {
                            const ItemIcon = getIcon(item.icon)
                            return (
                              <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => handleItemClick(item)}
                                className={cn(
                                  "w-full group flex items-center gap-3 px-2 py-2.5 rounded-lg text-left text-sm transition-colors",
                                  isDark ? "hover:bg-white/5 text-zinc-300" : "hover:bg-zinc-100 text-zinc-700"
                                )}
                              >
                                <div className={cn(
                                  "p-1.5 rounded-md flex-shrink-0",
                                  isDark ? "bg-white/10" : "bg-zinc-100"
                                )}>
                                  <ItemIcon className="w-4 h-4 text-zinc-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate font-medium">
                                    {item.title}
                                  </div>
                                  {item.description && (
                                    <div className={cn(
                                      "truncate text-xs mt-0.5",
                                      isDark ? "text-zinc-500" : "text-zinc-400"
                                    )}>
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                                <span className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded flex-shrink-0",
                                  isDark ? "bg-white/5 text-zinc-500" : "bg-zinc-100 text-zinc-400"
                                )}>
                                  {TYPE_LABELS[item.type] || item.type}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className={cn(
              "px-4 py-3 border-t text-xs",
              isDark ? "border-white/10 text-zinc-500" : "border-zinc-200 text-zinc-400"
            )}>
              <div className="flex items-center justify-between">
                <span>{filteredItems.length}개 항목</span>
                <kbd className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-mono",
                  isDark ? "bg-white/10" : "bg-zinc-100"
                )}>ESC</kbd>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
