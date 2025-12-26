'use client'

import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useNeuralMapApi } from '@/lib/neural-map/useNeuralMapApi'
import {
  parseWikiLinks,
  extractTitle,
  extractTags,
  getDailyNoteFileName,
  getDailyNoteTemplate,
  NOTE_TEMPLATES,
  findBacklinks,
  type NoteTemplate,
} from '@/lib/neural-map/markdown-parser'
import {
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  ArrowLeft,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Eye,
  EyeOff,
  Columns,
  Download,
  Search,
} from 'lucide-react'
import type { MarkdownEditorRef } from '../editor/MarkdownEditor'
import { MarkdownPreview } from '../editor/MarkdownPreview'
import { SearchPalette } from '../editor/SearchPalette'
import { ExportModal } from '../editor/ExportModal'

// CodeMirror 에디터 동적 로드 (SSR 방지)
const MarkdownEditor = lazy(() =>
  import('../editor/MarkdownEditor').then(mod => ({ default: mod.MarkdownEditor }))
)

interface MarkdownEditorPanelProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function MarkdownEditorPanel({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: MarkdownEditorPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(null)
  const [extractedTags, setExtractedTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit')
  const [showSearch, setShowSearch] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [panelWidth, setPanelWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const editorRef = useRef<MarkdownEditorRef>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const mapId = useNeuralMapStore((s) => s.mapId)
  const graph = useNeuralMapStore((s) => s.graph)
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const linkedProjectId = useNeuralMapStore((s) => s.linkedProjectId)
  const files = useNeuralMapStore((s) => s.files)
  const setFiles = useNeuralMapStore((s) => s.setFiles)
  const buildGraphFromFilesAsync = useNeuralMapStore((s) => s.buildGraphFromFilesAsync)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const { createNode, createEdge } = useNeuralMapApi(mapId)

  // 콘텐츠에서 태그 추출
  useEffect(() => {
    const tags = extractTags(content)
    setExtractedTags(tags)
  }, [content])

  // 모든 파일에서 기존 태그 수집
  const existingTags = useMemo(() => {
    const allTags = new Set<string>()
    files.forEach(f => {
      if (f.content) {
        extractTags(f.content).forEach(tag => allTags.add(tag))
      }
    })
    return Array.from(allTags).sort()
  }, [files])

  // 에디터용 파일 목록 (마크다운 파일만)
  const editorFiles = useMemo(() => {
    return files
      .filter(f => f.name.endsWith('.md'))
      .map(f => ({
        id: f.id,
        name: f.name,
        path: f.path || f.name,
        content: f.content,
      }))
  }, [files])

  // 툴바 버튼 클릭 핸들러
  const handleToolbarAction = useCallback((action: string) => {
    if (!editorRef.current) return

    switch (action) {
      case 'bold':
        editorRef.current.wrapSelection('**', '**')
        break
      case 'italic':
        editorRef.current.wrapSelection('*', '*')
        break
      case 'strikethrough':
        editorRef.current.wrapSelection('~~', '~~')
        break
      case 'code':
        editorRef.current.wrapSelection('`', '`')
        break
      case 'link':
        editorRef.current.insertLink()
        break
      case 'h1':
        editorRef.current.insertText('# ')
        break
      case 'h2':
        editorRef.current.insertText('## ')
        break
      case 'h3':
        editorRef.current.insertText('### ')
        break
      case 'bullet':
        editorRef.current.insertText('- ')
        break
      case 'numbered':
        editorRef.current.insertText('1. ')
        break
      case 'checkbox':
        editorRef.current.insertText('- [ ] ')
        break
      case 'quote':
        editorRef.current.insertText('> ')
        break
    }
    editorRef.current.focus()
  }, [])

  // 리셋
  const resetEditor = useCallback(() => {
    setTitle('')
    setContent('')
    setShowTemplates(true)
    setSelectedTemplate(null)
    setExtractedTags([])
  }, [])

  // 템플릿 선택
  const handleSelectTemplate = useCallback((template: NoteTemplate) => {
    setSelectedTemplate(template)
    setShowTemplates(false)

    if (template.id === 'daily') {
      // Daily Note는 제목 자동 설정
      const today = new Date()
      setTitle(getDailyNoteFileName(today).replace('.md', ''))
      setContent(getDailyNoteTemplate(today))
    } else if (template.id === 'blank') {
      setTitle('')
      setContent('')
    } else {
      setContent(template.content)
    }
  }, [])

  // Daily Note 바로 생성
  const handleCreateDailyNote = useCallback(() => {
    const dailyTemplate = NOTE_TEMPLATES.find(t => t.id === 'daily')
    if (dailyTemplate) {
      handleSelectTemplate(dailyTemplate)
    }
  }, [handleSelectTemplate])

  // 저장 - 파일 상태 업데이트를 패널 닫힘 애니메이션 이후로 지연
  const handleSave = useCallback(async () => {
    if (!title.trim()) return

    // 로컬 폴더도 없고 클라우드 프로젝트도 없으면 경고
    if (!projectPath && !linkedProjectId && !mapId) {
      alert('프로젝트를 먼저 선택하거나 생성해주세요.')
      return
    }

    setIsSaving(true)
    try {
      // 파일명 생성 (특수문자 제거)
      const sanitizedTitle = title.trim().replace(/[<>:"/\\|?*]/g, '-')
      const fileName = `${sanitizedTitle}.md`

      // 마크다운 파일 내용 생성 (제목이 없으면 추가)
      let fileContent = content
      if (!content.startsWith('---') && !content.match(/^#\s+/m)) {
        fileContent = `# ${title.trim()}\n\n${content}`
      }

      // 저장할 파일 데이터를 미리 준비
      let pendingFileUpdate: typeof files[0] | null = null

      // 1. 프로젝트 폴더가 있으면 실제 파일로 저장
      if (projectPath && window.electron?.fs?.writeFile) {
        const filePath = `${projectPath}/${fileName}`

        try {
          await window.electron.fs.writeFile(filePath, fileContent)
          console.log('[Note] Saved to file:', filePath)

          // 파일 데이터 준비 (나중에 추가)
          pendingFileUpdate = {
            id: `local-${Date.now()}`,
            name: fileName,
            path: fileName,
            type: 'markdown' as const,
            content: fileContent,
            size: fileContent.length,
            createdAt: new Date().toISOString(),
            mapId: mapId || '',
            url: '',
          }

          // fs:changed 이벤트 발송 (파일 워처가 감지하도록)
          window.dispatchEvent(new CustomEvent('note-saved', { detail: { path: filePath } }))
        } catch (fsErr) {
          console.error('[Note] File save failed:', fsErr)
        }
      }

      // 2. 클라우드 프로젝트 또는 projectPath 없이 linkedProjectId만 있는 경우
      if (!projectPath && linkedProjectId) {
        pendingFileUpdate = {
          id: `note-${Date.now()}`,
          name: fileName,
          path: fileName,
          type: 'markdown' as const,
          content: fileContent,
          size: fileContent.length,
          createdAt: new Date().toISOString(),
          mapId: mapId || '',
          url: '',
        }
      }

      // 3. 클라우드 프로젝트가 있으면 API로 노드 생성
      if (mapId || linkedProjectId) {
        // 태그 추출 (frontmatter + inline tags)
        const allTags = ['markdown', 'note', ...extractedTags]

        const newNode = await createNode({
          type: 'doc',
          title: title.trim(),
          content: content,
          summary: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          tags: allTags,
          importance: 5,
        })

        if (newNode && graph?.nodes) {
          // Self 노드와 연결
          const selfNode = graph.nodes.find(n => n.type === 'self')
          if (selfNode) {
            await createEdge({
              sourceId: selfNode.id,
              targetId: newNode.id,
              type: 'parent_child',
              weight: 0.7,
            })
          }

          // [[위키링크]] 파싱 및 엣지 생성
          const wikiLinks = parseWikiLinks(content)
          for (const link of wikiLinks) {
            const existingNode = graph.nodes.find(
              n => n.title.toLowerCase() === link.target.toLowerCase()
            )

            if (existingNode) {
              await createEdge({
                sourceId: newNode.id,
                targetId: existingNode.id,
                type: 'references',
                weight: 0.5,
                label: link.alias || undefined,
              })
            } else {
              const linkedNode = await createNode({
                type: 'concept',
                title: link.target,
                summary: '[[링크]]에서 자동 생성',
                tags: ['auto-generated'],
                importance: 3,
              })

              if (linkedNode) {
                await createEdge({
                  sourceId: newNode.id,
                  targetId: linkedNode.id,
                  type: 'references',
                  weight: 0.5,
                  label: link.alias || undefined,
                })
              }
            }
          }
        }
      }

      resetEditor()

      // 먼저 패널을 닫고, 애니메이션 완료 후 파일 상태 업데이트
      onClose()

      if (pendingFileUpdate) {
        const fileToAdd = pendingFileUpdate
        setTimeout(async () => {
          setFiles([...files, fileToAdd])
          // 그래프 재빌드하여 방사형 맵에 새 노드 표시
          await buildGraphFromFilesAsync()
        }, 300)
      }
    } catch (err) {
      console.error('노트 저장 실패:', err)
    } finally {
      setIsSaving(false)
    }
  }, [title, content, mapId, projectPath, linkedProjectId, graph, files, extractedTags, createNode, createEdge, setFiles, buildGraphFromFilesAsync, resetEditor, onClose])

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || showTemplates) return

      // Cmd+S: 저장
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
        return
      }

      // Cmd+\: 스플릿 뷰 토글
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setViewMode(prev => prev === 'split' ? 'edit' : 'split')
        return
      }

      // Cmd+Shift+P: 프리뷰 토글
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setViewMode(prev => prev === 'preview' ? 'edit' : 'preview')
        return
      }

      // Cmd+P: 검색 팔레트
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setShowSearch(prev => !prev)
        return
      }

      // Cmd+E: 내보내기
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        setShowExport(true)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showTemplates, handleSave])

  // 패널 리사이즈 핸들러
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = panelWidth

    const handleMouseMove = (e: MouseEvent) => {
      // 왼쪽으로 드래그하면 너비가 증가 (패널이 오른쪽에 있으므로)
      const deltaX = startX - e.clientX
      const newWidth = Math.min(Math.max(startWidth + deltaX, 300), 800)
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth])

  // 위키링크 클릭 핸들러
  const handleWikiLinkClick = useCallback((target: string) => {
    console.log('[Editor] Wiki link clicked:', target)
    // TODO: 해당 노트로 이동하거나 생성
  }, [])

  // 태그 클릭 핸들러
  const handleTagClick = useCallback((tag: string) => {
    console.log('[Editor] Tag clicked:', tag)
    // TODO: 태그 필터링
  }, [])

  // 검색 결과에서 파일 선택
  const handleSearchSelectFile = useCallback((file: { id: string; name: string; path?: string; content?: string }) => {
    console.log('[Search] File selected:', file.name)
    // 최근 파일에 추가
    setRecentFiles(prev => {
      const updated = [file.id, ...prev.filter(id => id !== file.id)].slice(0, 10)
      return updated
    })
    // 파일 내용을 에디터에 로드
    setTitle(file.name.replace('.md', ''))
    setContent(file.content || '')
    setShowTemplates(false)
    setSelectedTemplate(null)
    setShowSearch(false)
  }, [])

  // 검색 결과에서 태그 선택
  const handleSearchSelectTag = useCallback((tag: string) => {
    console.log('[Search] Tag selected:', tag)
    // 에디터에 태그 삽입
    if (editorRef.current) {
      editorRef.current.insertText(` #${tag} `)
      editorRef.current.focus()
    }
    setShowSearch(false)
  }, [])

  // 검색에서 새 노트 생성
  const handleSearchCreateNote = useCallback((noteTitle: string) => {
    console.log('[Search] Create note:', noteTitle)
    setTitle(noteTitle)
    setContent(`# ${noteTitle}\n\n`)
    setShowTemplates(false)
    setSelectedTemplate(null)
    setShowSearch(false)
  }, [])

  // 이미지 드롭/붙여넣기 핸들러
  const handleImageDrop = useCallback(async (file: File): Promise<string> => {
    // 프로젝트 폴더가 있으면 파일로 저장
    if (projectPath && window.electron?.fs?.writeFile) {
      try {
        // 이미지 폴더 생성 (있으면 무시)
        const imageDir = `${projectPath}/images`
        try {
          await window.electron.fs.mkdir?.(imageDir)
        } catch {
          // 폴더가 이미 존재하면 무시
        }

        // 파일명 생성 (timestamp + 원본 이름)
        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `${timestamp}_${safeName}`
        const filePath = `${imageDir}/${fileName}`

        // File을 base64로 읽어서 저장
        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            // data:image/png;base64, 부분을 제거하고 순수 base64만 추출
            const result = reader.result as string
            resolve(result)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        await window.electron.fs.writeFile(filePath, base64Content)

        console.log('[Image] Saved to:', filePath)
        return `images/${fileName}`
      } catch (err) {
        console.error('[Image] Failed to save file:', err)
      }
    }

    // 로컬 저장 실패시 Base64로 변환
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [projectPath])

  return (
    <>
      {/* 검색 팔레트 */}
      <SearchPalette
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        files={editorFiles}
        existingTags={existingTags}
        onSelectFile={handleSearchSelectFile}
        onSelectTag={handleSearchSelectTag}
        onCreateNote={handleSearchCreateNote}
        onFocusNode={setFocusNodeId}
        isDark={isDark}
        recentFiles={recentFiles}
      />

      {/* 내보내기 모달 */}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        content={content}
        title={title || 'Untitled'}
        isDark={isDark}
      />

      <AnimatePresence mode="wait">
        {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: isCollapsed ? 40 : panelWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: isResizing ? 0 : 0.2 }}
          className={cn(
            'h-full border-l flex flex-col overflow-hidden flex-shrink-0 relative',
            isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-zinc-200'
          )}
        >
          {/* 리사이즈 핸들 */}
          {!isCollapsed && (
            <div
              onMouseDown={handleResizeStart}
              className={cn(
                'absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 transition-colors',
                isDark
                  ? 'hover:bg-purple-500/50 active:bg-purple-500'
                  : 'hover:bg-purple-400/50 active:bg-purple-400',
                isResizing && (isDark ? 'bg-purple-500' : 'bg-purple-400')
              )}
              title="드래그하여 너비 조절"
            />
          )}
          {isCollapsed ? (
            // 접힌 상태
            <div className="h-full flex flex-col items-center py-2">
              <button
                onClick={onToggleCollapse}
                className={cn(
                  'p-2 rounded transition-colors',
                  isDark ? 'hover:bg-[#27272a]' : 'hover:bg-zinc-100'
                )}
                title="펼치기"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="mt-4 writing-vertical-rl text-xs text-zinc-500">
                Editor
              </div>
            </div>
          ) : showTemplates ? (
            // 템플릿 선택 화면
            <>
              {/* 헤더 */}
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2 border-b flex-shrink-0',
                  isDark ? 'border-zinc-800' : 'border-zinc-200'
                )}
              >
                <span className="text-sm text-zinc-500">New Note</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleCollapse}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-zinc-100'
                    )}
                    title="Collapse"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      resetEditor()
                      onClose()
                    }}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-zinc-100'
                    )}
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 템플릿 목록 */}
              <div className="flex-1 overflow-y-auto py-2">
                <div className="space-y-0.5">
                  {/* Daily Note 빠른 버튼 */}
                  <button
                    onClick={handleCreateDailyNote}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 transition-colors text-left',
                      isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                    )}
                  >
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    <div className="flex-1">
                      <span className="text-sm">Daily Note</span>
                      <span className="text-xs text-zinc-500 ml-2">{getDailyNoteFileName()}</span>
                    </div>
                  </button>

                  {NOTE_TEMPLATES.filter(t => t.id !== 'daily').map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 transition-colors text-left',
                        isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                      )}
                    >
                      <FileText className="w-4 h-4 text-zinc-500" />
                      <span className="text-sm">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // 에디터 화면
            <>
              {/* 헤더 */}
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2 border-b flex-shrink-0',
                  isDark ? 'border-[#27272a]' : 'border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTemplates(true)}
                    className={cn(
                      'p-1 rounded transition-colors',
                      isDark ? 'hover:bg-[#27272a]' : 'hover:bg-zinc-100'
                    )}
                    title="템플릿으로 돌아가기"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-medium">{selectedTemplate?.name || 'New Note'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleCollapse}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      isDark ? 'hover:bg-[#27272a]' : 'hover:bg-zinc-100'
                    )}
                    title="접기"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      resetEditor()
                      onClose()
                    }}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      isDark ? 'hover:bg-[#27272a]' : 'hover:bg-zinc-100'
                    )}
                    title="닫기"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 제목 입력 */}
              <div className={cn('px-3 py-2 border-b', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="노트 제목..."
                  className={cn(
                    'no-focus-ring w-full px-2 py-1.5 text-sm rounded border outline-none transition-colors',
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>

              {/* 포맷팅 툴바 */}
              <div className={cn('px-2 py-1.5 border-b flex items-center gap-0.5 flex-wrap', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                <ToolbarButton icon={Bold} action="bold" onClick={handleToolbarAction} isDark={isDark} tooltip="Bold (Cmd+B)" />
                <ToolbarButton icon={Italic} action="italic" onClick={handleToolbarAction} isDark={isDark} tooltip="Italic (Cmd+I)" />
                <ToolbarButton icon={Strikethrough} action="strikethrough" onClick={handleToolbarAction} isDark={isDark} tooltip="Strikethrough (Cmd+Shift+S)" />
                <ToolbarButton icon={Code} action="code" onClick={handleToolbarAction} isDark={isDark} tooltip="Code (Cmd+E)" />
                <div className={cn('w-px h-5 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
                <ToolbarButton icon={Heading1} action="h1" onClick={handleToolbarAction} isDark={isDark} tooltip="Heading 1 (Cmd+1)" />
                <ToolbarButton icon={Heading2} action="h2" onClick={handleToolbarAction} isDark={isDark} tooltip="Heading 2 (Cmd+2)" />
                <ToolbarButton icon={Heading3} action="h3" onClick={handleToolbarAction} isDark={isDark} tooltip="Heading 3 (Cmd+3)" />
                <div className={cn('w-px h-5 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
                <ToolbarButton icon={List} action="bullet" onClick={handleToolbarAction} isDark={isDark} tooltip="Bullet List (Cmd+Shift+8)" />
                <ToolbarButton icon={ListOrdered} action="numbered" onClick={handleToolbarAction} isDark={isDark} tooltip="Numbered List (Cmd+Shift+7)" />
                <ToolbarButton icon={CheckSquare} action="checkbox" onClick={handleToolbarAction} isDark={isDark} tooltip="Checkbox (Cmd+Shift+C)" />
                <ToolbarButton icon={Quote} action="quote" onClick={handleToolbarAction} isDark={isDark} tooltip="Quote (Cmd+Shift+.)" />
                <div className={cn('w-px h-5 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
                <ToolbarButton icon={Link} action="link" onClick={handleToolbarAction} isDark={isDark} tooltip="Wiki Link (Cmd+Shift+K)" />
                <div className={cn('w-px h-5 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
                <button
                  onClick={() => setShowSearch(true)}
                  className={cn(
                    'p-1.5 rounded transition-colors flex items-center gap-1',
                    isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
                  )}
                  title="Quick Open (Cmd+P)"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  className={cn(
                    'p-1.5 rounded transition-colors flex items-center gap-1',
                    isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
                  )}
                  title="Export (Cmd+E)"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* 뷰 모드 토글 (오른쪽 정렬) */}
                <div className="flex-1" />
                <div className={cn('flex items-center gap-0.5 p-0.5 rounded', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      viewMode === 'edit'
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900 shadow-sm'
                        : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
                    )}
                    title="Edit only"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      viewMode === 'split'
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900 shadow-sm'
                        : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
                    )}
                    title="Split view (Cmd+\\)"
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      viewMode === 'preview'
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900 shadow-sm'
                        : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
                    )}
                    title="Preview only (Cmd+Shift+P)"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 태그 표시 */}
              {extractedTags.length > 0 && (
                <div className={cn('px-3 py-1.5 border-b flex flex-wrap gap-1', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                  {extractedTags.map((tag, i) => (
                    <span
                      key={i}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                      )}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 에디터/프리뷰 영역 */}
              <div className="flex-1 overflow-hidden flex">
                {/* 에디터 (edit 또는 split 모드) */}
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div className={cn('overflow-hidden', viewMode === 'split' ? 'w-1/2 border-r' : 'w-full', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                        </div>
                      }
                    >
                      <MarkdownEditor
                        ref={editorRef}
                        defaultValue={content}
                        onChange={setContent}
                        onWikiLinkClick={handleWikiLinkClick}
                        onTagClick={handleTagClick}
                        onSave={handleSave}
                        onImageDrop={handleImageDrop}
                        isDark={isDark}
                        placeholder="마크다운으로 작성하세요... [[위키링크]]로 연결, #태그로 분류"
                        files={editorFiles}
                        existingTags={existingTags}
                      />
                    </Suspense>
                  </div>
                )}

                {/* 프리뷰 (preview 또는 split 모드) */}
                {(viewMode === 'preview' || viewMode === 'split') && (
                  <div className={cn('overflow-hidden', viewMode === 'split' ? 'w-1/2' : 'w-full')}>
                    <MarkdownPreview
                      content={content}
                      isDark={isDark}
                    />
                  </div>
                )}
              </div>

              {/* 푸터 - 저장 버튼 */}
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2 border-t',
                  isDark ? 'border-[#27272a]' : 'border-zinc-200'
                )}
              >
                <span className="text-xs text-zinc-500">
                  {content.length} chars · {content.split('\n').length} lines
                </span>
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || isSaving}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                    title.trim() && !isSaving
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}

// 툴바 버튼 컴포넌트
interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>
  action: string
  onClick: (action: string) => void
  isDark: boolean
  tooltip: string
}

function ToolbarButton({ icon: Icon, action, onClick, isDark, tooltip }: ToolbarButtonProps) {
  return (
    <button
      onClick={() => onClick(action)}
      className={cn(
        'p-1.5 rounded transition-colors',
        isDark ? 'hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900'
      )}
      title={tooltip}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
