'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  Search,
  Filter,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Route,
  Boxes,
  GitBranch,
  Circle,
  FileText,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react'

// Dynamic import for Three.js (no SSR)
const GraphRenderer = dynamic(() => import('./GraphRenderer'), { ssr: false })
import type {
  BrainMapTab,
  BrainMapState,
  BrainNode,
  BrainEdge,
  NodeType,
} from '@/types/brain-map'

// ============================================
// Types
// ============================================

interface BrainMapLayoutProps {
  agentId: string
  isDark: boolean
}

interface TabConfig {
  id: BrainMapTab
  label: string
  icon: React.ElementType
  description: string
}

// ============================================
// Constants
// ============================================

const TABS: TabConfig[] = [
  { id: 'pathfinder', label: 'Pathfinder', icon: Route, description: '경로 탐색' },
  { id: 'clusters', label: 'Clusters', icon: Boxes, description: '주제 군집' },
  { id: 'roadmap', label: 'Roadmap', icon: GitBranch, description: '흐름 로드뷰' },
  { id: 'radial', label: 'Radial Map', icon: Circle, description: '방사형 연관' },
  { id: 'insights', label: 'Insights', icon: FileText, description: '분석 리포트' },
]

const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: 'memory', label: '메모리' },
  { value: 'concept', label: '개념' },
  { value: 'person', label: '인물' },
  { value: 'doc', label: '문서' },
  { value: 'task', label: '태스크' },
  { value: 'decision', label: '결정' },
  { value: 'meeting', label: '회의' },
  { value: 'tool', label: '도구' },
  { value: 'skill', label: '스킬' },
]

// ============================================
// Color Utilities
// ============================================

function useThemeColors() {
  const { accentColor } = useThemeStore()
  return useMemo(() => {
    const accent = accentColors.find(c => c.id === accentColor) || accentColors[0]
    return {
      accent: accent.color,
      accentHover: accent.hoverColor,
      accentRgb: accent.rgb,
    }
  }, [accentColor])
}

// ============================================
// Filter Panel Component
// ============================================

