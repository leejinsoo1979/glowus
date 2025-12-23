'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useNeuralMapApi } from '@/lib/neural-map/useNeuralMapApi'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { parseWikiLinks, extractTitle } from '@/lib/neural-map/markdown-parser'
import type { NeuralFile } from '@/lib/neural-map/types'
import { isElectron } from '@/lib/utils/electron'
import {
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  Loader2,
  MoreHorizontal,
  FilePlus,
  FolderPlus,
  RefreshCw,
  Upload,
  Sparkles,
  PenLine,
  ArrowUpDown,
  ChevronsDownUp,
  X,
  Check,
  Play,
  Eye,
  Code,
  FolderClosed,
  FileText,
  FileCode,
  Image,
  Film,
  File,
  Files,
  GitBranch,
  Puzzle,
  ChevronUp,
  MonitorStop,
  Container,
  Share2,
  Cpu,
  Pin,
  Scissors,
  Copy,
  Clipboard,
  Terminal,
  FolderOpen,
  Link,
  Plus,
} from 'lucide-react'

// react-icons - VS Code 스타일 파일 아이콘
import {
  VscFile,
  VscFileCode,
  VscFilePdf,
  VscFileMedia,
  VscMarkdown,
  VscJson,
  VscFolder,
  VscFolderOpened,
} from 'react-icons/vsc'
import {
  SiTypescript,
  SiJavascript,
  SiReact,
  SiCss3,
  SiHtml5,
  SiPython,
  SiGit,
} from 'react-icons/si'


// VS Code 스타일 파일 아이콘 - react-icons 사용
function FileIcon({ type, name }: { type: string; name?: string }) {
  const ext = name?.split('.').pop()?.toLowerCase()
  const iconClass = "w-4 h-4 flex-shrink-0"

  // TypeScript / JavaScript / React
  if (ext === 'ts') return <SiTypescript className={cn(iconClass, "text-blue-500")} />
  if (ext === 'tsx') return <SiReact className={cn(iconClass, "text-cyan-400")} />
  if (ext === 'js') return <SiJavascript className={cn(iconClass, "text-yellow-400")} />
  if (ext === 'jsx') return <SiReact className={cn(iconClass, "text-cyan-400")} />

  // 스타일
  if (ext === 'css' || ext === 'scss' || ext === 'sass') return <SiCss3 className={cn(iconClass, "text-blue-400")} />
  if (ext === 'html') return <SiHtml5 className={cn(iconClass, "text-orange-500")} />

  // 데이터/설정
  if (ext === 'json') return <VscJson className={cn(iconClass, "text-yellow-500")} />
  if (ext === 'env' || name?.startsWith('.env')) return <VscFileCode className={cn(iconClass, "text-yellow-600")} />

  // 마크다운/문서
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return <VscMarkdown className={cn(iconClass, "text-sky-400")} />
  if (ext === 'pdf') return <VscFilePdf className={cn(iconClass, "text-red-500")} />
  if (ext === 'txt') return <VscFile className={cn(iconClass, "text-zinc-400")} />

  // 이미지
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext || '')) {
    return <VscFileMedia className={cn(iconClass, "text-emerald-400")} />
  }

  // 비디오/미디어
  if (['mp4', 'webm', 'mov', 'avi', 'mp3', 'wav', 'mkv'].includes(ext || '')) {
    return <VscFileMedia className={cn(iconClass, "text-purple-400")} />
  }

  // 파이썬
  if (ext === 'py') return <SiPython className={cn(iconClass, "text-yellow-500")} />

  // Git
  if (name === '.gitignore' || ext === 'gitignore') return <SiGit className={cn(iconClass, "text-orange-600")} />

  // 타입별 폴백
  switch (type) {
    case 'pdf': return <VscFilePdf className={cn(iconClass, "text-red-500")} />
    case 'image': return <VscFileMedia className={cn(iconClass, "text-emerald-400")} />
    case 'video': return <VscFileMedia className={cn(iconClass, "text-purple-400")} />
    case 'markdown': return <VscMarkdown className={cn(iconClass, "text-sky-400")} />
    case 'code': return <VscFileCode className={cn(iconClass, "text-cyan-400")} />
    case 'text': return <VscFile className={cn(iconClass, "text-zinc-400")} />
    case 'binary': return <VscFile className={cn(iconClass, "text-zinc-500")} />
    default: return <VscFile className={cn(iconClass, "text-zinc-500")} />
  }
}

interface FileTreePanelProps {
  mapId: string | null
}

// 트리 노드 타입
interface TreeNode {
  name: string
  type: 'folder' | 'file'
  file?: NeuralFile
  children: TreeNode[]
}

// 컨텍스트 메뉴 상태 타입
interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  targetType: 'file' | 'folder' | null
  targetFile?: NeuralFile
  targetPath?: string  // 폴더의 경우 경로
}

import { FileSystemManager } from '@/lib/neural-map/file-system'

const normalizePath = (path: string) =>
  path
    .replace(/\\+/g, '/')
    .replace(/^\/+/, '')

// 파일 목록을 트리 구조로 변환
function buildFileTree(files: NeuralFile[]): TreeNode[] {
  console.log('[buildFileTree] Input files:', files.length, files)

  const root: TreeNode[] = []

  // path가 없는 파일들 (단일 파일 업로드)
  const standaloneFiles = files.filter(f => !f.path)
  console.log('[buildFileTree] Standalone files (no path):', standaloneFiles.length, standaloneFiles.map(f => f.name))

  // path가 있는 파일들 (폴더 업로드)
  const pathFiles = files
    .filter(f => f.path)
    .map((file) => ({
      file,
      normalizedPath: normalizePath(file.path!)
    }))
  console.log('[buildFileTree] Path files:', pathFiles.length, pathFiles.map(pf => ({ name: pf.file.name, path: pf.normalizedPath })))

  // 단일 파일들을 루트에 추가
  standaloneFiles.forEach(file => {
    root.push({
      name: file.name,
      type: 'file',
      file,
      children: []
    })
  })

  // 폴더 구조 파일들 처리
  pathFiles.forEach(({ file, normalizedPath }) => {
    if (!normalizedPath) return
    const parts = normalizedPath.split('/')
    let current = root

    // 마지막은 파일명이므로 제외하고 폴더 경로만 처리
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      let folder = current.find(n => n.type === 'folder' && n.name === folderName)

      if (!folder) {
        folder = {
          name: folderName,
          type: 'folder',
          children: []
        }
        current.push(folder)
      }

      current = folder.children
    }

    // 파일 추가
    current.push({
      name: file.name,
      type: 'file',
      file,
      children: []
    })
  })

  // 정렬: 폴더 먼저, 그 다음 파일 (이름순)
  const sortTree = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'folder') return 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortTree(node.children)
      }
    })
    return nodes
  }

  const result = sortTree(root)
  console.log('[buildFileTree] Final tree:', result)
  return result
}

