'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Building2,
  ExternalLink,
  Tag,
  MapPin,
  Users,
  Clock,
  Loader2,
  FileText,
  Download,
  Bookmark,
  BookmarkCheck,
  Share2,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { AIMatchResult } from '@/components/government-programs/AIMatchResult'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

interface ProgramDetail {
  id: string
  program_id: string
  title: string
  category: string
  support_type?: string
  hashtags: string[]
  organization: string
  executing_agency?: string
  apply_start_date?: string
  apply_end_date?: string
  detail_url?: string
  source: string
  created_at: string
  content?: string // 스크래핑된 상세 내용
  summary?: string
  description?: string
  target?: string
  region?: string
  target_industries?: string[]
  target_regions?: string[]
  eligibility_criteria?: any
  support_amount?: string
  required_documents?: string[]
  application_method?: string
  application_form_url?: string
  contact_phone?: string
  attachments_primary?: Array<{ name: string; url: string }>
}

// 출처 라벨
const SOURCE_LABELS: Record<string, string> = {
  bizinfo: '기업마당',
  kstartup: 'K-Startup',
  semas: '소진공',
  bizinfo_event: '기업마당(행사)'
}

// 날짜 포맷
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// 남은 일수 계산
function getDaysRemaining(endDate?: string): { days: number; status: 'urgent' | 'warning' | 'normal' | 'ended' } {
  if (!endDate) return { days: -1, status: 'normal' }
  const end = new Date(endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff < 0) return { days: diff, status: 'ended' }
  if (diff <= 3) return { days: diff, status: 'urgent' }
  if (diff <= 7) return { days: diff, status: 'warning' }
  return { days: diff, status: 'normal' }
}

