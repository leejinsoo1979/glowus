'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useMyNeuronsStore } from '@/lib/my-neurons/store'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  ChevronDown,
  ChevronUp,
  Search,
  Save,
  Plus,
  Link2,
  Check,
  Loader2,
  X,
  Zap,
  HardDrive,
  Cloud,
  RefreshCw,
  Download,
  Upload,
  Palette,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Target,
  Workflow,
  Route,
  Map as MapIcon,
  BarChart3,
} from 'lucide-react'
import type { ViewMode } from '@/lib/my-neurons/types'

// View Tabs
const VIEW_TABS: { id: ViewMode; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'radial', label: 'Radial', icon: Target },
  { id: 'clusters', label: 'Clusters', icon: Workflow },
  { id: 'pathfinder', label: 'Pathfinder', icon: Route },
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
]

interface NeuronsToolbarProps {
  onRefresh?: () => void
  isLoading?: boolean
  canvasMode?: '2d' | '3d'
  onCanvasModeChange?: (mode: '2d' | '3d') => void
}

export function NeuronsToolbar({
  onRefresh,
  isLoading = false,
  canvasMode = '2d',
  onCanvasModeChange,
}: NeuronsToolbarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Local state
  const [showNodeModal, setShowNodeModal] = useState(false)
  const [showEdgeModal, setShowEdgeModal] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Store state
  const graph = useMyNeuronsStore((s) => s.graph)
  const viewMode = useMyNeuronsStore((s) => s.viewMode)
  const setViewMode = useMyNeuronsStore((s) => s.setViewMode)
  const showLabels = useMyNeuronsStore((s) => s.showLabels)
  const toggleLabels = useMyNeuronsStore((s) => s.toggleLabels)
  const selectNode = useMyNeuronsStore((s) => s.selectNode)
  const focusOnNode = useMyNeuronsStore((s) => s.focusOnNode)

  // User theme accent color
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  // 자동완성 검색 결과
  const suggestions = useMemo(() => {
    const query = searchQuery?.toLowerCase().trim() || ''
    if (!query || query.length < 1 || !graph?.nodes) return []

    return graph.nodes
      .filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.summary?.toLowerCase().includes(query) ||
        n.type.toLowerCase().includes(query)
      )
      .slice(0, 10)
      .map(n => ({
        id: n.id,
        name: n.title,
        type: n.type,
        item: n
      }))
  }, [searchQuery, graph?.nodes])

  // 선택 처리
  const handleSelectSuggestion = useCallback((suggestion: typeof suggestions[0]) => {
    selectNode(suggestion.id)
    focusOnNode(suggestion.id)
    setShowAutocomplete(false)
    setSearchQuery('')
  }, [selectNode, focusOnNode])

  // 검색 키보드 핸들러
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutocomplete && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSelectSuggestion(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowAutocomplete(false)
        return
      }
    }

    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const matchedNode = graph?.nodes?.find(n =>
        n.title.toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query)
      )
      if (matchedNode) {
        selectNode(matchedNode.id)
        focusOnNode(matchedNode.id)
      }
    }
  }

  // 노드 타입별 아이콘
  const getNodeTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      project: '📁',
      task: '✅',
      doc: '📄',
      person: '👤',
      agent: '🤖',
      objective: '🎯',
      key_result: '📊',
      program: '🏛️',
      workflow: '⚡',
      insight: '💡',
    }
    return icons[type] || '📌'
  }

  return (
    <div
      className={cn(
        'h-14 flex items-center justify-between px-4 border-b relative z-50 min-w-0 overflow-hidden',
        isDark ? 'bg-[#0a0a12] border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* Left: Mode & Storage & Search */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Save Button */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{ backgroundColor: currentAccent.color }}
          title="저장 (Cmd+S)"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">저장</span>
        </button>

        <div className={cn('w-px h-6 shrink-0 hidden sm:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Mode Selector - View Mode */}
        <div className="hidden lg:flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                viewMode === tab.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              )}
              style={viewMode === tab.id ? { backgroundColor: currentAccent.color } : undefined}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={cn('w-px h-6 shrink-0 hidden lg:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Storage Mode */}
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 hidden md:flex',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          )}
          title="저장 위치"
        >
          <HardDrive className="w-4 h-4" />
          <span className="hidden xl:inline">로컬</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Search */}
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowAutocomplete(true)
            }}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => suggestions.length > 0 && setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
            className={cn(
              'no-focus-ring w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400'
            )}
          />

          {/* 자동완성 드롭다운 */}
          {showAutocomplete && suggestions.length > 0 && (
            <div
              className={cn(
                'absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto',
                isDark
                  ? 'bg-zinc-900 border-zinc-700'
                  : 'bg-white border-zinc-200'
              )}
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                    index === selectedIndex
                      ? isDark
                        ? 'bg-zinc-700 text-white'
                        : 'bg-blue-50 text-blue-900'
                      : isDark
                        ? 'hover:bg-zinc-800 text-zinc-300'
                        : 'hover:bg-zinc-50 text-zinc-700'
                  )}
                >
                  <span className="text-base">{getNodeTypeIcon(suggestion.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{suggestion.name}</div>
                    <div className={cn(
                      'truncate text-xs capitalize',
                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                    )}>
                      {suggestion.type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Add Node */}
        <button
          onClick={() => setShowNodeModal(true)}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{ backgroundColor: currentAccent.color }}
          title="노드 추가 (N)"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">노드</span>
        </button>

        {/* Add Edge */}
        <button
          onClick={() => setShowEdgeModal(true)}
          className={cn(
            'flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border shrink-0',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
          )}
          title="연결 추가 (E)"
        >
          <Link2 className="w-4 h-4" />
          <span className="hidden sm:inline">연결</span>
        </button>

        <div className={cn('w-px h-6 shrink-0 hidden sm:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* 2D/3D Toggle */}
        <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded-lg p-0.5">
          <button
            onClick={() => onCanvasModeChange?.('2d')}
            className={cn(
              'px-2 py-1 rounded text-xs font-medium transition-colors',
              canvasMode === '2d'
                ? 'text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
            )}
            style={canvasMode === '2d' ? { backgroundColor: currentAccent.color } : undefined}
          >
            2D
          </button>
          <button
            onClick={() => onCanvasModeChange?.('3d')}
            className={cn(
              'px-2 py-1 rounded text-xs font-medium transition-colors',
              canvasMode === '3d'
                ? 'text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
            )}
            style={canvasMode === '3d' ? { backgroundColor: currentAccent.color } : undefined}
          >
            3D
          </button>
        </div>

        <div className={cn('w-px h-6 hidden md:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Labels Toggle */}
        <button
          onClick={toggleLabels}
          className={cn(
            'p-1.5 rounded transition-colors',
            showLabels ? 'text-white' : 'text-zinc-400 hover:text-white'
          )}
          style={showLabels ? { backgroundColor: currentAccent.color } : undefined}
          title={showLabels ? '라벨 숨기기' : '라벨 표시'}
        >
          {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        {/* Undo/Redo */}
        <div className="hidden md:flex items-center gap-1">
          <button
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600'
            )}
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600'
            )}
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className={cn('w-px h-6 hidden lg:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Export */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors hidden lg:block',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="내보내기"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={cn(
            'p-2 rounded-lg transition-colors',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700',
            'disabled:opacity-50'
          )}
          title="새로고침"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>

        <div className={cn('w-px h-6 shrink-0', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Blueprint */}
        <button
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{ backgroundColor: currentAccent.color }}
          title="Blueprint 실행"
        >
          <Zap className="w-4 h-4" />
          <span className="hidden sm:inline">Blueprint</span>
        </button>
      </div>

      {/* TODO: Node/Edge Modals - 필요시 구현 */}
    </div>
  )
}
