'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  X,
  Check,
  XCircle,
  Copy,
  Download,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  SplitSquareHorizontal,
  Rows,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Monaco Editor 동적 임포트
let monaco: typeof import('monaco-editor') | null = null

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

export interface DiffViewerProps {
  // 원본 내용
  originalContent: string
  // 수정된 내용
  modifiedContent: string
  // 파일 경로
  filePath?: string
  // 언어 (자동 감지 가능)
  language?: string
  // 닫기 콜백
  onClose?: () => void
  // 승인 콜백
  onApprove?: (content: string) => void
  // 거부 콜백
  onReject?: () => void
  // 읽기 전용 모드
  readOnly?: boolean
  // 높이
  height?: string | number
  // 너비
  width?: string | number
  // 인라인 모드 (사이드바이사이드 vs 인라인)
  inline?: boolean
}

// 파일 확장자로 언어 감지
function detectLanguage(filePath?: string): string {
  if (!filePath) return 'plaintext'

  const ext = filePath.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    php: 'php',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    dockerfile: 'dockerfile',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
  }

  return langMap[ext || ''] || 'plaintext'
}

// 변경 통계 계산
function calculateChangeStats(original: string, modified: string) {
  const originalLines = original.split('\n')
  const modifiedLines = modified.split('\n')

  let added = 0
  let removed = 0
  let unchanged = 0

  // 간단한 라인 기반 비교
  const maxLines = Math.max(originalLines.length, modifiedLines.length)

  for (let i = 0; i < maxLines; i++) {
    if (i >= originalLines.length) {
      added++
    } else if (i >= modifiedLines.length) {
      removed++
    } else if (originalLines[i] === modifiedLines[i]) {
      unchanged++
    } else {
      added++
      removed++
    }
  }

  return { added, removed, unchanged, totalOriginal: originalLines.length, totalModified: modifiedLines.length }
}

