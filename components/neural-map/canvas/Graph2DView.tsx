'use client'

import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge } from '@/lib/neural-map/types'

// Dynamic import for SSR compatibility
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Loading graph...</div>
    </div>
  ),
})

// 노드 타입별 색상 (Obsidian 스타일 - 단순한 색상)
const NODE_COLORS: Record<string, string> = {
  self: '#a855f7',      // 보라색 (중심 노드)
  concept: '#6b7280',   // 회색
  project: '#6b7280',
  doc: '#6b7280',
  idea: '#6b7280',
  decision: '#6b7280',
  memory: '#6b7280',
  task: '#6b7280',
  person: '#6b7280',
  insight: '#6b7280',
}

// 선택된 노드 색상
const SELECTED_COLOR = '#8b5cf6'
const HOVER_COLOR = '#a78bfa'

interface GraphNode {
  id: string
  name: string
  type: string
  val: number  // 노드 크기
  color: string
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
  type: string
}

interface Graph2DViewProps {
  className?: string
}

export function Graph2DView({ className }: Graph2DViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  // Store
  const graph = useNeuralMapStore((s) => s.graph)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const openModal = useNeuralMapStore((s) => s.openModal)

  // 컨테이너 크기 감지
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // 그래프 데이터 변환
  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }

    const nodes: GraphNode[] = graph.nodes.map((node) => ({
      id: node.id,
      name: node.title,
      type: node.type,
      val: node.type === 'self' ? 8 : node.importance || 4,
      color: selectedNodeIds.includes(node.id)
        ? SELECTED_COLOR
        : NODE_COLORS[node.type] || '#6b7280',
    }))

    const links: GraphLink[] = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }))

    return { nodes, links }
  }, [graph, selectedNodeIds])

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback((node: any) => {
    if (node?.id) {
      setSelectedNodes([node.id])
    }
  }, [setSelectedNodes])

  // 노드 더블클릭 - 편집 모달
  const handleNodeDoubleClick = useCallback((node: any) => {
    if (node?.id) {
      setSelectedNodes([node.id])
      openModal('nodeEditor', node.id)
    }
  }, [setSelectedNodes, openModal])

  // 배경 클릭 - 선택 해제
  const handleBackgroundClick = useCallback(() => {
    setSelectedNodes([])
  }, [setSelectedNodes])

  // 노드 호버
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id || null)
  }, [])

  // 노드 캔버스 렌더링 (Obsidian 스타일)
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name
    const fontSize = 12 / globalScale
    const isSelected = selectedNodeIds.includes(node.id)
    const isHovered = hoveredNode === node.id
    const nodeSize = node.type === 'self' ? 6 : 4

    // 노드 원 그리기
    ctx.beginPath()
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI)

    if (isSelected || isHovered) {
      ctx.fillStyle = SELECTED_COLOR
      // 글로우 효과
      ctx.shadowColor = SELECTED_COLOR
      ctx.shadowBlur = 10
    } else {
      ctx.fillStyle = isDark ? '#6b7280' : '#9ca3af'
      ctx.shadowBlur = 0
    }

    ctx.fill()
    ctx.shadowBlur = 0

    // 라벨 그리기
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = isDark ? '#d4d4d4' : '#525252'
    ctx.fillText(label, node.x, node.y + nodeSize + 2)
  }, [selectedNodeIds, hoveredNode, isDark])

  // 링크 캔버스 렌더링
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source
    const end = link.target

    if (!start || !end || typeof start.x !== 'number') return

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = isDark ? 'rgba(107, 114, 128, 0.3)' : 'rgba(156, 163, 175, 0.4)'
    ctx.lineWidth = 1 / globalScale
    ctx.stroke()
  }, [isDark])

  // 초기 줌 설정
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50)
      }, 500)
    }
  }, [graphData.nodes.length])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #18181b 0%, #1f1f23 100%)'
          : 'linear-gradient(135deg, #fafafa 0%, #f4f4f5 100%)'
      }}
    >
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"
        // 노드 설정
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.beginPath()
          ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI)
          ctx.fillStyle = color
          ctx.fill()
        }}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDragEnd={(node: any) => {
          node.fx = node.x
          node.fy = node.y
        }}
        // 링크 설정
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={0}
        // 물리 엔진 설정 (Force-directed)
        d3VelocityDecay={0.3}
        d3AlphaDecay={0.02}
        cooldownTicks={100}
        warmupTicks={100}
        // 상호작용
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.5}
        maxZoom={5}
      />

      {/* 노드 정보 툴팁 */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 px-3 py-2 rounded-lg text-sm bg-zinc-900/90 text-zinc-200 border border-zinc-700">
          {graph?.nodes.find(n => n.id === hoveredNode)?.title}
        </div>
      )}
    </div>
  )
}
