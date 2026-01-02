"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
    Mic,
    FileText,
    ShieldCheck,
    MonitorPlay,
    Smartphone,
    Newspaper,
    BookOpen,
    FileStack,
    Briefcase,
    FileAudio,
    PenTool,
    LayoutTemplate,
    MessageSquareQuote,
    School,
    Clapperboard,
    FileType2,
    Image as ImageIcon,
    UserCheck,
    Book,
    PenLine,
    Code,
    Plus,
    MoreHorizontal,
    Pencil,
    Settings,
    Heart,
    Share2,
    X,
    Check,
    Upload,
    Landmark
} from "lucide-react"
import { cn } from "@/lib/utils"

// Tool Data Interface
interface ToolItem {
    id: string
    title: string
    description: string
    icon: any
    iconColor: string
    iconBg: string
    category: string
    isFavorite?: boolean
    image?: string
}

const THUMBNAIL_PRESETS = [
    '/thumbnails/ai_summary.png',
    '/thumbnails/ppt.png',
    '/thumbnails/writing.png',
    '/thumbnails/video.png',
    '/thumbnails/coding.png',
    '/thumbnails/image_gen.png',
    '/thumbnails/job.png',
    '/thumbnails/study.png',
    '/thumbnails/money.png',
    '/thumbnails/work.png',
]

