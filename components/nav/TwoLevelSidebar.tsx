'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui'
import { TeamCreateModal, TeamFormData } from '@/components/team/TeamCreateModal'
import { CreateWorkModal } from '@/app/dashboard-group/works/create-modal'
import { EmailSidebarChat } from '@/components/email/EmailSidebarChat'
import { ThemeDropdown } from './ThemeDropdown'
import { FileTreePanel } from '@/components/neural-map/panels/FileTreePanel'
import GitPanel from '@/components/neural-map/panels/GitPanel'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { TaskHistorySidebar } from '@/components/works/TaskHistorySidebar'
import type { EmailAccount, EmailMessage } from '@/types/email'
import { useTeamStore } from '@/stores/teamStore'
// 사이드바에서 직접 사용하는 아이콘만 import
import {
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Folder,
  Pin,
  Files,
  GitBranch,
  Puzzle,
  Bug,
  MonitorPlay,
  Github,
  Container,
  FileCode,
  FileText,
  Share2,
  Bot,
  Building2,
} from 'lucide-react'
import { SiPython } from 'react-icons/si'

// 사이드바 메뉴 데이터 import
import {
  categories,
  investorCategories,
  companyMenuItems
} from './sidebar/menuData'
import type { Category, NestedMenuItem } from './sidebar/types'


