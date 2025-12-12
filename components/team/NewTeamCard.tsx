'use client'

import { motion } from 'framer-motion'
import { Users, FolderKanban, ArrowRight, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Team } from '@/stores/teamStore'
import { useThemeStore } from '@/stores/themeStore'

// Exported team card gradients for consistent colors
export const teamGradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-rose-500 to-pink-500',
    'from-cyan-500 to-blue-500',
]

// Exported team card patterns (optional decoration)
export const teamPatterns = [
    'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
    'radial-gradient(circle at 80% 30%, white 1px, transparent 1px)',
    'radial-gradient(circle at 50% 80%, white 1px, transparent 1px)',
    'radial-gradient(circle at 30% 20%, white 1px, transparent 1px)',
]

interface TeamCardProps {
    team: Team
    onClick?: () => void
    onEdit?: (e: React.MouseEvent) => void
    isSelected?: boolean
    index?: number
}

export function TeamCard({ team, onClick, onEdit, isSelected, index = 0 }: TeamCardProps) {
    const { accentColor } = useThemeStore()

    const getThemeStyles = () => {
        switch (accentColor) {
            case 'purple': return {
                gradient: 'from-purple-500 to-violet-600',
                text: 'text-purple-600 dark:text-purple-400',
                ring: 'ring-purple-500',
                shadow: 'shadow-purple-500/20',
                hoverBorder: 'hover:border-purple-500/30'
            }
            case 'blue': return {
                gradient: 'from-blue-500 to-indigo-600',
                text: 'text-blue-600 dark:text-blue-400',
                ring: 'ring-blue-500',
                shadow: 'shadow-blue-500/20',
                hoverBorder: 'hover:border-blue-500/30'
            }
            case 'green': return {
                gradient: 'from-emerald-500 to-teal-600',
                text: 'text-emerald-600 dark:text-emerald-400',
                ring: 'ring-emerald-500',
                shadow: 'shadow-emerald-500/20',
                hoverBorder: 'hover:border-emerald-500/30'
            }
            case 'orange': return {
                gradient: 'from-orange-500 to-amber-600',
                text: 'text-orange-600 dark:text-orange-400',
                ring: 'ring-orange-500',
                shadow: 'shadow-orange-500/20',
                hoverBorder: 'hover:border-orange-500/30'
            }
            case 'pink': return {
                gradient: 'from-pink-500 to-rose-600',
                text: 'text-pink-600 dark:text-pink-400',
                ring: 'ring-pink-500',
                shadow: 'shadow-pink-500/20',
                hoverBorder: 'hover:border-pink-500/30'
            }
            case 'red': return {
                gradient: 'from-red-500 to-rose-600',
                text: 'text-red-600 dark:text-red-400',
                ring: 'ring-red-500',
                shadow: 'shadow-red-500/20',
                hoverBorder: 'hover:border-red-500/30'
            }
            case 'yellow': return {
                gradient: 'from-yellow-400 to-orange-500',
                text: 'text-yellow-600 dark:text-yellow-400',
                ring: 'ring-yellow-500',
                shadow: 'shadow-yellow-500/20',
                hoverBorder: 'hover:border-yellow-500/30'
            }
            case 'cyan': return {
                gradient: 'from-cyan-400 to-blue-500',
                text: 'text-cyan-600 dark:text-cyan-400',
                ring: 'ring-cyan-500',
                shadow: 'shadow-cyan-500/20',
                hoverBorder: 'hover:border-cyan-500/30'
            }
            default: return { // Default to Blue
                gradient: 'from-blue-500 to-indigo-600',
                text: 'text-blue-600 dark:text-blue-400',
                ring: 'ring-blue-500',
                shadow: 'shadow-blue-500/20',
                hoverBorder: 'hover:border-blue-500/30'
            }
        }
    }

    const theme = getThemeStyles()

    return (
        <motion.div
            layoutId={`team-card-${team.id}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, scale: 1.01 }}
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300",
                "bg-white/80 dark:bg-black/20 backdrop-blur-xl",
                "border border-zinc-200/50 dark:border-white/10",
                "hover:shadow-2xl dark:hover:shadow-white/5", // General shadow
                theme.hoverBorder,
                isSelected && cn("ring-2 border-transparent shadow-lg", theme.ring, theme.shadow)
            )}
        >
            {/* Background Glow Effect - Theme Based */}
            <div className={cn(
                "absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            )} />

            {/* Top Banner (Avatar Area) */}
            <div className="p-6 pb-0 relative z-10">
                <div className="flex justify-between items-start">
                    <motion.div
                        whileHover={{ scale: 1.05, rotate: 2 }}
                        className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform",
                            "bg-gradient-to-br", theme.gradient
                        )}
                    >
                        <span className="text-2xl font-bold text-white tracking-tight">
                            {team.name.substring(0, 1)}
                        </span>
                    </motion.div>

                    {/* Action Menu Button */}
                    <button
                        onClick={onEdit}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content Content */}
            <div className="p-6 pt-4 relative z-10">
                <div className="mb-4">
                    <h3 className={cn(
                        "text-xl font-bold text-zinc-900 dark:text-white mb-1 transition-colors group-hover:text-zinc-900 dark:group-hover:text-white"
                    )}>
                        {team.name}
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {team.description || '팀 설명이 없습니다.'}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                        <div className="flex items-center gap-2 mb-1 text-zinc-500 dark:text-zinc-400">
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">멤버</span>
                        </div>
                        <span className="text-lg font-bold text-zinc-900 dark:text-white">
                            {team.memberCount || 0}
                        </span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                        <div className="flex items-center gap-2 mb-1 text-zinc-500 dark:text-zinc-400">
                            <FolderKanban className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">프로젝트</span>
                        </div>
                        <span className="text-lg font-bold text-zinc-900 dark:text-white">
                            {/* Mock Project Count since it might not be in Team object yet */}
                            {Math.floor(Math.random() * 10) + 1}
                        </span>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-white/5">
                    <div className="flex avatars -space-x-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-700" />
                        ))}
                        {(team.memberCount || 0) > 3 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-medium text-zinc-500">
                                +{(team.memberCount || 0) - 3}
                            </div>
                        )}
                    </div>

                    <div className={cn(
                        "flex items-center gap-1 text-xs font-medium transition-colors",
                        isSelected ? theme.text : "text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
                    )}>
                        <span>대시보드 이동</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
