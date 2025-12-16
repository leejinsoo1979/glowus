"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  Plus,
  Search,
  Play,
  Pause,
  Settings,
  Trash2,
  Zap,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertCircle,
  Users,
  Brain,
  Layers,
  Star,
  Clock,
  MoreHorizontal,
  Grid,
  List,
  Filter,
  SlidersHorizontal,
  Library,
  Cpu,
  Workflow,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { AgentGroupModal } from "@/components/agent/AgentGroupModal"
import { PROVIDER_INFO, LLMProvider } from "@/lib/llm/models"
import type { DeployedAgent, AgentStatus, AgentGroup, InteractionMode } from "@/types/database"

type TabType = "agents" | "groups"
type ViewMode = "grid" | "list"

const interactionModeLabels: Record<InteractionMode, string> = {
  solo: "단독",
  sequential: "순차",
  debate: "토론",
  collaborate: "협업",
  supervisor: "감독자",
}

const statusConfig: Record<AgentStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: "활성", color: "#22c55e", bgColor: "#22c55e20" },
  INACTIVE: { label: "비활성", color: "#64748b", bgColor: "#64748b20" },
  BUSY: { label: "작업 중", color: "#f59e0b", bgColor: "#f59e0b20" },
  ERROR: { label: "오류", color: "#ef4444", bgColor: "#ef444420" },
}

// 카테고리 정의
const categories = [
  { id: "all", label: "전체", icon: Layers },
  { id: "chatbot", label: "챗봇", icon: MessageSquare },
  { id: "analyzer", label: "분석기", icon: Brain },
  { id: "generator", label: "생성기", icon: Sparkles },
  { id: "assistant", label: "어시스턴트", icon: Bot },
]

function getCategoryId(capabilities: string[]): string {
  if (capabilities.includes("대화 기억") || capabilities.includes("프롬프트 처리")) return "chatbot"
  if (capabilities.includes("문서 검색")) return "analyzer"
  if (capabilities.includes("이미지 생성") || capabilities.includes("텍스트 생성")) return "generator"
  return "assistant"
}

