'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  ExternalLink,
  FileText,
  X,
  Check,
  Settings,
} from 'lucide-react'
import { useERPDashboard, useApprovalStats, useGoogleCalendarEvents } from '@/lib/hooks/use-cached-fetch'

// 위젯 헤더 컴포넌트 (보기 버튼 포함)
function WidgetHeader({
  title,
  href,
  isDark,
  children
}: {
  title: string
  href?: string
  isDark: boolean
  children?: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className={cn('font-semibold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
        {title}
      </h3>
      <div className="flex items-center gap-2">
        {children}
        {href && (
          <button
            onClick={() => router.push(href)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
              isDark
                ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
            )}
          >
            보기
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// 캘린더 컴포넌트
function CalendarWidget({ isDark, eventDays = [] }: { isDark: boolean; eventDays?: number[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const router = useRouter()

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const days = []

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, isCurrentMonth: false })
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, isCurrentMonth: true })
  }

  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ day: i, isCurrentMonth: false })
  }

  const todayEvents = eventDays.length > 0 ? eventDays : []
  const today = new Date()
  const isToday = (day: number) => today.getDate() === day && today.getMonth() === month && today.getFullYear() === year

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn('font-semibold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
          캘린더
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className={cn('p-1 rounded hover:bg-zinc-100', isDark && 'hover:bg-zinc-800')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            {year}.{String(month + 1).padStart(2, '0')}
          </span>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className={cn('p-1 rounded hover:bg-zinc-100', isDark && 'hover:bg-zinc-800')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button className={cn('p-1 rounded hover:bg-zinc-100 ml-2', isDark && 'hover:bg-zinc-800')}>
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push('/dashboard-group/company/calendar')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
              isDark
                ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
            )}
          >
            보기
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={cn(
            'py-1 font-medium',
            i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : isDark ? 'text-zinc-400' : 'text-zinc-500'
          )}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square flex flex-col items-center justify-center text-xs rounded-lg relative',
              !d.isCurrentMonth && 'opacity-30',
              d.isCurrentMonth && todayEvents.includes(d.day) && 'bg-accent/10',
              d.day === 12 && d.isCurrentMonth && 'bg-accent text-white',
              isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
            )}
          >
            <span className={cn(
              i % 7 === 0 ? 'text-red-500' : i % 7 === 6 ? 'text-blue-500' : '',
              d.day === 12 && d.isCurrentMonth && 'text-white'
            )}>
              {d.day}
            </span>
            {d.isCurrentMonth && todayEvents.includes(d.day) && d.day !== 12 && (
              <div className="w-1 h-1 rounded-full bg-accent mt-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Todo 위젯
interface UpcomingEvent {
  date: number
  title: string
}

function TodoWidget({ isDark, events = [] }: { isDark: boolean; events?: UpcomingEvent[] }) {
  const router = useRouter()
  const today = new Date().getDate()

  // 실제 이벤트가 있으면 사용, 없으면 기본 mock 데이터
  const todos = events.length > 0
    ? events.map((e, i) => ({
        date: e.date,
        label: e.date === today ? 'Today' : '',
        items: [e.title],
        color: e.date === today ? 'bg-accent' : i === 1 ? 'bg-zinc-400' : 'bg-amber-500'
      }))
    : [
        { date: today, label: 'Today', items: ['등록된 일정이 없습니다.'], color: 'bg-accent' },
        { date: today + 1, label: '', items: ['등록된 일정이 없습니다.'], color: 'bg-zinc-400' },
        { date: today + 2, label: '', items: ['등록된 일정이 없습니다.'], color: 'bg-amber-500' },
      ]

  return (
    <div className={cn(
      'rounded-xl border p-4 mt-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="일정" href="/dashboard-group/company/schedule" isDark={isDark} />
      {todos.map((todo, i) => (
        <div key={i} className={cn(
          'py-3',
          i !== todos.length - 1 && (isDark ? 'border-b border-zinc-800' : 'border-b border-zinc-200')
        )}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-xs font-medium',
              todo.color === 'bg-accent' ? 'text-accent' : todo.color === 'bg-amber-500' ? 'text-amber-500' : isDark ? 'text-zinc-400' : 'text-zinc-500'
            )}>
              {todo.date}
            </span>
            {todo.label && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded', todo.color, 'text-white')}>
                {todo.label}
              </span>
            )}
          </div>
          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            {todo.items[0]}
          </p>
        </div>
      ))}
    </div>
  )
}

// 매출입 현황
interface Financials {
  monthly_sales: number
  monthly_purchases: number
  monthly_profit: number
}

function SalesWidget({ isDark, financials }: { isDark: boolean; financials?: Financials | null }) {
  const [tab, setTab] = useState<'sales' | 'purchase'>('sales')

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  const hasData = financials && (financials.monthly_sales > 0 || financials.monthly_purchases > 0)

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="매출입 현황" href="/dashboard-group/sales/sales-list" isDark={isDark} />

      <div className="flex items-center gap-4 mb-4">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('sales')}
            className={cn(
              'px-3 py-1 text-xs rounded-full transition-colors',
              tab === 'sales'
                ? 'bg-accent text-white'
                : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
            )}
          >
            매출
          </button>
          <button
            onClick={() => setTab('purchase')}
            className={cn(
              'px-3 py-1 text-xs rounded-full transition-colors',
              tab === 'purchase'
                ? 'bg-accent text-white'
                : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
            )}
          >
            매입
          </button>
        </div>
        <div className="flex items-center gap-1">
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
          <span className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>2025-12</span>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </div>
      </div>

      <div className={cn(
        'h-32 flex items-center justify-center rounded-lg',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
      )}>
        {hasData ? (
          <div className="text-center">
            <p className={cn('text-2xl font-bold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
              ₩{formatMoney(tab === 'sales' ? financials.monthly_sales : financials.monthly_purchases)}
            </p>
            <p className={cn('text-xs mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {tab === 'sales' ? '이번 달 매출' : '이번 달 매입'}
            </p>
          </div>
        ) : (
          <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            매출 내역에 등록된 건이 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}

// 교육 현황
function TrainingWidget({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="교육 현황" href="/dashboard-group/hr/training-status" isDark={isDark} />

      <div className="flex items-center justify-center gap-1 mb-4">
        <ChevronLeft className="w-4 h-4 text-zinc-400" />
        <span className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>2025</span>
        <ChevronRight className="w-4 h-4 text-zinc-400" />
      </div>

      <div className={cn(
        'h-24 flex items-center justify-center rounded-lg',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
      )}>
        <p className={cn('text-xs text-center px-4', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          법정의무교육 앱 사용을 위해 서비스 신청이 필요합니다.
        </p>
      </div>
    </div>
  )
}

// 공지사항
function NoticeWidget({ isDark }: { isDark: boolean }) {
  const notices = [
    { type: '업데이트', title: '다우오피스 4.1.9.0 업데이트 (25.11.25)', date: '2025-12-10' },
    { type: 'N/a 시스템 안내', title: '[외부기관 연동센터] [장애통지] [조치완료] 현대카드 법인 오류 발생 안내', date: '2025-12-06' },
    { type: 'N/a 시스템 안내', title: '[직원교육] 2025년 하반기 산업안전보건교육 수강 기간 변경 안내', date: '2025-12-04' },
    { type: 'N/a 시스템 안내', title: '[외부기관 연동센터] [장애통지] 현대카드 법인 오류 발생 안내', date: '2025-12-04' },
    { type: 'N/a 시스템 안내', title: '[고용전자계약] 모두싸인 서비스 일시 중단 안내', date: '2025-12-03' },
  ]

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="공지사항" href="/dashboard-group/company/notices" isDark={isDark} />

      <div className="space-y-2">
        {notices.map((notice, i) => (
          <div key={i} className={cn(
            'flex items-start justify-between py-2',
            i !== notices.length - 1 && (isDark ? 'border-b border-zinc-800' : 'border-b border-zinc-100')
          )}>
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded flex-shrink-0',
                notice.type === '업데이트'
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              )}>
                {notice.type}
              </span>
              <p className={cn(
                'text-xs truncate',
                isDark ? 'text-zinc-300' : 'text-zinc-700'
              )}>
                {notice.title}
              </p>
            </div>
            <span className={cn('text-[10px] flex-shrink-0 ml-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {notice.date}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-4">
        <button className={cn('p-1 rounded', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}>
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <button className={cn('p-1 rounded', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
    </div>
  )
}

// 전자결제 진행현황
interface ApprovalStatsData {
  inbox: number
  sent: number
  drafts: number
  completed: number
  monthly: { total: number; approved: number; rejected: number; pending: number }
}

function PaymentProgressWidget({ isDark, approvalData }: { isDark: boolean; approvalData?: ApprovalStatsData | null }) {
  const hasData = approvalData && (approvalData.inbox > 0 || approvalData.sent > 0 || approvalData.completed > 0)

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="전자결제 진행현황" href="/dashboard-group/finance/transactions" isDark={isDark} />

      {hasData ? (
        <div className="grid grid-cols-4 gap-2">
          <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-zinc-800' : 'bg-zinc-50')}>
            <p className={cn('text-lg font-bold', 'text-blue-500')}>{approvalData.inbox}</p>
            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>수신함</p>
          </div>
          <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-zinc-800' : 'bg-zinc-50')}>
            <p className={cn('text-lg font-bold', 'text-amber-500')}>{approvalData.sent}</p>
            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>발신함</p>
          </div>
          <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-zinc-800' : 'bg-zinc-50')}>
            <p className={cn('text-lg font-bold', isDark ? 'text-zinc-400' : 'text-zinc-600')}>{approvalData.drafts}</p>
            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>임시저장</p>
          </div>
          <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-zinc-800' : 'bg-zinc-50')}>
            <p className={cn('text-lg font-bold', 'text-emerald-500')}>{approvalData.completed}</p>
            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>완료</p>
          </div>
        </div>
      ) : (
        <div className={cn(
          'h-24 flex items-center justify-center rounded-lg',
          isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
        )}>
          <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            목록이 없습니다.
          </p>
        </div>
      )}
    </div>
  )
}

// 전자세금계산서 발행 현황
function TaxInvoiceWidget({ isDark }: { isDark: boolean }) {
  const items = [
    { label: '미 전송', sales: '0건', invoice: '0건' },
    { label: '전송대기', sales: '0건', invoice: '0건' },
    { label: '전송중', sales: '0건', invoice: '0건' },
    { label: '전송 성공', sales: '0건', invoice: '0건' },
    { label: '전송 오류', sales: '0건', invoice: '0건', isError: true },
  ]

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="매출 전자세금계산서 발행 현황" href="/dashboard-group/sales/tax-invoice" isDark={isDark} />

      <div className="flex items-center justify-center gap-1 mb-4">
        <ChevronLeft className="w-4 h-4 text-zinc-400" />
        <span className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>2025-12</span>
        <ChevronRight className="w-4 h-4 text-zinc-400" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 세금 계산서 발행 */}
        <div className={cn(
          'rounded-lg border p-3',
          isDark ? 'border-zinc-700' : 'border-zinc-200'
        )}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
            <span className={cn('text-xs font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              세금 계산서 발행
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className={cn('grid grid-cols-3 gap-2 pb-1 border-b', isDark ? 'border-zinc-700 text-zinc-500' : 'border-zinc-200 text-zinc-400')}>
              <span>발행 상태</span>
              <span>발행</span>
              <span>수정</span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <span className={cn(
                  'flex items-center gap-1',
                  item.isError ? 'text-red-500' : isDark ? 'text-zinc-400' : 'text-zinc-600'
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    item.isError ? 'bg-red-500' : i === 3 ? 'bg-emerald-500' : i === 2 ? 'bg-blue-500' : i === 1 ? 'bg-amber-500' : 'bg-zinc-400'
                  )} />
                  {item.label}
                </span>
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>{item.sales}</span>
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>-</span>
              </div>
            ))}
          </div>
        </div>

        {/* 계산서 발행 */}
        <div className={cn(
          'rounded-lg border p-3',
          isDark ? 'border-zinc-700' : 'border-zinc-200'
        )}>
          <div className="flex items-center gap-2 mb-3">
            <FileText className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
            <span className={cn('text-xs font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              계산서 발행
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className={cn('grid grid-cols-3 gap-2 pb-1 border-b', isDark ? 'border-zinc-700 text-zinc-500' : 'border-zinc-200 text-zinc-400')}>
              <span>발행 상태</span>
              <span>일반</span>
              <span>수정</span>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <span className={cn(
                  'flex items-center gap-1',
                  item.isError ? 'text-red-500' : isDark ? 'text-zinc-400' : 'text-zinc-600'
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    item.isError ? 'bg-red-500' : i === 3 ? 'bg-emerald-500' : i === 2 ? 'bg-blue-500' : i === 1 ? 'bg-amber-500' : 'bg-zinc-400'
                  )} />
                  {item.label}
                </span>
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>{item.invoice}</span>
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>-</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 전자계약 진행현황
function ContractProgressWidget({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="전자계약 진행현황" href="/dashboard-group/hr/contracts" isDark={isDark} />

      <div className={cn(
        'h-24 flex items-center justify-center rounded-lg',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
      )}>
        <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          목록이 없습니다.
        </p>
      </div>
    </div>
  )
}

// 인력 현황
interface HRData {
  total: number
  active: number
  on_leave: number
  today_attendance: number
}

function HRStatusWidget({ isDark, employeesData }: { isDark: boolean; employeesData?: HRData | null }) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd, setRangeEnd] = useState(100)

  // 실제 데이터가 있으면 사용, 없으면 기본 mock 데이터
  const hrData = [
    { month: '2025-07', total: 0.35, joined: 0.1, left: 0.05 },
    { month: '2025-08', total: 0.4, joined: 0.15, left: 0.1 },
    { month: '2025-09', total: 0.55, joined: 0.2, left: 0.05 },
    { month: '2025-10', total: 0.65, joined: 0.1, left: 0.1 },
    { month: '2025-11', total: 0.75, joined: 0.2, left: 0.1 },
    { month: '2025-12', total: employeesData ? employeesData.total / 100 : 0.85, joined: 0.15, left: employeesData ? employeesData.on_leave / 100 : 0.05 },
  ]

  // viewBox 기반 반응형 차트
  const viewBoxWidth = 400
  const viewBoxHeight = 180
  const paddingLeft = 35
  const paddingRight = 20
  const paddingTop = 15
  const paddingBottom = 30
  const graphWidth = viewBoxWidth - paddingLeft - paddingRight
  const graphHeight = viewBoxHeight - paddingTop - paddingBottom

  const getX = (index: number) => paddingLeft + (index / (hrData.length - 1)) * graphWidth
  const getY = (value: number) => paddingTop + (1 - value) * graphHeight

  const linePath = hrData.map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i)},${getY(d.total)}`).join(' ')

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="인력 현황" href="/dashboard-group/hr/employees" isDark={isDark} />

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 rounded-full" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>총인원</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>입사자</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-red-400 rounded-sm" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>퇴사자</span>
        </div>
      </div>

      {/* Chart - 반응형 */}
      <div className="relative w-full" style={{ aspectRatio: '400/180' }}>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Y-Axis Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((val) => (
            <g key={val}>
              <line
                x1={paddingLeft}
                y1={getY(val)}
                x2={viewBoxWidth - paddingRight}
                y2={getY(val)}
                stroke={isDark ? '#3f3f46' : '#e4e4e7'}
                strokeDasharray="3,3"
              />
              <text
                x={paddingLeft - 8}
                y={getY(val) + 4}
                textAnchor="end"
                fontSize="11"
                fill={isDark ? '#71717a' : '#a1a1aa'}
              >
                {val}
              </text>
            </g>
          ))}

          {/* Bar Chart for 입사자/퇴사자 */}
          {hrData.map((d, i) => {
            const barWidth = 12
            const x = getX(i)
            return (
              <g key={i}>
                {/* 입사자 (blue) */}
                <rect
                  x={x - barWidth - 2}
                  y={getY(d.joined)}
                  width={barWidth}
                  height={graphHeight - (getY(d.joined) - paddingTop)}
                  fill="rgb(59, 130, 246)"
                  opacity={0.8}
                  rx={2}
                />
                {/* 퇴사자 (red) */}
                <rect
                  x={x + 2}
                  y={getY(d.left)}
                  width={barWidth}
                  height={graphHeight - (getY(d.left) - paddingTop)}
                  fill="rgb(248, 113, 113)"
                  opacity={0.8}
                  rx={2}
                />
              </g>
            )
          })}

          {/* Line Chart for 총인원 */}
          <path
            d={linePath}
            fill="none"
            stroke="rgb(16, 185, 129)"
            strokeWidth="2.5"
          />

          {/* Data Points */}
          {hrData.map((d, i) => (
            <g key={i}>
              <circle
                cx={getX(i)}
                cy={getY(d.total)}
                r={hoveredPoint === i ? 6 : 5}
                fill="rgb(16, 185, 129)"
                stroke={isDark ? '#18181b' : '#fff'}
                strokeWidth="2"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </g>
          ))}

          {/* X-Axis Labels */}
          {hrData.map((d, i) => (
            <text
              key={i}
              x={getX(i)}
              y={viewBoxHeight - 8}
              textAnchor="middle"
              fontSize="11"
              fill={isDark ? '#71717a' : '#a1a1aa'}
            >
              {d.month}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredPoint !== null && (
          <div
            className={cn(
              'absolute px-3 py-2 rounded-lg text-xs shadow-lg z-10 pointer-events-none',
              isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-zinc-200'
            )}
            style={{
              left: `${(getX(hoveredPoint) / viewBoxWidth) * 100}%`,
              top: `${(getY(hrData[hoveredPoint].total) / viewBoxHeight) * 100 - 25}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className={cn('font-medium mb-1', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
              {hrData[hoveredPoint].month}
            </p>
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-emerald-500 rounded" />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>총인원:</span>
                <span className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>{hrData[hoveredPoint].total}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>입사자:</span>
                <span className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>{hrData[hoveredPoint].joined}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-400 rounded-sm" />
                <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>퇴사자:</span>
                <span className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>{hrData[hoveredPoint].left}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Range Slider */}
      <div className="mt-4 px-1">
        <div className={cn(
          'relative h-2 rounded-full',
          isDark ? 'bg-zinc-800' : 'bg-zinc-200'
        )}>
          <div
            className="absolute h-full bg-emerald-500/50 rounded-full"
            style={{ left: `${rangeStart}%`, width: `${rangeEnd - rangeStart}%` }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={rangeStart}
            onChange={(e) => setRangeStart(Math.min(Number(e.target.value), rangeEnd - 10))}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
          <input
            type="range"
            min="0"
            max="100"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(Math.max(Number(e.target.value), rangeStart + 10))}
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-zinc-500">
          <span>2025-07</span>
          <span>2025-12</span>
        </div>
      </div>
    </div>
  )
}

// 계좌 잔액 현황
function AccountBalanceWidget({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="계좌 잔액 현황" href="/dashboard-group/finance/accounts" isDark={isDark}>
        <button className={cn(
          'text-xs px-2 py-1 rounded-full',
          isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
        )}>
          조회기준
        </button>
      </WidgetHeader>

      <p className={cn('text-xs mb-4', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
        최근 수집일시 : -
      </p>

      <div className={cn(
        'h-24 flex items-center justify-center rounded-lg',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
      )}>
        <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          조회된 계좌 목록이 없습니다.
        </p>
      </div>
    </div>
  )
}

// 기관별 자료수집 이력
function DataCollectionWidget({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="기관별 자료수집 이력" href="/dashboard-group/company/data-collection" isDark={isDark} />

      <div className={cn(
        'h-24 flex items-center justify-center rounded-lg',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
      )}>
        <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          자료수집 이력이 없습니다.
        </p>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 미니 캘린더
function MiniCalendarPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getAccentColor = () => {
    switch (accentColor) {
      case 'purple': return 'bg-purple-500'
      case 'blue': return 'bg-blue-500'
      case 'green': return 'bg-green-500'
      case 'orange': return 'bg-orange-500'
      case 'pink': return 'bg-pink-500'
      case 'red': return 'bg-red-500'
      case 'yellow': return 'bg-yellow-500'
      case 'cyan': return 'bg-cyan-500'
      default: return 'bg-blue-500'
    }
  }

  return (
    <div className="h-full p-3 flex flex-col">
      <div className={cn('text-[10px] font-bold mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>2025.09</div>
      <div className="grid grid-cols-7 gap-1 flex-1 content-start">
        {[...Array(21)].map((_, i) => (
          <div
            key={i}
            className={cn(
              'aspect-square rounded-[2px] flex items-center justify-center text-[6px] font-medium transition-colors',
              i === 8
                ? cn(getAccentColor(), 'text-white shadow-sm')
                : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

// 위젯 미리보기 - 차트
function MiniChartPreview({ isDark, type }: { isDark: boolean; type: 'bar' | 'line' }) {
  const { accentColor } = useThemeStore()

  const getStrokeColor = () => {
    switch (accentColor) {
      case 'purple': return '#a855f7' // purple-500
      case 'blue': return '#3b82f6' // blue-500
      case 'green': return '#22c55e' // green-500
      case 'orange': return '#f97316' // orange-500
      case 'pink': return '#ec4899' // pink-500
      case 'red': return '#ef4444' // red-500
      case 'yellow': return '#eab308' // yellow-500
      case 'cyan': return '#06b6d4' // cyan-500
      default: return '#3b82f6'
    }
  }

  const getFillColor = (idx: number) => {
    // Alternate opacity or slightly different shades based on accent
    const base = getStrokeColor()
    return idx % 2 === 0 ? base : `${base}80` // 50% opacity
  }

  if (type === 'bar') {
    return (
      <div className="h-full p-4 flex items-end gap-1.5">
        {[40, 70, 50, 85, 60, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all hover:opacity-80"
            style={{
              height: `${h}%`,
              backgroundColor: getFillColor(i)
            }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="h-full p-3 flex items-center">
      <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
        {/* Fill Area with Gradient */}
        <defs>
          <linearGradient id={`gradient-${accentColor}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={getStrokeColor()} stopOpacity="0.2" />
            <stop offset="100%" stopColor={getStrokeColor()} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,40 L20,30 L40,35 L60,20 L80,25 L100,15 L100,50 L0,50 Z"
          fill={`url(#gradient-${accentColor})`}
          stroke="none"
        />
        <path
          d="M0,40 L20,30 L40,35 L60,20 L80,25 L100,15"
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[0, 20, 40, 60, 80, 100].map((x, i) => (
          <circle
            key={i}
            cx={x}
            cy={[40, 30, 35, 20, 25, 15][i]}
            r="2.5"
            fill="white"
            stroke={getStrokeColor()}
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  )
}

// 위젯 미리보기 - 테이블
function MiniTablePreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getAccentBg = () => {
    switch (accentColor) {
      case 'purple': return 'bg-purple-500'
      case 'blue': return 'bg-blue-500'
      case 'green': return 'bg-green-500'
      case 'orange': return 'bg-orange-500'
      case 'pink': return 'bg-pink-500'
      case 'red': return 'bg-red-500'
      case 'yellow': return 'bg-yellow-500'
      case 'cyan': return 'bg-cyan-500'
      default: return 'bg-blue-500'
    }
  }

  return (
    <div className="h-full p-4 flex flex-col justify-center gap-2.5">
      <div className="flex gap-2 mb-1">
        <div className={cn('w-8 h-2 rounded-[2px]', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />
        <div className={cn('flex-1 h-2 rounded-[2px]', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />
        <div className={cn('w-4 h-2 rounded-[2px]', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />
      </div>
      {[1, 2, 3].map((_, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className={cn('w-1.5 h-1.5 rounded-full', i === 0 ? getAccentBg() : isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />
          <div className={cn('flex-1 h-1.5 rounded-full', isDark ? 'bg-zinc-800' : 'bg-zinc-100')} />
          <div className={cn('w-6 h-1.5 rounded-full', isDark ? 'bg-zinc-800' : 'bg-zinc-100')} />
        </div>
      ))}
    </div>
  )
}

// 위젯 미리보기 - 교육/플레이
function MiniPlayPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getIconColor = () => {
    switch (accentColor) {
      case 'purple': return 'text-purple-500'
      case 'blue': return 'text-blue-500'
      case 'green': return 'text-green-500'
      case 'orange': return 'text-orange-500'
      case 'pink': return 'text-pink-500'
      case 'red': return 'text-red-500'
      case 'yellow': return 'text-yellow-500'
      case 'cyan': return 'text-cyan-500'
      default: return 'text-blue-500'
    }
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center border transition-all',
        isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm'
      )}>
        <div
          className={cn(
            "w-0 h-0 ml-1 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px]",
            isDark ? "border-l-zinc-400" : "border-l-zinc-600"
          )}
          style={{
            // Override with theme color if needed, but grey usually looks cleaner for "play" unless active
          }}
        />
      </div>
    </div>
  )
}

// 위젯 미리보기 - 세금계산서 (High-Fidelity Receipt)
function MiniTaxInvoicePreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getStampColor = () => {
    switch (accentColor) {
      case 'purple': return '#a855f7'
      case 'blue': return '#3b82f6'
      case 'green': return '#22c55e'
      case 'orange': return '#f97316'
      case 'pink': return '#ec4899'
      case 'red': return '#ef4444'
      case 'yellow': return '#eab308'
      case 'cyan': return '#06b6d4'
      default: return '#3b82f6'
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3 relative overflow-hidden group">
      {/* Receipt Shape */}
      <div className={cn(
        "relative w-12 h-16 bg-white shadow-sm flex flex-col items-center pt-2 px-1.5 gap-1",
        isDark ? "bg-zinc-800" : "bg-white border border-zinc-200"
      )}>
        {/* Perforated Top */}
        <div className="absolute -top-1 left-0 w-full h-2 flex justify-between">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full -mt-1", isDark ? "bg-zinc-900" : "bg-zinc-50")} />
          ))}
        </div>

        {/* Header */}
        <div className={cn("w-8 h-1 rounded-sm mb-1", isDark ? "bg-zinc-600" : "bg-zinc-300")} />

        {/* Rows */}
        <div className="w-full space-y-1">
          <div className="flex justify-between items-center">
            <div className={cn("w-4 h-0.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
            <div className={cn("w-2 h-0.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
          </div>
          <div className="flex justify-between items-center">
            <div className={cn("w-5 h-0.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
            <div className={cn("w-2 h-0.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
          </div>
          <div className="flex justify-between items-center">
            <div className={cn("w-3 h-0.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
            <div className={cn("w-2 h-0.5 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
          </div>
        </div>

        {/* Total Line */}
        <div className={cn("w-full h-px mt-1", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
        <div className="flex justify-between items-center w-full mt-0.5">
          <div className={cn("w-2 h-1 rounded-sm", isDark ? "bg-zinc-600" : "bg-zinc-400")} />
          <div className={cn("w-3 h-1 rounded-sm", isDark ? "bg-zinc-600" : "bg-zinc-400")} />
        </div>

        {/* Stamp */}
        <div
          className="absolute bottom-2 right-[-6px] transform -rotate-12 border-[1.5px] rounded px-1 py-0.5 flex flex-col items-center justify-center bg-white/10 backdrop-blur-[1px]"
          style={{ borderColor: getStampColor() }}
        >
          <span className="text-[5px] font-bold leading-none tracking-tighter" style={{ color: getStampColor() }}>PAID</span>
        </div>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 계좌 (High-Fidelity Premium Card)
function MiniAccountPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getGradientClass = () => {
    switch (accentColor) {
      case 'purple': return 'from-purple-500 via-purple-600 to-purple-800'
      case 'blue': return 'from-blue-500 via-blue-600 to-blue-800'
      case 'green': return 'from-green-500 via-green-600 to-green-800'
      case 'orange': return 'from-orange-500 via-orange-600 to-orange-800'
      case 'pink': return 'from-pink-500 via-pink-600 to-pink-800'
      case 'red': return 'from-red-500 via-red-600 to-red-800'
      case 'yellow': return 'from-yellow-400 via-yellow-500 to-yellow-700'
      case 'cyan': return 'from-cyan-400 via-cyan-500 to-cyan-700'
      default: return 'from-zinc-700 via-zinc-800 to-black'
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3 perspective-[500px] group">
      <div className={cn(
        "relative w-14 h-9 rounded-md bg-gradient-to-br shadow-lg flex flex-col justify-between p-1.5 transition-transform duration-300 group-hover:rotate-y-6 group-hover:scale-110",
        getGradientClass()
      )}>
        {/* Glossy Overlay */}
        <div className="absolute inset-0 rounded-md bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />

        <div className="flex justify-between items-start">
          {/* Chip */}
          <div className="w-2.5 h-2 rounded-[2px] bg-gradient-to-br from-yellow-200 to-yellow-500 border border-yellow-600/30 flex items-center justify-center overflow-hidden">
            <div className="w-full h-px bg-black/20" />
            <div className="absolute h-full w-px bg-black/20" />
          </div>
          {/* Contactless Icon */}
          <svg className="w-2.5 h-2.5 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M8.5 10a7.5 7.5 0 0 1 7.5 7.5" />
            <path d="M12 10a4 4 0 0 1 4 4" />
            <path d="M14.5 13a1.5 1.5 0 0 1 1.5 1.5" />
          </svg>
        </div>

        <div className="space-y-0.5">
          {/* Number Dots */}
          <div className="flex gap-0.5 items-center">
            <div className="w-0.5 h-0.5 rounded-full bg-white/50" />
            <div className="w-0.5 h-0.5 rounded-full bg-white/50" />
            <div className="w-0.5 h-0.5 rounded-full bg-white/50" />
            <div className="w-0.5 h-0.5 rounded-full bg-white/50" />
            <div className="w-1" />
            <span className="text-[4px] text-white/90 font-mono tracking-widest">8824</span>
          </div>
          {/* Name Line */}
          <div className="w-6 h-0.5 rounded-full bg-white/30" />
        </div>

        {/* Shine Effect */}
        <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
      </div>
    </div>
  )
}

// 위젯 미리보기 - 전자계약 (High-Fidelity Legal Doc)
function MiniContractPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getPenColor = () => {
    switch (accentColor) {
      case 'purple': return 'text-purple-600'
      case 'green': return 'text-green-600'
      default: return 'text-blue-600'
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3">
      <div className={cn(
        "relative w-10 h-14 bg-white border shadow-sm flex flex-col p-1.5",
        isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-zinc-200"
      )}>
        {/* Header */}
        <div className="flex justify-center mb-1.5">
          <div className={cn("w-4 h-0.5 rounded-full", isDark ? "bg-zinc-500" : "bg-zinc-400")} />
        </div>

        {/* Text Lines */}
        <div className="space-y-0.5 mb-auto">
          <div className={cn("w-full h-[1px]", isDark ? "bg-zinc-700" : "bg-zinc-100")} />
          <div className={cn("w-[90%] h-[1px]", isDark ? "bg-zinc-700" : "bg-zinc-100")} />
          <div className={cn("w-[95%] h-[1px]", isDark ? "bg-zinc-700" : "bg-zinc-100")} />
          <div className={cn("w-[80%] h-[1px]", isDark ? "bg-zinc-700" : "bg-zinc-100")} />
        </div>

        {/* Signature Box */}
        <div className="relative mt-1">
          <div className={cn("text-[3px] mb-0.5", isDark ? "text-zinc-500" : "text-zinc-400")}>Sign here:</div>
          <div className={cn("w-full h-3 border border-dashed rounded-[2px] relative", isDark ? "border-zinc-600 bg-zinc-700/50" : "border-zinc-300 bg-zinc-50")}>
            {/* Floating Pen Icon */}
            <div className={cn("absolute -right-2 -bottom-2 transform -rotate-12 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5", getPenColor())}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="drop-shadow-sm">
                <path d="M19.07 4.93L17.07 2.93C16.68 2.54 16.05 2.54 15.66 2.93L3.21 15.38C3.06 15.53 2.98 15.74 3 15.96L3.5 19.8C3.55 20.23 3.91 20.55 4.34 20.55H4.51C4.54 20.55 4.56 20.55 4.58 20.55L8.46 20.1C8.68 20.08 8.89 20 9.04 19.85L21.49 7.4C21.88 7.01 21.88 6.38 21.49 5.99L19.49 3.99L19.07 4.93ZM16.36 3.64L18.36 5.64L17.5 6.5L15.5 4.5L16.36 3.64Z" />
              </svg>
            </div>
            {/* SVG Signature */}
            <svg className="absolute inset-0 w-full h-full p-0.5 pointer-events-none" viewBox="0 0 30 15">
              <path
                d="M2,10 C5,5 8,12 12,5 C15,2 18,10 25,8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className={cn(isDark ? "text-zinc-300" : "text-zinc-800")}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 정부지원사업 (Government Programs)
function MiniGovernmentProgramsPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getAccentBg = () => {
    switch (accentColor) {
      case 'purple': return 'bg-purple-500'
      case 'blue': return 'bg-blue-500'
      case 'green': return 'bg-green-500'
      case 'orange': return 'bg-orange-500'
      case 'pink': return 'bg-pink-500'
      case 'red': return 'bg-red-500'
      case 'yellow': return 'bg-yellow-500'
      case 'cyan': return 'bg-cyan-500'
      default: return 'bg-blue-500'
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3">
      <div className="flex flex-col items-center gap-2">
        {/* 로켓 아이콘 */}
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center transform -rotate-45',
          getAccentBg()
        )}>
          <svg className="w-5 h-5 text-white transform rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          </svg>
        </div>
        {/* 미니 진행 바 */}
        <div className="w-12 space-y-1">
          <div className={cn('h-1 rounded-full', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
            <div className={cn('h-1 rounded-full w-3/4', getAccentBg())} />
          </div>
          <div className={cn('h-1 rounded-full', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
            <div className={cn('h-1 rounded-full w-1/2', getAccentBg(), 'opacity-70')} />
          </div>
        </div>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 자료수집 (High-Fidelity Server Rack)
function MiniDataCollectionPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getGlowColor = () => {
    switch (accentColor) {
      case 'purple': return 'text-purple-500 shadow-purple-500/50'
      case 'blue': return 'text-blue-500 shadow-blue-500/50'
      default: return 'text-blue-500 shadow-blue-500/50'
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3">
      <div className="flex gap-1 items-end">
        {/* Server Unit 1 */}
        <div className={cn(
          "w-3 h-10 rounded-[1px] border-x border-t border-b-2 flex flex-col justify-between py-1 px-[1px]",
          isDark ? "bg-zinc-800 border-zinc-700 border-b-zinc-900" : "bg-zinc-100 border-zinc-300 border-b-zinc-400"
        )}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-[1px]">
              <div className={cn("w-full h-[2px] rounded-[0.5px]", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
              {i === 2 && <div className={cn("w-1 h-[2px] rounded-[0.5px] animate-pulse bg-current", getGlowColor().split(' ')[0])} />}
            </div>
          ))}
        </div>

        {/* Server Unit 2 (Taller) */}
        <div className={cn(
          "w-4 h-12 rounded-[1px] border-x border-t border-b-2 flex flex-col justify-evenly py-1 px-[2px] relative overflow-hidden",
          isDark ? "bg-zinc-800 border-zinc-700 border-b-zinc-900" : "bg-zinc-100 border-zinc-300 border-b-zinc-400"
        )}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={cn("w-full h-1 rounded-[0.5px]", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
          ))}

          {/* Data Flow Particles */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className={cn("w-1 h-1 rounded-full animate-ping bg-current opacity-75", getGlowColor().split(' ')[0])} />
          </div>
        </div>

        {/* Server Unit 3 */}
        <div className={cn(
          "w-3 h-8 rounded-[1px] border-x border-t border-b-2 flex flex-col justify-between py-1 px-[1px]",
          isDark ? "bg-zinc-800 border-zinc-700 border-b-zinc-900" : "bg-zinc-100 border-zinc-300 border-b-zinc-400"
        )}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className={cn("w-full h-[2px] rounded-[0.5px]", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
          ))}
        </div>
      </div>
    </div>
  )
}

// API 데이터 타입
interface ERPDashboardData {
  employees: { total: number; active: number; on_leave: number; today_attendance: number }
  financials: { monthly_sales: number; monthly_purchases: number; monthly_profit: number }
  monthly_trend: Array<{ month: string; sales: number; purchases: number }>
}

interface ApprovalStats {
  inbox: number; sent: number; drafts: number; completed: number
  monthly: { total: number; approved: number; rejected: number; pending: number }
}

export default function CompanyDashboardPage() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore() // Call hook here too for container styling
  const isDark = mounted ? resolvedTheme === 'dark' : false
  const [isWidgetBarOpen, setIsWidgetBarOpen] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  const router = useRouter()

  // SWR hooks로 데이터 로드 (캐시 적용)
  const { data: erpResponse } = useERPDashboard()
  const { data: approvalResponse } = useApprovalStats()

  // Google 캘린더 날짜 범위 계산
  const calendarDateRange = useMemo(() => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      timeMin: firstDay.toISOString(),
      timeMax: lastDay.toISOString()
    }
  }, [])

  const { data: calendarResponse } = useGoogleCalendarEvents(
    calendarDateRange.timeMin,
    calendarDateRange.timeMax
  )

  // 데이터 추출
  const erpData: ERPDashboardData | null = erpResponse?.success ? erpResponse.data : null
  const approvalStats: ApprovalStats | null = approvalResponse?.success ? approvalResponse.data : null

  // 캘린더 이벤트 처리
  const { calendarEvents, upcomingEvents } = useMemo(() => {
    if (!calendarResponse?.events) {
      return { calendarEvents: [] as number[], upcomingEvents: [] as Array<{ date: number; title: string }> }
    }

    const eventDays = calendarResponse.events.map((e: any) => new Date(e.start_time).getDate())
    const now = new Date()
    const today = now.getDate()

    const upcoming = calendarResponse.events
      .filter((e: any) => {
        const eventDate = new Date(e.start_time).getDate()
        return eventDate >= today && eventDate <= today + 2
      })
      .slice(0, 3)
      .map((e: any) => ({
        date: new Date(e.start_time).getDate(),
        title: e.summary || '일정'
      }))

    return { calendarEvents: eventDays, upcomingEvents: upcoming }
  }, [calendarResponse])

  const widgetPreviews = [
    { id: 'calendar', title: '자금 캘린더', href: '/dashboard-group/company/calendar', preview: <MiniCalendarPreview isDark={isDark} /> },
    { id: 'approval', title: '전자결재 진행현황', href: '/dashboard-group/finance/transactions', preview: <MiniChartPreview isDark={isDark} type="bar" /> },
    { id: 'workforce', title: '인력현황', href: '/dashboard-group/hr/employees', preview: <MiniChartPreview isDark={isDark} type="line" /> },
    { id: 'sales', title: '매출입 현황', href: '/dashboard-group/sales/sales-list', preview: <MiniChartPreview isDark={isDark} type="bar" /> },
    { id: 'tax-invoice', title: '매출 전자세금계산서 발행현황', href: '/dashboard-group/sales/tax-invoice', preview: <MiniTaxInvoicePreview isDark={isDark} /> },
    { id: 'account', title: '계좌 잔액 현황', href: '/dashboard-group/finance/accounts', preview: <MiniAccountPreview isDark={isDark} /> },
    { id: 'education', title: '교육 현황', href: '/dashboard-group/hr/training-status', preview: <MiniPlayPreview isDark={isDark} /> },
    { id: 'contract', title: '전자계약 진행현황', href: '/dashboard-group/hr/contracts', preview: <MiniContractPreview isDark={isDark} /> },
    { id: 'government-programs', title: '정부지원사업', href: '/dashboard-group/company/government-programs', preview: <MiniGovernmentProgramsPreview isDark={isDark} /> },
    { id: 'data-collection', title: '기관별 자료수집 이력', href: '/dashboard-group/company/data-collection', preview: <MiniDataCollectionPreview isDark={isDark} /> },
  ]

  // Copy-paste of the robust theme class generator from Sidebar
  const getThemeClasses = () => {
    switch (accentColor) {
      case 'purple': return { border: 'hover:border-purple-500', text: 'group-hover:text-purple-600 dark:group-hover:text-purple-400', bg: 'hover:bg-purple-50 dark:hover:bg-purple-900/10' }
      case 'green': return { border: 'hover:border-green-500', text: 'group-hover:text-green-600 dark:group-hover:text-green-400', bg: 'hover:bg-green-50 dark:hover:bg-green-900/10' }
      case 'orange': return { border: 'hover:border-orange-500', text: 'group-hover:text-orange-600 dark:group-hover:text-orange-400', bg: 'hover:bg-orange-50 dark:hover:bg-orange-900/10' }
      case 'pink': return { border: 'hover:border-pink-500', text: 'group-hover:text-pink-600 dark:group-hover:text-pink-400', bg: 'hover:bg-pink-50 dark:hover:bg-pink-900/10' }
      case 'red': return { border: 'hover:border-red-500', text: 'group-hover:text-red-600 dark:group-hover:text-red-400', bg: 'hover:bg-red-50 dark:hover:bg-red-900/10' }
      case 'yellow': return { border: 'hover:border-yellow-500', text: 'group-hover:text-yellow-600 dark:group-hover:text-yellow-400', bg: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/10' }
      case 'cyan': return { border: 'hover:border-cyan-500', text: 'group-hover:text-cyan-600 dark:group-hover:text-cyan-400', bg: 'hover:bg-cyan-50 dark:hover:bg-cyan-900/10' }
      case 'blue': default: return { border: 'hover:border-blue-500', text: 'group-hover:text-blue-600 dark:group-hover:text-blue-400', bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/10' }
    }
  }

  const theme = getThemeClasses()

  return (
    <div className="space-y-6">
      {/* 위젯 슬라이드 바 */}
      <div className={cn(
        'border-b transition-all duration-300 -mt-4 -mx-8 px-8',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        {/* 헤더 */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className={cn('text-sm font-bold', isDark ? 'text-zinc-100' : 'text-zinc-900')}>홈</span>
            <Settings className={cn('w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
            <div className={cn('w-24 h-px', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />
          </div>
          <div className="flex items-center gap-2">
            <button className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors',
              isDark ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            )}>
              <X className="w-3.5 h-3.5" />
              취소
            </button>
            <button className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors',
              isDark ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            )}>
              <Check className="w-3.5 h-3.5" />
              저장
            </button>
            <button
              onClick={() => setIsWidgetBarOpen(!isWidgetBarOpen)}
              className={cn(
                'p-1.5 rounded transition-colors ml-2',
                isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-500'
              )}
            >
              {isWidgetBarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 위젯 미리보기 슬라이드 */}
        <div className={cn(
          'transition-all duration-300 overflow-hidden',
          isWidgetBarOpen ? 'max-h-60 pb-6' : 'max-h-0'
        )}>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {widgetPreviews.map((widget) => (
              <div
                key={widget.id}
                onClick={() => router.push(widget.href)}
                className={cn(
                  'group rounded-lg border overflow-hidden cursor-pointer transition-all duration-200 flex-shrink-0 w-[calc((100%-2.25rem)/9)]',
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200',
                  theme.border, // Hover border color from theme
                  theme.bg // Hover background tint from theme
                )}
              >
                <div className={cn(
                  'h-24 transition-colors',
                  isDark ? 'bg-zinc-800/50' : 'bg-zinc-50/50',
                  'group-hover:bg-transparent' // Let container bg show through on hover
                )}>
                  {widget.preview}
                </div>
                <div className={cn(
                  'px-2 py-2.5 border-t text-center transition-colors',
                  isDark ? 'border-zinc-700' : 'border-zinc-100',
                  'group-hover:border-transparent'
                )}>
                  <p className={cn(
                    'text-[11px] font-bold leading-tight line-clamp-2 transition-colors',
                    isDark ? 'text-zinc-400' : 'text-zinc-600',
                    theme.text // Hover text color from theme
                  )}>
                    {widget.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3컬럼 그리드 레이아웃 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 왼쪽 컬럼 */}
        <div className="space-y-4">
          <CalendarWidget isDark={isDark} eventDays={calendarEvents} />
          <TodoWidget isDark={isDark} events={upcomingEvents} />
          <SalesWidget isDark={isDark} financials={erpData?.financials} />
          <TrainingWidget isDark={isDark} />
        </div>

        {/* 가운데 컬럼 */}
        <div className="space-y-4">
          <NoticeWidget isDark={isDark} />
          <PaymentProgressWidget isDark={isDark} approvalData={approvalStats} />
          <TaxInvoiceWidget isDark={isDark} />
          <ContractProgressWidget isDark={isDark} />
        </div>

        {/* 오른쪽 컬럼 */}
        <div className="space-y-4">
          <HRStatusWidget isDark={isDark} employeesData={erpData?.employees} />
          <AccountBalanceWidget isDark={isDark} />
          <DataCollectionWidget isDark={isDark} />
        </div>
      </div>
    </div>
  )
}
