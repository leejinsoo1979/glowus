// @ts-nocheck
'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge } from '@/lib/neural-map/types'

// Types for 3d-force-graph
interface GraphNode {
  id: string
  label: string
  type: string
  depth: number
  expanded: boolean
  x?: number
  y?: number
  z?: number
  // Original node reference
  __node?: NeuralNode
}

interface GraphLink {
  source: string
  target: string
  kind: 'parent' | 'reference' | 'sibling'
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

  // Theme
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Client-side only
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Convert graph data to force-graph format
  const convertToGraphData = useCallback(() => {
    if (!graph) return { nodes: [], links: [] }

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const nodeMap = new Map<string, GraphNode>()

    // Find root/self node
    const selfNode = graph.nodes.find(n => n.type === 'self')

    // Build nodes
    graph.nodes.forEach((node, index) => {
      const depth = node.type === 'self' ? 0 :
                    node.parentId ? 2 : 1

      const graphNode: GraphNode = {
        id: node.id,
        label: node.title,
        type: node.type,
        depth,
        expanded: true,
        __node: node,
      }

      nodes.push(graphNode)
      nodeMap.set(node.id, graphNode)
    })

    // Build links from edges
    graph.edges.forEach((edge) => {
      const sourceExists = nodeMap.has(edge.source)
      const targetExists = nodeMap.has(edge.target)

      if (sourceExists && targetExists) {
        links.push({
          source: edge.source,
          target: edge.target,
          kind: edge.type === 'parent_child' ? 'parent' : edge.type === 'imports' ? 'imports' : 'reference',
        })
      }
    })

    return { nodes, links }
  }, [graph])

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

  // Get node color based on type
  const getNodeColor = useCallback((type: string, isSelected: boolean) => {
    if (isSelected) return 0x8b5cf6 // Purple for selected

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

    return colors[type] || 0x6b7280
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

      if (graphRef.current) {
        // Already initialized
        return
      }

      const { nodes, links } = convertToGraphData()

      const Graph = ForceGraph3D()(containerRef.current!)
        .backgroundColor(isDark ? '#070A12' : '#f8fafc')
        .graphData({ nodes, links })
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
          const baseSize = n.type === 'self' ? 12 :
                          n.type === 'folder' ? 8 :
                          n.depth === 1 ? 7 : 5

          // Create sphere
          const geom = new THREE.SphereGeometry(baseSize, 24, 24)
          const color = getNodeColor(n.type, isSelected)

          const mat = new THREE.MeshStandardMaterial({
            color,
            metalness: 0.3,
            roughness: 0.5,
            emissive: new THREE.Color(color),
            emissiveIntensity: n.type === 'self' ? 0.8 : 0.4,
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
          }

          mesh.userData.__nodeId = n.id
          mesh.userData.__ring = ring

          return mesh
        })
        .linkOpacity((l: any) => l.kind === 'imports' ? 0.6 : 0.3)
        .linkWidth((l: any) => l.kind === 'parent' ? 1.5 : l.kind === 'imports' ? 1.2 : 0.8)
        .linkColor((l: any) => l.kind === 'parent' ? '#4a9eff' : l.kind === 'imports' ? '#f59e0b' : '#6b7280')
        .linkDirectionalParticles((l: any) => l.kind === 'parent' ? 3 : l.kind === 'imports' ? 2 : 0)
        .linkDirectionalParticleWidth((l: any) => l.kind === 'imports' ? 2 : 1.5)
        .linkDirectionalParticleColor((l: any) => l.kind === 'imports' ? '#f59e0b' : '#4a9eff')
        .onNodeClick((node: any) => {
          if (!node) return

          setSelectedId(node.id)
          setSelectedNodes([node.id])

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

      // Force tuning - ensure nodes are centered around origin
      Graph.d3Force('charge')?.strength(-180)
      Graph.d3Force('link')?.distance((l: any) => l.kind === 'parent' ? 80 : 120)
      Graph.d3Force('center', null) // Remove default center if exists

      // Add explicit center force to keep graph centered at origin
      import('d3-force-3d').then(d3Force => {
        if (graphRef.current) {
          graphRef.current.d3Force('center', d3Force.forceCenter(0, 0, 0))
        }
      })

      // Initial camera position - wait for force simulation to settle, then center
      setTimeout(() => {
        // Center the camera at origin with smooth transition
        Graph.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 500)
      }, 800)

      // After camera centered, zoom to fit all nodes
      setTimeout(() => {
        Graph.zoomToFit(600, 250)
      }, 1500)

      graphRef.current = Graph

      // Resize handling
      const handleResize = () => {
        if (containerRef.current && graphRef.current) {
          graphRef.current
            .width(containerRef.current.clientWidth)
            .height(containerRef.current.clientHeight)
        }
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    })
  }, [isClient, isDark, selectedNodeIds])

  // Update graph data when store changes
  useEffect(() => {
    if (!graphRef.current || !graph) return

    const { nodes, links } = convertToGraphData()
    graphRef.current.graphData({ nodes, links })

    // Re-center after update - wait for force simulation to settle
    setTimeout(() => {
      // First center the camera
      graphRef.current?.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 400)
    }, 500)

    // Then zoom to fit all nodes
    setTimeout(() => {
      graphRef.current?.zoomToFit(500, 250)
    }, 1000)
  }, [graph, convertToGraphData])

  // Update selection
  useEffect(() => {
    if (!graphRef.current) return
    setSelectedId(selectedNodeIds[0] || null)
    graphRef.current.nodeThreeObject(graphRef.current.nodeThreeObject())
  }, [selectedNodeIds])

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
