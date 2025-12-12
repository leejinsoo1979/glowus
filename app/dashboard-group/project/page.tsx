"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  FolderKanban,
  Users,
  Bot,
  Calendar,
  MoreHorizontal,
  Loader2,
  X,
  LayoutGrid,
  List,
  Star,
  Clock,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { useRouter } from "next/navigation"
import type { ProjectWithRelations, User, DeployedAgent } from "@/types/database"

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "계획중", color: "#6B7280" },
  active: { label: "진행중", color: "#10B981" },
  on_hold: { label: "보류", color: "#F59E0B" },
  completed: { label: "완료", color: "#3B82F6" },
  cancelled: { label: "취소", color: "#EF4444" },
}

const projectTemplates = [
  { id: "blank", name: "빈 프로젝트", icon: Plus, color: "#E5E7EB" },
  { id: "marketing", name: "마케팅 캠페인", icon: Sparkles, color: "#8B5CF6" },
  { id: "product", name: "제품 개발", icon: FolderKanban, color: "#3B82F6" },
  { id: "research", name: "리서치", icon: Search, color: "#10B981" },
]

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

  // Create form state
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    team_id: "",
    status: "planning",
    priority: "medium",
    deadline: "",
    color: "#8B5CF6",
  })
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    fetchProjects()
    fetchTeams()
    fetchAgents()
  }, [])

  useEffect(() => {
    if (newProject.team_id) {
      fetchTeamMembers(newProject.team_id)
    }
  }, [newProject.team_id])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/projects")
      if (!res.ok) {
        console.error("프로젝트 로드 실패")
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
        if (data.length > 0 && !newProject.team_id) {
          setNewProject((prev) => ({ ...prev, team_id: data[0].id }))
        }
      }
    } catch (error) {
      console.error("Teams fetch error:", error)
    }
  }

  const fetchTeamMembers = async (teamId: string) => {
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
  }

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

  const handleCreateProject = async () => {
    if (!newProject.name.trim() || !newProject.team_id) return

    setCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
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
      setNewProject({
        name: "",
        description: "",
        team_id: teams[0]?.id || "",
        status: "planning",
        priority: "medium",
        deadline: "",
        color: "#8B5CF6",
      })
      setSelectedMembers([])
      setSelectedAgents([])
      fetchProjects()
    } catch (error) {
      console.error("Create project error:", error)
      alert("프로젝트 생성에 실패했습니다")
    } finally {
      setCreating(false)
    }
  }

  const filteredProjects = projects
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
      if (sortBy === "created") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      return 0
    })

  const colorOptions = [
    "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#06B6D4", "#84CC16",
  ]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "오늘"
    if (diffDays === 1) return "어제"
    if (diffDays < 7) return `${diffDays}일 전`
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-zinc-400">프로젝트 템플릿</span>
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {projectTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                if (template.id === "blank") {
                  setIsCreateModalOpen(true)
                }
              }}
              className="flex-shrink-0 w-32 group"
            >
              <div
                className="w-full h-20 rounded-lg border-2 border-dashed border-zinc-700 flex items-center justify-center mb-2 transition-all group-hover:border-zinc-500"
                style={{ backgroundColor: template.id === "blank" ? "transparent" : `${template.color}10` }}
              >
                <template.icon
                  className="w-6 h-6 transition-transform group-hover:scale-110"
                  style={{ color: template.id === "blank" ? "#71717A" : template.color }}
                />
              </div>
              <p className="text-xs text-zinc-400 text-center group-hover:text-zinc-300">
                {template.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Projects Section */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl">
        {/* Section Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">프로젝트</h2>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="text-zinc-400">
              템플릿 둘러보기
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              style={{ backgroundColor: currentAccent.color }}
              className="text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              새 프로젝트
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">필터</span>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                <option value="all">모든 상태</option>
                <option value="planning">계획중</option>
                <option value="active">진행중</option>
                <option value="on_hold">보류</option>
                <option value="completed">완료</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>

            {/* Sort */}
            <span className="text-sm text-zinc-500 ml-4">정렬</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600 cursor-pointer"
              >
                <option value="updated">최근 수정</option>
                <option value="created">생성일</option>
                <option value="name">이름</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className="w-48 pl-9 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* View Toggle */}
            <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 ${viewMode === "grid" ? "bg-zinc-700" : "bg-zinc-800 hover:bg-zinc-700/50"}`}
              >
                <LayoutGrid className="w-4 h-4 text-zinc-400" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 ${viewMode === "list" ? "bg-zinc-700" : "bg-zinc-800 hover:bg-zinc-700/50"}`}
              >
                <List className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
            <FolderKanban className="w-16 h-16 mb-4 opacity-50" />
            <p>프로젝트가 없습니다</p>
            <p className="text-sm mt-1">새 프로젝트를 만들어 시작하세요</p>
          </div>
        ) : viewMode === "list" ? (
          /* List View */
          <div className="divide-y divide-zinc-800">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs text-zinc-500 font-medium">
              <div className="col-span-5">이름</div>
              <div className="col-span-2">참여자</div>
              <div className="col-span-2">최근 수정</div>
              <div className="col-span-2">담당자</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-zinc-800/50 cursor-pointer group"
                onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
              >
                {/* Name */}
                <div className="col-span-5 flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${project.color}20` }}
                  >
                    <FolderKanban className="w-4 h-4" style={{ color: project.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{project.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{project.description || "설명 없음"}</p>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: `${statusLabels[project.status]?.color}20`,
                      color: statusLabels[project.status]?.color,
                    }}
                  >
                    {statusLabels[project.status]?.label}
                  </span>
                </div>

                {/* Members */}
                <div className="col-span-2 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {project.members?.slice(0, 3).map((member) => (
                      <img
                        key={member.id}
                        src={member.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name}`}
                        alt={member.user?.name}
                        className="w-6 h-6 rounded-full border-2 border-zinc-900"
                        title={member.user?.name}
                      />
                    ))}
                    {project.agents?.slice(0, 1).map((assignment) => (
                      <img
                        key={assignment.id}
                        src={assignment.agent?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${assignment.agent?.name}`}
                        alt={assignment.agent?.name}
                        className="w-6 h-6 rounded-full border-2 border-zinc-900 bg-zinc-800"
                        title={`🤖 ${assignment.agent?.name}`}
                      />
                    ))}
                  </div>
                  {((project.members?.length || 0) + (project.agents?.length || 0)) > 4 && (
                    <span className="text-xs text-zinc-500">
                      +{(project.members?.length || 0) + (project.agents?.length || 0) - 4}
                    </span>
                  )}
                </div>

                {/* Last Updated */}
                <div className="col-span-2 text-sm text-zinc-400">
                  {formatDate(project.updated_at || project.created_at)}
                </div>

                {/* Owner */}
                <div className="col-span-2 text-sm text-zinc-400">
                  {project.owner?.name || "-"}
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1 hover:bg-zinc-700 rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Star className="w-4 h-4 text-zinc-500 hover:text-yellow-400" />
                  </button>
                  <button
                    className="p-1 hover:bg-zinc-700 rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-zinc-600 cursor-pointer transition-all group"
                onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
              >
                {/* Thumbnail */}
                <div
                  className="w-full h-24 rounded-lg mb-3 flex items-center justify-center"
                  style={{ backgroundColor: `${project.color}15` }}
                >
                  <FolderKanban className="w-10 h-10" style={{ color: project.color, opacity: 0.7 }} />
                </div>

                {/* Info */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white truncate">{project.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      수정: {formatDate(project.updated_at || project.created_at)}
                    </p>
                  </div>
                  <button
                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                  </button>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-700">
                  <div className="flex -space-x-2">
                    {project.members?.slice(0, 3).map((member) => (
                      <img
                        key={member.id}
                        src={member.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name}`}
                        alt={member.user?.name}
                        className="w-6 h-6 rounded-full border-2 border-zinc-800"
                      />
                    ))}
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${statusLabels[project.status]?.color}20`,
                      color: statusLabels[project.status]?.color,
                    }}
                  >
                    {statusLabels[project.status]?.label}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <h2 className="text-lg font-semibold text-white">새 프로젝트</h2>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      프로젝트 이름 *
                    </label>
                    <input
                      type="text"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="프로젝트 이름을 입력하세요"
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      설명
                    </label>
                    <textarea
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="프로젝트에 대한 설명을 입력하세요"
                      rows={3}
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">팀 *</label>
                      <select
                        value={newProject.team_id}
                        onChange={(e) => setNewProject({ ...newProject, team_id: e.target.value })}
                        className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                      >
                        {teams.length === 0 ? (
                          <option value="">팀 없음</option>
                        ) : (
                          teams.map((team) => (
                            <option key={team.id} value={team.id}>{team.name}</option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">마감일</label>
                      <input
                        type="date"
                        value={newProject.deadline}
                        onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                        className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">색상</label>
                    <div className="flex gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewProject({ ...newProject, color })}
                          className={`w-8 h-8 rounded-lg transition-all ${
                            newProject.color === color
                              ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                              : "hover:scale-110"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    <Users className="w-4 h-4 inline mr-2" />
                    팀원 추가
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-800/50 rounded-lg min-h-[60px]">
                    {teamMembers.length === 0 ? (
                      <p className="text-zinc-500 text-sm">팀을 선택하면 팀원이 표시됩니다</p>
                    ) : (
                      teamMembers.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            if (selectedMembers.includes(member.id)) {
                              setSelectedMembers(selectedMembers.filter((id) => id !== member.id))
                            } else {
                              setSelectedMembers([...selectedMembers, member.id])
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            selectedMembers.includes(member.id)
                              ? "bg-zinc-700 border-zinc-600"
                              : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                          }`}
                        >
                          <img
                            src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                            alt={member.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-sm text-white">{member.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* AI Agents */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    <Bot className="w-4 h-4 inline mr-2" />
                    AI 에이전트 투입
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-800/50 rounded-lg min-h-[60px]">
                    {agents.length === 0 ? (
                      <p className="text-zinc-500 text-sm">사용 가능한 에이전트가 없습니다</p>
                    ) : (
                      agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => {
                            if (selectedAgents.includes(agent.id)) {
                              setSelectedAgents(selectedAgents.filter((id) => id !== agent.id))
                            } else {
                              setSelectedAgents([...selectedAgents, agent.id])
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            selectedAgents.includes(agent.id)
                              ? "bg-zinc-700 border-zinc-600"
                              : "bg-zinc-800 border-zinc-700 hover:border-zinc-600"
                          }`}
                        >
                          <img
                            src={agent.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name}`}
                            alt={agent.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-sm text-white">{agent.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800">
                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  취소
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim() || creating}
                  style={{ backgroundColor: currentAccent.color }}
                  className="text-white"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    "프로젝트 생성"
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
