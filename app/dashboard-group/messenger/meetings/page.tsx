'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  FileText,
  Calendar,
  Clock,
  Users,
  Bot,
  Search,
  Filter,
  Download,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Loader2,
  X,
  Eye,
  Target,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  UserCircle,
} from 'lucide-react'
import { Button } from '@/components/ui'
import Link from 'next/link'

interface MeetingMessage {
  id: string
  content: string
  sender_type: 'user' | 'agent'
  sender_name: string
  sender_id: string
  created_at: string
}

interface MeetingParticipant {
  type: 'user' | 'agent'
  id: string
  name: string
  email?: string
  persona?: string
  job_title?: string
}

interface MeetingConfig {
  purpose?: string
  discussionMode?: string
  decisionStatement?: string
  successCriteria?: string
  allowDebate?: boolean
}

interface ActionItem {
  task: string
  assignee?: string
  deadline?: string
  priority?: 'high' | 'medium' | 'low'
}

interface AgentOpinion {
  agentName: string
  position: string
  mainPoints: string[]
  reasoning: string
}

interface RiskItem {
  risk: string
  severity: 'high' | 'medium' | 'low'
  mitigation?: string
  raisedBy?: string
}

interface MeetingRecord {
  id: string
  room_id: string
  room_name: string
  topic: string
  started_at: string
  ended_at: string
  duration_minutes: number
  participant_count: number
  agent_count: number
  message_count: number
  summary?: string
  key_points?: string[]
  action_items?: ActionItem[]
  decisions?: string[]
  agent_opinions?: AgentOpinion[]
  next_agenda?: string[]
  risk_register?: RiskItem[]
  meeting_config?: MeetingConfig
  messages?: MeetingMessage[]
  participants?: MeetingParticipant[]
}