// 상위 메뉴 카드 컴포넌트 (2열 그리드용 - Bold & Clean Redesign)
function TopLevelCardMenu({
  item,
  isDark,
  isExpanded,
  onToggle
}: {
  item: NestedMenuItem
  isDark: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const IconComponent = item.icon
  const { accentColor } = useThemeStore()

  // 페이지 이동 경로 결정
  const targetHref = item.href || (item.children && item.children.length > 0 ? item.children[0].href : null)

  const handleClick = (e: React.MouseEvent) => {
    // Link가 처리하므로 하위 메뉴 토글만
    onToggle()
  }

  // 테마 색상 클래스 생성기
  const getThemeClasses = () => {
    switch (accentColor) {
      case 'purple':
        return {
          border: 'hover:border-purple-500 focus:border-purple-500',
          text: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
          bg: 'hover:bg-purple-50 dark:hover:bg-purple-900/10',
          iconBg: 'group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20',
          activeBorder: 'border-purple-600 ring-1 ring-purple-600',
          activeText: 'text-purple-600 dark:text-purple-400',
          activeBg: 'bg-purple-50 dark:bg-purple-900/20',
          activeIconBg: 'bg-purple-100 dark:bg-purple-500/20'
        }
      case 'green':
        return {
          border: 'hover:border-green-500 focus:border-green-500',
          text: 'group-hover:text-green-600 dark:group-hover:text-green-400',
          bg: 'hover:bg-green-50 dark:hover:bg-green-900/10',
          iconBg: 'group-hover:bg-green-100 dark:group-hover:bg-green-500/20',
          activeBorder: 'border-green-600 ring-1 ring-green-600',
          activeText: 'text-green-600 dark:text-green-400',
          activeBg: 'bg-green-50 dark:bg-green-900/20',
          activeIconBg: 'bg-green-100 dark:bg-green-500/20'
        }
      case 'orange':
        return {
          border: 'hover:border-orange-500 focus:border-orange-500',
          text: 'group-hover:text-orange-600 dark:group-hover:text-orange-400',
          bg: 'hover:bg-orange-50 dark:hover:bg-orange-900/10',
          iconBg: 'group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20',
          activeBorder: 'border-orange-600 ring-1 ring-orange-600',
          activeText: 'text-orange-600 dark:text-orange-400',
          activeBg: 'bg-orange-50 dark:bg-orange-900/20',
          activeIconBg: 'bg-orange-100 dark:bg-orange-500/20'
        }
      case 'pink':
        return {
          border: 'hover:border-pink-500 focus:border-pink-500',
          text: 'group-hover:text-pink-600 dark:group-hover:text-pink-400',
          bg: 'hover:bg-pink-50 dark:hover:bg-pink-900/10',
          iconBg: 'group-hover:bg-pink-100 dark:group-hover:bg-pink-500/20',
          activeBorder: 'border-pink-600 ring-1 ring-pink-600',
          activeText: 'text-pink-600 dark:text-pink-400',
          activeBg: 'bg-pink-50 dark:bg-pink-900/20',
          activeIconBg: 'bg-pink-100 dark:bg-pink-500/20'
        }
      case 'red':
        return {
          border: 'hover:border-red-500 focus:border-red-500',
          text: 'group-hover:text-red-600 dark:group-hover:text-red-400',
          bg: 'hover:bg-red-50 dark:hover:bg-red-900/10',
          iconBg: 'group-hover:bg-red-100 dark:group-hover:bg-red-500/20',
          activeBorder: 'border-red-600 ring-1 ring-red-600',
          activeText: 'text-red-600 dark:text-red-400',
          activeBg: 'bg-red-50 dark:bg-red-900/20',
          activeIconBg: 'bg-red-100 dark:bg-red-500/20'
        }
      case 'yellow':
        return {
          border: 'hover:border-yellow-500 focus:border-yellow-500',
          text: 'group-hover:text-yellow-600 dark:group-hover:text-yellow-400',
          bg: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/10',
          iconBg: 'group-hover:bg-yellow-100 dark:group-hover:bg-yellow-500/20',
          activeBorder: 'border-yellow-600 ring-1 ring-yellow-600',
          activeText: 'text-yellow-600 dark:text-yellow-400',
          activeBg: 'bg-yellow-50 dark:bg-yellow-900/20',
          activeIconBg: 'bg-yellow-100 dark:bg-yellow-500/20'
        }
      case 'cyan':
        return {
          border: 'hover:border-cyan-500 focus:border-cyan-500',
          text: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400',
          bg: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/10',
          iconBg: 'group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/20',
          activeBorder: 'border-cyan-600 ring-1 ring-cyan-600',
          activeText: 'text-cyan-600 dark:text-cyan-400',
          activeBg: 'bg-cyan-50 dark:bg-cyan-900/20',
          activeIconBg: 'bg-cyan-100 dark:bg-cyan-500/20'
        }
      case 'blue':
      default:
        return {
          border: 'hover:border-accent focus:border-accent',
          text: 'group-hover:text-accent',
          bg: 'hover:bg-accent/10',
          iconBg: 'group-hover:bg-accent/20',
          activeBorder: 'border-accent ring-1 ring-accent',
          activeText: 'text-accent',
          activeBg: 'bg-accent/10',
          activeIconBg: 'bg-accent/20'
        }
    }
  }

  const theme = getThemeClasses()

  const cardContent = (
    <>
      <div className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
        isDark ? 'bg-zinc-800' : 'bg-zinc-100',
        theme.iconBg,
        isExpanded && theme.activeIconBg
      )}>
        {IconComponent && (
          <IconComponent
            className={cn(
              'w-6 h-6 transition-colors [&>path]:stroke-[1] [&>line]:stroke-[1] [&>circle]:stroke-[1] [&>rect]:stroke-[1]',
              isDark ? 'text-zinc-400' : 'text-zinc-500',
              theme.text,
              isExpanded && theme.activeText
            )}
          />
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className={cn(
          'text-sm font-bold transition-colors',
          isDark ? 'text-zinc-300' : 'text-zinc-700',
          theme.text,
          isExpanded && theme.activeText
        )}>
          {item.name}
        </span>
        {isExpanded && (
          <span className={cn(
            "text-[10px] uppercase font-semibold tracking-wider",
            isDark ? "text-zinc-500" : "text-zinc-400"
          )}>
            Select
          </span>
        )}
      </div>
    </>
  )

  const cardClassName = cn(
    'group w-full aspect-[4/5] rounded-xl border transition-colors duration-100 flex flex-col items-center justify-center gap-3',
    isDark
      ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
      : 'bg-white border-zinc-200 hover:bg-zinc-50',
    theme.border,
    theme.bg,
    isExpanded && cn(theme.activeBorder, theme.activeBg)
  )

  // Link가 있으면 Link 사용 (prefetch 활성화)
  if (targetHref) {
    return (
      <Link
        href={targetHref}
        prefetch={true}
        onClick={handleClick}
        className={cardClassName}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <button
      onClick={handleClick}
      className={cardClassName}
    >
      {cardContent}
    </button>
  )
}

// 재귀적 메뉴 아이템 컴포넌트 (하위 메뉴용)
function NestedMenuItemComponent({
  item,
  depth = 0,
  isDark,
  pathname,
  expandedItems,
  toggleExpand
}: {
  item: NestedMenuItem
  depth?: number
  isDark: boolean
  pathname: string
  expandedItems: Set<string>
  toggleExpand: (name: string) => void
}) {
  const router = useRouter()
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedItems.has(item.name)
  const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
  const IconComponent = item.icon

  const paddingLeft = 12 + depth * 12

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => toggleExpand(item.name)}
          className={cn(
            'w-full flex items-center gap-2 py-1.5 text-xs font-medium transition-all duration-200 rounded-md',
            depth === 0
              ? (isDark ? 'text-zinc-300 font-semibold' : 'text-zinc-700 font-semibold')
              : (isDark ? 'text-zinc-400' : 'text-zinc-600'),
            isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100'
          )}
          style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '8px' }}
        >
          {IconComponent && <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="flex-1 text-left truncate">{item.name}</span>
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
          )}
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {item.children!.map((child) => (
                <NestedMenuItemComponent
                  key={child.name}
                  item={child}
                  depth={depth + 1}
                  isDark={isDark}
                  pathname={pathname}
                  expandedItems={expandedItems}
                  toggleExpand={toggleExpand}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // 링크 아이템 - Link 사용으로 prefetch 활성화
  if (item.href && item.href !== '#') {
    return (
      <Link
        href={item.href}
        prefetch={true}
        onClick={(e) => {
          // Link 기본 동작 유지하면서 명시적으로 이동 처리
          e.preventDefault()
          router.push(item.href!)
        }}
        className={cn(
          'w-full flex items-center gap-2 py-1.5 text-xs transition-colors duration-100 rounded-md cursor-pointer',
          isActive
            ? 'bg-accent text-white font-medium'
            : isDark
              ? 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
        )}
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '8px' }}
      >
        {IconComponent && <IconComponent className="w-3 h-3 flex-shrink-0" />}
        <span className="truncate">{item.name}</span>
      </Link>
    )
  }

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 py-1.5 text-xs transition-colors duration-100 rounded-md text-left',
        isDark
          ? 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      )}
      style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '8px' }}
    >
      {IconComponent && <IconComponent className="w-3 h-3 flex-shrink-0" />}
      <span className="truncate">{item.name}</span>
    </button>
  )
}

interface TwoLevelSidebarProps {
  hideLevel2?: boolean
}

