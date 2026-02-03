"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    Plus,
    Settings,
    Star,
    Send,
    Bot,
    Home,
    FileText,
    Sheet,
    Globe,
    Briefcase,
    Wrench,
    Download,
    Upload,
    LayoutGrid,
    // 🔥 react-icons 완전 제거 - lucide-react로 통일 (번들 사이즈 대폭 절약)
    Presentation,   // BsFiletypePpt
    FileCode,       // BsFiletypeDoc, FaRegFileCode
    Table2,         // BsFileEarmarkSpreadsheet
    Image,          // BsFileEarmarkImage
    AppWindow,      // AiOutlineAppstoreAdd
    Sparkles,       // RiSparkling2Fill
} from "lucide-react"

// 🔥 react-icons → lucide-react 별칭 (기존 코드 호환성)
const BsFiletypePpt = Presentation
const BsFiletypeDoc = FileCode
const BsFileEarmarkSpreadsheet = Table2
const BsFileEarmarkImage = Image
const AiOutlineAppstoreAdd = AppWindow
const RiSparkling2Fill = Sparkles
const FaRegFileCode = FileCode
import { useThemeStore } from "@/stores/themeStore"
import { cn } from "@/lib/utils"
import { ToolsView } from "./tools-view"
import { useSearchParams, useRouter } from "next/navigation"
import { CreateWorkModal } from "./create-modal"
import { ChatView, CodingProjectModal, CodingProjectType, TaskHistorySidebar } from "@/components/works"

// --- Icons for App Grid ---
const AppIcon = ({ icon: Icon, color, bg }: { icon: any, color: string, bg: string }) => (
    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", bg)}>
        <Icon className={cn("w-6 h-6", color)} />
    </div>
)

function AppCard({ title, icon, iconColor, iconBg }: { title: string, icon: any, iconColor: string, iconBg: string }) {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto sm:h-48 shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><Settings className="w-4 h-4" /></button>
            </div>
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-zinc-400 hover:text-yellow-400"><Star className="w-4 h-4" /></button>
            </div>

            <AppIcon icon={icon} color={iconColor} bg={iconBg} />

            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h3>
        </motion.div>
    )
}

