'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
import type { EmailAccount, EmailMessage } from '@/types/email'
import { useTeamStore } from '@/stores/teamStore'
import { CgMenuGridO } from 'react-icons/cg'
import { BsPersonWorkspace } from 'react-icons/bs'
import { IoCalendarNumberOutline, IoRocketOutline } from 'react-icons/io5'
import { GoPerson, GoPeople } from 'react-icons/go'
import { TbBrandWechat } from 'react-icons/tb'
import { CiHardDrive } from 'react-icons/ci'
import { RxRocket } from 'react-icons/rx'
import { ShieldCheck } from 'lucide-react'
import {
  LayoutDashboard,
  ListTodo,
  GitCommit,
  Users,
  List,
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
  Home,
  Briefcase,
  PieChart,
  Zap,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  FolderOpen,
  Search,
  Folder,
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
  User,
  FolderKanban,
  Activity,
  Phone,
  Play,
  CheckCircle,
  Archive,
  Inbox,
  Send,
  ArrowRightFromLine,
  AlertCircle,
  Plus,
  CalendarDays,
  Star,
  Wrench,
  Package,
  Orbit,
  Files,
  GitBranch,
  Puzzle,
  ChevronUp,
  Bug,
  MonitorPlay,
  Share2,
  FileCode,
  Pin,
  Container,
  Github,
  LayoutGrid,
  GanttChart,
  BookmarkCheck,
  Bell,
  FileCheck,
  Upload,
  HeartHandshake,
  DollarSign,
  Trophy,
  Filter,
  Milestone,
  AlertTriangle,
  FolderArchive,
  FileSpreadsheet,
  BadgeCheck,
  ClipboardCheck,
  ScrollText,
  Banknote,
  Award,
  XCircle,
  BookOpen,
} from 'lucide-react'
import { SiPython } from 'react-icons/si'


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
    href: '/dashboard-group/erp',
    children: [
      { name: 'ERP 대시보드', href: '/dashboard-group/erp', icon: PieChart },
      { name: '회사정보 관리', href: '/dashboard-group/erp/company', icon: Building2 },
      { name: '비전, 목표·OKR', href: '/dashboard-group/company/vision', icon: Target },
      { name: '조직도', href: '/dashboard-group/company/org-chart', icon: Users },
      { name: '팀원 현황', href: '/dashboard-group/company/members', icon: Users },
      { name: '문서함', href: '/dashboard-group/company/documents', icon: FolderOpen },
    ]
  },
  {
    name: '인사관리',
    icon: UserCog,
    href: '/dashboard-group/hr',
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
              { name: '출퇴근 현황', href: '/dashboard-group/hr/attendance' },
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
      {
        name: '전자결재',
        icon: FileText,
        children: [
          {
            name: '전자결재',
            children: [
              { name: '결재함', href: '/dashboard-group/hr/approval' },
            ]
          },
        ]
      },
    ]
  },
  {
    name: '매출입관리',
    icon: Receipt,
    href: '/dashboard-group/sales',
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
    href: '/dashboard-group/payroll',
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
    href: '/dashboard-group/expenses',
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
    href: '/dashboard-group/reports',
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
  {
    name: '정부지원사업',
    icon: RxRocket,
    href: '/dashboard-group/company/government-programs',
    children: [
      // 0) 대시보드
      {
        name: '대시보드',
        href: '/dashboard-group/company/government-programs',
        icon: LayoutDashboard
      },
      { name: '추천 공고', href: '/dashboard-group/company/government-programs/recommended', icon: Sparkles },
      { name: '북마크', href: '/dashboard-group/company/government-programs/bookmarks', icon: BookmarkCheck },
      { name: '알림 설정', href: '/dashboard-group/company/government-programs/alerts', icon: Bell },
      // 2) 신청 준비
      {
        name: '신청 준비',
        icon: FileCheck,
        children: [
          { name: '준비 체크리스트', href: '/dashboard-group/company/government-programs/checklist', icon: ClipboardCheck },
          { name: '구비 서류', href: '/dashboard-group/company/government-programs/documents', icon: FolderOpen },
          { name: 'AI 자격진단', href: '/dashboard-group/company/government-programs/ai-diagnosis', icon: Bot },
          { name: '회사 프로필', href: '/dashboard-group/company/government-programs/profile', icon: Building2 },
          { name: '사업계획서 빌더', href: '/dashboard-group/company/government-programs/business-plan/builder', icon: FileText },
        ]
      },
      // 3) 제출/접수
      {
        name: '제출/접수',
        icon: Upload,
        children: [
          { name: '신청서 작성', href: '/dashboard-group/company/government-programs/application', icon: FileSignature },
          { name: '제출 이력', href: '/dashboard-group/company/government-programs/submissions', icon: ScrollText },
        ]
      },
      // 4) 선정/협약
      {
        name: '선정/협약',
        icon: HeartHandshake,
        children: [
          { name: '선정 결과', href: '/dashboard-group/company/government-programs/results', icon: BadgeCheck },
          { name: '협약서 관리', href: '/dashboard-group/company/government-programs/contracts', icon: FileSpreadsheet },
        ]
      },
      // 5) 수행 관리
      {
        name: '수행 관리',
        icon: GanttChart,
        children: [
          { name: '마일스톤', href: '/dashboard-group/company/government-programs/milestones', icon: Milestone },
          { name: '진행 현황', href: '/dashboard-group/company/government-programs/progress', icon: Activity },
          { name: '위험 관리', href: '/dashboard-group/company/government-programs/risks', icon: AlertTriangle },
          { name: '자료 보관함', href: '/dashboard-group/company/government-programs/archive', icon: FolderArchive },
        ]
      },
      // 6) 예산/보고
      {
        name: '예산/보고',
        icon: Banknote,
        children: [
          { name: '예산 현황', href: '/dashboard-group/company/government-programs/budget', icon: PieChart },
          { name: '지출 내역', href: '/dashboard-group/company/government-programs/expenses', icon: DollarSign },
          { name: '보고서 관리', href: '/dashboard-group/company/government-programs/reports', icon: FileSpreadsheet },
        ]
      },
      // 7) 성과/자산
      {
        name: '성과/자산',
        icon: Award,
        children: [
          { name: '특허/IP', href: '/dashboard-group/company/government-programs/patents', icon: ShieldCheck },
          { name: '논문/발표', href: '/dashboard-group/company/government-programs/publications', icon: BookOpen },
          { name: '참여 연구원', href: '/dashboard-group/company/government-programs/researchers', icon: Users },
        ]
      },
      // 8) 빠른 보기
      {
        name: '빠른 보기',
        icon: Filter,
        children: [
          { name: '지원한 공고', href: '/dashboard-group/company/government-programs/applied', icon: Send },
          { name: '선정된 공고', href: '/dashboard-group/company/government-programs/selected', icon: Trophy },
          { name: '미선정 공고', href: '/dashboard-group/company/government-programs/rejected', icon: XCircle },
        ]
      },
    ]
  },
]

