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
  Map,
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
import type { MyNeuronType } from '@/lib/my-neurons/types'
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
// View Tabs
// ============================================

type ViewTab = 'radial' | 'clusters' | 'pathfinder' | 'roadmap' | 'insights'

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'radial', label: 'Radial', icon: Target },
  { id: 'clusters', label: 'Clusters', icon: Workflow },
  { id: 'pathfinder', label: 'Pathfinder', icon: Route },
  { id: 'roadmap', label: 'Roadmap', icon: Map },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
]

// ============================================
// Right Panel Tabs
// ============================================

type RightTab = 'inspector' | 'actions' | 'chat'

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
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [leftPanelWidth, setLeftPanelWidth] = useState(280)
  const [rightPanelWidth, setRightPanelWidth] = useState(360)
  const [bottlenecks, setBottlenecksLocal] = useState<BottleneckInsight[]>([])
  const [priorities, setPrioritiesLocal] = useState<MyNeuronNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>('radial')
  const [rightTab, setRightTab] = useState<RightTab>('inspector')
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
        setBottlenecksLocal(data.bottlenecks || [])
        setPrioritiesLocal(data.priorities || [])
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
        node.description?.toLowerCase().includes(query)
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
              onClick={() => setActiveViewTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors',
                activeViewTab === tab.id
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

          {/* View Tabs (Bottom) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900/90 backdrop-blur rounded-lg p-1 border border-zinc-800">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveViewTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded text-sm transition-colors',
                  activeViewTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
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

        {/* Right Panel Toggle - 패널 닫혔을 때도 항상 보이도록 fixed 사용 */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className={cn(
            'z-30 p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-all',
            rightPanelOpen
              ? 'absolute top-1/2 -translate-y-1/2 rounded-l-lg border-r-0'
              : 'fixed top-1/2 -translate-y-1/2 rounded-l-lg border-r-0'
          )}
          style={{ right: rightPanelOpen ? rightPanelWidth : 0 }}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="w-4 h-4 text-zinc-400" />
          ) : (
            <PanelRightOpen className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {/* ===== Right Panel - Inspector/Actions/Chat ===== */}
        <aside
          className={cn(
            'flex-shrink-0 bg-[#0a0a12] transition-all duration-300 overflow-hidden flex flex-col',
            rightPanelOpen ? 'border-l border-zinc-800' : 'w-0'
          )}
          style={{ width: rightPanelOpen ? rightPanelWidth : 0 }}
        >
          {rightPanelOpen && (
            <>
              {/* Tab Header */}
              <div className="flex border-b border-zinc-800">
                <button
                  onClick={() => setRightTab('inspector')}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
                    rightTab === 'inspector'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  Inspector
                </button>
                <button
                  onClick={() => setRightTab('actions')}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
                    rightTab === 'actions'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  Actions
                </button>
                <button
                  onClick={() => setRightTab('chat')}
                  className={cn(
                    'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
                    rightTab === 'chat'
                      ? 'text-white border-b-2 border-blue-500'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  Chat
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {rightTab === 'inspector' && (
                  <div className="p-4">
                    {selectedNode ? (
                      <div className="space-y-4">
                        {/* Title */}
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">제목</label>
                          <input
                            type="text"
                            value={selectedNode.title}
                            readOnly
                            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm"
                          />
                        </div>

                        {/* Type */}
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">타입</label>
                          <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-300 capitalize">
                            {selectedNode.type}
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">상태</label>
                          <div className={cn(
                            'px-3 py-2 rounded text-sm capitalize',
                            selectedNode.status === 'blocked' && 'bg-red-500/20 text-red-400',
                            selectedNode.status === 'urgent' && 'bg-orange-500/20 text-orange-400',
                            selectedNode.status === 'active' && 'bg-emerald-500/20 text-emerald-400',
                            selectedNode.status === 'completed' && 'bg-zinc-500/20 text-zinc-400',
                            selectedNode.status === 'waiting' && 'bg-amber-500/20 text-amber-400',
                          )}>
                            {selectedNode.status}
                          </div>
                        </div>

                        {/* Summary */}
                        {selectedNode.summary && (
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">요약</label>
                            <p className="text-sm text-zinc-300">{selectedNode.summary}</p>
                          </div>
                        )}

                        {/* Tags */}
                        {selectedNode.tags && selectedNode.tags.length > 0 && (
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">태그</label>
                            <div className="flex flex-wrap gap-1">
                              {selectedNode.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Importance */}
                        <div>
                          <label className="block text-xs text-zinc-500 mb-1">
                            중요도: {selectedNode.importance}/10
                          </label>
                          <div className="w-full bg-zinc-800 rounded-full h-2">
                            <div
                              className="bg-blue-500 rounded-full h-2"
                              style={{ width: `${selectedNode.importance * 10}%` }}
                            />
                          </div>
                        </div>

                        {/* Progress */}
                        {selectedNode.progress !== undefined && (
                          <div>
                            <label className="block text-xs text-zinc-500 mb-1">
                              진행률: {selectedNode.progress}%
                            </label>
                            <div className="w-full bg-zinc-800 rounded-full h-2">
                              <div
                                className="bg-emerald-500 rounded-full h-2"
                                style={{ width: `${selectedNode.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Connected Nodes */}
                        {connectedNodes.length > 0 && (
                          <div>
                            <label className="block text-xs text-zinc-500 mb-2">
                              연결된 노드 ({connectedNodes.length})
                            </label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {connectedNodes.map((node) => (
                                <div
                                  key={node.id}
                                  className="flex items-center gap-2 px-2 py-1.5 bg-zinc-800 rounded text-sm cursor-pointer hover:bg-zinc-700"
                                >
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{
                                      backgroundColor:
                                        node.status === 'blocked'
                                          ? '#EF4444'
                                          : node.status === 'urgent'
                                          ? '#F97316'
                                          : '#3B82F6',
                                    }}
                                  />
                                  <span className="text-zinc-300 truncate">{node.title}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Navigate to Source */}
                        <button
                          onClick={() => handleNavigate(selectedNode.sourceTable, selectedNode.sourceId)}
                          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                        >
                          원본으로 이동
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm">
                        <Info className="w-8 h-8 mb-2 text-zinc-600" />
                        <p>노드를 선택하세요</p>
                      </div>
                    )}
                  </div>
                )}

                {rightTab === 'actions' && (
                  <div className="p-4">
                    {selectedNode ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                          <Expand className="w-4 h-4" />
                          확장
                        </button>
                        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                          <Shrink className="w-4 h-4" />
                          축소
                        </button>
                        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                          <Plus className="w-4 h-4" />
                          자식 추가
                        </button>
                        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                          <Link className="w-4 h-4" />
                          연결
                        </button>
                        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 text-sm transition-colors">
                          <Pin className="w-4 h-4" />
                          고정
                        </button>
                        <button className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm transition-colors">
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 text-sm">
                        <Zap className="w-8 h-8 mb-2 text-zinc-600" />
                        <p>노드를 선택하여 액션을 실행하세요</p>
                      </div>
                    )}
                  </div>
                )}

                {rightTab === 'chat' && (
                  <div className="flex flex-col h-full">
                    {/* Chat Messages */}
                    <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <Brain className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 bg-zinc-800 rounded-lg p-3">
                          <p className="text-sm text-zinc-300">
                            안녕하세요! 선택된 노드나 클러스터에 대해 질문해주세요.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-zinc-800">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="이 노드에 대해 질문하세요..."
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                        />
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors">
                          전송
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
