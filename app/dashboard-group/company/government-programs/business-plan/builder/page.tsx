'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Play, CheckCircle2, XCircle, Clock,
  Sparkles, AlertCircle, Edit3, Save,
  Download, MessageSquare, Loader2, Zap,
  ChevronRight, ArrowLeft, RefreshCw, Pause,
  FileDown, StopCircle
} from 'lucide-react'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PIPELINE_STAGES as SHARED_PIPELINE_STAGES } from '@/lib/business-plan/types'

// =====================================================
// 타입 정의
// =====================================================

interface PipelineStage {
  stage: number
  name: string
  description: string
  required: boolean
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  progress?: number
  message?: string
  log?: {
    duration_ms?: number
    tokens_used?: number
    error_message?: string
  }
}

interface Section {
  id: string
  section_key: string
  section_title: string
  section_order: number
  content: string
  char_count: number
  max_char_limit?: number
  validation_status: string
  validation_messages: { type: string; message: string }[]
  has_placeholders: boolean
  placeholders: { placeholder_id: string; text: string; question: string }[]
  ai_generated: boolean
}

interface Question {
  id: string
  question_text: string
  question_type: string
  context?: string
  priority: number
  status: string
  answer?: string
  section?: {
    id: string
    section_title: string
  }
}

interface BusinessPlan {
  id: string
  title: string
  project_name?: string
  pipeline_stage: number
  pipeline_status: string
  completion_percentage: number
  total_tokens_used: number
  generation_cost: number
  program?: {
    id: string
    title: string
    organization: string
    apply_end_date?: string
  }
  sections?: Section[]
}

interface Job {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  current_stage: number
  stage_progress: Record<number, { status: string; message: string; progress: number }>
  error?: string
}

// 실제로 실행되는 스테이지 (1-8)만 필터링
const EXECUTABLE_STAGES = SHARED_PIPELINE_STAGES
  .filter(s => s.stage >= 1 && s.stage <= 8)
  .map(s => ({
    stage: s.stage,
    name: s.name,
    description: s.description,
    required: s.required
  }))

// =====================================================
// 메인 컴포넌트
// =====================================================

