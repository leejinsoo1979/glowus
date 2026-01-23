'use client'

import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import { useMyNeuronsStore } from '@/lib/my-neurons/store'
import type { MyNeuronNode, MyNeuronType } from '@/lib/my-neurons/types'
import { useThemeStore, accentColors } from '@/stores/themeStore'

// ForceGraph2D를 React 외부에서 직접 관리 (Graph2DView 방식)
let ForceGraph2DClass: any = null

// 노드 타입별 색상 (모던 다크 테마)
const NODE_COLORS: Record<MyNeuronType, string> = {
  self: '#8b5cf6',      // 보라색 (중앙 노드)
  project: '#3b82f6',   // 파란색
  task: '#22c55e',      // 녹색
  doc: '#f97316',       // 오렌지
  person: '#a855f7',    // 연보라
  agent: '#06b6d4',     // 청록
  objective: '#ef4444', // 빨강
  key_result: '#ec4899',// 핑크
  decision: '#6366f1',  // 인디고
  memory: '#64748b',    // 슬레이트
  workflow: '#f97316',  // 오렌지
  insight: '#d946ef',   // 마젠타
  program: '#10b981',   // 에메랄드
  application: '#14b8a6',// 틸
  milestone: '#8b5cf6', // 보라
  budget: '#22d3ee',    // 시안
}

// 노드 타입별 크기
const NODE_SIZES: Record<MyNeuronType, number> = {
  self: 14,
  project: 8,
  objective: 7,
  program: 7,
  task: 5,
  doc: 4,
  person: 6,
  agent: 6,
  key_result: 5,
  decision: 5,
  memory: 4,
  workflow: 5,
  insight: 5,
  application: 5,
  milestone: 5,
  budget: 4,
}