// Mock Data matching the screenshot
const INITIAL_TOOLS_DATA: ToolItem[] = [
    {
        id: 'ai-summary-realtime',
        title: 'AI 실시간 요약',
        description: '실시간으로 음성을 받아쓰고 핵심 내용을 요약해주는 똑똑한 AI 노트...',
        icon: Mic,
        iconColor: 'text-rose-500',
        iconBg: 'bg-rose-100 dark:bg-rose-900/20',
        category: '업무',
        image: '/thumbnails/ai_summary.png'
    },
    {
        id: 'ai-summary-perfect',
        title: '유튜브 영상 요약',
        description: '유튜브 영상을 AI가 완벽하게 요약해 주는 기능',
        icon: FileText,
        iconColor: 'text-green-500',
        iconBg: 'bg-green-100 dark:bg-green-900/20',
        category: '업무',
        image: '/thumbnails/ai_summary.png'
    },
    {
        id: 'ai-detection',
        title: 'AI 탐지 방어',
        description: 'GPT 탐지에 걸리지 않게 자연스러운 말투로 완성해 주는 기능',
        icon: ShieldCheck,
        iconColor: 'text-orange-500',
        iconBg: 'bg-orange-100 dark:bg-orange-900/20',
        category: '학업',
        image: '/thumbnails/coding.png'
    },
    {
        id: 'ppt-draft',
        title: 'PPT 초안',
        description: 'PPT의 목차와 초안을 AI가 자동으로 만들어 주는 기능',
        icon: MonitorPlay,
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/20',
        category: '업무',
        image: '/thumbnails/ppt.png'
    },
    {
        id: 'sns-post',
        title: 'SNS 게시물',
        description: 'SNS 게시글을 종류에 맞게 자동으로 완성해 주는 기능',
        icon: Smartphone,
        iconColor: 'text-pink-500',
        iconBg: 'bg-pink-100 dark:bg-pink-900/20',
        category: '부업',
        image: '/thumbnails/money.png'
    },
    {
        id: 'article-draft',
        title: '기사 초안',
        description: '기사의 자료를 입력하면 초안을 자동으로 만들어 주는 기능',
        icon: Newspaper,
        iconColor: 'text-sky-500',
        iconBg: 'bg-sky-100 dark:bg-sky-900/20',
        category: '업무',
        image: '/thumbnails/writing.png'
    },
    {
        id: 'book-report',
        title: '독후감',
        description: '책을 읽고 책의 내용을 요약하고 책의 주요 내용을 요약해 주는 기능',
        icon: BookOpen,
        iconColor: 'text-teal-500',
        iconBg: 'bg-teal-100 dark:bg-teal-900/20',
        category: '학업',
        image: '/thumbnails/study.png'
    },
    {
        id: 'report',
        title: '레포트',
        description: '과제, 레포트, 보고서와 같은 긴 글을 쉽게 완성해 주는 기능',
        icon: FileStack,
        iconColor: 'text-purple-500',
        iconBg: 'bg-purple-100 dark:bg-purple-900/20',
        category: '학업',
        image: '/thumbnails/study.png'
    },
    {
        id: 'interview-prep',
        title: '면접 준비',
        description: '면접 예상 질문과 답변을 자동으로 완성해 주는 기능',
        icon: Briefcase,
        iconColor: 'text-pink-500',
        iconBg: 'bg-pink-100 dark:bg-pink-900/20',
        category: '취업',
        image: '/thumbnails/job.png'
    },
    {
        id: 'presentation-script',
        title: '발표 대본',
        description: '발표 자료와 시간, 주제를 입력하면 대본을 완성해 주는 기능',
        icon: FileAudio,
        iconColor: 'text-orange-500',
        iconBg: 'bg-orange-100 dark:bg-orange-900/20',
        category: '학업',
        image: '/thumbnails/ppt.png'
    },
    {
        id: 'blog',
        title: '블로그',
        description: '게시물의 주제, 말투를 설정하면 블로그 글을 자동으로 완성해 드려요',
        icon: PenTool,
        iconColor: 'text-green-500',
        iconBg: 'bg-green-100 dark:bg-green-900/20',
        category: '부업',
        image: '/thumbnails/writing.png'
    },
    {
        id: 'detail-page',
        title: '상세페이지',
        description: '상세페이지 내용을 자동으로 작성해 주는 기능',
        icon: LayoutTemplate,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/20',
        category: '업무',
        image: '/thumbnails/ppt.png'
    },
    {
        id: 'product-review',
        title: '상품 리뷰',
        description: '구매 상품의 링크를 입력하면 리뷰를 자동으로 작성해 주는 기능',
        icon: MessageSquareQuote,
        iconColor: 'text-pink-500',
        iconBg: 'bg-pink-100 dark:bg-pink-900/20',
        category: '부업',
        image: '/thumbnails/money.png'
    },
    {
        id: 'school-record',
        title: '생활기록부',
        description: '학생의 생활기록부를 자동으로 완성해 주는 기능',
        icon: School,
        iconColor: 'text-orange-500',
        iconBg: 'bg-orange-100 dark:bg-orange-900/20',
        category: '학업',
        image: '/thumbnails/study.png'
    },
    {
        id: 'video-scenario',
        title: '영상 시나리오',
        description: '만들고자 하는 영상의 시나리오를 자동으로 만들어 주는 기능',
        icon: Clapperboard,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/20',
        category: '부업',
        image: '/thumbnails/video.png'
    },
    {
        id: 'resume',
        title: '이력서',
        description: '입사 및 아르바이트 지원서를 간편하게 완성해주는 기능',
        icon: FileType2,
        iconColor: 'text-yellow-500',
        iconBg: 'bg-yellow-100 dark:bg-yellow-900/20',
        category: '취업',
        image: '/thumbnails/job.png'
    },
    {
        id: 'image-gen',
        title: '이미지 제작',
        description: '원하는 이미지를 설명하면 자동으로 이미지를 제작해 주는 기능',
        icon: ImageIcon,
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/20',
        category: '업무',
        image: '/thumbnails/image_gen.png'
    },
    {
        id: 'cover-letter',
        title: '자기소개서',
        description: '입사 및 입시 자기소개서 초안을 간편하게 완성해 주는 기능',
        icon: UserCheck,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/20',
        category: '취업',
        image: '/thumbnails/job.png'
    },
    {
        id: 'ebook',
        title: '전자책',
        description: '전자책 내용을 자동으로 작성해 주는 기능',
        icon: Book,
        iconColor: 'text-red-500',
        iconBg: 'bg-red-100 dark:bg-red-900/20',
        category: '부업',
        image: '/thumbnails/writing.png'
    },
    {
        id: 'copywriting',
        title: '카피라이팅',
        description: '마케팅 문구를 자동으로 완성해 주는 기능',
        icon: PenLine,
        iconColor: 'text-cyan-500',
        iconBg: 'bg-cyan-100 dark:bg-cyan-900/20',
        category: '업무',
        image: '/thumbnails/writing.png'
    },
    {
        id: 'coding-task',
        title: '코딩 과제',
        description: '코딩 과제를 입력하면 해결 답변을 제공하는 기능',
        icon: Code,
        iconColor: 'text-violet-500',
        iconBg: 'bg-violet-100 dark:bg-violet-900/20',
        category: '학업',
        image: '/thumbnails/coding.png'
    },
    {
        id: 'government-programs',
        title: '정부지원사업',
        description: '기업마당에서 제공하는 정부지원사업 공고를 실시간으로 확인하는 기능',
        icon: Landmark,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/20',
        category: '지원사업',
        image: '/thumbnails/work.png'
    }
]

