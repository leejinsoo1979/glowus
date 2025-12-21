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
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  ArrowDown,
  ArrowRight,
} from 'lucide-react'
import {
  BsFiletypePdf, BsFiletypeJsx, BsFiletypeTsx, BsFiletypeJs,
  BsFiletypeHtml, BsFiletypeCss, BsFiletypeScss, BsFiletypeJson, BsFiletypeMd,
  BsFiletypePy, BsFiletypeJava, BsFiletypeRb, BsFiletypePhp,
  BsFiletypeXml, BsFiletypeYml, BsFiletypeSql,
  BsFileEarmarkCode, BsFileEarmarkText, BsFileEarmarkImage, BsFileEarmarkPlay,
  BsFileEarmarkZip, BsFileEarmark
} from 'react-icons/bs'

// Layout direction type
type LayoutDirection = 'top-down' | 'left-right'

interface TreeNode {
  id: string
  node: NeuralNode
  children: TreeNode[]
  totalChildrenCount: number // 로컬에서 접힌 것과 상관없이 실제 자식 수
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
const NODE_WIDTH = 180
const NODE_HEIGHT = 44
const HORIZONTAL_GAP = 50
const VERTICAL_GAP = 70

// Get icon for node type
function getNodeIcon(node: NeuralNode) {
  const type = node.type
  const title = node.title?.toLowerCase() || ''

  if (type === 'folder') return Folder
  if (type === 'self') return GitBranch

  const ext = title.split('.').pop() || ''

  switch (ext) {
    case 'pdf': return BsFiletypePdf
    case 'tsx': return BsFiletypeTsx
    case 'ts': return BsFileEarmarkCode
    case 'jsx': return BsFiletypeJsx
    case 'js': return BsFiletypeJs
    case 'html': return BsFiletypeHtml
    case 'css': return BsFiletypeCss
    case 'scss': return BsFiletypeScss
    case 'json': return BsFiletypeJson
    case 'md': return BsFiletypeMd
    case 'py': return BsFiletypePy
    case 'java': return BsFiletypeJava
    case 'go': return BsFileEarmarkCode
    case 'rb': return BsFiletypeRb
    case 'php': return BsFiletypePhp
    case 'xml': return BsFiletypeXml
    case 'yaml': case 'yml': return BsFiletypeYml
    case 'sql': return BsFiletypeSql
    case 'zip': case 'rar': case '7z': return BsFileEarmarkZip
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'webp': return BsFileEarmarkImage
    case 'mp4': case 'webm': case 'mov': return BsFileEarmarkPlay
    case 'txt': return BsFileEarmarkText
    default:
      if (type === 'memory') return BsFileEarmarkImage
      if ((type as string) === 'config') return BsFiletypeJson
      if (type === 'doc') return BsFileEarmarkText
      return BsFileEarmarkCode
  }
}

// Get color for node type
function getNodeColor(node: NeuralNode, isDark: boolean) {
  const type = node.type as string
  const title = node.title?.toLowerCase() || ''

  if (type === 'self') {
    return isDark
      ? { bg: '#1e40af', border: '#3b82f6', text: '#ffffff', shadow: 'rgba(59, 130, 246, 0.4)' }
      : { bg: '#3b82f6', border: '#1d4ed8', text: '#ffffff', shadow: 'rgba(59, 130, 246, 0.3)' }
  }
  if (type === 'folder') {
    return isDark
      ? { bg: '#065f46', border: '#10b981', text: '#ffffff', shadow: 'rgba(16, 185, 129, 0.3)' }
      : { bg: '#10b981', border: '#059669', text: '#ffffff', shadow: 'rgba(16, 185, 129, 0.2)' }
  }
  if (type === 'code' || title.endsWith('.tsx') || title.endsWith('.ts')) {
    return isDark
      ? { bg: '#1e3a5f', border: '#38bdf8', text: '#ffffff', shadow: 'rgba(56, 189, 248, 0.3)' }
      : { bg: '#e0f2fe', border: '#38bdf8', text: '#0c4a6e', shadow: 'rgba(56, 189, 248, 0.2)' }
  }
  if (type === 'config') {
    return isDark
      ? { bg: '#4a4a00', border: '#facc15', text: '#ffffff', shadow: 'rgba(250, 204, 21, 0.3)' }
      : { bg: '#fef9c3', border: '#facc15', text: '#713f12', shadow: 'rgba(250, 204, 21, 0.2)' }
  }
  if (type === 'doc') {
    return isDark
      ? { bg: '#4a1d6e', border: '#a855f7', text: '#ffffff', shadow: 'rgba(168, 85, 247, 0.3)' }
      : { bg: '#f3e8ff', border: '#a855f7', text: '#581c87', shadow: 'rgba(168, 85, 247, 0.2)' }
  }
  return isDark
    ? { bg: '#27272a', border: '#52525b', text: '#ffffff', shadow: 'rgba(82, 82, 91, 0.3)' }
    : { bg: '#f4f4f5', border: '#a1a1aa', text: '#18181b', shadow: 'rgba(161, 161, 170, 0.2)' }
}

// Build tree structure from nodes and edges
function buildTree(nodes: NeuralNode[], edges: NeuralEdge[]): TreeNode | null {
  if (nodes.length === 0) return null

  const selfNode = nodes.find(n => n.type === 'self')
  const rootNode = selfNode || nodes[0]

  const childrenMap = new Map<string, string[]>()
  edges.forEach(edge => {
    // parent_child 또는 contains 타입 엣지 모두 처리
    if (edge.type === 'parent_child' || (edge.type as string) === 'contains') {
      const children = childrenMap.get(edge.source) || []
      children.push(edge.target)
      childrenMap.set(edge.source, children)
    }
  })

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
      totalChildrenCount: children.length,
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
function calculateLayout(root: TreeNode, direction: LayoutDirection): { width: number; height: number } {
  let minX = Infinity
  let maxX = 0
  let maxY = 0

  function calculateWidths(node: TreeNode): number {
    if (node.children.length === 0) {
      return direction === 'top-down' ? NODE_WIDTH : NODE_HEIGHT
    }

    const childrenSize = node.children.reduce((sum, child, i) => {
      return sum + calculateWidths(child) + (i > 0 ? (direction === 'top-down' ? HORIZONTAL_GAP : VERTICAL_GAP) : 0)
    }, 0)

    return Math.max(direction === 'top-down' ? NODE_WIDTH : NODE_HEIGHT, childrenSize)
  }

  function positionNodes(node: TreeNode, x: number, y: number, availableSize: number): void {
    if (direction === 'top-down') {
      node.y = y
      node.x = x + (availableSize - NODE_WIDTH) / 2
    } else {
      node.x = x
      node.y = y + (availableSize - NODE_HEIGHT) / 2
    }

    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x + NODE_WIDTH)
    maxY = Math.max(maxY, node.y + NODE_HEIGHT)

    if (node.children.length === 0) return

    const childSizes = node.children.map(child => calculateWidths(child))
    const gap = direction === 'top-down' ? HORIZONTAL_GAP : VERTICAL_GAP
    const totalChildrenSize = childSizes.reduce((sum, s, i) => sum + s + (i > 0 ? gap : 0), 0)

    if (direction === 'top-down') {
      let childX = x + (availableSize - totalChildrenSize) / 2
      node.children.forEach((child, i) => {
        positionNodes(child, childX, y + NODE_HEIGHT + VERTICAL_GAP, childSizes[i])
        childX += childSizes[i] + HORIZONTAL_GAP
      })
    } else {
      let childY = y + (availableSize - totalChildrenSize) / 2
      node.children.forEach((child, i) => {
        positionNodes(child, x + NODE_WIDTH + HORIZONTAL_GAP, childY, childSizes[i])
        childY += childSizes[i] + VERTICAL_GAP
      })
    }
  }

  const rootSize = calculateWidths(root)
  positionNodes(root, 0, 0, rootSize)

  // Normalize positions
  function normalizePositions(node: TreeNode): void {
    node.x -= minX
    node.children.forEach(normalizePositions)
  }
  if (minX !== Infinity && minX !== 0) {
    normalizePositions(root)
  }

  return {
    width: maxX - minX,
    height: maxY
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
  const files = useNeuralMapStore((s) => s.files)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 })
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('top-down')
  // Collapsed state
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((nodeId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // Build tree from graph
  const { tree, dimensions, nodePositions } = useMemo(() => {
    if (!graph) return { tree: null, dimensions: { width: 0, height: 0 }, nodePositions: new Map() }

    // 1. Build full tree
    const fullTree = buildTree(graph.nodes, graph.edges)
    if (!fullTree) return { tree: null, dimensions: { width: 0, height: 0 }, nodePositions: new Map() }

    // 2. Prune tree based on collapsed state
    function pruneTree(node: TreeNode): TreeNode {
      // If this node is collapsed, return it with empty children
      if (collapsedIds.has(node.id)) {
        return { ...node, children: [] }
      }
      // Otherwise, prune children recursively
      return {
        ...node,
        children: node.children
          .map(child => pruneTree(child))
      }
    }

    const prunedTree = pruneTree(fullTree)

    // 3. Calculate layout on pruned tree
    const dimensions = calculateLayout(prunedTree, layoutDirection)

    const nodePositions = new Map<string, { x: number; y: number }>()
    function collectPositions(node: TreeNode) {
      nodePositions.set(node.id, { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT / 2 })
      node.children.forEach(collectPositions)
    }
    collectPositions(prunedTree)

    return { tree: prunedTree, dimensions, nodePositions }
  }, [graph, layoutDirection, collapsedIds])

  // Import edges
  const importEdges = useMemo(() => {
    if (!graph) return []
    return getImportEdges(graph.edges, nodePositions)
  }, [graph, nodePositions])

  // Container size tracking
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight
      })
    }

    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Center tree on layout change
  useEffect(() => {
    if (containerSize.width === 0 || dimensions.width === 0) return

    const PADDING = 100
    const availableWidth = containerSize.width - PADDING * 2
    const availableHeight = containerSize.height - PADDING * 2

    const scaleX = availableWidth / dimensions.width
    const scaleY = availableHeight / dimensions.height
    const scale = Math.min(scaleX, scaleY, 0.8)

    const scaledWidth = dimensions.width * scale
    const scaledHeight = dimensions.height * scale
    const x = (containerSize.width - scaledWidth) / 2
    const y = (containerSize.height - scaledHeight) / 2

    setTransform({ x, y, scale })
  }, [containerSize, dimensions, layoutDirection])

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

  // Zoom with wheel
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1

      setTransform(prev => {
        const newScale = Math.max(0.1, Math.min(3, prev.scale * delta))
        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        const scaleChange = newScale / prev.scale
        const newX = mouseX - (mouseX - prev.x) * scaleChange
        const newY = mouseY - (mouseY - prev.y) * scaleChange

        return { x: newX, y: newY, scale: newScale }
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // Zoom controls
  const zoomIn = () => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))
  const zoomOut = () => setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale / 1.2) }))
  const resetView = () => {
    if (containerSize.width === 0 || dimensions.width === 0) return

    const PADDING = 100
    const availableWidth = containerSize.width - PADDING * 2
    const availableHeight = containerSize.height - PADDING * 2

    const scaleX = availableWidth / dimensions.width
    const scaleY = availableHeight / dimensions.height
    const scale = Math.min(scaleX, scaleY, 0.8)

    const scaledWidth = dimensions.width * scale
    const scaledHeight = dimensions.height * scale
    const x = (containerSize.width - scaledWidth) / 2
    const y = (containerSize.height - scaledHeight) / 2

    setTransform({ x, y, scale })
  }

  // Render orthogonal edge (elbow connector)
  const renderEdge = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    key: string,
    color: string = isDark ? '#4a9eff' : '#3b82f6'
  ) => {
    if (layoutDirection === 'top-down') {
      // Vertical elbow: down, then horizontal, then down
      const midY = startY + (endY - startY) / 2
      return (
        <path
          key={key}
          d={`M ${startX} ${startY}
              L ${startX} ${midY}
              L ${endX} ${midY}
              L ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    } else {
      // Horizontal elbow: right, then vertical, then right
      const midX = startX + (endX - startX) / 2
      return (
        <path
          key={key}
          d={`M ${startX} ${startY}
              L ${midX} ${startY}
              L ${midX} ${endY}
              L ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }
  }

  // Render tree node
  const renderNode = (treeNode: TreeNode): React.ReactNode => {
    const { node, children, x, y } = treeNode
    const Icon = getNodeIcon(node)
    const colors = getNodeColor(node, isDark)
    const isSelected = selectedNodeIds.includes(node.id)
    const isRoot = node.type === 'self'

    // Edge connection points
    const getEdgePoints = (parentNode: TreeNode, childNode: TreeNode) => {
      if (layoutDirection === 'top-down') {
        return {
          startX: parentNode.x + NODE_WIDTH / 2,
          startY: parentNode.y + NODE_HEIGHT,
          endX: childNode.x + NODE_WIDTH / 2,
          endY: childNode.y
        }
      } else {
        return {
          startX: parentNode.x + NODE_WIDTH,
          startY: parentNode.y + NODE_HEIGHT / 2,
          endX: childNode.x,
          endY: childNode.y + NODE_HEIGHT / 2
        }
      }
    }

    return (
      <g key={node.id}>
        {/* Edges to children */}
        {children.map(child => {
          const { startX, startY, endX, endY } = getEdgePoints(treeNode, child)
          return renderEdge(startX, startY, endX, endY, `edge-${node.id}-${child.id}`)
        })}

        {/* Node container */}
        <g
          transform={`translate(${x}, ${y})`}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedNodes([node.id])

            // 파일이면 코드 프리뷰 열기
            if (node.type !== 'folder' && node.type !== 'self') {
              let fileId = node.id
              // node- 접두사 제거 시도
              if (fileId.startsWith('node-')) fileId = fileId.replace('node-', '')

              const file = files.find(f => f.id === fileId)
              if (file) {
                openCodePreview(file)
              }
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* Shadow */}
          <rect
            x={3}
            y={3}
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={isRoot ? 12 : 8}
            ry={isRoot ? 12 : 8}
            fill={colors.shadow}
            opacity={0.5}
          />

          {/* Main rect */}
          <rect
            width={NODE_WIDTH}
            height={NODE_HEIGHT}
            rx={isRoot ? 12 : 8}
            ry={isRoot ? 12 : 8}
            fill={colors.bg}
            stroke={isSelected ? '#f59e0b' : colors.border}
            strokeWidth={isSelected ? 3 : 2}
          />

          {/* Highlight line at top */}
          <rect
            x={1}
            y={1}
            width={NODE_WIDTH - 2}
            height={3}
            rx={isRoot ? 11 : 7}
            fill={colors.border}
            opacity={0.6}
          />

          {/* Icon */}
          <foreignObject x={12} y={(NODE_HEIGHT - 20) / 2} width={20} height={20}>
            <Icon
              size={20}
              color={colors.text}
              style={{ opacity: 0.9 }}
            />
          </foreignObject>

          {/* Text */}
          <text
            x={40}
            y={NODE_HEIGHT / 2 + 5}
            fill={colors.text}
            fontSize={13}
            fontWeight={isRoot ? 600 : 500}
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {node.title && node.title.length > 16
              ? node.title.substring(0, 16) + '...'
              : node.title}
          </text>

          {/* Children count badge or toggle button */}
          {treeNode.totalChildrenCount > 0 && (
            <g
              transform={`translate(${NODE_WIDTH - 28}, ${(NODE_HEIGHT - 20) / 2})`}
              onClick={(e) => toggleCollapse(node.id, e)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={20}
                height={20}
                rx={4}
                fill={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                className="hover:fill-blue-500/20 transition-colors"
              />
              <text
                x={10}
                y={14}
                fill={colors.text}
                fontSize={12}
                fontWeight={600}
                textAnchor="middle"
              >
                {collapsedIds.has(node.id) ? '+' : '-'}
              </text>
            </g>
          )}
        </g>

        {/* Render children */}
        {children.map(child => renderNode(child))}
      </g>
    )
  }

  // Render import edges
  const renderImportEdges = () => {
    return importEdges.map(edge => {
      const source = nodePositions.get(edge.source)
      const target = nodePositions.get(edge.target)
      if (!source || !target) return null

      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      return (
        <g key={`import-${edge.id}`}>
          <path
            d={`M ${source.x} ${source.y}
                Q ${source.x + dx * 0.5 + dy * 0.2} ${source.y + dy * 0.5 - dx * 0.2},
                  ${target.x} ${target.y}`}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            strokeDasharray="6 3"
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
          <p className="text-sm mt-1">좌측 패널에서 파일을 업로드하고 시각화 버튼을 눌러주세요</p>
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
    >
      {/* Layout toggle */}
      <div className={cn(
        'absolute top-4 left-4 z-10 flex gap-1 p-1 rounded-lg shadow-lg',
        isDark ? 'bg-zinc-800/90 border border-zinc-700' : 'bg-white/90 border border-zinc-200'
      )}>
        <button
          onClick={() => setLayoutDirection('top-down')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors',
            layoutDirection === 'top-down'
              ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              : isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          )}
          title="탑다운 레이아웃"
        >
          <ArrowDown size={16} />
          <span>탑다운</span>
        </button>
        <button
          onClick={() => setLayoutDirection('left-right')}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors',
            layoutDirection === 'left-right'
              ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
              : isDark ? 'hover:bg-zinc-700 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
          )}
          title="마인드맵 레이아웃"
        >
          <ArrowRight size={16} />
          <span>마인드맵</span>
        </button>
      </div>

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
          <div className="w-6 h-0.5 bg-blue-500 rounded" />
          <span>폴더 구조</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-amber-500 rounded" style={{ borderStyle: 'dashed' }} />
          <span>Import 관계</span>
        </div>
      </div>

      {/* Stats */}
      <div className={cn(
        'absolute bottom-4 right-4 z-10 px-3 py-2 rounded-lg text-xs font-mono',
        isDark ? 'bg-zinc-800/90 border border-zinc-700 text-zinc-400' : 'bg-white/90 border border-zinc-200 text-zinc-600'
      )}>
        <div>{graph.nodes.length} nodes</div>
        <div>{Math.round(transform.scale * 100)}%</div>
      </div>

      {/* SVG Canvas */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible' }}
      >
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
              fillOpacity={0.7}
            />
          </marker>

          {/* Gradient for edges */}
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isDark ? '#4a9eff' : '#3b82f6'} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isDark ? '#4a9eff' : '#3b82f6'} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Import edges (behind) */}
          <g className="import-edges">
            {renderImportEdges()}
          </g>

          {/* Tree structure */}
          {renderNode(tree)}
        </g>
      </svg>
    </div>
  )
}
