'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralFile } from '@/lib/neural-map/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  X,
  Copy,
  Check,
  FileCode,
  FileText,
  Image as ImageIcon,
  Film,
  File,
  ExternalLink,
  Maximize2,
  Minimize2,
  Loader2,
  Code,
  BookOpen,
  Edit3,
  Eye,
  Save,
  AlertCircle,
} from 'lucide-react'

// Monaco Editor 동적 import
const MonacoCodeEditor = dynamic(
  () => import('@/components/editor/MonacoCodeEditor').then(mod => mod.MonacoCodeEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-zinc-900">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    ),
  }
)

interface CodePreviewPanelProps {
  className?: string
}

// Get file extension
function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

// Get language for syntax highlighter
function getLanguage(fileName: string): string {
  const ext = getExtension(fileName)
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'tsx',
    'js': 'javascript',
    'jsx': 'jsx',
    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'html': 'html',
    'xml': 'xml',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'rb': 'ruby',
    'php': 'php',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'env': 'bash',
    'txt': 'text',
    'dockerfile': 'docker',
  }
  return langMap[ext] || 'text'
}

// Check if file is markdown
function isMarkdown(fileName: string): boolean {
  const ext = getExtension(fileName)
  return ext === 'md' || ext === 'markdown'
}

// Check if file is code
function isCode(fileName: string): boolean {
  const ext = getExtension(fileName)
  const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'less', 'html', 'xml', 'py', 'go', 'rs', 'java', 'kt', 'swift', 'rb', 'php', 'sql', 'sh', 'bash', 'zsh', 'yaml', 'yml', 'toml', 'ini', 'env', 'dockerfile']
  return codeExts.includes(ext)
}

// Check if file is image
function isImage(fileName: string): boolean {
  const ext = getExtension(fileName)
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext)
}

// Check if file is video
function isVideo(fileName: string): boolean {
  const ext = getExtension(fileName)
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
}

// Get icon for file type
function getFileIcon(fileName: string) {
  if (isMarkdown(fileName)) return BookOpen
  if (isCode(fileName)) return Code
  if (isImage(fileName)) return ImageIcon
  if (isVideo(fileName)) return Film
  return File
}

// Get display mode
type DisplayMode = 'code' | 'markdown' | 'image' | 'video' | 'pdf' | 'text' | 'binary'

function getDisplayMode(file: NeuralFile): DisplayMode {
  const name = file.name || ''
  if (file.type === 'binary') return 'binary'
  if (isMarkdown(name) || file.type === 'markdown') return 'markdown'
  if (isCode(name) || file.type === 'code') return 'code'
  if (isImage(name) || file.type === 'image') return 'image'
  if (isVideo(name) || file.type === 'video') return 'video'
  if (file.type === 'pdf' || getExtension(name) === 'pdf') return 'pdf'
  if (file.type === 'text') return 'text'
  return 'text'
}

