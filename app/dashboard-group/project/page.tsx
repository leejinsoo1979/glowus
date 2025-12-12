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
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ProjectCreateModal, ProjectFormData } from "@/components/project/ProjectCreateModal"
import type { ProjectWithRelations, User, DeployedAgent } from "@/types/database"

const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
  planning: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-400", dot: "bg-zinc-400" },
  active: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  on_hold: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  completed: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" },
  cancelled: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
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
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchTeams()
    fetchAgents()
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

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents")
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) {
        setAgents(data)
      }
    } catch (error) {
      console.error("Agents fetch error:", error)
    }
  }

  const handleCreateProject = async (
    formData: ProjectFormData,
    selectedMembers: string[],
    selectedAgents: string[]
  ) => {
    if (!formData.name.trim() || !formData.team_id) return

    setCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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

      for (const agentId of selectedAgents) {
        await fetch(`/api/projects/${project.id}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId }),
        })
      }

      setIsCreateModalOpen(false)
      fetchProjects()
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
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">프로젝트가 없습니다</h3>
            <p className="text-sm text-zinc-500 mb-6">새 프로젝트를 만들어 시작하세요</p>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="accent"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              프로젝트 만들기
            </Button>
          </motion.div>
        ) : viewMode === "list" ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
              <div className="col-span-5 text-xs font-medium text-zinc-500 uppercase tracking-wider">프로젝트</div>
              <div className="col-span-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">상태</div>
              <div className="col-span-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">팀</div>
              <div className="col-span-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">수정일</div>
              <div className="col-span-1"></div>
            </div>

            {/* Rows */}
            {filteredProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer group transition-colors"
                onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
              >
                {/* Project Info */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Folder className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{project.description}</p>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${statusStyles[project.status]?.bg} ${statusStyles[project.status]?.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[project.status]?.dot}`} />
                    {statusLabels[project.status]}
                  </span>
                </div>

                {/* Team */}
                <div className="col-span-2">
                  <div className="flex items-center -space-x-1.5">
                    {project.members?.slice(0, 3).map((member) => (
                      <img
                        key={member.id}
                        src={member.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}&backgroundColor=e4e4e7`}
                        alt=""
                        className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-100"
                      />
                    ))}
                    {project.agents?.slice(0, 1).map((a) => (
                      <div
                        key={a.id}
                        className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-700 flex items-center justify-center"
                      >
                        <Bot className="w-3 h-3 text-zinc-300" />
                      </div>
                    ))}
                    {((project.members?.length || 0) + (project.agents?.length || 0)) > 4 && (
                      <div className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
                        +{(project.members?.length || 0) + (project.agents?.length || 0) - 4}
                      </div>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="col-span-2 flex items-center gap-1.5 text-xs text-zinc-500">
                  <Clock className="w-3.5 h-3.5" />
                  {formatRelativeDate(project.updated_at || project.created_at)}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg cursor-pointer transition-all"
                onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Folder className="w-5 h-5 text-zinc-500" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>

                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1 truncate">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{project.description}</p>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${statusStyles[project.status]?.bg} ${statusStyles[project.status]?.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyles[project.status]?.dot}`} />
                    {statusLabels[project.status]}
                  </span>
                  <span className="text-xs text-zinc-400">{formatRelativeDate(project.updated_at || project.created_at)}</span>
                </div>

                {((project.members?.length || 0) + (project.agents?.length || 0)) > 0 && (
                  <div className="flex items-center pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex -space-x-1.5">
                      {project.members?.slice(0, 4).map((member) => (
                        <img
                          key={member.id}
                          src={member.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}&backgroundColor=e4e4e7`}
                          alt=""
                          className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-100"
                        />
                      ))}
                      {project.agents?.slice(0, 1).map((a) => (
                        <div
                          key={a.id}
                          className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-700 flex items-center justify-center"
                        >
                          <Bot className="w-3 h-3 text-zinc-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
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
        agents={agents}
      />

      {/* Click outside to close filter */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
      )}
    </div>
  )
}
