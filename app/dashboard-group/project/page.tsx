"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  Folder,
  Bot,
  MoreHorizontal,
  Loader2,
  LayoutGrid,
  AlignJustify,
  Clock,
  SlidersHorizontal,
  Calendar,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  Users,
  Sparkles,
  Pencil,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { ProjectCreateModal, ProjectFormData } from "@/components/project/ProjectCreateModal"
import type { ProjectWithRelations, User } from "@/types/database"
import { useNeuralMapStore } from "@/lib/neural-map/store"

const statusStyles: Record<string, { bg: string; text: string; dot: string; gradient: string; icon: string }> = {
  planning: {
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-600 dark:text-zinc-400",
    dot: "bg-zinc-400",
    gradient: "from-zinc-500/10 to-transparent",
    icon: "text-zinc-500"
  },
  active: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    gradient: "from-emerald-500/10 to-transparent",
    icon: "text-emerald-500"
  },
  on_hold: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    gradient: "from-amber-500/10 to-transparent",
    icon: "text-amber-500"
  },
  completed: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    gradient: "from-blue-500/10 to-transparent",
    icon: "text-blue-500"
  },
  cancelled: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
    gradient: "from-red-500/10 to-transparent",
    icon: "text-red-500"
  },
}

const statusLabels: Record<string, string> = {
  planning: "계획",
  active: "진행중",
  on_hold: "보류",
  completed: "완료",
  cancelled: "취소",
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("updated")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchTeams()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/projects")
      if (!res.ok) {
        setProjects([])
        return
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setProjects(data)
      } else {
        setProjects([])
      }
    } catch (error) {
      console.error("Projects fetch error:", error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams")
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setTeams(data)
      }
    } catch (error) {
      console.error("Teams fetch error:", error)
    }
  }

  const fetchTeamMembers = useCallback(async (teamId: string) => {
    try {
      const res = await fetch(`/api/team-members?team_id=${teamId}`)
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setTeamMembers(data.map((m: any) => m.user).filter(Boolean))
      }
    } catch (error) {
      console.error("Team members fetch error:", error)
    }
  }, [])

  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)

  const handleCreateProject = async (
    formData: ProjectFormData,
    selectedMembers: string[]
  ) => {
    if (!formData.name.trim()) {
      alert("프로젝트 이름을 입력해주세요")
      return
    }
    // team_id는 선택사항 - 나중에 팀 생성 후 배치 가능

    setCreating(true)
    try {
      // Electron 환경에서 로컬 프로젝트 폴더 자동 생성
      let folderPath: string | undefined
      const electronProject = window.electron?.project as any
      if (typeof window !== 'undefined' && electronProject?.createWorkspace) {
        try {
          console.log('[Project] Creating local workspace for:', formData.name)
          const result = await electronProject.createWorkspace(formData.name)
          if (result.success && result.path) {
            folderPath = result.path
            console.log('[Project] Local workspace created at:', folderPath)
          } else {
            console.warn('[Project] Failed to create workspace:', result.error)
          }
        } catch (e) {
          console.warn('[Project] Electron workspace creation failed:', e)
          // 웹 환경에서는 무시하고 진행
        }
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          folder_path: folderPath,  // 로컬 폴더 경로 저장
        }),
      })

      if (!res.ok) throw new Error("프로젝트 생성 실패")
      const project = await res.json()

      for (const userId of selectedMembers) {
        await fetch(`/api/projects/${project.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, role: "member" }),
        })
      }

      setIsCreateModalOpen(false)

      // 마이뉴런(Neural Map)에 프로젝트 연결 후 이동
      // folder_path가 있으면 함께 설정
      setLinkedProject(project.id, project.name)
      if (folderPath) {
        // projectPath도 함께 설정 (터미널, 챗봇에서 사용)
        useNeuralMapStore.getState().setProjectPath(folderPath)
      }
      router.push("/dashboard-group/neural-map")
    } catch (error) {
      console.error("Create project error:", error)
      alert("프로젝트 생성에 실패했습니다")
    } finally {
      setCreating(false)
    }
  }

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === "all" || project.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        if (sortBy === "updated") {
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        }
        if (sortBy === "name") {
          return a.name.localeCompare(b.name)
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [projects, searchQuery, statusFilter, sortBy])

  const stats = useMemo(() => {
    const total = projects.length
    const active = projects.filter(p => p.status === "active").length
    const completed = projects.filter(p => p.status === "completed").length
    return { total, active, completed }
  }, [projects])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return "오늘"
    if (days === 1) return "어제"
    if (days < 7) return `${days}일 전`
    if (days < 30) return `${Math.floor(days / 7)}주 전`
    return formatDate(dateString)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          <span className="text-sm text-zinc-500">프로젝트 불러오는 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">프로젝트</h1>

              {/* Stats */}
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{stats.total}</span>
                  <span className="text-zinc-500">전체</span>
                </div>
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-emerald-600">{stats.active}</span>
                  <span className="text-zinc-500">진행중</span>
                </div>
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-blue-600">{stats.completed}</span>
                  <span className="text-zinc-500">완료</span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="accent"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              새 프로젝트
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-4 gap-4">
            <div className="flex items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="프로젝트 검색..."
                  className="w-full h-9 pl-9 pr-3 text-sm bg-zinc-100 dark:bg-zinc-800/50 border-0 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-shadow"
                />
              </div>

              {/* Filters */}
              <div className="relative">
                <Button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  variant={statusFilter !== "all" ? "accent" : "outline"}
                  size="sm"
                  leftIcon={<SlidersHorizontal className="w-4 h-4" />}
                  rightIcon={statusFilter !== "all" ? (
                    <span className="flex items-center justify-center w-5 h-5 text-xs bg-white/20 rounded">1</span>
                  ) : undefined}
                >
                  필터
                </Button>

                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl p-1.5 z-50"
                    >
                      <div className="px-2 py-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">상태</div>
                      {["all", "planning", "active", "on_hold", "completed"].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setStatusFilter(status)
                            setIsFilterOpen(false)
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors ${
                            statusFilter === status
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          }`}
                        >
                          {status !== "all" && (
                            <span className={`w-2 h-2 rounded-full ${statusStyles[status]?.dot}`} />
                          )}
                          {status === "all" ? "전체" : statusLabels[status]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 px-3 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 cursor-pointer"
              >
                <option value="updated">최근 수정순</option>
                <option value="created">생성일순</option>
                <option value="name">이름순</option>
              </select>
            </div>

            {/* View Toggle */}
            <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl">
              <Button
                onClick={() => setViewMode("list")}
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon-sm"
                className={viewMode === "list" ? "shadow-sm" : ""}
              >
                <AlignJustify className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setViewMode("grid")}
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon-sm"
                className={viewMode === "grid" ? "shadow-sm" : ""}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {filteredProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center shadow-lg">
                <Folder className="w-12 h-12 text-zinc-400" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Plus className="w-5 h-5 text-white" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">첫 프로젝트를 만들어보세요</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 text-center max-w-sm">
              프로젝트를 생성하고 팀원이나 AI 에이전트에게<br />업무를 할당해보세요
            </p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="accent"
              size="lg"
              leftIcon={<Plus className="w-5 h-5" />}
              className="shadow-lg"
            >
              새 프로젝트 만들기
            </Button>
          </motion.div>
        ) : viewMode === "list" ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3.5 bg-zinc-50/80 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
              <div className="col-span-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">프로젝트</div>
              <div className="col-span-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">상태</div>
              <div className="col-span-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">진행률</div>
              <div className="col-span-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">팀</div>
              <div className="col-span-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">수정일</div>
              <div className="col-span-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">작업</div>
            </div>

            {/* Rows */}
            {filteredProjects.map((project, idx) => {
              const style = statusStyles[project.status] || statusStyles.planning
              const progress = project.progress || 0
              const members = (project as any).project_members || project.members || []
              const agents = (project as any).project_agents || project.agents || []
              const memberCount = members.length + agents.length

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/20 cursor-pointer group transition-all"
                  onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
                >
                  {/* Project Info */}
                  <div className="col-span-4 flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Folder className={`w-5 h-5 ${style.icon}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate group-hover:text-zinc-700 dark:group-hover:text-white transition-colors">
                          {project.name}
                        </p>
                        {(project.priority === 'high' || project.priority === 'urgent') && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            {project.priority === 'urgent' ? '긴급' : '높음'}
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{project.description}</p>
                      )}
                    </div>
                    {/* 호버시 화살표 */}
                    <ArrowUpRight className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                      {statusLabels[project.status]}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${style.dot}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 w-8 text-right">{progress}%</span>
                    </div>
                  </div>

                  {/* Team */}
                  <div className="col-span-2">
                    {memberCount > 0 ? (
                      <div className="flex items-center -space-x-2">
                        {members.slice(0, 3).map((member: any) => (
                          <img
                            key={member.id}
                            src={member.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}&backgroundColor=e4e4e7`}
                            alt={member.user?.name}
                            title={member.user?.name}
                            className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-100 object-cover"
                          />
                        ))}
                        {agents.slice(0, 1).map((a: any) => (
                          <div
                            key={a.id}
                            title={a.agent?.name}
                            className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                          >
                            <Sparkles className="w-3 h-3 text-white" />
                          </div>
                        ))}
                        {memberCount > 4 && (
                          <div className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                            +{memberCount - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
                  </div>

                  {/* Date */}
                  <div className="col-span-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatRelativeDate(project.updated_at || project.created_at)}</span>
                  </div>

                  {/* Edit Button */}
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLinkedProject(project.id, project.name)
                        // folder_path가 있으면 projectPath도 설정
                        if ((project as any).folder_path) {
                          useNeuralMapStore.getState().setProjectPath((project as any).folder_path)
                        }
                        router.push("/dashboard-group/neural-map")
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          /* Grid View - 개선된 카드 디자인 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProjects.map((project, idx) => {
              const members = (project as any).project_members || project.members || []
              const agents = (project as any).project_agents || project.agents || []
              const memberCount = members.length + agents.length
              const progress = project.progress || 0
              const style = statusStyles[project.status] || statusStyles.planning
              const hasDeadline = project.deadline || project.end_date

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden cursor-pointer transition-shadow hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50"
                  onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
                >
                  {/* 상단 그라데이션 악센트 */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.gradient} ${style.dot}`} />

                  {/* 호버시 Edit 버튼 */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setLinkedProject(project.id, project.name)
                        // folder_path가 있으면 projectPath도 설정
                        if ((project as any).folder_path) {
                          useNeuralMapStore.getState().setProjectPath((project as any).folder_path)
                        }
                        router.push("/dashboard-group/neural-map")
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors shadow-lg"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>

                  <div className="p-5">
                    {/* 상태 뱃지 */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                        {statusLabels[project.status]}
                      </span>
                      {project.priority === 'high' || project.priority === 'urgent' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                          {project.priority === 'urgent' ? '긴급' : '높음'}
                        </span>
                      ) : null}
                    </div>

                    {/* 프로젝트 이름 */}
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-2 line-clamp-1 group-hover:text-zinc-700 dark:group-hover:text-white transition-colors">
                      {project.name}
                    </h3>

                    {/* 설명 */}
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2 min-h-[40px]">
                      {project.description || '설명 없음'}
                    </p>

                    {/* 진행률 바 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-zinc-500">진행률</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                          className={`h-full rounded-full ${style.dot}`}
                        />
                      </div>
                    </div>

                    {/* 메타 정보 */}
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                      {hasDeadline && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(project.deadline || project.end_date!)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatRelativeDate(project.updated_at || project.created_at)}</span>
                      </div>
                    </div>

                    {/* 하단 - 멤버 & 에이전트 */}
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      {memberCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {members.slice(0, 3).map((member: any) => (
                              <img
                                key={member.id}
                                src={member.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}&backgroundColor=e4e4e7`}
                                alt={member.user?.name}
                                title={member.user?.name}
                                className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-100 object-cover"
                              />
                            ))}
                            {agents.slice(0, 2).map((a: any) => (
                              <div
                                key={a.id}
                                title={a.agent?.name}
                                className="w-7 h-7 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                              </div>
                            ))}
                          </div>
                          {memberCount > 5 && (
                            <span className="text-xs font-medium text-zinc-500">+{memberCount - 5}</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <Users className="w-3.5 h-3.5" />
                          <span>멤버 없음</span>
                        </div>
                      )}

                      {/* 태스크 카운트 (있으면) */}
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>0 태스크</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Project Create Modal */}
      <ProjectCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
        isLoading={creating}
        teams={teams}
        onTeamChange={fetchTeamMembers}
        teamMembers={teamMembers}
      />

      {/* Click outside to close filter */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
      )}
    </div>
  )
}
