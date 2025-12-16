"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Search,
    Plus,
    MoreVertical,
    Settings,
    Star,
    Users,
    FileText,
    Briefcase,
    LayoutGrid,
    Download,
    Upload,
    ChevronDown,
    FolderOpen,
    Home,
    Wrench,
    ArrowUpDown,
    List,
    Send,
    Bot,
    User,
    ArrowLeft,
    Loader2,
    Mail,
    Sheet,
    Sparkles,
    Globe,
    Presentation,
    Table2,
    Image,
    AppWindow
} from "lucide-react"
import { BsFiletypePpt, BsFiletypeDoc, BsFileEarmarkSpreadsheet, BsFileEarmarkImage } from "react-icons/bs"
import { AiOutlineAppstoreAdd } from "react-icons/ai"
import { RiSparkling2Fill } from "react-icons/ri"
import { FaRegFileCode } from "react-icons/fa6"
import { useThemeStore } from "@/stores/themeStore"
import { cn } from "@/lib/utils"
import { ToolsView } from "./tools-view"
import { useSearchParams, useRouter } from "next/navigation"
import { CreateWorkModal } from "./create-modal"

interface Message {
    role: 'user' | 'assistant'
    content: string
}

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

// --- Chat View Component ---
function ChatView({ onBack, initialQuery }: { onBack: () => void, initialQuery?: string }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const hasSentInitialRef = useRef(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const sendMessageWithContent = async (content: string, currentMessages: Message[] = []) => {
        if (!content.trim() || isLoading) return

        const userMessage: Message = { role: 'user', content: content.trim() }
        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...currentMessages, userMessage].map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    model: 'grok-3-mini'
                })
            })

            const data = await response.json()
            if (data.error) {
                console.error('API Error:', data.error)
                setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${data.error}` }])
            } else if (data.content) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: '응답을 받지 못했습니다.' }])
            }
        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }])
        } finally {
            setIsLoading(false)
        }
    }

    // Send initial query if provided (use ref to prevent double-send in Strict Mode)
    useEffect(() => {
        if (initialQuery && !hasSentInitialRef.current) {
            hasSentInitialRef.current = true
            sendMessageWithContent(initialQuery, [])
        }
    }, [initialQuery])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return
        const content = input.trim()
        setInput('')
        await sendMessageWithContent(content, messages)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Chat Header */}
            <header className="flex items-center gap-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={onBack}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </button>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">GlowUS AI Chat</h2>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto py-6 px-4">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((message, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex gap-4",
                                message.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === 'assistant' && (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={cn(
                                "max-w-[75%] rounded-2xl px-5 py-4",
                                message.role === 'user'
                                    ? "bg-blue-500 text-white"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            )}>
                                <p className="text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            </div>
                            {message.role === 'user' && (
                                <div className="w-10 h-10 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Fixed Bottom Input Area - Enhanced */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-zinc-200 dark:border-zinc-700">
                            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white border-r border-zinc-200 dark:border-zinc-600">
                                <Sparkles className="w-4 h-4" />
                                슈퍼 에이전트
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                                <Users className="w-4 h-4" />
                                팀 채팅
                            </button>
                        </div>

                        {/* Input Field */}
                        <div className="p-4">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="무엇이든 물어보고 만들어보세요"
                                className="w-full bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 text-base focus:outline-none"
                            />
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-700">
                            <div className="flex items-center gap-2">
                                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Search className="w-4 h-4" />
                                    저에 대해 연구
                                </button>
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <FileText className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Wrench className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Upload className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={sendMessage}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    <Send className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- Genspark Style Home with Chat ---
function WorksHome({ onOpenCreate, onStartChat }: { onOpenCreate: () => void, onStartChat: (query: string) => void }) {
    const router = useRouter()
    const [inputValue, setInputValue] = useState('')
    const [activeTab, setActiveTab] = useState<'agent' | 'general'>('agent')

    const agentTools = [
        { icon: LayoutGrid, label: "커스텀 슈퍼 에이전트", bg: "bg-zinc-700", color: "text-white" },
        { icon: FileText, label: "AI 슬라이드", bg: "bg-yellow-500", color: "text-white" },
        { icon: Sheet, label: "AI 시트", bg: "bg-emerald-500", color: "text-white", href: "/dashboard-group/works/ai-sheet" },
        { icon: FileText, label: "AI 문서", bg: "bg-blue-600", color: "text-white", href: "/dashboard-group/works/ai-docs" },
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
        color: string
        active?: boolean
        href?: string
        badge?: string
    }> = [
        { icon: RiSparkling2Fill, label: "범용", bg: "bg-blue-600", color: "text-white", active: true },
        { icon: BsFiletypeDoc, label: "문서", bg: "bg-emerald-500", color: "text-white", href: "/dashboard-group/works/ai-docs" },
        { icon: BsFiletypePpt, label: "슬라이드", bg: "bg-orange-500", color: "text-white", href: "/dashboard-group/works/ai-slides" },
        { icon: BsFileEarmarkSpreadsheet, label: "시트", bg: "bg-green-600", color: "text-white", href: "/dashboard-group/works/ai-sheet" },
        { icon: BsFileEarmarkImage, label: "포스터", bg: "bg-pink-500", color: "text-white" },
        { icon: Globe, label: "웹사이트", bg: "bg-amber-500", color: "text-white" },
        { icon: FaRegFileCode, label: "코딩", bg: "bg-cyan-600", color: "text-white" },
        { icon: AiOutlineAppstoreAdd, label: "Apps +", bg: "bg-purple-500", color: "text-white" },
    ]

    const handleToolClick = (tool: typeof generalTools[number]) => {
        if (tool.href) {
            router.push(tool.href)
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
                GlowUS AI 워크스페이스
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
                        whileHover={{ scale: 1.05 }}
                        onClick={() => handleToolClick(tool)}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center",
                            tool.bg,
                            tool.active && "ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-950"
                        )}>
                            <tool.icon className={cn("w-6 h-6", tool.color)} />
                        </div>
                        <span className={cn("text-xs text-center", tool.active ? "text-white border-b border-white" : "text-zinc-400")}>
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
    const tab = searchParams.get('tab')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [initialQuery, setInitialQuery] = useState('')

    const handleStartChat = (query: string) => {
        setInitialQuery(query)
        setIsChatOpen(true)
    }

    return (
        <div className="flex h-[calc(100vh-64px)] -m-8">
            {/* --- Main Content Area --- */}
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 p-8 overflow-y-auto">
                {isChatOpen ? (
                    <ChatView onBack={() => { setIsChatOpen(false); setInitialQuery(''); }} initialQuery={initialQuery} />
                ) : tab === 'tools' ? (
                    <ToolsView />
                ) : (
                    <WorksHome
                        onOpenCreate={() => setIsCreateModalOpen(true)}
                        onStartChat={handleStartChat}
                    />
                )}
            </div>

            <CreateWorkModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    )
}
