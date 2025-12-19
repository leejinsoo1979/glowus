// @ts-nocheck
'use client'

import { Suspense, useRef, useEffect, useCallback, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Preload, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { THEME_PRESETS, POST_PROCESSING, CAMERA_SETTINGS } from '@/lib/neural-map/constants'
import { NeuralMapSimulation, createSimulation, type SimNode, type SimLink } from '@/lib/neural-map/simulation'
import { NodeMesh } from './NodeMesh'
import { EdgeLine } from './EdgeLine'
import { LabelSystem } from './LabelSystem'
import { CameraController } from './CameraController'
import { StarField, NebulaCloud } from './StarField'

interface NeuralMapCanvasProps {
  className?: string
}

export function NeuralMapCanvas({ className }: NeuralMapCanvasProps) {
  const themeId = useNeuralMapStore((s) => s.themeId)

  // Get theme for background
  const theme = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0]

  // Performance state
  const [dpr, setDpr] = useState(1.5)

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        dpr={dpr}
        camera={{
          fov: CAMERA_SETTINGS.fov,
          near: CAMERA_SETTINGS.near,
          far: CAMERA_SETTINGS.far,
          position: [
            CAMERA_SETTINGS.defaultPosition.x,
            CAMERA_SETTINGS.defaultPosition.y,
            CAMERA_SETTINGS.defaultPosition.z,
          ],
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color(theme.background.gradient[0]))
        }}
      >
        <PerformanceMonitor
          onIncline={() => setDpr(Math.min(2, dpr + 0.1))}
          onDecline={() => setDpr(Math.max(0.5, dpr - 0.1))}
        >
          <Suspense fallback={<LoadingIndicator />}>
            <SceneContent />
          </Suspense>
        </PerformanceMonitor>
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Preload all />
      </Canvas>
    </div>
  )
}

// Loading indicator while scene loads
function LoadingIndicator() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[2, 1]} />
      <meshBasicMaterial color="#FFD700" wireframe />
    </mesh>
  )
}

