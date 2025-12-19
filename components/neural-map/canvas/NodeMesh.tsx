// @ts-nocheck
'use client'

import { useRef, useMemo, useEffect, useCallback } from 'react'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { NODE_COLORS, NODE_THRESHOLDS, LOD_DISTANCES } from '@/lib/neural-map/constants'
import type { SimNode } from '@/lib/neural-map/simulation'
import type { NodeType } from '@/lib/neural-map/types'

interface NodeMeshProps {
  nodes: SimNode[]
  onNodeClick?: (nodeId: string) => void
  onNodeHover?: (nodeId: string | null) => void
  onNodeDragStart?: (nodeId: string) => void
  onNodeDrag?: (nodeId: string, position: THREE.Vector3) => void
  onNodeDragEnd?: (nodeId: string) => void
}

// Node geometry sizes by type (Self is 1.5x of base size 2)
const BASE_NODE_SIZE = 2
const NODE_SIZES: Record<NodeType, number> = {
  self: BASE_NODE_SIZE * 1.8,
  concept: 1.5,
  project: 2,
  doc: 1.2,
  idea: 1.3,
  decision: 1.4,
  memory: 1.1,
  task: 1.2,
  person: 1.8,
  insight: 1.6,
}

// Self node color
const SELF_NODE_COLOR = '#FFD700'

// Create shared geometries
const sphereGeometry = new THREE.SphereGeometry(1, 64, 64)
const sphereGeometryMed = new THREE.SphereGeometry(1, 32, 32)
const sphereGeometryLow = new THREE.SphereGeometry(1, 16, 16)

export function NodeMesh({
  nodes,
  onNodeClick,
  onNodeHover,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragEnd,
}: NodeMeshProps) {
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null)
  const { camera } = useThree()

  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const hoveredNodeId = useNeuralMapStore((s) => s.hoveredNodeId)
  const themeId = useNeuralMapStore((s) => s.themeId)

  // Determine if we should use instanced rendering
  const useInstanced = nodes.length > NODE_THRESHOLDS.INSTANCED

  // Create color array for instanced mesh
  const colorArray = useMemo(() => {
    const colors = new Float32Array(nodes.length * 3)
    nodes.forEach((node, i) => {
      const color = new THREE.Color(NODE_COLORS[node.type])
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    })
    return colors
  }, [nodes])

  // Update instanced mesh matrices
  useEffect(() => {
    if (!instancedMeshRef.current || !useInstanced) return

    const mesh = instancedMeshRef.current
    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    nodes.forEach((node, i) => {
      position.set(node.x, node.y, node.z)
      quaternion.identity()
      const size = NODE_SIZES[node.type] * (1 + node.importance / 200)
      scale.set(size, size, size)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
  }, [nodes, useInstanced])

  // Update colors on selection/hover
  useEffect(() => {
    if (!instancedMeshRef.current || !useInstanced) return

    const mesh = instancedMeshRef.current
    const colorAttr = mesh.geometry.getAttribute('color') as THREE.BufferAttribute

    if (!colorAttr) return

    nodes.forEach((node, i) => {
      let color: THREE.Color
      if (selectedNodeIds.includes(node.id)) {
        color = new THREE.Color('#ffffff')
      } else if (hoveredNodeId === node.id) {
        color = new THREE.Color(NODE_COLORS[node.type]).multiplyScalar(1.5)
      } else {
        color = new THREE.Color(NODE_COLORS[node.type])
      }
      colorAttr.setXYZ(i, color.r, color.g, color.b)
    })

    colorAttr.needsUpdate = true
  }, [nodes, selectedNodeIds, hoveredNodeId, useInstanced])

  // Handle click on instanced mesh
  const handleInstancedClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (event.instanceId !== undefined && nodes[event.instanceId]) {
        onNodeClick?.(nodes[event.instanceId].id)
      }
    },
    [nodes, onNodeClick]
  )

  // Handle pointer over on instanced mesh
  const handleInstancedPointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (event.instanceId !== undefined && nodes[event.instanceId]) {
        onNodeHover?.(nodes[event.instanceId].id)
      }
    },
    [nodes, onNodeHover]
  )

  // Handle pointer out
  const handleInstancedPointerOut = useCallback(() => {
    onNodeHover?.(null)
  }, [onNodeHover])

  // Get LOD geometry based on distance
  const getLODGeometry = useCallback(
    (distance: number) => {
      if (distance > LOD_DISTANCES.far) return sphereGeometryLow
      if (distance > LOD_DISTANCES.medium) return sphereGeometryMed
      return sphereGeometry
    },
    []
  )

  // Render instanced mesh for large node counts
  if (useInstanced) {
    return (
      <instancedMesh
        ref={instancedMeshRef}
        args={[sphereGeometryLow, undefined, nodes.length]}
        onClick={handleInstancedClick}
        onPointerOver={handleInstancedPointerOver}
        onPointerOut={handleInstancedPointerOut}
      >
        <meshStandardMaterial
          vertexColors
          metalness={0.3}
          roughness={0.7}
        />
        <instancedBufferAttribute
          attach="geometry-attributes-color"
          args={[colorArray, 3]}
        />
      </instancedMesh>
    )
  }

  // Render individual meshes for small node counts (better interaction)
  return (
    <group>
      {nodes.map((node) => (
        <PlanetNode
          key={node.id}
          node={node}
          isSelected={selectedNodeIds.includes(node.id)}
          isHovered={hoveredNodeId === node.id}
          onClick={onNodeClick}
          onHover={onNodeHover}
          onDragStart={onNodeDragStart}
          onDrag={onNodeDrag}
          onDragEnd={onNodeDragEnd}
          getLODGeometry={getLODGeometry}
        />
      ))}
    </group>
  )
}

