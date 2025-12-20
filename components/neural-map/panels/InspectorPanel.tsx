'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore, selectFirstSelectedNode } from '@/lib/neural-map/store'
import { useThemeStore, accentColors } from '@/stores/themeStore'
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
  Loader2,
  Settings2,
  Radius,
} from 'lucide-react'

const tabs: { id: RightPanelTab; label: string; icon: typeof Info }[] = [
  { id: 'inspector', label: 'Inspector', icon: Info },
  { id: 'actions', label: 'Actions', icon: Zap },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings2 },
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

function InspectorTab({ isDark, currentAccent }: { isDark: boolean; currentAccent: typeof accentColors[0] }) {
  const selectedNode = useNeuralMapStore(selectFirstSelectedNode)
  const updateNode = useNeuralMapStore((s) => s.updateNode)
  const deleteNode = useNeuralMapStore((s) => s.deleteNode)
  const mapId = useNeuralMapStore((s) => s.mapId)
  const deselectAll = useNeuralMapStore((s) => s.deselectAll)
  const [tagInput, setTagInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // API에 변경사항 저장
  const handleSave = async () => {
    if (!mapId || !selectedNode) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/nodes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          title: selectedNode.title,
          type: selectedNode.type,
          summary: selectedNode.summary,
          importance: selectedNode.importance,
          tags: selectedNode.tags,
        }),
      })

      if (!res.ok) throw new Error('Failed to save node')
    } catch (err) {
      console.error('Node save error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // 노드 삭제
  const handleDelete = async () => {
    if (!mapId || !selectedNode) return
    if (selectedNode.type === 'self') {
      alert('Self 노드는 삭제할 수 없습니다.')
      return
    }
    if (!confirm('이 노드를 삭제하시겠습니까?')) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/neural-map/${mapId}/nodes?nodeId=${selectedNode.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete node')

      deleteNode(selectedNode.id)
      deselectAll()
    } catch (err) {
      console.error('Node delete error:', err)
    } finally {
      setIsDeleting(false)
    }
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
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all text-white',
            isSaving && 'opacity-50 cursor-not-allowed'
          )}
          style={{ backgroundColor: currentAccent.color }}
          onMouseEnter={(e) => {
            if (!isSaving) e.currentTarget.style.backgroundColor = currentAccent.hoverColor
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = currentAccent.color
          }}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          저장
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting || selectedNode.type === 'self'}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-400'
              : 'bg-zinc-200 hover:bg-red-100 text-zinc-600 hover:text-red-600',
            (isDeleting || selectedNode.type === 'self') && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isDeleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
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

