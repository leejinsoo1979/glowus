'use client'

/**
 * ToolOutputPanel - 도구 실행 결과 표시 패널
 * 파일 읽기, 검색 결과, 터미널 출력 등을 전문적으로 표시
 *
 * Features:
 * - 도구별 최적화된 표시 형식
 * - 코드 문법 하이라이팅
 * - 접기/펼치기
 * - 복사 기능
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  File,
  Terminal,
  Search,
  GitBranch,
  FolderTree,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
} from 'lucide-react'

export interface ToolOutput {
  id: string
  toolName: string
  success: boolean
  result: unknown
  error?: string
  executionTime: number
  timestamp: number
}

interface ToolOutputPanelProps {
  outputs: ToolOutput[]
  onFileClick?: (path: string) => void
  className?: string
}

export function ToolOutputPanel({ outputs, onFileClick, className }: ToolOutputPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set(outputs.map(o => o.id)))
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleOutput = (id: string) => {
    setExpandedOutputs(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const copyContent = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const getToolIcon = (name: string) => {
    if (name.includes('search')) return Search
    if (name.includes('read') || name.includes('file')) return File
    if (name.includes('run') || name.includes('terminal') || name.includes('diagnostics')) return Terminal
    if (name.includes('git')) return GitBranch
    if (name.includes('tree')) return FolderTree
    return Terminal
  }

  return (
    <div className={cn(
      "flex flex-col h-full overflow-auto",
      isDark ? "bg-zinc-900" : "bg-white",
      className
    )}>
      {outputs.length === 0 ? (
        <div className={cn(
          "flex-1 flex items-center justify-center text-sm",
          isDark ? "text-zinc-600" : "text-zinc-400"
        )}>
          No tool outputs yet
        </div>
      ) : (
        <div className="space-y-2 p-3">
          {outputs.map((output) => {
            const Icon = getToolIcon(output.toolName)
            const isExpanded = expandedOutputs.has(output.id)

            return (
              <div
                key={output.id}
                className={cn(
                  "rounded-lg overflow-hidden border",
                  isDark ? "border-zinc-800 bg-zinc-800/50" : "border-zinc-200 bg-zinc-50"
                )}
              >
                {/* 헤더 */}
                <div
                  onClick={() => toggleOutput(output.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                    isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
                  )}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-500" />
                  )}

                  {output.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}

                  <Icon className={cn(
                    "w-4 h-4",
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  )} />

                  <span className={cn(
                    "font-mono text-sm flex-1",
                    isDark ? "text-zinc-200" : "text-zinc-800"
                  )}>
                    {output.toolName}
                  </span>

                  <span className={cn(
                    "flex items-center gap-1 text-xs",
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  )}>
                    <Clock className="w-3 h-3" />
                    {formatDuration(output.executionTime)}
                  </span>
                </div>

                {/* 내용 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        "border-t",
                        isDark ? "border-zinc-700" : "border-zinc-200"
                      )}>
                        {output.success ? (
                          <ToolResultRenderer
                            toolName={output.toolName}
                            result={output.result}
                            isDark={isDark}
                            onCopy={(content) => copyContent(content, output.id)}
                            copied={copiedId === output.id}
                            onFileClick={onFileClick}
                          />
                        ) : (
                          <div className="p-3">
                            <div className="text-xs font-semibold text-red-500 mb-1">Error:</div>
                            <pre className={cn(
                              "text-xs font-mono whitespace-pre-wrap",
                              "text-red-400"
                            )}>
                              {output.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// 도구별 결과 렌더러
function ToolResultRenderer({
  toolName,
  result,
  isDark,
  onCopy,
  copied,
  onFileClick,
}: {
  toolName: string
  result: unknown
  isDark: boolean
  onCopy: (content: string) => void
  copied: boolean
  onFileClick?: (path: string) => void
}) {
  // repo.read 결과
  if (toolName.includes('read') && typeof result === 'object' && result !== null) {
    const fileResult = result as { path?: string; content?: string; language?: string; lines?: number }

    return (
      <div>
        {fileResult.path && (
          <div className={cn(
            "flex items-center justify-between px-3 py-2 border-b",
            isDark ? "border-zinc-700 bg-zinc-800" : "border-zinc-200 bg-zinc-100"
          )}>
            <button
              onClick={() => onFileClick?.(fileResult.path!)}
              className={cn(
                "flex items-center gap-2 text-xs font-mono hover:underline",
                isDark ? "text-blue-400" : "text-blue-600"
              )}
            >
              <File className="w-3 h-3" />
              {fileResult.path}
              <ExternalLink className="w-3 h-3" />
            </button>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs",
                isDark ? "text-zinc-500" : "text-zinc-400"
              )}>
                {fileResult.lines} lines • {fileResult.language}
              </span>
              <button
                onClick={() => onCopy(fileResult.content || '')}
                className={cn(
                  "p-1 rounded transition-colors",
                  isDark ? "hover:bg-zinc-700" : "hover:bg-zinc-200"
                )}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500" />
                )}
              </button>
            </div>
          </div>
        )}
        <pre className={cn(
          "p-3 text-xs font-mono overflow-x-auto max-h-96",
          isDark ? "bg-zinc-900 text-zinc-300" : "bg-zinc-50 text-zinc-700"
        )}>
          {fileResult.content}
        </pre>
      </div>
    )
  }

  // repo.search 결과
  if (toolName.includes('search') && typeof result === 'object' && result !== null) {
    const searchResult = result as { results?: Array<{ file: string; line: number; content: string }> }

    return (
      <div className="max-h-96 overflow-auto">
        {searchResult.results?.map((match, idx) => (
          <div
            key={idx}
            className={cn(
              "border-b last:border-b-0",
              isDark ? "border-zinc-700" : "border-zinc-200"
            )}
          >
            <button
              onClick={() => onFileClick?.(match.file)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left hover:underline",
                isDark ? "text-blue-400 hover:bg-zinc-800" : "text-blue-600 hover:bg-zinc-50"
              )}
            >
              <File className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs font-mono truncate">{match.file}</span>
              <span className={cn(
                "text-xs flex-shrink-0",
                isDark ? "text-zinc-500" : "text-zinc-400"
              )}>
                :{match.line}
              </span>
            </button>
            <pre className={cn(
              "px-3 py-2 text-xs font-mono whitespace-pre-wrap",
              isDark ? "bg-zinc-900 text-zinc-400" : "bg-zinc-100 text-zinc-600"
            )}>
              {match.content}
            </pre>
          </div>
        ))}
        {(!searchResult.results || searchResult.results.length === 0) && (
          <div className={cn(
            "p-3 text-sm text-center",
            isDark ? "text-zinc-500" : "text-zinc-400"
          )}>
            No results found
          </div>
        )}
      </div>
    )
  }

  // repo.run / terminal 결과
  if ((toolName.includes('run') || toolName.includes('diagnostics')) && typeof result === 'object' && result !== null) {
    const runResult = result as { stdout?: string; stderr?: string; exitCode?: number }

    return (
      <div className={cn(
        "p-3",
        isDark ? "bg-zinc-900" : "bg-zinc-50"
      )}>
        {runResult.stdout && (
          <pre className={cn(
            "text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto",
            isDark ? "text-zinc-300" : "text-zinc-700"
          )}>
            {runResult.stdout}
          </pre>
        )}
        {runResult.stderr && (
          <pre className={cn(
            "text-xs font-mono whitespace-pre-wrap mt-2",
            "text-red-400"
          )}>
            {runResult.stderr}
          </pre>
        )}
        {runResult.exitCode !== undefined && runResult.exitCode !== 0 && (
          <div className={cn(
            "mt-2 text-xs",
            "text-yellow-500"
          )}>
            Exit code: {runResult.exitCode}
          </div>
        )}
      </div>
    )
  }

  // git 결과
  if (toolName.includes('git') && typeof result === 'object' && result !== null) {
    const gitResult = result as {
      branch?: string
      staged?: Array<{ path: string; status: string }>
      unstaged?: Array<{ path: string }>
      output?: string
    }

    return (
      <div className="p-3">
        {gitResult.branch && (
          <div className={cn(
            "flex items-center gap-2 mb-2 text-sm",
            isDark ? "text-zinc-300" : "text-zinc-700"
          )}>
            <GitBranch className="w-4 h-4" />
            <span className="font-mono">{gitResult.branch}</span>
          </div>
        )}
        {gitResult.staged && gitResult.staged.length > 0 && (
          <div className="mb-2">
            <div className={cn(
              "text-xs font-semibold mb-1",
              "text-green-500"
            )}>
              Staged ({gitResult.staged.length})
            </div>
            {gitResult.staged.map((file, idx) => (
              <div
                key={idx}
                className={cn(
                  "text-xs font-mono",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {file.status[0].toUpperCase()} {file.path}
              </div>
            ))}
          </div>
        )}
        {gitResult.unstaged && gitResult.unstaged.length > 0 && (
          <div className="mb-2">
            <div className={cn(
              "text-xs font-semibold mb-1",
              "text-yellow-500"
            )}>
              Modified ({gitResult.unstaged.length})
            </div>
            {gitResult.unstaged.map((file, idx) => (
              <div
                key={idx}
                className={cn(
                  "text-xs font-mono",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                M {file.path}
              </div>
            ))}
          </div>
        )}
        {gitResult.output && (
          <pre className={cn(
            "text-xs font-mono whitespace-pre-wrap",
            isDark ? "text-zinc-300" : "text-zinc-700"
          )}>
            {gitResult.output}
          </pre>
        )}
      </div>
    )
  }

  // 기본 JSON 표시
  return (
    <div className="p-3">
      <div className="flex justify-end mb-2">
        <button
          onClick={() => onCopy(JSON.stringify(result, null, 2))}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            isDark ? "hover:bg-zinc-700 text-zinc-400" : "hover:bg-zinc-200 text-zinc-600"
          )}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className={cn(
        "text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto",
        isDark ? "text-zinc-300" : "text-zinc-700"
      )}>
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  )
}

export default ToolOutputPanel
