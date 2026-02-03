// @ts-nocheck
'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { forceRadial, forceY, forceCollide } from 'd3-force-3d'
// 🔥 react-icons 완전 제거 - lucide-react로 통일 (번들 사이즈 대폭 절약)
import {
  Rocket,
  Target,
  FolderOpen,
  CheckCircle2,
  FileText,
  Lightbulb,
  Bug,
  Star,
  Circle,
  FileCode,
  FileJson,
  FileImage,
  Folder,
  Terminal,
} from 'lucide-react'

// 🔥 react-icons → lucide-react 별칭 (기존 코드 호환성)
const BsFiletypePdf = FileText
const BsFiletypeJs = FileCode
const BsFiletypeTsx = FileCode
const BsFiletypeJsx = FileCode
const BsFiletypeHtml = FileCode
const BsFiletypeCss = FileCode
const BsFiletypeJson = FileJson
const BsFiletypeMd = FileText
const BsFiletypePy = FileCode
const BsFiletypeJava = FileCode
const BsFiletypeRb = FileCode
const BsFiletypeSh = Terminal
const BsFiletypeYml = FileJson
const BsFiletypeXml = FileJson
const BsFiletypePng = FileImage
const BsFiletypeJpg = FileImage
const BsFiletypeGif = FileImage
const BsFiletypeSvg = FileImage
const BsFileEarmarkText = FileText
const BsFileEarmarkCode = FileCode
const BsFolder = Folder
const BsFolderFill = FolderOpen

// 노드 타입별 아이콘 컴포넌트
const getNodeTypeIcon = (type: string) => {
  switch (type) {
    case 'project': return Rocket
    case 'decision': return Target
    case 'folder': return FolderOpen
    case 'task': return CheckCircle2
    case 'note': return FileText
    case 'idea': return Lightbulb
    case 'bug': return Bug
    case 'feature': return Star
    default: return Circle
  }
}

// 파일 확장자별 아이콘 컴포넌트 매핑
const getIconComponent = (ext: string) => {
  const lower = ext.toLowerCase()
  switch (lower) {
    case 'pdf': return BsFiletypePdf
    case 'js': return BsFiletypeJs
    case 'mjs': return BsFiletypeJs
    case 'jsx': return BsFiletypeJsx
    case 'ts': return BsFiletypeTsx
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

// 파일 타입별 색상
const FILE_TYPE_COLORS: Record<string, number> = {
  tsx: 0x3b82f6,     // Blue - React TypeScript
  ts: 0x3b82f6,      // Blue - TypeScript
  jsx: 0x61dafb,     // Cyan - React
  js: 0xf7df1e,      // Yellow - JavaScript
  css: 0xa855f7,     // Purple - CSS
  scss: 0xcc6699,    // Pink - SCSS
  json: 0x6b7280,    // Gray - JSON
  md: 0x22c55e,      // Green - Markdown
  markdown: 0x22c55e,
  html: 0xef4444,    // Red - HTML
  svg: 0xf97316,     // Orange - SVG
  png: 0x10b981,     // Emerald - Image
  jpg: 0x10b981,
  jpeg: 0x10b981,
  gif: 0x10b981,
  webp: 0x10b981,
  mp4: 0x8b5cf6,     // Violet - Video
  webm: 0x8b5cf6,
  pdf: 0xef4444,     // Red - PDF
  txt: 0x6b7280,     // Gray - Text
  yaml: 0xf59e0b,    // Amber - Config
  yml: 0xf59e0b,
  env: 0xf59e0b,
}

// 노드 타입별 색상 (2D와 동일)
const NODE_COLORS: Record<string, number> = {
  self: 0x8b5cf6,      // Purple
  concept: 0x3b82f6,   // Blue
  project: 0x10b981,   // Green
  doc: 0xf59e0b,       // Amber
  idea: 0xec4899,      // Pink
  decision: 0x8b5cf6,  // Purple
  memory: 0x06b6d4,    // Cyan
  task: 0xef4444,      // Red
  person: 0xf97316,    // Orange
  insight: 0xa855f7,   // Violet
  agent: 0x06b6d4,     // Cyan
  folder: 0x6b7280,    // Gray
}

// 파일 확장자 추출
function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

// ============================================
// HARD COLLISION: 3D 공간에서 당구공처럼 겹치지 않게
// ============================================
function resolveHardCollisions(nodes: any[]) {
  const iterations = 20  // 더 많은 반복

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]

        // 3D 거리 계산 (X, Y, Z 모두 사용)
        const dx = (b.x || 0) - (a.x || 0)
        const dy = (b.y || 0) - (a.y || 0)
        const dz = (b.z || 0) - (a.z || 0)
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        // 최소 거리 = 두 노드 크기의 합 + 여유
        const aSize = a.nodeSize || 10
        const bSize = b.nodeSize || 10
        const requiredDist = (aSize + bSize) * 2 + 15

        if (dist < requiredDist && dist > 0.001) {
          const overlap = requiredDist - dist
          const nx = dx / dist
          const ny = dy / dist
          const nz = dz / dist

          // 3D 방향으로 밀어냄
          a.x = (a.x || 0) - nx * overlap * 0.55
          a.y = (a.y || 0) - ny * overlap * 0.55
          a.z = (a.z || 0) - nz * overlap * 0.55
          b.x = (b.x || 0) + nx * overlap * 0.55
          b.y = (b.y || 0) + ny * overlap * 0.55
          b.z = (b.z || 0) + nz * overlap * 0.55
        } else if (dist <= 0.001) {
          // 같은 위치 - 구 표면으로 밀어냄 (Golden Angle)
          const phi = Math.acos(1 - 2 * Math.random())
          const theta = Math.PI * (1 + Math.sqrt(5)) * Math.random()
          b.x = (a.x || 0) + requiredDist * Math.sin(phi) * Math.cos(theta)
          b.y = (a.y || 0) + requiredDist * Math.sin(phi) * Math.sin(theta)
          b.z = (a.z || 0) + requiredDist * Math.cos(phi)
        }
      }
    }
  }
}

