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
} from 'lucide-react'
import { Button } from '@/components/ui'
import Link from 'next/link'

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
  action_items?: string[]
}

export default function MeetingsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [generating, setGenerating] = useState<string | null>(null)

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
    <div className={`min-h-screen ${isDark ? 'bg-zinc-950' : 'bg-zinc-50'}`}>
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
                              {item}
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
    </div>
  )
}