const CATEGORIES = ["전체", "즐겨찾기", "취업", "부업", "학업", "업무", "지원사업"]

export default function AppsPage() {
    const router = useRouter()
    const [tools, setTools] = useState(INITIAL_TOOLS_DATA)
    const [activeFilter, setActiveFilter] = useState("전체")
    const [editingTool, setEditingTool] = useState<ToolItem | null>(null)
    const [showNewProjectModal, setShowNewProjectModal] = useState(false)

    const filteredTools = tools.filter(tool => {
        if (activeFilter === "전체") return true
        if (activeFilter === "즐겨찾기") return tool.isFavorite
        return tool.category === activeFilter
    })

    const handleSaveTool = (updatedTool: ToolItem) => {
        setTools(prev => prev.map(t => t.id === updatedTool.id ? updatedTool : t))
        setEditingTool(null)
    }

    const handleCreateProject = (projectName: string) => {
        setShowNewProjectModal(false)
        // Neural Map으로 이동 (빈 프로젝트, 프로젝트명 전달)
        router.push(`/dashboard-group/neural-map?newProject=true&name=${encodeURIComponent(projectName)}`)
    }

    return (
        <div className="flex h-[calc(100vh-64px)] -m-8">
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 p-8 overflow-y-auto">
                <div className="w-full">
                    {/* Header & Filters */}
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">도구 목록</h2>

                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setActiveFilter(category)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                                        activeFilter === category
                                            ? "bg-accent text-white"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    )}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {/* Create App Card */}
                        <motion.div
                            whileHover={{ y: -4 }}
                            onClick={() => setShowNewProjectModal(true)}
                            className="group relative bg-accent/5 border-2 border-dashed border-accent hover:bg-accent/10 rounded-xl transition-all cursor-pointer h-full min-h-[160px]"
                        >
                            <div className="absolute inset-0 flex items-center justify-center pb-6">
                                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                                    <Plus className="w-6 h-6 text-accent" />
                                </div>
                            </div>

                            <div className="absolute bottom-5 left-0 right-0 px-4 text-center">
                                <p className="text-[11px] text-zinc-500 font-medium group-hover:text-accent transition-colors">
                                    새 프로젝트를 시작하고 Neural Map으로 구현해보세요
                                </p>
                            </div>
                        </motion.div>

                        {filteredTools.map((tool) => (
                            <ToolCard key={tool.id} tool={tool} onEdit={() => setEditingTool(tool)} />
                        ))}
                    </div>

                    {/* Edit Modal */}
                    <AnimatePresence>
                        {editingTool && (
                            <EditToolModal
                                tool={editingTool}
                                onClose={() => setEditingTool(null)}
                                onSave={handleSaveTool}
                            />
                        )}
                    </AnimatePresence>

                    {/* New Project Modal */}
                    <AnimatePresence>
                        {showNewProjectModal && (
                            <NewProjectModal
                                onClose={() => setShowNewProjectModal(false)}
                                onCreate={handleCreateProject}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

function ToolCard({ tool, onEdit }: { tool: ToolItem, onEdit: () => void }) {
    const Icon = tool.icon
    const [isMenuOpen, setIsMenuOpen] = useState(false)

    return (
        <motion.div
            whileHover={{ y: -4 }}
            onClick={() => {
                if (tool.id === 'ai-summary-perfect') {
                    window.location.href = '/dashboard-group/apps/ai-summary'
                } else if (tool.id === 'image-gen') {
                    window.location.href = '/dashboard-group/apps/image-gen'
                } else if (tool.id === 'blog') {
                    window.location.href = '/dashboard-group/apps/ai-blog'
                } else if (tool.id === 'ai-slides') {
                    window.location.href = '/dashboard-group/apps/ai-slides'
                } else if (tool.id === 'government-programs') {
                    window.location.href = '/dashboard-group/apps/government-programs'
                }
            }}
            onMouseLeave={() => setIsMenuOpen(false)}
            className="group relative flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-accent/5 hover:border-accent/40 cursor-pointer"
        >
            {/* Thumbnail Area - Content Clipped */}
            <div className={cn("relative h-44 w-full flex items-center justify-center overflow-hidden rounded-t-2xl", tool.iconBg)}>
                {tool.image ? (
                    <div className="relative w-full h-full group-hover:scale-105 transition-transform duration-500">
                        <Image
                            src={tool.image}
                            alt={tool.title}
                            fill
                            className="object-cover"
                        />
                        {/* Soft overlay for text contrast if needed or decoration */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                        <Icon className={cn("w-16 h-16 transition-transform duration-500 group-hover:scale-110 drop-shadow-sm", tool.iconColor)} />
                    </>
                )}
            </div>

            {/* Menu Button - Outside Clipping Context */}
            <div className="absolute top-3 right-3 z-50">
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsMenuOpen(!isMenuOpen)
                    }}
                    className="p-2 text-zinc-600 dark:text-zinc-300 bg-white/60 dark:bg-black/40 backdrop-blur-md hover:bg-white dark:hover:bg-black rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm"
                >
                    <MoreHorizontal className="w-5 h-5" />
                </button>

                <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.1 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-2 w-36 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 z-50"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setIsMenuOpen(false)
                                    // Slight delay to allow menu closing animation
                                    setTimeout(onEdit, 100)
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>정보변경</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left">
                                <Settings className="w-3.5 h-3.5" />
                                <span>기능편집</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left">
                                <Heart className="w-3.5 h-3.5" />
                                <span>즐겨찾기</span>
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-left">
                                <Share2 className="w-3.5 h-3.5" />
                                <span>공유하기</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content Body */}
            <div className="flex-1 flex flex-col p-5">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-accent transition-colors line-clamp-1">
                        {tool.title}
                    </h3>
                </div>

                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-4 flex-1">
                    {tool.description}
                </p>

                {/* Footer Tag */}
                <div className="flex items-center mt-auto">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                        {tool.category}
                    </span>
                </div>
            </div>
        </motion.div>
    )
}

