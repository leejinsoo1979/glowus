'use client'

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge } from '@/lib/neural-map/types'
import {
  Folder,
  FileCode,
  FileText,
  File,
  Settings,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
} from 'lucide-react'

interface TreeNode {
  id: string
  node: NeuralNode
  children: TreeNode[]
  depth: number
  x: number
  y: number
  width: number
  height: number
}

interface TreeFlowChartProps {
  className?: string
}

// Node dimensions
const NODE_WIDTH = 160
const NODE_HEIGHT = 40
const HORIZONTAL_GAP = 40
const VERTICAL_GAP = 60

// Get icon for node type
function getNodeIcon(node: NeuralNode) {
  const type = node.type as string
  const title = node.title?.toLowerCase() || ''

  if (type === 'folder') return Folder
  if (type === 'code' || title.endsWith('.tsx') || title.endsWith('.ts') || title.endsWith('.jsx') || title.endsWith('.js')) return FileCode
  if (type === 'config' || title.endsWith('.json') || title.endsWith('.yaml') || title.endsWith('.yml')) return Settings
  if (type === 'doc' || title.endsWith('.md')) return FileText
  return File
}

// Get color for node type
function getNodeColor(node: NeuralNode, isDark: boolean) {
  const type = node.type as string
  const title = node.title?.toLowerCase() || ''

  if (type === 'self') {
    return isDark
      ? { bg: '#1e40af', border: '#3b82f6', text: '#ffffff' }
      : { bg: '#3b82f6', border: '#1d4ed8', text: '#ffffff' }
  }
  if (type === 'folder') {
    return isDark
      ? { bg: '#065f46', border: '#10b981', text: '#ffffff' }
      : { bg: '#10b981', border: '#059669', text: '#ffffff' }
  }
  if (type === 'code' || title.endsWith('.tsx') || title.endsWith('.ts')) {
    return isDark
      ? { bg: '#1e3a5f', border: '#38bdf8', text: '#ffffff' }
      : { bg: '#e0f2fe', border: '#38bdf8', text: '#0c4a6e' }
  }
  if (type === 'config') {
    return isDark
      ? { bg: '#4a4a00', border: '#facc15', text: '#ffffff' }
      : { bg: '#fef9c3', border: '#facc15', text: '#713f12' }
  }
  if (type === 'doc') {
    return isDark
      ? { bg: '#4a1d6e', border: '#a855f7', text: '#ffffff' }
      : { bg: '#f3e8ff', border: '#a855f7', text: '#581c87' }
  }
  return isDark
    ? { bg: '#27272a', border: '#52525b', text: '#ffffff' }
    : { bg: '#f4f4f5', border: '#a1a1aa', text: '#18181b' }
}

// Build tree structure from nodes and edges
function buildTree(nodes: NeuralNode[], edges: NeuralEdge[]): TreeNode | null {
  if (nodes.length === 0) return null

  // Find root node (self or first node without parent)
  const selfNode = nodes.find(n => n.type === 'self')
  const rootNode = selfNode || nodes[0]

  // Build parent-child map from edges
  const childrenMap = new Map<string, string[]>()
  edges.forEach(edge => {
    if (edge.type === 'parent_child') {
      const children = childrenMap.get(edge.source) || []
      children.push(edge.target)
      childrenMap.set(edge.source, children)
    }
  })

  // Recursively build tree
  function buildNode(nodeId: string, depth: number): TreeNode | null {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return null

    const childIds = childrenMap.get(nodeId) || []
    const children = childIds
      .map(id => buildNode(id, depth + 1))
      .filter((n): n is TreeNode => n !== null)

    return {
      id: nodeId,
      node,
      children,
      depth,
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    }
  }

  return buildNode(rootNode.id, 0)
}

// Calculate positions for tree layout
function calculateLayout(root: TreeNode): { width: number; height: number } {
  let minX = Infinity
  let maxX = 0
  let maxHeight = 0

  // First pass: calculate widths
  function calculateWidths(node: TreeNode): number {
    if (node.children.length === 0) {
      return NODE_WIDTH
    }

    const childrenWidth = node.children.reduce((sum, child, i) => {
      return sum + calculateWidths(child) + (i > 0 ? HORIZONTAL_GAP : 0)
    }, 0)

    return Math.max(NODE_WIDTH, childrenWidth)
  }

  // Second pass: position nodes
  function positionNodes(node: TreeNode, x: number, y: number, availableWidth: number): void {
    node.y = y
    node.x = x + (availableWidth - NODE_WIDTH) / 2

    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x + NODE_WIDTH)
    maxHeight = Math.max(maxHeight, node.y + NODE_HEIGHT)

    if (node.children.length === 0) return

    // Calculate total children width
    const childWidths = node.children.map(child => calculateWidths(child))
    const totalChildrenWidth = childWidths.reduce((sum, w, i) => sum + w + (i > 0 ? HORIZONTAL_GAP : 0), 0)

    // Position children
    let childX = x + (availableWidth - totalChildrenWidth) / 2
    node.children.forEach((child, i) => {
      positionNodes(child, childX, y + NODE_HEIGHT + VERTICAL_GAP, childWidths[i])
      childX += childWidths[i] + HORIZONTAL_GAP
    })
  }

  const rootWidth = calculateWidths(root)
  positionNodes(root, 0, 0, rootWidth)

  // Normalize positions so minX becomes 0
  function normalizePositions(node: TreeNode): void {
    node.x -= minX
    node.children.forEach(normalizePositions)
  }
  if (minX !== Infinity && minX !== 0) {
    normalizePositions(root)
  }

  // Add generous margins to ensure nothing is clipped
  const MARGIN = 100
  return {
    width: (maxX - minX) + MARGIN * 2,
    height: maxHeight + MARGIN * 2
  }
}

