'use client'

import { useState, useEffect } from 'react'
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
  X
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
  { value: '예비', label: '예비창업' },
  { value: '초기', label: '초기 (3년 미만)' },
  { value: '도약', label: '도약기 (3~7년)' },
  { value: '성장', label: '성장기 (7년+)' }
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
  'ISO 인증', '특허보유', '기술혁신형'
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
  business_description: string
  main_products: string
  core_technologies: string
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
  business_description: '',
  main_products: '',
  core_technologies: '',
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

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

export default function ProfileModal({ isOpen, onClose, onSave }: ProfileModalProps) {
  const { accentColor: accentColorId } = useThemeStore()
  const accentColor = accentColors.find(c => c.id === accentColorId)?.color || '#3b82f6'
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<ProfileFormData>(initialFormData)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [existingProfile, setExistingProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const steps = [
    { title: '업종', icon: Building2 },
    { title: '규모', icon: Users },
    { title: '유형', icon: Briefcase },
    { title: '지역', icon: MapPin },
    { title: '조건', icon: Sparkles },
    { title: '관심', icon: CheckCircle2 }
  ]

  // 기존 프로필 로드
  useEffect(() => {
    if (isOpen) {
      loadProfile()
    }
  }, [isOpen])

  const loadProfile = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/company-profile')
      const data = await res.json()

      if (data.success && data.profile) {
        setExistingProfile(data.profile)
        setFormData({
          industry_category: data.profile.industry_category || '',
          industry_subcategory: data.profile.industry_subcategory || '',
          business_description: data.profile.business_description || '',
          main_products: data.profile.main_products || '',
          core_technologies: data.profile.core_technologies || '',
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

      onSave?.()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!formData.industry_category && !!formData.business_description
      case 1: return true
      case 2: return !!formData.entity_type
      case 3: return !!formData.region
      case 4: return true
      case 5: return formData.interested_categories.length > 0
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        {/* 헤더 */}
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(10,10,15,0.95) 100%)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">기업 프로필 설정</h2>
              <p className="text-sm text-white/50 mt-1">맞춤 지원사업 추천을 위한 정보 입력</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>

          {/* 프로그레스 바 */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/40">프로필 완성도</span>
              <span className="text-xs font-medium" style={{ color: accentColor }}>{completeness()}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${completeness()}%`,
                  background: `linear-gradient(90deg, ${accentColor}, ${accentColor}dd)`
                }}
              />
            </div>
          </div>

          {/* 스텝 인디케이터 */}
          <div className="flex items-center justify-between mt-4 gap-1">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep

              return (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-lg transition-all"
                  style={{
                    background: isActive ? `${accentColor}20` : 'transparent'
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isActive || isCompleted
                        ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`
                        : 'rgba(255,255,255,0.1)',
                      boxShadow: isActive ? `0 0 20px ${accentColor}40` : 'none'
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="text-white" />
                    ) : (
                      <Icon size={16} className={isActive ? 'text-white' : 'text-white/40'} />
                    )}
                  </div>
                  <span className={`text-[10px] ${isActive ? 'text-white' : 'text-white/40'}`}>
                    {step.title}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                style={{ borderColor: accentColor }}
              />
            </div>
          ) : (
            <>
              {/* 에러 메시지 */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center gap-2">
                  <AlertCircle className="text-red-400" size={18} />
                  <span className="text-red-300 text-sm">{error}</span>
                </div>
              )}

              {/* Step 0: 업종 정보 */}
              {currentStep === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">
                      업종 분류 <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {INDUSTRY_CATEGORIES.map(category => (
                        <button
                          key={category}
                          onClick={() => handleInputChange('industry_category', category)}
                          className="p-2.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: formData.industry_category === category
                              ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${formData.industry_category === category ? accentColor : 'rgba(255,255,255,0.1)'}`,
                            color: formData.industry_category === category ? accentColor : 'rgba(255,255,255,0.7)'
                          }}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      세부 업종 (선택)
                    </label>
                    <input
                      type="text"
                      value={formData.industry_subcategory}
                      onChange={e => handleInputChange('industry_subcategory', e.target.value)}
                      placeholder="예: 소프트웨어 개발, 전자상거래"
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      사업 내용 <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={formData.business_description}
                      onChange={e => handleInputChange('business_description', e.target.value)}
                      placeholder="회사가 어떤 일을 하는지 구체적으로 설명해주세요"
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none transition-all resize-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      주요 제품/서비스
                    </label>
                    <input
                      type="text"
                      value={formData.main_products}
                      onChange={e => handleInputChange('main_products', e.target.value)}
                      placeholder="예: AI 챗봇, B2B SaaS, 모바일 앱"
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      핵심 기술/전문 분야
                    </label>
                    <input
                      type="text"
                      value={formData.core_technologies}
                      onChange={e => handleInputChange('core_technologies', e.target.value)}
                      placeholder="예: 머신러닝, 클라우드, 블록체인, IoT"
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step 1: 사업 규모 */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">연 매출액 (원)</label>
                    <input
                      type="number"
                      value={formData.annual_revenue}
                      onChange={e => handleInputChange('annual_revenue', e.target.value)}
                      placeholder="예: 500000000 (5억원)"
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    {formData.annual_revenue && (
                      <p className="mt-2 text-xs text-white/50">
                        = {(parseInt(formData.annual_revenue) / 100000000).toFixed(1)}억원
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">직원 수</label>
                      <input
                        type="number"
                        value={formData.employee_count}
                        onChange={e => handleInputChange('employee_count', e.target.value)}
                        placeholder="예: 10"
                        className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">업력 (년)</label>
                      <input
                        type="number"
                        value={formData.business_years}
                        onChange={e => handleInputChange('business_years', e.target.value)}
                        placeholder="예: 3"
                        className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: 사업자 유형 */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">
                      사업자 유형 <span className="text-red-400">*</span>
                    </label>
                    <div className="space-y-2">
                      {ENTITY_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => handleInputChange('entity_type', type.value)}
                          className="w-full p-4 rounded-lg text-left transition-all"
                          style={{
                            background: formData.entity_type === type.value
                              ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${formData.entity_type === type.value ? accentColor : 'rgba(255,255,255,0.1)'}`,
                            color: formData.entity_type === type.value ? accentColor : 'rgba(255,255,255,0.8)'
                          }}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">창업 단계</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STARTUP_STAGES.map(stage => (
                        <button
                          key={stage.value}
                          onClick={() => handleInputChange('startup_stage', stage.value)}
                          className="p-3 rounded-lg text-sm text-left transition-all"
                          style={{
                            background: formData.startup_stage === stage.value
                              ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${formData.startup_stage === stage.value ? accentColor : 'rgba(255,255,255,0.1)'}`,
                            color: formData.startup_stage === stage.value ? accentColor : 'rgba(255,255,255,0.7)'
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
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">
                      사업장 소재지 <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {REGIONS.map(region => (
                        <button
                          key={region}
                          onClick={() => handleInputChange('region', region)}
                          className="p-2.5 rounded-lg text-xs font-medium transition-all"
                          style={{
                            background: formData.region === region
                              ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${formData.region === region ? accentColor : 'rgba(255,255,255,0.1)'}`,
                            color: formData.region === region ? accentColor : 'rgba(255,255,255,0.7)'
                          }}
                        >
                          {region}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">시/군/구 (선택)</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => handleInputChange('city', e.target.value)}
                      placeholder="예: 강남구"
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
              )}

              {/* Step 4: 특수 조건 */}
              {currentStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">해당 조건 선택</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'is_youth_startup', label: '청년창업 (만 39세 이하)' },
                        { key: 'is_female_owned', label: '여성기업' },
                        { key: 'is_social_enterprise', label: '사회적기업' },
                        { key: 'is_export_business', label: '수출/해외진출' }
                      ].map(item => (
                        <button
                          key={item.key}
                          onClick={() => handleInputChange(item.key as keyof ProfileFormData, !formData[item.key as keyof ProfileFormData])}
                          className="flex items-center gap-2 p-3 rounded-lg text-sm transition-all"
                          style={{
                            background: formData[item.key as keyof ProfileFormData]
                              ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                              : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${formData[item.key as keyof ProfileFormData] ? accentColor : 'rgba(255,255,255,0.1)'}`,
                            color: formData[item.key as keyof ProfileFormData] ? accentColor : 'rgba(255,255,255,0.7)'
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded flex items-center justify-center"
                            style={{
                              background: formData[item.key as keyof ProfileFormData] ? accentColor : 'rgba(255,255,255,0.2)'
                            }}
                          >
                            {formData[item.key as keyof ProfileFormData] && (
                              <CheckCircle2 size={12} className="text-white" />
                            )}
                          </div>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-3">보유 기술 인증</label>
                    <div className="flex flex-wrap gap-2">
                      {TECH_CERTIFICATIONS.map(cert => (
                        <button
                          key={cert}
                          onClick={() => toggleArrayItem('tech_certifications', cert)}
                          className="px-3 py-1.5 rounded-full text-xs transition-all"
                          style={{
                            background: formData.tech_certifications.includes(cert)
                              ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`
                              : 'rgba(255,255,255,0.1)',
                            color: formData.tech_certifications.includes(cert) ? 'white' : 'rgba(255,255,255,0.6)'
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
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    관심 지원 분야 <span className="text-red-400">*</span>
                  </label>
                  <p className="text-xs text-white/40 mb-4">최소 1개 이상 선택</p>
                  <div className="space-y-2">
                    {INTEREST_CATEGORIES.map(category => (
                      <button
                        key={category}
                        onClick={() => toggleArrayItem('interested_categories', category)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                        style={{
                          background: formData.interested_categories.includes(category)
                            ? `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`
                            : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${formData.interested_categories.includes(category) ? accentColor : 'rgba(255,255,255,0.1)'}`,
                          color: formData.interested_categories.includes(category) ? accentColor : 'rgba(255,255,255,0.7)'
                        }}
                      >
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                          style={{
                            background: formData.interested_categories.includes(category) ? accentColor : 'rgba(255,255,255,0.2)'
                          }}
                        >
                          {formData.interested_categories.includes(category) && (
                            <CheckCircle2 size={14} className="text-white" />
                          )}
                        </div>
                        <span className="text-sm">{category}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 푸터 */}
        <div
          className="sticky bottom-0 px-6 py-4 border-t border-white/10 flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(15,15,20,0.95) 0%, rgba(10,10,15,0.95) 100%)'
          }}
        >
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              currentStep === 0
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-white/10 text-white/70'
            }`}
          >
            <ChevronLeft size={18} />
            이전
          </button>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all"
              style={{
                background: canProceed()
                  ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`
                  : 'rgba(255,255,255,0.1)',
                opacity: canProceed() ? 1 : 0.5,
                boxShadow: canProceed() ? `0 4px 20px ${accentColor}40` : 'none'
              }}
            >
              다음
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all"
              style={{
                background: canProceed() && !isSaving
                  ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`
                  : 'rgba(255,255,255,0.1)',
                opacity: canProceed() && !isSaving ? 1 : 0.5,
                boxShadow: canProceed() && !isSaving ? `0 4px 20px ${accentColor}40` : 'none'
              }}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save size={18} />
                  저장 및 매칭
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
