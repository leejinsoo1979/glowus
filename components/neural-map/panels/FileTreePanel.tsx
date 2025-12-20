'use client'

import { useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useNeuralMapApi } from '@/lib/neural-map/useNeuralMapApi'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { parseWikiLinks, extractTitle } from '@/lib/neural-map/markdown-parser'
import type { NeuralFile } from '@/lib/neural-map/types'
import {
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  Image,
  Film,
  FileCode,
  File,
  Trash2,
  Loader2,
  MoreHorizontal,
  FilePlus,
  FolderPlus,
  RefreshCw,
  FolderClosed,
  Upload,
  Sparkles,
  PenLine,
  ArrowUpDown,
  ChevronsDownUp,
  X,
  Check,
} from 'lucide-react'

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

// VS Code 스타일 파일 아이콘
function FileIcon({ type, name }: { type: string; name?: string }) {
  const ext = name?.split('.').pop()?.toLowerCase()

  // 확장자별 아이콘 매핑
  if (ext === 'pdf') return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
  if (ext === 'md' || ext === 'markdown') return <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
  if (ext === 'txt') return <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <Image className="w-4 h-4 text-emerald-400 flex-shrink-0" />
  }
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) {
    return <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
  }

  // 타입별 폴백
  switch (type) {
    case 'pdf': return <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
    case 'image': return <Image className="w-4 h-4 text-emerald-400 flex-shrink-0" />
    case 'video': return <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />
    case 'markdown': return <FileCode className="w-4 h-4 text-blue-400 flex-shrink-0" />
    default: return <File className="w-4 h-4 text-zinc-400 flex-shrink-0" />
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

// 파일 목록을 트리 구조로 변환
function buildFileTree(files: NeuralFile[]): TreeNode[] {
  const root: TreeNode[] = []

  // path가 없는 파일들 (단일 파일 업로드)
  const standaloneFiles = files.filter(f => !f.path)

  // path가 있는 파일들 (폴더 업로드)
  const pathFiles = files.filter(f => f.path)

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
  pathFiles.forEach(file => {
    const parts = file.path!.split('/')
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

  return sortTree(root)
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // Store
  const files = useNeuralMapStore((s) => s.files)
  const addFile = useNeuralMapStore((s) => s.addFile)
  const removeFile = useNeuralMapStore((s) => s.removeFile)
  const graph = useNeuralMapStore((s) => s.graph)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const openEditor = useNeuralMapStore((s) => s.openEditor)

  // API
  const { uploadFile, deleteFile, createNode, createEdge, analyzeFile } = useNeuralMapApi(mapId)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // 사용자 테마
  const { accentColor: userAccentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === userAccentColor) || accentColors[0]

  const mapTitle = graph?.title || 'Untitled Map'

  // 파일 트리 구조 생성
  const fileTree = buildFileTree(files)

  // 폴더 펼침/접기 토글
  const toggleFolder = (folderPath: string) => {
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

  // 파일 클릭 핸들러
  const handleFileClick = (file: NeuralFile) => {
    setSelectedFileId(file.id)
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
    const result = await uploadFile(file, path)
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
      ;(async () => {
        try {
          const nodeType = result.type === 'pdf' ? 'doc' :
                          result.type === 'markdown' ? 'doc' :
                          result.type === 'image' ? 'memory' :
                          result.type === 'video' ? 'memory' : 'doc'

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

  // 폴더 업로드
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0 || !mapId) return

    // 지원되는 파일만 필터링 (webkitRelativePath 포함)
    const supportedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm', '.mov', '.avi', '.md', '.markdown', '.txt']
    const validFiles = Array.from(selectedFiles)
      .filter(file => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        return supportedExtensions.includes(ext)
      })
      .map(file => ({
        file,
        // webkitRelativePath: "FolderName/subfolder/file.pdf"
        path: (file as any).webkitRelativePath || file.name
      }))

    if (validFiles.length === 0) {
      alert('지원되는 파일이 없습니다. (PDF, 이미지, 비디오, 마크다운, 텍스트)')
      return
    }

    setIsUploading(true)
    setUploadingCount(validFiles.length)
    setIsExpanded(true)

    try {
      // 1. 폴더 구조 추출 및 폴더 노드 생성
      const folderPaths = new Set<string>()
      validFiles.forEach(({ path }) => {
        const parts = path.split('/')
        // 마지막(파일)을 제외한 폴더 경로들
        for (let i = 1; i < parts.length; i++) {
          folderPaths.add(parts.slice(0, i).join('/'))
        }
      })

      // 폴더 노드 생성 (계층 순서대로)
      const sortedFolders = Array.from(folderPaths).sort((a, b) => a.split('/').length - b.split('/').length)
      const folderNodeMap = new Map<string, string>() // path -> nodeId

      // Self 노드 찾기
      const selfNode = graph?.nodes.find(n => n.type === 'self')

      for (const folderPath of sortedFolders) {
        const parts = folderPath.split('/')
        const folderName = parts[parts.length - 1]
        const parentPath = parts.slice(0, -1).join('/')

        try {
          const folderNode = await createNode({
            type: 'project' as any, // 폴더는 project 타입으로
            title: folderName,
            summary: `📁 ${folderPath}`,
            tags: ['folder', 'directory'],
            importance: 6,
          })

          if (folderNode) {
            folderNodeMap.set(folderPath, folderNode.id)

            // 부모 폴더 또는 Self 노드와 연결
            const parentNodeId = parentPath ? folderNodeMap.get(parentPath) : selfNode?.id
            if (parentNodeId) {
              await createEdge({
                sourceId: parentNodeId,
                targetId: folderNode.id,
                type: 'parent_child',
                weight: 0.8,
              })
            }
          }
        } catch (err) {
          console.error('폴더 노드 생성 실패:', folderPath, err)
        }
      }

      // 2. 파일 업로드 및 폴더에 연결
      let lastResult = null
      for (let i = 0; i < validFiles.length; i++) {
        setUploadingCount(validFiles.length - i)
        const { file, path } = validFiles[i]

        // 파일이 속한 폴더 경로
        const pathParts = path.split('/')
        const parentFolderPath = pathParts.slice(0, -1).join('/')

        const result = await processFileUpload(file, path)

        // 파일 노드를 폴더 노드에 연결 (processFileUpload 내부에서 self와 연결되므로 추가 연결)
        if (result && parentFolderPath && folderNodeMap.has(parentFolderPath)) {
          const folderNodeId = folderNodeMap.get(parentFolderPath)!

          // 최근 생성된 노드 찾기 (파일명으로)
          const fileNode = graph?.nodes.find(n => n.title === result.name || n.title === file.name)
          if (fileNode) {
            try {
              await createEdge({
                sourceId: folderNodeId,
                targetId: fileNode.id,
                type: 'parent_child',
                weight: 0.6,
              })
            } catch (err) {
              // 이미 연결되어 있을 수 있음
            }
          }
        }

        if (result) lastResult = result
      }

      if (lastResult) {
        setSelectedFileId(lastResult.id)
      }

      console.log(`폴더 업로드 완료: ${sortedFolders.length}개 폴더, ${validFiles.length}개 파일`)
    } catch (error) {
      console.error('Folder upload error:', error)
    } finally {
      setIsUploading(false)
      setUploadingCount(0)
      if (folderInputRef.current) {
        folderInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={cn('h-full flex flex-col text-[13px]', isDark ? 'bg-[#1e1e1e]' : 'bg-[#f3f3f3]')}>
      {/* Obsidian 스타일 상단 툴바 */}
      <div className={cn(
        'h-[40px] flex items-center justify-center gap-1 px-2 border-b select-none',
        isDark ? 'border-[#3c3c3c] text-[#999999]' : 'border-[#d4d4d4] text-[#666666]'
      )}>
        {isUploading || isAnalyzing ? (
          <div className="flex items-center gap-2 px-3">
            {isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-pulse text-amber-400" />
                <span className="text-[11px] text-amber-400">AI 분석중...</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[11px]">업로드 중... ({uploadingCount})</span>
              </>
            )}
          </div>
        ) : (
          <>
            {/* 새 노트 */}
            <button
              onClick={openEditor}
              disabled={!mapId}
              className={cn(
                'p-2 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#e8e8e8]',
                !mapId && 'opacity-50 cursor-not-allowed'
              )}
              title="New note"
            >
              <PenLine className="w-[18px] h-[18px]" />
            </button>

            {/* 새 폴더 */}
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={!mapId}
              className={cn(
                'p-2 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#e8e8e8]',
                !mapId && 'opacity-50 cursor-not-allowed'
              )}
              title="New folder"
            >
              <FolderPlus className="w-[18px] h-[18px]" />
            </button>

            {/* 정렬 */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={cn(
                  'p-2 rounded transition-colors',
                  isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#e8e8e8]',
                  showSortMenu && (isDark ? 'bg-[#3c3c3c]' : 'bg-[#e8e8e8]')
                )}
                title="Sort"
              >
                <ArrowUpDown className="w-[18px] h-[18px]" />
              </button>

              {/* 정렬 드롭다운 메뉴 */}
              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      'absolute top-full left-0 mt-1 py-1 rounded-md shadow-lg z-50 min-w-[200px]',
                      isDark ? 'bg-[#2d2d2d] border border-[#454545]' : 'bg-white border border-[#d4d4d4]'
                    )}
                  >
                    {SORT_OPTIONS.map((option, idx) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortOption(option.value)
                          setShowSortMenu(false)
                        }}
                        className={cn(
                          'w-full px-3 py-1.5 text-left text-[13px] flex items-center gap-2 transition-colors',
                          isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#f0f0f0]',
                          // 구분선 추가 (2개씩 그룹)
                          (idx === 2 || idx === 4) && (isDark ? 'border-t border-[#454545] mt-1 pt-2' : 'border-t border-[#e0e0e0] mt-1 pt-2')
                        )}
                      >
                        {sortOption === option.value ? (
                          <Check className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <span className="w-4" />
                        )}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 모두 접기 */}
            <button
              onClick={collapseAll}
              className={cn(
                'p-2 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#e8e8e8]'
              )}
              title="Collapse all"
            >
              <ChevronsDownUp className="w-[18px] h-[18px]" />
            </button>

            {/* 닫기 (패널 접기) */}
            <button
              onClick={() => setIsExpanded(false)}
              className={cn(
                'p-2 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-[#e8e8e8]'
              )}
              title="Close"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </>
        )}
      </div>

      {/* 파일 트리 영역 */}
      <div className="flex-1 overflow-y-auto">
        {/* 루트 폴더 (맵 이름) */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
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
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.mov,.avi,.md,.markdown,.txt"
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
        onChange={handleFolderUpload}
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
  findNodeByFileName
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
                    ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
                    : 'hover:bg-[#e8e8e8] text-[#3b3b3b]'
                )}
                style={{ paddingLeft }}
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                )}
                <FolderClosed className="w-4 h-4 text-amber-500 flex-shrink-0" />
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
                  ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
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
