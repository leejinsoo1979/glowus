'use client'

import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTheme } from 'next-themes'
import { useNeuralMapStore } from '@/lib/neural-map/store'
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
  self: '#8b5cf6',      // Purple (테마색 - 중심 노드)
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
import { renderToStaticMarkup } from 'react-dom/server'
import {
  BsFiletypePdf,
  BsFiletypeJs,
  BsFiletypeTsx,
  BsFiletypeJsx,
  BsFiletypeHtml,
  BsFiletypeCss,
  BsFiletypeJson,
  BsFiletypeMd,
  BsFiletypePy,
  BsFiletypeJava,
  BsFiletypeRb,
  BsFiletypeSh,
  BsFiletypeYml,
  BsFiletypeXml,
  BsFiletypePng,
  BsFiletypeJpg,
  BsFiletypeGif,
  BsFiletypeSvg,
  BsFileEarmarkText,
  BsFileEarmarkCode,
  BsFolder,
  BsFolderFill
} from 'react-icons/bs'

// 아이콘 이미지 캐시
const iconImageCache: Record<string, HTMLImageElement> = {}

// 아이콘 컴포넌트 매핑
const getIconComponent = (ext: string) => {
  const lower = ext.toLowerCase()
  switch (lower) {
    case 'pdf': return BsFiletypePdf
    case 'js': return BsFiletypeJs
    case 'mjs': return BsFiletypeJs
    case 'jsx': return BsFiletypeJsx
    case 'ts': return BsFiletypeTsx // Use TSX icon for TS
    case 'tsx': return BsFiletypeTsx
    case 'html': return BsFiletypeHtml
    case 'css': return BsFiletypeCss
    case 'scss': return BsFiletypeCss
    case 'sass': return BsFiletypeCss
    case 'json': return BsFiletypeJson
    case 'md': return BsFiletypeMd
    case 'markdown': return BsFiletypeMd
    case 'py': return BsFiletypePy
    case 'java': return BsFiletypeJava
    case 'rb': return BsFiletypeRb
    case 'sh': return BsFiletypeSh
    case 'yml': return BsFiletypeYml
    case 'yaml': return BsFiletypeYml
    case 'xml': return BsFiletypeXml
    case 'png': return BsFiletypePng
    case 'jpg': return BsFiletypeJpg
    case 'jpeg': return BsFiletypeJpg
    case 'gif': return BsFiletypeGif
    case 'svg': return BsFiletypeSvg
    default: return BsFileEarmarkCode
  }
}

