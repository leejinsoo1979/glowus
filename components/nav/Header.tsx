'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import { ThemeDropdown } from './ThemeDropdown'
import {
  Bell,
  Search,
  Plus,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Command,
  Bot,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { openCommitModal, sidebarOpen, workHistoryOpen, toggleWorkHistory } = useUIStore()
  const { user, logout: clearAuth } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  // resolvedTheme이 undefined일 때(SSR) dark로 기본값
  const isDark = resolvedTheme === 'dark' || resolvedTheme === undefined

  // Calculate header left position based on sidebar state and email page
  const isEmailPage = pathname?.includes('/email')
  // 이메일 페이지: Level1(64px) + FolderMenu(256px) = 320px - 폴더 메뉴는 자체 헤더 사용
  const headerLeft = sidebarOpen ? (isEmailPage ? 320 : 304) : 64

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/auth-group/login')
  }

  return (
    <header
      className={`fixed top-0 right-0 z-40 h-16 backdrop-blur-xl transition-all duration-300 ${isDark
          ? 'bg-zinc-900/80 border-b border-zinc-800'
          : 'bg-white/80 border-b border-zinc-200'
        }`}
      style={{ left: sidebarOpen ? 304 : 64 }}
    >
      <div className="h-full px-6 flex items-center justify-end gap-3">
        {/* Search - 에이전트 빌더 옆 */}
        <div className="w-72">
          <motion.div
            className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}
          >
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchFocused ? 'text-accent' : 'text-theme-muted'}`} />
            <input
              type="text"
              placeholder="검색..."
              className={`w-full h-9 pl-9 pr-16 rounded-lg text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all ${isDark
                ? 'bg-zinc-800/80 border border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500'
                : 'bg-zinc-100 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                }`}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-700/50' : 'bg-zinc-200'
              }`}>
              <Command className="w-3 h-3 text-theme-muted" />
              <span className="text-xs text-theme-muted font-medium">K</span>
            </div>
          </motion.div>
        </div>

        {/* Agent Builder Button */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => router.push('/agent-builder')}
            size="sm"
            variant="outline"
            leftIcon={<Bot className="w-4 h-4" />}
          >
            에이전트 빌더
          </Button>
        </motion.div>

        {/* Quick Commit Button */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
              onClick={openCommitModal}
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-lg shadow-accent/20"
            >
              커밋
            </Button>
          </motion.div>

          {/* Theme Toggle */}
          <ThemeDropdown />

          {/* Notifications */}
          <motion.button
            className={`relative p-2.5 rounded-xl transition-colors ${isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-5 h-5" />
            <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger-500 rounded-full border-2 ${isDark ? 'border-zinc-900' : 'border-white'
              }`} />
          </motion.button>

          {/* User Menu */}
          <div className="relative">
            <motion.button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center gap-3 p-1.5 pr-3 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                }`}
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/25">
                <span className="text-sm font-bold text-white">
                  {user?.name ? getInitials(user.name) : 'U'}
                </span>
              </div>
              <motion.div
                animate={{ rotate: showUserMenu ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-theme-muted" />
              </motion.div>
            </motion.button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <motion.div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                  <motion.div
                    className={`absolute right-0 mt-2 w-64 backdrop-blur-xl rounded-2xl shadow-2xl py-2 z-50 overflow-hidden ${isDark
                      ? 'bg-zinc-900/95 border border-zinc-700/50'
                      : 'bg-white/95 border border-zinc-200'
                      }`}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* User Info */}
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/25">
                          <span className="text-lg font-bold text-white">
                            {user?.name ? getInitials(user.name) : 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-theme">
                            {user?.name || '사용자'}
                          </p>
                          <p className="text-xs text-theme-muted">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/dashboard-group/profile')
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark
                          ? 'text-zinc-300 hover:bg-zinc-800'
                          : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                      >
                        <User className="w-4 h-4 text-theme-muted" />
                        프로필
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/dashboard-group/settings')
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark
                          ? 'text-zinc-300 hover:bg-zinc-800'
                          : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                      >
                        <Settings className="w-4 h-4 text-theme-muted" />
                        설정
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/dashboard-group/conversations')
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark
                          ? 'text-zinc-300 hover:bg-zinc-800'
                          : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                      >
                        <MessageSquare className="w-4 h-4 text-theme-muted" />
                        대화목록
                      </button>
                    </div>

                    {/* Logout */}
                    <div className={`border-t pt-2 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-400 hover:bg-danger-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        로그아웃
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Work History Panel Toggle - 맨 우측 */}
          <motion.button
            onClick={toggleWorkHistory}
            className={`p-2.5 rounded-xl transition-colors ${isDark
              ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={workHistoryOpen ? '작업 목록 닫기' : '작업 목록 열기'}
          >
            {workHistoryOpen ? (
              <PanelRightClose className="w-5 h-5" />
            ) : (
              <PanelRightOpen className="w-5 h-5" />
            )}
          </motion.button>
        </div>
    </header>
  )
}