function NewProjectModal({ onClose, onCreate }: { onClose: () => void, onCreate: (name: string) => void }) {
    const [projectName, setProjectName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    // 모달 열리면 입력창에 포커스
    useState(() => {
        setTimeout(() => inputRef.current?.focus(), 100)
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (projectName.trim()) {
            onCreate(projectName.trim())
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-accent" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">새 프로젝트</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                프로젝트 이름
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="예: 나만의 AI 서비스"
                                autoFocus
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-base"
                            />
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Neural Map에서 빈 프로젝트로 시작합니다
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!projectName.trim()}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            프로젝트 시작
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    )
}

function EditToolModal({ tool, onClose, onSave }: { tool: ToolItem, onClose: () => void, onSave: (t: ToolItem) => void }) {
    const [formData, setFormData] = useState(tool)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setFormData({ ...formData, image: reader.result as string })
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">앱 정보 수정</h3>
                    <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    {/* Image Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">썸네일 이미지</label>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                        />
                        <div className="grid grid-cols-5 gap-2">
                            {/* Upload Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-accent hover:bg-accent/5 transition-all flex flex-col items-center justify-center gap-1"
                            >
                                <Upload className="w-5 h-5 text-zinc-400 group-hover:text-accent transition-colors" />
                                <span className="text-[10px] text-zinc-500 group-hover:text-accent transition-colors font-medium">업로드</span>
                            </button>

                            {THUMBNAIL_PRESETS.map((src) => (
                                <button
                                    key={src}
                                    onClick={() => setFormData({ ...formData, image: src })}
                                    className={cn(
                                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                        formData.image === src
                                            ? "border-accent ring-2 ring-accent/20"
                                            : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                >
                                    <Image src={src} alt="Thumbnail select" fill className="object-cover" />
                                    {formData.image === src && (
                                        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                            <div className="bg-accent text-white p-1 rounded-full">
                                                <Check className="w-3 h-3" strokeWidth={3} />
                                            </div>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">앱 이름</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                    </div>

                    {/* Description Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">소개글</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
                        />
                    </div>

                    {/* Category Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">카테고리</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {["업무", "학업", "취업", "부업"].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setFormData({ ...formData, category: cat })}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                                        formData.category === cat
                                            ? "bg-accent/10 border-accent text-accent"
                                            : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="직접 입력하거나 위에서 선택하세요"
                            className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-sm"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => onSave(formData)}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95"
                    >
                        저장하기
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