function generateRobotAvatar(name: string): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=3B82F6,10B981,F59E0B,EF4444,8B5CF6,EC4899`
}

function getAvatarUrl(agent: DeployedAgent): string {
  if (!agent.avatar_url || agent.avatar_url.includes('ui-avatars.com')) {
    return generateRobotAvatar(agent.name)
  }
  return agent.avatar_url
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "사용 기록 없음"
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return "방금 사용"
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
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
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

      if (agentsRes.ok) setAgents(await agentsRes.json())
      if (groupsRes.ok) setGroups(await groupsRes.json())
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
    if (!response.ok) throw new Error("그룹 저장 실패")
    await fetchData()
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("정말 이 그룹을 삭제하시겠습니까?")) return
    try {
      const response = await fetch(`/api/agent-groups/${groupId}`, { method: "DELETE" })
      if (response.ok) setGroups(groups.filter(g => g.id !== groupId))
    } catch (error) {
      console.error("그룹 삭제 실패:", error)
    }
  }

  const handleDelete = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("정말 이 에이전트를 삭제하시겠습니까?")) return
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" })
      if (res.ok) fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 오류")
    }
  }

  const handleToggleStatus = async (agent: DeployedAgent, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus: AgentStatus = agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경 오류")
    }
  }

  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  // Filtered agents
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (agent.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" ||
        getCategoryId(agent.capabilities || []) === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [agents, searchQuery, selectedCategory])

  const totalAgents = agents.length
  const activeAgents = agents.filter((a) => a.status === "ACTIVE").length

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30 dark:opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl"
            style={{ backgroundColor: mounted ? `${currentAccent.color}30` : "#8b5cf630" }} />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-3xl bg-blue-500/20" />
        </div>

        <div className="relative px-8 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              {/* Icon */}
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    background: mounted
                      ? `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.color}cc)`
                      : "linear-gradient(135deg, #8b5cf6, #8b5cf6cc)"
                  }}
                >
                  <Library className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">{activeAgents}</span>
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                  에이전트 라이브러리
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  {totalAgents}개의 AI 에이전트 • 언제든 꺼내 쓸 수 있는 나만의 자비스들
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {activeTab === "groups" && (
                <Button
                  onClick={() => { setEditingGroup(undefined); setShowGroupModal(true) }}
                  variant="outline"
                  className="border-purple-400 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  <Users className="w-4 h-4 mr-2" />새 그룹
                </Button>
              )}
              <Button
                onClick={() => router.push("/agent-builder/new")}
                className="text-white shadow-lg hover:shadow-xl transition-shadow"
                style={{ background: mounted ? `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.hoverColor})` : "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
              >
                <Plus className="w-4 h-4 mr-2" />슈퍼 에이전트 생성
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="mt-6 flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="에이전트 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0 transition-shadow"
                style={{ focusRing: mounted ? currentAccent.color : "#8b5cf6" } as any}
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              {categories.map((cat) => {
                const Icon = cat.icon
                const isActive = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive
                      ? "text-white shadow-md"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                      }`}
                    style={isActive ? { backgroundColor: mounted ? currentAccent.color : "#8b5cf6" } : {}}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                )
              })}
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "grid"
                  ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "list"
                  ? "bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Pills */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setActiveTab("agents")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === "agents"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg"
                : "bg-white dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
            >
              <Bot className="w-4 h-4" />
              에이전트
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === "agents"
                ? "bg-white/20 dark:bg-zinc-900/20"
                : "bg-zinc-100 dark:bg-zinc-700"
                }`}>
                {totalAgents}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === "groups"
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg"
                : "bg-white dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
            >
              <Users className="w-4 h-4" />
              그룹
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === "groups"
                ? "bg-white/20 dark:bg-zinc-900/20"
                : "bg-zinc-100 dark:bg-zinc-700"
                }`}>
                {groups.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <Loader2 className="w-10 h-10 animate-spin text-zinc-300 dark:text-zinc-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Bot className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
              </div>
            </div>
            <p className="mt-4 text-zinc-500">에이전트를 불러오는 중...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-zinc-500">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty State */}
        {activeTab === "agents" && !loading && !error && filteredAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
              style={{ background: mounted ? `linear-gradient(135deg, ${currentAccent.color}40, ${currentAccent.color}20)` : "linear-gradient(135deg, #8b5cf640, #8b5cf620)" }}
            >
              <Bot className="w-10 h-10" style={{ color: mounted ? currentAccent.color : "#8b5cf6" }} />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              {searchQuery || selectedCategory !== "all" ? "검색 결과가 없습니다" : "아직 에이전트가 없습니다"}
            </h3>
            <p className="mt-2 text-zinc-500 text-center max-w-md">
              {searchQuery || selectedCategory !== "all"
                ? "다른 검색어나 카테고리를 시도해보세요"
                : "첫 번째 AI 에이전트를 만들어 라이브러리에 추가하세요!"}
            </p>
            {!searchQuery && selectedCategory === "all" && (
              <Button
                onClick={() => router.push("/agent-builder/new")}
                className="mt-6 text-white shadow-lg"
                style={{ background: mounted ? `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.hoverColor})` : "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}
              >
                <Plus className="w-4 h-4 mr-2" />
                첫 에이전트 만들기
              </Button>
            )}
          </div>
        )}

        {/* Agents Grid */}
        {activeTab === "agents" && !loading && !error && filteredAgents.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "space-y-3"
              }
            >
              {filteredAgents.map((agent, index) => {
                const status = statusConfig[agent.status] || statusConfig.INACTIVE
                const categoryId = getCategoryId(agent.capabilities || [])
                const category = categories.find(c => c.id === categoryId) || categories[4]
                const CategoryIcon = category.icon

                if (viewMode === "grid") {
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => router.push(`/dashboard-group/agents/${agent.id}`)}
                      className="group relative bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 hover:-translate-y-1"
                    >
                      {/* Status Indicator */}
                      <div
                        className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: status.color }}
                        title={status.label}
                      />

                      {/* Avatar */}
                      <div className="relative mb-4">
                        <img
                          src={getAvatarUrl(agent)}
                          alt={agent.name}
                          className="w-16 h-16 rounded-2xl object-cover bg-zinc-100 dark:bg-zinc-800 shadow-md"
                        />
                        <div
                          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center border-2 border-white dark:border-zinc-900"
                          style={{ backgroundColor: mounted ? `${currentAccent.color}20` : "#8b5cf620" }}
                        >
                          <CategoryIcon className="w-3.5 h-3.5" style={{ color: mounted ? currentAccent.color : "#8b5cf6" }} />
                        </div>
                      </div>

                      {/* Info */}
                      <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                        {agent.name}
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 min-h-[40px]">
                        {agent.description || "설명이 없습니다"}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(agent.capabilities || [])
                          .filter((cap: string) => !cap.startsWith('team:'))
                          .slice(0, 3)
                          .map((cap: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            >
                              {cap}
                            </span>
                          ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <span>{PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]?.icon || '🤖'}</span>
                          <span className="truncate max-w-[80px]">{agent.model || 'qwen2.5:3b'}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleToggleStatus(agent, e)}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title={agent.status === "ACTIVE" ? "비활성화" : "활성화"}
                          >
                            {agent.status === "ACTIVE" ? <Pause className="w-3.5 h-3.5 text-zinc-500" /> : <Play className="w-3.5 h-3.5 text-zinc-500" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/agent-builder/${agent.id}`) }}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="편집"
                          >
                            <Settings className="w-3.5 h-3.5 text-zinc-500" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(agent.id, e)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )
                }

                // List View
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => router.push(`/dashboard-group/agents/${agent.id}`)}
                    className="group bg-white dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 cursor-pointer transition-all hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={getAvatarUrl(agent)}
                        alt={agent.name}
                        className="w-12 h-12 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-900 dark:text-white truncate">{agent.name}</h3>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: status.bgColor, color: status.color }}
                          >
                            {status.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            {category.label}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-500 truncate mt-0.5">{agent.description || "설명 없음"}</p>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-zinc-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{formatTimeAgo(agent.last_active_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span>{PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]?.icon || '🤖'}</span>
                          <span>{agent.model || 'qwen2.5:3b'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleToggleStatus(agent, e)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          {agent.status === "ACTIVE" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/agent-builder/${agent.id}`) }} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          <Settings className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => handleDelete(agent.id, e)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Groups Tab */}
        {activeTab === "groups" && !loading && !error && (
          <>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6">
                  <Users className="w-10 h-10 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">아직 그룹이 없습니다</h3>
                <p className="mt-2 text-zinc-500 text-center max-w-md">
                  에이전트들을 그룹으로 묶어 협업하게 하세요
                </p>
                <Button
                  onClick={() => { setEditingGroup(undefined); setShowGroupModal(true) }}
                  className="mt-6 bg-purple-500 hover:bg-purple-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />그룹 만들기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group, index) => (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                          <Users className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-900 dark:text-white">{group.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            {interactionModeLabels[group.interaction_mode]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingGroup(group); setShowGroupModal(true) }} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                          <Settings className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button onClick={() => handleDeleteGroup(group.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {group.description && (
                      <p className="text-sm text-zinc-500 mb-4 line-clamp-2">{group.description}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">멤버:</span>
                      <div className="flex -space-x-2">
                        {group.members?.slice(0, 4).map((member: any, idx: number) => (
                          <img
                            key={member.agent?.id || idx}
                            src={member.agent?.avatar_url || generateRobotAvatar(member.agent?.name || 'agent')}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800"
                            title={member.agent?.name}
                          />
                        ))}
                        {(group.members?.length || 0) > 4 && (
                          <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-600 dark:text-zinc-300 border-2 border-white dark:border-zinc-900">
                            +{(group.members?.length || 0) - 4}
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
        onClose={() => { setShowGroupModal(false); setEditingGroup(undefined) }}
        onSave={handleSaveGroup}
        group={editingGroup}
        availableAgents={agents}
      />
    </div>
  )
}
