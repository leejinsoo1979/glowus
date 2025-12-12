'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  Users,
  Search,
  Filter,
  Mail,
  Phone,
  Building2,
  MoreVertical
} from 'lucide-react'

const employeesData = [
  {
    id: '1',
    name: '김대표',
    email: 'ceo@startup.com',
    phone: '010-1234-5678',
    department: '경영진',
    position: '대표이사',
    joinDate: '2022-01-01',
    status: 'active',
    avatar: 'K'
  },
  {
    id: '2',
    name: '이개발',
    email: 'dev@startup.com',
    phone: '010-2345-6789',
    department: '개발팀',
    position: '시니어 개발자',
    joinDate: '2022-03-15',
    status: 'active',
    avatar: 'L'
  },
  {
    id: '3',
    name: '박디자인',
    email: 'design@startup.com',
    phone: '010-3456-7890',
    department: '디자인팀',
    position: '디자이너',
    joinDate: '2022-06-01',
    status: 'active',
    avatar: 'P'
  },
  {
    id: '4',
    name: '최마케팅',
    email: 'marketing@startup.com',
    phone: '010-4567-8901',
    department: '마케팅팀',
    position: '마케팅 매니저',
    joinDate: '2023-01-10',
    status: 'active',
    avatar: 'C'
  },
  {
    id: '5',
    name: '정영업',
    email: 'sales@startup.com',
    phone: '010-5678-9012',
    department: '영업팀',
    position: '영업 담당자',
    joinDate: '2023-04-01',
    status: 'active',
    avatar: 'J'
  },
  {
    id: '6',
    name: '김신입',
    email: 'new@startup.com',
    phone: '010-6789-0123',
    department: '개발팀',
    position: '주니어 개발자',
    joinDate: '2024-12-01',
    status: 'probation',
    avatar: 'K'
  },
  {
    id: '7',
    name: '이인사',
    email: 'hr@startup.com',
    phone: '010-7890-1234',
    department: '경영지원팀',
    position: '인사 담당자',
    joinDate: '2022-09-01',
    status: 'active',
    avatar: 'L'
  }
]

export default function EmployeesPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')

  const departments = ['all', ...Array.from(new Set(employeesData.map(e => e.department)))]

  const filteredEmployees = employeesData.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter
    return matchesSearch && matchesDepartment
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
      case 'probation':
        return isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
      case 'leave':
        return isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
      default:
        return isDark ? 'bg-zinc-500/20 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
    }
  }

  const departmentStats = departments.filter(d => d !== 'all').map(dept => ({
    name: dept,
    count: employeesData.filter(e => e.department === dept).length
  }))

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
              인력 현황
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              직원 정보를 관리하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <Plus className="w-4 h-4" />
          직원 추가
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={cn(
          'p-4 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>전체 직원</p>
              <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{employeesData.length}명</p>
            </div>
          </div>
        </div>
        {departmentStats.slice(0, 3).map(stat => (
          <div
            key={stat.name}
            className={cn(
              'p-4 rounded-xl border',
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', isDark ? 'bg-zinc-800' : 'bg-zinc-100')}>
                <Building2 className={cn('w-5 h-5', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
              </div>
              <div>
                <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>{stat.name}</p>
                <p className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>{stat.count}명</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 & 필터 */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
          <input
            type="text"
            placeholder="이름 또는 이메일로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg border text-sm',
              isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className={cn('w-4 h-4', isDark ? 'text-zinc-400' : 'text-zinc-500')} />
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={cn(
              'px-3 py-2 rounded-lg border text-sm',
              isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
            )}
          >
            {departments.map(dept => (
              <option key={dept} value={dept}>
                {dept === 'all' ? '전체 부서' : dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 직원 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map(employee => (
          <div
            key={employee.id}
            className={cn(
              'p-4 rounded-xl border transition-colors',
              isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
                  isDark ? 'bg-accent/20 text-accent' : 'bg-accent/10 text-accent'
                )}>
                  {employee.avatar}
                </div>
                <div>
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    {employee.name}
                  </h3>
                  <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {employee.position}
                  </p>
                </div>
              </div>
              <button className={cn(
                'p-1 rounded transition-colors',
                isDark ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-zinc-100 text-zinc-400'
              )}>
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                <Building2 className="w-4 h-4" />
                {employee.department}
              </div>
              <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                <Mail className="w-4 h-4" />
                {employee.email}
              </div>
              <div className={cn('flex items-center gap-2 text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                <Phone className="w-4 h-4" />
                {employee.phone}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                입사일: {employee.joinDate}
              </span>
              <span className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                getStatusColor(employee.status)
              )}>
                {employee.status === 'active' ? '재직' : employee.status === 'probation' ? '수습' : '휴직'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
