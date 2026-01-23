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
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { Image as ImageIcon, Upload, BarChart2, PieChart as PieChartIcon, TrendingUp as LineChartIcon, Activity } from 'lucide-react'
// docx, file-saver, html2pdf는 동적으로 import (SSR 문제 방지)

// 차트 색상 팔레트
const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899']

// 차트 렌더링 컴포넌트
function ChartRenderer({ data }: { data: any }) {
  try {
    const chartData = typeof data === 'string' ? JSON.parse(data) : data
    const { type, title, data: chartValues } = chartData

    if (!chartValues || !Array.isArray(chartValues)) {
      return <div className="p-4 bg-red-50 text-red-600 rounded text-sm">차트 데이터 형식 오류</div>
    }

    const renderChart = () => {
      switch (type) {
        case 'bar':
          return (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartValues} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {chartValues.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        case 'line':
          return (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartValues} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          )
        case 'pie':
          return (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartValues}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartValues.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )
        case 'area':
          return (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartValues} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )
        default:
          return <div className="p-4 bg-yellow-50 text-yellow-700 rounded text-sm">지원하지 않는 차트 유형: {type}</div>
      }
    }

    return (
      <div className="my-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        {title && (
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            {type === 'bar' && <BarChart2 className="w-4 h-4" />}
            {type === 'pie' && <PieChartIcon className="w-4 h-4" />}
            {type === 'line' && <LineChartIcon className="w-4 h-4" />}
            {type === 'area' && <Activity className="w-4 h-4" />}
            {title}
          </h4>
        )}
        {renderChart()}
      </div>
    )
  } catch (e) {
    console.error('Chart parsing error:', e)
    return <div className="p-4 bg-red-50 text-red-600 rounded text-sm">차트 파싱 오류</div>
  }
}

// 이미지 플레이스홀더 컴포넌트
function ImagePlaceholder({ data }: { data: any }) {
  try {
    const imageData = typeof data === 'string' ? JSON.parse(data) : data
    const { type, description } = imageData

    const typeLabels: Record<string, string> = {
      product: '제품 이미지',
      diagram: '다이어그램',
      screenshot: '스크린샷',
      logo: '로고',
      team: '팀 사진',
      infographic: '인포그래픽'
    }

    return (
      <div className="my-4 border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer group">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
            <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            {typeLabels[type] || '이미지'} 삽입 영역
          </p>
          <p className="text-xs text-gray-500 mb-3">{description}</p>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors">
            <Upload className="w-3 h-3" />
            이미지 업로드
          </button>
        </div>
      </div>
    )
  } catch (e) {
    console.error('Image placeholder parsing error:', e)
    return <div className="p-4 bg-red-50 text-red-600 rounded text-sm">이미지 플레이스홀더 오류</div>
  }
}

// Mermaid 다이어그램 렌더링 (간단한 텍스트 표시, 실제 렌더링은 추후 구현)
function MermaidDiagram({ code }: { code: string }) {
  return (
    <div className="my-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="text-sm font-medium text-slate-700">다이어그램</span>
      </div>
      <pre className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
      <p className="text-xs text-slate-500 mt-2 italic">* 다이어그램은 문서 내보내기 시 렌더링됩니다</p>
    </div>
  )
}

