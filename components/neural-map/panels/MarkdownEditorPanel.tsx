'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useNeuralMapApi } from '@/lib/neural-map/useNeuralMapApi'
import {
  parseWikiLinks,
  extractTitle,
  extractTags,
  getDailyNoteFileName,
  getDailyNoteTemplate,
  NOTE_TEMPLATES,
  findBacklinks,
  type NoteTemplate,
} from '@/lib/neural-map/markdown-parser'
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
  Calendar,
  Hash,
  ArrowLeft,
  Sparkles,
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
  const [showTemplates, setShowTemplates] = useState(true) // 처음엔 템플릿 선택 화면
  const [selectedTemplate, setSelectedTemplate] = useState<NoteTemplate | null>(null)
  const [extractedTags, setExtractedTags] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mapId = useNeuralMapStore((s) => s.mapId)
  const graph = useNeuralMapStore((s) => s.graph)
  const projectPath = useNeuralMapStore((s) => s.projectPath)
  const linkedProjectId = useNeuralMapStore((s) => s.linkedProjectId)
  const files = useNeuralMapStore((s) => s.files)
  const setFiles = useNeuralMapStore((s) => s.setFiles)
  const buildGraphFromFilesAsync = useNeuralMapStore((s) => s.buildGraphFromFilesAsync)
  const { createNode, createEdge } = useNeuralMapApi(mapId)

  // 콘텐츠에서 태그 추출
  useEffect(() => {
    const tags = extractTags(content)
    setExtractedTags(tags)
  }, [content])

  // 리셋
  const resetEditor = useCallback(() => {
    setTitle('')
    setContent('')
    setShowTemplates(true)
    setSelectedTemplate(null)
    setExtractedTags([])
  }, [])

  // 템플릿 선택
  const handleSelectTemplate = useCallback((template: NoteTemplate) => {
    setSelectedTemplate(template)
    setShowTemplates(false)

    if (template.id === 'daily') {
      // Daily Note는 제목 자동 설정
      const today = new Date()
      setTitle(getDailyNoteFileName(today).replace('.md', ''))
      setContent(getDailyNoteTemplate(today))
    } else if (template.id === 'blank') {
      setTitle('')
      setContent('')
    } else {
      setContent(template.content)
    }

    // 에디터에 포커스
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [])

  // Daily Note 바로 생성
  const handleCreateDailyNote = useCallback(() => {
    const dailyTemplate = NOTE_TEMPLATES.find(t => t.id === 'daily')
    if (dailyTemplate) {
      handleSelectTemplate(dailyTemplate)
    }
  }, [handleSelectTemplate])

  // 저장 - 파일 상태 업데이트를 패널 닫힘 애니메이션 이후로 지연
  const handleSave = useCallback(async () => {
    if (!title.trim()) return

    // 로컬 폴더도 없고 클라우드 프로젝트도 없으면 경고
    if (!projectPath && !linkedProjectId && !mapId) {
      alert('프로젝트를 먼저 선택하거나 생성해주세요.')
      return
    }

    setIsSaving(true)
    try {
      // 파일명 생성 (특수문자 제거)
      const sanitizedTitle = title.trim().replace(/[<>:"/\\|?*]/g, '-')
      const fileName = `${sanitizedTitle}.md`

      // 마크다운 파일 내용 생성 (제목이 없으면 추가)
      let fileContent = content
      if (!content.startsWith('---') && !content.match(/^#\s+/m)) {
        fileContent = `# ${title.trim()}\n\n${content}`
      }

      // 저장할 파일 데이터를 미리 준비
      let pendingFileUpdate: typeof files[0] | null = null

      // 1. 프로젝트 폴더가 있으면 실제 파일로 저장
      if (projectPath && window.electron?.fs?.writeFile) {
        const filePath = `${projectPath}/${fileName}`

        try {
          await window.electron.fs.writeFile(filePath, fileContent)
          console.log('[Note] Saved to file:', filePath)

          // 파일 데이터 준비 (나중에 추가)
          pendingFileUpdate = {
            id: `local-${Date.now()}`,
            name: fileName,
            path: fileName,
            type: 'markdown' as const,
            content: fileContent,
            size: fileContent.length,
            createdAt: new Date().toISOString(),
            mapId: mapId || '',
            url: '',
          }

          // fs:changed 이벤트 발송 (파일 워처가 감지하도록)
          window.dispatchEvent(new CustomEvent('note-saved', { detail: { path: filePath } }))
        } catch (fsErr) {
          console.error('[Note] File save failed:', fsErr)
        }
      }

      // 2. 클라우드 프로젝트 또는 projectPath 없이 linkedProjectId만 있는 경우
      if (!projectPath && linkedProjectId) {
        pendingFileUpdate = {
          id: `note-${Date.now()}`,
          name: fileName,
          path: fileName,
          type: 'markdown' as const,
          content: fileContent,
          size: fileContent.length,
          createdAt: new Date().toISOString(),
          mapId: mapId || '',
          url: '',
        }
      }

      // 3. 클라우드 프로젝트가 있으면 API로 노드 생성
      if (mapId || linkedProjectId) {
        // 태그 추출 (frontmatter + inline tags)
        const allTags = ['markdown', 'note', ...extractedTags]

        const newNode = await createNode({
          type: 'doc',
          title: title.trim(),
          content: content,
          summary: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          tags: allTags,
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
      }

      resetEditor()

      // 먼저 패널을 닫고, 애니메이션 완료 후 파일 상태 업데이트
      onClose()

      if (pendingFileUpdate) {
        const fileToAdd = pendingFileUpdate
        setTimeout(() => {
          setFiles([...files, fileToAdd])
        }, 300)
      }
    } catch (err) {
      console.error('노트 저장 실패:', err)
    } finally {
      setIsSaving(false)
    }
  }, [title, content, mapId, projectPath, linkedProjectId, graph, files, extractedTags, createNode, createEdge, setFiles, resetEditor, onClose])

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
    { icon: Bold, action: () => insertMarkdown('**', '**'), title: 'Bold (Cmd+B)' },
    { icon: Italic, action: () => insertMarkdown('*', '*'), title: 'Italic (Cmd+I)' },
    { icon: Code, action: () => insertMarkdown('`', '`'), title: 'Code' },
    { icon: Quote, action: () => insertMarkdown('> '), title: 'Quote' },
    { icon: List, action: () => insertMarkdown('- '), title: 'Bullet List' },
    { icon: ListOrdered, action: () => insertMarkdown('1. '), title: 'Numbered List' },
    { icon: Link2, action: () => insertMarkdown('[[', ']]'), title: 'Wiki Link' },
    { icon: Hash, action: () => insertMarkdown('#'), title: 'Tag' },
    { icon: Minus, action: () => insertMarkdown('\n---\n'), title: 'Divider' },
  ]

  // 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || showTemplates) return

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'b') {
          e.preventDefault()
          insertMarkdown('**', '**')
        } else if (e.key === 'i') {
          e.preventDefault()
          insertMarkdown('*', '*')
        } else if (e.key === 's') {
          e.preventDefault()
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showTemplates, insertMarkdown, handleSave])

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: isCollapsed ? 40 : 420, opacity: 1 }}
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
          ) : showTemplates ? (
            // 템플릿 선택 화면
            <>
              {/* 헤더 */}
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2 border-b flex-shrink-0',
                  isDark ? 'border-[#3c3c3c]' : 'border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium">새 노트 만들기</span>
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

              {/* Daily Note 빠른 버튼 */}
              <div className={cn('px-3 py-3 border-b', isDark ? 'border-[#3c3c3c]' : 'border-zinc-200')}>
                <button
                  onClick={handleCreateDailyNote}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                    'bg-gradient-to-r from-blue-500/10 to-purple-500/10',
                    'hover:from-blue-500/20 hover:to-purple-500/20',
                    'border',
                    isDark ? 'border-blue-500/30' : 'border-blue-500/40'
                  )}
                >
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <div className="text-left">
                    <div className="text-sm font-medium">오늘의 Daily Note</div>
                    <div className="text-xs text-zinc-500">{getDailyNoteFileName()}</div>
                  </div>
                </button>
              </div>

              {/* 템플릿 목록 */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="text-xs text-zinc-500 mb-2 px-1">템플릿 선택</div>
                <div className="space-y-2">
                  {NOTE_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                        isDark ? 'hover:bg-[#2d2d2d]' : 'hover:bg-zinc-100'
                      )}
                    >
                      <span className="text-lg">{template.icon}</span>
                      <span className="text-sm">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // 에디터 화면
            <>
              {/* 헤더 */}
              <div
                className={cn(
                  'flex items-center justify-between px-3 py-2 border-b flex-shrink-0',
                  isDark ? 'border-[#3c3c3c]' : 'border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTemplates(true)}
                    className={cn(
                      'p-1 rounded transition-colors',
                      isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
                    )}
                    title="템플릿으로 돌아가기"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-lg">{selectedTemplate?.icon || '📄'}</span>
                  <span className="text-sm font-medium">{selectedTemplate?.name || 'New Note'}</span>
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
                    'no-focus-ring w-full px-2 py-1.5 text-sm rounded border outline-none transition-colors',
                    isDark
                      ? 'bg-[#2d2d2d] border-[#3c3c3c] text-zinc-200 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
              </div>

              {/* 태그 표시 */}
              {extractedTags.length > 0 && (
                <div className={cn('px-3 py-1.5 border-b flex flex-wrap gap-1', isDark ? 'border-[#3c3c3c]' : 'border-zinc-200')}>
                  {extractedTags.map((tag, i) => (
                    <span
                      key={i}
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded',
                        isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'
                      )}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

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

[[위키링크]]로 다른 노트와 연결
#태그로 분류"
                  className={cn(
                    'no-focus-ring w-full h-full px-3 py-2 text-sm resize-none outline-none font-mono leading-relaxed',
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
                  {content.length} chars · {content.split('\n').length} lines
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
      )}
    </AnimatePresence>
  )
}
