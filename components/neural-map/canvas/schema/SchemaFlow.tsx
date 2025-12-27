'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
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
    useReactFlow,
    ReactFlowProvider,
    useUpdateNodeInternals,
    BaseEdge,
    getBezierPath,
    EdgeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import dagre from 'dagre'
import { useTheme } from 'next-themes'
import { Plus, FileCode, AlertCircle, Play, LayoutGrid, GitBranch } from 'lucide-react'

import TableNode, { TableNodeData, SchemaColumn as TableColumn } from './TableNode'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { parseProjectSchema, type ParsedSchema, type SchemaTable } from '@/lib/neural-map/schema-parser'
import { Database, FileCode2, Hexagon, Code2, Share2, FileJson, Box } from 'lucide-react'
import {
    useSchemaSimulation,
    SimulationController,
    SIMULATION_COLORS,
} from './simulation'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// 레이아웃 타입
type LayoutType = 'grid' | 'topdown'

// 연결된 컴포넌트(그룹) 찾기 - Union-Find 알고리즘
function findConnectedGroups(nodes: Node[], edges: Edge[]): Map<string, string[]> {
    const parent = new Map<string, string>()

    // 초기화: 각 노드는 자기 자신이 부모
    nodes.forEach(n => parent.set(n.id, n.id))

    // Find with path compression
    function find(x: string): string {
        if (parent.get(x) !== x) {
            parent.set(x, find(parent.get(x)!))
        }
        return parent.get(x)!
    }

    // Union
    function union(a: string, b: string) {
        const rootA = find(a)
        const rootB = find(b)
        if (rootA !== rootB) {
            parent.set(rootA, rootB)
        }
    }

    // 엣지로 연결된 노드들 합치기
    edges.forEach(edge => {
        if (parent.has(edge.source) && parent.has(edge.target)) {
            union(edge.source, edge.target)
        }
    })

    // 그룹별로 노드 분류
    const groups = new Map<string, string[]>()
    nodes.forEach(node => {
        const root = find(node.id)
        if (!groups.has(root)) {
            groups.set(root, [])
        }
        groups.get(root)!.push(node.id)
    })

    return groups
}

// Dagre 레이아웃 적용 함수
function applyDagreLayout(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB'): Node[] {
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))

    const defaultNodeWidth = 280
    const defaultNodeHeight = 200

    dagreGraph.setGraph({
        rankdir: direction,
        nodesep: 80,
        ranksep: 120,
        marginx: 50,
        marginy: 50,
    })

    // 노드 ID Set 생성
    const nodeIdSet = new Set(nodes.map(n => n.id))

    // 노드별 실제 크기 사용
    nodes.forEach((node) => {
        const width = node.width || defaultNodeWidth
        const height = node.height || defaultNodeHeight
        dagreGraph.setNode(node.id, { width, height })
    })

    // 유효한 엣지만 dagre에 추가 (source, target이 모두 존재하는 경우)
    let validEdgeCount = 0
    let invalidEdgeCount = 0
    const connectedNodeIds = new Set<string>()

    edges.forEach((edge) => {
        if (nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)) {
            dagreGraph.setEdge(edge.source, edge.target)
            connectedNodeIds.add(edge.source)
            connectedNodeIds.add(edge.target)
            validEdgeCount++
        } else {
            invalidEdgeCount++
            console.warn('[Dagre] ⚠️ Invalid edge skipped:', edge.id, 'source:', edge.source, 'target:', edge.target)
        }
    })

    console.log('[Dagre] 📐 Layout input:', {
        direction,
        nodes: nodes.length,
        edges: edges.length,
        validEdges: validEdgeCount,
        invalidEdges: invalidEdgeCount,
        connectedNodes: connectedNodeIds.size,
        isolatedNodes: nodes.length - connectedNodeIds.size,
        dagreNodeCount: dagreGraph.nodeCount(),
        dagreEdgeCount: dagreGraph.edgeCount()
    })

    dagre.layout(dagreGraph)

    // 고립된 노드들(edge가 없는 노드)을 별도로 배치
    const isolatedNodes = nodes.filter(n => !connectedNodeIds.has(n.id))
    const ISOLATED_COLS = 5
    const ISOLATED_SPACING_X = 320
    const ISOLATED_SPACING_Y = 250

    // dagre로 배치된 노드들의 최대 Y 위치 찾기
    let maxY = 0
    nodes.forEach((node) => {
        const pos = dagreGraph.node(node.id)
        const nodeHeight = node.height || defaultNodeHeight
        if (pos && !isNaN(pos.y)) {
            maxY = Math.max(maxY, pos.y + nodeHeight)
        }
    })

    return nodes.map((node, index) => {
        const nodeWithPosition = dagreGraph.node(node.id)
        const nodeWidth = node.width || defaultNodeWidth
        const nodeHeight = node.height || defaultNodeHeight

        // dagre가 위치를 계산하지 못한 경우 (고립된 노드)
        if (!nodeWithPosition || isNaN(nodeWithPosition.x) || isNaN(nodeWithPosition.y)) {
            const isolatedIndex = isolatedNodes.findIndex(n => n.id === node.id)
            if (isolatedIndex >= 0) {
                const row = Math.floor(isolatedIndex / ISOLATED_COLS)
                const col = isolatedIndex % ISOLATED_COLS
                return {
                    ...node,
                    position: {
                        x: 50 + col * ISOLATED_SPACING_X,
                        y: maxY + 100 + row * ISOLATED_SPACING_Y,
                    },
                }
            }
            return node
        }

        return {
            ...node,
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        }
    })
}

