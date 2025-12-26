'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Search, FileText, Hash, Clock, Star, X, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react'

interface SearchResult {
  id: string
  type: 'note' | 'tag' | 'heading' | 'recent'
  title: string
  path?: string
  content?: string
  matchedText?: string
  score: number
}

interface NoteFile {
  id: string
  name: string
  path?: string
  content?: string
}

interface SearchPaletteProps {
  isOpen: boolean
  onClose: () => void
  files: NoteFile[]
  existingTags: string[]
  onSelectFile: (file: NoteFile) => void
  onSelectTag: (tag: string) => void
  onCreateNote: (title: string) => void
  isDark?: boolean
  recentFiles?: string[] // Recent file IDs
}

// 간단한 퍼지 검색 함수
function fuzzyMatch(pattern: string, str: string): { matched: boolean; score: number; indices: number[] } {
  const patternLower = pattern.toLowerCase()
  const strLower = str.toLowerCase()

  let patternIdx = 0
  let score = 0
  const indices: number[] = []

  for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
    if (strLower[i] === patternLower[patternIdx]) {
      indices.push(i)
      score += 1
      // 연속 매치 보너스
      if (indices.length > 1 && indices[indices.length - 1] - indices[indices.length - 2] === 1) {
        score += 2
      }
      // 단어 시작 보너스
      if (i === 0 || str[i - 1] === ' ' || str[i - 1] === '/' || str[i - 1] === '-' || str[i - 1] === '_') {
        score += 3
      }
      patternIdx++
    }
  }

  const matched = patternIdx === pattern.length

  return { matched, score: matched ? score : 0, indices }
}

// 하이라이트된 텍스트 렌더링
function HighlightedText({ text, indices, className }: { text: string; indices: number[]; className?: string }) {
  const elements: React.ReactNode[] = []
  let lastIndex = 0

  indices.forEach((idx, i) => {
    if (idx > lastIndex) {
      elements.push(<span key={`text-${i}`}>{text.slice(lastIndex, idx)}</span>)
    }
    elements.push(
      <span key={`match-${i}`} className="bg-yellow-400/30 text-yellow-300 font-medium">
        {text[idx]}
      </span>
    )
    lastIndex = idx + 1
  })

  if (lastIndex < text.length) {
    elements.push(<span key="text-end">{text.slice(lastIndex)}</span>)
  }

  return <span className={className}>{elements}</span>
}

