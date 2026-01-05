'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Users,
  MapPin,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Save,
  AlertCircle
} from 'lucide-react'
import { useThemeStore, accentColors } from '@/stores/themeStore'

// 업종 카테고리 목록
const INDUSTRY_CATEGORIES = [
  '제조업', '정보통신업', '도소매업', '서비스업', '건설업',
  '농림어업', '금융보험업', '부동산업', '전문과학기술', '예술스포츠',
  '교육서비스', '보건복지', '운수창고업', '숙박음식업', '기타'
]

// 지역 목록
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'
]

// 창업 단계
const STARTUP_STAGES = [
  { value: '예비', label: '예비창업 (아이디어 단계)' },
  { value: '초기', label: '초기창업 (3년 미만)' },
  { value: '도약', label: '도약기 (3~7년)' },
  { value: '성장', label: '성장기 (7년 이상)' }
]

// 사업자 유형
const ENTITY_TYPES = [
  { value: '예비창업자', label: '예비창업자' },
  { value: '개인', label: '개인사업자' },
  { value: '법인', label: '법인사업자' }
]

// 기술 인증
const TECH_CERTIFICATIONS = [
  '벤처기업', '이노비즈', '메인비즈', '연구개발전담부서',
  'ISO 인증', '특허보유', '기술혁신형 중소기업'
]

// 관심 분야
const INTEREST_CATEGORIES = [
  '자금지원 (융자/보증)', '기술개발 (R&D)', '수출/해외진출',
  '인력채용', '교육/컨설팅', '마케팅/판로개척',
  '인증지원', '시설/공간', '창업지원'
]

interface ProfileFormData {
  industry_category: string
  industry_subcategory: string
  annual_revenue: string
  employee_count: string
  business_years: string
  entity_type: string
  startup_stage: string
  region: string
  city: string
  is_youth_startup: boolean
  is_female_owned: boolean
  is_social_enterprise: boolean
  is_export_business: boolean
  tech_certifications: string[]
  interested_categories: string[]
}

const initialFormData: ProfileFormData = {
  industry_category: '',
  industry_subcategory: '',
  annual_revenue: '',
  employee_count: '',
  business_years: '',
  entity_type: '',
  startup_stage: '',
  region: '',
  city: '',
  is_youth_startup: false,
  is_female_owned: false,
  is_social_enterprise: false,
  is_export_business: false,
  tech_certifications: [],
  interested_categories: []
}

