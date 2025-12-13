"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Bot,
  Plus,
  Grid3X3,
  Play,
  Pause,
  Settings,
  Copy,
  Trash2,
  Clock,
  Zap,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { AgentGroupModal } from "@/components/agent/AgentGroupModal"
import { PROVIDER_INFO, LLMProvider } from "@/lib/llm/models"
import type { DeployedAgent, AgentStatus, AgentGroup, InteractionMode } from "@/types/database"

type TabType = "agents" | "groups"

const interactionModeLabels: Record<InteractionMode, string> = {
  solo: "단독",
  sequential: "순차",
  debate: "토론",
  collaborate: "협업",
  supervisor: "감독자",
}

const statusConfig: Record<
  AgentStatus,
  { label: string; color: string; bgColor: string }
> = {
  ACTIVE: { label: "활성", color: "#22c55e", bgColor: "#22c55e20" },
  INACTIVE: { label: "비활성", color: "#64748b", bgColor: "#64748b20" },
  BUSY: { label: "작업 중", color: "#f59e0b", bgColor: "#f59e0b20" },
  ERROR: { label: "오류", color: "#ef4444", bgColor: "#ef444420" },
}

// 노드 타입별 카테고리 매핑
function getCategoryFromCapabilities(capabilities: string[]): {
  label: string
  icon: React.ElementType
} {
  if (capabilities.includes("대화 기억") || capabilities.includes("프롬프트 처리")) {
    return { label: "챗봇", icon: MessageSquare }
  }
  if (capabilities.includes("문서 검색")) {
    return { label: "분석기", icon: Zap }
  }
  if (capabilities.includes("이미지 생성") || capabilities.includes("텍스트 생성")) {
    return { label: "생성기", icon: Sparkles }
  }
  return { label: "어시스턴트", icon: Bot }
}

// 로봇 아바타 URL 생성 (DiceBear bottts)
function generateRobotAvatar(name: string): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=3B82F6,10B981,F59E0B,EF4444,8B5CF6,EC4899`
}

// 아바타 URL 가져오기 (ui-avatars는 로봇 아바타로 교체)
function getAvatarUrl(agent: DeployedAgent): string {
  if (!agent.avatar_url || agent.avatar_url.includes('ui-avatars.com')) {
    return generateRobotAvatar(agent.name)
  }
  return agent.avatar_url
}

// 시간 포맷
function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return ""
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "방금 전"
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${diffDay}일 전`
}

