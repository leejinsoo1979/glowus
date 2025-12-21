'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    ConnectionMode,
    Panel,
    Position,
    ReactFlowProvider,
    useReactFlow,
    OnSelectionChangeParams,
} from 'reactflow'
import dagre from 'dagre'
import 'reactflow/dist/style.css'
import { useTheme } from 'next-themes'
import { ArrowDown, ArrowRight, FolderPlus } from 'lucide-react'

import LogicNode, { LogicNodeData } from './LogicNode'
import LogicGroupNode from './LogicGroupNode' // New Import
import { SelectionToolbar } from './SelectionToolbar'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge } from '@/lib/neural-map/types'
import { cn } from '@/lib/utils'

// Node Types Registration
const nodeTypes = {
    logic: LogicNode,
    group: LogicGroupNode, // New Type
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 44
const GROUP_PADDING = 20

const getLayoutedElements = (
    nodes: Node[],
    edges: Edge[],
    direction: 'TB' | 'LR' = 'TB'
) => {
    const dagreGraph = new dagre.graphlib.Graph({ compound: true })
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const isHorizontal = direction === 'LR'
    dagreGraph.setGraph({ rankdir: direction })

    nodes.forEach((node) => {
        if (node.type === 'group') {
            // Respect existing style dimensions if available (prevent shrinking on re-layout)
            const w = node.style?.width ? parseFloat(node.style.width.toString()) : 200
            const h = node.style?.height ? parseFloat(node.style.height.toString()) : 100

            dagreGraph.setNode(node.id, {
                width: w,
                height: h
            })
        } else {
            dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
        }

        // Parent/Child relationship
        if (node.parentNode) {
            dagreGraph.setParent(node.id, node.parentNode)
        }
    })

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target)
    })

    dagre.layout(dagreGraph)

    // Position Map for absolute positions
    const posMap = new Map<string, { x: number, y: number }>()

    nodes.forEach(node => {
        const nodeWithPosition = dagreGraph.node(node.id)
        posMap.set(node.id, { x: nodeWithPosition.x, y: nodeWithPosition.y })
    })

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id)

        node.targetPosition = isHorizontal ? Position.Left : Position.Top
        node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom

        if (node.parentNode) {
            // React Flow expects relative position for children
            // Child Absolute - Parent Absolute + Parent Padding offset (optional)
            // But actually Dagre gives center coordinates. 
            // React Flow positions are Top-Left logic for the handle? No, typically Top-Left of the node box.

            const parentPos = posMap.get(node.parentNode)
            if (parentPos) {
                // Dagre standard output is center. We need top-left.
                // Wait, dagre-d3 uses top-left? No, dagre core uses center usually.
                // Actually dagre layout(): "The x and y coordinates of the center of the node."

                // We need top-left for React Flow
                const x = nodeWithPosition.x - (node.width ?? NODE_WIDTH) / 2
                const y = nodeWithPosition.y - (node.height ?? NODE_HEIGHT) / 2

                const parentNodeInfo = dagreGraph.node(node.parentNode)
                const parentX = parentNodeInfo.x - parentNodeInfo.width / 2
                const parentY = parentNodeInfo.y - parentNodeInfo.height / 2

                node.position = {
                    x: x - parentX,
                    y: y - parentY
                }
            }
        } else {
            // Root level nodes
            node.position = {
                x: nodeWithPosition.x - (node.width ?? NODE_WIDTH) / 2,
                y: nodeWithPosition.y - (node.height ?? NODE_HEIGHT) / 2,
            }
        }

        return node
    })

    return { nodes: layoutedNodes, edges }
}

