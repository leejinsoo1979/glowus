'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useMyNeuronsStore } from '@/lib/my-neurons/store'
import type { MyNeuronNode, BottleneckInsight } from '@/lib/my-neurons/types'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
  Search,
  Upload,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Video,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Brain,
  Settings,
  Download,
  RefreshCw,
  Palette,
  Eye,
  EyeOff,
  Target,
  Workflow,
  Route,
  Map as MapIcon,
  BarChart3,
  X,
  Info,
  Zap,
  MessageSquare,
  Trash2,
  Link,
  Pin,
  Expand,
  Shrink,
  Plus,
  Folder,
  User,
  Bot,
  Flag,
  TrendingUp,
  Lightbulb,
  Calendar,
  DollarSign,
  CheckSquare,
  Building2,
  Sparkles,
  Circle,
} from 'lucide-react'
import type { MyNeuronType, ViewMode } from '@/lib/my-neurons/types'
import dynamic from 'next/dynamic'

// Dynamic import for 3D canvas (SSR 비활성화)
const NeuronsCanvas = dynamic(
  () => import('@/components/my-neurons/canvas/NeuronsCanvas').then(mod => mod.NeuronsCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#050510]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-zinc-400 text-sm">3D 뉴런 맵 로딩 중...</span>
        </div>
      </div>
    ),
  }
)

// ============================================
// View Tabs (uses ViewMode from types)
// ============================================

const VIEW_TABS: { id: ViewMode; label: string; icon: React.ComponentType<any>; description: string }[] = [
  { id: 'radial', label: 'Radial', icon: Target, description: '중심에서 방사형으로 펼쳐지는 기본 뷰' },
  { id: 'clusters', label: 'Clusters', icon: Workflow, description: '타입별로 클러스터링된 뷰' },
  { id: 'pathfinder', label: 'Pathfinder', icon: Route, description: '의존성과 연결 경로 강조 뷰' },
  { id: 'roadmap', label: 'Roadmap', icon: MapIcon, description: '시간/우선순위 기반 로드맵 뷰' },
  { id: 'insights', label: 'Insights', icon: BarChart3, description: '병목과 중요도 중심 분석 뷰' },
]

// ============================================
// Right Panel Tabs
// ============================================


// ============================================
// FileTree Categories (그래프 노드 타입별 분류)
// ============================================

interface FileTreeCategory {
  id: string
  label: string
  icon: React.ComponentType<any>
  types: MyNeuronType[]  // 이 카테고리에 속하는 노드 타입들
  color: string
}

const FILE_TREE_CATEGORIES: FileTreeCategory[] = [
  {
    id: 'projects',
    label: '프로젝트',
    icon: Folder,
    types: ['project'],
    color: 'text-blue-400'
  },
  {
    id: 'tasks',
    label: '작업',
    icon: CheckSquare,
    types: ['task'],
    color: 'text-green-400'
  },
  {
    id: 'documents',
    label: '문서',
    icon: FileText,
    types: ['doc'],
    color: 'text-amber-400'
  },
  {
    id: 'people',
    label: '팀원',
    icon: User,
    types: ['person'],
    color: 'text-purple-400'
  },
  {
    id: 'agents',
    label: 'AI 에이전트',
    icon: Bot,
    types: ['agent'],
    color: 'text-cyan-400'
  },
  {
    id: 'goals',
    label: '목표 & OKR',
    icon: Flag,
    types: ['objective', 'key_result'],
    color: 'text-red-400'
  },
  {
    id: 'programs',
    label: '정부지원사업',
    icon: Building2,
    types: ['program', 'application', 'milestone', 'budget'],
    color: 'text-emerald-400'
  },
  {
    id: 'workflows',
    label: '워크플로우',
    icon: Workflow,
    types: ['workflow'],
    color: 'text-orange-400'
  },
  {
    id: 'insights',
    label: '인사이트',
    icon: Sparkles,
    types: ['insight', 'decision'],
    color: 'text-pink-400'
  },
  {
    id: 'memories',
    label: '기록',
    icon: Calendar,
    types: ['memory'],
    color: 'text-indigo-400'
  },
]

