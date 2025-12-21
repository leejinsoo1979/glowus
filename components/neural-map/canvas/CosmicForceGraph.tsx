// @ts-nocheck
'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'

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

  // Store
  const graph = useNeuralMapStore((s) => s.graph)
  const files = useNeuralMapStore((s) => s.files)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const focusOnNode = useNeuralMapStore((s) => s.focusOnNode)
  const radialDistance = useNeuralMapStore((s) => s.radialDistance)
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

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
    const nodes = allNodes.filter(node => isNodeVisible(node.id, node.parentId))

    // 보이는 노드의 ID Set 생성
    const visibleNodeIds = new Set(nodes.map(n => n.id))

    // Build links from edges (only for visible nodes)
    const links: GraphLink[] = []
    graph.edges.forEach((edge) => {
      const sourceVisible = visibleNodeIds.has(edge.source)
      const targetVisible = visibleNodeIds.has(edge.target)

      if (sourceVisible && targetVisible) {
        const linkKind = edge.type === 'parent_child' ? 'parent' : edge.type === 'imports' ? 'imports' : 'reference'
        links.push({
          source: edge.source,
          target: edge.target,
          kind: linkKind,
          // 파티클 설정: parent와 imports 링크에 파티클 표시
          particles: linkKind === 'parent' ? 5 : linkKind === 'imports' ? 4 : 0,
          particleWidth: 6, // 매우 큰 크기
          particleColor: '#ffffff', // 흰색으로 눈에 띄게
        })
      }
    })

    return { nodes, links }
  }, [graph, fileMap, fileSizeRange, isNodeVisible, expandedNodeIds])

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

  // Initialize graph
  useEffect(() => {
    if (!isClient || !containerRef.current) return

    // Dynamic import for 3d-force-graph (browser only)
    Promise.all([
      import('3d-force-graph'),
      import('three'),
    ]).then(([ForceGraph3DModule, THREE]) => {
      const ForceGraph3D = ForceGraph3DModule.default

      // 이미 초기화된 경우 force만 업데이트
      if (graphRef.current) {
        const currentEffectiveDistance = graphExpanded ? radialDistance : radialDistance * 0.2
        const currentEffectiveStrength = graphExpanded ? -radialDistance * 1.5 : -30
        graphRef.current.d3Force('charge')?.strength(currentEffectiveStrength)
        graphRef.current.d3Force('link')?.distance((l: any) => l.kind === 'parent' ? currentEffectiveDistance * 0.5 : currentEffectiveDistance)
        graphRef.current.d3ReheatSimulation()
        return
      }

      const { nodes, links } = convertToGraphData()

      const Graph = ForceGraph3D()(containerRef.current!)
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
          // 파일 크기 기반 노드 크기 사용
          const baseSize = n.nodeSize || (n.type === 'self' ? 16 :
            n.depth === 1 ? 9 : 6)

          // Create sphere
          const geom = new THREE.SphereGeometry(baseSize, 24, 24)
          const color = getNodeColor(n, isSelected)

          const mat = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.3,
            roughness: 0.5,
            emissive: new THREE.Color(color),
            emissiveIntensity: n.type === 'self' ? 0.8 : 0.5,
          })

          const mesh = new THREE.Mesh(geom, mat)

          // Selection ring (aura)
          const ringGeom = new THREE.TorusGeometry(baseSize + 3, 1, 12, 48)
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: isSelected ? 0.9 : 0,
          })
          const ring = new THREE.Mesh(ringGeom, ringMat)
          ring.rotation.x = Math.PI / 2
          mesh.add(ring)

          // 파일 타입 표시 (스프라이트) - 얇고 세련된 아이콘
          if (n.fileType) {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            canvas.width = 64
            canvas.height = 64

            if (ctx) {
              const cx = 32, cy = 32
              // 조화로운 색상 팔레트
              const colors: Record<string, string> = {
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

              ctx.lineCap = 'round'
              ctx.lineJoin = 'round'

              switch (n.fileType) {
                case 'tsx':
                case 'jsx':
                  // React 아이콘 - 얇은 원자 궤도
                  ctx.strokeStyle = colors.react
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.ellipse(cx, cy, 18, 7, 0, 0, Math.PI * 2)
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.ellipse(cx, cy, 18, 7, Math.PI / 3, 0, Math.PI * 2)
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.ellipse(cx, cy, 18, 7, -Math.PI / 3, 0, Math.PI * 2)
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
                  ctx.fillStyle = colors.react
                  ctx.fill()
                  break
                case 'ts':
                  // TypeScript - 얇은 테두리 + T
                  ctx.strokeStyle = colors.ts
                  ctx.lineWidth = 1.5
                  ctx.strokeRect(12, 12, 40, 40)
                  ctx.beginPath()
                  ctx.moveTo(22, 24)
                  ctx.lineTo(42, 24)
                  ctx.moveTo(32, 24)
                  ctx.lineTo(32, 44)
                  ctx.stroke()
                  break
                case 'js':
                  // JavaScript - 얇은 테두리 + J
                  ctx.strokeStyle = colors.js
                  ctx.lineWidth = 1.5
                  ctx.strokeRect(12, 12, 40, 40)
                  ctx.beginPath()
                  ctx.moveTo(36, 22)
                  ctx.lineTo(36, 38)
                  ctx.quadraticCurveTo(36, 44, 28, 44)
                  ctx.stroke()
                  break
                case 'css':
                case 'scss':
                  // CSS - 얇은 해시태그
                  ctx.strokeStyle = colors.css
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(22, 16); ctx.lineTo(18, 48)
                  ctx.moveTo(34, 16); ctx.lineTo(30, 48)
                  ctx.moveTo(14, 26); ctx.lineTo(42, 26)
                  ctx.moveTo(12, 38); ctx.lineTo(40, 38)
                  ctx.stroke()
                  break
                case 'html':
                  // HTML - 얇은 꺾쇠
                  ctx.strokeStyle = colors.html
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(24, 16); ctx.lineTo(12, 32); ctx.lineTo(24, 48)
                  ctx.moveTo(40, 16); ctx.lineTo(52, 32); ctx.lineTo(40, 48)
                  ctx.stroke()
                  break
                case 'json':
                  // JSON - 얇은 중괄호
                  ctx.strokeStyle = colors.json
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(24, 14)
                  ctx.quadraticCurveTo(18, 14, 18, 22)
                  ctx.lineTo(18, 28)
                  ctx.quadraticCurveTo(18, 32, 12, 32)
                  ctx.quadraticCurveTo(18, 32, 18, 36)
                  ctx.lineTo(18, 42)
                  ctx.quadraticCurveTo(18, 50, 24, 50)
                  ctx.moveTo(40, 14)
                  ctx.quadraticCurveTo(46, 14, 46, 22)
                  ctx.lineTo(46, 28)
                  ctx.quadraticCurveTo(46, 32, 52, 32)
                  ctx.quadraticCurveTo(46, 32, 46, 36)
                  ctx.lineTo(46, 42)
                  ctx.quadraticCurveTo(46, 50, 40, 50)
                  ctx.stroke()
                  break
                case 'md':
                case 'markdown':
                  // Markdown - 얇은 M
                  ctx.strokeStyle = colors.md
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(12, 44); ctx.lineTo(12, 20)
                  ctx.lineTo(24, 32); ctx.lineTo(36, 20)
                  ctx.lineTo(36, 44)
                  ctx.moveTo(44, 32); ctx.lineTo(52, 32)
                  ctx.moveTo(48, 26); ctx.lineTo(48, 44)
                  ctx.stroke()
                  break
                case 'png':
                case 'jpg':
                case 'jpeg':
                case 'gif':
                case 'webp':
                case 'svg':
                  // 이미지 - 얇은 산/태양
                  ctx.strokeStyle = colors.image
                  ctx.lineWidth = 1.5
                  ctx.strokeRect(10, 14, 44, 36)
                  ctx.beginPath()
                  ctx.moveTo(10, 42)
                  ctx.lineTo(22, 30)
                  ctx.lineTo(30, 38)
                  ctx.lineTo(42, 24)
                  ctx.lineTo(54, 36)
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.arc(44, 22, 5, 0, Math.PI * 2)
                  ctx.stroke()
                  break
                case 'pdf':
                  // PDF - 얇은 문서
                  ctx.strokeStyle = colors.pdf
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(16, 10)
                  ctx.lineTo(38, 10)
                  ctx.lineTo(48, 20)
                  ctx.lineTo(48, 54)
                  ctx.lineTo(16, 54)
                  ctx.closePath()
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.moveTo(38, 10)
                  ctx.lineTo(38, 20)
                  ctx.lineTo(48, 20)
                  ctx.stroke()
                  // 줄
                  ctx.beginPath()
                  ctx.moveTo(22, 30); ctx.lineTo(42, 30)
                  ctx.moveTo(22, 38); ctx.lineTo(42, 38)
                  ctx.moveTo(22, 46); ctx.lineTo(34, 46)
                  ctx.stroke()
                  break
                case 'yaml':
                case 'yml':
                case 'env':
                  // Config - 얇은 슬라이더
                  ctx.strokeStyle = colors.config
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(10, 20); ctx.lineTo(54, 20)
                  ctx.moveTo(10, 32); ctx.lineTo(54, 32)
                  ctx.moveTo(10, 44); ctx.lineTo(54, 44)
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.arc(20, 20, 4, 0, Math.PI * 2)
                  ctx.arc(38, 32, 4, 0, Math.PI * 2)
                  ctx.arc(28, 44, 4, 0, Math.PI * 2)
                  ctx.fillStyle = colors.config
                  ctx.fill()
                  break
                default:
                  // 기본 - 얇은 문서
                  ctx.strokeStyle = colors.default
                  ctx.lineWidth = 1.5
                  ctx.beginPath()
                  ctx.moveTo(16, 10)
                  ctx.lineTo(38, 10)
                  ctx.lineTo(48, 20)
                  ctx.lineTo(48, 54)
                  ctx.lineTo(16, 54)
                  ctx.closePath()
                  ctx.stroke()
                  ctx.beginPath()
                  ctx.moveTo(38, 10)
                  ctx.lineTo(38, 20)
                  ctx.lineTo(48, 20)
                  ctx.stroke()
                  break
              }

              const texture = new THREE.CanvasTexture(canvas)
              const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false,
                depthWrite: false,
              })
              const sprite = new THREE.Sprite(spriteMat)
              sprite.scale.set(baseSize * 1.2, baseSize * 1.2, 1)
              sprite.position.set(0, 0, baseSize * 0.6)
              mesh.add(sprite)
            }
          }

          // Glow effect for self node
          if (n.type === 'self') {
            const glowGeom = new THREE.SphereGeometry(baseSize * 1.5, 24, 24)
            const glowMat = new THREE.MeshBasicMaterial({
              color: 0xffd700,
              transparent: true,
              opacity: 0.15,
            })
            const glow = new THREE.Mesh(glowGeom, glowMat)
            mesh.add(glow)

            // Self 노드에 별 아이콘
            const starCanvas = document.createElement('canvas')
            const starCtx = starCanvas.getContext('2d')
            starCanvas.width = 128
            starCanvas.height = 128
            if (starCtx) {
              const cx = 64, cy = 64

              // 5각 별 그리기
              starCtx.fillStyle = '#ffd700'
              starCtx.beginPath()
              for (let i = 0; i < 5; i++) {
                const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2
                const innerAngle = outerAngle + Math.PI / 5
                const outerR = 45, innerR = 20
                if (i === 0) {
                  starCtx.moveTo(cx + Math.cos(outerAngle) * outerR, cy + Math.sin(outerAngle) * outerR)
                } else {
                  starCtx.lineTo(cx + Math.cos(outerAngle) * outerR, cy + Math.sin(outerAngle) * outerR)
                }
                starCtx.lineTo(cx + Math.cos(innerAngle) * innerR, cy + Math.sin(innerAngle) * innerR)
              }
              starCtx.closePath()
              starCtx.fill()

              // 테두리
              starCtx.strokeStyle = '#ffffff'
              starCtx.lineWidth = 3
              starCtx.stroke()

              const starTexture = new THREE.CanvasTexture(starCanvas)
              const starSpriteMat = new THREE.SpriteMaterial({
                map: starTexture,
                transparent: true,
                depthTest: false,
                depthWrite: false,
              })
              const starSprite = new THREE.Sprite(starSpriteMat)
              starSprite.scale.set(baseSize * 1.4, baseSize * 1.4, 1)
              starSprite.position.set(0, 0, baseSize * 0.7)
              mesh.add(starSprite)
            }
          }

          mesh.userData.__nodeId = n.id
          mesh.userData.__ring = ring

          return mesh
        })
        .linkOpacity((l: any) => l.kind === 'imports' ? 0.6 : 0.3)
        .linkWidth((l: any) => l.kind === 'parent' ? 1.5 : l.kind === 'imports' ? 1.2 : 0.8)
        .linkColor((l: any) => l.kind === 'parent' ? '#4a9eff' : l.kind === 'imports' ? '#f59e0b' : '#6b7280')
        // 링크 파티클 설정 - 데이터 전송 효과
        .linkDirectionalParticles((link: any) => link.kind === 'parent' ? 4 : link.kind === 'imports' ? 3 : 0)
        .linkDirectionalParticleSpeed(0.006)
        .linkDirectionalParticleWidth(4)
        .linkDirectionalParticleResolution(10)
        .linkDirectionalParticleColor((link: any) => link.kind === 'imports' ? '#fbbf24' : '#60a5fa')
        // 모든 설정 후 데이터 로드 (파티클이 제대로 적용되려면 graphData는 마지막에 호출)
        .graphData({ nodes, links })
        .onNodeClick((node: any) => {
          if (!node) return

          setSelectedId(node.id)
          setSelectedNodes([node.id])

          // Trigger Preview
          let targetFile = files.find(f => f.id === node.id) || files.find(f => f.name === node.label)

          // Try sourceRef if available (__node property from convertToGraphData)
          if (!targetFile && node.__node?.sourceRef?.fileId) {
            targetFile = files.find(f => f.id === node.__node.sourceRef.fileId)
          }

          if (targetFile) {
            openCodePreview(targetFile)
          }

          // Animate camera to node
          Graph.cameraPosition(
            {
              x: node.x * 1.3,
              y: node.y * 1.3,
              z: (node.z ?? 0) * 1.3 + 150,
            },
            node,
            800
          )

          // Re-render to update selection ring
          Graph.nodeThreeObject(Graph.nodeThreeObject())
        })
        .onBackgroundClick(() => {
          setSelectedId(null)
          setSelectedNodes([])
          Graph.nodeThreeObject(Graph.nodeThreeObject())
        })

      // Get scene and add enhancements
      const scene = Graph.scene()

      // Add stars
      addStars(scene, THREE)

      // Lighting
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

      // Force tuning - radialDistance와 graphExpanded 연동
      const effectiveDistance = graphExpanded ? radialDistance : radialDistance * 0.2
      const effectiveStrength = graphExpanded ? -radialDistance * 1.5 : -30
      Graph.d3Force('charge')?.strength(effectiveStrength)
      Graph.d3Force('link')?.distance((l: any) => l.kind === 'parent' ? effectiveDistance * 0.5 : effectiveDistance)

      // Keep simulation running longer for smooth animation
      Graph.cooldownTicks(300)
      Graph.warmupTicks(100)

      // Continuous animation - reheat simulation periodically
      const animationInterval = setInterval(() => {
        if (graphRef.current) {
          // Add slight random movement to keep nodes alive
          const graphData = graphRef.current.graphData()
          if (graphData.nodes && graphData.nodes.length > 0) {
            graphData.nodes.forEach((node: any) => {
              if (node.vx !== undefined) {
                node.vx += (Math.random() - 0.5) * 0.5
                node.vy += (Math.random() - 0.5) * 0.5
                node.vz += (Math.random() - 0.5) * 0.5
              }
            })
            graphRef.current.d3ReheatSimulation()
          }
        }
      }, 3000)

      // Initial camera - center on graph after simulation settles
      const centerCamera = () => {
        if (!graphRef.current) return
        const graphData = graphRef.current.graphData()
        if (!graphData.nodes || graphData.nodes.length === 0) return

        // Calculate centroid of all nodes
        let cx = 0, cy = 0, cz = 0
        graphData.nodes.forEach((n: any) => {
          cx += n.x || 0
          cy += n.y || 0
          cz += n.z || 0
        })
        cx /= graphData.nodes.length
        cy /= graphData.nodes.length
        cz /= graphData.nodes.length

        // Position camera looking at centroid
        Graph.cameraPosition(
          { x: cx, y: cy - 50, z: cz + 350 },
          { x: cx, y: cy, z: cz },
          1000
        )
      }

      // Wait for initial simulation to settle, then center
      setTimeout(centerCamera, 1500)

        // Store interval for cleanup
        ; (Graph as any).__animationInterval = animationInterval

      graphRef.current = Graph

      // Resize handling (ResizeObserver로 컨테이너 크기 변화 감지)
      const handleResize = () => {
        if (containerRef.current && graphRef.current) {
          graphRef.current
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight)
        }
      }

      // ResizeObserver로 컨테이너 크기 변화 감지
      const resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current)
      }

      window.addEventListener('resize', handleResize)

      return () => {
        resizeObserver.disconnect()
        window.removeEventListener('resize', handleResize)
        // Clean up animation interval
        if ((Graph as any).__animationInterval) {
          clearInterval((Graph as any).__animationInterval)
        }
      }
    })
  }, [isClient, isDark, selectedNodeIds, graphExpanded, radialDistance])

  // Update graph data when store changes
  useEffect(() => {
    if (!graphRef.current || !graph) return

    const { nodes, links } = convertToGraphData()
    graphRef.current.graphData({ nodes, links })

    // 데이터 업데이트 후 파티클 설정 재적용 - 초기화와 동일한 설정 사용
    graphRef.current
      .linkDirectionalParticles((link: any) => link.kind === 'parent' ? 4 : link.kind === 'imports' ? 3 : 0)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(4)
      .linkDirectionalParticleColor((link: any) => link.kind === 'imports' ? '#fbbf24' : '#60a5fa')

    // Re-center after update - wait for simulation to settle
    setTimeout(() => {
      if (!graphRef.current) return
      const graphData = graphRef.current.graphData()
      if (!graphData.nodes || graphData.nodes.length === 0) return

      // Calculate centroid
      let cx = 0, cy = 0, cz = 0
      graphData.nodes.forEach((n: any) => {
        cx += n.x || 0
        cy += n.y || 0
        cz += n.z || 0
      })
      cx /= graphData.nodes.length
      cy /= graphData.nodes.length
      cz /= graphData.nodes.length

      // Center camera on centroid
      graphRef.current.cameraPosition(
        { x: cx, y: cy - 50, z: cz + 350 },
        { x: cx, y: cy, z: cz },
        800
      )
    }, 1200)
  }, [graph, convertToGraphData])

  // Update selection
  useEffect(() => {
    if (!graphRef.current) return
    setSelectedId(selectedNodeIds[0] || null)
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject())
  }, [selectedNodeIds])

  // radialDistance/graphExpanded에 따른 effective 값 계산
  const effectiveDistance = graphExpanded ? radialDistance : radialDistance * 0.2
  const effectiveStrength = graphExpanded ? -radialDistance * 1.5 : -30

  // Update force settings when radialDistance or graphExpanded changes
  useEffect(() => {
    if (!graphRef.current || !graph?.nodes?.length) return

    const graphInstance = graphRef.current

    // 약간의 딜레이 후 force 설정 (그래프 초기화 완료 대기)
    const timer = setTimeout(() => {
      const chargeForce = graphInstance.d3Force('charge')
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(effectiveStrength)
      }

      const linkForce = graphInstance.d3Force('link')
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance((l: any) => l.kind === 'parent' ? effectiveDistance * 0.5 : effectiveDistance)
      }

      graphInstance.d3ReheatSimulation()
    }, 100)

    return () => clearTimeout(timer)
  }, [radialDistance, graphExpanded, effectiveDistance, effectiveStrength, graph?.nodes?.length])

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
