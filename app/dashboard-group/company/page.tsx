'use client'

import { useState } from 'react'
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
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd, setRangeEnd] = useState(100)

  const hrData = [
    { month: '2025-07', total: 0.35, joined: 0.1, left: 0.05 },
    { month: '2025-08', total: 0.4, joined: 0.15, left: 0.1 },
    { month: '2025-09', total: 0.55, joined: 0.2, left: 0.05 },
    { month: '2025-10', total: 0.65, joined: 0.1, left: 0.1 },
    { month: '2025-11', total: 0.75, joined: 0.2, left: 0.1 },
    { month: '2025-12', total: 0.85, joined: 0.15, left: 0.05 },
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

// 위젯 미리보기 - 세금계산서 (문서 + 도장)
function MiniTaxInvoicePreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getFillColor = () => {
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
    <div className="h-full flex items-center justify-center p-3">
      {/* Document Shape */}
      <div className={cn(
        "relative w-10 h-14 rounded-sm border flex flex-col items-center pt-2 gap-1",
        isDark ? "bg-zinc-800 border-zinc-600" : "bg-white border-zinc-300 shadow-sm"
      )}>
        <div className={cn("w-6 h-0.5 rounded-full", isDark ? "bg-zinc-600" : "bg-zinc-200")} />
        <div className={cn("w-6 h-0.5 rounded-full", isDark ? "bg-zinc-600" : "bg-zinc-200")} />
        <div className={cn("w-4 h-0.5 rounded-full", isDark ? "bg-zinc-600" : "bg-zinc-200")} />

        {/* Stamp/Badge */}
        <div className="absolute bottom-2 right-[-4px] rounded-full p-0.5 bg-white dark:bg-zinc-900 border border-transparent shadow-sm">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: getFillColor() }}>
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 계좌 (카드)
function MiniAccountPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getGradientClass = () => {
    switch (accentColor) {
      case 'purple': return 'from-purple-500 to-purple-600'
      case 'blue': return 'from-blue-500 to-blue-600'
      case 'green': return 'from-green-500 to-green-600'
      case 'orange': return 'from-orange-500 to-orange-600'
      case 'pink': return 'from-pink-500 to-pink-600'
      case 'red': return 'from-red-500 to-red-600'
      case 'yellow': return 'from-yellow-500 to-yellow-600'
      case 'cyan': return 'from-cyan-500 to-cyan-600'
      default: return 'from-blue-500 to-blue-600'
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-3">
      {/* Card Shape */}
      <div className={cn(
        "w-12 h-8 rounded-md bg-gradient-to-br shadow-sm flex flex-col justify-between p-1.5",
        getGradientClass()
      )}>
        <div className="w-2 h-1.5 rounded-[1px] bg-white/30" />
        <div className="flex gap-1 justify-end">
          <div className="w-1 h-1 rounded-full bg-white/50" />
          <div className="w-1 h-1 rounded-full bg-white/50" />
        </div>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 전자계약 (서명)
function MiniContractPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getStrokeColor = () => {
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
    <div className="h-full flex items-center justify-center p-3">
      <div className={cn(
        "w-10 h-12 rounded-sm border flex flex-col justify-end p-2 gap-1.5",
        isDark ? "bg-zinc-800 border-zinc-600" : "bg-white border-zinc-300"
      )}>
        <div className={cn("w-full h-0.5 rounded-full mb-auto mt-1", isDark ? "bg-zinc-600" : "bg-zinc-100")} />

        {/* Signature Line */}
        <div className="relative">
          <div className={cn("w-full h-px", isDark ? "bg-zinc-600" : "bg-zinc-200")} />
          {/* Signature Scribble */}
          <svg className="absolute bottom-0.5 left-0 w-full h-4 overflow-visible">
            <path
              d="M2,10 Q5,4 8,8 T15,6 T22,8"
              fill="none"
              stroke={getStrokeColor()}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

// 위젯 미리보기 - 자료수집 (클라우드/서버)
function MiniDataCollectionPreview({ isDark }: { isDark: boolean }) {
  const { accentColor } = useThemeStore()

  const getFillColor = () => {
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
        "relative w-10 h-10 rounded-full flex items-center justify-center border",
        isDark ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200"
      )}>
        {/* Arrows */}
        <svg
          viewBox="0 0 24 24"
          className={cn("w-5 h-5 animate-pulse", getFillColor())}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
      </div>
    </div>
  )
}

export default function CompanyDashboardPage() {
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore() // Call hook here too for container styling
  const isDark = resolvedTheme === 'dark'
  const [isWidgetBarOpen, setIsWidgetBarOpen] = useState(true)

  const router = useRouter()

  const widgetPreviews = [
    { id: 'calendar', title: '자금 캘린더', href: '/dashboard-group/company/calendar', preview: <MiniCalendarPreview isDark={isDark} /> },
    { id: 'approval', title: '전자결재 진행현황', href: '/dashboard-group/finance/transactions', preview: <MiniChartPreview isDark={isDark} type="bar" /> },
    { id: 'workforce', title: '인력현황', href: '/dashboard-group/hr/employees', preview: <MiniChartPreview isDark={isDark} type="line" /> },
    { id: 'sales', title: '매출입 현황', href: '/dashboard-group/sales/sales-list', preview: <MiniChartPreview isDark={isDark} type="bar" /> },
    { id: 'tax-invoice', title: '매출 전자세금계산서 발행현황', href: '/dashboard-group/sales/tax-invoice', preview: <MiniTaxInvoicePreview isDark={isDark} /> },
    { id: 'account', title: '계좌 잔액 현황', href: '/dashboard-group/finance/accounts', preview: <MiniAccountPreview isDark={isDark} /> },
    { id: 'education', title: '교육 현황', href: '/dashboard-group/hr/training-status', preview: <MiniPlayPreview isDark={isDark} /> },
    { id: 'contract', title: '전자계약 진행현황', href: '/dashboard-group/hr/contracts', preview: <MiniContractPreview isDark={isDark} /> },
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

        {/* 위젯 미리보기 그리드 */}
        <div className={cn(
          'transition-all duration-300 overflow-hidden',
          isWidgetBarOpen ? 'max-h-60 pb-6' : 'max-h-0'
        )}>
          <div className="grid grid-cols-9 gap-3">
            {widgetPreviews.map((widget) => (
              <div
                key={widget.id}
                onClick={() => router.push(widget.href)}
                className={cn(
                  'group rounded-lg border overflow-hidden cursor-pointer transition-all duration-200',
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
