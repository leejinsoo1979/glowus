'use client'

/**
 * NodeDetailPopup - 노드 상세 정보 + 관련 노드 팝업
 *
 * 기능:
 * - 선택된 노드의 상세 정보 표시
 * - 관련 노드 (시간/태그/인과 관계) 표시
 * - 관련 노드 클릭 시 해당 노드로 이동
 */

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  X,
  Brain,
  Clock,
  Tag,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Link2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
  Lightbulb,
  Target,
  MessageSquare,
  CheckSquare,
  Calendar,
} from 'lucide-react'
import type { BrainNode, BrainEdge } from '@/types/brain-map'

interface RelatedNode {
  node: BrainNode
  relationship: {
    type: string
    strength: number
    direction: 'incoming' | 'outgoing' | 'bidirectional'
  }
}

interface NodeDetailResponse {
  node: BrainNode & {
    dataSource: string
    rawData: Record<string, unknown>
  }
  relatedNodes: RelatedNode[]
  edges: BrainEdge[]
  stats: {
    connectionCount: number
    incomingCount: number
    outgoingCount: number
    avgStrength: number
  }
}

interface NodeDetailPopupProps {
  agentId: string
  selectedNode: BrainNode | null
  onClose: () => void
  onNodeSelect: (node: BrainNode) => void
  isDark?: boolean
}

// 노드 타입별 아이콘
const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  memory: MessageSquare,
  task: CheckSquare,
  meeting: Calendar,
  decision: GitBranch,
  concept: Lightbulb,
  skill: Target,
  person: Users,
  self: Brain,
}

// 노드 타입별 색상
const NODE_TYPE_COLORS: Record<string, string> = {
  memory: 'from-blue-500 to-cyan-500',
  task: 'from-green-500 to-emerald-500',
  meeting: 'from-purple-500 to-violet-500',
  decision: 'from-orange-500 to-amber-500',
  concept: 'from-pink-500 to-rose-500',
  skill: 'from-teal-500 to-cyan-500',
  person: 'from-indigo-500 to-blue-500',
  self: 'from-cyan-500 to-blue-500',
}

// 관계 타입별 아이콘
const RELATIONSHIP_ICONS: Record<string, React.ElementType> = {
  temporal: Clock,
  semantic: Tag,
  causal: GitBranch,
  follows: ArrowRight,
  related: Link2,
}

