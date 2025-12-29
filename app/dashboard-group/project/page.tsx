"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Search,
  Folder,
  FolderOpen,
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
  Code,
  FileText,
  Palette,
  Briefcase,
  ArrowLeft,
  ChevronRight,
  X,
  Check,
  Trash2,
  GripVertical,
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

// 아이콘 매핑
const iconMap: Record<string, React.ElementType> = {
  Code,
  FileText,
  Palette,
  Briefcase,
  Folder,
  Users,
  Calendar,
  CheckCircle2,
}

// 카테고리 타입
interface ProjectCategory {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  sort_order: number
  user_id: string | null
}

// 기본 카테고리 (API 실패시 폴백)
const defaultCategories: ProjectCategory[] = [
  { id: "code", name: "개발", description: "코드 프로젝트", icon: "Code", color: "#10b981", sort_order: 0, user_id: null },
  { id: "document", name: "문서", description: "기획 & 문서", icon: "FileText", color: "#3b82f6", sort_order: 1, user_id: null },
  { id: "design", name: "디자인", description: "UI/UX & 그래픽", icon: "Palette", color: "#8b5cf6", sort_order: 2, user_id: null },
  { id: "work", name: "업무", description: "태스크 관리", icon: "Briefcase", color: "#f59e0b", sort_order: 3, user_id: null },
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
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // 카테고리 관련 상태
  const [categories, setCategories] = useState<ProjectCategory[]>(defaultCategories)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electron?.fs?.selectDirectory)
  }, [])

  useEffect(() => {
    fetchProjects()
    fetchTeams()
    fetchCategories()
  }, [])

  // 카테고리 조회
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/project-categories')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data)
        }
      }
    } catch (err) {
      console.error('Categories fetch error:', err)
    }
  }

  // 카테고리 이름 수정
  const handleUpdateCategory = async (id: string, name: string) => {
    try {
      const res = await fetch('/api/project-categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      })
      if (res.ok) {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
        setEditingCategory(null)
        setEditName("")
      }
    } catch (err) {
      console.error('Category update error:', err)
    }
  }

  // 새 카테고리 추가
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await fetch('/api/project-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: '',
          icon: 'Folder',
          color: '#6366f1',
        }),
      })
      if (res.ok) {
        const newCategory = await res.json()
        setCategories(prev => [...prev, newCategory])
        setIsAddingCategory(false)
        setNewCategoryName("")
      }
    } catch (err) {
      console.error('Category add error:', err)
    }
  }

  // 카테고리 삭제
  const handleDeleteCategory = async (id: string) => {
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/project-categories?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== id))
      } else {
        const data = await res.json()
        alert(data.error || '삭제 실패')
      }
    } catch (err) {
      console.error('Category delete error:', err)
    }
  }

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

  // 로컬 폴더 불러오기 핸들러
  const handleImportLocalFolder = async () => {
    if (!isElectron || !window.electron?.fs?.selectDirectory) {
      alert("이 기능은 데스크톱 앱에서만 사용할 수 있습니다.")
      return
    }

    setImporting(true)
    try {
      // 1. 폴더 선택
      const selectedFolder = await window.electron.fs.selectDirectory()
      if (!selectedFolder) {
        setImporting(false)
        return
      }
      const folderPath = selectedFolder.path

      console.log("[Import] Selected folder:", folderPath)

      // 2. package.json 파싱 시도
      let projectName = selectedFolder.name || folderPath.split("/").pop() || "Untitled Project"
      let projectDescription = ""
      let projectMetadata: Record<string, any> = {}

      try {
        const packageJsonContent = await window.electron.fs.readFile?.(`${folderPath}/package.json`)
        if (packageJsonContent) {
          const packageJson = JSON.parse(packageJsonContent)
          projectName = packageJson.name || projectName
          projectDescription = packageJson.description || ""
          projectMetadata = {
            version: packageJson.version,
            scripts: packageJson.scripts,
            dependencies: Object.keys(packageJson.dependencies || {}),
            devDependencies: Object.keys(packageJson.devDependencies || {}),
            main: packageJson.main,
            type: "node",
          }
          console.log("[Import] Parsed package.json:", projectName, projectMetadata)
        }
      } catch (e) {
        console.log("[Import] No package.json found, using folder name")
      }

      // 3. pyproject.toml 또는 requirements.txt 파싱 시도 (Node 프로젝트가 아닌 경우)
      if (!projectMetadata.type) {
        try {
          const pyprojectContent = await window.electron.fs.readFile?.(`${folderPath}/pyproject.toml`)
          if (pyprojectContent) {
            // 간단한 TOML 파싱 (name 추출)
            const nameMatch = pyprojectContent.match(/name\s*=\s*["']([^"']+)["']/)
            if (nameMatch) projectName = nameMatch[1]
            const descMatch = pyprojectContent.match(/description\s*=\s*["']([^"']+)["']/)
            if (descMatch) projectDescription = descMatch[1]
            projectMetadata = { type: "python" }
            console.log("[Import] Parsed pyproject.toml:", projectName)
          }
        } catch (e) {
          // pyproject.toml 없음
        }

        try {
          const reqContent = await window.electron.fs.readFile?.(`${folderPath}/requirements.txt`)
          if (reqContent && !projectMetadata.type) {
            projectMetadata = {
              type: "python",
              dependencies: reqContent.split("\n").filter((l: string) => l.trim() && !l.startsWith("#")),
            }
            console.log("[Import] Found requirements.txt")
          }
        } catch (e) {
          // requirements.txt 없음
        }
      }

      // 4. 프로젝트 생성 (DB 저장)
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          folder_path: folderPath,
          status: "active",
          metadata: projectMetadata,
        }),
      })

      if (!res.ok) throw new Error("프로젝트 생성 실패")
      const project = await res.json()
      console.log("[Import] Project created:", project.id, project.name)

      // 5. Neural Map에 연결하고 이동
      setLinkedProject(project.id, project.name)
      useNeuralMapStore.getState().setProjectPath(folderPath)

      // 프로젝트 목록 새로고침
      await fetchProjects()

      // Neural Map으로 이동
      router.push("/dashboard-group/neural-map")
    } catch (error) {
      console.error("[Import] Error:", error)
      alert("폴더를 불러오는 중 오류가 발생했습니다.")
    } finally {
      setImporting(false)
    }
  }

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
        // 카테고리 필터 추가 - category_id로 필터링
        const matchesCategory = !categoryFilter || (project as any).category_id === categoryFilter
        return matchesSearch && matchesStatus && matchesCategory
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
  }, [projects, searchQuery, statusFilter, sortBy, categoryFilter])

  const stats = useMemo(() => {
    const total = projects.length
    const active = projects.filter(p => p.status === "active").length
    const completed = projects.filter(p => p.status === "completed").length
    return { total, active, completed }
  }, [projects])

  // 카테고리별 프로젝트 수
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    categories.forEach(cat => {
      // category_id 또는 project_type으로 매칭
      stats[cat.id] = projects.filter(p => {
        const pid = (p as any).category_id || (p as any).project_type
        return pid === cat.id || pid === cat.name.toLowerCase()
      }).length
    })
    return stats
  }, [projects, categories])

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
            <div className="flex items-center gap-4">
              {/* 타이틀 + 뒤로가기 */}
              <div className="flex items-center gap-2">
                {categoryFilter && (
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className="p-1.5 -ml-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h1 className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
                  {categoryFilter
                    ? categories.find((c: ProjectCategory) => c.id === categoryFilter)?.name || '프로젝트'
                    : '프로젝트'}
                </h1>
              </div>

              {/* Stats - 카테고리 선택 시에만 표시 */}
              {categoryFilter && (
                <div className="hidden md:flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{filteredProjects.length}</span>
                    <span className="text-zinc-500">프로젝트</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 로컬 폴더 불러오기 버튼 (Electron 환경에서만 표시) */}
              {isElectron && (
                <Button
                  onClick={handleImportLocalFolder}
                  variant="outline"
                  size="sm"
                  leftIcon={importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                  disabled={importing}
                >
                  {importing ? "불러오는 중..." : "폴더 불러오기"}
                </Button>
              )}
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                variant="accent"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                새 프로젝트
              </Button>
            </div>
          </div>

          {/* Toolbar - 카테고리 선택 시에만 표시 */}
          {categoryFilter && (
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
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* 카테고리 카드 뷰 */}
        {!categoryFilter ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {categories.map((category, idx) => {
                const IconComponent = iconMap[category.icon] || Folder
                const count = categoryStats[category.id] || 0
                const isEditing = editingCategory === category.id

                return (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.08, type: "spring", stiffness: 200 }}
                    className="group"
                  >
                    <div
                      className="relative h-44 rounded-3xl p-5 overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl"
                      style={{
                        background: `linear-gradient(145deg, ${category.color}15 0%, ${category.color}08 100%)`,
                        border: `1px solid ${category.color}30`,
                      }}
                      onClick={() => !isEditing && setCategoryFilter(category.id)}
                    >
                      {/* 배경 장식 */}
                      <div
                        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl transition-all duration-500 group-hover:opacity-40 group-hover:scale-125"
                        style={{ background: category.color }}
                      />
                      <div
                        className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-10 blur-xl"
                        style={{ background: category.color }}
                      />

                      {/* 편집/삭제 버튼 */}
                      <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingCategory(category.id)
                            setEditName(category.name)
                          }}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all border border-white/10"
                        >
                          <Pencil className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                        {category.user_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCategory(category.id)
                            }}
                            className="p-2 rounded-xl bg-white/10 hover:bg-red-500/30 backdrop-blur-sm transition-all border border-white/10"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-zinc-300" />
                          </button>
                        )}
                      </div>

                      {/* 컨텐츠 */}
                      <div className="relative h-full flex flex-col justify-between z-10">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                          style={{
                            background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}cc 100%)`,
                            boxShadow: `0 8px 24px ${category.color}40`
                          }}
                        >
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>

                        <div>
                          {isEditing ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="flex-1 bg-white/10 text-white text-lg font-bold px-3 py-1.5 rounded-xl outline-none placeholder-white/50 backdrop-blur-sm border border-white/20"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateCategory(category.id, editName)
                                  if (e.key === 'Escape') setEditingCategory(null)
                                }}
                              />
                              <button
                                onClick={() => handleUpdateCategory(category.id, editName)}
                                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/30"
                              >
                                <Check className="w-4 h-4 text-emerald-400" />
                              </button>
                              <button
                                onClick={() => setEditingCategory(null)}
                                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/30"
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 className="text-zinc-100 text-xl font-bold tracking-tight mb-1">{category.name}</h3>
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-3xl font-black"
                                  style={{ color: category.color }}
                                >
                                  {count}
                                </span>
                                <span className="text-zinc-500 text-sm font-medium">프로젝트</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 호버 시 화살표 */}
                      <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {/* 카테고리 추가 카드 */}
              {isAddingCategory ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-44 rounded-3xl p-5 border border-violet-500/30 bg-violet-500/5 backdrop-blur-sm"
                >
                  <div className="h-full flex flex-col justify-center gap-4">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="카테고리 이름"
                      className="w-full bg-zinc-900/50 text-white px-4 py-3 rounded-xl border border-zinc-700 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-zinc-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory()
                        if (e.key === 'Escape') setIsAddingCategory(false)
                      }}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleAddCategory}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-violet-500/25"
                      >
                        추가
                      </button>
                      <button
                        onClick={() => setIsAddingCategory(false)}
                        className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-all border border-zinc-700"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: categories.length * 0.08, type: "spring", stiffness: 200 }}
                  onClick={() => setIsAddingCategory(true)}
                  className="group h-44 rounded-3xl p-5 border border-dashed border-zinc-700 hover:border-violet-500/50 bg-zinc-900/30 hover:bg-violet-500/5 cursor-pointer transition-all duration-300 flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-3 text-zinc-500 group-hover:text-violet-400 transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 group-hover:bg-violet-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-semibold">카테고리 추가</span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
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
            <div className="flex items-center gap-3">
              {isElectron && (
                <Button
                  onClick={handleImportLocalFolder}
                  variant="outline"
                  size="lg"
                  leftIcon={importing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
                  disabled={importing}
                >
                  {importing ? "불러오는 중..." : "로컬 폴더 불러오기"}
                </Button>
              )}
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                variant="accent"
                size="lg"
                leftIcon={<Plus className="w-5 h-5" />}
                className="shadow-lg"
              >
                새 프로젝트 만들기
              </Button>
            </div>
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
              const folderPath = (project as any).folder_path
              const metadata = (project as any).metadata || {}
              const projectType = metadata.type as string | undefined

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
                    <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Folder className={`w-5 h-5 ${style.icon}`} />
                      {/* 폴더 연결 표시 */}
                      {folderPath && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">
                          <FolderOpen className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate group-hover:text-zinc-700 dark:group-hover:text-white transition-colors">
                          {project.name}
                        </p>
                        {/* 프로젝트 타입 뱃지 */}
                        {projectType === 'node' && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                            Node
                          </span>
                        )}
                        {projectType === 'python' && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            Python
                          </span>
                        )}
                        {(project.priority === 'high' || project.priority === 'urgent') && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            {project.priority === 'urgent' ? '긴급' : '높음'}
                          </span>
                        )}
                      </div>
                      {project.description ? (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{project.description}</p>
                      ) : folderPath ? (
                        <p className="text-xs text-zinc-400 truncate mt-0.5" title={folderPath}>
                          📁 {folderPath.split('/').slice(-2).join('/')}
                        </p>
                      ) : null}
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
          /* Grid View - 카테고리 테마 적용 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {(() => {
              // 현재 카테고리 색상 가져오기
              const currentCategory = categoryFilter ? categories.find(c => c.id === categoryFilter) : null
              const themeColor = currentCategory?.color || '#8b5cf6'

              return filteredProjects.map((project, idx) => {
              const members = (project as any).project_members || project.members || []
              const agents = (project as any).project_agents || project.agents || []
              const memberCount = members.length + agents.length
              const progress = project.progress || 0
              const style = statusStyles[project.status] || statusStyles.planning
              const hasDeadline = project.deadline || project.end_date
              const folderPath = (project as any).folder_path
              const metadata = (project as any).metadata || {}
              const projectType = metadata.type as string | undefined

              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.3 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl"
                  style={{
                    background: `linear-gradient(145deg, ${themeColor}08 0%, transparent 100%)`,
                    border: `1px solid ${themeColor}25`,
                  }}
                  onClick={() => router.push(`/dashboard-group/project/${project.id}`)}
                >
                  {/* 배경 장식 */}
                  <div
                    className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-10 blur-2xl"
                    style={{ background: themeColor }}
                  />

                  {/* 상단 악센트 라인 */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: `linear-gradient(90deg, ${themeColor} 0%, ${themeColor}60 100%)` }}
                  />

                  {/* 호버시 Edit 버튼 */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors shadow-lg"
                      style={{ background: themeColor }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </div>

                  <div className="p-5">
                    {/* 상태 및 타입 뱃지 */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                        {statusLabels[project.status]}
                      </span>
                      {/* 프로젝트 타입 뱃지 */}
                      {projectType === 'node' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                          Node
                        </span>
                      )}
                      {projectType === 'python' && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          Python
                        </span>
                      )}
                      {/* 폴더 연결 뱃지 */}
                      {folderPath && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <FolderOpen className="w-3 h-3" />
                          연결됨
                        </span>
                      )}
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

                    {/* 설명 또는 폴더 경로 */}
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2 min-h-[40px]">
                      {project.description || (folderPath ? `📁 ${folderPath.split('/').slice(-2).join('/')}` : '설명 없음')}
                    </p>

                    {/* 진행률 바 */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-zinc-500">진행률</span>
                        <span className="font-medium" style={{ color: themeColor }}>{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${themeColor} 0%, ${themeColor}aa 100%)` }}
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
            })
            })()}
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
