'use client'

/**
 * ClusterPanel - 클러스터 시각화 패널
 *
 * PRD 12.1 기준 클러스터 기능:
 * - 의미론적 클러스터 그룹
 * - 노드 타입별 분류
 * - 상호작용 시각화
 * - 사용자 테마 색상 적용
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import type { BrainCluster } from '@/types/brain-map'
import {
  Network,
  Loader2,
  Tag,
  Sparkles,
  ChevronRight,
  X,
  BarChart2,
  Layers,
  Zap,
} from 'lucide-react'

interface ClusterPanelProps {
  agentId: string
  isDark?: boolean
  onClusterSelect?: (cluster: BrainCluster | null, nodeIds: string[]) => void
}

// PRD 기준 클러스터 색상 (사용자 테마 색상과 조화)
const getClusterColors = (accentHex: string) => [
  accentHex,           // 사용자 테마 색상
  '#8B5CF6',           // 보라
  '#22C55E',           // 초록
  '#EF4444',           // 빨강
  '#EAB308',           // 노랑
  '#06B6D4',           // 시안
  '#EC4899',           // 핑크
  '#F97316',           // 주황
  '#14B8A6',           // 틸
  '#6366F1',           // 인디고
  '#A855F7',           // 퍼플
  '#84CC16',           // 라임
]

export function ClusterPanel({
  agentId,
  isDark = true,
  onClusterSelect,
}: ClusterPanelProps) {
  const [clusters, setClusters] = useState<BrainCluster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
  const [showAIAnalysis, setShowAIAnalysis] = useState(false)
  const [resolution, setResolution] = useState(50)

  // 사용자 테마 색상
  const accentColor = useThemeStore((s) => s.accentColor)
  const userAccentHex = accentColors.find(c => c.id === accentColor)?.color || '#3b82f6'
  const clusterColors = getClusterColors(userAccentHex)

  // 데이터 로드
  useEffect(() => {
    const fetchClusters = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/agents/${agentId}/brain/clusters`)
        if (!res.ok) throw new Error('Failed to fetch clusters')

        const result = await res.json()
        setClusters(result.clusters || [])
      } catch (err) {
        console.error('[ClusterPanel] Error:', err)
        setError('클러스터를 불러오지 못했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    fetchClusters()
  }, [agentId])

  // 클러스터 선택
  const handleClusterSelect = useCallback((cluster: BrainCluster) => {
    if (selectedCluster === cluster.clusterId) {
      setSelectedCluster(null)
      onClusterSelect?.(null, [])
    } else {
      setSelectedCluster(cluster.clusterId)
      onClusterSelect?.(cluster, cluster.centralNodeIds || [])
    }
  }, [selectedCluster, onClusterSelect])

  // 해상도에 따른 필터링
  const filteredClusters = clusters.filter(c => {
    const threshold = (100 - resolution) / 100
    return c.cohesionScore >= threshold
  })

  // 통계
  const totalNodes = clusters.reduce((sum, c) => sum + c.nodeCount, 0)
  const avgCohesion = clusters.length > 0
    ? clusters.reduce((sum, c) => sum + c.cohesionScore, 0) / clusters.length
    : 0

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: userAccentHex }} />
          <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
            클러스터 분석 중...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        'h-full flex items-center justify-center text-center p-4',
        isDark ? 'text-red-400' : 'text-red-600'
      )}>
        <div>
          <p className="font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className={cn(
              'mt-2 px-4 py-2 rounded-lg text-sm',
              isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
            )}
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={cn('p-4 border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5" style={{ color: userAccentHex }} />
            <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
              클러스터
            </h3>
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              ({filteredClusters.length}개)
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className={cn(
            'p-2 rounded-lg text-center',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              {clusters.length}
            </p>
            <p className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              클러스터
            </p>
          </div>
          <div className={cn(
            'p-2 rounded-lg text-center',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              {totalNodes}
            </p>
            <p className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              총 노드
            </p>
          </div>
          <div className={cn(
            'p-2 rounded-lg text-center',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              {Math.round(avgCohesion * 100)}%
            </p>
            <p className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              평균 응집도
            </p>
          </div>
        </div>

        {/* Resolution Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
              해상도
            </label>
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {resolution}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={resolution}
            onChange={(e) => setResolution(Number(e.target.value))}
            className="w-full h-1 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${userAccentHex} 0%, ${userAccentHex} ${resolution}%, ${isDark ? '#3f3f46' : '#e4e4e7'} ${resolution}%, ${isDark ? '#3f3f46' : '#e4e4e7'} 100%)`
            }}
          />
        </div>
      </div>

      {/* Cluster Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredClusters.length === 0 ? (
          <div className={cn(
            'text-center py-12',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )}>
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">클러스터가 없습니다</p>
            <p className="text-sm mt-1">해상도를 낮추거나 데이터를 추가해주세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Cluster Cards */}
            {filteredClusters.map((cluster, idx) => {
              const color = clusterColors[idx % clusterColors.length]
              const isSelected = selectedCluster === cluster.clusterId

              return (
                <motion.button
                  key={cluster.clusterId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleClusterSelect(cluster)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl transition-all',
                    isSelected
                      ? 'ring-2'
                      : isDark
                        ? 'bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50'
                        : 'bg-zinc-50 hover:bg-zinc-100 border border-zinc-200'
                  )}
                  style={isSelected ? { boxShadow: `0 0 0 2px ${color}`, backgroundColor: `${color}10` } : undefined}
                >
                  <div className="flex items-start gap-3">
                    {/* Color indicator */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <span className="font-bold text-sm" style={{ color }}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn(
                          'font-medium text-sm truncate',
                          isDark ? 'text-zinc-200' : 'text-zinc-800'
                        )}>
                          {cluster.label}
                        </p>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded',
                          isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                        )}>
                          {cluster.nodeCount}
                        </span>
                      </div>

                      {/* Top keywords */}
                      {cluster.topKeywords && cluster.topKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cluster.topKeywords.slice(0, 4).map((keyword, i) => (
                            <span
                              key={i}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px]',
                                isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                              )}
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Cohesion bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className={cn(
                          'flex-1 h-1 rounded-full overflow-hidden',
                          isDark ? 'bg-zinc-700' : 'bg-zinc-200'
                        )}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${cluster.cohesionScore * 100}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className={cn('text-[10px]', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {Math.round(cluster.cohesionScore * 100)}%
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      className={cn(
                        'w-4 h-4 flex-shrink-0 transition-transform',
                        isSelected && 'rotate-90'
                      )}
                      style={{ color }}
                    />
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={cn(
                          'mt-3 pt-3 border-t',
                          isDark ? 'border-zinc-700' : 'border-zinc-200'
                        )}>
                          <div className="flex items-center justify-between">
                            <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                              중심 노드: {cluster.centralNodeIds?.length || 0}개
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // TODO: View in graph
                              }}
                              className="text-xs flex items-center gap-1"
                              style={{ color: userAccentHex }}
                            >
                              <Zap className="w-3 h-3" />
                              그래프에서 보기
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* AI Analysis Button */}
      <div className={cn('p-4 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <button
          onClick={() => setShowAIAnalysis(true)}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
            'text-white shadow-lg'
          )}
          style={{
            background: `linear-gradient(135deg, ${userAccentHex}, ${userAccentHex}dd)`,
          }}
        >
          <Sparkles className="w-4 h-4" />
          AI 분석
        </button>
      </div>

      {/* AI Analysis Modal */}
      <AnimatePresence>
        {showAIAnalysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowAIAnalysis(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-md rounded-2xl overflow-hidden',
                isDark ? 'bg-zinc-900' : 'bg-white'
              )}
            >
              <div className={cn(
                'flex items-center justify-between p-4 border-b',
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              )}>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: userAccentHex }} />
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    AI 클러스터 분석
                  </h3>
                </div>
                <button
                  onClick={() => setShowAIAnalysis(false)}
                  className={cn(
                    'p-1 rounded-lg transition-colors',
                    isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-600'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className={cn(
                  'p-4 rounded-xl',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart2 className="w-4 h-4" style={{ color: userAccentHex }} />
                    <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                      클러스터 분포
                    </span>
                  </div>
                  <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                    총 {clusters.length}개의 클러스터에서 {totalNodes}개의 노드가 분석되었습니다.
                    평균 응집도는 {Math.round(avgCohesion * 100)}%입니다.
                  </p>
                </div>

                <div className={cn(
                  'p-4 rounded-xl',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4" style={{ color: userAccentHex }} />
                    <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                      주요 패턴
                    </span>
                  </div>
                  <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                    가장 큰 클러스터는 "{clusters[0]?.label || '없음'}"이며,
                    {clusters[0]?.nodeCount || 0}개의 노드를 포함합니다.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ClusterPanel
