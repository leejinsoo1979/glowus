'use client'

import React from 'react'

type StatusType =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'

interface StatusBadgeProps {
  status: StatusType | string
  label: string
  size?: 'sm' | 'md'
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  // General - using theme-aware classes for neutral states
  default: { bg: 'bg-theme-secondary', text: 'text-theme-muted', dot: 'bg-gray-500 dark:bg-zinc-500' },
  success: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  warning: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  error: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  info: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },

  // Employee status
  active: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  on_leave: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  resigned: { bg: 'bg-theme-secondary', text: 'text-theme-muted', dot: 'bg-gray-500 dark:bg-zinc-500' },

  // Attendance status
  normal: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  late: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  early_leave: { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  absent: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  holiday: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  vacation: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },

  // Approval status
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  approved: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-theme-secondary', text: 'text-theme-muted', dot: 'bg-gray-500 dark:bg-zinc-500' },

  // Payment status
  unpaid: { bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  partial: { bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  paid: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },

  // Transaction status
  confirmed: { bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },

  // Payroll status
  draft: { bg: 'bg-theme-secondary', text: 'text-theme-muted', dot: 'bg-gray-500 dark:bg-zinc-500' },

  // Expense status
  reimbursed: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
}

const statusLabels: Record<string, string> = {
  // Employee
  active: '재직',
  on_leave: '휴직',
  resigned: '퇴사',
  // Attendance
  normal: '정상',
  late: '지각',
  early_leave: '조퇴',
  absent: '결근',
  holiday: '휴일',
  vacation: '휴가',
  // Approval
  pending: '대기',
  approved: '승인',
  rejected: '반려',
  cancelled: '취소',
  // Payment
  unpaid: '미결제',
  partial: '부분결제',
  paid: '결제완료',
  // Transaction
  confirmed: '확정',
  // Payroll
  draft: '작성중',
  // Expense
  reimbursed: '정산완료',
}

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.default
  const displayLabel = label || statusLabels[status] || status

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} rounded-full ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {displayLabel}
    </span>
  )
}

export function getStatusLabel(status: string): string {
  return statusLabels[status] || status
}
