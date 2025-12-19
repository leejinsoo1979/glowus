'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import {
  Brain,
  Users,
  MessageSquare,
  BookOpen,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Filter,
  X,
  Calendar,
  Tag,
  Folder,
  Star,
  Loader2,
} from 'lucide-react'

// react-force-graph-3d는 SSR에서 작동하지 않으므로 동적 import
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
    </div>
  ),
})

// ============================================
// Types
// ============================================

export type MemoryNodeType = 'private' | 'meeting' | 'team' | 'injected' | 'execution'

export interface GraphNode {
  id: string
  type: MemoryNodeType
  label: string
  importance: number // 1-10
  tags: string[]
  project?: string
  created_at: string
  // Force graph에서 사용하는 속성
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
  val?: number
  color?: string
}

export interface GraphEdge {
  source: string
  target: string
  type: 'co-occurrence' | 'causal' | 'reference' | 'participation'
  weight: number // 0-1
}

export interface KnowledgeGraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface KnowledgeGraph3DProps {
  data: KnowledgeGraphData
  isDark?: boolean
  height?: number
  onNodeClick?: (node: GraphNode) => void
  onNodeHover?: (node: GraphNode | null) => void
  className?: string
}

interface FilterState {
  types: MemoryNodeType[]
  minImportance: number
  dateRange: 'all' | '7d' | '30d' | '90d'
  project?: string
}

// ============================================
// Constants
// ============================================

const NODE_TYPE_CONFIG: Record<MemoryNodeType, {
  color: string
  emissive: string
  icon: React.ElementType
  label: string
}> = {
  private: { color: '#3b82f6', emissive: '#1d4ed8', icon: MessageSquare, label: '개인 대화' },
  meeting: { color: '#22c55e', emissive: '#15803d', icon: Users, label: '회의' },
  team: { color: '#f59e0b', emissive: '#b45309', icon: Users, label: '팀' },
  injected: { color: '#8b5cf6', emissive: '#6d28d9', icon: BookOpen, label: '지식' },
  execution: { color: '#ef4444', emissive: '#b91c1c', icon: Zap, label: '실행' },
}

const EDGE_TYPE_CONFIG: Record<string, { color: string; opacity: number }> = {
  'co-occurrence': { color: '#64748b', opacity: 0.3 },
  'causal': { color: '#f59e0b', opacity: 0.5 },
  'reference': { color: '#3b82f6', opacity: 0.4 },
  'participation': { color: '#22c55e', opacity: 0.4 },
}

// ============================================
// Filter Panel Component
// ============================================

