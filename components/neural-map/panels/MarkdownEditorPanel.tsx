'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useNeuralMapApi } from '@/lib/neural-map/useNeuralMapApi'
import { parseWikiLinks, extractTitle } from '@/lib/neural-map/markdown-parser'
import {
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  FileText,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading1,
  Heading2,
  Code,
  Quote,
  Minus,
} from 'lucide-react'

interface MarkdownEditorPanelProps {
  isOpen: boolean
  onClose: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function MarkdownEditorPanel({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: MarkdownEditorPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mapId = useNeuralMapStore((s) => s.mapId)
  const graph = useNeuralMapStore((s) => s.graph)
  const { createNode, createEdge } = useNeuralMapApi(mapId)

  // 리셋
  const resetEditor = useCallback(() => {
    setTitle('')
    setContent('')
  }, [])

  // 저장
  const handleSave = useCallback(async () => {
    if (!title.trim() || !mapId) return

    setIsSaving(true)
    try {
      // 노드 생성
      const newNode = await createNode({
        type: 'doc',
        title: title.trim(),
        content: content,
        summary: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        tags: ['markdown', 'note'],
        importance: 5,
      })

      if (newNode && graph?.nodes) {
        // Self 노드와 연결
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
        const wikiLinks = parseWikiLinks(content)
        for (const link of wikiLinks) {
          const existingNode = graph.nodes.find(
            n => n.title.toLowerCase() === link.target.toLowerCase()
          )

          if (existingNode) {
            await createEdge({
              sourceId: newNode.id,
              targetId: existingNode.id,
              type: 'references',
              weight: 0.5,
              label: link.alias || undefined,
            })
          } else {
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
            }
          }
        }
      }

      resetEditor()
      onClose()
    } catch (err) {
      console.error('노트 저장 실패:', err)
    } finally {
      setIsSaving(false)
    }
  }, [title, content, mapId, graph, createNode, createEdge, resetEditor, onClose])

  // 마크다운 단축키 삽입
  const insertMarkdown = useCallback((prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end)

    setContent(newText)

    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = selectedText ? start + prefix.length + selectedText.length + suffix.length : start + prefix.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }, [content])

  // 툴바 버튼들
  const toolbarButtons = [
    { icon: Heading1, action: () => insertMarkdown('# '), title: 'Heading 1' },
    { icon: Heading2, action: () => insertMarkdown('## '), title: 'Heading 2' },
    { icon: Bold, action: () => insertMarkdown('**', '**'), title: 'Bold' },
    { icon: Italic, action: () => insertMarkdown('*', '*'), title: 'Italic' },
    { icon: Code, action: () => insertMarkdown('`', '`'), title: 'Code' },
    { icon: Quote, action: () => insertMarkdown('> '), title: 'Quote' },
    { icon: List, action: () => insertMarkdown('- '), title: 'Bullet List' },
    { icon: ListOrdered, action: () => insertMarkdown('1. '), title: 'Numbered List' },
    { icon: Link2, action: () => insertMarkdown('[[', ']]'), title: 'Wiki Link' },
    { icon: Minus, action: () => insertMarkdown('\n---\n'), title: 'Divider' },
  ]

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: isCollapsed ? 40 : 400, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'h-full border-l flex flex-col overflow-hidden flex-shrink-0',
          isDark ? 'bg-[#1e1e1e] border-[#3c3c3c]' : 'bg-white border-zinc-200'
        )}
      >
        {isCollapsed ? (
          // 접힌 상태
          <div className="h-full flex flex-col items-center py-2">
            <button
              onClick={onToggleCollapse}
              className={cn(
                'p-2 rounded transition-colors',
                isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
              )}
              title="펼치기"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="mt-4 writing-vertical-rl text-xs text-zinc-500">
              Editor
            </div>
          </div>
        ) : (
          // 펼친 상태
          <>
            {/* 헤더 */}
            <div
              className={cn(
                'flex items-center justify-between px-3 py-2 border-b flex-shrink-0',
                isDark ? 'border-[#3c3c3c]' : 'border-zinc-200'
              )}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">New Note</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleCollapse}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
                  )}
                  title="접기"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    resetEditor()
                    onClose()
                  }}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
                  )}
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 제목 입력 */}
            <div className={cn('px-3 py-2 border-b', isDark ? 'border-[#3c3c3c]' : 'border-zinc-200')}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="노트 제목..."
                className={cn(
                  'w-full px-2 py-1.5 text-sm rounded border outline-none transition-colors',
                  isDark
                    ? 'bg-[#2d2d2d] border-[#3c3c3c] text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'
                )}
              />
            </div>

            {/* 툴바 */}
            <div
              className={cn(
                'flex items-center gap-0.5 px-2 py-1.5 border-b overflow-x-auto',
                isDark ? 'border-[#3c3c3c]' : 'border-zinc-200'
              )}
            >
              {toolbarButtons.map((btn, idx) => (
                <button
                  key={idx}
                  onClick={btn.action}
                  className={cn(
                    'p-1.5 rounded transition-colors flex-shrink-0',
                    isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
                  )}
                  title={btn.title}
                >
                  <btn.icon className="w-4 h-4" />
                </button>
              ))}
            </div>

            {/* 에디터 */}
            <div className="flex-1 overflow-hidden">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="마크다운으로 작성하세요...

[[링크]]를 사용하면 다른 노트와 연결됩니다."
                className={cn(
                  'w-full h-full px-3 py-2 text-sm resize-none outline-none font-mono',
                  isDark
                    ? 'bg-[#1e1e1e] text-zinc-200 placeholder:text-zinc-600'
                    : 'bg-white text-zinc-900 placeholder:text-zinc-400'
                )}
              />
            </div>

            {/* 푸터 - 저장 버튼 */}
            <div
              className={cn(
                'flex items-center justify-between px-3 py-2 border-t',
                isDark ? 'border-[#3c3c3c]' : 'border-zinc-200'
              )}
            >
              <span className="text-xs text-zinc-500">
                {content.length} characters
              </span>
              <button
                onClick={handleSave}
                disabled={!title.trim() || isSaving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  title.trim() && !isSaving
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-zinc-600 text-zinc-400 cursor-not-allowed'
                )}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
