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
import type { MyNeuronNode, MyNeuronEdge } from '@/lib/my-neurons/types'

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

  // Size based on type and importance
  const size = useMemo(() => {
    let base = 2
    if (node.type === 'self') base = 4
    return base + (node.importance / 20)
  }, [node.type, node.importance])

  // Animation
  useFrame((state) => {
    if (!meshRef.current) return

    // Hover/Select scale animation
    const targetScale = isHovered || isSelected ? 1.15 : 1
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    )

    // Self node rotation
    if (node.type === 'self') {
      meshRef.current.rotation.y += 0.002
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
          emissiveIntensity={isSelected ? 0.8 : isHovered ? 0.5 : 0.3}
          roughness={0.4}
          metalness={0.6}
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

      {/* Self node ring */}
      {node.type === 'self' && (
        <>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[size * 1.2, size * 1.3, 64]} />
            <meshBasicMaterial
              color="#FFD700"
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
            <ringGeometry args={[size * 1.4, size * 1.5, 64]} />
            <meshBasicMaterial
              color="#FFD700"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {/* Label */}
      {(isSelected || isHovered || node.type === 'self') && (
        <Html
          position={[0, size + 2, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div className="px-2 py-1 bg-zinc-900/90 backdrop-blur rounded text-xs text-white whitespace-nowrap border border-zinc-700">
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

  // Local state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])
  const simulationRef = useRef<any>(null)

  // Initialize simulation
  useEffect(() => {
    if (!graph?.nodes || graph.nodes.length === 0) return

    // Create simulation nodes with initial positions
    const nodes: SimNode[] = graph.nodes.map((node, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2
      const radius = node.type === 'self' ? 0 : 100 + Math.random() * 50
      return {
        ...node,
        x: node.position?.x ?? Math.cos(angle) * radius,
        y: node.position?.y ?? (Math.random() - 0.5) * 50,
        z: node.position?.z ?? Math.sin(angle) * radius,
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

    // Create simulation (3D)
    const simulation = forceSimulation(nodes)
      .numDimensions(3)
      .force(
        'link',
        forceLink(links)
          .id((d: any) => d.id)
          .distance(60)
          .strength(0.3)
      )
      .force('charge', forceManyBody().strength(-100).distanceMax(300))
      .force('center', forceCenter(0, 0, 0).strength(0.05))
      .force('collision', forceCollide().radius(15).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.4)

    simulationRef.current = simulation

    // Update state on tick
    simulation.on('tick', () => {
      setSimNodes([...nodes])
      setSimLinks([...links])
    })

    // Run initial ticks
    for (let i = 0; i < 100; i++) {
      simulation.tick()
    }
    setSimNodes([...nodes])
    setSimLinks([...links])

    return () => {
      simulation.stop()
    }
  }, [graph?.nodes, graph?.edges])

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
      {/* Ambient light */}
      <ambientLight intensity={0.4} />

      {/* Point light at center */}
      <pointLight position={[0, 0, 0]} intensity={1} color="#FFD700" />

      {/* Directional lights */}
      <directionalLight position={[100, 100, 100]} intensity={0.5} />
      <directionalLight position={[-100, -100, -100]} intensity={0.3} />

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

      {/* Fog */}
      <fog attach="fog" args={['#050510', 200, 1500]} />

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
