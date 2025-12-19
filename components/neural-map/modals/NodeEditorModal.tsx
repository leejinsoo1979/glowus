'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { NODE_COLORS } from '@/lib/neural-map/constants'
import type { NodeType, NeuralNode } from '@/lib/neural-map/types'
import {
  X,
  Sparkles,
  Lightbulb,
  FolderOpen,
  FileText,
  CheckSquare,
  User,
  Brain,
  GitBranch,
  Zap,
  Loader2,
} from 'lucide-react'

interface NodeEditorModalProps {
  mapId: string | null
  onClose: () => void
  editingNode?: NeuralNode | null
}

const NODE_TYPE_OPTIONS: { value: NodeType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'concept', label: '개념', icon: <Brain className="w-4 h-4" />, description: '아이디어나 주제' },
  { value: 'project', label: '프로젝트', icon: <FolderOpen className="w-4 h-4" />, description: '진행 중인 프로젝트' },
  { value: 'doc', label: '문서', icon: <FileText className="w-4 h-4" />, description: '문서나 노트' },
  { value: 'idea', label: '아이디어', icon: <Lightbulb className="w-4 h-4" />, description: '떠오른 생각' },
  { value: 'decision', label: '의사결정', icon: <GitBranch className="w-4 h-4" />, description: '결정 사항' },
  { value: 'task', label: '할일', icon: <CheckSquare className="w-4 h-4" />, description: '해야 할 작업' },
  { value: 'person', label: '사람', icon: <User className="w-4 h-4" />, description: '관련 인물' },
  { value: 'insight', label: '인사이트', icon: <Sparkles className="w-4 h-4" />, description: 'AI가 발견한 인사이트' },
  { value: 'memory', label: '기억', icon: <Zap className="w-4 h-4" />, description: '기억이나 경험' },
]

export function NodeEditorModal({ mapId, onClose, editingNode }: NodeEditorModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const addNode = useNeuralMapStore((s) => s.addNode)
  const updateNode = useNeuralMapStore((s) => s.updateNode)
  const graph = useNeuralMapStore((s) => s.graph)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<NodeType>(editingNode?.type || 'concept')
  const [title, setTitle] = useState(editingNode?.title || '')
  const [summary, setSummary] = useState(editingNode?.summary || '')
  const [tags, setTags] = useState(editingNode?.tags?.join(', ') || '')
  const [importance, setImportance] = useState(editingNode?.importance || 5)
  const [parentId, setParentId] = useState(editingNode?.parentId || '')

  const isEditing = !!editingNode

  // 부모 노드 옵션 (Self 노드 포함)
  const parentOptions = graph?.nodes.filter((n) => n.id !== editingNode?.id) || []

  const handleSubmit = async () => {
    if (!mapId || !title.trim()) return

    setIsSubmitting(true)
    try {
      const nodeData = {
        type,
        title: title.trim(),
        summary: summary.trim() || undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        importance,
        parentId: parentId || undefined,
      }

      if (isEditing && editingNode) {
        // 노드 수정
        const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: editingNode.id, ...nodeData }),
        })

        if (!res.ok) throw new Error('Failed to update node')

        const updatedNode = await res.json()
        updateNode(editingNode.id, updatedNode)
      } else {
        // 새 노드 생성
        const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nodeData),
        })

        if (!res.ok) throw new Error('Failed to create node')

        const newNode = await res.json()
        addNode(newNode)
      }

      onClose()
    } catch (err) {
      console.error('Node save error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className={cn(
            'w-full max-w-lg rounded-xl shadow-2xl overflow-hidden',
            isDark ? 'bg-zinc-900' : 'bg-white'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={cn(
              'flex items-center justify-between px-5 py-4 border-b',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}
          >
            <h2 className={cn('text-lg font-semibold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
              {isEditing ? '노드 편집' : '새 노드 추가'}
            </h2>
            <button
              onClick={onClose}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Node Type */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                노드 타입
              </label>
              <div className="grid grid-cols-3 gap-2">
                {NODE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setType(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                      type === option.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDark
                        ? 'border-zinc-700 hover:border-zinc-600'
                        : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <div style={{ color: NODE_COLORS[option.value] }}>{option.icon}</div>
                    <span className={cn('text-xs font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="노드 제목을 입력하세요"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              />
            </div>

            {/* Summary */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                요약
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="간단한 설명을 입력하세요"
                rows={3}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              />
            </div>

            {/* Tags */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                태그
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="태그를 쉼표로 구분하여 입력"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              />
            </div>

            {/* Parent Node */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                상위 노드
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              >
                <option value="">없음 (루트 레벨)</option>
                {parentOptions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Importance */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                중요도: {importance}
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>낮음</span>
                <span>높음</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className={cn(
              'flex items-center justify-end gap-3 px-5 py-4 border-t',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}
          >
            <button
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              )}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                'bg-blue-600 hover:bg-blue-500 text-white',
                (!title.trim() || isSubmitting) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? '저장' : '추가'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
