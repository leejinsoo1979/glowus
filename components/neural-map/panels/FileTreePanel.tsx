'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralFile } from '@/lib/neural-map/types'
import {
  Search,
  FolderOpen,
  Folder,
  FileText,
  Image,
  Film,
  FileCode,
  Upload,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Clock,
  Plus,
} from 'lucide-react'

interface FolderItem {
  id: string
  name: string
  type: 'folder'
  children: (FolderItem | FileItem)[]
  expanded?: boolean
}

interface FileItem {
  id: string
  name: string
  type: 'file'
  fileType: 'pdf' | 'image' | 'video' | 'markdown'
  linkedNodes?: number
}

// Mock folder structure
const mockFolders: FolderItem[] = [
  {
    id: 'docs',
    name: '문서',
    type: 'folder',
    expanded: true,
    children: [
      { id: 'doc-1', name: '프로젝트 기획서.pdf', type: 'file', fileType: 'pdf', linkedNodes: 5 },
      { id: 'doc-2', name: '회의록_12월.md', type: 'file', fileType: 'markdown', linkedNodes: 3 },
    ],
  },
  {
    id: 'images',
    name: '이미지',
    type: 'folder',
    children: [
      { id: 'img-1', name: '아키텍처_다이어그램.png', type: 'file', fileType: 'image', linkedNodes: 2 },
    ],
  },
  {
    id: 'videos',
    name: '비디오',
    type: 'folder',
    children: [],
  },
  {
    id: 'ideas',
    name: '아이디어',
    type: 'folder',
    children: [
      { id: 'idea-1', name: '신규 기능 아이디어.md', type: 'file', fileType: 'markdown', linkedNodes: 8 },
    ],
  },
]

function FileIcon({ type }: { type: string }) {
  switch (type) {
    case 'pdf':
      return <FileText className="w-4 h-4 text-red-400" />
    case 'image':
      return <Image className="w-4 h-4 text-green-400" />
    case 'video':
      return <Film className="w-4 h-4 text-purple-400" />
    case 'markdown':
      return <FileCode className="w-4 h-4 text-blue-400" />
    default:
      return <FileText className="w-4 h-4 text-zinc-400" />
  }
}

function TreeItem({
  item,
  level = 0,
  isDark,
}: {
  item: FolderItem | FileItem
  level?: number
  isDark: boolean
}) {
  const [expanded, setExpanded] = useState((item as FolderItem).expanded ?? false)

  if (item.type === 'folder') {
    const folder = item as FolderItem
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-sm',
            isDark
              ? 'hover:bg-zinc-800 text-zinc-300'
              : 'hover:bg-zinc-100 text-zinc-700'
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
          {expanded ? (
            <FolderOpen className="w-4 h-4 text-amber-400" />
          ) : (
            <Folder className="w-4 h-4 text-amber-400" />
          )}
          <span className="flex-1 text-left truncate">{folder.name}</span>
          <span className={cn('text-xs', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
            {folder.children.length}
          </span>
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {folder.children.map((child) => (
                <TreeItem key={child.id} item={child} level={level + 1} isDark={isDark} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const file = item as FileItem
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-sm group',
        isDark
          ? 'hover:bg-zinc-800 text-zinc-400'
          : 'hover:bg-zinc-100 text-zinc-600'
      )}
      style={{ paddingLeft: `${level * 12 + 24}px` }}
    >
      <FileIcon type={file.fileType} />
      <span className="flex-1 text-left truncate">{file.name}</span>
      {file.linkedNodes && file.linkedNodes > 0 && (
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500'
          )}
        >
          {file.linkedNodes}
        </span>
      )}
      <button
        className={cn(
          'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
          isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200'
        )}
      >
        <MoreHorizontal className="w-3 h-3" />
      </button>
    </button>
  )
}

export function FileTreePanel() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [searchQuery, setSearchQuery] = useState('')
  const files = useNeuralMapStore((s) => s.files)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={cn('p-3 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <h2 className={cn('text-sm font-semibold mb-3', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
          파일 트리
        </h2>

        {/* Search */}
        <div className="relative">
          <Search
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}
          />
          <input
            type="text"
            placeholder="파일 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300'
            )}
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {mockFolders.map((folder) => (
          <TreeItem key={folder.id} item={folder} isDark={isDark} />
        ))}
      </div>

      {/* Recent */}
      <div className={cn('p-3 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-zinc-500" />
          <span className={cn('text-xs font-medium', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
            최근 사용
          </span>
        </div>
        <div className="space-y-1">
          <button
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-sm',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400'
                : 'hover:bg-zinc-100 text-zinc-600'
            )}
          >
            <FileText className="w-4 h-4 text-red-400" />
            <span className="truncate">프로젝트 기획서.pdf</span>
          </button>
        </div>
      </div>

      {/* Upload */}
      <div className={cn('p-3 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <button
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          )}
        >
          <Upload className="w-4 h-4" />
          <span>파일 업로드</span>
        </button>
      </div>
    </div>
  )
}
