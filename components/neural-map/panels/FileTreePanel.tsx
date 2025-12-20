'use client'

import { useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useNeuralMapApi } from '@/lib/neural-map/useNeuralMapApi'
import { useThemeStore, accentColors } from '@/stores/themeStore'
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
  Plus,
  RefreshCw,
  FolderClosed,
  Upload,
} from 'lucide-react'

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

export function FileTreePanel({ mapId }: FileTreePanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Store
  const files = useNeuralMapStore((s) => s.files)
  const addFile = useNeuralMapStore((s) => s.addFile)
  const removeFile = useNeuralMapStore((s) => s.removeFile)
  const graph = useNeuralMapStore((s) => s.graph)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)

  // API
  const { uploadFile, deleteFile, createNode, createEdge } = useNeuralMapApi(mapId)

  // 사용자 테마
  const { accentColor: userAccentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === userAccentColor) || accentColors[0]

  const mapTitle = graph?.title || 'Untitled Map'

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

  // 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile || !mapId) return

    setIsUploading(true)
    try {
      const result = await uploadFile(selectedFile)
      if (result) {
        addFile(result)

        const nodeType = result.type === 'pdf' ? 'doc' :
                        result.type === 'markdown' ? 'doc' :
                        result.type === 'image' ? 'memory' :
                        result.type === 'video' ? 'memory' : 'doc'

        const newNode = await createNode({
          type: nodeType as any,
          title: result.name,
          summary: `${result.type} 파일`,
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
        }
      }
    } catch (error) {
      console.error('File upload error:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className={cn('h-full flex flex-col text-[13px]', isDark ? 'bg-[#1e1e1e]' : 'bg-[#f3f3f3]')}>
      {/* VS Code 스타일 헤더 - EXPLORER */}
      <div className={cn(
        'h-[35px] flex items-center justify-between px-3 select-none',
        isDark ? 'text-[#bbbbbb]' : 'text-[#616161]'
      )}>
        <span className="text-[11px] font-semibold tracking-wider uppercase">탐색기</span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !mapId}
            className={cn(
              'p-1 rounded hover:bg-white/10 transition-colors',
              (isUploading || !mapId) && 'opacity-50 cursor-not-allowed'
            )}
            title="새 파일"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
          <button className="p-1 rounded hover:bg-white/10 transition-colors" title="새로고침">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-1 rounded hover:bg-white/10 transition-colors" title="더보기">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
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

        {/* 파일 목록 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {files.length === 0 ? (
                <div className={cn(
                  'py-4 px-6 text-center',
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                )}>
                  <p className="text-xs">파일이 없습니다</p>
                </div>
              ) : (
                files.map((file) => {
                  const isSelected = selectedFileId === file.id
                  const hasNode = !!findNodeByFileName(file.name)

                  return (
                    <div
                      key={file.id}
                      onClick={() => handleFileClick(file)}
                      onDoubleClick={() => handleFileDoubleClick(file)}
                      className={cn(
                        'group flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer select-none',
                        'pl-6', // 들여쓰기
                        isSelected
                          ? isDark
                            ? 'bg-[#094771] text-white'
                            : 'bg-[#0060c0] text-white'
                          : isDark
                            ? 'hover:bg-[#2a2d2e] text-[#cccccc]'
                            : 'hover:bg-[#e8e8e8] text-[#3b3b3b]'
                      )}
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
                        onClick={(e) => handleDeleteFile(e, file.id)}
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
                })
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
        onChange={handleFileUpload}
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.mov,.avi,.md,.markdown,.txt"
        className="hidden"
      />
    </div>
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
