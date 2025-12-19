// @ts-nocheck
'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { THEME_PRESETS, NODE_THRESHOLDS } from '@/lib/neural-map/constants'
import type { SimNode, SimLink } from '@/lib/neural-map/simulation'
import type { EdgeType } from '@/lib/neural-map/types'

interface EdgeLineProps {
  links: SimLink[]
  nodes: SimNode[]
  onEdgeClick?: (edgeId: string) => void
  onEdgeHover?: (edgeId: string | null) => void
}

// Edge colors by type
const EDGE_COLORS: Record<EdgeType, string> = {
  parent_child: '#3B82F6',
  references: '#0EA5E9',
  supports: '#22c55e',
  contradicts: '#ef4444',
  causes: '#f59e0b',
  same_topic: '#06b6d4',
  sequence: '#14B8A6',
}

// Edge dash patterns by type
const EDGE_DASHES: Record<EdgeType, [number, number] | null> = {
  parent_child: null,
  references: [0.5, 0.2],
  supports: null,
  contradicts: [0.3, 0.3],
  causes: [0.5, 0.1],
  same_topic: [0.2, 0.1],
  sequence: null,
}

export function EdgeLine({ links, nodes, onEdgeClick, onEdgeHover }: EdgeLineProps) {
  const themeId = useNeuralMapStore((s) => s.themeId)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const hoveredNodeId = useNeuralMapStore((s) => s.hoveredNodeId)

  // Get theme settings
  const theme = useMemo(() => {
    return THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0]
  }, [themeId])

  // Create node position map for quick lookup
  const nodePositions = useMemo(() => {
    const map = new Map<string, THREE.Vector3>()
    nodes.forEach((node) => {
      map.set(node.id, new THREE.Vector3(node.x, node.y, node.z))
    })
    return map
  }, [nodes])

  // Determine if we should use instanced lines for performance
  const useInstanced = links.length > NODE_THRESHOLDS.LOD_MEDIUM

  // For large graphs, use a single line segments geometry
  if (useInstanced) {
    return (
      <InstancedEdges
        links={links}
        nodePositions={nodePositions}
        baseColor={theme.edge.baseColor}
        selectedNodeIds={selectedNodeIds}
        hoveredNodeId={hoveredNodeId}
      />
    )
  }

  // For smaller graphs, render individual lines with full styling
  return (
    <group>
      {links.map((link) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id
        const targetId = typeof link.target === 'string' ? link.target : link.target.id
        const sourcePos = nodePositions.get(sourceId)
        const targetPos = nodePositions.get(targetId)

        if (!sourcePos || !targetPos) return null

        const isConnectedToSelected =
          selectedNodeIds.includes(sourceId) || selectedNodeIds.includes(targetId)
        const isConnectedToHovered = hoveredNodeId === sourceId || hoveredNodeId === targetId

        return (
          <IndividualEdge
            key={link.id}
            link={link}
            sourcePos={sourcePos}
            targetPos={targetPos}
            isHighlighted={isConnectedToSelected || isConnectedToHovered}
            baseOpacity={theme.edge.baseOpacity}
            highlightOpacity={theme.edge.highlightOpacity}
            onClick={onEdgeClick}
            onHover={onEdgeHover}
          />
        )
      })}
    </group>
  )
}

// Instanced edges for large graphs (performance optimized)
interface InstancedEdgesProps {
  links: SimLink[]
  nodePositions: Map<string, THREE.Vector3>
  baseColor: string
  selectedNodeIds: string[]
  hoveredNodeId: string | null
}

