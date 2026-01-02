"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Target,
  Rocket,
  TrendingUp,
  Users,
  Bot,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  Sparkles,
  Zap,
  Activity,
} from "lucide-react"
import { AICommandCenter } from "./AICommandCenter"
import { BattlefieldMatrix } from "./BattlefieldMatrix"
import { NetworkRoadmap } from "./NetworkRoadmap"
import { ActivityLogPanel } from "./ActivityLogPanel"
import { ProjectRunner } from "./ProjectRunner"
import { WebFileManager } from "./WebFileManager"
import { useProjectFileSync } from "@/lib/hooks/useProjectFileSync"

const stageConfig = {
  planning: { label: "기획", color: "#6B7280", icon: Target },
  development: { label: "개발", color: "#3B82F6", icon: Rocket },
  beta: { label: "베타", color: "#F59E0B", icon: TrendingUp },
  production: { label: "운영", color: "#10B981", icon: CheckCircle2 },
}

interface OverviewSectionProps {
  projectId: string
  project: {
    name: string
    description?: string | null
    status: string
    progress: number
    deadline?: string | null
    color: string
    mission?: string | null
    stage?: string | null
    members?: any[]
    agents?: any[]
    folderPath?: string | null
    githubRepo?: string | null
    githubCloneUrl?: string | null
  }
  onEdit?: () => void
}

interface KPIData {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  overdueTasks: number
  documentCount: number
  teamSize: number
  agentCount: number
}

