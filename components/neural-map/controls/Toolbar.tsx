'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { THEME_PRESETS } from '@/lib/neural-map/constants'
import {
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Palette,
  Undo2,
  Redo2,
  Search,
  Save,
  Plus,
  Link2,
  FileText,
  Folder,
} from 'lucide-react'

export function Toolbar() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const themeId = useNeuralMapStore((s) => s.themeId)
  const setTheme = useNeuralMapStore((s) => s.setTheme)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery)
  const setSearchQuery = useNeuralMapStore((s) => s.setSearchQuery)
  const openModal = useNeuralMapStore((s) => s.openModal)
  const headerCollapsed = useNeuralMapStore((s) => s.headerCollapsed)
  const toggleHeader = useNeuralMapStore((s) => s.toggleHeader)
  const files = useNeuralMapStore((s) => s.files)
  const graph = useNeuralMapStore((s) => s.graph)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

  // 🔥 자동완성 검색 결과
  const suggestions = useMemo(() => {
    const query = searchQuery?.toLowerCase().trim() || ''
    if (!query || query.length < 1) return []

    const results: { type: 'file' | 'node'; name: string; path?: string; id: string; item: any }[] = []

    // 파일 검색
    files.forEach(f => {
      if (f.name.toLowerCase().includes(query) || f.path?.toLowerCase().includes(query)) {
        results.push({
          type: 'file',
          name: f.name,
          path: f.path,
          id: f.id,
          item: f
        })
      }
    })

    // 그래프 노드 검색
    graph?.nodes?.forEach(n => {
      if (n.title.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)) {
        // 이미 파일로 추가된 것은 제외
        if (!results.some(r => r.id === n.id)) {
          results.push({
            type: 'node',
            name: n.title,
            id: n.id,
            item: n
          })
        }
      }
    })

    return results.slice(0, 10) // 최대 10개
  }, [searchQuery, files, graph?.nodes])

  // 자동완성 표시/숨김
  useEffect(() => {
    setShowAutocomplete(suggestions.length > 0 && searchQuery.length > 0)
    setSelectedIndex(0)
  }, [suggestions.length, searchQuery.length])

  // 선택 처리
  const handleSelectSuggestion = (suggestion: typeof suggestions[0]) => {
    if (suggestion.type === 'file') {
      openCodePreview(suggestion.item)
    }
    setFocusNodeId(suggestion.id)
    setShowAutocomplete(false)
    setSearchQuery('')
  }

  // 검색어로 노드 찾기 및 카메라 이동
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

      // 1. 파일에서 검색
      const matchedFile = files.find(f =>
        f.name.toLowerCase().includes(query) ||
        f.path?.toLowerCase().includes(query)
      )

      if (matchedFile) {
        openCodePreview(matchedFile)
        setFocusNodeId(matchedFile.id)
        return
      }

      // 2. 그래프 노드에서 검색
      const matchedNode = graph?.nodes.find(n =>
        n.title.toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query)
      )

      if (matchedNode) {
        setFocusNodeId(matchedNode.id)
      }
    }
  }

  // User theme accent color
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  // 접힌 상태 - Toolbar와 ViewTabs 모두 접힘
  if (headerCollapsed) {
    return null
  }

  return (
    <div
      className={cn(
        'h-14 flex items-center justify-between px-4 border-b',
        isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* Center: Mode & Search */}
      <div className="flex items-center gap-3">
        {/* Mode Selector */}
        <div className="relative">
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            )}
          >
            Mode: Manual
            <ChevronDown className="w-4 h-4" />
          </button>
          {showModeMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowModeMenu(false)}
              />
              <div
                className={cn(
                  'absolute top-full left-0 mt-1 w-40 rounded-lg shadow-lg z-20 py-1',
                  isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'
                )}
              >
                <button
                  onClick={() => setShowModeMenu(false)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                  )}
                >
                  Manual Build
                </button>
                <button
                  onClick={() => setShowModeMenu(false)}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                  )}
                >
                  Auto Build (AI)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search with Autocomplete */}
        <div className="relative">
          <Search
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="파일/노드 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => suggestions.length > 0 && setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
            className={cn(
              'no-focus-ring w-72 pl-9 pr-3 py-1.5 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400'
            )}
          />

          {/* 🔥 자동완성 드롭다운 */}
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
                  {suggestion.type === 'file' ? (
                    <FileText className="w-4 h-4 shrink-0 text-blue-500" />
                  ) : (
                    <Folder className="w-4 h-4 shrink-0 text-amber-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{suggestion.name}</div>
                    {suggestion.path && (
                      <div className={cn(
                        'truncate text-xs',
                        isDark ? 'text-zinc-500' : 'text-zinc-400'
                      )}>
                        {suggestion.path}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Add Node / Edge */}
        <button
          onClick={() => openModal('nodeEditor')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white"
          style={{
            backgroundColor: currentAccent.color,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentAccent.hoverColor}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = currentAccent.color}
          title="노드 추가 (N)"
        >
          <Plus className="w-4 h-4" />
          노드
        </button>
        <button
          onClick={() => openModal('export', { mode: 'edge' })}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
          )}
          title="연결 추가 (E)"
        >
          <Link2 className="w-4 h-4" />
          연결
        </button>

        <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600'
            )}
            title="Undo (Ctrl+Z)"
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
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Theme */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title="테마"
          >
            <Palette className="w-4 h-4" />
          </button>
          {showThemeMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowThemeMenu(false)}
              />
              <div
                className={cn(
                  'absolute top-full right-0 mt-1 w-48 rounded-lg shadow-lg z-20 py-1',
                  isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'
                )}
              >
                {THEME_PRESETS.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setTheme(theme.id)
                      setShowThemeMenu(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                      isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100',
                      themeId === theme.id
                        ? isDark
                          ? 'text-blue-400'
                          : 'text-blue-600'
                        : isDark
                        ? 'text-zinc-300'
                        : 'text-zinc-700'
                    )}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${theme.background.gradient[0]}, ${theme.background.gradient[1]})`,
                      }}
                    />
                    {theme.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Import/Export */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="Import"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          className={cn(
            'p-2 rounded-lg transition-colors',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="Export"
        >
          <Download className="w-4 h-4" />
        </button>

        <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Save */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white"
          style={{
            backgroundColor: currentAccent.color,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentAccent.hoverColor}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = currentAccent.color}
        >
          <Save className="w-4 h-4" />
          저장
        </button>

        <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* 헤더 접기 버튼 */}
        <button
          onClick={toggleHeader}
          className={cn(
            'p-2 rounded-lg transition-colors',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="헤더 접기 (Toolbar + Tabs)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