// 아이콘 이미지 로드/생성 Helper
const getIconImage = (ext: string, color: string) => {
  const cacheKey = `${ext}-${color}`
  if (iconImageCache[cacheKey]) return iconImageCache[cacheKey]

  const IconComp = getIconComponent(ext)
  try {
    const svgString = renderToStaticMarkup(
      <IconComp size={64} color={color} style={{ display: 'block' }} />
    )
    const encoded = encodeURIComponent(svgString)
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encoded}`
    iconImageCache[cacheKey] = img
    return img
  } catch (e) {
    console.error('Icon load failed:', e)
    return null
  }
}

function drawFileTypeIcon(ctx: CanvasRenderingContext2D, ext: string, x: number, y: number, size: number, color: string) {
  const img = getIconImage(ext, color)

  if (img && img.complete && img.naturalWidth > 0) {
    // 이미지 그리기 (중앙 정렬)
    // 원 안에 꽉 채우기 위해 margin 고려 (radius * 1.1)
    // size가 지름이라면 0.6배, 반지름이라면 1.2배
    // 여기서 size는 radius(actualSize)로 넘어옴 (아래 호출부 확인)
    const iconSize = size * 1.1
    ctx.drawImage(img, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize)
  } else {
    // 로딩 중이거나 실패 시 기본 텍스트 처리
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = color
    ctx.font = `bold ${size / 2}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ext.slice(0, 3).toUpperCase(), 0, 0)
    ctx.restore()
  }
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
  parentId?: string  // 부모 노드 ID
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
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)
  const radialDistance = useNeuralMapStore((s) => s.radialDistance)
  const graphExpanded = useNeuralMapStore((s) => s.graphExpanded)

  // 컨테이너 크기 감지
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }

    // 초기 크기 설정
    updateDimensions()

    // ResizeObserver로 컨테이너 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })
    resizeObserver.observe(container)

    // window resize도 감지 (fallback)
    window.addEventListener('resize', updateDimensions)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
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

  // 그래프 데이터 변환 (필터링 + 방사 거리 대비)
  const graphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }

    // 노드 맵 생성 (부모 참조용)
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]))

    // 재귀적 가시성 체크 함수
    const isVisible = (nodeId: string): boolean => {
      const node = nodeMap.get(nodeId)
      if (!node) return false
      if (node.type === 'self') return true // 루트는 항상 보임
      if (!node.parentId) return true // 부모가 없으면 보임

      // 부모가 확장목록에 없으면(닫힘) -> 안보임
      const parent = nodeMap.get(node.parentId)
      if (parent && !expandedNodeIds.has(parent.id)) return false

      // 부모 자체도 보여야 함 (재귀)
      return isVisible(node.parentId)
    }

    // 가시성 필터링 적용
    const visibleNodes = graph.nodes.filter(node => isVisible(node.id))
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))

    console.log('[Graph2DView] Total nodes:', graph.nodes.length, 'Visible:', visibleNodes.length)
    console.log('[Graph2DView] Node types:', graph.nodes.map(n => ({ id: n.id, type: n.type, parentId: (n as any).parentId })))

    const nodes: GraphNode[] = visibleNodes.map((node) => {
      // 노드 제목으로 파일 매칭
      const matchedFile = fileMap.get(node.title) || fileMap.get(node.id)
      const ext = getExtension(node.title)
      const hasFileExt = ext && FILE_TYPE_COLORS[ext]

      // 색상 결정
      let nodeColor = NODE_COLORS[node.type] || '#6b7280'
      if (hasFileExt) {
        nodeColor = FILE_TYPE_COLORS[ext]
      }
      // 선택 상태는 렌더링 시점에 nodeCanvasObject에서 처리하므로 여기서 변경하지 않음 (리렌더링 방지)

      // 크기 결정 - 더 작게!
      let nodeSize = 4 // 기본 크기 (작게)
      if (node.type === 'self') {
        nodeSize = 10 // Self 노드 크기 축소 (사용자 요청)
      } else if (node.type === 'folder') {
        nodeSize = 5 // 폴더는 약간 크게
      } else if (matchedFile?.size) {
        // 파일 크기에 따라 3~6 범위
        nodeSize = 3 + (fileSizeToNodeSize(matchedFile.size, fileSizeRange.min, fileSizeRange.max) - 6) * 0.5
        nodeSize = Math.max(3, Math.min(6, nodeSize))
      } else {
        nodeSize = 4 + Math.min((node.importance || 0), 2) * 0.5
      }

      // SELF 노드 위치 고정
      const isSelf = node.type === 'self'
      const angle = Math.random() * Math.PI * 2
      // 초기 배치 거리를 radialDistance에 비례하게 설정
      const initDist = radialDistance ? radialDistance * 1.5 : 300
      const distance = initDist + Math.random() * (radialDistance * 0.5)

      return {
        id: node.id,
        name: node.title,
        type: node.type,
        val: nodeSize,
        color: nodeColor,
        fileType: ext || undefined,
        fileSize: matchedFile?.size,
        parentId: node.parentId,
        ...(isSelf
          ? { fx: 0, fy: 0, x: 0, y: 0 }
          : { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance }
        ),
      }
    })

    const links: GraphLink[] = graph.edges
      .filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
        type: edge.type,
      }))

    return { nodes, links }
  }, [graph, files, fileMap, fileSizeRange, expandedNodeIds, radialDistance])

  // 디버그: graphData 내용 출력
  console.log('[Graph2DView] graphData nodes:', graphData.nodes.map(n => ({ id: n.id, name: n.name, x: n.x, y: n.y, type: n.type })))

  // 노드 클릭 핸들러 - 선택 + 코드 미리보기
  const handleNodeClick = useCallback((node: any) => {
    if (node?.id) {
      setSelectedNodes([node.id])

      // 1. Try direct ID match
      let targetFile = files.find(f => f.id === node.id)

      // 2. Try sourceRef if available (from neural node data)
      if (!targetFile && node.sourceRef?.fileId) {
        targetFile = files.find(f => f.id === node.sourceRef.fileId)
      }

      // 3. Legacy support: 'node-' prefix
      if (!targetFile && (node.id as string).startsWith('node-')) {
        const fileId = (node.id as string).replace('node-', '')
        targetFile = files.find(f => f.id === fileId)
      }

      if (targetFile) {
        openCodePreview(targetFile)
      }
    }
  }, [setSelectedNodes, files, openCodePreview])

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
    // 위치가 유효하지 않으면 렌더링 스킵
    if (!isFinite(node.x) || !isFinite(node.y)) return

    const label = node.name
    const fontSize = 11 / globalScale
    const isSelected = selectedNodeIds.includes(node.id)
    const isHovered = hoveredNode === node.id

    // 노드 크기 (고정 크기, 줌에 따라 자연스럽게 스케일)
    const baseSize = node.val || 4
    const actualSize = baseSize

    // 색상 결정
    let fillColor = node.color || '#6b7280'
    // 파일 타입이 있으면 해당 색상 사용 (배경)
    if (node.fileType) {
      fillColor = FILE_TYPE_COLORS[node.fileType.toLowerCase()] || '#6b7280'
    }

    if (isSelected || isHovered) {
      // 선택 시 테두리로 강조하되, 배경색은 유지하거나 약간 밝게
      // 여기서는 원래 색상 유지하고 테두리 그림자 추가
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

    // 파일 타입 아이콘 그리기 (SELF 노드는 프로젝트 아이콘 우선)
    if (node.type === 'self') {
      // Self 노드 - 프로젝트 중앙 아이콘
      ctx.save()

      // 외곽 글로우 링 (테마색)
      const gradient = ctx.createRadialGradient(
        node.x, node.y, actualSize * 0.6,
        node.x, node.y, actualSize * 1.3
      )
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)')
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0)')
      ctx.beginPath()
      ctx.arc(node.x, node.y, actualSize * 1.3, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // 프로젝트 폴더 아이콘
      const s = actualSize * 0.45
      ctx.strokeStyle = '#ffffff'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // 폴더 본체
      ctx.beginPath()
      ctx.moveTo(node.x - s, node.y - s * 0.3)
      ctx.lineTo(node.x - s, node.y + s * 0.8)
      ctx.lineTo(node.x + s, node.y + s * 0.8)
      ctx.lineTo(node.x + s, node.y - s * 0.5)
      ctx.lineTo(node.x + s * 0.2, node.y - s * 0.5)
      ctx.lineTo(node.x - s * 0.1, node.y - s * 0.9)
      ctx.lineTo(node.x - s, node.y - s * 0.9)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // 폴더 탭
      ctx.beginPath()
      ctx.moveTo(node.x - s, node.y - s * 0.3)
      ctx.lineTo(node.x + s, node.y - s * 0.3)
      ctx.stroke()

      // 중앙 점 3개 (파일 표시)
      ctx.fillStyle = '#ffffff'
      const dotY = node.y + s * 0.25
      const dotR = s * 0.12
      ctx.beginPath()
      ctx.arc(node.x - s * 0.4, dotY, dotR, 0, Math.PI * 2)
      ctx.arc(node.x, dotY, dotR, 0, Math.PI * 2)
      ctx.arc(node.x + s * 0.4, dotY, dotR, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    } else if (node.fileType) {
      // 파일 타입 아이콘 (흰색)
      // actualSize는 반지름. 원 안에 안전하게 넣으려면 actualSize * 1.2 정도 (지름의 60%)
      const iconSize = actualSize * 1.2
      drawFileTypeIcon(ctx, node.fileType, node.x, node.y, iconSize, '#FFFFFF')
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

    // 엣지 타입별 색상
    if (link.type === 'imports') {
      ctx.strokeStyle = '#f59e0b'  // 앰버 - import 관계
      ctx.lineWidth = 2 / globalScale
      ctx.setLineDash([5 / globalScale, 3 / globalScale])
    } else {
      ctx.strokeStyle = isDark ? 'rgba(147, 197, 253, 0.7)' : 'rgba(59, 130, 246, 0.7)'  // 파란색 - 구조
      ctx.lineWidth = 1.5 / globalScale
      ctx.setLineDash([])
    }
    ctx.stroke()
    ctx.setLineDash([])
  }, [isDark])

  // 그래프 로드 후 자동 줌 맞춤 (SELF 노드 중심)
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        // SELF 노드(0,0)를 중심으로 적절한 줌 레벨 설정
        graphRef.current?.centerAt(0, 0, 300)
        graphRef.current?.zoom(1.5, 300)
      }, 500)
    }
  }, [graphData.nodes.length])

  // radialDistance 변경 시 시뮬레이션 재시작
  useEffect(() => {
    if (graphRef.current && radialDistance) {
      // d3 시뮬레이션 재가열로 노드 재배치
      graphRef.current.d3ReheatSimulation?.()
    }
  }, [radialDistance])

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
        key={`graph-${graphData.nodes.length}`}
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="transparent"

        // 노드 설정
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.val || 4, 0, 2 * Math.PI)
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
        // 물리 엔진 설정 - 빠르게 안정화
        dagMode={undefined}
        d3VelocityDecay={0.6}
        d3AlphaDecay={0.1}
        cooldownTicks={50}
        warmupTicks={50}
        // 노드 간 거리 (방사거리와 연동) - 강한 척력으로 퍼뜨림
        // @ts-ignore - d3Force is a valid prop but not in type definitions
        d3Force={(forceName: string, force: any) => {
          const effectiveDistance = radialDistance * 1.5
          const effectiveStrength = -radialDistance * 8 // 매우 강한 척력으로 노드 분리

          if (forceName === 'charge') {
            // 강한 척력 + 넓은 영향 범위로 노드들이 서로 밀어냄
            force.strength(effectiveStrength).distanceMax(radialDistance * 8)
          }
          if (forceName === 'link') {
            // 약한 링크 강도로 노드들이 독립적으로 움직임
            force.distance(effectiveDistance).strength(0.05)
          }
          if (forceName === 'center') {
            // 약한 중심력
            force.strength(0.01)
          }
          // collision force 추가로 노드 겹침 방지
          if (forceName === 'collide') {
            force.radius(20).strength(0.8)
          }
        }}
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

export default Graph2DView
