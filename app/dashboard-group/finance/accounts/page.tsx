'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  CreditCard,
  Building,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react'

const accountsData = [
  {
    id: '1',
    bank: '신한은행',
    accountName: '운영자금 계좌',
    accountNumber: '110-***-***890',
    balance: 125340000,
    type: 'checking',
    lastUpdated: '2024-12-15 14:30'
  },
  {
    id: '2',
    bank: '국민은행',
    accountName: '급여 계좌',
    accountNumber: '940-***-***123',
    balance: 85000000,
    type: 'checking',
    lastUpdated: '2024-12-15 14:30'
  },
  {
    id: '3',
    bank: '하나은행',
    accountName: '예비자금',
    accountNumber: '142-***-***456',
    balance: 50000000,
    type: 'savings',
    lastUpdated: '2024-12-15 14:30'
  },
  {
    id: '4',
    bank: '우리은행',
    accountName: '투자자금',
    accountNumber: '102-***-***789',
    balance: 200000000,
    type: 'investment',
    lastUpdated: '2024-12-15 14:30'
  }
]

const recentTransactions = [
  { id: '1', description: '제품 판매 - A사', amount: 15000000, type: 'income', date: '2024-12-15', account: '신한은행' },
  { id: '2', description: '12월 급여', amount: 8500000, type: 'expense', date: '2024-12-14', account: '국민은행' },
  { id: '3', description: '클라우드 서비스', amount: 1200000, type: 'expense', date: '2024-12-13', account: '신한은행' },
  { id: '4', description: '서비스 이용료', amount: 5200000, type: 'income', date: '2024-12-12', account: '신한은행' },
  { id: '5', description: '사무실 임대료', amount: 3000000, type: 'expense', date: '2024-12-11', account: '신한은행' },
]

export default function AccountsPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const totalBalance = accountsData.reduce((sum, acc) => sum + acc.balance, 0)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const getBankColor = (bank: string) => {
    switch (bank) {
      case '신한은행': return 'text-blue-500'
      case '국민은행': return 'text-yellow-500'
      case '하나은행': return 'text-green-500'
      case '우리은행': return 'text-sky-500'
      default: return 'text-zinc-500'
    }
  }

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking': return '입출금'
      case 'savings': return '예금'
      case 'investment': return '투자'
      default: return type
    }
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
              계좌 잔액 현황
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              연동된 계좌의 잔액을 확인하세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          )}>
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <button className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-accent text-white hover:bg-accent/90'
          )}>
            <Plus className="w-4 h-4" />
            계좌 추가
          </button>
        </div>
      </div>

      {/* 총 잔액 */}
      <div className={cn(
        'p-6 rounded-xl border',
        isDark ? 'bg-gradient-to-r from-zinc-900 to-zinc-800 border-zinc-700' : 'bg-gradient-to-r from-zinc-50 to-white border-zinc-200'
      )}>
        <p className={cn('text-sm mb-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>총 잔액</p>
        <p className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
          {formatCurrency(totalBalance)}
        </p>
        <p className={cn('text-sm mt-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          마지막 업데이트: 2024-12-15 14:30
        </p>
      </div>

      {/* 계좌 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accountsData.map(account => (
          <div
            key={account.id}
            className={cn(
              'p-4 rounded-xl border transition-colors cursor-pointer',
              isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}>
                  <Building className={cn('w-5 h-5', getBankColor(account.bank))} />
                </div>
                <div>
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    {account.accountName}
                  </h3>
                  <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {account.bank} · {account.accountNumber}
                  </p>
                </div>
              </div>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
              )}>
                {getAccountTypeLabel(account.type)}
              </span>
            </div>
            <div className="flex items-end justify-between">
              <p className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {formatCurrency(account.balance)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 최근 거래 */}
      <div className={cn(
        'rounded-xl border',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
            최근 거래
          </h2>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {recentTransactions.map(tx => (
            <div key={tx.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  tx.type === 'income'
                    ? isDark ? 'bg-green-500/20' : 'bg-green-100'
                    : isDark ? 'bg-red-500/20' : 'bg-red-100'
                )}>
                  {tx.type === 'income' ? (
                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <div>
                  <p className={cn('font-medium', isDark ? 'text-zinc-100' : 'text-zinc-900')}>
                    {tx.description}
                  </p>
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    {tx.account} · {tx.date}
                  </p>
                </div>
              </div>
              <p className={cn(
                'font-semibold',
                tx.type === 'income' ? 'text-green-500' : 'text-red-500'
              )}>
                {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