export default function CompanyProfilePage() {
  const router = useRouter()
  const { accentColor: accentColorId } = useThemeStore()
  const accentColor = accentColors.find(c => c.id === accentColorId)?.color || '#3b82f6'
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [existingProfile, setExistingProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const steps = [
    { title: '업종 정보', icon: Building2 },
    { title: '사업 규모', icon: Users },
    { title: '사업자 유형', icon: Briefcase },
    { title: '지역', icon: MapPin },
    { title: '특수 조건', icon: Sparkles },
    { title: '관심 분야', icon: CheckCircle2 }
  ]

  // 기존 프로필 로드
  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/company-profile')
      const data = await res.json()

      if (data.success && data.profile) {
        setExistingProfile(data.profile)
        setFormData({
          industry_category: data.profile.industry_category || '',
          industry_subcategory: data.profile.industry_subcategory || '',
          annual_revenue: data.profile.annual_revenue?.toString() || '',
          employee_count: data.profile.employee_count?.toString() || '',
          business_years: data.profile.business_years?.toString() || '',
          entity_type: data.profile.entity_type || '',
          startup_stage: data.profile.startup_stage || '',
          region: data.profile.region || '',
          city: data.profile.city || '',
          is_youth_startup: data.profile.is_youth_startup || false,
          is_female_owned: data.profile.is_female_owned || false,
          is_social_enterprise: data.profile.is_social_enterprise || false,
          is_export_business: data.profile.is_export_business || false,
          tech_certifications: data.profile.tech_certifications || [],
          interested_categories: data.profile.interested_categories || []
        })
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof ProfileFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleArrayItem = (field: 'tech_certifications' | 'interested_categories', item: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }))
  }

  const handleSubmit = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const method = existingProfile ? 'PUT' : 'POST'
      const res = await fetch('/api/company-profile', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '저장 실패')
      }

      // 성공 시 매칭 페이지로 이동
      router.push('/dashboard-group/company/government-programs?view=matches')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return !!formData.industry_category
      case 1:
        return true // 선택사항
      case 2:
        return !!formData.entity_type
      case 3:
        return !!formData.region
      case 4:
        return true // 선택사항
      case 5:
        return formData.interested_categories.length > 0
      default:
        return true
    }
  }

  const completeness = () => {
    let score = 0
    if (formData.industry_category) score += 15
    if (formData.annual_revenue) score += 10
    if (formData.employee_count) score += 10
    if (formData.business_years) score += 10
    if (formData.entity_type) score += 15
    if (formData.startup_stage) score += 10
    if (formData.region) score += 10
    if (formData.interested_categories.length > 0) score += 10
    if (formData.tech_certifications.length > 0) score += 5
    if (formData.is_youth_startup || formData.is_female_owned) score += 5
    return Math.min(100, score)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: accentColor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            회사 프로필 설정
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            정확한 프로필 정보를 입력하면 맞춤 지원사업을 추천받을 수 있습니다.
          </p>
        </div>

        {/* 프로그레스 바 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">프로필 완성도</span>
            <span className="text-sm font-medium" style={{ color: accentColor }}>{completeness()}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${completeness()}%`,
                backgroundColor: accentColor
              }}
            />
          </div>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`flex flex-col items-center min-w-[80px] transition-all ${
                  isActive || isCompleted ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isActive
                      ? 'ring-2 ring-offset-2'
                      : ''
                  }`}
                  style={{
                    backgroundColor: isActive || isCompleted ? accentColor : '#e5e7eb',
                    color: isActive || isCompleted ? 'white' : '#6b7280',
                    '--tw-ring-color': isActive ? accentColor : undefined
                  } as React.CSSProperties}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Icon size={20} />
                  )}
                </div>
                <span className={`text-xs text-center ${
                  isActive ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
              </button>
            )
          })}
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-500" size={20} />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {/* 폼 컨텐츠 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          {/* Step 0: 업종 정보 */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  업종 분류 *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {INDUSTRY_CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => handleInputChange('industry_category', category)}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        formData.industry_category === category
                          ? 'border-current bg-opacity-10'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: formData.industry_category === category ? accentColor : undefined,
                        backgroundColor: formData.industry_category === category ? `${accentColor}10` : undefined,
                        color: formData.industry_category === category ? accentColor : undefined
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  세부 업종 (선택)
                </label>
                <input
                  type="text"
                  value={formData.industry_subcategory}
                  onChange={e => handleInputChange('industry_subcategory', e.target.value)}
                  placeholder="예: 소프트웨어 개발, 전자상거래"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ outlineColor: accentColor }}
                />
              </div>
            </div>
          )}

          {/* Step 1: 사업 규모 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  연 매출액 (원)
                </label>
                <input
                  type="number"
                  value={formData.annual_revenue}
                  onChange={e => handleInputChange('annual_revenue', e.target.value)}
                  placeholder="예: 500000000 (5억원)"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {formData.annual_revenue && (
                  <p className="mt-2 text-sm text-gray-500">
                    = {(parseInt(formData.annual_revenue) / 100000000).toFixed(1)}억원
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  직원 수 (명)
                </label>
                <input
                  type="number"
                  value={formData.employee_count}
                  onChange={e => handleInputChange('employee_count', e.target.value)}
                  placeholder="예: 10"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  업력 (년)
                </label>
                <input
                  type="number"
                  value={formData.business_years}
                  onChange={e => handleInputChange('business_years', e.target.value)}
                  placeholder="예: 3"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Step 2: 사업자 유형 */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  사업자 유형 *
                </label>
                <div className="space-y-3">
                  {ENTITY_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => handleInputChange('entity_type', type.value)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        formData.entity_type === type.value
                          ? 'border-current'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: formData.entity_type === type.value ? accentColor : undefined,
                        backgroundColor: formData.entity_type === type.value ? `${accentColor}10` : undefined
                      }}
                    >
                      <span className={formData.entity_type === type.value ? '' : 'text-gray-700 dark:text-gray-300'}
                        style={{ color: formData.entity_type === type.value ? accentColor : undefined }}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  창업 단계
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {STARTUP_STAGES.map(stage => (
                    <button
                      key={stage.value}
                      onClick={() => handleInputChange('startup_stage', stage.value)}
                      className={`p-3 rounded-lg border-2 text-sm text-left transition-all ${
                        formData.startup_stage === stage.value
                          ? 'border-current'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: formData.startup_stage === stage.value ? accentColor : undefined,
                        backgroundColor: formData.startup_stage === stage.value ? `${accentColor}10` : undefined,
                        color: formData.startup_stage === stage.value ? accentColor : undefined
                      }}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 지역 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  사업장 소재지 (시/도) *
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {REGIONS.map(region => (
                    <button
                      key={region}
                      onClick={() => handleInputChange('region', region)}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        formData.region === region
                          ? 'border-current'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: formData.region === region ? accentColor : undefined,
                        backgroundColor: formData.region === region ? `${accentColor}10` : undefined,
                        color: formData.region === region ? accentColor : undefined
                      }}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  시/군/구 (선택)
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={e => handleInputChange('city', e.target.value)}
                  placeholder="예: 강남구"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Step 4: 특수 조건 */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  해당되는 조건을 선택하세요
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'is_youth_startup', label: '청년창업 (만 39세 이하 대표자)' },
                    { key: 'is_female_owned', label: '여성기업 (여성 대표자)' },
                    { key: 'is_social_enterprise', label: '사회적기업' },
                    { key: 'is_export_business', label: '수출/해외진출 기업' }
                  ].map(item => (
                    <label
                      key={item.key}
                      className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        formData[item.key as keyof ProfileFormData]
                          ? 'border-current'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: formData[item.key as keyof ProfileFormData] ? accentColor : undefined,
                        backgroundColor: formData[item.key as keyof ProfileFormData] ? `${accentColor}10` : undefined
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData[item.key as keyof ProfileFormData] as boolean}
                        onChange={e => handleInputChange(item.key as keyof ProfileFormData, e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                          formData[item.key as keyof ProfileFormData]
                            ? 'border-current bg-current'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}
                        style={{
                          borderColor: formData[item.key as keyof ProfileFormData] ? accentColor : undefined,
                          backgroundColor: formData[item.key as keyof ProfileFormData] ? accentColor : undefined
                        }}
                      >
                        {formData[item.key as keyof ProfileFormData] && (
                          <CheckCircle2 size={12} className="text-white" />
                        )}
                      </div>
                      <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  보유 기술 인증
                </label>
                <div className="flex flex-wrap gap-2">
                  {TECH_CERTIFICATIONS.map(cert => (
                    <button
                      key={cert}
                      onClick={() => toggleArrayItem('tech_certifications', cert)}
                      className={`px-4 py-2 rounded-full text-sm transition-all ${
                        formData.tech_certifications.includes(cert)
                          ? 'text-white'
                          : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                      }`}
                      style={{
                        backgroundColor: formData.tech_certifications.includes(cert) ? accentColor : undefined
                      }}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 관심 분야 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  관심 있는 지원 분야를 선택하세요 *
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  최소 1개 이상 선택해주세요
                </p>
                <div className="space-y-3">
                  {INTEREST_CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => toggleArrayItem('interested_categories', category)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        formData.interested_categories.includes(category)
                          ? 'border-current'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                      style={{
                        borderColor: formData.interested_categories.includes(category) ? accentColor : undefined,
                        backgroundColor: formData.interested_categories.includes(category) ? `${accentColor}10` : undefined
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            formData.interested_categories.includes(category)
                              ? 'border-current bg-current'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}
                          style={{
                            borderColor: formData.interested_categories.includes(category) ? accentColor : undefined,
                            backgroundColor: formData.interested_categories.includes(category) ? accentColor : undefined
                          }}
                        >
                          {formData.interested_categories.includes(category) && (
                            <CheckCircle2 size={12} className="text-white" />
                          )}
                        </div>
                        <span
                          className={formData.interested_categories.includes(category) ? '' : 'text-gray-700 dark:text-gray-300'}
                          style={{ color: formData.interested_categories.includes(category) ? accentColor : undefined }}
                        >
                          {category}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 네비게이션 버튼 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              currentStep === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <ChevronLeft size={20} />
            이전
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-all ${
                canProceed() ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ backgroundColor: accentColor }}
            >
              다음
              <ChevronRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSaving}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-all ${
                canProceed() && !isSaving ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ backgroundColor: accentColor }}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save size={20} />
                  저장 및 매칭 시작
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