function FilterPanel({
  state,
  onStateChange,
  isDark,
  onClose,
}: {
  state: BrainMapState
  onStateChange: (state: Partial<BrainMapState>) => void
  isDark: boolean
  onClose: () => void
}) {
  const colors = useThemeColors()

  const toggleNodeType = (type: NodeType) => {
    const current = state.filters.nodeTypes || []
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    onStateChange({
      filters: { ...state.filters, nodeTypes: updated.length > 0 ? updated : undefined },
    })
  }

  return (
    <div
      className={cn(
        'absolute top-16 right-4 w-72 p-4 rounded-xl border shadow-2xl z-30 backdrop-blur-lg',
        isDark ? 'bg-zinc-900/95 border-zinc-700' : 'bg-white/95 border-zinc-200'
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" style={{ color: colors.accent }} />
          <span className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            필터
          </span>
        </div>
        <button
          onClick={onClose}
          className={cn(
            'p-1 rounded-lg transition-colors',
            isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 노드 타입 필터 */}
      <div className="mb-4">
        <label className={cn('text-xs font-medium mb-2 block', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          노드 타입
        </label>
        <div className="flex flex-wrap gap-1.5">
          {NODE_TYPE_OPTIONS.map(opt => {
            const isActive = state.filters.nodeTypes?.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => toggleNodeType(opt.value)}
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-400'
                      : 'bg-zinc-100 text-zinc-600'
                )}
                style={isActive ? { backgroundColor: colors.accent } : {}}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 기간 필터 */}
      <div>
        <label className={cn('text-xs font-medium mb-2 block', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          <Calendar className="w-3 h-3 inline mr-1" />
          기간
        </label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { days: 0, label: '전체' },
            { days: 7, label: '7일' },
            { days: 30, label: '30일' },
            { days: 90, label: '90일' },
          ].map(opt => {
            const isActive = !state.filters.dateRange && opt.days === 0 ||
              (state.filters.dateRange &&
               Date.now() - state.filters.dateRange.from <= opt.days * 86400000 + 1000)
            return (
              <button
                key={opt.days}
                onClick={() => {
                  if (opt.days === 0) {
                    onStateChange({ filters: { ...state.filters, dateRange: undefined } })
                  } else {
                    onStateChange({
                      filters: {
                        ...state.filters,
                        dateRange: { from: Date.now() - opt.days * 86400000, to: Date.now() },
                      },
                    })
                  }
                }}
                className={cn(
                  'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
                style={isActive ? { backgroundColor: colors.accent } : {}}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Inspector Panel Component
// ============================================

function InspectorPanel({
  selectedNode,
  selectedEdge,
  isDark,
  onClose,
}: {
  selectedNode: BrainNode | null
  selectedEdge: BrainEdge | null
  isDark: boolean
  onClose: () => void
}) {
  const colors = useThemeColors()

  if (!selectedNode && !selectedEdge) {
    return (
      <div
        className={cn(
          'h-full flex flex-col items-center justify-center p-6',
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        )}
      >
        <Circle className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm text-center">노드나 엣지를 선택하면<br />상세 정보가 표시됩니다</p>
      </div>
    )
  }

  if (selectedNode) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            노드 상세
          </h3>
          <button
            onClick={onClose}
            className={cn(
              'p-1 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${colors.accent}20`, color: colors.accent }}
            >
              {selectedNode.type}
            </span>
          </div>

          <div>
            <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>제목</label>
            <p className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
              {selectedNode.title}
            </p>
          </div>

          {selectedNode.summary && (
            <div>
              <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>요약</label>
              <p className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                {selectedNode.summary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>중요도</label>
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn('w-2 h-2 rounded-full')}
                    style={{
                      backgroundColor: i < selectedNode.importance ? colors.accent : (isDark ? '#3f3f46' : '#e4e4e7'),
                    }}
                  />
                ))}
              </div>
            </div>
            {selectedNode.confidence !== undefined && (
              <div>
                <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>신뢰도</label>
                <p className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                  {Math.round(selectedNode.confidence * 100)}%
                </p>
              </div>
            )}
          </div>

          {selectedNode.tags && selectedNode.tags.length > 0 && (
            <div>
              <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>태그</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedNode.tags.map(tag => (
                  <span
                    key={tag}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs',
                      isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                    )}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>생성일</label>
            <p className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              {new Date(selectedNode.createdAt).toLocaleString('ko-KR')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ============================================
// Status Bar Component
// ============================================

function StatusBar({
  nodeCount,
  edgeCount,
  isLoading,
  fps,
  isDark,
}: {
  nodeCount: number
  edgeCount: number
  isLoading: boolean
  fps: number
  isDark: boolean
}) {
  const colors = useThemeColors()

  return (
    <div
      className={cn(
        'h-8 px-4 flex items-center justify-between text-xs border-t',
        isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-400' : 'bg-white/80 border-zinc-200 text-zinc-500'
      )}
    >
      <div className="flex items-center gap-4">
        <span>노드: <strong style={{ color: colors.accent }}>{nodeCount.toLocaleString()}</strong></span>
        <span>엣지: <strong style={{ color: colors.accent }}>{edgeCount.toLocaleString()}</strong></span>
      </div>
      <div className="flex items-center gap-4">
        {isLoading && (
          <span className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Loading...
          </span>
        )}
        <span>FPS: <strong className={fps < 30 ? 'text-red-500' : ''}>{fps}</strong></span>
      </div>
    </div>
  )
}

// ============================================
// Main Layout Component
// ============================================

export function BrainMapLayout({ agentId, isDark }: BrainMapLayoutProps) {
  const colors = useThemeColors()
  const [showFilter, setShowFilter] = useState(false)
  const [showInspector, setShowInspector] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [state, setState] = useState<BrainMapState>({
    activeTab: 'clusters',
    selectedNodeId: null,
    selectedEdgeId: null,
    hoveredNodeId: null,
    isLoading: false,
    expandingNodeId: null,
    anchorNodeId: null,
    radialDepth: 2,
    filters: {},
  })

  // 그래프 데이터
  const [nodes, setNodes] = useState<BrainNode[]>([])
  const [edges, setEdges] = useState<BrainEdge[]>([])
  const [fps, setFps] = useState(60)

  // Callbacks (useEffect 전에 정의)
  const handleStateChange = useCallback((partial: Partial<BrainMapState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // API에서 데이터 로드
  useEffect(() => {
    const fetchGraph = async () => {
      setState(prev => ({ ...prev, isLoading: true }))
      try {
        const res = await fetch(`/api/agents/${agentId}/brain/graph?limit=100`)
        if (res.ok) {
          const data = await res.json()
          setNodes(data.nodes || [])
          setEdges(data.edges || [])
        }
      } catch (err) {
        console.error('[BrainMapLayout] Failed to load graph:', err)
      } finally {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }
    fetchGraph()
  }, [agentId])

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === state.selectedNodeId) || null
  }, [nodes, state.selectedNodeId])

  const selectedEdge = useMemo(() => {
    return edges.find(e => e.id === state.selectedEdgeId) || null
  }, [edges, state.selectedEdgeId])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    handleStateChange({ filters: { ...state.filters, searchQuery } })
  }, [searchQuery, state.filters, handleStateChange])

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-xl border overflow-hidden',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}
    >
      {/* 상단 탭 + 필터 */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
        )}
      >
        {/* 탭 */}
        <div className="flex items-center gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = state.activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleStateChange({ activeTab: tab.id })}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'text-white'
                    : isDark
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
                )}
                style={isActive ? { backgroundColor: colors.accent } : {}}
                title={tab.description}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* 검색 + 필터 + 전체화면 */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="relative">
            <Search className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            )} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="노드 검색..."
              className={cn(
                'w-48 pl-9 pr-3 py-1.5 rounded-lg text-sm border',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
              )}
            />
          </form>

          <button
            onClick={() => setShowFilter(!showFilter)}
            className={cn(
              'p-2 rounded-lg transition-all',
              showFilter
                ? 'text-white'
                : isDark
                  ? 'text-zinc-400 hover:bg-zinc-800'
                  : 'text-zinc-500 hover:bg-zinc-100'
            )}
            style={showFilter ? { backgroundColor: colors.accent } : {}}
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowInspector(!showInspector)}
            className={cn(
              'p-2 rounded-lg transition-all',
              isDark
                ? 'text-zinc-400 hover:bg-zinc-800'
                : 'text-zinc-500 hover:bg-zinc-100'
            )}
          >
            {showInspector ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={cn(
              'p-2 rounded-lg transition-all',
              isDark
                ? 'text-zinc-400 hover:bg-zinc-800'
                : 'text-zinc-500 hover:bg-zinc-100'
            )}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* 좌측: 3D 뷰포트 */}
        <div className="flex-1 relative">
          {/* 3D 렌더러 */}
          <GraphRenderer
            nodes={nodes}
            edges={edges}
            selectedNodeId={state.selectedNodeId}
            hoveredNodeId={state.hoveredNodeId}
            isDark={isDark}
            onNodeClick={(nodeId) => handleStateChange({ selectedNodeId: nodeId, selectedEdgeId: null })}
            onNodeHover={(nodeId) => handleStateChange({ hoveredNodeId: nodeId })}
            onFpsUpdate={setFps}
          />

          {/* 로딩 표시 */}
          {state.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.accent }} />
            </div>
          )}

          {/* 필터 패널 */}
          {showFilter && (
            <FilterPanel
              state={state}
              onStateChange={handleStateChange}
              isDark={isDark}
              onClose={() => setShowFilter(false)}
            />
          )}
        </div>

        {/* 우측: 인스펙터 패널 */}
        {showInspector && (
          <div
            className={cn(
              'w-80 border-l overflow-y-auto',
              isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/50 border-zinc-200'
            )}
          >
            <InspectorPanel
              selectedNode={selectedNode}
              selectedEdge={selectedEdge}
              isDark={isDark}
              onClose={() => handleStateChange({ selectedNodeId: null, selectedEdgeId: null })}
            />
          </div>
        )}
      </div>

      {/* 하단 상태바 */}
      <StatusBar
        nodeCount={nodes.length}
        edgeCount={edges.length}
        isLoading={state.isLoading}
        fps={fps}
        isDark={isDark}
      />
    </div>
  )
}

export default BrainMapLayout
