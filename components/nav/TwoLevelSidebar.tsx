'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { createClient } from '@/lib/supabase/client'
import { Logo } from '@/components/ui'
import { CgMenuGridO } from 'react-icons/cg'
import { BsPersonWorkspace } from 'react-icons/bs'
import { IoCalendarOutline } from 'react-icons/io5'
import { GoPerson } from 'react-icons/go'
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
  ChevronRight,
  ChevronDown,
  Target,
  FolderOpen,
  UserCog,
  Clock,
  Palmtree,
  FileSignature,
  GraduationCap,
  Receipt,
  CreditCard,
  Landmark,
  Calculator,
  Wallet,
  Car,
  ClipboardList,
} from 'lucide-react'

// 중첩 메뉴 아이템 타입
interface NestedMenuItem {
  name: string
  href?: string
  icon?: any
  children?: NestedMenuItem[]
}

interface Category {
  id: string
  name: string
  icon: any
  items: NestedMenuItem[]
}

// 회사 메뉴 구조
const companyMenuItems: NestedMenuItem[] = [
  {
    name: '기업 현황',
    icon: Building2,
    children: [
      {
        name: '회사개요',
        href: '/dashboard-group/company/overview',
        children: [
          { name: '기업명', href: '/dashboard-group/company/overview#name' },
          { name: '대표자', href: '/dashboard-group/company/overview#ceo' },
          { name: '설립일', href: '/dashboard-group/company/overview#founded' },
          { name: '소재지', href: '/dashboard-group/company/overview#location' },
          { name: '업태', href: '/dashboard-group/company/overview#business' },
          { name: '업종', href: '/dashboard-group/company/overview#industry' },
          { name: '사업자번호', href: '/dashboard-group/company/overview#bizno' },
          { name: '연락처', href: '/dashboard-group/company/overview#contact' },
        ]
      },
      { name: '비전, 목표·OKR', href: '/dashboard-group/company/vision', icon: Target },
      { name: '팀원 현황', href: '/dashboard-group/company/members', icon: Users },
      { name: '문서함', href: '/dashboard-group/company/documents', icon: FolderOpen },
    ]
  },
  {
    name: '인사관리',
    icon: UserCog,
    children: [
      {
        name: '인사',
        children: [
          {
            name: '인사관리',
            children: [
              { name: '사원정보관리', href: '/dashboard-group/hr/employees' },
              { name: '계정상태관리', href: '/dashboard-group/hr/accounts' },
              { name: '인사발령', href: '/dashboard-group/hr/appointments' },
            ]
          },
          {
            name: '팀관리',
            children: [
              { name: '팀설계', href: '/dashboard-group/hr/team-design' },
              { name: '직위체계', href: '/dashboard-group/hr/positions' },
              { name: '팀원일괄등록', href: '/dashboard-group/hr/bulk-register' },
              { name: '팀원삭제관리', href: '/dashboard-group/hr/member-delete' },
            ]
          },
          {
            name: '증명서발급',
            children: [
              { name: '증명발급현황', href: '/dashboard-group/hr/certificates' },
            ]
          },
        ]
      },
      {
        name: '근태',
        icon: Clock,
        children: [
          {
            name: '근태관리',
            children: [
              { name: '근무그룹 관리', href: '/dashboard-group/hr/work-groups' },
              { name: '보상휴가 관리', href: '/dashboard-group/hr/comp-leave' },
              { name: '휴일대체 관리', href: '/dashboard-group/hr/holiday-sub' },
            ]
          },
          {
            name: '근태마감',
            children: [
              { name: '출퇴근이상자 관리', href: '/dashboard-group/hr/attendance-issues' },
              { name: '근태마감', href: '/dashboard-group/hr/attendance-close' },
            ]
          },
        ]
      },
      {
        name: '휴가',
        icon: Palmtree,
        children: [
          {
            name: '연차관리',
            children: [
              { name: '연차정책 관리', href: '/dashboard-group/hr/leave-policy' },
              { name: '보상휴가 관리', href: '/dashboard-group/hr/comp-vacation' },
              { name: '휴일대체 관리', href: '/dashboard-group/hr/holiday-replace' },
            ]
          },
          {
            name: '연차촉진',
            children: [
              { name: '연차촉진 현황', href: '/dashboard-group/hr/leave-promotion' },
            ]
          },
        ]
      },
      {
        name: '고용전자계약',
        icon: FileSignature,
        children: [
          {
            name: '고용전자계약',
            children: [
              { name: '템플릿 관리', href: '/dashboard-group/hr/contract-templates' },
              { name: '계약 관리', href: '/dashboard-group/hr/contracts' },
            ]
          },
        ]
      },
      {
        name: '직원교육',
        icon: GraduationCap,
        children: [
          {
            name: '직원교육',
            children: [
              { name: '교육관리', href: '/dashboard-group/hr/training-manage' },
              { name: '교육현황', href: '/dashboard-group/hr/training-status' },
            ]
          },
        ]
      },
    ]
  },
  {
    name: '매출입관리',
    icon: Receipt,
    children: [
      {
        name: '매출입',
        children: [
          {
            name: '기초정보관리',
            children: [
              { name: '거래처', href: '/dashboard-group/sales/partners' },
              { name: '기초잔액등록', href: '/dashboard-group/sales/initial-balance' },
              { name: '프로젝트', href: '/dashboard-group/sales/projects' },
              { name: '데이터엑셀변환', href: '/dashboard-group/sales/excel-convert' },
            ]
          },
          {
            name: '매출관리',
            children: [
              { name: '전자세금계산서 발행', href: '/dashboard-group/sales/tax-invoice' },
              { name: '매출내역', href: '/dashboard-group/sales/sales-list' },
              { name: '거래명세서 작성', href: '/dashboard-group/sales/transaction-statement' },
            ]
          },
          {
            name: '매입관리',
            children: [
              { name: '매입내역', href: '/dashboard-group/sales/purchase-list' },
              { name: '간이영수증외', href: '/dashboard-group/sales/simple-receipt' },
            ]
          },
          {
            name: '매출입리포트',
            children: [
              { name: '매출처원장', href: '/dashboard-group/sales/sales-ledger' },
              { name: '매입처원장', href: '/dashboard-group/sales/purchase-ledger' },
              { name: '미수금현황', href: '/dashboard-group/sales/receivables' },
              { name: '미지급현황', href: '/dashboard-group/sales/payables' },
              { name: '간편손익', href: '/dashboard-group/sales/simple-pl' },
            ]
          },
          {
            name: '거래유형',
            children: [
              { name: '거래유형 설정', href: '/dashboard-group/sales/transaction-types' },
            ]
          },
          {
            name: '카드관리',
            children: [
              { name: '법인카드관리', href: '/dashboard-group/sales/corp-card' },
              { name: '개인카드관리', href: '/dashboard-group/sales/personal-card' },
            ]
          },
        ]
      },
      {
        name: '금융',
        icon: Landmark,
        children: [
          {
            name: '입출금관리',
            children: [
              { name: '통장입금(수납)', href: '/dashboard-group/finance/deposit' },
              { name: '통장출금(지급)', href: '/dashboard-group/finance/withdraw' },
              { name: '통장거래내역', href: '/dashboard-group/finance/transactions' },
            ]
          },
          {
            name: '이체',
            children: [
              { name: '이체대기', href: '/dashboard-group/finance/transfer-pending' },
              { name: '이체결과조회', href: '/dashboard-group/finance/transfer-result' },
            ]
          },
          {
            name: '기타금융관리',
            children: [
              { name: '현금출납장', href: '/dashboard-group/finance/cash-book' },
              { name: '어음대장', href: '/dashboard-group/finance/bills' },
              { name: '정기예적금', href: '/dashboard-group/finance/savings' },
              { name: '외화예금', href: '/dashboard-group/finance/forex' },
              { name: '은행대출금', href: '/dashboard-group/finance/loans' },
              { name: '펀드', href: '/dashboard-group/finance/funds' },
              { name: '환율조회', href: '/dashboard-group/finance/exchange-rate' },
            ]
          },
          {
            name: '금융리포트',
            children: [
              { name: '일일시재보고서', href: '/dashboard-group/finance/daily-report' },
              { name: '기간별시재보고', href: '/dashboard-group/finance/period-report' },
              { name: '입출금내역보고', href: '/dashboard-group/finance/io-report' },
              { name: '자금캘린더', href: '/dashboard-group/finance/fund-calendar' },
            ]
          },
          {
            name: '통장관리',
            children: [
              { name: '통장관리', href: '/dashboard-group/finance/accounts' },
            ]
          },
        ]
      },
      {
        name: '세무',
        icon: Calculator,
        children: [
          {
            name: '부가세',
            children: [
              { name: '부가세 납부관리', href: '/dashboard-group/tax/vat-payment' },
              { name: '부가세 납부환급이력', href: '/dashboard-group/tax/vat-history' },
              { name: '매입매출합계표', href: '/dashboard-group/tax/summary-table' },
              { name: '국세청자료대사', href: '/dashboard-group/tax/nts-reconcile' },
            ]
          },
          {
            name: '세금과공과',
            children: [
              { name: '세금과공과 관리', href: '/dashboard-group/tax/taxes-dues' },
            ]
          },
          {
            name: '세무자료 다운로드',
            children: [
              { name: '세무자료 다운로드', href: '/dashboard-group/tax/download' },
            ]
          },
        ]
      },
    ]
  },
  {
    name: '급여관리',
    icon: Wallet,
    children: [
      {
        name: '급여',
        children: [
          {
            name: '급여관리',
            children: [
              { name: '사원별 급여관리', href: '/dashboard-group/payroll/employee-salary' },
              { name: '근로시간관리', href: '/dashboard-group/payroll/work-hours' },
              { name: '급여대장(작성)', href: '/dashboard-group/payroll/salary-ledger' },
              { name: '상여대장(작성)', href: '/dashboard-group/payroll/bonus-ledger' },
            ]
          },
          {
            name: '사회보험',
            children: [
              { name: '신고대상조회', href: '/dashboard-group/payroll/insurance-report' },
              { name: '정산보험료', href: '/dashboard-group/payroll/insurance-settle' },
            ]
          },
          {
            name: '퇴직급여',
            children: [
              { name: '퇴직금대장(작성)', href: '/dashboard-group/payroll/severance-ledger' },
              { name: '퇴직금추계액', href: '/dashboard-group/payroll/severance-estimate' },
            ]
          },
          {
            name: '급여리포트',
            children: [
              { name: '인건비현황', href: '/dashboard-group/payroll/labor-cost' },
            ]
          },
        ]
      },
      {
        name: '일용직',
        children: [
          {
            name: '일용직관리',
            children: [
              { name: '일용직사원관리', href: '/dashboard-group/payroll/daily-workers' },
              { name: '일용직급여대장', href: '/dashboard-group/payroll/daily-salary' },
              { name: '일용근로지급명세서', href: '/dashboard-group/payroll/daily-statement' },
            ]
          },
        ]
      },
    ]
  },
  {
    name: '경비관리',
    icon: CreditCard,
    children: [
      {
        name: '경비',
        children: [
          {
            name: '경비관리',
            children: [
              { name: '경비청구현황', href: '/dashboard-group/expense/claims' },
              { name: '경비예산관리', href: '/dashboard-group/expense/budget' },
              { name: '경비예산운영자 설정', href: '/dashboard-group/expense/budget-admin' },
            ]
          },
          {
            name: '경비리포트',
            children: [
              { name: '경비사용현황', href: '/dashboard-group/expense/usage-report' },
            ]
          },
          {
            name: '경비 사용용도',
            children: [
              { name: '사용용도 설정', href: '/dashboard-group/expense/purpose-settings' },
            ]
          },
          {
            name: '카드관리',
            children: [
              { name: '법인카드관리', href: '/dashboard-group/expense/corp-card' },
              { name: '개인카드관리', href: '/dashboard-group/expense/personal-card' },
            ]
          },
        ]
      },
      {
        name: '차량운행일지',
        icon: Car,
        children: [
          {
            name: '차량관리',
            children: [
              { name: '차량관리', href: '/dashboard-group/expense/vehicles' },
            ]
          },
          {
            name: '운행일지관리',
            children: [
              { name: '차량운행일지', href: '/dashboard-group/expense/drive-log' },
            ]
          },
        ]
      },
    ]
  },
  {
    name: '리포트',
    icon: ClipboardList,
    children: [
      {
        name: '리포트',
        children: [
          {
            name: '주간리포트 관리',
            children: [
              { name: '주간리포트 설정', href: '/dashboard-group/reports/weekly-settings' },
            ]
          },
        ]
      },
    ]
  },
]

