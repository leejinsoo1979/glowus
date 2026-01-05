// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useThemeStore } from '@/stores/themeStore'
import {
  ArrowLeft,
  Calendar,
  Building2,
  ExternalLink,
  Download,
  Bookmark,
  BookmarkCheck,
  Clock,
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface GovernmentProgram {
  id: string
  title: string
  organization: string
  category: string
  support_type: string
  status: string
  apply_start_date: string
  apply_end_date: string
  content: string
  detail_url: string
  source: string
  support_scale: string
  target_industries: string[]
  target_regions: string[]
  attachments_primary: { name: string; url: string }[]
  pdf_url: string
  created_at: string
  updated_at: string
}

const SUPPORT_TYPE_COLORS: Record<string, string> = {
  '사업화': '#3b82f6',
  '기술개발': '#8b5cf6',
  '시설보육': '#ec4899',
  '멘토링': '#10b981',
  '행사': '#f59e0b',
  '융자보증': '#ef4444',
  '인력': '#06b6d4',
  '기타': '#71717a',
}

export default function GovernmentProgramDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore()
  const isDark = resolvedTheme === 'dark'

  const [program, setProgram] = useState<GovernmentProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)

  const programId = params?.id as string

  useEffect(() => {
    if (!programId) return

    const fetchProgram = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/government-programs?id=' + programId)
        const data = await res.json()

        if (!res.ok || !data.program) {
          throw new Error(data.error || '프로그램을 찾을 수 없습니다')
        }

        setProgram(data.program)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProgram()
  }, [programId])

  const getStatusBadge = (prog: GovernmentProgram) => {
    const today = new Date()
    const endDate = prog.apply_end_date ? new Date(prog.apply_end_date) : null
    const startDate = prog.apply_start_date ? new Date(prog.apply_start_date) : null

    if (endDate && endDate < today) {
      return { label: '마감', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' }
    }
    if (startDate && startDate > today) {
      return { label: '예정', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' }
    }
    return { label: '진행중', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return y + '.' + m + '.' + day
  }

  const getDaysLeft = (endDate: string | null) => {
    if (!endDate) return null
    const today = new Date()
    const end = new Date(endDate)
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return null
    return diff
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: isDark ? '#0a0a0a' : '#fafafa' }}
      >
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
          <span style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (error || !program) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: isDark ? '#0a0a0a' : '#fafafa' }}
      >
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ef4444' }} />
          <p style={{ color: isDark ? '#fafafa' : '#18181b' }} className="text-lg font-medium mb-2">
            {error || '프로그램을 찾을 수 없습니다'}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: accentColor, color: '#fff' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  const status = getStatusBadge(program)
  const daysLeft = getDaysLeft(program.apply_end_date)
  const supportTypeColor = SUPPORT_TYPE_COLORS[program.support_type] || SUPPORT_TYPE_COLORS['기타']

  return (
    <div className="min-h-screen pb-20" style={{ background: isDark ? '#0a0a0a' : '#fafafa' }}>
      <div
        className="sticky top-0 z-10 px-6 py-4 border-b"
        style={{
          background: isDark ? 'rgba(10, 10, 10, 0.9)' : 'rgba(250, 250, 250, 0.9)',
          borderColor: isDark ? '#27272a' : '#e4e4e7',
          backdropFilter: 'blur(8px)'
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm transition-colors hover:opacity-70"
            style={{ color: isDark ? '#a1a1aa' : '#71717a' }}
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: isDark ? '#27272a' : '#f4f4f5',
                color: isBookmarked ? accentColor : (isDark ? '#a1a1aa' : '#71717a')
              }}
            >
              {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
            </button>
            {program.detail_url && (
              <a
                href={program.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: accentColor, color: '#fff' }}
              >
                <ExternalLink className="w-4 h-4" />
                원문 보기
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: supportTypeColor + '15', color: supportTypeColor }}
            >
              {program.support_type || '기타'}
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs"
              style={{ background: isDark ? '#27272a' : '#f4f4f5', color: isDark ? '#a1a1aa' : '#71717a' }}
            >
              {program.source === 'bizinfo' ? '기업마당' : program.source === 'kstartup' ? 'K-Startup' : program.source}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-4 leading-tight" style={{ color: isDark ? '#fafafa' : '#18181b' }}>
            {program.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
              <Building2 className="w-4 h-4" />
              {program.organization || '-'}
            </div>
            <div className="flex items-center gap-2" style={{ color: isDark ? '#a1a1aa' : '#71717a' }}>
              <Calendar className="w-4 h-4" />
              {formatDate(program.apply_start_date)} ~ {formatDate(program.apply_end_date)}
            </div>
            {daysLeft !== null && daysLeft >= 0 && (
              <div
                className="flex items-center gap-2 px-2 py-1 rounded"
                style={{
                  background: daysLeft <= 7 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: daysLeft <= 7 ? '#ef4444' : '#10b981'
                }}
              >
                <Clock className="w-4 h-4" />
                D-{daysLeft}
              </div>
            )}
          </div>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 p-4 rounded-xl"
          style={{ background: isDark ? '#18181b' : '#fff' }}
        >
          <div>
            <p className="text-xs mb-1" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>지원유형</p>
            <p className="font-medium" style={{ color: isDark ? '#fafafa' : '#18181b' }}>{program.support_type || '-'}</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>카테고리</p>
            <p className="font-medium" style={{ color: isDark ? '#fafafa' : '#18181b' }}>{program.category || '-'}</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>지원규모</p>
            <p className="font-medium" style={{ color: isDark ? '#fafafa' : '#18181b' }}>{program.support_scale || '-'}</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>대상지역</p>
            <p className="font-medium" style={{ color: isDark ? '#fafafa' : '#18181b' }}>{program.target_regions?.join(', ') || '전국'}</p>
          </div>
        </div>

        <div className="rounded-xl p-6 mb-8" style={{ background: isDark ? '#18181b' : '#fff' }}>
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: isDark ? '#fafafa' : '#18181b' }}>
            <FileText className="w-5 h-5" />
            공고 내용
          </h2>
          {program.content ? (
            <div
              className="government-content"
              dangerouslySetInnerHTML={{ __html: program.content }}
            />
          ) : program.detail_url?.includes('bizinfo.go.kr') ? (
            <div className="w-full" style={{ height: '800px' }}>
              <webview
                src={program.detail_url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowpopups="true"
              />
            </div>
          ) : (
            <div className="text-center py-12" style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>공고 내용이 없습니다</p>
              {program.detail_url && (
                <a
                  href={program.detail_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-sm"
                  style={{ color: accentColor }}
                >
                  <ExternalLink className="w-4 h-4" />
                  원문에서 확인하기
                </a>
              )}
            </div>
          )}
          <style jsx global>{`
            .government-content {
              color: ${isDark ? '#d4d4d8' : '#3f3f46'};
              font-size: 14px;
              line-height: 1.8;
            }
            .government-content h1,
            .government-content h2,
            .government-content h3,
            .government-content h4 {
              color: ${isDark ? '#fafafa' : '#18181b'};
              font-weight: 600;
              margin: 1.5rem 0 1rem 0;
            }
            .government-content h3 {
              font-size: 1.1rem;
              padding-bottom: 0.5rem;
              border-bottom: 1px solid ${isDark ? '#27272a' : '#e4e4e7'};
            }
            .government-content p {
              margin: 0.75rem 0;
            }
            .government-content ul,
            .government-content ol {
              margin: 0.75rem 0;
              padding-left: 0;
              list-style: none;
            }
            .government-content li {
              margin: 0.5rem 0;
              padding: 0.75rem 1rem;
              background: ${isDark ? '#27272a' : '#f4f4f5'};
              border-radius: 8px;
            }
            .government-content li > div {
              display: flex;
              gap: 1rem;
            }
            .government-content li > div > p:first-child {
              flex-shrink: 0;
              width: 100px;
              font-weight: 500;
              color: ${isDark ? '#a1a1aa' : '#71717a'};
            }
            .government-content li > div > p:last-child {
              flex: 1;
              color: ${isDark ? '#fafafa' : '#18181b'};
            }
            .government-content table {
              width: 100%;
              border-collapse: collapse;
              margin: 1rem 0;
              font-size: 13px;
            }
            .government-content th,
            .government-content td {
              padding: 0.75rem;
              border: 1px solid ${isDark ? '#27272a' : '#e4e4e7'};
              text-align: left;
            }
            .government-content th {
              background: ${isDark ? '#27272a' : '#f4f4f5'};
              font-weight: 600;
              color: ${isDark ? '#fafafa' : '#18181b'};
            }
            .government-content a {
              color: ${accentColor};
              text-decoration: underline;
            }
            .government-content strong,
            .government-content b {
              color: ${isDark ? '#fafafa' : '#18181b'};
              font-weight: 600;
            }
            .government-content .k-startup-section {
              margin: 1.5rem 0;
              padding: 1rem;
              background: ${isDark ? '#27272a50' : '#f9fafb'};
              border-radius: 12px;
              border-left: 3px solid ${accentColor};
            }
            .government-content .k-startup-section > p:first-child {
              font-weight: 600;
              color: ${isDark ? '#fafafa' : '#18181b'};
              margin-bottom: 0.75rem;
              font-size: 15px;
            }
            /* 기업마당 원본 스타일 */
            .government-content .bizinfo-original {
              color: ${isDark ? '#d4d4d8' : '#3f3f46'};
            }
            .government-content .bizinfo-original .view_cont {
              display: flex;
              flex-direction: column;
              gap: 0;
            }
            .government-content .bizinfo-original .view_cont > ul {
              list-style: none;
              padding: 0;
              margin: 0;
              display: flex;
              flex-direction: column;
              gap: 0;
            }
            .government-content .bizinfo-original .view_cont > ul > li {
              padding: 1rem 1.25rem;
              background: ${isDark ? '#27272a' : '#f4f4f5'};
              border-radius: 0;
              margin: 0;
              border-bottom: 1px solid ${isDark ? '#3f3f46' : '#e4e4e7'};
            }
            .government-content .bizinfo-original .view_cont > ul > li:first-child {
              border-radius: 12px 12px 0 0;
            }
            .government-content .bizinfo-original .view_cont > ul > li:last-child {
              border-radius: 0 0 12px 12px;
              border-bottom: none;
            }
            .government-content .bizinfo-original .s_title {
              display: block;
              font-size: 12px;
              font-weight: 500;
              color: ${isDark ? '#71717a' : '#a1a1aa'};
              margin-bottom: 0.5rem;
            }
            .government-content .bizinfo-original .txt {
              color: ${isDark ? '#fafafa' : '#18181b'};
              font-size: 14px;
              line-height: 1.7;
            }
            .government-content .bizinfo-original .txt p {
              margin: 0.5rem 0;
            }
            .government-content .bizinfo-original .txt br + br {
              display: none;
            }
            .government-content .bizinfo-original #iframe,
            .government-content .bizinfo-original [id="iframe"] {
              display: none;
            }
            .government-content .bizinfo-original a[id="fileLoad"] {
              display: none;
            }
            .government-content .bizinfo-original div[style*="text-align:center"] {
              margin-top: 1.5rem;
              padding: 1rem;
              background: ${isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'};
              border-radius: 8px;
              font-size: 13px;
              color: ${isDark ? '#93c5fd' : '#3b82f6'};
            }
          `}</style>
        </div>

        {program.attachments_primary && program.attachments_primary.length > 0 && (
          <div className="rounded-xl p-6" style={{ background: isDark ? '#18181b' : '#fff' }}>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: isDark ? '#fafafa' : '#18181b' }}>
              <Download className="w-5 h-5" />
              첨부파일
            </h2>
            <div className="space-y-2">
              {program.attachments_primary.map((file, idx) => (
                <a
                  key={idx}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                  style={{ background: isDark ? '#27272a' : '#f4f4f5', color: isDark ? '#fafafa' : '#18181b' }}
                >
                  <FileText className="w-5 h-5" style={{ color: accentColor }} />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <Download className="w-4 h-4" style={{ color: isDark ? '#71717a' : '#a1a1aa' }} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
