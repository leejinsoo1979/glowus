'use client'

import { useRef, useMemo, useCallback, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Stars } from '@react-three/drei'
// PostProcessing disabled due to version compatibility issues
// import { EffectComposer, Bloom, SSAO } from '@react-three/postprocessing'
import * as THREE from 'three'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force-3d'
import { useMyNeuronsStore } from '@/lib/my-neurons/store'
import { NODE_COLORS, STATUS_COLORS, CAMERA_SETTINGS } from '@/lib/my-neurons/constants'
import type { MyNeuronNode, MyNeuronEdge, ViewMode, MyNeuronType } from '@/lib/my-neurons/types'
import { VIEW_MODE_CONFIG } from '@/lib/my-neurons/types'

// ============================================
// Types
// ============================================

interface SimNode extends MyNeuronNode {
  x: number
  y: number
  z: number
  vx?: number
  vy?: number
  vz?: number
  fx?: number | null
  fy?: number | null
  fz?: number | null
}

interface SimLink {
  source: string | SimNode
  target: string | SimNode
  edge: MyNeuronEdge
}

interface NeuronsCanvasProps {
  onNodeClick?: (node: MyNeuronNode) => void
  onBackgroundClick?: () => void
}

// ============================================
// Node Mesh Component
// ============================================

function NodeMesh({
  node,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  node: SimNode
  isSelected: boolean
  isHovered: boolean
  onClick: () => void
  onPointerOver: () => void
  onPointerOut: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Get color based on status or type
  const color = useMemo(() => {
    if (node.status === 'blocked') return STATUS_COLORS.blocked
    if (node.status === 'urgent') return STATUS_COLORS.urgent
    return NODE_COLORS[node.type] || '#3B82F6'
  }, [node.status, node.type])

  // Size based on type and importance - 크게 설정
  const size = useMemo(() => {
    let base = 12
    if (node.type === 'self') base = 20
    else if (node.type === 'project') base = 15
    else if (node.type === 'doc') base = 13
    return base + ((node.importance || 5) / 5)
  }, [node.type, node.importance])

  // Animation - floating effect
  useFrame((state) => {
    if (!meshRef.current) return

    // Hover/Select scale animation
    const targetScale = isHovered || isSelected ? 1.15 : 1
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    )

    // Gentle floating animation for all nodes
    const time = state.clock.elapsedTime
    const floatOffset = Math.sin(time * 0.5 + node.x * 0.1) * 2
    meshRef.current.position.y = floatOffset

    // Self node rotation
    if (node.type === 'self') {
      meshRef.current.rotation.y += 0.005
    }
  })

  return (
    <group position={[node.x || 0, node.y || 0, node.z || 0]}>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          onPointerOver()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onPointerOut()
          document.body.style.cursor = 'default'
        }}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : isHovered ? 0.5 : 0.4}
          roughness={0.2}
          metalness={0.3}
          transparent={node.status === 'completed'}
          opacity={node.status === 'completed' ? 0.4 : 1}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.3, size * 1.5, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}


      {/* Label - 선택/호버/Self 노드만 표시 */}
      {(isSelected || isHovered || node.type === 'self') && (
        <Html
          position={[0, size + 3, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div className={`px-2 py-1 rounded text-xs whitespace-nowrap border ${
            isSelected || isHovered
              ? 'bg-zinc-900/95 text-white border-blue-500'
              : node.type === 'self'
                ? 'bg-yellow-900/90 text-yellow-100 border-yellow-600'
                : 'bg-zinc-900/80 text-zinc-300 border-zinc-700'
          }`}>
            {node.title}
          </div>
        </Html>
      )}
    </group>
  )
}

// ============================================
// Edge Line Component
// ============================================

function EdgeLine({
  source,
  target,
  edge,
  isHighlighted,
}: {
  source: SimNode
  target: SimNode
  edge: MyNeuronEdge
  isHighlighted: boolean
}) {
  const points = useMemo(() => {
    return new Float32Array([
      source.x || 0, source.y || 0, source.z || 0,
      target.x || 0, target.y || 0, target.z || 0,
    ])
  }, [source.x, source.y, source.z, target.x, target.y, target.z])

  const color = useMemo(() => {
    if (edge.type === 'blocks') return '#EF4444'
    if (edge.type === 'depends_on') return '#F59E0B'
    if (edge.isBottleneck) return '#EF4444'
    return '#3B82F680'
  }, [edge.type, edge.isBottleneck])

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={isHighlighted ? 0.8 : 0.3}
      />
    </line>
  )
}

