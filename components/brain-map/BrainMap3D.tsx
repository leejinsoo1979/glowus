'use client'

/**
 * BrainMap3D - 3D Force-Directed Graph with Bloom Effects
 * react-force-graph-3d + UnrealBloomPass
 * Obsidian-style visualization
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import * as THREE from 'three'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import type { BrainNode, BrainEdge, NodeType, EdgeType } from '@/types/brain-map'

// @ts-ignore - three.js examples JSM modules don't have proper type declarations
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// SSR 비활성화 - react-force-graph-3d는 클라이언트에서만 작동
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="animate-pulse text-zinc-500">3D 그래프 로딩...</div>
    </div>
  ),
})

// PRD 12.1 기준 노드 타입별 색상
// 🔵 Memory, 🟢 Concept, 🟡 Person, 🟣 Project/Doc, 🔴 Workflow/Task, ⚪ Decision
const NODE_COLORS: Record<NodeType, string> = {
  memory: '#3B82F6',    // 🔵 파랑 - 기억
  concept: '#22C55E',   // 🟢 초록 - 개념
  person: '#EAB308',    // 🟡 노랑 - 사람
  doc: '#8B5CF6',       // 🟣 보라 - 프로젝트/문서
  task: '#EF4444',      // 🔴 빨강 - 워크플로우/작업
  decision: '#F8FAFC',  // ⚪ 흰색 - 의사결정
  meeting: '#A855F7',   // 🟣 퍼플 - 회의
  tool: '#06B6D4',      // 시안 - 도구
  skill: '#14B8A6',     // 틸 - 스킬
}

// 노드 타입 라벨
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  memory: '기억',
  concept: '개념',
  person: '사람',
  doc: '문서',
  task: '작업',
  decision: '결정',
  meeting: '회의',
  tool: '도구',
  skill: '스킬',
}

// 엣지 타입별 색상
const EDGE_COLORS: Record<EdgeType, string> = {
  mentions: '#4ade80',
  supports: '#22d3ee',
  contradicts: '#f87171',
  causes: '#facc15',
  follows: '#a78bfa',
  part_of: '#fb923c',
  related: '#94a3b8',
  assigned_to: '#2dd4bf',
  produced_by: '#c084fc',
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface GraphNode extends BrainNode {
  color?: string
  __threeObj?: THREE.Object3D
}

interface GraphLink {
  source: string
  target: string
  type: EdgeType
  weight: number
  color?: string
}

interface BrainMap3DProps {
  agentId: string
  isDark?: boolean
  onNodeClick?: (node: BrainNode) => void
  onNodeHover?: (node: BrainNode | null) => void
  highlightNodes?: Set<string>
  filterTypes?: Set<NodeType>  // 필터링할 노드 타입 (비어있으면 모두 표시)
  focusNodeId?: string
  showLabels?: boolean
  bloomStrength?: number
}

export function BrainMap3D({
  agentId,
  isDark = true,
  onNodeClick,
  onNodeHover,
  highlightNodes,
  filterTypes,
  focusNodeId,
  showLabels = true,
  bloomStrength = 1.5,
}: BrainMap3DProps) {
  const fgRef = useRef<any>(null)
  const [rawGraphData, setRawGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const containerRef = useRef<HTMLDivElement>(null)

  // 사용자 테마 색상 가져오기
  const accentColor = useThemeStore((s) => s.accentColor)
  const userAccentHex = accentColors.find(c => c.id === accentColor)?.color || '#3b82f6'

  // 컨테이너 크기 감지
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/agents/${agentId}/brain/graph`)
        if (!res.ok) throw new Error('Failed to fetch graph data')

        const data = await res.json()

        // 노드에 색상 추가
        const nodes: GraphNode[] = (data.nodes || []).map((node: BrainNode) => ({
          ...node,
          color: NODE_COLORS[node.type] || '#888888',
        }))

        // 엣지를 링크로 변환
        const links: GraphLink[] = (data.edges || []).map((edge: BrainEdge) => ({
          source: edge.source,
          target: edge.target,
          type: edge.type,
          weight: edge.weight,
          color: EDGE_COLORS[edge.type] || '#666666',
        }))

        setRawGraphData({ nodes, links })
      } catch (error) {
        console.error('[BrainMap3D] Error fetching data:', error)
        // Fallback to mock data
        setRawGraphData(generateMockData())
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [agentId])

  // 필터링된 그래프 데이터
  const graphData = useMemo(() => {
    // 필터가 없거나 비어있으면 전체 표시
    if (!filterTypes || filterTypes.size === 0) {
      return rawGraphData
    }

    // 필터된 노드
    const filteredNodes = rawGraphData.nodes.filter(node => filterTypes.has(node.type))
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

    // 필터된 노드들 사이의 링크만 유지
    const filteredLinks = rawGraphData.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target
      return filteredNodeIds.has(sourceId) && filteredNodeIds.has(targetId)
    })

    return { nodes: filteredNodes, links: filteredLinks }
  }, [rawGraphData, filterTypes])

  // Bloom 이펙트 설정
  useEffect(() => {
    if (!fgRef.current) return

    const fg = fgRef.current

    try {
      // 렌더러에 Bloom 추가
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(dimensions.width, dimensions.height),
        bloomStrength,  // strength
        0.4,            // radius
        0.1             // threshold
      )

      // postProcessingComposer가 있으면 bloom 추가
      const composer = fg.postProcessingComposer?.()
      if (composer) {
        composer.addPass(bloomPass)
      }

      // 배경색 설정
      const scene = fg.scene?.()
      if (scene) {
        scene.background = new THREE.Color(isDark ? '#09090b' : '#ffffff')
      }

      // 카메라 설정
      fg.cameraPosition({ z: 500 })
    } catch (error) {
      console.warn('[BrainMap3D] Bloom effect setup failed:', error)
    }
  }, [fgRef.current, dimensions, bloomStrength, isDark])

  // 특정 노드로 포커스
  useEffect(() => {
    if (focusNodeId && fgRef.current) {
      const node = graphData.nodes.find(n => n.id === focusNodeId)
      if (node && node.x !== undefined) {
        fgRef.current.cameraPosition(
          { x: node.x, y: node.y, z: node.z! + 100 },
          { x: node.x, y: node.y, z: node.z },
          1000
        )
      }
    }
  }, [focusNodeId, graphData.nodes])

  // 노드 렌더링 (3D 오브젝트)
  const nodeThreeObject = useCallback((nodeObj: any) => {
    const node = nodeObj as GraphNode
    const isHighlighted = highlightNodes?.has(node.id) || hoveredNode?.id === node.id || selectedNode?.id === node.id
    const baseSize = Math.max(3, Math.min(12, node.importance || 5))
    const size = isHighlighted ? baseSize * 1.5 : baseSize

    // Sphere geometry
    const geometry = new THREE.SphereGeometry(size, 32, 32)

    // Material with emissive glow - 하이라이트 시 사용자 테마 색상 적용
    const baseColor = new THREE.Color(node.color || '#888888')
    const highlightColor = new THREE.Color(userAccentHex)
    const color = isHighlighted ? highlightColor : baseColor
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: isHighlighted ? highlightColor : baseColor,
      emissiveIntensity: isHighlighted ? 1.0 : 0.3,
      metalness: 0.3,
      roughness: 0.4,
    })

    const sphere = new THREE.Mesh(geometry, material)

    // 라벨 추가 (Sprite)
    if (showLabels && node.title) {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = 256
      canvas.height = 64

      ctx.fillStyle = 'transparent'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = 'bold 24px sans-serif'
      ctx.fillStyle = isHighlighted ? '#ffffff' : '#aaaaaa'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const label = node.title.length > 15 ? node.title.slice(0, 15) + '...' : node.title
      ctx.fillText(label, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: isHighlighted ? 1 : 0.7,
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(40, 10, 1)
      sprite.position.y = size + 8

      const group = new THREE.Group()
      group.add(sphere)
      group.add(sprite)
      return group
    }

    return sphere
  }, [hoveredNode, selectedNode, highlightNodes, showLabels, userAccentHex])

  // 링크 렌더링
  const linkColor = useCallback((linkObj: any) => {
    const link = linkObj as GraphLink
    const isConnectedToHovered = hoveredNode &&
      (link.source === hoveredNode.id || link.target === hoveredNode.id ||
       (typeof link.source === 'object' && (link.source as any).id === hoveredNode.id) ||
       (typeof link.target === 'object' && (link.target as any).id === hoveredNode.id))

    if (isConnectedToHovered) {
      return link.color || '#ffffff'
    }
    return `${link.color || '#666666'}40` // 40% opacity
  }, [hoveredNode])

  const linkWidth = useCallback((linkObj: any) => {
    const link = linkObj as GraphLink
    const isConnectedToHovered = hoveredNode &&
      (link.source === hoveredNode.id || link.target === hoveredNode.id ||
       (typeof link.source === 'object' && (link.source as any).id === hoveredNode.id) ||
       (typeof link.target === 'object' && (link.target as any).id === hoveredNode.id))

    return isConnectedToHovered ? link.weight * 3 : link.weight
  }, [hoveredNode])

  // 이벤트 핸들러
  const handleNodeClick = useCallback((nodeObj: any) => {
    const node = nodeObj as GraphNode
    setSelectedNode(node)
    onNodeClick?.(node)

    // 클릭한 노드로 카메라 이동
    if (fgRef.current && node.x !== undefined) {
      fgRef.current.cameraPosition(
        { x: node.x, y: node.y, z: node.z! + 150 },
        { x: node.x, y: node.y, z: node.z },
        1000
      )
    }
  }, [onNodeClick])

  const handleNodeHover = useCallback((nodeObj: any) => {
    const node = nodeObj ? (nodeObj as GraphNode) : null
    setHoveredNode(node)
    onNodeHover?.(node)

    // 커서 변경
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'grab'
    }
  }, [onNodeHover])

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
            지식 그래프 로딩 중...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ background: isDark ? '#09090b' : '#ffffff' }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeLabel={(node) => {
          const n = node as GraphNode
          return `
          <div style="background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 8px; color: white;">
            <div style="font-weight: bold; margin-bottom: 4px;">${n.title || 'Unknown'}</div>
            <div style="font-size: 12px; color: ${n.color || '#fff'};">${n.type ? (NODE_TYPE_LABELS[n.type] || n.type) : 'node'}</div>
            ${n.summary ? `<div style="font-size: 11px; color: #aaa; margin-top: 4px; max-width: 200px;">${n.summary}</div>` : ''}
          </div>
        `
        }}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.6}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(link) => (link as GraphLink).color || '#ffffff'}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onBackgroundClick={handleBackgroundClick}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        backgroundColor={isDark ? '#09090b' : '#ffffff'}
        // Force simulation 설정
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        cooldownTicks={500}
      />

      {/* 선택된 노드 정보 */}
      {selectedNode && (
        <div
          className={cn(
            'absolute bottom-4 left-4 p-4 rounded-xl border max-w-sm',
            isDark ? 'bg-zinc-900/90 border-zinc-800 text-white' : 'bg-white/90 border-zinc-200 text-zinc-900'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedNode.color }}
            />
            <span className="text-xs opacity-60">{NODE_TYPE_LABELS[selectedNode.type]}</span>
          </div>
          <h4 className="font-semibold mb-1">{selectedNode.title}</h4>
          {selectedNode.summary && (
            <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
              {selectedNode.summary}
            </p>
          )}
          <div className="flex gap-4 mt-3 text-xs opacity-60">
            <span>중요도: {selectedNode.importance}/10</span>
            {selectedNode.confidence && (
              <span>신뢰도: {Math.round(selectedNode.confidence * 100)}%</span>
            )}
          </div>
        </div>
      )}

      {/* 범례 */}
      <div
        className={cn(
          'absolute top-4 right-4 p-3 rounded-xl border text-xs',
          isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
        )}
      >
        <div className={cn('font-semibold mb-2', isDark ? 'text-white' : 'text-zinc-900')}>
          노드 타입
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(NODE_COLORS).slice(0, 6).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>
                {NODE_TYPE_LABELS[type as NodeType]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 통계 */}
      <div
        className={cn(
          'absolute bottom-4 right-4 px-3 py-2 rounded-lg border text-xs',
          isDark ? 'bg-zinc-900/80 border-zinc-800 text-zinc-400' : 'bg-white/80 border-zinc-200 text-zinc-600'
        )}
      >
        노드: {graphData.nodes.length} | 연결: {graphData.links.length}
      </div>
    </div>
  )
}

