import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { UserRole } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const then = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (diffInSeconds < 60) return '방금 전'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}일 전`
  return formatDate(date)
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('ko-KR').format(num)
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

// ============================================
// Role-Based Access Control (RBAC)
// ============================================

export type Permission =
  | 'startup:create'
  | 'startup:read'
  | 'startup:update'
  | 'startup:delete'
  | 'task:create'
  | 'task:read'
  | 'task:update'
  | 'task:delete'
  | 'team:manage'
  | 'investor:request'
  | 'investor:approve'
  | 'admin:all'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  FOUNDER: [
    'startup:create',
    'startup:read',
    'startup:update',
    'startup:delete',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'team:manage',
    'investor:approve',
  ],
  TEAM_MEMBER: [
    'startup:read',
    'task:create',
    'task:read',
    'task:update',
  ],
  INVESTOR: [
    'startup:read',
    'task:read',
    'investor:request',
  ],
  ADMIN: [
    'admin:all',
    'startup:create',
    'startup:read',
    'startup:update',
    'startup:delete',
    'task:create',
    'task:read',
    'task:update',
    'task:delete',
    'team:manage',
    'investor:approve',
    'investor:request',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes('admin:all') || permissions.includes(permission)
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    FOUNDER: '창업자',
    TEAM_MEMBER: '팀원',
    INVESTOR: '투자자',
    ADMIN: '관리자',
  }
  return labels[role] || role
}

export function isFounderOrAdmin(role: UserRole): boolean {
  return role === 'FOUNDER' || role === 'ADMIN'
}