function FilterPanel({
  filter,
  onFilterChange,
  projects,
  isDark,
  onClose,
}: {
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  projects: string[]
  isDark: boolean
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        'absolute top-4 right-4 w-72 p-4 rounded-xl border shadow-2xl z-20 backdrop-blur-lg',
        isDark ? 'bg-zinc-900/95 border-zinc-700' : 'bg-white/95 border-zinc-200'
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-violet-500" />
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
          <Tag className="w-3 h-3 inline mr-1" />
          노드 타입
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => {
            const isActive = filter.types.includes(type as MemoryNodeType)
            return (
              <button
                key={type}
                onClick={() => {
                  const newTypes = isActive
                    ? filter.types.filter(t => t !== type)
                    : [...filter.types, type as MemoryNodeType]
                  onFilterChange({ ...filter, types: newTypes })
                }}
                className={cn(
                  'px-2 py-1 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'text-white'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-400'
                      : 'bg-zinc-100 text-zinc-600'
                )}
                style={isActive ? { backgroundColor: config.color } : {}}
              >
                {config.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 중요도 필터 */}
      <div className="mb-4">
        <label className={cn('text-xs font-medium mb-2 block', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          <Star className="w-3 h-3 inline mr-1" />
          최소 중요도: {filter.minImportance}
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={filter.minImportance}
          onChange={(e) => onFilterChange({ ...filter, minImportance: Number(e.target.value) })}
          className="w-full accent-violet-500"
        />
      </div>

      {/* 기간 필터 */}
      <div className="mb-4">
        <label className={cn('text-xs font-medium mb-2 block', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          <Calendar className="w-3 h-3 inline mr-1" />
          기간
        </label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { value: 'all', label: '전체' },
            { value: '7d', label: '7일' },
            { value: '30d', label: '30일' },
            { value: '90d', label: '90일' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => onFilterChange({ ...filter, dateRange: option.value as FilterState['dateRange'] })}
              className={cn(
                'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                filter.dateRange === option.value
                  ? 'bg-violet-500 text-white'
                  : isDark
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* 프로젝트 필터 */}
      {projects.length > 0 && (
        <div>
          <label className={cn('text-xs font-medium mb-2 block', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            <Folder className="w-3 h-3 inline mr-1" />
            프로젝트
          </label>
          <select
            value={filter.project || ''}
            onChange={(e) => onFilterChange({ ...filter, project: e.target.value || undefined })}
            className={cn(
              'w-full px-3 py-2 rounded-lg text-sm border',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white'
                : 'bg-white border-zinc-200 text-zinc-900'
            )}
          >
            <option value="">전체 프로젝트</option>
            {projects.map(project => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ============================================
// Node Detail Panel Component
// ============================================

function NodeDetailPanel({
  node,
  isDark,
  onClose,
}: {
  node: GraphNode
  isDark: boolean
  onClose: () => void
}) {
  const config = NODE_TYPE_CONFIG[node.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'absolute bottom-4 left-4 w-80 p-4 rounded-xl border shadow-2xl z-20 backdrop-blur-lg',
        isDark ? 'bg-zinc-900/95 border-zinc-700' : 'bg-white/95 border-zinc-200'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>
          <div>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${config.color}20`, color: config.color }}
            >
              {config.label}
            </span>
          </div>
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

      <h4 className={cn('font-semibold mb-2', isDark ? 'text-white' : 'text-zinc-900')}>
        {node.label}
      </h4>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>중요도</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full',
                  i < node.importance ? '' : isDark ? 'bg-zinc-700' : 'bg-zinc-200'
                )}
                style={i < node.importance ? { backgroundColor: config.color } : {}}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>생성일</span>
          <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
            {new Date(node.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>

        {node.project && (
          <div className="flex items-center justify-between text-sm">
            <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>프로젝트</span>
            <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>{node.project}</span>
          </div>
        )}

        {node.tags.length > 0 && (
          <div className="pt-2">
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>태그</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {node.tags.map(tag => (
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
      </div>
    </div>
  )
}

// ============================================
// Main 3D Graph Component
// ============================================

export function KnowledgeGraph3D({
  data,
  isDark = false,
  height = 500,
  onNodeClick,
  onNodeHover,
  className,
}: KnowledgeGraph3DProps) {
  const graphRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [filter, setFilter] = useState<FilterState>({
    types: ['private', 'meeting', 'team', 'injected', 'execution'],
    minImportance: 1,
    dateRange: 'all',
  })

  // 필터된 데이터
  const filteredData = useMemo(() => {
    const now = new Date()
    const dateThresholds: Record<string, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
    }

    const filteredNodes = data.nodes.filter(node => {
      // 타입 필터
      if (!filter.types.includes(node.type)) return false

      // 중요도 필터
      if (node.importance < filter.minImportance) return false

      // 기간 필터
      if (filter.dateRange !== 'all') {
        const nodeDate = new Date(node.created_at)
        const threshold = dateThresholds[filter.dateRange]
        if (now.getTime() - nodeDate.getTime() > threshold) return false
      }

      // 프로젝트 필터
      if (filter.project && node.project !== filter.project) return false

      return true
    })

    const nodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = data.edges.filter(
      edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    )

    return {
      nodes: filteredNodes.map(node => ({
        ...node,
        val: 2 + node.importance * 0.5, // 노드 크기
        color: NODE_TYPE_CONFIG[node.type].color,
      })),
      links: filteredEdges.map(edge => ({
        source: edge.source,
        target: edge.target,
        color: EDGE_TYPE_CONFIG[edge.type]?.color || '#64748b',
        opacity: edge.weight * (EDGE_TYPE_CONFIG[edge.type]?.opacity || 0.3),
      })),
    }
  }, [data, filter])

  // 프로젝트 목록
  const projects = useMemo(() => {
    const projectSet = new Set(data.nodes.map(n => n.project).filter(Boolean) as string[])
    return Array.from(projectSet)
  }, [data.nodes])

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node as GraphNode)
    onNodeClick?.(node as GraphNode)

    // 카메라 이동
    if (graphRef.current) {
      const distance = 100
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1000
      )
    }
  }, [onNodeClick])

  // 노드 호버 핸들러
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node as GraphNode | null)
    onNodeHover?.(node as GraphNode | null)
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default'
    }
  }, [onNodeHover])

  // 컨트롤 함수들
  const zoomIn = () => {
    if (graphRef.current) {
      const { x, y, z } = graphRef.current.cameraPosition()
      graphRef.current.cameraPosition({ x: x * 0.8, y: y * 0.8, z: z * 0.8 })
    }
  }

  const zoomOut = () => {
    if (graphRef.current) {
      const { x, y, z } = graphRef.current.cameraPosition()
      graphRef.current.cameraPosition({ x: x * 1.2, y: y * 1.2, z: z * 1.2 })
    }
  }

  const resetCamera = () => {
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000)
    }
  }

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        containerRef.current.requestFullscreen()
      }
    }
  }

  // 노드 3D 오브젝트 생성
  const nodeThreeObject = useCallback((node: any) => {
    const config = NODE_TYPE_CONFIG[node.type as MemoryNodeType] || NODE_TYPE_CONFIG.private

    // Sphere geometry with more segments for smoother look
    const geometry = new THREE.SphereGeometry(node.val || 5, 32, 32)
    const material = new THREE.MeshPhongMaterial({
      color: config.color,
      emissive: config.emissive,
      emissiveIntensity: 0.4,
      shininess: 150,
      transparent: true,
      opacity: 0.95,
    })

    const sphere = new THREE.Mesh(geometry, material)

    // 외부 글로우 효과
    const glowGeometry = new THREE.SphereGeometry((node.val || 5) * 1.4, 24, 24)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.2,
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    sphere.add(glow)

    // 내부 코어 글로우
    const coreGeometry = new THREE.SphereGeometry((node.val || 5) * 0.5, 16, 16)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.3,
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    sphere.add(core)

    return sphere
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative rounded-xl overflow-hidden', className)}
      style={{ height }}
    >
      {/* 배경 */}
      <div
        className={cn(
          'absolute inset-0',
          isDark
            ? 'bg-gradient-to-br from-zinc-900 via-zinc-950 to-black'
            : 'bg-gradient-to-br from-zinc-100 via-zinc-50 to-white'
        )}
      />

      {/* 3D 그래프 */}
      <ForceGraph3D
        ref={graphRef}
        graphData={filteredData}
        nodeLabel={(node: any) => node.label}
        nodeColor={(node: any) => node.color}
        nodeVal={(node: any) => node.val}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={(link: any) => link.color}
        linkOpacity={0.3}
        linkWidth={(link: any) => link.opacity * 2}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1}
        linkDirectionalParticleSpeed={0.005}
        backgroundColor="rgba(0,0,0,0)"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
      />

      {/* 컨트롤 버튼들 */}
      <div
        className={cn(
          'absolute top-4 left-4 flex flex-col gap-2 z-10'
        )}
      >
        <button
          onClick={zoomIn}
          className={cn(
            'p-2 rounded-lg transition-all',
            isDark
              ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              : 'bg-white/80 hover:bg-zinc-100 text-zinc-700',
            'backdrop-blur-sm shadow-lg'
          )}
          title="확대"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className={cn(
            'p-2 rounded-lg transition-all',
            isDark
              ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              : 'bg-white/80 hover:bg-zinc-100 text-zinc-700',
            'backdrop-blur-sm shadow-lg'
          )}
          title="축소"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetCamera}
          className={cn(
            'p-2 rounded-lg transition-all',
            isDark
              ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              : 'bg-white/80 hover:bg-zinc-100 text-zinc-700',
            'backdrop-blur-sm shadow-lg'
          )}
          title="초기화"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className={cn(
            'p-2 rounded-lg transition-all',
            isDark
              ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
              : 'bg-white/80 hover:bg-zinc-100 text-zinc-700',
            'backdrop-blur-sm shadow-lg'
          )}
          title="전체화면"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="h-px bg-zinc-600/30 my-1" />
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={cn(
            'p-2 rounded-lg transition-all',
            showFilter
              ? 'bg-violet-500 text-white'
              : isDark
                ? 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300'
                : 'bg-white/80 hover:bg-zinc-100 text-zinc-700',
            'backdrop-blur-sm shadow-lg'
          )}
          title="필터"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* 통계 표시 */}
      <div
        className={cn(
          'absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full',
          'backdrop-blur-sm shadow-lg z-10',
          isDark ? 'bg-zinc-800/80 text-zinc-300' : 'bg-white/80 text-zinc-700'
        )}
      >
        <span className="text-sm">
          노드: <strong>{filteredData.nodes.length}</strong> | 연결: <strong>{filteredData.links.length}</strong>
        </span>
      </div>

      {/* 범례 */}
      <div
        className={cn(
          'absolute bottom-4 right-4 p-3 rounded-xl backdrop-blur-sm z-10',
          isDark ? 'bg-zinc-800/80' : 'bg-white/80'
        )}
      >
        <div className="flex flex-wrap gap-3">
          {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  {config.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 호버 툴팁 */}
      {hoveredNode && !selectedNode && (
        <div
          className={cn(
            'absolute top-20 left-4 px-3 py-2 rounded-lg z-20',
            'backdrop-blur-sm shadow-lg',
            isDark ? 'bg-zinc-800/90 text-white' : 'bg-white/90 text-zinc-900'
          )}
        >
          <p className="font-medium text-sm">{hoveredNode.label}</p>
          <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            {NODE_TYPE_CONFIG[hoveredNode.type].label} • 중요도 {hoveredNode.importance}
          </p>
        </div>
      )}

      {/* 필터 패널 */}
      {showFilter && (
        <FilterPanel
          filter={filter}
          onFilterChange={setFilter}
          projects={projects}
          isDark={isDark}
          onClose={() => setShowFilter(false)}
        />
      )}

      {/* 노드 상세 패널 */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          isDark={isDark}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}

// ============================================
// Mock data for development/demo
// ============================================

const MOCK_GRAPH_DATA: KnowledgeGraphData = {
  nodes: [
    { id: '1', type: 'private', label: '프로젝트 기획 회의', importance: 8, tags: ['기획', '회의'], project: 'GlowUS', created_at: new Date().toISOString() },
    { id: '2', type: 'meeting', label: '스프린트 리뷰', importance: 7, tags: ['스프린트', '리뷰'], project: 'GlowUS', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: '3', type: 'team', label: '팀 브레인스토밍', importance: 9, tags: ['아이디어', '협업'], project: 'GlowUS', created_at: new Date(Date.now() - 172800000).toISOString() },
    { id: '4', type: 'injected', label: 'React 18 문서', importance: 6, tags: ['React', '기술'], created_at: new Date(Date.now() - 259200000).toISOString() },
    { id: '5', type: 'execution', label: 'API 개발 완료', importance: 10, tags: ['개발', 'API'], project: 'GlowUS', created_at: new Date(Date.now() - 345600000).toISOString() },
    { id: '6', type: 'private', label: '버그 수정 노트', importance: 5, tags: ['버그', '수정'], project: 'GlowUS', created_at: new Date(Date.now() - 432000000).toISOString() },
    { id: '7', type: 'meeting', label: '고객 피드백 정리', importance: 8, tags: ['고객', '피드백'], project: 'GlowUS', created_at: new Date(Date.now() - 518400000).toISOString() },
    { id: '8', type: 'injected', label: 'TypeScript 가이드', importance: 7, tags: ['TypeScript', '가이드'], created_at: new Date(Date.now() - 604800000).toISOString() },
    { id: '9', type: 'team', label: '디자인 시스템 검토', importance: 8, tags: ['디자인', 'UI'], project: 'GlowUS', created_at: new Date(Date.now() - 691200000).toISOString() },
    { id: '10', type: 'execution', label: '배포 파이프라인 구축', importance: 9, tags: ['DevOps', '배포'], project: 'GlowUS', created_at: new Date(Date.now() - 777600000).toISOString() },
    { id: '11', type: 'private', label: '성능 최적화 계획', importance: 7, tags: ['성능', '최적화'], project: 'GlowUS', created_at: new Date(Date.now() - 864000000).toISOString() },
    { id: '12', type: 'meeting', label: '주간 스탠드업', importance: 5, tags: ['스탠드업', '주간'], project: 'GlowUS', created_at: new Date(Date.now() - 950400000).toISOString() },
  ],
  edges: [
    { source: '1', target: '2', type: 'co-occurrence', weight: 0.8 },
    { source: '1', target: '3', type: 'causal', weight: 0.9 },
    { source: '2', target: '5', type: 'reference', weight: 0.7 },
    { source: '3', target: '4', type: 'reference', weight: 0.6 },
    { source: '4', target: '8', type: 'co-occurrence', weight: 0.9 },
    { source: '5', target: '10', type: 'causal', weight: 0.85 },
    { source: '6', target: '5', type: 'reference', weight: 0.7 },
    { source: '7', target: '9', type: 'participation', weight: 0.75 },
    { source: '8', target: '11', type: 'reference', weight: 0.65 },
    { source: '9', target: '3', type: 'co-occurrence', weight: 0.8 },
    { source: '10', target: '11', type: 'causal', weight: 0.7 },
    { source: '11', target: '6', type: 'reference', weight: 0.6 },
    { source: '12', target: '2', type: 'participation', weight: 0.8 },
    { source: '1', target: '7', type: 'co-occurrence', weight: 0.5 },
    { source: '3', target: '9', type: 'participation', weight: 0.7 },
  ],
}

// ============================================
// 패널 컴포넌트 (API 연동)
// ============================================

export function KnowledgeGraph3DPanel({
  agentId,
  isDark = false,
  className,
}: {
  agentId: string
  isDark?: boolean
  className?: string
}) {
  const [data, setData] = useState<KnowledgeGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setLoading(true)
        setUsingMockData(false)
        const res = await fetch(`/api/agents/${agentId}/memories/graph`)
        if (!res.ok) throw new Error('그래프 데이터 로드 실패')
        const result = await res.json()

        // API가 nodes를 반환하는지 확인
        const graphNodes = result.nodes || []
        const graphEdges = result.edges || []

        // 데이터가 없으면 mock 데이터 사용
        if (graphNodes.length === 0) {
          setData(MOCK_GRAPH_DATA)
          setUsingMockData(true)
        } else {
          setData({ nodes: graphNodes, edges: graphEdges })
        }
      } catch (err: any) {
        console.error('Graph data fetch error:', err)
        // 에러 발생 시에도 mock 데이터로 fallback
        setData(MOCK_GRAPH_DATA)
        setUsingMockData(true)
        setError(null) // 에러 숨기고 mock 데이터 표시
      } finally {
        setLoading(false)
      }
    }

    fetchGraphData()
  }, [agentId])

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border h-[500px]',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200',
          className
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
            3D 그래프 로딩 중...
          </span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border h-[500px]',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200',
          className
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-12 h-12 text-zinc-400" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>
            {error || '그래프 데이터가 없습니다'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden backdrop-blur-sm',
        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/80 border-zinc-200',
        className
      )}
    >
      <div className={cn(
        'flex items-center gap-3 px-5 py-4 border-b',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <div className={cn(
          'p-2 rounded-xl',
          isDark ? 'bg-violet-500/20' : 'bg-violet-100'
        )}>
          <Brain className="w-5 h-5 text-violet-500" />
        </div>
        <div className="flex-1">
          <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            에이전트의 뇌
          </h4>
          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            3D 지식 그래프 시각화
          </p>
        </div>
        {usingMockData && (
          <span className={cn(
            'text-[10px] px-2 py-1 rounded-full',
            isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'
          )}>
            데모 데이터
          </span>
        )}
      </div>
      <KnowledgeGraph3D
        data={data}
        isDark={isDark}
        height={500}
      />
    </div>
  )
}

export default KnowledgeGraph3D