interface GraphNode {
  id: string
  name: string
  type: MyNeuronType
  val: number
  color: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLink {
  source: string
  target: string
}

interface Neurons2DCanvasProps {
  onNodeClick?: (node: MyNeuronNode) => void
  onBackgroundClick?: () => void
}

export function Neurons2DCanvas({ onNodeClick, onBackgroundClick }: Neurons2DCanvasProps) {
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const graphInstanceRef = useRef<any>(null)
  const isGraphReadyRef = useRef(false)
  const graphDataRef = useRef<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })

  // 콜백을 ref로 관리하여 최신 버전 유지
  const onNodeClickRef = useRef(onNodeClick)
  const onBackgroundClickRef = useRef(onBackgroundClick)

  // 테마 색상 적용
  const accentColor = useThemeStore((s) => s.accentColor)
  const themeConfig = useMemo(() => {
    return accentColors.find(c => c.id === accentColor) || accentColors[0]
  }, [accentColor])

  const graph = useMyNeuronsStore((s) => s.graph)
  const graphRef = useRef(graph) // graph도 ref로 관리

  // ref 업데이트
  useEffect(() => {
    onNodeClickRef.current = onNodeClick
    onBackgroundClickRef.current = onBackgroundClick
    graphRef.current = graph
  }, [onNodeClick, onBackgroundClick, graph])
  const selectedNodeIds = useMyNeuronsStore((s) => s.selectedNodeIds)
  const selectNode = useMyNeuronsStore((s) => s.selectNode)

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // 연결된 노드 ID 집합
  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>()
    if (selectedNodeIds.length > 0 && graph?.edges) {
      selectedNodeIds.forEach(id => {
        connected.add(id)
        graph.edges.forEach(edge => {
          if (edge.source === id) connected.add(edge.target)
          if (edge.target === id) connected.add(edge.source)
        })
      })
    }
    return connected
  }, [selectedNodeIds, graph?.edges])

  // 그래프 데이터 변환
  const graphData = useMemo(() => {
    if (!graph?.nodes || !graph?.edges) return { nodes: [], links: [] }

    // 타입별로 다른 영역에 초기 배치
    const typeAngles: Record<string, number> = {
      self: 0,
      project: 0,
      objective: Math.PI / 4,
      program: Math.PI / 2,
      task: (3 * Math.PI) / 4,
      doc: Math.PI,
      person: (5 * Math.PI) / 4,
      agent: (3 * Math.PI) / 2,
      key_result: (7 * Math.PI) / 8,
      decision: Math.PI / 8,
      memory: (5 * Math.PI) / 8,
      workflow: (11 * Math.PI) / 8,
      insight: (13 * Math.PI) / 8,
      application: (15 * Math.PI) / 8,
      milestone: (3 * Math.PI) / 8,
      budget: (9 * Math.PI) / 8,
    }

    // 타입별 카운터
    const typeCounters: Record<string, number> = {}

    const nodes: GraphNode[] = graph.nodes.map((node) => {
      const isSelf = node.type === 'self'

      if (isSelf) {
        return {
          id: node.id,
          name: node.title,
          type: node.type,
          val: NODE_SIZES[node.type] || 5,
          color: themeConfig.color, // 사용자 선택 테마 색상 적용
          fx: 0, fy: 0, x: 0, y: 0,
        }
      }

      // 같은 타입의 노드끼리 인덱스 부여
      typeCounters[node.type] = (typeCounters[node.type] || 0) + 1
      const typeIndex = typeCounters[node.type]

      // 타입별 기본 각도 + 오프셋
      const baseAngle = typeAngles[node.type] || 0
      const angleOffset = (typeIndex - 1) * 0.3
      const angle = baseAngle + angleOffset

      // 거리: 타입별로 다르게 + 인덱스에 따라 증가
      const baseDistance = 150 + typeIndex * 40

      return {
        id: node.id,
        name: node.title,
        type: node.type,
        val: NODE_SIZES[node.type] || 5,
        color: NODE_COLORS[node.type] || '#6b7280',
        x: Math.cos(angle) * baseDistance + (Math.random() - 0.5) * 50,
        y: Math.sin(angle) * baseDistance + (Math.random() - 0.5) * 50,
      }
    })

    const nodeIds = new Set(nodes.map(n => n.id))
    const links: GraphLink[] = graph.edges
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target }))

    return { nodes, links }
  }, [graph, themeConfig.color])

  // graphDataRef 업데이트
  useEffect(() => {
    graphDataRef.current = graphData
  }, [graphData])

  // 노드 렌더링
  const renderNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (!isFinite(node.x) || !isFinite(node.y)) return

    const isSelected = selectedNodeIds.includes(node.id)
    const isHovered = hoveredNodeId === node.id
    const hasSelection = selectedNodeIds.length > 0
    const isConnected = connectedNodeIds.has(node.id)
    const isDimmed = hasSelection && !isConnected && !isSelected && !isHovered

    const baseSize = node.val || 5
    const sizeMultiplier = isSelected ? 1.5 : isConnected ? 1.1 : 1
    const actualSize = baseSize * sizeMultiplier

    ctx.globalAlpha = isDimmed ? 0.15 : 1.0

    // 글로우 효과
    if (isSelected) {
      ctx.shadowColor = node.color
      ctx.shadowBlur = 15 / globalScale
    } else if (isHovered) {
      ctx.shadowColor = node.color
      ctx.shadowBlur = 8 / globalScale
    } else {
      ctx.shadowBlur = 0
    }

    // 노드 원
    ctx.beginPath()
    ctx.arc(node.x, node.y, actualSize, 0, Math.PI * 2)
    ctx.fillStyle = node.color
    ctx.fill()

    // 테두리
    if (isSelected) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    } else if (isHovered) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1 / globalScale
      ctx.stroke()
    }

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1.0

    // 라벨 - 줌인 시(globalScale > 3) 또는 선택/호버/self 노드만 표시
    const showLabel = globalScale > 3 || isSelected || isHovered || node.type === 'self'
    if (showLabel && !isDimmed) {
      const fontSize = Math.max(10, 12 / globalScale)
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3 / globalScale
      const label = node.name?.length > 12 ? node.name.slice(0, 12) + '...' : node.name
      ctx.strokeText(label || '', node.x, node.y + actualSize + 4)
      ctx.fillText(label || '', node.x, node.y + actualSize + 4)
    }
  }, [selectedNodeIds, hoveredNodeId, connectedNodeIds])

  // 노드 클릭 핸들러 - 직접 props 콜백을 호출
  const handleNodeClick = useCallback((node: any) => {
    console.log('[Neurons2DCanvas] handleNodeClick called:', node.id, node.name)
    selectNode(node.id)

    // props로 전달된 onNodeClick 콜백 직접 호출
    if (onNodeClick && graph?.nodes) {
      const orig = graph.nodes.find((n: MyNeuronNode) => n.id === node.id)
      if (orig) {
        console.log('[Neurons2DCanvas] Calling onNodeClick with:', orig.id, orig.title)
        onNodeClick(orig)
      } else {
        console.log('[Neurons2DCanvas] Node not found in graph:', node.id)
      }
    } else {
      console.log('[Neurons2DCanvas] Missing callback or nodes:', !!onNodeClick, !!graph?.nodes)
    }
  }, [selectNode, onNodeClick, graph?.nodes])

  // handleNodeClick을 ref로 저장하여 force-graph에서 최신 버전 사용
  const handleNodeClickRef = useRef(handleNodeClick)
  useEffect(() => {
    handleNodeClickRef.current = handleNodeClick
  }, [handleNodeClick])

  // 그래프 초기화
  useEffect(() => {
    if (!graphContainerRef.current || typeof window === 'undefined') return
    if (isGraphReadyRef.current) return

    let mounted = true

    const initGraph = async () => {
      try {
        if (!ForceGraph2DClass) {
          const module = await import('force-graph')
          ForceGraph2DClass = module.default
        }

        if (!mounted || !graphContainerRef.current) return

        const container = graphContainerRef.current
        const fg = ForceGraph2DClass()(container)
          .backgroundColor('#0d1117')
          .width(container.clientWidth || 800)
          .height(container.clientHeight || 600)
          .nodeCanvasObject((node: any, ctx: any, scale: number) => renderNode(node, ctx, scale))
          .nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath()
            ctx.arc(node.x, node.y, (node.val || 5) + 5, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.fill()
          })
          .linkColor(() => 'rgba(255,255,255,0.3)')
          .linkWidth(1)
          .onNodeClick((node: any) => handleNodeClickRef.current?.(node))
          .onNodeHover((node: any) => setHoveredNodeId(node?.id || null))
          .onBackgroundClick(() => onBackgroundClickRef.current?.())
          .onNodeDragEnd((node: any) => {
            node.fx = node.x
            node.fy = node.y
          })
          .linkDirectionalParticles(0)
          .d3VelocityDecay(0.4)
          .d3AlphaDecay(0.02)
          .cooldownTicks(200)
          .warmupTicks(100)
          .enableNodeDrag(true)
          .enableZoomPanInteraction(true)
          .minZoom(0.1)
          .maxZoom(10)

        // Force 설정 - 노드 겹침 방지를 위해 강화
        fg.d3Force('collide')?.radius(50).strength(1).iterations(6)
        fg.d3Force('center')?.strength(0.02)
        fg.d3Force('charge')?.strength(-400).distanceMax(600)
        fg.d3Force('link')?.distance(120).strength(0.3)

        graphInstanceRef.current = fg
        isGraphReadyRef.current = true

        // 데이터 로드 후 self 노드 중심으로 배치
        setTimeout(() => {
          if (mounted && graphInstanceRef.current && graphDataRef.current.nodes.length > 0) {
            graphInstanceRef.current.graphData(graphDataRef.current)
            // self 노드 위치로 중앙 정렬
            const selfNode = graphDataRef.current.nodes.find((n: any) => n.type === 'self')
            const centerX = selfNode?.x ?? 0
            const centerY = selfNode?.y ?? 0
            graphInstanceRef.current.centerAt(centerX, centerY, 500)
            graphInstanceRef.current.zoom(1.0, 500)
          }
        }, 100)
      } catch (error) {
        console.error('[Neurons2DCanvas] Init error:', error)
      }
    }

    initGraph()

    return () => {
      mounted = false
    }
  }, [])

  // 데이터 업데이트
  useEffect(() => {
    if (!graphInstanceRef.current || graphData.nodes.length === 0) return

    graphInstanceRef.current.graphData(graphData)

    // self 노드 위치로 중앙 정렬
    setTimeout(() => {
      const selfNode = graphData.nodes.find((n: any) => n.type === 'self')
      const centerX = selfNode?.x ?? 0
      const centerY = selfNode?.y ?? 0
      graphInstanceRef.current?.centerAt(centerX, centerY, 500)
      graphInstanceRef.current?.zoom(1.0, 500)
    }, 200)
  }, [graphData])

  // 리사이즈 - 부모 컨테이너 크기 변화 감지
  useEffect(() => {
    if (!graphContainerRef.current) return

    const container = graphContainerRef.current

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0 && graphInstanceRef.current) {
          console.log('[Neurons2DCanvas] Resize detected:', width, height)
          graphInstanceRef.current.width(width)
          graphInstanceRef.current.height(height)
        }
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // 렌더링 업데이트
  useEffect(() => {
    graphInstanceRef.current?.nodeCanvasObject((node: any, ctx: any, scale: number) => renderNode(node, ctx, scale))
  }, [renderNode])

  // 화면 초기화 함수 (self 노드 중심으로 리셋)
  const resetView = useCallback(() => {
    if (!graphInstanceRef.current) return
    const selfNode = graphDataRef.current.nodes.find((n: any) => n.type === 'self')
    const centerX = selfNode?.x ?? 0
    const centerY = selfNode?.y ?? 0
    graphInstanceRef.current.centerAt(centerX, centerY, 500)
    graphInstanceRef.current.zoom(1.0, 500)
    console.log('[Neurons2DCanvas] View reset to center')
  }, [])

  // 스페이스바로 화면 초기화
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        resetView()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [resetView])

  return (
    <div
      ref={graphContainerRef}
      className="absolute inset-0 bg-[#0d1117]"
      tabIndex={0}
    />
  )
}

export default Neurons2DCanvas