// Mock 데이터 생성
function generateMockData(): GraphData {
  const types: NodeType[] = ['memory', 'concept', 'person', 'doc', 'task', 'decision', 'meeting', 'tool', 'skill']
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  // 중심 노드들 생성
  const centerNodes = [
    { type: 'concept' as NodeType, title: '프로젝트 전략', importance: 10 },
    { type: 'person' as NodeType, title: '진수', importance: 9 },
    { type: 'meeting' as NodeType, title: '주간 회의', importance: 8 },
    { type: 'doc' as NodeType, title: '사업 계획서', importance: 9 },
    { type: 'task' as NodeType, title: 'MVP 개발', importance: 8 },
  ]

  // 중심 노드 추가
  centerNodes.forEach((cn, idx) => {
    nodes.push({
      id: `center-${idx}`,
      type: cn.type,
      title: cn.title,
      summary: `${cn.title}에 대한 핵심 정보`,
      importance: cn.importance,
      confidence: 0.9,
      createdAt: Date.now() - Math.random() * 30 * 86400000,
      color: NODE_COLORS[cn.type],
    })
  })

  // 주변 노드들 생성
  for (let i = 0; i < 50; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    nodes.push({
      id: `node-${i}`,
      type,
      title: `${NODE_TYPE_LABELS[type]} #${i + 1}`,
      summary: `${NODE_TYPE_LABELS[type]} 관련 정보입니다.`,
      importance: Math.floor(Math.random() * 7) + 3,
      confidence: 0.5 + Math.random() * 0.5,
      createdAt: Date.now() - Math.random() * 60 * 86400000,
      color: NODE_COLORS[type],
    })
  }

  // 링크 생성 - 중심 노드에 연결
  const edgeTypes: EdgeType[] = ['mentions', 'supports', 'related', 'causes', 'follows', 'part_of']

  nodes.forEach((node, idx) => {
    if (!node.id.startsWith('center')) {
      // 랜덤 중심 노드에 연결
      const centerIdx = Math.floor(Math.random() * centerNodes.length)
      const edgeType = edgeTypes[Math.floor(Math.random() * edgeTypes.length)]
      links.push({
        source: `center-${centerIdx}`,
        target: node.id,
        type: edgeType,
        weight: 0.3 + Math.random() * 0.7,
        color: EDGE_COLORS[edgeType],
      })

      // 일부 노드들은 서로 연결
      if (Math.random() > 0.7 && idx > 5) {
        const targetIdx = Math.floor(Math.random() * (idx - 5)) + 5
        const edgeType2 = edgeTypes[Math.floor(Math.random() * edgeTypes.length)]
        links.push({
          source: node.id,
          target: nodes[targetIdx].id,
          type: edgeType2,
          weight: 0.2 + Math.random() * 0.5,
          color: EDGE_COLORS[edgeType2],
        })
      }
    }
  })

  // 중심 노드들 간 연결
  for (let i = 0; i < centerNodes.length; i++) {
    for (let j = i + 1; j < centerNodes.length; j++) {
      if (Math.random() > 0.4) {
        const edgeType = edgeTypes[Math.floor(Math.random() * edgeTypes.length)]
        links.push({
          source: `center-${i}`,
          target: `center-${j}`,
          type: edgeType,
          weight: 0.6 + Math.random() * 0.4,
          color: EDGE_COLORS[edgeType],
        })
      }
    }
  }

  return { nodes, links }
}

export default BrainMap3D
