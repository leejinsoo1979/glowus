"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ChevronLeft,
    ChevronRight,
    Search,
    RefreshCw,
    Minus,
    MessageSquare,
    FileText,
    Youtube,
    Bot,
    Sparkles,
    Globe,
    Code,
    Image as ImageIcon,
    Music,
    Video,
    BookOpen,
    Loader2,
    Table,
    Mail,
    FolderKanban
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkItem {
    id: string
    title: string
    type: 'chat' | 'youtube' | 'document' | 'code' | 'image' | 'analysis' | 'sheet' | 'email' | 'project'
    date: string
    subtitle?: string
    agentId?: string
    avatarUrl?: string
    url?: string
}

// 작업 타입별 아이콘
const getTypeIcon = (type: WorkItem['type']) => {
    switch (type) {
        case 'youtube':
            return <Youtube className="w-4 h-4 text-red-500" />
        case 'document':
            return <FileText className="w-4 h-4 text-blue-500" />
        case 'code':
            return <Code className="w-4 h-4 text-green-500" />
        case 'image':
            return <ImageIcon className="w-4 h-4 text-purple-500" />
        case 'analysis':
            return <Sparkles className="w-4 h-4 text-yellow-500" />
        case 'sheet':
            return <Table className="w-4 h-4 text-emerald-500" />
        case 'email':
            return <Mail className="w-4 h-4 text-sky-500" />
        case 'project':
            return <FolderKanban className="w-4 h-4 text-violet-500" />
        case 'chat':
        default:
            return <MessageSquare className="w-4 h-4 text-zinc-500" />
    }
}

interface WorkHistorySidebarProps {
    isOpen?: boolean
    onToggle?: () => void
    onSelectWork?: (work: WorkItem) => void
}

export function WorkHistorySidebar({
    isOpen: controlledIsOpen,
    onToggle,
    onSelectWork
}: WorkHistorySidebarProps) {
    const router = useRouter()
    const [internalIsOpen, setInternalIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [workHistory, setWorkHistory] = useState<WorkItem[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
    const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen))

    // 작업 목록 가져오기
    const fetchWorkHistory = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/work-history')
            if (response.ok) {
                const data = await response.json()
                setWorkHistory(data.workHistory || [])
            }
        } catch (error) {
            console.error('Failed to fetch work history:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // 사이드바 열릴 때 데이터 로드
    useEffect(() => {
        if (isOpen) {
            fetchWorkHistory()
        }
    }, [isOpen])

    // 작업 클릭 시 해당 페이지로 이동
    const handleWorkClick = (work: WorkItem) => {
        // URL이 있으면 해당 URL로 이동
        if (work.url) {
            if (work.url.startsWith('http')) {
                window.open(work.url, '_blank')
            } else {
                router.push(work.url)
            }
        } else if (work.agentId) {
            // 에이전트 대화인 경우
            router.push(`/dashboard-group/agents/${work.agentId}`)
        } else if (work.type === 'youtube') {
            // YouTube 요약인 경우
            router.push('/dashboard-group/apps/ai-summary')
        } else if (work.type === 'sheet') {
            // 스프레드시트인 경우
            router.push('/dashboard-group/works')
        } else if (work.type === 'email') {
            // 이메일인 경우
            router.push('/dashboard-group/email')
        }
        onSelectWork?.(work)
    }

    // 검색 필터링
    const filteredWorks = searchQuery
        ? workHistory.filter(work =>
            work.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            work.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : workHistory

    return (
        <>
            {/* 토글 버튼 - 항상 표시 */}
            <button
                onClick={handleToggle}
                className={cn(
                    "fixed top-1/2 -translate-y-1/2 z-[100]",
                    "w-8 h-20 bg-zinc-800 hover:bg-zinc-700 rounded-l-xl",
                    "flex items-center justify-center transition-all duration-300",
                    "border-l border-t border-b border-zinc-600 shadow-lg",
                    isOpen ? "right-[320px]" : "right-0"
                )}
            >
                {isOpen ? (
                    <ChevronRight className="w-5 h-5 text-white" />
                ) : (
                    <ChevronLeft className="w-5 h-5 text-white" />
                )}
            </button>

            {/* 사이드바 패널 */}
            <div
                className={cn(
                    "fixed right-0 top-0 h-full w-[320px] bg-zinc-900 border-l border-zinc-700 z-[90]",
                    "transform transition-transform duration-300 ease-in-out shadow-2xl",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* 헤더 */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
                    <h2 className="text-sm font-semibold text-white">작업 목록</h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={fetchWorkHistory}
                            disabled={isLoading}
                            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn("w-4 h-4 text-zinc-400", isLoading && "animate-spin")} />
                        </button>
                        <button
                            onClick={handleToggle}
                            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <Minus className="w-4 h-4 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* 검색 */}
                <div className="p-3 border-b border-zinc-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="채팅 검색"
                            className="w-full h-9 bg-zinc-800 border-0 rounded-lg pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                        />
                    </div>
                </div>

                {/* 작업 목록 */}
                <div className="flex-1 overflow-y-auto h-[calc(100%-130px)]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
                        </div>
                    ) : filteredWorks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <MessageSquare className="w-10 h-10 text-zinc-700 mb-3" />
                            <p className="text-sm text-zinc-500">작업 기록이 없습니다</p>
                            <p className="text-xs text-zinc-600 mt-1">에이전트와 대화를 시작해보세요</p>
                        </div>
                    ) : (
                        filteredWorks.map((work) => (
                            <button
                                key={work.id}
                                onClick={() => handleWorkClick(work)}
                                className="w-full px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left border-b border-zinc-800/50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">
                                        {work.avatarUrl ? (
                                            <img
                                                src={work.avatarUrl}
                                                alt={work.title}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                                                {getTypeIcon(work.type)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">
                                            {work.title}
                                        </p>
                                        {work.subtitle && (
                                            <p className="text-xs text-zinc-500 truncate mt-0.5">
                                                {work.subtitle}
                                            </p>
                                        )}
                                        <p className="text-xs text-zinc-600 mt-1">
                                            {work.date}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* 오버레이 (모바일용) */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-30 lg:hidden"
                    onClick={handleToggle}
                />
            )}
        </>
    )
}
