'use client'

import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useUIStore } from '@/stores/uiStore'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'

// Dynamic import for SSR compatibility
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-zinc-500 text-sm">Loading graph...</div>
    </div>
  ),
})

// 파일 타입별 색상
const FILE_TYPE_COLORS: Record<string, string> = {
  tsx: '#3b82f6',     // Blue - React TypeScript
  ts: '#3b82f6',      // Blue - TypeScript
  jsx: '#61dafb',     // Cyan - React
  js: '#f7df1e',      // Yellow - JavaScript
  css: '#a855f7',     // Purple - CSS
  scss: '#cc6699',    // Pink - SCSS
  json: '#6b7280',    // Gray - JSON
  md: '#22c55e',      // Green - Markdown
  markdown: '#22c55e',
  html: '#ef4444',    // Red - HTML
  svg: '#f97316',     // Orange - SVG
  png: '#10b981',     // Emerald - Image
  jpg: '#10b981',
  jpeg: '#10b981',
  gif: '#10b981',
  webp: '#10b981',
  mp4: '#8b5cf6',     // Violet - Video
  webm: '#8b5cf6',
  pdf: '#ef4444',     // Red - PDF
  txt: '#6b7280',     // Gray - Text
  yaml: '#f59e0b',    // Amber - Config
  yml: '#f59e0b',
  env: '#f59e0b',
}

// 노드 타입별 색상 (fallback)
const NODE_COLORS: Record<string, string> = {
  self: '#ffd700',      // Gold (중심 노드)
  concept: '#3b82f6',   // Blue
  project: '#10b981',   // Green
  doc: '#f59e0b',       // Amber
  idea: '#ec4899',      // Pink
  decision: '#8b5cf6',  // Purple
  memory: '#06b6d4',    // Cyan
  task: '#ef4444',      // Red
  person: '#f97316',    // Orange
  insight: '#a855f7',   // Violet
}

// 선택된 노드 색상
const SELECTED_COLOR = '#8b5cf6'
const HOVER_COLOR = '#a78bfa'

// 파일 확장자 추출
function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

