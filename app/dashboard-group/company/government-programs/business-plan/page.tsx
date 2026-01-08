'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Edit3,
  ArrowLeft,
  Wand2,
  Eye,
  EyeOff,
  Building2,
  Target,
  BarChart3,
  Users,
  DollarSign,
  TrendingUp,
  Lightbulb,
  MessageSquare,
  Check,
  Zap,
  Clock,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
// docx, file-saver, html2pdf는 동적으로 import (SSR 문제 방지)

// 섹션 아이콘 매핑
const SECTION_ICONS: Record<string, any> = {
  // 옛날 키 (호환성)
  executive_summary: Sparkles,
  company_overview: Building2,
  problem_statement: AlertCircle,
  solution: Lightbulb,
  market_research: BarChart3,
  business_model: DollarSign,
  team_introduction: Users,
  financial_plan: TrendingUp,
  fund_usage: Target,
  expected_outcomes: CheckCircle2,
  // DIPS 원본 HWP 템플릿 키
  '1-1': Users,           // 대표자 현황
  '1-2': Building2,       // 기업 현황 및 팀
  '2-1': Sparkles,        // 개발 동기
  '2-2': Lightbulb,       // 아이템 차별성
  '2-3': DollarSign,      // 비즈니스 모델
  '2-4': Target,          // 개선과제
  '3-1': BarChart3,       // 내수시장
  '3-1-1': BarChart3,
  '3-1-2': BarChart3,
  '3-2': Globe,           // 해외시장
  '3-2-1': Globe,
  '3-2-2': Globe,
  '3-2-3': Globe,
  '3-3': Clock,           // 추진일정
  '3-3-1': Clock,
  '3-4': TrendingUp,      // 사업비
  '4-1': Building2,       // 대중견기업 협력
  '4-1-1': Building2,
  '4-1-2': Building2,
  '5-1': DollarSign,      // 투자유치
  '5-1-1': DollarSign,
  '5-1-2': DollarSign,
  '6-1': Target,          // 출구전략
  '6-1-1': Target,
  '6-1-2': Target,
  '6-1-3': Target,
  '6-1-4': Target,
}

interface Section {
  content: string
  generated_at?: string
  edited?: boolean
  edited_at?: string
  title: string
  order: number
  error?: string
}

interface BusinessPlan {
  id: string
  title: string
  status: string
  sections: Record<string, Section>
  created_at: string
  updated_at: string
  government_programs?: {
    id: string
    title: string
    organization: string
    category: string
  }
}

interface Program {
  id: string
  title: string
  organization: string
  category: string
}

// 글래스 카드 컴포넌트
function GlassCard({
  children,
  className,
  hover = true
}: {
  children: React.ReactNode
  className?: string
  hover?: boolean
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-white/[0.08] to-white/[0.02]",
        "backdrop-blur-xl border border-white/10",
        hover && "hover:border-white/20 transition-all duration-300",
        className
      )}
    >
      {children}
    </div>
  )
}