// 1단계: 카테고리 (아이콘만)
const categories: Category[] = [
  // 회사 - 클릭 시 사이드바 열림 + 회사 페이지 이동
  {
    id: 'company',
    name: '회사',
    icon: Building2,
    items: companyMenuItems
  },
  // 워크스페이스 (마이 대시보드) - 요약만
  {
    id: 'workspace',
    name: '워크스페이스',
    icon: BsPersonWorkspace,
    items: [
      { name: '대시보드', href: '/dashboard-group', icon: LayoutDashboard },
      { name: 'Works', href: '/dashboard-group/works', icon: Briefcase },
      {
        name: '빠른 액션',
        icon: Zap,
        children: [
          { name: '프로젝트 생성', href: '/dashboard-group/project', icon: Plus },
          { name: '업무 생성', href: '/dashboard-group/task-hub?action=create', icon: Plus },
          { name: '에이전트 호출', href: '/dashboard-group/agents', icon: Bot },
        ]
      },
      {
        name: '프로젝트',
        icon: IoRocketOutline,
        children: [
          { name: '전체 프로젝트', href: '/dashboard-group/project', icon: FolderKanban },
          { name: '진행 중', href: '/dashboard-group/project?status=active', icon: Play },
          { name: '완료', href: '/dashboard-group/project?status=completed', icon: CheckCircle },
          { name: '보류', href: '/dashboard-group/project?status=on_hold', icon: Archive },
        ]
      },
      { name: '태스크 허브', href: '/dashboard-group/task-hub', icon: LayoutGrid },
      { name: '오늘 일정', href: '/dashboard-group/calendar?view=today', icon: CalendarDays },
      { name: '간트차트', href: '/dashboard-group/gantt', icon: GanttChart },
      { name: 'KPI 관리', href: '/dashboard-group/kpis', icon: Target },
    ]
  },
  // 앱 (Apps) - 도구 모음
  {
    id: 'apps',
    name: 'Apps',
    icon: CgMenuGridO,
    items: [
      { name: '모든 앱', href: '/dashboard-group/apps', icon: CgMenuGridO },
      {
        name: '업무',
        icon: Briefcase,
        children: [
          { name: 'AI 실시간 요약', href: '/dashboard-group/apps/ai-summary', icon: Sparkles },
          { name: '유튜브 영상 요약', href: '/dashboard-group/apps/ai-summary', icon: FileText },
          { name: 'PPT 초안', href: '/dashboard-group/apps/ppt-draft', icon: FileText },
          { name: '기사 초안', href: '/dashboard-group/apps/article-draft', icon: FileText },
          { name: '상세페이지', href: '/dashboard-group/apps/detail-page', icon: FileText },
          { name: '이미지 제작', href: '/dashboard-group/apps/image-gen', icon: Sparkles },
          { name: '카피라이팅', href: '/dashboard-group/apps/copywriting', icon: FileText },
        ]
      },
      {
        name: '학업',
        icon: GraduationCap,
        children: [
          { name: 'AI 탐지 방어', href: '/dashboard-group/apps/ai-detection', icon: ShieldCheck },
          { name: '독후감', href: '/dashboard-group/apps/book-report', icon: FileText },
          { name: '레포트', href: '/dashboard-group/apps/report', icon: FileText },
          { name: '발표 대본', href: '/dashboard-group/apps/presentation-script', icon: FileText },
          { name: '생활기록부', href: '/dashboard-group/apps/school-record', icon: FileText },
          { name: '코딩 과제', href: '/dashboard-group/apps/coding-task', icon: FileText },
        ]
      },
      {
        name: '취업',
        icon: UserCog,
        children: [
          { name: '면접 준비', href: '/dashboard-group/apps/interview-prep', icon: Users },
          { name: '이력서', href: '/dashboard-group/apps/resume', icon: FileText },
          { name: '자기소개서', href: '/dashboard-group/apps/cover-letter', icon: FileText },
        ]
      },
      {
        name: '부업',
        icon: Wallet,
        children: [
          { name: 'SNS 게시물', href: '/dashboard-group/apps/sns-post', icon: FileText },
          { name: '블로그', href: '/dashboard-group/apps/blog', icon: FileText },
          { name: '상품 리뷰', href: '/dashboard-group/apps/product-review', icon: FileText },
          { name: '영상 시나리오', href: '/dashboard-group/apps/video-scenario', icon: FileText },
          { name: '전자책', href: '/dashboard-group/apps/ebook', icon: FileText },
        ]
      },
    ]
  },
  // 캘린더 - 일정 관리
  {
    id: 'calendar',
    name: '캘린더',
    icon: IoCalendarNumberOutline,
    items: [
      { name: '전체 일정', href: '/dashboard-group/calendar', icon: IoCalendarNumberOutline },
      { name: '개인 일정', href: '/dashboard-group/calendar?view=personal', icon: User },
      { name: '프로젝트 일정', href: '/dashboard-group/calendar?view=projects', icon: FolderKanban },
      { name: '마감일', href: '/dashboard-group/calendar?view=deadlines', icon: AlertCircle },
      { name: '회의', href: '/dashboard-group/calendar?view=meetings', icon: Users },
      { name: 'AI 일정 제안', href: '/dashboard-group/calendar?view=ai', icon: Sparkles },
    ]
  },
  // 파일·문서 - 내가 쓰는 모든 자료
  {
    id: 'files',
    name: '파일·문서',
    icon: CiHardDrive,
    items: [
      { name: '내 파일', href: '/dashboard-group/files', icon: FolderOpen },
      { name: '프로젝트별 문서', href: '/dashboard-group/files?view=projects', icon: FolderKanban },
      { name: '최근 사용', href: '/dashboard-group/files?view=recent', icon: Clock },
      { name: 'AI 정리 문서', href: '/dashboard-group/files?view=ai', icon: Sparkles },
    ]
  },

  // 이메일 - 외부 커뮤니케이션
  {
    id: 'email',
    name: '이메일',
    icon: Mail,
    items: [
      { name: '수신함', href: '/dashboard-group/email', icon: Inbox },
      { name: '발신함', href: '/dashboard-group/email?view=sent', icon: Send },
      { name: '메일 → 업무', href: '/dashboard-group/email?view=to-task', icon: ArrowRightFromLine },
      { name: 'AI 요약', href: '/dashboard-group/email?view=ai-summary', icon: Sparkles },
    ]
  },
  // 메신저 - 회의/토론/발표/자유채팅 (세션룸 연동)
  {
    id: 'messenger',
    name: '메신저',
    icon: TbBrandWechat,
    items: [
      {
        name: '회의실',
        icon: Users,
        children: [
          { name: '새 회의', href: '/dashboard-group/messenger?action=new&mode=meeting', icon: Plus },
          { name: '진행중', href: '/dashboard-group/messenger?mode=meeting&status=active', icon: Play },
          { name: '예정', href: '/dashboard-group/messenger?mode=meeting&status=scheduled', icon: CalendarDays },
          { name: '완료', href: '/dashboard-group/messenger?mode=meeting&status=completed', icon: CheckCircle },
          { name: '회의록', href: '/dashboard-group/messenger/meetings', icon: FileText },
        ]
      },
      {
        name: '진영 토론방',
        icon: Target,
        children: [
          { name: '새 토론', href: '/dashboard-group/messenger?action=new&mode=debate', icon: Plus },
          { name: '진행중', href: '/dashboard-group/messenger?mode=debate&status=active', icon: Play },
          { name: '예정', href: '/dashboard-group/messenger?mode=debate&status=scheduled', icon: CalendarDays },
          { name: '완료', href: '/dashboard-group/messenger?mode=debate&status=completed', icon: CheckCircle },
          { name: '리포트', href: '/dashboard-group/messenger/debates', icon: FileText },
        ]
      },
      {
        name: '발표실',
        icon: Zap,
        children: [
          { name: '새 발표', href: '/dashboard-group/messenger?action=new&mode=presentation', icon: Plus },
          { name: '진행중', href: '/dashboard-group/messenger?mode=presentation&status=active', icon: Play },
          { name: '예정', href: '/dashboard-group/messenger?mode=presentation&status=scheduled', icon: CalendarDays },
          { name: '완료', href: '/dashboard-group/messenger?mode=presentation&status=completed', icon: CheckCircle },
          { name: '리포트', href: '/dashboard-group/messenger/presentations', icon: FileText },
        ]
      },
      { name: '자유채팅', href: '/dashboard-group/messenger', icon: TbBrandWechat },
    ]
  },
  // 팀 - 클릭 시 사이드바 열림
  {
    id: 'team',
    name: '팀',
    icon: GoPeople,
    items: [
      { name: '팀 생성', href: '#create-team', icon: Plus },
      { name: '팀목록', href: '/dashboard-group/team/list', icon: List },
      { name: '팀 관리', href: '/dashboard-group/team', icon: Users },
      { name: '팀원', href: '/dashboard-group/team/members', icon: User },
      { name: '역할 설정', href: '/dashboard-group/team/roles', icon: Settings },
    ]
  },
  // AI 에이전트
  {
    id: 'agents',
    name: 'AI 에이전트',
    icon: Bot,
    items: [
      { name: '에이전트 목록', href: '/dashboard-group/agents', icon: Bot },
      { name: '슈퍼 에이전트 생성', href: '/dashboard-group/agents/create', icon: Plus },
      { name: '워크플로우', href: '/dashboard-group/workflows', icon: Workflow },
    ]
  },
  // 뉴럴맵
  {
    id: 'neural-map',
    name: '뉴럴맵',
    icon: Orbit,
    items: [
      { name: '내 뉴럴맵', href: '/dashboard-group/neural-map', icon: Orbit },
      { name: '새 맵 생성', href: '/dashboard-group/neural-map/new', icon: Plus },
    ]
  },
  // 마이페이지 - 클릭 시 사이드바 열림
  {
    id: 'mypage',
    name: '마이페이지',
    icon: GoPerson,
    items: [
      { name: '소개', href: '/dashboard-group/mypage', icon: User },
      { name: '이력', href: '/dashboard-group/mypage/resume', icon: Briefcase },
      { name: '포트폴리오', href: '/dashboard-group/mypage/portfolio', icon: FolderKanban },
      { name: '활동', href: '/dashboard-group/mypage/activity', icon: Activity },
      { name: '연락처', href: '/dashboard-group/mypage/contact', icon: Phone },
    ]
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
  const router = useRouter()
  const IconComponent = item.icon
  const { accentColor } = useThemeStore()

  const handleClick = () => {
    // 하위 메뉴 토글
    onToggle()

    // 페이지 이동: href가 있으면 그 href로, 없으면 첫번째 자식의 href로
    if (item.href) {
      router.push(item.href)
    } else if (item.children && item.children.length > 0) {
      const firstChildHref = item.children[0].href
      if (firstChildHref) {
        router.push(firstChildHref)
      }
    }
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

  return (
    <button
      onClick={handleClick}
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

interface TwoLevelSidebarProps {
  hideLevel2?: boolean
}

export function TwoLevelSidebar({ hideLevel2 = false }: TwoLevelSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, currentTeam, logout: clearAuth } = useAuthStore()
  const { accentColor } = useThemeStore()
  const [isResizingHover, setIsResizingHover] = useState(false)
  const {
    activeCategory, setActiveCategory, sidebarOpen, setSidebarOpen, toggleSidebar,
    level2Width, setLevel2Width, isResizingLevel2, setIsResizingLevel2,
    emailSidebarWidth, setEmailSidebarWidth, isResizingEmail, setIsResizingEmail,
    level2Collapsed, toggleLevel2, setLevel2Collapsed
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

  // 정부지원사업 페이지 진입 시 자동으로 해당 메뉴 선택
  useEffect(() => {
    if (pathname?.includes('/company/government-programs')) {
      setSelectedCompanyMenu('정부지원사업')
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
    if (pathname.startsWith('/dashboard-group/files')) return 'files'
    if (pathname.startsWith('/dashboard-group/calendar')) return 'calendar'
    if (pathname.startsWith('/dashboard-group/email')) return 'email'
    if (pathname.startsWith('/dashboard-group/messenger')) return 'messenger'
    if (pathname.startsWith('/dashboard-group/team')) return 'team'
    if (pathname.startsWith('/dashboard-group/agents') ||
      pathname.startsWith('/dashboard-group/workflows') ||
      pathname.startsWith('/agent-builder')) return 'agents'
    if (pathname.startsWith('/dashboard-group/neural-map')) return 'neural-map'
    if (pathname.startsWith('/dashboard-group/works')) {
      const tab = searchParams.get('tab')
      if (tab === 'tools') return 'apps'
      return 'workspace'
    }
    if (pathname.startsWith('/dashboard-group/apps') || pathname.includes('/tools/')) return 'apps'
    if (pathname.startsWith('/dashboard-group/kpis') ||
      pathname === '/dashboard-group') return 'workspace'
    return activeCategory || 'workspace'
  })()

  // activeCategory 동기화
  useEffect(() => {
    if (currentCategory !== activeCategory) {
      setActiveCategory(currentCategory)
    }
  }, [currentCategory, activeCategory, setActiveCategory])

  // 메뉴 경로 prefetch
  useEffect(() => {
    const paths = [
      '/dashboard-group',
      '/dashboard-group/company',
      '/dashboard-group/mypage',
      '/dashboard-group/tasks',
      '/dashboard-group/workflows',
      '/dashboard-group/reports',
      '/dashboard-group/team',
      '/dashboard-group/messenger',
      '/dashboard-group/agents',
      '/dashboard-group/agents/create',
    ]
    paths.forEach(path => router.prefetch(path))
  }, [router])

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

  const worksItems: NestedMenuItem[] = [
    { name: 'Works홈', href: '/dashboard-group/works?tab=home', icon: Home },
    { name: '즐겨찾는 앱', href: '/dashboard-group/works?tab=favorites', icon: Star },
    { name: '운영중인 앱', href: '/dashboard-group/works?tab=operating', icon: Wrench },

    { name: '나의 폴더', href: '/dashboard-group/works?tab=folders', icon: FolderOpen },
    { name: '앱 내보내기/가져오기', href: '/dashboard-group/works?tab=export', icon: ArrowRightFromLine },
  ]

  const activeItems = (pathname.startsWith('/dashboard-group/works') && currentCategory !== 'apps')
    ? worksItems
    : navCategories.find(cat => cat.id === currentCategory)?.items || []
  const isCompanyMenu = currentCategory === 'company'

  const isDashboardRoot = pathname === '/dashboard-group'

  // Hydration 에러 방지: 클라이언트 마운트 전에는 렌더링하지 않음
  if (!mounted) {
    return <div className="flex fixed left-0 top-0 h-screen z-50 w-16" />
  }

  return (
    <div className="flex fixed left-0 top-0 h-screen z-50 transition-all duration-300" style={{ top: 'var(--title-bar-height, 0px)', height: 'calc(100vh - var(--title-bar-height, 0px))' }}>
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
                  setActiveCategory(category.id)
                  setSelectedCompanyMenu(null)

                  // 모든 카테고리는 사이드바를 열고, 첫 번째 메뉴로 이동
                  setSidebarOpen(true)

                  // 이동할 경로 결정
                  let targetPath = ''
                  if (category.id === 'company') {
                    targetPath = '/dashboard-group/company'
                  } else if (category.id === 'workspace') {
                    targetPath = '/dashboard-group'
                  } else if (category.id === 'team') {
                    targetPath = '/dashboard-group/team'
                  } else if (category.id === 'calendar') {
                    targetPath = '/dashboard-group/calendar'
                  } else if (category.id === 'neural-map') {
                    targetPath = '/dashboard-group/neural-map'
                  } else if (category.id === 'messenger') {
                    targetPath = '/dashboard-group/messenger'
                  } else {
                    // 첫 번째 아이템의 href 사용 (# 시작하는 건 제외)
                    const firstItem = category.items.find(item => item.href && !item.href.startsWith('#'))
                    targetPath = firstItem?.href || ''
                  }

                  // 현재 경로와 다를 때만 이동
                  if (targetPath && pathname !== targetPath) {
                    router.push(targetPath)
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
                <category.icon className="w-5 h-5" />
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
          {/* 사이드바 토글 버튼 */}
          <button
            onClick={toggleSidebar}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
              isDark
                ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
            )}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeftOpen className="w-5 h-5" />
            )}
            <div className={cn(
              'absolute left-full ml-2 px-2 py-1 text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50',
              isDark
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                : 'bg-white text-zinc-900 border border-zinc-200 shadow-lg'
            )}>
              {sidebarOpen ? '메뉴 접기' : '메뉴 펼치기'}
            </div>
          </button>

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

      {!pathname?.includes('/works/new') && (
        <AnimatePresence>
          {/* Neural Map Collapsed Toggle Button */}
          {sidebarOpen && currentCategory === 'neural-map' && pathname?.includes('/neural-map') && level2Collapsed && (
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

          {/* Neural Map File Tree Panel */}
          {sidebarOpen && currentCategory === 'neural-map' && pathname?.includes('/neural-map') && !level2Collapsed && (
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



          {/* Regular menus (not email, not neural-map page) */}
          {sidebarOpen && activeItems.length > 0 && currentCategory !== 'email' && !(currentCategory === 'neural-map' && pathname?.includes('/neural-map')) && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'h-full border-r overflow-hidden bg-white dark:bg-zinc-950',
                isDashboardRoot
                  ? (isDark ? 'border-white/10' : 'border-zinc-200/50')
                  : isDark ? 'border-zinc-800' : 'border-zinc-200'
              )}
            >
              <div className="h-full flex flex-col" style={{ width: 240 }}>
                {/* Category Header */}
                <div className={cn(
                  'h-16 flex items-center px-4 border-b flex-shrink-0',
                  isDark ? 'border-zinc-800' : 'border-zinc-200'
                )}>
                  {currentCategory === 'apps' ? (
                    <div className="flex items-center gap-2 w-full">
                      <h2 className={cn(
                        'text-lg font-bold',
                        isDark ? 'text-zinc-100' : 'text-zinc-900'
                      )}>
                        Apps
                      </h2>
                    </div>
                  ) : pathname.startsWith('/dashboard-group/works') ? (
                    <div className="flex items-center gap-2 w-full">
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
                      <span>페이지 생성</span>
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
                                      <Link
                                        key={child.name}
                                        href={child.href || '#'}
                                        className={cn(
                                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                                          childActive
                                            ? 'bg-accent text-white'
                                            : isDark
                                              ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                                              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                                        )}
                                      >
                                        {ChildIcon && (
                                          <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                        )}
                                        <span>{child.name}</span>
                                      </Link>
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