export function TwoLevelSidebar({ hideLevel2 = false }: TwoLevelSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null)
  const { user, currentTeam, logout: clearAuth } = useAuthStore()
  const { accentColor } = useThemeStore()
  const [isResizingHover, setIsResizingHover] = useState(false)
  const {
    activeCategory, setActiveCategory, sidebarOpen, setSidebarOpen, toggleSidebar,
    level2Width, setLevel2Width, isResizingLevel2, setIsResizingLevel2,
    emailSidebarWidth, setEmailSidebarWidth, isResizingEmail, setIsResizingEmail,
    level2Collapsed, toggleLevel2, setLevel2Collapsed,
    openTaskHistory, closeTaskHistory, taskHistoryOpen
  } = useUIStore()

  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const neuralMapId = useNeuralMapStore((s) => s.mapId)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedCompanyMenu, setSelectedCompanyMenu] = useState<string | null>(null)
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false)
  const { createTeam } = useTeamStore()
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)

  // Email sidebar state
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [selectedEmailAccount, setSelectedEmailAccount] = useState<EmailAccount | null>(null)
  const [allEmails, setAllEmails] = useState<EmailMessage[]>([])
  const [currentEmailFolder, setCurrentEmailFolder] = useState<'inbox' | 'starred' | 'sent' | 'trash' | 'spam' | 'drafts' | 'all' | 'scheduled' | 'attachments'>('inbox')
  const [isSyncingEmail, setIsSyncingEmail] = useState(false)
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false)
  const [pinnedToolbarItems, setPinnedToolbarItems] = useState<Set<string>>(new Set(['explorer', 'search', 'git', 'extensions']))
  const [activeToolbarItem, setActiveToolbarItem] = useState<string>('explorer')

  // Toolbar menu items (VS Code style)
  const toolbarMenuItems = [
    { id: 'explorer', name: '탐색기', shortcut: '⇧⌘E', icon: Files },
    { id: 'search', name: '검색', shortcut: '⇧⌘F', icon: Search },
    { id: 'git', name: '소스 제어', shortcut: '^⇧G', icon: GitBranch },
    { id: 'extensions', name: '확장', shortcut: '⇧⌘X', icon: Puzzle },
    { id: 'debug', name: '실행 및 디버그', shortcut: '⇧⌘D', icon: Bug },
    { id: 'remote', name: '원격 탐색기', shortcut: '', icon: MonitorPlay },
    { id: 'python', name: 'Python', shortcut: '', icon: SiPython },
    { id: 'github-actions', name: 'GitHub Actions', shortcut: '', icon: Github },
    { id: 'containers', name: 'Containers', shortcut: '', icon: Container },
    { id: 'makefile', name: 'Makefile', shortcut: '', icon: FileCode },
    { id: 'liveshare', name: 'Live Share', shortcut: '', icon: Share2 },
    { id: 'codex', name: 'Codex', shortcut: '', icon: Bot },
  ]

  const togglePinnedItem = (id: string) => {
    setPinnedToolbarItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }


  useEffect(() => {
    setMounted(true)
  }, [])

  // 정부지원사업 페이지 진입 시 자동으로 해당 메뉴 선택, 아니면 리셋
  useEffect(() => {
    if (pathname?.includes('/company/government-programs')) {
      setSelectedCompanyMenu('정부지원사업')
    } else if (pathname === '/dashboard-group/company') {
      // 회사 대시보드 메인으로 돌아가면 서브메뉴 리셋
      setSelectedCompanyMenu(null)
    }
  }, [pathname])

  // Email sidebar resize effect (like ai-slides)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingEmail) return
      const newWidth = e.clientX - 64 // 64px is Level 1 sidebar width
      const clampedWidth = Math.min(Math.max(newWidth, 320), 600)
      setEmailSidebarWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizingEmail(false)
    }

    if (isResizingEmail) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingEmail, setEmailSidebarWidth])

  // Level 2 sidebar resize effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingLevel2) return
      const newWidth = e.clientX - 64 // 64px is Level 1 sidebar width
      // 최소 150px, 최대 화면의 50%
      const maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600
      const clampedWidth = Math.min(Math.max(newWidth, 150), maxWidth)
      setLevel2Width(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizingLevel2(false)
    }

    if (isResizingLevel2) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingLevel2, setLevel2Width])


  // Fetch email accounts when on email page
  useEffect(() => {
    if (pathname?.startsWith('/dashboard-group/email')) {
      const fetchEmailAccounts = async () => {
        try {
          const res = await fetch('/api/email/accounts')
          if (res.ok) {
            const data = await res.json()
            setEmailAccounts(data)
            if (data.length > 0 && !selectedEmailAccount) {
              setSelectedEmailAccount(data[0])
            }
          }
        } catch (error) {
          console.error('Failed to fetch email accounts:', error)
        }
      }
      fetchEmailAccounts()
    }
  }, [pathname, selectedEmailAccount])

  // Fetch emails when account is selected
  useEffect(() => {
    if (selectedEmailAccount && pathname?.startsWith('/dashboard-group/email')) {
      const fetchEmails = async () => {
        try {
          const res = await fetch(`/api/email/messages?account_id=${selectedEmailAccount.id}`)
          if (res.ok) {
            const data = await res.json()
            setAllEmails(data)
          }
        } catch (error) {
          console.error('Failed to fetch emails:', error)
        }
      }
      fetchEmails()
    }
  }, [selectedEmailAccount, pathname])

  // Sync emails
  const handleSyncEmails = async () => {
    if (!selectedEmailAccount) return
    setIsSyncingEmail(true)
    try {
      await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selectedEmailAccount.id }),
      })
      const res = await fetch(`/api/email/messages?account_id=${selectedEmailAccount.id}`)
      if (res.ok) {
        setAllEmails(await res.json())
      }
    } catch (error) {
      console.error('Failed to sync emails:', error)
    } finally {
      setIsSyncingEmail(false)
    }
  }

  // Handle folder change
  const handleEmailFolderChange = (folder: typeof currentEmailFolder) => {
    setCurrentEmailFolder(folder)
    const url = new URL(window.location.href)
    if (folder === 'inbox') {
      url.searchParams.delete('folder')
    } else {
      url.searchParams.set('folder', folder)
    }
    router.push(url.pathname + url.search)
  }

  // Email sidebar resize handler
  const handleEmailResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizingEmail(true)
  }, [])

  // pathname에 따라 현재 카테고리 계산
  // 🔥 캘린더/이메일은 이제 워크스페이스 하위 메뉴로 이동됨
  const currentCategory = (() => {
    if (pathname.startsWith('/dashboard-group/mypage')) return 'mypage'
    if (pathname.startsWith('/dashboard-group/company') ||
      pathname.startsWith('/dashboard-group/hr') ||
      pathname.startsWith('/dashboard-group/sales') ||
      pathname.startsWith('/dashboard-group/finance') ||
      pathname.startsWith('/dashboard-group/tax') ||
      pathname.startsWith('/dashboard-group/payroll') ||
      pathname.startsWith('/dashboard-group/expense') ||
      pathname.startsWith('/dashboard-group/erp')) return 'company'
    if (pathname.startsWith('/dashboard-group/project')) return 'workspace'
    // 🔥 파일 → 워크스페이스
    if (pathname.startsWith('/dashboard-group/files')) return 'workspace'
    // 🔥 캘린더 → 워크스페이스
    if (pathname.startsWith('/dashboard-group/calendar')) return 'workspace'
    // 🔥 이메일 → 워크스페이스
    if (pathname.startsWith('/dashboard-group/email')) return 'workspace'
    if (pathname.startsWith('/dashboard-group/messenger')) return 'messenger'
    if (pathname.startsWith('/dashboard-group/team')) return 'team'
    if (pathname.startsWith('/dashboard-group/agents') ||
      pathname.startsWith('/dashboard-group/workflows') ||
      pathname.startsWith('/agent-builder')) return 'agents'
    if (pathname.startsWith('/dashboard-group/ai-coding')) return 'ai-coding'
    if (pathname.startsWith('/dashboard-group/neurons')) return 'neurons'
    if (pathname.startsWith('/dashboard-group/works')) {
      return 'home'
    }
    // 🔥 앱 → 홈
    if (pathname.startsWith('/dashboard-group/apps') || pathname.includes('/tools/')) return 'home'
    if (pathname.startsWith('/dashboard-group/kpis')) return 'workspace'
    if (pathname.startsWith('/dashboard-group/gantt')) return 'workspace'
    if (pathname.startsWith('/dashboard-group/task-hub')) return 'workspace'
    // 🔥 /dashboard-group (정확히 일치)은 워크스페이스 대시보드
    if (pathname === '/dashboard-group') return 'workspace'
    return activeCategory || 'home'
  })()

  // activeCategory 동기화
  useEffect(() => {
    if (currentCategory !== activeCategory) {
      setActiveCategory(currentCategory)
    }
  }, [currentCategory, activeCategory, setActiveCategory])

  // 메뉴 경로 prefetch (페이지 JS 번들 미리 로드)
  useEffect(() => {
    const paths = [
      '/dashboard-group',
      '/dashboard-group/company',
      '/dashboard-group/company/government-programs',
      '/dashboard-group/mypage',
      '/dashboard-group/tasks',
      '/dashboard-group/workflows',
      '/dashboard-group/reports',
      '/dashboard-group/team',
      '/dashboard-group/messenger',
      '/dashboard-group/agents',
      '/dashboard-group/agents/create',
      '/dashboard-group/ai-coding',
      '/dashboard-group/neurons',
      '/dashboard-group/works',
      '/dashboard-group/calendar',
    ]
    paths.forEach(path => router.prefetch(path))
  }, [router])

  // 페이지 전환 완료 시 로딩 상태 초기화
  useEffect(() => {
    if (!isPending) {
      setPendingCategoryId(null)
    }
  }, [isPending])

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const isDark = mounted ? resolvedTheme === 'dark' : true
  const isVC = user?.role === 'INVESTOR'
  const navCategories = isVC ? investorCategories : categories

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearAuth()
    router.push('/auth-group/login')
  }

  const handleTeamCreate = async (teamData: TeamFormData) => {
    setIsCreatingTeam(true)
    const result = await createTeam({
      name: teamData.name,
      description: teamData.description,
      industry: teamData.industry,
    })
    setIsCreatingTeam(false)
    if (result) {
      setIsTeamModalOpen(false)
      router.push('/dashboard-group/team')
    } else {
      alert('팀 생성에 실패했습니다.')
    }
  }

  const activeItems = navCategories.find(cat => cat.id === currentCategory)?.items || []
  const isCompanyMenu = currentCategory === 'company'

  const isDashboardRoot = pathname === '/dashboard-group'

  // Hydration 에러 방지: 클라이언트 마운트 전에는 렌더링하지 않음
  if (!mounted) {
    return <div className="flex fixed left-0 top-12 z-50 w-16" style={{ height: 'calc(100vh - 48px)' }} />
  }

  return (
    <div className="flex fixed left-0 top-12 z-50 transition-all duration-300" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Level 1: 아이콘 사이드바 */}
      <motion.aside
        className={cn(
          'w-16 h-full flex flex-col items-center py-4 border-r transition-colors duration-300 z-20',
          isDashboardRoot
            ? (isDark
              ? 'bg-black/20 backdrop-blur-xl border-white/10'
              : 'bg-white/60 backdrop-blur-xl border-zinc-200/50')
            : isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        {/* Logo */}
        <Logo collapsed className="mb-6" />

        {/* Category Icons */}
        <nav className="flex-1 flex flex-col items-center gap-2">
          {navCategories.map((category) => {
            const isActive = currentCategory === category.id
            return (
              <button
                key={category.id}
                onClick={() => {
                  // 이동할 경로 결정
                  let targetPath = ''
                  if (category.id === 'home') {
                    targetPath = '/dashboard-group/works'
                  } else if (category.id === 'company') {
                    targetPath = '/dashboard-group/company'
                  } else if (category.id === 'workspace') {
                    targetPath = '/dashboard-group'
                  } else if (category.id === 'team') {
                    targetPath = '/dashboard-group/team'
                  } else if (category.id === 'calendar') {
                    targetPath = '/dashboard-group/calendar'
                  } else if (category.id === 'ai-coding') {
                    targetPath = '/dashboard-group/ai-coding'
                  } else if (category.id === 'messenger') {
                    targetPath = '/dashboard-group/messenger'
                  } else {
                    const firstItem = category.items.find(item => item.href && !item.href.startsWith('#'))
                    targetPath = firstItem?.href || ''
                  }

                  // 즉시 UI 반응: 사이드바 열기 및 카테고리 선택
                  setActiveCategory(category.id)
                  setSelectedCompanyMenu(null)
                  setSidebarOpen(true)

                  // 페이지 이동 (startTransition으로 감싸서 블로킹 없이 처리)
                  if (targetPath && pathname !== targetPath) {
                    setPendingCategoryId(category.id)
                    startTransition(() => {
                      router.push(targetPath)
                    })
                  }
                }}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
                  isActive
                    ? 'bg-accent text-white shadow-lg shadow-accent/25'
                    : isDashboardRoot
                      ? (isDark
                        ? 'text-white/70 hover:bg-white/10 hover:text-white'
                        : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900')
                      : isDark
                        ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                        : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
                )}
              >
                {/* 로딩 인디케이터 - 클릭한 카테고리에 표시 */}
                {isPending && pendingCategoryId === category.id ? (
                  <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : (
                  <category.icon className="w-5 h-5" />
                )}
                {/* Tooltip */}
                <div className={cn(
                  'absolute left-full ml-2 px-2 py-1 text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50',
                  isDark || isDashboardRoot
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
          <ThemeDropdown
            align="left-start"
            trigger={
              <div
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
                  isDark
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
              </div>
            }
          />

          <button
            onClick={handleLogout}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
              isDark
                ? 'text-zinc-500 hover:bg-zinc-800 hover:text-red-400'
                : 'text-zinc-500 hover:bg-zinc-200 hover:text-red-500'
            )}
          >
            <LogOut className="w-5 h-5 rotate-180" />
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

      {/* 사이드바 펼치기 버튼 - 접혀있을 때 아이콘바 오른쪽 경계 중앙에 표시 */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 rounded-full flex items-center justify-center z-30 transition-all',
            isDark
              ? 'bg-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-600'
              : 'bg-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-300'
          )}
          title="메뉴 펼치기"
        >
          <ChevronRight className="w-2.5 h-2.5" />
        </button>
      )}

      {!pathname?.includes('/works/new') && (
        <AnimatePresence>
          {/* AI Coding Collapsed Toggle Button */}
          {sidebarOpen && currentCategory === 'ai-coding' && pathname?.includes('/ai-coding') && level2Collapsed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 32, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'h-full border-r flex items-start justify-center pt-3',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              <button
                onClick={toggleLevel2}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
                )}
                title="파일 트리 펼치기"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* AI Coding File Tree Panel */}
          {sidebarOpen && currentCategory === 'ai-coding' && pathname?.includes('/ai-coding') && !level2Collapsed && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: level2Width, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: isResizingLevel2 ? 0 : 0.15 }}
              className={cn(
                'h-full border-r overflow-hidden relative flex flex-col',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
              style={{ width: level2Width }}
            >
              {/* 커서 스타일 상단 아이콘 툴바 */}
              <div className={cn(
                'h-10 flex items-center px-1 gap-1 border-b flex-shrink-0',
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              )}>
                {/* 고정된 툴바 아이템들 */}
                {toolbarMenuItems.filter(item => pinnedToolbarItems.has(item.id)).slice(0, 4).map((item) => {
                  const IconComponent = item.icon
                  const isActive = activeToolbarItem === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveToolbarItem(item.id)}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
                        isActive
                          ? isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-200 text-zinc-900"
                          : isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                      )}
                      title={`${item.name} ${item.shortcut}`}
                    >
                      <IconComponent className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  )
                })}
                {/* 더보기 드롭다운 */}
                <div className="relative">
                  <button
                    onClick={() => setIsToolbarMenuOpen(!isToolbarMenuOpen)}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      isToolbarMenuOpen
                        ? isDark ? "bg-zinc-700 text-zinc-100" : "bg-zinc-200 text-zinc-900"
                        : isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                    )}
                    title="더보기"
                  >
                    {isToolbarMenuOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* 드롭다운 메뉴 */}
                  <AnimatePresence>
                    {isToolbarMenuOpen && (
                      <>
                        {/* 오버레이 */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsToolbarMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.15 }}
                          className={cn(
                            'absolute left-0 top-full mt-1 w-64 rounded-lg border shadow-xl z-50 overflow-hidden',
                            isDark
                              ? 'bg-zinc-900 border-zinc-700'
                              : 'bg-white border-zinc-200'
                          )}
                        >
                          <div className="py-1 max-h-80 overflow-y-auto scrollbar-thin">
                            {toolbarMenuItems.map((item) => {
                              const IconComponent = item.icon
                              const isPinned = pinnedToolbarItems.has(item.id)
                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    'flex items-center gap-3 px-3 py-2 cursor-pointer group',
                                    isDark
                                      ? 'hover:bg-zinc-800'
                                      : 'hover:bg-zinc-100'
                                  )}
                                  onClick={() => {
                                    // 아이템 선택 시 동작 (추후 확장 가능)
                                  }}
                                >
                                  <IconComponent className={cn(
                                    'w-4 h-4 flex-shrink-0',
                                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                                  )} />
                                  <span className={cn(
                                    'flex-1 text-sm',
                                    isDark ? 'text-zinc-200' : 'text-zinc-700'
                                  )}>
                                    {item.name}
                                  </span>
                                  {item.shortcut && (
                                    <span className={cn(
                                      'text-xs',
                                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                                    )}>
                                      {item.shortcut}
                                    </span>
                                  )}
                                  {/* 핀 버튼 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      togglePinnedItem(item.id)
                                    }}
                                    className={cn(
                                      'p-1 rounded transition-colors',
                                      isPinned
                                        ? isDark ? 'text-accent' : 'text-accent'
                                        : isDark
                                          ? 'text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-zinc-300'
                                          : 'text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-600'
                                    )}
                                    title={isPinned ? '고정 해제' : '툴바에 고정'}
                                  >
                                    <Pin className={cn(
                                      'w-3.5 h-3.5',
                                      isPinned && 'fill-current'
                                    )} />
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* 패널 접기 버튼 */}
                <button
                  onClick={toggleLevel2}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                  )}
                  title="파일 트리 접기"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* FileTreePanel / GitPanel - 툴바 선택에 따라 전환 */}
              <div className="flex-1 overflow-hidden min-w-0" style={{ width: level2Width }}>
                {activeToolbarItem === 'git' ? (
                  <GitPanel />
                ) : activeToolbarItem === 'search' ? (
                  <SearchPanel isDark={isDark} />

                ) : activeToolbarItem === 'extensions' ? (
                  <div className={cn("p-4 text-sm", isDark ? "text-zinc-400" : "text-zinc-500")}>
                    확장 기능 준비 중...
                  </div>
                ) : (
                  <FileTreePanel mapId={neuralMapId} />
                )}
              </div>

              {/* 리사이즈 핸들 */}
              <div
                className="absolute top-0 right-0 w-2 h-full cursor-col-resize transition-colors z-10"
                style={{
                  backgroundColor: isResizingHover ? `${accentColor}80` : 'transparent'
                }}
                onMouseEnter={() => setIsResizingHover(true)}
                onMouseLeave={() => setIsResizingHover(false)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizingLevel2(true)
                }}
              />
            </motion.aside>
          )}

          {/* Regular menus (not neurons page, not ai-coding page) */}
          {sidebarOpen && activeItems.length > 0 && currentCategory !== 'neurons' && !(currentCategory === 'ai-coding' && pathname?.includes('/ai-coding')) && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'h-full overflow-hidden bg-white dark:bg-zinc-950 relative border-r',
                isDashboardRoot
                  ? (isDark ? 'border-white/10' : 'border-zinc-200/50')
                  : isDark ? 'border-zinc-800' : 'border-zinc-200'
              )}
            >
              {/* 사이드바 접기 버튼 - 오른쪽 경계 중앙 */}
              <button
                onClick={toggleSidebar}
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 rounded-full flex items-center justify-center z-30 transition-all',
                  isDark
                    ? 'bg-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-600'
                    : 'bg-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-300'
                )}
                title="메뉴 접기"
              >
                <ChevronRight className="w-2.5 h-2.5 rotate-180" />
              </button>
              <div className="h-full flex flex-col" style={{ width: 240 }}>
                {/* Category Header */}
                <div className={cn(
                  'h-16 flex items-center px-4 border-b flex-shrink-0',
                  isDark ? 'border-zinc-800' : 'border-zinc-200'
                )}>
                  {currentCategory === 'apps' ? (
                    <div className="flex items-center gap-2">
                      <h2 className={cn(
                        'text-lg font-bold',
                        isDark ? 'text-zinc-100' : 'text-zinc-900'
                      )}>
                        Apps
                      </h2>
                    </div>
                  ) : pathname.startsWith('/dashboard-group/works') ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push('/dashboard-group')}
                        className={cn(
                          "p-1 rounded-md transition-colors",
                          isDark ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100" : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
                        )}
                      >
                        <ChevronRight className="w-5 h-5 rotate-180" />
                      </button>
                      <h2 className={cn(
                        'text-lg font-bold',
                        isDark ? 'text-zinc-100' : 'text-zinc-900'
                      )}>
                        Works
                      </h2>
                    </div>
                  ) : (
                    <h2 className={cn(
                      'text-sm font-semibold',
                      isDark ? 'text-zinc-100' : 'text-zinc-900'
                    )}>
                      {navCategories.find(c => c.id === currentCategory)?.name}
                    </h2>
                  )}
                </div>

                {/* Team Info (for non-VC users) */}
                {!isVC && currentTeam && !isCompanyMenu && (
                  <div className={cn(
                    'px-3 py-3 border-b flex-shrink-0',
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

                {/* Work Create Button */}
                {pathname.startsWith('/dashboard-group/works') && (
                  <div className="px-3 py-3 flex-shrink-0">
                    <button
                      onClick={() => setIsWorkModalOpen(true)}
                      className="w-full py-2.5 px-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>새 대화</span>
                    </button>
                  </div>
                )}

                {/* Sub Navigation */}
                <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
                  {isCompanyMenu ? (
                    // 회사 메뉴 - 드릴다운 네비게이션
                    <AnimatePresence mode="wait">
                      {selectedCompanyMenu === null ? (
                        // 메인 카드 그리드 뷰
                        <motion.div
                          key="card-grid"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="grid grid-cols-2 gap-2"
                        >
                          {activeItems.map((item, index) => (
                            <motion.div
                              key={item.name}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 }}
                            >
                              <TopLevelCardMenu
                                item={item}
                                isDark={isDark}
                                isExpanded={false}
                                onToggle={() => setSelectedCompanyMenu(item.name)}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      ) : (
                        // 선택된 메뉴의 하위 메뉴 뷰
                        <motion.div
                          key={`submenu-${selectedCompanyMenu}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* 뒤로가기 버튼 */}
                          <button
                            onClick={() => {
                              setSelectedCompanyMenu(null)
                              router.push('/dashboard-group/company')
                            }}
                            className={cn(
                              'flex items-center gap-2 w-full px-2 py-2 mb-3 rounded-lg text-sm font-medium transition-colors',
                              isDark
                                ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                            )}
                          >
                            <ChevronRight className="w-4 h-4 rotate-180" />
                            <span>전체 메뉴</span>
                          </button>

                          {/* 현재 메뉴 타이틀 */}
                          {(() => {
                            const selectedItem = activeItems.find(item => item.name === selectedCompanyMenu)
                            const IconComponent = selectedItem?.icon
                            return (
                              <div className={cn(
                                'flex items-center gap-2 px-2 py-2 mb-2 rounded-lg',
                                isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
                              )}>
                                {IconComponent && (
                                  <IconComponent className={cn(
                                    'w-4 h-4',
                                    isDark ? 'text-zinc-300' : 'text-zinc-700'
                                  )} />
                                )}
                                <span className={cn(
                                  'text-sm font-semibold',
                                  isDark ? 'text-zinc-200' : 'text-zinc-800'
                                )}>
                                  {selectedCompanyMenu}
                                </span>
                              </div>
                            )
                          })()}

                          {/* 하위 메뉴 목록 */}
                          <div className="space-y-0.5">
                            {activeItems
                              .find(item => item.name === selectedCompanyMenu)
                              ?.children?.map((child) => (
                                <NestedMenuItemComponent
                                  key={child.name}
                                  item={child}
                                  depth={0}
                                  isDark={isDark}
                                  pathname={pathname}
                                  expandedItems={expandedItems}
                                  toggleExpand={toggleExpand}
                                />
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    // 일반 메뉴 - 중첩 메뉴 지원
                    activeItems.map((item, index) => {
                      const hasChildren = item.children && item.children.length > 0
                      // 정확한 매칭: 쿼리 파라미터만 허용하고 하위 경로는 제외
                      // 자유채팅은 mode 파라미터가 없을 때만 active
                      const isMessengerFreeChat = item.href === '/dashboard-group/messenger' && item.name === '자유채팅'
                      const messengerMode = searchParams.get('mode')
                      const isActive = item.href && (
                        isMessengerFreeChat
                          ? pathname === item.href && !messengerMode
                          : (pathname === item.href || pathname.startsWith(item.href + '?'))
                      )
                      const IconComponent = item.icon
                      const isExpanded = expandedItems.has(item.name)

                      if (hasChildren) {
                        return (
                          <motion.div
                            key={item.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <button
                              onClick={() => toggleExpand(item.name)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                isDark
                                  ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                              )}
                            >
                              {IconComponent && (
                                <IconComponent className="w-4 h-4 flex-shrink-0" />
                              )}
                              <span className="flex-1 text-left">{item.name}</span>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden pl-4 space-y-0.5"
                                >
                                  {item.children!.map((child) => {
                                    // 메신저 하위 메뉴의 active 상태는 URL 파라미터로 체크
                                    let childActive = false
                                    if (child.href) {
                                      const childUrl = new URL(child.href, 'http://localhost')
                                      const childPath = childUrl.pathname
                                      const childMode = childUrl.searchParams.get('mode')
                                      const childStatus = childUrl.searchParams.get('status')
                                      const currentMode = searchParams.get('mode')
                                      const currentStatus = searchParams.get('status')

                                      if (pathname === childPath) {
                                        // 메신저 하위 메뉴: mode와 status 파라미터 매칭
                                        if (childMode || childStatus) {
                                          childActive = childMode === currentMode && childStatus === currentStatus
                                        } else {
                                          childActive = !currentMode && !currentStatus
                                        }
                                      }
                                    }
                                    const ChildIcon = child.icon
                                    return (
                                      <button
                                        key={child.name}
                                        onClick={() => {
                                          if (child.href && child.href !== '#') {
                                            const href = child.href
                                            startTransition(() => {
                                              router.push(href)
                                            })
                                          }
                                        }}
                                        className={cn(
                                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 text-left',
                                          childActive
                                            ? 'bg-accent text-white'
                                            : isDark
                                              ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700',
                                          isPending && 'opacity-70'
                                        )}
                                      >
                                        {ChildIcon && (
                                          <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                        )}
                                        <span>{child.name}</span>
                                      </button>
                                    )
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )
                      }

                      // Handle "팀 생성" special case
                      if (item.href === '#create-team') {
                        return (
                          <motion.div
                            key={item.name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <button
                              onClick={() => setIsTeamModalOpen(true)}
                              className={cn(
                                'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-2 border-dashed',
                                isDark
                                  ? 'border-zinc-700 text-zinc-400 hover:border-accent hover:text-accent hover:bg-accent/10'
                                  : 'border-zinc-300 text-zinc-500 hover:border-accent hover:text-accent hover:bg-accent/10'
                              )}
                            >
                              {IconComponent && (
                                <IconComponent className="w-4 h-4 flex-shrink-0" />
                              )}
                              <span>{item.name}</span>
                            </button>
                          </motion.div>
                        )
                      }

                      return (
                        <motion.div
                          key={item.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <button
                            onClick={() => {
                              if (item.href === '#task-history') {
                                openTaskHistory()
                              } else if (item.href && item.href !== '#') {
                                const href = item.href
                                startTransition(() => {
                                  router.push(href)
                                })
                              }
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left',
                              isActive
                                ? 'bg-accent text-white shadow-md shadow-accent/20'
                                : isDark
                                  ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                              isPending && 'opacity-70'
                            )}
                          >
                            {IconComponent && (
                              <IconComponent className={cn(
                                'w-4 h-4 flex-shrink-0',
                                isActive ? 'text-white' : ''
                              )} />
                            )}
                            <span>{item.name}</span>
                          </button>
                        </motion.div>
                      )
                    })
                  )}
                </nav>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Team Create Modal */}
      <TeamCreateModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        onSubmit={handleTeamCreate}
        isLoading={isCreatingTeam}
      />

      <CreateWorkModal
        isOpen={isWorkModalOpen}
        onClose={() => setIsWorkModalOpen(false)}
      />

      {/* Global Task History Sidebar */}
      <TaskHistorySidebar
        isOpen={taskHistoryOpen}
        onClose={closeTaskHistory}
      />
    </div >
  )
}

// 🔥 검색 패널 컴포넌트
function SearchPanel({ isDark }: { isDark: boolean }) {
  const files = useNeuralMapStore((s) => s.files)
  const graph = useNeuralMapStore((s) => s.graph)
  const searchQuery = useNeuralMapStore((s) => s.searchQuery)
  const setSearchQuery = useNeuralMapStore((s) => s.setSearchQuery)
  const setFocusNodeId = useNeuralMapStore((s) => s.setFocusNodeId)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

  const [selectedIndex, setSelectedIndex] = useState(0)

  // 검색 결과
  const suggestions = React.useMemo(() => {
    const query = searchQuery?.toLowerCase().trim() || ''
    if (!query || query.length < 1) return []

    const results: { type: 'file' | 'node'; name: string; path?: string; id: string; item: any }[] = []

    // 파일 검색
    files.forEach(f => {
      if (f.name.toLowerCase().includes(query) || f.path?.toLowerCase().includes(query)) {
        results.push({
          type: 'file',
          name: f.name,
          path: f.path,
          id: f.id,
          item: f
        })
      }
    })

    // 그래프 노드 검색
    graph?.nodes?.forEach(n => {
      if (n.title.toLowerCase().includes(query) || n.id.toLowerCase().includes(query)) {
        if (!results.some(r => r.id === n.id)) {
          results.push({
            type: 'node',
            name: n.title,
            id: n.id,
            item: n
          })
        }
      }
    })

    return results.slice(0, 20)
  }, [searchQuery, files, graph?.nodes])

  const handleSelect = (suggestion: typeof suggestions[0]) => {
    if (suggestion.type === 'file') {
      openCodePreview(suggestion.item)
    } else {
      setFocusNodeId(suggestion.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(suggestions[selectedIndex])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className={cn("p-3 border-b", isDark ? "border-zinc-800" : "border-zinc-200")}>
        <div className="relative">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", isDark ? "text-zinc-500" : "text-zinc-400")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="파일/노드 검색..."
            autoFocus
            className={cn(
              "no-focus-ring w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none",
              isDark
                ? "bg-zinc-800 border-zinc-700 text-zinc-200 placeholder-zinc-500"
                : "bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400"
            )}
          />
        </div>
      </div>

      {/* 검색 결과 */}
      <div className="flex-1 overflow-y-auto">
        {searchQuery.length > 0 && suggestions.length === 0 ? (
          <div className={cn("p-4 text-sm text-center", isDark ? "text-zinc-500" : "text-zinc-400")}>
            검색 결과가 없습니다
          </div>
        ) : suggestions.length > 0 ? (
          <div className="py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                onClick={() => handleSelect(suggestion)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  index === selectedIndex
                    ? isDark ? "bg-zinc-800 text-white" : "bg-accent/10 text-accent"
                    : isDark ? "hover:bg-zinc-800/50 text-zinc-300" : "hover:bg-zinc-50 text-zinc-700"
                )}
              >
                {suggestion.type === 'file' ? (
                  <FileText className="w-4 h-4 flex-shrink-0 text-accent" />
                ) : (
                  <Folder className="w-4 h-4 flex-shrink-0 text-amber-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{suggestion.name}</div>
                  {suggestion.path && (
                    <div className={cn("truncate text-xs", isDark ? "text-zinc-500" : "text-zinc-400")}>
                      {suggestion.path}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={cn("p-4 text-sm", isDark ? "text-zinc-500" : "text-zinc-400")}>
            검색어를 입력하세요
          </div>
        )}
      </div>
    </div>
  )
}
