'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { EdgeType } from '@/lib/neural-map/types'
import {
  X,
  GitBranch,
  Link,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Layers,
  ListOrdered,
  Loader2,
} from 'lucide-react'

interface EdgeEditorModalProps {
  mapId: string | null
  onClose: () => void
}

const EDGE_TYPE_OPTIONS: { value: EdgeType; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  { value: 'parent_child', label: '상위-하위', icon: <GitBranch className="w-4 h-4" />, description: '계층 관계', color: '#3B82F6' },
  { value: 'references', label: '참조', icon: <Link className="w-4 h-4" />, description: '참조 관계', color: '#0EA5E9' },
  { value: 'supports', label: '지지', icon: <ThumbsUp className="w-4 h-4" />, description: '지지/뒷받침', color: '#22c55e' },
  { value: 'contradicts', label: '반박', icon: <ThumbsDown className="w-4 h-4" />, description: '반박/충돌', color: '#ef4444' },
  { value: 'causes', label: '인과', icon: <ArrowRight className="w-4 h-4" />, description: '원인-결과', color: '#f59e0b' },
  { value: 'same_topic', label: '같은 주제', icon: <Layers className="w-4 h-4" />, description: '동일 토픽', color: '#06b6d4' },
  { value: 'sequence', label: '순서', icon: <ListOrdered className="w-4 h-4" />, description: '순차적 관계', color: '#14B8A6' },
]

export function EdgeEditorModal({ mapId, onClose }: EdgeEditorModalProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const addEdge = useNeuralMapStore((s) => s.addEdge)
  const graph = useNeuralMapStore((s) => s.graph)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sourceId, setSourceId] = useState(selectedNodeIds[0] || '')
  const [targetId, setTargetId] = useState(selectedNodeIds[1] || '')
  const [type, setType] = useState<EdgeType>('references')
  const [weight, setWeight] = useState(0.5)
  const [label, setLabel] = useState('')
  const [bidirectional, setBidirectional] = useState(false)

  const nodes = graph?.nodes || []

  const handleSubmit = async () => {
    if (!mapId || !sourceId || !targetId || sourceId === targetId) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/edges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          targetId,
          type,
          weight,
          label: label.trim() || undefined,
          bidirectional,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create edge')
      }

      const newEdge = await res.json()
      addEdge(newEdge)
      onClose()
    } catch (err) {
      console.error('Edge create error:', err)
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
              노드 연결 추가
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
            {/* Source Node */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                시작 노드 <span className="text-red-500">*</span>
              </label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              >
                <option value="">노드를 선택하세요</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Node */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                대상 노드 <span className="text-red-500">*</span>
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              >
                <option value="">노드를 선택하세요</option>
                {nodes.filter((n) => n.id !== sourceId).map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Edge Type */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                연결 타입
              </label>
              <div className="grid grid-cols-2 gap-2">
                {EDGE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setType(option.value)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left',
                      type === option.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : isDark
                        ? 'border-zinc-700 hover:border-zinc-600'
                        : 'border-zinc-200 hover:border-zinc-300'
                    )}
                  >
                    <div style={{ color: option.color }}>{option.icon}</div>
                    <div>
                      <div className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        {option.label}
                      </div>
                      <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        {option.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                라벨 (선택)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="연결에 대한 설명"
                className={cn(
                  'w-full px-3 py-2 rounded-lg border outline-none transition-colors',
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-100 focus:border-blue-500'
                    : 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                )}
              />
            </div>

            {/* Weight */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                연결 강도: {(weight * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-xs text-zinc-500 mt-1">
                <span>약함</span>
                <span>강함</span>
              </div>
            </div>

            {/* Bidirectional */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="bidirectional"
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 accent-blue-500"
              />
              <label
                htmlFor="bidirectional"
                className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}
              >
                양방향 연결
              </label>
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
              disabled={!sourceId || !targetId || sourceId === targetId || isSubmitting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                'bg-blue-600 hover:bg-blue-500 text-white',
                (!sourceId || !targetId || sourceId === targetId || isSubmitting) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              연결
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
