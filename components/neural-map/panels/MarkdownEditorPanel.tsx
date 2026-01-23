'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTheme } from 'next-themes'
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
  Sparkles,
  Send,
  ChevronUp,
  ChevronDown,
  Check,
  Replace,
  Plus,
  FolderOpen,
  Maximize2,
  Minimize2,
  Bot,
  Globe,
  AtSign,
  ImagePlus,
  Mic,
  ArrowUp,
} from 'lucide-react'
import type { MarkdownEditorRef } from '../editor/MarkdownEditor'
import { MarkdownPreview } from '../editor/MarkdownPreview'
import { SearchPalette } from '../editor/SearchPalette'
import { ExportModal } from '../editor/ExportModal'
import { PropertiesPanel } from './properties'
import { useAutoPropertiesSync } from '@/lib/neural-map/usePropertiesSync'

// CodeMirror 에디터 직접 import (forwardRef 컴포넌트라 dynamic 사용 불가)
import { MarkdownEditor } from '../editor/MarkdownEditor'

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

  // 🔥 editingFile이 있으면 템플릿 스킵하고 바로 내용 표시
  const editingFile = useNeuralMapStore((s) => s.editingFile)

  const [title, setTitle] = useState(() => editingFile ? editingFile.name.replace(/\.md$|\.markdown$|\.mdx$/i, '') : '')
  const [content, setContent] = useState(() => editingFile?.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const [showTemplates, setShowTemplates] = useState(() => !editingFile) // editingFile이 있으면 false
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(null)
  const [extractedTags, setExtractedTags] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>(() => editingFile ? 'preview' : 'edit') // 기존 파일은 preview 모드
  const [showSearch, setShowSearch] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [recentFiles, setRecentFiles] = useState<string[]>([])
  const [panelWidth, setPanelWidth] = useState(480)
  const [isResizing, setIsResizing] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  // AI 채팅 상태
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{
    role: 'user' | 'assistant'
    content: string
    markdown?: string
    applied?: boolean
    fileAction?: { type: 'read' | 'write' | 'search'; fileName: string; content?: string }
  }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const editorRef = useRef<MarkdownEditorRef>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const mapId = useNeuralMapStore((s) => s.mapId)
  const graph = useNeuralMapStore((s) => s.graph)
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const linkedProjectId = useNeuralMapStore((s) => s.linkedProjectId)
  const files = useNeuralMapStore((s) => s.files)
  const setFiles = useNeuralMapStore((s) => s.setFiles)
  const buildGraphFromFilesAsync = useNeuralMapStore((s) => s.buildGraphFromFilesAsync)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  // editingFile은 위에서 이미 선언됨
  const { createNode, createEdge } = useNeuralMapApi(mapId)

  // 편집 중인 파일 ID 추적 (기존 파일 수정 시 사용)
  const [currentFileId, setCurrentFileId] = useState<string | null>(null)

  // 기존 파일이 열렸을 때 내용 로드 (파일트리에서 열기)
  // editingFile.id가 바뀔 때마다 실행되도록 의존성 배열에 id 추가
  useEffect(() => {
    if (editingFile) {
      // 기존 파일 편집 모드 - 템플릿 메뉴 스킵하고 바로 내용 표시
      const fileName = editingFile.name.replace(/\.md$|\.markdown$|\.mdx$/i, '')
      const fileContent = editingFile.content || ''
      setTitle(fileName)
      setContent(fileContent)
      setShowTemplates(false)
      setCurrentFileId(editingFile.id)
      setSelectedTemplate(null)
      setViewMode('preview')  // 기존 파일은 보기 모드로 시작
      // CodeMirror 에디터에도 직접 내용 설정
      if (editorRef.current) {
        editorRef.current.setMarkdown(fileContent)
      }
      console.log('[MarkdownEditor] Opened existing file:', editingFile.name, 'content length:', fileContent.length)
    }
  }, [editingFile?.id, editingFile?.content])

  // 콘텐츠에서 태그 추출
  useEffect(() => {
    const tags = extractTags(content)
    setExtractedTags(tags)
  }, [content])

  // Properties ↔ Neural Map 양방향 동기화
  // content 변경 시 [[링크]]를 파싱하여 Graph 엣지로 동기화
  useAutoPropertiesSync(content, {
    fileId: currentFileId || undefined,
    filePath: editingFile?.path,
    fileName: editingFile?.name,
    enabled: isOpen
  })

  // 콘텐츠 변경 핸들러 - 제목 실시간 동기화
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    // H1 제목 추출하여 제목 필드에 실시간 동기화
    const titleMatch = newContent.match(/^#\s+(.+)$/m)
    if (titleMatch) {
      const extractedTitle = titleMatch[1].trim()
      // 현재 제목과 다르면 업데이트
      if (extractedTitle !== title) {
        setTitle(extractedTitle)
      }
    }
  }, [title])

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
    setCurrentFileId(null)
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

  // 저장 - 기존 파일 업데이트 또는 새 파일 생성
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

      // 기존 파일 수정인지 새 파일 생성인지 확인
      const isEditing = !!currentFileId
      const existingFile = isEditing ? files.find(f => f.id === currentFileId) : null

      // 1. 프로젝트 폴더가 있으면 실제 파일로 저장
      if (projectPath && window.electron?.fs?.writeFile) {
        // 기존 파일 수정 시 원래 경로 사용, 새 파일은 새 경로
        const filePath = isEditing && existingFile?.path
          ? `${projectPath}/${existingFile.path}`
          : `${projectPath}/${fileName}`

        try {
          await window.electron.fs.writeFile(filePath, fileContent)
          console.log(`[Note] ${isEditing ? 'Updated' : 'Created'}:`, filePath)

          // fs:changed 이벤트 발송
          window.dispatchEvent(new CustomEvent('note-saved', { detail: { path: filePath } }))
        } catch (fsErr) {
          console.error('[Note] File save failed:', fsErr)
        }
      }

      // 2. 웹 환경 - API 사용
      if (!window.electron?.fs?.writeFile) {
        const filePath = isEditing && existingFile?.path ? existingFile.path : fileName
        try {
          await fetch('/api/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, content: fileContent })
          })
          console.log(`[Note] API ${isEditing ? 'Updated' : 'Created'}:`, filePath)
        } catch (apiErr) {
          console.error('[Note] API save failed:', apiErr)
        }
      }

      // 3. 파일 상태 업데이트
      if (isEditing && existingFile) {
        // 기존 파일 업데이트
        const updatedFiles = files.map(f =>
          f.id === currentFileId
            ? { ...f, name: fileName, content: fileContent, size: fileContent.length }
            : f
        )
        setFiles(updatedFiles)
        console.log('[Note] ✅ 기존 파일 업데이트 완료:', fileName)
      } else {
        // 새 파일 추가
        const newFileId = `local-${Date.now()}`
        const newFile = {
          id: newFileId,
          name: fileName,
          path: fileName,
          type: 'markdown' as const,
          content: fileContent,
          size: fileContent.length,
          createdAt: new Date().toISOString(),
          mapId: mapId || '',
          url: '',
        }
        setFiles([...files, newFile])
        // 새 파일 ID 저장 (이후 저장 시 업데이트 모드로 전환)
        setCurrentFileId(newFileId)
        console.log('[Note] ✅ 새 파일 생성 완료:', fileName)
      }

      // 그래프 재빌드
      await buildGraphFromFilesAsync()

      // 저장 완료 알림 (짧게 표시)
      const saveNotice = document.createElement('div')
      saveNotice.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in'
      saveNotice.textContent = '✅ 저장 완료!'
      document.body.appendChild(saveNotice)
      setTimeout(() => saveNotice.remove(), 2000)
      console.log('[Note] 저장 완료!')

    } catch (err) {
      console.error('노트 저장 실패:', err)
    } finally {
      setIsSaving(false)
    }
  }, [title, content, mapId, projectPath, linkedProjectId, files, currentFileId, setFiles, buildGraphFromFilesAsync])

  // ============================================================
  // 🔥 실제 코딩 어시스턴트 - GlowUS 프로젝트 직접 접근
  // Electron에서는 fs 직접 접근, 웹에서는 API 사용
  // ============================================================
  const GLOWUS_ROOT = '/Users/jinsoolee/Downloads/GlowUS'
  const [scannedFiles, setScannedFiles] = useState<string[]>([])
  const isElectron = typeof window !== 'undefined' && !!window.electron?.fs

  // 앱 시작 시 프로젝트 스캔 (Electron 또는 API)
  useEffect(() => {
    const scan = async () => {
      try {
        // Electron 환경
        const readDir = window.electron?.fs?.readDir
        if (readDir) {
          const walkDir = async (dir: string, prefix = ''): Promise<string[]> => {
            const entries = await readDir(dir)
            const result: string[] = []
            for (const e of entries) {
              if (e.name.startsWith('.') || ['node_modules', '.next', 'dist'].includes(e.name)) continue
              const p = prefix ? `${prefix}/${e.name}` : e.name
              if (e.isDirectory) result.push(...await walkDir(`${dir}/${e.name}`, p))
              else result.push(p)
            }
            return result
          }
          const allFiles = await walkDir(GLOWUS_ROOT)
          setScannedFiles(allFiles.slice(0, 1000))
          console.log(`[CodingAI] Electron: Scanned ${allFiles.length} files`)
        }
        // 웹 환경 - API 사용
        else {
          const res = await fetch('/api/files?action=scan')
          if (res.ok) {
            const data = await res.json()
            setScannedFiles(data.files || [])
            console.log(`[CodingAI] Web API: Scanned ${data.files?.length || 0} files`)
          }
        }
      } catch (e) {
        console.error('[CodingAI] Scan error:', e)
      }
    }
    scan()
  }, [])

  // 프로젝트 파일 목록 컨텍스트
  const allFilesContext = useMemo(() => {
    if (scannedFiles.length === 0 && files.length === 0) return '(프로젝트 스캔 중...)'
    const allPaths = scannedFiles.length > 0 ? scannedFiles : files.map(f => f.path || f.name)
    return allPaths.slice(0, 100).join('\n')
  }, [scannedFiles, files])

  // 📖 파일 읽기 - Electron 또는 API
  const readFile = useCallback(async (filePath: string): Promise<string | null> => {
    // 상대경로로 정규화
    const relativePath = filePath.startsWith('/') ? filePath.replace(GLOWUS_ROOT + '/', '') : filePath

    try {
      // Electron 환경
      if (window.electron?.fs?.readFile) {
        const fullPath = `${GLOWUS_ROOT}/${relativePath}`
        const content = await window.electron.fs.readFile(fullPath)
        console.log(`[CodingAI] 📖 Electron Read: ${relativePath} (${content.length} bytes)`)
        return content
      }
      // 웹 환경 - API 사용
      else {
        const res = await fetch(`/api/files?path=${encodeURIComponent(relativePath)}`)
        if (res.ok) {
          const data = await res.json()
          console.log(`[CodingAI] 📖 API Read: ${relativePath} (${data.content?.length || 0} bytes)`)
          return data.content
        }
        return null
      }
    } catch (err) {
      console.error('[CodingAI] Read error:', relativePath, err)
      return null
    }
  }, [])

  // ✏️ 파일 쓰기 - Electron 또는 API
  const writeFile = useCallback(async (filePath: string, newContent: string): Promise<boolean> => {
    // 상대경로로 정규화
    const relativePath = filePath.startsWith('/') ? filePath.replace(GLOWUS_ROOT + '/', '') : filePath

    try {
      // Electron 환경
      if (window.electron?.fs?.writeFile) {
        const fullPath = `${GLOWUS_ROOT}/${relativePath}`
        await window.electron.fs.writeFile(fullPath, newContent)
        console.log(`[CodingAI] ✅ Electron Write: ${relativePath} (${newContent.length} bytes)`)
        return true
      }
      // 웹 환경 - API 사용
      else {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: relativePath, content: newContent })
        })
        if (res.ok) {
          console.log(`[CodingAI] ✅ API Write: ${relativePath} (${newContent.length} bytes)`)
          return true
        }
        return false
      }
    } catch (err) {
      console.error('[CodingAI] Write error:', relativePath, err)
      return false
    }
  }, [])

  // 🔍 파일 검색 - scannedFiles 기반으로 전체 프로젝트 검색
  const searchInFiles = useCallback(async (query: string): Promise<{ file: string; matches: string[] }[]> => {
    const results: { file: string; matches: string[] }[] = []
    const queryLower = query.toLowerCase()

    // 코드 파일만 검색 (성능 위해 최대 100개)
    const codeFiles = scannedFiles
      .filter(f => /\.(ts|tsx|js|jsx|md|json|css|scss|py|go|rs)$/.test(f))
      .slice(0, 100)

    for (const filePath of codeFiles) {
      try {
        const content = await readFile(filePath)
        if (content) {
          const lines = content.split('\n')
          const matches: string[] = []
          lines.forEach((line, idx) => {
            if (line.toLowerCase().includes(queryLower)) {
              matches.push(`L${idx + 1}: ${line.trim().slice(0, 100)}`)
            }
          })
          if (matches.length > 0) {
            results.push({ file: filePath, matches: matches.slice(0, 5) })
          }
        }
      } catch {
        // 파일 읽기 실패 무시
      }
      // 최대 10개 파일 결과
      if (results.length >= 10) break
    }
    return results
  }, [scannedFiles, readFile])

  // AI 응답에서 코드블록 추출 (모든 언어)
  const extractCodeBlocks = useCallback((response: string): { lang: string; code: string; fileName?: string }[] => {
    const blocks: { lang: string; code: string; fileName?: string }[] = []
    // 파일명이 포함된 코드블록: ```typescript:filename.ts 또는 ```typescript filename.ts
    const codeBlockRegex = /```(\w+)?(?::([^\n]+)|[ \t]+([^\n]+))?\n([\s\S]*?)```/g
    let match
    while ((match = codeBlockRegex.exec(response)) !== null) {
      blocks.push({
        lang: match[1] || 'text',
        fileName: match[2] || match[3],
        code: match[4].trim()
      })
    }
    return blocks
  }, [])

  // AI 응답에서 파일 작업 명령 파싱
  const parseFileOperations = useCallback((response: string): {
    type: 'read' | 'write' | 'search';
    path?: string;
    content?: string;
    query?: string;
  }[] => {
    const operations: { type: 'read' | 'write' | 'search'; path?: string; content?: string; query?: string }[] = []

    // FILE_READ: path 패턴
    const readMatches = response.matchAll(/FILE_READ:\s*([^\n]+)/g)
    for (const match of readMatches) {
      operations.push({ type: 'read', path: match[1].trim() })
    }

    // FILE_WRITE: path 패턴 (다음 코드블록이 내용)
    const writeMatches = response.matchAll(/FILE_WRITE:\s*([^\n]+)/g)
    for (const match of writeMatches) {
      operations.push({ type: 'write', path: match[1].trim() })
    }

    // FILE_SEARCH: query 패턴
    const searchMatches = response.matchAll(/FILE_SEARCH:\s*([^\n]+)/g)
    for (const match of searchMatches) {
      operations.push({ type: 'search', query: match[1].trim() })
    }

    return operations
  }, [])

  // AI가 제안한 마크다운을 에디터에 적용 (실시간 반영)
  const handleApplyMarkdown = useCallback((messageIndex: number, markdownContent: string, mode: 'replace' | 'append') => {
    let finalContent = markdownContent

    if (mode === 'replace') {
      setContent(markdownContent)
      if (editorRef.current) {
        editorRef.current.setMarkdown(markdownContent)
      }
      // 제목 자동 추출 (첫 번째 H1 헤딩)
      const titleMatch = markdownContent.match(/^#\s+(.+)$/m)
      if (titleMatch) {
        setTitle(titleMatch[1].trim())
      }
    } else {
      finalContent = content + '\n\n' + markdownContent
      setContent(finalContent)
      if (editorRef.current) {
        editorRef.current.setMarkdown(finalContent)
      }
    }

    // 적용됨 표시
    setChatMessages(prev => prev.map((msg, i) =>
      i === messageIndex ? { ...msg, applied: true } : msg
    ))
  }, [content])

  // AI 채팅 메시지 전송 (전체 코딩 기능)
  const handleSendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)

    try {
      // 사용자 메시지에서 파일 읽기 요청 감지
      const fileReadRequest = userMessage.match(/(?:읽어|보여|열어|확인|내용)[^\s]*\s*([^\s]+\.\w+)/i)
      let additionalContext = ''

      if (fileReadRequest) {
        const requestedFile = fileReadRequest[1]
        const fileContent = await readFile(requestedFile)
        if (fileContent) {
          additionalContext = `\n\n📂 요청된 파일 (${requestedFile}) 내용:\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\``
        }
      }

      // 🔥 Cursor/Antigravity 수준의 코딩 어시스턴트 프롬프트
      const systemPrompt = `당신은 Cursor/Antigravity 수준의 전문 AI 코딩 어시스턴트입니다.

## 🔧 역할
- GlowUS 프로젝트(${GLOWUS_ROOT})의 **모든** 코드 파일을 읽고, 분석하고, 수정할 수 있습니다
- 새로운 파일 생성, 기존 코드 리팩토링 가능
- 버그 수정, 기능 구현, 코드 리뷰 제공
- 한국어로 친절하고 전문적으로 답변

## 📁 GlowUS 프로젝트 (${scannedFiles.length}개 파일)
${scannedFiles.filter(f => /\.(tsx?|jsx?)$/.test(f)).slice(0, 50).join('\n')}
${scannedFiles.length > 50 ? `\n... 외 ${scannedFiles.length - 50}개 파일` : ''}

## 📝 현재 노트
제목: ${title || '(새 노트)'}
\`\`\`
${content.slice(0, 2000)}
\`\`\`
${additionalContext}

## 🎯 파일 작업 명령어

### FILE_READ: 파일경로
파일 내용을 읽습니다. 예: FILE_READ: components/Button.tsx

### FILE_WRITE: 파일경로
코드블록과 함께 사용하여 파일을 생성/수정합니다.

### FILE_SEARCH: 검색어
코드베이스에서 텍스트를 검색합니다.

### 마크다운 노트 수정
\`\`\`markdown 코드블록으로 현재 노트 수정 제안

## ⚡ 응답 가이드
1. 무엇을 할지 간단히 설명 후 코드 제공
2. 전체 파일 대신 변경 부분만 제공
3. 여러 파일은 각각 FILE_WRITE로 구분
4. 파일 경로는 상대경로 사용 (예: lib/utils.ts)`

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ],
          model: 'gemini-2.0-flash',
        }),
      })

      if (!response.ok) throw new Error('API 요청 실패')

      const data = await response.json()
      let assistantMessage = data.content || data.message || ''

      // 파일 작업 파싱 및 실행
      const operations = parseFileOperations(assistantMessage)
      const codeBlocks = extractCodeBlocks(assistantMessage)
      const executedOps: string[] = []

      // FILE_WRITE 작업 실행
      for (const op of operations) {
        if (op.type === 'write' && op.path) {
          // 해당 파일의 코드블록 찾기
          const matchingBlock = codeBlocks.find(b => b.fileName === op.path || assistantMessage.includes(`FILE_WRITE: ${op.path}`))
          if (matchingBlock) {
            const success = await writeFile(op.path, matchingBlock.code)
            if (success) {
              executedOps.push(`✅ ${op.path} 저장됨`)
            } else {
              executedOps.push(`❌ ${op.path} 저장 실패`)
            }
          }
        } else if (op.type === 'search' && op.query) {
          const results = await searchInFiles(op.query)
          if (results.length > 0) {
            const searchResult = results.map(r =>
              `📄 ${r.file}:\n${r.matches.map(m => `  - ${m.trim()}`).join('\n')}`
            ).join('\n\n')
            assistantMessage += `\n\n🔍 검색 결과 "${op.query}":\n${searchResult}`
          }
        } else if (op.type === 'read' && op.path) {
          const content = await readFile(op.path)
          if (content) {
            assistantMessage += `\n\n📂 ${op.path}:\n\`\`\`\n${content.slice(0, 5000)}\n\`\`\``
          }
        }
      }

      // 실행된 작업 표시
      if (executedOps.length > 0) {
        assistantMessage += `\n\n---\n${executedOps.join('\n')}`
      }

      // 마크다운 코드블록 추출 (현재 노트용)
      const markdownBlock = codeBlocks.find(b => b.lang === 'markdown' || b.lang === 'md')

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        markdown: markdownBlock?.code,
        fileAction: operations.length > 0 ? {
          type: operations[0].type,
          fileName: operations[0].path || operations[0].query || '',
          content: codeBlocks[0]?.code
        } : undefined,
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송합니다, 오류가 발생했습니다. 다시 시도해주세요.',
      }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, chatMessages, title, content, allFilesContext, projectPath, readFile, writeFile, searchInFiles, parseFileOperations, extractCodeBlocks])

  // 채팅 스크롤
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

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

      // ESC: 전체화면 종료
      if (e.key === 'Escape' && isFullScreen) {
        e.preventDefault()
        setIsFullScreen(false)
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showTemplates, handleSave, isFullScreen])

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

      {/* 창 분할 레이아웃 - isOpen이 true면 너비를 가짐, false면 0 */}
      <div
        ref={panelRef}
        className={cn(
          'h-full border-l flex flex-col overflow-hidden flex-shrink-0 relative transition-[width] duration-200',
          isFullScreen && 'fixed inset-0 z-50 border-l-0',
          isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-zinc-200'
        )}
        style={{
          width: !isOpen ? 0 : isCollapsed ? 40 : isFullScreen ? '100vw' : panelWidth,
        }}
      >
        {isOpen && (
          <>
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
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-zinc-100'
                    )}
                    title={isFullScreen ? "창 축소" : "전체 화면"}
                  >
                    {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  {!isFullScreen && (
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
                  )}
                  <button
                    onClick={() => {
                      resetEditor()
                      setIsFullScreen(false)
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
              {/* 헤더: 뒤로가기 + 제목 + 닫기 */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 border-b flex-shrink-0',
                  isDark ? 'border-[#27272a]' : 'border-zinc-200'
                )}
              >
                <button
                  onClick={() => setShowTemplates(true)}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isDark ? 'hover:bg-[#27272a] text-zinc-400' : 'hover:bg-zinc-100'
                  )}
                  title="뒤로"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="untitled"
                  className={cn(
                    'flex-1 bg-transparent border-none outline-none text-sm font-medium',
                    isDark ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
                <button
                  onClick={() => { resetEditor(); setIsFullScreen(false); onClose() }}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isDark ? 'hover:bg-[#27272a] text-zinc-400' : 'hover:bg-zinc-100'
                  )}
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 툴바 1줄 통합 */}
              <div className={cn('px-2 py-1.5 border-b flex items-center gap-0.5', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                <ToolbarButton icon={Bold} action="bold" onClick={handleToolbarAction} isDark={isDark} tooltip="Bold" />
                <ToolbarButton icon={Italic} action="italic" onClick={handleToolbarAction} isDark={isDark} tooltip="Italic" />
                <ToolbarButton icon={Strikethrough} action="strikethrough" onClick={handleToolbarAction} isDark={isDark} tooltip="Strikethrough" />
                <ToolbarButton icon={Code} action="code" onClick={handleToolbarAction} isDark={isDark} tooltip="Code" />
                <div className={cn('w-px h-4 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
                <ToolbarButton icon={Heading1} action="h1" onClick={handleToolbarAction} isDark={isDark} tooltip="H1" />
                <ToolbarButton icon={Heading2} action="h2" onClick={handleToolbarAction} isDark={isDark} tooltip="H2" />
                <ToolbarButton icon={Heading3} action="h3" onClick={handleToolbarAction} isDark={isDark} tooltip="H3" />
                <div className={cn('w-px h-4 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
                <ToolbarButton icon={List} action="bullet" onClick={handleToolbarAction} isDark={isDark} tooltip="List" />
                <ToolbarButton icon={CheckSquare} action="checkbox" onClick={handleToolbarAction} isDark={isDark} tooltip="Checkbox" />
                <ToolbarButton icon={Quote} action="quote" onClick={handleToolbarAction} isDark={isDark} tooltip="Quote" />
                <ToolbarButton icon={Link} action="link" onClick={handleToolbarAction} isDark={isDark} tooltip="Link" />

                <div className="flex-1" />

                {/* 뷰 모드 */}
                <div className={cn('flex items-center gap-0.5 p-0.5 rounded', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                  <button
                    onClick={() => {
                      setViewMode('edit')
                      // edit 모드로 전환 시 에디터에 현재 content 동기화
                      setTimeout(() => {
                        if (editorRef.current && content) {
                          editorRef.current.setMarkdown(content)
                          editorRef.current.focus()
                        }
                      }, 50)
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded text-xs transition-colors',
                      viewMode === 'edit'
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900 shadow-sm'
                        : isDark ? 'text-zinc-400' : 'text-zinc-500'
                    )}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('split')
                      // split 모드로 전환 시 에디터에 현재 content 동기화
                      setTimeout(() => {
                        if (editorRef.current && content) {
                          editorRef.current.setMarkdown(content)
                        }
                      }, 50)
                    }}
                    className={cn(
                      'p-1 rounded transition-colors',
                      viewMode === 'split'
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900 shadow-sm'
                        : isDark ? 'text-zinc-400' : 'text-zinc-500'
                    )}
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      'p-1 rounded transition-colors',
                      viewMode === 'preview'
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-zinc-900 shadow-sm'
                        : isDark ? 'text-zinc-400' : 'text-zinc-500'
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className={cn('p-1 rounded transition-colors ml-1', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200')}
                  title="전체화면"
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Properties 패널 - 툴바 아래 */}
              <PropertiesPanel
                content={content}
                onUpdate={(newContent) => {
                  setContent(newContent)
                  // CodeMirror 에디터에도 반영
                  if (editorRef.current) {
                    editorRef.current.setMarkdown(newContent)
                  }
                }}
              />

              {/* 에디터/프리뷰 영역 */}
              <div className="flex-1 overflow-hidden flex">
                {/* 에디터 (edit 또는 split 모드) */}
                {(viewMode === 'edit' || viewMode === 'split') && (
                  <div className={cn('overflow-hidden', viewMode === 'split' ? 'w-1/2 border-r' : 'w-full', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                    <MarkdownEditor
                      ref={editorRef}
                      defaultValue={content}
                      onChange={handleContentChange}
                      onWikiLinkClick={handleWikiLinkClick}
                      onTagClick={handleTagClick}
                      onSave={handleSave}
                      onImageDrop={handleImageDrop}
                      isDark={isDark}
                      placeholder="마크다운으로 작성하세요... [[위키링크]]로 연결, #태그로 분류"
                      files={editorFiles}
                      existingTags={existingTags}
                    />
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

              {/* AI 어시스턴트 채팅 */}
              <div className={cn('border-t', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                {/* 헤더 - 토글 */}
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors',
                    isDark ? 'hover:bg-zinc-800/50 text-zinc-400' : 'hover:bg-zinc-50 text-zinc-600'
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    AI 어시스턴트
                    {chatMessages.length > 0 && (
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px]',
                        isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                      )}>
                        {chatMessages.length}
                      </span>
                    )}
                    {scannedFiles.length > 0 && (
                      <span className={cn(
                        'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]',
                        isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                      )}>
                        <FolderOpen className="w-3 h-3" />
                        {scannedFiles.length} files
                      </span>
                    )}
                  </span>
                  {chatOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>

                {/* 채팅 영역 */}
                {chatOpen && (
                  <div className={cn('border-t', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                    {/* 메시지 목록 */}
                    {chatMessages.length > 0 && (
                      <div
                        ref={chatContainerRef}
                        className="max-h-64 overflow-y-auto p-2 space-y-2"
                      >
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={cn('text-xs', msg.role === 'user' ? 'text-right' : '')}>
                            {/* 파일 작업 표시 */}
                            {msg.fileAction && (
                              <div className={cn(
                                'flex items-center gap-1 mb-1 text-[10px]',
                                msg.fileAction.type === 'write'
                                  ? isDark ? 'text-green-400' : 'text-green-600'
                                  : msg.fileAction.type === 'read'
                                    ? isDark ? 'text-blue-400' : 'text-blue-600'
                                    : isDark ? 'text-yellow-400' : 'text-yellow-600'
                              )}>
                                {msg.fileAction.type === 'write' && '📝'}
                                {msg.fileAction.type === 'read' && '📂'}
                                {msg.fileAction.type === 'search' && '🔍'}
                                {msg.fileAction.fileName}
                              </div>
                            )}
                            <div
                              className={cn(
                                'inline-block max-w-[95%] px-2 py-1.5 rounded-lg',
                                msg.role === 'user'
                                  ? 'bg-purple-600 text-white'
                                  : isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-800'
                              )}
                            >
                              <div className="whitespace-pre-wrap break-words text-[11px]">
                                {msg.content
                                  .replace(/```[\s\S]*?```/g, '[코드 블록]')
                                  .replace(/FILE_(READ|WRITE|SEARCH):[^\n]+/g, '')
                                  .trim()
                                  .slice(0, 500)}
                                {msg.content.length > 500 && '...'}
                              </div>
                            </div>
                            {/* 적용 버튼 */}
                            {msg.markdown && (
                              <div className={cn('flex items-center gap-1 mt-1', msg.role === 'user' ? 'justify-end' : '')}>
                                {msg.applied ? (
                                  <span className={cn('flex items-center gap-1 text-[10px]', isDark ? 'text-green-400' : 'text-green-600')}>
                                    <Check className="w-3 h-3" />
                                    적용됨
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleApplyMarkdown(i, msg.markdown!, 'replace')}
                                      className={cn(
                                        'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                                        isDark
                                          ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                      )}
                                    >
                                      <Replace className="w-3 h-3" />
                                      교체
                                    </button>
                                    <button
                                      onClick={() => handleApplyMarkdown(i, msg.markdown!, 'append')}
                                      className={cn(
                                        'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                                        isDark
                                          ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                                      )}
                                    >
                                      <Plus className="w-3 h-3" />
                                      추가
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {chatLoading && (
                          <div className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            <span className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              생각 중...
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 입력창 - 스크린샷 스타일 */}
                    <div className={cn('p-3 border-t', isDark ? 'border-[#27272a]' : 'border-zinc-200')}>
                      {/* 텍스트 입력 */}
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendChatMessage()
                          }
                        }}
                        placeholder="메시지를 입력하세요..."
                        rows={2}
                        className={cn(
                          'w-full px-3 py-2 text-sm rounded-lg border-none resize-none mb-2',
                          isDark
                            ? 'bg-zinc-800 text-white placeholder:text-zinc-500'
                            : 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400'
                        )}
                      />
                      {/* 하단 툴바 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {/* Agent 버튼 */}
                          <button
                            className={cn(
                              'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium',
                              isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                            )}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Agent
                          </button>
                          {/* 모델 선택 */}
                          <div className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded text-xs',
                            isDark ? 'text-zinc-400' : 'text-zinc-600'
                          )}>
                            <span className="text-zinc-500">|</span>
                            <span>Gemini 3 Flash</span>
                            <ChevronDown className="w-3 h-3" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className={cn('p-1.5 rounded', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500')}>
                            <AtSign className="w-4 h-4" />
                          </button>
                          <button className={cn('p-1.5 rounded', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500')}>
                            <Globe className="w-4 h-4" />
                          </button>
                          <button className={cn('p-1.5 rounded', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500')}>
                            <ImagePlus className="w-4 h-4" />
                          </button>
                          <button className={cn('p-1.5 rounded', isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500')}>
                            <Mic className="w-4 h-4" />
                          </button>
                          {/* 전송 버튼 */}
                          <button
                            onClick={handleSendChatMessage}
                            disabled={!chatInput.trim() || chatLoading}
                            className={cn(
                              'p-1.5 rounded-full transition-colors ml-1',
                              chatInput.trim() && !chatLoading
                                ? 'bg-white text-black'
                                : isDark ? 'bg-zinc-700 text-zinc-500' : 'bg-zinc-300 text-zinc-400'
                            )}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 푸터 - 글자수 표시만 */}
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2 border-t',
                  isDark ? 'border-[#27272a]' : 'border-zinc-200'
                )}
              >
                <span className="text-xs text-zinc-500">
                  {content.length} chars · {content.split('\n').length} lines
                </span>
                <span className="text-xs text-zinc-500">
                  Cmd+S로 저장
                </span>
              </div>
            </>
          )}
          </>
        )}
      </div>
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
