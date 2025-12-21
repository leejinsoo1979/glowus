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
    MarkerType,
    Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useTheme } from 'next-themes'
import { Plus } from 'lucide-react'

import TableNode, { TableNodeData, SchemaColumn } from './TableNode'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralNode, NeuralEdge } from '@/lib/neural-map/types'

// Node Types Registration
const nodeTypes = {
    table: TableNode,
}

// Utility to avoid duplicate column definitions
function addColumn(columns: SchemaColumn[], column: SchemaColumn) {
    if (!columns.some((c) => c.name === column.name)) {
        columns.push(column)
    }
}

function formatLabel(key: string) {
    return key
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
}

// Helper: Convert Neural Nodes to Schema Nodes using actual graph data
function transformToSchema(
    nodes: NeuralNode[],
    edges: NeuralEdge[]
): { initialNodes: Node<TableNodeData>[]; initialEdges: Edge[] } {
    if (nodes.length <= 1) { // Only root
        const userColumns: SchemaColumn[] = [
            { name: 'id', type: 'uuid', isPrimaryKey: true },
            { name: 'email', type: 'text' }
        ]
        const postColumns: SchemaColumn[] = [
            { name: 'id', type: 'uuid', isPrimaryKey: true },
            { name: 'user_id', type: 'uuid', isForeignKey: true },
            { name: 'title', type: 'text' }
        ]

        return {
            initialNodes: [
                { id: 'users', type: 'table', position: { x: 100, y: 100 }, data: { label: 'users', columns: userColumns } },
                { id: 'posts', type: 'table', position: { x: 400, y: 100 }, data: { label: 'posts', columns: postColumns } }
            ],
            initialEdges: [
                { id: 'e1', source: 'users', target: 'posts', animated: true }
            ]
        }
    }

    const groupedByType = new Map<string, NeuralNode[]>()
    const nodesById = new Map<string, NeuralNode>()

    nodes.forEach((node) => {
        const type = node.type || 'unknown'
        nodesById.set(node.id, node)
        if (!groupedByType.has(type)) groupedByType.set(type, [])
        groupedByType.get(type)!.push(node)
    })

    const typeColumns = new Map<string, SchemaColumn[]>()

    groupedByType.forEach((nodesOfType, key) => {
        const columns: SchemaColumn[] = []
        addColumn(columns, { name: 'id', type: 'uuid', isPrimaryKey: true })
        addColumn(columns, { name: 'title', type: 'text' })
        addColumn(columns, { name: 'created_at', type: 'timestamptz' })
        addColumn(columns, { name: 'updated_at', type: 'timestamptz' })

        if (nodesOfType.some((n) => n.summary)) {
            addColumn(columns, { name: 'summary', type: 'text' })
        }

        if (nodesOfType.some((n) => n.content)) {
            addColumn(columns, { name: 'content', type: 'text' })
        }

        if (nodesOfType.some((n) => n.tags && n.tags.length > 0)) {
            addColumn(columns, { name: 'tags', type: 'text[]' })
        }

        if (nodesOfType.some((n) => typeof n.importance === 'number')) {
            addColumn(columns, { name: 'importance', type: 'int2' })
        }

        if (nodesOfType.some((n) => n.parentId)) {
            addColumn(columns, { name: 'parent_id', type: 'uuid', isForeignKey: true })
        }

        if (nodesOfType.some((n) => n.clusterId)) {
            addColumn(columns, { name: 'cluster_id', type: 'uuid', isForeignKey: true })
        }

        if (nodesOfType.some((n) => n.sourceRef?.fileId)) {
            addColumn(columns, { name: 'source_file_id', type: 'uuid', isForeignKey: true })
        }

        if (nodesOfType.some((n) => n.stats?.views)) {
            addColumn(columns, { name: 'views', type: 'int8' })
        }

        typeColumns.set(key, columns)
    })

    const relationshipEdges = new Set<string>()
    const initialEdges: Edge[] = []

    edges.forEach((edge) => {
        const parent = nodesById.get(edge.source)
        const child = nodesById.get(edge.target)
        if (!parent || !child) return

        const parentType = parent.type || 'unknown'
        const childType = child.type || 'unknown'
        if (!typeColumns.has(parentType) || !typeColumns.has(childType)) return

        if (edge.type === 'parent_child') {
            const childColumns = typeColumns.get(childType)!
            const columnName = `${parentType}_id`
            addColumn(childColumns, { name: columnName, type: 'uuid', isForeignKey: true })
        }

        const relationKey = `${parentType}->${childType}-${edge.type}`
        if (!relationshipEdges.has(relationKey)) {
            relationshipEdges.add(relationKey)
            initialEdges.push({
                id: `edge-${relationKey}`,
                source: parentType,
                target: childType,
                type: 'smoothstep',
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                },
                label: edge.type.replace('_', ' '),
            })
        }
    })

    const initialNodes: Node<TableNodeData>[] = []
    const SPACING_X = 300
    const SPACING_Y = 200
    const COLS = 3

    Array.from(typeColumns.entries()).forEach(([key, columns], idx) => {
        const row = Math.floor(idx / COLS)
        const col = idx % COLS
        initialNodes.push({
            id: key,
            type: 'table',
            position: { x: 100 + col * SPACING_X, y: 100 + row * SPACING_Y },
            data: {
                label: formatLabel(key),
                columns,
            },
        })
    })

    return { initialNodes, initialEdges }
}

export default function SchemaFlow({ className }: { className?: string }) {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    const graph = useNeuralMapStore(s => s.graph)

    // Transform initial state
    const { initialNodes, initialEdges } = useMemo(() => {
        if (!graph) return { initialNodes: [], initialEdges: [] }
        return transformToSchema(graph.nodes, graph.edges)
    }, [graph])

    // React Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

    // Sync when graph changes (optional: could reset layout, handle carefully)
    useEffect(() => {
        setNodes(initialNodes)
        setEdges(initialEdges)
    }, [initialNodes, initialEdges, setNodes, setEdges])

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges]
    )

    const handleAddTable = useCallback(() => {
        const id = `new_table_${Date.now()}`
        const newNode: Node<TableNodeData> = {
            id,
            position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
            type: 'table',
            data: {
                label: 'New Table',
                columns: [
                    { name: 'id', type: 'uuid', isPrimaryKey: true },
                ],
            },
        }
        setNodes((nds) => nds.concat(newNode))
    }, [setNodes])

    return (
        <div className={className}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                connectionMode={ConnectionMode.Loose}
                minZoom={0.1}
                maxZoom={4}
            >
                <Background color={isDark ? '#333' : '#ddd'} gap={20} />
                <Controls />

                <Panel position="top-right">
                    <button
                        onClick={handleAddTable}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md shadow-lg hover:bg-blue-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Table</span>
                    </button>
                </Panel>
            </ReactFlow>
        </div>
    )
}
