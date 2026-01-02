'use client'

import React, { useState, useMemo } from 'react'
import { Users, Search, Filter, Building2, Mail, Phone, ChevronDown } from 'lucide-react'
import { useEmployees, useDepartments } from '@/lib/erp/hooks'
import { PageHeader, StatusBadge, StatCard, StatGrid } from './shared'
import type { Employee } from '@/lib/erp/types'

interface DepartmentGroup {
  id: string
  name: string
  members: Employee[]
}

export function TeamMembersPage() {
  const [search, setSearch] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data: employees, loading } = useEmployees({ limit: '1000' })
  const { data: departments } = useDepartments(true)

  // 부서별 그룹화
  const groupedByDepartment = useMemo(() => {
    if (!employees) return []

    const filtered = employees.filter((emp: Employee) => {
      const matchesSearch =
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.email?.toLowerCase().includes(search.toLowerCase()) ||
        emp.position?.name?.toLowerCase().includes(search.toLowerCase())

      const matchesDepartment =
        selectedDepartment === 'all' || emp.department_id === selectedDepartment

      return matchesSearch && matchesDepartment
    })

    // 부서별 그룹화
    const groups: Record<string, DepartmentGroup> = {}

    filtered.forEach((emp: Employee) => {
      const deptId = emp.department_id || 'unassigned'
      const deptName = emp.department?.name || '미배정'

      if (!groups[deptId]) {
        groups[deptId] = {
          id: deptId,
          name: deptName,
          members: []
        }
      }
      groups[deptId].members.push(emp)
    })

    return Object.values(groups).sort((a, b) => {
      if (a.id === 'unassigned') return 1
      if (b.id === 'unassigned') return -1
      return a.name.localeCompare(b.name)
    })
  }, [employees, search, selectedDepartment])

  // 통계
  const stats = useMemo(() => {
    if (!employees) return { total: 0, active: 0, departments: 0 }
    return {
      total: employees.length,
      active: employees.filter((e: Employee) => e.status === 'active').length,
      departments: new Set(employees.map((e: Employee) => e.department_id).filter(Boolean)).size,
    }
  }, [employees])

  const getInitials = (name: string) => {
    if (!name) return '?'
    return name.slice(0, 2)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500'
      case 'inactive': return 'bg-gray-400'
      case 'leave': return 'bg-amber-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <PageHeader
        title="팀원 현황"
        subtitle="인사관리에서 등록한 팀원들을 조회합니다"
        icon={Users}
      />

      {/* 통계 카드 */}
      <StatGrid columns={3}>
        <StatCard
          title="전체 인원"
          value={stats.total}
          icon={Users}
          iconColor="text-blue-500"
        />
        <StatCard
          title="재직 중"
          value={stats.active}
          icon={Users}
          iconColor="text-green-500"
        />
        <StatCard
          title="부서 수"
          value={stats.departments}
          icon={Building2}
          iconColor="text-purple-500"
        />
      </StatGrid>

      {/* 필터 영역 */}
      <div className="flex flex-wrap items-center gap-4">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input
            type="text"
            placeholder="이름, 이메일, 직위로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-theme-input border border-theme rounded-lg text-sm text-theme placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        {/* 부서 필터 */}
        <div className="relative">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2.5 bg-theme-input border border-theme rounded-lg text-sm text-theme cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          >
            <option value="all">모든 부서</option>
            {departments?.map((dept: any) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
        </div>

        {/* 뷰 모드 토글 */}
        <div className="flex items-center gap-1 p-1 bg-theme-secondary rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-accent text-white'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            그리드
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-accent text-white'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            리스트
          </button>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* 팀원 목록 - 부서별 */}
      {!loading && groupedByDepartment.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-16 h-16 text-theme-muted mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">팀원이 없습니다</h3>
          <p className="text-sm text-theme-muted">
            인사관리 &gt; 사원정보관리에서 팀원을 등록해주세요
          </p>
        </div>
      )}

      {!loading && groupedByDepartment.map((group) => (
        <div key={group.id} className="space-y-4">
          {/* 부서 헤더 */}
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-theme">{group.name}</h3>
            <span className="px-2 py-0.5 bg-theme-secondary text-theme-muted text-xs rounded-full">
              {group.members.length}명
            </span>
          </div>

          {/* 그리드 뷰 */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="group relative bg-theme-card border border-theme rounded-xl p-4 hover:border-accent/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
                >
                  {/* 상태 표시 */}
                  <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${getStatusColor(member.status || 'active')}`} />

                  {/* 프로필 이미지 */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      {member.profile_image_url ? (
                        <img
                          src={member.profile_image_url}
                          alt={member.name}
                          className="w-20 h-20 rounded-full object-cover border-2 border-theme shadow-md group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/20 to-accent/40 flex items-center justify-center border-2 border-theme shadow-md group-hover:scale-105 transition-transform">
                          <span className="text-xl font-bold text-accent">
                            {getInitials(member.name)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 정보 */}
                  <div className="text-center space-y-1">
                    <h4 className="font-semibold text-theme group-hover:text-accent transition-colors">
                      {member.name}
                    </h4>
                    <p className="text-xs text-theme-muted">
                      {member.position?.name || '직위 미지정'}
                    </p>
                    {member.email && (
                      <p className="text-xs text-theme-muted truncate" title={member.email}>
                        {member.email}
                      </p>
                    )}
                  </div>

                  {/* 호버 시 추가 정보 */}
                  <div className="absolute inset-0 bg-theme-card/95 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/40 flex items-center justify-center mb-3">
                      {member.profile_image_url ? (
                        <img
                          src={member.profile_image_url}
                          alt={member.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-accent">
                          {getInitials(member.name)}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold text-theme mb-1">{member.name}</h4>
                    <p className="text-xs text-accent mb-3">{member.position?.name || '직위 미지정'}</p>

                    <div className="flex items-center gap-3">
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="p-2 rounded-full bg-theme-secondary hover:bg-accent/20 text-theme-muted hover:text-accent transition-colors"
                          title="이메일 보내기"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                      {member.phone && (
                        <a
                          href={`tel:${member.phone}`}
                          className="p-2 rounded-full bg-theme-secondary hover:bg-accent/20 text-theme-muted hover:text-accent transition-colors"
                          title="전화하기"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 리스트 뷰 */}
          {viewMode === 'list' && (
            <div className="bg-theme-card border border-theme rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-theme bg-theme-secondary/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      직위
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      이메일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      전화번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {group.members.map((member) => (
                    <tr key={member.id} className="hover:bg-theme-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {member.profile_image_url ? (
                            <img
                              src={member.profile_image_url}
                              alt={member.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-accent/40 flex items-center justify-center">
                              <span className="text-xs font-bold text-accent">
                                {getInitials(member.name)}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-theme">{member.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-muted">
                        {member.position?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-muted">
                        {member.email || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-muted">
                        {member.phone || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={member.status || 'active'}
                          label={member.status === 'active' ? '재직' : member.status === 'on_leave' ? '휴직' : '퇴직'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
