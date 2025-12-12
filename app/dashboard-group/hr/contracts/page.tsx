'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  FileSignature,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Filter,
  Download
} from 'lucide-react'

const contractsData = [
  {
    id: '1',
    title: '근로계약서',
    employee: '김신입',
    type: 'employment',
    createdDate: '2024-12-15',
    deadline: '2024-12-20',
    status: 'pending_signature',
    signers: [
      { name: '김신입', status: 'pending' },
      { name: '이인사', status: 'signed' }
    ]
  },
  {
    id: '2',
    title: '비밀유지계약서',
    employee: '박개발',
    type: 'nda',
    createdDate: '2024-12-14',
    deadline: '2024-12-19',
    status: 'completed',
    signers: [
      { name: '박개발', status: 'signed' },
      { name: '최CTO', status: 'signed' }
    ]
  },
  {
    id: '3',
    title: '연봉계약서',
    employee: '이영업',
    type: 'salary',
    createdDate: '2024-12-13',
    deadline: '2024-12-18',
    status: 'completed',
    signers: [
      { name: '이영업', status: 'signed' },
      { name: '김대표', status: 'signed' }
    ]
  },
  {
    id: '4',
    title: '업무위탁계약서',
    employee: '프리랜서A',
    type: 'freelance',
    createdDate: '2024-12-12',
    deadline: '2024-12-17',
    status: 'sent',
    signers: [
      { name: '프리랜서A', status: 'pending' },
      { name: '박팀장', status: 'signed' }
    ]
  },
  {
    id: '5',
    title: '근로계약 갱신',
    employee: '최마케팅',
    type: 'renewal',
    createdDate: '2024-12-11',
    deadline: '2024-12-31',
    status: 'draft',
    signers: [
      { name: '최마케팅', status: 'pending' },
      { name: '이인사', status: 'pending' }
    ]
  }
]

export default function ContractsPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [filter, setFilter] = useState<string>('all')

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: '완료', color: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700', icon: CheckCircle2 }
      case 'pending_signature':
        return { label: '서명대기', color: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700', icon: Clock }
      case 'sent':
        return { label: '발송완료', color: isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700', icon: Send }
      case 'draft':
        return { label: '작성중', color: isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600', icon: FileSignature }
      default:
        return { label: '알수없음', color: isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600', icon: AlertCircle }
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'employment': return '근로계약'
      case 'nda': return 'NDA'
      case 'salary': return '연봉계약'
      case 'freelance': return '업무위탁'
      case 'renewal': return '계약갱신'
      default: return type
    }
  }

  const filteredData = filter === 'all'
    ? contractsData
    : contractsData.filter(c => c.status === filter)

  const stats = {
    total: contractsData.length,
    completed: contractsData.filter(c => c.status === 'completed').length,
    pending: contractsData.filter(c => ['pending_signature', 'sent'].includes(c.status)).length,
    draft: contractsData.filter(c => c.status === 'draft').length
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
              전자계약 진행현황
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              전자계약 작성 및 서명 현황을 관리하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <Plus className="w-4 h-4" />
          계약서 작성
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체', value: stats.total, icon: FileSignature, color: 'text-zinc-500' },
          { label: '완료', value: stats.completed, icon: CheckCircle2, color: 'text-green-500' },
          { label: '진행중', value: stats.pending, icon: Clock, color: 'text-yellow-500' },
          { label: '작성중', value: stats.draft, icon: FileSignature, color: 'text-blue-500' }
        ].map(stat => (
          <div
            key={stat.label}
            className={cn(
              'p-4 rounded-xl border',
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            )}
          >
            <div className="flex items-center gap-3">
              <stat.icon className={cn('w-5 h-5', stat.color)} />
              <div>
                <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{stat.label}</p>
                <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{stat.value}건</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <Filter className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
        {['all', 'completed', 'pending_signature', 'sent', 'draft'].map(f => (
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
            {f === 'all' ? '전체' : f === 'completed' ? '완료' : f === 'pending_signature' ? '서명대기' : f === 'sent' ? '발송완료' : '작성중'}
          </button>
        ))}
      </div>

      {/* 계약 목록 */}
      <div className="space-y-4">
        {filteredData.map(contract => {
          const statusInfo = getStatusInfo(contract.status)
          const StatusIcon = statusInfo.icon

          return (
            <div
              key={contract.id}
              className={cn(
                'p-4 rounded-xl border transition-colors cursor-pointer',
                isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                      {contract.title}
                    </h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                    )}>
                      {getTypeLabel(contract.type)}
                    </span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1',
                      statusInfo.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className={cn('text-sm mb-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    대상: {contract.employee}
                  </p>
                  <div className={cn('flex items-center gap-4 text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    <span>작성일: {contract.createdDate}</span>
                    <span>마감일: {contract.deadline}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn('text-xs mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>서명 현황</p>
                  <div className="flex items-center gap-2">
                    {contract.signers.map((signer, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'px-2 py-1 rounded text-xs flex items-center gap-1',
                          signer.status === 'signed'
                            ? isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                            : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                        )}
                      >
                        {signer.status === 'signed' && <CheckCircle2 className="w-3 h-3" />}
                        {signer.name}
                      </div>
                    ))}
                  </div>
                  {contract.status === 'completed' && (
                    <button className={cn(
                      'mt-2 flex items-center gap-1 text-xs',
                      isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-700'
                    )}>
                      <Download className="w-3 h-3" />
                      다운로드
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
