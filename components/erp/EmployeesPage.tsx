'use client'

import React, { useState, useRef } from 'react'
import { Users, Edit, UserMinus, Camera, Eye, EyeOff, Plus, HelpCircle, X, Check, AlertCircle } from 'lucide-react'
import { useEmployees, useDepartments, usePositions, useMutation } from '@/lib/erp/hooks'
import {
  PageHeader,
  DataTable,
  StatusBadge,
  FormField,
  FormInput,
  FormSelect,
  FormRow,
  StatCard,
  StatGrid,
} from './shared'
import { CustomSelect } from '@/components/ui/custom-select'
import type { Employee, CreateEmployeeInput } from '@/lib/erp/types'

// 확장된 직원 입력 타입
interface ExtendedEmployeeInput extends CreateEmployeeInput {
  username?: string
  password?: string
  password_confirm?: string
  recognized_hire_date?: string
  external_email?: string
  resident_number_front?: string
  resident_number_back?: string
  account_status?: 'active' | 'suspended' | 'dormant'
  language?: string
  birthday?: string
  birthday_type?: 'solar' | 'lunar'
  anniversary?: string
  direct_phone?: string
  mobile_phone?: string
  main_phone?: string
  fax?: string
  job_title?: string
  location?: string
  homepage?: string
  messenger?: string
  introduction?: string
  notes?: string
}

