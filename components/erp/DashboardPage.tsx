'use client'

import React from 'react'
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { useDashboard } from '@/lib/erp/hooks'
import { PageHeader, StatCard, StatGrid, StatusBadge } from './shared'

export function DashboardPage() {
  const { data, loading } = useDashboard()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatCompact = (amount: number) => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억`
    }
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(0)}만`
    }
    return amount.toLocaleString()
  }

  return (
    <div className="h-full flex flex-col bg-theme">
      <PageHeader
        title="대시보드"
        subtitle={`${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 현황`}
        icon={LayoutDashboard}
      />

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Key Stats */}
        <StatGrid columns={4}>
          <StatCard
            title="전체 직원"
            value={data?.employees?.total || 0}
            subtitle={`재직 ${data?.employees?.active || 0}명`}
            icon={Users}
            iconColor="text-blue-500"
            loading={loading}
          />
          <StatCard
            title="오늘 출근"
            value={data?.employees?.today_attendance || 0}
            subtitle={`출근율 ${data?.employees?.active ? Math.round((data.employees.today_attendance / data.employees.active) * 100) : 0}%`}
            icon={Clock}
            iconColor="text-green-500"
            loading={loading}
          />
          <StatCard
            title="이번 달 매출"
            value={formatCompact(data?.financials?.monthly_sales || 0)}
            icon={TrendingUp}
            iconColor="text-purple-500"
            loading={loading}
          />
          <StatCard
            title="이번 달 매입"
            value={formatCompact(data?.financials?.monthly_purchases || 0)}
            icon={TrendingDown}
            iconColor="text-orange-500"
            loading={loading}
          />
        </StatGrid>

        {/* Financial Overview */}
        <div className="grid grid-cols-3 gap-6">
          {/* Profit Card */}
          <div className="bg-theme-card border border-theme rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-theme-muted">이번 달 손익</h3>
              <DollarSign className="w-5 h-5 text-theme-muted" />
            </div>
            <div className={`text-2xl font-bold ${(data?.financials?.monthly_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(data?.financials?.monthly_profit || 0)}
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm">
              {(data?.financials?.monthly_profit || 0) >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
              <span className="text-theme-muted">매출 - 매입</span>
            </div>
          </div>

          {/* Receivable */}
          <div className="bg-theme-card border border-theme rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-theme-muted">매출채권 (미수금)</h3>
              <Receipt className="w-5 h-5 text-theme-muted" />
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {formatCurrency(data?.financials?.total_receivable || 0)}
            </div>
            <div className="text-sm text-theme-muted mt-2">미회수 잔액</div>
          </div>

          {/* Payable */}
          <div className="bg-theme-card border border-theme rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-theme-muted">매입채무 (미지급금)</h3>
              <Receipt className="w-5 h-5 text-theme-muted" />
            </div>
            <div className="text-2xl font-bold text-orange-400">
              {formatCurrency(data?.financials?.total_payable || 0)}
            </div>
            <div className="text-sm text-theme-muted mt-2">미지급 잔액</div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Pending Items */}
          <div className="bg-theme-card border border-theme rounded-xl p-5">
            <h3 className="text-lg font-semibold text-theme mb-4">처리 대기</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-theme-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  </div>
                  <span className="text-sm text-theme-secondary">휴가 신청</span>
                </div>
                <span className="text-lg font-bold text-yellow-500">
                  {data?.leaves?.pending || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-theme-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Receipt className="w-4 h-4 text-purple-500" />
                  </div>
                  <span className="text-sm text-theme-secondary">경비 신청</span>
                </div>
                <span className="text-lg font-bold text-purple-500">
                  {data?.expenses?.pending || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-theme-card border border-theme rounded-xl p-5">
            <h3 className="text-lg font-semibold text-theme mb-4">최근 거래</h3>
            <div className="space-y-2">
              {data?.recent_transactions?.length > 0 ? (
                data.recent_transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-theme-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tx.transaction_type === 'sales' ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                        {tx.transaction_type === 'sales' ? (
                          <TrendingUp className={`w-4 h-4 text-green-500`} />
                        ) : (
                          <TrendingDown className={`w-4 h-4 text-orange-500`} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-theme-secondary">
                          {tx.partner?.name || tx.transaction_number}
                        </div>
                        <div className="text-xs text-theme-muted">{tx.transaction_date}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-medium ${tx.transaction_type === 'sales' ? 'text-green-400' : 'text-orange-400'}`}>
                      {tx.transaction_type === 'sales' ? '+' : '-'}
                      {formatCompact(tx.total_amount)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-theme-muted text-center py-4">
                  최근 거래가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart Placeholder */}
        <div className="bg-theme-card border border-theme rounded-xl p-5">
          <h3 className="text-lg font-semibold text-theme mb-4">월별 매출/매입 추이</h3>
          <div className="h-64 flex items-end gap-2">
            {data?.monthly_trend?.map((item: any, index: number) => {
              const maxValue = Math.max(
                ...data.monthly_trend.map((t: any) => Math.max(t.sales, t.purchases))
              )
              const salesHeight = maxValue > 0 ? (item.sales / maxValue) * 100 : 0
              const purchasesHeight = maxValue > 0 ? (item.purchases / maxValue) * 100 : 0

              return (
                <div key={item.month} className="flex-1 flex items-end gap-1">
                  <div
                    className="flex-1 bg-purple-500/50 rounded-t"
                    style={{ height: `${salesHeight}%` }}
                    title={`매출: ${formatCurrency(item.sales)}`}
                  />
                  <div
                    className="flex-1 bg-orange-500/50 rounded-t"
                    style={{ height: `${purchasesHeight}%` }}
                    title={`매입: ${formatCurrency(item.purchases)}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-theme-muted">
            {data?.monthly_trend?.map((item: any) => (
              <span key={item.month}>{item.month.slice(-2)}월</span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500/50 rounded" />
              <span className="text-xs text-theme-muted">매출</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500/50 rounded" />
              <span className="text-xs text-theme-muted">매입</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
