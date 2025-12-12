'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  FileText,
} from 'lucide-react'

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
function CalendarWidget({ isDark }: { isDark: boolean }) {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 11, 1))
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

  const todayEvents = [12, 25, 26]

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
function TodoWidget({ isDark }: { isDark: boolean }) {
  const router = useRouter()
  const todos = [
    { date: 12, label: 'Today', items: ['등록된 일정이 없습니다.'], color: 'bg-accent' },
    { date: 13, label: '', items: ['등록된 일정이 없습니다.'], color: 'bg-zinc-400' },
    { date: 14, label: '', items: ['등록된 일정이 없습니다.'], color: 'bg-amber-500' },
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
function SalesWidget({ isDark }: { isDark: boolean }) {
  const [tab, setTab] = useState<'sales' | 'purchase'>('sales')

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
        <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          매출 내역에 등록된 건이 없습니다.
        </p>
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
function PaymentProgressWidget({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="전자결제 진행현황" href="/dashboard-group/finance/transactions" isDark={isDark} />

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
function HRStatusWidget({ isDark }: { isDark: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      <WidgetHeader title="인력 현황" href="/dashboard-group/hr/employees" isDark={isDark} />

      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>총인원</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>입사자</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>퇴사자</span>
        </div>
      </div>

      <div className={cn(
        'h-32 rounded-lg relative overflow-hidden',
        isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'
      )}>
        <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
          <path
            d="M0,80 L50,75 L100,70 L150,65 L200,60 L250,55 L300,50"
            fill="none"
            stroke="rgb(59, 130, 246)"
            strokeWidth="2"
            opacity="0.8"
          />
          <path
            d="M0,90 L50,88 L100,85 L150,82 L200,80 L250,78 L300,75"
            fill="none"
            stroke="rgb(34, 197, 94)"
            strokeWidth="2"
            opacity="0.8"
          />
        </svg>
        <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-[10px] text-zinc-500">
          <span>2025-07</span>
          <span>2025-08</span>
          <span>2025-09</span>
          <span>2025-10</span>
          <span>2025-11</span>
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

export default function CompanyDashboardPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="space-y-6">
      {/* 탭 헤더 */}
      <div className={cn(
        'flex items-center gap-1 border-b pb-2 -mt-4 -mx-8 px-8',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        {['전자세금계산서 발행', '사원정보관리', '계정상태관리', '연차촉진 현황'].map((tab, i) => (
          <div key={tab} className="flex items-center">
            <button className={cn(
              'px-3 py-2 text-sm',
              i === 0
                ? isDark ? 'text-zinc-100 font-medium' : 'text-zinc-900 font-medium'
                : isDark ? 'text-zinc-500' : 'text-zinc-400'
            )}>
              {tab}
            </button>
            <button className={cn(
              'p-1 rounded hover:bg-zinc-100 text-zinc-400',
              isDark && 'hover:bg-zinc-800'
            )}>
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 3컬럼 그리드 레이아웃 */}
      <div className="grid grid-cols-3 gap-6">
        {/* 왼쪽 컬럼 */}
        <div className="space-y-4">
          <CalendarWidget isDark={isDark} />
          <TodoWidget isDark={isDark} />
          <SalesWidget isDark={isDark} />
          <TrainingWidget isDark={isDark} />
        </div>

        {/* 가운데 컬럼 */}
        <div className="space-y-4">
          <NoticeWidget isDark={isDark} />
          <PaymentProgressWidget isDark={isDark} />
          <TaxInvoiceWidget isDark={isDark} />
          <ContractProgressWidget isDark={isDark} />
        </div>

        {/* 오른쪽 컬럼 */}
        <div className="space-y-4">
          <HRStatusWidget isDark={isDark} />
          <AccountBalanceWidget isDark={isDark} />
          <DataCollectionWidget isDark={isDark} />
        </div>
      </div>
    </div>
  )
}