export function OverviewSection({ projectId, project, onEdit }: OverviewSectionProps) {
  const [kpiData, setKpiData] = useState<KPIData>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    documentCount: 0,
    teamSize: project.members?.length || 0,
    agentCount: project.agents?.length || 0,
  })
  const [loading, setLoading] = useState(true)
  const [linkedFolderPath, setLinkedFolderPath] = useState<string | null | undefined>(project.folderPath)

  // 🔄 실시간 파일 동기화 - 프로젝트 폴더가 있으면 자동으로 파일 워처 시작
  const { files, refresh: refreshFiles } = useProjectFileSync({
    projectId,
    folderPath: project.folderPath,
    projectName: project.name,
    enabled: !!project.folderPath,
    debounceMs: 300, // 빠른 동기화를 위해 300ms
  })

  useEffect(() => {
    fetchKPIData()
  }, [projectId])

  const fetchKPIData = async () => {
    try {
      const [tasksRes, docsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/tasks`),
        fetch(`/api/projects/${projectId}/documents`),
      ])

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        const tasks = tasksData.tasks || []
        const now = new Date()

        setKpiData((prev) => ({
          ...prev,
          totalTasks: tasks.length,
          completedTasks: tasks.filter((t: any) => t.status === "DONE").length,
          inProgressTasks: tasks.filter((t: any) => t.status === "IN_PROGRESS").length,
          overdueTasks: tasks.filter(
            (t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "DONE"
          ).length,
        }))
      }

      if (docsRes.ok) {
        const docsData = await docsRes.json()
        setKpiData((prev) => ({
          ...prev,
          documentCount: docsData.documents?.length || 0,
        }))
      }
    } catch (error) {
      console.error("KPI fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const stage = project.stage || "planning"
  const stageInfo = stageConfig[stage as keyof typeof stageConfig] || stageConfig.planning
  const StageIcon = stageInfo.icon

  const completionRate = kpiData.totalTasks > 0
    ? Math.round((kpiData.completedTasks / kpiData.totalTasks) * 100)
    : 0

  const daysUntilDeadline = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="relative min-h-full">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl opacity-50 dark:opacity-100" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl opacity-50 dark:opacity-100" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/3 rounded-full blur-3xl opacity-50 dark:opacity-100" />
      </div>

      <div className="relative z-10 space-y-6 pb-20">
        {/* Header Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
              style={{
                background: `linear-gradient(135deg, ${project.color}40, ${project.color}20)`,
                boxShadow: `0 0 40px ${project.color}30`,
              }}
            >
              <Rocket className="w-7 h-7 text-zinc-900 dark:text-white" />
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ border: `2px solid ${project.color}50` }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{project.name}</h1>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${stageInfo.color}20`, color: stageInfo.color }}
                >
                  <StageIcon className="w-3 h-3" />
                  {stageInfo.label}
                </span>
                {daysUntilDeadline !== null && daysUntilDeadline <= 14 && daysUntilDeadline >= 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    D-{daysUntilDeadline}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-500 mt-1">
                {project.mission || project.description || "스타트업쇼 Daily Dashboard"}
              </p>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 shadow-sm backdrop-blur-sm"
            >
              <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              <span className="text-sm text-zinc-700 dark:text-white font-medium">{kpiData.teamSize}명</span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/80 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 shadow-sm backdrop-blur-sm"
            >
              <Bot className="w-4 h-4 text-purple-500 dark:text-purple-400" />
              <span className="text-sm text-zinc-700 dark:text-white font-medium">{kpiData.agentCount} AI</span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 shadow-sm"
            >
              <div className="w-10 h-10 relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3" fill="none" className="text-zinc-200 dark:text-zinc-800" />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke="#10b981"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(project.progress / 100) * 100.5} 100.5`}
                  />
                </svg>
              </div>
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">{project.progress}%</span>
            </motion.div>
          </div>
        </motion.div>

        {/* AI Command Center */}
        <AICommandCenter projectId={projectId} />

        {/* Project Runner - Electron Only (자동 워크스페이스 생성) */}
        <ProjectRunner
          projectId={projectId}
          folderPath={linkedFolderPath}
          projectName={project.name}
          onFolderLinked={(path) => setLinkedFolderPath(path)}
        />

        {/* Web File Manager - Web Only */}
        <WebFileManager
          projectId={projectId}
          projectName={project.name}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: Battlefield Matrix (2 cols) */}
          <div className="xl:col-span-2">
            <BattlefieldMatrix projectId={projectId} />
          </div>

          {/* Right: KPI Cards + Activity Log */}
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "전체 태스크",
                  value: kpiData.totalTasks,
                  icon: CheckCircle2,
                  color: "#3B82F6",
                  subtext: `${completionRate}% 완료`,
                },
                {
                  label: "진행 중",
                  value: kpiData.inProgressTasks,
                  icon: Activity,
                  color: "#F59E0B",
                  subtext: kpiData.overdueTasks > 0 ? `${kpiData.overdueTasks} 지연` : "순조로움",
                  alert: kpiData.overdueTasks > 0,
                },
                {
                  label: "완료",
                  value: kpiData.completedTasks,
                  icon: Zap,
                  color: "#10B981",
                  subtext: "완료된 태스크",
                },
                {
                  label: "문서",
                  value: kpiData.documentCount,
                  icon: FileText,
                  color: "#8B5CF6",
                  subtext: "생성된 문서",
                },
              ].map((kpi, idx) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="relative overflow-hidden bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 group cursor-pointer shadow-sm"
                >
                  {/* Glow Effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-10 dark:group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at center, ${kpi.color}20 0%, transparent 70%)`,
                    }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${kpi.color}20` }}
                      >
                        <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                      </div>
                      {(kpi as any).alert && (
                        <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 animate-pulse" />
                      )}
                    </div>
                    <div className="text-xl font-bold text-zinc-900 dark:text-white">{kpi.value}</div>
                    <div className="text-xs text-zinc-500">{kpi.label}</div>
                    <div className="text-[10px] text-zinc-600 dark:text-zinc-500 mt-1">{kpi.subtext}</div>
                  </div>

                  {/* Bottom accent */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: kpi.color, opacity: 0.5 }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Activity Log */}
            <ActivityLogPanel projectId={projectId} />
          </div>
        </div>

        {/* Network Roadmap */}
        <NetworkRoadmap projectId={projectId} />

        {/* Stage Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm"
        >
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4" />
            프로젝트 단계
          </h3>
          <div className="flex items-center justify-between">
            {Object.entries(stageConfig).map(([key, config], idx) => {
              const isActive = key === stage
              const isPast = Object.keys(stageConfig).indexOf(key) < Object.keys(stageConfig).indexOf(stage)
              const Icon = config.icon

              return (
                <div key={key} className="flex-1 relative">
                  {idx > 0 && (
                    <div
                      className={`absolute left-0 top-5 w-full h-0.5 -translate-x-1/2 transition-colors ${isPast ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                    />
                  )}
                  <div className="relative flex flex-col items-center">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${isActive ? "ring-4 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 shadow-md" : ""
                        } ${!(isPast || isActive) ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600" : ""
                        }`}
                      style={{
                        backgroundColor: isPast || isActive ? `${config.color}20` : undefined,
                        color: isPast || isActive ? config.color : undefined,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </motion.div>
                    <span
                      className={`mt-2 text-sm font-medium ${isActive ? "text-zinc-900 dark:text-white" : isPast ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"
                        }`}
                    >
                      {config.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* AI Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative overflow-hidden bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-cyan-500/5 border border-purple-500/20 rounded-xl p-6 shadow-sm"
        >
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-xl pointer-events-none">
            <div
              className="absolute inset-0 rounded-xl animate-pulse opacity-50"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.1), transparent)",
                backgroundSize: "200% 100%",
              }}
            />
          </div>

          <div className="relative z-10 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
                AI 인사이트
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {kpiData.overdueTasks > 0
                  ? `⚠️ ${kpiData.overdueTasks}개의 지연된 태스크가 있습니다. 우선순위를 조정하거나 AI 에이전트에게 위임하는 것을 고려해보세요.`
                  : kpiData.inProgressTasks > 0
                    ? `✨ 현재 ${kpiData.inProgressTasks}개의 태스크가 진행 중입니다. 완료율 ${completionRate}%로 순조롭게 진행되고 있습니다.`
                    : "🚀 태스크를 추가하여 프로젝트를 시작하세요!"}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