// ============================================
// Performance Optimization: Caches
// ============================================

// Geometry cache - shared across all nodes
const geometryCache = new Map<string, any>()
function getCachedGeometry(size: number, THREE: any): any {
  const key = `sphere-${size.toFixed(1)}`
  if (!geometryCache.has(key)) {
    // Lower segment count for performance (24→12)
    geometryCache.set(key, new THREE.SphereGeometry(size, 12, 12))
  }
  return geometryCache.get(key)!
}

// Material cache - shared by color
// Using MeshBasicMaterial for better visibility (no lighting dependency)
const materialCache = new Map<string, any>()
function getCachedMaterial(color: number, emissiveIntensity: number, THREE: any): any {
  const key = `mat-${color}-${emissiveIntensity.toFixed(1)}`
  if (!materialCache.has(key)) {
    // Use MeshBasicMaterial - doesn't require lights, always visible
    materialCache.set(key, new THREE.MeshBasicMaterial({
      color,
      transparent: false,
    }))
  }
  return materialCache.get(key)!
}

// Texture cache for file icons
const textureCache = new Map<string, any>()
function getCachedTexture(ext: string, color: string, IconComp: any, THREE: any): any | null {
  const key = `icon-${ext}-${color}`
  if (textureCache.has(key)) {
    return textureCache.get(key)!
  }

  // Create texture only once per extension
  const canvas = document.createElement('canvas')
  canvas.width = 64  // Reduced from 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  try {
    const isJS = ['js', 'javascript'].includes(ext.toLowerCase())
    const iconColor = isJS ? '#000000' : '#FFFFFF'
    const svgString = renderToStaticMarkup(<IconComp size={50} color={iconColor} style={{ display: 'block' }} />)
    const img = new Image()
    const svgData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    const texture = new THREE.CanvasTexture(canvas)

    img.onload = () => {
      ctx.clearRect(0, 0, 64, 64)
      ctx.beginPath()
      ctx.arc(32, 32, 27, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.drawImage(img, 7, 7, 50, 50)
      texture.needsUpdate = true
    }
    img.src = svgData

    textureCache.set(key, texture)
    return texture
  } catch (e) {
    return null
  }
}

// Node type icon texture cache
const nodeTypeTextureCache = new Map<string, any>()
function getNodeTypeTexture(type: string, THREE: any): any | null {
  const key = `nodetype-${type}`
  if (nodeTypeTextureCache.has(key)) {
    return nodeTypeTextureCache.get(key)!
  }

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  try {
    const IconComp = getNodeTypeIcon(type)
    const svgString = renderToStaticMarkup(<IconComp size={48} color="#FFFFFF" strokeWidth={2} style={{ display: 'block' }} />)
    const img = new Image()
    const svgData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

    const texture = new THREE.CanvasTexture(canvas)

    img.onload = () => {
      ctx.clearRect(0, 0, 64, 64)
      ctx.drawImage(img, 8, 8, 48, 48)
      texture.needsUpdate = true
    }
    img.src = svgData

    nodeTypeTextureCache.set(key, texture)
    return texture
  } catch (e) {
    console.error('Node type texture error:', e)
    return null
  }
}

// Ring geometry cache
let ringGeometryCache: any | null = null
function getCachedRingGeometry(THREE: any): any {
  if (!ringGeometryCache) {
    ringGeometryCache = new THREE.TorusGeometry(1, 0.08, 8, 24) // Lower segments
  }
  return ringGeometryCache
}