// 커스텀 엣지 컴포넌트 - 디버깅용
function DebugEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}: EdgeProps) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    })

    // 엣지 경로가 유효한지 확인
    const isValidPath = edgePath && edgePath.length > 10

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke: isValidPath ? '#6366f1' : '#ff0000',
                    strokeWidth: 3,
                }}
            />
            {/* 디버그: 시작점과 끝점에 원 그리기 */}
            <circle cx={sourceX} cy={sourceY} r={5} fill="#22c55e" />
            <circle cx={targetX} cy={targetY} r={5} fill="#ef4444" />
        </>
    )
}

// Node Types Registration
const nodeTypes = {
    table: TableNode,
}

// Edge Types Registration
const edgeTypes = {
    debug: DebugEdge,
}

// Convert parsed schema to React Flow nodes/edges
function schemaToFlow(schema: ParsedSchema): { nodes: Node<TableNodeData>[]; edges: Edge[] } {
    const SPACING_X = 450  // 넓은 가로 간격
    const SPACING_Y = 350  // 넓은 세로 간격
    const COLS = 3         // 한 줄에 3개만

    // 테이블 노드 생성
    const nodes: Node<TableNodeData>[] = schema.tables.map((table, idx) => {
        const row = Math.floor(idx / COLS)
        const col = idx % COLS

        const columns: TableColumn[] = table.columns.map(c => ({
            name: c.name,
            type: c.type,
            isPrimaryKey: c.isPrimaryKey,
            isForeignKey: c.isForeignKey,
        }))

        return {
            id: table.name,
            type: 'table',
            position: { x: 150 + col * SPACING_X, y: 150 + row * SPACING_Y },
            // 명시적 크기 지정 (ReactFlow 엣지 path 계산에 필요)
            width: 280,
            height: 100 + columns.length * 24,  // 헤더 + 컬럼 수 기반 높이
            data: {
                label: table.name,
                columns,
            },
        }
    })

    // 노드 ID Set 생성 (엣지 유효성 검사용)
    const nodeIds = new Set(nodes.map(n => n.id))

    // relation에서 참조되는 모든 테이블 이름 수집
    const referencedTables = new Set<string>()
    schema.relations.forEach(rel => {
        referencedTables.add(rel.sourceTable)
        referencedTables.add(rel.targetTable)
    })

    // 누락된 타입에 대한 스텁 노드 생성
    const stubNodes: Node<TableNodeData>[] = []
    let stubIdx = nodes.length
    referencedTables.forEach(tableName => {
        if (!nodeIds.has(tableName)) {
            const row = Math.floor(stubIdx / COLS)
            const col = stubIdx % COLS
            stubNodes.push({
                id: tableName,
                type: 'table',
                position: { x: 150 + col * SPACING_X, y: 150 + row * SPACING_Y },
                // 스텁 노드도 명시적 크기 지정
                width: 280,
                height: 124,  // 헤더 + 1컬럼
                data: {
                    label: `${tableName} (ref)`,
                    columns: [{ name: 'id', type: 'string', isPrimaryKey: true }],
                },
            })
            nodeIds.add(tableName)
            stubIdx++
        }
    })

    // 스텁 노드 추가
    if (stubNodes.length > 0) {
        console.log('[SchemaFlow] 📦 Created stub nodes for missing types:', stubNodes.map(n => n.id))
        nodes.push(...stubNodes)
    }

    // FK 관계를 Edge로 변환 (이제 모든 노드가 존재함)
    const edges: Edge[] = schema.relations.map((rel, idx) => ({
        id: `edge-${idx}-${rel.sourceTable}-${rel.targetTable}`,
        source: rel.targetTable,  // FK가 참조하는 테이블에서
        target: rel.sourceTable,  // FK가 있는 테이블로
        type: 'debug',  // 커스텀 디버그 엣지
        animated: false,
        label: rel.sourceColumn,
        labelStyle: { fontSize: 10, fill: '#888' },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
        },
        style: { stroke: '#6366f1', strokeWidth: 2 },
    }))

    // 디버그 로그 - 상세 정보
    console.log('[SchemaFlow] 📊 Edge creation:', {
        totalRelations: schema.relations.length,
        edgesCreated: edges.length,
        nodeCount: nodes.length,
        stubNodeCount: stubNodes.length,
        sampleNodeIds: Array.from(nodeIds).slice(0, 10),
    })

    // 엣지 source/target 검증 로그
    const validEdges: typeof edges = []
    const invalidEdges: { edge: typeof edges[0], reason: string }[] = []

    edges.forEach(edge => {
        const hasSource = nodeIds.has(edge.source)
        const hasTarget = nodeIds.has(edge.target)
        if (hasSource && hasTarget) {
            validEdges.push(edge)
        } else {
            invalidEdges.push({
                edge,
                reason: `source(${edge.source})=${hasSource}, target(${edge.target})=${hasTarget}`
            })
        }
    })

    console.log('[SchemaFlow] ✅ Valid edges:', validEdges.length)
    if (invalidEdges.length > 0) {
        console.log('[SchemaFlow] ❌ Invalid edges:', invalidEdges.length)
        console.log('[SchemaFlow] 🔍 Invalid edge samples:', invalidEdges.slice(0, 5))
    }

    // 연결된 노드 vs 고립된 노드 분석
    const connectedNodeIds = new Set<string>()
    validEdges.forEach(e => {
        connectedNodeIds.add(e.source)
        connectedNodeIds.add(e.target)
    })
    const isolatedNodeIds = Array.from(nodeIds).filter(id => !connectedNodeIds.has(id))
    console.log('[SchemaFlow] 🔗 Connected nodes:', connectedNodeIds.size, '| Isolated nodes:', isolatedNodeIds.length)
    if (isolatedNodeIds.length > 0 && isolatedNodeIds.length <= 10) {
        console.log('[SchemaFlow] 🚫 Isolated nodes:', isolatedNodeIds)
    }

    return { nodes, edges }
}