// ============================================
// Scene Component (with simulation)
// ============================================

function Scene({
  onNodeClick,
  onBackgroundClick,
}: {
  onNodeClick?: (node: MyNeuronNode) => void
  onBackgroundClick?: () => void
}) {
  const { camera } = useThree()

  // Store
  const graph = useMyNeuronsStore((s) => s.graph)
  const selectedNodeIds = useMyNeuronsStore((s) => s.selectedNodeIds)
  const selectNode = useMyNeuronsStore((s) => s.selectNode)
  const showLabels = useMyNeuronsStore((s) => s.showLabels)
  const viewMode = useMyNeuronsStore((s) => s.viewMode)

  // Local state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])
  const simulationRef = useRef<any>(null)

  // Get force config based on view mode
  const forceConfig = VIEW_MODE_CONFIG[viewMode]?.forceConfig || VIEW_MODE_CONFIG.radial.forceConfig

  // Type cluster positions for 'clusters' view mode
  const TYPE_CLUSTER_POSITIONS: Record<MyNeuronType, { x: number; z: number }> = {
    self: { x: 0, z: 0 },
    project: { x: 150, z: 0 },
    task: { x: 75, z: 130 },
    doc: { x: -75, z: 130 },
    person: { x: -150, z: 0 },
    agent: { x: -75, z: -130 },
    objective: { x: 75, z: -130 },
    key_result: { x: 120, z: -80 },
    decision: { x: 180, z: 60 },
    memory: { x: -180, z: 60 },
    workflow: { x: -120, z: -80 },
    insight: { x: 0, z: 180 },
    program: { x: 0, z: -180 },
    application: { x: 100, z: 160 },
    milestone: { x: -100, z: 160 },
    budget: { x: -180, z: -60 },
  }

  // Initialize simulation
  useEffect(() => {
    if (!graph?.nodes || graph.nodes.length === 0) return

    // Create simulation nodes with initial positions based on view mode
    // IMPORTANT: Always calculate fresh positions - don't use node.position which may be all zeros
    const nodes: SimNode[] = graph.nodes.map((node, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2
      let x: number, y: number, z: number

      if (viewMode === 'clusters') {
        // Cluster by type
        const clusterPos = TYPE_CLUSTER_POSITIONS[node.type] || { x: 0, z: 0 }
        x = clusterPos.x + (Math.random() - 0.5) * 40
        y = (Math.random() - 0.5) * 30
        z = clusterPos.z + (Math.random() - 0.5) * 40
      } else if (viewMode === 'roadmap') {
        // Arrange by priority/importance horizontally
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const xPos = (priorityOrder[node.priority] || 2) * 80 - 120
        x = xPos + (Math.random() - 0.5) * 30
        y = ((node.importance || 5) - 5) * 15
        z = (Math.random() - 0.5) * 100
      } else if (viewMode === 'insights') {
        // Place bottlenecks/urgent items closer to center
        const isUrgent = node.status === 'blocked' || node.status === 'urgent'
        const radius = isUrgent ? 50 + Math.random() * 30 : 120 + Math.random() * 80
        x = Math.cos(angle) * radius
        y = (isUrgent ? 20 : 0) + (Math.random() - 0.5) * 30
        z = Math.sin(angle) * radius
      } else if (viewMode === 'pathfinder') {
        // Spread out more to show connections
        const radius = node.type === 'self' ? 0 : 150 + Math.random() * 50
        x = Math.cos(angle) * radius
        y = (Math.random() - 0.5) * 80
        z = Math.sin(angle) * radius
      } else {
        // Default radial - spread by type into different rings - WIDE spacing
        let baseRadius = 80
        if (node.type === 'self') baseRadius = 0
        else if (node.type === 'project') baseRadius = 80 + (i % 5) * 40  // 80 to 240
        else if (node.type === 'doc') baseRadius = 200 + (i % 4) * 30    // 200 to 290
        else baseRadius = 250 + Math.random() * 60

        const radius = baseRadius + Math.random() * 30
        x = Math.cos(angle) * radius
        y = (Math.random() - 0.5) * 60
        z = Math.sin(angle) * radius
      }

      return {
        ...node,
        x,
        y,
        z,
      }
    })

    // Self node fixed at center
    const selfNode = nodes.find((n) => n.type === 'self')
    if (selfNode) {
      selfNode.fx = 0
      selfNode.fy = 0
      selfNode.fz = 0
    }

    // Create links
    const links: SimLink[] = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      edge,
    }))

    // Use static positions - simulation collapses nodes to center
    setSimNodes([...nodes])
    setSimLinks([...links])
  }, [graph?.nodes, graph?.edges, viewMode, forceConfig])

  // Get node map for edge lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, SimNode>()
    simNodes.forEach((node) => map.set(node.id, node))
    return map
  }, [simNodes])

  // Handle node click
  const handleNodeClick = useCallback(
    (node: SimNode) => {
      selectNode(node.id)
      onNodeClick?.(node)
    },
    [selectNode, onNodeClick]
  )

  // Focus camera on selected node
  useEffect(() => {
    if (selectedNodeIds.length !== 1) return

    const selectedNode = simNodes.find((n) => n.id === selectedNodeIds[0])
    if (!selectedNode) return

    // Animate camera to selected node
    const targetPosition = new THREE.Vector3(
      selectedNode.x,
      selectedNode.y + 50,
      selectedNode.z + CAMERA_SETTINGS.focusOffset
    )

    // Simple lerp animation would be better with gsap or spring
    camera.position.lerp(targetPosition, 0.1)
  }, [selectedNodeIds, simNodes, camera])

  return (
    <>
      {/* Ambient light - increased for visibility */}
      <ambientLight intensity={0.8} />

      {/* Point light at center */}
      <pointLight position={[0, 0, 0]} intensity={1.5} color="#FFD700" />
      <pointLight position={[0, 50, 0]} intensity={1} color="#FFFFFF" />

      {/* Directional lights - increased */}
      <directionalLight position={[100, 100, 100]} intensity={0.8} />
      <directionalLight position={[-100, -100, -100]} intensity={0.5} />
      <directionalLight position={[0, 200, 0]} intensity={0.6} />

      {/* Stars background */}
      <Stars
        radius={1000}
        depth={200}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {/* Fog - pushed far away to not obscure nodes */}
      <fog attach="fog" args={['#050510', 500, 2500]} />

      {/* Edges */}
      {simLinks.map((link, i) => {
        const sourceNode =
          typeof link.source === 'string'
            ? nodeMap.get(link.source)
            : link.source
        const targetNode =
          typeof link.target === 'string'
            ? nodeMap.get(link.target)
            : link.target

        if (!sourceNode || !targetNode) return null

        const isHighlighted =
          selectedNodeIds.includes(sourceNode.id) ||
          selectedNodeIds.includes(targetNode.id)

        return (
          <EdgeLine
            key={link.edge.id || i}
            source={sourceNode}
            target={targetNode}
            edge={link.edge}
            isHighlighted={isHighlighted}
          />
        )
      })}

      {/* Nodes */}
      {simNodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          isSelected={selectedNodeIds.includes(node.id)}
          isHovered={hoveredNodeId === node.id}
          onClick={() => handleNodeClick(node)}
          onPointerOver={() => setHoveredNodeId(node.id)}
          onPointerOut={() => setHoveredNodeId(null)}
        />
      ))}

      {/* Click handler for background */}
      <mesh
        position={[0, 0, 0]}
        onClick={(e) => {
          if (e.eventObject.type === 'Mesh') {
            onBackgroundClick?.()
          }
        }}
        visible={false}
      >
        <sphereGeometry args={[2000, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>

      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={CAMERA_SETTINGS.minDistance}
        maxDistance={CAMERA_SETTINGS.maxDistance}
        dampingFactor={CAMERA_SETTINGS.dampingFactor}
        enableDamping
      />
    </>
  )
}

// ============================================
// Main Canvas Export
// ============================================

export function NeuronsCanvas({ onNodeClick, onBackgroundClick }: NeuronsCanvasProps) {
  return (
    <div
      className="w-full h-full"
      onWheel={(e) => e.stopPropagation()}
    >
      <Canvas
        camera={{
          position: [
            CAMERA_SETTINGS.initialPosition.x,
            CAMERA_SETTINGS.initialPosition.y,
            CAMERA_SETTINGS.initialPosition.z,
          ],
          fov: CAMERA_SETTINGS.fov,
          near: CAMERA_SETTINGS.near,
          far: CAMERA_SETTINGS.far,
        }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'linear-gradient(180deg, #050510 0%, #0a0a1a 100%)' }}
      >
        <Scene onNodeClick={onNodeClick} onBackgroundClick={onBackgroundClick} />

        {/* PostProcessing Effects - Disabled due to version compatibility
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
          <SSAO samples={16} radius={0.1} intensity={20} />
        </EffectComposer>
        */}
      </Canvas>
    </div>
  )
}
