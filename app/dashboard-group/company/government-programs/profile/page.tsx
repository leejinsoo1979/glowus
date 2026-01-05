'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
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
  AlertCircle,
  FileText
} from 'lucide-react'
import { useThemeStore, accentColors, ThemeMode } from '@/stores/themeStore'
import { cn } from '@/lib/utils'

// 테마 헬퍼 함수
const getThemeColors = (mode: string) => {
  const isDark = mode === 'dark'
  return {
    bg: isDark ? 'bg-[#0a0a0f]' : 'bg-gray-50',
    card: isDark ? 'bg-white/[0.08]' : 'bg-white',
    cardBorder: isDark ? 'border-white/10' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-zinc-400' : 'text-gray-500',
    inputBg: isDark ? 'bg-white/5' : 'bg-white',
    inputBorder: isDark ? 'border-white/10' : 'border-gray-200',
  }
}

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
  // 상세 정보
  business_description: string
  main_products: string
  core_technologies: string
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
  interested_categories: [],
  business_description: '',
  main_products: '',
  core_technologies: ''
}

// 글래스 카드 컴포넌트
function GlassCard({
  children,
  className,
  isDark = true
}: {
  children: React.ReactNode
  className?: string
  isDark?: boolean
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        isDark
          ? "bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl border-white/10"
          : "bg-white border-gray-200 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  )
}

export default function CompanyProfilePage() {
  const router = useRouter()
  const { accentColor: accentColorId } = useThemeStore()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'
  const theme = getThemeColors(isDark ? 'dark' : 'light')

  const accentColor = accentColors.find(c => c.id === accentColorId)?.color || '#8b5cf6'

  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [existingProfile, setExistingProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const steps = [
    { title: '업종 정보', icon: Building2 },
    { title: '사업 상세', icon: FileText },
    { title: '사업 규모', icon: Users },
    { title: '사업자 유형', icon: Briefcase },
    { title: '지역', icon: MapPin },
    { title: '특수 조건', icon: Sparkles },
    { title: '관심 분야', icon: CheckCircle2 }
  ]

  useEffect(() => {
    setMounted(true)
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
          interested_categories: data.profile.interested_categories || [],
          business_description: data.profile.business_description || '',
          main_products: data.profile.main_products || '',
          core_technologies: data.profile.core_technologies || ''
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

      router.push('/dashboard-group/company/government-programs?view=matches')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!formData.industry_category
      case 1: return true
      case 2: return true
      case 3: return !!formData.entity_type
      case 4: return !!formData.region
      case 5: return true
      case 6: return formData.interested_categories.length > 0
      default: return true
    }
  }

  const completeness = () => {
    let score = 0
    if (formData.industry_category) score += 10
    if (formData.business_description) score += 15
    if (formData.main_products) score += 10
    if (formData.core_technologies) score += 10
    if (formData.annual_revenue) score += 8
    if (formData.employee_count) score += 7
    if (formData.business_years) score += 5
    if (formData.entity_type) score += 10
    if (formData.startup_stage) score += 5
    if (formData.region) score += 10
    if (formData.interested_categories.length > 0) score += 5
    if (formData.tech_certifications.length > 0) score += 3
    if (formData.is_youth_startup || formData.is_female_owned) score += 2
    return Math.min(100, score)
  }

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-10 h-10 border-2 border-t-transparent border-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  const CurrentStepIcon = steps[currentStep].icon

  return (
    <div className={cn("min-h-screen relative overflow-hidden transition-colors duration-300", theme.bg)}>
      {/* Ambient Background Orbs */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full blur-[120px] mix-blend-screen"
            style={{ background: `${accentColor}33` }}
          />
          <div
            className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] rounded-full blur-[100px] mix-blend-screen"
            style={{ background: `${accentColor}1a` }}
          />
        </div>
      )}

      {/* 헤더 */}
      <GlassCard className="sticky top-0 z-20 m-6 mb-0 px-8 py-4 flex items-center justify-between !rounded-2xl" isDark={isDark}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className={cn("p-2 rounded-xl transition-all", isDark ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-gray-100")}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={cn("text-xl font-bold tracking-tight", theme.text)}>
              회사 프로필 설정
            </h1>
            <p className={cn("text-xs font-medium", theme.textSecondary)}>
              맞춤 지원사업 추천을 위한 필수 정보입니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-2">
            <span className={cn("text-xs font-medium mb-1", theme.textSecondary)}>완성도</span>
            <span className="text-lg font-bold" style={{ color: accentColor }}>{completeness()}%</span>
          </div>
          <div className={cn("w-32 h-2 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-gray-100")}>
            <div
              className="h-full transition-all duration-500 relative"
              style={{ width: `${completeness()}%`, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}dd)` }}
            >
              <div
                className="absolute inset-0 opacity-50 blur-[2px]"
                style={{ background: accentColor }}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mx-6 p-6 pb-0 flex gap-6 items-start relative z-10">
        {/* 왼쪽: 스텝 네비게이션 */}
        <div className="w-64 flex-shrink-0 sticky top-32">
          <GlassCard className="p-4 space-y-2" isDark={isDark}>
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep

              return (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 relative overflow-hidden group text-left",
                    isActive
                      ? (isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-900")
                      : (isDark ? "text-zinc-500 hover:text-zinc-300 hover:bg-white/5" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                      isActive ? "scale-110" : "group-hover:scale-105"
                    )}
                    style={{
                      backgroundColor: isActive ? accentColor : (isCompleted ? `${accentColor}33` : 'transparent'),
                      color: isActive ? '#fff' : (isCompleted ? accentColor : 'currentColor')
                    }}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-medium">{step.title}</span>
                </button>
              )
            })}
          </GlassCard>
        </div>

        {/* 오른쪽: 폼 컨텐츠 */}
        <div className="flex-1">
          <GlassCard className="p-8 min-h-[calc(100vh-180px)] flex flex-col" isDark={isDark}>
            <div className="flex items-center gap-3 mb-8">
              <div
                className="p-3 rounded-2xl shadow-lg"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}
              >
                <CurrentStepIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className={cn("text-2xl font-bold", theme.text)}>
                {steps[currentStep].title}
              </h2>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="animate-in fade-in slide-in-from-right-4 duration-300 flex-1">
              {/* Step 0: 업종 정보 */}
              {currentStep === 0 && (
                <div className="space-y-8">
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>
                      업종 분류 <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {INDUSTRY_CATEGORIES.map(category => (
                        <button
                          key={category}
                          onClick={() => handleInputChange('industry_category', category)}
                          className={cn(
                            "p-3 rounded-xl border transition-all text-sm font-medium hover:scale-[1.02]",
                            formData.industry_category === category
                              ? "ring-1 ring-offset-2 ring-offset-transparent"
                              : (isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-gray-50 border-gray-200 hover:bg-gray-100")
                          )}
                          style={{
                            borderColor: formData.industry_category === category ? accentColor : undefined,
                            backgroundColor: formData.industry_category === category ? `${accentColor}20` : undefined,
                            color: formData.industry_category === category ? accentColor : (isDark ? '#e4e4e7' : '#3f3f46'),
                            boxShadow: formData.industry_category === category ? `0 0 10px ${accentColor}40` : 'none',
                            outlineColor: accentColor
                          }}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>
                      세부 업종 (선택)
                    </label>
                    <input
                      type="text"
                      value={formData.industry_subcategory}
                      onChange={e => handleInputChange('industry_subcategory', e.target.value)}
                      placeholder="예: 소프트웨어 개발, 전자상거래"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50",
                        theme.inputBg,
                        theme.inputBorder,
                        theme.text
                      )}
                      style={{
                        '--tw-ring-color': accentColor
                      } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}

              {/* Step 1: 사업 상세 */}
              {currentStep === 1 && (
                <div className="space-y-8">
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>
                      회사/서비스 소개
                    </label>
                    <textarea
                      value={formData.business_description}
                      onChange={e => handleInputChange('business_description', e.target.value)}
                      placeholder="회사가 제공하는 서비스나 제품에 대해 자세히 설명해주세요. (예: AI 기반의 자동화 마케팅 솔루션을 제공하는 플랫폼입니다...)"
                      rows={5}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50 resize-none",
                        theme.inputBg,
                        theme.inputBorder,
                        theme.text
                      )}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>
                      주력 아이템 (서비스/제품)
                    </label>
                    <input
                      type="text"
                      value={formData.main_products}
                      onChange={e => handleInputChange('main_products', e.target.value)}
                      placeholder="예: 마케팅 자동화 툴, CRM 솔루션"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50",
                        theme.inputBg,
                        theme.inputBorder,
                        theme.text
                      )}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                  </div>

                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>
                      핵심 기술
                    </label>
                    <input
                      type="text"
                      value={formData.core_technologies}
                      onChange={e => handleInputChange('core_technologies', e.target.value)}
                      placeholder="예: 자연어 처리(NLP), 빅데이터 분석"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50",
                        theme.inputBg,
                        theme.inputBorder,
                        theme.text
                      )}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: 사업 규모 */}
              {currentStep === 2 && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", theme.textSecondary)}>연 매출액 (원)</label>
                    <input
                      type="number"
                      value={formData.annual_revenue}
                      onChange={e => handleInputChange('annual_revenue', e.target.value)}
                      placeholder="예: 500000000 (5억원)"
                      className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50", theme.inputBg, theme.inputBorder, theme.text)}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                    {formData.annual_revenue && (
                      <p className={cn("mt-2 text-sm", theme.textSecondary)}>
                        = {(parseInt(formData.annual_revenue) / 100000000).toFixed(1)}억원
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", theme.textSecondary)}>직원 수 (명)</label>
                    <input
                      type="number"
                      value={formData.employee_count}
                      onChange={e => handleInputChange('employee_count', e.target.value)}
                      placeholder="예: 10"
                      className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50", theme.inputBg, theme.inputBorder, theme.text)}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", theme.textSecondary)}>업력 (년)</label>
                    <input
                      type="number"
                      value={formData.business_years}
                      onChange={e => handleInputChange('business_years', e.target.value)}
                      placeholder="예: 3"
                      className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50", theme.inputBg, theme.inputBorder, theme.text)}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: 사업자 유형 */}
              {currentStep === 3 && (
                <div className="space-y-8 max-w-3xl">
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>사업자 유형 *</label>
                    <div className="space-y-3">
                      {ENTITY_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => handleInputChange('entity_type', type.value)}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between group hover:scale-[1.01]",
                            formData.entity_type === type.value
                              ? "bg-opacity-10"
                              : (isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-gray-50 border-gray-200 hover:bg-gray-100")
                          )}
                          style={{
                            borderColor: formData.entity_type === type.value ? accentColor : 'transparent',
                            backgroundColor: formData.entity_type === type.value ? `${accentColor}10` : undefined
                          }}
                        >
                          <span
                            className="font-medium"
                            style={{ color: formData.entity_type === type.value ? accentColor : (isDark ? '#e4e4e7' : '#3f3f46') }}
                          >
                            {type.label}
                          </span>
                          {formData.entity_type === type.value && <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>창업 단계</label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {STARTUP_STAGES.map(stage => (
                        <button
                          key={stage.value}
                          onClick={() => handleInputChange('startup_stage', stage.value)}
                          className={cn(
                            "p-3 rounded-xl border-2 text-left transition-all text-sm group hover:scale-[1.02]",
                            formData.startup_stage === stage.value
                              ? "bg-opacity-10"
                              : (isDark ? "bg-white/5 border-white/5 hover:bg-white/10" : "bg-gray-50 border-gray-200 hover:bg-gray-100")
                          )}
                          style={{
                            borderColor: formData.startup_stage === stage.value ? accentColor : 'transparent',
                            backgroundColor: formData.startup_stage === stage.value ? `${accentColor}10` : undefined,
                            color: formData.startup_stage === stage.value ? accentColor : (isDark ? '#e4e4e7' : '#3f3f46')
                          }}
                        >
                          {stage.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: 지역 */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div>
                    <label className={cn("block text-sm font-medium mb-3", theme.textSecondary)}>사업장 소재지 *</label>
                    <div className="grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                      {REGIONS.map(region => (
                        <button
                          key={region}
                          onClick={() => handleInputChange('region', region)}
                          className={cn(
                            "p-3 rounded-xl border transition-all text-sm font-medium hover:scale-110",
                            formData.region === region
                              ? "ring-1 ring-offset-2 ring-offset-transparent"
                              : (isDark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-gray-50 border-gray-200 hover:bg-gray-100")
                          )}
                          style={{
                            borderColor: formData.region === region ? accentColor : undefined,
                            backgroundColor: formData.region === region ? `${accentColor}20` : undefined,
                            color: formData.region === region ? accentColor : (isDark ? '#e4e4e7' : '#3f3f46'),
                            boxShadow: formData.region === region ? `0 0 10px ${accentColor}40` : 'none',
                            outlineColor: accentColor
                          }}
                        >
                          {region}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", theme.textSecondary)}>시/군/구 (선택)</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => handleInputChange('city', e.target.value)}
                      placeholder="예: 강남구"
                      className={cn("w-full px-4 py-3 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-opacity-50", theme.inputBg, theme.inputBorder, theme.text)}
                      style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}

              {/* Step 5: 특수 조건 */}
              {currentStep === 5 && (
                <div className="space-y-8 max-w-4xl">
                  <div>
                    <label className={cn("block text-sm font-medium mb-4", theme.textSecondary)}>해당되는 조건을 선택하세요</label>
                    <div className="space-y-3">
                      {[
                        { key: 'is_youth_startup', label: '청년창업 (만 39세 이하 대표자)' },
                        { key: 'is_female_owned', label: '여성기업 (여성 대표자)' },
                        { key: 'is_social_enterprise', label: '사회적기업' },
                        { key: 'is_export_business', label: '수출/해외진출 기업' }
                      ].map(item => (
                        <label
                          key={item.key}
                          className={cn(
                            "flex items-center p-4 rounded-xl border transition-all cursor-pointer hover:bg-white/5 hover:scale-[1.01]",
                            isDark ? "border-white/10" : "border-gray-200"
                          )}
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
                            className="w-5 h-5 rounded border mr-3 flex items-center justify-center transition-all bg-transparent"
                            style={{
                              borderColor: formData[item.key as keyof ProfileFormData] ? accentColor : (isDark ? 'rgba(255,255,255,0.3)' : '#d1d5db'),
                              backgroundColor: formData[item.key as keyof ProfileFormData] ? accentColor : 'transparent'
                            }}
                          >
                            {formData[item.key as keyof ProfileFormData] && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                          <span className={theme.text}>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={cn("block text-sm font-medium mb-4", theme.textSecondary)}>보유 기술 인증</label>
                    <div className="flex flex-wrap gap-2">
                      {TECH_CERTIFICATIONS.map(cert => (
                        <button
                          key={cert}
                          onClick={() => toggleArrayItem('tech_certifications', cert)}
                          className="px-4 py-2 rounded-full text-sm transition-all border hover:scale-105"
                          style={{
                            borderColor: formData.tech_certifications.includes(cert) ? accentColor : (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'),
                            backgroundColor: formData.tech_certifications.includes(cert) ? accentColor : 'transparent',
                            color: formData.tech_certifications.includes(cert) ? '#fff' : (isDark ? '#a1a1aa' : '#4b5563')
                          }}
                        >
                          {cert}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6: 관심 분야 */}
              {currentStep === 6 && (
                <div className="space-y-6">
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", theme.textSecondary)}>관심 있는 지원 분야 *</label>
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {INTEREST_CATEGORIES.map(category => (
                        <button
                          key={category}
                          onClick={() => toggleArrayItem('interested_categories', category)}
                          className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 hover:scale-[1.01]",
                            isDark ? "bg-white/5 border-white/5" : "bg-gray-50 border-gray-200"
                          )}
                          style={{
                            borderColor: formData.interested_categories.includes(category) ? accentColor : 'transparent',
                            backgroundColor: formData.interested_categories.includes(category) ? `${accentColor}15` : undefined
                          }}
                        >
                          <div
                            className="w-5 h-5 rounded border mt-0.5 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: formData.interested_categories.includes(category) ? accentColor : (isDark ? 'rgba(255,255,255,0.3)' : '#d1d5db'),
                              backgroundColor: formData.interested_categories.includes(category) ? accentColor : 'transparent'
                            }}
                          >
                            {formData.interested_categories.includes(category) && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </div>
                          <span
                            className="font-medium"
                            style={{ color: formData.interested_categories.includes(category) ? accentColor : (isDark ? '#e4e4e7' : '#3f3f46') }}
                          >
                            {category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 액션 버튼 */}
            <div className="mt-12 flex items-center justify-between pt-6 border-t border-white/10">
              <button
                onClick={() => setCurrentStep(prev => prev - 1)}
                disabled={currentStep === 0}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-medium",
                  currentStep === 0
                    ? "opacity-0 cursor-not-allowed"
                    : (isDark ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-gray-100 text-gray-600")
                )}
              >
                <ChevronLeft className="w-5 h-5" />
                이전 단계
              </button>

              <button
                onClick={currentStep < steps.length - 1 ? () => setCurrentStep(prev => prev + 1) : handleSubmit}
                disabled={!canProceed() || isSaving}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 rounded-xl text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95",
                  (!canProceed() || isSaving) && "opacity-50 cursor-not-allowed transform-none"
                )}
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                  boxShadow: canProceed() ? `0 8px 20px ${accentColor}40` : 'none'
                }}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    저장 중...
                  </>
                ) : (
                  <>
                    {currentStep < steps.length - 1 ? '다음 단계' : '저장 완료'}
                    {currentStep < steps.length - 1 ? <ChevronRight className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                  </>
                )}
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