export function FileTreePanel({ mapId }: FileTreePanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showHiddenFiles, setShowHiddenFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Store
  const files = useNeuralMapStore((s) => s.files)
  const addFile = useNeuralMapStore((s) => s.addFile)
  const removeFile = useNeuralMapStore((s) => s.removeFile)
  const setFiles = useNeuralMapStore((s) => s.setFiles)
  const graph = useNeuralMapStore((s) => s.graph)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const openEditor = useNeuralMapStore((s) => s.openEditor)
  const buildGraphFromFilesAsync = useNeuralMapStore((s) => s.buildGraphFromFilesAsync)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

  // Node Expansion Store
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)
  const toggleNodeExpansion = useNeuralMapStore((s) => s.toggleNodeExpansion)
  const setExpandedNodes = useNeuralMapStore((s) => s.setExpandedNodes)
  const graphExpanded = useNeuralMapStore((s) => s.graphExpanded)
  const setProjectPath = useNeuralMapStore((s) => s.setProjectPath)
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const linkedProjectName = useNeuralMapStore((s) => s.linkedProjectName)
  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)

  // API
  const { uploadFile, deleteFile, createNode, createEdge, analyzeFile, removeNode } = useNeuralMapApi(mapId)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 새 파일/폴더 생성 상태
  const [isCreatingNew, setIsCreatingNew] = useState<'file' | 'folder' | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const newItemInputRef = useRef<HTMLInputElement>(null)

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetType: null,
  })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // 클립보드 상태 (Cut/Copy/Paste용)
  const [clipboard, setClipboard] = useState<{
    operation: 'cut' | 'copy' | null
    file?: NeuralFile
    path?: string  // 전체 경로
  }>({ operation: null })

  // 프로젝트 생성 모달 상태
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreatingProjectLoading, setIsCreatingProjectLoading] = useState(false)
  const projectNameInputRef = useRef<HTMLInputElement>(null)

  // 이름 변경 상태
  const [renamingItem, setRenamingItem] = useState<{
    type: 'file' | 'folder'
    file?: NeuralFile
    path?: string
    name: string
  } | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // 사용자 테마
  const { accentColor: userAccentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === userAccentColor) || accentColors[0]

  // 폴더 이름 추출: projectPath에서 마지막 폴더명 가져오기
  const getFolderName = (path: string | null): string => {
    if (!path) return ''
    // Windows와 Unix 경로 모두 지원
    const parts = path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || parts[parts.length - 2] || ''
  }

  // 맵 제목: 프로젝트가 있을 때만 표시
  const folderName = getFolderName(projectPath)
  const hasProject = linkedProjectName || projectPath
  const mapTitle = linkedProjectName || graph?.title || folderName || ''

  // 파일 확장자로 타입 결정 (VS Code 스타일)
  const getFileTypeFromExt = useCallback((fileName: string): NeuralFile['type'] => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp']
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv']
    const mdExts = ['md', 'markdown', 'mdx']
    const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'xml', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'php', 'rb', 'swift', 'kt', 'yaml', 'yml', 'toml', 'ini', 'sh', 'bash', 'sql']

    if (ext === 'pdf') return 'pdf'
    if (imageExts.includes(ext)) return 'image'
    if (videoExts.includes(ext)) return 'video'
    if (mdExts.includes(ext)) return 'markdown'
    if (codeExts.includes(ext)) return 'code'
    return 'text'
  }, [])

  // 파일 확장자에 따른 기본 템플릿
  const getDefaultContent = useCallback((fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase() || ''
    const baseName = fileName.replace(/\.[^.]+$/, '')

    switch (ext) {
      case 'md':
      case 'markdown':
        return `# ${baseName}\n\n`
      case 'html':
        return `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${baseName}</title>\n</head>\n<body>\n  \n</body>\n</html>\n`
      case 'css':
        return `/* ${fileName} */\n\n`
      case 'js':
        return `// ${fileName}\n\n`
      case 'ts':
        return `// ${fileName}\n\n`
      case 'tsx':
      case 'jsx':
        const componentName = baseName.replace(/[^a-zA-Z0-9]/g, '') || 'Component'
        return `export function ${componentName}() {\n  return (\n    <div>\n      \n    </div>\n  )\n}\n`
      case 'json':
        return `{\n  \n}\n`
      case 'py':
        return `# ${fileName}\n\n`
      case 'yaml':
      case 'yml':
        return `# ${fileName}\n\n`
      default:
        return ''
    }
  }, [])

  // 새 파일 생성 핸들러
  const handleCreateNewFile = useCallback(async () => {
    const trimmedName = newItemName.trim()
    if (!trimmedName) {
      setIsCreatingNew(null)
      setNewItemName('')
      return
    }

    // VS Code 스타일: 사용자가 입력한 파일명 그대로 사용
    const fileName = trimmedName
    const fileContent = getDefaultContent(fileName)
    const fileType = getFileTypeFromExt(fileName)

    // 로컬 폴더가 있으면 파일 시스템에 저장
    if (projectPath && window.electron?.fs?.writeFile) {
      try {
        const filePath = `${projectPath}/${fileName}`
        await window.electron.fs.writeFile(filePath, fileContent)
        console.log('[FileTree] Created new file:', filePath)
      } catch (err) {
        console.error('[FileTree] Failed to create file:', err)
      }
    }

    // 파일 목록에 추가만 함
    // 그래프 노드는 useEffect의 auto-rebuild가 자동 생성 (files.length 변경 감지)
    const newFile: NeuralFile = {
      id: `local-${Date.now()}`,
      name: fileName,
      path: fileName,
      type: fileType,
      content: fileContent,
      size: fileContent.length,
      createdAt: new Date().toISOString(),
      mapId: mapId || '',
      url: '',
    }
    addFile(newFile)

    setIsCreatingNew(null)
    setNewItemName('')
  }, [newItemName, projectPath, mapId, addFile, getDefaultContent, getFileTypeFromExt])

  // 새 폴더 생성 핸들러
  const handleCreateNewFolder = useCallback(async () => {
    if (!newItemName.trim()) {
      setIsCreatingNew(null)
      setNewItemName('')
      return
    }

    const newFolderName = newItemName.trim()

    // 로컬 폴더가 있으면 파일 시스템에 폴더 생성
    if (projectPath && window.electron?.fs) {
      try {
        const folderPath = `${projectPath}/${newFolderName}`
        // fs.mkdir 사용 (타입 단언)
        const fs = window.electron.fs as any
        if (fs.mkdir) {
          await fs.mkdir(folderPath)
          console.log('[FileTree] Created new folder:', folderPath)
        }
      } catch (err) {
        console.error('[FileTree] Failed to create folder:', err)
      }
    }

    // 폴더는 파일 목록에 추가하지 않음 (파일만 추적)
    // 새로고침하면 폴더가 나타남

    setIsCreatingNew(null)
    setNewItemName('')
  }, [newItemName, projectPath])

  // 새로고침 핸들러
  const handleRefresh = useCallback(async () => {
    if (projectPath && window.electron?.fs) {
      console.log('[FileTree] Refreshing...')
      try {
        // readDirectory 사용 (기존 API)
        const fs = window.electron.fs
        if (fs.readDirectory) {
          await fs.readDirectory(projectPath, {})
        }
        // 파일 필터링 및 처리는 loadLocalFolder에서 처리됨
        window.dispatchEvent(new CustomEvent('folder-refresh', { detail: { path: projectPath } }))
      } catch (err) {
        console.error('[FileTree] Refresh failed:', err)
      }
    }
  }, [projectPath])

  // 모두 접기 핸들러
  const handleCollapseAll = useCallback(() => {
    setExpandedFolders(new Set())
    setIsExpanded(false)
    // 그래프 노드들도 모두 접기
    setExpandedNodes([])
  }, [setExpandedNodes])

  // 사이드바에서 프로젝트 생성 핸들러
  const handleCreateProjectFromSidebar = useCallback(async () => {
    const trimmedName = newProjectName.trim()
    if (!trimmedName) return

    setIsCreatingProjectLoading(true)
    try {
      // 1. Electron으로 로컬 워크스페이스 폴더 생성
      let folderPath: string | undefined
      const electronProject = window.electron?.project as any
      if (typeof window !== 'undefined' && electronProject?.createWorkspace) {
        const result = await electronProject.createWorkspace(trimmedName)
        if (result.success && result.path) {
          folderPath = result.path
          console.log('[FileTree] Local workspace created:', folderPath)
        } else {
          console.error('[FileTree] Failed to create workspace:', result.error)
          alert('로컬 폴더 생성에 실패했습니다: ' + (result.error || 'Unknown error'))
          return
        }
      }

      // 2. Supabase에 프로젝트 메타데이터 저장
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: '',
          status: 'active',
          folder_path: folderPath || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const newProject = await response.json()
      console.log('[FileTree] Project created in cloud:', newProject)

      // 3. 프로젝트 경로로 이동 및 Neural Map에 연결
      if (folderPath) {
        setProjectPath(folderPath)
      }
      if (newProject.id) {
        setLinkedProject(newProject.id, trimmedName)
      }

      // 4. 모달 닫기
      setIsCreatingProject(false)
      setNewProjectName('')

      console.log('[FileTree] Project linked to Neural Map:', {
        id: newProject.id,
        name: trimmedName,
        folderPath,
      })
    } catch (err) {
      console.error('[FileTree] Error creating project:', err)
      alert('프로젝트 생성 중 오류가 발생했습니다.')
    } finally {
      setIsCreatingProjectLoading(false)
    }
  }, [newProjectName, setProjectPath, setLinkedProject])

  // 컨텍스트 메뉴 열기
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    type: 'file' | 'folder',
    file?: NeuralFile,
    path?: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetType: type,
      targetFile: file,
      targetPath: path,
    })
  }, [])

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }, [])

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu.isOpen, closeContextMenu])

  // Reveal in Finder (macOS) / Show in Explorer (Windows)
  const handleRevealInFinder = useCallback(async () => {
    closeContextMenu()
    if (!projectPath) return

    let targetPath = projectPath
    if (contextMenu.targetFile?.path) {
      targetPath = `${projectPath}/${contextMenu.targetFile.path}`
    } else if (contextMenu.targetPath) {
      targetPath = `${projectPath}/${contextMenu.targetPath}`
    }

    // Electron API로 Finder에서 열기
    const electronApi = window.electron as any
    if (electronApi?.shell?.showItemInFolder) {
      await electronApi.shell.showItemInFolder(targetPath)
    } else {
      // 웹 환경에서는 경로를 클립보드에 복사
      await navigator.clipboard.writeText(targetPath)
      console.log('[FileTree] Path copied (no Finder available):', targetPath)
    }
  }, [contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // Open in Integrated Terminal
  const handleOpenInTerminal = useCallback(() => {
    closeContextMenu()
    if (!projectPath) return

    let targetPath = projectPath
    if (contextMenu.targetPath) {
      targetPath = `${projectPath}/${contextMenu.targetPath}`
    } else if (contextMenu.targetFile?.path) {
      // 파일의 경우 부모 디렉토리
      const filePath = contextMenu.targetFile.path
      const parentPath = filePath.includes('/')
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : ''
      targetPath = parentPath ? `${projectPath}/${parentPath}` : projectPath
    }

    // 터미널 이벤트 발송 (cd 명령 실행)
    window.dispatchEvent(new CustomEvent('terminal-execute', {
      detail: { command: `cd "${targetPath}"` }
    }))
    // 터미널 패널 열기
    useNeuralMapStore.getState().setTerminalOpen(true)
  }, [contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // Cut
  const handleCut = useCallback(() => {
    closeContextMenu()
    if (contextMenu.targetFile) {
      const fullPath = contextMenu.targetFile.path
        ? `${projectPath}/${contextMenu.targetFile.path}`
        : undefined
      setClipboard({
        operation: 'cut',
        file: contextMenu.targetFile,
        path: fullPath,
      })
    } else if (contextMenu.targetPath) {
      setClipboard({
        operation: 'cut',
        path: `${projectPath}/${contextMenu.targetPath}`,
      })
    }
  }, [contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // Copy
  const handleCopy = useCallback(() => {
    closeContextMenu()
    if (contextMenu.targetFile) {
      const fullPath = contextMenu.targetFile.path
        ? `${projectPath}/${contextMenu.targetFile.path}`
        : undefined
      setClipboard({
        operation: 'copy',
        file: contextMenu.targetFile,
        path: fullPath,
      })
    } else if (contextMenu.targetPath) {
      setClipboard({
        operation: 'copy',
        path: `${projectPath}/${contextMenu.targetPath}`,
      })
    }
  }, [contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // Paste
  const handlePaste = useCallback(async () => {
    closeContextMenu()
    if (!clipboard.operation || !clipboard.path || !projectPath) return

    // 대상 디렉토리 결정
    let targetDir = projectPath
    if (contextMenu.targetPath) {
      targetDir = `${projectPath}/${contextMenu.targetPath}`
    } else if (contextMenu.targetFile?.path) {
      const filePath = contextMenu.targetFile.path
      const parentPath = filePath.includes('/')
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : ''
      targetDir = parentPath ? `${projectPath}/${parentPath}` : projectPath
    }

    const sourcePath = clipboard.path
    const fileName = sourcePath.split('/').pop() || ''
    const destPath = `${targetDir}/${fileName}`

    // Electron API로 파일 복사/이동
    const electronFs = window.electron?.fs as any
    if (electronFs) {
      try {
        if (clipboard.operation === 'copy') {
          await electronFs.copyFile?.(sourcePath, destPath)
          console.log('[FileTree] File copied:', sourcePath, '->', destPath)
        } else {
          // cut: 복사 후 원본 삭제
          await electronFs.copyFile?.(sourcePath, destPath)
          await electronFs.deleteFile?.(sourcePath)
          console.log('[FileTree] File moved:', sourcePath, '->', destPath)
        }
        // 새로고침
        if (loadFolderFromPathRef.current) {
          await loadFolderFromPathRef.current(projectPath)
        }
      } catch (err) {
        console.error('[FileTree] Paste failed:', err)
      }
    }

    // 클립보드 초기화 (cut의 경우)
    if (clipboard.operation === 'cut') {
      setClipboard({ operation: null })
    }
  }, [clipboard, contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // Copy Path (절대 경로)
  const handleCopyPath = useCallback(async () => {
    closeContextMenu()
    if (!projectPath) return

    let targetPath = projectPath
    if (contextMenu.targetFile?.path) {
      targetPath = `${projectPath}/${contextMenu.targetFile.path}`
    } else if (contextMenu.targetPath) {
      targetPath = `${projectPath}/${contextMenu.targetPath}`
    }

    await navigator.clipboard.writeText(targetPath)
    console.log('[FileTree] Path copied:', targetPath)
  }, [contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // Copy Relative Path
  const handleCopyRelativePath = useCallback(async () => {
    closeContextMenu()

    let relativePath = ''
    if (contextMenu.targetFile?.path) {
      relativePath = contextMenu.targetFile.path
    } else if (contextMenu.targetPath) {
      relativePath = contextMenu.targetPath
    }

    await navigator.clipboard.writeText(relativePath)
    console.log('[FileTree] Relative path copied:', relativePath)
  }, [contextMenu.targetFile, contextMenu.targetPath, closeContextMenu])

  // Rename 시작
  const handleStartRename = useCallback(() => {
    closeContextMenu()
    if (contextMenu.targetFile) {
      setRenamingItem({
        type: 'file',
        file: contextMenu.targetFile,
        name: contextMenu.targetFile.name,
      })
    } else if (contextMenu.targetPath) {
      const name = contextMenu.targetPath.split('/').pop() || ''
      setRenamingItem({
        type: 'folder',
        path: contextMenu.targetPath,
        name,
      })
    }
    // 포커스
    setTimeout(() => renameInputRef.current?.select(), 50)
  }, [contextMenu.targetFile, contextMenu.targetPath, closeContextMenu])

  // Rename 완료
  const handleRename = useCallback(async () => {
    if (!renamingItem || !renamingItem.name.trim() || !projectPath) {
      setRenamingItem(null)
      return
    }

    const newName = renamingItem.name.trim()
    const electronFs = window.electron?.fs as any

    if (renamingItem.type === 'file' && renamingItem.file?.path) {
      const filePath = renamingItem.file.path
      const oldPath = `${projectPath}/${filePath}`
      const dir = filePath.includes('/')
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : ''
      const newPath = dir ? `${projectPath}/${dir}/${newName}` : `${projectPath}/${newName}`

      if (electronFs?.rename) {
        try {
          await electronFs.rename(oldPath, newPath)
          console.log('[FileTree] File renamed:', oldPath, '->', newPath)
          // 새로고침
          if (loadFolderFromPathRef.current) {
            await loadFolderFromPathRef.current(projectPath)
          }
        } catch (err) {
          console.error('[FileTree] Rename failed:', err)
        }
      }
    } else if (renamingItem.type === 'folder' && renamingItem.path) {
      const oldPath = `${projectPath}/${renamingItem.path}`
      const parentDir = renamingItem.path.includes('/')
        ? renamingItem.path.substring(0, renamingItem.path.lastIndexOf('/'))
        : ''
      const newPath = parentDir ? `${projectPath}/${parentDir}/${newName}` : `${projectPath}/${newName}`

      if (electronFs?.rename) {
        try {
          await electronFs.rename(oldPath, newPath)
          console.log('[FileTree] Folder renamed:', oldPath, '->', newPath)
          // 새로고침
          if (loadFolderFromPathRef.current) {
            await loadFolderFromPathRef.current(projectPath)
          }
        } catch (err) {
          console.error('[FileTree] Rename failed:', err)
        }
      }
    }

    setRenamingItem(null)
  }, [renamingItem, projectPath])

  // Delete
  const handleDelete = useCallback(async () => {
    closeContextMenu()
    if (!projectPath) return

    let targetPath = ''
    let targetName = ''

    if (contextMenu.targetFile) {
      targetPath = `${projectPath}/${contextMenu.targetFile.path}`
      targetName = contextMenu.targetFile.name
    } else if (contextMenu.targetPath) {
      targetPath = `${projectPath}/${contextMenu.targetPath}`
      targetName = contextMenu.targetPath.split('/').pop() || ''
    }

    if (!targetPath) return

    // 확인 다이얼로그
    const confirmed = window.confirm(`"${targetName}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)
    if (!confirmed) return

    const electronApi = window.electron as any
    if (electronApi?.fs) {
      try {
        // 휴지통으로 이동 시도 (Electron API)
        if (electronApi.shell?.trashItem) {
          await electronApi.shell.trashItem(targetPath)
          console.log('[FileTree] Moved to trash:', targetPath)
        } else {
          // 휴지통 API가 없으면 직접 삭제
          await electronApi.fs.deleteFile?.(targetPath)
          console.log('[FileTree] Deleted:', targetPath)
        }
        // 새로고침
        if (loadFolderFromPathRef.current) {
          await loadFolderFromPathRef.current(projectPath)
        }
      } catch (err) {
        console.error('[FileTree] Delete failed:', err)
      }
    }
  }, [contextMenu.targetFile, contextMenu.targetPath, projectPath, closeContextMenu])

  // New File in Folder
  const handleNewFileInFolder = useCallback(() => {
    closeContextMenu()
    setIsCreatingNew('file')
    setNewItemName('')
    // 대상 폴더 열기
    if (contextMenu.targetPath) {
      setExpandedFolders(prev => new Set([...prev, contextMenu.targetPath!]))
    }
  }, [contextMenu.targetPath, closeContextMenu])

  // New Folder in Folder
  const handleNewFolderInFolder = useCallback(() => {
    closeContextMenu()
    setIsCreatingNew('folder')
    setNewItemName('')
    // 대상 폴더 열기
    if (contextMenu.targetPath) {
      setExpandedFolders(prev => new Set([...prev, contextMenu.targetPath!]))
    }
  }, [contextMenu.targetPath, closeContextMenu])

  // 새 파일/폴더 생성 시 자동 포커스
  useEffect(() => {
    if (isCreatingNew && newItemInputRef.current) {
      newItemInputRef.current.focus()
    }
  }, [isCreatingNew])

  // 파일 트리 구조 생성 - useMemo로 메모이제이션하여 무한 루프 방지
  const fileTree = useMemo(() => {
    console.log('[FileTree] Building tree from files:', files.length, files)
    return buildFileTree(files)
  }, [files])

  // 파일이 변경되면 자동으로 그래프 리빌드 (최초 로드 또는 파일 추가 시)
  const prevFilesLengthRef = useRef(-1) // -1로 초기화해서 첫 렌더링에서 무조건 체크
  const isRebuildingRef = useRef(false) // 무한 루프 방지 플래그
  useEffect(() => {
    // 이미 리빌드 중이면 스킵
    if (isRebuildingRef.current) return

    // 파일이 있고 (1) 개수가 변경되었거나 (2) 그래프가 없으면 리빌드
    const filesChanged = files.length !== prevFilesLengthRef.current
    const needsGraph = !graph || (graph?.nodes?.length || 0) === 0
    // 프로젝트가 연결되어 있으면 파일이 없어도 그래프 빌드 (빈 프로젝트 노드 표시)
    const hasLinkedProject = !!linkedProjectName || !!projectPath

    if ((files.length > 0 && (filesChanged || needsGraph)) || (hasLinkedProject && needsGraph)) {
      console.log('[FileTree] Auto-rebuild graph:', {
        prev: prevFilesLengthRef.current,
        current: files.length,
        hasGraph: !!graph,
        nodeCount: graph?.nodes?.length || 0,
        filesChanged,
        needsGraph,
        linkedProjectName,
        projectPath
      })
      prevFilesLengthRef.current = files.length
      isRebuildingRef.current = true
      buildGraphFromFilesAsync().finally(() => {
        isRebuildingRef.current = false
      })
    }
  }, [files.length, graph, buildGraphFromFilesAsync, linkedProjectName, projectPath])

  // 폴더 경로로 노드 ID 찾기 (그래프 동기화용)
  const findNodeIdByPath = (folderPath: string): string | undefined => {
    if (!graph?.nodes) return undefined;

    // 0. 루트 폴더 (슬래시 없음) → SELF 노드
    if (!folderPath.includes('/')) {
      const selfNode = graph.nodes.find(n => n.type === 'self')
      if (selfNode) return selfNode.id
    }

    // 1. 직접 ID 매칭 (folder-{path} 형식)
    const directId = `folder-${folderPath}`
    const directNode = graph.nodes.find(n => n.id === directId)
    if (directNode) return directNode.id

    // 2. 이름과 타입으로 매칭 (가장 정확)
    // 폴더 업로드 시 title은 폴더명, summary에 전체 경로가 포함됨
    const parts = folderPath.split('/');
    const folderName = parts[parts.length - 1];

    // Try to find a node that matches the folder name and is a container type
    const node = graph.nodes.find(n => {
      const isContainer = n.type === 'project' || (n.type as any) === 'folder'
      if (!isContainer) return false

      // Match by title
      if (n.title === folderName) return true

      // Match by path in summary (if explicitly stored there)
      if (n.summary && n.summary.includes(folderPath)) return true

      return false
    });

    return node?.id;
  }

  // 폴더 펼침/접기 토글 (Global Sync)
  const toggleFolder = (folderPath: string) => {
    const nodeId = findNodeIdByPath(folderPath)
    console.log('[FileTree] toggleFolder:', folderPath, 'Found Node ID:', nodeId)
    if (nodeId) {
      // 그래프 노드가 있으면 스토어 상태 토글 (그래프와 동기화)
      toggleNodeExpansion(nodeId)
    }

    // 로컬 UI 상태도 업데이트 (노드가 없는 폴더를 위해)
    // (Note: We previously used setExpandedFolders. Now we need a hybrid approach if we want to support non-node folders,
    // but for "Sync", leveraging the store is key. 
    // Let's use a local set ONLY for folders that don't have nodes, OR just force sync.)
    // For now, let's assume we maintain a local set for UI responsiveness, 
    // BUT we prioritize the store if a node exists.

    // Actually, to avoid complexity, let's keep `expandedFolders` for UI rendering,
    // and SYNC it with store.
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }

  // Effect: Store의 expandedNodeIds와 graphExpanded가 바뀌면 로컬 상태도 업데이트 (양방향 동기화)
  useEffect(() => {
    if (!graph?.nodes) return;

    // 폴더/프로젝트 노드들의 ID -> 경로 매핑 생성
    const nodeIdToPath = new Map<string, string>();

    // fileTree를 순회하며 경로 매핑 생성
    const buildPathMap = (nodes: TreeNode[], parentPath: string) => {
      nodes.forEach(node => {
        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;

        if (node.type === 'folder') {
          const nodeId = findNodeIdByPath(nodePath);
          if (nodeId) nodeIdToPath.set(nodeId, nodePath);

          if (node.children && node.children.length > 0) {
            buildPathMap(node.children, nodePath);
          }
        }
      })
    }

    // 루트 레벨 순회
    buildPathMap(fileTree, '');

    // "노드가 존재하는" 폴더들에 대해서만 로컬 상태 동기화
    setExpandedFolders(prev => {
      const next = new Set(prev);

      nodeIdToPath.forEach((path, nodeId) => {
        if (expandedNodeIds.has(nodeId)) {
          next.add(path);
        } else {
          // 스토어에서 닫혀있으면 로컬에서도 닫음 (단, 노드가 있는 경우만)
          next.delete(path);
        }
      });

      return next;
    });

    // graphExpanded 상태에 따라 루트 폴더 펼침/접힘 동기화
    setIsExpanded(graphExpanded);

  }, [expandedNodeIds, graph?.nodes, graphExpanded, fileTree]);

  // 파일에 해당하는 노드 찾기
  const findNodeByFileName = (fileName: string) => {
    return graph?.nodes.find(n => n.title === fileName)
  }

  // 파일 클릭 핸들러 - 코드 미리보기 열기
  const handleFileClick = (file: NeuralFile) => {
    console.log('[FileTree] File clicked:', file.name, 'id:', file.id, 'hasContent:', !!(file as any).content)
    setSelectedFileId(file.id)

    // 파일 객체에 이미 content가 있으면 그대로 사용
    // 없으면 새 객체 생성해서 전달 (zustand 객체는 frozen됨)
    const fileToOpen = (file as any).content
      ? { ...file }  // 이미 content 있음
      : file

    console.log('[FileTree] Opening file:', file.name, 'content length:', (fileToOpen as any).content?.length || 0)

    // 파일 클릭 시 바로 코드 미리보기 열기
    openCodePreview(fileToOpen)

    const node = findNodeByFileName(file.name)
    if (node) {
      setSelectedNodes([node.id])
      focusOnNode(node.id)
    }
  }

  // 파일 더블클릭 - 외부에서 열기
  const handleFileDoubleClick = (file: NeuralFile) => {
    if (file.url) {
      window.open(file.url, '_blank')
    }
  }

  // 파일 삭제
  const handleDeleteFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation()
    if (!mapId) return
    const success = await deleteFile(fileId)
    if (success) {
      removeFile(fileId)
      if (selectedFileId === fileId) {
        setSelectedFileId(null)
      }
    }
  }

  // 단일 파일 업로드 처리 - VS Code처럼 즉시 반영
  const processFileUpload = async (file: File, path?: string) => {
    console.log('[processFileUpload] Uploading:', file.name, 'type:', file.type, 'path:', path)
    const result = await uploadFile(file, path)
    console.log('[processFileUpload] Result:', result ? 'SUCCESS' : 'FAILED', file.name)
    if (result) {
      // 1. 파일 트리에 즉시 추가
      addFile(result)

      // 2. 마크다운 파일인 경우 내용 읽기 (링크 파싱용)
      let fileContent: string | null = null
      if (result.type === 'markdown') {
        try {
          fileContent = await file.text()
        } catch (err) {
          console.error('파일 내용 읽기 실패:', err)
        }
      }

      // 3. 노드 생성 및 AI 분석은 백그라운드에서 비동기 실행 (UI 블로킹 없음)
      ; (async () => {
        try {
          const nodeType =
            result.type === 'image' || result.type === 'video'
              ? 'memory'
              : result.type === 'binary'
                ? 'file'
                : 'doc'

          // 마크다운인 경우 제목 추출
          const nodeTitle = fileContent
            ? extractTitle(fileContent, result.name)
            : result.name

          const newNode = await createNode({
            type: nodeType as any,
            title: nodeTitle,
            summary: `${result.type} 파일`,
            content: result.type === 'markdown' ? fileContent || undefined : undefined,
            tags: [result.type],
            importance: 5,
          })

          if (newNode && graph?.nodes) {
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
            if (fileContent) {
              const wikiLinks = parseWikiLinks(fileContent)
              console.log(`[[링크]] ${wikiLinks.length}개 발견:`, wikiLinks.map(l => l.target))

              for (const link of wikiLinks) {
                // 기존 노드에서 제목으로 찾기
                const existingNode = graph.nodes.find(
                  n => n.title.toLowerCase() === link.target.toLowerCase()
                )

                if (existingNode) {
                  // 기존 노드와 연결
                  await createEdge({
                    sourceId: newNode.id,
                    targetId: existingNode.id,
                    type: 'references',
                    weight: 0.5,
                    label: link.alias || undefined,
                  })
                  console.log(`엣지 생성: ${nodeTitle} → ${existingNode.title}`)
                } else {
                  // 새 노드 생성 후 연결
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
                    console.log(`새 노드 + 엣지 생성: ${nodeTitle} → ${link.target}`)
                  }
                }
              }
            }
          }

          // AI 분석 (백그라운드)
          if (result.type === 'pdf' || result.type === 'markdown') {
            setIsAnalyzing(true)
            try {
              const analysisResult = await analyzeFile(result.id)
              if (analysisResult?.nodes && analysisResult.nodes.length > 0) {
                console.log(`AI 분석 완료: ${analysisResult.nodes.length}개 노드 생성`)
              }
            } finally {
              setIsAnalyzing(false)
            }
          }
        } catch (err) {
          console.error('백그라운드 처리 실패:', err)
        }
      })()

      return result
    }
    return null
  }

  // 파일 업로드 (단일/다중)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0 || !mapId) return

    setIsUploading(true)
    setUploadingCount(selectedFiles.length)
    setIsExpanded(true)

    try {
      let lastResult = null
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadingCount(selectedFiles.length - i)
        const result = await processFileUpload(selectedFiles[i])
        if (result) lastResult = result
      }

      // 마지막 업로드 파일 선택
      if (lastResult) {
        setSelectedFileId(lastResult.id)
      }
    } catch (error) {
      console.error('File upload error:', error)
    } finally {
      setIsUploading(false)
      setUploadingCount(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 폴더 업로드 (Legacy/Fallback) - input[type=file] webkitdirectory 사용
  const handleLegacyFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    // 숨김/시스템 파일 제외
    const ignoredNames = new Set(['.DS_Store', 'Thumbs.db', '.git', 'node_modules', '.next'])
    const validFiles = Array.from(selectedFiles)
      .filter(file => {
        const fileName = file.name
        const pathParts = (file as any).webkitRelativePath?.split('/') || []
        return !!fileName &&
          !ignoredNames.has(fileName) &&
          !pathParts.some((part: string) => ignoredNames.has(part))
      })

    if (validFiles.length === 0) {
      alert('업로드 가능한 파일이 없습니다.')
      return
    }

    setIsExpanded(true)

    const getFileType = (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp']
      const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv']
      const mdExts = ['md', 'markdown', 'mdx']
      const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h']

      if (ext === 'pdf') return 'pdf'
      if (imageExts.includes(ext)) return 'image'
      if (videoExts.includes(ext)) return 'video'
      if (mdExts.includes(ext)) return 'markdown'
      if (codeExts.includes(ext)) return 'code'
      return 'text'
    }

    const timestamp = Date.now()
    const fileIds = validFiles.map((_, index) => `local-${timestamp}-${index}`)
    const fileContentsMap = new Map<number, string>()

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const type = getFileType(file.name)
      if (type === 'code' || type === 'markdown' || type === 'text') {
        try {
          const content = await file.text()
          fileContentsMap.set(i, content)
        } catch (err) {
          console.error('파일 읽기 실패:', file.name, err)
        }
      }
    }

    const localFiles: NeuralFile[] = validFiles.map((file, index) => {
      const rawPath = (file as any).webkitRelativePath || file.name
      const path = normalizePath(rawPath)
      const id = fileIds[index]
      const type = getFileType(file.name) as NeuralFile['type']
      const content = fileContentsMap.get(index)
      const blobUrl = URL.createObjectURL(file)

      const neuralFile: NeuralFile = {
        id,
        mapId: mapId || 'local',
        name: file.name,
        path: path,
        type: type,
        url: blobUrl,
        size: file.size,
        createdAt: new Date().toISOString(),
      }

      if (content) {
        (neuralFile as any).content = content
      }

      return neuralFile
    })

    if (files.length > 0) {
      const choice = window.confirm(
        `기존 파일 ${files.length}개가 있습니다.\n[확인] = 교체\n[취소] = 추가`
      )
      if (choice) {
        setFiles(localFiles)
        buildGraphFromFilesAsync()
      } else {
        const existingPaths = new Set(files.map(f => f.path))
        const newFiles = localFiles.filter(f => !existingPaths.has(f.path))
        setFiles([...files, ...newFiles])
        buildGraphFromFilesAsync()
      }
    } else {
      setFiles(localFiles)
      buildGraphFromFilesAsync()
    }

    // 입력 초기화
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  // 공통 폴더 로드 함수 (Electron 환경)
  const loadFolderFromPath = useCallback(async (dirPath: string) => {
    const electron = (window as any).electron
    if (!electron?.fs?.scanTree) return

    try {
      setIsUploading(true)
      setIsExpanded(true)
      setProjectPath(dirPath)
      console.log('[FileTree] ✅ Set projectPath:', dirPath)

      // 🔄 Start file system watcher for external changes (Claude Code, etc.)
      if (electron?.fs?.watchStart) {
        electron.fs.watchStart(dirPath).then((result: { success: boolean; path: string }) => {
          if (result.success) {
            console.log('[FileTree] 👁️ File watcher started for:', result.path)
          }
        }).catch((err: Error) => {
          console.warn('[FileTree] File watcher failed:', err)
        })
      }

      // 🚀 Batch Scan: Single IPC call for entire tree (includes file content)
      console.time('Batch Scan Tree')

      const scanResult = await electron.fs.scanTree(dirPath, {
        includeSystemFiles: showHiddenFiles,
        includeContent: true,
        contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs']
      })

      console.timeEnd('Batch Scan Tree')
      console.log(`[Batch Scan] ${scanResult.stats.fileCount} files, ${scanResult.stats.dirCount} dirs in ${scanResult.stats.elapsed}ms`)

      const timestamp = Date.now()
      const neuralFiles: NeuralFile[] = []

      const getFileType = (ext: string) => {
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
        const mdExts = ['md', 'markdown', 'mdx']
        const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go']
        if (imageExts.includes(ext)) return 'image'
        if (mdExts.includes(ext)) return 'markdown'
        if (codeExts.includes(ext)) return 'code'
        return 'text'
      }

      const flattenTree = (node: any) => {
        if (node.kind === 'file') {
          const ext = node.name.split('.').pop()?.toLowerCase() || ''
          const type = getFileType(ext)

          neuralFiles.push({
            id: `local-${timestamp}-${neuralFiles.length}`,
            name: node.name,
            path: node.relativePath,
            type: type as any,
            content: node.content || '',
            size: node.size || 0,
            createdAt: new Date().toISOString(),
            mapId: mapId || '',
            url: '',
          })
        }

        if (node.children) {
          for (const child of node.children) {
            flattenTree(child)
          }
        }
      }

      flattenTree(scanResult.tree)

      console.log(`[Batch Scan] Processed ${neuralFiles.length} files for Neural Map`)

      setFiles(neuralFiles)
      buildGraphFromFilesAsync()
      setIsUploading(false)

    } catch (err) {
      console.error('Failed to load folder:', err)
      alert('폴더 로딩 실패: ' + (err as Error).message)
      setIsUploading(false)
    }
  }, [showHiddenFiles, mapId, setProjectPath, setFiles, buildGraphFromFilesAsync])

  // ref로 최신 함수 참조 유지 (useEffect에서 사용)
  const loadFolderFromPathRef = useRef(loadFolderFromPath)
  loadFolderFromPathRef.current = loadFolderFromPath

  // 폴더 업로드 - File System Access API (Real Sync)
  const handleNativeFolderUpload = async () => {
    try {
      // Electron 환경에서는 Electron API 사용
      const electronFs = window.electron?.fs
      if (isElectron() && electronFs?.selectDirectory) {
        const result = await electronFs.selectDirectory()
        if (!result) return

        // 공통 함수 호출
        await loadFolderFromPath(result.path)
        return
      }

      // 웹 브라우저 환경 - File System Access API 사용
      const dirHandle = await FileSystemManager.selectDirectory()
      if (!dirHandle) return

      if (showHiddenFiles) {
        const confirmResult = window.confirm(
          "경고: 숨김 파일(node_modules, .git 등)을 모두 포함하면 \n" +
          "파일 개수가 너무 많아 브라우저가 응답하지 않을 수 있습니다.\n\n" +
          "그래도 진행하시겠습니까?"
        )
        if (!confirmResult) return
      }

      setIsExpanded(true)
      FileSystemManager.setProjectHandle(dirHandle)

      // 웹 환경에서는 dirHandle.name만 사용 가능 (전체 경로 없음)
      console.log('[FileTree] Selected directory (Web):', {
        name: dirHandle.name,
      })
      // 웹 환경에서는 projectPath를 폴더 이름으로만 설정
      setProjectPath(dirHandle.name)
      console.log('[FileTree] ✅ Set projectPath in store (Web):', dirHandle.name)

      // 폴더 스캔 (재귀적)
      console.log('Scanning directory:', dirHandle.name)
      const { files: scannedFiles, handles } = await FileSystemManager.readDirectory(dirHandle, '', { includeSystemFiles: showHiddenFiles })
      console.log(`Found ${scannedFiles.length} files`)

      if (scannedFiles.length === 0) {
        // 빈 폴더여도 정상 처리 - 파일 트리에 폴더 이름만 표시
        console.log('[FileTree] Empty folder selected:', dirHandle.name)
        setFiles([])
        return
      }

      // 파일 타입 결정 함수
      const getFileType = (fileName: string): string => {
        const ext = fileName.split('.').pop()?.toLowerCase() || ''
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp']
        const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv']
        const mdExts = ['md', 'markdown', 'mdx']
        const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h']

        if (ext === 'pdf') return 'pdf'
        if (imageExts.includes(ext)) return 'image'
        if (videoExts.includes(ext)) return 'video'
        if (mdExts.includes(ext)) return 'markdown'
        if (codeExts.includes(ext)) return 'code'
        return 'text'
      }

      const timestamp = Date.now()
      const fileIds = scannedFiles.map((_, index) => `local-${timestamp}-${index}`)
      const fileContentsMap = new Map<number, string>()

      // 파일 읽기
      for (let i = 0; i < scannedFiles.length; i++) {
        const file = scannedFiles[i]
        const type = getFileType(file.name)
        if (type === 'code' || type === 'markdown' || type === 'text' || type === 'config' || file.name === '.env') {
          try {
            const content = await file.text()
            fileContentsMap.set(i, content)
          } catch (err) {
            console.error('Failed to read file:', file.name, err)
          }
        }
      }

      // NeuralFile 변환 및 핸들 등록
      const localFiles: NeuralFile[] = scannedFiles.map((file, index) => {
        // webkitRelativePath was injected by FileSystemManager
        const rawPath = (file as any).webkitRelativePath || file.name
        const path = normalizePath(rawPath)
        const id = fileIds[index]
        const type = getFileType(file.name) as NeuralFile['type']
        const content = fileContentsMap.get(index)

        // Register Handle
        const handle = handles.get(rawPath)
        if (handle) {
          FileSystemManager.registerFileHandle(id, handle)
        }

        let blobUrl = ''
        try {
          // @ts-ignore
          if (window.electron) {
            // in Electron, we use file:// path
            // Accessing the 'path' property we injected in the fake file
            blobUrl = `file://${(file as any).path}`
          } else {
            blobUrl = URL.createObjectURL(file)
          }
        } catch (e) {
          console.warn('Failed to create object URL', e)
        }

        const neuralFile: NeuralFile = {
          id,
          mapId: mapId || 'local',
          name: file.name,
          path: path,
          type: type,
          url: blobUrl,
          size: file.size,
          createdAt: new Date().toISOString(),
        }

        if (content) {
          (neuralFile as any).content = content
        }
        return neuralFile
      })

      // 기존 파일 교체 여부 확인
      if (files.length > 0) {
        const choice = window.confirm(
          `기존 파일 ${files.length}개가 있습니다.\n[확인] = 교체 (실제 폴더 연동)\n[취소] = 추가`
        )
        if (choice) {
          setFiles(localFiles)
          buildGraphFromFilesAsync()
        } else {
          const existingPaths = new Set(files.map(f => f.path))
          const newFiles = localFiles.filter(f => !existingPaths.has(f.path))
          setFiles([...files, ...newFiles])
          buildGraphFromFilesAsync()
        }
      } else {
        setFiles(localFiles)
        buildGraphFromFilesAsync()
      }

      console.log(`✅ ${localFiles.length} files loaded via File System Access API`)

    } catch (err) {
      if ((err as any).name === 'AbortError') return; // User cancelled
      console.error('Folder upload failed:', err)
      alert("Folder access failed. Note: Use Chrome/Edge/Opera.")
    }
  }

  const [showFileMenu, setShowFileMenu] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)

  // 파일 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setShowFileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Electron 메뉴 이벤트 리스너
  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.onMenuEvent) return

    // 폴더 선택 완료 이벤트 - ref로 최신 함수 참조
    const unsubFolderSelected = electron.onMenuEvent('menu:folder-selected', async (_event: any, dirInfo: { name: string, path: string }) => {
      console.log('[Menu] Folder selected:', dirInfo)
      if (!dirInfo?.path) return
      await loadFolderFromPathRef.current(dirInfo.path)
    })

    const unsubNewNote = electron.onMenuEvent('menu:new-note', () => {
      console.log('[Menu] New Note triggered')
      openEditor()
    })

    const unsubNewFile = electron.onMenuEvent('menu:new-file', () => {
      console.log('[Menu] New File triggered')
      fileInputRef.current?.click()
    })

    // Listen for file system changes (Agent actions)
    const unsubFsChanged = electron.fs?.onChanged?.(async (data: { path: string }) => {
      console.log('[FileTree] File changed by Agent:', data.path)
      // Get latest project path from store directly to avoid dependency issues
      const currentProjectPath = useNeuralMapStore.getState().projectPath
      if (currentProjectPath) {
        // Debounce reload slightly to prevent flashing if multiple files change
        await loadFolderFromPathRef.current(currentProjectPath)
      }
    })

    return () => {
      unsubFolderSelected?.()
      unsubNewNote?.()
      unsubNewFile?.()
      unsubFsChanged?.()
      // Stop file system watcher
      electron.fs?.watchStop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])




  return (
    <div className={cn('h-full flex flex-col text-[13px] overflow-hidden min-w-0', isDark ? 'bg-zinc-900' : 'bg-[#f3f3f3]')}>
      {/* File 드롭다운 메뉴 바 */}
      <div
        className={cn(
          'h-[36px] flex items-center px-2 border-b shrink-0 min-w-0',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-[#e5e5e5]'
        )}
      >
        <div className="relative" ref={fileMenuRef}>
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className={cn(
              'px-3 py-1 text-[13px] rounded transition-colors',
              showFileMenu
                ? isDark ? 'bg-[#3c3c3c] text-white' : 'bg-[#e8e8e8] text-zinc-900'
                : isDark ? 'text-[#cfcfcf] hover:bg-[#2c2c2c]' : 'text-[#4a4a4a] hover:bg-[#f4f4f4]'
            )}
          >
            File
          </button>

          {/* File 드롭다운 메뉴 - 네이티브 메뉴와 동일 */}
          <AnimatePresence>
            {showFileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.1 }}
                className={cn(
                  'absolute top-full left-0 mt-1 py-1 rounded-md shadow-xl z-50 min-w-[240px]',
                  isDark ? 'bg-zinc-900 border border-zinc-700' : 'bg-white border border-[#d4d4d4]'
                )}
              >
                {/* New Note */}
                <button
                  onClick={() => { openEditor(); setShowFileMenu(false) }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>New Note</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘N</span>
                </button>

                {/* New File */}
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowFileMenu(false) }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>New File...</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌥⌘N</span>
                </button>

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Open Folder */}
                <button
                  onClick={() => {
                    // @ts-ignore
                    if (window.showDirectoryPicker || isElectron()) {
                      handleNativeFolderUpload()
                    } else {
                      folderInputRef.current?.click()
                    }
                    setShowFileMenu(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>Open Folder...</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘O</span>
                </button>

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Save */}
                <button
                  onClick={() => {
                    // menu:save 이벤트 트리거 (에디터에서 처리)
                    window.dispatchEvent(new CustomEvent('menu:save'))
                    setShowFileMenu(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>Save</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘S</span>
                </button>

                {/* Save As */}
                <button
                  onClick={() => {
                    // menu:save-as 이벤트 트리거
                    window.dispatchEvent(new CustomEvent('menu:save-as'))
                    setShowFileMenu(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>Save As...</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⇧⌘S</span>
                </button>

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Close */}
                <button
                  onClick={() => {
                    // 현재 탭/창 닫기
                    if (isElectron()) {
                      window.close()
                    }
                    setShowFileMenu(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>Close</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘W</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 로딩 상태 표시 */}
        {(isUploading || isAnalyzing) && (
          <div className="ml-auto flex items-center gap-2 px-3">
            {isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse text-amber-400" />
                <span className="text-[11px] text-amber-400">AI 분석중...</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">파일 불러오는 중...</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 파일 트리 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* 루트 폴더 헤더 - 프로젝트가 있을 때만 표시 */}
        {hasProject ? (
          <div
            className={cn(
              'group flex items-center justify-between py-[3px] px-2 cursor-pointer select-none',
              isDark
                ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
                : 'hover:bg-[#e8e8e8] text-[#3b3b3b]',
              'font-semibold text-[11px] uppercase tracking-wide'
            )}
          >
            {/* 좌측: 폴더 토글 + 이름 */}
            <div
              className="flex items-center gap-1 flex-1 min-w-0"
              onClick={() => {
                const newExpanded = !isExpanded
                setIsExpanded(newExpanded)

                // Sync with graph: Toggle self node
                if (graph?.nodes) {
                  const selfNode = graph.nodes.find(n => n.type === 'self')
                  if (selfNode) {
                    if (newExpanded) {
                      if (!expandedNodeIds.has(selfNode.id)) {
                        toggleNodeExpansion(selfNode.id)
                      }
                    } else {
                      if (expandedNodeIds.has(selfNode.id)) {
                        toggleNodeExpansion(selfNode.id)
                      }
                    }
                  }
                }
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="truncate">{mapTitle}</span>
            </div>

          {/* 우측: 액션 아이콘 (호버 시 표시) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 프로젝트 미연결 시: 새 프로젝트 생성 버튼 */}
            {!projectPath && !linkedProjectName && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCreatingProject(true)
                  setNewProjectName('')
                  setTimeout(() => projectNameInputRef.current?.focus(), 100)
                }}
                className={cn(
                  'p-1 rounded transition-colors',
                  isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d4d4d4]'
                )}
                style={{ color: currentAccent.color }}
                title="새 프로젝트 생성"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
            {/* 새 파일 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsCreatingNew('file')
                setNewItemName('')
                setIsExpanded(true)
              }}
              className={cn(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d4d4d4]'
              )}
              title="새 파일"
            >
              <FilePlus className="w-4 h-4" />
            </button>
            {/* 새 폴더 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsCreatingNew('folder')
                setNewItemName('')
                setIsExpanded(true)
              }}
              className={cn(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d4d4d4]'
              )}
              title="새 폴더"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            {/* 새로고침 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleRefresh()
              }}
              className={cn(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d4d4d4]'
              )}
              title="새로고침"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {/* 모두 접기 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCollapseAll()
              }}
              className={cn(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#d4d4d4]'
              )}
              title="모두 접기"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>
          </div>
        </div>
        ) : (
          /* 프로젝트 없을 때 - 새 프로젝트 생성 버튼 */
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <button
              onClick={() => {
                setIsCreatingProject(true)
                setNewProjectName('')
                setTimeout(() => projectNameInputRef.current?.focus(), 100)
              }}
              className={cn(
                'flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                isDark
                  ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
              )}
            >
              <Plus className="w-4 h-4" />
              <span>새 프로젝트</span>
            </button>
          </div>
        )}

        {/* 새 파일/폴더 입력창 - VS Code 스타일 */}
        {isCreatingNew && (
          <div
            className="flex items-center gap-1.5 py-[2px] pr-2"
            style={{ paddingLeft: 20 }}
          >
            {isCreatingNew === 'file' ? (
              <VscFile className="w-4 h-4 flex-shrink-0 text-zinc-400" />
            ) : (
              <VscFolder className="w-4 h-4 flex-shrink-0 text-zinc-400" />
            )}
            <input
              ref={newItemInputRef}
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isCreatingNew === 'file') {
                    handleCreateNewFile()
                  } else {
                    handleCreateNewFolder()
                  }
                } else if (e.key === 'Escape') {
                  setIsCreatingNew(null)
                  setNewItemName('')
                }
              }}
              onBlur={() => {
                // 약간의 딜레이 후 처리 (클릭 이벤트 처리를 위해)
                setTimeout(() => {
                  if (newItemName.trim()) {
                    if (isCreatingNew === 'file') {
                      handleCreateNewFile()
                    } else {
                      handleCreateNewFolder()
                    }
                  } else {
                    setIsCreatingNew(null)
                    setNewItemName('')
                  }
                }, 100)
              }}
              placeholder={isCreatingNew === 'file' ? 'filename.ext' : 'folder name'}
              className={cn(
                'flex-1 px-1.5 py-[2px] text-[13px] border-0 outline-none focus:outline-none focus:ring-0',
                isDark
                  ? 'bg-[#3c3c3c] text-[#cccccc] placeholder:text-zinc-600 caret-white'
                  : 'bg-white text-zinc-900 placeholder:text-zinc-400'
              )}
              style={{ boxShadow: 'none' }}
            />
          </div>
        )}

        {/* 파일 트리 목록 - 프로젝트가 있을 때만 */}
        {hasProject && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {fileTree.length === 0 ? (
                <div className={cn(
                  'py-4 px-4 text-xs',
                  isDark ? 'text-zinc-600' : 'text-zinc-400'
                )}>
                  {projectPath ? (
                    <span>빈 폴더입니다. 파일을 추가하세요.</span>
                  ) : linkedProjectName ? (
                    <span>프로젝트를 로드 중입니다...</span>
                  ) : (
                    <div className="py-3 px-2">
                      <button
                        onClick={() => {
                          setIsCreatingProject(true)
                          setNewProjectName('')
                          setTimeout(() => projectNameInputRef.current?.focus(), 100)
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors',
                          isDark
                            ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            : 'text-zinc-400 hover:text-zinc-600 hover:bg-black/5'
                        )}
                      >
                        <Plus className="w-3 h-3" />
                        <span>새 프로젝트</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <TreeNodeList
                  nodes={fileTree}
                  depth={1}
                  parentPath=""
                  isDark={isDark}
                  selectedFileId={selectedFileId}
                  expandedFolders={expandedFolders}
                  currentAccent={currentAccent}
                  onFileClick={handleFileClick}
                  onFileDoubleClick={handleFileDoubleClick}
                  onDeleteFile={handleDeleteFile}
                  onToggleFolder={toggleFolder}
                  findNodeByFileName={findNodeByFileName}
                  onOpenCodePreview={openCodePreview}
                  onContextMenu={handleContextMenu}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>

      {/* 하단 패널들 (VS Code 스타일) */}
      <div className={cn('border-t', isDark ? 'border-[#3c3c3c]' : 'border-[#d4d4d4]')}>
        {/* 개요 섹션 */}
        <CollapsibleSection title="개요" isDark={isDark} defaultClosed>
          <div className={cn('py-2 px-4 text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            문서 개요가 없습니다
          </div>
        </CollapsibleSection>

        {/* 타임라인 섹션 */}
        <CollapsibleSection title="타임라인" isDark={isDark} defaultClosed>
          <div className={cn('py-2 px-4 text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            타임라인 항목이 없습니다
          </div>
        </CollapsibleSection>
      </div>

      {/* 컨텍스트 메뉴 (VS Code 스타일) */}
      <AnimatePresence>
        {contextMenu.isOpen && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              'fixed z-[9999] py-1 rounded-md shadow-xl min-w-[220px] text-[13px]',
              isDark
                ? 'bg-[#252526] border border-[#454545]'
                : 'bg-white border border-[#c8c8c8]'
            )}
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 240),
              top: Math.min(contextMenu.y, window.innerHeight - 400),
            }}
          >
            {/* New File / New Folder - 폴더에서만 표시 */}
            {contextMenu.targetType === 'folder' && (
              <>
                <ContextMenuItem
                  icon={<FilePlus className="w-4 h-4" />}
                  label="New File..."
                  onClick={handleNewFileInFolder}
                  isDark={isDark}
                />
                <ContextMenuItem
                  icon={<FolderPlus className="w-4 h-4" />}
                  label="New Folder..."
                  onClick={handleNewFolderInFolder}
                  isDark={isDark}
                />
                <ContextMenuDivider isDark={isDark} />
              </>
            )}

            {/* Reveal in Finder */}
            <ContextMenuItem
              icon={<FolderOpen className="w-4 h-4" />}
              label="Reveal in Finder"
              shortcut="⌘⇧R"
              onClick={handleRevealInFinder}
              isDark={isDark}
            />

            {/* Open in Integrated Terminal */}
            <ContextMenuItem
              icon={<Terminal className="w-4 h-4" />}
              label="Open in Integrated Terminal"
              onClick={handleOpenInTerminal}
              isDark={isDark}
            />

            <ContextMenuDivider isDark={isDark} />

            {/* Cut / Copy / Paste */}
            <ContextMenuItem
              icon={<Scissors className="w-4 h-4" />}
              label="Cut"
              shortcut="⌘X"
              onClick={handleCut}
              isDark={isDark}
            />
            <ContextMenuItem
              icon={<Copy className="w-4 h-4" />}
              label="Copy"
              shortcut="⌘C"
              onClick={handleCopy}
              isDark={isDark}
            />
            <ContextMenuItem
              icon={<Clipboard className="w-4 h-4" />}
              label="Paste"
              shortcut="⌘V"
              onClick={handlePaste}
              disabled={!clipboard.operation}
              isDark={isDark}
            />

            <ContextMenuDivider isDark={isDark} />

            {/* Copy Path / Copy Relative Path */}
            <ContextMenuItem
              icon={<Link className="w-4 h-4" />}
              label="Copy Path"
              shortcut="⌥⌘C"
              onClick={handleCopyPath}
              isDark={isDark}
            />
            <ContextMenuItem
              icon={<Link className="w-4 h-4" />}
              label="Copy Relative Path"
              shortcut="⌥⇧C"
              onClick={handleCopyRelativePath}
              isDark={isDark}
            />

            <ContextMenuDivider isDark={isDark} />

            {/* Rename / Delete */}
            <ContextMenuItem
              icon={<PenLine className="w-4 h-4" />}
              label="Rename..."
              onClick={handleStartRename}
              isDark={isDark}
            />
            <ContextMenuItem
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete"
              shortcut="⌘⌫"
              onClick={handleDelete}
              isDark={isDark}
              danger
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        accept="*/*"
        className="hidden"
      />
      {/* 숨겨진 폴더 입력 */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in the types
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleLegacyFolderUpload}
        accept="*/*"
        className="hidden"
      />

      {/* 프로젝트 생성 모달 */}
      <AnimatePresence>
        {isCreatingProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
            onClick={() => setIsCreatingProject(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-[400px] rounded-xl shadow-2xl p-6',
                isDark ? 'bg-[#1e1e1e] border border-[#3c3c3c]' : 'bg-white border border-zinc-200'
              )}
            >
              <h3 className={cn(
                'text-lg font-semibold mb-4',
                isDark ? 'text-white' : 'text-zinc-900'
              )}>
                새 프로젝트 생성
              </h3>
              <p className={cn(
                'text-sm mb-4',
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              )}>
                새로운 프로젝트 폴더가 로컬 워크스페이스에 생성되고, 클라우드에 메타데이터가 저장됩니다.
              </p>
              <input
                ref={projectNameInputRef}
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectName.trim()) {
                    handleCreateProjectFromSidebar()
                  } else if (e.key === 'Escape') {
                    setIsCreatingProject(false)
                  }
                }}
                placeholder="프로젝트 이름"
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors border-2',
                  isDark
                    ? 'bg-[#2d2d2d] border-[#3c3c3c] text-white placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                )}
                style={{
                  borderColor: newProjectName.trim() ? currentAccent.color : undefined
                }}
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsCreatingProject(false)}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isDark
                      ? 'bg-[#2d2d2d] hover:bg-[#3d3d3d] text-zinc-300'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  )}
                >
                  취소
                </button>
                <button
                  onClick={handleCreateProjectFromSidebar}
                  disabled={!newProjectName.trim() || isCreatingProjectLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50 hover:brightness-110"
                  style={{
                    backgroundColor: currentAccent.color
                  }}
                >
                  {isCreatingProjectLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      생성
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 트리 노드 목록 렌더링 컴포넌트
interface TreeNodeListProps {
  nodes: TreeNode[]
  depth: number
  parentPath: string
  isDark: boolean
  selectedFileId: string | null
  expandedFolders: Set<string>
  currentAccent: { color: string }
  onFileClick: (file: NeuralFile) => void
  onFileDoubleClick: (file: NeuralFile) => void
  onDeleteFile: (e: React.MouseEvent, fileId: string) => void
  onToggleFolder: (path: string) => void
  findNodeByFileName: (name: string) => unknown
  onOpenCodePreview: (file: NeuralFile) => void
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', file?: NeuralFile, path?: string) => void
}

function TreeNodeList({
  nodes,
  depth,
  parentPath,
  isDark,
  selectedFileId,
  expandedFolders,
  currentAccent,
  onFileClick,
  onFileDoubleClick,
  onDeleteFile,
  onToggleFolder,
  findNodeByFileName,
  onOpenCodePreview,
  onContextMenu,
}: TreeNodeListProps) {
  return (
    <>
      {nodes.map((node, index) => {
        const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name
        const paddingLeft = depth * 12 + 8 // 들여쓰기

        if (node.type === 'folder') {
          const isOpen = expandedFolders.has(nodePath)

          return (
            <div key={`folder-${nodePath}-${index}`}>
              <div
                onClick={() => onToggleFolder(nodePath)}
                onContextMenu={(e) => onContextMenu(e, 'folder', undefined, nodePath)}
                className={cn(
                  'flex items-center gap-1 py-[3px] pr-2 cursor-pointer select-none',
                  isDark
                    ? 'hover:bg-zinc-800 text-zinc-300'
                    : 'hover:bg-[#e8e8e8] text-[#3b3b3b]'
                )}
                style={{ paddingLeft }}
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
                <FolderClosed className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="truncate">{node.name}</span>
              </div>
              <AnimatePresence>
                {isOpen && node.children.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.1 }}
                  >
                    <TreeNodeList
                      nodes={node.children}
                      depth={depth + 1}
                      parentPath={nodePath}
                      isDark={isDark}
                      selectedFileId={selectedFileId}
                      expandedFolders={expandedFolders}
                      currentAccent={currentAccent}
                      onFileClick={onFileClick}
                      onFileDoubleClick={onFileDoubleClick}
                      onDeleteFile={onDeleteFile}
                      onToggleFolder={onToggleFolder}
                      findNodeByFileName={findNodeByFileName}
                      onOpenCodePreview={onOpenCodePreview}
                      onContextMenu={onContextMenu}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        }

        // 파일 노드
        const file = node.file!
        const isSelected = selectedFileId === file.id
        const hasNode = !!findNodeByFileName(file.name)

        return (
          <div
            key={file.id}
            onClick={() => onFileClick(file)}
            onDoubleClick={() => onFileDoubleClick(file)}
            onContextMenu={(e) => onContextMenu(e, 'file', file, undefined)}
            className={cn(
              'group flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer select-none',
              isSelected
                ? isDark
                  ? 'bg-[#094771] text-white'
                  : 'bg-[#0060c0] text-white'
                : isDark
                  ? 'hover:bg-zinc-800 text-zinc-300'
                  : 'hover:bg-[#e8e8e8] text-[#3b3b3b]'
            )}
            style={{ paddingLeft: paddingLeft + 16 }} // 파일은 추가 들여쓰기
          >
            <FileIcon type={file.type} name={file.name} />
            <span className="flex-1 truncate">{file.name}</span>

            {/* 노드 연결 표시 */}
            {hasNode && !isSelected && (
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: currentAccent.color }}
                title="노드 연결됨"
              />
            )}

            {/* 코드 미리보기 버튼 - 호버 시 표시 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenCodePreview(file)
              }}
              className={cn(
                'p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                isSelected
                  ? 'hover:bg-white/20'
                  : isDark
                    ? 'hover:bg-zinc-700'
                    : 'hover:bg-zinc-300'
              )}
              title="코드 미리보기"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            {/* 삭제 버튼 - 호버 시 표시 */}
            <button
              onClick={(e) => onDeleteFile(e, file.id)}
              className={cn(
                'p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                isSelected
                  ? 'hover:bg-white/20'
                  : isDark
                    ? 'hover:bg-zinc-700'
                    : 'hover:bg-zinc-300'
              )}
              title="삭제"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </>
  )
}

// 접을 수 있는 섹션 컴포넌트
function CollapsibleSection({
  title,
  isDark,
  children,
  defaultClosed = false
}: {
  title: string
  isDark: boolean
  children: React.ReactNode
  defaultClosed?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(!defaultClosed)

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-1 py-[3px] px-2 select-none',
          isDark
            ? 'hover:bg-[#2a2d2e] text-[#bbbbbb]'
            : 'hover:bg-[#e8e8e8] text-[#616161]',
          'text-[11px] font-semibold uppercase tracking-wide'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{title}</span>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 컨텍스트 메뉴 아이템 컴포넌트
function ContextMenuItem({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  danger,
  isDark,
}: {
  icon?: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  isDark: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full px-3 py-1.5 flex items-center gap-3 text-left transition-colors',
        disabled
          ? isDark
            ? 'text-[#6e6e6e] cursor-not-allowed'
            : 'text-zinc-400 cursor-not-allowed'
          : danger
            ? isDark
              ? 'text-red-400 hover:bg-[#094771] hover:text-white'
              : 'text-red-600 hover:bg-blue-50'
            : isDark
              ? 'text-[#cccccc] hover:bg-[#094771]'
              : 'text-zinc-700 hover:bg-blue-50'
      )}
    >
      {icon && <span className="flex-shrink-0 opacity-80">{icon}</span>}
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className={cn(
          'text-[11px]',
          isDark ? 'text-[#6e6e6e]' : 'text-zinc-400'
        )}>
          {shortcut}
        </span>
      )}
    </button>
  )
}

// 컨텍스트 메뉴 구분선
function ContextMenuDivider({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'my-1 h-px',
      isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]'
    )} />
  )
}
