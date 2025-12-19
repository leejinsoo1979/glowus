// @ts-nocheck
'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { LABEL_POLICY, LOD_DISTANCES, THEME_PRESETS } from '@/lib/neural-map/constants'
import type { SimNode } from '@/lib/neural-map/simulation'

interface LabelSystemProps {
  nodes: SimNode[]
}

interface LabelData {
  id: string
  text: string
  position: THREE.Vector3
  importance: number
  isSelected: boolean
  isHovered: boolean
  distance: number
}

export function LabelSystem({ nodes }: LabelSystemProps) {
  const { camera } = useThree()
  const labelsRef = useRef<LabelData[]>([])

  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const hoveredNodeId = useNeuralMapStore((s) => s.hoveredNodeId)
  const themeId = useNeuralMapStore((s) => s.themeId)
  const graph = useNeuralMapStore((s) => s.graph)

  // Get theme
  const theme = useMemo(() => {
    return THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0]
  }, [themeId])

  // Get node titles from graph
  const nodeTitles = useMemo(() => {
    const titles = new Map<string, string>()
    graph?.nodes.forEach((node) => {
      titles.set(node.id, node.title)
    })
    return titles
  }, [graph?.nodes])

  // Calculate visible labels based on LOD policy
  const visibleLabels = useMemo(() => {
    const cameraPosition = camera.position.clone()
    const nodeCount = nodes.length

    // Determine max labels based on node count
    let maxLabels = LABEL_POLICY.maxVisible
    if (nodeCount > 3000) {
      maxLabels = Math.min(20, LABEL_POLICY.maxVisible)
    } else if (nodeCount > 1000) {
      maxLabels = Math.min(50, LABEL_POLICY.maxVisible)
    }

    // Calculate label data with distances
    const labelData: LabelData[] = nodes.map((node) => {
      const position = new THREE.Vector3(node.x, node.y, node.z)
      const distance = cameraPosition.distanceTo(position)
      const isSelected = selectedNodeIds.includes(node.id)
      const isHovered = hoveredNodeId === node.id

      return {
        id: node.id,
        text: nodeTitles.get(node.id) || node.id,
        position,
        importance: node.importance,
        isSelected,
        isHovered,
        distance,
      }
    })

    // Filter by distance threshold
    const inRange = labelData.filter((label) => {
      // Always show selected/hovered labels
      if (label.isSelected || label.isHovered) return true
      // Filter by distance
      return label.distance < LOD_DISTANCES.far
    })

    // Sort by priority: selected > hovered > importance > distance
    inRange.sort((a, b) => {
      // Selected nodes first
      if (a.isSelected && !b.isSelected) return -1
      if (!a.isSelected && b.isSelected) return 1

      // Hovered nodes second
      if (a.isHovered && !b.isHovered) return -1
      if (!a.isHovered && b.isHovered) return 1

      // Then by importance (higher first)
      if (a.importance !== b.importance) {
        return b.importance - a.importance
      }

      // Finally by distance (closer first)
      return a.distance - b.distance
    })

    // Take only the max visible labels
    return inRange.slice(0, maxLabels)
  }, [nodes, camera.position, selectedNodeIds, hoveredNodeId, nodeTitles])

  // Store for frame updates
  labelsRef.current = visibleLabels

  return (
    <group>
      {visibleLabels.map((label) => (
        <NodeLabel
          key={label.id}
          label={label}
          fontColor={theme.ui.textColor}
          fontSize={LABEL_POLICY.fontSize}
        />
      ))}
    </group>
  )
}

interface NodeLabelProps {
  label: LabelData
  fontColor: string
  fontSize: number
}

function NodeLabel({ label, fontColor, fontSize }: NodeLabelProps) {
  const textRef = useRef<THREE.Object3D>(null)

  // Calculate font size based on importance and selection
  const adjustedFontSize = useMemo(() => {
    let size = fontSize
    if (label.isSelected) size *= 1.3
    else if (label.isHovered) size *= 1.2
    else size *= 0.8 + (label.importance / 100) * 0.4
    return size
  }, [fontSize, label.isSelected, label.isHovered, label.importance])

  // Calculate opacity based on distance
  const opacity = useMemo(() => {
    if (label.isSelected || label.isHovered) return 1
    // Fade based on distance
    const fadeStart = LOD_DISTANCES.near
    const fadeEnd = LOD_DISTANCES.far
    if (label.distance < fadeStart) return 1
    if (label.distance > fadeEnd) return 0
    return 1 - (label.distance - fadeStart) / (fadeEnd - fadeStart)
  }, [label.distance, label.isSelected, label.isHovered])

  // Calculate color
  const color = useMemo(() => {
    if (label.isSelected) return '#ffffff'
    if (label.isHovered) return '#f0f0f0'
    return fontColor
  }, [fontColor, label.isSelected, label.isHovered])

  // Truncate long labels
  const displayText = useMemo(() => {
    const maxLength = LABEL_POLICY.maxLength
    if (label.text.length <= maxLength) return label.text
    return label.text.substring(0, maxLength - 2) + '...'
  }, [label.text])

  // Position offset (slightly above node)
  const offsetPosition = useMemo(() => {
    return [
      label.position.x,
      label.position.y + 3 + (label.isSelected ? 0.5 : 0),
      label.position.z,
    ] as [number, number, number]
  }, [label.position, label.isSelected])

  return (
    <Billboard position={offsetPosition} follow lockX={false} lockY={false} lockZ={false}>
      <Text
        ref={textRef}
        fontSize={adjustedFontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
        fillOpacity={opacity}
        outlineOpacity={opacity * 0.8}
      >
        {displayText}
      </Text>
    </Billboard>
  )
}

// Debug component to show label count
export function LabelDebug({ nodes }: { nodes: SimNode[] }) {
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)

  return (
    <group position={[0, 50, 0]}>
      <Billboard>
        <Text fontSize={2} color="#ffffff" anchorX="center" anchorY="middle">
          {`Nodes: ${nodes.length} | Selected: ${selectedNodeIds.length}`}
        </Text>
      </Billboard>
    </group>
  )
}

export default LabelSystem