export default function BusinessPlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const programId = searchParams.get('program_id')
  const planId = searchParams.get('id')

  const { accentColor: accentColorId } = useThemeStore()
  const themeColor = accentColors.find(c => c.id === accentColorId)?.color || '#6366f1'

  // 상태
  const [program, setProgram] = useState<Program | null>(null)
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [regenerateInstructions, setRegenerateInstructions] = useState('')
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [showInterviewPrompt, setShowInterviewPrompt] = useState(false)
  const [interviewData, setInterviewData] = useState<{
    message: string
    missing_data: string[]
    suggestions: string[]
    completeness_score: number
  } | null>(null)
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)

  // 프로그램 정보 로드
  const fetchProgram = useCallback(async () => {
    if (!programId) return

    try {
      const res = await fetch(`/api/government-programs?id=${programId}`)
      const data = await res.json()
      if (data.success && data.program) {
        setProgram(data.program)
      }
    } catch (error) {
      console.error('프로그램 로드 실패:', error)
    }
  }, [programId])

  // 기존 사업계획서 로드
  const fetchBusinessPlan = useCallback(async () => {
    if (!planId && !programId) {
      setLoading(false)
      return
    }

    try {
      let url = '/api/skills/business-plan/generate?'
      if (planId) {
        url += `id=${planId}`
      } else if (programId) {
        url += `program_id=${programId}`
      }

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        if (planId && data.business_plan) {
          setBusinessPlan(data.business_plan)
          const sections = Object.keys(data.business_plan.sections || {})
          if (sections.length > 0) {
            setSelectedSection(sections[0])
          }
        } else if (data.business_plans && data.business_plans.length > 0) {
          // 최신 사업계획서 사용
          setBusinessPlan(data.business_plans[0])
          const sections = Object.keys(data.business_plans[0].sections || {})
          if (sections.length > 0) {
            setSelectedSection(sections[0])
          }
        }
      }
    } catch (error) {
      console.error('사업계획서 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [planId, programId])

  useEffect(() => {
    fetchProgram()
    fetchBusinessPlan()
  }, [fetchProgram, fetchBusinessPlan])

  // 기존 계획서 없으면 자동 생성 시작 (1회만)
  useEffect(() => {
    if (
      programId &&
      !loading &&
      !generating &&
      !businessPlan &&
      !autoGenerateTriggered &&
      program
    ) {
      setAutoGenerateTriggered(true)
      generatePlan()
    }
  }, [programId, loading, generating, businessPlan, autoGenerateTriggered, program])

  // 생성 중 진행률 업데이트 (예상 시간 2분 기준)
  useEffect(() => {
    if (!generating || !generationStartTime) return

    const ESTIMATED_DURATION = 120000 // 2분
    const interval = setInterval(() => {
      const elapsed = Date.now() - generationStartTime
      const progress = Math.min(95, Math.floor((elapsed / ESTIMATED_DURATION) * 100))
      setGenerationProgress(progress)
    }, 1000)

    return () => clearInterval(interval)
  }, [generating, generationStartTime])

  // 사업계획서 생성
  const generatePlan = async () => {
    if (!programId) return

    setGenerating(true)
    try {
      const res = await fetch('/api/skills/business-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId })
      })

      const data = await res.json()

      if (data.success) {
        // 생성된 사업계획서 바로 사용 (추가 API 호출 없이)
        const newPlan: BusinessPlan = {
          id: data.business_plan_id,
          title: program?.title ? `${program.title} - 사업계획서` : '사업계획서',
          status: 'completed',
          sections: data.sections || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          government_programs: program ? {
            id: program.id,
            title: program.title,
            organization: program.organization,
            category: program.category || ''
          } : undefined
        }

        setBusinessPlan(newPlan)
        const sectionKeys = Object.keys(newPlan.sections)
        if (sectionKeys.length > 0) {
          const firstSection = sectionKeys[0]
          setSelectedSection(firstSection)
          // 자동으로 편집 모드 진입
          setEditContent(newPlan.sections[firstSection]?.content || '')
          setEditMode(true)
        }
      } else if (data.needs_interview) {
        // 지식베이스 부족 - 인터뷰 모드 안내
        setInterviewData({
          message: data.message,
          missing_data: data.missing_data || [],
          suggestions: data.suggestions || [],
          completeness_score: data.completeness_score || 0
        })
        setShowInterviewPrompt(true)
      } else {
        alert(data.error || '생성 실패')
      }
    } catch (error) {
      console.error('생성 실패:', error)
      alert('사업계획서 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  // 섹션 저장
  const saveSection = async () => {
    if (!businessPlan || !selectedSection) return

    setSaving(true)
    try {
      const res = await fetch(`/api/skills/business-plan/${businessPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: selectedSection,
          content: editContent
        })
      })

      const data = await res.json()

      if (data.success) {
        setBusinessPlan(data.business_plan)
        setEditMode(false)
      } else {
        alert(data.error || '저장 실패')
      }
    } catch (error) {
      console.error('저장 실패:', error)
    } finally {
      setSaving(false)
    }
  }

  // 섹션 재생성
  const regenerateSection = async () => {
    if (!businessPlan || !selectedSection) return

    setGenerating(true)
    setShowRegenerateModal(false)

    try {
      const res = await fetch(`/api/skills/business-plan/${businessPlan.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_key: selectedSection,
          additional_instructions: regenerateInstructions
        })
      })

      const data = await res.json()

      if (data.success) {
        // 사업계획서 새로고침
        const planRes = await fetch(`/api/skills/business-plan/${businessPlan.id}`)
        const planData = await planRes.json()

        if (planData.success) {
          setBusinessPlan(planData.business_plan)
        }
      } else {
        alert(data.error || '재생성 실패')
      }
    } catch (error) {
      console.error('재생성 실패:', error)
    } finally {
      setGenerating(false)
      setRegenerateInstructions('')
    }
  }

  // 편집 모드 진입
  const enterEditMode = () => {
    if (businessPlan && selectedSection) {
      setEditContent(businessPlan.sections[selectedSection]?.content || '')
      setEditMode(true)
    }
  }

  // PDF 내보내기
  const handleExportPDF = async () => {
    if (!businessPlan) return

    // PDF용 컨텐츠 생성 (숨겨진 div)
    const element = document.createElement('div')
    element.innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; color: #333;">
        <h1 style="text-align: center; font-size: 24px; margin-bottom: 20px;">${businessPlan.title}</h1>
        <div style="margin-bottom: 40px; text-align: center; color: #666;">
          <p>지원사업: ${program?.title || ''}</p>
          <p>작성일: ${new Date().toLocaleDateString()}</p>
        </div>
        ${Object.entries(businessPlan.sections || {})
        .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
        .map(([key, section]) => `
            <div style="margin-bottom: 30px; page-break-inside: avoid;">
              <h2 style="font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
                ${section.title}
              </h2>
              <div style="white-space: pre-wrap; line-height: 1.6; font-size: 14px;">
                ${section.content ? section.content.replace(/\n/g, '<br/>') : '내용 없음'}
              </div>
            </div>
          `).join('')}
      </div>
    `

    const opt = {
      margin: 10,
      filename: `${businessPlan.title}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    }

    try {
      // html2pdf는 브라우저에서만 동작 (동적 import)
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf().set(opt).from(element).save()
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF 내보내기 중 오류가 발생했습니다.')
    }
  }

  // Word 내보내기
  const handleExportWord = async () => {
    if (!businessPlan) return

    try {
      // 동적 import (SSR 문제 방지)
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = await import('docx')
      const { saveAs } = await import('file-saver')

      const children: any[] = [
        new Paragraph({
          text: businessPlan.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: `지원사업: ${program?.title || ''}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: `작성일: ${new Date().toLocaleDateString()}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 }
        })
      ]

      const sections = Object.entries(businessPlan.sections || {})
        .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))

      for (const [_, section] of sections) {
        children.push(
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
            border: {
              bottom: {
                color: "000000",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          })
        )

        // 내용 추가 (간단히 줄바꿈 처리)
        const contentLines = (section.content || '').split('\n')
        for (const line of contentLines) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })], // 12pt
              spacing: { after: 100 }
            })
          )
        }

        // 섹션 간 간격 (페이지 브레이크는 아님)
        children.push(new Paragraph({ text: "" }))
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      })

      const blob = await Packer.toBlob(doc)
      saveAs(blob, `${businessPlan.title}.docx`)
    } catch (err) {
      console.error('Word export failed:', err)
      alert('Word 내보내기 중 오류가 발생했습니다.')
    }
  }

  // 정렬된 섹션 목록
  const sortedSections = businessPlan?.sections
    ? Object.entries(businessPlan.sections)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
    : []

  const currentSection: Section | undefined = selectedSection
    ? businessPlan?.sections[selectedSection]
    : undefined

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-white/50 animate-spin" />
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white/50" />
          </div>
          <p className="text-zinc-500">불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* 배경 그라데이션 */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]"
          style={{ background: `radial-gradient(circle, ${themeColor} 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px]"
          style={{ background: `radial-gradient(circle, #8b5cf6 0%, transparent 70%)` }}
        />
      </div>

      {/* 헤더 */}
      <div className="relative z-10 h-16 border-b border-white/5 px-6 flex items-center justify-between backdrop-blur-xl bg-black/20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
            >
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AI 사업계획서</h1>
              <p className="text-xs text-zinc-500">
                {program?.title || businessPlan?.government_programs?.title || '지원사업 선택 필요'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 사업계획서가 있고 섹션에 내용이 있을 때만 다운로드 버튼 표시 */}
          {businessPlan && Object.keys(businessPlan.sections || {}).length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`/api/business-plans/${businessPlan.id}/hwp`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
              >
                <Download className="w-4 h-4" />
                HWP 다운로드
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-all"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={handleExportWord}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-all"
              >
                <Download className="w-4 h-4" />
                Word
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 flex h-[calc(100vh-64px)]">
        {!businessPlan || Object.keys(businessPlan.sections || {}).length === 0 ? (
          /* 사업계획서 없음 또는 섹션 없음 - 생성 유도 (새 디자인) */
          <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
            {/* 배경 애니메이션 */}
            <div className="absolute inset-0 overflow-hidden">
              {/* 그라데이션 오브 */}
              <div
                className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse"
                style={{ background: `radial-gradient(circle, ${themeColor}, transparent)` }}
              />
              <div
                className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-15 animate-pulse"
                style={{ background: `radial-gradient(circle, ${themeColor}80, transparent)`, animationDelay: '1s' }}
              />
              {/* 플로팅 파티클 */}
              {generating && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full animate-bounce"
                      style={{
                        background: themeColor,
                        left: `${20 + i * 12}%`,
                        top: `${30 + (i % 3) * 20}%`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: `${1.5 + i * 0.3}s`,
                        opacity: 0.6
                      }}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="relative z-10 text-center max-w-xl">
              {generating ? (
                /* 생성 중 화면 */
                <div className="space-y-8">
                  {/* 로딩 애니메이션 */}
                  <div className="relative mx-auto w-32 h-32">
                    {/* 외부 링 */}
                    <div
                      className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
                      style={{
                        borderTopColor: themeColor,
                        borderRightColor: `${themeColor}50`,
                        animationDuration: '2s'
                      }}
                    />
                    {/* 중간 링 */}
                    <div
                      className="absolute inset-3 rounded-full border-4 border-transparent animate-spin"
                      style={{
                        borderBottomColor: themeColor,
                        borderLeftColor: `${themeColor}30`,
                        animationDuration: '1.5s',
                        animationDirection: 'reverse'
                      }}
                    />
                    {/* 중앙 아이콘 */}
                    <div
                      className="absolute inset-6 rounded-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                    >
                      <Sparkles className="w-10 h-10 animate-pulse" style={{ color: themeColor }} />
                    </div>
                  </div>

                  {/* 텍스트 */}
                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white">
                      AI가 작성 중입니다
                    </h2>
                    <p className="text-zinc-400 text-lg">
                      {program?.title}
                    </p>
                  </div>

                  {/* 진행 상태 */}
                  <div className="space-y-4 max-w-sm mx-auto">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`,
                          animation: 'loading-slide 1.5s ease-in-out infinite'
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>사업계획서 생성 중... 약 1-2분 소요</span>
                    </div>
                  </div>

                  {/* 생성 단계 표시 */}
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    {['회사 분석', '공고 분석', '계획서 작성'].map((step, i) => (
                      <div
                        key={step}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                        style={{
                          background: i === 2 ? `${themeColor}20` : 'rgba(255,255,255,0.05)',
                          color: i === 2 ? themeColor : '#a1a1aa'
                        }}
                      >
                        {i < 2 ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* 초기 화면 */
                <div className="space-y-8">
                  {/* 아이콘 */}
                  <div
                    className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-2xl"
                    style={{
                      background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                      boxShadow: `0 20px 50px ${themeColor}40`
                    }}
                  >
                    <Wand2 className="w-12 h-12 text-white" />
                  </div>

                  {/* 제목 */}
                  <div className="space-y-3">
                    <h2 className="text-4xl font-bold text-white">
                      AI 사업계획서
                    </h2>
                    <p className="text-zinc-400 text-lg max-w-md mx-auto">
                      {program ? (
                        <>지원사업에 최적화된 사업계획서를<br />AI가 자동으로 작성해드립니다</>
                      ) : (
                        '지원사업을 선택한 후 사업계획서를 생성할 수 있습니다'
                      )}
                    </p>
                  </div>

                  {/* 프로그램 정보 */}
                  {program && (
                    <div
                      className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl max-w-md"
                      style={{ background: `${themeColor}15`, border: `1px solid ${themeColor}30` }}
                    >
                      <FileText className="w-5 h-5 flex-shrink-0" style={{ color: themeColor }} />
                      <span className="text-white text-sm font-medium text-left line-clamp-2">{program.title}</span>
                    </div>
                  )}

                  {/* 버튼 */}
                  {program ? (
                    <button
                      onClick={generatePlan}
                      className="group inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-semibold text-lg transition-all hover:scale-105 hover:shadow-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}90)`,
                        boxShadow: `0 10px 40px ${themeColor}50`
                      }}
                    >
                      <Sparkles className="w-6 h-6 group-hover:animate-spin" />
                      사업계획서 생성하기
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/dashboard-group/company/government-programs')}
                      className="group inline-flex items-center gap-3 px-10 py-4 rounded-2xl text-white font-semibold text-lg transition-all hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}90)`,
                        boxShadow: `0 10px 40px ${themeColor}50`
                      }}
                    >
                      지원사업 선택하기
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}

                  {/* 하단 정보 */}
                  <div className="flex items-center justify-center gap-6 text-sm text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4" style={{ color: themeColor }} />
                      Gemini 2.5 Flash 기반
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      1-2분 소요
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* CSS 애니메이션 */}
            <style jsx>{`
              @keyframes loading-slide {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `}</style>
          </div>
        ) : (
          <>
            {/* 왼쪽: 섹션 네비게이션 */}
            <div className="w-72 border-r border-white/5 p-4 overflow-y-auto">
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  섹션 목차
                </h3>
                <div className="text-xs text-zinc-600">
                  {sortedSections.filter(([, s]) => s.content).length}/{sortedSections.length} 완료
                </div>
              </div>

              <div className="space-y-1">
                {sortedSections.map(([key, section]) => {
                  const Icon = SECTION_ICONS[key] || FileText
                  const isActive = selectedSection === key
                  const hasContent = !!section.content
                  const isEdited = section.edited

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedSection(key)
                        setEditMode(false)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all",
                        isActive ? "text-white" : "text-zinc-400 hover:bg-white/5"
                      )}
                      style={isActive ? {
                        background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`,
                        borderLeft: `3px solid ${themeColor}`
                      } : undefined}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          hasContent ? "bg-emerald-500/20" : "bg-white/10"
                        )}
                      >
                        {hasContent ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Icon className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{section.title}</div>
                        {isEdited && (
                          <div className="text-[10px] text-amber-400">수정됨</div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 오른쪽: 섹션 에디터 */}
            <div className="flex-1 overflow-y-auto">
              {selectedSection && currentSection ? (
                <div className="p-6">
                  {/* 섹션 헤더 */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{currentSection.title}</h2>
                      {currentSection.generated_at && (
                        <p className="text-sm text-zinc-500 mt-1">
                          {currentSection.edited
                            ? `수정됨: ${new Date(currentSection.edited_at || '').toLocaleString('ko-KR')}`
                            : `생성됨: ${new Date(currentSection.generated_at).toLocaleString('ko-KR')}`
                          }
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {editMode ? (
                        <>
                          <button
                            onClick={() => setEditMode(false)}
                            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-all"
                          >
                            취소
                          </button>
                          <button
                            onClick={saveSection}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                          >
                            {saving ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            저장
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowRegenerateModal(true)}
                            disabled={generating}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-all"
                          >
                            {generating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            AI 재생성
                          </button>
                          <button
                            onClick={enterEditMode}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                          >
                            <Edit3 className="w-4 h-4" />
                            편집
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 섹션 콘텐츠 */}
                  <GlassCard className="p-6" hover={false}>
                    {editMode ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full min-h-[500px] bg-transparent text-white resize-none focus:outline-none font-mono text-sm leading-relaxed"
                        placeholder="내용을 입력하세요..."
                      />
                    ) : currentSection.content ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-table:border-collapse prose-th:border prose-th:border-zinc-600 prose-th:bg-zinc-800 prose-th:p-2 prose-td:border prose-td:border-zinc-700 prose-td:p-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {currentSection.content}
                        </ReactMarkdown>
                      </div>
                    ) : currentSection.error ? (
                      <div className="text-center py-12">
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                        <p className="text-red-300 mb-2">생성 중 오류가 발생했습니다</p>
                        <p className="text-zinc-500 text-sm">{currentSection.error}</p>
                        <button
                          onClick={() => setShowRegenerateModal(true)}
                          className="mt-4 px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-all"
                        >
                          다시 시도
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-zinc-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>아직 생성되지 않은 섹션입니다</p>
                        <button
                          onClick={() => setShowRegenerateModal(true)}
                          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all hover:opacity-90"
                          style={{ background: `${themeColor}20`, color: themeColor }}
                        >
                          <Sparkles className="w-4 h-4" />
                          AI로 생성하기
                        </button>
                      </div>
                    )}
                  </GlassCard>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>섹션을 선택하세요</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 재생성 모달 */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegenerateModal(false)} />
          <GlassCard className="relative w-full max-w-lg p-6" hover={false}>
            <h3 className="text-xl font-bold text-white mb-4">AI 재생성</h3>
            <p className="text-zinc-400 mb-4">
              {currentSection?.title} 섹션을 다시 작성합니다.
              추가 요청사항이 있으면 입력하세요.
            </p>

            <textarea
              value={regenerateInstructions}
              onChange={(e) => setRegenerateInstructions(e.target.value)}
              placeholder="예: 더 구체적인 수치를 포함해주세요, 경쟁사 분석을 강화해주세요..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-white/20"
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowRegenerateModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-all"
              >
                취소
              </button>
              <button
                onClick={regenerateSection}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                재생성
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 인터뷰 모드 안내 모달 */}
      {showInterviewPrompt && interviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInterviewPrompt(false)} />
          <GlassCard className="relative w-full max-w-xl p-6" hover={false}>
            {/* 헤더 */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
              >
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">인터뷰 모드 시작</h3>
                <p className="text-sm text-zinc-400">AI가 질문을 통해 정보를 수집합니다</p>
              </div>
            </div>

            {/* 완성도 표시 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">지식베이스 완성도</span>
                <span className="text-sm font-medium" style={{ color: themeColor }}>
                  {interviewData.completeness_score}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${interviewData.completeness_score}%`,
                    background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80)`
                  }}
                />
              </div>
            </div>

            {/* 부족한 정보 */}
            {interviewData.missing_data.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-zinc-300 mb-3">부족한 정보</h4>
                <div className="flex flex-wrap gap-2">
                  {interviewData.missing_data.slice(0, 6).map((item, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    >
                      {item}
                    </span>
                  ))}
                  {interviewData.missing_data.length > 6 && (
                    <span className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-zinc-400">
                      +{interviewData.missing_data.length - 6}개 더
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 안내 메시지 */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
              <p className="text-sm text-zinc-300 leading-relaxed">
                {interviewData.message}
              </p>
            </div>

            {/* 선택 옵션 */}
            <div className="space-y-3 mb-6">
              {interviewData.suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (i === 0) {
                      // 인터뷰 모드 시작 - builder 페이지로 이동
                      setShowInterviewPrompt(false)
                      router.push(`/dashboard-group/company/government-programs/business-plan/builder?program_id=${programId}`)
                    } else if (i === 1) {
                      // 파일 업로드
                      setShowInterviewPrompt(false)
                      router.push(`/dashboard-group/company/knowledge-base?upload=true`)
                    } else {
                      // 직접 입력
                      setShowInterviewPrompt(false)
                      router.push(`/dashboard-group/company/profile`)
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
                    i === 0
                      ? "text-white hover:opacity-90"
                      : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  )}
                  style={i === 0 ? { background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` } : undefined}
                >
                  {i === 0 && <MessageSquare className="w-5 h-5" />}
                  {i === 1 && <Download className="w-5 h-5" />}
                  {i === 2 && <Edit3 className="w-5 h-5" />}
                  <span className="text-sm font-medium">{suggestion}</span>
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </button>
              ))}
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowInterviewPrompt(false)}
              className="w-full px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-400 hover:bg-white/10 transition-all"
            >
              나중에 하기
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