// 노드 타입별 아이콘 매핑
const NODE_TYPE_ICONS: Record<MyNeuronType, React.ComponentType<any>> = {
  self: Brain,
  project: Folder,
  task: CheckSquare,
  doc: FileText,
  person: User,
  agent: Bot,
  objective: Flag,
  key_result: TrendingUp,
  decision: Lightbulb,
  memory: Calendar,
  workflow: Workflow,
  insight: Sparkles,
  program: Building2,
  application: FileText,
  milestone: Target,
  budget: DollarSign,
}

// ============================================
// Main Page Component
// ============================================

export default function NeuronsPage() {
  const router = useRouter()

  // Store state
  const graph = useMyNeuronsStore((s) => s.graph)
  const isLoading = useMyNeuronsStore((s) => s.isLoading)
  const selectedNodeIds = useMyNeuronsStore((s) => s.selectedNodeIds)
  const setGraph = useMyNeuronsStore((s) => s.setGraph)
  const setLoading = useMyNeuronsStore((s) => s.setLoading)
  const setBottlenecks = useMyNeuronsStore((s) => s.setBottlenecks)
  const setPriorities = useMyNeuronsStore((s) => s.setPriorities)
  const clearSelection = useMyNeuronsStore((s) => s.clearSelection)
  const selectNode = useMyNeuronsStore((s) => s.selectNode)
  const showLabels = useMyNeuronsStore((s) => s.showLabels)
  const toggleLabels = useMyNeuronsStore((s) => s.toggleLabels)

  // Local state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [leftPanelWidth] = useState(280)
  const [error, setError] = useState<string | null>(null)
  // viewMode from store
  const viewMode = useMyNeuronsStore((s) => s.viewMode)
  const setViewMode = useMyNeuronsStore((s) => s.setViewMode)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['projects', 'tasks']))

  // Fetch graph data
  const fetchGraph = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/my-neurons/graph')
      if (!res.ok) {
        throw new Error('Failed to fetch graph data')
      }

      const data = await res.json()
      if (data.success) {
        setGraph(data.data)
        setBottlenecks(data.bottlenecks || [])
        setPriorities(data.priorities || [])
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (err) {
      console.error('Failed to fetch graph:', err)
      setError(err instanceof Error ? err.message : 'Failed to load graph')
    } finally {
      setLoading(false)
    }
  }, [setGraph, setLoading, setBottlenecks, setPriorities])

  // Initial fetch
  useEffect(() => {
    fetchGraph()
  }, [fetchGraph])

  // Get selected node
  const selectedNode = useMemo(() => {
    if (!graph?.nodes || selectedNodeIds.length !== 1) return null
    return graph.nodes.find((n) => n.id === selectedNodeIds[0]) || null
  }, [graph?.nodes, selectedNodeIds])

  // Get connected nodes for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode || !graph?.edges || !graph?.nodes) return []

    const connectedIds = new Set<string>()
    for (const edge of graph.edges) {
      if (edge.source === selectedNode.id) {
        connectedIds.add(edge.target)
      } else if (edge.target === selectedNode.id) {
        connectedIds.add(edge.source)
      }
    }

    return graph.nodes.filter((n) => connectedIds.has(n.id))
  }, [selectedNode, graph?.edges, graph?.nodes])

  // Navigate to source
  const handleNavigate = useCallback(
    (sourceTable: string, sourceId: string) => {
      const routeMap: Record<string, string> = {
        projects: `/project/${sourceId}`,
        unified_tasks: `/tasks?id=${sourceId}`,
        business_plans: `/company/government-programs/business-plan?id=${sourceId}`,
        team_members: `/company/team?member=${sourceId}`,
        deployed_agents: `/agents/${sourceId}`,
        objectives: `/okr?objective=${sourceId}`,
        key_results: `/okr?kr=${sourceId}`,
        government_programs: `/company/government-programs/${sourceId}`,
        program_applications: `/company/government-programs/applications?id=${sourceId}`,
        project_milestones: `/project/milestones?id=${sourceId}`,
        project_budgets: `/project/budgets?id=${sourceId}`,
      }

      const route = routeMap[sourceTable]
      if (route) {
        router.push(route)
      }
    },
    [router]
  )

  // Toggle folder
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Group nodes by category for FileTree
  const groupedNodes = useMemo(() => {
    const emptyMap = new Map<string, MyNeuronNode[]>()
    if (!graph?.nodes) return emptyMap

    const groups = new Map<string, MyNeuronNode[]>()

    // Initialize all categories
    FILE_TREE_CATEGORIES.forEach(cat => {
      groups.set(cat.id, [])
    })

    // Group nodes by category (exclude 'self' node)
    graph.nodes.forEach(node => {
      if (node.type === 'self') return

      const category = FILE_TREE_CATEGORIES.find(cat =>
        cat.types.includes(node.type)
      )
      if (category) {
        const existing = groups.get(category.id) || []
        existing.push(node)
        groups.set(category.id, existing)
      }
    })

    return groups
  }, [graph?.nodes])

  // Filter nodes by search query
  const filteredGroupedNodes = useMemo(() => {
    if (!searchQuery.trim()) return groupedNodes

    const query = searchQuery.toLowerCase()
    const filtered = new Map<string, MyNeuronNode[]>()

    groupedNodes.forEach((nodes, categoryId) => {
      const matchingNodes = nodes.filter(node =>
        node.title.toLowerCase().includes(query) ||
        node.summary?.toLowerCase().includes(query)
      )
      filtered.set(categoryId, matchingNodes)
    })

    return filtered
  }, [groupedNodes, searchQuery])

  // Handle node click in FileTree
  const handleFileTreeNodeClick = useCallback((node: MyNeuronNode) => {
    selectNode(node.id)
  }, [selectNode])

  // Get total nodes count (excluding self)
  const totalNodesCount = useMemo(() => {
    if (!graph?.nodes) return 0
    return graph.nodes.filter(n => n.type !== 'self').length
  }, [graph?.nodes])

  return (
    <div className="h-full flex flex-col bg-[#050510] overflow-hidden">
      {/* ===== Top Toolbar ===== */}
      <header className="flex-shrink-0 h-12 border-b border-zinc-800 flex items-center px-4 gap-4 bg-[#0a0a12]">
        {/* Logo & Title */}
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-white">My Neural Map</span>
        </div>

        {/* Mode Selector */}
        <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300">
          <option>Mode: Auto</option>
          <option>Mode: Manual</option>
        </select>

        {/* View Tab Selector */}
        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              title={tab.description}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors',
                viewMode === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right Actions */}
        <button
          onClick={toggleLabels}
          className={cn(
            'p-1.5 rounded transition-colors',
            showLabels ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
          )}
          title={showLabels ? '라벨 숨기기' : '라벨 표시'}
        >
          {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        <button className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors" title="테마">
          <Palette className="w-4 h-4" />
        </button>

        <button
          onClick={fetchGraph}
          disabled={isLoading}
          className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>

        <button className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors" title="내보내기">
          <Download className="w-4 h-4" />
        </button>

        <button className="p-1.5 rounded text-zinc-400 hover:text-white transition-colors" title="설정">
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* ===== Main Content (3 Panels) ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ===== Left Panel - File Tree ===== */}
        <aside
          className={cn(
            'flex-shrink-0 border-r border-zinc-800 bg-[#0a0a12] transition-all duration-300 overflow-hidden flex flex-col',
            leftPanelOpen ? '' : 'w-0'
          )}
          style={{ width: leftPanelOpen ? leftPanelWidth : 0 }}
        >
          {leftPanelOpen && (
            <>
              {/* Search */}
              <div className="p-3 border-b border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* File Tree - 실제 사용자 데이터 기반 */}
              <div className="flex-1 overflow-y-auto p-2">
                {/* 총 노드 수 표시 */}
                <div className="px-2 py-1.5 mb-2 text-xs text-zinc-500 border-b border-zinc-800">
                  내 뇌 속 뉴런: {totalNodesCount}개
                </div>

                {/* Dynamic Categories */}
                {FILE_TREE_CATEGORIES.map(category => {
                  const nodes = filteredGroupedNodes.get(category.id) || []
                  const CategoryIcon = category.icon

                  // 노드가 없는 카테고리는 숨김 (검색 중이 아닐 때만)
                  if (nodes.length === 0 && !searchQuery) return null

                  return (
                    <div key={category.id} className="mb-1">
                      <button
                        onClick={() => toggleFolder(category.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-zinc-300"
                      >
                        {expandedFolders.has(category.id) ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )}
                        <CategoryIcon className={cn('w-4 h-4', category.color)} />
                        <span className="text-sm">{category.label}</span>
                        <span className="ml-auto text-xs text-zinc-500">{nodes.length}</span>
                      </button>

                      {expandedFolders.has(category.id) && nodes.length > 0 && (
                        <div className="ml-6 space-y-0.5">
                          {nodes.map(node => {
                            const NodeIcon = NODE_TYPE_ICONS[node.type] || Circle
                            const isSelected = selectedNodeIds.includes(node.id)

                            return (
                              <button
                                key={node.id}
                                onClick={() => handleFileTreeNodeClick(node)}
                                className={cn(
                                  'w-full flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors',
                                  isSelected
                                    ? 'bg-blue-600/20 text-blue-400'
                                    : 'hover:bg-zinc-800 text-zinc-400'
                                )}
                              >
                                <NodeIcon className={cn(
                                  'w-3.5 h-3.5 flex-shrink-0',
                                  isSelected ? 'text-blue-400' : 'text-zinc-500'
                                )} />
                                <span className="truncate">{node.title}</span>
                                {node.status === 'blocked' && (
                                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                )}
                                {node.status === 'urgent' && (
                                  <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* 검색 결과 없음 */}
                {searchQuery && totalNodesCount === 0 && (
                  <div className="px-2 py-8 text-center text-zinc-500 text-sm">
                    검색 결과가 없습니다
                  </div>
                )}

                {/* 데이터 없음 */}
                {!searchQuery && totalNodesCount === 0 && !isLoading && (
                  <div className="px-2 py-8 text-center text-zinc-500 text-sm">
                    아직 뉴런이 없습니다.<br />
                    GlowUS에서 활동을 시작하세요!
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <div className="p-3 border-t border-zinc-800">
                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors">
                  <Upload className="w-4 h-4" />
                  파일 업로드
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Left Panel Toggle */}
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="absolute top-1/2 -translate-y-1/2 z-20 p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-r-lg border border-l-0 border-zinc-700 transition-colors"
          style={{ left: leftPanelOpen ? leftPanelWidth : 0 }}
        >
          {leftPanelOpen ? (
            <PanelLeftClose className="w-4 h-4 text-zinc-400" />
          ) : (
            <PanelLeftOpen className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {/* ===== Center - 3D Neural Map ===== */}
        <main className="flex-1 relative flex flex-col">
          {/* 3D Canvas */}
          <div className="flex-1 relative">
            {isLoading && !graph ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#050510]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="text-zinc-400 text-sm">마이뉴런을 불러오는 중...</span>
                </div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#050510]">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="text-red-400 text-sm">{error}</div>
                  <button
                    onClick={fetchGraph}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            ) : (
              <NeuronsCanvas
                onNodeClick={(node) => console.log('Node clicked:', node)}
                onBackgroundClick={clearSelection}
              />
            )}
          </div>

          {/* Stats Overlay */}
          {graph && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/80 backdrop-blur border border-zinc-800 text-xs text-zinc-400">
              <span className="text-amber-400">{graph.stats?.totalNodes || 0}</span>
              <span>노드</span>
              <span className="text-zinc-600">•</span>
              <span className="text-blue-400">{graph.stats?.totalEdges || 0}</span>
              <span>연결</span>
              {graph.stats?.blockedTasks > 0 && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="text-red-400">{graph.stats.blockedTasks}</span>
                  <span>차단</span>
                </>
              )}
              {graph.lastSyncAt && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span>
                    {new Date(graph.lastSyncAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </>
              )}
            </div>
          )}
        </main>

      </div>
    </div>
  )
}
