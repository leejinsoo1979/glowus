'use client'

/**
 * BrainMapLayout - 에이전트 지식 그래프 레이아웃
 * 탭: 패스파인더, 클러스터, 로드맵
 *
 * 실제 기능:
 * - 패스파인더: BFS 경로 탐색 + 노드 자동완성
 * - 클러스터: DB 기반 클러스터링 + 3D 필터링
 * - 로드맵: 시간순 트리 구조 시각화
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import {
  Search,
  Filter,
  Download,
  Maximize2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Route,
  GitBranch,
  Network,
  Brain,
  Users,
  FileText,
  Lightbulb,
  Target,
  X,
  ZoomIn,
  ZoomOut,
  Loader2,
} from 'lucide-react'
import type { BrainNode, BrainCluster, BrainInsight, NodeType } from '@/types/brain-map'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { NodeDetailPopup } from './NodeDetailPopup'
import { RoadmapPanel } from './RoadmapPanel'
import { ClusterPanel } from './ClusterPanel'

// 검색 결과 타입
interface SearchResult {
  id: string
  title: string
  type: string
  source: string
}

// BrainMap3D를 동적 import (SSR 비활성화)
const BrainMap3D = dynamic(() => import('./BrainMap3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <span className="text-zinc-400 text-sm">3D 그래프 초기화 중...</span>
      </div>
    </div>
  ),
})

type TabType = 'pathfinder' | 'clusters' | 'roadmap'

const TABS = [
  { id: 'pathfinder' as TabType, label: '패스파인더', icon: Route },
  { id: 'clusters' as TabType, label: '클러스터', icon: Network },
  { id: 'roadmap' as TabType, label: '로드맵', icon: GitBranch },
]

// ClusterPanel에서 사용하므로 상수 제거

interface BrainMapLayoutProps {
  agentId: string
  isDark?: boolean
}

export function BrainMapLayout({ agentId, isDark = true }: BrainMapLayoutProps) {
  // 사용자 테마 색상
  const accentColor = useThemeStore((s) => s.accentColor)
  const userAccentHex = accentColors.find(c => c.id === accentColor)?.color || '#3b82f6'

  // State
  const [activeTab, setActiveTab] = useState<TabType>('pathfinder')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNode, setSelectedNode] = useState<BrainNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<BrainNode | null>(null)

  // Pathfinder state
  const [startNode, setStartNode] = useState('')
  const [endNode, setEndNode] = useState('')
  const [startNodeId, setStartNodeId] = useState<string | null>(null)
  const [endNodeId, setEndNodeId] = useState<string | null>(null)
  const [pathResults, setPathResults] = useState<any[]>([])
  const [pathNodes, setPathNodes] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)

  // Autocomplete state
  const [startSuggestions, setStartSuggestions] = useState<SearchResult[]>([])
  const [endSuggestions, setEndSuggestions] = useState<SearchResult[]>([])
  const [showStartSuggestions, setShowStartSuggestions] = useState(false)
  const [showEndSuggestions, setShowEndSuggestions] = useState(false)
  const [isLoadingStart, setIsLoadingStart] = useState(false)
  const [isLoadingEnd, setIsLoadingEnd] = useState(false)
  const startInputRef = useRef<HTMLInputElement>(null)
  const endInputRef = useRef<HTMLInputElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Cluster state (selectedCluster는 3D 그래프 하이라이트용으로 유지)
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)

  // Insights state
  const [insights, setInsights] = useState<BrainInsight[]>([])
  const [showAnalysis, setShowAnalysis] = useState(false)

  // 노드 타입 필터
  const [nodeTypeFilters, setNodeTypeFilters] = useState<Set<NodeType>>(new Set())

  // 하이라이트할 노드 ID들
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set())

  // 클러스터 데이터는 ClusterPanel에서 처리

  // Insights 로드
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/brain/insights`)
        if (res.ok) {
          const data = await res.json()
          setInsights(data.insightItems || [])
        }
      } catch (error) {
        console.error('Failed to fetch insights:', error)
      }
    }
    fetchInsights()
  }, [agentId])

  // 노드 검색 (자동완성)
  const searchNodes = useCallback(async (query: string, type: 'start' | 'end') => {
    if (query.length < 1) {
      if (type === 'start') setStartSuggestions([])
      else setEndSuggestions([])
      return
    }

    if (type === 'start') setIsLoadingStart(true)
    else setIsLoadingEnd(true)

    try {
      const res = await fetch(`/api/agents/${agentId}/brain/nodes/search?q=${encodeURIComponent(query)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        if (type === 'start') {
          setStartSuggestions(data.nodes || [])
          setShowStartSuggestions(true)
        } else {
          setEndSuggestions(data.nodes || [])
          setShowEndSuggestions(true)
        }
      }
    } catch (error) {
      console.error('Node search failed:', error)
    } finally {
      if (type === 'start') setIsLoadingStart(false)
      else setIsLoadingEnd(false)
    }
  }, [agentId])

  // 디바운스 검색
  const handleInputChange = useCallback((value: string, type: 'start' | 'end') => {
    if (type === 'start') {
      setStartNode(value)
      setStartNodeId(null)
    } else {
      setEndNode(value)
      setEndNodeId(null)
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      searchNodes(value, type)
    }, 300)
  }, [searchNodes])

  // 자동완성 선택
  const handleSuggestionSelect = (node: SearchResult, type: 'start' | 'end') => {
    if (type === 'start') {
      setStartNode(node.title)
      setStartNodeId(node.id)
      setShowStartSuggestions(false)
    } else {
      setEndNode(node.title)
      setEndNodeId(node.id)
      setShowEndSuggestions(false)
    }
  }

  // 패스파인더 검색
  const handlePathSearch = async () => {
    if (!startNode || !endNode) return

    setIsSearching(true)
    setPathError(null)
    setPathResults([])
    setPathNodes([])

    try {
      const fromParam = startNodeId || startNode
      const toParam = endNodeId || endNode
      const res = await fetch(`/api/agents/${agentId}/brain/pathfinder?from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toParam)}`)

      if (res.ok) {
        const data = await res.json()
        if (data.found && data.trace) {
          setPathResults(data.trace.steps || [])
          setPathNodes(data.pathNodes || [])
          // 경로의 노드들 하이라이트
          const nodeIds = new Set<string>()
          data.path?.forEach((id: string) => nodeIds.add(id))
          setHighlightNodes(nodeIds)
        } else {
          setPathError(data.message || '경로를 찾을 수 없습니다.')
        }
      } else {
        const errData = await res.json()
        setPathError(errData.error || '경로 탐색 실패')
      }
    } catch (error) {
      console.error('Path search failed:', error)
      setPathError('경로 탐색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  // 경로 초기화
  const handleClearPath = () => {
    setStartNode('')
    setEndNode('')
    setStartNodeId(null)
    setEndNodeId(null)
    setPathResults([])
    setPathNodes([])
    setPathError(null)
    setHighlightNodes(new Set())
  }

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback((node: BrainNode) => {
    setSelectedNode(node)
  }, [])

  // 노드 호버 핸들러
  const handleNodeHover = useCallback((node: BrainNode | null) => {
    setHoveredNode(node)
  }, [])

  // 노드 타입 필터 토글
  const toggleNodeTypeFilter = (type: NodeType) => {
    const newFilters = new Set(nodeTypeFilters)
    if (newFilters.has(type)) {
      newFilters.delete(type)
    } else {
      newFilters.add(type)
    }
    setNodeTypeFilters(newFilters)
  }

  return (
    <div className={cn('w-full h-full flex', isDark ? 'bg-zinc-950' : 'bg-white')}>
      {/* 사이드바 */}
      <div
        className={cn(
          'h-full border-r flex flex-col transition-all duration-300',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200',
          sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
        )}
      >
        {/* 탭 헤더 */}
        <div className={cn('p-4 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'text-white'
                      : isDark
                        ? 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                  )}
                  style={activeTab === tab.id ? { backgroundColor: userAccentHex } : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 패스파인더 */}
          {activeTab === 'pathfinder' && (
            <div className="space-y-4">
              {/* 시작 지점 */}
              <div className="space-y-2">
                <label className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  시작 지점
                </label>
                <div className="relative">
                  <input
                    ref={startInputRef}
                    type="text"
                    value={startNode}
                    onChange={(e) => handleInputChange(e.target.value, 'start')}
                    onFocus={() => startSuggestions.length > 0 && setShowStartSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowStartSuggestions(false), 200)}
                    placeholder="노드 검색..."
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400',
                      'border focus:outline-none focus:ring-2',
                      startNodeId ? 'ring-2' : ''
                    )}
                    style={startNodeId ? { borderColor: userAccentHex, boxShadow: `0 0 0 2px ${userAccentHex}40` } : undefined}
                  />
                  {isLoadingStart ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: userAccentHex }} />
                  ) : (
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  )}

                  {/* 시작 노드 자동완성 드롭다운 */}
                  {showStartSuggestions && startSuggestions.length > 0 && (
                    <div className={cn(
                      'absolute z-50 w-full mt-1 py-1 rounded-lg shadow-lg max-h-48 overflow-y-auto',
                      isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'
                    )}>
                      {startSuggestions.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleSuggestionSelect(node, 'start')}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm transition-colors',
                            isDark ? 'hover:bg-zinc-700 text-zinc-200' : 'hover:bg-zinc-100 text-zinc-800'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                            )}>
                              {node.type}
                            </span>
                            <span className="truncate">{node.title}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 종료 지점 */}
              <div className="space-y-2">
                <label className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  종료 지점
                </label>
                <div className="relative">
                  <input
                    ref={endInputRef}
                    type="text"
                    value={endNode}
                    onChange={(e) => handleInputChange(e.target.value, 'end')}
                    onFocus={() => endSuggestions.length > 0 && setShowEndSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowEndSuggestions(false), 200)}
                    placeholder="노드 검색..."
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                        : 'bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400',
                      'border focus:outline-none focus:ring-2',
                      endNodeId ? 'ring-2' : ''
                    )}
                    style={endNodeId ? { borderColor: userAccentHex, boxShadow: `0 0 0 2px ${userAccentHex}40` } : undefined}
                  />
                  {isLoadingEnd ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: userAccentHex }} />
                  ) : (
                    <Target className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  )}

                  {/* 종료 노드 자동완성 드롭다운 */}
                  {showEndSuggestions && endSuggestions.length > 0 && (
                    <div className={cn(
                      'absolute z-50 w-full mt-1 py-1 rounded-lg shadow-lg max-h-48 overflow-y-auto',
                      isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'
                    )}>
                      {endSuggestions.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleSuggestionSelect(node, 'end')}
                          className={cn(
                            'w-full text-left px-3 py-2 text-sm transition-colors',
                            isDark ? 'hover:bg-zinc-700 text-zinc-200' : 'hover:bg-zinc-100 text-zinc-800'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-medium',
                              isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                            )}>
                              {node.type}
                            </span>
                            <span className="truncate">{node.title}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 검색/초기화 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={handlePathSearch}
                  disabled={!startNode || !endNode || isSearching}
                  className={cn(
                    'flex-1 py-2 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2',
                    startNode && endNode && !isSearching
                      ? 'text-white'
                      : isDark
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  )}
                  style={startNode && endNode && !isSearching ? { backgroundColor: userAccentHex } : undefined}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      탐색 중...
                    </>
                  ) : (
                    '경로 탐색'
                  )}
                </button>
                {(pathResults.length > 0 || pathError) && (
                  <button
                    onClick={handleClearPath}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm transition-colors',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600'
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 에러 메시지 */}
              {pathError && (
                <div className={cn(
                  'p-3 rounded-lg text-sm',
                  isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
                )}>
                  {pathError}
                </div>
              )}

              {/* 경로 결과 */}
              {pathNodes.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className={cn('text-sm font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <Route className="w-4 h-4" style={{ color: userAccentHex }} />
                    경로 ({pathNodes.length - 1}단계)
                  </h4>
                  <div className="space-y-1">
                    {pathNodes.map((node: any, idx: number) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg text-xs',
                          isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200',
                          idx === 0 && 'border-l-2 border-l-green-500',
                          idx === pathNodes.length - 1 && 'border-l-2'
                        )}
                        style={idx === pathNodes.length - 1 ? { borderLeftColor: userAccentHex } : undefined}
                      >
                        <span
                          className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                            idx === 0 ? 'bg-green-500 text-white' :
                            idx === pathNodes.length - 1 ? 'text-white' :
                            'bg-zinc-600 text-white'
                          )}
                          style={idx === pathNodes.length - 1 ? { backgroundColor: userAccentHex } : undefined}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={cn('truncate block', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                            {node.title || node.id}
                          </span>
                          {node.type && (
                            <span className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              {node.type}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 클러스터 - ClusterPanel 사용 */}
          {activeTab === 'clusters' && (
            <div className="h-full -mx-4 -my-4">
              <ClusterPanel
                agentId={agentId}
                isDark={isDark}
                onClusterSelect={(cluster, nodeIds) => {
                  if (cluster) {
                    setSelectedCluster(cluster.clusterId)
                    setHighlightNodes(new Set(nodeIds))
                  } else {
                    setSelectedCluster(null)
                    setHighlightNodes(new Set())
                  }
                }}
              />
            </div>
          )}

          {/* 로드맵 - 메인 뷰에서 표시 */}
          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                시간 순서에 따른 기억/이벤트 흐름을 타임라인으로 시각화합니다.
              </p>
              <div className={cn(
                'p-3 rounded-lg text-sm',
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
              )}>
                <p className="font-medium mb-1">사용법:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>일/주/월별 그룹 선택</li>
                  <li>이벤트 타입 필터링</li>
                  <li>이벤트 클릭하여 상세 보기</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        <div className={cn('p-4 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <button
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
            )}
          >
            <Download className="w-4 h-4" />
            데이터 다운로드
          </button>
        </div>
      </div>

      {/* 사이드바 토글 버튼 */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg transition-all',
          isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600',
          sidebarOpen ? 'ml-80' : 'ml-0'
        )}
      >
        {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* 메인 뷰 - 탭에 따라 다른 뷰 렌더링 */}
      <div className="flex-1 relative">
        {/* 패스파인더 & 클러스터: 3D 그래프 */}
        {(activeTab === 'pathfinder' || activeTab === 'clusters') && (
          <>
            <BrainMap3D
              agentId={agentId}
              isDark={isDark}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              highlightNodes={highlightNodes}
              showLabels={true}
              bloomStrength={1.5}
            />

            {/* 줌 컨트롤 */}
            <div className={cn(
              'absolute top-4 left-4 flex flex-col gap-1',
            )}>
              <button
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-white hover:bg-zinc-100 text-zinc-600',
                  'border',
                  isDark ? 'border-zinc-700' : 'border-zinc-200'
                )}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-white hover:bg-zinc-100 text-zinc-600',
                  'border',
                  isDark ? 'border-zinc-700' : 'border-zinc-200'
                )}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-white hover:bg-zinc-100 text-zinc-600',
                  'border',
                  isDark ? 'border-zinc-700' : 'border-zinc-200'
                )}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* 로드맵: 전체 화면 타임라인 */}
        {activeTab === 'roadmap' && (
          <div className={cn(
            'w-full h-full',
            isDark ? 'bg-zinc-950' : 'bg-white'
          )}>
            <RoadmapPanel
              agentId={agentId}
              isDark={isDark}
              onEventClick={(event) => {
                setHighlightNodes(new Set(event.relatedNodes))
              }}
            />
          </div>
        )}
      </div>

      {/* AI 분석 모달 */}
      {showAnalysis && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={cn(
            'w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden',
            isDark ? 'bg-zinc-900' : 'bg-white'
          )}>
            <div className={cn(
              'flex items-center justify-between p-4 border-b',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}>
              <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                AI 분석 결과
              </h3>
              <button
                onClick={() => setShowAnalysis(false)}
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {insights.length > 0 ? (
                insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-3 rounded-lg',
                      isDark ? 'bg-zinc-800' : 'bg-zinc-50 border border-zinc-200'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                          {insight.title}
                        </h4>
                        <p className={cn('text-xs mt-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                          {insight.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs',
                            isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                          )}>
                            {insight.category}
                          </span>
                          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                            신뢰도 {Math.round(insight.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className={cn('text-sm text-center py-8', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  분석 중...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 선택된 노드 상세 팝업 */}
      <NodeDetailPopup
        agentId={agentId}
        selectedNode={selectedNode}
        onClose={() => setSelectedNode(null)}
        onNodeSelect={handleNodeClick}
        isDark={isDark}
      />
    </div>
  )
}

export default BrainMapLayout
