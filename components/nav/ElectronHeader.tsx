'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import {
    Search,
    Plus,
    LogOut,
    User,
    Settings,
    ChevronDown,
    ChevronRight,
    Command,
    Bot,
    MessageSquare,
    PanelRightClose,
    PanelRightOpen,
    LayoutGrid,
    Square,
    Columns,
    Chrome,
    Settings2,
    Check,
    Bell,
    ExternalLink,
    RefreshCw,
    FileText,
    AlertCircle,
    History,
    Sun,
    Moon,
    Palette,
    Terminal
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'

export function ElectronHeader() {
    const router = useRouter()
    const pathname = usePathname()
    const { user, logout: clearAuth } = useAuthStore()
    const { agentSidebarOpen, toggleAgentSidebar } = useUIStore()
    const { theme, setTheme, resolvedTheme } = useTheme()
    const { accentColor, setAccentColor } = useThemeStore()

    const [showUserMenu, setShowUserMenu] = useState(false)
    const [showThemeSubmenu, setShowThemeSubmenu] = useState(false)
    const [isElectron, setIsElectron] = useState(false)
    const [isMac, setIsMac] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const checkElectron = () => {
            const isEl = typeof window !== 'undefined' &&
                (!!(window as any).electron ||
                    navigator.userAgent.toLowerCase().includes('electron') ||
                    (window as any).process?.versions?.electron ||
                    window.location.search.includes('electron=true'));

            const isM = typeof window !== 'undefined' &&
                (navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
                    navigator.userAgent.includes('Macintosh'));

            setIsElectron(isEl)
            setIsMac(isM)
        }
        checkElectron()
    }, [])

    // Prevent hydration mismatch by only rendering after mount
    if (!isElectron) return null

    const isDark = resolvedTheme === 'dark' || resolvedTheme === undefined

    // 헤더 더블클릭 시 창 최대화/복원 (빠른 반응)
    const handleDoubleClick = async (e: React.MouseEvent) => {
        const target = e.target as HTMLElement

        // 버튼, 인풋, 또는 no-drag 클래스 영역에서는 무시
        if (target.tagName === 'INPUT' ||
            target.tagName === 'BUTTON' ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('[data-no-drag]')) {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        try {
            if ((window as any).electron?.window?.maximize) {
                const isMax = await (window as any).electron.window.maximize()
                console.log('[Header] Toggle maximize:', isMax)
            }
        } catch (err) {
            console.error('Failed to toggle maximize:', err)
        }
    }

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        clearAuth()
        router.push('/auth-group/login')
    }

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] h-12 flex items-center px-4 border-b transition-colors select-none",
                isDark ? "bg-zinc-900/95 border-white/5" : "bg-white/90 border-zinc-200"
            )}
            style={{ WebkitAppRegion: 'drag' } as any}
            onDoubleClick={handleDoubleClick}
        >
            {/* Drag area for traffic lights on Mac */}
            {isMac && <div className="w-20 h-full flex-shrink-0" />}

            <div className="flex items-center gap-2" data-no-drag style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={() => router.back()}
                    className={cn("p-1.5 rounded-md transition-colors", isDark ? "hover:bg-white/5 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900")}
                    title="뒤로"
                >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <button
                    onClick={() => router.forward()}
                    className={cn("p-1.5 rounded-md transition-colors", isDark ? "hover:bg-white/5 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900")}
                    title="앞으로"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Center Section: Flexible Drag Area */}
            {/* IMPORTANT: Keep this container draggable to allow dragging in empty space. Only the input box is no-drag. */}
            <div className="flex-1 flex justify-center px-4">
                <div
                    className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-lg w-full max-w-md border transition-all",
                        isDark
                            ? "bg-white/5 border-white/10 hover:border-white/20 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20"
                            : "bg-zinc-100 border-zinc-200 hover:border-zinc-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
                    )}
                    data-no-drag
                    style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                    <Search className="w-3.5 h-3.5 text-zinc-500" />
                    <input
                        type="text"
                        placeholder={pathname || "Search or enter URL..."}
                        className={cn(
                            "flex-1 bg-transparent text-sm outline-none placeholder-zinc-500",
                            isDark ? "text-zinc-300" : "text-zinc-700"
                        )}
                    />
                </div>
            </div>

            {/* Right Section: Layout Controls & Search - No Drag */}
            <div className="flex items-center gap-2" data-no-drag style={{ WebkitAppRegion: 'no-drag' } as any}>
                {/* Neural Map 전용 뷰 모드 아이콘들 - 마이뉴럴맵 페이지에서만 표시 */}
                {pathname?.includes('/neural-map') && (
                    <>
                        {/* Node count */}
                        <span className="text-xs text-zinc-500 font-medium">08</span>

                        {/* Window Layout Icons Group */}
                        <div className="flex items-center gap-0.5">
                            {/* Grid 4-panel */}
                            <button
                                className={cn("p-1.5 rounded transition-colors", isDark ? "hover:bg-white/10 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900")}
                                title="Grid Layout"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                                    <rect x="2" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="9" y="2" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="2" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="9" y="9" width="5" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
                                </svg>
                            </button>
                            {/* Single window */}
                            <button
                                className={cn("p-1.5 rounded transition-colors", isDark ? "hover:bg-white/10 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900")}
                                title="Single Window"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                                    <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                                </svg>
                            </button>
                            {/* Split view */}
                            <button
                                className="p-1.5 rounded bg-white/10 text-zinc-300 transition-colors"
                                title="Split View"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                                    <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                                    <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="1.2" />
                                </svg>
                            </button>
                            {/* Terminal */}
                            <button
                                onClick={() => useNeuralMapStore.getState().toggleTerminal()}
                                className={cn(
                                    "p-1.5 rounded transition-colors",
                                    !useNeuralMapStore.getState().terminalOpen && "hover:bg-white/10 text-zinc-500 hover:text-white"
                                )}
                                style={useNeuralMapStore.getState().terminalOpen ? {
                                    backgroundColor: `${accentColor}33`,
                                    color: accentColor
                                } : undefined}
                                title="Terminal"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                                    <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
                                    <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="2.6" y="10.6" width="10.8" height="2.8" rx="0.5" fill="currentColor" opacity="0.5" />
                                </svg>
                            </button>
                        </div>

                        {/* Search */}
                        <button
                            className={cn("p-1.5 rounded transition-colors", isDark ? "hover:bg-white/10 text-zinc-500 hover:text-white" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900")}
                            title="Search"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    </>
                )}

                {/* Profile Widget */}
                <div className="relative">
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className={cn(
                            "flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border transition-all",
                            isDark
                                ? "bg-white/5 border-white/10 hover:border-white/20"
                                : "bg-zinc-100 border-zinc-200 hover:border-zinc-300",
                            showUserMenu && "border-blue-500/50 ring-2 ring-blue-500/20"
                        )}
                    >
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden shadow-lg shadow-blue-500/20">
                            {user?.avatar_url ? (
                                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                getInitials(user?.name || 'U')
                            )}
                        </div>
                        <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform", showUserMenu && "rotate-180")} />
                    </button>

                    {/* Integrated User Menu Dropdown */}
                    <AnimatePresence>
                        {showUserMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10, x: 0 }}
                                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10, x: 0 }}
                                className={cn(
                                    "absolute top-10 right-0 w-64 rounded-2xl shadow-2xl z-[200] border backdrop-blur-2xl py-2",
                                    isDark ? "bg-zinc-900/95 border-white/10 text-zinc-300" : "bg-white/95 border-zinc-200 text-zinc-700"
                                )}
                            >
                                {/* Personal Identity Section */}
                                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.02]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                                            {getInitials(user?.name || 'U')}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold truncate max-w-[120px]">{user?.name || 'User'}</span>
                                            <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">(Google Auth)</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                                </div>

                                {/* Main Menu Items */}
                                <div className="py-2 space-y-0.5">
                                    <MenuButton icon={Settings} label="Quick Settings Panel" />
                                    <MenuButton
                                        icon={RefreshCw}
                                        label={isUpdating ? "Checking..." : "Check for Updates..."}
                                        iconClassName={isUpdating ? "animate-spin" : ""}
                                        onClick={async () => {
                                            if ((window as any).electron) {
                                                setIsUpdating(true);
                                                try {
                                                    const result = await (window as any).electron.invoke('app:check-for-updates');
                                                    if (result && result.updateInfo) {
                                                        alert(`New version ${result.updateInfo.version} found! Downloading in progress...`);
                                                    } else if (result && result.status === 'dev-mode') {
                                                        alert('You are in development mode.');
                                                    } else {
                                                        alert('You are on the latest version.');
                                                    }
                                                } catch (e: any) {
                                                    alert('Error checking for updates: ' + e.message);
                                                } finally {
                                                    setIsUpdating(false);
                                                }
                                            } else {
                                                alert("Update check not available in browser mode");
                                            }
                                        }}
                                    />
                                    <MenuButton icon={Settings2} label="Preferences" />

                                    <div className="my-1 border-t border-white/5" />

                                    <MenuButton icon={FileText} label="View Changelog" />
                                    <MenuButton icon={AlertCircle} label="Report Issue" onClick={() => window.open('https://github.com/issues', '_blank')} />
                                </div>

                                {/* Logout Section */}
                                <div className="p-2 border-t border-white/5">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-xs"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Agent Sidebar Toggle */}
                <button
                    onClick={toggleAgentSidebar}
                    className={cn(
                        "p-2 rounded-md transition-colors",
                        agentSidebarOpen ? "bg-blue-500 text-white" : "text-zinc-500 hover:text-white hover:bg-white/5"
                    )}
                >
                    <Bot className="w-4 h-4" />
                </button>
            </div>
        </header>
    )
}

function MenuButton({ icon: Icon, label, onClick, iconClassName }: { icon: any, label: string, onClick?: () => void, iconClassName?: string }) {
    return (
        <button
            onClick={onClick}
            className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors group"
        >
            <Icon className={cn("w-4 h-4 text-zinc-500 group-hover:text-white transition-colors", iconClassName)} />
            <span className="text-sm font-medium">{label}</span>
        </button>
    )
}
