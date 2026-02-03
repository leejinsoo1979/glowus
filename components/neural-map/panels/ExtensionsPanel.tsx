'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Search,
  Download,
  Star,
  RefreshCw,
  Settings,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react'

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

interface Extension {
  id: string
  name: string
  displayName: string
  description: string
  publisher: string
  publisherId: string
  version: string
  iconUrl: string | null
  installCount: number
  rating: number
  ratingCount: number
  categories: string[]
  tags: string[]
  // Local state
  installed?: boolean
  enabled?: boolean
}

// 로컬 설치 상태 (localStorage)
const INSTALLED_KEY = 'glow-extensions-installed'

function getInstalledExtensions(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const saved = localStorage.getItem(INSTALLED_KEY)
    return new Set(saved ? JSON.parse(saved) : [])
  } catch {
    return new Set()
  }
}

function saveInstalledExtensions(ids: Set<string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(INSTALLED_KEY, JSON.stringify([...ids]))
  // 🔥 커스텀 이벤트 발생 - TwoLevelSidebar에서 리스닝
  window.dispatchEvent(new Event('glow-extension-change'))
}

function formatDownloads(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`
  return count.toString()
}

interface ExtensionsPanelProps {
  isDark: boolean
}

export function ExtensionsPanel({ isDark }: ExtensionsPanelProps) {
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'installed' | 'popular' | 'all'>('popular')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set())
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)

  // Load installed extensions from localStorage
  useEffect(() => {
    setInstalledIds(getInstalledExtensions())
  }, [])

  // Fetch extensions from API
  const fetchExtensions = useCallback(async (query: string = '', category: string = 'popular') => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (category) params.set('category', category)

      const response = await fetch(`/api/extensions/search?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch extensions')
      }

      const data = await response.json()

      // Merge with local installed state
      const installed = getInstalledExtensions()
      const withLocalState = data.map((ext: Extension) => ({
        ...ext,
        installed: installed.has(ext.id),
        enabled: installed.has(ext.id),
      }))

      setExtensions(withLocalState)
    } catch (err: any) {
      console.error('[ExtensionsPanel] Error:', err)
      setError(err.message || 'Failed to load extensions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchExtensions('', 'popular')
  }, [fetchExtensions])

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        fetchExtensions(searchQuery, '')
      } else if (filter === 'popular') {
        fetchExtensions('', 'popular')
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, fetchExtensions, filter])

  // Filter extensions
  const filteredExtensions = extensions.filter(ext => {
    if (filter === 'installed') {
      return installedIds.has(ext.id)
    }
    return true
  })

  const handleInstall = async (extensionId: string) => {
    setInstallingId(extensionId)

    // 설치 시뮬레이션 (실제로는 vsix 다운로드 등)
    await new Promise(resolve => setTimeout(resolve, 1500))

    const newInstalled = new Set(installedIds)
    newInstalled.add(extensionId)
    setInstalledIds(newInstalled)
    saveInstalledExtensions(newInstalled)

    // Update local state
    setExtensions(prev => prev.map(ext =>
      ext.id === extensionId
        ? { ...ext, installed: true, enabled: true }
        : ext
    ))

    setInstallingId(null)
  }

  const handleUninstall = (extensionId: string) => {
    const newInstalled = new Set(installedIds)
    newInstalled.delete(extensionId)
    setInstalledIds(newInstalled)
    saveInstalledExtensions(newInstalled)

    // Update local state
    setExtensions(prev => prev.map(ext =>
      ext.id === extensionId
        ? { ...ext, installed: false, enabled: false }
        : ext
    ))
  }

  const handleRefresh = () => {
    fetchExtensions(searchQuery, filter === 'popular' ? 'popular' : '')
  }

  return (
    <div className="flex flex-col h-full">
      {/* 검색 바 */}
      <div className={cn("p-3 border-b", isDark ? "border-zinc-800" : "border-zinc-200")}>
        <div className="relative">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-zinc-500" : "text-zinc-400")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="마켓플레이스에서 확장 검색"
            className={cn(
              "w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none",
              isDark
                ? "bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:border-zinc-600"
                : "bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400 focus:border-zinc-300"
            )}
          />
        </div>
      </div>

      {/* 필터 탭 */}
      <div className={cn("flex items-center gap-1 px-3 py-2 border-b", isDark ? "border-zinc-800" : "border-zinc-200")}>
        {[
          { id: 'installed', label: '설치됨' },
          { id: 'popular', label: '인기' },
          { id: 'all', label: '전체' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setFilter(tab.id as any)
              if (tab.id === 'popular') {
                fetchExtensions('', 'popular')
              } else if (tab.id === 'all') {
                fetchExtensions('', '')
              }
            }}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              filter === tab.id
                ? isDark ? "bg-zinc-700 text-white" : "bg-zinc-200 text-zinc-900"
                : isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {tab.label}
            {tab.id === 'installed' && installedIds.size > 0 && (
              <span className="ml-1 text-[10px] opacity-60">({installedIds.size})</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            "p-1 rounded-md transition-colors",
            isDark ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
          )}
          title="새로고침"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* 확장 목록 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && extensions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={cn("w-6 h-6 animate-spin", isDark ? "text-zinc-500" : "text-zinc-400")} />
          </div>
        ) : error ? (
          <div className={cn("p-4 text-sm text-center", isDark ? "text-red-400" : "text-red-500")}>
            {error}
            <button
              onClick={handleRefresh}
              className="block mx-auto mt-2 text-xs underline"
            >
              다시 시도
            </button>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className={cn("p-4 text-sm text-center", isDark ? "text-zinc-500" : "text-zinc-400")}>
            {filter === 'installed' ? '설치된 확장이 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : (
          <div className="py-1">
            {filteredExtensions.map((extension) => (
              <ExtensionItem
                key={extension.id}
                extension={extension}
                isDark={isDark}
                isInstalling={installingId === extension.id}
                isSelected={selectedExtension?.id === extension.id}
                onSelect={() => setSelectedExtension(extension)}
                onInstall={() => handleInstall(extension.id)}
                onUninstall={() => handleUninstall(extension.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 확장 아이템 컴포넌트
function ExtensionItem({
  extension,
  isDark,
  isInstalling,
  isSelected,
  onSelect,
  onInstall,
  onUninstall,
}: {
  extension: Extension
  isDark: boolean
  isInstalling?: boolean
  isSelected?: boolean
  onSelect: () => void
  onInstall: () => void
  onUninstall: () => void
}) {
  const isClaudeCode = extension.id.toLowerCase().includes('claude')

  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 px-3 py-3 transition-colors cursor-pointer",
        isSelected
          ? isDark ? "bg-zinc-800 border-l-2 border-accent" : "bg-accent/10 border-l-2 border-accent"
          : isDark ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50"
      )}
    >
      {/* 아이콘 */}
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden",
        !extension.iconUrl && (isDark ? "bg-zinc-700" : "bg-zinc-200")
      )}>
        {extension.iconUrl ? (
          <img
            src={extension.iconUrl}
            alt={extension.displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span className={cn("text-lg font-bold", isDark ? "text-zinc-400" : "text-zinc-500")}>
            {extension.displayName[0]}
          </span>
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium truncate", isDark ? "text-zinc-200" : "text-zinc-800")}>
            {extension.displayName}
          </span>
          {isClaudeCode && (
            <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
          )}
        </div>
        <p className={cn("text-xs truncate mt-0.5", isDark ? "text-zinc-500" : "text-zinc-500")}>
          {extension.description}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={cn("text-[10px]", isDark ? "text-zinc-600" : "text-zinc-400")}>
            {extension.publisher}
          </span>
          {extension.rating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className={cn("text-[10px]", isDark ? "text-zinc-600" : "text-zinc-400")}>
                {extension.rating}
              </span>
            </div>
          )}
          {extension.installCount > 0 && (
            <span className={cn("text-[10px]", isDark ? "text-zinc-600" : "text-zinc-400")}>
              {formatDownloads(extension.installCount)}
            </span>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {extension.installed ? (
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "px-2.5 py-1 text-xs rounded whitespace-nowrap font-medium",
                isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600"
              )}
            >
              활성
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onUninstall()
              }}
              className={cn(
                "p-1.5 rounded transition-colors",
                isDark ? "hover:bg-zinc-700 text-zinc-400" : "hover:bg-zinc-200 text-zinc-500"
              )}
              title="제거"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onInstall()
            }}
            disabled={isInstalling}
            className={cn(
              "px-3 py-1.5 text-xs rounded font-medium transition-colors whitespace-nowrap flex items-center gap-1.5",
              isInstalling
                ? "bg-zinc-600 text-zinc-300 cursor-wait"
                : isDark
                  ? "bg-accent text-white hover:bg-accent/80"
                  : "bg-accent text-white hover:bg-accent/90"
            )}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                설치 중...
              </>
            ) : (
              '설치'
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default ExtensionsPanel
