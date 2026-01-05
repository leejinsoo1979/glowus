'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Brain, RefreshCw, CheckCircle, AlertTriangle, XCircle,
  ArrowRight, Sparkles, Target, TrendingUp, FileText
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface DiagnosisResult {
  category: string
  score: number
  status: 'good' | 'warning' | 'critical'
  message: string
  suggestions: string[]
}

interface CompanyProfile {
  business_type: string | null
  employee_count: number | null
  annual_revenue: number | null
  established_year: number | null
  main_industry: string | null
  has_patents: boolean
  has_certifications: boolean
}

const DIAGNOSIS_CATEGORIES = [
  { key: 'eligibility', label: '자격요건', icon: Target },
  { key: 'documents', label: '서류준비', icon: FileText },
  { key: 'competitiveness', label: '경쟁력', icon: TrendingUp },
  { key: 'readiness', label: '신청준비도', icon: Sparkles },
]

export default function AIDiagnosisPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [diagnosisResults, setDiagnosisResults] = useState<DiagnosisResult[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [overallScore, setOverallScore] = useState(0)
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchProfile()
    fetchDiagnosis()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/company-profile')
      const data = await res.json()
      setProfile(data.profile)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const fetchDiagnosis = async () => {
    try {
      // Simulate AI diagnosis results
      const mockResults: DiagnosisResult[] = [
        {
          category: 'eligibility',
          score: 85,
          status: 'good',
          message: '대부분의 정부지원사업 자격요건을 충족합니다.',
          suggestions: [
            '벤처기업 인증 취득 시 추가 가점 가능',
            'ISO 인증 취득 권장'
          ]
        },
        {
          category: 'documents',
          score: 65,
          status: 'warning',
          message: '일부 서류가 만료되었거나 누락되었습니다.',
          suggestions: [
            '납세증명서 갱신 필요 (만료 D-7)',
            '최신 재무제표 업로드 필요',
            '4대보험 가입증명서 준비'
          ]
        },
        {
          category: 'competitiveness',
          score: 78,
          status: 'good',
          message: 'R&D 역량과 기술력이 우수합니다.',
          suggestions: [
            '특허 1건 추가 출원 시 경쟁력 상승',
            '최근 3년 매출 성장률 강조 권장'
          ]
        },
        {
          category: 'readiness',
          score: 55,
          status: 'warning',
          message: '신청 준비가 미흡한 부분이 있습니다.',
          suggestions: [
            '사업계획서 템플릿 작성 필요',
            '핵심 기술 설명 자료 보완',
            '수행인력 이력서 업데이트'
          ]
        }
      ]

      setDiagnosisResults(mockResults)
      const avg = mockResults.reduce((sum, r) => sum + r.score, 0) / mockResults.length
      setOverallScore(Math.round(avg))
    } catch (error) {
      console.error('Failed to fetch diagnosis:', error)
    } finally {
      setLoading(false)
    }
  }

  const runDiagnosis = async () => {
    setAnalyzing(true)
    // Simulate AI analysis
    await new Promise(resolve => setTimeout(resolve, 2000))
    await fetchDiagnosis()
    setAnalyzing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return '#10b981'
      case 'warning': return '#f59e0b'
      case 'critical': return '#ef4444'
      default: return '#71717a'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return CheckCircle
      case 'warning': return AlertTriangle
      case 'critical': return XCircle
      default: return AlertTriangle
    }
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '우수'
    if (score >= 60) return '양호'
    if (score >= 40) return '보통'
    return '미흡'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: themeColor }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
            <Brain className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI 자격진단</h1>
            <p className="text-sm text-zinc-400">회사 정보 기반 지원사업 적합도 분석</p>
          </div>
        </div>

        <button
          onClick={runDiagnosis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: themeColor }}
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? '분석 중...' : '재분석'}
        </button>
      </div>

      {/* 종합 점수 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8"
      >
        <div className="flex items-center gap-8">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="#27272a"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke={themeColor}
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(overallScore / 100) * 352} 352`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{overallScore}</span>
              <span className="text-sm text-zinc-400">종합점수</span>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">
              지원사업 신청 준비도: <span style={{ color: themeColor }}>{getScoreLabel(overallScore)}</span>
            </h2>
            <p className="text-zinc-400 mb-4">
              {overallScore >= 80
                ? '대부분의 정부지원사업에 신청할 준비가 되어 있습니다.'
                : overallScore >= 60
                ? '일부 보완이 필요하지만 신청 가능한 사업이 많습니다.'
                : '신청 전 추가 준비가 필요합니다.'}
            </p>
            <Link
              href="/dashboard-group/company/government-programs/recommended"
              className="inline-flex items-center gap-2 text-sm hover:underline"
              style={{ color: themeColor }}
            >
              추천 공고 보기 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* 카테고리별 분석 */}
      <div className="grid grid-cols-2 gap-4">
        {diagnosisResults.map((result, index) => {
          const categoryInfo = DIAGNOSIS_CATEGORIES.find(c => c.key === result.category)
          const Icon = categoryInfo?.icon || Target
          const StatusIcon = getStatusIcon(result.status)
          const statusColor = getStatusColor(result.status)

          return (
            <motion.div
              key={result.category}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${statusColor}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: statusColor }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{categoryInfo?.label}</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
                      <span style={{ color: statusColor }}>{result.score}점</span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-zinc-400 mb-3">{result.message}</p>

              {result.suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-zinc-500 font-medium">개선 제안</div>
                  {result.suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-sm text-zinc-400"
                    >
                      <span className="text-zinc-600">•</span>
                      <span>{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* 액션 가이드 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5" style={{ color: themeColor }} />
          다음 단계 추천
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/dashboard-group/company/government-programs/documents"
            className="p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
          >
            <FileText className="w-6 h-6 text-zinc-400 group-hover:text-white mb-2" />
            <div className="text-sm font-medium text-white">서류 보관함</div>
            <div className="text-xs text-zinc-500">만료된 서류를 갱신하세요</div>
          </Link>

          <Link
            href="/dashboard-group/company/government-programs/checklist"
            className="p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
          >
            <CheckCircle className="w-6 h-6 text-zinc-400 group-hover:text-white mb-2" />
            <div className="text-sm font-medium text-white">체크리스트</div>
            <div className="text-xs text-zinc-500">신청 요건을 확인하세요</div>
          </Link>

          <Link
            href="/dashboard-group/company/government-programs/profile"
            className="p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors group"
          >
            <Target className="w-6 h-6 text-zinc-400 group-hover:text-white mb-2" />
            <div className="text-sm font-medium text-white">프로필 보완</div>
            <div className="text-xs text-zinc-500">회사 정보를 업데이트하세요</div>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
