// @ts-nocheck
'use client'

import { Suspense, useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Preload, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { THEME_PRESETS, POST_PROCESSING, CAMERA_SETTINGS } from '@/lib/neural-map/constants'
import { NeuralMapSimulation, createSimulation, type SimNode, type SimLink } from '@/lib/neural-map/simulation'
import { NodeMesh } from './NodeMesh'
import { EdgeLine } from './EdgeLine'
import { LabelSystem } from './LabelSystem'
import { CameraController } from './CameraController'
import { StarField, NebulaCloud } from './StarField'
import { CameraResetter } from './CameraResetter'

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
  const expandedNodeIds = useNeuralMapStore((s) => s.expandedNodeIds)
  const radialDistance = useNeuralMapStore((s) => s.radialDistance)

  // Simulation state
  const simulationRef = useRef<NeuralMapSimulation | null>(null)
  const [simNodes, setSimNodes] = useState<SimNode[]>([])
  const [simLinks, setSimLinks] = useState<SimLink[]>([])

  // Get theme
  const theme = THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0]

  // Initialize simulation when graph changes or expansion changes
  useEffect(() => {
    if (!graph) return

    // Clean up existing simulation
    if (simulationRef.current) {
      simulationRef.current.dispose()
    }

    // Visibility Check Helper (Recursive)
    const isNodeVisible = (nodeId: string): boolean => {
      const node = graph.nodes.find(n => n.id === nodeId);
      if (!node) return false;

      // Root items (no parent) are always visible unless we implement root collapsing
      if (!node.parentId) return true;

      // If parent exists, parent MUST be expanded (in expandedNodeIds)
      if (expandedNodeIds.has(node.parentId)) {
        // Parent is expanded, check grandparent recursively
        return isNodeVisible(node.parentId);
      } else {
        // Parent is NOT expanded (collapsed), so this node is hidden
        return false;
      }
    };

    // Filter nodes based on visibility
    const visibleNodes = graph.nodes.filter(n => {
      // 1. Self node always visible
      if (n.type === 'self') return true;
      // 2. Recursive visibility check
      return isNodeVisible(n.id);
    });

    console.log('[Canvas] Visibility Check:', {
      total: graph.nodes.length,
      visible: visibleNodes.length,
      expandedIds: Array.from(expandedNodeIds)
    });

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    // Filter edges (both source and target must be visible)
    const visibleEdges = graph.edges.filter(e =>
      visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    // Create new simulation
    const simulation = createSimulation({
      nodeCount: visibleNodes.length,
      enableRadialLayout: true,
      centerNodeId: graph.nodes.find((n) => n.type === 'self')?.id,
      radialDistance: radialDistance, // Inject dynamic radial distance
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

    simulation.init(visibleNodes, visibleEdges)
    simulation.start()

    simulationRef.current = simulation

    return () => {
      simulation.stop()
    }
  }, [graph, expandedNodeIds, radialDistance, setSimulationAlpha, setSimulationRunning])

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

      {/* Background gradient sphere + nebula */}
      <CosmicBackground colors={theme.background.gradient} />

      {theme.background.starsEnabled && (
        <StarField
          radius={1200}
          count={theme.background.starsCount}
          color={theme.background.starsColor}
        />
      )}

      {/* Soft nebula clouds for cosmic depth */}
      <NebulaCloud
        position={[0, 80, -250]}
        color={theme.ui?.accentColor || '#3b82f6'}
        opacity={0.18}
        scale={380}
      />
      <NebulaCloud
        position={[-200, -40, -180]}
        color="#342b5d"
        opacity={0.12}
        scale={420}
      />

      {/* Camera controls */}
      <CameraController />
      <CameraResetter />

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

// Simple dark background
interface CosmicBackgroundProps {
  colors: [string, string]
}

function CosmicBackground({ colors }: CosmicBackgroundProps) {
  const { scene } = useThree()

  useEffect(() => {
    scene.background = new THREE.Color(colors?.[1] || '#050510')
  }, [scene, colors])

  const gradientMaterial = useMemo(() => {
    const top = new THREE.Color(colors?.[0] || '#0f172a')
    const bottom = new THREE.Color(colors?.[1] || '#020617')

    return new THREE.ShaderMaterial({
      uniforms: {
        colorTop: { value: top },
        colorBottom: { value: bottom },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = normalize(worldPosition.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        varying vec3 vWorldPosition;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          float gradient = smoothstep(-0.2, 0.8, vWorldPosition.y);
          vec3 baseColor = mix(colorBottom, colorTop, gradient);

          float starNoise = hash(vWorldPosition.xy * 20.0);
          float glow = pow(1.0 - abs(vWorldPosition.y), 2.0);

          vec3 finalColor = baseColor + starNoise * 0.08 + glow * vec3(0.04, 0.02, 0.08);
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [colors])

  useEffect(() => {
    return () => {
      gradientMaterial.dispose()
    }
  }, [gradientMaterial])

  return (
    <mesh scale={1200}>
      <sphereGeometry args={[1, 64, 64]} />
      <primitive object={gradientMaterial} attach="material" />
    </mesh>
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
