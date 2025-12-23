'use client'

/**
 * DiffViewer - 코드 변경사항 시각화 컴포넌트
 * Cursor/Claude Code 수준의 Diff 표시 UI
 *
 * Features:
 * - 라인별 +/- 하이라이팅
 * - Unified/Split 뷰 토글
 * - 문법 하이라이팅
 * - 변경 통계
 */

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  Plus,
  Minus,
  File,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Columns,
  Rows,
  GitCommit,
} from 'lucide-react'

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  changes: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'add' | 'delete'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface FileDiff {
  path: string
  oldPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: DiffHunk[]
  additions: number
  deletions: number
  language?: string
}

interface DiffViewerProps {
  diffs: FileDiff[]
  onApply?: (path: string) => void
  onReject?: (path: string) => void
  className?: string
}

export function DiffViewer({ diffs, onApply, onReject, className }: DiffViewerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(diffs.map(d => d.path)))
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  const totalStats = useMemo(() => {
    return diffs.reduce(
      (acc, diff) => ({
        additions: acc.additions + diff.additions,
        deletions: acc.deletions + diff.deletions,
        files: acc.files + 1,
      }),
      { additions: 0, deletions: 0, files: 0 }
    )
  }, [diffs])

  const toggleFile = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const copyPath = async (path: string) => {
    await navigator.clipboard.writeText(path)
    setCopiedPath(path)
    setTimeout(() => setCopiedPath(null), 2000)
  }

  const getStatusColor = (status: FileDiff['status']) => {
    switch (status) {
      case 'added':
        return 'text-green-500'
      case 'deleted':
        return 'text-red-500'
      case 'modified':
        return 'text-yellow-500'
      case 'renamed':
        return 'text-blue-500'
      default:
        return isDark ? 'text-zinc-400' : 'text-zinc-600'
    }
  }

  const getStatusIcon = (status: FileDiff['status']) => {
    switch (status) {
      case 'added':
        return <Plus className="w-3.5 h-3.5" />
      case 'deleted':
        return <Minus className="w-3.5 h-3.5" />
      case 'modified':
        return <GitCommit className="w-3.5 h-3.5" />
      case 'renamed':
        return <File className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* 헤더 - 통계 및 뷰 모드 */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b",
        isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
      )}>
        <div className="flex items-center gap-4 text-sm">
          <span className={isDark ? "text-zinc-400" : "text-zinc-600"}>
            {totalStats.files} files changed
          </span>
          <span className="text-green-500 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            {totalStats.additions}
          </span>
          <span className="text-red-500 flex items-center gap-1">
            <Minus className="w-3.5 h-3.5" />
            {totalStats.deletions}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === 'unified'
                ? isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-200 text-zinc-900"
                : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
            )}
            title="Unified view"
          >
            <Rows className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={cn(
              "p-1.5 rounded transition-colors",
              viewMode === 'split'
                ? isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-200 text-zinc-900"
                : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
            )}
            title="Split view"
          >
            <Columns className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Diff 목록 */}
      <div className="flex-1 overflow-auto">
        {diffs.map((diff) => (
          <div
            key={diff.path}
            className={cn(
              "border-b",
              isDark ? "border-zinc-800" : "border-zinc-200"
            )}
          >
            {/* 파일 헤더 */}
            <div
              onClick={() => toggleFile(diff.path)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 cursor-pointer",
                isDark ? "hover:bg-zinc-800/50" : "hover:bg-zinc-100"
              )}
            >
              {expandedFiles.has(diff.path) ? (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              )}

              <span className={getStatusColor(diff.status)}>
                {getStatusIcon(diff.status)}
              </span>

              <span className={cn(
                "font-mono text-sm flex-1",
                isDark ? "text-zinc-200" : "text-zinc-800"
              )}>
                {diff.path}
                {diff.oldPath && diff.oldPath !== diff.path && (
                  <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>
                    {' ← '}{diff.oldPath}
                  </span>
                )}
              </span>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-500">+{diff.additions}</span>
                <span className="text-red-500">-{diff.deletions}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyPath(diff.path)
                  }}
                  className={cn(
                    "p-1 rounded transition-colors",
                    isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-200"
                  )}
                >
                  {copiedPath === diff.path ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Diff 내용 */}
            <AnimatePresence>
              {expandedFiles.has(diff.path) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {viewMode === 'unified' ? (
                    <UnifiedDiffView diff={diff} isDark={isDark} />
                  ) : (
                    <SplitDiffView diff={diff} isDark={isDark} />
                  )}

                  {/* 액션 버튼 */}
                  {(onApply || onReject) && (
                    <div className={cn(
                      "flex items-center gap-2 px-4 py-2 border-t",
                      isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                    )}>
                      {onApply && (
                        <button
                          onClick={() => onApply(diff.path)}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
                        >
                          Apply Changes
                        </button>
                      )}
                      {onReject && (
                        <button
                          onClick={() => onReject(diff.path)}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

// Unified Diff View
function UnifiedDiffView({ diff, isDark }: { diff: FileDiff; isDark: boolean }) {
  return (
    <div className={cn(
      "font-mono text-xs overflow-x-auto",
      isDark ? "bg-zinc-950" : "bg-zinc-50"
    )}>
      {diff.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk 헤더 */}
          <div className={cn(
            "px-4 py-1",
            isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"
          )}>
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>

          {/* 변경 라인들 */}
          {hunk.changes.map((line, lineIndex) => (
            <div
              key={lineIndex}
              className={cn(
                "flex",
                line.type === 'add' && (isDark ? "bg-green-500/10" : "bg-green-50"),
                line.type === 'delete' && (isDark ? "bg-red-500/10" : "bg-red-50")
              )}
            >
              {/* 라인 번호 */}
              <div className={cn(
                "w-12 px-2 text-right select-none flex-shrink-0",
                isDark ? "text-zinc-600 bg-zinc-900" : "text-zinc-400 bg-zinc-100"
              )}>
                {line.oldLineNumber || ''}
              </div>
              <div className={cn(
                "w-12 px-2 text-right select-none flex-shrink-0",
                isDark ? "text-zinc-600 bg-zinc-900" : "text-zinc-400 bg-zinc-100"
              )}>
                {line.newLineNumber || ''}
              </div>

              {/* +/- 기호 */}
              <div className={cn(
                "w-6 text-center flex-shrink-0",
                line.type === 'add' && "text-green-500",
                line.type === 'delete' && "text-red-500"
              )}>
                {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
              </div>

              {/* 코드 내용 */}
              <div className={cn(
                "flex-1 px-2 whitespace-pre",
                line.type === 'add' && (isDark ? "text-green-300" : "text-green-700"),
                line.type === 'delete' && (isDark ? "text-red-300" : "text-red-700"),
                line.type === 'context' && (isDark ? "text-zinc-400" : "text-zinc-600")
              )}>
                {line.content}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Split Diff View
function SplitDiffView({ diff, isDark }: { diff: FileDiff; isDark: boolean }) {
  return (
    <div className={cn(
      "flex font-mono text-xs overflow-x-auto",
      isDark ? "bg-zinc-950" : "bg-zinc-50"
    )}>
      {/* 왼쪽 (Old) */}
      <div className="flex-1 border-r border-zinc-800">
        {diff.hunks.map((hunk, hunkIndex) => (
          <div key={hunkIndex}>
            <div className={cn(
              "px-4 py-1",
              isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
            )}>
              -{hunk.oldStart},{hunk.oldLines}
            </div>
            {hunk.changes
              .filter(line => line.type !== 'add')
              .map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={cn(
                    "flex",
                    line.type === 'delete' && (isDark ? "bg-red-500/10" : "bg-red-50")
                  )}
                >
                  <div className={cn(
                    "w-12 px-2 text-right select-none flex-shrink-0",
                    isDark ? "text-zinc-600 bg-zinc-900" : "text-zinc-400 bg-zinc-100"
                  )}>
                    {line.oldLineNumber || ''}
                  </div>
                  <div className={cn(
                    "flex-1 px-2 whitespace-pre",
                    line.type === 'delete' && (isDark ? "text-red-300" : "text-red-700"),
                    line.type === 'context' && (isDark ? "text-zinc-400" : "text-zinc-600")
                  )}>
                    {line.content}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* 오른쪽 (New) */}
      <div className="flex-1">
        {diff.hunks.map((hunk, hunkIndex) => (
          <div key={hunkIndex}>
            <div className={cn(
              "px-4 py-1",
              isDark ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-600"
            )}>
              +{hunk.newStart},{hunk.newLines}
            </div>
            {hunk.changes
              .filter(line => line.type !== 'delete')
              .map((line, lineIndex) => (
                <div
                  key={lineIndex}
                  className={cn(
                    "flex",
                    line.type === 'add' && (isDark ? "bg-green-500/10" : "bg-green-50")
                  )}
                >
                  <div className={cn(
                    "w-12 px-2 text-right select-none flex-shrink-0",
                    isDark ? "text-zinc-600 bg-zinc-900" : "text-zinc-400 bg-zinc-100"
                  )}>
                    {line.newLineNumber || ''}
                  </div>
                  <div className={cn(
                    "flex-1 px-2 whitespace-pre",
                    line.type === 'add' && (isDark ? "text-green-300" : "text-green-700"),
                    line.type === 'context' && (isDark ? "text-zinc-400" : "text-zinc-600")
                  )}>
                    {line.content}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default DiffViewer
