'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  ChevronDown,
  ChevronUp,
  Search,
  Save,
  Play,
  Square,
  FileText,
  Folder,
  Check,
  Loader2,
  X,
  GitBranch,
  Terminal,
  Code2,
  Bug,
  Braces,
  RefreshCw,
  Settings,
  FolderOpen,
} from 'lucide-react'

interface CodingToolbarProps {
  onToggleTerminal?: () => void
  terminalOpen?: boolean
  projectPath?: string | null
  linkedProjectName?: string | null
  onRun?: (previewUrl: string) => void  // Browser 탭에서 열기 위한 콜백
}

export function CodingToolbar({
  onToggleTerminal,
  terminalOpen = false,
  projectPath,
  linkedProjectName,
  onRun,
}: CodingToolbarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const headerCollapsed = useNeuralMapStore((s) => s.headerCollapsed)
  const toggleHeader = useNeuralMapStore((s) => s.toggleHeader)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery)
  const setSearchQuery = useNeuralMapStore((s) => s.setSearchQuery)
  const files = useNeuralMapStore((s) => s.files)
  const graph = useNeuralMapStore((s) => s.graph)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)
  const mapId = useNeuralMapStore((s) => s.mapId)
  const linkedProjectId = useNeuralMapStore((s) => s.linkedProjectId)
  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)
  const setMapId = useNeuralMapStore((s) => s.setMapId)

  // User theme accent color
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  // 자동완성 검색 결과
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

    return results.slice(0, 10)
  }, [searchQuery, files, graph?.nodes])

  // 선택 처리
  const handleSelectSuggestion = (suggestion: typeof suggestions[0]) => {
    if (suggestion.type === 'file') {
      openCodePreview(suggestion.item)
    }
    setFocusNodeId(suggestion.id)
    setShowAutocomplete(false)
    setSearchQuery('')
  }

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
      const matchedFile = files.find(f =>
        f.name.toLowerCase().includes(query) ||
        f.path?.toLowerCase().includes(query)
      )

      if (matchedFile) {
        openCodePreview(matchedFile)
        setFocusNodeId(matchedFile.id)
        return
      }

      const matchedNode = graph?.nodes.find(n =>
        n.title.toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query)
      )

      if (matchedNode) {
        setFocusNodeId(matchedNode.id)
      }
    }
  }

  // 저장 처리 (프로젝트 미연결 시 자동 생성)
  const handleSave = useCallback(async () => {
    if (!projectPath) {
      alert('프로젝트 폴더를 먼저 열어주세요.')
      return
    }

    setIsSaving(true)
    try {
      let currentProjectId = linkedProjectId
      let currentMapId = mapId

      // 🔥 프로젝트가 연결되지 않은 경우 자동 생성
      if (!currentProjectId) {
        const projectName = projectPath.split('/').pop() || '새 프로젝트'
        console.log('[CodingToolbar] Creating new project:', projectName)

        // 1. 프로젝트 생성
        const projectRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: projectName,
            description: `${projectName} 프로젝트`,
            folder_path: projectPath,
            project_type: 'code',
            status: 'active',
          })
        })

        if (!projectRes.ok) {
          throw new Error('프로젝트 생성 실패')
        }

        const { project } = await projectRes.json()
        currentProjectId = project.id
        console.log('[CodingToolbar] Project created:', currentProjectId)

        // 2. AI Coding Map 생성
        const mapRes = await fetch('/api/ai-coding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: currentProjectId,
            title: projectName,
          })
        })

        if (mapRes.ok) {
          const { map } = await mapRes.json()
          currentMapId = map.id
          console.log('[CodingToolbar] Map created:', currentMapId)
        }

        // 3. Store에 연결 정보 저장
        setLinkedProject(currentProjectId, projectName)
        if (currentMapId) {
          setMapId(currentMapId)
        }
      }

      // 4. 그래프 데이터 저장
      if (currentMapId) {
        const state = useNeuralMapStore.getState()
        await fetch(`/api/ai-coding/${currentMapId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graph: state.graph }),
        })
      }

      // 5. 프로젝트 폴더 경로 업데이트
      if (currentProjectId && projectPath) {
        await fetch(`/api/projects/${currentProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_path: projectPath })
        })
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }, [linkedProjectId, mapId, projectPath, setLinkedProject, setMapId])

  // Run 버튼 - Browser 탭에서 로컬 서버로 프로젝트 실행
  const handleRun = useCallback(async () => {
    console.log('[CodingToolbar] handleRun called', { linkedProjectId, projectPath, linkedProjectName })

    setIsRunning(true)

    try {
      // Electron 환경인지 확인
      const isElectron = typeof window !== 'undefined' && !!(window as any).electron?.projectPreview

      if (isElectron && projectPath) {
        // Electron: 팝업 창으로 프로젝트 열기
        const indexPath = `${projectPath}/index.html`
        console.log('[CodingToolbar] Opening in Electron:', indexPath)
        const result = await (window as any).electron.projectPreview.open(indexPath, linkedProjectName || 'Preview')
        if (!result?.success) {
          console.error('[CodingToolbar] Failed to open preview:', result?.error)
        }
      } else if (projectPath) {
        // 웹: Browser 탭에서 로컬 서버 URL로 열기
        const sessionId = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        const previewUrl = `/api/preview/index.html?basePath=${encodeURIComponent(projectPath)}&sessionId=${encodeURIComponent(sessionId)}`
        console.log('[CodingToolbar] Opening in Browser tab:', previewUrl)

        if (onRun) {
          onRun(previewUrl)
        } else {
          window.open(previewUrl, '_blank', 'width=1024,height=768')
        }
      } else {
        // projectPath 없음: store에서 HTML 찾아서 새 창에서 열기
        console.log('[CodingToolbar] No projectPath, checking store')
        const state = useNeuralMapStore.getState()
        const htmlFile = state.files.find(f =>
          f.name.endsWith('.html') || f.name.endsWith('.htm')
        )

        if (htmlFile && htmlFile.content) {
          console.log('[CodingToolbar] Opening from store:', htmlFile.name)
          const newWindow = window.open('', '_blank', 'width=1024,height=768')
          if (newWindow) {
            newWindow.document.write(htmlFile.content)
            newWindow.document.close()
          }
        } else {
          console.log('[CodingToolbar] No HTML in store, opening terminal')
          if (onToggleTerminal && !terminalOpen) {
            onToggleTerminal()
          }
        }
      }
    } catch (err) {
      console.error('[CodingToolbar] Run error:', err)
    } finally {
      setTimeout(() => setIsRunning(false), 500)
    }
  }, [linkedProjectId, projectPath, linkedProjectName, onToggleTerminal, terminalOpen, onRun])

  // 접힌 상태
  if (headerCollapsed) {
    return (
      <div
        className={cn(
          'h-10 flex items-center justify-end px-4 border-b relative z-50',
          isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <button
          onClick={toggleHeader}
          className={cn(
            'p-2 rounded-lg transition-colors',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="헤더 펼치기"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-14 flex items-center justify-between px-4 border-b relative z-50 min-w-0 overflow-hidden',
        isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* Left: Project Info & Save */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Project/Folder Info */}
        <div className="flex items-center gap-2 shrink-0">
          <FolderOpen className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
          <span className={cn('text-sm font-medium truncate max-w-[150px]', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            {linkedProjectName || projectPath?.split('/').pop() || '프로젝트 없음'}
          </span>
        </div>

        <div className={cn('w-px h-6 shrink-0', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Save Button - 프로젝트 미연결 시에도 활성화 (자동 생성) */}
        <button
          onClick={handleSave}
          disabled={isSaving || !projectPath}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0 disabled:opacity-50"
          style={{
            backgroundColor: saveSuccess ? '#22c55e' : currentAccent.color,
          }}
          title={linkedProjectId ? "저장 (Cmd+S)" : "프로젝트 생성 및 저장 (Cmd+S)"}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {saveSuccess ? '저장됨' : '저장'}
          </span>
        </button>

        <div className={cn('w-px h-6 shrink-0 hidden sm:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

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
            placeholder="파일 검색... (Ctrl+P)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Right: Code Actions */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Run Button */}
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{ backgroundColor: currentAccent.color }}
          title="실행 (F5)"
        >
          {isRunning ? (
            <Square className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">실행</span>
        </button>

        {/* Format Button */}
        <button
          className={cn(
            'flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border shrink-0',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              : 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
          )}
          title="코드 포맷 (Shift+Alt+F)"
        >
          <Braces className="w-4 h-4" />
          <span className="hidden sm:inline">Format</span>
        </button>

        <div className={cn('w-px h-6 shrink-0 hidden sm:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Git Status */}
        <div className="hidden md:flex items-center gap-2">
          <button
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title="Git 브랜치"
          >
            <GitBranch className="w-4 h-4" />
            <span className="text-xs">main</span>
          </button>
        </div>

        <div className={cn('w-px h-6 hidden md:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Debug */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors hidden lg:flex',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="디버그"
        >
          <Bug className="w-4 h-4" />
        </button>

        {/* Terminal Toggle */}
        <button
          onClick={onToggleTerminal}
          className={cn(
            'p-2 rounded-lg transition-colors',
            terminalOpen
              ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-900'
              : isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="터미널 (Ctrl+`)"
        >
          <Terminal className="w-4 h-4" />
        </button>

        {/* Refresh */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors hidden lg:flex',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className={cn('w-px h-6 shrink-0', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* 헤더 접기 버튼 */}
        <button
          onClick={toggleHeader}
          className={cn(
            'p-2 rounded-lg transition-colors shrink-0',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="헤더 접기"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