function ChatTab({ isDark, currentAccent }: { isDark: boolean; currentAccent: typeof accentColors[0] }) {
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
              'px-4 py-2 rounded-lg text-sm font-medium transition-all text-white',
              (!selectedNode || !message.trim()) && 'opacity-50 cursor-not-allowed'
            )}
            style={{ backgroundColor: currentAccent.color }}
            onMouseEnter={(e) => {
              if (selectedNode && message.trim()) e.currentTarget.style.backgroundColor = currentAccent.hoverColor
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = currentAccent.color
            }}
          >
            전송
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsTab({ isDark, currentAccent }: { isDark: boolean; currentAccent: typeof accentColors[0] }) {
  const radialDistance = useNeuralMapStore((s) => s.radialDistance)
  const setRadialDistance = useNeuralMapStore((s) => s.setRadialDistance)
  // graphExpanded - 노드 펼침/수축 (사이드바와 별개)
  const graphExpanded = useNeuralMapStore((s) => s.graphExpanded)
  const setGraphExpanded = useNeuralMapStore((s) => s.setGraphExpanded)
  // 파일트리 자동 펼침 위한 스토어 함수들
  const graph = useNeuralMapStore((s) => s.graph)
  const expandNode = useNeuralMapStore((s) => s.expandNode)
  const collapseNode = useNeuralMapStore((s) => s.collapseNode)
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)

  // 노드 펼침 토글 핸들러 - 전체 파일트리 펼침/접힘
  const handleGraphExpandedToggle = () => {
    const newExpanded = !graphExpanded
    setGraphExpanded(newExpanded)

    if (!graph) return

    // 폴더 노드들만 추출 (project, folder 타입 모두 폴더로 처리)
    const folderNodes = graph.nodes.filter(n => n.type === 'folder' || n.type === 'project' || n.type === 'self')

    if (newExpanded) {
      // 전체 펼치기
      folderNodes.forEach((node) => {
        expandNode(node.id)
      })
    } else {
      // 전체 접기 (self 제외)
      folderNodes.forEach(node => {
        if (node.type !== 'self') {
          collapseNode(node.id)
        }
      })
    }
  }

  // radialDistance 변경 시 파일트리 자동 펼침
  const handleRadialDistanceChange = (value: number) => {
    setRadialDistance(value)

    if (!graph) return

    // 폴더 노드들만 추출하고 계층 구조 정렬 (project, folder 타입 모두 폴더로 처리)
    const folderNodes = graph.nodes.filter(n => n.type === 'folder' || n.type === 'project' || n.type === 'self')

    // parentId를 기반으로 depth 계산
    const getDepth = (nodeId: string, nodes: typeof folderNodes, depth = 0): number => {
      const node = nodes.find(n => n.id === nodeId)
      if (!node || !node.parentId) return depth
      return getDepth(node.parentId, nodes, depth + 1)
    }

    // depth로 정렬
    const sortedFolders = folderNodes
      .map(node => ({ ...node, calculatedDepth: getDepth(node.id, folderNodes) }))
      .sort((a, b) => a.calculatedDepth - b.calculatedDepth)

    // radialDistance 비율에 따라 펼칠 폴더 개수 결정
    // 50~300 범위에서 0%~100%로 변환
    const ratio = (value - 50) / 250
    const foldersToExpand = Math.floor(sortedFolders.length * ratio)

    // 모든 폴더 먼저 접기
    sortedFolders.forEach(node => {
      if (expandedNodeIds.has(node.id) && node.type !== 'self') {
        collapseNode(node.id)
      }
    })

    // 비율에 따라 위에서부터 순차적으로 펼치기
    sortedFolders.slice(0, foldersToExpand + 1).forEach((node, index) => {
      // 약간의 딜레이로 순차적 효과
      setTimeout(() => {
        expandNode(node.id)
      }, index * 30)
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* Graph Layout Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Radius className="w-4 h-4 text-zinc-500" />
          <h3 className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            그래프 레이아웃
          </h3>
        </div>

        {/* Radial Distance Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
              방사 거리
            </label>
            <span
              className={cn(
                'text-xs font-mono px-2 py-0.5 rounded',
                isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
              )}
            >
              {radialDistance}
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={300}
            step={10}
            value={radialDistance}
            onChange={(e) => handleRadialDistanceChange(parseInt(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${currentAccent.color} 0%, ${currentAccent.color} ${((radialDistance - 50) / 250) * 100}%, ${isDark ? '#3f3f46' : '#e4e4e7'} ${((radialDistance - 50) / 250) * 100}%, ${isDark ? '#3f3f46' : '#e4e4e7'} 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>좁게</span>
            <span>넓게</span>
          </div>
        </div>

        {/* Graph Expanded Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
              노드 펼침
            </label>
            <button
              onClick={handleGraphExpandedToggle}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                graphExpanded
                  ? ''
                  : isDark
                  ? 'bg-zinc-700'
                  : 'bg-zinc-300'
              )}
              style={{
                backgroundColor: graphExpanded ? currentAccent.color : undefined,
              }}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
                  graphExpanded ? 'translate-x-4' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          <p className={cn('text-[10px]', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
            {graphExpanded ? '모든 폴더가 펼쳐집니다' : '모든 폴더가 접힙니다'}
          </p>
        </div>
      </div>

      {/* Presets Section */}
      <div className={cn('pt-4 border-t space-y-3', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <label className={cn('text-xs font-medium block', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
          빠른 설정
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '밀집', value: 50 },
            { label: '기본', value: 150 },
            { label: '확산', value: 250 },
          ].map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleRadialDistanceChange(preset.value)}
              className={cn(
                'px-3 py-2 text-xs rounded-lg font-medium transition-all',
                radialDistance === preset.value
                  ? 'text-white'
                  : isDark
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
              style={{
                backgroundColor: radialDistance === preset.value ? currentAccent.color : undefined,
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div
        className={cn(
          'p-3 rounded-lg text-xs',
          isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-100/50 text-zinc-500'
        )}
      >
        <p>💡 방사 거리 슬라이더를 움직이면 좌측 파일트리가 자동으로 펼쳐지면서 그래프 노드들이 확장됩니다.</p>
      </div>
    </div>
  )
}

export function InspectorPanel() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const rightPanelTab = useNeuralMapStore((s) => s.rightPanelTab)
  const setRightPanelTab = useNeuralMapStore((s) => s.setRightPanelTab)

  // 사용자 테마 색상 사용
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

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
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: currentAccent.color }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === 'inspector' && <InspectorTab isDark={isDark} currentAccent={currentAccent} />}
        {rightPanelTab === 'actions' && <ActionsTab isDark={isDark} />}
        {rightPanelTab === 'chat' && <ChatTab isDark={isDark} currentAccent={currentAccent} />}
        {rightPanelTab === 'settings' && <SettingsTab isDark={isDark} currentAccent={currentAccent} />}
      </div>
    </div>
  )
}
