'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Download,
  Calendar
} from 'lucide-react'

const dataCollectionData = [
  {
    id: '1',
    institution: '국세청',
    dataType: '세금계산서',
    lastSync: '2024-12-15 10:30',
    status: 'success',
    records: 156,
    period: '2024.12'
  },
  {
    id: '2',
    institution: '4대보험',
    dataType: '보험료 내역',
    lastSync: '2024-12-15 10:25',
    status: 'success',
    records: 28,
    period: '2024.11'
  },
  {
    id: '3',
    institution: '은행 (신한)',
    dataType: '계좌 거래내역',
    lastSync: '2024-12-15 10:00',
    status: 'success',
    records: 89,
    period: '2024.12'
  },
  {
    id: '4',
    institution: '은행 (국민)',
    dataType: '계좌 거래내역',
    lastSync: '2024-12-15 09:55',
    status: 'success',
    records: 45,
    period: '2024.12'
  },
  {
    id: '5',
    institution: '카드사 (삼성)',
    dataType: '카드 매출',
    lastSync: '2024-12-14 23:00',
    status: 'warning',
    records: 234,
    period: '2024.12',
    message: '일부 데이터 누락'
  },
  {
    id: '6',
    institution: '고용노동부',
    dataType: '고용보험 이력',
    lastSync: '2024-12-10 15:00',
    status: 'pending',
    records: 0,
    period: '2024.11',
    message: '연동 대기중'
  },
  {
    id: '7',
    institution: '건강보험공단',
    dataType: '건강보험 내역',
    lastSync: '2024-12-12 14:30',
    status: 'error',
    records: 0,
    period: '2024.11',
    message: '인증 만료'
  }
]

export default function DataCollectionPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [syncing, setSyncing] = useState<string | null>(null)

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'success':
        return { label: '정상', color: isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700', icon: CheckCircle2 }
      case 'warning':
        return { label: '주의', color: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700', icon: AlertCircle }
      case 'error':
        return { label: '오류', color: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700', icon: AlertCircle }
      case 'pending':
        return { label: '대기', color: isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600', icon: Clock }
      default:
        return { label: '알수없음', color: isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600', icon: Clock }
    }
  }

  const handleSync = (id: string) => {
    setSyncing(id)
    setTimeout(() => setSyncing(null), 2000)
  }

  const stats = {
    total: dataCollectionData.length,
    success: dataCollectionData.filter(d => d.status === 'success').length,
    warning: dataCollectionData.filter(d => d.status === 'warning').length,
    error: dataCollectionData.filter(d => d.status === 'error').length
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
              기관별 자료수집 이력
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              연동된 기관의 데이터 수집 현황을 확인하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <RefreshCw className="w-4 h-4" />
          전체 동기화
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '총 연동', value: stats.total, color: 'text-zinc-500', bgColor: isDark ? 'bg-zinc-500/20' : 'bg-zinc-100' },
          { label: '정상', value: stats.success, color: 'text-green-500', bgColor: isDark ? 'bg-green-500/20' : 'bg-green-100' },
          { label: '주의', value: stats.warning, color: 'text-yellow-500', bgColor: isDark ? 'bg-yellow-500/20' : 'bg-yellow-100' },
          { label: '오류', value: stats.error, color: 'text-red-500', bgColor: isDark ? 'bg-red-500/20' : 'bg-red-100' }
        ].map(stat => (
          <div
            key={stat.label}
            className={cn(
              'p-4 rounded-xl border',
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                <Building2 className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{stat.label}</p>
                <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{stat.value}개</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 기관 목록 */}
      <div className="space-y-4">
        {dataCollectionData.map(item => {
          const statusInfo = getStatusInfo(item.status)
          const StatusIcon = statusInfo.icon

          return (
            <div
              key={item.id}
              className={cn(
                'p-4 rounded-xl border transition-colors',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-3 rounded-lg',
                    isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                  )}>
                    <Building2 className={cn('w-6 h-6', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                        {item.institution}
                      </h3>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1',
                        statusInfo.color
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      {item.dataType}
                    </p>
                    {item.message && (
                      <p className={cn(
                        'text-xs mt-1',
                        item.status === 'error' ? 'text-red-500' : item.status === 'warning' ? 'text-yellow-500' : 'text-zinc-500'
                      )}>
                        {item.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                      <Calendar className="w-4 h-4" />
                      {item.period}
                    </div>
                    <div className={cn('flex items-center gap-2 text-sm mt-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      <FileText className="w-4 h-4" />
                      {item.records > 0 ? `${item.records}건` : '-'}
                    </div>
                  </div>
                  <div className={cn('text-right text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    <p>마지막 동기화</p>
                    <p>{item.lastSync}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(item.id)}
                      disabled={syncing === item.id}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                      )}
                    >
                      <RefreshCw className={cn('w-4 h-4', syncing === item.id && 'animate-spin')} />
                    </button>
                    {item.records > 0 && (
                      <button className={cn(
                        'p-2 rounded-lg transition-colors',
                        isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                      )}>
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
