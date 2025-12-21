// @ts-nocheck
'use client'

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge, NeuralFile } from '@/lib/neural-map/types'
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

          // 파일 타입 표시 (스프라이트) - 2D와 동일한 아이콘 사용
          if (n.fileType) {
            const ext = n.fileType
            const color = '#' + (FILE_TYPE_COLORS[ext.toLowerCase()] || 0x6b7280).toString(16).padStart(6, '0')
            const IconComp = getIconComponent(ext)

            const canvas = document.createElement('canvas')
            canvas.width = 128
            canvas.height = 128
            const ctx = canvas.getContext('2d')

            if (ctx) {
              try {
                const svgString = renderToStaticMarkup(
                  <IconComp size={100} color="#FFFFFF" style={{ display: 'block' }} />
                )
                const img = new Image()
                const svgData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

                img.onload = () => {
                  ctx.clearRect(0, 0, 128, 128)
                  // 배경 원 (2D 뷰 스타일 반영 가능)
                  ctx.beginPath()
                  ctx.arc(64, 64, 54, 0, Math.PI * 2)
                  ctx.fillStyle = color
                  ctx.fill()

                  // 아이콘 그리기
                  ctx.drawImage(img, 14, 14, 100, 100)
                  texture.needsUpdate = true
                }
                img.src = svgData
              } catch (e) {
                console.error('Icon texture generation failed:', e)
              }

              const texture = new THREE.CanvasTexture(canvas)
              const spriteMat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false,
                depthWrite: false,
              })
              const sprite = new THREE.Sprite(spriteMat)
              sprite.scale.set(baseSize * 1.5, baseSize * 1.5, 1)
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
        .linkWidth((l: any) => l.kind === 'parent' ? 1.5 : l.kind === 'imports' ? 1.8 : 0.8)
        .linkColor((l: any) =>
          l.kind === 'parent' ? '#4a9eff88' :
            l.kind === 'imports' ? (currentTheme.ui.accentColor + 'cc') :
              (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)')
        )
        // 링크 파티클 설정 - 2D와 일치하는 데이터 전송 효과
        .linkDirectionalParticles((link: any) => link.kind === 'imports' ? 4 : 0)
        .linkDirectionalParticleSpeed(0.01)
        .linkDirectionalParticleWidth(4)
        .linkDirectionalParticleResolution(10)
        .linkDirectionalParticleColor(() => currentTheme.ui.accentColor)
        // 모든 설정 후 데이터 로드
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
  }, [graph, convertToGraphData])

  // 정렬 버튼 클릭 시 시뮬레이션 재시작 감지
  useEffect(() => {
    if (graphRef.current && isSimulationRunning) {
      // Reheat simulation
      graphRef.current.d3ReheatSimulation()
    }
  }, [isSimulationRunning])


  // Update selection
  useEffect(() => {
    if (!graphRef.current) return
    setSelectedId(selectedNodeIds[0] || null)
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject())
  }, [selectedNodeIds])

  // radialDistance/graphExpanded에 따른 effective 값 계산
  const effectiveDistance = graphExpanded ? radialDistance : radialDistance * 0.2
  const effectiveStrength = graphExpanded ? -radialDistance * 1.5 : -30

  // Update force settings when layoutMode, radialDistance or graphExpanded changes
  useEffect(() => {
    if (!graphRef.current || !graph?.nodes?.length) return

    const graphInstance = graphRef.current

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
        import('d3-force-3d').then(d3 => {
          graphInstance.d3Force('radial', d3.forceRadial((n: any) => {
            if (n.type === 'self') return 0
            if (n.type === 'folder') return 120
            return 240
          }, 0, 0, 0).strength(0.8))
          graphInstance.d3Force('y', null)
        })
      }
      // 'structural' 모드
      else if (layoutMode === 'structural') {
        import('d3-force-3d').then(d3 => {
          graphInstance.d3Force('radial', null)
          // Simple hierarchy simulation: folders on top, files below
          graphInstance.d3Force('y', d3.forceY((n: any) => {
            if (n.type === 'self') return -200
            if (n.type === 'folder') return -100
            return 100
          }).strength(0.5))
        })
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