// Ring material cache - for selection ring
const ringMaterialCache = new Map<string, any>()
function getCachedRingMaterial(isSelected: boolean, THREE: any): any {
  const key = isSelected ? 'selected' : 'hidden'
  if (!ringMaterialCache.has(key)) {
    ringMaterialCache.set(key, new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: isSelected ? 0.9 : 0,
    }))
  }
  return ringMaterialCache.get(key)!
}

// Self node star texture cache
let starTextureCache: any | null = null
function getCachedStarTexture(THREE: any): any {
  if (starTextureCache) return starTextureCache

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const cx = 32, cy = 32
    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const oa = (i * 2 * Math.PI / 5) - Math.PI / 2, ia = oa + Math.PI / 5
      const or = 22, ir = 10
      i === 0 ? ctx.moveTo(cx + Math.cos(oa) * or, cy + Math.sin(oa) * or) : ctx.lineTo(cx + Math.cos(oa) * or, cy + Math.sin(oa) * or)
      ctx.lineTo(cx + Math.cos(ia) * ir, cy + Math.sin(ia) * ir)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  starTextureCache = new THREE.CanvasTexture(canvas)
  return starTextureCache
}

// 파일 크기 → 노드 크기 변환 (8~14 범위, 균일하게)
function fileSizeToNodeSize(size: number, minSize: number, maxSize: number): number {
  if (maxSize === minSize) return 10
  // 로그 스케일로 극단적인 크기 차이 완화
  const logSize = Math.log(size + 1)
  const logMin = Math.log(minSize + 1)
  const logMax = Math.log(maxSize + 1)
  const normalized = (logSize - logMin) / (logMax - logMin)
  return 8 + normalized * 6 // 8~14 범위 (더 균일하게)
}

// Types for 3d-force-graph
interface GraphNode {
  id: string
  label: string
  type: string
  depth: number
  expanded: boolean
  fileType?: string   // 파일 확장자
  fileSize?: number   // 파일 크기
  nodeSize?: number   // 계산된 노드 크기
  parentId?: string   // 부모 노드 ID
  x?: number
  y?: number
  z?: number
  // Original node reference
  __node?: NeuralNode
}

interface GraphLink {
  source: string
  target: string
  kind: 'parent' | 'reference' | 'sibling' | 'imports'
  particles: number  // 파티클 개수
  particleWidth: number  // 파티클 크기
  particleColor: string  // 파티클 색상
}

interface CosmicForceGraphProps {
  className?: string
}