export default function PipelineBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('id')
  const programId = searchParams.get('program_id')

  const [plan, setPlan] = useState<BusinessPlan | null>(null)
  const [stages, setStages] = useState<PipelineStage[]>(
    EXECUTABLE_STAGES.map(s => ({ ...s, status: 'pending' as const }))
  )
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [activeTab, setActiveTab] = useState<'pipeline' | 'editor' | 'questions'>('pipeline')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { accentColor } = useThemeStore()
  const themeColorHex = accentColors.find(c => c.id === accentColor)?.color || '#3b82f6'

  // 파이프라인 실행 중 폴링 (2초마다)
  useEffect(() => {
    if (!running || !planId) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/business-plans/${planId}/pipeline`)
        const data = await res.json()

        // 스테이지 상태 업데이트
        if (data.stages) {
          const apiStages = data.stages.filter((s: any) => s.stage >= 1 && s.stage <= 8)
          setStages(prev => prev.map(s => {
            const apiStage = apiStages.find((as: any) => as.stage === s.stage)
            if (apiStage) {
              return {
                ...s,
                status: (apiStage.status === 'completed' ? 'completed'
                  : apiStage.status === 'failed' ? 'failed'
                  : apiStage.status === 'skipped' ? 'skipped'
                  : apiStage.status === 'running' ? 'processing'
                  : 'pending') as PipelineStage['status'],
                progress: apiStage.progress || (apiStage.status === 'completed' ? 100 : 0),
                message: apiStage.message,
                log: apiStage.log
              }
            }
            return s
          }))
        }

        // Job 상태 확인
        const runningJob = data.jobs?.find((j: Job) => j.status === 'running')
        if (runningJob) {
          setCurrentJob(runningJob)
        } else {
          // 완료 또는 실패
          setRunning(false)
          setCurrentJob(null)
          fetchPlan()
        }
      } catch (e) {
        console.error('[Polling] Failed:', e)
      }
    }, 2000) // 2초마다 폴링

    return () => clearInterval(pollInterval)
  }, [running, planId])

  useEffect(() => {
    console.log('[Builder] useEffect triggered - planId:', planId, 'programId:', programId)
    if (planId) {
      console.log('[Builder] Calling fetchPlan and fetchPipelineStatus')
      fetchPlan()
      fetchPipelineStatus()
    } else if (programId) {
      console.log('[Builder] Calling createNewPlan')
      createNewPlan()
    } else {
      console.log('[Builder] No planId or programId - setting loading false')
      setLoading(false)
    }
  }, [planId, programId])

  // =====================================================
  // API 호출 함수들
  // =====================================================

  const fetchPlan = async () => {
    try {
      console.log('[Builder] Fetching plan with ID:', planId)
      const res = await fetch(`/api/business-plans/${planId}`)
      const data = await res.json()
      console.log('[Builder] API response:', { status: res.status, ok: res.ok, error: data.error, hasPlan: !!data.plan })

      // API 에러 응답 처리 - 404인 경우 프로그램 ID일 수 있으므로 확인
      console.log('[Builder] Checking condition:', { notOk: !res.ok, dataError: data.error, condition: !res.ok || data.error })
      if (!res.ok || data.error) {
        console.log('[Builder] ENTERING ERROR BLOCK - status:', res.status, 'error:', data.error)

        // Plan not found - 해당 ID가 정부지원사업 ID인지 확인
        if (res.status === 404 || data.error === 'Plan not found') {
          console.log('[Builder] Plan not found, checking if ID is a program ID...')

          // 정부지원사업 ID인지 확인
          const progRes = await fetch(`/api/government-programs?id=${planId}`)
          const progData = await progRes.json()

          if (progData.programs?.length > 0 || progData.program) {
            // 프로그램 ID로 확인됨 - program_id로 리다이렉트하여 새 계획 생성
            console.log('[Builder] ID is a program ID, redirecting to create new plan...')
            router.replace(`/dashboard-group/company/government-programs/business-plan/builder?program_id=${planId}`)
            return
          }
        }

        // 401 Unauthorized인 경우 로그인 페이지로 리다이렉트
        if (res.status === 401) {
          console.log('[Builder] Unauthorized, redirecting to login...')
          router.push('/login')
          return
        }

        console.log('[Builder] Setting error from API error response')
        setError(data.error || '사업계획서를 찾을 수 없습니다')
        return
      }

      if (!data.plan) {
        console.log('[Builder] Setting error - no plan data')
        setError('사업계획서 데이터가 없습니다')
        return
      }

      // 성공 시 에러 상태 초기화
      console.log('[Builder] SUCCESS - clearing error and setting plan')
      setError(null)
      setPlan(data.plan)
      setQuestions(data.questions || [])
    } catch (error) {
      console.error('[Builder] CATCH - Failed to fetch plan:', error)
      setError('사업계획서를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const fetchPipelineStatus = async () => {
    if (!planId) return

    try {
      const res = await fetch(`/api/business-plans/${planId}/pipeline`)
      const data = await res.json()

      // API 에러 응답 처리 - 404는 아직 사업계획서가 없는 경우이므로 무시
      if (!res.ok || data.error) {
        if (res.status !== 404) {
          console.error('Pipeline status error:', data.error)
        }
        return
      }

      if (data.stages) {
        // API 스테이지에서 1-8만 필터링하여 상태 업데이트
        const apiStages = data.stages.filter((s: any) => s.stage >= 1 && s.stage <= 8)
        setStages(prev => prev.map(s => {
          const apiStage = apiStages.find((as: any) => as.stage === s.stage)
          if (apiStage) {
            return {
              ...s,
              status: apiStage.status || 'pending',
              progress: apiStage.progress,
              message: apiStage.message,
              log: apiStage.log
            }
          }
          return s
        }))
      }

      // 실행 중인 Job이 있으면 running 상태로
      if (data.jobs?.find((j: Job) => j.status === 'running')) {
        const runningJob = data.jobs.find((j: Job) => j.status === 'running')
        setRunning(true)
        setCurrentJob(runningJob)
      }
    } catch (error) {
      console.error('Failed to fetch pipeline status:', error)
    }
  }

  const createNewPlan = async () => {
    console.log('[Builder] createNewPlan called with programId:', programId)
    if (!programId) return

    try {
      const progRes = await fetch(`/api/government-programs?id=${programId}`)
      const progData = await progRes.json()
      const program = progData.programs?.[0]

      if (!program) {
        setError('공고를 찾을 수 없습니다')
        setLoading(false)
        return
      }

      const res = await fetch('/api/business-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${program.title} 사업계획서`,
          program_id: programId
        })
      })

      const data = await res.json()
      if (data.plan?.id) {
        router.replace(`/dashboard-group/company/government-programs/business-plan/builder?id=${data.plan.id}`)
      }
    } catch (error) {
      console.error('Failed to create plan:', error)
      setError('사업계획서 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // 파이프라인 실행
  // =====================================================

  const runPipeline = async () => {
    if (!planId || running) return
    setError(null)

    try {
      setRunning(true)

      // 스테이지 상태 초기화 (EXECUTABLE_STAGES 기준)
      setStages(EXECUTABLE_STAGES.map(s => ({
        ...s,
        status: 'pending' as const,
        progress: 0,
        message: undefined
      })))

      const res = await fetch(`/api/business-plans/${planId}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'async' })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '파이프라인 실행 실패')
      }

      if (data.job_id) {
        setCurrentJob({
          id: data.job_id,
          status: 'running',
          progress: 0,
          current_stage: 0,
          stage_progress: {}
        })
        // 폴링이 자동으로 시작됨 (useEffect에서)
      }
    } catch (err: any) {
      setError(err.message)
      setRunning(false)
    }
  }

  const cancelPipeline = async () => {
    if (!planId || !currentJob) return

    try {
      await fetch(`/api/business-plans/${planId}/pipeline?job_id=${currentJob.id}`, {
        method: 'DELETE'
      })
      setRunning(false)
      setCurrentJob(null)
    } catch (err) {
      console.error('Cancel failed:', err)
    }
  }

  // =====================================================
  // 문서 다운로드
  // =====================================================

  const downloadDocument = async (format: 'docx' | 'pdf') => {
    if (!planId) return

    try {
      // 직접 다운로드 API 호출
      const downloadUrl = `/api/business-plans/${planId}/download?format=${format}`

      // 새 창에서 다운로드 (브라우저가 파일로 인식)
      window.open(downloadUrl, '_blank')
    } catch (err) {
      console.error('Download failed:', err)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  // =====================================================
  // 섹션 편집
  // =====================================================

  const startEditing = (section: Section) => {
    setEditingSection(section.id)
    setEditContent(section.content)
  }

  const saveSection = async () => {
    if (!planId || !editingSection) return

    try {
      setSaving(true)
      const res = await fetch(`/api/business-plans/${planId}/sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: editingSection,
          content: editContent
        })
      })

      if (res.ok) {
        await fetchPlan()
        setEditingSection(null)
      }
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // 질문 답변
  // =====================================================

  const answerQuestion = async (questionId: string, answer: string) => {
    if (!planId) return

    try {
      const res = await fetch(`/api/business-plans/${planId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId, answer })
      })

      if (res.ok) {
        await fetchPlan()
        setQuestions(prev => prev.filter(q => q.id !== questionId))
      }
    } catch (err) {
      console.error('Answer failed:', err)
    }
  }

  // =====================================================
  // 렌더링
  // =====================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    )
  }

  if (!planId && !programId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50 dark:bg-zinc-900">
        <FileText className="w-16 h-16 text-gray-300 dark:text-zinc-600" />
        <p className="text-gray-500 dark:text-zinc-400">사업계획서 ID가 필요합니다</p>
        <Link
          href="/dashboard-group/company/government-programs"
          className="px-4 py-2 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg"
        >
          공고 목록으로
        </Link>
      </div>
    )
  }

  // 사업계획서를 찾을 수 없는 경우 (에러 화면)
  if (error && !plan && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gray-50 dark:bg-zinc-900">
        <AlertCircle className="w-16 h-16 text-red-400 dark:text-red-500" />
        <p className="text-gray-700 dark:text-zinc-300 font-medium">{error}</p>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          사업계획서가 존재하지 않거나 접근 권한이 없습니다
        </p>
        <Link
          href="/dashboard-group/company/government-programs"
          className="px-4 py-2 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg"
        >
          공고 목록으로
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-zinc-800 border-b dark:border-zinc-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard-group/company/government-programs"
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-zinc-300" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{plan?.title || '새 사업계획서'}</h1>
                {plan?.program && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400">
                    {plan.program.organization} · {plan.program.title}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 진행률 */}
              {running && currentJob && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded-full">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {currentJob.progress}%
                  </span>
                </div>
              )}

              {/* 완료율 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-zinc-700 rounded-full">
                <Zap className="w-4 h-4 text-gray-600 dark:text-zinc-300" />
                <span className="text-sm text-gray-600 dark:text-zinc-300">
                  {plan?.completion_percentage || 0}% 완료
                </span>
              </div>

              {/* 다운로드 */}
              <div className="flex gap-1">
                <button
                  onClick={() => downloadDocument('docx')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                  title="DOCX 다운로드"
                >
                  <FileDown className="w-5 h-5 text-gray-600 dark:text-zinc-300" />
                </button>
              </div>

              {/* 실행/취소 버튼 */}
              {running ? (
                <button
                  onClick={cancelPipeline}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <StopCircle className="w-4 h-4" />
                  중지
                </button>
              ) : (
                <button
                  onClick={runPipeline}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
                  style={{ backgroundColor: themeColorHex }}
                >
                  <Play className="w-4 h-4" />
                  자동 생성
                </button>
              )}
            </div>
          </div>

          {/* 에러 표시 */}
          {error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                ×
              </button>
            </div>
          )}

          {/* 탭 */}
          <div className="flex gap-1 mt-4">
            {[
              { id: 'pipeline', label: '파이프라인', icon: Zap },
              { id: 'editor', label: '편집기', icon: Edit3 },
              { id: 'questions', label: `질문 (${questions.length})`, icon: MessageSquare }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-medium'
                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'pipeline' && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-2 gap-4"
            >
              {stages.map((stage, index) => (
                <motion.div
                  key={stage.stage}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    stage.status === 'completed'
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                      : stage.status === 'processing'
                        ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950 shadow-lg'
                        : stage.status === 'failed'
                          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
                          : 'border-gray-100 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 상태 아이콘 */}
                    <div className={`p-2 rounded-lg ${
                      stage.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                      stage.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900' :
                      stage.status === 'failed' ? 'bg-red-100 dark:bg-red-900' :
                      'bg-gray-100 dark:bg-zinc-700'
                    }`}>
                      {stage.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : stage.status === 'processing' ? (
                        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      ) : stage.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400 dark:text-zinc-500">
                          STAGE {stage.stage}
                        </span>
                        {stage.required && (
                          <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300 rounded">
                            필수
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium mt-1 text-gray-900 dark:text-zinc-100">{stage.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{stage.description}</p>

                      {/* 진행률 바 */}
                      {stage.status === 'processing' && stage.progress !== undefined && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-blue-500 dark:bg-blue-400"
                              initial={{ width: 0 }}
                              animate={{ width: `${stage.progress}%` }}
                            />
                          </div>
                          {stage.message && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{stage.message}</p>
                          )}
                        </div>
                      )}

                      {/* 완료 정보 */}
                      {stage.status === 'completed' && stage.log && (
                        <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-zinc-400">
                          {stage.log.duration_ms && (
                            <span>{(stage.log.duration_ms / 1000).toFixed(1)}초</span>
                          )}
                          {stage.log.tokens_used && (
                            <span>{stage.log.tokens_used.toLocaleString()} 토큰</span>
                          )}
                        </div>
                      )}

                      {/* 에러 메시지 */}
                      {stage.status === 'failed' && stage.log?.error_message && (
                        <p className="text-xs text-red-600 mt-2">{stage.log.error_message}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === 'editor' && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {plan?.sections?.length ? (
                plan.sections.map(section => (
                  <div key={section.id} className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-zinc-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-400 dark:text-zinc-500">
                          {section.section_order}.
                        </span>
                        <h3 className="font-medium text-gray-900 dark:text-zinc-100">{section.section_title}</h3>
                        {section.validation_status === 'valid' && (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        {section.validation_status === 'warning' && (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        {section.validation_status === 'invalid' && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 dark:text-zinc-500">
                          {section.char_count?.toLocaleString()}자
                          {section.max_char_limit && ` / ${section.max_char_limit.toLocaleString()}`}
                        </span>
                        {editingSection === section.id ? (
                          <button
                            onClick={saveSection}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            저장
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditing(section)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                          >
                            <Edit3 className="w-4 h-4 text-gray-600 dark:text-zinc-400" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      {editingSection === section.id ? (
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="w-full min-h-[300px] p-3 text-sm border dark:border-zinc-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                          placeholder="섹션 내용을 입력하세요..."
                        />
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          {section.content ? (
                            <div
                              className="whitespace-pre-wrap text-gray-700 dark:text-zinc-300"
                              dangerouslySetInnerHTML={{
                                __html: section.content.replace(
                                  /\{\{미확정:([^}]+)\}\}/g,
                                  '<mark class="bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 px-1 rounded">[$1]</mark>'
                                )
                              }}
                            />
                          ) : (
                            <p className="text-gray-400 dark:text-zinc-500 italic">내용이 없습니다. 파이프라인을 실행하세요.</p>
                          )}
                        </div>
                      )}
                    </div>
                    {section.validation_messages?.length > 0 && (
                      <div className="px-4 pb-4">
                        {section.validation_messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 p-2 rounded text-sm ${
                              msg.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' :
                              msg.type === 'warning' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                              'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {msg.type === 'error' ? <XCircle className="w-4 h-4" /> :
                             msg.type === 'warning' ? <AlertCircle className="w-4 h-4" /> :
                             <CheckCircle2 className="w-4 h-4" />}
                            {msg.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-gray-500 dark:text-zinc-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                  <p>생성된 섹션이 없습니다</p>
                  <p className="text-sm mt-1">파이프라인을 실행하여 섹션을 생성하세요</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'questions' && (
            <motion.div
              key="questions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {questions.length > 0 ? (
                questions.map(q => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    onAnswer={(answer) => answerQuestion(q.id, answer)}
                  />
                ))
              ) : (
                <div className="text-center py-16 text-gray-500 dark:text-zinc-400">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-zinc-600" />
                  <p>미확정 질문이 없습니다</p>
                  <p className="text-sm mt-1">모든 정보가 확정되었습니다</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// =====================================================
// 질문 카드 컴포넌트
// =====================================================

function QuestionCard({
  question,
  onAnswer
}: {
  question: Question
  onAnswer: (answer: string) => void
}) {
  const [answer, setAnswer] = useState(question.answer || '')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!answer.trim()) return
    setSubmitting(true)
    await onAnswer(answer)
    setSubmitting(false)
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {question.section && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-full">
                {question.section.section_title}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              우선순위 {question.priority}
            </span>
          </div>
          <p className="font-medium text-gray-900 dark:text-zinc-100">{question.question_text}</p>
          {question.context && (
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{question.context}</p>
          )}

          <div className="mt-3">
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              className="w-full p-3 text-sm border dark:border-zinc-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
              placeholder="답변을 입력하세요..."
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmit}
                disabled={!answer.trim() || submitting}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                답변 제출
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