export default function AgentsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [groups, setGroups] = useState<(AgentGroup & { members?: any[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { accentColor } = useThemeStore()
  const [activeTab, setActiveTab] = useState<TabType>("agents")

  // Modal states
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<(AgentGroup & { members?: any[] }) | undefined>()

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [agentsRes, groupsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/agent-groups"),
      ])

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        setAgents(agentsData)
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        setGroups(groupsData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류")
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/agents")
      if (!res.ok) {
        throw new Error("에이전트 목록을 불러오는데 실패했습니다")
      }
      const data = await res.json()
      setAgents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveGroup = async (groupData: Partial<AgentGroup> & { agent_ids?: string[] }) => {
    const method = groupData.id ? "PATCH" : "POST"
    const url = groupData.id ? `/api/agent-groups/${groupData.id}` : "/api/agent-groups"

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groupData),
    })

    if (!response.ok) {
      throw new Error("그룹 저장 실패")
    }

    await fetchData()
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("정말 이 그룹을 삭제하시겠습니까?")) return

    try {
      const response = await fetch(`/api/agent-groups/${groupId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setGroups(groups.filter(g => g.id !== groupId))
      }
    } catch (error) {
      console.error("그룹 삭제 실패:", error)
    }
  }

  const handleDelete = async (agentId: string) => {
    if (!confirm("정말 이 에이전트를 삭제하시겠습니까?")) return

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error("에이전트 삭제에 실패했습니다")
      }
      // 목록 새로고침
      fetchAgents()
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 오류")
    }
  }

  const handleToggleStatus = async (agent: DeployedAgent) => {
    const newStatus: AgentStatus = agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        throw new Error("상태 변경에 실패했습니다")
      }
      fetchAgents()
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경 오류")
    }
  }

  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  // Calculate stats
  const totalAgents = agents.length
  const activeAgents = agents.filter((a) => a.status === "ACTIVE").length
  const totalGroups = groups.length
  const avgNodes =
    agents.length > 0
      ? Math.round(
          agents.reduce((sum, a) => sum + (a.workflow_nodes?.length || 0), 0) /
            agents.length
        )
      : 0

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: mounted ? `${currentAccent.color}20` : "#8b5cf620" }}
            >
              <Bot
                className="w-5 h-5"
                style={{ color: mounted ? currentAccent.color : "#8b5cf6" }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">AI 에이전트</h1>
              <p className="text-sm text-zinc-500">
                AI 에이전트를 생성하고 관리하세요
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "groups" && (
              <Button
                onClick={() => {
                  setEditingGroup(undefined)
                  setShowGroupModal(true)
                }}
                variant="outline"
                className="border-purple-500 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Users className="w-4 h-4 mr-2" />새 그룹
              </Button>
            )}
            <Button
              onClick={() => router.push("/agent-builder/new")}
              style={{
                backgroundColor: mounted ? currentAccent.color : "#8b5cf6",
              }}
              className="text-white"
            >
              <Plus className="w-4 h-4 mr-2" />새 에이전트
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4">
          <button
            onClick={() => setActiveTab("agents")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "agents"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Bot className="w-4 h-4 inline mr-2" />
            에이전트 ({totalAgents})
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "groups"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            그룹 ({totalGroups})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-500">전체 에이전트</span>
              <Bot className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{totalAgents}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-500">활성 에이전트</span>
              <Zap className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{activeAgents}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-500">비활성 에이전트</span>
              <Pause className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalAgents - activeAgents}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-500">평균 노드 수</span>
              <Grid3X3 className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{avgNodes}</div>
          </motion.div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            <p className="mt-4 text-zinc-500">에이전트 목록을 불러오는 중...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="mt-4 text-zinc-500">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={fetchAgents}
            >
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty State - Agents Tab */}
        {activeTab === "agents" && !loading && !error && agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: mounted ? `${currentAccent.color}20` : "#8b5cf620" }}
            >
              <Bot
                className="w-8 h-8"
                style={{ color: mounted ? currentAccent.color : "#8b5cf6" }}
              />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              아직 에이전트가 없습니다
            </h3>
            <p className="mt-2 text-zinc-500 text-center">
              첫 번째 AI 에이전트를 만들어보세요!
            </p>
            <Button
              onClick={() => router.push("/agent-builder/new")}
              className="mt-4 text-white"
              style={{ backgroundColor: mounted ? currentAccent.color : "#8b5cf6" }}
            >
              <Plus className="w-4 h-4 mr-2" />
              에이전트 만들기
            </Button>
          </div>
        )}

        {/* Agent List */}
        {activeTab === "agents" && !loading && !error && agents.length > 0 && (
          <div className="space-y-3">
            {agents.map((agent, index) => {
              const status = statusConfig[agent.status] || statusConfig.INACTIVE
              const category = getCategoryFromCapabilities(agent.capabilities || [])
              const CategoryIcon = category.icon
              const nodeCount = agent.workflow_nodes?.length || 0

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl border transition-colors bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer"
                  onClick={() => router.push(`/dashboard-group/agents/${agent.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={getAvatarUrl(agent)}
                        alt={agent.name}
                        className="w-12 h-12 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800"
                      />

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                            {agent.name}
                          </h3>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: status.bgColor,
                              color: status.color,
                            }}
                          >
                            {status.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {category.label}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5 text-zinc-500">
                          {agent.description || "설명 없음"}
                        </p>
                        {/* 기능 태그 */}
                        {agent.capabilities && agent.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {agent.capabilities
                              .filter((cap: string) => !cap.startsWith('team:'))
                              .slice(0, 6)
                              .map((capability: string, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md text-xs font-medium"
                                  style={{
                                    backgroundColor: mounted ? `${currentAccent.color}15` : "#8b5cf615",
                                    color: mounted ? currentAccent.color : "#8b5cf6",
                                  }}
                                >
                                  {capability}
                                </span>
                              ))}
                            {agent.capabilities.filter((cap: string) => !cap.startsWith('team:')).length > 6 && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                +{agent.capabilities.filter((cap: string) => !cap.startsWith('team:')).length - 6}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1">
                          <Grid3X3 className="w-4 h-4" />
                          <span>{nodeCount} 노드</span>
                        </div>
                        {agent.last_active_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTimeAgo(agent.last_active_at)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1" title={`${agent.llm_provider || 'ollama'} / ${agent.model}`}>
                          <span className="text-base">{PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]?.icon || '🤖'}</span>
                          <span>{agent.model || 'qwen2.5:3b'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={agent.status === "ACTIVE" ? "비활성화" : "활성화"}
                          onClick={() => handleToggleStatus(agent)}
                        >
                          {agent.status === "ACTIVE" ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="설정"
                          onClick={() => router.push(`/agent-builder/${agent.id}`)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="복제">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          title="삭제"
                          onClick={() => handleDelete(agent.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Groups Tab Content */}
        {activeTab === "groups" && !loading && !error && (
          <>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-purple-100 dark:bg-purple-900/30">
                  <Users className="w-8 h-8 text-purple-500" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  아직 그룹이 없습니다
                </h3>
                <p className="mt-2 text-zinc-500 text-center">
                  에이전트들을 그룹으로 묶어 협업하게 하세요
                </p>
                <Button
                  onClick={() => {
                    setEditingGroup(undefined)
                    setShowGroupModal(true)
                  }}
                  className="mt-4 bg-purple-500 hover:bg-purple-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  그룹 만들기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {groups.map((group, index) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-5 rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Users className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-900 dark:text-white">
                            {group.name}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {interactionModeLabels[group.interaction_mode]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingGroup(group)
                            setShowGroupModal(true)
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {group.description && (
                      <p className="text-sm text-zinc-500 mb-4">
                        {group.description}
                      </p>
                    )}

                    {/* Members */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">멤버:</span>
                      <div className="flex -space-x-2">
                        {group.members?.slice(0, 5).map((member: any, idx: number) => (
                          <div
                            key={member.agent?.id || idx}
                            className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-zinc-900"
                            title={member.agent?.name}
                          >
                            {member.agent?.name?.charAt(0) || "?"}
                          </div>
                        ))}
                        {(group.members?.length || 0) > 5 && (
                          <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-600 dark:text-zinc-300 border-2 border-white dark:border-zinc-900">
                            +{(group.members?.length || 0) - 5}
                          </div>
                        )}
                      </div>
                      {(!group.members || group.members.length === 0) && (
                        <span className="text-xs text-zinc-400">없음</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Group Modal */}
      <AgentGroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false)
          setEditingGroup(undefined)
        }}
        onSave={handleSaveGroup}
        group={editingGroup}
        availableAgents={agents}
      />
    </div>
  )
}