export function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [showModal, setShowModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<Partial<ExtendedEmployeeInput>>({})
  const [activeTab, setActiveTab] = useState<'basic' | 'profile'>('basic')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({ show: false, type: 'success', message: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: employees, loading, pagination, setPage, updateParams, refresh } = useEmployees({
    search,
    ...filters,
  })
  const { data: departments } = useDepartments(true)
  const { data: allPositions } = usePositions()
  const { loading: saving, create, update, remove } = useMutation<CreateEmployeeInput>('/api/erp/employees')

  // 직위(title)와 직급(rank) 분리
  const positions = allPositions?.filter((p: any) => p.position_type === 'title') || []
  const ranks = allPositions?.filter((p: any) => p.position_type === 'rank') || []

  const handleSearch = (value: string) => {
    setSearch(value)
    updateParams({ search: value })
  }

  const handleAdd = () => {
    setSelectedEmployee(null)
    setFormData({
      hire_type: 'regular',
      status: 'active',
      account_status: 'active',
      language: 'ko',
      birthday_type: 'solar',
    })
    setActiveTab('basic')
    setProfileImage(null)
    setShowModal(true)
  }

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee)
    setFormData(employee as any)
    setActiveTab('basic')
    setProfileImage(employee.profile_image_url || null)
    setShowModal(true)
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast({ show: false, type: 'success', message: '' }), 3000)
  }

  const handleSubmit = async () => {
    // 비밀번호 확인
    if (formData.password && formData.password !== formData.password_confirm) {
      showToast('error', '비밀번호가 일치하지 않습니다.')
      return
    }

    try {
      if (selectedEmployee) {
        await update(selectedEmployee.id, formData as CreateEmployeeInput)
        showToast('success', '사원 정보가 수정되었습니다.')
      } else {
        await create(formData as CreateEmployeeInput)
        showToast('success', '사원이 등록되었습니다.')
      }
      setShowModal(false)
      refresh()
    } catch (error) {
      console.error('Save error:', error)
      showToast('error', '저장 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (employee: Employee) => {
    if (!confirm(`${employee.name} 직원을 퇴사 처리하시겠습니까?`)) return
    try {
      await remove(employee.id)
      refresh()
      showToast('success', '퇴사 처리가 완료되었습니다.')
    } catch (error) {
      console.error('Delete error:', error)
      showToast('error', '퇴사 처리 중 오류가 발생했습니다.')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 미리보기
    const reader = new FileReader()
    reader.onload = (event) => {
      setProfileImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // 서버에 업로드
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('folder', 'profile-images')

      const response = await fetch('/api/erp/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      const result = await response.json()

      if (result.success && result.url) {
        setFormData(f => ({ ...f, profile_image_url: result.url }))
        showToast('success', '프로필 이미지가 업로드되었습니다.')
      } else {
        showToast('error', result.error || '이미지 업로드 실패')
      }
    } catch (error) {
      console.error('Image upload error:', error)
      showToast('error', '이미지 업로드 중 오류가 발생했습니다.')
    }
  }

  const activeCount = employees.filter(e => e.status === 'active').length
  const onLeaveCount = employees.filter(e => e.status === 'on_leave').length

  const columns = [
    { key: 'employee_number', header: '사번', width: '100px' },
    {
      key: 'name',
      header: '이름',
      render: (item: Employee) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center overflow-hidden">
            {item.profile_image_url ? (
              <img src={item.profile_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-accent">{item.name?.charAt(0)}</span>
            )}
          </div>
          <div>
            <div className="font-medium text-theme">{item.name}</div>
            <div className="text-xs text-theme-muted">{item.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'department.name', header: '부서', render: (item: Employee) => item.department?.name || '-' },
    { key: 'position.name', header: '직급', render: (item: Employee) => item.position?.name || '-' },
    { key: 'hire_date', header: '입사일', render: (item: Employee) => item.hire_date || '-' },
    {
      key: 'hire_type',
      header: '고용형태',
      render: (item: Employee) => {
        const labels: Record<string, string> = { regular: '정규직', contract: '계약직', part_time: '시간제', intern: '인턴' }
        return labels[item.hire_type] || item.hire_type
      },
    },
    { key: 'status', header: '상태', render: (item: Employee) => <StatusBadge status={item.status} label="" /> },
  ]

  return (
    <div className="h-full flex flex-col bg-theme">
      <PageHeader title="직원 관리" subtitle="직원 정보 조회 및 관리" icon={Users} onAdd={handleAdd} addLabel="사원 생성" />

      {/* Stats */}
      <div className="px-6 py-4">
        <StatGrid columns={4}>
          <StatCard title="전체 직원" value={pagination.total} icon={Users} />
          <StatCard title="재직 중" value={activeCount} icon={Users} iconColor="text-green-500" />
          <StatCard title="휴직 중" value={onLeaveCount} icon={Users} iconColor="text-yellow-500" />
          <StatCard title="이번 달 입사" value={0} icon={Users} iconColor="text-blue-500" />
        </StatGrid>
      </div>

      {/* Filters */}
      <div className="px-6 pb-4 flex items-center gap-3">
        <FormSelect
          value={filters.status || ''}
          onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); updateParams({ status: e.target.value }) }}
          options={[{ value: 'active', label: '재직' }, { value: 'on_leave', label: '휴직' }, { value: 'resigned', label: '퇴사' }]}
          placeholder="상태 전체"
          className="w-32"
        />
        <FormSelect
          value={filters.department_id || ''}
          onChange={(e) => { setFilters(f => ({ ...f, department_id: e.target.value })); updateParams({ department_id: e.target.value }) }}
          options={departments?.map((d: any) => ({ value: d.id, label: d.name })) || []}
          placeholder="부서 전체"
          className="w-40"
        />
        <FormSelect
          value={filters.hire_type || ''}
          onChange={(e) => { setFilters(f => ({ ...f, hire_type: e.target.value })); updateParams({ hire_type: e.target.value }) }}
          options={[{ value: 'regular', label: '정규직' }, { value: 'contract', label: '계약직' }, { value: 'part_time', label: '시간제' }, { value: 'intern', label: '인턴' }]}
          placeholder="고용형태 전체"
          className="w-36"
        />
      </div>

      {/* Table */}
      <div className="flex-1 px-6 pb-6">
        <div className="h-full bg-theme-card border border-theme rounded-xl overflow-hidden">
          <DataTable
            columns={columns}
            data={employees}
            loading={loading}
            emptyMessage="등록된 직원이 없습니다."
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            onPageChange={setPage}
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder="이름, 사번, 이메일 검색..."
            onRowClick={handleEdit}
            rowActions={(item: Employee) => (
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(item)} className="p-1 text-theme-muted hover:text-theme"><Edit className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item)} className="p-1 text-theme-muted hover:text-red-400"><UserMinus className="w-4 h-4" /></button>
              </div>
            )}
          />
        </div>
      </div>

      {/* Employee Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowModal(false)} />
          <div className="relative bg-theme-card border border-theme rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-theme">
              <h2 className="text-xl font-bold text-theme">{selectedEmployee ? '사원 수정' : '사원 생성'}</h2>
              <p className="text-sm text-theme-muted mt-1">* 인사정보는 사원정보 등록 후 추가가 가능합니다.</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Profile Image */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-theme-secondary rounded-full flex items-center justify-center overflow-hidden border border-theme">
                    {profileImage ? (
                      <img src={profileImage} alt="프로필" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-theme-input rounded-full" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-theme-card border border-theme rounded-full flex items-center justify-center shadow-sm hover:bg-theme-secondary"
                  >
                    <Camera className="w-4 h-4 text-theme-secondary" />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>
                <p className="text-xs text-theme-muted mt-2">사진은 자동으로 150 x 150 사이즈로 적용됩니다.</p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-theme mb-6">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'basic' ? 'border-accent text-accent' : 'border-transparent text-theme-muted hover:text-theme'}`}
                >
                  기본
                </button>
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === 'profile' ? 'border-accent text-accent' : 'border-transparent text-theme-muted hover:text-theme'}`}
                >
                  프로필
                </button>
              </div>

              {/* Basic Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  {/* 이름 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">이름 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <div className="w-28">
                      <CustomSelect
                        value="ko"
                        onChange={() => {}}
                        options={[
                          { value: 'ko', label: '한국어' },
                          { value: 'en', label: 'English' },
                          { value: 'ja', label: '日本語' },
                          { value: 'zh', label: '中文' },
                        ]}
                        placeholder="언어"
                      />
                    </div>
                  </div>

                  {/* 아이디 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">아이디 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData(f => ({ ...f, username: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 비밀번호 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">비밀번호 <span className="text-red-500">*</span></label>
                    <div className="flex-1 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password || ''}
                        onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                        placeholder="비밀번호를 입력해주세요."
                        className="w-full px-3 py-2 pr-10 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme">
                        {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* 비밀번호 확인 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0"></label>
                    <div className="flex-1 relative">
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        value={formData.password_confirm || ''}
                        onChange={(e) => setFormData(f => ({ ...f, password_confirm: e.target.value }))}
                        placeholder="비밀번호를 다시 입력해주세요."
                        className="w-full px-3 py-2 pr-10 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                      <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme">
                        {showPasswordConfirm ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* 직원구분 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">직원구분 <span className="text-red-500">*</span></label>
                    <div className="flex-1">
                      <CustomSelect
                        value={formData.hire_type || 'regular'}
                        onChange={(val) => setFormData(f => ({ ...f, hire_type: val as any }))}
                        options={[
                          { value: 'regular', label: '정규직' },
                          { value: 'contract', label: '계약직' },
                          { value: 'part_time', label: '시간제' },
                          { value: 'intern', label: '인턴' },
                        ]}
                        placeholder="직원구분 선택"
                      />
                    </div>
                  </div>

                  {/* 입사일자 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">입사일자 <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={formData.hire_date || ''}
                      onChange={(e) => setFormData(f => ({ ...f, hire_date: e.target.value }))}
                      className="px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 인정입사일자 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0 flex items-center gap-1">
                      인정입사일자
                      <HelpCircle className="w-3 h-3 text-theme-muted" />
                    </label>
                    <input
                      type="date"
                      value={formData.recognized_hire_date || ''}
                      onChange={(e) => setFormData(f => ({ ...f, recognized_hire_date: e.target.value }))}
                      className="px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 부서 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">부서</label>
                    <div className="flex-1">
                      <CustomSelect
                        value={formData.department_id || ''}
                        onChange={(val) => setFormData(f => ({ ...f, department_id: val }))}
                        options={departments?.map((d: any) => ({ value: d.id, label: d.name })) || []}
                        placeholder={departments?.length ? '부서 선택' : '부서 데이터가 없습니다'}
                        searchable={departments?.length > 5}
                      />
                    </div>
                  </div>

                  {/* 외부 이메일 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">외부 이메일</label>
                    <input
                      type="email"
                      value={formData.external_email || ''}
                      onChange={(e) => setFormData(f => ({ ...f, external_email: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 직위 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">직위</label>
                    <div className="flex-1">
                      <CustomSelect
                        value={formData.position_id || ''}
                        onChange={(val) => setFormData(f => ({ ...f, position_id: val }))}
                        options={positions.map((p: any) => ({ value: p.id, label: p.name }))}
                        placeholder={positions.length ? '직위 선택' : '직위 데이터가 없습니다'}
                      />
                    </div>
                  </div>

                  {/* 직급 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">직급</label>
                    <div className="flex-1">
                      <CustomSelect
                        value={formData.rank_id || ''}
                        onChange={(val) => setFormData(f => ({ ...f, rank_id: val }))}
                        options={ranks.map((r: any) => ({ value: r.id, label: r.name }))}
                        placeholder={ranks.length ? '직급 선택' : '직급 데이터가 없습니다'}
                      />
                    </div>
                  </div>

                  {/* 사용자그룹 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">사용자그룹</label>
                    <button className="flex items-center gap-1 text-theme-muted hover:text-accent">
                      <Plus className="w-4 h-4" />
                      <span className="text-sm">추가</span>
                    </button>
                  </div>

                  {/* 주민등록번호 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">주민등록번호</label>
                    <input
                      type="text"
                      value={formData.resident_number_front || ''}
                      onChange={(e) => setFormData(f => ({ ...f, resident_number_front: e.target.value }))}
                      maxLength={6}
                      className="w-32 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <span className="text-theme-muted">-</span>
                    <div className="relative flex-1">
                      <input
                        type="password"
                        value={formData.resident_number_back || ''}
                        onChange={(e) => setFormData(f => ({ ...f, resident_number_back: e.target.value }))}
                        maxLength={7}
                        className="w-full px-3 py-2 pr-10 bg-theme-input border border-theme rounded-lg text-theme focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                      <EyeOff className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                    </div>
                  </div>

                  {/* 사원번호 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">사원번호</label>
                    <input
                      type="text"
                      value={formData.employee_number || ''}
                      onChange={(e) => setFormData(f => ({ ...f, employee_number: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 계정 상태 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">계정 상태</label>
                    <div className="flex items-center gap-4">
                      {[
                        { value: 'active', label: '정상' },
                        { value: 'suspended', label: '중지' },
                        { value: 'dormant', label: '휴면' },
                      ].map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="account_status"
                            value={opt.value}
                            checked={formData.account_status === opt.value}
                            onChange={(e) => setFormData(f => ({ ...f, account_status: e.target.value as any }))}
                            className="w-4 h-4 text-accent bg-theme-input border-theme"
                          />
                          <span className="text-sm text-theme-secondary">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 언어 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">언어</label>
                    <div className="flex-1">
                      <CustomSelect
                        value={formData.language || 'ko'}
                        onChange={(val) => setFormData(f => ({ ...f, language: val }))}
                        options={[
                          { value: 'ko', label: '한국어' },
                          { value: 'en', label: 'English' },
                          { value: 'ja', label: '日本語' },
                          { value: 'zh', label: '中文' },
                        ]}
                        placeholder="언어 선택"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  {/* 생일 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">생일</label>
                    <input
                      type="date"
                      value={formData.birthday || ''}
                      onChange={(e) => setFormData(f => ({ ...f, birthday: e.target.value }))}
                      className="px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <div className="flex items-center gap-3 ml-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="birthday_type"
                          value="solar"
                          checked={formData.birthday_type === 'solar'}
                          onChange={(e) => setFormData(f => ({ ...f, birthday_type: 'solar' }))}
                          className="w-4 h-4 text-accent bg-theme-input border-theme"
                        />
                        <span className="text-sm text-theme-secondary">양력</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="birthday_type"
                          value="lunar"
                          checked={formData.birthday_type === 'lunar'}
                          onChange={(e) => setFormData(f => ({ ...f, birthday_type: 'lunar' }))}
                          className="w-4 h-4 text-accent bg-theme-input border-theme"
                        />
                        <span className="text-sm text-theme-secondary">음력</span>
                      </label>
                    </div>
                  </div>

                  {/* 기념일 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">기념일</label>
                    <input
                      type="date"
                      value={formData.anniversary || ''}
                      onChange={(e) => setFormData(f => ({ ...f, anniversary: e.target.value }))}
                      className="px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 주소 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">주소</label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData(f => ({ ...f, address: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 직통전화 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">직통전화</label>
                    <input
                      type="tel"
                      value={formData.direct_phone || ''}
                      onChange={(e) => setFormData(f => ({ ...f, direct_phone: e.target.value }))}
                      placeholder="010-1234-5678 형식으로 입력해주세요."
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 휴대전화 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">휴대전화</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                      placeholder="010-1234-5678 형식으로 입력해주세요."
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 대표번호 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">대표번호</label>
                    <input
                      type="tel"
                      value={formData.main_phone || ''}
                      onChange={(e) => setFormData(f => ({ ...f, main_phone: e.target.value }))}
                      placeholder="010-1234-5678 형식으로 입력해주세요."
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* FAX */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">FAX</label>
                    <input
                      type="tel"
                      value={formData.fax || ''}
                      onChange={(e) => setFormData(f => ({ ...f, fax: e.target.value }))}
                      placeholder="010-1234-5678 형식으로 입력해주세요."
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 직무 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">직무</label>
                    <input
                      type="text"
                      value={formData.job_title || ''}
                      onChange={(e) => setFormData(f => ({ ...f, job_title: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 위치 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">위치</label>
                    <input
                      type="text"
                      value={formData.location || ''}
                      onChange={(e) => setFormData(f => ({ ...f, location: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 홈페이지 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">홈페이지</label>
                    <input
                      type="url"
                      value={formData.homepage || ''}
                      onChange={(e) => setFormData(f => ({ ...f, homepage: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 메신저 */}
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0">메신저</label>
                    <input
                      type="text"
                      value={formData.messenger || ''}
                      onChange={(e) => setFormData(f => ({ ...f, messenger: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </div>

                  {/* 자기소개 */}
                  <div className="flex items-start gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0 pt-2">자기소개</label>
                    <textarea
                      value={formData.introduction || ''}
                      onChange={(e) => setFormData(f => ({ ...f, introduction: e.target.value }))}
                      rows={3}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y"
                    />
                  </div>

                  {/* 메모 */}
                  <div className="flex items-start gap-2">
                    <label className="w-24 text-sm text-theme-secondary flex-shrink-0 pt-2">메모</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="flex-1 px-3 py-2 bg-theme-input border border-theme rounded-lg text-theme placeholder-theme-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-theme flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 text-theme-secondary hover:bg-theme-secondary rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {toast.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
