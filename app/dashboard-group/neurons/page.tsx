'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useMyNeuronsStore } from '@/lib/my-neurons/store'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { MyNeuronNode } from '@/lib/my-neurons/types'
import type { NeuralFile } from '@/lib/neural-map/types'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useTheme } from 'next-themes'
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
import { NodeDetailPanel } from '@/components/my-neurons/panels/NodeDetailPanel'
import { MarkdownEditorPanel } from '@/components/neural-map/panels/MarkdownEditorPanel'

// Dynamic import for 3D canvas (SSR 비활성화)
const NeuronsCanvas = dynamic(
  () => import('@/components/my-neurons/canvas/NeuronsCanvas').then(mod => mod.NeuronsCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#050510]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <span className="text-zinc-400 text-sm">3D 뉴런 맵 로딩 중...</span>
        </div>
      </div>
    ),
  }
)

// Dynamic import for 2D canvas (Obsidian style)
const Neurons2DCanvas = dynamic(
  () => import('@/components/my-neurons/canvas/Neurons2DCanvas').then(mod => mod.Neurons2DCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#050510]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <span className="text-zinc-400 text-sm">2D 뉴런 맵 로딩 중...</span>
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
    color: 'text-orange-400'
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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

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

  // Neural Map Store - 마크다운 에디터용
  const editorOpen = useNeuralMapStore((s) => s.editorOpen)
  const editorCollapsed = useNeuralMapStore((s) => s.editorCollapsed)
  const editingFile = useNeuralMapStore((s) => s.editingFile)
  const rightPanelCollapsed = useNeuralMapStore((s) => s.rightPanelCollapsed)
  const toggleRightPanel = useNeuralMapStore((s) => s.toggleRightPanel)

  // Theme store
  const accentColor = useThemeStore((s) => s.accentColor)
  const themeConfig = useMemo(() => {
    return accentColors.find(c => c.id === accentColor) || accentColors[0]
  }, [accentColor])

  // Local state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [leftPanelWidth] = useState(280)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [rightPanelWidth] = useState(360)
  const [canvasMode, setCanvasMode] = useState<'2d' | '3d'>('2d') // 기본값 2D (옵시디언 스타일)
  const [clickedNode, setClickedNode] = useState<MyNeuronNode | null>(null) // 클릭된 노드 직접 저장
  const [markdownEditorOpen, setMarkdownEditorOpen] = useState(false) // 마크다운 에디터 열림 상태
  const [markdownEditorCollapsed, setMarkdownEditorCollapsed] = useState(false) // 마크다운 에디터 접힘 상태
  // viewMode from store
  const viewMode = useMyNeuronsStore((s) => s.viewMode)
  const setViewMode = useMyNeuronsStore((s) => s.setViewMode)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['projects', 'tasks']))

  // SWR fetcher
  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Failed to fetch graph data')
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Unknown error')
    return data
  }, [])

  // SWR로 데이터 페칭 + 캐싱 (페이지 재방문 시 즉시 로딩)
  const { data: graphData, error: swrError, isLoading: swrLoading, mutate } = useSWR(
    '/api/my-neurons/graph',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30초간 중복 요청 방지
      keepPreviousData: true, // 이전 데이터 유지 (빠른 페이지 전환)
    }
  )

  // SWR 데이터를 store에 동기화
  useEffect(() => {
    if (graphData) {
      setGraph(graphData.data)
      setBottlenecks(graphData.bottlenecks || [])
      setPriorities(graphData.priorities || [])
      setLoading(false)
    }
  }, [graphData, setGraph, setBottlenecks, setPriorities, setLoading])

  // SWR 에러 처리
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (swrError) {
      setError(swrError.message)
      setLoading(false)
    }
  }, [swrError, setLoading])

  // 수동 새로고침
  const fetchGraph = useCallback(() => {
    setLoading(true)
    setError(null)
    mutate()
  }, [mutate, setLoading])

  // Get selected node
  const selectedNode = useMemo(() => {
    if (!graph?.nodes || selectedNodeIds.length !== 1) return null
    return graph.nodes.find((n) => n.id === selectedNodeIds[0]) || null
  }, [graph?.nodes, selectedNodeIds])

  // Get connected nodes for clicked node
  const connectedNodes = useMemo(() => {
    if (!clickedNode || !graph?.edges || !graph?.nodes) return []

    const connectedIds = new Set<string>()
    for (const edge of graph.edges) {
      if (edge.source === clickedNode.id) {
        connectedIds.add(edge.target)
      } else if (edge.target === clickedNode.id) {
        connectedIds.add(edge.source)
      }
    }

    return graph.nodes.filter((n) => connectedIds.has(n.id))
  }, [clickedNode, graph?.edges, graph?.nodes])

  // 디버깅용 로그 (clickedNode 변경 시)
  useEffect(() => {
    console.log('[NeuronsPage] clickedNode changed:', clickedNode?.id, clickedNode?.title, 'rightPanelOpen:', rightPanelOpen)
  }, [clickedNode, rightPanelOpen])

  // 우측 패널 닫기 핸들러
  const handleCloseRightPanel = useCallback(() => {
    setRightPanelOpen(false)
    setClickedNode(null)
    clearSelection()
  }, [clearSelection])

  // 마크다운 에디터 닫기 핸들러
  const handleCloseEditor = useCallback(() => {
    setMarkdownEditorOpen(false)
    useNeuralMapStore.setState({
      editingFile: null,
      editorOpen: false
    })
  }, [])

  // 마크다운 에디터 접기/펼기 토글
  const handleToggleEditorCollapse = useCallback(() => {
    setMarkdownEditorCollapsed(prev => !prev)
  }, [])

  // 노드 선택 핸들러 (연결된 노드 클릭 시)
  const handleSelectConnectedNode = useCallback((nodeId: string) => {
    selectNode(nodeId)
    // 연결된 노드를 찾아서 clickedNode 설정
    const connectedNode = graph?.nodes.find(n => n.id === nodeId)
    if (connectedNode) {
      console.log('[NeuronsPage] Connected node clicked:', connectedNode.id, connectedNode.title)
      setClickedNode(connectedNode)
    }
  }, [selectNode, graph?.nodes])

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

  // 노드 타입별 한글 라벨 (마크다운 생성용)
  const NODE_TYPE_KO_LABELS: Record<MyNeuronType, string> = {
    self: '나',
    project: '프로젝트',
    task: '작업',
    doc: '문서',
    person: '팀원',
    agent: 'AI 에이전트',
    objective: '목표',
    key_result: '핵심 결과',
    decision: '의사결정',
    memory: '기록',
    workflow: '워크플로우',
    insight: '인사이트',
    program: '정부지원사업',
    application: '지원서',
    milestone: '마일스톤',
    budget: '예산',
  }

  // 상태별 한글 라벨과 이모지
  const STATUS_LABELS: Record<string, { label: string; emoji: string }> = {
    active: { label: '진행 중', emoji: '🟢' },
    blocked: { label: '차단됨', emoji: '🔴' },
    urgent: { label: '긴급', emoji: '🟠' },
    waiting: { label: '대기 중', emoji: '🟡' },
    completed: { label: '완료', emoji: '✅' },
    attention: { label: '주의 필요', emoji: '⚠️' },
  }

  // 우선순위별 한글 라벨
  const PRIORITY_LABELS: Record<string, string> = {
    critical: '🔥 최우선',
    high: '⬆️ 높음',
    medium: '➡️ 보통',
    low: '⬇️ 낮음',
  }

  // 연결된 노드 정보 생성
  const getConnectedNodesInfo = useCallback((nodeId: string): string => {
    if (!graph?.edges || !graph?.nodes) return ''

    const connections: { type: string; nodes: MyNeuronNode[] }[] = []
    const incomingIds = new Set<string>()
    const outgoingIds = new Set<string>()

    for (const edge of graph.edges) {
      if (edge.source === nodeId) outgoingIds.add(edge.target)
      if (edge.target === nodeId) incomingIds.add(edge.source)
    }

    const incoming = graph.nodes.filter(n => incomingIds.has(n.id))
    const outgoing = graph.nodes.filter(n => outgoingIds.has(n.id))

    let result = ''
    if (incoming.length > 0) {
      result += `### 연결된 상위 항목\n`
      incoming.forEach(n => {
        result += `- [[${n.title}]] (${NODE_TYPE_KO_LABELS[n.type] || n.type})\n`
      })
      result += '\n'
    }
    if (outgoing.length > 0) {
      result += `### 연결된 하위 항목\n`
      outgoing.forEach(n => {
        result += `- [[${n.title}]] (${NODE_TYPE_KO_LABELS[n.type] || n.type})\n`
      })
      result += '\n'
    }
    return result
  }, [graph?.edges, graph?.nodes])

  // MyNeuronNode를 NeuralFile로 변환 - 타입별 풍부한 콘텐츠 생성
  const convertNodeToFile = useCallback((node: MyNeuronNode): NeuralFile => {
    const createdAtStr = node.createdAt || new Date().toISOString()
    const updatedAtStr = node.updatedAt || createdAtStr
    const statusInfo = STATUS_LABELS[node.status] || { label: node.status, emoji: '⚪' }
    const priorityLabel = PRIORITY_LABELS[node.priority] || node.priority
    const typeLabel = NODE_TYPE_KO_LABELS[node.type] || node.type

    // 기본 헤더 섹션
    let markdownContent = `# ${node.title}\n\n`

    // 상태 배지
    markdownContent += `> ${statusInfo.emoji} **${statusInfo.label}** | ${priorityLabel} | 중요도 ${node.importance || 5}/10\n\n`

    // 요약 (있는 경우)
    if (node.summary) {
      markdownContent += `## 📋 요약\n${node.summary}\n\n`
    }

    // 콘텐츠 (있는 경우)
    if (node.content) {
      markdownContent += `## 📝 상세 내용\n${node.content}\n\n`
    }

    // 타입별 세부 섹션
    switch (node.type) {
      case 'project':
        markdownContent += `## 🏗️ 프로젝트 정보\n`
        if (node.progress !== undefined) {
          markdownContent += `- **진행률**: ${node.progress}%\n`
          markdownContent += `\`${'█'.repeat(Math.floor(node.progress / 10))}${'░'.repeat(10 - Math.floor(node.progress / 10))}\` ${node.progress}%\n`
        }
        if (node.deadline) {
          markdownContent += `- **마감일**: ${new Date(node.deadline).toLocaleDateString('ko-KR')}`
          if (node.daysUntilDeadline !== undefined) {
            markdownContent += ` (${node.daysUntilDeadline > 0 ? `D-${node.daysUntilDeadline}` : node.daysUntilDeadline === 0 ? 'D-Day' : `D+${Math.abs(node.daysUntilDeadline)}`})`
          }
          markdownContent += '\n'
        }
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.description) markdownContent += `\n### 프로젝트 설명\n${data.description}\n`
          if (data.goals) markdownContent += `\n### 목표\n${data.goals}\n`
        }
        markdownContent += '\n'
        break

      case 'task':
        markdownContent += `## ✅ 작업 정보\n`
        if (node.progress !== undefined) {
          markdownContent += `- **진행률**: ${node.progress}%\n`
        }
        if (node.deadline) {
          const deadlineDate = new Date(node.deadline)
          const isOverdue = node.daysUntilDeadline !== undefined && node.daysUntilDeadline < 0
          markdownContent += `- **마감일**: ${deadlineDate.toLocaleDateString('ko-KR')} ${isOverdue ? '⚠️ 마감 초과!' : ''}\n`
        }
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.description) markdownContent += `\n### 작업 설명\n${data.description}\n`
          if (data.acceptance_criteria) markdownContent += `\n### 완료 기준\n${data.acceptance_criteria}\n`
          if (data.assigned_to) markdownContent += `- **담당자**: ${data.assigned_to}\n`
        }
        markdownContent += '\n'
        break

      case 'person':
        markdownContent += `## 👤 팀원 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.role) markdownContent += `- **역할**: ${data.role}\n`
          if (data.email) markdownContent += `- **이메일**: ${data.email}\n`
          if (data.department) markdownContent += `- **부서**: ${data.department}\n`
          if (data.skills) markdownContent += `- **스킬**: ${Array.isArray(data.skills) ? data.skills.join(', ') : data.skills}\n`
          if (data.bio) markdownContent += `\n### 소개\n${data.bio}\n`
        }
        markdownContent += '\n'
        break

      case 'agent':
        markdownContent += `## 🤖 AI 에이전트 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.model) markdownContent += `- **모델**: ${data.model}\n`
          if (data.capabilities) markdownContent += `- **능력**: ${Array.isArray(data.capabilities) ? data.capabilities.join(', ') : data.capabilities}\n`
          if (data.status) markdownContent += `- **상태**: ${data.status}\n`
          if (data.description) markdownContent += `\n### 설명\n${data.description}\n`
          if (data.system_prompt) markdownContent += `\n### 시스템 프롬프트\n\`\`\`\n${String(data.system_prompt).slice(0, 500)}${String(data.system_prompt).length > 500 ? '...' : ''}\n\`\`\`\n`
        }
        markdownContent += '\n'
        break

      case 'objective':
        markdownContent += `## 🎯 목표 정보\n`
        if (node.progress !== undefined) {
          markdownContent += `- **달성률**: ${node.progress}%\n`
          markdownContent += `\`${'█'.repeat(Math.floor(node.progress / 10))}${'░'.repeat(10 - Math.floor(node.progress / 10))}\` ${node.progress}%\n`
        }
        if (node.deadline) {
          markdownContent += `- **목표 기간**: ~ ${new Date(node.deadline).toLocaleDateString('ko-KR')}\n`
        }
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.description) markdownContent += `\n### 목표 설명\n${data.description}\n`
        }
        markdownContent += '\n'
        break

      case 'key_result':
        markdownContent += `## 📊 핵심 결과 (KR) 정보\n`
        if (node.progress !== undefined) {
          markdownContent += `- **현재 달성률**: ${node.progress}%\n`
        }
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.target_value) markdownContent += `- **목표 수치**: ${data.target_value}\n`
          if (data.current_value) markdownContent += `- **현재 수치**: ${data.current_value}\n`
          if (data.unit) markdownContent += `- **단위**: ${data.unit}\n`
        }
        markdownContent += '\n'
        break

      case 'program':
        markdownContent += `## 🏛️ 정부지원사업 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.organization) markdownContent += `- **주관기관**: ${data.organization}\n`
          if (data.support_amount) markdownContent += `- **지원금액**: ${Number(data.support_amount).toLocaleString()}원\n`
          if (data.application_period) markdownContent += `- **신청기간**: ${data.application_period}\n`
          if (data.eligibility) markdownContent += `\n### 신청자격\n${data.eligibility}\n`
          if (data.description) markdownContent += `\n### 사업 설명\n${data.description}\n`
        }
        markdownContent += '\n'
        break

      case 'application':
        markdownContent += `## 📄 지원서 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.program_name) markdownContent += `- **대상 사업**: ${data.program_name}\n`
          if (data.submitted_at) markdownContent += `- **제출일**: ${new Date(data.submitted_at as string).toLocaleDateString('ko-KR')}\n`
          if (data.status) markdownContent += `- **진행상태**: ${data.status}\n`
        }
        markdownContent += '\n'
        break

      case 'milestone':
        markdownContent += `## 🏁 마일스톤 정보\n`
        if (node.deadline) {
          markdownContent += `- **목표일**: ${new Date(node.deadline).toLocaleDateString('ko-KR')}\n`
        }
        if (node.progress !== undefined) {
          markdownContent += `- **완료율**: ${node.progress}%\n`
        }
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.deliverables) markdownContent += `\n### 산출물\n${data.deliverables}\n`
        }
        markdownContent += '\n'
        break

      case 'budget':
        markdownContent += `## 💰 예산 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.total_budget) markdownContent += `- **총 예산**: ${Number(data.total_budget).toLocaleString()}원\n`
          if (data.spent_amount) markdownContent += `- **사용 금액**: ${Number(data.spent_amount).toLocaleString()}원\n`
          if (data.remaining) markdownContent += `- **잔여 금액**: ${Number(data.remaining).toLocaleString()}원\n`
          if (data.category) markdownContent += `- **분류**: ${data.category}\n`
        }
        markdownContent += '\n'
        break

      case 'doc':
        markdownContent += `## 📑 문서 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.document_type) markdownContent += `- **문서 유형**: ${data.document_type}\n`
          if (data.version) markdownContent += `- **버전**: ${data.version}\n`
          if (data.author) markdownContent += `- **작성자**: ${data.author}\n`
        }
        markdownContent += '\n'
        break

      case 'workflow':
        markdownContent += `## ⚡ 워크플로우 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.steps) markdownContent += `- **단계 수**: ${Array.isArray(data.steps) ? data.steps.length : 'N/A'}\n`
          if (data.trigger) markdownContent += `- **트리거**: ${data.trigger}\n`
        }
        markdownContent += '\n'
        break

      case 'insight':
        markdownContent += `## 💡 인사이트 정보\n`
        if (node.sourceData) {
          const data = node.sourceData as Record<string, unknown>
          if (data.recommendation) markdownContent += `\n### AI 추천\n${data.recommendation}\n`
          if (data.confidence) markdownContent += `- **신뢰도**: ${data.confidence}%\n`
        }
        markdownContent += '\n'
        break

      case 'memory':
        markdownContent += `## 📝 기록 정보\n`
        if (node.lastActivityAt) {
          markdownContent += `- **기록 시간**: ${new Date(node.lastActivityAt).toLocaleString('ko-KR')}\n`
        }
        markdownContent += '\n'
        break

      default:
        // 기본 정보만 표시
        break
    }

    // 연결된 노드 정보
    const connectionInfo = getConnectedNodesInfo(node.id)
    if (connectionInfo) {
      markdownContent += `## 🔗 연결\n${connectionInfo}`
    }

    // 태그
    if (node.tags && node.tags.length > 0) {
      markdownContent += `## 🏷️ 태그\n${node.tags.map(t => `#${t}`).join(' ')}\n\n`
    }

    // 메타 정보
    markdownContent += `---\n`
    markdownContent += `**타입**: ${typeLabel} | `
    markdownContent += `**생성**: ${new Date(createdAtStr).toLocaleDateString('ko-KR')} | `
    markdownContent += `**수정**: ${new Date(updatedAtStr).toLocaleDateString('ko-KR')}\n`
    markdownContent += `*원본: ${node.sourceTable}/${node.sourceId}*\n`

    return {
      id: node.id,
      mapId: 'my-neurons',
      name: `${node.title}.md`,
      path: `neurons/${node.type}/${node.title}.md`,
      type: 'markdown',
      url: '',
      size: markdownContent.length,
      content: markdownContent,
      createdAt: createdAtStr,
    }
  }, [getConnectedNodesInfo])

  // 노드 클릭 시 마크다운 에디터 열기
  const openNodeInEditor = useCallback((node: MyNeuronNode) => {
    console.log('[NeuronsPage] Opening node in editor:', node.id, node.title)
    const file = convertNodeToFile(node)
    // Neural Map Store에 editingFile 설정
    useNeuralMapStore.setState({
      editingFile: file,
      editorOpen: true,
      editorCollapsed: false
    })
    setMarkdownEditorOpen(true)
    setMarkdownEditorCollapsed(false)
    setClickedNode(node)
    selectNode(node.id)
  }, [convertNodeToFile, selectNode])

  // Handle node click in FileTree
  const handleFileTreeNodeClick = useCallback((node: MyNeuronNode) => {
    console.log('[NeuronsPage] FileTree Node clicked:', node.id, node.title)
    openNodeInEditor(node)
  }, [openNodeInEditor])

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
          <Brain className="w-5 h-5" style={{ color: themeConfig.color }} />
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
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              )}
              style={viewMode === tab.id ? { backgroundColor: themeConfig.color } : undefined}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* 2D/3D Toggle */}
        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          <button
            onClick={() => setCanvasMode('2d')}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              canvasMode === '2d'
                ? 'text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
            )}
            style={canvasMode === '2d' ? { backgroundColor: themeConfig.color } : undefined}
          >
            2D
          </button>
          <button
            onClick={() => setCanvasMode('3d')}
            className={cn(
              'px-3 py-1 rounded text-xs font-medium transition-colors',
              canvasMode === '3d'
                ? 'text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
            )}
            style={canvasMode === '3d' ? { backgroundColor: themeConfig.color } : undefined}
          >
            3D
          </button>
        </div>

        {/* Right Actions */}
        <button
          onClick={toggleLabels}
          className={cn(
            'p-1.5 rounded transition-colors',
            showLabels ? 'text-white' : 'text-zinc-400 hover:text-white'
          )}
          style={showLabels ? { backgroundColor: themeConfig.color } : undefined}
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
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
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
                                    ? ''
                                    : 'hover:bg-zinc-800 text-zinc-400'
                                )}
                                style={isSelected ? { backgroundColor: `${themeConfig.color}20`, color: themeConfig.color } : undefined}
                              >
                                <NodeIcon
                                  className="w-3.5 h-3.5 flex-shrink-0"
                                  style={{ color: isSelected ? themeConfig.color : undefined }}
                                />
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
        <main className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
          {/* 3D Canvas - overflow-hidden으로 캔버스가 부모 크기에 맞게 조절됨 */}
          <div className="flex-1 relative overflow-hidden">
            {isLoading && !graph ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#050510]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
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
            ) : canvasMode === '2d' ? (
              <Neurons2DCanvas
                onNodeClick={(node) => {
                  console.log('[NeuronsPage] 2D Node clicked:', node.id, node.title)
                  // 마크다운 에디터 열기
                  openNodeInEditor(node)
                }}
                onBackgroundClick={() => {
                  clearSelection()
                  setClickedNode(null)
                }}
              />
            ) : (
              <NeuronsCanvas
                onNodeClick={(node) => {
                  console.log('[NeuronsPage] 3D Node clicked:', node.id, node.title)
                  // 마크다운 에디터 열기
                  openNodeInEditor(node)
                }}
                onBackgroundClick={() => {
                  clearSelection()
                  setClickedNode(null)
                }}
              />
            )}
          </div>

          {/* Stats Overlay */}
          {graph && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/80 backdrop-blur border border-zinc-800 text-xs text-zinc-400">
              <span style={{ color: themeConfig.color }}>{graph.stats?.totalNodes || 0}</span>
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

        {/* Markdown Editor Panel - AI 코딩 페이지처럼 마크다운 에디터 + AI 채팅 */}
        <MarkdownEditorPanel
          isOpen={markdownEditorOpen}
          onClose={handleCloseEditor}
          isCollapsed={markdownEditorCollapsed}
          onToggleCollapse={handleToggleEditorCollapse}
        />


      </div>
    </div>
  )
}
