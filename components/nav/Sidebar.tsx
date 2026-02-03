'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui'
import {
  LayoutDashboard,
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
  TrendingUp,
  FileText,
  Workflow,
  LogOut,
  Mail,
  BrainCircuit,
  MessageSquare,
  Layers,
  Orbit,
  GanttChart,
  Brain,
  Laptop,     // 🔥 FaLaptopCode 대체
  Link2,      // 🔥 GrConnect 대체
} from 'lucide-react'

// 🔥 react-icons → lucide-react 별칭 (번들 사이즈 절약)
const TbBrandWechat = MessageSquare
const GrConnect = Link2
const FaLaptopCode = Laptop

const navigation = [
  { name: '대시보드', href: '/dashboard-group', icon: LayoutDashboard },
  { name: '스타트업', href: '/dashboard-group/startup', icon: Building2 },
  { name: '태스크', href: '/dashboard-group/tasks', icon: ListTodo },
  { name: '태스크 허브', href: '/dashboard-group/task-hub', icon: Layers },
  { name: '간트차트', href: '/dashboard-group/gantt', icon: GanttChart },
  { name: 'KPI', href: '/dashboard-group/kpis', icon: TrendingUp },
  { name: '커밋 기록', href: '/dashboard-group/commits', icon: GitCommit },
  { name: '메신저', href: '/dashboard-group/messenger', icon: TbBrandWechat },
  { name: '이메일', href: '/dashboard-group/email', icon: Mail },
  { name: '워크플로우', href: '/dashboard-group/workflows', icon: Workflow },
  { name: 'AI 에이전트', href: '/dashboard-group/agents', icon: BrainCircuit },
  { name: 'AI 코딩', href: '/dashboard-group/ai-coding', icon: FaLaptopCode },
  { name: '마이뉴런', href: '/dashboard-group/neurons', icon: Brain },
  { name: '리포트', href: '/dashboard-group/reports', icon: FileText },
  { name: '커넥트', href: '/dashboard-group/connect', icon: GrConnect },
  { name: '팀 관리', href: '/dashboard-group/team', icon: Users },
  { name: 'AI 인사이트', href: '/dashboard-group/insights', icon: Sparkles },
]

const investorNav = [
  { name: '스타트업 탐색', href: '/dashboard-group/investor/explore', icon: Globe },
  { name: '파이프라인', href: '/dashboard-group/investor/pipeline', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { user, currentTeam, logout: clearAuth } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : true
  const isVC = user?.role === 'INVESTOR'
  const navItems = isVC ? investorNav : navigation

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/auth-group/login')
  }

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen backdrop-blur-xl',
        'transition-all duration-300 ease-out',
        isDark
          ? 'bg-zinc-900/90 border-r border-zinc-800'
          : 'bg-white/90 border-r border-zinc-200'
      )}
      animate={{ width: sidebarOpen ? 280 : 80 }}
      style={{ top: 'var(--title-bar-height, 0px)', height: 'calc(100vh - var(--title-bar-height, 0px))' }}
    >
      {/* Logo */}
      <div className={`h-16 flex items-center justify-between px-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}>
        <Logo size="md" collapsed={!sidebarOpen} />
        <motion.button
          onClick={toggleSidebar}
          className={`p-2 rounded-xl transition-colors ${isDark
            ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            : 'hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700'
            }`}
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
            className={`px-4 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${isDark
              ? 'from-zinc-800/50 to-zinc-800 border border-zinc-700/50'
              : 'from-zinc-100 to-zinc-50 border border-zinc-200'
              }`}>
              <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                  {currentTeam.name}
                </p>
                <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
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
                    ? 'bg-accent text-white shadow-lg shadow-accent/25'
                    : isDark
                      ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                )}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110',
                    isActive
                      ? 'text-white'
                      : isDark
                        ? 'text-zinc-500 group-hover:text-accent'
                        : 'text-zinc-400 group-hover:text-accent'
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
                  <div className={`absolute left-full ml-2 px-3 py-2 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg ${isDark
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'bg-white text-zinc-900 border border-zinc-200'
                    }`}>
                    {item.name}
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 border-l border-b ${isDark
                      ? 'bg-zinc-800 border-zinc-700'
                      : 'bg-white border-zinc-200'
                      }`} />
                  </div>
                )}
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* Chat History & Settings */}
      <div className={`px-3 py-4 border-t space-y-1 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        {/* 채팅기록 */}
        <Link
          href="/dashboard-group/chat-history"
          className={cn(
            'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
            pathname === '/dashboard-group/chat-history'
              ? isDark
                ? 'bg-zinc-800 text-zinc-100'
                : 'bg-zinc-100 text-zinc-900'
              : isDark
                ? 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
          )}
        >
          <MessageSquare className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${isDark ? 'text-zinc-500 group-hover:text-accent' : 'text-zinc-400 group-hover:text-accent'
            }`} />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                채팅기록
              </motion.span>
            )}
          </AnimatePresence>
          {/* Tooltip for collapsed state */}
          {!sidebarOpen && (
            <div className={`absolute left-full ml-2 px-3 py-2 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg ${isDark
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'bg-white text-zinc-900 border border-zinc-200'
              }`}>
              채팅기록
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 border-l border-b ${isDark
                ? 'bg-zinc-800 border-zinc-700'
                : 'bg-white border-zinc-200'
                }`} />
            </div>
          )}
        </Link>

        {/* 설정 */}
        <Link
          href="/dashboard-group/settings"
          className={cn(
            'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
            pathname === '/dashboard-group/settings'
              ? isDark
                ? 'bg-zinc-800 text-zinc-100'
                : 'bg-zinc-100 text-zinc-900'
              : isDark
                ? 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
          )}
        >
          <Settings className={`w-5 h-5 flex-shrink-0 group-hover:rotate-90 transition-transform duration-300 ${isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`} />
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
          {/* Tooltip for collapsed state */}
          {!sidebarOpen && (
            <div className={`absolute left-full ml-2 px-3 py-2 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg ${isDark
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'bg-white text-zinc-900 border border-zinc-200'
              }`}>
              설정
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 border-l border-b ${isDark
                ? 'bg-zinc-800 border-zinc-700'
                : 'bg-white border-zinc-200'
                }`} />
            </div>
          )}
        </Link>
      </div>

      {/* Logout Button */}
      <div className={`px-3 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <button
          onClick={handleLogout}
          className={cn(
            'relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group',
            isDark
              ? 'text-zinc-500 hover:bg-zinc-800 hover:text-white'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
          )}
        >
          <LogOut className={`w-5 h-5 flex-shrink-0 group-hover:-translate-x-1 transition-transform duration-300 ${isDark ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-400 group-hover:text-zinc-900'
            }`} />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                나가기
              </motion.span>
            )}
          </AnimatePresence>
          {/* Tooltip for collapsed state */}
          {!sidebarOpen && (
            <div className={`absolute left-full ml-2 px-3 py-2 text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg ${isDark
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'bg-white text-zinc-900 border border-zinc-200'
              }`}>
              나가기
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 border-l border-b ${isDark
                ? 'bg-zinc-800 border-zinc-700'
                : 'bg-white border-zinc-200'
                }`} />
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
