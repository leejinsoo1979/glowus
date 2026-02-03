'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { createClient } from '@/lib/supabase/client'
import { getInitials, cn } from '@/lib/utils'
import {
  Search,
  LogOut,
  Settings,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FileText,
  AlertCircle,
  Settings2,
  Folder,
  PanelLeft,
  Key,
} from 'lucide-react'

const CLAUDE_ORANGE = '#D97757'

// Claude Code 픽셀 마스코트 아이콘
const ClaudeMascotIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 22 13" className={className}>
    {/* Ears */}
    <rect x="1" y="4" width="2" height="3" fill="currentColor" />
    <rect x="19" y="4" width="2" height="3" fill="currentColor" />
    {/* Body */}
    <rect x="3" y="0" width="16" height="10" fill="currentColor" />
    {/* Eyes */}
    <rect x="5" y="4" width="2" height="2" fill="#1a1a1a" />
    <rect x="15" y="4" width="2" height="2" fill="#1a1a1a" />
    {/* Legs */}
    <rect x="4" y="10" width="2" height="3" fill="currentColor" />
    <rect x="7" y="10" width="2" height="3" fill="currentColor" />
    <rect x="13" y="10" width="2" height="3" fill="currentColor" />
    <rect x="16" y="10" width="2" height="3" fill="currentColor" />
  </svg>
)
import { MainAssistantButton } from '@/components/notifications/MainAssistantButton'
import { ProactiveNotificationBadge } from '@/components/proactive'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { leftPanelOpen, toggleLeftPanel, agentSidebarOpen, toggleAgentSidebar } = useUIStore()
  const { user, logout: clearAuth } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)

  // Neural Map store for search
  const files = useNeuralMapStore((s) => s.files)
  const graph = useNeuralMapStore((s) => s.graph)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery)
  const setSearchQuery = useNeuralMapStore((s) => s.setSearchQuery)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

  // 검색 결과
  const suggestions = useMemo(() => {
    const query = searchQuery?.toLowerCase().trim() || ''
    if (!query || query.length < 1) return []

    const results: { type: 'file' | 'node'; name: string; path?: string; id: string; item: any }[] = []

    files.forEach(f => {
      if (f.name.toLowerCase().includes(query) || f.path?.toLowerCase().includes(query)) {
        results.push({ type: 'file', name: f.name, path: f.path, id: f.id, item: f })
      }
    })

    graph?.nodes?.forEach(n => {
      if (n.title.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)) {
        if (!results.some(r => r.id === n.id)) {
          results.push({ type: 'node', name: n.title, id: n.id, item: n })
        }
      }
    })

    return results.slice(0, 10)
  }, [searchQuery, files, graph?.nodes])

  // 자동완성 표시
  useEffect(() => {
    setShowAutocomplete(suggestions.length > 0 && searchQuery.length > 0 && searchFocused)
    setSelectedIndex(0)
  }, [suggestions.length, searchQuery.length, searchFocused])

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectSuggestion = (suggestion: typeof suggestions[0]) => {
    if (suggestion.type === 'file') {
      openCodePreview(suggestion.item)
    } else {
      setFocusNodeId(suggestion.id)
    }
    setShowAutocomplete(false)
    setSearchQuery('')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showAutocomplete || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelectSuggestion(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false)
    }
  }

  useEffect(() => {
    const checkElectron = () => {
      const isEl = typeof window !== 'undefined' &&
        (!!(window as any).electron ||
          navigator.userAgent.toLowerCase().includes('electron') ||
          (window as any).process?.versions?.electron);
      setIsElectron(isEl)
    }
    checkElectron()
  }, [])

  if (isElectron) return null

  const isDark = resolvedTheme === 'dark' || resolvedTheme === undefined

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
    >
      {/* Left: Panel Toggle */}
      <button
        onClick={toggleLeftPanel}
        className={cn(
          "p-2 transition-colors mr-2",
          isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
        )}
        title="대화 목록"
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      {/* Center: Search Bar */}
      <div className="flex-1 flex justify-center px-4" ref={searchRef}>
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-lg w-full max-w-md border transition-all relative",
            isDark
              ? "bg-white/5 border-white/10 hover:border-white/20 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20"
              : "bg-zinc-100 border-zinc-200 hover:border-zinc-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"
          )}
        >
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder={pathname || "Search or enter URL..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            className={cn(
              "flex-1 bg-transparent text-sm outline-none placeholder-zinc-500",
              isDark ? "text-zinc-300" : "text-zinc-700"
            )}
          />

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {showAutocomplete && suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn(
                  'absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto',
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
                )}
              >
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                      index === selectedIndex
                        ? isDark ? 'bg-zinc-700 text-white' : 'bg-blue-50 text-blue-900'
                        : isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-50 text-zinc-700'
                    )}
                  >
                    {suggestion.type === 'file' ? (
                      <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
                    ) : (
                      <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{suggestion.name}</div>
                      {suggestion.path && (
                        <div className={cn('truncate text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {suggestion.path}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Profile & Agent Toggle */}
      <div className="flex items-center gap-2">
        {/* Proactive Notifications */}
        <ProactiveNotificationBadge position="top-right" />

        {/* AI Assistant Button */}
        <MainAssistantButton />

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

          {/* User Menu Dropdown */}
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={cn(
                  "absolute top-10 right-0 w-64 rounded-2xl shadow-2xl z-[200] border backdrop-blur-2xl py-2",
                  isDark ? "bg-zinc-900/95 border-white/10 text-zinc-300" : "bg-white/95 border-zinc-200 text-zinc-700"
                )}
              >
                {/* Personal Identity Section */}
                <div className={cn(
                  "px-4 py-3 border-b flex items-center justify-between group cursor-pointer",
                  isDark ? "border-white/5 hover:bg-white/[0.02]" : "border-zinc-100 hover:bg-zinc-50"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                      {getInitials(user?.name || 'U')}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate max-w-[120px]">{user?.name || 'User'}</span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{user?.email || '(Google Auth)'}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                </div>

                {/* Main Menu Items */}
                <div className="py-2 space-y-0.5">
                  <MenuButton
                    icon={Settings}
                    label="프로필 설정"
                    isDark={isDark}
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/dashboard-group/profile')
                    }}
                  />
                  <MenuButton
                    icon={Settings2}
                    label="환경설정"
                    isDark={isDark}
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/dashboard-group/settings')
                    }}
                  />
                  <MenuButton
                    icon={Key}
                    label="API 키 관리"
                    isDark={isDark}
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/dashboard-group/settings/api-keys')
                    }}
                  />

                  <div className={cn("my-1 border-t", isDark ? "border-white/5" : "border-zinc-100")} />

                  <MenuButton icon={FileText} label="변경 로그" isDark={isDark} />
                  <MenuButton
                    icon={AlertCircle}
                    label="문제 신고"
                    isDark={isDark}
                    onClick={() => window.open('https://github.com/issues', '_blank')}
                  />
                </div>

                {/* Logout Section */}
                <div className={cn("p-2 border-t", isDark ? "border-white/5" : "border-zinc-100")}>
                  <button
                    onClick={handleLogout}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-xs",
                      isDark
                        ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                    )}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>로그아웃</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Claude Code Sidebar Toggle */}
        <button
          onClick={toggleAgentSidebar}
          className={cn(
            "p-2 rounded-md transition-colors",
            agentSidebarOpen
              ? "text-white"
              : isDark
                ? "hover:bg-white/5"
                : "hover:bg-zinc-100"
          )}
          style={{
            backgroundColor: agentSidebarOpen ? CLAUDE_ORANGE : undefined,
            color: agentSidebarOpen ? 'white' : CLAUDE_ORANGE
          }}
          title="Claude Code"
        >
          <ClaudeMascotIcon className="w-5 h-4" />
        </button>
      </div>
    </header>
  )
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  iconClassName,
  isDark
}: {
  icon: any
  label: string
  onClick?: () => void
  iconClassName?: string
  isDark: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-2 flex items-center gap-3 transition-colors group",
        isDark ? "hover:bg-white/5" : "hover:bg-zinc-50"
      )}
    >
      <Icon className={cn("w-4 h-4 text-zinc-500 group-hover:text-inherit transition-colors", iconClassName)} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
