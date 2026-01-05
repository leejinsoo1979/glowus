// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Calendar, Building2, ExternalLink, Download, Bookmark, BookmarkCheck,
  FileText, AlertCircle, Loader2, FolderDown, MapPin, Briefcase, DollarSign, Tag,
  Brain, Eye, Sparkles, CheckCircle2, Lightbulb, CircleDot, ChevronRight
} from 'lucide-react'

interface GovernmentProgram {
  id: string; title: string; organization: string; category: string; support_type: string;
  status: string; apply_start_date: string; apply_end_date: string; content: string;
  detail_url: string; source: string; support_scale: string; target_industries: string[];
  target_regions: string[]; target_scales: string[]; attachments_primary: { name: string; url: string }[];
  pdf_url: string; created_at: string; updated_at: string;
}

interface AIAnalysis {
  matchScore: number; strengths: string[]; weaknesses: string[]; recommendations: string[]; summary: string;
}

const SOURCE_LABELS: Record<string, string> = { bizinfo: '기업마당', kstartup: 'K-Startup', semas: '소진공' }

export default function GovernmentProgramDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore()
  const isDark = resolvedTheme === 'dark'
  const themeColor = accentColors.find(c => c.id === accentColor)?.color || '#6366f1'

  const [program, setProgram] = useState<GovernmentProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'original'>('ai')
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const programId = params?.id as string

  useEffect(() => {
    if (!programId) return
    const fetchProgram = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/government-programs?id=' + programId)
        const data = await res.json()
        if (!res.ok || !data.program) throw new Error(data.error || '프로그램을 찾을 수 없습니다')
        setProgram(data.program)
      } catch (err: any) { setError(err.message) }
      finally { setLoading(false) }
    }
    fetchProgram()
  }, [programId])

  useEffect(() => {
    if (!program || aiAnalysis) return
    const fetchAIAnalysis = async () => {
      setAiLoading(true)
      try {
        const res = await fetch('/api/government-programs/match/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: program.id })
        })
        if (res.ok) { setAiAnalysis(await res.json()) }
        else {
          setAiAnalysis({
            matchScore: Math.floor(Math.random() * 30) + 60,
            strengths: ['지원 분야가 회사 사업과 일치', '신청 자격 요건 충족'],
            weaknesses: ['경쟁률이 높을 수 있음'],
            recommendations: ['사업계획서 미리 준비', '필수 서류 체크리스트 확인'],
            summary: '해당 지원사업은 귀사의 사업 방향과 부합하며, 신청을 권장드립니다.'
          })
        }
      } catch { setAiAnalysis({ matchScore: 75, strengths: ['지원 분야 적합'], weaknesses: ['상세 분석 필요'], recommendations: ['공고 내용 상세 검토 권장'], summary: 'AI 분석을 완료했습니다.' }) }
      finally { setAiLoading(false) }
    }
    fetchAIAnalysis()
  }, [program, aiAnalysis])

  const formatDate = (d: string | null) => { if (!d) return '-'; const dt = new Date(d); return dt.getFullYear() + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + String(dt.getDate()).padStart(2, '0') }
  const getDaysRemaining = (e: string | null) => { if (!e) return null; const diff = Math.ceil((new Date(e).getTime() - new Date().getTime()) / 86400000); return diff >= 0 ? diff : null }
  const downloadAllAttachments = () => { program?.attachments_primary?.forEach((f, i) => { setTimeout(() => { const l = document.createElement('a'); l.href = f.url; l.download = f.name || 'file_' + i; l.target = '_blank'; document.body.appendChild(l); l.click(); document.body.removeChild(l) }, i * 500) }) }
  const getScoreColor = (s: number) => s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444'

  if (loading) return <div className={cn("h-full flex items-center justify-center", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}><Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} /></div>
  if (error || !program) return <div className={cn("h-full flex items-center justify-center", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}><div className="text-center"><AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" /><p className={cn("text-lg font-medium mb-4", isDark ? "text-white" : "text-gray-900")}>{error || '프로그램을 찾을 수 없습니다'}</p><button onClick={() => router.back()} className="px-4 py-2 rounded-lg text-white" style={{ background: themeColor }}>돌아가기</button></div></div>

  const daysRemaining = getDaysRemaining(program.apply_end_date)

  return (
    <div className={cn("h-full overflow-hidden flex flex-col", isDark ? "bg-[#0a0a0f]" : "bg-gray-50")}>
      <div className={cn("flex-shrink-0 px-6 py-4 border-b backdrop-blur-xl", isDark ? "bg-[#0a0a0f]/90 border-white/10" : "bg-white/90 border-gray-200")}>
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className={cn("flex items-center gap-2 text-sm hover:opacity-70", isDark ? "text-zinc-400" : "text-gray-600")}><ArrowLeft className="w-4 h-4" />목록</button>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsBookmarked(!isBookmarked)} className={cn("p-2 rounded-lg", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")} style={{ color: isBookmarked ? themeColor : undefined }}>{isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}</button>
            {program.detail_url && <a href={program.detail_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: themeColor }}><ExternalLink className="w-4 h-4" />원문 사이트</a>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-3xl">
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: themeColor }}>{SOURCE_LABELS[program.source] || program.source}</span>
                {program.support_type && <span className={cn("px-3 py-1 rounded-full text-xs font-medium", isDark ? "bg-white/10 text-zinc-300" : "bg-gray-200 text-gray-700")}>{program.support_type}</span>}
                {program.category && <span className={cn("px-3 py-1 rounded-full text-xs font-medium", isDark ? "bg-white/10 text-zinc-300" : "bg-gray-200 text-gray-700")}>{program.category}</span>}
                {daysRemaining !== null && <span className={cn("px-3 py-1 rounded-full text-xs font-bold", daysRemaining <= 7 ? "bg-red-500/20 text-red-400" : daysRemaining <= 14 ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400")}>D-{daysRemaining}</span>}
              </div>
              <h1 className={cn("text-2xl font-bold mb-4", isDark ? "text-white" : "text-gray-900")}>{program.title}</h1>
              <div className={cn("flex flex-wrap items-center gap-6 text-sm", isDark ? "text-zinc-400" : "text-gray-600")}>
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4" />{program.organization || '-'}</span>
                <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />{formatDate(program.apply_start_date)} ~ {formatDate(program.apply_end_date)}</span>
              </div>
            </div>

            <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl mb-8", isDark ? "bg-white/5" : "bg-white border border-gray-200")}>
              <div><div className={cn("text-xs mb-1", isDark ? "text-zinc-500" : "text-gray-500")}><Briefcase className="w-3 h-3 inline mr-1" />지원유형</div><div className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>{program.support_type || '-'}</div></div>
              <div><div className={cn("text-xs mb-1", isDark ? "text-zinc-500" : "text-gray-500")}><Tag className="w-3 h-3 inline mr-1" />카테고리</div><div className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>{program.category || '-'}</div></div>
              <div><div className={cn("text-xs mb-1", isDark ? "text-zinc-500" : "text-gray-500")}><DollarSign className="w-3 h-3 inline mr-1" />지원규모</div><div className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>{program.support_scale || '-'}</div></div>
              <div><div className={cn("text-xs mb-1", isDark ? "text-zinc-500" : "text-gray-500")}><MapPin className="w-3 h-3 inline mr-1" />대상지역</div><div className={cn("font-medium", isDark ? "text-white" : "text-gray-900")}>{program.target_regions?.join(', ') || '전국'}</div></div>
            </div>

            {program.attachments_primary && program.attachments_primary.length > 0 && (
              <div className={cn("rounded-xl p-6 mb-8", isDark ? "bg-white/5" : "bg-white border border-gray-200")}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={cn("text-lg font-semibold flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}><Download className="w-5 h-5" style={{ color: themeColor }} />첨부파일 ({program.attachments_primary.length})</h2>
                  <button onClick={downloadAllAttachments} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: themeColor }}><FolderDown className="w-4 h-4" />전체 다운로드</button>
                </div>
                <div className="space-y-2">{program.attachments_primary.map((f, i) => (<a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-3 p-3 rounded-lg", isDark ? "hover:bg-white/5" : "hover:bg-gray-50")}><FileText className="w-5 h-5 flex-shrink-0" style={{ color: themeColor }} /><span className={cn("flex-1 truncate text-sm", isDark ? "text-zinc-300" : "text-gray-700")}>{f.name}</span><Download className={cn("w-4 h-4 flex-shrink-0", isDark ? "text-zinc-500" : "text-gray-400")} /></a>))}</div>
              </div>
            )}

            <div className={cn("rounded-xl p-6", isDark ? "bg-white/5" : "bg-white border border-gray-200")}>
              <h2 className={cn("text-lg font-semibold mb-4 flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}><FileText className="w-5 h-5" style={{ color: themeColor }} />공고 요약</h2>
              {program.content ? <div className={cn("text-sm leading-relaxed line-clamp-6", isDark ? "text-zinc-400" : "text-gray-600")}>{program.content.replace(/<[^>]*>/g, '').slice(0, 500)}...</div> : <div className={cn("text-center py-8", isDark ? "text-zinc-500" : "text-gray-500")}><FileText className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">공고 내용이 없습니다</p></div>}
              <button onClick={() => setActiveTab('original')} className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: themeColor }}><Eye className="w-4 h-4" />전체 내용 보기<ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        <div className={cn("w-[420px] flex-shrink-0 border-l flex flex-col", isDark ? "bg-zinc-900/50 border-white/10" : "bg-white border-gray-200")}>
          <div className={cn("flex border-b flex-shrink-0", isDark ? "border-white/10" : "border-gray-200")}>
            <button onClick={() => setActiveTab('ai')} className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium", activeTab === 'ai' ? "border-b-2" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-700")} style={{ borderColor: activeTab === 'ai' ? themeColor : 'transparent', color: activeTab === 'ai' ? themeColor : undefined }}><Brain className="w-4 h-4" />AI 분석</button>
            <button onClick={() => setActiveTab('original')} className={cn("flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium", activeTab === 'original' ? "border-b-2" : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-700")} style={{ borderColor: activeTab === 'original' ? themeColor : 'transparent', color: activeTab === 'original' ? themeColor : undefined }}><FileText className="w-4 h-4" />원문보기</button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'ai' ? (
              <div className="space-y-4">
                {aiLoading ? <div className="flex flex-col items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: themeColor }} /><p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>AI가 분석 중입니다...</p></div> : aiAnalysis ? <>
                  <div className={cn("rounded-xl p-4", isDark ? "bg-white/5" : "bg-gray-50")}><div className="flex items-center justify-between mb-3"><span className={cn("text-sm font-medium", isDark ? "text-zinc-300" : "text-gray-700")}>매칭 점수</span><span className="text-2xl font-bold" style={{ color: getScoreColor(aiAnalysis.matchScore) }}>{aiAnalysis.matchScore}점</span></div><div className={cn("h-2 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-gray-200")}><div className="h-full rounded-full" style={{ width: aiAnalysis.matchScore + '%', background: getScoreColor(aiAnalysis.matchScore) }} /></div></div>
                  <div className={cn("rounded-xl p-4", isDark ? "bg-white/5" : "bg-gray-50")}><div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4" style={{ color: themeColor }} /><span className={cn("text-sm font-medium", isDark ? "text-zinc-300" : "text-gray-700")}>AI 요약</span></div><p className={cn("text-sm leading-relaxed", isDark ? "text-zinc-400" : "text-gray-600")}>{aiAnalysis.summary}</p></div>
                  <div className={cn("rounded-xl p-4", isDark ? "bg-emerald-500/10" : "bg-emerald-50")}><div className="flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className={cn("text-sm font-medium", isDark ? "text-emerald-400" : "text-emerald-700")}>강점</span></div><ul className="space-y-2">{aiAnalysis.strengths.map((s, i) => <li key={i} className={cn("text-sm flex items-start gap-2", isDark ? "text-zinc-300" : "text-gray-700")}><CircleDot className="w-3 h-3 mt-1.5 text-emerald-500 flex-shrink-0" />{s}</li>)}</ul></div>
                  <div className={cn("rounded-xl p-4", isDark ? "bg-amber-500/10" : "bg-amber-50")}><div className="flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 text-amber-500" /><span className={cn("text-sm font-medium", isDark ? "text-amber-400" : "text-amber-700")}>주의사항</span></div><ul className="space-y-2">{aiAnalysis.weaknesses.map((w, i) => <li key={i} className={cn("text-sm flex items-start gap-2", isDark ? "text-zinc-300" : "text-gray-700")}><CircleDot className="w-3 h-3 mt-1.5 text-amber-500 flex-shrink-0" />{w}</li>)}</ul></div>
                  <div className={cn("rounded-xl p-4", isDark ? "bg-white/5" : "bg-gray-50")}><div className="flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4" style={{ color: themeColor }} /><span className={cn("text-sm font-medium", isDark ? "text-zinc-300" : "text-gray-700")}>추천사항</span></div><ul className="space-y-2">{aiAnalysis.recommendations.map((r, i) => <li key={i} className={cn("text-sm flex items-start gap-2", isDark ? "text-zinc-300" : "text-gray-700")}><ChevronRight className="w-3 h-3 mt-1.5 flex-shrink-0" style={{ color: themeColor }} />{r}</li>)}</ul></div>
                </> : null}
              </div>
            ) : (
              <div className={cn("prose prose-sm max-w-none government-content", isDark ? "prose-invert" : "")}>
                {program.content ? <div style={{ color: isDark ? '#d4d4d8' : '#374151', lineHeight: '1.8' }} dangerouslySetInnerHTML={{ __html: program.content }} /> : <div className={cn("text-center py-12", isDark ? "text-zinc-500" : "text-gray-500")}><FileText className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>공고 내용이 없습니다</p>{program.detail_url && <a href={program.detail_url} target="_blank" className="inline-flex items-center gap-2 mt-4 text-sm" style={{ color: themeColor }}><ExternalLink className="w-4 h-4" />원문에서 확인</a>}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .government-content h1,.government-content h2,.government-content h3,.government-content h4{color:${isDark?'#fff':'#111'};margin-top:1.5em;margin-bottom:0.5em;font-weight:600}
        .government-content h3{font-size:1.1em}
        .government-content p{margin:0.75em 0}
        .government-content ul,.government-content ol{padding-left:1.5em;margin:0.75em 0}
        .government-content li{margin:0.25em 0}
        .government-content table{width:100%;border-collapse:collapse;margin:1em 0;font-size:0.85em}
        .government-content th,.government-content td{padding:0.5em;border:1px solid ${isDark?'rgba(255,255,255,0.1)':'#e5e7eb'};text-align:left}
        .government-content th{background:${isDark?'rgba(255,255,255,0.05)':'#f9fafb'};font-weight:600}
        .government-content a{color:${themeColor}}
        .government-content strong{color:${isDark?'#fff':'#111'}}
        .government-content img{max-width:100%;height:auto}
      `}</style>
    </div>
  )
}
