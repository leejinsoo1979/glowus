// 사이드바 메뉴 데이터
import { CgMenuGridO } from 'react-icons/cg'
import { BsPersonWorkspace } from 'react-icons/bs'
import { IoCalendarNumberOutline, IoRocketOutline } from 'react-icons/io5'
import { GoPerson, GoPeople } from 'react-icons/go'
import { GrHomeRounded } from 'react-icons/gr'
import { TbBrandWechat } from 'react-icons/tb'
import { CiHardDrive } from 'react-icons/ci'
import { RxRocket } from 'react-icons/rx'
import { ShieldCheck } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  List,
  Settings,
  Sparkles,
  BarChart3,
  Globe,
  Building2,
  FileText,
  Workflow,
  Bot,
  Mail,
  Briefcase,
  PieChart,
  Zap,
  Target,
  FolderOpen,
  Search,
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
  Brain,
} from 'lucide-react'
import { FaLaptopCode, FaCodeBranch } from 'react-icons/fa6'
import type { Category, NestedMenuItem } from './types'

// 회사 메뉴 구조
export const companyMenuItems: NestedMenuItem[] = [
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
      { name: '대시보드', href: '/dashboard-group/company/government-programs', icon: LayoutDashboard },
      { name: '전체목록', href: '/dashboard-group/company/government-programs?view=list', icon: Search },
      { name: 'AI 매칭', href: '/dashboard-group/company/government-programs?view=matches', icon: Target },
      { name: '북마크', href: '/dashboard-group/company/government-programs/bookmarks', icon: BookmarkCheck },
      { name: '알림 설정', href: '/dashboard-group/company/government-programs/alerts', icon: Bell },
      {
        name: '신청 준비',
        icon: FileCheck,
        children: [
          { name: '준비 체크리스트', href: '/dashboard-group/company/government-programs/checklist', icon: ClipboardCheck },
          { name: '구비 서류', href: '/dashboard-group/company/government-programs/documents', icon: FolderOpen },
          { name: 'AI 자격진단', href: '/dashboard-group/company/government-programs/ai-diagnosis', icon: Bot },
          { name: '회사 프로필', href: '/dashboard-group/company/government-programs/profile', icon: Building2 },
          { name: '사업계획서 빌더', href: '/dashboard-group/company/government-programs/business-plan/builder', icon: FileText },
          { name: '작성중 사업계획서', href: '/dashboard-group/company/government-programs/business-plan/my-plans', icon: FileSignature },
        ]
      },
      {
        name: '제출/접수',
        icon: Upload,
        children: [
          { name: '신청서 작성', href: '/dashboard-group/company/government-programs/application', icon: FileSignature },
          { name: '제출 이력', href: '/dashboard-group/company/government-programs/submissions', icon: ScrollText },
        ]
      },
      {
        name: '선정/협약',
        icon: HeartHandshake,
        children: [
          { name: '선정 결과', href: '/dashboard-group/company/government-programs/results', icon: BadgeCheck },
          { name: '협약서 관리', href: '/dashboard-group/company/government-programs/contracts', icon: FileSpreadsheet },
        ]
      },
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
      {
        name: '예산/보고',
        icon: Banknote,
        children: [
          { name: '예산 현황', href: '/dashboard-group/company/government-programs/budget', icon: PieChart },
          { name: '지출 내역', href: '/dashboard-group/company/government-programs/expenses', icon: DollarSign },
          { name: '보고서 관리', href: '/dashboard-group/company/government-programs/reports', icon: FileSpreadsheet },
        ]
      },
      {
        name: '성과/자산',
        icon: Award,
        children: [
          { name: '특허/IP', href: '/dashboard-group/company/government-programs/patents', icon: ShieldCheck },
          { name: '논문/발표', href: '/dashboard-group/company/government-programs/publications', icon: BookOpen },
          { name: '참여 연구원', href: '/dashboard-group/company/government-programs/researchers', icon: Users },
        ]
      },
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

// 🔥 메인 카테고리 - 캘린더/이메일을 워크스페이스 하위로 이동
export const categories: Category[] = [
  // 홈 - 최상단에 배치 → Works 페이지로 이동
  {
    id: 'home',
    name: '홈',
    icon: GrHomeRounded,
    items: [
      { name: '홈', href: '/dashboard-group/works', icon: GrHomeRounded },
      { name: '즐겨찾는 앱', href: '/dashboard-group/works?tab=favorites', icon: Star },
      { name: '운영중인 앱', href: '/dashboard-group/works?tab=operating', icon: Wrench },
      { name: '나의 폴더', href: '/dashboard-group/works?tab=folders', icon: FolderOpen },
      { name: '작업 목록', href: '#task-history', icon: ClipboardList },
      // 🔥 Apps (홈 하위로 이동)
      {
        name: 'Apps',
        icon: CgMenuGridO,
        children: [
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
    ]
  },
  // 회사
  {
    id: 'company',
    name: '회사',
    icon: Building2,
    items: companyMenuItems
  },
  // 🔥 워크스페이스 - 캘린더/이메일 통합
  {
    id: 'workspace',
    name: '워크스페이스',
    icon: BsPersonWorkspace,
    items: [
      { name: '대시보드', href: '/dashboard-group', icon: LayoutDashboard },
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
      { name: '간트차트', href: '/dashboard-group/gantt', icon: GanttChart },
      { name: 'KPI 관리', href: '/dashboard-group/kpis', icon: Target },
      // 🔥 캘린더 (워크스페이스 하위로 이동)
      {
        name: '캘린더',
        icon: IoCalendarNumberOutline,
        children: [
          { name: '전체 일정', href: '/dashboard-group/calendar', icon: IoCalendarNumberOutline },
          { name: '오늘 일정', href: '/dashboard-group/calendar?view=today', icon: CalendarDays },
          { name: '개인 일정', href: '/dashboard-group/calendar?view=personal', icon: User },
          { name: '프로젝트 일정', href: '/dashboard-group/calendar?view=projects', icon: FolderKanban },
          { name: '마감일', href: '/dashboard-group/calendar?view=deadlines', icon: AlertCircle },
          { name: '회의', href: '/dashboard-group/calendar?view=meetings', icon: Users },
        ]
      },
      // 🔥 이메일 (워크스페이스 하위로 이동)
      {
        name: '이메일',
        icon: Mail,
        children: [
          { name: '수신함', href: '/dashboard-group/email', icon: Inbox },
          { name: '발신함', href: '/dashboard-group/email?view=sent', icon: Send },
          { name: '메일 → 업무', href: '/dashboard-group/email?view=to-task', icon: ArrowRightFromLine },
          { name: 'AI 요약', href: '/dashboard-group/email?view=ai-summary', icon: Sparkles },
        ]
      },
      // 🔥 파일·문서 (워크스페이스 하위로 이동)
      {
        name: '파일·문서',
        icon: CiHardDrive,
        children: [
          { name: '내 파일', href: '/dashboard-group/files', icon: FolderOpen },
          { name: '프로젝트별 문서', href: '/dashboard-group/files?view=projects', icon: FolderKanban },
          { name: '최근 사용', href: '/dashboard-group/files?view=recent', icon: Clock },
          { name: 'AI 정리 문서', href: '/dashboard-group/files?view=ai', icon: Sparkles },
        ]
      },
    ]
  },
  // 마이뉴런
  {
    id: 'neurons',
    name: '마이뉴런',
    icon: Brain,
    items: [
      { name: '마이뉴런', href: '/dashboard-group/neurons', icon: Brain },
    ]
  },
  // 메신저
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
  // 팀
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
    ]
  },
  // 워크플로우 빌더
  {
    id: 'workflow-builder',
    name: '워크플로우 빌더',
    icon: FaCodeBranch,
    items: [
      { name: '워크플로우 에디터', href: '/dashboard-group/workflow-builder', icon: FaCodeBranch },
      { name: '새 워크플로우', href: '/dashboard-group/workflow-builder/new', icon: Plus },
    ]
  },
  // AI 코딩
  {
    id: 'ai-coding',
    name: 'AI 코딩',
    icon: FaLaptopCode,
    items: [
      { name: 'AI 코딩', href: '/dashboard-group/ai-coding', icon: FaLaptopCode },
      { name: '새 프로젝트', href: '/dashboard-group/ai-coding/new', icon: Plus },
    ]
  },
  // 마이페이지
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

// 투자자 카테고리
export const investorCategories: Category[] = [
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