function InstancedEdges({
  links,
  nodePositions,
  baseColor,
  selectedNodeIds,
  hoveredNodeId,
}: InstancedEdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null)

  // Create positions and colors arrays
  const { positions, colors } = useMemo(() => {
    const posArray = new Float32Array(links.length * 6) // 2 points per line, 3 coords each
    const colArray = new Float32Array(links.length * 6) // 2 colors per line, 3 components each

    const baseCol = new THREE.Color(baseColor)
    const highlightCol = new THREE.Color('#ffffff')

    links.forEach((link, i) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      const sourcePos = nodePositions.get(sourceId)
      const targetPos = nodePositions.get(targetId)

      if (sourcePos && targetPos) {
        // Positions
        posArray[i * 6] = sourcePos.x
        posArray[i * 6 + 1] = sourcePos.y
        posArray[i * 6 + 2] = sourcePos.z
        posArray[i * 6 + 3] = targetPos.x
        posArray[i * 6 + 4] = targetPos.y
        posArray[i * 6 + 5] = targetPos.z

        // Colors (highlight if connected to selected/hovered)
        const isHighlighted =
          selectedNodeIds.includes(sourceId) ||
          selectedNodeIds.includes(targetId) ||
          hoveredNodeId === sourceId ||
          hoveredNodeId === targetId

        const col = isHighlighted ? highlightCol : baseCol

        // Source color
        colArray[i * 6] = col.r
        colArray[i * 6 + 1] = col.g
        colArray[i * 6 + 2] = col.b
        // Target color
        colArray[i * 6 + 3] = col.r
        colArray[i * 6 + 4] = col.g
        colArray[i * 6 + 5] = col.b
      }
    })

    return { positions: posArray, colors: colArray }
  }, [links, nodePositions, baseColor, selectedNodeIds, hoveredNodeId])

  // Update geometry when positions change
  useEffect(() => {
    if (!lineRef.current) return

    const geometry = lineRef.current.geometry
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  }, [positions, colors])

  return (
    <lineSegments ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={links.length * 2}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={links.length * 2}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.6} />
    </lineSegments>
  )
}

// Individual edge for small graphs (with full styling)
interface IndividualEdgeProps {
  link: SimLink
  sourcePos: THREE.Vector3
  targetPos: THREE.Vector3
  isHighlighted: boolean
  baseOpacity: number
  highlightOpacity: number
  onClick?: (edgeId: string) => void
  onHover?: (edgeId: string | null) => void
}

function IndividualEdge({
  link,
  sourcePos,
  targetPos,
  isHighlighted,
  baseOpacity,
  highlightOpacity,
  onClick,
  onHover,
}: IndividualEdgeProps) {
  // Calculate line width based on strength - thicker lines
  const lineWidth = useMemo(() => {
    return 1.0 + link.strength * 3
  }, [link.strength])

  // Calculate opacity - more visible
  const opacity = isHighlighted ? highlightOpacity : Math.max(0.4, baseOpacity * link.strength)

  // Line points
  const points = useMemo(() => {
    return [sourcePos, targetPos]
  }, [sourcePos, targetPos])

  // Get edge color based on type
  const edgeColor = useMemo(() => {
    return EDGE_COLORS[link.type] || '#3B82F6'
  }, [link.type])

  return (
    <Line
      points={points}
      color={isHighlighted ? '#ffffff' : edgeColor}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  )
}

// Animated edge for special effects (e.g., data flow visualization)
interface AnimatedEdgeProps {
  sourcePos: THREE.Vector3
  targetPos: THREE.Vector3
  color: string
  speed?: number
}

export function AnimatedEdge({ sourcePos, targetPos, color, speed = 1 }: AnimatedEdgeProps) {
  const lineRef = useRef<THREE.Line>(null)
  const dashOffset = useRef(0)

  useFrame((_, delta) => {
    if (!lineRef.current) return
    dashOffset.current -= delta * speed
    const material = lineRef.current.material as THREE.LineDashedMaterial
    if (material.dashOffset !== undefined) {
      material.dashOffset = dashOffset.current
    }
  })

  const points = useMemo(() => {
    const curve = new THREE.LineCurve3(sourcePos, targetPos)
    return curve.getPoints(50)
  }, [sourcePos, targetPos])

  return (
    <line ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineDashedMaterial color={color} dashSize={0.5} gapSize={0.2} transparent opacity={0.8} />
    </line>
  )
}

export default EdgeLine
