"use client"

import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Map,
  Users,
  CheckSquare,
  Calendar,
  BarChart3,
  Bell,
  FileText,
  DollarSign,
  Settings,
  ChevronRight,
  Target,
  Rocket,
  Play,
  GitBranch,
  Brain,
  Sparkles,
} from "lucide-react"

export type ProjectSection =
  | "overview"
  | "roadmap"
  | "workflow"
  | "team"
  | "tasks"
  | "calendar"
  | "progress"
  | "updates"
  | "documents"
  | "budget"
  | "ai-intelligence"
  | "settings"

interface MenuItem {
  id: ProjectSection
  label: string
  icon: typeof LayoutDashboard
  badge?: number
  color?: string
  description?: string
}

const menuGroups = [
  {
    title: "프로젝트",
    items: [
      { id: "overview" as ProjectSection, label: "개요", icon: LayoutDashboard, color: "#3B82F6" },
    ],
  },
  {
    title: "계획",
    items: [
      { id: "roadmap" as ProjectSection, label: "로드맵", icon: Map, color: "#8B5CF6", description: "전체 설계도" },
    ],
  },
  {
    title: "실행",
    items: [
      { id: "workflow" as ProjectSection, label: "워크플로우", icon: Play, color: "#10B981", description: "실행 현황" },
      { id: "tasks" as ProjectSection, label: "작업 관리", icon: CheckSquare, color: "#F59E0B" },
      { id: "calendar" as ProjectSection, label: "일정", icon: Calendar, color: "#EC4899" },
    ],
  },
  {
    title: "현황",
    items: [
      { id: "progress" as ProjectSection, label: "진행 현황", icon: BarChart3, color: "#06B6D4", description: "요약 대시보드" },
      { id: "updates" as ProjectSection, label: "업데이트", icon: Bell, color: "#EF4444" },
    ],
  },
  {
    title: "자료",
    items: [
      { id: "documents" as ProjectSection, label: "문서", icon: FileText, color: "#6366F1" },
      { id: "team" as ProjectSection, label: "조직 구성", icon: Users, color: "#22C55E" },
    ],
  },
  {
    title: "AI",
    items: [
      { id: "ai-intelligence" as ProjectSection, label: "AI 인텔리전스", icon: Brain, color: "#A855F7", description: "토큰 사용량 & ROI" },
    ],
  },
  {
    title: "관리",
    items: [
      { id: "settings" as ProjectSection, label: "설정", icon: Settings, color: "#6B7280" },
    ],
  },
]

interface ProjectSidebarProps {
  activeSection: ProjectSection
  onSectionChange: (section: ProjectSection) => void
  project: {
    name: string
    color: string
    status: string
    progress: number
  }
  taskCount?: number
  updateCount?: number
}

export function ProjectSidebar({
  activeSection,
  onSectionChange,
  project,
  taskCount = 0,
  updateCount = 0,
}: ProjectSidebarProps) {
  const getBadge = (id: ProjectSection) => {
    if (id === "tasks" && taskCount > 0) return taskCount
    if (id === "updates" && updateCount > 0) return updateCount
    return undefined
  }

  return (
    <div className="w-64 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border-r border-zinc-200 dark:border-zinc-800 flex-shrink-0 flex flex-col overflow-hidden">
      {/* Project Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm"
            style={{ backgroundColor: `${project.color}20`, color: project.color }}
          >
            {project.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-zinc-900 dark:text-white truncate">{project.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="h-1.5 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${project.progress}%`, backgroundColor: project.color }}
                />
              </div>
              <span className="text-xs text-zinc-500">{project.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuGroups.map((group, groupIdx) => (
          <div key={group.title} className={groupIdx > 0 ? "mt-4" : ""}>
            <div className="px-4 py-2">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {group.title}
              </span>
            </div>
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isActive = activeSection === item.id
                const badge = getBadge(item.id)

                return (
                  <motion.button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? "" : "bg-transparent"
                        }`}
                      style={{
                        backgroundColor: isActive ? `${item.color}20` : undefined,
                      }}
                    >
                      <item.icon
                        className="w-4 h-4"
                        style={{ color: isActive ? item.color : undefined }}
                      />
                    </div>
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    {badge && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-full">
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Rocket className="w-4 h-4" />
          <span>GlowUS v1.0</span>
        </div>
      </div>
    </div>
  )
}
