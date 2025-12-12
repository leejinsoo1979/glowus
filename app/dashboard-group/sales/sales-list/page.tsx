'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  Download,
  Filter,
  Search
} from 'lucide-react'

const salesData = [
  { id: '1', date: '2024-12-15', type: 'income', category: '매출', description: '제품 판매 - A사', amount: 15000000, status: 'completed' },
  { id: '2', date: '2024-12-14', type: 'expense', category: '인건비', description: '12월 급여', amount: 8500000, status: 'completed' },
  { id: '3', date: '2024-12-13', type: 'income', category: '매출', description: '서비스 이용료 - B사', amount: 5200000, status: 'completed' },
  { id: '4', date: '2024-12-12', type: 'expense', category: '운영비', description: '사무실 임대료', amount: 3000000, status: 'completed' },
  { id: '5', date: '2024-12-11', type: 'income', category: '기타수입', description: '이자 수익', amount: 125000, status: 'completed' },
  { id: '6', date: '2024-12-10', type: 'expense', category: '마케팅', description: 'SNS 광고비', amount: 2500000, status: 'pending' },
  { id: '7', date: '2024-12-09', type: 'income', category: '매출', description: '컨설팅 수수료', amount: 8000000, status: 'completed' },
  { id: '8', date: '2024-12-08', type: 'expense', category: '운영비', description: '클라우드 서비스 비용', amount: 1200000, status: 'completed' },
]

export default function SalesListPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const totalIncome = salesData.filter(s => s.type === 'income').reduce((sum, s) => sum + s.amount, 0)
  const totalExpense = salesData.filter(s => s.type === 'expense').reduce((sum, s) => sum + s.amount, 0)
  const balance = totalIncome - totalExpense

  const filteredData = salesData.filter(s => {
    const matchesFilter = filter === 'all' || s.type === filter
    const matchesSearch = s.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard-group/company')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              매출입 현황
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              수입과 지출 내역을 확인하세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          )}>
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-accent text-white hover:bg-accent/90'
          )}>
            <Plus className="w-4 h-4" />
            거래 추가
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center justify-between">
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>총 수입</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-500 mt-2">{formatCurrency(totalIncome)}</p>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center justify-between">
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>총 지출</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500 mt-2">{formatCurrency(totalExpense)}</p>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center justify-between">
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>순이익</span>
          </div>
          <p className={cn('text-2xl font-bold mt-2', balance >= 0 ? 'text-green-500' : 'text-red-500')}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>

      {/* 필터 & 검색 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
          {(['all', 'income', 'expense'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-accent text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              )}
            >
              {f === 'all' ? '전체' : f === 'income' ? '수입' : '지출'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
          <input
            type="text"
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'pl-10 pr-4 py-2 rounded-lg border text-sm',
              isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            )}
          />
        </div>
      </div>

      {/* 거래 목록 */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <table className="w-full">
          <thead>
            <tr className={isDark ? 'bg-zinc-800' : 'bg-zinc-50'}>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>날짜</th>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>구분</th>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>카테고리</th>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>내용</th>
              <th className={cn('px-4 py-3 text-right text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>금액</th>
              <th className={cn('px-4 py-3 text-center text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>상태</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(item => (
              <tr key={item.id} className={cn(
                'border-t transition-colors',
                isDark ? 'border-zinc-800 hover:bg-zinc-800/50' : 'border-zinc-100 hover:bg-zinc-50'
              )}>
                <td className={cn('px-4 py-3 text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{item.date}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    item.type === 'income'
                      ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                      : isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                  )}>
                    {item.type === 'income' ? '수입' : '지출'}
                  </span>
                </td>
                <td className={cn('px-4 py-3 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{item.category}</td>
                <td className={cn('px-4 py-3 text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{item.description}</td>
                <td className={cn('px-4 py-3 text-sm text-right font-medium', item.type === 'income' ? 'text-green-500' : 'text-red-500')}>
                  {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    item.status === 'completed'
                      ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                      : isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                  )}>
                    {item.status === 'completed' ? '완료' : '대기'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