// Main scene content
function SceneContent() {
  const graph = useNeuralMapStore((s) => s.graph)
  const themeId = useNeuralMapStore((s) => s.themeId)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)
  const addSelectedNode = useNeuralMapStore((s) => s.addSelectedNode)
  const setHoveredNode = useNeuralMapStore((s) => s.setHoveredNode)
  const setSimulationRunning = useNeuralMapStore((s) => s.setSimulationRunning)
  const setSimulationAlpha = useNeuralMapStore((s) => s.setSimulationAlpha)

  // Simulation state
  const simulationRef = useRef<NeuralMapSimulation | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])

  // Get theme
  const theme = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0]

  // Initialize simulation when graph changes
  useEffect(() => {
    if (!graph) return

    // Clean up existing simulation
    if (simulationRef.current) {
      simulationRef.current.dispose()
    }

    // Create new simulation
    const simulation = createSimulation({
      nodeCount: graph.nodes.length,
      enableRadialLayout: true,
      centerNodeId: graph.nodes.find((n) => n.type === 'self')?.id,
      onTick: (state) => {
        setSimNodes([...state.nodes])
        setSimLinks([...state.links])
        setSimulationAlpha(state.alpha)
        setSimulationRunning(state.isRunning)
      },
      onEnd: () => {
        setSimulationRunning(false)
      },
    })

    simulation.init(graph.nodes, graph.edges)
    simulation.start()

    simulationRef.current = simulation

    return () => {
      simulation.dispose()
    }
  }, [graph, setSimulationAlpha, setSimulationRunning])

  // Handle node click
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      // Check for multi-select (shift/ctrl key)
      const isMultiSelect = false // Would need to track key state
      if (isMultiSelect) {
        addSelectedNode(nodeId)
      } else {
        setSelectedNodes([nodeId])
      }
    },
    [setSelectedNodes, addSelectedNode]
  )

  // Handle node hover
  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNode(nodeId)
    },
    [setHoveredNode]
  )

  // Handle node drag
  const handleNodeDragStart = useCallback((nodeId: string) => {
    simulationRef.current?.pinNode(nodeId, true)
  }, [])

  const handleNodeDrag = useCallback((nodeId: string, position: THREE.Vector3) => {
    simulationRef.current?.dragNode(nodeId, { x: position.x, y: position.y, z: position.z })
  }, [])

  const handleNodeDragEnd = useCallback((nodeId: string) => {
    simulationRef.current?.endDrag(nodeId, false)
  }, [])

  // Handle background click (deselect)
  const handleBackgroundClick = useCallback(() => {
    setSelectedNodes([])
  }, [setSelectedNodes])

  return (
    <>
      {/* Cosmic Lighting */}
      <ambientLight intensity={0.3} color="#3a4a5a" />
      <directionalLight position={[100, 100, 50]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-100, -50, -100]} intensity={0.3} color="#4a9eff" />

      {/* Point lights for dramatic effect */}
      <pointLight position={[0, 0, 0]} intensity={1.5} color="#FFD700" distance={200} decay={2} />
      <pointLight position={[150, 50, 100]} intensity={0.8} color="#00BFFF" distance={300} decay={2} />
      <pointLight position={[-150, -50, -100]} intensity={0.5} color="#00BFFF" distance={300} decay={2} />

      {/* Background gradient sphere */}
      <CosmicBackground colors={theme.background.gradient} />

      {/* Very subtle background - nodes are the real stars */}
      <Stars
        radius={1000}
        depth={50}
        count={500}
        factor={2}
        saturation={0}
        fade
        speed={0.1}
      />

      {/* Camera controls */}
      <CameraController />

      {/* Fog for depth - starts far to not hide stars */}
      <fog attach="fog" args={[theme.background.gradient[1], 500, 2000]} />

      {/* Edges */}
      {simLinks.length > 0 && (
        <EdgeLine links={simLinks} nodes={simNodes} />
      )}

      {/* Nodes */}
      {simNodes.length > 0 && (
        <NodeMesh
          nodes={simNodes}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragEnd={handleNodeDragEnd}
        />
      )}

      {/* Labels */}
      {simNodes.length > 0 && <LabelSystem nodes={simNodes} />}

      {/* Click handler for background */}
      <mesh onClick={handleBackgroundClick} visible={false}>
        <sphereGeometry args={[1000, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>
    </>
  )
}

// Cosmic background with gradient and glow
interface CosmicBackgroundProps {
  colors: [string, string]
}

function CosmicBackground({ colors }: CosmicBackgroundProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const { scene } = useThree()

  useEffect(() => {
    // Create gradient texture
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 512

    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 512)
      gradient.addColorStop(0, colors[0])
      gradient.addColorStop(0.5, colors[1])
      gradient.addColorStop(1, '#000005')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 2, 512)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial
      material.map = texture
      material.needsUpdate = true
    }

    // Set scene background
    scene.background = new THREE.Color(colors[0])
  }, [colors, scene])

  // Animate subtle glow
  useFrame((state) => {
    if (glowRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 0.2) * 0.02
      glowRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group>
      {/* Main background sphere */}
      <mesh ref={meshRef} scale={[-1, 1, 1]}>
        <sphereGeometry args={[800, 64, 64]} />
        <meshBasicMaterial side={THREE.BackSide} />
      </mesh>

      {/* Central glow effect */}
      <mesh ref={glowRef} position={[0, 0, -100]}>
        <sphereGeometry args={[150, 32, 32]} />
        <meshBasicMaterial
          color="#0a1a2a"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// Grid helper for development
export function GridHelper() {
  return (
    <>
      <gridHelper args={[100, 50, '#333333', '#222222']} position={[0, -20, 0]} />
      <axesHelper args={[50]} />
    </>
  )
}

export default NeuralMapCanvas
