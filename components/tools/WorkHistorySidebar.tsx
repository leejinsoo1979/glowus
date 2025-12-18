"use client"

import React, { useState } from 'react'
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
    BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkItem {
    id: string
    title: string
    type: 'chat' | 'youtube' | 'document' | 'code' | 'image' | 'analysis'
    date: string
    subtitle?: string
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
        case 'chat':
        default:
            return <MessageSquare className="w-4 h-4 text-zinc-500" />
    }
}

// 더미 작업 목록 데이터
const DUMMY_WORKS: WorkItem[] = [
    {
        id: '1',
        title: "BTS 제이홉 'Arson' 뮤직비디오 분석",
        type: 'youtube',
        date: '어제',
    },
    {
        id: '2',
        title: '한국어 문장 의미 파악하기',
        type: 'analysis',
        date: '어제',
        subtitle: '어제 내 스타트업쇼',
    },
    {
        id: '3',
        title: 'Flutter Native App',
        type: 'code',
        date: '어제',
    },
    {
        id: '4',
        title: '이걸 작성해줘',
        type: 'document',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '5',
        title: '이거뭐야? in html format',
        type: 'code',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '6',
        title: '혁신적인 비즈니스 사업계획서 개발 ...',
        type: 'document',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '7',
        title: 'Simple Website or Web App',
        type: 'code',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '8',
        title: '한국어 초기 대화 의미 이해',
        type: 'chat',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '9',
        title: '한국어 초기 대화 및 물음표 분석',
        type: 'analysis',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '10',
        title: 'AI 기능 목록 및 다양한 작업 소개',
        type: 'chat',
        date: '2025년 12월 16일 (화)',
    },
    {
        id: '11',
        title: 'Invoice4',
        type: 'document',
        date: '2025년 12월 16일 (화)',
    },
]

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
    const [internalIsOpen, setInternalIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
    const handleToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen))

    // 검색 필터링
    const filteredWorks = searchQuery
        ? DUMMY_WORKS.filter(work =>
            work.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : DUMMY_WORKS

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
                        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
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
                    {filteredWorks.map((work) => (
                        <button
                            key={work.id}
                            onClick={() => onSelectWork?.(work)}
                            className="w-full px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left border-b border-zinc-800/50"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    {getTypeIcon(work.type)}
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
                    ))}
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
