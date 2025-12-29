"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
    Play,
    Pause,
    Settings,
    Trash2,
    Clock,
    Bot,
    MessageSquare,
    Brain,
    Sparkles,
    Zap,
} from "lucide-react"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import type { DeployedAgent, AgentStatus } from "@/types/database"
import { PROVIDER_INFO, LLMProvider } from "@/lib/llm/models"
import {
    getCategoryId,
    getAvatarUrl,
    formatTimeAgo,
    AGENT_STATUS_CONFIG,
} from "@/lib/agent/utils"

interface AgentCardProps {
    agent: DeployedAgent
    viewMode?: "grid" | "list"
    index?: number
    onToggleStatus: (agent: DeployedAgent, e: React.MouseEvent) => void
    onDelete: (agentId: string, e: React.MouseEvent) => void
}

const CATEGORY_ICONS: Record<string, any> = {
    chatbot: MessageSquare,
    analyzer: Brain,
    generator: Sparkles,
    assistant: Bot,
    default: Bot,
}

const CATEGORY_LABELS: Record<string, string> = {
    chatbot: "챗봇",
    analyzer: "분석기",
    generator: "생성기",
    assistant: "어시스턴트",
    default: "기타",
}

export function AgentCard({
    agent,
    viewMode = "grid",
    index = 0,
    onToggleStatus,
    onDelete,
}: AgentCardProps) {
    const router = useRouter()
    const { accentColor } = useThemeStore()
    const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]
    const [mounted, setMounted] = useState(false)

    // Hydration fix for theme colors
    useMemo(() => {
        setMounted(true)
    }, [])

    const status = AGENT_STATUS_CONFIG[agent.status] || AGENT_STATUS_CONFIG.INACTIVE
    const categoryId = getCategoryId(agent.capabilities || [])
    const CategoryIcon = CATEGORY_ICONS[categoryId] || CATEGORY_ICONS.default
    const categoryLabel = CATEGORY_LABELS[categoryId] || CATEGORY_LABELS.default

    // Dynamic styles based on theme
    const activeColor = mounted ? currentAccent.color : "#8b5cf6"
    const accentHoverColor = mounted ? currentAccent.hoverColor : "#7c3aed"

    if (viewMode === "list") {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                onClick={() => router.push(`/dashboard-group/agents/${agent.id}`)}
                className="group relative bg-white dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800/60 p-4 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white dark:hover:bg-zinc-900/80"
            >
                <div
                    className="absolute inset-x-0 bottom-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform scale-x-0 group-hover:scale-x-100"
                    style={{ background: `linear-gradient(90deg, transparent, ${activeColor}, transparent)` }}
                />

                <div className="flex items-center gap-4 relative z-10">
                    <div className="relative">
                        <img
                            src={getAvatarUrl(agent)}
                            alt={agent.name}
                            className="w-12 h-12 rounded-xl object-cover bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-800 group-hover:ring-2 group-hover:ring-offset-2 dark:group-hover:ring-offset-zinc-900 group-hover:ring-zinc-300 dark:group-hover:ring-zinc-700 transition-all"
                        />
                        <div
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 bg-white dark:bg-zinc-800 shadow-sm"
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: status.color }}
                            />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-zinc-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                {agent.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase tracking-wider">
                                {categoryLabel}
                            </span>
                        </div>
                        <p className="text-sm text-zinc-500 truncate">{agent.description || "설명 없음"}</p>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-zinc-500">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-50 dark:bg-zinc-800/50">
                            <span className="text-base">{PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]?.icon || '🤖'}</span>
                            <span className="text-xs font-medium">{agent.model || 'qwen2.5:3b'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTimeAgo(agent.last_active_at)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 pl-4 border-l border-zinc-200 dark:border-zinc-800/50 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <button
                            onClick={(e) => onToggleStatus(agent, e)}
                            className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title={status.label}
                        >
                            {agent.status === "ACTIVE" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/agent-builder/${agent.id}`) }}
                            className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            title="편집"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => onDelete(agent.id, e)}
                            className="p-2 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="삭제"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            onClick={() => router.push(`/dashboard-group/agents/${agent.id}`)}
            className="group relative bg-white dark:bg-zinc-900/40 rounded-3xl border border-zinc-200 dark:border-zinc-800/60 p-6 cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-xl hover:bg-white dark:hover:bg-zinc-900/80 hover:-translate-y-1"
            style={{
                boxShadow: mounted ? `0 0 0 0 transparent` : undefined
            } as any}
        >
            {/* Dynamic Glow Effect */}
            <div
                className="absolute -inset-1 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl"
                style={{
                    background: `radial-gradient(circle at center, ${activeColor}, transparent 70%)`
                }}
            />

            {/* Top Border Highlight */}
            <div
                className="absolute inset-x-0 top-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: `linear-gradient(90deg, transparent, ${activeColor}, transparent)`
                }}
            />

            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                    <div className="relative">
                        {/* Avatar Container with Animated Ring */}
                        <div className="relative z-10">
                            <img
                                src={getAvatarUrl(agent)}
                                alt={agent.name}
                                className="w-16 h-16 rounded-2xl object-cover bg-zinc-100 dark:bg-zinc-800 shadow-lg ring-1 ring-zinc-100 dark:ring-zinc-800 group-hover:ring-2 group-hover:ring-offset-2 dark:group-hover:ring-offset-zinc-900 transition-all duration-300"
                                style={{
                                    // @ts-ignore
                                    "--tw-ring-color": activeColor
                                }}
                            />
                        </div>

                        {/* Category Badge Icon */}
                        <div
                            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-md backdrop-blur-md z-20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                            style={{ backgroundColor: `${activeColor}20` }}
                        >
                            <CategoryIcon className="w-4 h-4" style={{ color: activeColor }} />
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border border-transparent group-hover:border-zinc-100 dark:group-hover:border-zinc-800 transition-colors"
                        style={{
                            backgroundColor: status.bgColor,
                            color: status.color
                        }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: status.color }} />
                        {status.label}
                    </div>
                </div>

                <div className="mb-4">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1 group-hover:text-primary transition-colors truncate">
                        {agent.name}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 h-10 leading-relaxed">
                        {agent.description || "설명이 없습니다. 이 에이전트는 특별한 목적을 위해 만들어졌습니다."}
                    </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                    {(agent.capabilities || [])
                        .filter((cap: string) => !cap.startsWith('team:'))
                        .slice(0, 3)
                        .map((cap: string, idx: number) => (
                            <span
                                key={idx}
                                className="px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-transparent group-hover:border-zinc-200 dark:group-hover:border-zinc-700 transition-colors"
                            >
                                {cap}
                            </span>
                        ))}
                    {(!agent.capabilities || agent.capabilities.length === 0) && (
                        <span className="px-2 py-1 rounded-md text-[10px] bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800">
                            기능 없음
                        </span>
                    )}
                </div>

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 overflow-hidden">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-500">
                        <span className="text-base filter grayscale group-hover:grayscale-0 transition-all">
                            {PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]?.icon || '🤖'}
                        </span>
                        <span className="font-medium truncate max-w-[80px]">
                            {agent.model || 'qwen2.5:3b'}
                        </span>
                    </div>

                    {/* Actions - Slide up on Hover */}
                    <div className="flex items-center gap-1 transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out">
                        <button
                            onClick={(e) => onToggleStatus(agent, e)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                            title={status.label}
                        >
                            {agent.status === "ACTIVE" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/agent-builder/${agent.id}`) }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                            title="편집"
                        >
                            <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={(e) => onDelete(agent.id, e)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 text-zinc-400 transition-colors"
                            title="삭제"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Time Indicator - Fades out on Hover */}
                    <div className="transform transition-all duration-300 group-hover:translate-y-10 group-hover:opacity-0 absolute right-6">
                        <span className="text-xs text-zinc-400">
                            {formatTimeAgo(agent.last_active_at)}
                        </span>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