// Planet-style node component
interface PlanetNodeProps {
  node: SimNode
  isSelected: boolean
  isHovered: boolean
  onClick?: (nodeId: string) => void
  onHover?: (nodeId: string | null) => void
  onDragStart?: (nodeId: string) => void
  onDrag?: (nodeId: string, position: THREE.Vector3) => void
  onDragEnd?: (nodeId: string) => void
  getLODGeometry: (distance: number) => THREE.SphereGeometry
}

function PlanetNode({
  node,
  isSelected,
  isHovered,
  onClick,
  onHover,
  onDragStart,
  onDrag,
  onDragEnd,
  getLODGeometry,
}: PlanetNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const isDragging = useRef(false)

  const isSelf = node.type === 'self'
  const nodeColor = isSelf ? SELF_NODE_COLOR : NODE_COLORS[node.type]

  // Calculate size based on type and importance
  const size = useMemo(() => {
    const baseSize = NODE_SIZES[node.type] * (1 + node.importance / 150)
    return isHovered ? baseSize * 1.1 : baseSize
  }, [node.type, node.importance, isHovered])

  // Update LOD based on distance to camera
  useFrame(() => {
    if (!meshRef.current) return
    const distance = camera.position.distanceTo(meshRef.current.position)
    meshRef.current.geometry = getLODGeometry(distance)
  })

  // Handle click
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      if (!isDragging.current) {
        onClick?.(node.id)
      }
    },
    [node.id, onClick]
  )

  // Handle pointer down (drag start)
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation()
      isDragging.current = true
      onDragStart?.(node.id)
      ;(event.target as HTMLElement)?.setPointerCapture?.(event.pointerId)
    },
    [node.id, onDragStart]
  )

  // Handle pointer move (drag)
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!isDragging.current) return
      event.stopPropagation()
      if (meshRef.current && event.point) {
        onDrag?.(node.id, event.point)
      }
    },
    [node.id, onDrag]
  )

  // Handle pointer up (drag end)
  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (isDragging.current) {
        isDragging.current = false
        onDragEnd?.(node.id)
        ;(event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId)
      }
    },
    [node.id, onDragEnd]
  )

  return (
    <group position={[node.x, node.y, node.z]}>
      {/* Main planet sphere */}
      <mesh
        ref={meshRef}
        scale={size}
        onClick={handleClick}
        onPointerOver={() => onHover?.(node.id)}
        onPointerOut={() => onHover?.(null)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color={isSelected ? '#ffffff' : nodeColor}
          metalness={isSelf ? 0.9 : 0.6}
          roughness={isSelf ? 0.1 : 0.3}
          emissive={nodeColor}
          emissiveIntensity={isSelected ? 2.5 : isHovered ? 2.0 : isSelf ? 1.5 : 1.0}
        />
      </mesh>


      {/* Selection indicator ring (for non-self nodes) */}
      {isSelected && !isSelf && (
        <mesh scale={size * 1.4} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.02, 16, 64]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

    </group>
  )
}

export default NodeMesh
