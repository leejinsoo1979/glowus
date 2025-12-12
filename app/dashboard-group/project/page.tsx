"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  Filter,
  FolderKanban,
  Users,
  Bot,
  Calendar,
  MoreHorizontal,
  Loader2,
  ChevronRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { useRouter } from "next/navigation"
import type { Project, ProjectWithRelations, User, DeployedAgent } from "@/types/database"

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: "계획중", color: "#6B7280" },
  active: { label: "진행중", color: "#10B981" },
  on_hold: { label: "보류", color: "#F59E0B" },
  completed: { label: "완료", color: "#3B82F6" },
  cancelled: { label: "취소", color: "#EF4444" },
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: "낮음", color: "#6B7280" },
  medium: { label: "보통", color: "#3B82F6" },
  high: { label: "높음", color: "#F59E0B" },
  urgent: { label: "긴급", color: "#EF4444" },
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
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
      if (!res.ok) throw new Error("프로젝트 로드 실패")
      const data = await res.json()
      setProjects(data)
    } catch (error) {
      console.error("Projects fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams")
      if (!res.ok) return
      const data = await res.json()
      setTeams(data)
      if (data.length > 0 && !newProject.team_id) {
        setNewProject((prev) => ({ ...prev, team_id: data[0].id }))
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
      setTeamMembers(data.map((m: any) => m.user).filter(Boolean))
    } catch (error) {
      console.error("Team members fetch error:", error)
    }
  }

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents")
      if (!res.ok) return
      const data = await res.json()
      setAgents(data)
    } catch (error) {
      console.error("Agents fetch error:", error)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.name.trim() || !newProject.team_id) return

    setCreating(true)
    try {
      // 프로젝트 생성
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProject),
      })

      if (!res.ok) throw new Error("프로젝트 생성 실패")
      const project = await res.json()

      // 멤버 추가
      for (const userId of selectedMembers) {
        await fetch(`/api/projects/${project.id}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, role: "member" }),
        })
      }

      // 에이전트 추가
      for (const agentId of selectedAgents) {
        await fetch(`/api/projects/${project.id}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId }),
        })
      }

      // 리셋 및 새로고침
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

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || project.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const colorOptions = [
    "#8B5CF6",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#EC4899",
    "#06B6D4",
    "#84CC16",
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">프로젝트</h1>
          <p className="text-zinc-400 mt-1">팀원과 AI 에이전트를 프로젝트에 투입하세요</p>
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          style={{ backgroundColor: currentAccent.color }}
          className="text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          새 프로젝트
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="프로젝트 검색..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
        >
          <option value="all">모든 상태</option>
          <option value="planning">계획중</option>
          <option value="active">진행중</option>
          <option value="on_hold">보류</option>
          <option value="completed">완료</option>
          <option value="cancelled">취소</option>
        </select>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <FolderKanban className="w-16 h-16 mb-4 opacity-50" />
          <p>프로젝트가 없습니다</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            첫 프로젝트 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 cursor-pointer transition-all group"
              onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${project.color}20` }}
                  >
                    <FolderKanban className="w-5 h-5" style={{ color: project.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-zinc-100">
                      {project.name}
                    </h3>
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
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Description */}
              {project.description && (
                <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
                  {project.description}
                </p>
              )}

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-zinc-500">진행률</span>
                  <span className="text-zinc-400">{project.progress}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${project.progress}%`,
                      backgroundColor: project.color,
                    }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                {/* Members */}
                <div className="flex items-center gap-2">
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
                    {(project.members?.length || 0) > 3 && (
                      <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center">
                        <span className="text-[10px] text-zinc-400">
                          +{(project.members?.length || 0) - 3}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    <Users className="w-3 h-3 inline mr-1" />
                    {project.members?.length || 0}
                  </span>
                </div>

                {/* Agents */}
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {project.agents?.slice(0, 2).map((assignment) => (
                      <img
                        key={assignment.id}
                        src={assignment.agent?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${assignment.agent?.name}`}
                        alt={assignment.agent?.name}
                        className="w-6 h-6 rounded-full border-2 border-zinc-900"
                        title={assignment.agent?.name}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-zinc-500">
                    <Bot className="w-3 h-3 inline mr-1" />
                    {project.agents?.length || 0}
                  </span>
                </div>

                {/* Deadline */}
                {project.deadline && (
                  <span className="text-xs text-zinc-500">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {new Date(project.deadline).toLocaleDateString("ko-KR", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

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
                <h2 className="text-lg font-semibold text-white">새 프로젝트 만들기</h2>
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
                      onChange={(e) =>
                        setNewProject({ ...newProject, name: e.target.value })
                      }
                      placeholder="프로젝트 이름을 입력하세요"
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      설명
                    </label>
                    <textarea
                      value={newProject.description}
                      onChange={(e) =>
                        setNewProject({ ...newProject, description: e.target.value })
                      }
                      placeholder="프로젝트에 대한 설명을 입력하세요"
                      rows={3}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        팀 *
                      </label>
                      <select
                        value={newProject.team_id}
                        onChange={(e) =>
                          setNewProject({ ...newProject, team_id: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                      >
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        마감일
                      </label>
                      <input
                        type="date"
                        value={newProject.deadline}
                        onChange={(e) =>
                          setNewProject({ ...newProject, deadline: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        상태
                      </label>
                      <select
                        value={newProject.status}
                        onChange={(e) =>
                          setNewProject({ ...newProject, status: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                      >
                        <option value="planning">계획중</option>
                        <option value="active">진행중</option>
                        <option value="on_hold">보류</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        우선순위
                      </label>
                      <select
                        value={newProject.priority}
                        onChange={(e) =>
                          setNewProject({ ...newProject, priority: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
                      >
                        <option value="low">낮음</option>
                        <option value="medium">보통</option>
                        <option value="high">높음</option>
                        <option value="urgent">긴급</option>
                      </select>
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      색상
                    </label>
                    <div className="flex gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewProject({ ...newProject, color })}
                          className={`w-8 h-8 rounded-lg transition-all ${
                            newProject.color === color
                              ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                              : ""
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
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-800/50 rounded-lg min-h-[80px]">
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
                  <div className="flex flex-wrap gap-2 p-3 bg-zinc-800/50 rounded-lg min-h-[80px]">
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
                  disabled={!newProject.name.trim() || !newProject.team_id || creating}
                  style={{ backgroundColor: currentAccent.color }}
                  className="text-white"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      프로젝트 생성
                    </>
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
