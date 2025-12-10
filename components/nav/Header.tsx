'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/utils'
import {
  Bell,
  Search,
  Plus,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Command,
  Sparkles,
} from 'lucide-react'

export function Header() {
  const router = useRouter()
  const { openCommitModal, sidebarOpen } = useUIStore()
  const { user, logout: clearAuth } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/auth-group/login')
  }

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 transition-all duration-300 ${
        sidebarOpen ? 'left-[280px]' : 'left-20'
      }`}
    >
      <div className="h-full px-6 flex items-center justify-between gap-4">
        {/* Search */}
        <div className="flex-1 max-w-2xl">
          <motion.div
            className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}
          >
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${searchFocused ? 'text-primary-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="프로젝트, 태스크, 커밋 검색..."
              className="w-full h-11 pl-12 pr-24 bg-gray-50/80 border-2 border-gray-200/50 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-gray-400"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 bg-gray-200/50 rounded-lg">
              <Command className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">K</span>
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Commit Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={openCommitModal}
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              className="shadow-lg shadow-primary-500/20"
            >
              커밋
            </Button>
          </motion.div>

          {/* AI Assistant */}
          <motion.button
            className="relative p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-primary-500 text-white shadow-lg shadow-purple-500/25"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.button>

          {/* Notifications */}
          <motion.button
            className="relative p-2.5 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger-500 rounded-full border-2 border-white" />
          </motion.button>

          {/* User Menu */}
          <div className="relative">
            <motion.button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-gray-100 transition-colors"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                <span className="text-sm font-bold text-white">
                  {user?.name ? getInitials(user.name) : 'U'}
                </span>
              </div>
              <motion.div
                animate={{ rotate: showUserMenu ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
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
                    className="absolute right-0 mt-2 w-64 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 py-2 z-50 overflow-hidden"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                          <span className="text-lg font-bold text-white">
                            {user?.name ? getInitials(user.name) : 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {user?.name || '사용자'}
                          </p>
                          <p className="text-xs text-gray-500">{user?.email}</p>
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        프로필
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/dashboard-group/settings')
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        설정
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-gray-100 pt-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
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
        </div>
      </div>
    </header>
  )
}