// 내부 컴포넌트 (useReactFlow 사용)
function SchemaFlowInner({ className }: { className?: string }) {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'
    const reactFlowInstance = useReactFlow()
    const updateNodeInternals = useUpdateNodeInternals()

    // 파일 트리에서 파일 가져오기
    const files = useNeuralMapStore(s => s.files)

    // 파싱된 스키마 상태
    const [parsedSchema, setParsedSchema] = useState<ParsedSchema | null>(null)
    const [parsingError, setParsingError] = useState<string | null>(null)
    const [schemaFileInfo, setSchemaFileInfo] = useState<{
        type: 'sql' | 'prisma' | 'drizzle' | 'typescript' | 'graphql' | 'openapi' | 'typeorm' | 'mixed' | null
        count: number
    }>({ type: null, count: 0 })

    // 시뮬레이션 컨트롤러 표시 상태
    const [showSimulation, setShowSimulation] = useState(false)

    // 레이아웃 타입 상태 - 기본값 grid (안정적)
    const [layoutType, setLayoutType] = useState<LayoutType>('grid')

    // 그룹 상태 (연결된 컴포넌트) - 노드/엣지 선언 후 아래에서 계산
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

    // 카메라 이동 함수 - 시네마틱 애니메이션
    const moveCameraToNodes = useCallback((nodeIds: string[]) => {
        if (nodeIds.length === 0) return

        // 해당 노드들의 위치 계산
        const targetNodes = reactFlowInstance.getNodes().filter(n => nodeIds.includes(n.id))
        if (targetNodes.length === 0) return

        // 노드들의 중심점 계산
        const padding = 150
        const minX = Math.min(...targetNodes.map(n => n.position.x)) - padding
        const maxX = Math.max(...targetNodes.map(n => n.position.x + (n.width || 240))) + padding
        const minY = Math.min(...targetNodes.map(n => n.position.y)) - padding
        const maxY = Math.max(...targetNodes.map(n => n.position.y + (n.height || 200))) + padding

        // 중심점 계산
        const centerX = (minX + maxX) / 2
        const centerY = (minY + maxY) / 2

        // 단일 노드인 경우 setCenter로 부드럽게 이동
        if (targetNodes.length === 1) {
            const node = targetNodes[0]
            const nodeCenterX = node.position.x + (node.width || 240) / 2
            const nodeCenterY = node.position.y + (node.height || 200) / 2

            reactFlowInstance.setCenter(nodeCenterX, nodeCenterY, {
                duration: 1200,
                zoom: 1.2,
            })
        } else {
            // 여러 노드인 경우 fitBounds 사용 (느린 시네마틱 이동)
            reactFlowInstance.fitBounds(
                { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
                { duration: 1000, padding: 0.3 }
            )
        }
    }, [reactFlowInstance])

    // 프로젝트 파일에서 스키마 파싱
    useEffect(() => {
        if (!files || files.length === 0) {
            console.log('[SchemaFlow] No files provided')
            setParsedSchema(null)
            setSchemaFileInfo({ type: null, count: 0 })
            return
        }

        console.log('[SchemaFlow] Total files:', files.length)

        try {
            // 스키마 관련 파일 카운트
            const allSqlFiles = files.filter(f => f.name.endsWith('.sql'))
            const sqlFiles = allSqlFiles.filter(f => f.content)
            console.log('[SchemaFlow] SQL files:', allSqlFiles.length, 'with content:', sqlFiles.length)
            if (allSqlFiles.length > 0 && sqlFiles.length === 0) {
                console.warn('[SchemaFlow] SQL files found but no content loaded:', allSqlFiles.map(f => f.path || f.name))
            }
            const prismaFile = files.find(f =>
                (f.name === 'schema.prisma' || f.path?.includes('prisma/schema.prisma')) && f.content
            )
            const graphqlFiles = files.filter(f =>
                (f.name.endsWith('.graphql') || f.name.endsWith('.gql')) && f.content
            )
            const openapiFiles = files.filter(f =>
                (f.name === 'openapi.yaml' || f.name === 'openapi.yml' ||
                 f.name === 'swagger.yaml' || f.name === 'swagger.yml' ||
                 f.name === 'openapi.json' || f.name === 'swagger.json') && f.content
            )
            const typeormFiles = files.filter(f =>
                f.name.endsWith('.ts') && f.content && f.content.includes('@Entity')
            )
            const drizzleFiles = files.filter(f =>
                f.name.endsWith('.ts') && f.content &&
                (f.content.includes('pgTable') || f.content.includes('mysqlTable') || f.content.includes('sqliteTable'))
            )
            const tsTypeFiles = files.filter(f =>
                (f.name.endsWith('.ts') || f.name.endsWith('.tsx')) && f.content &&
                (f.path?.includes('types') || f.path?.includes('models') || f.path?.includes('entities'))
            )

            // 스키마 파싱 (auto-detect 로직은 parseProjectSchema에 있음)
            const schema = parseProjectSchema(files)

            if (schema.tables.length === 0) {
                // 파일이 있지만 스키마가 없는 경우
                if (sqlFiles.length > 0) {
                    setParsingError('SQL 파일에서 CREATE TABLE 문을 찾을 수 없습니다')
                    setSchemaFileInfo({ type: 'sql', count: sqlFiles.length })
                } else if (prismaFile) {
                    setParsingError('Prisma 스키마에서 model을 찾을 수 없습니다')
                    setSchemaFileInfo({ type: 'prisma', count: 1 })
                } else {
                    setParsingError('스키마 파일을 찾을 수 없습니다 (SQL, Prisma, Drizzle, TypeScript 지원)')
                    setSchemaFileInfo({ type: null, count: 0 })
                }
                setParsedSchema(null)
                return
            }

            // 감지된 타입 설정
            let detectedType = schema.detectedType
            let fileCount = 0
            if (detectedType === 'sql') fileCount = sqlFiles.length
            else if (detectedType === 'prisma') fileCount = 1
            else if (detectedType === 'graphql') fileCount = graphqlFiles.length
            else if (detectedType === 'openapi') fileCount = openapiFiles.length
            else if (detectedType === 'typeorm') fileCount = typeormFiles.length
            else if (detectedType === 'drizzle') fileCount = drizzleFiles.length
            else if (detectedType === 'typescript') fileCount = tsTypeFiles.length
            else if (detectedType === 'mixed') fileCount = sqlFiles.length + graphqlFiles.length + openapiFiles.length + typeormFiles.length + drizzleFiles.length + (prismaFile ? 1 : 0)

            setSchemaFileInfo({ type: detectedType || null, count: fileCount })
            setParsedSchema(schema)
            setParsingError(null)
            console.log('[SchemaFlow] Parsed schema:', schema.tables.length, 'tables,', schema.relations.length, 'relations, type:', detectedType)
        } catch (err: any) {
            console.error('[SchemaFlow] Parse error:', err)
            setParsingError(err.message || '스키마 파싱 오류')
            setParsedSchema(null)
        }
    }, [files])

    // 스키마를 Flow 노드/엣지로 변환
    const { initialNodes, initialEdges } = useMemo(() => {
        if (!parsedSchema || parsedSchema.tables.length === 0) {
            return { initialNodes: [] as Node<TableNodeData>[], initialEdges: [] as Edge[] }
        }
        const { nodes, edges } = schemaToFlow(parsedSchema)
        return { initialNodes: nodes, initialEdges: edges }
    }, [parsedSchema])

    // React Flow State
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

    // 그룹 계산 (연결된 컴포넌트)
    const nodeGroups = useMemo(() => {
        if (nodes.length === 0) return new Map<string, string[]>()
        return findConnectedGroups(nodes, edges)
    }, [nodes, edges])

    // 그룹 목록 (크기 순 정렬) - 연결된 노드가 있는 그룹만
    const sortedGroups = useMemo(() => {
        const groups = Array.from(nodeGroups.entries())
            .map(([rootId, nodeIds]) => {
                // 이 그룹에 실제 엣지가 있는지 확인
                const nodeIdSet = new Set(nodeIds)
                const groupEdges = edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
                return {
                    id: rootId,
                    nodeIds,
                    size: nodeIds.length,
                    edgeCount: groupEdges.length,
                    // 그룹 대표 이름 (가장 짧은 노드 이름)
                    name: nodeIds.reduce((shortest, id) =>
                        id.length < shortest.length ? id : shortest, nodeIds[0] || '')
                }
            })
            // 엣지가 있는 그룹만 필터링 (연결된 컴포넌트)
            .filter(g => g.edgeCount > 0)
            .sort((a, b) => b.size - a.size)
        return groups
    }, [nodeGroups, edges])

    // 고립된 노드 수 계산
    const isolatedNodeCount = useMemo(() => {
        const connectedNodeIds = new Set<string>()
        edges.forEach(e => {
            connectedNodeIds.add(e.source)
            connectedNodeIds.add(e.target)
        })
        return nodes.length - connectedNodeIds.size
    }, [nodes, edges])

    // 선택된 그룹의 노드/엣지만 필터링
    const filteredNodes = useMemo(() => {
        if (!selectedGroupId) return nodes
        const groupNodeIds = nodeGroups.get(selectedGroupId) || []
        const nodeIdSet = new Set(groupNodeIds)
        return nodes.filter(n => nodeIdSet.has(n.id))
    }, [nodes, selectedGroupId, nodeGroups])

    const filteredEdges = useMemo(() => {
        if (!selectedGroupId) return edges
        const groupNodeIds = nodeGroups.get(selectedGroupId) || []
        const nodeIdSet = new Set(groupNodeIds)
        return edges.filter(e => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
    }, [edges, selectedGroupId, nodeGroups])

    // 그룹 선택 시 fitView
    useEffect(() => {
        if (selectedGroupId && filteredNodes.length > 0) {
            setTimeout(() => {
                reactFlowInstance.fitView({ padding: 0.3, duration: 800 })
            }, 100)
        }
    }, [selectedGroupId, filteredNodes.length, reactFlowInstance])

    // 🔍 엣지 상태 변화 추적
    useEffect(() => {
        console.log('[SchemaFlow] 📊 EDGE STATE CHANGED:', {
            count: edges.length,
            sample: edges.slice(0, 3).map(e => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: e.type,
            })),
        })
    }, [edges])

    // 스키마 변경시 동기화 + 레이아웃 적용
    useEffect(() => {
        console.log('[SchemaFlow] 🔄 Layout effect triggered:', {
            initialNodesLength: initialNodes.length,
            initialEdgesLength: initialEdges.length,
        })

        if (initialNodes.length === 0) {
            console.log('[SchemaFlow] ⚠️ No initial nodes, waiting for data...')
            return
        }

        console.log('[SchemaFlow] 🔄 Layout sync effect running:', {
            layoutType,
            nodesCount: initialNodes.length,
            edgesCount: initialEdges.length,
        })

        // 레이아웃 타입에 따라 노드 위치 계산
        let layoutedNodes = initialNodes
        if (layoutType === 'topdown') {
            console.log('[SchemaFlow] 🌲 Applying dagre top-down layout...')
            layoutedNodes = applyDagreLayout(initialNodes, initialEdges, 'TB')
            console.log('[SchemaFlow] ✅ Dagre layout applied, nodes repositioned')
        }

        // 노드에 layoutType 추가 (Handle 위치 결정용)
        const nodesWithLayout = layoutedNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                layoutType,
            }
        }))

        // 🔍 노드 위치 검증
        const invalidPositionNodes = nodesWithLayout.filter(n =>
            isNaN(n.position.x) || isNaN(n.position.y) ||
            n.position.x === undefined || n.position.y === undefined
        )
        if (invalidPositionNodes.length > 0) {
            console.error('[SchemaFlow] ❌ Invalid node positions:', invalidPositionNodes.map(n => ({ id: n.id, pos: n.position })))
        }

        // 커스텀 debug 엣지 타입 사용
        const edgesToSet: Edge[] = initialEdges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: 'debug',  // 커스텀 디버그 엣지
            animated: false,
            label: edge.label,
            labelStyle: { fontSize: 10, fill: '#888' },
            markerEnd: edge.markerEnd,
            style: {
                stroke: '#6366f1',
                strokeWidth: 2,
            },
        }))

        // 노드와 엣지를 동시에 설정
        console.log('[SchemaFlow] 📌 Setting nodes:', nodesWithLayout.length, 'and edges:', edgesToSet.length)
        setNodes(nodesWithLayout)
        setEdges(edgesToSet)

        // 노드가 렌더링된 후 Handle 위치 업데이트 및 엣지 재계산
        const updateTimer = setTimeout(() => {
            // 모든 노드의 internal 상태 업데이트 (Handle 위치 포함)
            const nodeIds = nodesWithLayout.map(n => n.id)
            console.log('[SchemaFlow] 🔧 Updating node internals for', nodeIds.length, 'nodes')
            nodeIds.forEach(id => updateNodeInternals(id))

            // 추가 딜레이 후 fitView 및 엣지 강제 업데이트
            setTimeout(() => {
                reactFlowInstance.fitView({ padding: 0.2, duration: 800 })

                // fitView 후 엣지 강제 업데이트 (새 배열로 리렌더 트리거)
                requestAnimationFrame(() => {
                    setEdges(currentEdges => {
                        console.log('[SchemaFlow] 🔄 Force edge update, edges:', currentEdges.length)
                        return currentEdges.map(e => ({ ...e }))
                    })
                })
            }, 100)
        }, 150)

        return () => {
            clearTimeout(updateTimer)
        }
    }, [initialNodes, initialEdges, setNodes, setEdges, layoutType, reactFlowInstance, updateNodeInternals])

    // 레이아웃 토글 함수
    const toggleLayout = useCallback(() => {
        setLayoutType(prev => prev === 'grid' ? 'topdown' : 'grid')
    }, [])

    // 시뮬레이션 하이라이트 상태
    const [simulationHighlight, setSimulationHighlight] = useState<{
        mode: 'fk-flow' | 'crud' | 'sequential'
        operation?: 'create' | 'read' | 'update' | 'delete'
    }>({ mode: 'fk-flow' })

    // 카메라 이동 타이머 ref
    const cameraTimerRef = useRef<NodeJS.Timeout | null>(null)

    // 시뮬레이션에서 노드 하이라이트 처리 + 카메라 이동
    const handleNodeHighlight = useCallback((highlightedNodeIds: Set<string>, visitedNodeIds: Set<string>) => {
        // 노드 하이라이트 스타일 적용 + 시뮬레이션 모드 상태
        setNodes((nds) =>
            nds.map((node, index) => ({
                ...node,
                data: {
                    ...node.data,
                    isHighlighted: highlightedNodeIds.has(node.id),
                    highlightColor: simulationHighlight.mode === 'crud'
                        ? SIMULATION_COLORS[simulationHighlight.operation || 'read']
                        : SIMULATION_COLORS.active,
                    highlightIntensity: highlightedNodeIds.has(node.id) ? 1 : 0,
                    // 시뮬레이션 모드 관련 상태
                    simulationMode: showSimulation,
                    isVisited: visitedNodeIds.has(node.id),
                    isActive: highlightedNodeIds.has(node.id),
                    appearDelay: index * 50, // 순차 등장 효과
                },
            }))
        )

        // 이전 카메라 타이머 취소
        if (cameraTimerRef.current) {
            clearTimeout(cameraTimerRef.current)
        }

        // 카메라를 하이라이트된 노드로 이동 (약간의 딜레이로 시네마틱 효과)
        const nodeIdsArray = Array.from(highlightedNodeIds)
        if (nodeIdsArray.length > 0) {
            cameraTimerRef.current = setTimeout(() => {
                moveCameraToNodes(nodeIdsArray)
            }, 200) // 200ms 딜레이 후 카메라 이동 시작
        }
    }, [setNodes, simulationHighlight, moveCameraToNodes, showSimulation])

    // 시뮬레이션에서 엣지 하이라이트 처리
    const handleEdgeHighlight = useCallback((highlightedEdgeIds: Set<string>, visitedEdgeIds: Set<string>) => {
        setEdges((eds) =>
            eds.map((edge) => {
                const isActive = highlightedEdgeIds.has(edge.id)
                const isVisited = visitedEdgeIds.has(edge.id)
                return {
                    ...edge,
                    animated: isActive,
                    className: isActive ? 'schema-flow-active' : '',
                    style: {
                        ...edge.style,
                        stroke: isActive
                            ? '#22c55e' // 활성: 밝은 그린
                            : isVisited
                                ? '#60a5fa' // 방문: 밝은 블루
                                : showSimulation
                                    ? '#374151' // 미방문: 어둡게
                                    : '#6366f1',
                        strokeWidth: isActive ? 4 : isVisited ? 2.5 : 1.5,
                        opacity: showSimulation ? (isVisited || isActive ? 1 : 0.15) : 1,
                        filter: isActive
                            ? `drop-shadow(0 0 8px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 16px rgba(34, 197, 94, 0.5))`
                            : isVisited
                                ? `drop-shadow(0 0 4px rgba(96, 165, 250, 0.5))`
                                : undefined,
                        transition: 'all 0.5s ease-out',
                    },
                }
            })
        )
    }, [setEdges, showSimulation])

    // 시뮬레이션 훅
    // 시뮬레이션은 선택된 그룹 내에서만 동작
    const simulation = useSchemaSimulation({
        nodes: filteredNodes,
        edges: filteredEdges,
        onNodeHighlight: handleNodeHighlight,
        onEdgeHighlight: handleEdgeHighlight,
    })

    // 시뮬레이션 설정 변경 시 하이라이트 상태 동기화
    useEffect(() => {
        setSimulationHighlight({
            mode: simulation.config.mode,
            operation: simulation.config.crud?.operation,
        })
    }, [simulation.config.mode, simulation.config.crud?.operation])

    // 시뮬레이션 stop 함수 참조 (의존성 문제 방지)
    const simulationStopRef = useRef(simulation.stop)
    simulationStopRef.current = simulation.stop

    // 시뮬레이션 시작 여부 추적 (한 번이라도 시작됐는지)
    const hasSimulationStartedRef = useRef(false)

    // 시뮬레이션 모드 토글 시 노드 상태 리셋
    useEffect(() => {
        // 초기 렌더링 시에는 edge 스타일을 변경하지 않음 (edge가 제대로 설정되기 전에 실행되는 것 방지)
        if (!hasSimulationStartedRef.current && !showSimulation) {
            console.log('[SchemaFlow] ⏭️ Skipping simulation reset on initial render')
            return
        }

        if (!showSimulation) {
            // 시뮬레이션 종료 시 모든 노드를 정상 상태로 복원
            console.log('[SchemaFlow] 🔄 Simulation OFF - restoring edge styles')
            setNodes((nds) =>
                nds.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        simulationMode: false,
                        isVisited: true,
                        isActive: false,
                        isHighlighted: false,
                    },
                }))
            )
            setEdges((eds) => {
                console.log('[SchemaFlow] 🔄 Restoring', eds.length, 'edges')
                return eds.map((edge) => ({
                    ...edge,
                    animated: true,
                    style: {
                        ...edge.style,
                        stroke: '#6366f1',
                        strokeWidth: 2,
                        opacity: 1,
                        filter: undefined,
                    },
                }))
            })
            // ref를 통해 stop 호출
            simulationStopRef.current()
            hasSimulationStartedRef.current = false
        } else {
            // 시뮬레이션 시작 시 모든 노드를 미방문 상태로 설정
            console.log('[SchemaFlow] ▶️ Simulation ON - dimming edges')
            hasSimulationStartedRef.current = true
            setNodes((nds) =>
                nds.map((node, index) => ({
                    ...node,
                    data: {
                        ...node.data,
                        simulationMode: true,
                        isVisited: false,
                        isActive: false,
                        isHighlighted: false,
                        appearDelay: index * 50,
                    },
                }))
            )
            setEdges((eds) => {
                console.log('[SchemaFlow] 🔅 Dimming', eds.length, 'edges for simulation')
                return eds.map((edge) => ({
                    ...edge,
                    animated: false,
                    style: {
                        ...edge.style,
                        stroke: '#64748b',  // 더 밝은 회색
                        strokeWidth: 1.5,
                        opacity: 0.5,  // 더 높은 opacity
                    },
                }))
            })
        }
    }, [showSimulation, setNodes, setEdges])

    // 테이블 목록 (CRUD 대상 선택용)
    // 시뮬레이션 테이블 목록 (선택된 그룹 기준)
    const tables = useMemo(() =>
        filteredNodes.map((node) => ({
            id: node.id,
            name: node.data?.label || node.id,
        })),
        [filteredNodes]
    )

    // 시뮬레이션 열릴 때 스텝 생성
    useEffect(() => {
        if (showSimulation && nodes.length > 0 && simulation.steps.length === 0) {
            // CRUD 모드일 경우 첫 번째 테이블을 기본 대상으로 설정
            if (simulation.config.mode === 'crud' && !simulation.config.crud?.targetTableId && tables.length > 0) {
                simulation.updateConfig({
                    crud: {
                        ...simulation.config.crud!,
                        targetTableId: tables[0].id,
                    },
                })
            }
            simulation.generateSteps()
        }
    }, [showSimulation, nodes.length])

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
                label: 'new_table',
                columns: [
                    { name: 'id', type: 'uuid', isPrimaryKey: true },
                ],
            },
        }
        setNodes((nds) => nds.concat(newNode))
    }, [setNodes])

    // 파일이 없거나 스키마가 없을 때 안내 화면
    if (!files || files.length === 0) {
        return (
            <div className={className}>
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                    <FileCode className="w-16 h-16 opacity-50" />
                    <div className="text-center">
                        <p className="text-lg font-medium">프로젝트 파일을 로드해주세요</p>
                        <p className="text-sm mt-1">좌측 패널에서 프로젝트를 열면 스키마가 자동으로 분석됩니다</p>
                    </div>
                </div>
            </div>
        )
    }

    if (parsingError && !parsedSchema) {
        // 스키마 파일이 없는 경우 친근한 빈 상태 표시
        const isNoSchemaProject = parsingError.includes('스키마 파일을 찾을 수 없습니다')
        return (
            <div className={className}>
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                    {isNoSchemaProject ? (
                        <>
                            <Database className="w-16 h-16 opacity-30" />
                            <div className="text-center">
                                <p className="text-lg font-medium opacity-70">데이터베이스 스키마 없음</p>
                                <p className="text-sm mt-1 opacity-50">
                                    이 프로젝트에는 감지된 스키마 파일이 없습니다
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="w-16 h-16 opacity-50 text-amber-500" />
                            <div className="text-center">
                                <p className="text-lg font-medium">{parsingError}</p>
                                <p className="text-sm mt-1 max-w-md">
                                    지원 형식: SQL migrations, Prisma schema, Drizzle schema, TypeScript types
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // 스키마 타입 아이콘 및 라벨
    const getSchemaTypeInfo = () => {
        switch (schemaFileInfo.type) {
            case 'sql':
                return { icon: <Database className="w-4 h-4 text-blue-400" />, label: 'SQL' }
            case 'prisma':
                return { icon: <Hexagon className="w-4 h-4 text-indigo-400" />, label: 'Prisma' }
            case 'graphql':
                return { icon: <Share2 className="w-4 h-4 text-pink-400" />, label: 'GraphQL' }
            case 'openapi':
                return { icon: <FileJson className="w-4 h-4 text-orange-400" />, label: 'OpenAPI' }
            case 'typeorm':
                return { icon: <Box className="w-4 h-4 text-red-400" />, label: 'TypeORM' }
            case 'drizzle':
                return { icon: <FileCode2 className="w-4 h-4 text-green-400" />, label: 'Drizzle' }
            case 'typescript':
                return { icon: <Code2 className="w-4 h-4 text-cyan-400" />, label: 'TypeScript' }
            case 'mixed':
                return { icon: <FileCode className="w-4 h-4 text-purple-400" />, label: 'Mixed' }
            default:
                return { icon: <FileCode className="w-4 h-4 text-emerald-400" />, label: 'Schema' }
        }
    }

    const typeInfo = getSchemaTypeInfo()

    return (
        <div className={className}>
            <ReactFlow
                nodes={filteredNodes}
                edges={filteredEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                connectionMode={ConnectionMode.Loose}
                minZoom={0.1}
                maxZoom={4}
                defaultEdgeOptions={{
                    type: 'default',
                    animated: true,
                    style: { stroke: '#6366f1', strokeWidth: 2 },
                }}
                elementsSelectable={true}
                edgesFocusable={true}
                onInit={(instance) => {
                    console.log('[SchemaFlow] 🚀 ReactFlow initialized, forcing edge update...')
                    // ReactFlow 초기화 후 엣지 강제 업데이트
                    setTimeout(() => {
                        setEdges(currentEdges => {
                            console.log('[SchemaFlow] 🔧 onInit: updating', currentEdges.length, 'edges')
                            return currentEdges.map(e => ({ ...e }))
                        })
                    }, 300)
                }}
            >
                <Background color={isDark ? '#333' : '#ddd'} gap={20} />
                <Controls showInteractive={false} />
                {/* ReactFlow 워터마크 숨김 */}
                <style>{`.react-flow__attribution { display: none !important; }`}</style>

                {/* 상단 정보 패널 */}
                <Panel position="top-left">
                    <div className="flex flex-col gap-2">
                        {/* 스키마 정보 */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/90 text-white rounded-md shadow-lg text-sm">
                            {typeInfo.icon}
                            <span className="font-medium">{typeInfo.label}</span>
                            <span className="text-zinc-500">|</span>
                            <span>{parsedSchema?.tables.length || 0} tables</span>
                            <span className="text-zinc-500">|</span>
                            <span>{parsedSchema?.relations.length || 0} relations</span>
                            {schemaFileInfo.count > 0 && (
                                <>
                                    <span className="text-zinc-500">|</span>
                                    <span className="text-zinc-400">{schemaFileInfo.count} files</span>
                                </>
                            )}
                        </div>
                        {/* 그룹 선택 패널 */}
                        {sortedGroups.length > 0 && (
                            <div className="flex flex-col gap-2 px-3 py-2 bg-zinc-800/95 text-white rounded-md shadow-lg text-sm max-w-[400px]">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-zinc-300">연결된 그룹</span>
                                    <span className="text-xs text-zinc-500">
                                        {sortedGroups.length}개 그룹 | {isolatedNodeCount}개 고립
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {/* 전체 보기 버튼 */}
                                    <button
                                        onClick={() => {
                                            setSelectedGroupId(null)
                                            setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 500 }), 50)
                                        }}
                                        className={cn(
                                            "px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                                            !selectedGroupId
                                                ? "bg-indigo-600 text-white shadow-md"
                                                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                                        )}
                                    >
                                        전체 ({nodes.length})
                                    </button>
                                    {/* 그룹 버튼들 */}
                                    {sortedGroups.slice(0, 10).map((group, idx) => (
                                        <button
                                            key={group.id}
                                            onClick={() => setSelectedGroupId(group.id)}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded text-xs font-medium transition-all",
                                                selectedGroupId === group.id
                                                    ? "bg-green-600 text-white shadow-md"
                                                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                                            )}
                                            title={`${group.nodeIds.join(', ')}`}
                                        >
                                            {group.name.length > 12 ? group.name.slice(0, 12) + '...' : group.name}
                                            <span className="ml-1 text-zinc-400">
                                                ({group.size}n/{group.edgeCount}e)
                                            </span>
                                        </button>
                                    ))}
                                    {sortedGroups.length > 10 && (
                                        <span className="px-2 py-1 text-xs text-zinc-500">
                                            +{sortedGroups.length - 10} more
                                        </span>
                                    )}
                                </div>
                                {/* 선택된 그룹 정보 */}
                                {selectedGroupId && (
                                    <div className="text-xs text-zinc-400 border-t border-zinc-700 pt-2 mt-1">
                                        📍 {filteredNodes.length}개 노드, {filteredEdges.length}개 엣지 표시 중
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 레이아웃 토글 버튼 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleLayout}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-md shadow-lg text-sm font-medium transition-all',
                                    layoutType === 'grid'
                                        ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                )}
                            >
                                {layoutType === 'grid' ? (
                                    <>
                                        <LayoutGrid className="w-4 h-4" />
                                        <span>그리드</span>
                                    </>
                                ) : (
                                    <>
                                        <GitBranch className="w-4 h-4" />
                                        <span>탑다운</span>
                                    </>
                                )}
                            </button>
                            <span className="text-xs text-zinc-400 bg-zinc-800/70 px-2 py-1 rounded">
                                {layoutType === 'topdown' ? '계층 구조 (FK 흐름)' : '격자 배치'}
                            </span>
                        </div>
                    </div>
                </Panel>

                <Panel position="top-right">
                    <div className="flex items-center gap-2">
                        {/* 시뮬레이션 토글 버튼 */}
                        <Button
                            onClick={() => setShowSimulation(!showSimulation)}
                            className={cn(
                                'gap-2 shadow-lg transition-all',
                                showSimulation
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-emerald-600 hover:bg-emerald-700',
                                simulation.state === 'playing' && 'animate-pulse'
                            )}
                        >
                            <Play className={cn('w-4 h-4', simulation.state === 'playing' && 'fill-current')} />
                            <span>{showSimulation ? '시뮬레이션 닫기' : '데이터 흐름'}</span>
                        </Button>

                        <button
                            onClick={handleAddTable}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md shadow-lg hover:bg-blue-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Table</span>
                        </button>
                    </div>
                </Panel>

                {/* 시뮬레이션 컨트롤러 패널 - 우측 하단 (compact) */}
                {showSimulation && parsedSchema && parsedSchema.tables.length > 0 && (
                    <Panel position="bottom-right">
                        <SimulationController
                            state={simulation.state}
                            config={simulation.config}
                            steps={simulation.steps}
                            currentStepIndex={simulation.currentStepIndex}
                            progress={simulation.progress}
                            tables={tables}
                            onPlay={simulation.play}
                            onPause={simulation.pause}
                            onStop={simulation.stop}
                            onNextStep={simulation.nextStep}
                            onPrevStep={simulation.prevStep}
                            onGoToStep={simulation.goToStep}
                            onSetSpeed={simulation.setSpeed}
                            onToggleLoop={simulation.toggleLoop}
                            onSetMode={simulation.setMode}
                            onUpdateConfig={simulation.updateConfig}
                            onGenerateSteps={simulation.generateSteps}
                            className="mb-2 mr-2"
                            compact
                        />
                    </Panel>
                )}
            </ReactFlow>
        </div>
    )
}

// 메인 컴포넌트 - ReactFlowProvider로 래핑
export default function SchemaFlow({ className }: { className?: string }) {
    return (
        <ReactFlowProvider>
            <SchemaFlowInner className={className} />
        </ReactFlowProvider>
    )
}