// 세련된 파일 타입 아이콘 (얇은 선, 조화로운 색상)
function drawFileTypeIcon(ctx: CanvasRenderingContext2D, ext: string, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  const s = size / 12 // 스케일 팩터
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // 통일된 색상 팔레트 (회색 계열 기반)
  const colors = {
    react: '#8eb8e5',    // 부드러운 파란색
    ts: '#7ba7d4',       // 차분한 파란색
    js: '#d4c87b',       // 부드러운 노란색
    css: '#b794c7',      // 연한 보라색
    html: '#c98a8a',     // 연한 빨간색
    json: '#9ca3af',     // 회색
    md: '#8bc49a',       // 연한 초록색
    image: '#7bc4b8',    // 청록색
    pdf: '#c98a8a',      // 연한 빨간색
    config: '#c4a87b',   // 연한 황갈색
    default: '#9ca3af',  // 회색
  }

  switch (ext) {
    case 'tsx':
    case 'jsx':
      // React - 얇은 원자 궤도
      ctx.strokeStyle = colors.react
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.ellipse(0, 0, 5 * s, 2 * s, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(0, 0, 5 * s, 2 * s, Math.PI / 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.ellipse(0, 0, 5 * s, 2 * s, -Math.PI / 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, 1.2 * s, 0, Math.PI * 2)
      ctx.fillStyle = colors.react
      ctx.fill()
      break
    case 'ts':
      // TypeScript - 깔끔한 T
      ctx.strokeStyle = colors.ts
      ctx.lineWidth = 1 * s
      ctx.beginPath()
      ctx.moveTo(-4 * s, -4 * s)
      ctx.lineTo(4 * s, -4 * s)
      ctx.moveTo(0, -4 * s)
      ctx.lineTo(0, 5 * s)
      ctx.stroke()
      break
    case 'js':
      // JavaScript - 깔끔한 J
      ctx.strokeStyle = colors.js
      ctx.lineWidth = 1 * s
      ctx.beginPath()
      ctx.moveTo(2 * s, -4 * s)
      ctx.lineTo(2 * s, 3 * s)
      ctx.quadraticCurveTo(2 * s, 5 * s, -2 * s, 5 * s)
      ctx.stroke()
      break
    case 'css':
    case 'scss':
      // CSS - 물결 (스타일)
      ctx.strokeStyle = colors.css
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-5 * s, -2 * s)
      ctx.quadraticCurveTo(-2 * s, -5 * s, 0, -2 * s)
      ctx.quadraticCurveTo(2 * s, 1 * s, 5 * s, -2 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-5 * s, 2 * s)
      ctx.quadraticCurveTo(-2 * s, -1 * s, 0, 2 * s)
      ctx.quadraticCurveTo(2 * s, 5 * s, 5 * s, 2 * s)
      ctx.stroke()
      break
    case 'html':
      // HTML - 얇은 꺽쇠
      ctx.strokeStyle = colors.html
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-2 * s, -4 * s)
      ctx.lineTo(-5 * s, 0)
      ctx.lineTo(-2 * s, 4 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(2 * s, -4 * s)
      ctx.lineTo(5 * s, 0)
      ctx.lineTo(2 * s, 4 * s)
      ctx.stroke()
      break
    case 'json':
      // JSON - 얇은 중괄호
      ctx.strokeStyle = colors.json
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-1 * s, -5 * s)
      ctx.quadraticCurveTo(-4 * s, -5 * s, -4 * s, -2 * s)
      ctx.lineTo(-4 * s, -1 * s)
      ctx.quadraticCurveTo(-4 * s, 0, -5 * s, 0)
      ctx.quadraticCurveTo(-4 * s, 0, -4 * s, 1 * s)
      ctx.lineTo(-4 * s, 2 * s)
      ctx.quadraticCurveTo(-4 * s, 5 * s, -1 * s, 5 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(1 * s, -5 * s)
      ctx.quadraticCurveTo(4 * s, -5 * s, 4 * s, -2 * s)
      ctx.lineTo(4 * s, -1 * s)
      ctx.quadraticCurveTo(4 * s, 0, 5 * s, 0)
      ctx.quadraticCurveTo(4 * s, 0, 4 * s, 1 * s)
      ctx.lineTo(4 * s, 2 * s)
      ctx.quadraticCurveTo(4 * s, 5 * s, 1 * s, 5 * s)
      ctx.stroke()
      break
    case 'md':
    case 'markdown':
      // Markdown - 깔끔한 M
      ctx.strokeStyle = colors.md
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-5 * s, 4 * s)
      ctx.lineTo(-5 * s, -4 * s)
      ctx.lineTo(0, 1 * s)
      ctx.lineTo(5 * s, -4 * s)
      ctx.lineTo(5 * s, 4 * s)
      ctx.stroke()
      break
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
      // 이미지 - 심플한 산
      ctx.strokeStyle = colors.image
      ctx.lineWidth = 0.8 * s
      ctx.strokeRect(-5 * s, -4 * s, 10 * s, 8 * s)
      ctx.beginPath()
      ctx.moveTo(-4 * s, 3 * s)
      ctx.lineTo(-1 * s, -1 * s)
      ctx.lineTo(1 * s, 1 * s)
      ctx.lineTo(4 * s, -2 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(3 * s, -2 * s, 1 * s, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'pdf':
      // PDF - 문서 아이콘
      ctx.strokeStyle = colors.pdf
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-3 * s, -5 * s)
      ctx.lineTo(2 * s, -5 * s)
      ctx.lineTo(4 * s, -3 * s)
      ctx.lineTo(4 * s, 5 * s)
      ctx.lineTo(-3 * s, 5 * s)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(2 * s, -5 * s)
      ctx.lineTo(2 * s, -3 * s)
      ctx.lineTo(4 * s, -3 * s)
      ctx.stroke()
      break
    case 'yaml':
    case 'yml':
    case 'env':
      // 설정 - 심플한 슬라이더
      ctx.strokeStyle = colors.config
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-5 * s, -3 * s); ctx.lineTo(5 * s, -3 * s)
      ctx.moveTo(-5 * s, 0); ctx.lineTo(5 * s, 0)
      ctx.moveTo(-5 * s, 3 * s); ctx.lineTo(5 * s, 3 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(-2 * s, -3 * s, 1.5 * s, 0, Math.PI * 2)
      ctx.arc(2 * s, 0, 1.5 * s, 0, Math.PI * 2)
      ctx.arc(-1 * s, 3 * s, 1.5 * s, 0, Math.PI * 2)
      ctx.fillStyle = colors.config
      ctx.fill()
      break
    default:
      // 기본 - 심플한 문서
      ctx.strokeStyle = colors.default
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(-3 * s, -5 * s)
      ctx.lineTo(2 * s, -5 * s)
      ctx.lineTo(4 * s, -3 * s)
      ctx.lineTo(4 * s, 5 * s)
      ctx.lineTo(-3 * s, 5 * s)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(2 * s, -5 * s)
      ctx.lineTo(2 * s, -3 * s)
      ctx.lineTo(4 * s, -3 * s)
      ctx.stroke()
      break
  }
  ctx.restore()
}

// 파일 크기 → 노드 크기 변환 (6~12 범위, 균일하게)
function fileSizeToNodeSize(size: number, minSize: number, maxSize: number): number {
  if (maxSize === minSize) return 8
  // 로그 스케일로 극단적인 크기 차이 완화
  const logSize = Math.log(size + 1)
  const logMin = Math.log(minSize + 1)
  const logMax = Math.log(maxSize + 1)
  const normalized = (logSize - logMin) / (logMax - logMin)
  return 6 + normalized * 6 // 6~12 범위 (더 균일하게)
}

interface GraphNode {
  id: string
  name: string
  type: string
  val: number  // 노드 크기
  color: string
  fileType?: string  // 파일 확장자
  fileSize?: number  // 파일 크기
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
  const files = useNeuralMapStore((s) => s.files)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const openModal = useNeuralMapStore((s) => s.openModal)
  const radialDistance = useNeuralMapStore((s) => s.radialDistance)

  // UI Store - 사이드바 상태와 그래프 연동
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

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

  // 파일 이름으로 파일 찾기
  const fileMap = useMemo(() => {
    const map = new Map<string, NeuralFile>()
    files.forEach(file => {
      map.set(file.name, file)
      map.set(file.id, file)
    })
    return map
  }, [files])

  // 파일 크기 범위 계산
  const fileSizeRange = useMemo(() => {
    if (files.length === 0) return { min: 0, max: 1000 }
    const sizes = files.map(f => f.size || 0).filter(s => s > 0)
    if (sizes.length === 0) return { min: 0, max: 1000 }
    return {
      min: Math.min(...sizes),
      max: Math.max(...sizes),
    }
  }, [files])

  // 그래프 데이터 변환
  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }

    const nodes: GraphNode[] = graph.nodes.map((node) => {
      // 노드 제목으로 파일 매칭
      const matchedFile = fileMap.get(node.title) || fileMap.get(node.id)
      const ext = getExtension(node.title)
      const hasFileExt = ext && FILE_TYPE_COLORS[ext]

      // 색상 결정: 파일 타입 → 노드 타입 → 기본값
      let nodeColor = NODE_COLORS[node.type] || '#6b7280'
      if (hasFileExt) {
        nodeColor = FILE_TYPE_COLORS[ext]
      }
      if (selectedNodeIds.includes(node.id)) {
        nodeColor = SELECTED_COLOR
      }

      // 크기 결정: 파일 크기 기반 또는 중요도 기반 (더 균일하게)
      let nodeSize = 8 // 기본 크기
      if (node.type === 'self') {
        nodeSize = 12 // Self 노드
      } else if (matchedFile?.size) {
        nodeSize = fileSizeToNodeSize(matchedFile.size, fileSizeRange.min, fileSizeRange.max)
      } else {
        nodeSize = 7 + Math.min((node.importance || 0), 3) // 7~10 범위
      }

      return {
        id: node.id,
        name: node.title,
        type: node.type,
        val: nodeSize,
        color: nodeColor,
        fileType: ext || undefined,
        fileSize: matchedFile?.size,
      }
    })

    const links: GraphLink[] = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      type: edge.type,
    }))

    return { nodes, links }
  }, [graph, files, fileMap, fileSizeRange, selectedNodeIds])

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

  // 노드 캔버스 렌더링 (파일 타입 아이콘 포함)
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name
    const fontSize = 11 / globalScale
    const isSelected = selectedNodeIds.includes(node.id)
    const isHovered = hoveredNode === node.id

    // 노드 크기 (고정 크기, 줌에 따라 자연스럽게 스케일)
    const baseSize = node.val || 8
    const actualSize = baseSize // 고정 크기 사용 (줌 시 자연스럽게 확대/축소)

    // 색상 결정
    let fillColor = node.color || '#6b7280'
    if (isSelected || isHovered) {
      fillColor = SELECTED_COLOR
    }

    // 그림자/글로우 효과
    if (isSelected || isHovered) {
      ctx.shadowColor = fillColor
      ctx.shadowBlur = 15 / globalScale
    } else {
      ctx.shadowBlur = 0
    }

    // 노드 원 그리기
    ctx.beginPath()
    ctx.arc(node.x, node.y, actualSize, 0, 2 * Math.PI)
    ctx.fillStyle = fillColor
    ctx.fill()

    // 테두리 (선택/호버 시)
    if (isSelected || isHovered) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    }

    ctx.shadowBlur = 0

    // 파일 타입 아이콘 그리기
    if (node.fileType) {
      const iconSize = Math.max(actualSize * 1.2, 8)
      drawFileTypeIcon(ctx, node.fileType, node.x, node.y, iconSize)
    } else if (node.type === 'self') {
      // Self 노드는 별 모양
      ctx.fillStyle = '#ffffff'
      const starSize = actualSize * 0.5
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
        const r = i === 0 ? starSize : starSize
        const x = node.x + Math.cos(angle) * r
        const y = node.y + Math.sin(angle) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    }

    // 라벨 그리기
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = isDark ? '#d4d4d4' : '#525252'

    // 긴 이름 줄임
    const maxLabelWidth = 100 / globalScale
    let displayLabel = label
    const labelWidth = ctx.measureText(label).width
    if (labelWidth > maxLabelWidth) {
      const ext = getExtension(label)
      const baseName = label.replace(/\.\w+$/, '')
      if (baseName.length > 15) {
        displayLabel = baseName.slice(0, 12) + '...' + (ext ? '.' + ext : '')
      }
    }

    ctx.fillText(displayLabel, node.x, node.y + actualSize + 4)
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

  // radialDistance/sidebarOpen에 따른 effective 값 계산
  const effectiveDistance = sidebarOpen ? radialDistance : radialDistance * 0.2
  const effectiveStrength = sidebarOpen ? -radialDistance * 2 : -30

  // radialDistance/sidebarOpen 변경 시 force 설정 및 시뮬레이션 재시작
  useEffect(() => {
    if (!graphRef.current || graphData.nodes.length === 0) return

    const graph = graphRef.current

    // 약간의 딜레이 후 force 설정 (그래프 초기화 완료 대기)
    const timer = setTimeout(() => {
      // d3Force 설정
      const linkForce = graph.d3Force('link')
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance(effectiveDistance)
      }

      const chargeForce = graph.d3Force('charge')
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(effectiveStrength)
      }

      // 시뮬레이션 재시작
      graph.d3ReheatSimulation()
    }, 100)

    return () => clearTimeout(timer)
  }, [radialDistance, sidebarOpen, effectiveDistance, effectiveStrength, graphData.nodes.length])

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
        key={`graph-${sidebarOpen}-${radialDistance}`}
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
        dagMode={undefined}
        d3VelocityDecay={0.3}
        d3AlphaDecay={0.02}
        cooldownTicks={100}
        warmupTicks={100}
        // 상호작용
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        minZoom={0.1}
        maxZoom={15}
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