// --- Genspark Style Home with Chat ---
function WorksHome({
    onOpenCreate,
    onStartChat,
    onOpenCodingModal
}: {
    onOpenCreate: () => void
    onStartChat: (query: string) => void
    onOpenCodingModal: () => void
}) {
    const router = useRouter()
    const [inputValue, setInputValue] = useState('')
    const [activeTab, setActiveTab] = useState<'agent' | 'general'>('agent')

    const agentTools = [
        { icon: LayoutGrid, label: "커스텀 슈퍼 에이전트", bg: "bg-zinc-700", color: "text-white" },
        { icon: FileText, label: "AI 슬라이드", bg: "bg-yellow-500", color: "text-white", href: "/dashboard-group/apps/ai-slides" },
        { icon: Sheet, label: "AI 시트", bg: "bg-emerald-500", color: "text-white", href: "/dashboard-group/apps/ai-sheet" },
        { icon: FileText, label: "AI 문서", bg: "bg-blue-600", color: "text-white", href: "/dashboard-group/apps/ai-docs" },
        { icon: Wrench, label: "AI 개발자", bg: "bg-zinc-700", color: "text-white" },
        { icon: Briefcase, label: "AI 디자이너", bg: "bg-zinc-700", color: "text-white" },
        { icon: Star, label: "클립 지니어스", bg: "bg-zinc-700", color: "text-white" },
        { icon: Bot, label: "AI 채팅", bg: "bg-blue-500", color: "text-white", badge: "무제한" },
        { icon: Download, label: "AI 이미지", bg: "bg-green-500", color: "text-white", badge: "무제한" },
        { icon: Upload, label: "AI 동영상", bg: "bg-zinc-700", color: "text-white" },
        { icon: FileText, label: "AI 회의 노트", bg: "bg-zinc-700", color: "text-white" },
        { icon: Briefcase, label: "모든 에이전트", bg: "bg-zinc-700", color: "text-white" },
    ]

    const generalTools: Array<{
        icon: any
        label: string
        bg: string
        shadow: string
        color: string
        active?: boolean
        href?: string
        badge?: string
    }> = [
        { icon: RiSparkling2Fill, label: "범용", bg: "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700", shadow: "shadow-blue-500/40 hover:shadow-blue-500/60", color: "text-white", active: true },
        { icon: BsFiletypeDoc, label: "문서", bg: "bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600", shadow: "shadow-emerald-500/40 hover:shadow-emerald-500/60", color: "text-white", href: "/dashboard-group/apps/ai-docs" },
        { icon: BsFiletypePpt, label: "슬라이드", bg: "bg-gradient-to-br from-orange-400 via-orange-500 to-red-500", shadow: "shadow-orange-500/40 hover:shadow-orange-500/60", color: "text-white", href: "/dashboard-group/apps/ai-slides" },
        { icon: BsFileEarmarkSpreadsheet, label: "시트", bg: "bg-gradient-to-br from-green-400 via-emerald-500 to-green-700", shadow: "shadow-green-500/40 hover:shadow-green-500/60", color: "text-white", href: "/dashboard-group/apps/ai-sheet" },
        { icon: BsFileEarmarkImage, label: "포스터", bg: "bg-gradient-to-br from-pink-400 via-rose-500 to-pink-600", shadow: "shadow-pink-500/40 hover:shadow-pink-500/60", color: "text-white" },
        { icon: Globe, label: "웹사이트", bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600", shadow: "shadow-amber-500/40 hover:shadow-amber-500/60", color: "text-white" },
        { icon: FaRegFileCode, label: "코딩", bg: "bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-700", shadow: "shadow-cyan-500/40 hover:shadow-cyan-500/60", color: "text-white" },
        { icon: AiOutlineAppstoreAdd, label: "Apps +", bg: "bg-gradient-to-br from-purple-400 via-violet-500 to-purple-700", shadow: "shadow-purple-500/40 hover:shadow-purple-500/60", color: "text-white" },
    ]

    const handleToolClick = (tool: typeof generalTools[number]) => {
        console.log('[WorksHome] handleToolClick:', tool.label)
        if (tool.href) {
            router.push(tool.href)
        } else if (tool.label === '코딩') {
            // 코딩 버튼 클릭 시 Genspark 스타일 모달 열기
            console.log('[WorksHome] Opening coding modal')
            onOpenCodingModal()
        } else {
            onStartChat(tool.label)
        }
    }

    const handleSubmit = () => {
        if (inputValue.trim()) {
            onStartChat(inputValue.trim())
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            {/* Title */}
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-16">
                Welcome to GlowUS
            </h1>

            {/* Main Input */}
            <div className="w-full max-w-4xl mb-10 px-4">
                <div className="bg-white dark:bg-zinc-800/80 rounded-3xl p-6 border-2 border-zinc-300 dark:border-zinc-600 shadow-2xl focus-within:ring-0 focus-within:border-zinc-300 dark:focus-within:border-zinc-600">
                    <div className="flex items-center gap-4 mb-4">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="요구사항을 입력하고, @를 입력하여 파일을 참조하세요"
                            className="flex-1 bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 text-base outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0"
                            style={{ outline: 'none', boxShadow: 'none' }}
                        />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-3">
                            <button className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
                                <Home className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            </button>
                            <button className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
                                <Plus className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            </button>
                        </div>
                        <button
                            onClick={handleSubmit}
                            className="p-3 bg-blue-500 hover:bg-blue-600 rounded-full transition-colors shadow-lg shadow-blue-500/25"
                        >
                            <Send className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* General Tools */}
            <div className="w-full max-w-4xl flex flex-wrap justify-center gap-8 px-4">
                {generalTools.map((tool, idx) => (
                    <motion.button
                        key={idx}
                        whileHover={{ scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleToolClick(tool)}
                        className="flex flex-col items-center gap-3 group"
                    >
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                            tool.bg,
                            tool.shadow,
                            tool.active && "ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-950",
                            "group-hover:shadow-xl"
                        )}>
                            <tool.icon className={cn("w-7 h-7 drop-shadow-sm", tool.color)} />
                        </div>
                        <span className={cn(
                            "text-xs text-center font-medium transition-colors",
                            tool.active ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                        )}>
                            {tool.label}
                        </span>
                        {tool.badge && (
                            <span className={cn(
                                "absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded text-white",
                                tool.badge === 'Free' ? "bg-red-500" : "bg-pink-500"
                            )}>
                                {tool.badge}
                            </span>
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

export default function WorksPage() {
    const { accentColor } = useThemeStore()
    const searchParams = useSearchParams()
    const router = useRouter()
    const tab = searchParams.get('tab')
    const showHistory = searchParams.get('history') === 'true'
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [initialQuery, setInitialQuery] = useState('')
    const [isCodingModalOpen, setIsCodingModalOpen] = useState(false)
    const [isTaskHistoryOpen, setIsTaskHistoryOpen] = useState(showHistory)

    // URL 파라미터로 히스토리 사이드바 열기
    useEffect(() => {
        if (showHistory) {
            setIsTaskHistoryOpen(true)
            // URL에서 history 파라미터 제거
            router.replace('/dashboard-group/works', { scroll: false })
        }
    }, [showHistory, router])

    const handleStartChat = (query: string) => {
        setInitialQuery(query)
        setIsChatOpen(true)
    }

    const handleCodingProjectSelect = async (projectType: CodingProjectType) => {
        setIsCodingModalOpen(false)

        // 코딩 페이지로 이동 (전체화면)
        router.push(`/dashboard-group/works/coding?type=${projectType.id}&title=${encodeURIComponent(projectType.title)}`)
    }

    return (
        <div className="flex h-[calc(100vh-64px)] -m-8">
            {/* --- Main Content Area --- */}
            <div className="flex-1 bg-white dark:bg-zinc-950 overflow-hidden">
                {isChatOpen ? (
                    <div className="h-full p-8 overflow-y-auto">
                        <ChatView
                            onBack={() => {
                                setIsChatOpen(false)
                                setInitialQuery('')
                            }}
                            initialQuery={initialQuery}
                        />
                    </div>
                ) : tab === 'tools' ? (
                    <div className="h-full p-8 overflow-y-auto">
                        <ToolsView />
                    </div>
                ) : (
                    <div className="h-full p-8 overflow-y-auto">
                        <WorksHome
                            onOpenCreate={() => setIsCreateModalOpen(true)}
                            onStartChat={handleStartChat}
                            onOpenCodingModal={() => setIsCodingModalOpen(true)}
                        />
                    </div>
                )}
            </div>

            <CreateWorkModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            {/* Coding Project Modal */}
            <CodingProjectModal
                isOpen={isCodingModalOpen}
                onClose={() => setIsCodingModalOpen(false)}
                onSelect={handleCodingProjectSelect}
            />

            {/* Task History Sidebar */}
            <TaskHistorySidebar
                isOpen={isTaskHistoryOpen}
                onClose={() => setIsTaskHistoryOpen(false)}
                onSelectChat={(id) => {
                    setIsTaskHistoryOpen(false)
                    setInitialQuery('')
                    setIsChatOpen(true)
                }}
            />
        </div>
    )
}
