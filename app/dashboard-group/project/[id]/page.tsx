"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Users,
  Bot,
  Calendar,
  Edit2,
  Trash2,
  Plus,
  X,
  Loader2,
  Settings,
  UserPlus,
  Play,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import type { ProjectWithRelations, User, DeployedAgent } from "@/types/database"

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

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false)
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    fetchProject()
    fetchAgents()
  }, [projectId])

  useEffect(() => {
    if (project?.team_id) {
      fetchTeamMembers(project.team_id)
    }
  }, [project?.team_id])

  const fetchProject = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error("프로젝트 로드 실패")
      const data = await res.json()
      setProject(data)
    } catch (error) {
      console.error("Project fetch error:", error)
    } finally {
      setLoading(false)
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

  const addMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: "member" }),
      })
      if (!res.ok) throw new Error("멤버 추가 실패")
      fetchProject()
      setIsAddMemberOpen(false)
    } catch (error) {
      console.error("Add member error:", error)
      alert("멤버 추가에 실패했습니다")
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm("이 멤버를 프로젝트에서 제거하시겠습니까?")) return
    try {
      const res = await fetch(`/api/projects/${projectId}/members?member_id=${memberId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("멤버 제거 실패")
      fetchProject()
    } catch (error) {
      console.error("Remove member error:", error)
    }
  }

  const addAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId }),
      })
      if (!res.ok) throw new Error("에이전트 추가 실패")
      fetchProject()
      setIsAddAgentOpen(false)
    } catch (error) {
      console.error("Add agent error:", error)
      alert("에이전트 추가에 실패했습니다")
    }
  }

  const removeAgent = async (assignmentId: string) => {
    if (!confirm("이 에이전트를 프로젝트에서 제거하시겠습니까?")) return
    try {
      const res = await fetch(`/api/projects/${projectId}/agents?assignment_id=${assignmentId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("에이전트 제거 실패")
      fetchProject()
    } catch (error) {
      console.error("Remove agent error:", error)
    }
  }

  const updateProject = async (updates: Partial<ProjectWithRelations>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("업데이트 실패")
      const data = await res.json()
      setProject((prev) => (prev ? { ...prev, ...data } : data))
    } catch (error) {
      console.error("Update project error:", error)
    } finally {
      setSaving(false)
    }
  }

  const deleteProject = async () => {
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("삭제 실패")
      router.push("/dashboard-group/project")
    } catch (error) {
      console.error("Delete project error:", error)
    }
  }

  // 프로젝트에 이미 있는 멤버/에이전트 필터링
  const availableMembers = teamMembers.filter(
    (member) => !project?.members?.some((pm) => pm.user_id === member.id)
  )
  const availableAgents = agents.filter(
    (agent) => !project?.agents?.some((pa) => pa.agent_id === agent.id)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-zinc-500">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p>프로젝트를 찾을 수 없습니다</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20` }}
          >
            <span className="text-2xl" style={{ color: project.color }}>
              {project.name.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${statusLabels[project.status]?.color}20`,
                  color: statusLabels[project.status]?.color,
                }}
              >
                {statusLabels[project.status]?.label}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${priorityLabels[project.priority]?.color}20`,
                  color: priorityLabels[project.priority]?.color,
                }}
              >
                {priorityLabels[project.priority]?.label}
              </span>
              {project.deadline && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.deadline).toLocaleDateString("ko-KR")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            편집
          </Button>
          <Button variant="outline" size="sm" onClick={deleteProject}>
            <Trash2 className="w-4 h-4 mr-2" />
            삭제
          </Button>
        </div>
      </div>

      {/* Description & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">설명</h3>
          <p className="text-white">{project.description || "설명이 없습니다"}</p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-zinc-400">진행률</span>
              <span className="text-white font-medium">{project.progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${project.progress}%`,
                  backgroundColor: project.color,
                }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={project.progress}
              onChange={(e) => updateProject({ progress: parseInt(e.target.value) })}
              className="w-full mt-2 accent-white"
            />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-4">프로젝트 정보</h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-zinc-500">생성일</dt>
              <dd className="text-white">
                {new Date(project.created_at).toLocaleDateString("ko-KR")}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">팀원</dt>
              <dd className="text-white">{project.members?.length || 0}명</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">에이전트</dt>
              <dd className="text-white">{project.agents?.length || 0}개</dd>
            </div>
            {project.budget && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">예산</dt>
                <dd className="text-white">
                  {project.budget.toLocaleString()}원
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Members & Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Members */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4" />
              투입 인원
            </h3>
            <Button size="sm" variant="outline" onClick={() => setIsAddMemberOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              추가
            </Button>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {project.members?.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">투입된 인원이 없습니다</p>
            ) : (
              project.members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={member.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name}`}
                      alt={member.user?.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-white font-medium">{member.user?.name}</p>
                      <p className="text-xs text-zinc-500">{member.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        member.role === "lead"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-700 text-zinc-400"
                      }`}
                    >
                      {member.role === "lead" ? "리드" : "멤버"}
                    </span>
                    <button
                      onClick={() => removeMember(member.id)}
                      className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Agents */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4" />
              AI 에이전트
            </h3>
            <Button size="sm" variant="outline" onClick={() => setIsAddAgentOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              추가
            </Button>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {project.agents?.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">투입된 에이전트가 없습니다</p>
            ) : (
              project.agents?.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={assignment.agent?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${assignment.agent?.name}`}
                      alt={assignment.agent?.name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <p className="text-white font-medium">{assignment.agent?.name}</p>
                      <p className="text-xs text-zinc-500">{assignment.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        assignment.is_active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-zinc-700 text-zinc-400"
                      }`}
                    >
                      {assignment.is_active ? "활성" : "비활성"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        router.push(`/dashboard-group/agents/${assignment.agent_id}`)
                      }
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <button
                      onClick={() => removeAgent(assignment.id)}
                      className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setIsAddMemberOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <h3 className="font-semibold text-white">팀원 추가</h3>
                <button onClick={() => setIsAddMemberOpen(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {availableMembers.length === 0 ? (
                  <p className="text-center text-zinc-500 py-4">
                    추가 가능한 팀원이 없습니다
                  </p>
                ) : (
                  availableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => addMember(member.id)}
                      className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <img
                        src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="text-left">
                        <p className="text-white font-medium">{member.name}</p>
                        <p className="text-xs text-zinc-500">{member.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Agent Modal */}
      <AnimatePresence>
        {isAddAgentOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setIsAddAgentOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <h3 className="font-semibold text-white">AI 에이전트 추가</h3>
                <button onClick={() => setIsAddAgentOpen(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {availableAgents.length === 0 ? (
                  <p className="text-center text-zinc-500 py-4">
                    추가 가능한 에이전트가 없습니다
                  </p>
                ) : (
                  availableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => addAgent(agent.id)}
                      className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <img
                        src={agent.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name}`}
                        alt={agent.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="text-left flex-1">
                        <p className="text-white font-medium">{agent.name}</p>
                        <p className="text-xs text-zinc-500 line-clamp-1">
                          {agent.description || "설명 없음"}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          agent.status === "ACTIVE"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-zinc-700 text-zinc-400"
                        }`}
                      >
                        {agent.status === "ACTIVE" ? "활성" : "비활성"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Project Modal */}
      <AnimatePresence>
        {isEditOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={() => setIsEditOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <h3 className="font-semibold text-white">프로젝트 편집</h3>
                <button onClick={() => setIsEditOpen(false)}>
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">이름</label>
                  <input
                    type="text"
                    value={project.name}
                    onChange={(e) =>
                      setProject({ ...project, name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">설명</label>
                  <textarea
                    value={project.description || ""}
                    onChange={(e) =>
                      setProject({ ...project, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">상태</label>
                    <select
                      value={project.status}
                      onChange={(e) =>
                        setProject({ ...project, status: e.target.value as any })
                      }
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    >
                      <option value="planning">계획중</option>
                      <option value="active">진행중</option>
                      <option value="on_hold">보류</option>
                      <option value="completed">완료</option>
                      <option value="cancelled">취소</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      우선순위
                    </label>
                    <select
                      value={project.priority}
                      onChange={(e) =>
                        setProject({ ...project, priority: e.target.value as any })
                      }
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    >
                      <option value="low">낮음</option>
                      <option value="medium">보통</option>
                      <option value="high">높음</option>
                      <option value="urgent">긴급</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">마감일</label>
                  <input
                    type="date"
                    value={project.deadline || ""}
                    onChange={(e) =>
                      setProject({ ...project, deadline: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  취소
                </Button>
                <Button
                  onClick={() => {
                    updateProject({
                      name: project.name,
                      description: project.description,
                      status: project.status,
                      priority: project.priority,
                      deadline: project.deadline,
                    })
                    setIsEditOpen(false)
                  }}
                  disabled={saving}
                  style={{ backgroundColor: currentAccent.color }}
                  className="text-white"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "저장"
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