export function NodeDetailPopup({
  agentId,
  selectedNode,
  onClose,
  onNodeSelect,
  isDark = true,
}: NodeDetailPopupProps) {
  const [nodeDetail, setNodeDetail] = useState<NodeDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRelated, setShowRelated] = useState(true)

  // 노드 상세 정보 로드
  useEffect(() => {
    if (!selectedNode) {
      setNodeDetail(null)
      return
    }

    const fetchNodeDetail = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/agents/${agentId}/brain/nodes/${selectedNode.id}`)
        if (res.ok) {
          const data = await res.json()
          setNodeDetail(data)
        } else {
          const errData = await res.json()
          setError(errData.error || '노드 정보를 불러오지 못했습니다')
        }
      } catch (err) {
        console.error('Failed to fetch node detail:', err)
        setError('노드 정보 로드 중 오류가 발생했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    fetchNodeDetail()
  }, [agentId, selectedNode])

  // 관련 노드 클릭 핸들러
  const handleRelatedNodeClick = useCallback((node: BrainNode) => {
    onNodeSelect(node)
  }, [onNodeSelect])

  // 시간 포맷
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!selectedNode) return null

  const Icon = NODE_TYPE_ICONS[selectedNode.type] || Brain
  const colorGradient = NODE_TYPE_COLORS[selectedNode.type] || 'from-cyan-500 to-blue-600'

  return (
    <div className={cn(
      'absolute bottom-4 left-1/2 -translate-x-1/2 z-20',
      'w-full max-w-lg rounded-2xl overflow-hidden',
      isDark ? 'bg-zinc-900/95 border border-zinc-800' : 'bg-white/95 border border-zinc-200',
      'shadow-2xl backdrop-blur-sm'
    )}>
      {/* 헤더 */}
      <div className={cn(
        'p-4 border-b',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              `bg-gradient-to-br ${colorGradient}`
            )}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-zinc-900')}>
                {selectedNode.title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
                )}>
                  {selectedNode.type}
                </span>
                {selectedNode.createdAt && (
                  <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    {formatTime(selectedNode.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 요약 */}
        {selectedNode.summary && (
          <p className={cn('text-sm mt-3', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
            {selectedNode.summary}
          </p>
        )}

        {/* 태그 */}
        {selectedNode.tags && selectedNode.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {selectedNode.tags.map((tag, idx) => (
              <span
                key={idx}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs',
                  isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600'
                )}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 통계 */}
        {nodeDetail && (
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5">
              <Link2 className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                {nodeDetail.stats.connectionCount}개 연결
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowLeft className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                {nodeDetail.stats.incomingCount} 유입
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowRight className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                {nodeDetail.stats.outgoingCount} 발신
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 관련 노드 */}
      <div className={cn(
        'border-t',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <button
          onClick={() => setShowRelated(!showRelated)}
          className={cn(
            'w-full flex items-center justify-between px-4 py-3 transition-colors',
            isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
          )}
        >
          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            관련 노드
          </span>
          <div className="flex items-center gap-2">
            {nodeDetail && (
              <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                {nodeDetail.relatedNodes.length}개
              </span>
            )}
            {showRelated ? (
              <ChevronUp className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
            ) : (
              <ChevronDown className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
            )}
          </div>
        </button>

        {showRelated && (
          <div className="px-4 pb-4 max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
              </div>
            ) : error ? (
              <div className={cn(
                'text-center py-4 text-sm',
                isDark ? 'text-red-400' : 'text-red-600'
              )}>
                {error}
              </div>
            ) : nodeDetail && nodeDetail.relatedNodes.length > 0 ? (
              <div className="space-y-2">
                {nodeDetail.relatedNodes.map((related, idx) => {
                  const RelIcon = NODE_TYPE_ICONS[related.node.type] || Brain
                  const RelationIcon = RELATIONSHIP_ICONS[related.relationship.type] || Link2

                  return (
                    <button
                      key={idx}
                      onClick={() => handleRelatedNodeClick(related.node)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl transition-all',
                        isDark
                          ? 'bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50'
                          : 'bg-zinc-50 hover:bg-zinc-100 border border-zinc-200',
                        'group'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        `bg-gradient-to-br ${NODE_TYPE_COLORS[related.node.type] || 'from-zinc-500 to-zinc-600'}`
                      )}>
                        <RelIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          isDark ? 'text-zinc-200' : 'text-zinc-800'
                        )}>
                          {related.node.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn(
                            'text-xs',
                            isDark ? 'text-zinc-500' : 'text-zinc-400'
                          )}>
                            {related.node.type}
                          </span>
                          <span className={cn(
                            'flex items-center gap-1 text-xs',
                            isDark ? 'text-zinc-500' : 'text-zinc-400'
                          )}>
                            <RelationIcon className="w-3 h-3" />
                            {related.relationship.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {related.relationship.direction === 'incoming' && (
                          <ArrowLeft className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                        )}
                        {related.relationship.direction === 'outgoing' && (
                          <ArrowRight className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                        )}
                        {related.relationship.direction === 'bidirectional' && (
                          <Link2 className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                        )}
                        <span className={cn(
                          'text-xs opacity-0 group-hover:opacity-100 transition-opacity',
                          isDark ? 'text-cyan-400' : 'text-cyan-600'
                        )}>
                          보기
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className={cn(
                'text-center py-6 text-sm',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}>
                관련 노드가 없습니다
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default NodeDetailPopup
