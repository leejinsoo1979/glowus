'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
  FolderPlus,
  Check,
  Loader2,
  X,
  Zap,
  HardDrive,
  Cloud,
  Database,
} from 'lucide-react'

// Blueprint Panel
import { BlueprintPanel } from '../panels/BlueprintPanel'

export function Toolbar() {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const isDark = resolvedTheme === 'dark'
  const [showThemeMenu, setShowThemeMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showStorageModeMenu, setShowStorageModeMenu] = useState(false)
  const [showBlueprintPanel, setShowBlueprintPanel] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [projects, setProjects] = useState<{ id: string; name: string; folder_path?: string }[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string; color: string; icon: string }[]>([])
  const [newProjectName, setNewProjectName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null) // 같은 폴더의 기존 프로젝트
  const [saveToast, setSaveToast] = useState<{ show: boolean; message: string; projectName?: string; categoryName?: string; categoryColor?: string }>({ show: false, message: '' })
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 저장 완료 토스트 표시
  const showSaveToast = useCallback((message: string, projectName?: string, categoryName?: string, categoryColor?: string) => {
    setSaveToast({ show: true, message, projectName, categoryName, categoryColor })
    setTimeout(() => setSaveToast({ show: false, message: '' }), 4000) // 4초로 연장
  }, [])

  const themeId = useNeuralMapStore((s) => s.themeId)
  const setTheme = useNeuralMapStore((s) => s.setTheme)
  const storageMode = useNeuralMapStore((s) => s.storageMode)
  const setStorageMode = useNeuralMapStore((s) => s.setStorageMode)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery)
  const setSearchQuery = useNeuralMapStore((s) => s.setSearchQuery)
  const openModal = useNeuralMapStore((s) => s.openModal)
  const headerCollapsed = useNeuralMapStore((s) => s.headerCollapsed)
  const toggleHeader = useNeuralMapStore((s) => s.toggleHeader)
  const files = useNeuralMapStore((s) => s.files)
  const graph = useNeuralMapStore((s) => s.graph)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)
  const mapId = useNeuralMapStore((s) => s.mapId)
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const linkedProjectId = useNeuralMapStore((s) => s.linkedProjectId)
  const linkedProjectName = useNeuralMapStore((s) => s.linkedProjectName)
  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)
  const setMapId = useNeuralMapStore((s) => s.setMapId)
  const showSaveModalFromStore = useNeuralMapStore((s) => s.showSaveModal)
  const setShowSaveModalStore = useNeuralMapStore((s) => s.setShowSaveModal)

  // 프로젝트 및 카테고리 목록 로드
  const loadProjectsAndCategories = useCallback(async () => {
    try {
      // 카테고리 먼저 로드
      const catRes = await fetch('/api/project-categories')
      let catData: any[] = []
      if (catRes.ok) {
        catData = await catRes.json()
        setCategories(Array.isArray(catData) ? catData : [])
      }

      // 프로젝트 로드
      const projectRes = await fetch('/api/projects')
      if (projectRes.ok) {
        const data = await projectRes.json()
        const projectList = Array.isArray(data) ? data : []
        setProjects(projectList)

        // 같은 folder_path를 가진 기존 프로젝트 찾기
        if (projectPath) {
          const existing = projectList.find((p: any) => p.folder_path === projectPath)
          if (existing) {
            setExistingProjectId(existing.id)
            setSelectedProjectId(existing.id)
            setNewProjectName('')
            // 기존 프로젝트의 카테고리 선택
            if (existing.category_id) {
              setSelectedCategoryId(existing.category_id)
            } else if (catData.length > 0) {
              setSelectedCategoryId(catData[0].id)
            }
          } else {
            setExistingProjectId(null)
            // 새 프로젝트면 기본 카테고리 선택
            if (catData.length > 0) {
              setSelectedCategoryId(catData[0].id)
            }
          }
        } else if (catData.length > 0 && !selectedCategoryId) {
          setSelectedCategoryId(catData[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load projects/categories:', err)
    }
  }, [projectPath])

  // 🔥 Store의 showSaveModal 상태 감지 (Cmd+S에서 모달 열기)
  useEffect(() => {
    if (showSaveModalFromStore && !showSaveModal) {
      console.log('[Toolbar] Opening save modal from store trigger (Cmd+S)')
      // 프로젝트 및 카테고리 로드
      loadProjectsAndCategories().then(() => {
        // 폴더명으로 프로젝트 이름 제안
        if (!existingProjectId && projectPath) {
          const folderName = projectPath.split('/').pop() || 'New Project'
          setNewProjectName(folderName)
        }
        setShowSaveModal(true)
      })
      // Store 상태 리셋 (중복 트리거 방지)
      setShowSaveModalStore(false)
    }
  }, [showSaveModalFromStore, showSaveModal, loadProjectsAndCategories, existingProjectId, projectPath, setShowSaveModalStore])

  // 저장 처리
  const handleSave = useCallback(async () => {
    // 이미 프로젝트에 연결되어 있으면 카테고리 확인 후 저장
    if (linkedProjectId && mapId) {
      setIsSaving(true)
      try {
        // 먼저 프로젝트의 카테고리 정보 확인
        const projectRes = await fetch(`/api/projects/${linkedProjectId}`)
        let projectData: any = null
        if (projectRes.ok) {
          projectData = await projectRes.json()
        }

        // 🔥 카테고리가 없으면 모달을 열어서 카테고리 선택하도록 함
        if (!projectData?.category_id) {
          setIsSaving(false)
          console.log('[Toolbar] No category set, opening modal for category selection')
          await loadProjectsAndCategories()
          setSelectedProjectId(linkedProjectId)
          setNewProjectName('')
          setShowSaveModal(true)
          return
        }

        // 카테고리가 있으면 바로 저장
        const res = await fetch(`/api/neural-map/${mapId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            graph,
            themeId,
          }),
        })

        if (res.ok) {
          // folder_path도 업데이트
          if (projectPath) {
            await fetch(`/api/projects/${linkedProjectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder_path: projectPath })
            })
          }

          // 카테고리 정보 가져오기
          let categoryName: string | undefined
          let categoryColor: string | undefined
          if (projectData?.category_id) {
            const catRes = await fetch('/api/project-categories')
            if (catRes.ok) {
              const cats = await catRes.json()
              const cat = cats.find((c: any) => c.id === projectData.category_id)
              if (cat) {
                categoryName = cat.name
                categoryColor = cat.color
              }
            }
          }

          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 2000)
          showSaveToast(
            '저장 완료!',
            linkedProjectName || '프로젝트',
            categoryName,
            categoryColor
          )
        }
      } catch (err) {
        console.error('Save failed:', err)
        showSaveToast('저장 실패', undefined)
      } finally {
        setIsSaving(false)
      }
      return
    }

    // 프로젝트 연결 없으면 모달 표시
    if (projectPath && !linkedProjectId) {
      await loadProjectsAndCategories()
      // 폴더명으로 프로젝트 이름 제안 (기존 프로젝트 없을 때만)
      if (!existingProjectId) {
        const folderName = projectPath.split('/').pop() || 'New Project'
        setNewProjectName(folderName)
      }
      setShowSaveModal(true)
      return
    }

    // 아무것도 없으면 안내 (폴더도 없고 프로젝트 연결도 없음)
    if (!projectPath && !linkedProjectId) {
      showSaveToast('저장할 폴더를 먼저 열어주세요', undefined)
    }
  }, [linkedProjectId, linkedProjectName, mapId, graph, themeId, projectPath, loadProjectsAndCategories, existingProjectId, showSaveToast])

  // 프로젝트에 저장 (새 프로젝트 생성 또는 기존 프로젝트 선택)
  const saveToProject = useCallback(async () => {
    setIsSaving(true)
    try {
      let targetProjectId = selectedProjectId

      // 새 프로젝트 생성
      if (!targetProjectId && newProjectName.trim()) {
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newProjectName.trim(),
            folder_path: projectPath,
            category_id: selectedCategoryId, // 카테고리 포함
          }),
        })

        if (!createRes.ok) {
          throw new Error('Failed to create project')
        }

        const newProject = await createRes.json()
        targetProjectId = newProject.id
        console.log('[Toolbar] Created new project:', newProject.id, newProject.name)
      }

      if (!targetProjectId) {
        throw new Error('No project selected')
      }

      // Neural Map을 프로젝트에 연결
      let targetMapId = mapId

      if (targetMapId) {
        // 기존 맵 업데이트 (project_id 설정)
        await fetch(`/api/neural-map/${targetMapId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: targetProjectId,
            graph,
            themeId,
          }),
        })
      } else {
        // 새 맵 생성 (project_id와 함께)
        const createMapRes = await fetch('/api/neural-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newProjectName.trim() || linkedProjectName || 'Neural Map',
            project_id: targetProjectId,
          }),
        })

        if (createMapRes.ok) {
          const newMap = await createMapRes.json()
          targetMapId = newMap.id
          setMapId(newMap.id)
        }
      }

      // folder_path 및 category_id 저장 (기존 프로젝트도 카테고리 업데이트)
      const updateData: any = {}
      if (projectPath) updateData.folder_path = projectPath
      if (selectedCategoryId) updateData.category_id = selectedCategoryId

      if (Object.keys(updateData).length > 0) {
        await fetch(`/api/projects/${targetProjectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        })
      }

      // 스토어 업데이트
      const projectName = newProjectName.trim() || projects.find(p => p.id === targetProjectId)?.name || null
      setLinkedProject(targetProjectId, projectName)

      // 선택된 카테고리 정보 찾기
      const savedCategory = categories.find(c => c.id === selectedCategoryId)

      setShowSaveModal(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      // 토스트로 저장 위치 표시 (카테고리 포함)
      showSaveToast('저장 완료!', projectName || '새 프로젝트', savedCategory?.name, savedCategory?.color)

      console.log('[Toolbar] Saved to project:', targetProjectId, 'category:', savedCategory?.name)
    } catch (err) {
      console.error('Save to project failed:', err)
      showSaveToast('저장 실패', undefined)
    } finally {
      setIsSaving(false)
    }
  }, [selectedProjectId, newProjectName, projectPath, mapId, graph, themeId, linkedProjectName, projects, setLinkedProject, setMapId, showSaveToast, selectedCategoryId])

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

  // 저장 토스트 컴포넌트 (항상 렌더링)
  const SaveToastComponent = (
    <AnimatePresence>
      {saveToast.show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className={cn(
            'fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-5 py-4 rounded-xl shadow-2xl',
            'flex items-center gap-3 backdrop-blur-sm',
            saveToast.projectName
              ? 'bg-zinc-900/95 border border-zinc-700 text-white'
              : 'bg-red-500/95 text-white'
          )}
        >
          {saveToast.projectName ? (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: saveToast.categoryColor || '#22c55e' }}
            >
              <Check className="w-5 h-5 text-white" />
            </div>
          ) : (
            <X className="w-5 h-5 shrink-0" />
          )}
          <div className="flex flex-col">
            <span className="font-bold text-base">{saveToast.message}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-zinc-400">
                📁 {saveToast.projectName}
              </span>
              {saveToast.categoryName && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span
                    className="text-sm font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${saveToast.categoryColor}25`,
                      color: saveToast.categoryColor
                    }}
                  >
                    {saveToast.categoryName}
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // 접힌 상태 - 펼치기 버튼만 표시
  if (headerCollapsed) {
    return (
      <>
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
        {SaveToastComponent}
      </>
    )
  }

  return (
    <div
      className={cn(
        'h-14 flex items-center justify-between px-4 border-b relative z-50 min-w-0 overflow-hidden',
        isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* Left: Save & Mode & Search */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Save Button (왼쪽에 배치하여 헤더에 가려지지 않음) */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{
            backgroundColor: saveSuccess ? '#22c55e' : currentAccent.color,
          }}
          onMouseEnter={(e) => !saveSuccess && (e.currentTarget.style.backgroundColor = currentAccent.hoverColor)}
          onMouseLeave={(e) => !saveSuccess && (e.currentTarget.style.backgroundColor = currentAccent.color)}
          title={linkedProjectId ? '저장 (Cmd+S)' : '프로젝트에 저장'}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {saveSuccess ? '저장됨' : linkedProjectId ? '저장' : '저장'}
          </span>
        </button>

        <div className={cn('w-px h-6 shrink-0 hidden sm:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Mode Selector */}
        <div className="relative shrink-0 hidden md:block">
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            )}
          >
            <span className="hidden lg:inline">Mode:</span> Manual
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

        {/* 🔥 Storage Mode Selector */}
        <div className="relative shrink-0 hidden lg:block">
          <button
            onClick={() => setShowStorageModeMenu(!showStorageModeMenu)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
            )}
            title="파일 저장 위치 설정"
          >
            {storageMode === 'local' && <HardDrive className="w-4 h-4" />}
            {storageMode === 'supabase' && <Database className="w-4 h-4" />}
            {storageMode === 'gcs' && <Cloud className="w-4 h-4" />}
            <span className="hidden xl:inline">
              {storageMode === 'local' ? '로컬' : storageMode === 'supabase' ? 'Cloud' : 'GCS'}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {showStorageModeMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowStorageModeMenu(false)}
              />
              <div
                className={cn(
                  'absolute top-full left-0 mt-1 w-56 rounded-lg shadow-lg z-20 py-1',
                  isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'
                )}
              >
                <button
                  onClick={() => {
                    setStorageMode('local')
                    setShowStorageModeMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                    storageMode === 'local'
                      ? isDark ? 'bg-zinc-700 text-white' : 'bg-blue-50 text-blue-700'
                      : isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                  )}
                >
                  <HardDrive className="w-4 h-4" />
                  <div>
                    <div className="font-medium">로컬 참조</div>
                    <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      경로만 저장 (용량 절약)
                    </div>
                  </div>
                  {storageMode === 'local' && <Check className="w-4 h-4 ml-auto text-green-500" />}
                </button>
                <button
                  onClick={() => {
                    setStorageMode('supabase')
                    setShowStorageModeMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                    storageMode === 'supabase'
                      ? isDark ? 'bg-zinc-700 text-white' : 'bg-blue-50 text-blue-700'
                      : isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                  )}
                >
                  <Database className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Supabase Storage</div>
                    <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      클라우드 동기화
                    </div>
                  </div>
                  {storageMode === 'supabase' && <Check className="w-4 h-4 ml-auto text-green-500" />}
                </button>
                <button
                  onClick={() => {
                    setStorageMode('gcs')
                    setShowStorageModeMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors',
                    storageMode === 'gcs'
                      ? isDark ? 'bg-zinc-700 text-white' : 'bg-blue-50 text-blue-700'
                      : isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                  )}
                >
                  <Cloud className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Google Cloud</div>
                    <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      Google Drive 연동 필요
                    </div>
                  </div>
                  {storageMode === 'gcs' && <Check className="w-4 h-4 ml-auto text-green-500" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Search with Autocomplete */}
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
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Add Node / Edge */}
        <button
          onClick={() => openModal('nodeEditor')}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{
            backgroundColor: currentAccent.color,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentAccent.hoverColor}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = currentAccent.color}
          title="노드 추가 (N)"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">노드</span>
        </button>
        <button
          onClick={() => openModal('export', { mode: 'edge' })}
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

        {/* Undo/Redo - 작은 화면에서 숨김 */}
        <div className="hidden md:flex items-center gap-1">
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

        <div className={cn('w-px h-6 hidden md:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Theme - 작은 화면에서 숨김 */}
        <div className="relative hidden lg:block">
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

        {/* Import/Export - 작은 화면에서 숨김 */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors hidden lg:block',
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
            'p-2 rounded-lg transition-colors hidden lg:block',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
          )}
          title="Export"
        >
          <Download className="w-4 h-4" />
        </button>

        <div className={cn('w-px h-6 hidden sm:block', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />

        {/* Blueprint Execution */}
        <button
          onClick={() => setShowBlueprintPanel(true)}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-white shrink-0"
          style={{ backgroundColor: currentAccent.color }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = currentAccent.hoverColor}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = currentAccent.color}
          title="Blueprint 실행"
        >
          <Zap className="w-4 h-4" />
          <span className="hidden sm:inline">Blueprint</span>
        </button>

        {/* Save Modal (저장 버튼은 왼쪽으로 이동됨) */}
        {showSaveModal && (
          <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSaveModal(false)} />
            <div className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-xl shadow-2xl z-50 p-6',
              isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
            )}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  프로젝트에 저장
                </h2>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className={cn('p-1 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current folder */}
              <div className={cn('p-3 rounded-lg mb-4', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                <p className={cn('text-xs mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>현재 폴더</p>
                <p className={cn('text-sm font-mono truncate', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  {projectPath}
                </p>
              </div>

              {/* 기존 프로젝트 발견 경고 */}
              {existingProjectId && (
                <div className={cn('p-3 rounded-lg mb-4 border-2', 'bg-amber-500/10 border-amber-500/50')}>
                  <p className="text-sm font-medium text-amber-500">
                    ⚠️ 이 폴더로 이미 프로젝트가 있습니다
                  </p>
                  <p className={cn('text-xs mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    기존 프로젝트에 저장하면 덮어씁니다
                  </p>
                </div>
              )}

              {/* 카테고리 선택 - 항상 표시 */}
              {categories.length > 0 && (
                <div className="mb-4">
                  <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                    📂 저장할 카테고리 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left',
                          selectedCategoryId === cat.id
                            ? 'ring-2 ring-offset-1'
                            : isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50',
                          isDark ? 'border-zinc-700' : 'border-zinc-200'
                        )}
                        style={selectedCategoryId === cat.id ? {
                          borderColor: cat.color,
                          '--tw-ring-color': cat.color,
                          backgroundColor: `${cat.color}15`
                        } as React.CSSProperties : undefined}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* New Project */}
              {!existingProjectId && (
                <div className="mb-4">
                  <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                    <FolderPlus className="w-4 h-4 inline mr-1" />
                    새 프로젝트 생성
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => {
                      setNewProjectName(e.target.value)
                      setSelectedProjectId(null) // 새 프로젝트 입력 시 기존 선택 해제
                    }}
                    placeholder="프로젝트 이름"
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                        : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                    )}
                  />
                </div>
              )}

              {/* Or Select Existing */}
              {projects.length > 0 && (
                <div className="mb-4">
                  <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                    {existingProjectId ? '기존 프로젝트 (선택됨)' : '또는 기존 프로젝트 선택'}
                  </label>
                  <select
                    value={selectedProjectId || ''}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value || null)
                      if (e.target.value) setNewProjectName('') // 선택 시 새 프로젝트 입력 초기화
                    }}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-sm outline-none',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-white border-zinc-200 text-zinc-900',
                      existingProjectId && 'ring-2 ring-amber-500'
                    )}
                  >
                    <option value="">선택...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.id === existingProjectId ? '(이 폴더)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 카테고리 미선택 경고 */}
              {categories.length > 0 && !selectedCategoryId && (
                <div className={cn('p-2 rounded-lg mb-4 text-center', 'bg-red-500/10 border border-red-500/30')}>
                  <p className="text-sm text-red-500">⚠️ 카테고리를 선택해주세요</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                  )}
                >
                  취소
                </button>
                <button
                  onClick={saveToProject}
                  disabled={isSaving || (!newProjectName.trim() && !selectedProjectId) || (categories.length > 0 && !selectedCategoryId)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: existingProjectId && selectedProjectId === existingProjectId ? '#f59e0b' : currentAccent.color }}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {selectedProjectId === existingProjectId ? '덮어쓰기' : selectedProjectId ? '선택한 프로젝트에 저장' : '새 프로젝트 생성'}
                </button>
              </div>
            </div>
          </>
        )}

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
          title="헤더 접기 (Toolbar + Tabs)"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* 저장 완료 토스트 */}
      {SaveToastComponent}

      {/* Blueprint Panel */}
      <BlueprintPanel
        isOpen={showBlueprintPanel}
        onClose={() => setShowBlueprintPanel(false)}
      />
    </div>
  )
}
