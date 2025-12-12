'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  FileCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  FileText
} from 'lucide-react'

const transactionsData = [
  {
    id: '1',
    title: '12월 사무용품 구매',
    amount: 350000,
    requester: '김경영',
    department: '경영지원팀',
    date: '2024-12-15',
    status: 'pending',
    approvers: ['이과장', '박부장'],
    currentStep: 1
  },
  {
    id: '2',
    title: '외부 미팅 교통비',
    amount: 85000,
    requester: '박영업',
    department: '영업팀',
    date: '2024-12-14',
    status: 'approved',
    approvers: ['김팀장'],
    currentStep: 1
  },
  {
    id: '3',
    title: '클라우드 서비스 비용',
    amount: 1200000,
    requester: '이개발',
    department: '개발팀',
    date: '2024-12-13',
    status: 'approved',
    approvers: ['최CTO', '김대표'],
    currentStep: 2
  },
  {
    id: '4',
    title: '마케팅 광고비',
    amount: 5000000,
    requester: '정마케팅',
    department: '마케팅팀',
    date: '2024-12-12',
    status: 'in_review',
    approvers: ['이팀장', '박이사', '김대표'],
    currentStep: 2
  },
  {
    id: '5',
    title: '출장 경비',
    amount: 450000,
    requester: '최영업',
    department: '영업팀',
    date: '2024-12-11',
    status: 'rejected',
    approvers: ['김팀장'],
    currentStep: 1,
    rejectReason: '영수증 미첨부'
  },
  {
    id: '6',
    title: '소프트웨어 라이선스',
    amount: 2400000,
    requester: '이개발',
    department: '개발팀',
    date: '2024-12-10',
    status: 'approved',
    approvers: ['최CTO'],
    currentStep: 1
  }
]

export default function TransactionsPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [filter, setFilter] = useState<string>('all')

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: '승인완료', color: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700', icon: CheckCircle2 }
      case 'pending':
        return { label: '대기중', color: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700', icon: Clock }
      case 'in_review':
        return { label: '검토중', color: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700', icon: FileCheck }
      case 'rejected':
        return { label: '반려', color: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700', icon: XCircle }
      default:
        return { label: '알수없음', color: isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600', icon: FileText }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)
  }

  const filteredData = filter === 'all'
    ? transactionsData
    : transactionsData.filter(t => t.status === filter)

  const stats = {
    total: transactionsData.length,
    pending: transactionsData.filter(t => t.status === 'pending').length,
    inReview: transactionsData.filter(t => t.status === 'in_review').length,
    approved: transactionsData.filter(t => t.status === 'approved').length,
    rejected: transactionsData.filter(t => t.status === 'rejected').length
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
              전자결제 진행현황
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              결재 요청 및 승인 현황을 확인하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <Plus className="w-4 h-4" />
          결재 요청
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: '전체', value: stats.total, color: 'text-zinc-500' },
          { label: '대기중', value: stats.pending, color: 'text-yellow-500' },
          { label: '검토중', value: stats.inReview, color: 'text-blue-500' },
          { label: '승인완료', value: stats.approved, color: 'text-green-500' },
          { label: '반려', value: stats.rejected, color: 'text-red-500' }
        ].map(stat => (
          <div
            key={stat.label}
            className={cn(
              'p-4 rounded-xl border text-center',
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            )}
          >
            <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Filter className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
        {['all', 'pending', 'in_review', 'approved', 'rejected'].map(f => (
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
            {f === 'all' ? '전체' : f === 'pending' ? '대기중' : f === 'in_review' ? '검토중' : f === 'approved' ? '승인완료' : '반려'}
          </button>
        ))}
      </div>

      {/* 결재 목록 */}
      <div className="space-y-4">
        {filteredData.map(transaction => {
          const statusInfo = getStatusInfo(transaction.status)
          const StatusIcon = statusInfo.icon

          return (
            <div
              key={transaction.id}
              className={cn(
                'p-4 rounded-xl border transition-colors',
                isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                      {transaction.title}
                    </h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1',
                      statusInfo.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className={cn('flex items-center gap-4 text-sm mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    <span>신청자: {transaction.requester}</span>
                    <span>{transaction.department}</span>
                    <span>{transaction.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>결재선:</span>
                    {transaction.approvers.map((approver, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          idx < transaction.currentStep
                            ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                            : idx === transaction.currentStep && transaction.status !== 'rejected'
                            ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                            : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                        )}
                      >
                        {approver}
                      </span>
                    ))}
                  </div>
                  {transaction.rejectReason && (
                    <p className="text-sm text-red-500 mt-2">반려 사유: {transaction.rejectReason}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
