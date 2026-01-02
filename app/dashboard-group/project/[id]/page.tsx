"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Users,
  Bot,
  Calendar,
  Trash2,
  Plus,
  X,
  Loader2,
  Settings,
  UserPlus,
  Play,
  AlertCircle,
  DollarSign,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import {
  ProjectSidebar,
  OverviewSection,
  RoadmapSection,
  WorkflowSection,
  CalendarSection,
  UpdatesSection,
  AIIntelligenceDashboard,
  type ProjectSection,
} from "@/components/project-dashboard"
import {
  WorkflowCanvas,
  ProjectDocuments,
  ProjectOverview,
} from "@/components/project-workflow"
import type { ProjectWithRelations, User, DeployedAgent } from "@/types/database"

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [activeSection, setActiveSection] = useState<ProjectSection>("overview")
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

  // API returns project_members/project_agents naming
  const projectMembers = (project as any)?.project_members || project?.members || []
  const projectAgents = (project as any)?.project_agents || project?.agents || []

  const availableMembers = teamMembers.filter(
    (member) => !projectMembers.some((pm: any) => pm.user_id === member.id)
  )
  const availableAgents = agents.filter(
    (agent) => !projectAgents.some((pa: any) => pa.agent_id === agent.id)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-zinc-400" />
          <p className="text-zinc-500">프로젝트 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-zinc-500">
        <AlertCircle className="w-16 h-16 mb-4" />
        <p className="text-xl mb-2">프로젝트를 찾을 수 없습니다</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <OverviewSection
            projectId={projectId}
            project={{
              name: project.name,
              description: project.description,
              status: project.status,
              progress: project.progress,
              deadline: project.deadline,
              color: project.color,
              mission: project.description,
              stage: project.status === "planning" ? "planning" : project.status === "active" ? "development" : "production",
              // API returns project_members/project_agents, support both naming conventions
              members: (project as any).project_members || project.members || [],
              agents: (project as any).project_agents || project.agents || [],
              folderPath: (project as any).folder_path || null,
              githubRepo: (project as any).github_repo || null,
              githubCloneUrl: (project as any).github_clone_url || null,
            }}
            onEdit={() => setIsEditOpen(true)}
          />
        )

      case "roadmap":
        return (
          <RoadmapSection
            projectId={projectId}
            project={{
              name: project.name,
              deadline: project.deadline,
              stage: project.status === "planning" ? "planning" : project.status === "active" ? "development" : "production",
            }}
          />
        )

      case "workflow":
        return (
          <WorkflowSection
            projectId={projectId}
            project={{
              name: project.name,
              status: project.status,
            }}
          />
        )

      case "team":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">조직 구성</h2>
                <p className="text-sm text-zinc-500 mt-1">프로젝트 팀원 및 AI 에이전트 관리</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Team Members */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                    팀원
                    <span className="text-sm text-zinc-500">({projectMembers.length})</span>
                  </h3>
                  <Button size="sm" onClick={() => setIsAddMemberOpen(true)} className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                    <UserPlus className="w-4 h-4 mr-2" />
                    추가
                  </Button>
                </div>
                <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                  {projectMembers.length === 0 ? (
                    <div className="text-center text-zinc-500 py-12">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>투입된 팀원이 없습니다</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setIsAddMemberOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        팀원 추가
                      </Button>
                    </div>
                  ) : (
                    projectMembers.map((member: any) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={member.user?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.user?.name}`}
                            alt={member.user?.name}
                            className="w-12 h-12 rounded-full bg-white dark:bg-zinc-700 shadow-sm"
                          />
                          <div>
                            <p className="text-zinc-900 dark:text-white font-medium">{member.user?.name}</p>
                            <p className="text-sm text-zinc-500">{member.user?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-3 py-1 rounded-full ${member.role === "lead"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                              }`}
                          >
                            {member.role === "lead" ? "리드" : "멤버"}
                          </span>
                          <button
                            onClick={() => removeMember(member.id)}
                            className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* AI Agents */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                  <h3 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                    AI 에이전트
                    <span className="text-sm text-zinc-500">({projectAgents.length})</span>
                  </h3>
                  <Button size="sm" onClick={() => setIsAddAgentOpen(true)} className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200">
                    <Plus className="w-4 h-4 mr-2" />
                    추가
                  </Button>
                </div>
                <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                  {projectAgents.length === 0 ? (
                    <div className="text-center text-zinc-500 py-12">
                      <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>투입된 AI 에이전트가 없습니다</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setIsAddAgentOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        에이전트 추가
                      </Button>
                    </div>
                  ) : (
                    projectAgents.map((assignment: any) => (
                      <motion.div
                        key={assignment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={assignment.agent?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${assignment.agent?.name}`}
                            alt={assignment.agent?.name}
                            className="w-12 h-12 rounded-full bg-white dark:bg-zinc-700 shadow-sm"
                          />
                          <div>
                            <p className="text-zinc-900 dark:text-white font-medium">{assignment.agent?.name}</p>
                            <p className="text-sm text-zinc-500 line-clamp-1">
                              {assignment.agent?.description || assignment.role}
                            </p>
                            {assignment.agent?.capabilities && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {assignment.agent.capabilities.slice(0, 3).map((cap: string) => (
                                  <span
                                    key={cap}
                                    className="text-xs px-1.5 py-0.5 bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 rounded"
                                  >
                                    {cap}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-3 py-1 rounded-full ${assignment.is_active
                              ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                              }`}
                          >
                            {assignment.is_active ? "활성" : "비활성"}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/dashboard-group/agents/${assignment.agent_id}`)}
                            className="hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          >
                            <Play className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                          </Button>
                          <button
                            onClick={() => removeAgent(assignment.id)}
                            className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case "tasks":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">작업 관리</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">AI 워크플로우로 태스크 자동화</p>
              </div>
            </div>
            <WorkflowCanvas projectId={projectId} />
          </div>
        )

      case "calendar":
        return (
          <CalendarSection
            projectId={projectId}
            project={{
              name: project.name,
              deadline: project.deadline,
            }}
          />
        )

      case "progress":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">진행 현황</h2>
                <p className="text-sm text-zinc-500 mt-1">프로젝트 전체 진행 상황 및 통계</p>
              </div>
            </div>
            <ProjectOverview
              projectId={projectId}
              project={{
                name: project.name,
                progress: project.progress,
                deadline: project.deadline,
                status: project.status,
                members: projectMembers,
                agents: projectAgents,
              }}
            />
          </div>
        )

      case "updates":
        return (
          <UpdatesSection
            projectId={projectId}
            project={{
              name: project.name,
            }}
          />
        )

      case "documents":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">문서 자료</h2>
                <p className="text-sm text-zinc-500 mt-1">프로젝트 관련 문서 및 자료 관리</p>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <ProjectDocuments projectId={projectId} />
            </div>
          </div>
        )

      case "budget":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">예산 관리</h2>
                <p className="text-sm text-zinc-500 mt-1">프로젝트 비용 및 리소스 현황</p>
              </div>
              <Button variant="outline" size="sm" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                비용 추가
              </Button>
            </div>

            {/* Budget Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-zinc-500">총 예산</span>
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">₩50,000,000</div>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-zinc-500">사용 금액</span>
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">₩32,500,000</div>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-zinc-500">잔액</span>
                </div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">₩17,500,000</div>
              </div>
            </div>

            {/* Budget Details */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">비용 내역</h3>
              <div className="text-center py-12 text-zinc-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>아직 등록된 비용 내역이 없습니다</p>
                <p className="text-sm mt-2">비용 추가 버튼을 눌러 첫 내역을 등록하세요</p>
              </div>
            </div>
          </div>
        )

      case "ai-intelligence":
        return <AIIntelligenceDashboard projectId={projectId} />

      case "settings":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">프로젝트 설정</h2>
                <p className="text-sm text-zinc-500 mt-1">프로젝트 정보 및 권한 관리</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">기본 정보</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">프로젝트 이름</label>
                    <input
                      type="text"
                      value={project.name}
                      onChange={(e) => setProject({ ...project, name: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">설명</label>
                    <textarea
                      value={project.description || ""}
                      onChange={(e) => setProject({ ...project, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">상태</label>
                      <select
                        value={project.status}
                        onChange={(e) => setProject({ ...project, status: e.target.value as any })}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="planning">계획중</option>
                        <option value="active">진행중</option>
                        <option value="on_hold">보류</option>
                        <option value="completed">완료</option>
                        <option value="cancelled">취소</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">우선순위</label>
                      <select
                        value={project.priority}
                        onChange={(e) => setProject({ ...project, priority: e.target.value as any })}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="low">낮음</option>
                        <option value="medium">보통</option>
                        <option value="high">높음</option>
                        <option value="urgent">긴급</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">마감일</label>
                    <input
                      type="date"
                      value={project.deadline || ""}
                      onChange={(e) => setProject({ ...project, deadline: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <Button
                    onClick={() =>
                      updateProject({
                        name: project.name,
                        description: project.description,
                        status: project.status,
                        priority: project.priority,
                        deadline: project.deadline,
                      })
                    }
                    disabled={saving}
                    className="w-full shadow-md text-white font-bold"
                    style={{ backgroundColor: currentAccent.color }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "변경사항 저장"}
                  </Button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">진행률</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">현재 진행률</span>
                      <span className="text-zinc-900 dark:text-white font-medium">{project.progress}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={project.progress}
                      onChange={(e) => updateProject({ progress: parseInt(e.target.value) })}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-6">
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-4">위험 구역</h3>
                  <p className="text-sm text-red-500 dark:text-zinc-400 mb-4">
                    프로젝트를 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                  </p>
                  <Button
                    variant="ghost"
                    onClick={deleteProject}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    프로젝트 삭제
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-zinc-950">
      {/* Sidebar - Fixed, no scroll with page */}
      <ProjectSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        project={{
          name: project.name,
          color: project.color,
          status: project.status,
          progress: project.progress,
        }}
        taskCount={0}
        updateCount={0}
      />

      {/* Main Content - Only this area scrolls */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header - Fixed within content */}
        <div className="flex-shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <ArrowLeft className="w-4 h-4 mr-2" />
              프로젝트 목록
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddMemberOpen(true)} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                <UserPlus className="w-4 h-4 mr-2" />
                팀원 추가
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsAddAgentOpen(true)} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                <Bot className="w-4 h-4 mr-2" />
                에이전트 추가
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50 dark:bg-black/20">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsAddMemberOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-white">팀원 추가</h3>
                <button onClick={() => setIsAddMemberOpen(false)}>
                  <X className="w-5 h-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-white" />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {availableMembers.length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">추가 가능한 팀원이 없습니다</p>
                ) : (
                  availableMembers.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => addMember(member.id)}
                      className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                    >
                      <img
                        src={member.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                        alt={member.name}
                        className="w-10 h-10 rounded-full bg-white dark:bg-zinc-700"
                      />
                      <div className="text-left">
                        <p className="text-zinc-900 dark:text-white font-medium">{member.name}</p>
                        <p className="text-sm text-zinc-500">{member.email}</p>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsAddAgentOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-white">AI 에이전트 추가</h3>
                <button onClick={() => setIsAddAgentOpen(false)}>
                  <X className="w-5 h-5 text-zinc-400 hover:text-zinc-600 dark:hover:text-white" />
                </button>
              </div>
              <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                {availableAgents.length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">추가 가능한 에이전트가 없습니다</p>
                ) : (
                  availableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => addAgent(agent.id)}
                      className="w-full flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                    >
                      <img
                        src={agent.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.name}`}
                        alt={agent.name}
                        className="w-10 h-10 rounded-full bg-white dark:bg-zinc-700"
                      />
                      <div className="text-left flex-1">
                        <p className="text-zinc-900 dark:text-white font-medium">{agent.name}</p>
                        <p className="text-sm text-zinc-500 line-clamp-1">
                          {agent.description || "설명 없음"}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${agent.status === "ACTIVE"
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
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
    </div>
  )
}
