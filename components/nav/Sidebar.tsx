'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  GitCommit,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  Globe,
  Building2,
  Zap,
  TrendingUp,
} from 'lucide-react'

const navigation = [
  { name: '대시보드', href: '/dashboard-group', icon: LayoutDashboard },
  { name: '스타트업', href: '/dashboard-group/startup', icon: Building2 },
  { name: '태스크', href: '/dashboard-group/tasks', icon: ListTodo },
  { name: 'KPI', href: '/dashboard-group/kpis', icon: TrendingUp },
  { name: '커밋 기록', href: '/dashboard-group/commits', icon: GitCommit },
  { name: '팀 관리', href: '/dashboard-group/team', icon: Users },
  { name: 'AI 인사이트', href: '/dashboard-group/insights', icon: Sparkles },
]

const investorNav = [
  { name: '스타트업 탐색', href: '/dashboard-group/investor/explore', icon: Globe },
  { name: '파이프라인', href: '/dashboard-group/investor/pipeline', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { user, currentTeam } = useAuthStore()

  const isVC = user?.role === 'vc'
  const navItems = isVC ? investorNav : navigation

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-zinc-900/90 backdrop-blur-xl border-r border-zinc-800',
        'transition-all duration-300 ease-out'
      )}
      animate={{ width: sidebarOpen ? 280 : 80 }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
        <Link href="/dashboard-group" className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Zap className="w-5 h-5 text-white" />
          </motion.div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                className="text-lg font-bold bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                StartupShow
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        <motion.button
          onClick={toggleSidebar}
          className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </motion.button>
      </div>

      {/* Team Selector */}
      <AnimatePresence>
        {!isVC && sidebarOpen && currentTeam && (
          <motion.div
            className="px-4 py-4 border-b border-zinc-800"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-zinc-800/50 to-zinc-800 border border-zinc-700/50">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">
                  {currentTeam.name}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {currentTeam.industry || '스타트업'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                  'group',
                  isActive
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                )}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110',
                    isActive ? 'text-white' : 'text-zinc-500 group-hover:text-primary-400'
                  )}
                />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Tooltip for collapsed state */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-zinc-800 text-zinc-100 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg border border-zinc-700">
                    {item.name}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-zinc-800 rotate-45 border-l border-b border-zinc-700" />
                  </div>
                )}
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* Settings */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <Link
          href="/dashboard-group/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
            pathname === '/dashboard-group/settings'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
          )}
        >
          <Settings className="w-5 h-5 flex-shrink-0 text-zinc-500 group-hover:rotate-90 transition-transform duration-300" />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                설정
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>
    </motion.aside>
  )
}
