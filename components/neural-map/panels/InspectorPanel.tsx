'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore, selectFirstSelectedNode } from '@/lib/neural-map/store'
import { NODE_COLORS } from '@/lib/neural-map/constants'
import type { RightPanelTab, NodeType } from '@/lib/neural-map/types'
import {
  Info,
  Zap,
  MessageSquare,
  Save,
  Trash2,
  Plus,
  Expand,
  Shrink,
  Link2,
  GitMerge,
  Pin,
  Layers,
  Calendar,
  Eye,
  X,
} from 'lucide-react'

const tabs: { id: RightPanelTab; label: string; icon: typeof Info }[] = [
  { id: 'inspector', label: 'Inspector', icon: Info },
  { id: 'actions', label: 'Actions', icon: Zap },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
]

const nodeTypes: { value: NodeType; label: string }[] = [
  { value: 'concept', label: '개념' },
  { value: 'project', label: '프로젝트' },
  { value: 'doc', label: '문서' },
  { value: 'idea', label: '아이디어' },
  { value: 'decision', label: '의사결정' },
  { value: 'memory', label: '기억' },
  { value: 'task', label: '할일' },
  { value: 'person', label: '사람' },
  { value: 'insight', label: '인사이트' },
]

function InspectorTab({ isDark }: { isDark: boolean }) {
  const selectedNode = useNeuralMapStore(selectFirstSelectedNode)
  const updateNode = useNeuralMapStore((s) => s.updateNode)
  const [tagInput, setTagInput] = useState('')

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <Info className="w-8 h-8 mx-auto text-zinc-500" />
          <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
            노드를 선택하세요
          </p>
        </div>
      </div>
    )
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !selectedNode.tags.includes(tagInput.trim())) {
      updateNode(selectedNode.id, {
        tags: [...selectedNode.tags, tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    updateNode(selectedNode.id, {
      tags: selectedNode.tags.filter((t) => t !== tag),
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div>
        <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          제목
        </label>
        <input
          type="text"
          value={selectedNode.title}
          onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors',
            isDark
              ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-zinc-600'
              : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-300'
          )}
        />
      </div>

      {/* Type */}
      <div>
        <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          타입
        </label>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: NODE_COLORS[selectedNode.type] }}
          />
          <select
            value={selectedNode.type}
            onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as NodeType })}
            disabled={selectedNode.type === 'self'}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 focus:border-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-300',
              selectedNode.type === 'self' && 'opacity-50 cursor-not-allowed'
            )}
          >
            {selectedNode.type === 'self' && <option value="self">Self (중심)</option>}
            {nodeTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          요약
        </label>
        <textarea
          value={selectedNode.summary || ''}
          onChange={(e) => updateNode(selectedNode.id, { summary: e.target.value })}
          placeholder="노드에 대한 간단한 설명..."
          rows={3}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors resize-none',
            isDark
              ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600'
              : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300'
          )}
        />
      </div>

      {/* Importance */}
      <div>
        <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          중요도: {selectedNode.importance}
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={selectedNode.importance}
          onChange={(e) => updateNode(selectedNode.id, { importance: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Tags */}
      <div>
        <label className={cn('text-xs font-medium mb-1.5 block', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          태그
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedNode.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full',
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
              )}
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="새 태그..."
            className={cn(
              'flex-1 px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300'
            )}
          />
          <button
            onClick={handleAddTag}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-colors',
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className={cn('pt-4 border-t space-y-2', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>생성:</span>
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
            {new Date(selectedNode.createdAt).toLocaleDateString('ko-KR')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Eye className="w-3.5 h-3.5 text-zinc-500" />
          <span className={isDark ? 'text-zinc-500' : 'text-zinc-500'}>조회:</span>
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
            {selectedNode.stats?.views || 0}회
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-4">
        <button
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          <Save className="w-4 h-4" />
          저장
        </button>
        <button
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400'
              : 'bg-zinc-200 hover:bg-red-100 text-zinc-600 hover:text-red-600'
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ActionsTab({ isDark }: { isDark: boolean }) {
  const selectedNode = useNeuralMapStore(selectFirstSelectedNode)
  const toggleNodeExpansion = useNeuralMapStore((s) => s.toggleNodeExpansion)
  const isExpanded = useNeuralMapStore((s) =>
    selectedNode ? s.expandedNodeIds.has(selectedNode.id) : false
  )

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <Zap className="w-8 h-8 mx-auto text-zinc-500" />
          <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
            노드를 선택하세요
          </p>
        </div>
      </div>
    )
  }

  const actions = [
    {
      icon: isExpanded ? Shrink : Expand,
      label: isExpanded ? '축소' : '확장',
      onClick: () => toggleNodeExpansion(selectedNode.id),
    },
    { icon: Plus, label: '자식 추가', onClick: () => {} },
    { icon: Link2, label: '연결', onClick: () => {} },
    { icon: GitMerge, label: '병합', onClick: () => {} },
    { icon: Pin, label: selectedNode.pinned ? '고정 해제' : '고정', onClick: () => {} },
    { icon: Layers, label: '클러스터', onClick: () => {} },
  ]

  return (
    <div className="p-4 space-y-2">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={action.onClick}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          )}
        >
          <action.icon className="w-4 h-4" />
          {action.label}
        </button>
      ))}
    </div>
  )
}

function ChatTab({ isDark }: { isDark: boolean }) {
  const selectedNode = useNeuralMapStore(selectFirstSelectedNode)
  const [message, setMessage] = useState('')

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedNode ? (
          <div className="space-y-3">
            <div
              className={cn(
                'p-3 rounded-lg text-sm',
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
              )}
            >
              <p className="font-medium mb-1">컨텍스트:</p>
              <p className="text-xs opacity-70">
                선택된 노드: {selectedNode.title} ({selectedNode.type})
              </p>
            </div>
            <p className={cn('text-sm text-center py-8', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
              이 노드에 대해 질문하세요
            </p>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-zinc-500" />
              <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                노드를 선택하면
                <br />
                AI와 대화할 수 있습니다
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className={cn('p-3 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="질문을 입력하세요..."
            disabled={!selectedNode}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300',
              !selectedNode && 'opacity-50 cursor-not-allowed'
            )}
          />
          <button
            disabled={!selectedNode || !message.trim()}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-blue-600 hover:bg-blue-500 text-white',
              (!selectedNode || !message.trim()) && 'opacity-50 cursor-not-allowed'
            )}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}

export function InspectorPanel() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const rightPanelTab = useNeuralMapStore((s) => s.rightPanelTab)
  const setRightPanelTab = useNeuralMapStore((s) => s.setRightPanelTab)

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className={cn('flex border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightPanelTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors relative',
              rightPanelTab === tab.id
                ? isDark
                  ? 'text-zinc-100'
                  : 'text-zinc-900'
                : isDark
                ? 'text-zinc-500 hover:text-zinc-300'
                : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {rightPanelTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === 'inspector' && <InspectorTab isDark={isDark} />}
        {rightPanelTab === 'actions' && <ActionsTab isDark={isDark} />}
        {rightPanelTab === 'chat' && <ChatTab isDark={isDark} />}
      </div>
    </div>
  )
}
