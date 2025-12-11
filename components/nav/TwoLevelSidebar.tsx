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
  Sparkles,
  BarChart3,
  Globe,
  Building2,
  TrendingUp,
  FileText,
  Workflow,
  Bot,
  LogOut,
  Mail,
  MessageCircle,
  Home,
  Briefcase,
  PieChart,
  Zap,
} from 'lucide-react'

// 1단계: 카테고리 (아이콘만)
const categories = [
  {
    id: 'home',
    name: '홈',
    icon: Home,
    items: [
      { name: '대시보드', href: '/dashboard-group', icon: LayoutDashboard },
      { name: '스타트업', href: '/dashboard-group/startup', icon: Building2 },
    ]
  },
  {
    id: 'work',
    name: '업무',
    icon: Briefcase,
    items: [
      { name: '태스크', href: '/dashboard-group/tasks', icon: ListTodo },
      { name: 'KPI', href: '/dashboard-group/kpis', icon: TrendingUp },
      { name: '커밋 기록', href: '/dashboard-group/commits', icon: GitCommit },
    ]
  },
  {
    id: 'communication',
    name: '소통',
    icon: MessageCircle,
    items: [
      { name: '메신저', href: '/dashboard-group/messenger', icon: MessageCircle },
      { name: '이메일', href: '/dashboard-group/email', icon: Mail },
    ]
  },
  {
    id: 'automation',
    name: '자동화',
    icon: Zap,
    items: [
      { name: '워크플로우', href: '/dashboard-group/workflows', icon: Workflow },
      { name: 'AI 에이전트', href: '/dashboard-group/agents', icon: Bot },
    ]
  },
  {
    id: 'analytics',
    name: '분석',
    icon: PieChart,
    items: [
      { name: '리포트', href: '/dashboard-group/reports', icon: FileText },
      { name: 'AI 인사이트', href: '/dashboard-group/insights', icon: Sparkles },
    ]
  },
  {
    id: 'team',
    name: '팀',
    icon: Users,
    items: [
      { name: '팀 관리', href: '/dashboard-group/team', icon: Users },
    ]
  },
]

const investorCategories = [
  {
    id: 'investor',
    name: '투자',
    icon: Globe,
    items: [
      { name: '스타트업 탐색', href: '/dashboard-group/investor/explore', icon: Globe },
      { name: '파이프라인', href: '/dashboard-group/investor/pipeline', icon: BarChart3 },
    ]
  },
]

export function TwoLevelSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, currentTeam, logout: clearAuth } = useAuthStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>('home')
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  // pathname에 따라 activeCategory 자동 설정
  useEffect(() => {
    const allCategories = user?.role === 'INVESTOR' ? investorCategories : categories
    for (const cat of allCategories) {
      if (cat.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
        setActiveCategory(cat.id)
        break
      }
    }
  }, [pathname, user?.role])

  const isDark = mounted ? resolvedTheme === 'dark' : true
  const isVC = user?.role === 'INVESTOR'
  const navCategories = isVC ? investorCategories : categories

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/auth-group/login')
  }

  const activeItems = navCategories.find(cat => cat.id === activeCategory)?.items || []

  return (
    <div className="flex h-screen fixed left-0 top-0 z-40">
      {/* Level 1: 아이콘 사이드바 */}
      <motion.aside
        className={cn(
          'w-16 h-full flex flex-col items-center py-4 border-r',
          isDark
            ? 'bg-zinc-950 border-zinc-800'
            : 'bg-zinc-100 border-zinc-200'
        )}
      >
        {/* Logo */}
        <div className="mb-6">
          <Logo size="sm" collapsed={true} />
        </div>

        {/* Category Icons */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {navCategories.map((category) => {
            const isActive = activeCategory === category.id
            return (
              <button
                key={category.id}
                onClick={() => {
                  setActiveCategory(category.id)
                  setIsSubMenuOpen(true)
                }}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
                  isActive
                    ? 'bg-accent text-white shadow-lg shadow-accent/25'
                    : isDark
                      ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                      : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
                )}
              >
                <category.icon className="w-5 h-5" />
                {/* Tooltip */}
                <div className={cn(
                  'absolute left-full ml-2 px-2 py-1 text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50',
                  isDark
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'bg-white text-zinc-900 border border-zinc-200 shadow-lg'
                )}>
                  {category.name}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Bottom Icons */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <Link
            href="/dashboard-group/settings"
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
              pathname === '/dashboard-group/settings'
                ? isDark
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'bg-zinc-200 text-zinc-900'
                : isDark
                  ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                  : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
            )}
          >
            <Settings className="w-5 h-5" />
            <div className={cn(
              'absolute left-full ml-2 px-2 py-1 text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50',
              isDark
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                : 'bg-white text-zinc-900 border border-zinc-200 shadow-lg'
            )}>
              설정
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
              isDark
                ? 'text-zinc-500 hover:bg-zinc-800 hover:text-red-400'
                : 'text-zinc-500 hover:bg-zinc-200 hover:text-red-500'
            )}
          >
            <LogOut className="w-5 h-5" />
            <div className={cn(
              'absolute left-full ml-2 px-2 py-1 text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50',
              isDark
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                : 'bg-white text-zinc-900 border border-zinc-200 shadow-lg'
            )}>
              나가기
            </div>
          </button>
        </div>
      </motion.aside>

      {/* Level 2: 서브메뉴 사이드바 */}
      <AnimatePresence>
        {isSubMenuOpen && activeItems.length > 0 && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'h-full border-r overflow-hidden',
              isDark
                ? 'bg-zinc-900/95 border-zinc-800'
                : 'bg-white border-zinc-200'
            )}
          >
            <div className="w-[220px] h-full flex flex-col">
              {/* Category Header */}
              <div className={cn(
                'h-16 flex items-center px-4 border-b',
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              )}>
                <h2 className={cn(
                  'text-sm font-semibold',
                  isDark ? 'text-zinc-100' : 'text-zinc-900'
                )}>
                  {navCategories.find(c => c.id === activeCategory)?.name}
                </h2>
              </div>

              {/* Team Info (for non-VC users) */}
              {!isVC && currentTeam && (
                <div className={cn(
                  'px-3 py-3 border-b',
                  isDark ? 'border-zinc-800' : 'border-zinc-200'
                )}>
                  <div className={cn(
                    'flex items-center gap-2 p-2 rounded-lg',
                    isDark
                      ? 'bg-zinc-800/50'
                      : 'bg-zinc-100'
                  )}>
                    <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-medium truncate',
                        isDark ? 'text-zinc-100' : 'text-zinc-900'
                      )}>
                        {currentTeam.name}
                      </p>
                      <p className={cn(
                        'text-[10px] truncate',
                        isDark ? 'text-zinc-500' : 'text-zinc-500'
                      )}>
                        {currentTeam.industry || '스타트업'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub Navigation */}
              <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
                {activeItems.map((item, index) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                          isActive
                            ? 'bg-accent text-white shadow-md shadow-accent/20'
                            : isDark
                              ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                        )}
                      >
                        <item.icon className={cn(
                          'w-4 h-4 flex-shrink-0',
                          isActive ? 'text-white' : ''
                        )} />
                        <span>{item.name}</span>
                      </Link>
                    </motion.div>
                  )
                })}
              </nav>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
