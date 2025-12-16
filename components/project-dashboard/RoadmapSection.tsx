"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Flag,
  Target,
  Rocket,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronRight,
  Plus,
  Milestone,
  TrendingUp,
  AlertCircle,
  GitBranch,
  List,
  Sparkles,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { RoadmapCanvasWithProvider } from "@/components/roadmap"

interface MilestoneData {
  id: string
  title: string
  description?: string
  target_date: string
  status: "upcoming" | "in_progress" | "completed" | "delayed"
  progress: number
  tasks_count?: number
  completed_tasks?: number
}

type ViewMode = "dag" | "timeline"

interface RoadmapSectionProps {
  projectId: string
  project: {
    name: string
    deadline?: string | null
    stage?: string | null
  }
}

const quarterConfig = {
  Q1: { label: "1분기", months: "1월 - 3월", color: "#3B82F6" },
  Q2: { label: "2분기", months: "4월 - 6월", color: "#8B5CF6" },
  Q3: { label: "3분기", months: "7월 - 9월", color: "#F59E0B" },
  Q4: { label: "4분기", months: "10월 - 12월", color: "#10B981" },
}

const statusConfig = {
  upcoming: { label: "예정", color: "#6B7280", icon: Clock },
  in_progress: { label: "진행 중", color: "#3B82F6", icon: Rocket },
  completed: { label: "완료", color: "#10B981", icon: CheckCircle2 },
  delayed: { label: "지연", color: "#EF4444", icon: AlertCircle },
}

