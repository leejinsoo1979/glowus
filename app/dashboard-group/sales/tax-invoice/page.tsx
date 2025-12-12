'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  FileText,
  Download,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter
} from 'lucide-react'

const invoiceData = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-1215-001',
    type: 'issued',
    company: '(주)테크솔루션',
    businessNumber: '123-45-67890',
    amount: 15000000,
    tax: 1500000,
    total: 16500000,
    date: '2024-12-15',
    dueDate: '2024-12-31',
    status: 'sent'
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-1214-002',
    type: 'received',
    company: '클라우드서비스(주)',
    businessNumber: '234-56-78901',
    amount: 1200000,
    tax: 120000,
    total: 1320000,
    date: '2024-12-14',
    dueDate: '2024-12-28',
    status: 'confirmed'
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-1213-003',
    type: 'issued',
    company: '스마트비즈(주)',
    businessNumber: '345-67-89012',
    amount: 8000000,
    tax: 800000,
    total: 8800000,
    date: '2024-12-13',
    dueDate: '2024-12-27',
    status: 'pending'
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-1212-004',
    type: 'received',
    company: '오피스플러스',
    businessNumber: '456-78-90123',
    amount: 350000,
    tax: 35000,
    total: 385000,
    date: '2024-12-12',
    dueDate: '2024-12-26',
    status: 'confirmed'
  },
  {
    id: '5',
    invoiceNumber: 'INV-2024-1211-005',
    type: 'issued',
    company: '디지털마케팅(주)',
    businessNumber: '567-89-01234',
    amount: 5200000,
    tax: 520000,
    total: 5720000,
    date: '2024-12-11',
    dueDate: '2024-12-25',
    status: 'sent'
  }
]

export default function TaxInvoicePage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [filter, setFilter] = useState<'all' | 'issued' | 'received'>('all')

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'sent':
        return { label: '발송완료', color: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700', icon: CheckCircle2 }
      case 'confirmed':
        return { label: '확인완료', color: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700', icon: CheckCircle2 }
      case 'pending':
        return { label: '대기중', color: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700', icon: Clock }
      default:
        return { label: '알수없음', color: isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600', icon: AlertCircle }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const filteredData = filter === 'all'
    ? invoiceData
    : invoiceData.filter(inv => inv.type === filter)

  const issuedTotal = invoiceData.filter(inv => inv.type === 'issued').reduce((sum, inv) => sum + inv.total, 0)
  const receivedTotal = invoiceData.filter(inv => inv.type === 'received').reduce((sum, inv) => sum + inv.total, 0)

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
              전자세금계산서
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              세금계산서 발행 및 수취 현황을 관리하세요
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
            발행하기
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
              <Send className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>발행 (매출)</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{formatCurrency(issuedTotal)}</p>
            </div>
          </div>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-orange-500/20' : 'bg-orange-100')}>
              <FileText className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>수취 (매입)</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{formatCurrency(receivedTotal)}</p>
            </div>
          </div>
        </div>
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-green-500/20' : 'bg-green-100')}>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>이번 달 건수</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{invoiceData.length}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Filter className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
        {(['all', 'issued', 'received'] as const).map(f => (
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
            {f === 'all' ? '전체' : f === 'issued' ? '발행' : '수취'}
          </button>
        ))}
      </div>

      {/* 세금계산서 목록 */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
      )}>
        <table className="w-full">
          <thead>
            <tr className={isDark ? 'bg-zinc-800' : 'bg-zinc-50'}>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>계산서번호</th>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>구분</th>
              <th className={cn('px-4 py-3 text-left text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>거래처</th>
              <th className={cn('px-4 py-3 text-right text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>공급가액</th>
              <th className={cn('px-4 py-3 text-right text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>세액</th>
              <th className={cn('px-4 py-3 text-right text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>합계</th>
              <th className={cn('px-4 py-3 text-center text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>상태</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(invoice => {
              const statusInfo = getStatusInfo(invoice.status)
              const StatusIcon = statusInfo.icon

              return (
                <tr key={invoice.id} className={cn(
                  'border-t transition-colors cursor-pointer',
                  isDark ? 'border-zinc-800 hover:bg-zinc-800/50' : 'border-zinc-100 hover:bg-zinc-50'
                )}>
                  <td className={cn('px-4 py-3 text-sm font-mono', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{invoice.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      invoice.type === 'issued'
                        ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                        : isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                    )}>
                      {invoice.type === 'issued' ? '발행' : '수취'}
                    </span>
                  </td>
                  <td className={cn('px-4 py-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                    <div className="text-sm font-medium">{invoice.company}</div>
                    <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{invoice.businessNumber}</div>
                  </td>
                  <td className={cn('px-4 py-3 text-sm text-right', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{formatCurrency(invoice.amount)}</td>
                  <td className={cn('px-4 py-3 text-sm text-right', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{formatCurrency(invoice.tax)}</td>
                  <td className={cn('px-4 py-3 text-sm text-right font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1',
                      statusInfo.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