export function SearchPalette({
  isOpen,
  onClose,
  files,
  existingTags,
  onSelectFile,
  onSelectTag,
  onCreateNote,
  isDark = true,
  recentFiles = [],
}: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 검색 결과 계산
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      // 쿼리가 없으면 최근 파일 표시
      const recentResults: SearchResult[] = files
        .filter(f => recentFiles.includes(f.id))
        .slice(0, 5)
        .map(f => ({
          id: f.id,
          type: 'recent' as const,
          title: f.name.replace('.md', ''),
          path: f.path,
          score: 100,
        }))

      return recentResults
    }

    const searchResults: SearchResult[] = []

    // 파일 검색
    files.forEach(file => {
      const nameMatch = fuzzyMatch(query, file.name.replace('.md', ''))
      if (nameMatch.matched) {
        searchResults.push({
          id: file.id,
          type: 'note',
          title: file.name.replace('.md', ''),
          path: file.path,
          score: nameMatch.score + 10, // 파일명 매치 보너스
        })
      }

      // 콘텐츠 검색
      if (file.content) {
        const contentLower = file.content.toLowerCase()
        const queryLower = query.toLowerCase()
        const idx = contentLower.indexOf(queryLower)
        if (idx !== -1) {
          const start = Math.max(0, idx - 30)
          const end = Math.min(file.content.length, idx + query.length + 30)
          const matchedText = (start > 0 ? '...' : '') +
            file.content.slice(start, end) +
            (end < file.content.length ? '...' : '')

          // 이미 파일명으로 추가되지 않았으면 추가
          if (!searchResults.find(r => r.id === file.id)) {
            searchResults.push({
              id: file.id,
              type: 'note',
              title: file.name.replace('.md', ''),
              path: file.path,
              matchedText,
              score: 5,
            })
          }
        }
      }
    })

    // 태그 검색
    existingTags.forEach(tag => {
      const tagMatch = fuzzyMatch(query, tag)
      if (tagMatch.matched) {
        searchResults.push({
          id: `tag-${tag}`,
          type: 'tag',
          title: `#${tag}`,
          score: tagMatch.score,
        })
      }
    })

    // 점수순 정렬
    searchResults.sort((a, b) => b.score - a.score)

    return searchResults.slice(0, 10)
  }, [query, files, existingTags, recentFiles])

  // 선택 인덱스 리셋
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // 팔레트 열릴 때 포커스
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // 선택된 항목 스크롤
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        } else if (query.trim()) {
          // 결과 없으면 새 노트 생성
          onCreateNote(query.trim())
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [results, selectedIndex, query, onClose, onCreateNote])

  // 결과 선택
  const handleSelect = useCallback((result: SearchResult) => {
    switch (result.type) {
      case 'note':
      case 'recent':
        const file = files.find(f => f.id === result.id)
        if (file) {
          onSelectFile(file)
        }
        break
      case 'tag':
        onSelectTag(result.title.replace('#', ''))
        break
    }
    onClose()
  }, [files, onSelectFile, onSelectTag, onClose])

  // 글로벌 키보드 단축키
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault()
        if (isOpen) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose])

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'note':
        return FileText
      case 'tag':
        return Hash
      case 'recent':
        return Clock
      default:
        return FileText
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 백드롭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* 팔레트 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50',
              'rounded-xl shadow-2xl overflow-hidden',
              isDark ? 'bg-[#252526] border border-[#3c3c3c]' : 'bg-white border border-zinc-200'
            )}
          >
            {/* 검색 입력 */}
            <div className={cn('flex items-center gap-3 px-4 py-3 border-b', isDark ? 'border-[#3c3c3c]' : 'border-zinc-200')}>
              <Search className="w-5 h-5 text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search notes, tags, or create new..."
                className={cn(
                  'no-focus-ring flex-1 bg-transparent outline-none text-base',
                  isDark ? 'text-zinc-200 placeholder:text-zinc-500' : 'text-zinc-900 placeholder:text-zinc-400'
                )}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                onClick={onClose}
                className={cn(
                  'p-1 rounded transition-colors',
                  isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
                )}
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* 검색 결과 */}
            <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
              {results.length > 0 ? (
                results.map((result, index) => {
                  const Icon = getResultIcon(result.type)
                  const isSelected = index === selectedIndex

                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        isSelected
                          ? isDark ? 'bg-[#094771]' : 'bg-blue-100'
                          : isDark ? 'hover:bg-[#2d2d2d]' : 'hover:bg-zinc-50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', result.type === 'tag' ? 'text-green-400' : 'text-zinc-500')} />
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm truncate', isDark ? 'text-zinc-200' : 'text-zinc-900')}>
                          {result.title}
                        </div>
                        {result.matchedText && (
                          <div className={cn('text-xs truncate mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                            {result.matchedText}
                          </div>
                        )}
                        {result.path && !result.matchedText && (
                          <div className={cn('text-xs truncate mt-0.5', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                            {result.path}
                          </div>
                        )}
                      </div>
                      {result.type === 'recent' && (
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-100 text-zinc-500')}>
                          Recent
                        </span>
                      )}
                    </button>
                  )
                })
              ) : query.trim() ? (
                <div className="px-4 py-8 text-center">
                  <div className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    No results found
                  </div>
                  <button
                    onClick={() => {
                      onCreateNote(query.trim())
                      onClose()
                    }}
                    className={cn(
                      'mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                      isDark ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    Create &quot;{query.trim()}&quot;
                  </button>
                </div>
              ) : (
                <div className={cn('px-4 py-6 text-center text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  Start typing to search...
                </div>
              )}
            </div>

            {/* 푸터 힌트 */}
            <div className={cn('flex items-center justify-between px-4 py-2 border-t text-xs', isDark ? 'border-[#3c3c3c] text-zinc-500' : 'border-zinc-200 text-zinc-400')}>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3" />
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="w-3 h-3" />
                  select
                </span>
                <span>esc close</span>
              </div>
              <span>Cmd+P</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
