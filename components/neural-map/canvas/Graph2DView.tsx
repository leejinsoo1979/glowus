'use client'

import React, { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'
import { forceRadial, forceY } from 'd3-force'

// ForceGraph2D를 React 외부에서 직접 관리
let ForceGraph2DClass: any = null

// DOM 패치는 page.tsx에서 수행됨

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
  sourceRef?: { fileId: string; kind: string }  // 원본 파일 참조
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
  const layoutMode = useNeuralMapStore((s) => s.layoutMode)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const hoveredNodeRef = useRef<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

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
  const currentTheme = useNeuralMapStore((s) => s.currentTheme)
  const focusNodeId = useNeuralMapStore((s) => s.focusNodeId)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)

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

    // 🔍 디버그: 폴더 노드 상세 정보
    const folderNodes = graph.nodes.filter(n => n.type === 'folder')
    const selfNode = graph.nodes.find(n => n.type === 'self')
    console.log('[Graph2DView] 📊 Stats:', {
      totalNodes: graph.nodes.length,
      visibleNodes: visibleNodes.length,
      folderNodes: folderNodes.length,
      selfNode: selfNode?.id,
      expandedNodeIds: Array.from(expandedNodeIds)
    })
    console.log('[Graph2DView] 📁 Folder details:', folderNodes.map(n => ({
      id: n.id,
      title: n.title,
      parentId: (n as any).parentId,
      parentInExpanded: expandedNodeIds.has((n as any).parentId),
      isVisible: isVisible(n.id)
    })))

    const nodes: GraphNode[] = visibleNodes.map((node, index) => {
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
        nodeSize = 12 // Self 노드
      } else if (node.type === 'folder') {
        nodeSize = 5 // 폴더는 약간 크게
      } else if (matchedFile?.size) {
        // 파일 크기에 따라 3~6 범위
        nodeSize = 3 + (fileSizeToNodeSize(matchedFile.size, fileSizeRange.min, fileSizeRange.max) - 6) * 0.5
        nodeSize = Math.max(3, Math.min(6, nodeSize))
      } else {
        nodeSize = 4 + Math.min((node.importance || 0), 2) * 0.5
      }

      // SELF 노드 위치 고정, 나머지는 원형으로 균등 배치
      const isSelf = node.type === 'self'

      // 균등한 각도로 배치 (겹침 방지)
      const totalNonSelfNodes = visibleNodes.filter(n => n.type !== 'self').length
      const nonSelfIndex = visibleNodes.filter((n, i) => n.type !== 'self' && i < index).length
      const goldenAngle = Math.PI * (3 - Math.sqrt(5)) // 황금각 ~137.5도
      const angle = nonSelfIndex * goldenAngle // 황금각으로 배치하면 균등하게 퍼짐

      // 거리는 노드 수에 따라 동적 조절 (더 조밀하게)
      const baseDistance = Math.max(80, radialDistance || 80)
      const distance = baseDistance + (nonSelfIndex * 10) // 각 노드마다 거리 증가 (적게)

      return {
        id: node.id,
        name: node.title,
        type: node.type,
        val: nodeSize,
        color: nodeColor,
        fileType: ext || undefined,
        fileSize: matchedFile?.size,
        parentId: node.parentId,
        sourceRef: node.sourceRef,  // 원본 파일 참조 포함
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

  // 선택된 노드와 연결된 노드 ID 계산 (강조 표시용)
  const connectedNodeIds = useMemo(() => {
    if (selectedNodeIds.length === 0 || !graph?.edges) return new Set<string>()

    const connected = new Set<string>(selectedNodeIds)

    // 선택된 노드와 직접 연결된 모든 노드 찾기
    graph.edges.forEach(edge => {
      selectedNodeIds.forEach(selectedId => {
        if (edge.source === selectedId) {
          connected.add(edge.target)
        }
        if (edge.target === selectedId) {
          connected.add(edge.source)
        }
      })
    })

    // 부모-자식 관계도 포함 (폴더 구조)
    graph.nodes.forEach(node => {
      const nodeWithParent = node as any
      selectedNodeIds.forEach(selectedId => {
        // 선택된 노드의 부모
        if (nodeWithParent.parentId === selectedId) {
          connected.add(node.id)
        }
        // 선택된 노드가 자식인 경우 부모도 포함
        const selectedNode = graph.nodes.find(n => n.id === selectedId) as any
        if (selectedNode?.parentId === node.id) {
          connected.add(node.id)
        }
      })
    })

    return connected
  }, [selectedNodeIds, graph?.edges, graph?.nodes])

  // 디버그: graphData 내용 출력
  console.log('[Graph2DView] graphData nodes:', graphData.nodes.map(n => ({ id: n.id, name: n.name, x: n.x, y: n.y, type: n.type })))

  // 노드 클릭 핸들러 - 선택 + 코드 미리보기 + 카메라 이동
  const handleNodeClick = useCallback((node: any) => {
    if (node?.id) {
      setSelectedNodes([node.id])

      // 🎯 선택한 노드를 화면 중심으로 부드럽게 이동
      if (graphInstanceRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
        graphInstanceRef.current.centerAt(node.x, node.y, 500)
        // 적당한 줌 레벨로 조정 (라벨이 보이도록)
        const currentZoom = graphInstanceRef.current.zoom() || 1
        if (currentZoom < 1.5) {
          graphInstanceRef.current.zoom(2.0, 400)
        }
      }

      // 폴더 노드는 파일을 열지 않음
      if (node.type === 'folder' || node.type === 'self') {
        return
      }

      // 🔍 디버그 로그: 노드와 파일 배열 정보
      console.log('[Graph2DView] 🎯 Node click:', {
        nodeId: node.id,
        nodeName: node.name,
        nodeTitle: node.title,
        nodeType: node.type,
        sourceRef: node.sourceRef,
        filesCount: files.length,
        filesIds: files.slice(0, 5).map(f => ({ id: f.id, name: f.name }))
      })

      // 다양한 방법으로 파일 매칭 시도
      let targetFile = null

      // 1. Try direct ID match
      targetFile = files.find(f => f.id === node.id)

      // 2. Try by name (node.name 또는 node.title)
      if (!targetFile && node.name) {
        targetFile = files.find(f => f.name === node.name || f.name === node.name + '.md')
      }
      if (!targetFile && node.title) {
        targetFile = files.find(f => f.name === node.title || f.name === node.title + '.md')
      }

      // 3. Try by path matching
      if (!targetFile && node.name) {
        targetFile = files.find(f => f.path?.endsWith(node.name) || f.path?.includes(node.name))
      }

      // 4. Try sourceRef if available (from neural node data)
      if (!targetFile && node.sourceRef?.fileId) {
        targetFile = files.find(f => f.id === node.sourceRef.fileId)
      }

      // 5. Try fileId property
      if (!targetFile && node.fileId) {
        targetFile = files.find(f => f.id === node.fileId)
      }

      // 6. Legacy support: 'node-' prefix
      if (!targetFile && (node.id as string).startsWith('node-')) {
        const fileId = (node.id as string).replace('node-', '')
        targetFile = files.find(f => f.id === fileId)
      }

      // 7. Try matching by title in files
      if (!targetFile) {
        const nodeTitle = node.title || node.name
        if (nodeTitle) {
          targetFile = files.find(f =>
            f.name.replace(/\.\w+$/, '') === nodeTitle ||
            f.name === nodeTitle
          )
        }
      }

      if (targetFile) {
        console.log('[Graph2DView] ✅ Opening file:', {
          fileName: targetFile.name,
          fileId: targetFile.id,
          filePath: targetFile.path,
          nodeId: node.id,
          sourceRefFileId: node.sourceRef?.fileId
        })
        openCodePreview(targetFile)
      } else {
        console.warn('[Graph2DView] ❌ No file found for node:', {
          nodeId: node.id,
          nodeName: node.name,
          nodeTitle: node.title,
          sourceRef: node.sourceRef,
          availableFiles: files.map(f => ({ id: f.id, name: f.name }))
        })
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

  // 노드 호버 (DOM 직접 조작으로 React 리렌더 방지)
  const handleNodeHover = useCallback((node: any) => {
    hoveredNodeRef.current = node?.id || null

    // 툴팁 DOM 직접 업데이트
    if (tooltipRef.current) {
      if (node?.id) {
        const nodeData = graph?.nodes.find(n => n.id === node.id)
        tooltipRef.current.textContent = nodeData?.title || node.name || ''
        tooltipRef.current.style.display = 'block'
      } else {
        tooltipRef.current.style.display = 'none'
      }
    }
  }, [graph?.nodes])

  // 노드 캔버스 렌더링 (파일 타입 아이콘 포함)
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // 위치가 유효하지 않으면 렌더링 스킵
    if (!isFinite(node.x) || !isFinite(node.y)) return

    const label = node.name
    const fontSize = 11 / globalScale
    const isSelected = selectedNodeIds.includes(node.id)
    const isHovered = hoveredNodeRef.current === node.id

    // 노드가 선택된 것과 연결되어 있는지 확인 (종속성 강조)
    const hasSelection = selectedNodeIds.length > 0
    const isConnected = connectedNodeIds.has(node.id)
    const isDimmed = hasSelection && !isConnected && !isSelected && !isHovered

    // 🌌 은하 효과: 줌아웃 시 반짝이는 별처럼 보이게 (더 멀리 줌아웃해야 활성화)
    const isGalaxyMode = globalScale < 0.6 // 0.6 미만에서만 은하 모드 (더 멀리 줌아웃 필요)
    const time = Date.now() / 1000
    // 각 노드마다 고유한 반짝임 패턴 (노드 ID 해시 기반)
    const nodeHash = node.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)
    const twinkleSpeed = 1.5 + (nodeHash % 10) / 5 // 1.5~3.5 속도 변화
    const twinklePhase = (nodeHash % 100) / 100 * Math.PI * 2 // 위상 차이
    const twinkle = Math.sin(time * twinkleSpeed + twinklePhase) * 0.5 + 0.5 // 0~1

    // 노드 크기 (고정 크기, 줌에 따라 자연스럽게 스케일)
    const baseSize = node.val || 4
    // 연결된 노드는 약간 크게 표시
    let sizeMultiplier = isSelected ? 1.3 : (isConnected && hasSelection) ? 1.15 : 1

    // 은하 모드: 반짝임에 따라 크기 변화
    if (isGalaxyMode && !isSelected && !isHovered) {
      sizeMultiplier *= 0.8 + twinkle * 0.4 // 0.8~1.2 크기 변화
    }
    const actualSize = baseSize * sizeMultiplier

    // 색상 결정
    let fillColor = node.color || '#6b7280'
    // 파일 타입이 있으면 해당 색상 사용 (배경)
    if (node.fileType) {
      fillColor = FILE_TYPE_COLORS[node.fileType.toLowerCase()] || '#6b7280'
    }

    // 투명도 설정: 기본 1.0, 조건에 따라 변경
    if (isDimmed) {
      // 선택된 노드와 연결되지 않은 노드는 매우 흐리게
      ctx.globalAlpha = 0.08
    } else if (isGalaxyMode && !isSelected && !isHovered) {
      // 은하 모드 (줌 < 0.6): 반짝임에 따라 투명도 변화
      ctx.globalAlpha = 0.6 + twinkle * 0.4 // 0.6~1.0 (더 밝게)
    } else {
      // 기본 상태: 완전 불투명
      ctx.globalAlpha = 1.0
    }

    // 그림자/글로우 효과
    if (isSelected) {
      // 선택된 노드: 강한 글로우
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur = 20 / globalScale
    } else if (isHovered) {
      ctx.shadowColor = fillColor
      ctx.shadowBlur = 15 / globalScale
    } else if (isConnected && hasSelection) {
      // 연결된 노드: 테마색 글로우로 강조
      ctx.shadowColor = fillColor
      ctx.shadowBlur = 12 / globalScale
    } else if (isGalaxyMode) {
      // 🌟 은하 모드: 별처럼 반짝이는 글로우
      ctx.shadowColor = fillColor
      ctx.shadowBlur = (8 + twinkle * 15) / globalScale // 반짝일 때 더 강한 글로우
    } else {
      ctx.shadowBlur = 0
    }

    // 노드 원 그리기
    ctx.beginPath()
    ctx.arc(node.x, node.y, actualSize, 0, 2 * Math.PI)
    ctx.fillStyle = fillColor
    ctx.fill()

    // 🌌 은하 모드: 밝은 별에 십자 광선 효과
    if (isGalaxyMode && twinkle > 0.7 && !isDimmed) {
      const rayLength = actualSize * (1.5 + twinkle)
      const rayAlpha = (twinkle - 0.7) / 0.3 * 0.6 // 0~0.6

      ctx.save()
      ctx.strokeStyle = fillColor
      ctx.globalAlpha = rayAlpha
      ctx.lineWidth = 1 / globalScale

      // 수직 광선
      ctx.beginPath()
      ctx.moveTo(node.x, node.y - rayLength)
      ctx.lineTo(node.x, node.y + rayLength)
      ctx.stroke()

      // 수평 광선
      ctx.beginPath()
      ctx.moveTo(node.x - rayLength, node.y)
      ctx.lineTo(node.x + rayLength, node.y)
      ctx.stroke()

      ctx.restore()
    }

    // 테두리 (선택/호버/연결 시)
    if (isSelected) {
      // 선택된 노드: 두꺼운 흰색 테두리
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3 / globalScale
      ctx.stroke()
    } else if (isConnected && hasSelection) {
      // 연결된 노드: 얇은 흰색 테두리로 강조
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2 / globalScale
      ctx.stroke()
    } else if (isHovered) {
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
      // 파일 타입 아이콘
      // actualSize는 반지름. 원 안에 안전하게 넣으려면 actualSize * 1.2 정도 (지름의 60%)
      const iconSize = actualSize * 1.2

      // JS 아이콘은 노란 배경이므로 검정색으로 처리 (가독성 향상)
      const isJS = ['js', 'javascript'].includes(node.fileType.toLowerCase())
      const iconColor = isJS ? '#000000' : '#FFFFFF'

      drawFileTypeIcon(ctx, node.fileType, node.x, node.y, iconSize, iconColor)
    }

    // 라벨 그리기 - 줌 레벨에 따라 표시/숨김 (깔끔한 원거리 뷰)
    // globalScale < 1.8: 라벨 숨김 (원거리에서는 노드만 표시)
    // globalScale 1.8~3.0: 페이드 인
    // globalScale > 3.0: 완전 표시
    const labelOpacity = globalScale < 1.8
      ? 0
      : globalScale < 3.0
        ? (globalScale - 1.8) / 1.2 // 1.8~3.0 사이에서 0~1로 페이드
        : 1

    // 선택되거나 호버된 노드는 항상 라벨 표시 (연결된 노드도)
    const shouldShowLabel = labelOpacity > 0 || isSelected || isHovered || (isConnected && hasSelection)

    if (shouldShowLabel) {
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      // 선택/호버 노드는 완전 불투명, 아니면 줌 레벨에 따라 투명도 조절
      const finalOpacity = (isSelected || isHovered) ? 1 : labelOpacity
      const baseColor = isDark ? '212, 212, 212' : '82, 82, 82'
      ctx.fillStyle = `rgba(${baseColor}, ${finalOpacity})`

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
    }

    // 알파 값 리셋 (다음 노드 렌더링에 영향 방지)
    ctx.globalAlpha = 1
  }, [selectedNodeIds, connectedNodeIds, isDark])

  // 링크 캔버스 렌더링
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const start = link.source
    const end = link.target

    if (!start || !end || typeof start.x !== 'number') return

    // 선택된 노드가 있을 때 연결되지 않은 링크는 흐리게 처리
    const hasSelection = selectedNodeIds.length > 0
    const sourceId = typeof start === 'string' ? start : start.id
    const targetId = typeof end === 'string' ? end : end.id
    const isLinkConnected = connectedNodeIds.has(sourceId) || connectedNodeIds.has(targetId)
    const isLinkDimmed = hasSelection && !isLinkConnected

    if (isLinkDimmed) {
      ctx.globalAlpha = 0.05
    }

    // 연결된 링크인지 확인 (양쪽 노드가 모두 연결된 노드인 경우)
    const isLinkHighlighted = hasSelection &&
      (selectedNodeIds.includes(sourceId) || selectedNodeIds.includes(targetId)) &&
      (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId))

    const isImport = link.type === 'imports'
    const isSemantic = link.type === 'semantic'
    const accentColor = currentTheme.ui.accentColor

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)

    if (isImport) {
      // 의존성 라인: 테마 색상, 얇고 세련되게, 점선, 강한 발광
      ctx.strokeStyle = accentColor
      ctx.lineWidth = isLinkHighlighted ? 2.5 / globalScale : 1.5 / globalScale
      ctx.setLineDash([4 / globalScale, 4 / globalScale]) // 점선 간격 조정

      // 빛나는 효과 (Glow) 강화 - 연결된 링크는 더 강하게
      ctx.shadowBlur = isLinkHighlighted ? 20 : 15
      ctx.shadowColor = accentColor
    } else if (isSemantic) {
      // 기능적 라인
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.5)'
      ctx.lineWidth = isLinkHighlighted ? 1.5 / globalScale : 1.0 / globalScale
      ctx.setLineDash([2 / globalScale, 2 / globalScale])
      ctx.shadowBlur = isLinkHighlighted ? 10 : 0
      ctx.shadowColor = accentColor
    } else {
      // 구조 라인(폴더-파일): 테마 색상을 따르되 은은하게 (투명도 조절)
      if (isLinkHighlighted) {
        // 연결된 링크는 더 밝게 강조
        ctx.globalAlpha = 1
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 2.0 / globalScale
        ctx.shadowBlur = 12
        ctx.shadowColor = accentColor
      } else {
        ctx.globalAlpha = isDark ? 0.3 : 0.4
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 1.0 / globalScale
        ctx.shadowBlur = 0
      }
      ctx.setLineDash([])
    }

    ctx.stroke()
    ctx.globalAlpha = 1.0 // 투명도 초기화
    ctx.setLineDash([])

    // 라벨 그리기 (의존성 관계일 때만)
    if (isImport && link.label && globalScale > 1.2) {
      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2

      ctx.save()
      ctx.translate(midX, midY)

      // 라벨 배경
      ctx.font = `${10 / globalScale}px -apple-system, sans-serif`
      const textWidth = ctx.measureText(link.label).width
      const padding = 4 / globalScale

      ctx.fillStyle = isDark ? 'rgba(24, 24, 27, 0.9)' : 'rgba(255, 255, 255, 0.9)'

      // 라운딩된 사각형 그리기
      const r = 4 / globalScale
      const w = textWidth + padding * 2
      const h = 14 / globalScale
      const x = -w / 2
      const y = -h / 2

      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()

      // 테두리
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 1 / globalScale
      ctx.stroke()

      // 라벨 텍스트
      ctx.fillStyle = accentColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(link.label, 0, 0)

      ctx.restore()
    }

    // 그림자 효과 초기화
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }, [isDark, currentTheme, selectedNodeIds, connectedNodeIds])

  // 그래프 로드 후 자동 줌 맞춤 (SELF 노드 중심)
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // 노드가 1개면 많이 줌 아웃, 여러개면 적당히
      const targetZoom = graphData.nodes.length === 1 ? 0.3 : 1.0
      graphRef.current?.centerAt(0, 0, 300)
      graphRef.current?.zoom(targetZoom, 300)
    }
  }, [graphData.nodes.length])

  // radialDistance 변경 시 시뮬레이션 재시작
  useEffect(() => {
    if (graphRef.current && radialDistance) {
      // d3 시뮬레이션 재가열로 노드 재배치
      graphRef.current.d3ReheatSimulation?.()
    }
  }, [radialDistance])

  // Layout Mode Change Effect
  useEffect(() => {
    // Wait for graph ref and data
    if (!graphRef.current) return

    const applyLayout = () => {
      const fg = graphRef.current
      const effectiveDistance = radialDistance || 150
      console.log('Applying Layout Mode:', layoutMode) // Debug log

      // 1. Force: Charge (Repulsion) - 더 약하게 밀어냄
      fg.d3Force('charge')
        ?.strength(layoutMode === 'radial' ? -80 : -200)
        ?.distanceMax(200)

      // 2. Force: Link (Distance) - 더 짧게
      fg.d3Force('link')?.distance((link: any) => {
        if (layoutMode === 'radial') {
          return link.type === 'parent_child' ? 20 : 50
        }
        if (layoutMode === 'structural') {
          return link.type === 'parent_child' ? 30 : 80
        }
        return link.type === 'imports' ? effectiveDistance * 0.5 : effectiveDistance * 0.8
      })

      // 3. Force: Radial (Circular Layout) - 더 조밀하게
      if (layoutMode === 'radial') {
        fg.d3Force('radial', forceRadial((n: any) => {
          if (n.type === 'self') return 0
          if (n.type === 'folder' || n.depth === 1) return 80
          return 160
        }, 0, 0).strength(0.8))

        fg.d3Force('y', null) // Disable Y force
      }
      // 4. Force: Structural (Tree-like Layout) - 더 조밀하게
      else if (layoutMode === 'structural') {
        fg.d3Force('radial', null) // Disable Radial force

        // Simple hierarchy simulation: folders on top, files below
        fg.d3Force('y', forceY((n: any) => {
          if (n.type === 'self') return -80
          if (n.type === 'folder') return -40
          return 40
        }).strength(0.5))
      }
      // 5. Force: Organic (Default)
      else {
        fg.d3Force('radial', null)
        fg.d3Force('y', null)
      }

      // Restart simulation
      fg.d3ReheatSimulation()
    }

    // Small delay to ensure graph is initialized
    const timer = setTimeout(applyLayout, 50)

    return () => clearTimeout(timer)
  }, [layoutMode, radialDistance, graphData.nodes.length])

  // Imperative ForceGraph2D 마운트 (완전히 React 외부에서 관리)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const graphWrapperRef = useRef<HTMLDivElement | null>(null)
  const graphInstanceRef = useRef<any>(null)
  const isGraphReadyRef = useRef(false)

  // 콜백 함수들을 ref로 저장 (재생성 방지)
  const callbacksRef = useRef({
    nodeCanvasObject,
    linkCanvasObject,
    handleNodeClick,
    handleNodeHover,
    handleBackgroundClick,
  })

  // 콜백 업데이트
  useEffect(() => {
    callbacksRef.current = {
      nodeCanvasObject,
      linkCanvasObject,
      handleNodeClick,
      handleNodeHover,
      handleBackgroundClick,
    }
  }, [nodeCanvasObject, linkCanvasObject, handleNodeClick, handleNodeHover, handleBackgroundClick])

  // ForceGraph2D 초기화 (한 번만 실행)
  useEffect(() => {
    if (!graphContainerRef.current || typeof window === 'undefined') return
    if (isGraphReadyRef.current) return // 이미 초기화됨

    let mounted = true

    const initGraph = async () => {
      try {
        // force-graph 라이브러리 동적 로드
        if (!ForceGraph2DClass) {
          const module = await import('force-graph')
          ForceGraph2DClass = module.default
        }

        if (!mounted || !graphContainerRef.current) return

        // React 외부에서 wrapper div 생성
        const wrapper = document.createElement('div')
        wrapper.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;'
        graphContainerRef.current.appendChild(wrapper)
        graphWrapperRef.current = wrapper

        // 새 인스턴스 생성
        const graph = ForceGraph2DClass()(wrapper)
          .backgroundColor('transparent')
          .width(graphContainerRef.current.clientWidth || 800)
          .height(graphContainerRef.current.clientHeight || 600)
          .nodeCanvasObject((node: any, ctx: any, globalScale: number) =>
            callbacksRef.current.nodeCanvasObject(node, ctx, globalScale))
          .nodePointerAreaPaint((node: any, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.beginPath()
            ctx.arc(node.x, node.y, node.val || 4, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
          })
          .onNodeClick((node: any) => callbacksRef.current.handleNodeClick(node))
          .onNodeHover((node: any) => callbacksRef.current.handleNodeHover(node))
          .onNodeDragEnd((node: any) => {
            node.fx = node.x
            node.fy = node.y
          })
          .linkCanvasObject((link: any, ctx: any, globalScale: number) =>
            callbacksRef.current.linkCanvasObject(link, ctx, globalScale))
          .linkDirectionalParticles((link: any) => link.type === 'imports' ? 4 : 0)
          .linkDirectionalParticleWidth(3)
          .linkDirectionalParticleSpeed(0.01)
          .linkDirectionalParticleColor(() => currentTheme.ui.accentColor)
          .d3VelocityDecay(0.4)
          .d3AlphaDecay(0.01)
          .cooldownTicks(200)
          .warmupTicks(200)
          .enableNodeDrag(true)
          .enableZoomPanInteraction(true)
          .minZoom(0.1)
          .maxZoom(15)
          .onBackgroundClick(() => callbacksRef.current.handleBackgroundClick())

        // Force 설정 (노드 간 거리 축소)
        graph.d3Force('collide')?.radius(35).strength(0.8).iterations(3)
        graph.d3Force('center')?.strength(0.08)
        graph.d3Force('charge')?.strength(-200).distanceMax(200).distanceMin(20)
        graph.d3Force('link')?.distance(50).strength(0.6)

        graphInstanceRef.current = graph
        graphRef.current = graph
        isGraphReadyRef.current = true

        console.log('[Graph2DView] Graph initialized successfully')
      } catch (error) {
        console.error('[Graph2DView] Failed to initialize graph:', error)
      }
    }

    initGraph()

    return () => {
      mounted = false
      if (graphInstanceRef.current) {
        graphInstanceRef.current._destructor?.()
        graphInstanceRef.current = null
      }
      if (graphWrapperRef.current && graphContainerRef.current) {
        try {
          graphContainerRef.current.removeChild(graphWrapperRef.current)
        } catch (e) {
          // DOM이 이미 정리된 경우 무시
        }
        graphWrapperRef.current = null
      }
      isGraphReadyRef.current = false
    }
  }, []) // 빈 의존성 - 한 번만 마운트

  // 🌌 은하 효과 애니메이션 루프 (줌아웃 시 반짝임)
  useEffect(() => {
    if (!graphInstanceRef.current || !isGraphReadyRef.current) return

    let animationId: number
    let lastTime = 0
    const fps = 30 // 30fps로 제한하여 성능 최적화

    const animate = (currentTime: number) => {
      if (currentTime - lastTime >= 1000 / fps) {
        // 줌 레벨 체크하여 은하 모드일 때만 리렌더
        const currentZoom = graphInstanceRef.current?.zoom?.() || 1
        if (currentZoom < 0.6) {
          // 강제 리렌더링으로 반짝임 효과 적용
          graphInstanceRef.current?.refresh?.()
        }
        lastTime = currentTime
      }
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [graphData.nodes.length]) // 노드가 있을 때만 애니메이션

  // graphData 변경 시 업데이트 (imperative)
  useEffect(() => {
    console.log('[Graph2DView] 🔄 graphData useEffect triggered:', {
      graphReady: isGraphReadyRef.current,
      hasInstance: !!graphInstanceRef.current,
      nodeCount: graphData.nodes.length,
      linkCount: graphData.links.length,
      folderNodes: graphData.nodes.filter((n: any) => n.type === 'folder').length
    })

    if (!graphInstanceRef.current || !isGraphReadyRef.current) {
      console.log('[Graph2DView] ⏳ Graph not ready yet, skipping update')
      return
    }
    if (!graphData.nodes.length) {
      console.log('[Graph2DView] ⚠️ No nodes to render')
      return
    }

    try {
      console.log('[Graph2DView] ✅ Updating graph with:', graphData.nodes.length, 'nodes')
      graphInstanceRef.current.graphData(graphData)

      // 첫 데이터 로드 시 줌 조정
      setTimeout(() => {
        if (graphInstanceRef.current) {
          graphInstanceRef.current.centerAt(0, 0, 300)
          graphInstanceRef.current.zoom(graphData.nodes.length === 1 ? 0.3 : 1.0, 300)
        }
      }, 100)
    } catch (error) {
      console.warn('[Graph2DView] Graph data update failed:', error)
    }
  }, [graphData])

  // 크기 변경 시 업데이트
  useEffect(() => {
    if (!graphInstanceRef.current || !isGraphReadyRef.current) return
    if (dimensions.width > 0 && dimensions.height > 0) {
      graphInstanceRef.current
        .width(dimensions.width)
        .height(dimensions.height)
    }
  }, [dimensions])

  // 🎯 검색 시 노드로 카메라 이동
  useEffect(() => {
    if (!focusNodeId || !graphInstanceRef.current || !isGraphReadyRef.current) return

    // graphData에서 해당 노드 찾기
    const targetNode = graphData.nodes.find(n => n.id === focusNodeId)

    if (targetNode && typeof targetNode.x === 'number' && typeof targetNode.y === 'number') {
      console.log('[Graph2DView] 🎯 Focusing on node:', focusNodeId, targetNode.x, targetNode.y)

      // 부드러운 카메라 이동 애니메이션
      graphInstanceRef.current.centerAt(targetNode.x, targetNode.y, 800)

      // 적당한 줌 레벨로 확대 (라벨이 보이는 정도)
      setTimeout(() => {
        graphInstanceRef.current?.zoom(2.5, 600)
      }, 200)

      // 포커스 상태 초기화 (한 번만 실행되도록)
      setTimeout(() => {
        setFocusNodeId(null)
      }, 1500)
    } else {
      // 노드를 찾지 못한 경우 - 파일명으로 재시도
      const file = files.find(f => f.id === focusNodeId)
      if (file) {
        const nodeByName = graphData.nodes.find(n =>
          n.name === file.name ||
          n.name === file.name.replace('.md', '') ||
          n.id.includes(file.id)
        )
        if (nodeByName && typeof nodeByName.x === 'number') {
          console.log('[Graph2DView] 🎯 Focusing on node by name:', nodeByName.name)
          graphInstanceRef.current.centerAt(nodeByName.x, nodeByName.y, 800)
          setTimeout(() => {
            graphInstanceRef.current?.zoom(2.5, 600)
          }, 200)
        }
      }
      // 포커스 상태 초기화
      setTimeout(() => {
        setFocusNodeId(null)
      }, 1000)
    }
  }, [focusNodeId, graphData.nodes, files, setFocusNodeId])

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
      {/* ForceGraph2D가 마운트될 컨테이너 - React가 관리하지 않음 */}
      <div
        ref={graphContainerRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />

      {/* 노드 정보 툴팁 - DOM 직접 조작으로 업데이트 */}
      <div
        ref={tooltipRef}
        className="absolute bottom-4 left-4 px-3 py-2 rounded-lg text-sm bg-zinc-900/90 text-zinc-200 border border-zinc-700"
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default Graph2DView
