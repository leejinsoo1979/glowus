'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { FileText, Image, Video, Code, File } from 'lucide-react'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralFile, NeuralFileType } from '@/lib/neural-map/types'

interface LinkAutocompleteProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (fileName: string) => void
  searchQuery?: string
  position?: { top: number; left: number }
  className?: string
}

const fileTypeIcons: Record<NeuralFileType, typeof FileText> = {
  markdown: FileText,
  pdf: FileText,
  image: Image,
  video: Video,
  code: Code,
  text: FileText,
  binary: File,
}

export function LinkAutocomplete({
  isOpen,
  onClose,
  onSelect,
  searchQuery = '',
  position,
  className,
}: LinkAutocompleteProps) {
  const files = useNeuralMapStore((s) => s.files)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // 검색어로 파일 필터링
  const filteredFiles = files.filter((file) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      file.name.toLowerCase().includes(searchLower) ||
      (file.path?.toLowerCase().includes(searchLower) ?? false)
    )
  })

  // 검색어 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // 선택된 아이템 스크롤
  useEffect(() => {
    if (listRef.current && filteredFiles.length > 0) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, filteredFiles.length])

  // 키보드 이벤트 처리를 위한 외부 노출
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev < filteredFiles.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredFiles[selectedIndex]) {
            handleSelect(filteredFiles[selectedIndex])
          } else if (searchQuery.trim()) {
            onSelect(searchQuery.trim())
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredFiles, selectedIndex, searchQuery, onSelect, onClose])

  const handleSelect = useCallback((file: NeuralFile) => {
    // 파일명에서 확장자 제거 (마크다운 링크용)
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    onSelect(nameWithoutExt)
    onClose()
  }, [onSelect, onClose])

  const getFileIcon = (type: NeuralFileType) => {
    const Icon = fileTypeIcons[type] || File
    return <Icon className="w-4 h-4" />
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.1 }}
        style={position ? { top: position.top, left: position.left } : undefined}
        className={cn(
          position ? 'fixed' : 'absolute left-0 top-full mt-1',
          'z-50 w-[280px]',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700',
          'rounded-lg shadow-xl',
          'overflow-hidden',
          className
        )}
      >
        {/* 파일 목록 */}
        <div
          ref={listRef}
          className="max-h-[250px] overflow-y-auto"
        >
          {filteredFiles.length === 0 ? (
            <div className="p-4 text-center">
              {searchQuery.trim() ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No matching files
                  </p>
                  <button
                    onClick={() => {
                      onSelect(searchQuery.trim())
                      onClose()
                    }}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded',
                      'bg-blue-500 text-white',
                      'hover:bg-blue-600 transition-colors'
                    )}
                  >
                    Create [[{searchQuery.trim()}]]
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Type to search files...
                </p>
              )}
            </div>
          ) : (
            filteredFiles.map((file, index) => (
              <button
                key={file.id}
                onClick={() => handleSelect(file)}
                className={cn(
                  'w-full px-3 py-2 text-left',
                  'flex items-center gap-3',
                  'transition-colors',
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
              >
                <span className={cn(
                  'flex-shrink-0',
                  index === selectedIndex
                    ? 'text-blue-500'
                    : 'text-gray-400'
                )}>
                  {getFileIcon(file.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'text-sm truncate',
                    index === selectedIndex
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300'
                  )}>
                    {file.name.replace(/\.[^/.]+$/, '')}
                  </div>
                  {file.path && (
                    <div className="text-xs text-gray-400 truncate">
                      {file.path}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

      </motion.div>
    </AnimatePresence>
  )
}