export function CodePreviewPanel({ className }: CodePreviewPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const codePreviewFile = useNeuralMapStore((s) => s.codePreviewFile)
  const codePreviewOpen = useNeuralMapStore((s) => s.codePreviewOpen)
  const closeCodePreview = useNeuralMapStore((s) => s.closeCodePreview)
  const isDirty = useNeuralMapStore((s) => s.codePreviewDirty)
  const setDirty = useNeuralMapStore((s) => s.setCodePreviewDirty)
  const updateFileContent = useNeuralMapStore((s) => s.updateFileContent)

  const [content, setContent] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)

  // Resizing State
  const [panelWidth, setPanelWidth] = useState(480)
  const [isResizing, setIsResizing] = useState(false)

  // Start Resizing
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent event bubbling
    setIsResizing(true)
  }, [])

  // Handle Resizing
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new width relative to right edge of screen
      const newWidth = window.innerWidth - e.clientX
      // Min 300px, Max 90% of screen width
      const constrainedWidth = Math.max(300, Math.min(newWidth, window.innerWidth * 0.9))

      setPanelWidth(constrainedWidth)

      // If manually resizing, turn off preset expanded mode
      if (isExpanded) {
        setIsExpanded(false)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    // Global style changes during resize
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, isExpanded])

  // Fetch file content
  useEffect(() => {
    console.log('[CodePreview useEffect] codePreviewFile:', codePreviewFile?.name, 'open:', codePreviewOpen)

    if (!codePreviewFile || !codePreviewOpen) {
      console.log('[CodePreview] Early return: no file or not open')
      setContent(null)
      setEditedContent('')
      setError(null)
      setIsLoading(false)
      return
    }

    // 로컬 파일 캐시에서 먼저 확인 (가장 빠른 경로)
    const cachedContent = (window as any).__localFileContents?.[codePreviewFile.id]
    if (cachedContent) {
      console.log('[CodePreview] ✅ Using cached content:', codePreviewFile.name, 'length:', cachedContent.length)
      setContent(cachedContent)
      setEditedContent(cachedContent)
      setIsLoading(false)
      setError(null)
      return
    }

    const displayMode = getDisplayMode(codePreviewFile)
    console.log('[CodePreview] displayMode:', displayMode, 'type:', codePreviewFile.type)

    // For images and videos, no content fetch needed
    if (displayMode === 'image' || displayMode === 'video' || displayMode === 'pdf' || displayMode === 'binary') {
      console.log('[CodePreview] Early return: media type')
      setContent(null)
      setEditedContent('')
      setError(null)
      setIsLoading(false)
      return
    }

    // Check if content is already cached in file object
    if (codePreviewFile.content) {
      console.log('[CodePreview] Using file.content')
      setContent(codePreviewFile.content)
      setEditedContent(codePreviewFile.content)
      setIsLoading(false)
      return
    }

    // Check URL
    if (!codePreviewFile.url) {
      console.log('[CodePreview] No URL')
      const emptyContent = '// 파일 URL이 없습니다'
      setContent(emptyContent)
      setEditedContent(emptyContent)
      setIsLoading(false)
      return
    }

    // Check for mock/demo URLs
    if (codePreviewFile.url.startsWith('mock://')) {
      const demoContent = generateDemoContent(codePreviewFile.name)
      setContent(demoContent)
      setEditedContent(demoContent)
      setIsLoading(false)
      return
    }

    console.log('[CodePreview] Fetching from URL:', codePreviewFile.url)
    let isCancelled = false
    setIsLoading(true)
    setError(null)

    const fetchContent = async () => {
      try {
        // 전역 캐시에서 로컬 파일 내용 확인
        const allCached = (window as any).__localFileContents || {}
        console.log('[CodePreview] Looking for id:', codePreviewFile.id, 'in cache. Available keys:', Object.keys(allCached))

        const cachedContent = allCached[codePreviewFile.id]
        console.log('[CodePreview] Cached value type:', typeof cachedContent, 'truthy:', !!cachedContent, 'length:', cachedContent?.length)

        if (cachedContent) {
          console.log('[CodePreview] Found cached content for:', codePreviewFile.name, 'length:', cachedContent.length)
          setContent(cachedContent)
          setEditedContent(cachedContent)
          setIsLoading(false)
          return
        } else {
          console.log('[CodePreview] Cache miss - content not found or falsy')
        }

        // 로컬 파일 처리 (File 객체가 있는 경우)
        const localFile = (codePreviewFile as any)._localFile as File | undefined
        if (localFile) {
          const text = await localFile.text()
          if (!isCancelled) {
            setContent(text || '')
            setEditedContent(text || '')
          }
          return
        }

        // Blob URL 처리 (blob:로 시작하는 경우)
        if (codePreviewFile.url.startsWith('blob:')) {
          const response = await fetch(codePreviewFile.url)
          const text = await response.text()
          if (!isCancelled) {
            setContent(text || '')
            setEditedContent(text || '')
          }
          return
        }

        // 일반 URL 처리
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(codePreviewFile.url, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (isCancelled) return

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const text = await response.text()
        if (!isCancelled) {
          setContent(text || '')
          setEditedContent(text || '')
        }
      } catch (err: any) {
        if (isCancelled) return
        console.error('Error fetching file content:', err)
        if (err.name === 'AbortError') {
          setError('요청 시간 초과')
        } else {
          setError(`파일을 불러올 수 없습니다`)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchContent()

    return () => {
      isCancelled = true
    }
  }, [codePreviewFile, codePreviewOpen])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S or Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty) {
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, editedContent, codePreviewFile])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    const textToCopy = editedContent || content
    if (!textToCopy) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [content, editedContent])

  // Open in new tab
  const handleOpenExternal = useCallback(() => {
    if (codePreviewFile?.url && !codePreviewFile.url.startsWith('mock://')) {
      window.open(codePreviewFile.url, '_blank')
    }
  }, [codePreviewFile])

  // Check if file can be edited
  const canEdit = useCallback(() => {
    if (!codePreviewFile) return false
    const displayMode = getDisplayMode(codePreviewFile)
    return displayMode === 'code' || displayMode === 'markdown' || displayMode === 'text'
  }, [codePreviewFile])

  // Save file
  const handleSave = useCallback(() => {
    if (!codePreviewFile || !editedContent) return

    updateFileContent(codePreviewFile.id, editedContent)
    setContent(editedContent)

    // TODO: Optionally call API to persist to backend
    // await saveFileToBackend(codePreviewFile.id, editedContent)
  }, [codePreviewFile, editedContent, updateFileContent])

  // Handle content change in Monaco
  const handleContentChange = useCallback((value: string) => {
    setEditedContent(value)
    setDirty(value !== content)
  }, [content, setDirty])

  // Handle close with unsaved changes
  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedWarning(true)
    } else {
      closeCodePreview()
    }
  }, [isDirty, closeCodePreview])

  // Confirm discard changes
  const handleDiscardChanges = useCallback(() => {
    setEditedContent(content || '')
    setDirty(false)
    setShowUnsavedWarning(false)
    closeCodePreview()
  }, [content, setDirty, closeCodePreview])

  // Confirm save and close
  const handleSaveAndClose = useCallback(() => {
    handleSave()
    setShowUnsavedWarning(false)
    closeCodePreview()
  }, [handleSave, closeCodePreview])

  const isOpen = codePreviewOpen && codePreviewFile
  const displayMode = codePreviewFile ? getDisplayMode(codePreviewFile) : 'text'
  const FileIcon = codePreviewFile ? getFileIcon(codePreviewFile.name) : File
  const language = codePreviewFile ? getLanguage(codePreviewFile.name) : 'text'
  const headerLabel = displayMode === 'markdown'
    ? 'Markdown'
    : displayMode === 'binary'
      ? 'Binary'
      : displayMode === 'pdf'
        ? 'PDF'
        : language.toUpperCase()
  const footerLabel = displayMode === 'markdown'
    ? 'Markdown Preview'
    : displayMode === 'binary'
      ? 'Binary file'
      : language

  // 로컬 캐시에서 직접 콘텐츠 가져오기 (useEffect 우회)
  const cachedContent = useMemo(() => {
    if (typeof window === 'undefined') return null
    if (!codePreviewFile) return null
    const cached = (window as any).__localFileContents?.[codePreviewFile.id]
    if (cached) {
      console.log('[CodePreview useMemo] ✅ Found cached content for:', codePreviewFile.name, 'length:', cached.length)
    } else {
      console.log('[CodePreview useMemo] ❌ No cache for:', codePreviewFile.name, 'id:', codePreviewFile.id)
      console.log('[CodePreview useMemo] Available keys:', Object.keys((window as any).__localFileContents || {}))
    }
    return cached || null
  }, [codePreviewFile])

  // 표시할 콘텐츠 (파일 객체 > 캐시 > state)
  const displayContent = (codePreviewFile as any)?.content || cachedContent || content || editedContent

  console.log('[CodePreview] displayContent exists:', !!displayContent, 'length:', displayContent?.length, 'from file:', !!(codePreviewFile as any)?.content)

  return (
    <AnimatePresence mode="wait">
      {isOpen && codePreviewFile && (
        <motion.div
          key="code-preview-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: isExpanded ? '60%' : panelWidth, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={isResizing ? { duration: 0 } : { duration: 0.2, ease: 'easeInOut' }}
          className={cn(
            'h-full border-l flex flex-col overflow-hidden flex-shrink-0 relative',
            isDark ? 'bg-[#1e1e1e] border-zinc-800' : 'bg-white border-zinc-200',
            className
          )}
        >
          {/* Resize Handle (Left Border) */}
          <div
            onMouseDown={startResizing}
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-blue-500/50 transition-colors",
              isResizing && "bg-blue-500/50"
            )}
            title="드래그하여 크기 조절"
          />
          {/* Header */}
          <div className={cn(
            'h-10 flex items-center justify-between px-3 border-b flex-shrink-0',
            isDark ? 'bg-[#252526] border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          )}>
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon className={cn(
                'w-4 h-4 flex-shrink-0',
                displayMode === 'markdown' ? 'text-blue-400' :
                  displayMode === 'code' ? 'text-yellow-400' :
                    'text-zinc-400'
              )} />
              <span className={cn(
                'text-sm font-medium truncate',
                isDark ? 'text-zinc-200' : 'text-zinc-700'
              )}>
                {codePreviewFile.name}
              </span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-mono',
                isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
              )}>
                {headerLabel}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Save button - always visible for editable files */}
              {displayContent && canEdit() && (
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className={cn(
                    'p-1.5 rounded transition-colors relative',
                    isDirty
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : isDark ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 cursor-not-allowed'
                  )}
                  title={isDirty ? '저장 (Cmd+S)' : '변경사항 없음'}
                >
                  <Save className="w-4 h-4" />
                  {isDirty && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
              )}

              {/* Copy button */}
              {displayContent && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
                  )}
                  title="복사"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}

              {/* Open external */}
              {codePreviewFile.url && !codePreviewFile.url.startsWith('mock://') && (
                <button
                  onClick={handleOpenExternal}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
                  )}
                  title="새 탭에서 열기"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              {/* Expand/Collapse */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
                )}
                title={isExpanded ? '축소' : '확대'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Close */}
              <button
                onClick={handleClose}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
                )}
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                  <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    파일 로딩 중...
                  </span>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-sm text-red-500">{error}</div>
              </div>
            ) : displayMode === 'image' ? (
              <div className="flex items-center justify-center h-full p-6 bg-checkered">
                {codePreviewFile.url && (
                  <img
                    src={codePreviewFile.url.startsWith('mock://') ? '/placeholder-image.png' : codePreviewFile.url}
                    alt={codePreviewFile.name}
                    className="max-w-full max-h-full object-contain rounded shadow-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23333" width="200" height="150"/><text x="50%" y="50%" fill="%23888" text-anchor="middle" dy=".3em">Image</text></svg>'
                    }}
                  />
                )}
              </div>
            ) : displayMode === 'video' ? (
              <div className="flex items-center justify-center h-full p-6">
                {codePreviewFile.url && !codePreviewFile.url.startsWith('mock://') ? (
                  <video
                    src={codePreviewFile.url}
                    controls
                    className="max-w-full max-h-full rounded shadow-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-500">
                    <Film className="w-16 h-16" />
                    <span>비디오 미리보기</span>
                  </div>
                )}
              </div>
            ) : displayMode === 'pdf' ? (
              <div className="flex flex-col h-full w-full">
                {codePreviewFile.url && !codePreviewFile.url.startsWith('mock://') ? (
                  <>
                    <div className={cn(
                      'px-4 py-3 border-b flex items-center justify-between',
                      isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
                    )}>
                      <div className="flex items-center gap-2">
                        <FileText className={cn('w-5 h-5', isDark ? 'text-red-400' : 'text-red-500')} />
                        <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                          {codePreviewFile.name}
                        </span>
                      </div>
                      <button
                        onClick={handleOpenExternal}
                        className={cn(
                          'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                          isDark ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
                        )}
                      >
                        새 탭에서 열기
                      </button>
                    </div>
                    <iframe
                      src={codePreviewFile.url}
                      className="flex-1 w-full border-0"
                      title={codePreviewFile.name}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className={cn('w-16 h-16 mx-auto mb-4', isDark ? 'text-red-400' : 'text-red-500')} />
                      <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                        PDF를 불러올 수 없습니다
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : displayMode === 'binary' ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                <File className={cn('w-10 h-10', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  이진 파일은 미리보기를 지원하지 않습니다.<br />
                  새 탭에서 다운로드해 내용을 확인하세요.
                </div>
                {codePreviewFile.url && !codePreviewFile.url.startsWith('mock://') && (
                  <button
                    onClick={handleOpenExternal}
                    className={cn(
                      'px-4 py-2 rounded text-sm font-medium transition-colors',
                      isDark ? 'bg-zinc-700 text-white hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
                    )}
                  >
                    파일 다운로드
                  </button>
                )}
              </div>
            ) : displayMode === 'code' && displayContent ? (
              <div className="flex-1 h-full min-h-0" key={codePreviewFile?.id}>
                <MonacoCodeEditor
                  value={displayContent}
                  onChange={handleContentChange}
                  language={language}
                  height="calc(100vh - 200px)"
                  readOnly={false}
                  minimap={true}
                  lineNumbers={true}
                />
              </div>
            ) : displayMode === 'markdown' && displayContent ? (
              <div className="h-full">
                <MonacoCodeEditor
                  value={displayContent || ''}
                  onChange={handleContentChange}
                  language="markdown"
                  height="100%"
                  readOnly={false}
                  minimap={false}
                  lineNumbers={true}
                />
              </div>
            ) : content ? (
              <pre className={cn(
                'p-4 font-mono text-sm whitespace-pre-wrap',
                isDark ? 'text-zinc-300' : 'text-zinc-700'
              )}>
                {content}
              </pre>
            ) : null}
          </div>

          {/* Footer */}
          <div className={cn(
            'h-6 flex items-center justify-between px-3 text-[11px] border-t flex-shrink-0',
            isDark ? 'bg-[#252526] border-zinc-800 text-zinc-500' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
          )}>
            <span className="flex items-center gap-2">
              {displayMode === 'markdown' && <BookOpen className="w-3 h-3" />}
              {displayMode === 'code' && <Code className="w-3 h-3" />}
              {displayMode === 'binary' && <File className="w-3 h-3" />}
              {footerLabel}
            </span>
            {content && (
              <span>{content.split('\n').length} lines</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Unsaved Changes Warning Dialog */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'w-full max-w-md p-6 rounded-lg shadow-xl',
              isDark ? 'bg-zinc-900 border border-zinc-700' : 'bg-white border border-zinc-200'
            )}
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className={cn(
                  'text-lg font-semibold mb-1',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}>
                  저장되지 않은 변경사항
                </h3>
                <p className={cn(
                  'text-sm',
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                )}>
                  변경사항을 저장하지 않고 닫으시겠습니까?
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowUnsavedWarning(false)}
                className={cn(
                  'px-4 py-2 rounded text-sm font-medium transition-colors',
                  isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                )}
              >
                취소
              </button>
              <button
                onClick={handleDiscardChanges}
                className={cn(
                  'px-4 py-2 rounded text-sm font-medium transition-colors',
                  'bg-red-600 text-white hover:bg-red-700'
                )}
              >
                변경사항 버리기
              </button>
              <button
                onClick={handleSaveAndClose}
                className={cn(
                  'px-4 py-2 rounded text-sm font-medium transition-colors',
                  'bg-green-600 text-white hover:bg-green-700'
                )}
              >
                저장하고 닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// Generate realistic demo content based on file name
function generateDemoContent(fileName: string): string {
  const ext = getExtension(fileName)
  const name = fileName.replace(/\.\w+$/, '')

  switch (ext) {
    case 'tsx':
    case 'jsx':
      return `import React from 'react'

interface ${toPascalCase(name)}Props {
  className?: string
  children?: React.ReactNode
}

export function ${toPascalCase(name)}({ className, children }: ${toPascalCase(name)}Props) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export default ${toPascalCase(name)}
`

    case 'ts':
    case 'js':
      if (name.includes('route')) {
        return `import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  // Handle POST request
  return NextResponse.json({ success: true })
}
`
      }
      if (name.includes('utils') || name.includes('lib')) {
        return `export function cn(...classes: (string | undefined | boolean)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
`
      }
      if (name.includes('Store') || name.includes('store')) {
        return `import { create } from 'zustand'

interface ${toPascalCase(name)}State {
  count: number
  isLoading: boolean
}

interface ${toPascalCase(name)}Actions {
  increment: () => void
  decrement: () => void
  setLoading: (loading: boolean) => void
}

export const use${toPascalCase(name)} = create<${toPascalCase(name)}State & ${toPascalCase(name)}Actions>((set) => ({
  count: 0,
  isLoading: false,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  setLoading: (loading) => set({ isLoading: loading }),
}))
`
      }
      if (name.startsWith('use')) {
        return `import { useState, useEffect, useCallback } from 'react'

export function ${name}() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch data here
      const response = await fetch('/api/data')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, isLoading, error, refetch }
}
`
      }
      return `// ${fileName}

export const config = {
  name: '${name}',
  version: '1.0.0',
}

export function init() {
  console.log('Initializing ${name}...')
}
`

    case 'css':
    case 'scss':
      return `/* ${fileName} */

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.card {
  background: var(--bg-card);
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s;
}

.button-primary {
  background: var(--color-primary);
  color: white;
}

.button-primary:hover {
  background: var(--color-primary-dark);
}
`

    case 'json':
      if (name === 'package') {
        return `{
  "name": "my-nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "typescript": "^5"
  }
}
`
      }
      if (name === 'tsconfig') {
        return `{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
`
      }
      return `{
  "${name}": {
    "enabled": true,
    "options": {}
  }
}
`

    case 'md':
    case 'markdown':
      return `# ${toPascalCase(name)}

## Overview

This is the documentation for **${name}**.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`bash
npm install ${name}
\`\`\`

## Usage

\`\`\`typescript
import { ${toPascalCase(name)} } from '${name}'

const instance = new ${toPascalCase(name)}()
instance.init()
\`\`\`

## API Reference

### \`init()\`

Initializes the ${name} instance.

### \`destroy()\`

Cleans up resources.

---

For more information, see the [documentation](https://example.com).
`

    case 'yaml':
    case 'yml':
      return `# ${fileName}

name: ${name}
version: 1.0.0

settings:
  debug: false
  timeout: 30000

features:
  - name: feature1
    enabled: true
  - name: feature2
    enabled: false
`

    default:
      return `// ${fileName}\n// Demo file content`
  }
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase())
}
