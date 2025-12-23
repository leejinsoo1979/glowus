'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { FileTreePanel } from '@/components/neural-map/panels/FileTreePanel'
import {
    Files,
    Search,
    GitBranch,
    Puzzle,
    ChevronDown,
    Play,
    MonitorStop,
    FolderOpen,
    Bot,
    Container,
    FileCode,
    Share2,
    Cpu,
    Pin
} from 'lucide-react'

interface MenuItem {
    id: string
    name: string
    icon: React.ElementType
    shortcut?: string
    href?: string
}

// 상단 아이콘 메뉴 (항상 표시)
const topMenuItems: MenuItem[] = [
    { id: 'explorer', name: '탐색기', icon: Files, shortcut: '⇧⌘E' },
    { id: 'search', name: '검색', icon: Search, shortcut: '⇧⌘F' },
    { id: 'source-control', name: '소스 제어', icon: GitBranch, shortcut: '^⇧G' },
    { id: 'extensions', name: '확장', icon: Puzzle, shortcut: '⇧⌘X' },
]

// 드롭다운 메뉴 (더보기 클릭 시)
const dropdownMenuItems: MenuItem[] = [
    { id: 'explorer', name: '탐색기', icon: Files, shortcut: '⇧⌘E' },
    { id: 'search', name: '검색', icon: Search, shortcut: '⇧⌘F' },
    { id: 'source-control', name: '소스 제어', icon: GitBranch, shortcut: '^⇧G' },
    { id: 'extensions', name: '확장', icon: Puzzle, shortcut: '⇧⌘X' },
    { id: 'run-debug', name: '실행 및 디버그', icon: Play, shortcut: '⇧⌘D' },
    { id: 'remote', name: '원격 탐색기', icon: MonitorStop },
    { id: 'python', name: 'Python', icon: FileCode },
    { id: 'github-actions', name: 'GitHub Actions', icon: GitBranch },
    { id: 'containers', name: 'Containers', icon: Container },
    { id: 'makefile', name: 'Makefile', icon: FileCode },
    { id: 'live-share', name: 'Live Share', icon: Share2 },
    { id: 'codex', name: 'Codex', icon: Cpu },
]

export function CursorStyleSidebar() {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'
    const currentMapId = useNeuralMapStore(s => s.currentGraph?.id)

    const [activeItem, setActiveItem] = useState('explorer')
    const [showDropdown, setShowDropdown] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className={cn(
            "flex flex-col h-full min-h-0",
            isDark ? "bg-zinc-900" : "bg-white"
        )}>
            {/* 상단 아이콘 메뉴 바 */}
            <div className={cn(
                "flex items-center gap-0.5 px-2 py-2 border-b flex-shrink-0",
                isDark ? "border-zinc-800" : "border-zinc-200"
            )}>
                {/* 메인 아이콘들 */}
                {topMenuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeItem === item.id
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveItem(item.id)}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                isActive
                                    ? isDark
                                        ? "bg-zinc-700 text-zinc-100"
                                        : "bg-zinc-200 text-zinc-900"
                                    : isDark
                                        ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                            )}
                            title={`${item.name} ${item.shortcut || ''}`}
                        >
                            <Icon className="w-5 h-5" strokeWidth={1.5} />
                        </button>
                    )
                })}

                {/* 더보기 화살표 */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            showDropdown
                                ? isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-200 text-zinc-900"
                                : isDark
                                    ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                                    : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                        )}
                        title="더보기"
                    >
                        <ChevronDown className={cn(
                            "w-4 h-4 transition-transform",
                            showDropdown && "rotate-180"
                        )} />
                    </button>

                    {/* 드롭다운 메뉴 */}
                    <AnimatePresence>
                        {showDropdown && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className={cn(
                                    "absolute top-full left-0 mt-1 w-64 py-1 rounded-lg shadow-xl border z-50",
                                    isDark
                                        ? "bg-zinc-800 border-zinc-700"
                                        : "bg-white border-zinc-200"
                                )}
                            >
                                {dropdownMenuItems.map((item) => {
                                    const Icon = item.icon
                                    const isActive = activeItem === item.id
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setActiveItem(item.id)
                                                setShowDropdown(false)
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                                                isActive
                                                    ? isDark
                                                        ? "bg-zinc-700 text-zinc-100"
                                                        : "bg-zinc-100 text-zinc-900"
                                                    : isDark
                                                        ? "text-zinc-300 hover:bg-zinc-700"
                                                        : "text-zinc-700 hover:bg-zinc-50"
                                            )}
                                        >
                                            <Icon className="w-4 h-4" strokeWidth={1.5} />
                                            <span className="flex-1 text-left">{item.name}</span>
                                            {item.shortcut && (
                                                <span className={cn(
                                                    "text-xs",
                                                    isDark ? "text-zinc-500" : "text-zinc-400"
                                                )}>
                                                    {item.shortcut}
                                                </span>
                                            )}
                                            {/* 핀 아이콘 */}
                                            <Pin className={cn(
                                                "w-3.5 h-3.5",
                                                isDark ? "text-zinc-600" : "text-zinc-300"
                                            )} />
                                        </button>
                                    )
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* 콘텐츠 영역 */}
            <div className="flex-1 overflow-auto min-h-0">
                {activeItem === 'explorer' && (
                    <FileTreePanel mapId={currentMapId || ''} />
                )}

                {activeItem === 'search' && (
                    <div className="px-3 py-3">
                        <input
                            type="text"
                            placeholder="검색..."
                            className={cn(
                                "no-focus-ring w-full px-3 py-2 rounded-lg border text-sm outline-none",
                                isDark
                                    ? "bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500"
                                    : "bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400"
                            )}
                        />
                    </div>
                )}

                {activeItem === 'source-control' && (
                    <div className={cn("p-4 text-sm", isDark ? "text-zinc-400" : "text-zinc-500")}>
                        소스 제어 기능 준비 중...
                    </div>
                )}

                {activeItem === 'extensions' && (
                    <div className={cn("p-4 text-sm", isDark ? "text-zinc-400" : "text-zinc-500")}>
                        확장 기능 준비 중...
                    </div>
                )}
            </div>
        </div>
    )
}