function LogicFlowContent({ className }: { className?: string }) {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'
    const reactFlowInstance = useReactFlow()

    const {
        graph,
        setSelectedNodes: setGlobalSelectedNodes,
        openCodePreview,
        files
    } = useNeuralMapStore()

    const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB')
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

    // Selection State (Local for toolbar)
    const [localSelectedNodes, setLocalSelectedNodes] = useState<Node[]>([])

    // Initial Data Transformation
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        if (!graph || graph.nodes.length === 0) return { nodes: [], edges: [] }

        // 1. Convert Neural Nodes to RF Nodes
        const rfNodes: Node<LogicNodeData>[] = graph.nodes.map(n => ({
            id: n.id,
            type: 'logic',
            data: {
                label: n.title || 'Untitled',
                type: n.type || 'file',
                isExpanded: !collapsedIds.has(n.id),
                hasChildren: false, // Will calculate below
                onToggle: (id) => toggleCollapse(id),
            },
            position: { x: 0, y: 0 },
            width: NODE_WIDTH, // Explicit width for correct calculation
            height: NODE_HEIGHT,
        }))

        // 2. Convert Edges
        const rfEdges: Edge[] = graph.edges
            .filter(e => e.type === 'parent_child' || (e.type as string) === 'contains')
            .map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: 'smoothstep',
                animated: false,
                style: { stroke: isDark ? '#52525b' : '#a1a1aa' },
            }))

        // 3. Identify children & handle collapsing
        const childrenMap = new Map<string, string[]>()
        rfEdges.forEach(e => {
            const children = childrenMap.get(e.source) || []
            children.push(e.target)
            childrenMap.set(e.source, children)
        })

        rfNodes.forEach(n => {
            const children = childrenMap.get(n.id) || []
            n.data.hasChildren = children.length > 0
        })

        // Filter hidden nodes (Pruning)
        const visibleNodeIds = new Set<string>()
        if (graph.nodes.find(n => n.type === 'self')) {
            const rootId = graph.nodes.find(n => n.type === 'self')!.id

            function visit(nodeId: string, isVisible: boolean) {
                if (isVisible) visibleNodeIds.add(nodeId)
                const isCollapsed = collapsedIds.has(nodeId)
                const children = childrenMap.get(nodeId) || []
                children.forEach(childId => visit(childId, isVisible && !isCollapsed))
            }
            visit(rootId, true)
        }

        const visibleNodes = rfNodes.filter(n => visibleNodeIds.has(n.id))
        const visibleEdges = rfEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))

        // 4. Run Layout
        return getLayoutedElements(visibleNodes, visibleEdges, layoutDirection)

    }, [graph, layoutDirection, collapsedIds, isDark])

    // React Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])

    useEffect(() => {
        setNodes(initialNodes)
        setEdges(initialEdges)
    }, [initialNodes, initialEdges, setNodes, setEdges])

    // Handlers
    const toggleCollapse = useCallback((id: string) => {
        setCollapsedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds)),
        [setEdges]
    )

    const onSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
        setLocalSelectedNodes(nodes)

        // 1. Sync with Global Store
        const selectedIds = nodes.map(n => n.id)
        setGlobalSelectedNodes(selectedIds)

        // 2. Trigger Preview for Single File Selection
        if (nodes.length === 1 && graph) {
            const nodeId = nodes[0].id
            const neuralNode = graph.nodes.find(n => n.id === nodeId)

            if (neuralNode) {
                // Find associated file
                // Strategy A: ID match (if 1:1)
                // Strategy B: sourceRef.fileId

                let targetFile = files.find(f => f.id === nodeId)

                if (!targetFile) {
                    const sourceFileId = neuralNode.sourceRef?.fileId
                    if (sourceFileId) {
                        targetFile = files.find(f => f.id === sourceFileId)
                    }
                }

                // If not found by ID, maybe it's a file node with path?
                // For now, if we found a file object, open preview
                if (targetFile) {
                    openCodePreview(targetFile)
                }
            }

            // Auto-pan to selected node to ensure visibility
            // Delay slightly to allow panel to open/layout to shift
            setTimeout(() => {
                const node = nodes.find(n => n.id === nodeId)
                if (node) {
                    const x = node.positionAbsolute?.x ?? node.position.x
                    const y = node.positionAbsolute?.y ?? node.position.y
                    const w = (node as any).measured?.width ?? node.width ?? 180
                    const h = (node as any).measured?.height ?? node.height ?? 40

                    // Center with zoom
                    reactFlowInstance.setCenter(x + w / 2, y + h / 2, { zoom: 1.2, duration: 800 })
                }
            }, 100)
        }
    }, [graph, files, setGlobalSelectedNodes, openCodePreview, nodes, reactFlowInstance])

    const handleGroupSelected = useCallback(() => {
        if (localSelectedNodes.length < 2) return

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        let validNodes = 0

        localSelectedNodes.forEach(selectedNode => {
            const node = nodes.find(n => n.id === selectedNode.id) || selectedNode

            // Fallback positions
            const x = node.positionAbsolute?.x ?? node.position.x ?? 0
            const y = node.positionAbsolute?.y ?? node.position.y ?? 0

            // Robust Dimension Logic: Prefer measured, fallback to property, fallback to constant
            const measuredW = (node as any).measured?.width
            const measuredH = (node as any).measured?.height

            // Treat 0 as invalid/missing
            const w = (measuredW && measuredW > 0) ? measuredW : (node.width || NODE_WIDTH)
            const h = (measuredH && measuredH > 0) ? measuredH : (node.height || NODE_HEIGHT)

            // Skip 0,0 nodes if uninitialized (optional safety)
            if (x === 0 && y === 0 && w === NODE_WIDTH) {
                // Potentially uninitialized
            }

            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + w)
            maxY = Math.max(maxY, y + h)
            validNodes++
        })

        if (validNodes === 0 || minX === Infinity) return

        const HEADER_HEIGHT = 40
        const H_PADDING = 24
        const V_PADDING = 16

        const groupX = minX - H_PADDING
        const groupY = minY - HEADER_HEIGHT - V_PADDING

        // Enforce strong minimums to avoid thin boxes
        const calculatedWidth = (maxX - minX) + (H_PADDING * 2)
        const calculatedHeight = (maxY - minY) + (V_PADDING * 2) + HEADER_HEIGHT

        const groupWidth = Math.max(calculatedWidth, 240)
        const groupHeight = Math.max(calculatedHeight, 160)

        const groupId = `group-${Date.now()}`

        const groupNode: Node = {
            id: groupId,
            type: 'group',
            position: { x: groupX, y: groupY },
            style: { width: groupWidth, height: groupHeight },
            data: { label: 'New Group' },
            zIndex: -10, // Must be behind
        }



        // 2. Update Children to be relative to Parent
        const updatedNodes = nodes.map(node => {
            if (localSelectedNodes.find(sn => sn.id === node.id)) {
                // Current absolute position (fallback to position if absolute missing)
                const currentAbsX = node.positionAbsolute?.x ?? node.position.x
                const currentAbsY = node.positionAbsolute?.y ?? node.position.y

                return {
                    ...node,
                    parentNode: groupId,
                    expandParent: true,
                    // Convert to relative position
                    position: {
                        x: currentAbsX - groupX - H_PADDING,
                        y: currentAbsY - groupY - HEADER_HEIGHT
                    },
                    zIndex: 10, // Ensure strictly above group
                }
            }
            return node
        })

        // 3. Apply updates
        setNodes([groupNode, ...updatedNodes])

        // Keep selection clear or select group? 
        // setLocalSelectedNodes([]) 

    }, [localSelectedNodes, nodes, setNodes])

    const handleUngroup = useCallback(() => {
        if (localSelectedNodes.length !== 1 || localSelectedNodes[0].type !== 'group') return

        const groupNode = localSelectedNodes[0]
        const groupId = groupNode.id

        // 1. Find all children of this group
        const children = nodes.filter(n => n.parentNode === groupId)

        // 2. Calculate their new absolute positions
        const groupAbsPos = groupNode.positionAbsolute || groupNode.position

        const updatedChildren = children.map(child => {
            const childRelativePos = child.position

            return {
                ...child,
                parentNode: undefined,
                expandParent: undefined,
                position: {
                    x: groupAbsPos.x + childRelativePos.x,
                    y: groupAbsPos.y + childRelativePos.y
                },
                zIndex: 0 // Reset zIndex
            }
        })

        // 3. Remove group node and update children
        const remainingNodes = nodes.filter(n => n.id !== groupId && n.parentNode !== groupId)

        setNodes([...remainingNodes, ...updatedChildren])
        setLocalSelectedNodes([]) // Clear selection
    }, [localSelectedNodes, nodes, setNodes])

    // Helper to get selection bounds
    const getSelectionBounds = useCallback(() => {
        if (localSelectedNodes.length === 0) return null

        // If single group selected, use its bounds directly
        if (localSelectedNodes.length === 1) {
            const node = localSelectedNodes[0]
            if (node.type === 'group' && node.positionAbsolute && node.width && node.height) {
                return {
                    x: node.positionAbsolute.x,
                    y: node.positionAbsolute.y,
                    width: node.width,
                    height: node.height,
                    centerX: node.positionAbsolute.x + node.width / 2,
                    topY: node.positionAbsolute.y
                }
            }
            return null // Don't show toolbar for single normal node
        }

        // Simple bounding box calculation for multi-selection
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

        localSelectedNodes.forEach(node => {
            if (!node.positionAbsolute) return // Wait for absolute position

            // Fallback sizes if not measured yet
            const w = node.width || NODE_WIDTH
            const h = node.height || NODE_HEIGHT

            minX = Math.min(minX, node.positionAbsolute.x)
            minY = Math.min(minY, node.positionAbsolute.y)
            maxX = Math.max(maxX, node.positionAbsolute.x + w)
            maxY = Math.max(maxY, node.positionAbsolute.y + h)
        })

        if (minX === Infinity) return null

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: minX + (maxX - minX) / 2,
            topY: minY
        }
    }, [localSelectedNodes])

    const selectionBounds = getSelectionBounds()

    return (
        <div className={cn("w-full h-full relative", className)}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                onSelectionChange={onSelectionChange} // Track select
                fitView
                connectionMode={ConnectionMode.Loose}
                minZoom={0.1}
                maxZoom={4}
                // Enable Shift for multi-selection and selection box
                multiSelectionKeyCode={['Shift', 'Meta']}
                selectionKeyCode="Shift"
                selectionOnDrag
                panOnDrag={[1, 2]} // Pan on left(1) or middle(2) click? No, usually 0 is left. 
            // Default panOnDrag is true (left click). 
            // If we want selection box on drag, we usually need a modifier key or specific mode.
            // If selectionKeyCode is set (Shift), holding Shift + Drag creates box.
            // Shift + Click adds to selection (multiSelectionKeyCode).
            >
                <Background color={isDark ? '#333' : '#ddd'} gap={20} />
                <Controls />

                <Panel position="top-left" className="flex gap-2">
                    <div className={cn("flex rounded-lg shadow-lg border p-1 gap-1", isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200")}>
                        <button
                            onClick={() => setLayoutDirection('TB')}
                            className={cn(
                                "p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition",
                                layoutDirection === 'TB' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50" : ""
                            )}
                            title="Top-Down"
                        >
                            <ArrowDown size={16} />
                        </button>
                        <button
                            onClick={() => setLayoutDirection('LR')}
                            className={cn(
                                "p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition",
                                layoutDirection === 'LR' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50" : ""
                            )}
                            title="Left-Right"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </Panel>
            </ReactFlow>

            {/* Render Toolbar Overlay */}
            <SelectionOverlay
                bounds={selectionBounds}
                onGroup={handleGroupSelected}
                onUngroup={handleUngroup}
                selectedNodes={localSelectedNodes}
            />
        </div>
    )
}

// Inner component to access React Flow instance for projection
function SelectionOverlay({ bounds, onGroup, onUngroup, selectedNodes }: { bounds: any, onGroup: () => void, onUngroup: () => void, selectedNodes: Node[] }) {
    const { getViewport } = useReactFlow()

    if (!bounds) return null

    // Determine mode
    let mode: 'multi' | 'group' | null = null
    if (selectedNodes.length > 1) mode = 'multi'
    else if (selectedNodes.length === 1 && selectedNodes[0].type === 'group') mode = 'group'

    if (!mode) return null

    const viewport = getViewport()

    // Calculate Top-Right or Top-Center of the selection box in SCREEN coordinates
    const screenX = bounds.centerX * viewport.zoom + viewport.x
    const screenY = bounds.topY * viewport.zoom + viewport.y

    return (
        <div
            style={{
                position: 'absolute',
                left: screenX,
                top: screenY - 20, // 20px offset up
                zIndex: 50,
                transform: 'translate(-50%, -100%)', // Centered horizontally, sitting above
                pointerEvents: 'auto'
            }}
        >
            <SelectionToolbar
                mode={mode}
                onGroup={onGroup}
                onUngroup={onUngroup}
            />
        </div>
    )
}

// Wrapper with Provider
export default function LogicFlow(props: { className?: string }) {
    return (
        <ReactFlowProvider>
            <LogicFlowContent {...props} />
        </ReactFlowProvider>
    )
}