// 커스텀 마크다운 코드 블록 렌더러
function CustomCodeBlock({ node, inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  const codeContent = String(children).replace(/\n$/, '')

  // 차트 블록
  if (language === 'chart') {
    return <ChartRenderer data={codeContent} />
  }

  // 이미지 플레이스홀더 블록
  if (language === 'image') {
    return <ImagePlaceholder data={codeContent} />
  }

  // Mermaid 다이어그램
  if (language === 'mermaid') {
    return <MermaidDiagram code={codeContent} />
  }

  // 기본 코드 블록
  return inline ? (
    <code className={cn("bg-gray-100 px-1 py-0.5 rounded text-sm", className)} {...props}>
      {children}
    </code>
  ) : (
    <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto my-3">
      <code className={cn("text-sm", className)} {...props}>
        {children}
      </code>
    </pre>
  )
}

// 커스텀 마크다운 컴포넌트 타입
type MarkdownComponentProps = {
  children?: React.ReactNode
  [key: string]: any
}

// 커스텀 테이블 렌더러 (HWP 스타일)
const markdownComponents = {
  code: CustomCodeBlock,
  table: ({ children }: MarkdownComponentProps) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: MarkdownComponentProps) => (
    <thead className="bg-gray-100">{children}</thead>
  ),
  tr: ({ children }: MarkdownComponentProps) => (
    <tr className="border-b border-gray-300">{children}</tr>
  ),
  th: ({ children }: MarkdownComponentProps) => (
    <th className="border border-gray-300 px-3 py-2 text-left font-bold bg-gray-100 text-gray-700">
      {children}
    </th>
  ),
  td: ({ children }: MarkdownComponentProps) => (
    <td className="border border-gray-300 px-3 py-2 text-left">
      {children}
    </td>
  ),
}

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
  char_count?: number
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
  content?: string
  detail_url?: string
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
  const [showExistingPlanModal, setShowExistingPlanModal] = useState(false)
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

  // 스트리밍 상태
  const [streamingSections, setStreamingSections] = useState<Record<string, { title: string; content: string; complete: boolean }>>({})
  const [currentStreamingSection, setCurrentStreamingSection] = useState<string | null>(null)
  const [streamingStatus, setStreamingStatus] = useState<string>('')
  const [generationError, setGenerationError] = useState<string | null>(null)

  // 리사이징 상태
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)

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

  // 기존 계획서 체크 - 있으면 선택 모달, 없으면 자동 생성
  useEffect(() => {
    if (!programId || loading || generating || autoGenerateTriggered || !program) return

    const hasSections = businessPlan && Object.keys(businessPlan.sections || {}).length > 0

    if (hasSections) {
      // 기존 계획서가 있으면 선택 모달 표시
      console.log('[BusinessPlan] Existing plan found, showing modal')
      setShowExistingPlanModal(true)
      setAutoGenerateTriggered(true) // 모달 중복 방지
    } else {
      // 기존 계획서가 없으면 자동 생성
      console.log('[BusinessPlan] No existing plan, auto-generating')
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

  // 현재 스트리밍 섹션으로 자동 스크롤
  useEffect(() => {
    if (currentStreamingSection && generating) {
      const element = document.getElementById(`streaming-section-${currentStreamingSection}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentStreamingSection, generating])

  // 사업계획서 생성 (스트리밍)
  const generatePlan = async () => {
    if (!programId) {
      console.error('[BusinessPlan] generatePlan called without programId')
      return
    }

    console.log('[BusinessPlan] Starting streaming generation for program:', programId)
    setGenerating(true)
    setGenerationStartTime(Date.now())
    setGenerationProgress(0)
    setStreamingSections({})
    setCurrentStreamingSection(null)
    setStreamingStatus('초기화 중...')
    setGenerationError(null)

    try {
      const res = await fetch('/api/skills/business-plan/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: programId })
      })

      if (!res.ok) {
        throw new Error('스트리밍 API 오류')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let businessPlanId: string | null = null
      const sectionsData: Record<string, any> = {}

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case 'start':
                  setStreamingStatus('프로그램 정보 로드 완료')
                  break

                case 'status':
                  setStreamingStatus(data.message)
                  break

                case 'plan_created':
                  businessPlanId = data.business_plan_id
                  setStreamingStatus('사업계획서 생성 시작')
                  break

                case 'section_start':
                  setCurrentStreamingSection(data.section_key)
                  setStreamingStatus(`${data.section_title} 작성 중...`)
                  setGenerationProgress(data.progress)
                  setStreamingSections(prev => ({
                    ...prev,
                    [data.section_key]: {
                      title: data.section_title,
                      content: '',
                      complete: false
                    }
                  }))
                  break

                case 'section_chunk':
                  setStreamingSections(prev => ({
                    ...prev,
                    [data.section_key]: {
                      ...prev[data.section_key],
                      content: data.full_content
                    }
                  }))
                  break

                case 'section_complete':
                  sectionsData[data.section_key] = {
                    content: data.content,
                    title: data.section_title,
                    order: Object.keys(sectionsData).length + 1,
                    generated_at: new Date().toISOString(),
                    char_count: data.char_count
                  }
                  setGenerationProgress(data.progress)
                  setStreamingSections(prev => ({
                    ...prev,
                    [data.section_key]: {
                      ...prev[data.section_key],
                      content: data.content,
                      complete: true
                    }
                  }))
                  break

                case 'section_error':
                  setStreamingSections(prev => ({
                    ...prev,
                    [data.section_key]: {
                      ...prev[data.section_key],
                      content: `[생성 실패: ${data.error}]`,
                      complete: true
                    }
                  }))
                  break

                case 'complete':
                  setStreamingStatus('생성 완료!')
                  setGenerationProgress(100)

                  // 최종 사업계획서 설정
                  const newPlan: BusinessPlan = {
                    id: businessPlanId || data.business_plan_id,
                    title: program?.title ? `${program.title} - 사업계획서` : '사업계획서',
                    status: 'completed',
                    sections: data.sections || sectionsData,
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
                    setSelectedSection(sectionKeys[0])
                    setEditContent(newPlan.sections[sectionKeys[0]]?.content || '')
                    setEditMode(true)
                  }
                  break

                case 'error':
                  setGenerationError(data.message || '생성 실패')
                  setStreamingStatus('')
                  setGenerating(false)
                  setGenerationStartTime(null)
                  break
              }
            } catch (e) {
              // JSON 파싱 실패는 무시
            }
          }
        }
      }
    } catch (error) {
      console.error('[BusinessPlan] Generation error:', error)
      alert('사업계획서 생성 중 오류가 발생했습니다.')
    } finally {
      console.log('[BusinessPlan] Generation complete')
      setGenerating(false)
      setGenerationStartTime(null)
      setCurrentStreamingSection(null)
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

  // 전체 사업계획서 저장 (현재 상태 그대로 저장)
  const handleSaveAll = async () => {
    if (!businessPlan) return

    setSaving(true)
    try {
      const res = await fetch(`/api/skills/business-plan/${businessPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'draft'
        })
      })

      const data = await res.json()

      if (data.success) {
        setBusinessPlan(data.business_plan)
        alert('사업계획서가 저장되었습니다.')
      } else {
        alert(data.error || '저장 실패')
      }
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장 중 오류가 발생했습니다.')
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
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                저장
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex h-[calc(100vh-64px)]">
        {!businessPlan || Object.keys(businessPlan.sections || {}).length === 0 ? (
          /* 사업계획서 없음 또는 섹션 없음 - 생성 UI */
          generating ? (
            /* 스트리밍 생성 UI - 왼쪽 섹션트리거 + 오른쪽 콘텐츠 */
            <>
              {/* 왼쪽: 섹션 트리거 사이드바 */}
              <div
                style={{ width: sidebarWidth }}
                className="bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col h-full font-sans flex-shrink-0"
              >
                {/* 헤더 */}
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      AI 생성 중
                    </h2>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      <span className="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded">
                        {generationProgress}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">{streamingStatus}</p>
                  {/* 진행률 바 */}
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${generationProgress}%`, background: themeColor }}
                    />
                  </div>
                </div>

                {/* 섹션 트리거 목록 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {/* 기본 섹션 목록 (스트리밍 데이터 기반) */}
                  {Object.entries(streamingSections).length > 0 ? (
                    Object.entries(streamingSections).map(([key, section], idx) => {
                      const isActive = currentStreamingSection === key
                      const isComplete = section.complete
                      const Icon = SECTION_ICONS[key] || FileText

                      return (
                        <div
                          key={key}
                          className={cn(
                            "relative pl-6 pb-4 border-l-2 last:border-0 ml-4 transition-all",
                            isComplete ? "border-green-500/50" : isActive ? "border-yellow-500" : "border-zinc-800"
                          )}
                        >
                          {/* 타임라인 노드 */}
                          <div className={cn(
                            "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 transition-all",
                            isComplete
                              ? "bg-green-500 border-green-500"
                              : isActive
                                ? "bg-yellow-500 border-yellow-500 animate-pulse"
                                : "bg-black border-zinc-700"
                          )} />

                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-xs font-bold uppercase tracking-wider",
                                isComplete ? "text-green-400" : isActive ? "text-yellow-400" : "text-zinc-500"
                              )}>
                                Step {idx + 1}
                              </span>
                              {isComplete && (
                                <span className="text-[10px] text-zinc-600 font-mono">
                                  {section.content.length.toLocaleString()}자
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Icon className={cn(
                                "w-4 h-4",
                                isComplete ? "text-green-400" : isActive ? "text-yellow-400" : "text-zinc-500"
                              )} />
                              <h3 className={cn(
                                "text-sm font-medium",
                                isComplete ? "text-white" : isActive ? "text-yellow-100" : "text-zinc-400"
                              )}>
                                {section.title}
                              </h3>
                            </div>

                            {/* 상태 표시 */}
                            {isActive && (
                              <div className="mt-2 text-xs text-yellow-400/80 font-mono bg-yellow-500/10 p-2 rounded border border-yellow-500/20 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                작성 중...
                              </div>
                            )}
                            {isComplete && (
                              <div className="mt-2 text-xs text-green-400/80 font-mono bg-green-500/10 p-2 rounded border border-green-500/20 flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3" />
                                완료
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    /* 대기 중 - 기본 섹션 표시 */
                    <div className="text-center py-10 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" style={{ color: themeColor }} />
                      <p className="text-sm">섹션 생성 준비 중...</p>
                    </div>
                  )}
                </div>

                {/* 하단 상태 */}
                <div className="p-4 bg-black border-t border-white/10 font-mono text-[10px] text-zinc-400">
                  <div className="flex justify-between mb-1">
                    <span>SECTIONS</span>
                    <span className="text-green-400">
                      {Object.values(streamingSections).filter(s => s.complete).length} / {Object.keys(streamingSections).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>TOTAL_CHARS</span>
                    <span className="text-blue-400">
                      {Object.values(streamingSections).reduce((acc, s) => acc + (s.content?.length || 0), 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 콘텐츠 영역 */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#1a1a1f]">
                <div className="max-w-4xl mx-auto space-y-6">
                  {Object.entries(streamingSections).map(([key, section], idx) => (
                    <div
                      key={key}
                      id={`streaming-section-${key}`}
                      className={cn(
                        "rounded-xl border transition-all",
                        section.complete
                          ? "bg-white/5 border-white/10"
                          : currentStreamingSection === key
                            ? "bg-yellow-500/5 border-yellow-500/30"
                            : "bg-white/[0.02] border-white/10"
                      )}
                    >
                      {/* 섹션 헤더 */}
                      <div className={cn(
                        "px-5 py-3 border-b flex items-center justify-between",
                        section.complete ? "border-white/10" : "border-yellow-500/20"
                      )}>
                        <div className="flex items-center gap-3">
                          {section.complete ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          ) : (
                            <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                          )}
                          <h3 className="text-base font-semibold text-white">{section.title}</h3>
                        </div>
                        {section.complete && (
                          <span className="text-xs text-zinc-500">{section.content.length.toLocaleString()}자</span>
                        )}
                      </div>

                      {/* 섹션 콘텐츠 */}
                      <div className="p-5">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {section.content || '생성 중...'}
                          </ReactMarkdown>
                          {!section.complete && section.content && (
                            <span className="inline-block w-2 h-5 bg-yellow-400/50 animate-pulse ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 대기 중 표시 */}
                  {Object.keys(streamingSections).length === 0 && (
                    <div className="text-center py-20 text-zinc-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: themeColor }} />
                      <p>AI가 회사 정보를 분석하고 있습니다...</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* 초기 화면 - 심플하게 */
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-lg space-y-6">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                >
                  <Wand2 className="w-10 h-10 text-white" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">AI 사업계획서</h2>
                  <p className="text-zinc-400">
                    {program ? '지원사업에 최적화된 사업계획서를 AI가 작성합니다' : '지원사업을 선택해주세요'}
                  </p>
                </div>

                {generationError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {generationError}
                    </div>
                  </div>
                )}

                {program && (
                  <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-sm text-zinc-300">{program.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{program.organization}</p>
                  </div>
                )}

                {program ? (
                  <button
                    onClick={generatePlan}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                  >
                    <Sparkles className="w-5 h-5" />
                    생성하기
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/dashboard-group/company/government-programs')}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                  >
                    지원사업 선택
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}

                <p className="text-xs text-zinc-600">Gemini 2.5 Flash · 약 1-2분 소요</p>
              </div>
            </div>
          )
        ) : (
          <>
            {/* 왼쪽: AI 작업 루프 (Agent Loop) */}
            <div
              style={{ width: sidebarWidth }}
              className="bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col h-full font-sans flex-shrink-0"
            >
              {/* 헤더 */}
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    AI Agent Pipeline
                  </h2>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded">
                      Live
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  실시간으로 기업 데이터를 분석하고<br />최적의 사업계획서 전략을 수립합니다.
                </p>
              </div>

              {/* AI 작업 피드 (Loop Visualization) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. 작업 대기열 시각화 - Generating 상태일 때 보여줌 */}
                {generating && (
                  <div className="relative pl-6 pb-6 border-l-2 border-dashed border-zinc-800 last:border-0 ml-4 animate-pulse">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Active Process</span>
                      <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                          <span className="text-sm font-bold text-white">섹션별 초안 생성 중...</span>
                        </div>
                        <div className="space-y-1">
                          {['기업 현황 분석', '경쟁사 데이터 크롤링', 'SWOT 분석 적용', '문장 다듬기'].map((task, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                              <CheckCircle2 className="w-3 h-3 text-green-500/50" />
                              {task}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. 섹션 생성 로그 (Loop Nodes) */}
                {sortedSections.map(([key, section], idx) => {
                  const isComplete = !!section.content;
                  const isSelected = selectedSection === key;

                  return (
                    <div key={key} className="relative pl-6 pb-6 border-l-2 border-zinc-800 last:border-0 ml-4">
                      {/* 타임라인 노드 */}
                      <div className={cn(
                        "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 transition-all cursor-pointer",
                        isComplete ? "bg-blue-500 border-blue-500" : "bg-black border-zinc-700",
                        isSelected && "ring-2 ring-white ring-offset-2 ring-offset-black"
                      )}
                        onClick={() => {
                          setSelectedSection(key);
                          // 해당 섹션으로 스크롤 이동
                          document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                      />

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            isComplete ? "text-blue-400" : "text-zinc-500"
                          )}>
                            Step {idx + 1}
                          </span>
                          {isComplete && <span className="text-[10px] text-zinc-600 font-mono">{(section.char_count || 0).toLocaleString()}자 작성됨</span>}
                        </div>

                        <h3 className={cn(
                          "text-sm font-medium transition-colors cursor-pointer hover:text-white",
                          isSelected ? "text-white" : "text-zinc-400"
                        )} onClick={() => {
                          setSelectedSection(key);
                          document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}>
                          {section.title}
                        </h3>

                        {/* AI 생각/로그 */}
                        {isComplete && (
                          <div className="mt-2 text-xs text-zinc-500 font-mono bg-white/5 p-2 rounded border border-white/5">
                            <span className="text-blue-400">$</span> 완료: 데이터 기반 초안 작성<br />
                            <span className="text-blue-400">$</span> 검증: 오타 및 비문 검사 Pass
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 터미널 스타일 상태창 */}
              <div className="p-4 bg-black border-t border-white/10 font-mono text-[10px] text-zinc-400">
                <div className="flex justify-between mb-1">
                  <span>MEMORY_USAGE</span>
                  <span className="text-green-400">42%</span>
                </div>
                <div className="flex justify-between">
                  <span>TOKENS_GENERATED</span>
                  <span className="text-blue-400">{(sortedSections.reduce((acc, [, s]) => acc + (s.char_count || 0), 0) * 1.5).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Resizer Handle */}
            <div
              className="w-1 bg-white/5 hover:bg-white/20 cursor-col-resize hover:w-1.5 transition-all z-50 flex flex-col justify-center items-center group relative"
              onMouseDown={() => setIsResizing(true)}
            >
              <div className="h-8 w-1 bg-zinc-600 rounded-full group-hover:bg-blue-500 transition-colors" />
              <div className={cn(
                "absolute top-1/2 left-4 px-2 py-1 bg-black text-xs text-white rounded opacity-0 transition-opacity whitespace-nowrap pointer-events-none",
                isResizing && "opacity-100"
              )}>
                {sidebarWidth}px
              </div>
            </div>

            {/* 오른쪽: A4 양식 에디터 (Template Editor) - User Request: "공고문에 첨부되어있는 사업계획서 양식 그대로" */}
            <div className="flex-1 bg-[#2e2e33] overflow-y-auto flex justify-center p-8 relative">
              {/* 배경 그리드 패턴 */}
              <div className="absolute inset-0 opacity-[0.05]"
                style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
              />

              <div className="w-full max-w-[210mm] space-y-8 pb-32">
                {/* 문서 컨테이너 (A4) */}
                <div className="bg-white text-black min-h-[297mm] w-full p-[20mm] shadow-2xl relative font-sans">
                  {/* 워터마크/가이드라인 */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-blue-600/10 border-b border-blue-600/20 flex items-center justify-center text-[10px] text-blue-600 uppercase tracking-widest font-bold print:hidden">
                    Standard Business Plan Template (HWP Compatible Mode)
                  </div>

                  {/* 제목 정보 */}
                  <div className="text-center mb-12 border-b-2 border-black pb-8 mt-8">
                    <div className="text-sm text-zinc-500 mb-2">[별지 제1호 서식]</div>
                    <h1 className="text-3xl font-bold tracking-tight text-black mb-8">
                      {businessPlan?.title || '2025년도 창업성장기술개발사업 사업계획서'}
                    </h1>

                    {/* HWP 스타일 표: 일반 현황 */}
                    <table className="w-full border-collapse border border-black mt-8 text-sm">
                      <tbody>
                        <tr>
                          <td className="border border-black bg-zinc-100 p-2 font-bold w-32 text-center h-10 align-middle">과제명</td>
                          <td className="border border-black p-2 h-10 align-middle">{program?.title || 'AI 기반 스마트 비즈니스 솔루션 개발'}</td>
                        </tr>
                        <tr>
                          <td className="border border-black bg-zinc-100 p-2 font-bold w-32 text-center h-10 align-middle">주관기관</td>
                          <td className="border border-black p-2 bg-blue-50/50 h-10 align-middle">
                            <span className="text-zinc-400 text-xs mr-2">[자동입력]</span>
                            (주)글로우어스
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-black bg-zinc-100 p-2 font-bold w-32 text-center h-10 align-middle">대표자</td>
                          <td className="border border-black p-2 bg-blue-50/50 h-10 align-middle">
                            이진수
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 섹션들 렌더링 (A4 문서 흐름처럼) */}
                  {sortedSections.map(([key, section], idx) => {
                    const isSelected = selectedSection === key;
                    const content = section.content || '';

                    return (
                      <div key={key} id={`section-${key}`} className={cn(
                        "mb-8 scroll-mt-32",
                        isSelected ? "outline outline-2 outline-blue-500 outline-offset-4 rounded-sm" : ""
                      )}>
                        {/* 섹션 제목 (HWP 스타일) */}
                        <h2 className="text-lg font-bold mb-3 flex items-center text-black">
                          <span className="mr-2">{idx + 1}.</span> {section.title}
                        </h2>

                        {/* HWP 테이블 스타일 에디터 */}
                        <div className="border border-black">
                          {/* 테이블 헤더 시뮬레이션 */}
                          <div className="bg-zinc-100 border-b border-black p-2 font-bold text-sm text-center">
                            세부 내용 및 추진 전략
                          </div>

                          {/* 편집 영역 - 줄이 있는 노트패드 느낌 */}
                          {/* 편집 영역 */}
                          {isSelected && editMode ? (
                            <div className="relative">
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full min-h-[150px] p-4 text-sm leading-relaxed resize-y focus:outline-none bg-blue-50/10 font-sans"
                                placeholder="내용을 입력하세요..."
                                autoFocus
                              />
                              <div className="absolute bottom-2 right-2 flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditMode(false);
                                  }}
                                  className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50"
                                >
                                  취소
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveSection();
                                  }}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                >
                                  저장
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="p-4 min-h-[150px] text-sm leading-relaxed hover:bg-zinc-50 transition-colors cursor-text prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-black prose-p:text-black prose-strong:text-black"
                              onClick={() => {
                                setSelectedSection(key);
                                setEditMode(true);
                                setEditContent(content);
                              }}
                            >
                              {content ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={markdownComponents}
                                >
                                  {content}
                                </ReactMarkdown>
                              ) : (
                                <span className="text-zinc-400 italic">[내용을 입력하거나 문서를 생성해주세요]</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 하단 캡션 */}
                        <div className="text-[10px] text-zinc-500 mt-1 text-right">
                          * 평가 위원 주요 검토 항목
                        </div>
                      </div>
                    )
                  })}

                  {/* 페이지 번호 (가짜) */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-zinc-400 font-serif">
                    - 1 -
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 기존 계획서 선택 모달 */}
      {showExistingPlanModal && businessPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExistingPlanModal(false)} />
          <GlassCard className="relative w-full max-w-lg p-6" hover={false}>
            {/* 헤더 */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
              >
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">기존 사업계획서 발견</h3>
                <p className="text-sm text-zinc-400">이미 작성된 사업계획서가 있습니다</p>
              </div>
            </div>

            {/* 기존 계획서 정보 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{program?.title || '사업계획서'}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  businessPlan.status === 'completed' ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                )}>
                  {businessPlan.status === 'completed' ? '완료' : '작성중'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{Object.keys(businessPlan.sections || {}).length}개 섹션</span>
                <span>·</span>
                <span>
                  마지막 수정: {new Date(businessPlan.updated_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            {/* 선택 옵션 */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowExistingPlanModal(false)
                  // 기존 계획서로 편집 모드 진입
                  const sections = Object.keys(businessPlan.sections || {})
                  if (sections.length > 0) {
                    setSelectedSection(sections[0])
                    setEditContent(businessPlan.sections[sections[0]]?.content || '')
                    setEditMode(true)
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-white hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
              >
                <Edit3 className="w-5 h-5" />
                <div>
                  <span className="font-medium">수정/편집하기</span>
                  <p className="text-xs text-white/70">기존 내용을 유지하고 수정합니다</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>

              <button
                onClick={() => {
                  setShowExistingPlanModal(false)
                  // 새로 생성
                  setBusinessPlan(null)
                  generatePlan()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left bg-white/5 text-zinc-300 hover:bg-white/10 transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                <div>
                  <span className="font-medium">새로 작성하기</span>
                  <p className="text-xs text-zinc-500">기존 내용을 삭제하고 새로 생성합니다</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowExistingPlanModal(false)}
              className="w-full mt-4 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-zinc-400 hover:bg-white/10 transition-all"
            >
              취소
            </button>
          </GlassCard>
        </div>
      )}

      {/* 재생성 모달 */}
      {
        showRegenerateModal && (
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
        )
      }

      {/* 인터뷰 모드 안내 모달 */}
      {
        showInterviewPrompt && interviewData && (
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
        )
      }
    </div >
  )
}
