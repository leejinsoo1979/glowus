'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MarkerType,
  ReactFlowProvider,
  Panel,
  useReactFlow,
  NodeTypes,
} from 'reactflow'
import dagre from 'dagre'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { ArchitectureNode } from './ArchitectureNode'
import {
  analyzeArchitecture,
  type ArchitectureAnalysis,
  type ArchitectureComponent,
  type FileInfo,
  type LayerType,
  type DetectedPattern,
  type DataFlowPath,
} from '@/lib/architecture/analyzer'
import {
  Loader2,
  RefreshCw,
  Layers,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight,
  ChevronDown,
  X,
  FileCode,
  GitBranch,
  Activity,
  BarChart3,
  ArrowRight,
  Maximize2,
  Minimize2,
  Settings2,
  Grid3X3,
  FolderTree,
  Files,
} from 'lucide-react'

import 'reactflow/dist/style.css'

// ============================================
// Constants & Config
// ============================================

const NODE_WIDTH = 220
const NODE_HEIGHT = 80
const LAYER_PADDING = 60
const LAYER_GAP = 180

const LAYER_COLORS: Record<LayerType, { bg: string; border: string; label: string }> = {
  presentation: { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', label: '프레젠테이션 레이어 (UI/화면)' },
  application: { bg: 'rgba(34, 197, 94, 0.08)', border: '#22c55e', label: '애플리케이션 레이어 (비즈니스 로직)' },
  domain: { bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7', label: '도메인 레이어 (핵심 모델)' },
  infrastructure: { bg: 'rgba(249, 115, 22, 0.08)', border: '#f97316', label: '인프라 레이어 (DB/API)' },
  shared: { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', label: '공유 레이어 (유틸리티)' },
}

const LAYER_ORDER: LayerType[] = ['presentation', 'application', 'domain', 'infrastructure', 'shared']

// 그룹핑 상세도 옵션
type GranularityLevel = 'layer' | 'folder' | 'file'

const GRANULARITY_CONFIG: Record<GranularityLevel, { label: string; description: string }> = {
  layer: { label: '레이어', description: '레이어별로 그룹화 (가장 단순)' },
  folder: { label: '폴더', description: '폴더별로 그룹화 (기본)' },
  file: { label: '파일', description: '파일별로 표시 (가장 상세)' },
}

// ============================================
// Node Types Registration
// ============================================

const nodeTypes: NodeTypes = {
  architecture: ArchitectureNode,
}

// ============================================
// Custom Group Node
// ============================================

function LayerGroupNode({ data }: { data: { label: string; layer: LayerType } }) {
  const colors = LAYER_COLORS[data.layer]
  return (
    <div
      className="rounded-xl border-2 border-dashed pointer-events-none"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        width: '100%',
        height: '100%',
      }}
    >
      <div
        className="absolute -top-3 left-4 px-2 text-xs font-medium rounded"
        style={{ backgroundColor: colors.border, color: 'white' }}
      >
        {data.label}
      </div>
    </div>
  )
}

// ============================================
// Granularity-based Component Generation
// ============================================

function generateComponentsByGranularity(
  analysis: ArchitectureAnalysis,
  granularity: GranularityLevel
): { components: ArchitectureComponent[]; connections: ArchitectureAnalysis['connections'] } {
  if (granularity === 'folder') {
    // 기본 동작 - 폴더별 그룹핑 (기존 로직)
    return { components: analysis.components, connections: analysis.connections }
  }

  if (granularity === 'layer') {
    // 레이어별로만 그룹핑 (가장 단순)
    const layerComponents: ArchitectureComponent[] = []
    const layerConnections: ArchitectureAnalysis['connections'] = []

    for (const layer of LAYER_ORDER) {
      const layerFiles = analysis.files.filter(f => f.layer === layer)
      if (layerFiles.length === 0) continue

      const componentTypes = new Set(layerFiles.map(f => f.type))
      const mainType = layerFiles[0]?.type || 'utility'

      layerComponents.push({
        id: `layer-comp-${layer}`,
        name: LAYER_COLORS[layer].label.split(' (')[0],
        type: mainType,
        layer,
        technology: `${layerFiles.length}개 파일`,
        description: `${componentTypes.size}개 타입의 ${layerFiles.length}개 파일`,
        files: layerFiles.map(f => f.path),
        endpoints: layerFiles.filter(f => f.type === 'api-route').flatMap(f => f.metadata.apiMethods || []),
        dependencies: [],
      })
    }

    // 레이어 간 연결 생성
    const layerDeps = new Map<string, Set<string>>()
    for (const file of analysis.files) {
      const sourceLayer = `layer-comp-${file.layer}`
      for (const depId of file.dependencies) {
        const depFile = analysis.files.find(f => f.id === depId)
        if (depFile && depFile.layer !== file.layer) {
          const targetLayer = `layer-comp-${depFile.layer}`
          if (!layerDeps.has(sourceLayer)) layerDeps.set(sourceLayer, new Set())
          layerDeps.get(sourceLayer)!.add(targetLayer)
        }
      }
    }

    for (const [source, targets] of layerDeps) {
      for (const target of targets) {
        layerConnections.push({
          id: `conn-${source}-${target}`,
          source,
          target,
          type: 'uses',
          weight: 2,
          label: '의존',
        })
      }
    }

    return { components: layerComponents, connections: layerConnections }
  }

  if (granularity === 'file') {
    // 파일 단위로 표시 (가장 상세)
    const fileComponents: ArchitectureComponent[] = analysis.files.map(file => ({
      id: file.id,
      name: file.name.replace(/\.(tsx?|jsx?)$/, ''),
      type: file.type,
      layer: file.layer,
      technology: file.type,
      description: `${file.metadata.linesOfCode} LOC`,
      files: [file.path],
      endpoints: file.metadata.apiMethods,
      dependencies: file.dependencies,
    }))

    const fileConnections: ArchitectureAnalysis['connections'] = []
    for (const file of analysis.files) {
      for (const depId of file.dependencies) {
        fileConnections.push({
          id: `conn-${file.id}-${depId}`,
          source: file.id,
          target: depId,
          type: 'imports',
          weight: 1,
        })
      }
    }

    return { components: fileComponents, connections: fileConnections }
  }

  return { components: analysis.components, connections: analysis.connections }
}

// ============================================
// Dagre Layout with Layer Grouping
// ============================================

// 🔥 파일 레벨 그리드 레이아웃
function getGridLayoutedElements(
  components: ArchitectureComponent[],
  connections: ArchitectureAnalysis['connections'],
) {
  const GRID_NODE_WIDTH = 220   // 노드 실제 너비 (min-w-[200px])
  const GRID_NODE_HEIGHT = 130  // 노드 실제 높이 (Header + Body ≈ 120-130px)
  const GRID_GAP_X = 25         // 가로 간격
  const GRID_GAP_Y = 20         // 세로 간격
  const GRID_COLS = 5           // 한 줄에 5개
  const LAYER_TITLE_HEIGHT = 50

  // Group components by layer
  const layerComponents: Record<LayerType, ArchitectureComponent[]> = {
    presentation: [],
    application: [],
    domain: [],
    infrastructure: [],
    shared: [],
  }

  components.forEach((comp) => {
    layerComponents[comp.layer].push(comp)
  })

  const nodes: Node[] = []
  let currentY = 0

  // Generate grid layout for each layer
  LAYER_ORDER.forEach((layer) => {
    const comps = layerComponents[layer]
    if (comps.length === 0) return

    const rows = Math.ceil(comps.length / GRID_COLS)
    const actualCols = Math.min(comps.length, GRID_COLS) // 실제 사용되는 열 수
    const layerWidth = actualCols * (GRID_NODE_WIDTH + GRID_GAP_X) + LAYER_PADDING * 2
    const layerHeight = rows * (GRID_NODE_HEIGHT + GRID_GAP_Y) + LAYER_PADDING * 2 + LAYER_TITLE_HEIGHT + GRID_GAP_Y

    // Add layer background
    nodes.push({
      id: `layer-${layer}`,
      type: 'group',
      position: { x: 0, y: currentY },
      style: {
        width: layerWidth,
        height: layerHeight,
        backgroundColor: LAYER_COLORS[layer].bg,
        border: `2px dashed ${LAYER_COLORS[layer].border}`,
        borderRadius: 12,
        zIndex: -1,
      },
      data: {
        label: LAYER_COLORS[layer].label,
        layer,
      },
    })

    // Add component nodes in grid
    comps.forEach((component, idx) => {
      const col = idx % GRID_COLS
      const row = Math.floor(idx / GRID_COLS)
      const x = LAYER_PADDING + col * (GRID_NODE_WIDTH + GRID_GAP_X)
      const y = currentY + LAYER_PADDING + LAYER_TITLE_HEIGHT + row * (GRID_NODE_HEIGHT + GRID_GAP_Y)

      nodes.push({
        id: component.id,
        type: 'architecture',
        position: { x, y },
        data: {
          label: component.name,
          type: component.type,
          technology: component.technology,
          layer: component.layer,
          endpoints: component.endpoints,
          description: component.description,
          fileCount: component.files.length,
          dependencyCount: component.dependencies.length,
          compact: true, // 컴팩트 모드 플래그
        },
      })
    })

    currentY += layerHeight + LAYER_GAP
  })

  // Generate edges (simplified for grid view)
  const edges: Edge[] = connections.slice(0, 100).map((conn) => { // 연결선 100개로 제한
    const targetComp = components.find(c => c.id === conn.target)
    let strokeColor = '#6b7280'
    if (conn.type === 'uses' || targetComp?.layer === 'infrastructure') {
      strokeColor = '#f97316'
    } else if (conn.type === 'calls') {
      strokeColor = '#22c55e'
    } else if (conn.type === 'renders') {
      strokeColor = '#3b82f6'
    }

    return {
      id: conn.id,
      source: conn.source,
      target: conn.target,
      type: 'smoothstep',
      style: {
        stroke: strokeColor,
        strokeWidth: 1,
        opacity: 0.3,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 10,
        height: 10,
      },
    }
  })

  return { nodes, edges }
}

function getLayoutedElements(
  components: ArchitectureComponent[],
  connections: ArchitectureAnalysis['connections'],
  direction: 'TB' | 'LR' = 'TB',
  granularity: GranularityLevel = 'folder'
) {
  // 🔥 파일 레벨일 때 그리드 레이아웃 사용
  if (granularity === 'file') {
    return getGridLayoutedElements(components, connections)
  }

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 120,
    nodesep: 50,
    marginx: 80,
    marginy: 80,
    ranker: 'network-simplex',
  })

  // Group components by layer
  const layerComponents: Record<LayerType, ArchitectureComponent[]> = {
    presentation: [],
    application: [],
    domain: [],
    infrastructure: [],
    shared: [],
  }

  components.forEach((comp) => {
    layerComponents[comp.layer].push(comp)
  })

  // Add nodes with layer-based rank constraints
  components.forEach((component, idx) => {
    const layerIndex = LAYER_ORDER.indexOf(component.layer)
    dagreGraph.setNode(component.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      rank: layerIndex,
    })
  })

  // Add edges
  connections.forEach((conn) => {
    dagreGraph.setEdge(conn.source, conn.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Calculate layer boundaries
  const layerBounds: Record<LayerType, { minX: number; maxX: number; minY: number; maxY: number }> = {
    presentation: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    application: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    domain: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    infrastructure: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    shared: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  }

  // Generate React Flow nodes
  const nodes: Node[] = []

  components.forEach((component) => {
    const nodeWithPosition = dagreGraph.node(component.id)
    if (!nodeWithPosition) return

    const x = nodeWithPosition.x - NODE_WIDTH / 2
    const y = nodeWithPosition.y - NODE_HEIGHT / 2

    // Update layer bounds
    const bounds = layerBounds[component.layer]
    bounds.minX = Math.min(bounds.minX, x - LAYER_PADDING)
    bounds.maxX = Math.max(bounds.maxX, x + NODE_WIDTH + LAYER_PADDING)
    bounds.minY = Math.min(bounds.minY, y - LAYER_PADDING)
    bounds.maxY = Math.max(bounds.maxY, y + NODE_HEIGHT + LAYER_PADDING)

    nodes.push({
      id: component.id,
      type: 'architecture',
      position: { x, y },
      data: {
        label: component.name,
        type: component.type,
        technology: component.technology,
        layer: component.layer,
        endpoints: component.endpoints,
        description: component.description,
        fileCount: component.files.length,
        dependencyCount: component.dependencies.length,
      },
    })
  })

  // Add layer background nodes (groups)
  LAYER_ORDER.forEach((layer, idx) => {
    const bounds = layerBounds[layer]
    if (bounds.minX !== Infinity) {
      nodes.unshift({
        id: `layer-${layer}`,
        type: 'group',
        position: { x: bounds.minX, y: bounds.minY },
        style: {
          width: bounds.maxX - bounds.minX,
          height: bounds.maxY - bounds.minY,
          backgroundColor: LAYER_COLORS[layer].bg,
          border: `2px dashed ${LAYER_COLORS[layer].border}`,
          borderRadius: 12,
          zIndex: -1,
        },
        data: {
          label: LAYER_COLORS[layer].label,
          layer,
        },
      })
    }
  })

  // Generate React Flow edges
  const edges: Edge[] = connections.map((conn) => {
    const sourceComp = components.find(c => c.id === conn.source)
    const targetComp = components.find(c => c.id === conn.target)

    // Color based on connection type
    let strokeColor = '#6b7280'
    if (conn.type === 'uses' || targetComp?.layer === 'infrastructure') {
      strokeColor = '#f97316'
    } else if (conn.type === 'calls') {
      strokeColor = '#22c55e'
    } else if (conn.type === 'renders') {
      strokeColor = '#3b82f6'
    } else if (conn.type === 'data-flow') {
      strokeColor = '#a855f7'
    }

    return {
      id: conn.id,
      source: conn.source,
      target: conn.target,
      label: conn.label,
      type: 'smoothstep',
      animated: conn.type === 'data-flow' || conn.weight > 3,
      style: {
        stroke: strokeColor,
        strokeWidth: Math.min(conn.weight + 1, 4),
        opacity: 0.7,
      },
      labelStyle: { fill: '#9ca3af', fontSize: 9 },
      labelBgStyle: { fill: '#18181b', fillOpacity: 0.85, rx: 4 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 15,
        height: 15,
      },
    }
  })

  return { nodes, edges }
}

// ============================================
// Detail Panel Component
// ============================================

interface DetailPanelProps {
  analysis: ArchitectureAnalysis
  selectedComponent: string | null
  onClose: () => void
  isDark: boolean
}

function DetailPanel({ analysis, selectedComponent, onClose, isDark }: DetailPanelProps) {
  const component = selectedComponent
    ? analysis.components.find(c => c.id === selectedComponent)
    : null

  if (!component) {
    // Show overview when no component selected
    return (
      <div className={cn(
        'w-80 h-full border-l overflow-y-auto',
        isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white/95 border-zinc-200'
      )}>
        <div className="p-4 border-b border-zinc-800">
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            아키텍처 개요
          </h3>
        </div>

        {/* Metrics */}
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">메트릭</h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(analysis.metrics).map(([key, value]) => (
                <div
                  key={key}
                  className={cn(
                    'px-3 py-2 rounded-lg',
                    isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  )}
                >
                  <div className="text-xs text-zinc-500 capitalize">{key}</div>
                  <div className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                    {typeof value === 'number' ? value.toFixed(2) : value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">감지된 패턴</h4>
            <div className="space-y-2">
              {analysis.patterns.map((pattern, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-3 py-2 rounded-lg flex items-start gap-2',
                    isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  )}
                >
                  {pattern.type === 'anti-pattern' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : pattern.type === 'architecture' ? (
                    <Layers className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={cn('text-xs font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                      {pattern.name}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {pattern.description}
                    </div>
                  </div>
                </div>
              ))}
              {analysis.patterns.length === 0 && (
                <div className="text-xs text-zinc-500">감지된 패턴 없음</div>
              )}
            </div>
          </div>

          {/* Data Flows */}
          {analysis.dataFlows.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-2">데이터 흐름</h4>
              <div className="space-y-2">
                {analysis.dataFlows.slice(0, 5).map((flow, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'px-3 py-2 rounded-lg',
                      isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    )}
                  >
                    <div className="flex items-center gap-1 text-xs">
                      <Activity className="w-3 h-3 text-purple-500" />
                      <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                        {flow.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Layer Summary */}
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">레이어 분포</h4>
            <div className="space-y-1">
              {analysis.layers.filter(l => l.components.length > 0).map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: LAYER_COLORS[layer.layer].border }}
                    />
                    <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      {layer.label.replace(' Layer', '')}
                    </span>
                  </div>
                  <span className="text-zinc-500">
                    {layer.components.length}개 컴포넌트
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Component detail view
  const componentFiles = analysis.files.filter(f => component.files.includes(f.path))

  // 🔥 컴포넌트 역할 설명 생성
  const getComponentRoleDescription = () => {
    const typeDescriptions: Record<string, string> = {
      'page': '사용자에게 직접 보여지는 화면입니다. URL 라우팅과 연결되어 있으며, 다른 컴포넌트들을 조합하여 완성된 UI를 구성합니다.',
      'component': 'UI를 구성하는 재사용 가능한 블록입니다. 여러 페이지나 다른 컴포넌트에서 공통으로 사용됩니다.',
      'api-route': 'API 엔드포인트로, 클라이언트의 요청을 처리하고 데이터를 반환합니다. 데이터베이스나 외부 서비스와 통신합니다.',
      'service': '비즈니스 로직을 담당하는 서비스 레이어입니다. 데이터 처리, 검증, 변환 등의 핵심 로직을 수행합니다.',
      'hook': 'React Hook으로, 상태 관리나 부수 효과를 캡슐화합니다. 여러 컴포넌트에서 로직을 재사용할 수 있게 합니다.',
      'utility': '공통으로 사용되는 유틸리티 함수들입니다. 날짜 포맷, 문자열 처리 등 순수 함수를 제공합니다.',
      'type': 'TypeScript 타입 정의 파일입니다. 코드의 타입 안정성을 보장하고 자동 완성을 지원합니다.',
      'config': '설정 파일로, 환경 변수나 상수 값들을 관리합니다.',
      'database': '데이터베이스 접근 레이어입니다. 쿼리 실행과 데이터 매핑을 담당합니다.',
      'external-service': '외부 API나 서드파티 서비스와의 통신을 담당합니다.',
      'state-management': '전역 상태 관리를 담당합니다. 여러 컴포넌트 간 데이터 공유를 가능하게 합니다.',
      'middleware': '요청/응답 처리 중간에 개입하여 인증, 로깅, 에러 처리 등을 수행합니다.',
    }
    return typeDescriptions[component.type] || '시스템의 일부를 구성하는 모듈입니다.'
  }

  // 🔥 레이어별 역할 설명
  const getLayerRoleDescription = () => {
    const layerDescriptions: Record<LayerType, string> = {
      'presentation': '사용자 인터페이스를 담당합니다. 화면 렌더링과 사용자 상호작용을 처리합니다.',
      'application': '비즈니스 로직과 유스케이스를 구현합니다. 프레젠테이션과 도메인 레이어를 연결합니다.',
      'domain': '핵심 비즈니스 규칙과 엔티티를 정의합니다. 시스템의 가장 중요한 로직이 위치합니다.',
      'infrastructure': '외부 시스템(DB, API)과의 통신을 담당합니다. 기술적 세부사항을 캡슐화합니다.',
      'shared': '여러 레이어에서 공통으로 사용되는 유틸리티와 타입을 제공합니다.',
    }
    return layerDescriptions[component.layer]
  }

  // 🔥 의존성 분석
  const getDependencyAnalysis = () => {
    const incomingDeps = analysis.connections.filter(c => c.target === component.id)
    const outgoingDeps = analysis.connections.filter(c => c.source === component.id)

    const isHighlyDependent = outgoingDeps.length > 5
    const isHighlyUsed = incomingDeps.length > 5

    if (isHighlyDependent && isHighlyUsed) {
      return { type: 'hub', message: '🔄 이 컴포넌트는 시스템의 허브 역할을 합니다. 많은 모듈이 의존하고, 또한 많은 모듈에 의존합니다. 변경 시 영향 범위가 넓으므로 신중하게 수정해야 합니다.' }
    } else if (isHighlyUsed) {
      return { type: 'core', message: '⭐ 핵심 컴포넌트입니다. 많은 모듈이 이 컴포넌트에 의존하므로, 안정성이 매우 중요합니다.' }
    } else if (isHighlyDependent) {
      return { type: 'leaf', message: '🍃 다양한 모듈을 조합하는 컴포넌트입니다. 상위 레벨 기능을 구현합니다.' }
    } else if (outgoingDeps.length === 0 && incomingDeps.length === 0) {
      return { type: 'isolated', message: '🏝️ 독립적인 컴포넌트입니다. 다른 모듈과의 연결이 적어 독립적으로 작동합니다.' }
    }
    return { type: 'normal', message: '' }
  }

  const dependencyAnalysis = getDependencyAnalysis()

  return (
    <div className={cn(
      'w-96 h-full border-l overflow-y-auto',
      isDark ? 'bg-zinc-900/95 border-zinc-800' : 'bg-white/95 border-zinc-200'
    )}>
      {/* Header */}
      <div className={cn(
        'p-4 border-b sticky top-0 z-10',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={cn('text-base font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
            {component.name}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-1 text-xs font-medium rounded-full"
            style={{
              backgroundColor: LAYER_COLORS[component.layer].bg,
              color: LAYER_COLORS[component.layer].border,
              border: `1px solid ${LAYER_COLORS[component.layer].border}`,
            }}
          >
            {component.layer}
          </span>
          <span className={cn(
            'px-2.5 py-1 text-xs rounded-full',
            isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
          )}>
            {component.type.replace('-', ' ')}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* 🔥 컴포넌트 역할 설명 */}
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-blue-50 border-blue-200'
        )}>
          <h4 className={cn(
            'text-xs font-semibold mb-2 flex items-center gap-1.5',
            isDark ? 'text-blue-400' : 'text-blue-600'
          )}>
            <Info className="w-3.5 h-3.5" />
            컴포넌트 역할
          </h4>
          <p className={cn(
            'text-xs leading-relaxed',
            isDark ? 'text-zinc-300' : 'text-zinc-700'
          )}>
            {getComponentRoleDescription()}
          </p>
        </div>

        {/* 🔥 레이어 역할 */}
        <div className={cn(
          'p-3 rounded-lg',
          isDark ? 'bg-zinc-800/30' : 'bg-zinc-50'
        )}>
          <h4 className="text-xs font-medium text-zinc-500 mb-1.5 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            레이어 위치
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {getLayerRoleDescription()}
          </p>
        </div>

        {/* 🔥 의존성 분석 인사이트 */}
        {dependencyAnalysis.message && (
          <div className={cn(
            'p-3 rounded-lg border',
            dependencyAnalysis.type === 'hub' && (isDark ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'),
            dependencyAnalysis.type === 'core' && (isDark ? 'bg-purple-900/20 border-purple-700/50' : 'bg-purple-50 border-purple-200'),
            dependencyAnalysis.type === 'leaf' && (isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200'),
            dependencyAnalysis.type === 'isolated' && (isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'),
          )}>
            <p className="text-xs leading-relaxed text-zinc-300">
              {dependencyAnalysis.message}
            </p>
          </div>
        )}

        {/* Description */}
        {component.description && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-1.5">설명</h4>
            <p className={cn(
              'text-xs',
              isDark ? 'text-zinc-300' : 'text-zinc-700'
            )}>
              {component.description}
            </p>
          </div>
        )}

        {/* Files */}
        {componentFiles.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2 flex items-center gap-1">
              <FileCode className="w-3 h-3" />
              파일 ({componentFiles.length}개)
            </h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {componentFiles.map((file, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-2 py-1.5 rounded text-xs font-mono truncate',
                    isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                  )}
                  title={file.path}
                >
                  {file.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Endpoints */}
        {component.endpoints && component.endpoints.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">API 엔드포인트</h4>
            <div className="space-y-1">
              {component.endpoints.map((endpoint, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-2 py-1.5 rounded text-xs font-mono',
                    isDark ? 'bg-zinc-800 text-green-400' : 'bg-zinc-100 text-green-600'
                  )}
                >
                  {endpoint}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {component.dependencies.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2 flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              의존성 ({component.dependencies.length}개)
            </h4>
            <div className="flex flex-wrap gap-1">
              {component.dependencies.map((dep, idx) => {
                const depComp = analysis.components.find(c => c.id === dep)
                return (
                  <span
                    key={idx}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded',
                      isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                    )}
                  >
                    {depComp?.name || dep}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* File Stats */}
        {componentFiles.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">통계</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={cn('px-2 py-1.5 rounded', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                <div className="text-zinc-500">총 코드 라인</div>
                <div className={isDark ? 'text-white' : 'text-zinc-900'}>
                  {componentFiles.reduce((sum, f) => sum + f.metadata.linesOfCode, 0)}
                </div>
              </div>
              <div className={cn('px-2 py-1.5 rounded', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                <div className="text-zinc-500">React 컴포넌트</div>
                <div className={isDark ? 'text-white' : 'text-zinc-900'}>
                  {componentFiles.filter(f => f.metadata.isReactComponent).length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Main Component
// ============================================

function ArchitectureViewContent() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const files = useNeuralMapStore((s) => s.files)
  const mapId = useNeuralMapStore((s) => s.mapId)

  const [analysis, setAnalysis] = useState<ArchitectureAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB')
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(true)
  const [granularity, setGranularity] = useState<GranularityLevel>('folder')
  const [showGranularityMenu, setShowGranularityMenu] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const reactFlowInstance = useReactFlow()

  // Convert NeuralFiles to FileInfo
  const fileInfos = useMemo<FileInfo[]>(() => {
    const result: FileInfo[] = []

    function traverse(items: typeof files, parentPath = '') {
      for (const item of items) {
        const path = parentPath ? `${parentPath}/${item.name}` : item.name
        result.push({
          path,
          content: item.content || '',
          type: item.children ? 'folder' : 'file',
        })
        if (item.children) {
          traverse(item.children, path)
        }
      }
    }

    traverse(files)
    return result
  }, [files])

  // Analyze architecture
  const runAnalysis = useCallback(async () => {
    if (fileInfos.length === 0) {
      setError('프로젝트 파일을 먼저 불러와주세요')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      // Find package.json
      const packageJsonFile = fileInfos.find(f => f.path.endsWith('package.json'))
      let packageJson: Record<string, unknown> = {}

      if (packageJsonFile?.content) {
        try {
          packageJson = JSON.parse(packageJsonFile.content)
        } catch {
          console.warn('Failed to parse package.json')
        }
      }

      const projectName = (packageJson.name as string) || 'Project'

      // Run analysis
      const result = await analyzeArchitecture(projectName, fileInfos, packageJson)
      setAnalysis(result)

      // Generate layout based on granularity
      const { components: granularComponents, connections: granularConnections } =
        generateComponentsByGranularity(result, granularity)

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        granularComponents,
        granularConnections,
        layoutDirection,
        granularity
      )

      setNodes(layoutedNodes)
      setEdges(layoutedEdges)

      // Fit view after layout
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.15 })
      }, 100)
    } catch (e) {
      console.error('Architecture analysis failed:', e)
      setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다')
    } finally {
      setIsAnalyzing(false)
    }
  }, [fileInfos, layoutDirection, granularity, setNodes, setEdges, reactFlowInstance])

  // Auto-analyze when files change
  useEffect(() => {
    if (fileInfos.length > 0 && !analysis) {
      runAnalysis()
    }
  }, [fileInfos, analysis, runAnalysis])

  // Re-layout when direction or granularity changes
  useEffect(() => {
    if (analysis) {
      const { components: granularComponents, connections: granularConnections } =
        generateComponentsByGranularity(analysis, granularity)

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        granularComponents,
        granularConnections,
        layoutDirection,
        granularity
      )
      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
    }
  }, [layoutDirection, granularity, analysis, setNodes, setEdges])

  // Handle node click
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!node.id.startsWith('layer-')) {
      setSelectedComponent(node.id)
      setShowPanel(true)
    }
  }, [])

  // Toggle layout direction
  const toggleLayout = () => {
    setLayoutDirection(prev => prev === 'TB' ? 'LR' : 'TB')
  }

  // Close granularity menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowGranularityMenu(false)
    if (showGranularityMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showGranularityMenu])

  return (
    <div className={cn('w-full h-full relative flex', isDark ? 'bg-zinc-950' : 'bg-zinc-100')}>
      {/* Main Canvas */}
      <div className="flex-1 relative">
        {/* Toolbar */}
        <div
          className={cn(
            'absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg border',
            isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-zinc-200'
          )}
        >
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className={cn(
              'p-2 rounded-md transition-colors',
              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100',
              isAnalyzing && 'opacity-50 cursor-not-allowed'
            )}
            title="다시 분석"
          >
            {isAnalyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>

          <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />

          <button
            onClick={toggleLayout}
            className={cn(
              'p-2 rounded-md transition-colors flex items-center gap-1.5 text-xs',
              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
            )}
            title="레이아웃 방향 변경"
          >
            <Layers className="w-4 h-4" />
            <span>{layoutDirection === 'TB' ? '수직' : '수평'}</span>
          </button>

          <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />

          {/* 그룹핑 상세도 선택 */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowGranularityMenu(!showGranularityMenu)
              }}
              className={cn(
                'p-2 rounded-md transition-colors flex items-center gap-1.5 text-xs',
                isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
              )}
              title="그룹핑 상세도"
            >
              {granularity === 'layer' && <Grid3X3 className="w-4 h-4" />}
              {granularity === 'folder' && <FolderTree className="w-4 h-4" />}
              {granularity === 'file' && <Files className="w-4 h-4" />}
              <span>{GRANULARITY_CONFIG[granularity].label}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showGranularityMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'absolute top-full left-0 mt-1 py-1 rounded-lg border shadow-lg z-50 min-w-[160px]',
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                )}
              >
                {(Object.entries(GRANULARITY_CONFIG) as [GranularityLevel, typeof GRANULARITY_CONFIG['layer']][]).map(
                  ([level, config]) => (
                    <button
                      key={level}
                      onClick={() => {
                        setGranularity(level)
                        setShowGranularityMenu(false)
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left flex items-center gap-2 transition-colors',
                        isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100',
                        granularity === level && (isDark ? 'bg-zinc-800' : 'bg-zinc-100')
                      )}
                    >
                      {level === 'layer' && <Grid3X3 className="w-4 h-4 text-blue-500" />}
                      {level === 'folder' && <FolderTree className="w-4 h-4 text-green-500" />}
                      {level === 'file' && <Files className="w-4 h-4 text-purple-500" />}
                      <div>
                        <div className={cn('text-xs font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                          {config.label}
                        </div>
                        <div className="text-[10px] text-zinc-500">{config.description}</div>
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div className={cn('w-px h-6', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />

          <button
            onClick={() => setShowPanel(!showPanel)}
            className={cn(
              'p-2 rounded-md transition-colors',
              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
            )}
            title={showPanel ? '패널 숨기기' : '패널 보기'}
          >
            {showPanel ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Stats Badge */}
        {analysis && (
          <div
            className={cn(
              'absolute top-4 right-4 z-10 flex items-center gap-4 px-4 py-2 rounded-lg border text-xs',
              isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-zinc-200'
            )}
            style={{ right: showPanel ? '336px' : '16px' }}
          >
            <div className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-zinc-500">파일:</span>
              <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                {analysis.metadata.fileCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-zinc-500">컴포넌트:</span>
              <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                {analysis.components.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-green-500" />
              <span className="text-zinc-500">API:</span>
              <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                {analysis.metadata.apiEndpoints}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-zinc-500">코드 라인:</span>
              <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                {analysis.metadata.totalLinesOfCode.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'px-6 py-4 rounded-lg border text-center max-w-md',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <p className="text-red-400 mb-2">{error}</p>
              <p className="text-xs text-zinc-500">
                Neural Map에서 프로젝트 폴더를 업로드하면 자동으로 분석됩니다.
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <p className="text-sm text-white">아키텍처 분석 중...</p>
              <p className="text-xs text-zinc-400">코드를 파싱하고 의존성을 추적하는 중</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!error && !isAnalyzing && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'px-6 py-4 rounded-lg border text-center max-w-md',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              <Layers className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
              <h3 className={cn('text-lg font-semibold mb-2', isDark ? 'text-white' : 'text-zinc-900')}>
                아키텍처 역설계
              </h3>
              <p className="text-sm text-zinc-500 mb-4">
                프로젝트 폴더를 불러오면 코드를 분석하여 시스템 아키텍처를 자동으로 시각화합니다.
              </p>
              <ul className="text-xs text-zinc-500 text-left space-y-1 mb-4">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  파일 의존성 그래프 분석
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  레이어별 컴포넌트 분류
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  데이터 흐름 추적
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  아키텍처 패턴 감지
                </li>
              </ul>
              <button
                onClick={runAnalysis}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                분석 시작
              </button>
            </div>
          </div>
        )}

        {/* React Flow Canvas */}
        {nodes.length > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color={isDark ? '#27272a' : '#e4e4e7'}
              gap={20}
              size={1}
            />
            <Controls
              className={cn(
                '[&>button]:border-zinc-700 [&>button]:bg-zinc-900 [&>button]:text-zinc-400',
                '[&>button:hover]:bg-zinc-800 [&>button:hover]:text-white'
              )}
            />
            <MiniMap
              nodeColor={(node) => {
                if (node.id.startsWith('layer-')) {
                  return LAYER_COLORS[node.data?.layer as LayerType]?.border || '#6b7280'
                }
                const layer = node.data?.layer as LayerType
                return LAYER_COLORS[layer]?.border || '#6b7280'
              }}
              maskColor={isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'}
              className={cn(
                'rounded-lg border',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            />
          </ReactFlow>
        )}
      </div>

      {/* Detail Panel */}
      {showPanel && analysis && (
        <DetailPanel
          analysis={analysis}
          selectedComponent={selectedComponent}
          onClose={() => setSelectedComponent(null)}
          isDark={isDark}
        />
      )}
    </div>
  )
}

export function ArchitectureView() {
  return (
    <ReactFlowProvider>
      <ArchitectureViewContent />
    </ReactFlowProvider>
  )
}