// 1단계: 카테고리 (아이콘만)
const categories: Category[] = [
  {
    id: 'menu',
    name: '메뉴',
    icon: CgMenuGridO,
    items: []
  },
  {
    id: 'company',
    name: '회사',
    icon: Building2,
    items: companyMenuItems
  },
  {
    id: 'home',
    name: '홈',
    icon: Home,
    items: [
      { name: '대시보드', href: '/dashboard-group', icon: LayoutDashboard },
    ]
  },
  {
    id: 'workspace',
    name: '워크스페이스',
    icon: BsPersonWorkspace,
    items: []
  },
  {
    id: 'calendar',
    name: '캘린더',
    icon: IoCalendarOutline,
    items: []
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
  {
    id: 'mypage',
    name: '마이페이지',
    icon: GoPerson,
    items: []
  },
]

const investorCategories: Category[] = [
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
  const IconComponent = item.icon
  const { accentColor } = useThemeStore()

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
          border: 'hover:border-blue-500 focus:border-blue-500',
          text: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
          bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/10',
          iconBg: 'group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20',
          activeBorder: 'border-blue-600 ring-1 ring-blue-600',
          activeText: 'text-blue-600 dark:text-blue-400',
          activeBg: 'bg-blue-50 dark:bg-blue-900/20',
          activeIconBg: 'bg-blue-100 dark:bg-blue-500/20'
        }
    }
  }

  const theme = getThemeClasses()

  return (
    <button
      onClick={onToggle}
      className={cn(
        'group w-full aspect-[4/5] rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-3',
        isDark
          ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'
          : 'bg-white border-zinc-200 hover:bg-zinc-50',
        theme.border,
        theme.bg,
        isExpanded && cn(theme.activeBorder, theme.activeBg)
      )}
    >
      <div className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
        isDark ? 'bg-zinc-800' : 'bg-zinc-100',
        theme.iconBg,
        isExpanded && theme.activeIconBg
      )}>
        {IconComponent && (
          <IconComponent
            strokeWidth={1.5}
            className={cn(
              'w-8 h-8 transition-colors', // 아이콘 크기 대폭 확대
              isDark ? 'text-zinc-400' : 'text-zinc-500',
              theme.text,
              isExpanded && theme.activeText
            )}
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span className={cn(
          'text-sm font-bold transition-colors', // 폰트 굵기 강화
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
            depth === 0 ? 'text-zinc-300 font-semibold' : 'text-zinc-400',
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

  // 링크 아이템
  return (
    <Link
      href={item.href || '#'}
      className={cn(
        'flex items-center gap-2 py-1.5 text-xs transition-all duration-200 rounded-md',
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

export function TwoLevelSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, currentTeam, logout: clearAuth } = useAuthStore()
  const { activeCategory, setActiveCategory } = useUIStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedCompanyMenu, setSelectedCompanyMenu] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // pathname에 따라 activeCategory 자동 설정
  useEffect(() => {
    // 회사 관련 경로 체크
    const companyPaths = ['/dashboard-group/company', '/dashboard-group/hr', '/dashboard-group/sales', '/dashboard-group/finance', '/dashboard-group/tax', '/dashboard-group/payroll', '/dashboard-group/expense', '/dashboard-group/reports']
    const isCompanyPath = companyPaths.some(p => pathname.startsWith(p))
    if (isCompanyPath) {
      setActiveCategory('company')
      return
    }

    const allCategories = user?.role === 'INVESTOR' ? investorCategories : categories
    for (const cat of allCategories) {
      const hasMatch = cat.items.some(item => {
        if (item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))) {
          return true
        }
        // 중첩 메뉴 체크
        const checkNested = (items: NestedMenuItem[]): boolean => {
          for (const i of items) {
            if (i.href && (pathname === i.href || pathname.startsWith(i.href + '/'))) {
              return true
            }
            if (i.children && checkNested(i.children)) {
              return true
            }
          }
          return false
        }
        return item.children ? checkNested(item.children) : false
      })
      if (hasMatch) {
        setActiveCategory(cat.id)
        break
      }
    }
  }, [pathname, user?.role, setActiveCategory])

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

  const activeItems = navCategories.find(cat => cat.id === activeCategory)?.items || []
  const isCompanyMenu = activeCategory === 'company'

  return (
    <div className="flex h-screen fixed left-0 top-0 z-40">
      {/* Level 1: 아이콘 사이드바 */}
      <motion.aside
        className={cn(
          'w-16 h-full flex flex-col items-center py-4 border-r',
          isDark
            ? 'border-zinc-800'
            : 'border-zinc-200'
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
                  setSelectedCompanyMenu(null) // 카테고리 변경 시 초기화
                  // 회사 메뉴 클릭 시 회사 대시보드로 이동
                  if (category.id === 'company') {
                    router.push('/dashboard-group/company')
                  } else if (category.id === 'home') {
                    router.push('/dashboard-group')
                  }
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
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'h-full border-r overflow-hidden',
              isDark
                ? 'border-zinc-800'
                : 'border-zinc-200'
            )}
          >
            <div className="h-full flex flex-col w-[240px]">
              {/* Category Header */}
              <div className={cn(
                'h-16 flex items-center px-4 border-b flex-shrink-0',
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
                          onClick={() => setSelectedCompanyMenu(null)}
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
                  // 일반 메뉴 - 플랫 구조
                  activeItems.map((item, index) => {
                    const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
                    const IconComponent = item.icon
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          href={item.href || '#'}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive
                              ? 'bg-accent text-white shadow-md shadow-accent/20'
                              : isDark
                                ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                          )}
                        >
                          {IconComponent && (
                            <IconComponent className={cn(
                              'w-4 h-4 flex-shrink-0',
                              isActive ? 'text-white' : ''
                            )} />
                          )}
                          <span>{item.name}</span>
                        </Link>
                      </motion.div>
                    )
                  })
                )}
              </nav>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