export default function ProgramDetailPage() {
  const params = useParams()
  const router = useRouter()
  const programId = params.id as string

  const [program, setProgram] = useState<ProgramDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [matchResult, setMatchResult] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const { resolvedTheme } = useTheme()
  const isDark = mounted ? resolvedTheme !== 'light' : true // Default to dark during SSR

  useEffect(() => {
    setMounted(true)
  }, [])

  // 프로그램 상세 정보 로드
  useEffect(() => {
    async function loadProgram() {
      try {
        const res = await fetch(`/api/government-programs?id=${programId}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || '프로그램을 찾을 수 없습니다.')
        }

        if (data.programs && data.programs.length > 0) {
          setProgram(data.programs[0])
        } else if (data.program) {
          setProgram(data.program)
        } else {
          throw new Error('프로그램을 찾을 수 없습니다.')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (programId) {
      loadProgram()
    }
  }, [programId])

  // 저장된 매칭 결과 로드
  useEffect(() => {
    async function loadMatchResult() {
      try {
        const res = await fetch(`/api/government-programs/match/ai?program_id=${programId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            setMatchResult(data.results[0])
          }
        }
      } catch (err) {
        // 매칭 결과가 없어도 에러 표시하지 않음
      }
    }

    if (programId) {
      loadMatchResult()
    }
  }, [programId])

  const handleDownloadAll = async () => {
    if (!program?.attachments_primary?.length) return

    try {
      setIsDownloading(true)
      const zip = new JSZip()
      const folder = zip.folder("attachments")

      const downloadPromises = (program as any).attachments_primary.map(async (file: any) => {
        try {
          const response = await fetch(file.url)
          const blob = await response.blob()
          folder?.file(file.name, blob)
        } catch (err) {
          console.error(`Failed to download ${file.name}:`, err)
        }
      })

      await Promise.all(downloadPromises)

      const content = await zip.generateAsync({ type: "blob" })
      saveAs(content, `${program.title}_attachments.zip`)
    } catch (err) {
      console.error('Download failed:', err)
      alert('다운로드 중 오류가 발생했습니다.')
    } finally {
      setIsDownloading(false)
    }
  }

  const remaining = getDaysRemaining(program?.apply_end_date)

  if (loading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className={isDark ? "text-zinc-400" : "text-gray-500"}>공고 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !program) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-4", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className={cn("text-xl font-bold mb-2", isDark ? "text-white" : "text-gray-900")}>오류 발생</h2>
          <p className={cn("mb-6", isDark ? "text-zinc-400" : "text-gray-500")}>{error || '프로그램을 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.push('/dashboard-group/company/government-programs')}
            className={cn("px-4 py-2 rounded-lg transition-colors", isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-900")}
          >
            뒤로 가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}>
      {/* 헤더 */}
      <header className={cn("sticky top-0 z-50 backdrop-blur-xl border-b", isDark ? "bg-black/80 border-white/10" : "bg-white/80 border-gray-200")}>
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard-group/company/government-programs')}
              className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}
            >
              <ArrowLeft className={cn("w-5 h-5", isDark ? "text-white" : "text-gray-900")} />
            </button>
            <div className="flex-1 min-w-0">
              <div className={cn("flex items-center gap-2 text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
                <span>{SOURCE_LABELS[program.source] || program.source}</span>
                <ChevronRight className="w-4 h-4" />
                <span>{program.category || '기타'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isBookmarked
                    ? "bg-yellow-500/20 text-yellow-400"
                    : isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
                )}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-5 h-5" />
                ) : (
                  <Bookmark className="w-5 h-5" />
                )}
              </button>
              <button className={cn("p-2 rounded-lg transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}>
                <Share2 className={cn("w-5 h-5", isDark ? "text-zinc-400" : "text-gray-500")} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 공고 정보 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 제목 & 기관 */}
            <div>
              <h1 className={cn("text-2xl lg:text-3xl font-bold mb-4 leading-tight", isDark ? "text-white" : "text-gray-900")}>
                {program.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className={cn("flex items-center gap-2", isDark ? "text-zinc-300" : "text-gray-600")}>
                  <Building2 className={cn("w-4 h-4", isDark ? "text-zinc-500" : "text-gray-400")} />
                  <span>{program.organization}</span>
                </div>
                {program.executing_agency && (
                  <div className={cn("flex items-center gap-2", isDark ? "text-zinc-400" : "text-gray-500")}>
                    <span>실행기관: {program.executing_agency}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 마감일 배너 */}
            <div className={cn(
              "p-4 rounded-xl border flex items-center justify-between",
              remaining.status === 'urgent' && "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)]",
              remaining.status === 'warning' && "bg-yellow-500/10 border-yellow-500/30",
              remaining.status === 'normal' && "bg-[rgba(var(--accent-color-rgb),0.1)] border-[rgba(var(--accent-color-rgb),0.3)]",
              remaining.status === 'ended' && (isDark ? "bg-zinc-800 border-zinc-700" : "bg-gray-100 border-gray-300")
            )}>
              <div className="flex items-center gap-3">
                <Clock className={cn(
                  "w-5 h-5",
                  remaining.status === 'urgent' && "text-[var(--accent-color)]",
                  remaining.status === 'warning' && "text-yellow-400",
                  remaining.status === 'normal' && "text-[var(--accent-color)]",
                  remaining.status === 'ended' && "text-zinc-500"
                )} />
                <div>
                  <div className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>
                    {remaining.status === 'ended' ? '마감됨' : (
                      remaining.days === 0 ? '오늘 마감' : `D-${remaining.days}`
                    )}
                  </div>
                  <div className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
                    {formatDate(program.apply_start_date)} ~ {formatDate(program.apply_end_date)}
                  </div>
                </div>
              </div>
              {program.detail_url && remaining.status !== 'ended' && (
                <a
                  href={program.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[var(--accent-color)] hover:bg-[var(--accent-color-hover)] text-white rounded-lg
                             flex items-center gap-2 text-sm font-medium transition-colors"
                >
                  <span>지원하기</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* 해시태그 */}
            {program.hashtags && program.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {program.hashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    className={cn("px-3 py-1 rounded-full text-sm", isDark ? "bg-zinc-800 text-zinc-300" : "bg-gray-200 text-gray-600")}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 기본 정보 카드 */}
            <div className={cn("rounded-xl p-6 border", isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-gray-200 shadow-sm")}>
              <h2 className={cn("text-lg font-semibold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                <FileText className="w-5 h-5 text-accent" />
                기본 정보
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {program.target && (
                  <InfoItem
                    icon={Users}
                    label="지원대상"
                    value={program.target}
                  />
                )}
                {program.region && (
                  <InfoItem
                    icon={MapPin}
                    label="지역"
                    value={program.region}
                  />
                )}
                {program.support_type && (
                  <InfoItem
                    icon={Tag}
                    label="지원유형"
                    value={program.support_type}
                  />
                )}
                {program.support_amount && (
                  <InfoItem
                    icon={Tag}
                    label="지원금액"
                    value={program.support_amount}
                  />
                )}
              </div>
            </div>

            {/* 상세 내용 */}
            {(program.content || program.summary || program.description) && (
              <div className={cn("rounded-xl p-6 border", isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-gray-200 shadow-sm")}>
                <h2 className={cn("text-lg font-semibold mb-4", isDark ? "text-white" : "text-gray-900")}>상세 내용</h2>
                <div className={cn("prose max-w-none k-startup-content", isDark ? "prose-invert prose-zinc" : "prose-gray")}>
                  <style jsx global>{`
                    .k-startup-content .k-startup-section { margin-bottom: 2rem; }
                    /* 기본 폰트 사이즈 및 컬러 - 다크모드 기본 */
                    .k-startup-content { font-size: 15px; line-height: 1.6; }
                    .dark .k-startup-content { color: #e4e4e7; }
                    html:not(.dark) .k-startup-content { color: #374151; }

                    /* 테이블 스타일 */
                    .k-startup-content table,
                    .k-startup-content .table {
                      width: 100%;
                      border-collapse: collapse;
                      margin-bottom: 1.5rem;
                      font-size: 0.9em;
                    }
                    .k-startup-content th,
                    .k-startup-content td {
                      padding: 10px;
                      text-align: left;
                    }
                    .dark .k-startup-content th,
                    .dark .k-startup-content td { border: 1px solid #3f3f46; }
                    html:not(.dark) .k-startup-content th,
                    html:not(.dark) .k-startup-content td { border: 1px solid #e5e7eb; }

                    .k-startup-content th { font-weight: 600; }
                    .dark .k-startup-content th { background-color: #27272a; color: #a1a1aa; }
                    html:not(.dark) .k-startup-content th { background-color: #f3f4f6; color: #4b5563; }
                    .k-startup-content td { background-color: transparent; }

                    /* 박스 스타일 */
                    .k-startup-content .app_notice_details-wrap { margin-top: 10px; }
                    .k-startup-content .information_box-wrap { margin-bottom: 30px; }

                    .k-startup-content .bg_box {
                      padding: 20px;
                      border-radius: 8px;
                      margin-bottom: 20px;
                    }
                    .dark .k-startup-content .bg_box { background: #18181b; border: 1px solid #3f3f46; }
                    html:not(.dark) .k-startup-content .bg_box { background: #f9fafb; border: 1px solid #e5e7eb; }

                    /* 내부 key-value 테이블 */
                    .k-startup-content .table_inner {
                      display: flex;
                      flex-direction: column;
                    }
                    .dark .k-startup-content .table_inner { border-bottom: 1px solid #27272a; }
                    html:not(.dark) .k-startup-content .table_inner { border-bottom: 1px solid #e5e7eb; }
                    @media (min-width: 768px) {
                      .k-startup-content .table_inner { flex-direction: row; align-items: stretch; }
                    }
                    .dark .k-startup-content .table_inner:first-child { border-top: 1px solid #27272a; }
                    html:not(.dark) .k-startup-content .table_inner:first-child { border-top: 1px solid #e5e7eb; }

                    .k-startup-content .tit {
                      padding: 12px 16px;
                      font-weight: 600;
                      display: flex;
                      align-items: center;
                    }
                    .dark .k-startup-content .tit { background: #27272a; color: #a1a1aa; }
                    html:not(.dark) .k-startup-content .tit { background: #f3f4f6; color: #4b5563; }
                    @media (min-width: 768px) {
                      .k-startup-content .tit { width: 160px; flex-shrink: 0; }
                      .dark .k-startup-content .tit { border-right: 1px solid #3f3f46; }
                      html:not(.dark) .k-startup-content .tit { border-right: 1px solid #e5e7eb; }
                    }
                    .k-startup-content .txt {
                      padding: 12px 16px;
                      flex: 1;
                      word-break: break-all;
                    }
                    .dark .k-startup-content .txt { color: #e4e4e7; }
                    html:not(.dark) .k-startup-content .txt { color: #374151; }

                    /* 본문 박스 */
                    .k-startup-content .box { margin-bottom: 2rem; }
                    .k-startup-content .box_inner {
                      padding: 24px;
                      border-radius: 12px;
                      min-height: 200px;
                    }
                    .dark .k-startup-content .box_inner { background: #18181b; border: 1px solid #3f3f46; }
                    html:not(.dark) .k-startup-content .box_inner { background: #ffffff; border: 1px solid #e5e7eb; }
                    .k-startup-content .tit_wrap { display: none; }

                    /* 리스트 스타일 */
                    .k-startup-content .dot_list-wrap { margin-top: 20px; }
                    .dark .k-startup-content .dot_list-wrap { border-top: 1px solid #3f3f46; }
                    html:not(.dark) .k-startup-content .dot_list-wrap { border-top: 1px solid #e5e7eb; }
                    .k-startup-content .dot_list {
                      list-style: none;
                      padding: 0;
                      margin: 0;
                    }
                    .dark .k-startup-content .dot_list { border-bottom: 1px solid #3f3f46; }
                    html:not(.dark) .k-startup-content .dot_list { border-bottom: 1px solid #e5e7eb; }
                    .k-startup-content .dot_list > li {
                      padding: 12px 16px;
                      display: flex;
                      align-items: flex-start;
                      gap: 8px;
                    }
                    .k-startup-content .dot_list > li::before {
                      content: '•';
                      color: var(--accent-color);
                      margin-top: 2px;
                    }

                    /* 유의사항 */
                    .k-startup-content .guide_wrap {
                      padding: 20px;
                      border-radius: 8px;
                      margin-top: 30px;
                    }
                    .dark .k-startup-content .guide_wrap { background: #2a2a30; border: 1px solid #3f3f46; }
                    html:not(.dark) .k-startup-content .guide_wrap { background: #fef3c7; border: 1px solid #fcd34d; }
                    .k-startup-content .guide_txt li {
                       margin-bottom: 6px;
                       padding-left: 14px;
                       position: relative;
                       font-size: 0.9em;
                    }
                    .dark .k-startup-content .guide_txt li { color: #d4d4d8; }
                    html:not(.dark) .k-startup-content .guide_txt li { color: #92400e; }
                    .k-startup-content .guide_txt li::before {
                       content: '-';
                       position: absolute;
                       left: 0;
                    }
                    .dark .k-startup-content .guide_txt li::before { color: #a1a1aa; }
                    html:not(.dark) .k-startup-content .guide_txt li::before { color: #b45309; }

                    /* 타이틀 스타일 */
                    .k-startup-content .information_list .title,
                    .k-startup-content h4 {
                      font-size: 1.125rem;
                      font-weight: 600;
                      margin-bottom: 1rem;
                      margin-top: 2rem;
                      padding-left: 12px;
                      border-left: 4px solid var(--accent-color);
                    }
                    .dark .k-startup-content .information_list .title,
                    .dark .k-startup-content h4 { color: white; }
                    html:not(.dark) .k-startup-content .information_list .title,
                    html:not(.dark) .k-startup-content h4 { color: #111827; }

                    /* 버튼 등 기타 요소 */
                    .k-startup-content a.btn_by-bl,
                    .k-startup-content .btn_file {
                      display: inline-flex;
                      align-items: center;
                      padding: 4px 12px;
                      border-radius: 4px;
                      font-size: 0.85rem;
                      text-decoration: none;
                      margin-right: 6px;
                    }
                    .dark .k-startup-content a.btn_by-bl,
                    .dark .k-startup-content .btn_file {
                      background-color: #27272a; color: #e4e4e7; border: 1px solid #3f3f46;
                    }
                    html:not(.dark) .k-startup-content a.btn_by-bl,
                    html:not(.dark) .k-startup-content .btn_file {
                      background-color: #f3f4f6; color: #374151; border: 1px solid #d1d5db;
                    }
                    .dark .k-startup-content a.btn_by-bl:hover { background-color: #3f3f46; }
                    html:not(.dark) .k-startup-content a.btn_by-bl:hover { background-color: #e5e7eb; }
                  `}</style>
                  <div dangerouslySetInnerHTML={{
                    __html: program.content ||
                      (program.description ? `<p>${program.description}</p>` : '') ||
                      (program.summary ? `<p>${program.summary}</p>` : '')
                  }} />
                </div>
              </div>
            )}

            {/* 원문 공고 링크 (상세 내용이 없을 때) */}
            {!program.content && !program.description && !program.summary && program.detail_url && (
              <div className={cn("rounded-xl p-6 border", isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-gray-200 shadow-sm")}>
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                    <ExternalLink className="w-8 h-8 text-accent" />
                  </div>
                  <div className="text-center">
                    <h2 className={cn("text-lg font-semibold mb-2", isDark ? "text-white" : "text-gray-900")}>원문 공고 확인</h2>
                    <p className={cn("text-sm mb-4", isDark ? "text-zinc-400" : "text-gray-500")}>
                      상세 내용은 원문 공고 페이지에서 확인하세요.
                    </p>
                  </div>
                  <a
                    href={program.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 btn-accent rounded-lg
                               font-medium transition-colors flex items-center gap-2"
                  >
                    원문 공고 보기
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* 제출 서류 */}
            {program.required_documents && program.required_documents.length > 0 && (
              <div className={cn("rounded-xl p-6 border", isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-gray-200 shadow-sm")}>
                <h2 className={cn("text-lg font-semibold mb-4", isDark ? "text-white" : "text-gray-900")}>제출 서류</h2>
                <ul className="space-y-2">
                  {program.required_documents.map((doc, idx) => (
                    <li key={idx} className={cn("flex items-start gap-2", isDark ? "text-zinc-300" : "text-gray-600")}>
                      <span className="text-accent mt-1">•</span>
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 첨부파일 */}
            {(program as any).attachments_primary && (program as any).attachments_primary.length > 0 && (
              <div className={cn("rounded-xl p-6 border", isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-gray-200 shadow-sm")}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>첨부파일</h2>
                  <button
                    onClick={handleDownloadAll}
                    disabled={isDownloading}
                    className={cn(
                      "text-sm flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors",
                      isDark
                        ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700",
                      isDownloading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    일괄 다운로드
                  </button>
                </div>
                <ul className="space-y-3">
                  {(program as any).attachments_primary.map((file: any, idx: number) => (
                    <li key={idx}>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all group",
                          isDark
                            ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800"
                            : "bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-md",
                          isDark ? "bg-zinc-800 group-hover:bg-zinc-700" : "bg-white group-hover:bg-gray-200"
                        )}>
                          <FileText className={cn("w-5 h-5", isDark ? "text-zinc-400" : "text-gray-500")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", isDark ? "text-zinc-200" : "text-gray-900")}>
                            {file.name}
                          </p>
                        </div>
                        <Download className={cn("w-4 h-4", isDark ? "text-zinc-500 group-hover:text-zinc-300" : "text-gray-400 group-hover:text-gray-600")} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 신청 방법 */}
            {program.application_method && (
              <div className={cn("rounded-xl p-6 border", isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-white border-gray-200 shadow-sm")}>
                <h2 className={cn("text-lg font-semibold mb-4", isDark ? "text-white" : "text-gray-900")}>신청 방법</h2>
                <p className={cn(isDark ? "text-zinc-300" : "text-gray-600")}>{program.application_method}</p>
                {program.application_form_url && (
                  <a
                    href={program.application_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-accent hover:text-accent"
                  >
                    <Download className="w-4 h-4" />
                    신청서 양식 다운로드
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 오른쪽: AI 매칭 & 액션 */}
          <div className="space-y-6">
            {/* AI 매칭 결과 */}
            <AIMatchResult
              programId={programId}
              programTitle={program.title}
              initialResult={matchResult ? {
                score: matchResult.score,
                action: matchResult.action,
                reasons: matchResult.reasons,
                risks: matchResult.risks,
                next_actions: matchResult.next_actions
              } : undefined}
            />

            {/* 빠른 액션 */}
            <div className="rounded-xl p-6 border bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm dark:shadow-none">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">빠른 액션</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/dashboard-group/company/government-programs/business-plan?program_id=${programId}`)}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg
                             font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  사업계획서 초안 생성
                </button>

                {program.detail_url && (
                  <a
                    href={program.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white"
                  >
                    <ExternalLink className="w-5 h-5" />
                    원문 공고 보기
                  </a>
                )}
              </div>
            </div>

            {/* 출처 정보 */}
            <div className="rounded-xl p-4 border bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 shadow-sm dark:shadow-none">
              <div className="text-sm text-gray-500 dark:text-zinc-500">
                <div className="flex justify-between mb-2">
                  <span>출처</span>
                  <span className="text-gray-700 dark:text-zinc-300">{SOURCE_LABELS[program.source] || program.source}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>수집일</span>
                  <span className="text-gray-700 dark:text-zinc-300">{formatDate(program.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span>공고 ID</span>
                  <span className="text-xs font-mono text-gray-500 dark:text-zinc-400">{program.program_id}</span>
                </div>
              </div>
            </div>
          </div>
        </div >
      </main >
    </div >
  )
}

// 정보 항목 컴포넌트
function InfoItem({
  icon: Icon,
  label,
  value
}: {
  icon: any
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">
        <Icon className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
      </div>
      <div>
        <div className="text-xs text-gray-500 dark:text-zinc-500">{label}</div>
        <div className="text-sm text-gray-700 dark:text-zinc-200">{value}</div>
      </div>
    </div>
  )
}