// Collect import edges for rendering
function getImportEdges(edges: NeuralEdge[], nodePositions: Map<string, { x: number; y: number }>): NeuralEdge[] {
  return edges.filter(edge => edge.type === 'imports' && nodePositions.has(edge.source) && nodePositions.has(edge.target))
}

export function TreeFlowChart({ className }: TreeFlowChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const graph = useNeuralMapStore((s) => s.graph)
  const selectedNodeIds = useNeuralMapStore((s) => s.selectedNodeIds)
  const setSelectedNodes = useNeuralMapStore((s) => s.setSelectedNodes)

  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 })

  // Build tree from graph
  const { tree, dimensions, nodePositions } = useMemo(() => {
    if (!graph) return { tree: null, dimensions: { width: 0, height: 0 }, nodePositions: new Map() }

    const tree = buildTree(graph.nodes, graph.edges)
    if (!tree) return { tree: null, dimensions: { width: 0, height: 0 }, nodePositions: new Map() }

    const dimensions = calculateLayout(tree)

    // Collect all node positions for import edge rendering
    const nodePositions = new Map<string, { x: number; y: number }>()
    function collectPositions(node: TreeNode) {
      nodePositions.set(node.id, { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 })
      node.children.forEach(collectPositions)
    }
    collectPositions(tree)

    return { tree, dimensions, nodePositions }
  }, [graph])

  // Import edges
  const importEdges = useMemo(() => {
    if (!graph) return []
    return getImportEdges(graph.edges, nodePositions)
  }, [graph, nodePositions])

  // Center the tree on load
  useEffect(() => {
    if (containerRef.current && dimensions.width > 0) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight

      // Calculate scale to fit entire tree - be more aggressive with scaling
      const scaleX = containerWidth / dimensions.width
      const scaleY = containerHeight / dimensions.height
      // Use a lower max scale (0.35) to ensure everything fits with room to spare
      const scale = Math.min(scaleX, scaleY, 0.35)

      // Center the tree in the available space with offset for margin
      const MARGIN = 100 // Same as in calculateLayout
      const scaledWidth = dimensions.width * scale
      const scaledHeight = dimensions.height * scale
      // Offset by scaled margin to center the actual content
      const x = (containerWidth - scaledWidth) / 2 + (MARGIN * scale)
      const y = (containerHeight - scaledHeight) / 2 + (MARGIN * scale)

      setTransform({ x, y, scale })
    }
  }, [dimensions])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true)
      setLastMouse({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return

    const dx = e.clientX - lastMouse.x
    const dy = e.clientY - lastMouse.y

    setTransform(prev => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }))
    setLastMouse({ x: e.clientX, y: e.clientY })
  }, [isPanning, lastMouse])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(3, transform.scale * delta))

    // Zoom towards mouse position
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const scaleChange = newScale / transform.scale
      const newX = mouseX - (mouseX - transform.x) * scaleChange
      const newY = mouseY - (mouseY - transform.y) * scaleChange

      setTransform({ x: newX, y: newY, scale: newScale })
    } else {
      setTransform(prev => ({ ...prev, scale: newScale }))
    }
  }, [transform])

  // Zoom controls
  const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))
  const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale / 1.2) }))
  const resetView = () => {
    if (containerRef.current && dimensions.width > 0) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight

      const scaleX = containerWidth / dimensions.width
      const scaleY = containerHeight / dimensions.height
      const scale = Math.min(scaleX, scaleY, 0.35)

      const MARGIN = 100
      const scaledWidth = dimensions.width * scale
      const scaledHeight = dimensions.height * scale
      const x = (containerWidth - scaledWidth) / 2 + (MARGIN * scale)
      const y = (containerHeight - scaledHeight) / 2 + (MARGIN * scale)

      setTransform({ x, y, scale })
    }
  }

  // Render tree node
  const renderNode = (treeNode: TreeNode): React.ReactNode => {
    const { node, children, x, y } = treeNode
    const Icon = getNodeIcon(node)
    const colors = getNodeColor(node, isDark)
    const isSelected = selectedNodeIds.includes(node.id)

    return (
      <g key={node.id}>
        {/* Edges to children (parent_child) */}
        {children.map(child => {
          const startX = x + NODE_WIDTH / 2
          const startY = y + NODE_HEIGHT
          const endX = child.x + NODE_WIDTH / 2
          const endY = child.y
          const midY = startY + (endY - startY) / 2

          return (
            <path
              key={`edge-${node.id}-${child.id}`}
              d={`M ${startX} ${startY}
                  C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
              fill="none"
              stroke={isDark ? '#4a9eff' : '#3b82f6'}
              strokeWidth={2}
              strokeOpacity={0.6}
            />
          )
        })}

        {/* Node rectangle */}
        <g
          transform={`translate(${x}, ${y})`}
          onClick={() => setSelectedNodes([node.id])}
          style={{ cursor: 'pointer' }}
        >
          <rect
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={8}
            ry={8}
            fill={colors.bg}
            stroke={isSelected ? '#f59e0b' : colors.border}
            strokeWidth={isSelected ? 3 : 2}
            filter={isSelected ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))' : undefined}
          />

          {/* Icon */}
          <foreignObject x={10} y={(NODE_HEIGHT - 18) / 2} width={18} height={18}>
            <Icon
              size={18}
              color={colors.text}
              style={{ opacity: 0.9 }}
            />
          </foreignObject>

          {/* Text */}
          <text
            x={34}
            y={NODE_HEIGHT / 2 + 5}
            fill={colors.text}
            fontSize={12}
            fontWeight={500}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.title && node.title.length > 14
              ? node.title.substring(0, 14) + '...'
              : node.title}
          </text>

          {/* Children indicator */}
          {children.length > 0 && (
            <foreignObject x={NODE_WIDTH - 24} y={(NODE_HEIGHT - 16) / 2} width={16} height={16}>
              <ChevronDown size={16} color={colors.text} style={{ opacity: 0.6 }} />
            </foreignObject>
          )}
        </g>

        {/* Render children */}
        {children.map(child => renderNode(child))}
      </g>
    )
  }

  // Render import edges (curved lines between files)
  const renderImportEdges = () => {
    return importEdges.map(edge => {
      const source = nodePositions.get(edge.source)
      const target = nodePositions.get(edge.target)
      if (!source || !target) return null

      // Curved path for import dependencies
      const dx = target.x - source.x
      const dy = target.y - source.y
      const dr = Math.sqrt(dx * dx + dy * dy) * 0.8

      return (
        <g key={`import-${edge.id}`}>
          <path
            d={`M ${source.x} ${source.y}
                Q ${(source.x + target.x) / 2 + dr * 0.3} ${(source.y + target.y) / 2 - dr * 0.2},
                  ${target.x} ${target.y}`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeOpacity={0.5}
            strokeDasharray="4 2"
            markerEnd="url(#arrowhead)"
          />
        </g>
      )
    })
  }

  if (!graph || !tree) {
    return (
      <div className={cn(
        'flex items-center justify-center h-full',
        isDark ? 'bg-zinc-900 text-zinc-400' : 'bg-zinc-50 text-zinc-500',
        className
      )}>
        <div className="text-center">
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">트리 데이터가 없습니다</p>
          <p className="text-sm mt-1">좌측 패널에서 데모 버튼을 눌러 샘플 프로젝트를 로드하세요</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden',
        isDark ? 'bg-zinc-900' : 'bg-zinc-50',
        isPanning ? 'cursor-grabbing' : 'cursor-grab',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Zoom controls */}
      <div className={cn(
        'absolute top-4 right-4 z-10 flex flex-col gap-1 p-1 rounded-lg shadow-lg',
        isDark ? 'bg-zinc-800/90 border border-zinc-700' : 'bg-white/90 border border-zinc-200'
      )}>
        <button
          onClick={zoomIn}
          className={cn(
            'p-2 rounded transition-colors',
            isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          )}
          title="확대"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={zoomOut}
          className={cn(
            'p-2 rounded transition-colors',
            isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          )}
          title="축소"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={resetView}
          className={cn(
            'p-2 rounded transition-colors',
            isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          )}
          title="맞춤"
        >
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Legend */}
      <div className={cn(
        'absolute bottom-4 left-4 z-10 flex flex-col gap-2 p-3 rounded-lg shadow-lg text-xs',
        isDark ? 'bg-zinc-800/90 border border-zinc-700 text-zinc-300' : 'bg-white/90 border border-zinc-200 text-zinc-700'
      )}>
        <div className="font-medium mb-1">범례</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500" />
          <span>폴더 구조</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
          <span>Import 종속성</span>
        </div>
      </div>

      {/* Scale indicator */}
      <div className={cn(
        'absolute bottom-4 right-4 z-10 px-2 py-1 rounded text-xs font-mono',
        isDark ? 'bg-zinc-800/90 text-zinc-400' : 'bg-white/90 text-zinc-600'
      )}>
        {Math.round(transform.scale * 100)}%
      </div>

      {/* SVG Canvas */}
      <svg
        width="100%"
        height="100%"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Defs for arrowhead */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#f59e0b"
              fillOpacity={0.6}
            />
          </marker>
        </defs>

        {/* Import dependency edges (behind nodes) */}
        <g className="import-edges">
          {renderImportEdges()}
        </g>

        {/* Tree nodes and parent-child edges */}
        {renderNode(tree)}
      </svg>
    </div>
  )
}