export function RoadmapSection({ projectId, project }: RoadmapSectionProps) {
  const [milestones, setMilestones] = useState<MilestoneData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("dag")

  // AI Generation state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [customInstructions, setCustomInstructions] = useState("")
  const [clearExisting, setClearExisting] = useState(false)
  const [generationResult, setGenerationResult] = useState<{
    summary?: string
    phases?: string[]
    totalEstimatedHours?: number
  } | null>(null)
  const [roadmapKey, setRoadmapKey] = useState(0) // For forcing re-render

  useEffect(() => {
    fetchMilestones()
  }, [projectId])

  const handleAIGenerate = async () => {
    setIsGenerating(true)
    setGenerationResult(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/roadmap/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customInstructions: customInstructions || undefined,
          clearExisting,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate roadmap")
      }

      const result = await response.json()
      setGenerationResult({
        summary: result.summary,
        phases: result.phases,
        totalEstimatedHours: result.totalEstimatedHours,
      })

      // Force roadmap canvas to refresh
      setRoadmapKey(prev => prev + 1)

      // Close modal after short delay to show success
      setTimeout(() => {
        setIsAIModalOpen(false)
        setCustomInstructions("")
        setClearExisting(false)
      }, 2000)
    } catch (error) {
      console.error("AI generation error:", error)
      alert(`로드맵 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const fetchMilestones = async () => {
    try {
      // TODO: Replace with actual API call
      // For now, generate sample milestones based on project data
      const sampleMilestones: MilestoneData[] = [
        {
          id: "1",
          title: "MVP 개발 완료",
          description: "핵심 기능 구현 및 기본 UI 완성",
          target_date: "2024-03-31",
          status: "completed",
          progress: 100,
          tasks_count: 15,
          completed_tasks: 15,
        },
        {
          id: "2",
          title: "베타 테스트 시작",
          description: "초기 사용자 피드백 수집 및 버그 수정",
          target_date: "2024-06-30",
          status: "in_progress",
          progress: 65,
          tasks_count: 20,
          completed_tasks: 13,
        },
        {
          id: "3",
          title: "정식 출시",
          description: "마케팅 캠페인 및 공개 런칭",
          target_date: "2024-09-30",
          status: "upcoming",
          progress: 0,
          tasks_count: 25,
          completed_tasks: 0,
        },
        {
          id: "4",
          title: "투자 유치",
          description: "시리즈 A 펀딩 라운드 진행",
          target_date: "2024-12-31",
          status: "upcoming",
          progress: 0,
          tasks_count: 10,
          completed_tasks: 0,
        },
      ]
      setMilestones(sampleMilestones)
    } catch (error) {
      console.error("Milestones fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const getQuarter = (dateStr: string) => {
    const month = new Date(dateStr).getMonth() + 1
    if (month <= 3) return "Q1"
    if (month <= 6) return "Q2"
    if (month <= 9) return "Q3"
    return "Q4"
  }

  const groupedMilestones = milestones.reduce((acc, milestone) => {
    const quarter = getQuarter(milestone.target_date)
    if (!acc[quarter]) acc[quarter] = []
    acc[quarter].push(milestone)
    return acc
  }, {} as Record<string, MilestoneData[]>)

  const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">프로젝트 로드맵</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {viewMode === "dag" ? "전체 설계도 - 프로젝트 구조 및 의존성 관계" : "분기별 마일스톤 계획"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("dag")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                viewMode === "dag"
                  ? "bg-cyan-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              설계도
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${
                viewMode === "timeline"
                  ? "bg-cyan-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <List className="w-4 h-4" />
              마일스톤
            </button>
          </div>
          {viewMode === "dag" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAIModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI 로드맵 생성
            </Button>
          )}
          {viewMode === "timeline" && (
            <Button variant="default" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              마일스톤 추가
            </Button>
          )}
        </div>
      </div>

      {/* DAG View */}
      {viewMode === "dag" && (
        <RoadmapCanvasWithProvider key={roadmapKey} projectId={projectId} />
      )}

      {/* AI Generation Modal */}
      <AnimatePresence>
        {isAIModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => !isGenerating && setIsAIModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">AI 로드맵 생성</h3>
                    <p className="text-xs text-zinc-500">프로젝트 분석 기반 자동 설계</p>
                  </div>
                </div>
                <button
                  onClick={() => !isGenerating && setIsAIModalOpen(false)}
                  disabled={isGenerating}
                  className="text-zinc-400 hover:text-white disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Project Info */}
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-sm text-zinc-400">분석할 프로젝트</p>
                  <p className="text-white font-medium mt-1">{project.name}</p>
                </div>

                {/* Custom Instructions */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">
                    추가 지침 (선택사항)
                  </label>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="예: MVP 우선 개발, 보안 중점, 빠른 출시 등..."
                    rows={3}
                    disabled={isGenerating}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                </div>

                {/* Clear Existing Option */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    disabled={isGenerating}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-zinc-300">
                    기존 로드맵 삭제 후 새로 생성
                  </span>
                </label>

                {/* Generation Result */}
                {generationResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">로드맵 생성 완료!</span>
                    </div>
                    {generationResult.summary && (
                      <p className="text-sm text-zinc-300 mb-2">{generationResult.summary}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      {generationResult.phases && (
                        <span>{generationResult.phases.length}개 단계</span>
                      )}
                      {generationResult.totalEstimatedHours && (
                        <span>예상 {generationResult.totalEstimatedHours}시간</span>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Warning */}
                {clearExisting && !generationResult && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p className="text-sm text-amber-400">
                      기존 로드맵의 모든 노드와 연결이 삭제됩니다.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
                <Button
                  variant="outline"
                  onClick={() => setIsAIModalOpen(false)}
                  disabled={isGenerating}
                >
                  취소
                </Button>
                <Button
                  onClick={handleAIGenerate}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      생성하기
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <>
        {/* Quarter Tabs */}
      <div className="flex gap-2">
        {Object.entries(quarterConfig).map(([key, config]) => {
          const isActive = selectedQuarter === key || (!selectedQuarter && key === currentQuarter)
          const milestoneCount = groupedMilestones[key]?.length || 0

          return (
            <button
              key={key}
              onClick={() => setSelectedQuarter(key === selectedQuarter ? null : key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              <span className="font-medium">{config.label}</span>
              {milestoneCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: isActive ? `${config.color}20` : "transparent",
                    color: isActive ? config.color : undefined,
                  }}
                >
                  {milestoneCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Timeline View */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-800" />

          {/* Milestones */}
          <div className="space-y-6">
            {milestones
              .filter((m) => !selectedQuarter || getQuarter(m.target_date) === selectedQuarter)
              .map((milestone, idx) => {
                const StatusIcon = statusConfig[milestone.status].icon
                const quarter = getQuarter(milestone.target_date)
                const quarterInfo = quarterConfig[quarter as keyof typeof quarterConfig]

                return (
                  <motion.div
                    key={milestone.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative pl-16"
                  >
                    {/* Timeline Node */}
                    <div
                      className="absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={{
                        borderColor: statusConfig[milestone.status].color,
                        backgroundColor:
                          milestone.status === "completed"
                            ? statusConfig[milestone.status].color
                            : "#18181b",
                      }}
                    >
                      {milestone.status === "completed" && (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                    </div>

                    {/* Milestone Card */}
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-zinc-600 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${quarterInfo.color}20` }}
                          >
                            <Flag className="w-5 h-5" style={{ color: quarterInfo.color }} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{milestone.title}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-zinc-500">
                                {new Date(milestone.target_date).toLocaleDateString("ko-KR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded text-xs"
                                style={{
                                  backgroundColor: `${statusConfig[milestone.status].color}20`,
                                  color: statusConfig[milestone.status].color,
                                }}
                              >
                                {statusConfig[milestone.status].label}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      {milestone.description && (
                        <p className="text-sm text-zinc-400 mb-4">{milestone.description}</p>
                      )}

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">진행률</span>
                          <span className="text-white font-medium">{milestone.progress}%</span>
                        </div>
                        <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${milestone.progress}%`,
                              backgroundColor: statusConfig[milestone.status].color,
                            }}
                          />
                        </div>
                        {milestone.tasks_count && (
                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>태스크</span>
                            <span>
                              {milestone.completed_tasks}/{milestone.tasks_count} 완료
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
          </div>
        </div>

        {milestones.filter((m) => !selectedQuarter || getQuarter(m.target_date) === selectedQuarter)
          .length === 0 && (
          <div className="text-center py-12">
            <Milestone className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">이 분기에는 마일스톤이 없습니다</p>
            <Button variant="outline" size="sm" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              마일스톤 추가
            </Button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "전체 마일스톤",
            value: milestones.length,
            icon: Flag,
            color: "#3B82F6",
          },
          {
            label: "완료",
            value: milestones.filter((m) => m.status === "completed").length,
            icon: CheckCircle2,
            color: "#10B981",
          },
          {
            label: "진행 중",
            value: milestones.filter((m) => m.status === "in_progress").length,
            icon: Rocket,
            color: "#F59E0B",
          },
          {
            label: "예정",
            value: milestones.filter((m) => m.status === "upcoming").length,
            icon: Clock,
            color: "#6B7280",
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + idx * 0.05 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
        </>
      )}
    </div>
  )
}
