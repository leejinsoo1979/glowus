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
import { getFileSystem, isWeb } from '@/lib/file-system'
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
  Bot,
  Palette,
  Briefcase,
  Folder,
  Brain,
  CircleDot,
  FileJson,
  FileImage,
} from 'lucide-react'

// 🔥 react-icons 완전 제거 - lucide-react로 통일 (16MB 번들 절약!)
// 파일 타입별 별칭 (기존 코드 호환성)
const VscFileCode = FileCode
const VscFile = File
const VscFilePdf = FileText
const VscFileMedia = FileImage
const VscMarkdown = FileText
const VscJson = FileJson
const VscFolder = Folder
const VscFolderOpened = FolderOpen

// 🔥 브랜드 아이콘을 lucide-react generic 아이콘으로 대체
const SiTypescript = FileCode
const SiJavascript = FileCode
const SiReact = FileCode
const SiCss3 = FileCode
const SiHtml5 = FileCode
const SiPython = FileCode
const SiGit = GitBranch

// 파일 아이콘 컴포넌트 - lucide-react 사용
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

  // 🆕 agents 폴더를 필터링하지 않음 - 프로젝트 내 agents 폴더가 표시되어야 함
  // (에이전트가 프로젝트 내에 저장되므로 다른 프로젝트를 열면 자동으로 해당 프로젝트 에이전트만 표시)

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

  // 에이전트 폴더 상태
  const [agentFolders, setAgentFolders] = useState<Array<{
    folderName: string
    name: string
    description: string
    nodeCount: number
    edgeCount: number
  }>>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)

  // 에이전트 폴더 목록 가져오기 (프로젝트 연결 시 해당 프로젝트 에이전트만)
  const fetchAgentFolders = useCallback(async (projectId: string | null) => {
    setIsLoadingAgents(true)
    try {
      // 🆕 프로젝트가 연결된 경우: DB에서 해당 프로젝트의 에이전트만 조회
      if (projectId) {
        const res = await fetch(`/api/agents?project_id=${projectId}`)
        if (res.ok) {
          const agents = await res.json()
          // DB 에이전트를 폴더 형식으로 변환
          const agentFolders = (agents || []).map((agent: any) => ({
            folderName: agent.name.toLowerCase().replace(/\s+/g, '-'),
            name: agent.name,
            description: agent.description || '',
            nodeCount: agent.workflow_nodes?.length || 0,
            edgeCount: agent.workflow_edges?.length || 0,
            agentId: agent.id,  // DB ID 추가
          }))
          setAgentFolders(agentFolders)
          console.log('[FileTree] Loaded project agents:', agentFolders.length)
        }
      } else {
        // 프로젝트 연결 없음: 빈 목록 (글로벌 에이전트 표시 안 함)
        setAgentFolders([])
        console.log('[FileTree] No project linked, clearing agents')
      }
    } catch (error) {
      console.error('[FileTree] Failed to fetch agents:', error)
      setAgentFolders([])
    } finally {
      setIsLoadingAgents(false)
    }
  }, [])

  // Store
  const files = useNeuralMapStore((s) => s.files)
  const addFile = useNeuralMapStore((s) => s.addFile)
  const removeFile = useNeuralMapStore((s) => s.removeFile)
  const setFiles = useNeuralMapStore((s) => s.setFiles)
  const graph = useNeuralMapStore((s) => s.graph)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const openEditor = useNeuralMapStore((s) => s.openEditor)
  const openEditorWithFile = useNeuralMapStore((s) => s.openEditorWithFile)
  const closeEditor = useNeuralMapStore((s) => s.closeEditor)
  const editingFile = useNeuralMapStore((s) => s.editingFile)
  const editorOpen = useNeuralMapStore((s) => s.editorOpen)
  const buildGraphFromFilesAsync = useNeuralMapStore((s) => s.buildGraphFromFilesAsync)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)
  const closeCodePreview = useNeuralMapStore((s) => s.closeCodePreview)
  const codePreviewFile = useNeuralMapStore((s) => s.codePreviewFile)
  const codePreviewOpen = useNeuralMapStore((s) => s.codePreviewOpen)

  // Node Expansion Store
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)
  const toggleNodeExpansion = useNeuralMapStore((s) => s.toggleNodeExpansion)
  const setExpandedNodes = useNeuralMapStore((s) => s.setExpandedNodes)
  const graphExpanded = useNeuralMapStore((s) => s.graphExpanded)
  const setProjectPath = useNeuralMapStore((s) => s.setProjectPath)
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery) // 🔥 검색 필터링용
  const linkedProjectName = useNeuralMapStore((s) => s.linkedProjectName)
  const linkedProjectId = useNeuralMapStore((s) => s.linkedProjectId)
  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)
  const clearLinkedProject = useNeuralMapStore((s) => s.clearLinkedProject)
  const setMapId = useNeuralMapStore((s) => s.setMapId)
  const setRightPanelTab = useNeuralMapStore((s) => s.setRightPanelTab)  // Agent Builder 탭 전환용

  // 🆕 linkedProjectId가 변경되면 에이전트 목록 새로고침
  useEffect(() => {
    fetchAgentFolders(linkedProjectId)

    // 에이전트 생성 이벤트 수신하여 목록 새로고침
    const channel = new BroadcastChannel('agent-folder-refresh')
    channel.onmessage = () => {
      fetchAgentFolders(linkedProjectId)
    }
    return () => channel.close()
  }, [linkedProjectId, fetchAgentFolders])

  // 🔄 Agent Builder 노드 클릭 시 파일 동기화 (역방향)
  useEffect(() => {
    const syncChannel = new BroadcastChannel('agent-file-sync')
    syncChannel.onmessage = (event) => {
      if (event.data?.type === 'SELECT_FILE') {
        const { fileName } = event.data.payload
        console.log('[FileTree] Sync request from AgentBuilder:', fileName)

        // 파일 트리에서 해당 파일 찾기 (TreeNode 구조)
        const findFileByName = (items: TreeNode[], targetName: string): NeuralFile | null => {
          for (const item of items) {
            if (item.name === targetName && item.file) return item.file
            if (item.children && item.children.length > 0) {
              const found = findFileByName(item.children, targetName)
              if (found) return found
            }
          }
          return null
        }

        const foundFile = findFileByName(fileTree, fileName)
        if (foundFile) {
          console.log('[FileTree] Found file, selecting:', foundFile.id)
          setSelectedFileId(foundFile.id)

          // agents 폴더 확장
          if (foundFile.path?.includes('agents/')) {
            const pathParts = foundFile.path.split('/')
            const agentsIndex = pathParts.indexOf('agents')
            if (agentsIndex !== -1) {
              // agents 폴더와 에이전트 서브폴더 확장
              setExpandedFolders(prev => {
                const next = new Set(prev)
                next.add('agents')
                if (pathParts[agentsIndex + 1]) {
                  next.add(`agents/${pathParts[agentsIndex + 1]}`)
                }
                return next
              })
            }
          }
        }
      }
    }
    return () => syncChannel.close()
  }, [files])

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
  const [createGitHubRepo, setCreateGitHubRepo] = useState(false)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const projectNameInputRef = useRef<HTMLInputElement>(null)

  // 프로젝트 열기 모달 상태
  const [isOpenProjectModal, setIsOpenProjectModal] = useState(false)
  const [projectList, setProjectList] = useState<Array<{ id: string; name: string; folder_path?: string; status?: string }>>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)

  // 카테고리 상태
  interface ProjectCategory {
    id: string
    name: string
    description: string | null
    icon: string
    color: string
    sort_order: number
  }
  const [categories, setCategories] = useState<ProjectCategory[]>([
    { id: '11111111-1111-1111-1111-111111111111', name: '개발', description: '코드 프로젝트', icon: 'Code', color: '#10b981', sort_order: 0 },
    { id: '22222222-2222-2222-2222-222222222222', name: '문서', description: '기획 & 문서', icon: 'FileText', color: '#3b82f6', sort_order: 1 },
    { id: '33333333-3333-3333-3333-333333333333', name: '디자인', description: 'UI/UX & 그래픽', icon: 'Palette', color: '#8b5cf6', sort_order: 2 },
    { id: '44444444-4444-4444-4444-444444444444', name: '업무', description: '태스크 관리', icon: 'Briefcase', color: '#f59e0b', sort_order: 3 },
  ])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('11111111-1111-1111-1111-111111111111')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState('')

  // 카테고리 아이콘 매핑
  const categoryIconMap: Record<string, React.ElementType> = {
    Code, FileText, Palette, Briefcase, Folder,
  }

  // 카테고리 로드
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/project-categories')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setCategories(data)
          }
        }
      } catch (err) {
        console.error('[FileTree] Failed to load categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // 최근 프로젝트 상태
  interface RecentProject {
    path: string
    name: string
    lastOpened: number
  }
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const RECENT_PROJECTS_KEY = 'neural-map-recent-projects'
  const MAX_RECENT_PROJECTS = 10

  // 최근 프로젝트 localStorage에서 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_PROJECTS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as RecentProject[]
        setRecentProjects(parsed.sort((a, b) => b.lastOpened - a.lastOpened))
      }
    } catch (err) {
      console.error('[FileTree] Failed to load recent projects:', err)
    }
  }, [])

  // 최근 프로젝트에 추가하는 함수
  const addToRecentProjects = useCallback((path: string) => {
    if (!path) return
    const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || path

    setRecentProjects(prev => {
      // 이미 있으면 제거
      const filtered = prev.filter(p => p.path !== path)
      // 맨 앞에 추가
      const updated = [{ path, name, lastOpened: Date.now() }, ...filtered].slice(0, MAX_RECENT_PROJECTS)
      // localStorage에 저장
      try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated))
      } catch (err) {
        console.error('[FileTree] Failed to save recent projects:', err)
      }
      return updated
    })
  }, [])

  // GitHub 연결 상태 확인 - 연결되어 있으면 자동으로 레포 생성 ON
  useEffect(() => {
    const checkGitHubConnection = async () => {
      try {
        const res = await fetch('/api/github')
        if (res.ok) {
          const data = await res.json()
          setIsGitHubConnected(data.connected)
          // GitHub 연결되어 있으면 자동으로 레포 생성 활성화
          if (data.connected) {
            setCreateGitHubRepo(true)
          }
        }
      } catch (err) {
        console.error('Failed to check GitHub connection:', err)
      }
    }
    checkGitHubConnection()
  }, [])

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

  // 맵 제목: 프로젝트 이름 → 폴더 이름 순서
  // 🔥 linkedProjectId가 있을 때만 linkedProjectName 표시 (불일치 방지)
  const folderName = getFolderName(projectPath)
  // 🔥 hasProject: linkedProjectId 또는 projectPath가 있어야 프로젝트가 있는 것
  // linkedProjectName만 있는 경우는 불완전한 상태이므로 프로젝트 없음으로 처리
  const hasProject = linkedProjectId || projectPath
  // 🔥 mapTitle: linkedProjectId가 없으면 linkedProjectName도 사용하지 않음
  const mapTitle = hasProject
    ? ((linkedProjectId && linkedProjectName) ? linkedProjectName : folderName || '')
    : ''

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

    // 파일 시스템에 저장 (Electron 또는 GCS)
    if (projectPath) {
      try {
        if (isWeb()) {
          // Web 모드: GCS에 저장
          const response = await fetch('/api/gcs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: fileName,
              content: fileContent,
              projectId: projectPath,
            }),
          })
          if (response.ok) {
            console.log('[FileTree] 🌐 Created file in GCS:', fileName)
          }
        } else if (window.electron?.fs?.writeFile) {
          // Electron 모드: 로컬에 저장
          const filePath = `${projectPath}/${fileName}`
          await window.electron.fs.writeFile(filePath, fileContent)
          console.log('[FileTree] Created new file:', filePath)
        }
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

    // 파일 시스템에 폴더 생성 (Electron 또는 GCS)
    if (projectPath) {
      try {
        if (isWeb()) {
          // Web 모드: GCS에 .keep 파일로 폴더 표시
          const response = await fetch('/api/gcs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: `${newFolderName}/.keep`,
              content: '',
              projectId: projectPath,
            }),
          })
          if (response.ok) {
            console.log('[FileTree] 🌐 Created folder in GCS:', newFolderName)
          }
        } else if (window.electron?.fs) {
          // Electron 모드: 로컬에 폴더 생성
          const folderPath = `${projectPath}/${newFolderName}`
          const fs = window.electron.fs as any
          if (fs.mkdir) {
            await fs.mkdir(folderPath)
            console.log('[FileTree] Created new folder:', folderPath)
          }
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

  // 모두 접기 핸들러
  const handleCollapseAll = useCallback(() => {
    setExpandedFolders(new Set())
    setIsExpanded(false)
    // 그래프 노드들도 모두 접기
    setExpandedNodes([])
  }, [setExpandedNodes])

  // 🔥 프로젝트 저장 핸들러 (File 메뉴 Save)
  const [isSavingProject, setIsSavingProject] = useState(false)
  const handleSaveProject = useCallback(async () => {
    if (!projectPath) {
      alert('프로젝트 폴더를 먼저 열어주세요.')
      return
    }

    setIsSavingProject(true)
    try {
      let currentProjectId = linkedProjectId
      let currentMapId = mapId

      // 프로젝트가 연결되지 않은 경우 자동 생성
      if (!currentProjectId) {
        const projectName = projectPath.split('/').pop() || '새 프로젝트'
        console.log('[FileTree] Creating new project:', projectName)

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
        console.log('[FileTree] Project created:', currentProjectId)

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
          console.log('[FileTree] Map created:', currentMapId)
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

      alert('✅ 저장되었습니다!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSavingProject(false)
    }
  }, [linkedProjectId, mapId, projectPath, setLinkedProject, setMapId])

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
      } else {
        // 🔥 웹 환경: 프로젝트를 열려면 로컬 폴더 선택 필요
        // FileSystem Access API 사용해서 폴더 선택
        if ('showDirectoryPicker' in window) {
          try {
            const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
            folderPath = dirHandle.name  // 웹에서는 핸들의 name만 사용 가능
            console.log('[FileTree] Web: Directory selected:', folderPath)
          } catch (pickerError: any) {
            if (pickerError.name !== 'AbortError') {
              console.error('[FileTree] Directory picker error:', pickerError)
            }
            // 사용자가 취소하거나 API 미지원 시 가상 경로 사용
            folderPath = `/workspace/${trimmedName}`
            console.log('[FileTree] Web: Using virtual path:', folderPath)
          }
        } else {
          // FileSystem Access API 미지원 브라우저: 가상 경로 사용
          folderPath = `/workspace/${trimmedName}`
          console.log('[FileTree] Web: Using virtual path (no FS API):', folderPath)
        }
      }

      // 2. GitHub 레포지토리 생성 (옵션) - auto_init: false로 빈 레포 생성
      let githubData: { owner: string; repo: string; clone_url: string; default_branch: string } | null = null
      if (createGitHubRepo && isGitHubConnected) {
        try {
          const repoName = trimmedName.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
          const repoRes = await fetch('/api/github/repos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: repoName,
              description: `${trimmedName} - Created with GlowUS`,
              private: true,
              auto_init: false,  // 빈 레포로 생성 → 로컬에서 initial commit
            }),
          })

          if (repoRes.ok) {
            const repoResult = await repoRes.json()
            githubData = {
              owner: repoResult.repo.owner.login,
              repo: repoResult.repo.name,
              clone_url: repoResult.repo.clone_url,
              default_branch: repoResult.repo.default_branch || 'main',  // 빈 레포는 main 사용
            }
            console.log('[FileTree] GitHub repo created:', githubData)
          } else {
            const errorData = await repoRes.json()
            console.warn('[FileTree] GitHub repo creation failed:', errorData)
            // 레포 생성 실패해도 계속 진행 (선택적 기능)
          }
        } catch (githubErr) {
          console.warn('[FileTree] GitHub repo creation error:', githubErr)
        }
      }

      // 3. 커스텀 카테고리 생성 (필요시)
      let finalCategoryId = selectedCategoryId
      if (isCustomCategory && customCategoryName.trim()) {
        try {
          const categoryRes = await fetch('/api/project-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: customCategoryName.trim(),
              icon: 'Folder',
              color: currentAccent.color,
            }),
          })
          if (categoryRes.ok) {
            const newCategory = await categoryRes.json()
            finalCategoryId = newCategory.id
            console.log('[FileTree] Custom category created:', newCategory)
          }
        } catch (catErr) {
          console.warn('[FileTree] Custom category creation failed:', catErr)
        }
      }

      // 4. Supabase에 프로젝트 메타데이터 저장
      // 선택된 카테고리로 project_type 결정
      const selectedCategory = categories.find(c => c.id === finalCategoryId)
      const projectTypeMap: Record<string, string> = {
        '11111111-1111-1111-1111-111111111111': 'code',
        '22222222-2222-2222-2222-222222222222': 'document',
        '33333333-3333-3333-3333-333333333333': 'design',
        '44444444-4444-4444-4444-444444444444': 'work',
      }
      const projectType = projectTypeMap[finalCategoryId] || 'code'

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: selectedCategory?.description || '',
          status: 'active',
          folder_path: folderPath || null,
          project_type: projectType,
          category_id: finalCategoryId,
          github_owner: githubData?.owner || null,
          github_repo: githubData?.repo || null,
          github_clone_url: githubData?.clone_url || null,
          github_default_branch: githubData?.default_branch || null,
          github_connected_at: githubData ? new Date().toISOString() : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create project')
      }

      const newProject = await response.json()
      console.log('[FileTree] Project created in cloud:', newProject)

      // 4. Git 초기화, README 생성, 커밋, 푸시 (GitHub 레포가 있는 경우)
      if (folderPath && githubData && window.electron?.git && window.electron?.fs) {
        try {
          // Git 초기화
          await window.electron.git.init?.(folderPath)
          console.log('[FileTree] Git initialized')

          // README.md 생성
          const readmeContent = `# ${trimmedName}\n\n> Created with [GlowUS](https://glowus.dev)\n`
          await window.electron.fs.writeFile?.(`${folderPath}/README.md`, readmeContent)
          console.log('[FileTree] README.md created')

          // Git 사용자 설정 (GitHub 정보 사용)
          const githubRes = await fetch('/api/github')
          if (githubRes.ok) {
            const githubUser = await githubRes.json()
            if (githubUser.username) {
              await window.electron.git.config?.(folderPath, 'user.name', githubUser.username)
            }
            if (githubUser.email) {
              await window.electron.git.config?.(folderPath, 'user.email', githubUser.email)
            }
          }

          // 원격 저장소 연결
          await window.electron.git.remoteAdd?.(folderPath, 'origin', githubData.clone_url)
          console.log('[FileTree] Remote added:', githubData.clone_url)

          // git add .
          await window.electron.git.add?.(folderPath, '.')
          console.log('[FileTree] Files staged')

          // git commit
          await window.electron.git.commit?.(folderPath, '🎉 Initial commit - Created with GlowUS')
          console.log('[FileTree] Initial commit created')

          // git push (main 브랜치로)
          await window.electron.git.push?.(folderPath, 'origin', 'main')
          console.log('[FileTree] Pushed to GitHub')

        } catch (gitErr) {
          console.warn('[FileTree] Git initialization error:', gitErr)
          // Git 에러가 나도 프로젝트 생성은 성공
        }
      }

      // 5. Neural Map에 프로젝트 연결 → 경로 설정 (순서 중요!)
      // 🔥 setLinkedProject가 먼저 호출되어야 setProjectPath에서 DB에 folder_path 저장됨
      if (newProject.id) {
        setLinkedProject(newProject.id, trimmedName)
      }
      // 🔥 folderPath가 없어도 (웹 환경) 프로젝트 이름 기반 가상 경로 설정
      const finalPath = folderPath || `/workspace/${trimmedName}`
      setProjectPath(finalPath)
      console.log('[FileTree] ✅ setProjectPath:', finalPath)

      // 7. 모달 닫기
      setIsCreatingProject(false)
      setNewProjectName('')
      setCreateGitHubRepo(false)
      setSelectedCategoryId('11111111-1111-1111-1111-111111111111')
      setIsCustomCategory(false)
      setCustomCategoryName('')

      console.log('[FileTree] Project linked to Neural Map:', {
        id: newProject.id,
        name: trimmedName,
        folderPath,
        github: githubData,
      })
    } catch (err) {
      console.error('[FileTree] Error creating project:', err)
      alert('프로젝트 생성 중 오류가 발생했습니다.')
    } finally {
      setIsCreatingProjectLoading(false)
    }
  }, [newProjectName, setProjectPath, setLinkedProject, createGitHubRepo, isGitHubConnected, categories, selectedCategoryId, isCustomCategory, customCategoryName, currentAccent])

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
    console.log('[FileTree] handleRevealInFinder called, projectPath:', projectPath)
    if (!projectPath) {
      console.warn('[FileTree] projectPath is empty!')
      return
    }

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
    console.log('[FileTree] handleCopyPath called, projectPath:', projectPath)
    if (!projectPath) {
      console.warn('[FileTree] projectPath is empty!')
      return
    }

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
    console.log('[FileTree] handleDelete called, projectPath:', projectPath)
    if (!projectPath) {
      console.warn('[FileTree] projectPath is empty!')
      return
    }

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
  // 🔥 searchQuery로 파일 필터링
  const fileTree = useMemo(() => {
    const query = searchQuery?.toLowerCase().trim() || ''
    let filteredFiles = files

    if (query) {
      // 검색어가 있으면 파일명 또는 경로에서 검색
      filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.path?.toLowerCase().includes(query)
      )
      console.log('[FileTree] Filtered by search:', query, filteredFiles.length, '/', files.length)
    }

    console.log('[FileTree] Building tree from files:', filteredFiles.length)
    return buildFileTree(filteredFiles)
  }, [files, searchQuery])

  // 파일이 변경되면 자동으로 그래프 리빌드 (최초 로드 또는 파일 추가 시)
  const prevFilesLengthRef = useRef(-1) // -1로 초기화해서 첫 렌더링에서 무조건 체크
  const isRebuildingRef = useRef(false) // 무한 루프 방지 플래그
  useEffect(() => {
    // 이미 리빌드 중이면 스킵
    if (isRebuildingRef.current) return

    // 파일이 있고 (1) 개수가 변경되었거나 (2) 그래프가 파일을 포함하지 않으면 리빌드
    const filesChanged = files.length !== prevFilesLengthRef.current
    // 그래프가 없거나, SELF 노드만 있는 경우 (파일 노드가 없음)
    const fileNodesCount = graph?.nodes?.filter(n => n.type === 'file').length || 0
    const needsGraph = !graph || (graph?.nodes?.length || 0) === 0 || (files.length > 0 && fileNodesCount === 0)
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
      const selfNode = graph.nodes.find(n => n.type === 'project')
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

    // 🆕 agents/ 하위 폴더 클릭 시 에이전트 로드
    if (folderPath.startsWith('agents/')) {
      const pathParts = folderPath.split('/')
      if (pathParts.length >= 2 && pathParts[0] === 'agents' && pathParts[1]) {
        const folderName = pathParts[1]
        console.log('[FileTree] Agent folder clicked, loading agent:', folderName)

        // Agent Builder로 로드 메시지 전송
        const channel = new BroadcastChannel('agent-builder')
        channel.postMessage({
          type: 'LOAD_AGENT',
          payload: { folderName, projectPath }
        })
        channel.close()
        // Note: Agent Builder is at /agent-builder page, not a right panel tab
      }
    }

    // 로컬 UI 상태도 업데이트 (노드가 없는 폴더를 위해)
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

  // 파일 클릭 핸들러 - MD는 MarkdownEditorPanel, 그 외는 CodePreviewPanel
  const handleFileClick = (file: NeuralFile) => {
    console.log('[FileTree] File clicked:', file.name, 'id:', file.id, 'hasContent:', !!(file as any).content)
    setSelectedFileId(file.id)

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isMdFile = ext === 'md' || ext === 'markdown' || ext === 'mdx'

    // 🆕 에이전트 폴더 내 파일 클릭 시 Agent Builder로 로드 + 노드 선택
    // agents/폴더명/* 형태의 모든 파일에 대해 동작
    if (file.path?.includes('agents/')) {
      const pathParts = file.path.split('/')
      const agentsIndex = pathParts.indexOf('agents')
      // agents 다음에 폴더명이 있어야 함 (agents/폴더명/... 구조)
      if (agentsIndex !== -1 && pathParts[agentsIndex + 1]) {
        const folderName = pathParts[agentsIndex + 1]
        const clickedFileName = file.name // 클릭한 파일명 (start.ts, end.ts 등)
        console.log('[FileTree] Agent folder file clicked:', clickedFileName, 'folder:', folderName, 'projectPath:', projectPath)

        // Agent Builder로 로드 메시지 전송 (파일명 포함하여 해당 노드 선택)
        const channel = new BroadcastChannel('agent-builder')
        channel.postMessage({
          type: 'LOAD_AGENT',
          payload: { folderName, projectPath, selectFile: clickedFileName }
        })
        channel.close()
        // Note: Agent Builder is at /agent-builder page, not a right panel tab
        return
      }
    }

    // 중복 열림 방지
    if (isMdFile) {
      if (editorOpen && editingFile?.id === file.id) {
        console.log('[FileTree] File already open in editor, skipping:', file.name)
        const node = findNodeByFileName(file.name)
        if (node) {
          setSelectedNodes([node.id])
          setFocusNodeId(node.id)
        }
        return
      }
    } else {
      if (codePreviewOpen && codePreviewFile?.id === file.id) {
        console.log('[FileTree] File already open in code preview, skipping:', file.name)
        const node = findNodeByFileName(file.name)
        if (node) {
          setSelectedNodes([node.id])
          setFocusNodeId(node.id)
        }
        return
      }
    }

    // 파일 객체에 이미 content가 있으면 그대로 사용
    const fileToOpen = (file as any).content
      ? { ...file }
      : file

    console.log('[FileTree] Opening file:', file.name, 'content length:', (fileToOpen as any).content?.length || 0)

    // MD 파일은 MarkdownEditorPanel, 그 외는 CodePreviewPanel
    // 🔥 다른 패널은 닫아서 화면 공간 확보
    if (isMdFile) {
      closeCodePreview()  // 코드 프리뷰 닫기
      openEditorWithFile(fileToOpen)
    } else {
      closeEditor()  // 마크다운 에디터 닫기
      openCodePreview(fileToOpen)
    }

    const node = findNodeByFileName(file.name)
    if (node) {
      setSelectedNodes([node.id])
      setFocusNodeId(node.id)
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
            const selfNode = graph.nodes.find(n => n.type === 'project')
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

  // 공통 폴더 로드 함수 (Electron 환경 + Web GCS 환경)
  const loadFolderFromPath = useCallback(async (dirPath: string) => {
    const electron = (window as any).electron

    // 🔄 새 로컬 폴더를 로드할 때 이전 링크된 프로젝트 정보 초기화
    // 이렇게 해야 이전 프로젝트(예: 테트리스)의 파일이 새 프로젝트에서 열리지 않음
    console.log('[FileTree] 🔄 Clearing previous linked project before loading new folder')
    clearLinkedProject()
    setSelectedNodes([])  // 이전 선택 초기화 (노드 흐림 방지)

    // Web 모드: GCS에서 파일 로드
    if (isWeb()) {
      try {
        setIsUploading(true)
        setIsExpanded(true)
        setProjectPath(dirPath)
        addToRecentProjects(dirPath)  // 최근 프로젝트에 추가
        console.log('[FileTree] 🌐 Web mode - loading from GCS:', dirPath)

        const response = await fetch(`/api/gcs/tree?projectId=${encodeURIComponent(dirPath)}`)
        if (!response.ok) {
          console.error('[FileTree] GCS tree fetch failed')
          return
        }

        const data = await response.json()
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

        const flattenGcsTree = (nodes: any[], parentPath = '') => {
          for (const node of nodes) {
            if (node.type === 'file') {
              const ext = node.name.split('.').pop()?.toLowerCase() || ''
              const type = getFileType(ext)
              neuralFiles.push({
                id: `gcs-${timestamp}-${neuralFiles.length}`,
                name: node.name,
                path: node.path,
                type: type as any,
                content: '',  // 필요시 lazy load
                size: node.size || 0,
                createdAt: new Date().toISOString(),
                mapId: mapId || '',
                url: '',
              })
            }
            if (node.children) {
              flattenGcsTree(node.children, node.path)
            }
          }
        }

        flattenGcsTree(data.tree || [])
        setFiles(neuralFiles)
        await buildGraphFromFilesAsync()
        console.log(`[FileTree] 🌐 GCS loaded ${neuralFiles.length} files, graph built`)
      } catch (error) {
        console.error('[FileTree] GCS load error:', error)
      } finally {
        setIsUploading(false)
      }
      return
    }

    // Electron 모드: 로컬 파일시스템
    if (!electron?.fs?.scanTree) return

    try {
      setIsUploading(true)
      setIsExpanded(true)
      setProjectPath(dirPath)
      addToRecentProjects(dirPath)  // 최근 프로젝트에 추가
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
        // 스키마 파일 확장자 포함: .sql, .prisma, .graphql, .gql, .yaml, .yml
        contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs', '.sql', '.prisma', '.graphql', '.gql', '.yaml', '.yml']
      })

      console.timeEnd('Batch Scan Tree')
      console.log(`[Batch Scan] ${scanResult.stats.fileCount} files, ${scanResult.stats.dirCount} dirs in ${scanResult.stats.elapsed}ms`)

      const timestamp = Date.now()
      const neuralFiles: NeuralFile[] = []

      const getFileType = (ext: string) => {
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
        const mdExts = ['md', 'markdown', 'mdx']
        // 스키마 파일 확장자 포함: sql, prisma, graphql, gql, yaml, yml
        const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
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
  }, [showHiddenFiles, mapId, setProjectPath, setFiles, buildGraphFromFilesAsync, clearLinkedProject, addToRecentProjects, setSelectedNodes])

  // ref로 최신 함수 참조 유지 (useEffect에서 사용)
  const loadFolderFromPathRef = useRef(loadFolderFromPath)
  loadFolderFromPathRef.current = loadFolderFromPath

  // 새로고침 핸들러 (loadFolderFromPath 이후 정의)
  const handleRefresh = useCallback(async () => {
    if (projectPath) {
      console.log('[FileTree] Refreshing...')
      try {
        if (isWeb()) {
          // Web 모드: GCS에서 다시 로드
          await loadFolderFromPath(projectPath)
        } else if (window.electron?.fs) {
          // Electron 모드: readDirectory 사용 (기존 API)
          const fs = window.electron.fs
          if (fs.readDirectory) {
            await fs.readDirectory(projectPath, {})
          }
          // 파일 필터링 및 처리는 loadLocalFolder에서 처리됨
          window.dispatchEvent(new CustomEvent('folder-refresh', { detail: { path: projectPath } }))
        }
      } catch (err) {
        console.error('[FileTree] Refresh failed:', err)
      }
    }
  }, [projectPath, loadFolderFromPath])

  // 폴더 업로드 - File System Access API (Real Sync)
  const handleNativeFolderUpload = async () => {
    try {
      // Electron 환경에서는 Electron API 사용
      const electronFs = window.electron?.fs
      if (isElectron() && electronFs?.selectDirectory) {
        const result = await electronFs.selectDirectory()
        if (!result) return

        // 🔥 프로젝트가 이미 선택된 상태면 확인 다이얼로그 표시
        const currentLinkedProjectId = useNeuralMapStore.getState().linkedProjectId
        const currentProjectPath = useNeuralMapStore.getState().projectPath
        const currentLinkedProjectName = useNeuralMapStore.getState().linkedProjectName

        if (currentLinkedProjectId && currentProjectPath && result.path !== currentProjectPath) {
          // 다른 폴더를 선택한 경우 - 새 프로젝트로 시작할지 물어봄
          const projectDisplayName = currentLinkedProjectName || currentProjectPath.split('/').pop() || '현재 프로젝트'
          const confirmNewProject = window.confirm(
            `현재 '${projectDisplayName}' 프로젝트에 연결되어 있습니다.\n\n` +
            `새로운 폴더로 새 프로젝트를 시작하시겠습니까?\n\n` +
            `• 확인: 새 프로젝트로 시작 (기존 연결 해제)\n` +
            `• 취소: 기존 프로젝트에 이 폴더 연결`
          )

          if (confirmNewProject) {
            // 새 프로젝트로 시작 - clearLinkedProject 포함
            console.log('[FileTree] Starting new project with folder:', result.path)
            await loadFolderFromPath(result.path)
            return
          }
          // 취소 -> 기존 프로젝트에 새 폴더 연결 (아래 로직 진행)
        }

        if (currentLinkedProjectId) {
          console.log('[FileTree] Linking folder to existing project:', currentLinkedProjectId, '->', result.path)

          // 1. DB에 folder_path 저장
          try {
            const res = await fetch(`/api/projects/${currentLinkedProjectId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folder_path: result.path })
            })
            if (res.ok) {
              console.log('[FileTree] ✅ Saved folder_path to DB')
            } else {
              console.error('[FileTree] Failed to save folder_path to DB:', res.status)
            }
          } catch (e) {
            console.error('[FileTree] Error saving folder_path:', e)
          }

          // 2. Store에 projectPath 설정 (clearLinkedProject 없이)
          useNeuralMapStore.getState().setProjectPath(result.path)
          // 3. 파일 로드는 projectPath useEffect에서 자동으로 처리됨
          return
        }

        // 프로젝트가 선택되지 않은 상태면 기존 로직 (새 로컬 프로젝트)
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
        // 스키마 파일 확장자 포함: sql, prisma, graphql, gql, yaml, yml
        const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']

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

  // 🔥 projectPath 변경 감지 → 자동 파일 로드 (Cursor/VSCode 스타일)
  // 프로젝트 페이지에서 프로젝트를 선택하면 setProjectPath가 호출되고
  // 이 useEffect가 파일을 자동으로 로드함
  const lastLoadedPathRef = useRef<string | null>(null)

  useEffect(() => {
    // 이미 같은 경로를 로드했으면 스킵 (중복 로드 방지)
    if (!projectPath || projectPath === lastLoadedPathRef.current) return

    // files가 이미 있으면 스킵 (neural-map page에서 이미 로드한 경우)
    const currentFiles = useNeuralMapStore.getState().files
    if (currentFiles && currentFiles.length > 0) {
      console.log('[FileTree] Files already loaded, skipping auto-load for:', projectPath)
      lastLoadedPathRef.current = projectPath
      return
    }

    console.log('[FileTree] 🔄 Auto-loading folder for projectPath:', projectPath)
    lastLoadedPathRef.current = projectPath

    // Electron 환경 확인
    const electron = (window as any).electron
    const isElectron = !!electron?.fs?.scanTree

    // 🔥 웹 환경: 파일 시스템 접근 불가 시에도 프로젝트 경로 설정만으로 에이전트 패널 활성화
    if (!isElectron) {
      console.log('[FileTree] 🌐 Web mode - projectPath set, building empty graph for:', projectPath)
      setIsExpanded(true)
      // 빈 파일 목록이라도 그래프 빌드 (프로젝트 노드만 표시)
      buildGraphFromFilesAsync()
      return
    }

    // 🔥 linkedProjectId가 있으면 loadFolderFromPath 대신 직접 scanTree 호출
    // (loadFolderFromPath는 clearLinkedProject를 호출해서 프로젝트 연결이 끊어지므로)
    const currentLinkedProjectId = useNeuralMapStore.getState().linkedProjectId
    if (currentLinkedProjectId) {
      console.log('[FileTree] 🔗 Loading files for linked project (without clearing):', currentLinkedProjectId)

      // 직접 scanTree 호출 (clearLinkedProject 없이)
      const scanAndLoad = async () => {
        try {
          setIsUploading(true)
          setIsExpanded(true)
          addToRecentProjects(projectPath)

          const scanResult = await electron.fs.scanTree(projectPath, {
            includeSystemFiles: showHiddenFiles,
            includeContent: true,
            contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs', '.sql', '.prisma', '.graphql', '.gql', '.yaml', '.yml']
          })

          if (scanResult?.tree) {
            const timestamp = Date.now()
            const neuralFiles: NeuralFile[] = []

            const getFileType = (ext: string): 'image' | 'markdown' | 'code' | 'text' => {
              const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
              const mdExts = ['md', 'markdown', 'mdx']
              const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
              if (imageExts.includes(ext)) return 'image'
              if (mdExts.includes(ext)) return 'markdown'
              if (codeExts.includes(ext)) return 'code'
              return 'text'
            }

            const flattenTree = (node: any) => {
              if (node.kind === 'file') {
                const ext = node.name.split('.').pop()?.toLowerCase() || ''
                neuralFiles.push({
                  id: `local-${timestamp}-${neuralFiles.length}`,
                  name: node.name,
                  path: node.relativePath,
                  type: getFileType(ext),
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
            console.log(`[FileTree] ✅ Loaded ${neuralFiles.length} files for linked project`)

            setFiles(neuralFiles)
            await buildGraphFromFilesAsync()
          }
        } catch (err) {
          console.error('[FileTree] Failed to load files for linked project:', err)
        } finally {
          setIsUploading(false)
        }
      }

      scanAndLoad()
    } else {
      // linkedProjectId가 없으면 일반 loadFolderFromPath 호출
      loadFolderFromPathRef.current(projectPath)
    }
  }, [projectPath, showHiddenFiles, mapId, setFiles, buildGraphFromFilesAsync, addToRecentProjects])

  // 🔥 세션 복원 이벤트 리스너 (새로고침 시 마지막 프로젝트 로드)
  useEffect(() => {
    const handleLoadProject = (e: CustomEvent<{ projectPath: string; projectId: string; projectName: string }>) => {
      const { projectPath: path, projectId, projectName } = e.detail
      console.log('[FileTree] 🔄 Received load-project event:', { path, projectId, projectName })

      // lastLoadedPathRef 초기화 (강제 로드)
      lastLoadedPathRef.current = null

      // linkedProject 설정
      setLinkedProject(projectId, projectName)

      // projectPath 설정 → useEffect에서 파일 로드
      setProjectPath(path)
    }

    window.addEventListener('glowus:load-project', handleLoadProject as EventListener)
    return () => window.removeEventListener('glowus:load-project', handleLoadProject as EventListener)
  }, [setLinkedProject, setProjectPath])

  // 🔥 파일 시스템 변경 감지 (Claude CLI 등 외부 도구가 파일 생성/수정 시 실시간 반영)
  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.fs?.onChanged) return
    if (!projectPath) return

    console.log('[FileTree] 👁️ Setting up file change listener for:', projectPath)

    // 파일 변경 이벤트 리스너
    const unsubscribe = electron.fs.onChanged((data: { path: string; type: 'create' | 'change' | 'delete' }) => {
      console.log('[FileTree] 📝 File changed:', data.type, data.path)

      // 변경된 파일이 현재 프로젝트 내의 파일인지 확인
      if (!data.path.startsWith(projectPath)) return

      // 파일 트리 새로고침 (debounce 적용)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }

      refreshTimeoutRef.current = setTimeout(async () => {
        console.log('[FileTree] 🔄 Refreshing file tree due to:', data.type, data.path)

        try {
          // 전체 트리 다시 스캔
          const scanResult = await electron.fs.scanTree(projectPath, {
            includeSystemFiles: showHiddenFiles,
            includeContent: true,
            contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs', '.sql', '.prisma', '.graphql', '.gql', '.yaml', '.yml']
          })

          const timestamp = Date.now()
          const neuralFiles: NeuralFile[] = []

          const getFileType = (ext: string) => {
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
            const mdExts = ['md', 'markdown', 'mdx']
            const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
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
              node.children.forEach(flattenTree)
            }
          }

          if (scanResult.tree) {
            flattenTree(scanResult.tree)
          }

          // Store 업데이트
          setFiles(neuralFiles)
          console.log('[FileTree] ✅ File tree refreshed:', neuralFiles.length, 'files')

          // 🔥 새로 생성된 파일이면 에디터에서 자동으로 열기
          if (data.type === 'create') {
            const relativePath = data.path.replace(projectPath + '/', '')
            const newFile = neuralFiles.find(f => f.path === relativePath)
            if (newFile) {
              console.log('[FileTree] 📂 Auto-opening new file:', newFile.name)
              // 파일 선택 이벤트 발생
              window.dispatchEvent(new CustomEvent('glowus:file-created', {
                detail: { file: newFile, path: data.path }
              }))
            }
          }

        } catch (err) {
          console.error('[FileTree] Failed to refresh file tree:', err)
        }
      }, 300) // 300ms debounce
    })

    return () => {
      console.log('[FileTree] 👁️ Cleaning up file change listener')
      unsubscribe()
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [projectPath, showHiddenFiles, mapId, setFiles])

  // Refresh timeout ref for debouncing
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastFileCountRef = useRef<number>(0)

  // 🔥 웹 환경: 파일 변경 감지를 위한 폴링 (5초마다)
  useEffect(() => {
    const electron = (window as any).electron
    // Electron 환경이면 워처 사용하므로 폴링 불필요
    if (electron?.fs?.onChanged) return
    // 가상 경로면 스킵
    if (!projectPath || projectPath.startsWith('/workspace/')) return

    console.log('[FileTree] 🔄 Starting polling for web environment:', projectPath)

    const pollFiles = async () => {
      try {
        const response = await fetch('/api/workspace/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectPath, includeContent: true })
        })

        if (!response.ok) return

        const result = await response.json()
        if (!result.success || !result.tree) return

        // 파일 개수가 변경되었는지 확인
        const newFileCount = result.stats.fileCount
        if (newFileCount === lastFileCountRef.current) return

        console.log('[FileTree] 📝 File count changed:', lastFileCountRef.current, '->', newFileCount)
        lastFileCountRef.current = newFileCount

        // 파일 목록 업데이트
        const timestamp = Date.now()
        const neuralFiles: NeuralFile[] = []

        const getFileType = (ext: string) => {
          const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
          const mdExts = ['md', 'markdown', 'mdx']
          const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
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
              id: `web-${timestamp}-${neuralFiles.length}`,
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
            node.children.forEach(flattenTree)
          }
        }

        flattenTree(result.tree)
        setFiles(neuralFiles)
        console.log('[FileTree] ✅ Web polling: updated', neuralFiles.length, 'files')

      } catch (err) {
        // 에러는 조용히 무시 (네트워크 문제 등)
      }
    }

    // 초기 파일 개수 설정
    const currentFiles = useNeuralMapStore.getState().files
    lastFileCountRef.current = currentFiles?.length || 0

    // 5초마다 폴링
    pollingIntervalRef.current = setInterval(pollFiles, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [projectPath, mapId, setFiles])

  // 🔥 GlowCode에서 파일 변경 이벤트 수신 (실시간 업데이트)
  useEffect(() => {
    if (!projectPath || projectPath.startsWith('/workspace/')) return

    const handleFileChanged = async (event: CustomEvent<{ path: string; type: 'create' | 'change' | 'delete' }>) => {
      const { path: filePath, type: changeType } = event.detail
      console.log('[FileTree] 🔔 File change event received:', changeType, filePath)

      // 변경된 파일이 현재 프로젝트 내의 파일인지 확인
      if (!filePath.startsWith(projectPath)) return

      // Debounce 적용하여 파일 트리 새로고침
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }

      refreshTimeoutRef.current = setTimeout(async () => {
        console.log('[FileTree] 🔄 Refreshing file tree due to GlowCode event:', changeType, filePath)

        const electron = (window as any).electron
        try {
          let scanResult: any

          if (electron?.fs?.scanTree) {
            // Electron 환경
            scanResult = await electron.fs.scanTree(projectPath, {
              showHidden: showHiddenFiles,
              includeContent: true
            })
          } else {
            // 웹 환경
            const response = await fetch('/api/workspace/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectPath, includeContent: true })
            })
            if (response.ok) {
              const result = await response.json()
              scanResult = result.tree
            }
          }

          if (!scanResult) return

          // NeuralFile 형식으로 변환
          const timestamp = Date.now()
          const neuralFiles: NeuralFile[] = []

          const getFileType = (ext: string) => {
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']
            const mdExts = ['md', 'markdown', 'mdx']
            const codeExts = ['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'prisma', 'graphql', 'gql', 'yaml', 'yml']
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
                id: `event-${timestamp}-${neuralFiles.length}`,
                name: node.name,
                path: node.relativePath || node.path?.replace(projectPath + '/', '') || node.name,
                type: type as any,
                content: node.content || '',
                size: node.size || 0,
                createdAt: new Date().toISOString(),
                mapId: mapId || '',
                url: '',
              })
            }
            if (node.children) {
              node.children.forEach(flattenTree)
            }
          }

          flattenTree(scanResult)
          setFiles(neuralFiles)
          console.log('[FileTree] ✅ Updated', neuralFiles.length, 'files from GlowCode event')

          // 파일 생성인 경우 자동 열기 이벤트 발생
          if (changeType === 'create') {
            const relativePath = filePath.replace(projectPath + '/', '')
            window.dispatchEvent(new CustomEvent('glowus:file-created', {
              detail: { path: filePath, relativePath }
            }))
          }

        } catch (err) {
          console.error('[FileTree] Error refreshing after GlowCode event:', err)
        }
      }, 200) // 200ms debounce (더 빠른 반응)
    }

    window.addEventListener('glowus:file-changed', handleFileChanged as unknown as EventListener)

    return () => {
      window.removeEventListener('glowus:file-changed', handleFileChanged as unknown as EventListener)
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [projectPath, showHiddenFiles, mapId, setFiles])

  // Electron 메뉴 이벤트 리스너
  useEffect(() => {
    const electron = (window as any).electron
    if (!electron?.onMenuEvent) return

    // 폴더 선택 완료 이벤트 - ref로 최신 함수 참조
    const unsubFolderSelected = electron.onMenuEvent('menu:folder-selected', async (_event: any, dirInfo: { name: string, path: string }) => {
      console.log('[Menu] Folder selected:', dirInfo)
      if (!dirInfo?.path) return

      // 🔥 프로젝트가 이미 선택된 상태면 folder_path를 DB에 저장하고 파일만 로드
      const currentLinkedProjectId = useNeuralMapStore.getState().linkedProjectId
      if (currentLinkedProjectId) {
        console.log('[Menu] Linking folder to existing project:', currentLinkedProjectId, '->', dirInfo.path)

        // 1. DB에 folder_path 저장
        try {
          const res = await fetch(`/api/projects/${currentLinkedProjectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_path: dirInfo.path })
          })
          if (res.ok) {
            console.log('[Menu] ✅ Saved folder_path to DB')
          } else {
            console.error('[Menu] Failed to save folder_path to DB:', res.status)
          }
        } catch (e) {
          console.error('[Menu] Error saving folder_path:', e)
        }

        // 2. Store에 projectPath 설정 (clearLinkedProject 없이)
        useNeuralMapStore.getState().setProjectPath(dirInfo.path)

        // 3. 파일 로드는 projectPath useEffect에서 자동으로 처리됨
        return
      }

      // 프로젝트가 선택되지 않은 상태면 기존 로직 (새 로컬 프로젝트)
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

    const unsubNewProject = electron.onMenuEvent('menu:new-project', () => {
      console.log('[Menu] New Project triggered')
      setIsCreatingProject(true)
      setNewProjectName('')
      setTimeout(() => projectNameInputRef.current?.focus(), 100)
    })

    const unsubOpenProject = electron.onMenuEvent('menu:open-project', async () => {
      console.log('[Menu] Open Project triggered')
      setIsOpenProjectModal(true)
      setIsLoadingProjects(true)
      try {
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjectList(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      } finally {
        setIsLoadingProjects(false)
      }
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
      unsubNewProject?.()
      unsubOpenProject?.()
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

                {/* New Project */}
                <button
                  onClick={() => {
                    setIsCreatingProject(true)
                    setNewProjectName('')
                    setShowFileMenu(false)
                    setTimeout(() => projectNameInputRef.current?.focus(), 100)
                  }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>New Project...</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⇧⌘N</span>
                </button>

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

                {/* 최근 프로젝트 */}
                {recentProjects.length > 0 && (
                  <>
                    <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />
                    <div className={cn(
                      'px-4 py-1.5 text-[11px] font-medium',
                      isDark ? 'text-[#6e6e6e]' : 'text-zinc-400'
                    )}>
                      최근 프로젝트
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {recentProjects.slice(0, 5).map((project) => (
                        <button
                          key={project.path}
                          onClick={() => {
                            loadFolderFromPath(project.path)
                            setShowFileMenu(false)
                          }}
                          className={cn(
                            'w-full px-4 py-1.5 text-left flex items-center gap-2 text-[13px]',
                            isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                          )}
                        >
                          <FolderOpen className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                          <span className="truncate" title={project.path}>{project.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Save Project */}
                <button
                  onClick={() => {
                    handleSaveProject()
                    setShowFileMenu(false)
                  }}
                  disabled={isSavingProject || !projectPath}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700',
                    (isSavingProject || !projectPath) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>{isSavingProject ? '저장 중...' : 'Save Project'}</span>
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
      <div className="flex-1 overflow-y-auto flex flex-col">
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
                  const selfNode = graph.nodes.find(n => n.type === 'project')
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
        ) : null}

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

        {/* 🤖 Agents 폴더 트리 - 비활성화 (에이전트가 프로젝트 내 파일 시스템에 저장되므로 일반 파일 트리에서 표시) */}
        {/* agents 폴더는 이제 프로젝트별로 저장되어 파일 트리에 자동으로 표시됨 */}

        {/* 파일 트리 목록 - 프로젝트가 있을 때만 */}
        {hasProject ? (
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
                  'py-4 px-4 text-xs text-center',
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                )}>
                  빈 폴더입니다
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
        ) : (
          /* 프로젝트가 없을 때 - 프로젝트 생성 버튼 표시 */
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <button
              onClick={() => {
                setIsCreatingProject(true)
                setNewProjectName('')
                setTimeout(() => projectNameInputRef.current?.focus(), 100)
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110 hover:scale-105 mb-4"
              style={{ backgroundColor: currentAccent.color }}
            >
              <Plus className="w-4 h-4" />
              프로젝트 생성
            </button>
            <p className={cn(
              'text-xs text-center',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}>
              새 프로젝트를 생성하거나<br />기존 폴더를 열어보세요
            </p>
          </div>
        )}
      </div>

      {/* 하단 패널들 (VS Code 스타일) */}
      <div className={cn('border-t', isDark ? 'border-[#3c3c3c]' : 'border-[#d4d4d4]')}>
        {/* 🧠 노트 섹션 - Obsidian 스타일 (노드 = 파일) */}
        <CollapsibleSection title="노트" isDark={isDark} defaultClosed={false}>
          {graph?.nodes && graph.nodes.length > 0 ? (
            <div className="max-h-[200px] overflow-y-auto">
              {graph.nodes
                .filter(n => n.type !== 'project' && n.type !== 'self') // 프로젝트/셀프 노드 제외
                .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
                .map((node) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      // 노드 선택 및 포커스
                      setSelectedNodes([node.id])
                      setFocusNodeId(node.id)
                      focusOnNode(node.id)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors',
                      isDark
                        ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
                        : 'hover:bg-[#e8e8e8] text-[#3b3b3b]'
                    )}
                    title={node.summary || node.title}
                  >
                    {/* 노드 타입별 아이콘 */}
                    {node.type === 'concept' && <CircleDot className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
                    {node.type === 'identity' && <Brain className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                    {node.type === 'rule' && <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    {node.type === 'decision' && <FileCode className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                    {node.type === 'playbook' && <Files className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                    {node.type === 'preference' && <Palette className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />}
                    {node.type === 'memory' && <Bot className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                    {!['concept', 'identity', 'rule', 'decision', 'playbook', 'preference', 'memory'].includes(node.type) && (
                      <VscMarkdown className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    )}
                    <span className="truncate flex-1">{node.title || 'Untitled'}</span>
                    {/* 태그 카운트 뱃지 */}
                    {node.tags && node.tags.length > 0 && (
                      <span className={cn(
                        'text-[10px] px-1 rounded',
                        isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                      )}>
                        {node.tags.length}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          ) : (
            <div className={cn('py-2 px-4 text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              노트가 없습니다. 캔버스에서 노드를 추가하세요.
            </div>
          )}
        </CollapsibleSection>

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

              {/* 카테고리 선택 */}
              <div className="mt-4">
                <p className={cn(
                  'text-xs mb-2 font-medium',
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                )}>
                  카테고리
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => {
                    const IconComponent = categoryIconMap[cat.icon] || Folder
                    const isSelected = !isCustomCategory && selectedCategoryId === cat.id
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategoryId(cat.id)
                          setIsCustomCategory(false)
                        }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border-2',
                          isSelected
                            ? 'border-current'
                            : isDark
                              ? 'border-transparent bg-[#2d2d2d] hover:bg-[#3d3d3d] text-zinc-300'
                              : 'border-transparent bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        )}
                        style={{
                          borderColor: isSelected ? cat.color : 'transparent',
                          color: isSelected ? cat.color : undefined,
                          backgroundColor: isSelected ? `${cat.color}15` : undefined,
                        }}
                      >
                        <IconComponent className="w-4 h-4" />
                        {cat.name}
                      </button>
                    )
                  })}
                  {/* 직접 입력 버튼 */}
                  <button
                    onClick={() => setIsCustomCategory(true)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 col-span-2',
                      isCustomCategory
                        ? 'border-current'
                        : isDark
                          ? 'border-transparent bg-[#2d2d2d] hover:bg-[#3d3d3d] text-zinc-300'
                          : 'border-transparent bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                    )}
                    style={{
                      borderColor: isCustomCategory ? currentAccent.color : 'transparent',
                      color: isCustomCategory ? currentAccent.color : undefined,
                      backgroundColor: isCustomCategory ? `${currentAccent.color}15` : undefined,
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    직접 입력
                  </button>
                </div>
                {/* 직접 입력 필드 */}
                {isCustomCategory && (
                  <input
                    type="text"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder="카테고리 이름 입력"
                    className={cn(
                      'w-full mt-2 px-3 py-2 rounded-lg text-sm outline-none transition-colors border-2',
                      isDark
                        ? 'bg-[#2d2d2d] border-[#3c3c3c] text-white placeholder:text-zinc-500'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                    )}
                    style={{
                      borderColor: customCategoryName.trim() ? currentAccent.color : undefined
                    }}
                    autoFocus
                  />
                )}
              </div>

              {/* GitHub 연동은 Git 탭에서 나중에 가능 */}
              <p className={cn(
                'text-xs mt-4 flex items-center gap-2',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}>
                <GitBranch className="w-3.5 h-3.5" />
                GitHub 연동은 프로젝트 생성 후 Git 탭에서 할 수 있습니다.
              </p>

              <div className="flex gap-3 mt-4">
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

      {/* 프로젝트 열기 모달 */}
      <AnimatePresence>
        {isOpenProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
            onClick={() => setIsOpenProjectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-[480px] max-h-[600px] rounded-2xl shadow-2xl overflow-hidden flex flex-col',
                isDark ? 'bg-[#1e1e1e]' : 'bg-white'
              )}
            >
              {/* 헤더 */}
              <div className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                isDark ? 'border-zinc-700' : 'border-zinc-200'
              )}>
                <h2 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  프로젝트 열기
                </h2>
                <button
                  onClick={() => setIsOpenProjectModal(false)}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors',
                    isDark ? 'hover:bg-zinc-700 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 프로젝트 목록 */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                  </div>
                ) : projectList.length === 0 ? (
                  <div className={cn(
                    'text-center py-12',
                    isDark ? 'text-zinc-500' : 'text-zinc-400'
                  )}>
                    <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>프로젝트가 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectList.map((project) => (
                      <button
                        key={project.id}
                        onClick={async () => {
                          // 프로젝트 선택 시 Neural Map에 연결
                          setLinkedProject(project.id, project.name)
                          if (project.folder_path) {
                            // 🔥 setProjectPath만 호출 - useEffect에서 파일 로드 자동 처리됨
                            // loadFolderFromPath를 호출하면 clearLinkedProject()가 실행되어 연결이 끊어짐
                            useNeuralMapStore.getState().setProjectPath(project.folder_path)
                          }
                          setIsOpenProjectModal(false)
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
                          isDark
                            ? 'hover:bg-zinc-800 active:bg-zinc-700'
                            : 'hover:bg-zinc-50 active:bg-zinc-100'
                        )}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${currentAccent.color}20` }}
                        >
                          <Folder className="w-5 h-5" style={{ color: currentAccent.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-semibold truncate',
                            isDark ? 'text-white' : 'text-zinc-900'
                          )}>
                            {project.name}
                          </p>
                          {project.folder_path && (
                            <p className={cn(
                              'text-xs truncate',
                              isDark ? 'text-zinc-500' : 'text-zinc-400'
                            )}>
                              {project.folder_path}
                            </p>
                          )}
                        </div>
                        {project.status === 'active' && (
                          <span
                            className="px-2 py-0.5 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${currentAccent.color}20`,
                              color: currentAccent.color
                            }}
                          >
                            진행중
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
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
                {/* agents 폴더 특별 아이콘 */}
                {node.name === 'agents' || nodePath.startsWith('agents/') ? (
                  <Bot className="w-4 h-4 text-violet-500 flex-shrink-0" />
                ) : (
                  <FolderClosed className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
                <span className="truncate">{node.name}</span>
                {/* agents 하위 폴더에 스킬 배지 표시 */}
                {nodePath.startsWith('agents/') && !nodePath.includes('/', 7) && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full">
                    Skill
                  </span>
                )}
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

// 🤖 에이전트 폴더 트리 컴포넌트
function AgentsFolderTree({
  agents,
  isDark,
  isLoading,
  onRefresh,
  onAgentClick,
}: {
  agents: Array<{ folderName: string; name: string; description: string; nodeCount: number; edgeCount: number }>
  isDark: boolean
  isLoading: boolean
  onRefresh: () => void
  onAgentClick: (folderName: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="py-1">
      {/* 폴더 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center gap-1 py-[3px] px-2 select-none group',
          isDark
            ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
            : 'hover:bg-[#e8e8e8] text-[#3d3d3d]'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0 text-inherit" />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0 text-inherit" />
        )}
        <Bot className={cn('w-4 h-4 flex-shrink-0', isDark ? 'text-violet-400' : 'text-violet-500')} />
        <span className="text-[13px] font-medium flex-1 text-left">agents</span>
        <span className={cn('text-[11px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          {agents.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRefresh()
          }}
          className={cn(
            'p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'
          )}
        >
          <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
        </button>
      </button>

      {/* 에이전트 폴더 목록 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {agents.map((agent) => (
              <button
                key={agent.folderName}
                onClick={() => onAgentClick(agent.folderName)}
                className={cn(
                  'w-full flex items-center gap-1.5 py-[3px] pr-2 select-none',
                  isDark
                    ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
                    : 'hover:bg-[#e8e8e8] text-[#3d3d3d]'
                )}
                style={{ paddingLeft: '28px' }}
              >
                <FolderClosed className={cn('w-4 h-4 flex-shrink-0', isDark ? 'text-violet-400' : 'text-violet-500')} />
                <span className="text-[13px] truncate flex-1 text-left">{agent.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
