'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useTheme } from 'next-themes'
import {
  FileText,
  Loader2,
  ArrowLeft,
  Calendar,
  Building2,
  Trash2,
  Edit3,
  ChevronRight,
  FileEdit,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react'

interface BusinessPlan {
  id: string
  program_id: string
  status: 'draft' | 'completed' | 'generating'
  sections: Record<string, any>
  created_at: string
  updated_at: string
  government_programs?: {
    title: string
    organization: string
  }
}

export default function MyBusinessPlansPage() {
  const router = useRouter()
  const { accentColor } = useThemeStore()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const themeColor = accentColors.find(c => c.id === accentColor)?.color || '#6366f1'

  const [plans, setPlans] = useState<BusinessPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/skills/business-plan/generate')
      const data = await response.json()
      if (data.success && data.business_plans) {
        setPlans(data.business_plans)
      }
    } catch (error) {
      console.error('사업계획서 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (planId: string) => {
    if (!confirm('정말로 이 사업계획서를 삭제하시겠습니까?')) return

    setDeleting(planId)
    try {
      const response = await fetch(`/api/skills/business-plan/${planId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setPlans(prev => prev.filter(p => p.id !== planId))
      } else {
        alert(data.error || '삭제 실패')
      }
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(null)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: '완료', color: '#10b981', icon: CheckCircle2 }
      case 'draft':
        return { label: '작성중', color: themeColor, icon: Edit3 }
      case 'generating':
        return { label: '생성중', color: '#f59e0b', icon: Clock }
      default:
        return { label: '알 수 없음', color: '#71717a', icon: AlertCircle }
    }
  }

  const getSectionCount = (sections: Record<string, any> | null) => {
    if (!sections) return 0
    return Object.keys(sections).length
  }

  return (
    <div className={cn("h-full flex flex-col", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}>
      {/* 헤더 */}
      <div className={cn(
        "sticky top-0 z-20 px-8 h-16 flex items-center justify-between border-b backdrop-blur-xl",
        isDark ? "bg-black/20 border-white/5" : "bg-white/90 border-zinc-200"
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div
            className="p-2.5 rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
          >
            <FileEdit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={cn("text-lg font-bold", isDark ? "text-white" : "text-gray-900")}>
              작성중 사업계획서
            </h1>
            <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
              저장된 사업계획서를 관리하세요
            </p>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-full text-sm font-medium",
          isDark ? "bg-white/10 text-zinc-300" : "bg-gray-100 text-gray-600"
        )}>
          총 {plans.length}개
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
          </div>
        ) : plans.length === 0 ? (
          <div className={cn(
            "text-center py-20 rounded-2xl border",
            isDark ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
          )}>
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className={cn("text-lg font-medium mb-2", isDark ? "text-white" : "text-gray-900")}>
              작성중인 사업계획서가 없습니다
            </p>
            <p className={cn("text-sm mb-6", isDark ? "text-zinc-400" : "text-gray-500")}>
              지원사업을 선택하고 AI로 사업계획서를 생성해보세요
            </p>
            <button
              onClick={() => router.push('/dashboard-group/company/government-programs?view=list')}
              className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)` }}
            >
              지원사업 둘러보기
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((plan) => {
              const statusInfo = getStatusInfo(plan.status)
              const StatusIcon = statusInfo.icon
              const sectionCount = getSectionCount(plan.sections)

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "p-5 rounded-2xl border transition-all group",
                    isDark
                      ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                      : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* 왼쪽: 정보 */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/dashboard-group/company/government-programs/business-plan?program_id=${plan.program_id}`)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: `${statusInfo.color}20`, color: statusInfo.color }}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                        {sectionCount > 0 && (
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            isDark ? "bg-white/10 text-zinc-400" : "bg-gray-100 text-gray-500"
                          )}>
                            {sectionCount}개 섹션
                          </span>
                        )}
                      </div>

                      <h3 className={cn(
                        "font-semibold text-base mb-1 truncate group-hover:underline",
                        isDark ? "text-white" : "text-gray-900"
                      )}>
                        {plan.government_programs?.title || '사업계획서'}
                      </h3>

                      <div className="flex items-center gap-4 text-sm">
                        <span className={cn(
                          "flex items-center gap-1.5",
                          isDark ? "text-zinc-400" : "text-gray-500"
                        )}>
                          <Building2 className="w-4 h-4" />
                          {plan.government_programs?.organization || '정부지원사업'}
                        </span>
                        <span className={cn(
                          "flex items-center gap-1.5",
                          isDark ? "text-zinc-500" : "text-gray-400"
                        )}>
                          <Calendar className="w-4 h-4" />
                          {new Date(plan.updated_at || plan.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>

                      {/* 진행률 바 */}
                      {sectionCount > 0 && (
                        <div className="mt-3">
                          <div className={cn(
                            "h-1.5 rounded-full overflow-hidden",
                            isDark ? "bg-white/10" : "bg-gray-200"
                          )}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (sectionCount / 10) * 100)}%`,
                                background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80)`
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 오른쪽: 액션 버튼 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => router.push(`/dashboard-group/company/government-programs/business-plan?program_id=${plan.program_id}`)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          isDark
                            ? "bg-white/10 hover:bg-white/20 text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        )}
                      >
                        <Edit3 className="w-4 h-4" />
                        편집
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        disabled={deleting === plan.id}
                        className={cn(
                          "p-2 rounded-xl transition-all",
                          isDark
                            ? "hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                            : "hover:bg-red-50 text-gray-400 hover:text-red-500",
                          deleting === plan.id && "opacity-50"
                        )}
                      >
                        {deleting === plan.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