export function DiffViewer({
  originalContent,
  modifiedContent,
  filePath,
  language,
  onClose,
  onApprove,
  onReject,
  readOnly = false,
  height = 400,
  width = '100%',
  inline = false,
}: DiffViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inlineMode, setInlineMode] = useState(inline)
  const [fontSize, setFontSize] = useState(13)
  const [editedContent, setEditedContent] = useState(modifiedContent)
  const [copied, setCopied] = useState(false)

  const detectedLanguage = language || detectLanguage(filePath)
  const stats = calculateChangeStats(originalContent, modifiedContent)

  // Monaco 초기화
  useEffect(() => {
    let isMounted = true

    const initMonaco = async () => {
      if (!containerRef.current) return

      try {
        // Monaco 동적 로드
        if (!monaco) {
          monaco = await import('monaco-editor')

          // 다크 테마 설정
          monaco.editor.defineTheme('glow-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              'editor.background': '#1a1a1a',
              'editor.foreground': '#e4e4e7',
              'editorLineNumber.foreground': '#52525b',
              'editorLineNumber.activeForeground': '#a1a1aa',
              'editor.selectionBackground': '#3f3f46',
              'editor.lineHighlightBackground': '#27272a',
              'diffEditor.insertedTextBackground': '#22c55e20',
              'diffEditor.removedTextBackground': '#ef444420',
              'diffEditor.insertedLineBackground': '#22c55e15',
              'diffEditor.removedLineBackground': '#ef444415',
            }
          })
        }

        if (!isMounted) return

        // Diff Editor 생성
        const originalModel = monaco.editor.createModel(originalContent, detectedLanguage)
        const modifiedModel = monaco.editor.createModel(editedContent, detectedLanguage)

        editorRef.current = monaco.editor.createDiffEditor(containerRef.current, {
          theme: 'glow-dark',
          automaticLayout: true,
          readOnly,
          fontSize,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderSideBySide: !inlineMode,
          renderIndicators: true,
          ignoreTrimWhitespace: false,
          renderOverviewRuler: true,
          diffWordWrap: 'on',
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          }
        })

        editorRef.current.setModel({
          original: originalModel,
          modified: modifiedModel
        })

        // 수정 내용 추적
        if (!readOnly) {
          modifiedModel.onDidChangeContent(() => {
            setEditedContent(modifiedModel.getValue())
          })
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Monaco diff editor init failed:', error)
        setIsLoading(false)
      }
    }

    initMonaco()

    return () => {
      isMounted = false
      if (editorRef.current) {
        editorRef.current.dispose()
      }
    }
  }, [originalContent, detectedLanguage, readOnly])

  // 인라인 모드 토글
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        renderSideBySide: !inlineMode
      })
    }
  }, [inlineMode])

  // 폰트 크기 변경
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize })
    }
  }, [fontSize])

  // 내용 복사
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(editedContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [editedContent])

  // 다운로드
  const handleDownload = useCallback(() => {
    const blob = new Blob([editedContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filePath?.split('/').pop() || 'file.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [editedContent, filePath])

  // 승인
  const handleApprove = useCallback(() => {
    onApprove?.(editedContent)
  }, [editedContent, onApprove])

  return (
    <div className="flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-zinc-400" />
          <span className="text-sm text-zinc-300 font-mono">
            {filePath || 'Diff Viewer'}
          </span>
          <span className="text-xs text-zinc-500">
            ({detectedLanguage})
          </span>
        </div>

        {/* 변경 통계 */}
        <div className="flex items-center gap-4 text-xs">
          <span className="text-green-400">
            +{stats.added} 추가
          </span>
          <span className="text-red-400">
            -{stats.removed} 삭제
          </span>
          <span className="text-zinc-500">
            {stats.unchanged} 변경없음
          </span>
        </div>

        {/* 도구 버튼 */}
        <div className="flex items-center gap-1">
          {/* 인라인/사이드바이사이드 토글 */}
          <button
            onClick={() => setInlineMode(!inlineMode)}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title={inlineMode ? '사이드 바이 사이드' : '인라인'}
          >
            {inlineMode ? <SplitSquareHorizontal className="w-4 h-4" /> : <Rows className="w-4 h-4" />}
          </button>

          {/* 줌 아웃 */}
          <button
            onClick={() => setFontSize(s => Math.max(10, s - 1))}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* 줌 인 */}
          <button
            onClick={() => setFontSize(s => Math.min(20, s + 1))}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* 복사 */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="수정된 내용 복사"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* 다운로드 */}
          <button
            onClick={handleDownload}
            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="다운로드"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* 닫기 */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div
        ref={containerRef}
        style={{ height, width }}
        className="relative"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Footer Actions (승인/거부 버튼) */}
      {(onApprove || onReject) && (
        <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
          {onReject && (
            <button
              onClick={onReject}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
            >
              <XCircle className="w-4 h-4" />
              <span>거부</span>
            </button>
          )}

          {onApprove && (
            <button
              onClick={handleApprove}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm transition-colors"
              style={{ backgroundColor: CLAUDE_ORANGE }}
            >
              <Check className="w-4 h-4" />
              <span>적용</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// 🔥 간단한 텍스트 기반 Diff (Monaco 없이)
export function TextDiff({
  originalContent,
  modifiedContent,
  className,
}: {
  originalContent: string
  modifiedContent: string
  className?: string
}) {
  const originalLines = originalContent.split('\n')
  const modifiedLines = modifiedContent.split('\n')

  // 간단한 라인 기반 diff
  const diffLines: Array<{ type: 'add' | 'remove' | 'same'; content: string; lineNum?: number }> = []

  const maxLen = Math.max(originalLines.length, modifiedLines.length)

  for (let i = 0; i < maxLen; i++) {
    const orig = originalLines[i]
    const mod = modifiedLines[i]

    if (orig === undefined) {
      diffLines.push({ type: 'add', content: mod, lineNum: i + 1 })
    } else if (mod === undefined) {
      diffLines.push({ type: 'remove', content: orig, lineNum: i + 1 })
    } else if (orig === mod) {
      diffLines.push({ type: 'same', content: orig, lineNum: i + 1 })
    } else {
      diffLines.push({ type: 'remove', content: orig, lineNum: i + 1 })
      diffLines.push({ type: 'add', content: mod })
    }
  }

  return (
    <div className={cn("font-mono text-xs overflow-x-auto", className)}>
      {diffLines.map((line, i) => (
        <div
          key={i}
          className={cn(
            "px-2 py-0.5 whitespace-pre",
            line.type === 'add' && 'bg-green-900/30 text-green-300',
            line.type === 'remove' && 'bg-red-900/30 text-red-300',
            line.type === 'same' && 'text-zinc-400'
          )}
        >
          <span className="inline-block w-8 text-zinc-600 text-right mr-2">
            {line.lineNum || ''}
          </span>
          <span className="inline-block w-4">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          {line.content}
        </div>
      ))}
    </div>
  )
}

export default DiffViewer