export function CosmicForceGraph({ className }: CosmicForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [threeInstance, setThreeInstance] = useState<any>(null)
  const [webglError, setWebglError] = useState<string | null>(null)
  const zoomLevelRef = useRef<number>(500) // Track camera distance for LOD

  // Store
  const graph = useNeuralMapStore((s) => s.graph)
  const files = useNeuralMapStore((s) => s.files)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const radialDistance = useNeuralMapStore((s) => s.radialDistance)
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)
  const currentTheme = useNeuralMapStore((s) => s.currentTheme)
  const isSimulationRunning = useNeuralMapStore((s) => s.isSimulationRunning)
  const layoutMode = useNeuralMapStore((s) => s.layoutMode)

  // UI Store - 사이드바 상태와 그래프 연동
  const graphExpanded = useNeuralMapStore((s) => s.graphExpanded)

  // Theme
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Client-side only
  useEffect(() => {
    setIsClient(true)
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

  // 노드 가시성 체크: 부모가 접혀있으면 숨김
  const isNodeVisible = useCallback((nodeId: string, parentId?: string): boolean => {
    if (!parentId) return true // 부모 없으면 항상 표시

    // 부모가 펼쳐져 있는지 확인
    if (!expandedNodeIds.has(parentId)) return false

    // 부모의 부모도 재귀적으로 확인
    const parentNode = graph?.nodes.find(n => n.id === parentId)
    if (parentNode?.parentId) {
      return isNodeVisible(parentId, parentNode.parentId)
    }

    return true
  }, [expandedNodeIds, graph?.nodes])

  // Convert graph data to force-graph format
  // PERFORMANCE: Limit max visible nodes to prevent lag
  // This only affects 3D visualization - all files are still accessible via file tree/search
  // With LOD (folders collapsed by default), this limit is rarely hit
  const MAX_VISIBLE_NODES = 2000

  const convertToGraphData = useCallback(() => {
    if (!graph) return { nodes: [], links: [] }

    const allNodes: GraphNode[] = []
    const nodeMap = new Map<string, GraphNode>()

    // Find root/self node
    const selfNode = graph.nodes.find(n => n.type === 'project')

    // Build all nodes first
    graph.nodes.forEach((node, index) => {
      const depth = node.type === 'project' ? 0 :
        node.parentId ? 2 : 1

      // 파일 매칭
      const matchedFile = fileMap.get(node.title) || fileMap.get(node.id)
      const ext = getExtension(node.title)

      // 노드 크기 계산 (더 균일하게)
      let nodeSize = 10 // 기본 크기
      if (node.type === 'project') {
        nodeSize = 14 // Self 노드
      } else if (matchedFile?.size) {
        nodeSize = fileSizeToNodeSize(matchedFile.size, fileSizeRange.min, fileSizeRange.max)
      } else {
        nodeSize = 9 + Math.min((node.importance || 0), 3) // 9~12 범위
      }

      // ====================================================
      // 초기 위치: 3D 구 표면에 Fibonacci Sphere 분포
      // ====================================================
      const totalNodes = graph.nodes.length || 100
      const phi = Math.acos(1 - 2 * (index + 0.5) / totalNodes)
      const goldenRatio = (1 + Math.sqrt(5)) / 2
      const theta = 2 * Math.PI * index / goldenRatio

      // 깊이에 따라 반지름 조절 (project는 중심, 깊을수록 멀리)
      const baseRadius = 100 + depth * 80

      const graphNode: GraphNode = {
        id: node.id,
        label: node.title,
        type: node.type,
        depth,
        expanded: true,
        fileType: ext || undefined,
        fileSize: matchedFile?.size,
        nodeSize,
        parentId: node.parentId,
        __node: node,
        // 3D 구 표면 분포 (Fibonacci Sphere)
        x: node.type === 'project' ? 0 : baseRadius * Math.sin(phi) * Math.cos(theta),
        y: node.type === 'project' ? 0 : baseRadius * Math.sin(phi) * Math.sin(theta),
        z: node.type === 'project' ? 0 : baseRadius * Math.cos(phi),
      }

      allNodes.push(graphNode)
      nodeMap.set(node.id, graphNode)
    })

    // 가시성 필터링: 부모가 접혀있으면 숨김
    const visibleNodes = allNodes.filter(node => isNodeVisible(node.id, node.parentId))

    // PERFORMANCE: Limit nodes - prioritize folders and self node
    let nodes: GraphNode[]
    if (visibleNodes.length > MAX_VISIBLE_NODES) {
      // Sort: self first, then folders, then files by importance
      const sorted = visibleNodes.sort((a, b) => {
        if (a.type === 'project') return -1
        if (b.type === 'project') return 1
        if (a.type === 'folder' && b.type !== 'folder') return -1
        if (b.type === 'folder' && a.type !== 'folder') return 1
        return (b.__node?.importance || 0) - (a.__node?.importance || 0)
      })
      nodes = sorted.slice(0, MAX_VISIBLE_NODES)
      console.log(`[Neural Map] Limited from ${visibleNodes.length} to ${MAX_VISIBLE_NODES} nodes`)
    } else {
      nodes = visibleNodes
    }

    // 보이는 노드의 ID Set 생성
    const visibleNodeIds = new Set(nodes.map(n => n.id))

    // Build links from edges (only for visible nodes)
    const links: GraphLink[] = []
    graph.edges.forEach((edge) => {
      const sourceVisible = visibleNodeIds.has(edge.source)
      const targetVisible = visibleNodeIds.has(edge.target)

      if (sourceVisible && targetVisible) {
        const linkKind = edge.type === 'parent_child' ? 'parent' : edge.type === 'imports' ? 'imports' : 'reference'

        // PERFORMANCE: Disabled particles - they cause significant lag
        links.push({
          source: edge.source,
          target: edge.target,
          kind: linkKind,
          type: edge.type,
          particles: 0, // Disabled for performance
          particleColor: currentTheme.ui.accentColor,
          particleWidth: 0,
          color: linkKind === 'imports' ? (currentTheme.ui.accentColor + '33') : (isDark ? '#ffffff1a' : '#0000001a')
        })
      }
    })

    return { nodes, links }
  }, [graph, fileMap, fileSizeRange, isNodeVisible, expandedNodeIds, currentTheme, isDark]) // Theme dependencies added

  // Add stars to scene
  const addStars = useCallback((scene: any, THREE: any, count = 1500) => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 2400
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1600
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2400

      // Slight color variation
      const brightness = 0.7 + Math.random() * 0.3
      colors[i * 3 + 0] = brightness
      colors[i * 3 + 1] = brightness
      colors[i * 3 + 2] = brightness + Math.random() * 0.1
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })

    const stars = new THREE.Points(geo, mat)
    scene.add(stars)
    return stars
  }, [])

  // Get node color based on type and file extension
  const getNodeColor = useCallback((node: any, isSelected: boolean) => {
    if (isSelected) return 0x8b5cf6 // Purple for selected

    // 파일 타입 색상 우선
    if (node.fileType && FILE_TYPE_COLORS[node.fileType]) {
      return FILE_TYPE_COLORS[node.fileType]
    }

    // 노드 타입별 색상
    const colors: Record<string, number> = {
      self: 0xffd700,      // Gold
      concept: 0x3b82f6,   // Blue
      project: 0x10b981,   // Green
      doc: 0xf59e0b,       // Amber
      idea: 0xec4899,      // Pink
      decision: 0x8b5cf6,  // Purple
      memory: 0x06b6d4,    // Cyan
      task: 0xef4444,      // Red
      person: 0xf97316,    // Orange
      insight: 0xa855f7,   // Violet
      folder: 0x6b7280,    // Gray
    }

    return colors[node.type] || 0x6b7280
  }, [])

  // 1. Initialization Effect (Mount only)
  useEffect(() => {
    if (!isClient || !containerRef.current) return

    let resizeObserver: ResizeObserver | null = null
    let animationInterval: NodeJS.Timeout | null = null
    let handleResize: (() => void) | null = null
    let graphInstance: any = null

    Promise.all([
      import('3d-force-graph'),
      import('three'),
    ]).then(([ForceGraph3DModule, THREE]) => {
      console.log('[CosmicForceGraph] Promise resolved, checking container...')

      // Prevent race conditions if unmounted
      if (!containerRef.current) {
        console.error('[CosmicForceGraph] Container ref is NULL!')
        return
      }

      // Check container dimensions
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight
      console.log('[CosmicForceGraph] Container dimensions:', containerWidth, 'x', containerHeight)

      if (containerWidth === 0 || containerHeight === 0) {
        console.error('[CosmicForceGraph] Container has ZERO dimensions! Retrying in 100ms...')
        // Retry after a short delay
        setTimeout(() => {
          if (containerRef.current) {
            const w = containerRef.current.clientWidth
            const h = containerRef.current.clientHeight
            console.log('[CosmicForceGraph] Retry dimensions:', w, 'x', h)
          }
        }, 100)
      }

      let Graph: any
      try {
        // Handle different module export formats
        const ForceGraph3D = ForceGraph3DModule.default || ForceGraph3DModule
        console.log('[CosmicForceGraph] Module type:', typeof ForceGraph3D)
        console.log('[CosmicForceGraph] Module keys:', Object.keys(ForceGraph3DModule))

        // Create graph instance - 3d-force-graph uses curried API: ForceGraph3D()(container)
        if (typeof ForceGraph3D === 'function') {
          console.log('[CosmicForceGraph] Calling ForceGraph3D with curried API...')
          // 3d-force-graph requires double invocation: ForceGraph3D()(container)
          const GraphFactory = ForceGraph3D()
          console.log('[CosmicForceGraph] GraphFactory created:', typeof GraphFactory)

          const instance = GraphFactory(containerRef.current!)
          console.log('[CosmicForceGraph] Instance created:', !!instance, typeof instance)

          if (instance && typeof instance.backgroundColor === 'function') {
            Graph = instance
            console.log('[CosmicForceGraph] Graph instance ready!')
          } else {
            console.error('[CosmicForceGraph] Instance does not have expected methods!')
          }
        } else {
          throw new Error('ForceGraph3D is not a function')
        }

        if (!Graph) {
          throw new Error('Failed to create Graph instance')
        }

        console.log('[CosmicForceGraph] Graph created successfully, configuring...')

        // Configure the graph - call methods separately as they may not return 'this'
        Graph.backgroundColor(isDark ? '#070A12' : '#f8fafc')
        Graph.cooldownTicks(300) // Increased: 100→300 for proper collision resolution
        Graph.warmupTicks(200) // Increased: 50→200 for better initial layout
        Graph.d3AlphaDecay(0.01) // Slower decay for more accurate positioning
        Graph.d3VelocityDecay(0.3) // Slower velocity decay

        graphRef.current = Graph
        graphInstance = Graph
        console.log('[CosmicForceGraph] Initialization COMPLETE!')
      } catch (err: any) {
        console.error('[CosmicForceGraph] WebGL initialization failed:', err)
        console.error('[CosmicForceGraph] Error stack:', err.stack)
        setWebglError(err.message || 'WebGL 초기화 실패')
        return
      }

      // Scene Setup
      const scene = Graph.scene()
      // addStars uses THREE, so we pass it
      addStars(scene, THREE)

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(150, 200, 100)
      scene.add(directionalLight)

      const pointLight1 = new THREE.PointLight(0x4a9eff, 1.5, 500)
      pointLight1.position.set(100, 50, 100)
      scene.add(pointLight1)

      const pointLight2 = new THREE.PointLight(0xffd700, 1, 400)
      pointLight2.position.set(-100, -50, -100)
      scene.add(pointLight2)

      // Animation Loop - disabled for performance
      // Only reheat on explicit user action (expand/collapse)
      // Continuous reheat was causing severe lag
      animationInterval = null

      // Resize Observer
      handleResize = () => {
        if (containerRef.current && graphRef.current) {
          graphRef.current
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight)
        }
      }
      resizeObserver = new ResizeObserver(handleResize)
      resizeObserver.observe(containerRef.current)
      window.addEventListener('resize', handleResize)

      // Trigger Update Phase passed the THREE instance
      setThreeInstance(THREE)
    })

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      if (handleResize) window.removeEventListener('resize', handleResize)
      if (animationInterval) clearInterval(animationInterval)
      // Attempt to pause/clean graph if possible
      if (graphInstance) {
        try { graphInstance.pauseAnimation() } catch (e) { }
      }
    }
  }, [isClient])

  // 2. Update Effect (Runs on dependencies)
  useEffect(() => {
    console.log('[CosmicForceGraph] Update effect triggered:', {
      hasThreeInstance: !!threeInstance,
      hasGraphRef: !!graphRef.current,
      graphNodes: graph?.nodes?.length || 0
    })

    if (!threeInstance || !graphRef.current) {
      console.log('[CosmicForceGraph] Update effect skipped - missing dependencies')
      return
    }

    // We casts to any to avoid complex TS issues with dynamic imports
    const THREE = threeInstance as any
    const Graph = graphRef.current
    const { nodes, links } = convertToGraphData()
    console.log('[CosmicForceGraph] Setting graph data:', { nodes: nodes.length, links: links.length })

    // Track zoom for LOD (Level of Detail)
    const controls = Graph.controls?.()
    if (controls && controls.addEventListener) {
      controls.addEventListener('change', () => {
        const camera = Graph.camera()
        if (camera) {
          const newZoom = camera.position.length()
          zoomLevelRef.current = newZoom

          // Update icon/label visibility based on zoom
          const showDetails = newZoom < 350
          nodes.forEach((n: any) => {
            if (n.__iconSprite) {
              n.__iconSprite.visible = showDetails
            }
            if (n.__labelSprite) {
              n.__labelSprite.visible = showDetails
            }
          })
        }
      })
    }

    // Track highlighted node for click interaction
    let highlightedNodeId: string | null = null

    // Configure graph - NO CHAINING (methods may not return 'this')
    Graph.backgroundColor(isDark ? '#070A12' : '#f8fafc')
    Graph.nodeLabel((n: any) => {
        // Hide labels when zoomed out (camera distance > 400)
        if (zoomLevelRef.current > 400) return ''
        return `
          <div style="
            font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
            background: rgba(0,0,0,0.85);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.15);
            backdrop-filter: blur(4px);
          ">
            <b style="color: #fff;">${n.label}</b><br/>
            <span style="color: rgba(255,255,255,0.6);">type: ${n.type}</span>
          </div>
        `
    })
    // EXPLICIT node rendering with nodeThreeObject
    // Creates sphere + icon + label sprite for each node
    Graph.nodeThreeObject((node: any) => {
      const size = node.type === 'project' ? 15 : (node.nodeSize || 10)

      // Determine color: file extension first, then node type, then default
      let colorHex = NODE_COLORS[node.type] || 0x6b7280
      if (node.fileType) {
        const ext = node.fileType.toLowerCase()
        if (FILE_TYPE_COLORS[ext]) {
          colorHex = FILE_TYPE_COLORS[ext]
        }
      }

      // Create group to hold sphere + icon + label
      const group = new THREE.Group()

      // 1. Create sphere
      const geometry = new THREE.SphereGeometry(size, 16, 16)
      const material = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: false,
      })
      const sphere = new THREE.Mesh(geometry, material)
      group.add(sphere)

      // 2. Create ICON sprite using Lucide icons
      const iconTexture = getNodeTypeTexture(node.type, THREE)
      if (iconTexture) {
        const iconMaterial = new THREE.SpriteMaterial({
          map: iconTexture,
          transparent: true,
          depthTest: false,
          sizeAttenuation: true,
        })
        const iconSprite = new THREE.Sprite(iconMaterial)

        // Position icon on sphere surface
        iconSprite.position.set(0, 0, size * 0.5)
        iconSprite.scale.set(size * 0.9, size * 0.9, 1)
        group.add(iconSprite)

        // Store reference for LOD updates
        node.__iconSprite = iconSprite
      }

      // Store sphere reference for highlight
      node.__sphere = sphere
      node.__material = material
      node.__originalColor = colorHex

      // 3. Create text label sprite above the node
      const labelCanvas = document.createElement('canvas')
      const labelCtx = labelCanvas.getContext('2d')
      if (labelCtx) {
        labelCanvas.width = 256
        labelCanvas.height = 48
        labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height)

        // Text with shadow for readability
        labelCtx.font = 'bold 24px Arial, sans-serif'
        labelCtx.textAlign = 'center'
        labelCtx.textBaseline = 'middle'

        // Shadow
        labelCtx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        labelCtx.shadowBlur = 4
        labelCtx.shadowOffsetX = 1
        labelCtx.shadowOffsetY = 1

        labelCtx.fillStyle = '#ffffff'

        // Truncate long labels
        let label = node.label || ''
        if (label.length > 16) label = label.substring(0, 15) + '...'
        labelCtx.fillText(label, labelCanvas.width / 2, labelCanvas.height / 2)

        const labelTexture = new THREE.CanvasTexture(labelCanvas)
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true,
          depthTest: false,
          sizeAttenuation: true,
        })
        const labelSprite = new THREE.Sprite(labelMaterial)

        // Position label above the sphere
        labelSprite.position.set(0, size + 10, 0)
        labelSprite.scale.set(22, 4.5, 1)
        group.add(labelSprite)

        // Store reference for LOD updates
        node.__labelSprite = labelSprite
      }

      return group
    })

    // Node click handler - highlight connected nodes, dim others
    Graph.onNodeClick((clickedNode: any, event: MouseEvent) => {
      if (!clickedNode) return

      // Get connected node IDs
      const connectedIds = new Set<string>()
      connectedIds.add(clickedNode.id)
      links.forEach((link: any) => {
        if (link.source?.id === clickedNode.id || link.source === clickedNode.id) {
          connectedIds.add(link.target?.id || link.target)
        }
        if (link.target?.id === clickedNode.id || link.target === clickedNode.id) {
          connectedIds.add(link.source?.id || link.source)
        }
      })

      // Update all nodes - dim non-connected
      nodes.forEach((n: any) => {
        if (n.__material) {
          const isConnected = connectedIds.has(n.id)
          if (isConnected) {
            n.__material.color.setHex(n.__originalColor)
            n.__material.opacity = 1
            n.__material.transparent = false
          } else {
            n.__material.color.setHex(0x333333)
            n.__material.opacity = 0.3
            n.__material.transparent = true
          }
          n.__material.needsUpdate = true
        }
        // Also dim icons/labels
        if (n.__iconSprite) {
          n.__iconSprite.material.opacity = connectedIds.has(n.id) ? 1 : 0.2
        }
        if (n.__labelSprite) {
          n.__labelSprite.material.opacity = connectedIds.has(n.id) ? 1 : 0.2
        }
      })

      // Update links - dim non-connected
      Graph.linkOpacity((link: any) => {
        const sourceId = link.source?.id || link.source
        const targetId = link.target?.id || link.target
        const isConnected = connectedIds.has(sourceId) && connectedIds.has(targetId)
        return isConnected ? 0.8 : 0.05
      })

      // Also call the original onNodeClick if provided
      if (onNodeClick) {
        onNodeClick(clickedNode.id)
      }
    })

    // Background click to reset highlight
    Graph.onBackgroundClick(() => {
      // Reset all nodes to original colors
      nodes.forEach((n: any) => {
        if (n.__material && n.__originalColor !== undefined) {
          n.__material.color.setHex(n.__originalColor)
          n.__material.opacity = 1
          n.__material.transparent = false
          n.__material.needsUpdate = true
        }
        if (n.__iconSprite) {
          n.__iconSprite.material.opacity = 1
        }
        if (n.__labelSprite) {
          n.__labelSprite.material.opacity = 1
        }
      })

      // Reset link opacity
      Graph.linkOpacity(0.15)
    })

    // Disable default node resolution (we're using custom objects)
    Graph.nodeResolution(16)

    // Clean minimal links like Obsidian
    Graph.linkOpacity(0.15)  // Very subtle
    Graph.linkWidth(0.3)     // Hair-thin
    Graph.linkColor(() => '#ffffff')  // White/gray lines
    Graph.linkDirectionalParticles(0)  // No particles
    Graph.linkCurvature(0)  // Straight lines

    // Update Data FIRST (forces are configured after simulation is initialized)
    Graph.graphData({ nodes, links })

    // Debug: Check what's in the scene
    const scene = Graph.scene()
    console.log('[CosmicForceGraph] Scene children count:', scene?.children?.length)

    // CRITICAL: Position camera to see nodes
    // Nodes are positioned in a sphere of radius ~100-260
    // Camera needs to be far enough to see them
    setTimeout(() => {
      if (Graph && nodes.length > 0) {
        // Calculate bounding sphere of nodes
        let maxDist = 0
        nodes.forEach((n: any) => {
          const dist = Math.sqrt((n.x || 0) ** 2 + (n.y || 0) ** 2 + (n.z || 0) ** 2)
          if (dist > maxDist) maxDist = dist
        })

        // Position camera at 3x the max distance to see all nodes
        const cameraZ = Math.max(maxDist * 3, 500)
        console.log('[CosmicForceGraph] Positioning camera at z:', cameraZ, 'maxDist:', maxDist)

        Graph.cameraPosition(
          { x: 0, y: 0, z: cameraZ }, // Camera position
          { x: 0, y: 0, z: 0 },        // Look at center
          0                             // Instant (no animation)
        )

        // Force graph refresh
        try {
          Graph.refresh()
          console.log('[CosmicForceGraph] Graph refreshed')
        } catch (e) {
          console.warn('[CosmicForceGraph] refresh() error:', e)
        }

        // Debug: Check scene after refresh
        const updatedScene = Graph.scene()
        console.log('[CosmicForceGraph] After refresh - scene children:', updatedScene?.children?.length)

        // Log camera info
        const camera = Graph.camera()
        if (camera) {
          console.log('[CosmicForceGraph] Camera position:', camera.position.x, camera.position.y, camera.position.z)
          console.log('[CosmicForceGraph] Camera frustum near/far:', camera.near, camera.far)
        }
      }
    }, 200)

    console.log('[CosmicForceGraph] Graph data set with', nodes.length, 'nodes')

    // Interactions (separate from chain)
    Graph.onNodeClick((node: any) => {
      if (!node) return
      setSelectedNodes([node.id])
      let targetFile = files.find(f => f.id === node.id) || files.find(f => f.name === node.label)
      if (!targetFile && node.__node?.sourceRef?.fileId) targetFile = files.find(f => f.id === node.__node.sourceRef.fileId)
      if (targetFile) openCodePreview(targetFile)
      Graph.cameraPosition({ x: node.x * 1.3, y: node.y * 1.3, z: (node.z ?? 0) * 1.3 + 150 }, node, 800)
    })
    Graph.onBackgroundClick(() => {
      setSelectedNodes([])
    })

    // Force Settings DISABLED - causes tick errors
    // Using default d3-force simulation instead

    // Set cleanup function on the Graph object for extraction later if needed (though resizeObserver handles most)
    // Note: React cleanup below handles component unmount
    return () => {
      window.removeEventListener('resize', () => { }) // Dummy
    }
  }, [threeInstance, graph, fileMap, fileSizeRange, isNodeVisible, expandedNodeIds, currentTheme, isDark, radialDistance, graphExpanded, layoutMode])

  // Update graph data when store changes
  useEffect(() => {
    if (!graphRef.current || !graph) return
    const { nodes, links } = convertToGraphData()
    graphRef.current.graphData({ nodes, links })
  }, [graph, convertToGraphData])

  // 정렬 버튼 클릭 시 시뮬레이션 재시작 감지
  // DISABLED - d3ReheatSimulation causes tick errors
  // useEffect(() => {
  //   if (graphRef.current && isSimulationRunning) {
  //     graphRef.current.d3ReheatSimulation()
  //   }
  // }, [isSimulationRunning])


  // Update selection - only update local state, no expensive nodeThreeObject rebuild
  useEffect(() => {
    if (!graphRef.current) return
    setSelectedId(selectedNodeIds[0] || null)
    // Removed: graphRef.current.nodeThreeObject(...) - was causing severe lag
    // Selection visual is handled by the ring geometry in nodeThreeObject
  }, [selectedNodeIds])

  // radialDistance/graphExpanded에 따른 effective 값 계산
  const effectiveDistance = graphExpanded ? radialDistance : radialDistance * 0.2
  const effectiveStrength = graphExpanded ? -radialDistance * 1.5 : -30

  // Update force settings when layoutMode, radialDistance or graphExpanded changes
  // DISABLED ENTIRELY - d3Force calls cause tick errors
  // Using default 3d-force-graph simulation instead
  /*
  useEffect(() => {
    if (!graphRef.current || !graph?.nodes?.length) return
    // Force configuration disabled to prevent tick errors
  }, [layoutMode, radialDistance, graphExpanded, effectiveDistance, effectiveStrength, graph?.nodes?.length])
  */

  if (!isClient) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center', className)}>
        <div className="text-zinc-500">Loading 3D view...</div>
      </div>
    )
  }

  // WebGL 에러 시 2D 뷰로 전환 안내
  if (webglError) {
    return (
      <div className={cn('w-full h-full flex flex-col items-center justify-center gap-4', className)}
        style={{ background: isDark ? '#070A12' : '#f8fafc' }}>
        <div className="text-amber-500 text-lg">⚠️ 3D 렌더링 실패</div>
        <div className="text-zinc-500 text-sm text-center max-w-md">
          WebGL 컨텍스트를 생성할 수 없습니다.<br/>
          브라우저를 새로고침하거나 다른 탭을 닫아보세요.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm"
        >
          새로고침
        </button>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('w-full h-full', className)}
      style={{ background: isDark ? '#070A12' : '#f8fafc' }}
    />
  )
}

export default CosmicForceGraph