export default function MeetingsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [generating, setGenerating] = useState<string | null>(null)
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 회의 목록 조회
  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/chat/meetings')
      if (res.ok) {
        const data = await res.json()
        setMeetings(data)
      }
    } catch (err) {
      console.error('Failed to fetch meetings:', err)
    } finally {
      setLoading(false)
    }
  }

  // 회의록 상세 조회
  const fetchMeetingDetail = async (meetingId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/chat/meetings/${meetingId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedMeeting(data)
      }
    } catch (err) {
      console.error('Failed to fetch meeting detail:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // AI 요약 생성
  const generateSummary = async (meetingId: string) => {
    setGenerating(meetingId)
    try {
      const res = await fetch(`/api/chat/meetings/${meetingId}/summary`, {
        method: 'POST',
      })
      if (res.ok) {
        await fetchMeetings()
      }
    } catch (err) {
      console.error('Failed to generate summary:', err)
    } finally {
      setGenerating(null)
    }
  }

  // 필터링
  const filteredMeetings = meetings.filter(m => {
    if (!searchQuery) return true
    return (
      m.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.room_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className={`min-h-full overflow-y-auto pb-20 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
      {/* 헤더 */}
      <div className={`sticky top-0 z-10 ${isDark ? 'bg-zinc-950/80' : 'bg-zinc-50/80'} backdrop-blur-xl border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-violet-500/20' : 'bg-violet-100'}`}>
                <FileText className={`w-5 h-5 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  회의록
                </h1>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  AI 에이전트와 함께한 회의 기록
                </p>
              </div>
            </div>

            {/* 검색 */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-white'} border ${isDark ? 'border-zinc-700' : 'border-zinc-200'}`}>
                <Search className="w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="회의 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`bg-transparent outline-none text-sm w-48 ${isDark ? 'text-white placeholder-zinc-500' : 'text-zinc-900 placeholder-zinc-400'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className={`text-center py-20 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">회의록이 없습니다</p>
            <p className="text-sm">채팅방에서 회의를 시작하면 여기에 기록됩니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMeetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'} overflow-hidden`}
              >
                {/* 회의 헤더 */}
                <div className="p-4 border-b border-zinc-800/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {meeting.topic || '자유 토론'}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(meeting.started_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(meeting.started_at)} ({meeting.duration_minutes}분)
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {meeting.participant_count}명
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot className="w-4 h-4" />
                          AI {meeting.agent_count}명
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          {meeting.message_count}개 메시지
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchMeetingDetail(meeting.id)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        상세보기
                      </Button>
                      {!meeting.summary && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => generateSummary(meeting.id)}
                          disabled={generating === meeting.id}
                          className="flex items-center gap-1"
                        >
                          {generating === meeting.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          AI 요약
                        </Button>
                      )}
                      <Link href={`/dashboard-group/messenger?room=${meeting.room_id}`}>
                        <Button variant="secondary" size="sm" className="flex items-center gap-1">
                          채팅방 보기
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* 요약 내용 */}
                {meeting.summary && (
                  <div className="p-4 space-y-4">
                    <div>
                      <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        AI 요약
                      </h4>
                      <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {meeting.summary}
                      </p>
                    </div>

                    {meeting.key_points && meeting.key_points.length > 0 && (
                      <div>
                        <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                          주요 논의 사항
                        </h4>
                        <ul className={`text-sm space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {meeting.key_points.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-violet-500">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {meeting.action_items && meeting.action_items.length > 0 && (
                      <div>
                        <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                          Action Items
                        </h4>
                        <ul className={`text-sm space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {meeting.action_items.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-500">☐</span>
                              <span>
                                {typeof item === 'string' ? item : item.task}
                                {typeof item !== 'string' && item.assignee && (
                                  <span className="text-xs ml-2 text-zinc-500">@{item.assignee}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 채팅방 이름 */}
                <div className={`px-4 py-2 ${isDark ? 'bg-zinc-800/30' : 'bg-zinc-50'}`}>
                  <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    채팅방: {meeting.room_name}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 회의록 상세 보기 모달 */}
      {selectedMeeting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedMeeting(null)}
          />

          {/* 모달 컨텐츠 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-2xl`}
          >
            {/* 모달 헤더 */}
            <div className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {selectedMeeting.topic || '회의록'}
                </h2>
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {formatDate(selectedMeeting.started_at)} · {formatTime(selectedMeeting.started_at)} ~ {formatTime(selectedMeeting.ended_at)} ({selectedMeeting.duration_minutes}분)
                </p>
              </div>
              <button
                onClick={() => setSelectedMeeting(null)}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
              >
                <X className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              ) : (
                <>
                  {/* 회의 설정 정보 */}
                  {selectedMeeting.meeting_config && Object.keys(selectedMeeting.meeting_config).length > 0 && (
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}>
                      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <Settings2 className="w-4 h-4" />
                        회의 설정
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {selectedMeeting.meeting_config.purpose && (
                          <div>
                            <span className={`${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>목적:</span>{' '}
                            <span className={`${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              {selectedMeeting.meeting_config.purpose === 'strategic_decision' && '전략적 의사결정'}
                              {selectedMeeting.meeting_config.purpose === 'problem_analysis' && '문제 분석'}
                              {selectedMeeting.meeting_config.purpose === 'action_planning' && '실행 계획'}
                              {selectedMeeting.meeting_config.purpose === 'idea_expansion' && '아이디어 확장'}
                              {selectedMeeting.meeting_config.purpose === 'risk_validation' && '리스크 검증'}
                            </span>
                          </div>
                        )}
                        {selectedMeeting.meeting_config.discussionMode && (
                          <div>
                            <span className={`${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>토론 모드:</span>{' '}
                            <span className={`${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              {selectedMeeting.meeting_config.discussionMode === 'quick' && '빠른 결론'}
                              {selectedMeeting.meeting_config.discussionMode === 'balanced' && '균형 토론'}
                              {selectedMeeting.meeting_config.discussionMode === 'deep' && '심층 분석'}
                              {selectedMeeting.meeting_config.discussionMode === 'brainstorm' && '브레인스토밍'}
                            </span>
                          </div>
                        )}
                        {selectedMeeting.meeting_config.decisionStatement && (
                          <div className="col-span-2">
                            <span className={`${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>의사결정 문장:</span>{' '}
                            <span className={`${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              {selectedMeeting.meeting_config.decisionStatement}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 참여자 목록 */}
                  {selectedMeeting.participants && selectedMeeting.participants.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <Users className="w-4 h-4" />
                        참여자 ({selectedMeeting.participants.length}명)
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedMeeting.participants.map((p, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                              p.type === 'agent'
                                ? isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-700'
                                : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                            }`}
                          >
                            {p.type === 'agent' ? <Bot className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                            {p.name}
                            {p.job_title && <span className="text-xs opacity-60">({p.job_title})</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI 요약 */}
                  {selectedMeeting.summary && (
                    <div className={`p-4 rounded-xl ${isDark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
                      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                        <Sparkles className="w-4 h-4" />
                        AI 요약
                      </h3>
                      <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {selectedMeeting.summary}
                      </p>
                    </div>
                  )}

                  {/* 결정 사항 */}
                  {selectedMeeting.decisions && selectedMeeting.decisions.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        결정 사항
                      </h3>
                      <ul className={`text-sm space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {selectedMeeting.decisions.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-500">✓</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {selectedMeeting.action_items && selectedMeeting.action_items.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <Target className="w-4 h-4 text-amber-500" />
                        실행 태스크
                      </h3>
                      <div className="space-y-2">
                        {selectedMeeting.action_items.map((item, idx) => (
                          <div
                            key={idx}
                            className={`flex items-start gap-3 p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}
                          >
                            <span className="text-amber-500 mt-0.5">☐</span>
                            <div className="flex-1">
                              <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                {typeof item === 'string' ? item : item.task}
                              </p>
                              {typeof item !== 'string' && (
                                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                                  {item.assignee && <span>담당: {item.assignee}</span>}
                                  {item.deadline && <span>기한: {item.deadline}</span>}
                                  {item.priority && (
                                    <span className={`px-1.5 py-0.5 rounded ${
                                      item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                      item.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                      'bg-zinc-500/20 text-zinc-400'
                                    }`}>
                                      {item.priority === 'high' ? '높음' : item.priority === 'medium' ? '보통' : '낮음'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 에이전트별 의견 */}
                  {selectedMeeting.agent_opinions && selectedMeeting.agent_opinions.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <UserCircle className="w-4 h-4 text-violet-500" />
                        에이전트별 의견
                      </h3>
                      <div className="space-y-3">
                        {selectedMeeting.agent_opinions.map((opinion, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-50'}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Bot className={`w-4 h-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                              <span className={`font-medium text-sm ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                                {opinion.agentName}
                              </span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                opinion.position === '찬성' ? 'bg-emerald-500/20 text-emerald-400' :
                                opinion.position === '반대' ? 'bg-red-500/20 text-red-400' :
                                opinion.position === '조건부찬성' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-zinc-500/20 text-zinc-400'
                              }`}>
                                {opinion.position}
                              </span>
                            </div>
                            <ul className={`text-sm space-y-1 mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                              {opinion.mainPoints.map((point, pidx) => (
                                <li key={pidx} className="flex items-start gap-2">
                                  <span className="text-violet-500">•</span>
                                  {point}
                                </li>
                              ))}
                            </ul>
                            {opinion.reasoning && (
                              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} italic`}>
                                근거: {opinion.reasoning}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 리스크/반대 의견 */}
                  {selectedMeeting.risk_register && selectedMeeting.risk_register.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        리스크/반대 의견
                      </h3>
                      <div className="space-y-2">
                        {selectedMeeting.risk_register.map((risk, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border-l-2 ${
                              risk.severity === 'high' ? 'border-l-red-500 bg-red-500/5' :
                              risk.severity === 'medium' ? 'border-l-amber-500 bg-amber-500/5' :
                              'border-l-zinc-500 bg-zinc-500/5'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                {risk.risk}
                              </p>
                              <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                                risk.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                                risk.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-zinc-500/20 text-zinc-400'
                              }`}>
                                {risk.severity === 'high' ? '높음' : risk.severity === 'medium' ? '보통' : '낮음'}
                              </span>
                            </div>
                            {risk.mitigation && (
                              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                대응: {risk.mitigation}
                              </p>
                            )}
                            {risk.raisedBy && (
                              <p className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                제기: {risk.raisedBy}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 다음 회의 안건 */}
                  {selectedMeeting.next_agenda && selectedMeeting.next_agenda.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <ListTodo className="w-4 h-4 text-blue-500" />
                        다음 회의 안건 제안
                      </h3>
                      <ul className={`text-sm space-y-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {selectedMeeting.next_agenda.map((agenda, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500">{idx + 1}.</span>
                            {agenda}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 전체 대화 내용 */}
                  {selectedMeeting.messages && selectedMeeting.messages.length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        <MessageSquare className="w-4 h-4" />
                        전체 대화 내용 ({selectedMeeting.messages.length}개)
                      </h3>
                      <div className={`rounded-xl border ${isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} max-h-96 overflow-y-auto`}>
                        {selectedMeeting.messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`p-3 border-b last:border-b-0 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${
                                msg.sender_type === 'agent'
                                  ? isDark ? 'text-violet-400' : 'text-violet-600'
                                  : isDark ? 'text-zinc-400' : 'text-zinc-600'
                              }`}>
                                {msg.sender_type === 'agent' && <Bot className="w-3 h-3 inline mr-1" />}
                                {msg.sender_name}
                              </span>
                              <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              {msg.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
