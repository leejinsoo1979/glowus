'use client'

import { useState } from 'react'
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
} from 'lucide-react'

export function Toolbar() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)

  const themeId = useNeuralMapStore((s) => s.themeId)
  const setTheme = useNeuralMapStore((s) => s.setTheme)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery)
  const setSearchQuery = useNeuralMapStore((s) => s.setSearchQuery)
  const openModal = useNeuralMapStore((s) => s.openModal)
  const headerCollapsed = useNeuralMapStore((s) => s.headerCollapsed)
  const toggleHeader = useNeuralMapStore((s) => s.toggleHeader)

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

        {/* Search */}
        <div className="relative">
          <Search
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}
          />
          <input
            type="text"
            placeholder="노드 검색... (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-64 pl-9 pr-3 py-1.5 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300'
            )}
          />
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
