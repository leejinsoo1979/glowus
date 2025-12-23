// @ts-nocheck
'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { forceRadial, forceY } from 'd3-force-3d'
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

// 아이콘 컴포넌트 매핑
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

// 파일 확장자 추출
function getExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || ''
}

// ============================================
// Performance Optimization: Caches
// ============================================

// Geometry cache - shared across all nodes
const geometryCache = new Map<string, THREE.SphereGeometry>()
function getCachedGeometry(size: number): THREE.SphereGeometry {
  const key = `sphere-${size.toFixed(1)}`
  if (!geometryCache.has(key)) {
    // Lower segment count for performance (24→12)
    geometryCache.set(key, new THREE.SphereGeometry(size, 12, 12))
  }
  return geometryCache.get(key)!
}

// Material cache - shared by color
const materialCache = new Map<string, THREE.MeshStandardMaterial>()
function getCachedMaterial(color: number, emissiveIntensity: number): THREE.MeshStandardMaterial {
  const key = `mat-${color}-${emissiveIntensity.toFixed(1)}`
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.5,
      emissive: new THREE.Color(color),
      emissiveIntensity,
    }))
  }
  return materialCache.get(key)!
}

// Texture cache for file icons
const textureCache = new Map<string, THREE.CanvasTexture>()
function getCachedTexture(ext: string, color: string, IconComp: any): THREE.CanvasTexture | null {
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

// Ring geometry cache
let ringGeometryCache: THREE.TorusGeometry | null = null
function getCachedRingGeometry(): THREE.TorusGeometry {
  if (!ringGeometryCache) {
    ringGeometryCache = new THREE.TorusGeometry(1, 0.08, 8, 24) // Lower segments
  }
  return ringGeometryCache
}

// Ring material cache - for selection ring
const ringMaterialCache = new Map<string, THREE.MeshBasicMaterial>()
function getCachedRingMaterial(isSelected: boolean): THREE.MeshBasicMaterial {
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
let starTextureCache: THREE.CanvasTexture | null = null
function getCachedStarTexture(): THREE.CanvasTexture {
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
    const selfNode = graph.nodes.find(n => n.type === 'self')

    // Build all nodes first
    graph.nodes.forEach((node, index) => {
      const depth = node.type === 'self' ? 0 :
        node.parentId ? 2 : 1

      // 파일 매칭
      const matchedFile = fileMap.get(node.title) || fileMap.get(node.id)
      const ext = getExtension(node.title)

      // 노드 크기 계산 (더 균일하게)
      let nodeSize = 10 // 기본 크기
      if (node.type === 'self') {
        nodeSize = 14 // Self 노드
      } else if (matchedFile?.size) {
        nodeSize = fileSizeToNodeSize(matchedFile.size, fileSizeRange.min, fileSizeRange.max)
      } else {
        nodeSize = 9 + Math.min((node.importance || 0), 3) // 9~12 범위
      }

      const graphNode: GraphNode = {
        id: node.id,
        label: node.title,
        type: node.type,
        depth,
        expanded: true,
        fileType: ext || undefined,
        fileSize: matchedFile?.size,
        nodeSize,
        parentId: node.parentId, // 부모 ID 추가
        __node: node,
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
        if (a.type === 'self') return -1
        if (b.type === 'self') return 1
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
      // Prevent race conditions if unmounted
      if (!containerRef.current) return

      const ForceGraph3D = ForceGraph3DModule.default
      const Graph = ForceGraph3D()(containerRef.current!)
        .backgroundColor(isDark ? '#070A12' : '#f8fafc')
        .minZoom(0.1)
        .cooldownTicks(100) // Stop simulation after 100 ticks for performance
        .warmupTicks(50) // Pre-calculate initial layout

      graphRef.current = Graph
      graphInstance = Graph

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
    if (!threeInstance || !graphRef.current) return

    // We casts to any to avoid complex TS issues with dynamic imports
    const THREE = threeInstance as any
    const Graph = graphRef.current
    const { nodes, links } = convertToGraphData()

    Graph
      .backgroundColor(isDark ? '#070A12' : '#f8fafc')
      .nodeLabel((n: any) => `
          <div style="
            font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
            background: rgba(0,0,0,0.8);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.1);
          ">
            <b style="color: #fff;">${n.label}</b><br/>
            <span style="color: rgba(255,255,255,0.6);">type: ${n.type}</span>
          </div>
        `)
      .nodeThreeObject((n: any) => {
        const isSelected = selectedNodeIds.includes(n.id)
        const baseSize = n.nodeSize || (n.type === 'self' ? 16 : n.depth === 1 ? 9 : 6)

        // Use cached geometry (12 segments instead of 24)
        const geom = getCachedGeometry(baseSize)
        const colorNum = getNodeColor(n, isSelected)
        const emissive = n.type === 'self' ? 0.8 : 0.5

        // Use cached material
        const mat = getCachedMaterial(colorNum, emissive)
        const mesh = new THREE.Mesh(geom, mat)

        // Selection Ring - use cached geometry and material
        const ringGeom = getCachedRingGeometry()
        const ringMat = getCachedRingMaterial(isSelected)
        const ring = new THREE.Mesh(ringGeom, ringMat)
        ring.scale.set(baseSize + 3, baseSize + 3, baseSize + 3)
        ring.rotation.x = Math.PI / 2
        mesh.add(ring)

        // File Type Icon - use cached texture
        if (n.fileType) {
          const ext = n.fileType
          const colorHex = '#' + (FILE_TYPE_COLORS[ext.toLowerCase()] || 0x6b7280).toString(16).padStart(6, '0')
          const IconComp = getIconComponent(ext)
          const texture = getCachedTexture(ext, colorHex, IconComp)

          if (texture) {
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
            const sprite = new THREE.Sprite(spriteMat)
            sprite.scale.set(baseSize * 1.5, baseSize * 1.5, 1)
            sprite.position.set(0, 0, baseSize * 0.6)
            mesh.add(sprite)
          }
        }

        // Self Node visuals - use cached
        if (n.type === 'self') {
          const glowGeom = getCachedGeometry(baseSize * 1.5)
          const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.15 })
          mesh.add(new THREE.Mesh(glowGeom, glowMat))

          // Star Icon - use cached texture
          const starTexture = getCachedStarTexture()
          const ss = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture, transparent: true, depthTest: false, depthWrite: false }))
          ss.scale.set(baseSize * 1.4, baseSize * 1.4, 1)
          ss.position.set(0, 0, baseSize * 0.7)
          mesh.add(ss)
        }

        mesh.userData.__nodeId = n.id
        mesh.userData.__ring = ring
        return mesh
      })
      .linkOpacity((l: any) => l.kind === 'imports' ? 0.6 : 0.3)
      .linkWidth((l: any) => l.kind === 'imports' ? 1.5 : 0.8)
      .linkColor((l: any) => l.color) // Use injected color
      .linkDirectionalParticles((l: any) => l.particles)
      .linkDirectionalParticleSpeed(0.01)
      .linkDirectionalParticleWidth((l: any) => l.particleWidth)
      .linkDirectionalParticleResolution(10)
      .linkDirectionalParticleColor((l: any) => l.particleColor)

      // Update Data
      .graphData({ nodes, links })

      // Interactions
      .onNodeClick((node: any) => {
        if (!node) return
        setSelectedNodes([node.id])
        let targetFile = files.find(f => f.id === node.id) || files.find(f => f.name === node.label)
        if (!targetFile && node.__node?.sourceRef?.fileId) targetFile = files.find(f => f.id === node.__node.sourceRef.fileId)
        if (targetFile) openCodePreview(targetFile)
        Graph.cameraPosition({ x: node.x * 1.3, y: node.y * 1.3, z: (node.z ?? 0) * 1.3 + 150 }, node, 800)
        // Removed redundant nodeThreeObject rebuild - uses cached geometry/materials
      })
      .onBackgroundClick(() => {
        setSelectedNodes([])
        // Removed redundant nodeThreeObject rebuild - uses cached geometry/materials
      })

    // Force Settings
    const currentEffectiveDistance = graphExpanded ? radialDistance : radialDistance * 0.2
    const currentEffectiveStrength = graphExpanded ? -radialDistance * 1.5 : -30
    Graph.d3Force('charge')?.strength(currentEffectiveStrength)
    Graph.d3Force('link')?.distance((l: any) => l.kind === 'parent' ? currentEffectiveDistance * 0.5 : currentEffectiveDistance)
    Graph.d3ReheatSimulation()

    // Set cleanup function on the Graph object for extraction later if needed (though resizeObserver handles most)
    // Note: React cleanup below handles component unmount
    return () => {
      window.removeEventListener('resize', () => { }) // Dummy
    }
  }, [graph, fileMap, fileSizeRange, isNodeVisible, expandedNodeIds, currentTheme, isDark, radialDistance, graphExpanded, layoutMode])

  // Update graph data when store changes
  useEffect(() => {
    if (!graphRef.current || !graph) return
    const { nodes, links } = convertToGraphData()
    graphRef.current.graphData({ nodes, links })
  }, [graph, convertToGraphData])

  // 정렬 버튼 클릭 시 시뮬레이션 재시작 감지
  useEffect(() => {
    if (graphRef.current && isSimulationRunning) {
      // Reheat simulation
      graphRef.current.d3ReheatSimulation()
    }
  }, [isSimulationRunning])


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
  useEffect(() => {
    if (!graphRef.current || !graph?.nodes?.length) return

    const graphInstance = graphRef.current

    // Debug log
    console.log('3D Layout Mode Changed:', layoutMode)

    // 약간의 딜레이 후 force 설정 (그래프 초기화 완료 대기)
    const timer = setTimeout(() => {
      const chargeForce = graphInstance.d3Force('charge')
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(layoutMode === 'radial' ? -50 : effectiveStrength)
      }

      const linkForce = graphInstance.d3Force('link')
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance((l: any) => {
          if (layoutMode === 'radial') {
            return l.kind === 'parent' ? 40 : 100
          }
          if (layoutMode === 'structural') {
            return l.kind === 'parent' ? 50 : 150
          }
          return l.kind === 'parent' ? effectiveDistance * 0.5 : effectiveDistance
        })
      }

      // 'radial' 모드일 때 중심으로부터의 거리 강제
      if (layoutMode === 'radial') {
        graphInstance.d3Force('radial', forceRadial((n: any) => {
          if (n.type === 'self') return 0
          if (n.type === 'folder') return 120
          return 240
        }, 0, 0, 0).strength(0.8))
        graphInstance.d3Force('y', null)
      }
      // 'structural' 모드
      else if (layoutMode === 'structural') {
        graphInstance.d3Force('radial', null)
        // Simple hierarchy simulation: folders on top, files below
        graphInstance.d3Force('y', forceY((n: any) => {
          if (n.type === 'self') return -200
          if (n.type === 'folder') return -100
          return 100
        }).strength(0.5))
      }
      else {
        graphInstance.d3Force('radial', null)
        graphInstance.d3Force('y', null)
      }

      graphInstance.d3ReheatSimulation()
    }, 100)

    return () => clearTimeout(timer)
  }, [layoutMode, radialDistance, graphExpanded, effectiveDistance, effectiveStrength, graph?.nodes?.length])

  if (!isClient) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center', className)}>
        <div className="text-zinc-500">Loading 3D view...</div>
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
