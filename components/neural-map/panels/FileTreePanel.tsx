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

// 정렬 옵션 타입
type SortOption = 'name-asc' | 'name-desc' | 'modified-new' | 'modified-old' | 'created-new' | 'created-old'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'File name (A to Z)' },
  { value: 'name-desc', label: 'File name (Z to A)' },
  { value: 'modified-new', label: 'Modified time (new to old)' },
  { value: 'modified-old', label: 'Modified time (old to new)' },
  { value: 'created-new', label: 'Created time (new to old)' },
  { value: 'created-old', label: 'Created time (old to new)' },
]

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
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showHiddenFiles, setShowHiddenFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)

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

  // API
  const { uploadFile, deleteFile, createNode, createEdge, analyzeFile, removeNode } = useNeuralMapApi(mapId)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 사용자 테마
  const { accentColor: userAccentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === userAccentColor) || accentColors[0]

  const mapTitle = graph?.title || 'Untitled Map'

  // 파일 트리 구조 생성 - useMemo로 메모이제이션하여 무한 루프 방지
  const fileTree = useMemo(() => {
    console.log('[FileTree] Building tree from files:', files.length, files)
    return buildFileTree(files)
  }, [files])

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

  // 모든 폴더 접기
  const collapseAll = () => {
    setExpandedFolders(new Set())
    setIsExpanded(false)
  }

  // 정렬 메뉴 외부 클릭 감지
  const handleClickOutside = (e: MouseEvent) => {
    if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
      setShowSortMenu(false)
    }
  }

  // 외부 클릭 이벤트 등록
  // useEffect로 처리 - showSortMenu 변경 시 이벤트 등록/해제
  if (typeof window !== 'undefined' && showSortMenu) {
    setTimeout(() => {
      const handler = (e: Event) => {
        if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
          setShowSortMenu(false)
        }
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, 0)
  }

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

  // 폴더 업로드 - File System Access API (Real Sync)
  const handleNativeFolderUpload = async () => {
    try {
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

      // 폴더 스캔 (재귀적)
      console.log('Scanning directory:', dirHandle.name)
      const { files: scannedFiles, handles } = await FileSystemManager.readDirectory(dirHandle, '', { includeSystemFiles: showHiddenFiles })
      console.log(`Found ${scannedFiles.length} files`)

      if (scannedFiles.length === 0) {
        alert('업로드 가능한 파일이 없습니다.')
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

    // 폴더 선택 완료 이벤트 - Electron main에서 직접 다이얼로그 열고 결과 전송
    // 폴더 선택 완료 이벤트 - Electron main에서 직접 다이얼로그 열고 결과 전송
    const unsubFolderSelected = electron.onMenuEvent('menu:folder-selected', async (_event: any, dirInfo: { name: string, path: string }) => {
      console.log('[Menu] Folder selected:', dirInfo)

      if (!dirInfo?.path) return

      try {
        setIsUploading(true)
        setIsExpanded(true)

        // 🚀 Batch Scan: Single IPC call for entire tree (includes file content)
        console.time('Batch Scan Tree')

        const scanResult = await electron.fs.scanTree(dirInfo.path, {
          includeSystemFiles: showHiddenFiles,
          includeContent: true,  // 파일 내용도 함께 로드
          contentExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html', '.py', '.java', '.go', '.rs']
        })

        console.timeEnd('Batch Scan Tree')
        console.log(`[Batch Scan] ${scanResult.stats.fileCount} files, ${scanResult.stats.dirCount} dirs in ${scanResult.stats.elapsed}ms`)

        const timestamp = Date.now()
        const neuralFiles: NeuralFile[] = []

        // Flatten tree to file list
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

        // 즉시 파일 설정 및 그래프 빌드
        setFiles(neuralFiles)
        buildGraphFromFilesAsync()
        setIsUploading(false)

      } catch (err) {
        console.error('Failed to load folder:', err)
        alert('폴더 로딩 실패: ' + (err as Error).message)
        setIsUploading(false)
      }
    })

    const unsubNewNote = electron.onMenuEvent('menu:new-note', () => {
      console.log('[Menu] New Note triggered')
      openEditor()
    })

    const unsubNewFile = electron.onMenuEvent('menu:new-file', () => {
      console.log('[Menu] New File triggered')
      fileInputRef.current?.click()
    })

    return () => {
      unsubFolderSelected?.()
      unsubNewNote?.()
      unsubNewFile?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])




  return (
    <div className={cn('h-full flex flex-col text-[13px]', isDark ? 'bg-zinc-900' : 'bg-[#f3f3f3]')}>
      {/* File 드롭다운 메뉴 바 */}
      <div
        className={cn(
          'h-[36px] flex items-center px-2 border-b',
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

          {/* File 드롭다운 메뉴 */}
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
                  disabled={!mapId}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700',
                    !mapId && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>New Note</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘ N</span>
                </button>

                {/* New File */}
                <button
                  onClick={() => { fileInputRef.current?.click(); setShowFileMenu(false) }}
                  disabled={!mapId}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700',
                    !mapId && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>New File...</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌥ ⌘ N</span>
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
                  disabled={!mapId}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700',
                    !mapId && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>Open Folder...</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘ O</span>
                </button>

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Visualize */}
                <button
                  onClick={() => { buildGraphFromFilesAsync(); setShowFileMenu(false) }}
                  disabled={files.length === 0}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center justify-between',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700',
                    files.length === 0 && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span>Visualize Files</span>
                  <span className={cn('text-[11px]', isDark ? 'text-[#6e6e6e]' : 'text-zinc-400')}>⌘ V</span>
                </button>

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Sort submenu */}
                <div className="relative group">
                  <button
                    className={cn(
                      'w-full px-4 py-2 text-left flex items-center justify-between',
                      isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                    )}
                  >
                    <span>Sort By</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {/* Sort submenu */}
                  <div className={cn(
                    'absolute left-full top-0 ml-1 py-1 rounded-md shadow-xl min-w-[200px] hidden group-hover:block',
                    isDark ? 'bg-[#252526] border border-[#454545]' : 'bg-white border border-[#d4d4d4]'
                  )}>
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => { setSortOption(option.value); setShowFileMenu(false) }}
                        className={cn(
                          'w-full px-4 py-2 text-left flex items-center gap-2',
                          isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                        )}
                      >
                        {sortOption === option.value ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <span className="w-4" />
                        )}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Collapse All */}
                <button
                  onClick={() => { collapseAll(); setShowFileMenu(false) }}
                  className={cn(
                    'w-full px-4 py-2 text-left',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  <span>Collapse All</span>
                </button>

                {/* 구분선 */}
                <div className={cn('my-1 h-px', isDark ? 'bg-[#454545]' : 'bg-[#e0e0e0]')} />

                {/* Show Hidden Files */}
                <button
                  onClick={() => { setShowHiddenFiles(!showHiddenFiles); setShowFileMenu(false) }}
                  className={cn(
                    'w-full px-4 py-2 text-left flex items-center gap-2',
                    isDark ? 'hover:bg-[#094771] text-[#cccccc]' : 'hover:bg-blue-50 text-zinc-700'
                  )}
                >
                  {showHiddenFiles ? <Check className="w-4 h-4" /> : <span className="w-4" />}
                  <span>Show Hidden Files</span>
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
        {/* 루트 폴더 (맵 이름) */}
        <div
          onClick={() => {
            const newExpanded = !isExpanded
            setIsExpanded(newExpanded)

            // Sync with graph: Toggle self node
            if (graph?.nodes) {
              const selfNode = graph.nodes.find(n => n.type === 'self')
              if (selfNode) {
                // To match UI state (if UI expands, Graph expands)
                // We use setExpandedNodes to force sync or just toggle if states are aligned.
                // Simpler: Just toggle it. Or better: Ensure state matches `newExpanded`
                if (newExpanded) {
                  // If opening, ensure self is in expandedNodeIds
                  if (!expandedNodeIds.has(selfNode.id)) {
                    toggleNodeExpansion(selfNode.id)
                  }
                } else {
                  // If closing, ensure self is removed
                  if (expandedNodeIds.has(selfNode.id)) {
                    toggleNodeExpansion(selfNode.id)
                  }
                }
              }
            }
          }}
          className={cn(
            'flex items-center gap-1 py-[3px] px-2 cursor-pointer select-none',
            isDark
              ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
              : 'hover:bg-[#e8e8e8] text-[#3b3b3b]',
            'font-semibold text-[11px] uppercase tracking-wide'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate">{mapTitle}</span>
        </div>

        {/* 파일 트리 목록 */}
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
                  'py-4 px-6 text-center',
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                )}>
                  <p className="text-xs">파일이 없습니다</p>
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
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
  onOpenCodePreview
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
