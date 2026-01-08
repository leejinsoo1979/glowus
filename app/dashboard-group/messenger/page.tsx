'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Search, Send, Paperclip, MoreVertical, Phone, Video, Info,
  Image as ImageIcon, Smile, Plus, Users, Bot, ChevronLeft, Loader2,
  FileText, Download, X, UserPlus, LogOut, Trash2, Settings,
  ChevronRight, UserMinus, PanelRightClose, PanelRightOpen,
  Clock, Play, Square, Timer, Target, Swords, Presentation,
  MessageSquare, Crown, Shield, Zap, BarChart3, AlertTriangle,
  CheckCircle2, XCircle, ArrowRight, Mic, MicOff, Volume2,
  Film, Share2, MonitorPlay, Eye, Scan
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useChatRooms, useChatRoom, usePresence, useMeeting, useSharedViewer } from '@/hooks/useChat'
import { ChatRoom, ChatMessage, ChatParticipant, SharedMediaType } from '@/types/chat'
import SharedViewer from '@/components/chat/SharedViewer'
import { DEV_USER, isDevMode } from '@/lib/dev-user'
import { useAuth } from '@/hooks/useAuth'
import { PROVIDER_INFO, LLMProvider } from '@/lib/llm/models'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useVoice, OpenAIVoice } from '@/hooks/useVoice'
import { useSpeakerTTS } from '@/components/voice/SpeakerMode'
import { AIViewfinder, ViewfinderCaptureResult } from '@/components/neural-map/viewfinder/AIViewfinder'
import { Globe } from 'lucide-react'

// 에이전트 역할별 음성 매핑 (Grok 음성만 사용)
// Grok 음성: sol(차분 여성), tara(활기 여성), cove(따뜻 남성), puck(유쾌 남성), charon(깊은 남성), vale(중성)
const ROLE_VOICES: Record<string, string> = {
  strategist: 'charon',
  analyst: 'sol',
  executor: 'cove',
  critic: 'puck',
  mediator: 'vale',
}

// 참여자별 고유 색상 팔레트 (Enterprise 스타일)
const AVATAR_COLORS = [
  'from-slate-600 to-slate-700',
  'from-zinc-600 to-zinc-700',
  'from-stone-600 to-stone-700',
  'from-neutral-600 to-neutral-700',
  'from-gray-600 to-gray-700',
  'from-slate-500 to-zinc-600',
  'from-stone-500 to-neutral-600',
  'from-zinc-500 to-gray-600',
  'from-neutral-500 to-slate-600',
  'from-gray-500 to-stone-600',
]

// 에이전트 역할별 색상
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  strategist: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  analyst: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  executor: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  critic: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  mediator: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
}

// 룸 타입 정의
type RoomMode = 'meeting' | 'debate' | 'presentation' | 'chat'

// 룸 타입 감지 함수
function detectRoomMode(room: ChatRoom | null): RoomMode {
  if (!room) return 'chat'
  const category = (room as any).category || ''
  const name = room.name?.toLowerCase() || ''

  // 토론방: 진영 대결 구조
  if (category.includes('debate') || name.includes('토론') || name.includes('debate')) {
    return 'debate'
  }
  // 발표실: 발표자 포커스
  if (category.includes('presentation') || name.includes('발표') || name.includes('presentation')) {
    return 'presentation'
  }
  // 회의실: 기본 AI 회의
  if (room.type === 'meeting' || category.includes('strategic') || category.includes('problem') ||
    category.includes('action') || category.includes('idea') || category.includes('risk')) {
    return 'meeting'
  }
  return 'chat'
}

// ID 기반으로 일관된 색상 반환
function getColorForId(id: string, isAgent: boolean = false): string {
  if (!id) return AVATAR_COLORS[0]
  // ID의 문자 코드 합계로 인덱스 결정
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// 역할 라벨
const ROLE_LABELS: Record<string, string> = {
  strategist: '전략가',
  analyst: '분석가',
  executor: '실행가',
  critic: '비평가',
  mediator: '중재자',
}

export default function MessengerPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatMode, setNewChatMode] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showRoomSettings, setShowRoomSettings] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showRightSidebar, setShowRightSidebar] = useState(true)
  const [confirmKick, setConfirmKick] = useState<{ participantId: string; name: string } | null>(null)
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [showViewfinder, setShowViewfinder] = useState(false)  // 🔭 뷰파인더 모달
  const [isNearBottom, setIsNearBottom] = useState(true) // 스크롤이 아래쪽인지

  // 📐 뷰어 패널 리사이즈
  const [viewerWidthPx, setViewerWidthPx] = useState(400) // 픽셀 (px)
  const isResizingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 🔭 공유된 문서들 (AI 비전 분석 포함)
  interface SharedDocWithAnalysis {
    id: string
    name: string
    type: 'image' | 'pdf' | 'document' | 'url'
    content: string  // URL
    mimeType?: string
    analysis?: string  // AI가 분석한 내용
    timestamp: Date
    analyzing?: boolean
  }
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocWithAnalysis[]>([])
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false)

  // 🔊 스피커 모드 (에이전트 메시지 TTS + 사용자 음성 입력)
  const [speakerMode, setSpeakerMode] = useState(false)
  const { playTTS, clearQueue, isSpeaking, currentSpeaker } = useSpeakerTTS()
  const lastMessageIdRef = useRef<string | null>(null)
  const prevMeetingActiveRef = useRef<boolean | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 채팅 훅 사용
  const { rooms, loading: roomsLoading, createRoom, fetchRooms } = useChatRooms()
  const {
    room: activeRoom,
    messages,
    loading: messagesLoading,
    sending,
    typingUsers,
    agentTyping,
    sendMessage,
    handleTyping,
    fetchRoom
  } = useChatRoom(activeRoomId)
  const { onlineUsers } = usePresence(activeRoomId)
  const { meetingStatus, loading: meetingLoading, startMeeting, endMeeting } = useMeeting(activeRoomId)
  const { viewerState, isActive: isViewerActive, startSharing, stopSharing } = useSharedViewer(activeRoomId)
  const [showSharedViewer, setShowSharedViewer] = useState(false)
  const shareInputRef = useRef<HTMLInputElement>(null)
  const { user: authUser } = useAuth()
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]

  // 음성 서비스 훅
  const {
    isVoiceEnabled,
    isPlaying,
    isTranscribing,
    toggleVoiceMode,
    playSpeech,
    startTranscription,
    stopTranscription
  } = useVoice()

  // 현재 사용자 ID (DEV 모드 or 실제 로그인)
  const currentUserId = isDevMode() ? DEV_USER.id : authUser?.id || null
  const currentUserName = isDevMode() ? DEV_USER.name : authUser?.name || authUser?.email || 'You'

  // 룸 모드 감지
  const roomMode = useMemo(() => detectRoomMode(activeRoom), [activeRoom])

  // 회의 설정 정보
  const meetingConfig = useMemo(() => {
    if (!activeRoom) return null
    return (activeRoom as any).meeting_config || null
  }, [activeRoom])

  // URL 파라미터로 새 채팅방 생성 모달 열기
  useEffect(() => {
    const action = searchParams.get('action')
    const mode = searchParams.get('mode')
    if (action === 'new') {
      setNewChatMode(mode)
      setShowNewChat(true)
      // URL에서 파라미터 제거
      router.replace('/dashboard-group/messenger')
    }
  }, [searchParams, router])

  // URL에서 room 파라미터 읽어서 채팅방 선택
  useEffect(() => {
    const roomIdFromUrl = searchParams.get('room')
    if (roomIdFromUrl && rooms.length > 0) {
      const roomExists = rooms.some(r => r.id === roomIdFromUrl)
      if (roomExists && activeRoomId !== roomIdFromUrl) {
        setActiveRoomId(roomIdFromUrl)
      }
    }
  }, [searchParams, rooms, activeRoomId])

  // 채팅방 선택 시 URL 업데이트 함수
  const selectRoom = (room: ChatRoom) => {
    setActiveRoomId(room.id)
    const roomModeType = detectRoomMode(room)
    const params = new URLSearchParams()
    params.set('room', room.id)
    if (roomModeType !== 'chat') {
      params.set('mode', roomModeType)
    }
    router.replace(`/dashboard-group/messenger?${params.toString()}`, { scroll: false })
  }

  // 필터링된 채팅방
  const filteredRooms = rooms.filter(room => {
    if (!searchQuery) return true
    const roomName = getRoomDisplayName(room)
    return roomName.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // 스크롤 위치 감지 (사용자가 위로 스크롤했는지)
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // 하단에서 100px 이내면 "아래쪽"으로 간주
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsNearBottom(nearBottom)
  }

  // 스크롤 최신 메시지로 (아래쪽에 있을 때만)
  useEffect(() => {
    if (scrollRef.current && messages.length > 0 && isNearBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isNearBottom])

  // 방 변경 시 스크롤 초기화
  useEffect(() => {
    setIsNearBottom(true)
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeRoomId])

  // 📐 뷰어 패널 리사이즈 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      // 사이드바 너비(260px)를 제외한 가용 영역에서 계산
      const sidebarWidth = showRightSidebar ? 260 : 0
      const availableWidth = containerRect.width - sidebarWidth
      const mouseX = e.clientX - containerRect.left

      // 최소 250px, 최대 (가용 영역 - 300px)
      const minWidth = 250
      const maxWidth = availableWidth - 300
      if (mouseX >= minWidth && mouseX <= maxWidth) {
        setViewerWidthPx(mouseX)
      }
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [showRightSidebar])

  const startResize = () => {
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // 에이전트 메시지 수신 시 자동 재생 (기존 방식 - 회의 모드)
  useEffect(() => {
    if (!isVoiceEnabled || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.sender_type === 'agent' && !lastMessage.metadata?.speech_played) {
      // 역할에 따른 목소리 선택
      const agentRole = meetingConfig?.agentConfigs?.find((c: any) => c.id === lastMessage.sender_agent_id)?.role
      const voice = (agentRole ? ROLE_VOICES[agentRole] : 'alloy') as OpenAIVoice

      playSpeech(lastMessage.content, voice)

      // 중복 재생 방지를 위해 메타데이터 표시 (로컬에서만 관리)
      lastMessage.metadata = { ...lastMessage.metadata, speech_played: true }
    }
  }, [messages, isVoiceEnabled, meetingConfig, playSpeech])

  // 🔊 스피커 모드 켤 때: 현재 마지막 메시지 ID 기록 (이전 메시지 읽지 않도록)
  useEffect(() => {
    if (speakerMode && messages.length > 0) {
      // 스피커 모드 켜는 순간의 마지막 메시지 ID 저장
      const lastMessage = messages[messages.length - 1]
      if (!lastMessageIdRef.current) {
        lastMessageIdRef.current = lastMessage.id
        console.log('[SpeakerMode] 🔊 Mode enabled, skipping existing messages until:', lastMessage.id)
      }
    }
  }, [speakerMode, messages.length])

  // 🔊 스피커 모드: 새 에이전트 메시지 수신 시 TTS 재생
  useEffect(() => {
    if (!speakerMode || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    // 이미 처리한 메시지면 스킵
    if (lastMessage.id === lastMessageIdRef.current) return

    // 에이전트 메시지만 TTS (새로 도착한 것만)
    if (lastMessage.sender_type === 'agent') {
      const agentName = lastMessage.sender_agent?.name || '에이전트'
      // 🔧 TTS용 텍스트 정리 (마크다운, 이모지, 코드블록 제거)
      const cleanText = lastMessage.content
        .replace(/```[\s\S]*?```/g, '') // 코드블록 제거
        .replace(/`[^`]+`/g, '') // 인라인 코드 제거
        .replace(/\*\*([^*]+)\*\*/g, '$1') // **볼드** → 볼드
        .replace(/\*([^*]+)\*/g, '$1') // *이탤릭* → 이탤릭
        .replace(/__([^_]+)__/g, '$1') // __밑줄__ → 밑줄
        .replace(/~~([^~]+)~~/g, '$1') // ~~취소선~~ → 취소선
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [링크](url) → 링크
        .replace(/^#+\s*/gm, '') // # 헤딩 제거
        .replace(/^[-*]\s+/gm, '') // 리스트 마커 제거
        .replace(/^\d+\.\s+/gm, '') // 숫자 리스트 마커 제거
        .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '') // 이모지 제거
        .replace(/\s+/g, ' ') // 다중 공백 정리
        .trim()

      if (cleanText) {
        console.log('[SpeakerMode] 🔊 Playing:', agentName, cleanText.slice(0, 50))
        playTTS(cleanText, agentName)
      }
    }

    // 항상 마지막 메시지 ID 업데이트 (에이전트든 유저든)
    lastMessageIdRef.current = lastMessage.id
  }, [messages, speakerMode, playTTS])

  // 스피커 모드 끄면 TTS 큐 비우기 + ref 초기화
  useEffect(() => {
    if (!speakerMode) {
      clearQueue()
      lastMessageIdRef.current = null  // 다음에 켤 때 다시 초기화되도록
    }
  }, [speakerMode, clearQueue])

  // 회의 종료 시 스피커 모드 자동 해제 + TTS 정리
  useEffect(() => {
    const wasMeetingActive = prevMeetingActiveRef.current
    const isMeetingActive = meetingStatus?.is_meeting_active ?? false

    // 회의가 실제로 종료된 경우에만 (true → false 전환)
    if (wasMeetingActive === true && isMeetingActive === false) {
      console.log('[Meeting] 회의 종료 감지 - 스피커 모드 해제 및 TTS 정리')
      setSpeakerMode(false)
      clearQueue()
    }

    // 현재 상태 저장
    prevMeetingActiveRef.current = isMeetingActive
  }, [meetingStatus?.is_meeting_active, clearQueue])

  // 🎤 음성 입력 → 텍스트 메시지 전송
  const handleVoiceInput = async (text: string) => {
    if (!text.trim() || !activeRoomId) return
    console.log('[SpeakerMode] 🎤 Voice input:', text)
    await sendMessage(text)
  }

  // 에이전트 멘션 (프로필 클릭 시)
  const mentionAgent = (agentName: string) => {
    const mention = `/${agentName} `
    // 이미 같은 멘션이 있으면 추가하지 않음
    if (!inputText.startsWith(mention)) {
      setInputText(mention + inputText.replace(/^\/\S+\s*/, ''))  // 기존 멘션 제거 후 새 멘션 추가
    }
    inputRef.current?.focus()
  }

  // 메시지에서 에이전트 멘션 파싱
  const parseAgentMention = (text: string): { targetAgentName: string | null; content: string } => {
    const mentionMatch = text.match(/^\/(\S+)\s+([\s\S]*)$/)
    if (mentionMatch) {
      return {
        targetAgentName: mentionMatch[1],
        content: mentionMatch[2].trim()
      }
    }
    return { targetAgentName: null, content: text }
  }

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return

    // 에이전트 멘션 파싱
    const { targetAgentName, content } = parseAgentMention(inputText.trim())

    // 멘션만 있고 내용이 없으면 전송하지 않음
    if (targetAgentName && !content) {
      return
    }

    try {
      // 멘션이 있으면 메타데이터에 target_agent_name 추가
      if (targetAgentName) {
        await sendMessage(content, {
          metadata: { target_agent_name: targetAgentName }
        })
      } else {
        await sendMessage(inputText)
      }
      setInputText('')
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => {
    const file = e.target.files?.[0]
    if (!file || !activeRoomId) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('roomId', activeRoomId)

      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url, fileName, fileSize, fileType, isImage } = await res.json()

      // 메시지로 전송
      await sendMessage(isImage ? '이미지를 공유했습니다' : `파일을 공유했습니다: ${fileName}`, {
        message_type: isImage ? 'image' : 'file',
        metadata: {
          url,
          fileName,
          fileSize,
          fileType,
        },
      })
    } catch (err) {
      console.error('File upload failed:', err)
      alert(err instanceof Error ? err.message : '파일 업로드에 실패했습니다')
    } finally {
      setUploading(false)
      // input 초기화
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  // 공유 뷰어용 파일 업로드 핸들러
  const handleShareFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeRoomId) return

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('roomId', activeRoomId)

      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url, fileName, fileType, isImage, isVideo, isPdf } = await res.json()

      // 미디어 타입 결정
      let mediaType: SharedMediaType = 'image'
      if (isPdf) mediaType = 'pdf'
      else if (isVideo) mediaType = 'video'

      // 공유 뷰어 시작
      await startSharing({
        url,
        name: fileName,
        type: mediaType,
        // PDF의 경우 총 페이지 수는 클라이언트에서 계산 필요
        // 비디오의 경우 duration은 클라이언트에서 계산 필요
      })

      setShowSharedViewer(true)

      // 🔭 AI 비전 분석을 위해 공유 문서 목록에 추가
      const docId = `doc-${Date.now()}`
      const newDoc: SharedDocWithAnalysis = {
        id: docId,
        name: fileName,
        type: isImage ? 'image' : isPdf ? 'pdf' : 'document',
        content: url,
        mimeType: fileType,
        timestamp: new Date(),
        analyzing: true,  // 분석 중 표시
      }
      setSharedDocuments(prev => [...prev, newDoc])

      // 시스템 메시지로 공유 알림
      await sendMessage(`[공유 시작] ${fileName}`, {
        message_type: 'system' as any,
        metadata: { shared_file: true, url, fileName, fileType },
      })

      // 🔭 AI 비전으로 문서 분석 (이미지/PDF만)
      if (isImage || isPdf) {
        setIsAnalyzingDocument(true)
        try {
          const visionRes = await fetch('/api/skills/viewfinder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageUrl: url,
              mimeType: fileType,
              prompt: `이 자료를 회의 참석자들이 이해할 수 있도록 분석해줘. 주요 내용, 핵심 포인트, 논의할 사항을 정리해줘.`,
              provider: 'openai',  // GPT-4o 사용
            }),
          })

          if (visionRes.ok) {
            const { analysis } = await visionRes.json()
            // 분석 결과 업데이트
            setSharedDocuments(prev =>
              prev.map(doc =>
                doc.id === docId
                  ? { ...doc, analysis, analyzing: false }
                  : doc
              )
            )

            // 분석 결과를 시스템 메시지로 공유
            await sendMessage(`[AI 분석] ${fileName}\n\n${analysis}`, {
              message_type: 'system' as any,
              metadata: { ai_analysis: true, documentId: docId },
            })
          }
        } catch (analysisErr) {
          console.error('Vision analysis failed:', analysisErr)
          setSharedDocuments(prev =>
            prev.map(doc =>
              doc.id === docId ? { ...doc, analyzing: false } : doc
            )
          )
        } finally {
          setIsAnalyzingDocument(false)
        }
      }
    } catch (err) {
      console.error('Share file failed:', err)
      alert(err instanceof Error ? err.message : '파일 공유에 실패했습니다')
    } finally {
      setUploading(false)
      if (shareInputRef.current) shareInputRef.current.value = ''
    }
  }

  // 🔭 MeetingVoiceChat에서 파일/뷰파인더 캡처 공유 핸들러
  const handleMeetingShareFile = async (
    input: File | { dataUrl: string; name: string; type: string }
  ) => {
    if (!activeRoomId) return

    try {
      setUploading(true)

      let url: string
      let fileName: string
      let fileType: string
      let isImage = false
      let isPdf = false

      // 1. File 객체인 경우: 기존 업로드 API 사용
      if (input instanceof File) {
        const formData = new FormData()
        formData.append('file', input)
        formData.append('roomId', activeRoomId)

        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Upload failed')
        }

        const data = await res.json()
        url = data.url
        fileName = data.fileName
        fileType = data.fileType
        isImage = data.isImage
        isPdf = data.isPdf
      }
      // 2. 뷰파인더 캡처 (dataUrl)인 경우: 직접 처리
      else {
        url = input.dataUrl
        fileName = input.name
        fileType = input.type
        isImage = fileType.startsWith('image/')
        isPdf = fileType === 'application/pdf'
      }

      // 🔭 AI 비전 분석을 위해 공유 문서 목록에 추가
      const docId = `doc-${Date.now()}`
      const newDoc: SharedDocWithAnalysis = {
        id: docId,
        name: fileName,
        type: isImage ? 'image' : isPdf ? 'pdf' : 'document',
        content: url,
        mimeType: fileType,
        timestamp: new Date(),
        analyzing: true,
      }
      setSharedDocuments(prev => [...prev, newDoc])

      console.log('[MeetingShareFile] 📄 Document added:', fileName)

      // 🔭 AI 비전으로 문서 분석 (이미지/PDF만)
      if (isImage || isPdf) {
        setIsAnalyzingDocument(true)
        try {
          // dataUrl인 경우 base64 추출
          const isDataUrl = url.startsWith('data:')
          const visionBody: any = {
            prompt: `이 자료를 회의 참석자들이 이해할 수 있도록 분석해줘. 주요 내용, 핵심 포인트, 논의할 사항을 정리해줘.`,
            provider: 'openai',
          }

          if (isDataUrl) {
            // data:image/jpeg;base64,... 형식에서 base64 추출
            const base64Match = url.match(/^data:([^;]+);base64,(.+)$/)
            if (base64Match) {
              visionBody.imageBase64 = base64Match[2]
              visionBody.mimeType = base64Match[1]
            }
          } else {
            visionBody.imageUrl = url
            visionBody.mimeType = fileType
          }

          const visionRes = await fetch('/api/skills/viewfinder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(visionBody),
          })

          if (visionRes.ok) {
            const { analysis } = await visionRes.json()
            // 분석 결과 업데이트
            setSharedDocuments(prev =>
              prev.map(doc =>
                doc.id === docId
                  ? { ...doc, analysis, analyzing: false }
                  : doc
              )
            )
            console.log('[MeetingShareFile] ✅ Analysis complete:', analysis.substring(0, 100))
          }
        } catch (analysisErr) {
          console.error('[MeetingShareFile] Vision analysis failed:', analysisErr)
          setSharedDocuments(prev =>
            prev.map(doc =>
              doc.id === docId ? { ...doc, analyzing: false } : doc
            )
          )
        } finally {
          setIsAnalyzingDocument(false)
        }
      }
    } catch (err) {
      console.error('[MeetingShareFile] Failed:', err)
      alert(err instanceof Error ? err.message : '파일 공유에 실패했습니다')
    } finally {
      setUploading(false)
    }
  }

  // 공유 뷰어가 활성화되면 자동으로 표시
  useEffect(() => {
    if (isViewerActive && !showSharedViewer) {
      setShowSharedViewer(true)
    }
  }, [isViewerActive])

  // 채팅방 나가기
  const handleLeaveRoom = async () => {
    if (!activeRoomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}/participants`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to leave room')
      }
      setActiveRoomId(null)
      setConfirmLeave(false)
      await fetchRooms()
    } catch (err) {
      console.error('Failed to leave room:', err)
      alert(err instanceof Error ? err.message : '채팅방 나가기에 실패했습니다')
    }
  }

  // 채팅방 삭제
  const handleDeleteRoom = async () => {
    if (!activeRoomId) return
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete room')
      }
      setActiveRoomId(null)
      setConfirmDelete(false)
      await fetchRooms()
    } catch (err) {
      console.error('Failed to delete room:', err)
      alert(err instanceof Error ? err.message : '채팅방 삭제에 실패했습니다')
    }
  }

  // 현재 사용자가 방장인지 확인
  const isRoomOwner = () => {
    if (!activeRoom || !currentUserId) return false
    return activeRoom.created_by === currentUserId
  }

  // 참여자 강퇴
  const handleKickParticipant = async () => {
    if (!activeRoomId || !confirmKick) return
    const kickedName = confirmKick.name
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoomId}/participants?participant_id=${confirmKick.participantId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to kick participant')
      }

      // 강퇴 시스템 메시지 전송
      await fetch(`/api/chat/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `${kickedName}님이 강퇴당하셨습니다.`,
          message_type: 'system',
        }),
      })

      setConfirmKick(null)
      // 채팅방 정보 새로고침을 위해 activeRoomId를 잠시 null로 설정 후 복원
      const roomId = activeRoomId
      setActiveRoomId(null)
      setTimeout(() => setActiveRoomId(roomId), 100)
    } catch (err) {
      console.error('Failed to kick participant:', err)
      alert(err instanceof Error ? err.message : '강퇴에 실패했습니다')
    }
  }

  // 파일 크기 포맷
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // 채팅방 표시 이름 가져오기
  function getRoomDisplayName(room: ChatRoom): string {
    if (room.name) return room.name
    // 1:1 채팅일 경우 상대방 이름
    const otherParticipant = room.participants?.find(p =>
      p.user?.id !== room.created_by || p.agent
    )
    return otherParticipant?.user?.name || otherParticipant?.agent?.name || '채팅방'
  }

  // 참여자 아바타 가져오기
  function getParticipantAvatar(participant: ChatParticipant): string {
    if (participant.user) {
      return participant.user.name?.slice(0, 2).toUpperCase() || 'U'
    }
    if (participant.agent) {
      return participant.agent.name?.slice(0, 2).toUpperCase() || 'AI'
    }
    return '?'
  }

  // 온라인 상태 확인
  function isOnline(participant: ChatParticipant): boolean {
    if (participant.agent) return true // 에이전트는 항상 온라인
    return participant.user_id ? onlineUsers.includes(participant.user_id) : false
  }

  return (
    <div className={`flex h-[calc(100vh-4rem)] overflow-hidden ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'}`}>

      {/* Sidebar - Room List - 회의/채팅방 선택 시 숨김 */}
      <div className={`w-full lg:w-72 flex-shrink-0 flex flex-col border-r ${isDark ? 'border-zinc-800/50 bg-zinc-900' : 'border-zinc-200 bg-white'
        } ${activeRoomId ? 'hidden' : 'flex'}`}>

        {/* Header */}
        <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800/50' : 'border-zinc-200'} flex items-center justify-between`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Conversations
          </span>
          <button
            onClick={() => setShowNewChat(true)}
            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
              }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className={`relative rounded-lg overflow-hidden ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
            }`}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full py-2 pl-8 pr-3 bg-transparent text-sm placeholder:text-zinc-500 no-focus-ring"
            />
          </div>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {roomsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                }`}>
                <MessageSquare className={`w-5 h-5 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
              </div>
              <p className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>No conversations</p>
              <p className="text-xs text-zinc-500 mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredRooms.map((room) => {
                const displayName = getRoomDisplayName(room)
                const roomModeType = detectRoomMode(room)
                const hasUnread = (room.unread_count || 0) > 0
                const hasAgents = room.participants?.some(p => p.agent && !p.user)

                return (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-left ${activeRoomId === room.id
                      ? isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                      }`}
                  >
                    {/* Room Type Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${roomModeType === 'meeting' ? 'bg-indigo-500/10' :
                      roomModeType === 'debate' ? 'bg-amber-500/10' :
                        roomModeType === 'presentation' ? 'bg-emerald-500/10' :
                          isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      }`}>
                      {roomModeType === 'meeting' && <Target className="w-3.5 h-3.5 text-indigo-400" />}
                      {roomModeType === 'debate' && <Swords className="w-3.5 h-3.5 text-amber-400" />}
                      {roomModeType === 'presentation' && <Presentation className="w-3.5 h-3.5 text-emerald-400" />}
                      {roomModeType === 'chat' && (
                        hasAgents
                          ? <Bot className="w-3.5 h-3.5 text-zinc-500" />
                          : <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-sm font-medium truncate ${activeRoomId === room.id
                          ? isDark ? 'text-white' : 'text-zinc-900'
                          : isDark ? 'text-zinc-300' : 'text-zinc-700'
                          }`}>
                          {displayName}
                        </span>
                        <span className="text-[10px] text-zinc-500 flex-shrink-0">
                          {room.last_message?.created_at
                            ? formatTime(room.last_message.created_at)
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-zinc-500 truncate">
                          {room.last_message?.content || 'No messages yet'}
                        </p>
                        {hasUnread && (
                          <span className="min-w-[1rem] h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center px-1 flex-shrink-0">
                            {room.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeRoomId ? 'hidden lg:flex' : 'flex'}`}>

        {/* Chat Header - Enterprise Style */}
        <div className={`h-16 px-4 border-b flex items-center justify-between flex-shrink-0 ${isDark ? 'border-zinc-800/50 bg-zinc-900' : 'border-zinc-200 bg-white'
          }`}>
          {activeRoom ? (
            <div className="flex items-center gap-3 min-w-0">
              <Button
                size="icon"
                variant="ghost"
                className="-ml-2 flex-shrink-0"
                onClick={() => {
                  setActiveRoomId(null)
                  router.replace('/dashboard-group/messenger', { scroll: false })
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              {/* Room Mode Icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${roomMode === 'meeting' ? 'bg-indigo-500/10' :
                roomMode === 'debate' ? 'bg-amber-500/10' :
                  roomMode === 'presentation' ? 'bg-emerald-500/10' :
                    isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                }`}>
                {roomMode === 'meeting' && <Target className={`w-4 h-4 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />}
                {roomMode === 'debate' && <Swords className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />}
                {roomMode === 'presentation' && <Presentation className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />}
                {roomMode === 'chat' && <MessageSquare className={`w-4 h-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`} />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm truncate">{getRoomDisplayName(activeRoom)}</h2>
                  {roomMode !== 'chat' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${roomMode === 'meeting' ? 'bg-indigo-500/10 text-indigo-400' :
                      roomMode === 'debate' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      }`}>
                      {roomMode === 'meeting' ? 'Meeting' : roomMode === 'debate' ? 'Debate' : 'Presentation'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{activeRoom.participants?.length || 0} participants</span>
                  {typingUsers.length > 0 && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-zinc-500" />
                      <span className="text-accent animate-pulse">
                        {typingUsers.map(p => p.user?.name || p.agent?.name).join(', ')} typing...
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full text-center text-zinc-500 text-sm">Select a conversation</div>
          )}

          <div className="flex items-center gap-1">
            {/* 회의 컨트롤 - 에이전트가 1명 이상이면 표시 */}
            {activeRoom && activeRoom.participants && activeRoom.participants.some(p => p.participant_type === 'agent' || p.agent) && (
              <>
                {/* 🔊 스피커 모드 토글 */}
                <Button
                  size="icon"
                  variant="ghost"
                  className={`transition-colors ${speakerMode
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : 'text-zinc-500 hover:text-accent'
                  }`}
                  onClick={() => setSpeakerMode(!speakerMode)}
                  title={speakerMode ? '스피커 모드 끄기' : '스피커 모드 켜기 (AI가 말로 응답)'}
                >
                  {speakerMode ? (
                    <div className="relative">
                      <Volume2 className="w-5 h-5" />
                      {isSpeaking && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                      )}
                    </div>
                  ) : (
                    <Volume2 className="w-5 h-5 opacity-50" />
                  )}
                </Button>

                {meetingStatus?.is_meeting_active ? (
                  // 회의 진행 중 표시 (간단하게 - 타이머는 상단 배너에)
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-red-500">LIVE</span>
                  </div>
                ) : (
                  // 회의 시작 버튼
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-3 text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                    onClick={() => setShowMeetingModal(true)}
                    disabled={meetingLoading}
                  >
                    <Play className="w-4 h-4 mr-1.5" />
                    회의 시작
                  </Button>
                )}
                <div className={`w-px h-6 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>
              </>
            )}

            {/* 🌐 브라우저 버튼 - 시스템 브라우저에서 열기 */}
            <Button
              size="icon"
              variant="ghost"
              className="text-zinc-500 hover:text-accent"
              onClick={() => {
                const url = prompt('열고 싶은 URL을 입력하세요:', 'https://www.google.com')
                if (url) {
                  // Electron이면 shell.openExternal, 아니면 window.open
                  if ((window as any).electron?.shell) {
                    (window as any).electron.shell.openExternal(url)
                  } else {
                    window.open(url, '_blank')
                  }
                }
              }}
              title="웹 브라우저 열기"
            >
              <Globe className="w-5 h-5" />
            </Button>
            {/* 🔭 뷰파인더 버튼 */}
            <Button
              size="icon"
              variant="ghost"
              className={`${showViewfinder ? 'text-cyan-500 bg-cyan-500/10' : 'text-zinc-500 hover:text-accent'}`}
              onClick={() => setShowViewfinder(true)}
              title="뷰파인더 (화면 캡처 & AI 분석)"
            >
              <Eye className="w-5 h-5" />
            </Button>
            <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
              <Video className="w-5 h-5" />
            </Button>
            {/* 화면 공유 버튼 */}
            {isViewerActive ? (
              <Button
                size="icon"
                variant="ghost"
                className="text-accent hover:text-accent"
                onClick={() => setShowSharedViewer(!showSharedViewer)}
                title={showSharedViewer ? '공유 화면 숨기기' : '공유 화면 보기'}
              >
                <MonitorPlay className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-500 hover:text-accent"
                onClick={() => shareInputRef.current?.click()}
                title="화면 공유"
                disabled={uploading}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            )}

            <div className={`w-px h-6 mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>

            {/* 음성 모드 토글 - speakerMode로 통합됨 */}

            {/* 채팅방 설정 드롭다운 */}
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-500 hover:text-accent"
                onClick={() => setShowRoomSettings(!showRoomSettings)}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>

              <AnimatePresence>
                {showRoomSettings && activeRoom && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl border z-50 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                      }`}
                  >
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowRoomSettings(false)
                          setShowInviteModal(true)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                          }`}
                      >
                        <UserPlus className="w-4 h-4 text-blue-500" />
                        <span>참여자 초대</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRoomSettings(false)
                          setConfirmLeave(true)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                          }`}
                      >
                        <LogOut className="w-4 h-4 text-orange-500" />
                        <span>채팅방 나가기</span>
                      </button>

                      {isRoomOwner() && (
                        <>
                          <div className={`mx-4 my-2 h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                          <button
                            onClick={() => {
                              setShowRoomSettings(false)
                              setConfirmDelete(true)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                              }`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>채팅방 삭제</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 우측 사이드바 토글 */}
            <Button
              size="icon"
              variant="ghost"
              className="text-zinc-500 hover:text-accent"
              onClick={() => setShowRightSidebar(!showRightSidebar)}
            >
              {showRightSidebar ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div ref={containerRef} className="flex flex-1 overflow-hidden">
          {/* Shared Viewer Panel - 회의/토론/발표 모드이거나 공유 화면이 활성화되면 왼쪽에 표시 */}
          {(roomMode !== 'chat' || meetingStatus?.is_meeting_active || (showSharedViewer && isViewerActive)) && (
            <div
              className={`border-r flex-shrink-0 flex flex-col ${isDark ? 'border-zinc-800/50 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}
              style={{ width: `${viewerWidthPx}px` }}
            >
              {isViewerActive ? (
                <SharedViewer
                  roomId={activeRoomId!}
                  onClose={() => {
                    setShowSharedViewer(false)
                    stopSharing()
                  }}
                  accentColor={currentAccent.color}
                />
              ) : (
                /* 파일 없을 때 Placeholder UI */
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-200/50'
                    }`}>
                    <MonitorPlay className={`w-12 h-12 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
                  </div>
                  <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    자료 공유 대기중
                  </h3>
                  <p className={`text-sm text-center mb-6 max-w-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    PDF, 이미지, 비디오 파일을 공유하여 회의 참가자들과 함께 볼 수 있습니다
                  </p>
                  <Button
                    onClick={() => shareInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                    style={{ backgroundColor: currentAccent.color }}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                    {uploading ? '업로드 중...' : '파일 공유하기'}
                  </Button>
                  <div className={`mt-6 flex items-center gap-4 text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> PDF
                    </span>
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> 이미지
                    </span>
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" /> 비디오
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 📐 리사이즈 핸들 - 뷰어 패널이 열려있을 때만 표시 */}
          {(roomMode !== 'chat' || meetingStatus?.is_meeting_active || (showSharedViewer && isViewerActive)) && (
            <div
              className={`w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors flex-shrink-0 ${isDark ? 'bg-zinc-800 hover:bg-blue-500/30' : 'bg-zinc-300 hover:bg-blue-500/30'}`}
              onMouseDown={startResize}
              title="드래그하여 크기 조절"
            />
          )}

          {/* Main Content Column */}
          <div
            className="flex flex-col min-w-0 flex-1"
          >
            {/* Meeting Status Bar - Enterprise Style */}
            {meetingStatus?.is_meeting_active && (() => {
              // 진행자 정보 찾기
              const facilitatorAgent = meetingStatus.meeting_facilitator_id
                ? activeRoom?.participants?.find(p => p.agent_id === meetingStatus.meeting_facilitator_id)?.agent
                : null
              const remainingSeconds = meetingStatus.remaining_seconds || 0
              const isLowTime = remainingSeconds <= 60

              return (
                <div className={`flex items-center justify-between py-2 px-4 border-b ${isDark ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-zinc-50/50 border-zinc-200'
                  }`}>
                  <div className="flex items-center gap-4">
                    {/* Live Indicator */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping opacity-75" />
                        <span className="relative w-2 h-2 bg-red-500 rounded-full" />
                      </div>
                      <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-red-400' : 'text-red-600'
                        }`}>Live</span>
                    </div>

                    {/* Timer */}
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-sm ${isLowTime
                      ? 'bg-red-500/10 text-red-500'
                      : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                      }`}>
                      <Timer className="w-3.5 h-3.5" />
                      <span className="font-medium tabular-nums">
                        {formatMeetingTime(remainingSeconds)}
                      </span>
                    </div>

                    {/* Topic */}
                    {meetingStatus.meeting_topic && meetingStatus.meeting_topic !== '자유 토론' && (
                      <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                        <span className="text-zinc-400">/</span>
                        <span className="font-medium truncate max-w-[200px]">{meetingStatus.meeting_topic}</span>
                      </div>
                    )}

                    {/* Facilitator */}
                    {facilitatorAgent && (
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                        <Crown className="w-3 h-3 text-amber-500" />
                        <span>{facilitatorAgent.name}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 px-2.5 text-xs font-medium ${isDark
                      ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
                      : 'text-zinc-600 hover:text-red-600 hover:bg-red-50'
                      }`}
                    onClick={endMeeting}
                    disabled={meetingLoading}
                  >
                    <Square className="w-3 h-3 mr-1" />
                    End
                  </Button>
                </div>
              )
            })()}

            {/* Room Mode Context Panel */}
            {activeRoom && roomMode !== 'chat' && !meetingStatus?.is_meeting_active && (
              <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800/50 bg-zinc-900/30' : 'border-zinc-200 bg-zinc-50/50'
                }`}>
                {/* Meeting Room Context */}
                {roomMode === 'meeting' && meetingConfig && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'
                        }`}>
                        <Target className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-xs font-medium text-indigo-500">
                          {meetingConfig.purpose === 'strategic_decision' ? 'Strategic Decision' :
                            meetingConfig.purpose === 'problem_analysis' ? 'Problem Analysis' :
                              meetingConfig.purpose === 'action_planning' ? 'Action Planning' :
                                meetingConfig.purpose === 'idea_expansion' ? 'Idea Expansion' :
                                  meetingConfig.purpose === 'risk_validation' ? 'Risk Validation' : 'Meeting'}
                        </span>
                      </div>
                      {meetingConfig.discussionMode && (
                        <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                          {meetingConfig.discussionMode === 'quick' ? 'Quick Conclusion' :
                            meetingConfig.discussionMode === 'balanced' ? 'Balanced Discussion' :
                              meetingConfig.discussionMode === 'deep' ? 'Deep Analysis' :
                                'Brainstorming'}
                        </span>
                      )}
                      {meetingConfig.agentConfigs?.length > 0 && (
                        <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-500'}`}>
                          {meetingConfig.agentConfigs.length} agents configured
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-7 px-3 text-xs ${isDark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-600 hover:bg-indigo-50'
                        }`}
                      onClick={() => setShowMeetingModal(true)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Start Meeting
                    </Button>
                  </div>
                )}

                {/* Debate Room Context */}
                {roomMode === 'debate' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                        }`}>
                        <Swords className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-amber-500">Debate Mode</span>
                      </div>
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                        Team-based discussion with opposing viewpoints
                      </span>
                    </div>
                  </div>
                )}

                {/* Presentation Room Context */}
                {roomMode === 'presentation' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                        }`}>
                        <Presentation className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-500">Presentation Mode</span>
                      </div>
                      <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-600'}`}>
                        Presenter-focused with Q&A sessions
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message List - Enterprise Style */}
            <div className={`flex-1 overflow-y-auto px-4 py-4 ${isDark ? 'bg-zinc-950' : 'bg-zinc-50/30'}`} ref={scrollRef} onScroll={handleScroll}>
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
                    <span className="text-xs text-zinc-500">Loading messages...</span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    }`}>
                    <MessageSquare className={`w-7 h-7 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
                  </div>
                  <p className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>No messages yet</p>
                  <p className="text-xs text-zinc-500 mt-1">Send a message to start the conversation</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, index) => {
                    // 내가 보낸 메시지인지 확인
                    const isMe = msg.sender_type === 'user' && msg.sender_user_id === currentUserId
                    const isAgent = msg.sender_type === 'agent'
                    const senderName = msg.sender_user?.name || msg.sender_agent?.name || 'Unknown'
                    const senderInitials = senderName.slice(0, 2).toUpperCase()
                    const senderId = msg.sender_user_id || msg.sender_agent_id || ''

                    // 이전 메시지와 같은 발신자인지 확인 (연속 메시지 그룹핑)
                    const prevMsg = messages[index - 1]
                    const isContinuation = prevMsg &&
                      ((prevMsg.sender_user_id === msg.sender_user_id && msg.sender_user_id) ||
                        (prevMsg.sender_agent_id === msg.sender_agent_id && msg.sender_agent_id)) &&
                      (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 60000

                    // 에이전트 역할 정보
                    const agentRole = meetingConfig?.agentConfigs?.find((c: any) => c.id === msg.sender_agent_id)?.role
                    const roleStyle = agentRole ? ROLE_COLORS[agentRole] : null

                    // 시스템 메시지
                    if (msg.message_type === 'system') {
                      return (
                        <div key={msg.id} className="flex justify-center py-2">
                          <span className={`text-xs px-3 py-1 rounded-full ${isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-100 text-zinc-500'
                            }`}>
                            {msg.content}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isContinuation ? 'mt-0.5' : 'mt-3'}`}
                      >
                        {/* Avatar - 연속 메시지면 숨김 */}
                        {!isMe && (
                          <div className={`w-8 flex-shrink-0 ${isContinuation ? 'invisible' : ''}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isAgent && roleStyle
                              ? `${roleStyle.bg} ${roleStyle.text}`
                              : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                              }`}>
                              {isAgent ? <Bot className="w-3.5 h-3.5" /> : senderInitials}
                            </div>
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {/* Sender Info - 연속 메시지면 숨김 */}
                          {!isMe && !isContinuation && (
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {senderName}
                              </span>
                              {isAgent && agentRole && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleStyle?.bg} ${roleStyle?.text}`}>
                                  {ROLE_LABELS[agentRole] || agentRole}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-500">
                                {formatTime(msg.created_at)}
                              </span>
                            </div>
                          )}

                          {/* Message Content */}
                          {msg.message_type === 'image' && msg.metadata?.url ? (
                            <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200'
                              }`}>
                              <a href={msg.metadata.url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={msg.metadata.url}
                                  alt={msg.metadata.fileName || 'Image'}
                                  className="max-w-[280px] max-h-[180px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              </a>
                            </div>
                          ) : msg.message_type === 'file' && msg.metadata?.url ? (
                            <a
                              href={msg.metadata.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${isDark
                                ? 'bg-zinc-800 hover:bg-zinc-700'
                                : 'bg-white border border-zinc-200 hover:bg-zinc-50'
                                }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-zinc-700' : 'bg-zinc-100'
                                }`}>
                                <FileText className="w-4 h-4 text-zinc-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{msg.metadata.fileName || 'File'}</p>
                                <p className="text-xs text-zinc-500">{msg.metadata.fileSize ? formatFileSize(msg.metadata.fileSize) : ''}</p>
                              </div>
                              <Download className="w-4 h-4 text-zinc-400" />
                            </a>
                          ) : (
                            <div className={`px-3.5 py-2 rounded-xl text-sm leading-relaxed ${isMe
                              ? 'bg-accent text-white'
                              : isAgent && roleStyle
                                ? `${isDark ? 'bg-zinc-800/80' : 'bg-white'} border ${roleStyle.border}`
                                : isDark
                                  ? 'bg-zinc-800/80 text-zinc-100'
                                  : 'bg-white text-zinc-900 border border-zinc-200'
                              }`}>
                              {msg.content}
                            </div>
                          )}

                          {/* Time for own messages */}
                          {isMe && !isContinuation && (
                            <span className="text-[10px] text-zinc-500 mt-1 px-1">
                              {formatTime(msg.created_at)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}

              {/* Typing Indicator - Enterprise Style */}
              <AnimatePresence>
                {(agentTyping || typingUsers.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="px-4 py-2"
                  >
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
                      }`}>
                      <div className="flex gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${agentTyping ? 'bg-indigo-400' : 'bg-zinc-400'
                          }`} style={{ animationDelay: '0ms' }} />
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${agentTyping ? 'bg-indigo-400' : 'bg-zinc-400'
                          }`} style={{ animationDelay: '150ms' }} />
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${agentTyping ? 'bg-indigo-400' : 'bg-zinc-400'
                          }`} style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-zinc-500">
                        {typingUsers.map(p => p.agent?.name || p.user?.name).slice(0, 2).join(', ')}
                        {typingUsers.length > 2 && ` +${typingUsers.length - 2}`}
                        {agentTyping ? ' generating...' : ' typing...'}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input Area - Enterprise Style */}
            {activeRoomId && (
              <div className={`px-4 py-3 border-t flex-shrink-0 ${isDark ? 'border-zinc-800/50 bg-zinc-900' : 'border-zinc-200 bg-white'
                }`}>
                {/* Hidden file inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e, 'file')}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={(e) => handleFileUpload(e, 'image')}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                />
                {/* Hidden share file input (PDF, Image, Video) */}
                <input
                  type="file"
                  ref={shareInputRef}
                  onChange={handleShareFile}
                  accept="application/pdf,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                  className="hidden"
                />

                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isDark
                  ? 'bg-zinc-800/50 border-zinc-700/50 focus-within:border-zinc-600'
                  : 'bg-zinc-50 border-zinc-200 focus-within:border-zinc-300'
                  }`}>
                  {/* Attachment buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300' : 'hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600'
                        }`}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploading}
                      className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300' : 'hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600'
                        }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className={`w-px h-5 ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />

                  {/* Input field */}
                  {uploading ? (
                    <div className="flex-1 flex items-center gap-2 py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      <span className="text-sm text-zinc-500">Uploading...</span>
                    </div>
                  ) : (
                    <input
                      ref={inputRef}
                      type="text"
                      id="chat-message-input"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={inputText.startsWith('/') ? 'Message to mentioned agent...' : 'Type a message...'}
                      autoComplete="off"
                      className={`flex-1 py-1 bg-transparent text-sm placeholder:text-zinc-500 no-focus-ring ${isDark ? 'text-zinc-100' : 'text-zinc-900'
                        }`}
                    />
                  )}

                  {/* STT Microphone button */}
                  <button
                    onClick={() => isTranscribing ? stopTranscription() : startTranscription((text) => setInputText(prev => prev + (prev ? ' ' : '') + text))}
                    className={`p-1.5 rounded-lg transition-colors ${isTranscribing
                      ? 'bg-red-500/10 text-red-500 animate-pulse'
                      : isDark ? 'hover:bg-zinc-700 text-zinc-500' : 'hover:bg-zinc-200 text-zinc-400'
                      }`}
                    title={isTranscribing ? '음성 인식 중지' : '음성 인식 시작'}
                  >
                    {isTranscribing ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <div className={`w-px h-5 ${isDark ? 'bg-zinc-700' : 'bg-zinc-200'}`} />

                  {/* Send button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || sending}
                    className={`p-2 rounded-lg transition-all ${inputText.trim() && !sending
                      ? 'bg-accent text-white hover:opacity-90'
                      : isDark ? 'bg-zinc-700 text-zinc-500' : 'bg-zinc-200 text-zinc-400'
                      }`}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Mention hint */}
                {inputText.startsWith('/') && (
                  <div className="mt-2 px-1">
                    <span className="text-xs text-zinc-500">
                      Tip: Use /AgentName to mention a specific agent
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar - Participants Panel */}
          <AnimatePresence>
            {showRightSidebar && activeRoom && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex-shrink-0 border-l overflow-hidden ${isDark ? 'border-zinc-800/50 bg-zinc-900' : 'border-zinc-200 bg-white'
                  }`}
              >
                <div className="w-[260px] h-full flex flex-col">
                  {/* Sidebar Header */}
                  <div className={`px-4 py-3 border-b ${isDark ? 'border-zinc-800/50' : 'border-zinc-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'
                        }`}>
                        Participants ({activeRoom.participants?.length || 0})
                      </span>
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                          }`}
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Participants List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {activeRoom.participants?.map((participant) => {
                      const isAgentParticipant = participant.participant_type === 'agent' || participant.agent
                      const name = participant.user?.name || participant.agent?.name || 'Unknown'
                      const initials = name.slice(0, 2).toUpperCase()
                      const isOwner = participant.user_id === activeRoom.created_by
                      const isMe = !isAgentParticipant && participant.user_id === currentUserId
                      const isFacilitator = isAgentParticipant && meetingStatus?.is_meeting_active &&
                        meetingStatus?.meeting_facilitator_id === participant.agent_id
                      const agentRole = meetingConfig?.agentConfigs?.find((c: any) => c.id === participant.agent_id)?.role
                      const roleStyle = agentRole ? ROLE_COLORS[agentRole] : null

                      return (
                        <div
                          key={participant.id}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg group transition-colors ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
                            } ${isAgentParticipant ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (isAgentParticipant && participant.agent?.name) {
                              mentionAgent(participant.agent.name)
                            }
                          }}
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold ${isAgentParticipant && roleStyle
                              ? `${roleStyle.bg} ${roleStyle.text}`
                              : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                              }`}>
                              {isAgentParticipant ? <Bot className="w-3.5 h-3.5" /> : initials}
                            </div>
                            {/* Online indicator */}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${isDark ? 'border-zinc-900' : 'border-white'
                              } ${isAgentParticipant || onlineUsers.includes(participant.user_id || '') ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">{name}</span>
                              {/* 🎤 현재 말하는 중인 참가자 마이크 표시 */}
                              {speakerMode && currentSpeaker === name && (
                                <div className="flex items-center">
                                  <Mic className="w-3 h-3 text-emerald-400 animate-pulse flex-shrink-0" />
                                  <span className="flex gap-0.5 ml-0.5">
                                    {[0, 1, 2].map(i => (
                                      <span
                                        key={i}
                                        className="w-0.5 h-2 bg-emerald-400 rounded-full animate-pulse"
                                        style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
                                      />
                                    ))}
                                  </span>
                                </div>
                              )}
                              {isOwner && (
                                <Crown className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              )}
                              {isFacilitator && (
                                <Shield className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                              )}
                              {isMe && (
                                <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
                                  }`}>you</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                              {isAgentParticipant ? (
                                <>
                                  {agentRole && (
                                    <span className={roleStyle?.text}>{ROLE_LABELS[agentRole]}</span>
                                  )}
                                  {!agentRole && (
                                    <span>{(participant.agent as any)?.model || 'AI Agent'}</span>
                                  )}
                                </>
                              ) : (
                                <span className="truncate">{participant.user?.email || ''}</span>
                              )}
                            </div>
                          </div>

                          {/* Kick button */}
                          {isRoomOwner() && !isMe && !isOwner && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfirmKick({ participantId: participant.id, name })
                              }}
                              className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'
                                }`}
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Sidebar Footer */}
                  <div className={`p-2 border-t ${isDark ? 'border-zinc-800/50' : 'border-zinc-200'}`}>
                    <button
                      onClick={() => setConfirmLeave(true)}
                      className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isDark
                        ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
                        : 'text-zinc-500 hover:text-red-600 hover:bg-red-50'
                        }`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Leave Room
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            isDark={isDark}
            initialMode={newChatMode}
            onClose={() => {
              setShowNewChat(false)
              setNewChatMode(null)
            }}
            onCreateRoom={async (data) => {
              const { topic, duration, facilitator_id, ...roomData } = data
              const room = await createRoom(roomData)
              if (room) {
                const newRoomMode = detectRoomMode(room)
                setActiveRoomId(room.id)
                const params = new URLSearchParams()
                params.set('room', room.id)
                if (newRoomMode !== 'chat') {
                  params.set('mode', newRoomMode)
                }
                router.replace(`/dashboard-group/messenger?${params.toString()}`, { scroll: false })
              }
              setShowNewChat(false)

              // 주제가 있으면 회의 시작 및 첫 메시지 전송
              if (room?.id) {
                // 약간의 딜레이 후 회의 시작 (방이 완전히 로드되도록)
                setTimeout(async () => {
                  try {
                    // 회의 시작 (진행자 포함)
                    const meetingRes = await fetch(`/api/chat/rooms/${room.id}/meeting`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        topic: topic || '자유 토론',
                        duration_minutes: duration || 5,
                        facilitator_id: facilitator_id || null,
                      }),
                    })
                    const meetingData = await meetingRes.json()
                    console.log('[Messenger] Meeting started:', meetingData)

                    // DB 저장 완료를 위한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 500))

                    // 첫 메시지 전송하여 대화 트리거
                    const startMessage = topic
                      ? `회의를 시작합니다. 주제: "${topic}" (${duration}분)\n\n이 주제에 대해 토론해주세요.`
                      : `회의를 시작합니다. 자유롭게 대화해주세요. (${duration}분)`

                    await fetch(`/api/chat/rooms/${room.id}/messages`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: startMessage }),
                    })
                  } catch (err) {
                    console.error('Failed to start meeting:', err)
                  }
                }, 500)
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && activeRoomId && (
          <InviteModal
            isDark={isDark}
            roomId={activeRoomId}
            onClose={() => setShowInviteModal(false)}
            onInvited={async () => {
              setShowInviteModal(false)
              // 방 목록 및 현재 방 정보 새로고침
              await Promise.all([fetchRooms(), fetchRoom()])
            }}
          />
        )}
      </AnimatePresence>

      {/* Leave Room Confirmation */}
      <AnimatePresence>
        {confirmLeave && (
          <ConfirmModal
            isDark={isDark}
            title="채팅방 나가기"
            message="정말 이 채팅방을 나가시겠습니까?"
            confirmText="나가기"
            confirmColor="orange"
            onClose={() => setConfirmLeave(false)}
            onConfirm={handleLeaveRoom}
          />
        )}
      </AnimatePresence>

      {/* Delete Room Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmModal
            isDark={isDark}
            title="채팅방 삭제"
            message="채팅방을 삭제하면 모든 메시지가 영구적으로 삭제됩니다. 계속하시겠습니까?"
            confirmText="삭제"
            confirmColor="red"
            onClose={() => setConfirmDelete(false)}
            onConfirm={handleDeleteRoom}
          />
        )}
      </AnimatePresence>

      {/* Kick Participant Confirmation */}
      <AnimatePresence>
        {confirmKick && (
          <ConfirmModal
            isDark={isDark}
            title="참여자 강퇴"
            message={`"${confirmKick.name}"님을 채팅방에서 강퇴하시겠습니까?`}
            confirmText="강퇴"
            confirmColor="red"
            onClose={() => setConfirmKick(null)}
            onConfirm={handleKickParticipant}
          />
        )}
      </AnimatePresence>

      {/* Meeting Start Modal */}
      <AnimatePresence>
        {showMeetingModal && (
          <MeetingModal
            isDark={isDark}
            onClose={() => setShowMeetingModal(false)}
            onStart={async (topic, duration) => {
              await startMeeting(topic, duration)
              // 회의 시작 후 첫 메시지 전송하여 대화 트리거
              await sendMessage(`회의를 시작합니다. 주제: ${topic || '자유 토론'} (${duration}분)`)
              // 음성 모드는 사용자가 수동으로 활성화해야 함 (자동 활성화 제거)
            }}
          />
        )}
      </AnimatePresence>

      {/* 🔭 AI Viewfinder Modal */}
      {showViewfinder && (
        <AIViewfinder
          onClose={() => setShowViewfinder(false)}
          onCapture={async (capture: ViewfinderCaptureResult) => {
            // 뷰파인더 캡처를 파일 공유 핸들러로 전달
            await handleMeetingShareFile({
              dataUrl: capture.imageDataUrl,
              name: `viewfinder-${Date.now()}.png`,
              type: 'image/png'
            })
            setShowViewfinder(false)
          }}
        />
      )}

      {/* Click outside to close dropdown */}
      {showRoomSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowRoomSettings(false)}
        />
      )}
    </div>
  )
}

// 회의 시작 모달
function MeetingModal({
  isDark,
  onClose,
  onStart
}: {
  isDark: boolean
  onClose: () => void
  onStart: (topic: string, duration: number) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(5) // 기본 5분

  const durationOptions = [
    { value: 3, label: '3분' },
    { value: 5, label: '5분' },
    { value: 10, label: '10분' },
    { value: 15, label: '15분' },
    { value: 30, label: '30분' },
  ]

  const handleStart = async () => {
    setLoading(true)
    try {
      await onStart(topic || '자유 토론', duration)
      onClose()
    } catch (err) {
      console.error('Failed to start meeting:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Play className="w-5 h-5 text-purple-500" />
          </div>
          <h2 className="text-xl font-bold">회의 시작</h2>
        </div>

        <p className={`mb-4 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          에이전트들이 설정된 시간 동안 서로 대화합니다. 중간에 메시지를 보내거나 종료 버튼을 누르면 대화가 중단됩니다.
        </p>

        {/* 주제 입력 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">회의 주제 (선택)</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="자유 토론"
            className={`w-full px-4 py-2.5 rounded-xl no-focus-ring ${isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
              }`}
          />
        </div>

        {/* 시간 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">회의 시간</label>
          <div className="grid grid-cols-5 gap-2">
            {durationOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${duration === opt.value
                  ? 'bg-purple-500 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '시작하기'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 회의 시간 포맷팅 (초 → MM:SS)
function formatMeetingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 시간 포맷팅
function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (dayDiff === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (dayDiff === 1) {
    return 'Yesterday'
  } else if (dayDiff < 7) {
    return `${dayDiff} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

// 새 채팅 모달
// ═══════════════════════════════════════════════════════════════════════════════
// AI 조직 소집 콘솔 (AI Organization Summon Console)
// ═══════════════════════════════════════════════════════════════════════════════

// 에이전트 역할 정의
type AgentRole = 'strategist' | 'analyst' | 'executor' | 'critic' | 'mediator'
type AgentTendency = 'aggressive' | 'conservative' | 'creative' | 'data-driven'

interface AgentConfig {
  id: string
  role: AgentRole
  tendency: AgentTendency
  canDecide: boolean // 의사결정 권한
}

function NewChatModal({
  isDark,
  initialMode,
  onClose,
  onCreateRoom
}: {
  isDark: boolean
  initialMode?: string | null
  onClose: () => void
  onCreateRoom: (data: any) => Promise<{ id: string } | void>
}) {
  // 테마 스토어에서 액센트 컬러 가져오기
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find(c => c.id === accentColor) || accentColors[0]

  // initialMode에 따라 기본 purpose 설정
  const getDefaultPurpose = () => {
    switch (initialMode) {
      case 'meeting': return 'strategic_decision'
      case 'debate': return 'risk_analysis'
      case 'presentation': return 'idea_generation'
      default: return ''
    }
  }

  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])

  // [A] 회의 목적 (WHY)
  const [purpose, setPurpose] = useState(getDefaultPurpose())

  // [B] AI 에이전트 구성 (WHO)
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([])

  // [C] 회의 방식 (HOW)
  const [discussionMode, setDiscussionMode] = useState('balanced')
  const [allowDebate, setAllowDebate] = useState(true)
  const [failureResolution, setFailureResolution] = useState<'majority' | 'leader' | 'defer'>('leader')

  // [D] 컨텍스트 (CONTEXT)
  const [topic, setTopic] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [attachmentPreviews, setAttachmentPreviews] = useState<{ name: string; size: string; type: string }[]>([])
  const [linkedProject, setLinkedProject] = useState<string | null>(null)
  const [memoryScope, setMemoryScope] = useState<'team' | 'project' | 'none'>('team')

  // [E] 결과물 정의 (OUTPUT)
  const [outputs, setOutputs] = useState({
    decisionSummary: true,
    actionTasks: true,
    agentOpinions: false,
    riskSummary: false,
    nextAgenda: false,
    boardReflection: false,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 회의 목적 옵션
  const purposeOptions = [
    {
      value: 'strategic_decision',
      label: '전략적 의사결정',
      description: 'AI가 장기적 관점에서 옵션을 분석하고 최적의 방향을 제안합니다',
      icon: '◆'
    },
    {
      value: 'problem_analysis',
      label: '문제 원인 분석',
      description: 'AI가 문제의 근본 원인을 파악하고 체계적으로 분석합니다',
      icon: '◇'
    },
    {
      value: 'action_planning',
      label: '실행 계획 수립',
      description: 'AI가 구체적인 실행 단계와 담당자를 제안합니다',
      icon: '▷'
    },
    {
      value: 'idea_expansion',
      label: '아이디어 확장',
      description: 'AI가 창의적 관점에서 다양한 가능성을 탐색합니다',
      icon: '○'
    },
    {
      value: 'risk_validation',
      label: '리스크 검증',
      description: 'AI가 잠재적 위험요소를 식별하고 대응방안을 검토합니다',
      icon: '△'
    },
  ]

  // 에이전트 역할 옵션
  const roleOptions: { value: AgentRole; label: string; description: string }[] = [
    { value: 'strategist', label: '전략가', description: '최종 방향 제안' },
    { value: 'analyst', label: '분석가', description: '데이터 기반 검증' },
    { value: 'executor', label: '실행가', description: '실행 가능성 평가' },
    { value: 'critic', label: '반대자', description: '반대 의견 전담' },
    { value: 'mediator', label: '중재자', description: '의견 조율' },
  ]

  // 성향 옵션
  const tendencyOptions: { value: AgentTendency; label: string }[] = [
    { value: 'aggressive', label: '공격적' },
    { value: 'conservative', label: '보수적' },
    { value: 'creative', label: '창의적' },
    { value: 'data-driven', label: '데이터 중심' },
  ]

  // 토론 방식 옵션
  const discussionModeOptions = [
    {
      value: 'quick',
      label: '빠른 결론',
      description: '핵심 요약 중심으로 신속하게 결론 도출',
      depth: 1
    },
    {
      value: 'balanced',
      label: '균형 토론',
      description: '찬반 구조로 다양한 관점 검토',
      depth: 2
    },
    {
      value: 'deep',
      label: '심층 분석',
      description: '리스크와 대안을 반복 검증',
      depth: 3
    },
    {
      value: 'brainstorm',
      label: '브레인스토밍',
      description: '아이디어 확장 우선, 평가는 후순위',
      depth: 2
    },
  ]

  // 파일 첨부 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const validFiles = files.slice(0, 5).filter(file => file.size <= 10 * 1024 * 1024)
    setAttachments(prev => [...prev, ...validFiles].slice(0, 5))
    setAttachmentPreviews(prev => [
      ...prev,
      ...validFiles.map(f => ({
        name: f.name,
        size: f.size < 1024 * 1024
          ? `${(f.size / 1024).toFixed(1)}KB`
          : `${(f.size / (1024 * 1024)).toFixed(1)}MB`,
        type: f.type
      }))
    ].slice(0, 5))
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // 팀원 및 에이전트 목록 조회
  useEffect(() => {
    async function fetchData() {
      try {
        const membersRes = await fetch('/api/teams/members')
        if (membersRes.ok) {
          const members = await membersRes.json()
          setTeamMembers(members)
        }
        const agentsRes = await fetch('/api/agents')
        if (agentsRes.ok) {
          const agentsList = await agentsRes.json()
          setAgents(agentsList)
        }
      } catch (err) {
        console.error('Failed to fetch participants:', err)
      }
    }
    fetchData()
  }, [])

  // 🔥 역할 자동 분배를 위한 역할 풀
  const ROLE_ROTATION: Array<{ role: 'strategist' | 'analyst' | 'executor' | 'critic' | 'mediator'; tendency: 'aggressive' | 'conservative' | 'creative' | 'data-driven' }> = [
    { role: 'strategist', tendency: 'creative' },     // 1번째: 전략가 (방향 제시)
    { role: 'critic', tendency: 'conservative' },     // 2번째: 비평가 (반대 의견 필수!)
    { role: 'executor', tendency: 'data-driven' },    // 3번째: 실행가 (현실 체크)
    { role: 'analyst', tendency: 'data-driven' },     // 4번째: 분석가
    { role: 'mediator', tendency: 'creative' },       // 5번째: 중재자
  ]

  // 에이전트 추가 (🔥 역할 자동 분배!)
  const addAgent = (agentId: string) => {
    if (agentConfigs.some(c => c.id === agentId)) return

    // 현재 에이전트 수에 따라 다음 역할 자동 선택
    const nextIndex = agentConfigs.length % ROLE_ROTATION.length
    const nextConfig = ROLE_ROTATION[nextIndex]

    setAgentConfigs(prev => [...prev, {
      id: agentId,
      role: nextConfig.role,
      tendency: nextConfig.tendency,
      canDecide: false,
    }])
  }

  // 에이전트 제거
  const removeAgent = (agentId: string) => {
    setAgentConfigs(prev => prev.filter(c => c.id !== agentId))
  }

  // 에이전트 설정 변경
  const updateAgentConfig = (agentId: string, updates: Partial<AgentConfig>) => {
    setAgentConfigs(prev => prev.map(c =>
      c.id === agentId ? { ...c, ...updates } : c
    ))
  }

  // Output 토글
  const toggleOutput = (key: keyof typeof outputs) => {
    setOutputs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // 소집 실행
  const handleSummon = async () => {
    if (!purpose || agentConfigs.length === 0) {
      alert('회의 목적과 AI 에이전트를 선택해주세요')
      return
    }
    setLoading(true)
    try {
      let attachmentData: { name: string; content: string; type: string }[] = []
      if (attachments.length > 0) {
        attachmentData = await Promise.all(
          attachments.map(async (file) => {
            const content = await new Promise<string>((resolve) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                reader.readAsText(file)
              } else {
                reader.readAsDataURL(file)
              }
            })
            return { name: file.name, content, type: file.type }
          })
        )
      }

      const purposeLabel = purposeOptions.find(p => p.value === purpose)?.label || purpose

      await onCreateRoom({
        name: purposeLabel,
        type: 'meeting',
        category: purpose,
        participant_ids: agentConfigs.map(c => ({ type: 'agent' as const, id: c.id })),
        topic: topic.trim() || null,
        duration: discussionModeOptions.find(m => m.value === discussionMode)?.depth === 3 ? 15 :
          discussionModeOptions.find(m => m.value === discussionMode)?.depth === 1 ? 3 : 5,
        facilitator_id: null,
        attachments: attachmentData.length > 0 ? attachmentData : null,
        // 확장 설정
        meeting_config: {
          purpose,
          agentConfigs,
          discussionMode,
          allowDebate,
          failureResolution,
          linkedProject,
          memoryScope,
          outputs,
        }
      })
    } catch (err) {
      console.error('Failed to summon AI organization:', err)
    } finally {
      setLoading(false)
    }
  }

  // 선택된 에이전트 정보
  const selectedAgentsInfo = agentConfigs.map(config => ({
    ...config,
    agent: agents.find(a => a.id === config.id)
  })).filter(c => c.agent)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-900' : 'bg-white'
          } shadow-2xl max-h-[90vh] flex flex-col`}
        style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}
      >
        {/* 헤더 - 콘솔 스타일 */}
        <div className={`px-6 py-4 border-b ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.hoverColor})` }}
              >
                <span className="text-white text-lg">AI</span>
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight">AI 조직 소집</h2>
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Organization Summon Console
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 스텝 인디케이터 */}
          <div className="flex gap-2 mt-4">
            {['WHY', 'WHO', 'HOW', 'CONTEXT', 'OUTPUT'].map((step, i) => (
              <button
                key={step}
                onClick={() => setCurrentStep(i)}
                className={`flex-1 py-1.5 text-xs font-mono rounded transition-all ${currentStep === i
                  ? 'text-white'
                  : currentStep > i
                    ? ''
                    : isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                  }`}
                style={
                  currentStep === i
                    ? { backgroundColor: currentAccent.color }
                    : currentStep > i
                      ? { backgroundColor: `rgba(${currentAccent.rgb}, 0.2)`, color: currentAccent.color }
                      : undefined
                }
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* [A] 회의 목적 (WHY) */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1" style={{ color: currentAccent.color }}>MISSION OBJECTIVE</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  이 선택이 AI의 사고방식과 행동을 결정합니다
                </p>
              </div>

              <div className="space-y-2">
                {purposeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPurpose(opt.value)}
                    className={`w-full p-4 rounded-xl text-left transition-all border ${purpose === opt.value
                      ? ''
                      : isDark
                        ? 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                        : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                      }`}
                    style={purpose === opt.value ? {
                      borderColor: currentAccent.color,
                      backgroundColor: `rgba(${currentAccent.rgb}, 0.1)`
                    } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="text-lg"
                        style={{ color: purpose === opt.value ? currentAccent.color : '#71717a' }}
                      >
                        {opt.icon}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{opt.label}</div>
                        <div className={`text-xs mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {opt.description}
                        </div>
                      </div>
                      {purpose === opt.value && (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: currentAccent.color }}
                        >
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* [B] AI 에이전트 구성 (WHO) */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1" style={{ color: currentAccent.color }}>TEAM COMPOSITION</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  AI 에이전트를 선택하고 역할을 지정하세요
                </p>
              </div>

              {/* 선택된 에이전트 카드들 */}
              {selectedAgentsInfo.length > 0 && (
                <div className="space-y-3 mb-4">
                  {selectedAgentsInfo.map(({ id, role, tendency, canDecide, agent }) => (
                    <div
                      key={id}
                      className={`p-4 rounded-xl border ${isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-200 bg-zinc-50'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getColorForId(id)} flex items-center justify-center text-white`}>
                            <Bot className="w-4 h-4" />
                          </div>
                          <span className="font-medium">{agent?.name}</span>
                        </div>
                        <button
                          onClick={() => removeAgent(id)}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 역할 선택 */}
                      <div className="mb-3">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mb-1 block`}>역할</label>
                        <div className="flex flex-wrap gap-1">
                          {roleOptions.map(r => (
                            <button
                              key={r.value}
                              onClick={() => updateAgentConfig(id, { role: r.value })}
                              className={`px-2 py-1 rounded text-xs transition-all ${role === r.value
                                ? 'text-white'
                                : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600'
                                }`}
                              style={role === r.value ? { backgroundColor: currentAccent.color } : undefined}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 성향 선택 */}
                      <div className="mb-3">
                        <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mb-1 block`}>성향</label>
                        <div className="flex flex-wrap gap-1">
                          {tendencyOptions.map(t => (
                            <button
                              key={t.value}
                              onClick={() => updateAgentConfig(id, { tendency: t.value })}
                              className={`px-2 py-1 rounded text-xs transition-all ${tendency === t.value
                                ? 'text-white'
                                : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600'
                                }`}
                              style={tendency === t.value ? { backgroundColor: currentAccent.hoverColor } : undefined}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 의사결정 권한 */}
                      <button
                        onClick={() => updateAgentConfig(id, { canDecide: !canDecide })}
                        className={`flex items-center gap-2 text-xs ${canDecide ? 'text-amber-500' : isDark ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${canDecide ? 'bg-amber-500 border-amber-500' : isDark ? 'border-zinc-600' : 'border-zinc-300'
                          }`}>
                          {canDecide && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        의사결정 권한 부여
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 에이전트 목록 */}
              <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'}`}>
                <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mb-2 block`}>
                  소집 가능한 에이전트
                </label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {agents.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-2">에이전트가 없습니다</p>
                  ) : (
                    agents.filter(a => !agentConfigs.some(c => c.id === a.id)).map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => addAgent(agent.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all ${isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200'
                          }`}
                      >
                        <div className={`w-6 h-6 rounded bg-gradient-to-br ${getColorForId(agent.id)} flex items-center justify-center text-white`}>
                          <Bot className="w-3 h-3" />
                        </div>
                        <span className="text-sm flex-1 text-left">{agent.name}</span>
                        <Plus className="w-4 h-4" style={{ color: currentAccent.color }} />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* [C] 회의 방식 (HOW) */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1" style={{ color: currentAccent.color }}>DISCUSSION PROTOCOL</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  AI의 사고 깊이와 토론 방식을 설정합니다
                </p>
              </div>

              {/* 토론 모드 */}
              <div className="grid grid-cols-2 gap-2">
                {discussionModeOptions.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setDiscussionMode(mode.value)}
                    className={`p-3 rounded-xl text-left transition-all border ${discussionMode === mode.value
                      ? ''
                      : isDark
                        ? 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                        : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                      }`}
                    style={discussionMode === mode.value ? {
                      borderColor: currentAccent.color,
                      backgroundColor: `rgba(${currentAccent.rgb}, 0.1)`
                    } : undefined}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3].map(i => (
                          <div
                            key={i}
                            className={`w-1.5 h-3 rounded-sm ${i <= mode.depth && discussionMode !== mode.value
                              ? isDark ? 'bg-zinc-500' : 'bg-zinc-400'
                              : !(i <= mode.depth) ? (isDark ? 'bg-zinc-700' : 'bg-zinc-200') : ''
                              }`}
                            style={i <= mode.depth && discussionMode === mode.value ? { backgroundColor: currentAccent.color } : undefined}
                          />
                        ))}
                      </div>
                      <span className="font-medium text-sm">{mode.label}</span>
                    </div>
                    <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      {mode.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* 추가 설정 */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'} space-y-3`}>
                <button
                  onClick={() => setAllowDebate(!allowDebate)}
                  className="flex items-center justify-between w-full"
                >
                  <div>
                    <div className="text-sm font-medium text-left">AI 간 상호 반박</div>
                    <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      에이전트들이 서로의 의견에 반박할 수 있습니다
                    </div>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors flex items-center ${allowDebate ? 'justify-end' : 'justify-start'} p-1`}
                    style={{ backgroundColor: allowDebate ? currentAccent.color : isDark ? '#52525b' : '#d4d4d8' }}
                  >
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </div>
                </button>

                <div className="border-t border-zinc-700 pt-3">
                  <div className="text-sm font-medium mb-2">합의 실패 시 처리</div>
                  <div className="flex gap-2">
                    {[
                      { value: 'majority', label: '다수결' },
                      { value: 'leader', label: '리더 결정' },
                      { value: 'defer', label: '보류' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setFailureResolution(opt.value as any)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${failureResolution === opt.value
                          ? 'text-white'
                          : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600'
                          }`}
                        style={failureResolution === opt.value ? { backgroundColor: currentAccent.color } : undefined}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* [D] 컨텍스트 (CONTEXT) */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1" style={{ color: currentAccent.color }}>MISSION BRIEFING</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  AI가 참고할 정보와 범위를 설정합니다
                </p>
              </div>

              {/* 토론 주제 */}
              <div>
                <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mb-1 block`}>
                  핵심 안건
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="AI 조직이 논의할 핵심 안건을 입력하세요"
                  rows={3}
                  className={`w-full px-4 py-3 rounded-xl no-focus-ring resize-none ${isDark ? 'bg-zinc-800 text-white placeholder:text-zinc-600' : 'bg-zinc-100 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                />
              </div>

              {/* 참고 자료 */}
              <div>
                <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mb-1 block`}>
                  참고 자료
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx,.csv,.json"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full px-4 py-3 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2 ${isDark
                    ? 'border-zinc-700 hover:border-emerald-500 text-zinc-400 hover:text-emerald-400'
                    : 'border-zinc-300 hover:border-emerald-500 text-zinc-500 hover:text-emerald-500'
                    }`}
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="text-sm">파일 첨부</span>
                </button>
                {attachmentPreviews.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachmentPreviews.map((file, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                          }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 flex-shrink-0" style={{ color: currentAccent.color }} />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-zinc-500 flex-shrink-0">{file.size}</span>
                        </div>
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 메모리 범위 */}
              <div>
                <label className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mb-1 block`}>
                  참조 메모리 범위
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'team', label: '조직 메모리', desc: '팀 전체 기록' },
                    { value: 'project', label: '프로젝트 메모리', desc: '현재 프로젝트만' },
                    { value: 'none', label: '없음', desc: '새로 시작' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMemoryScope(opt.value as any)}
                      className={`flex-1 p-2 rounded-lg text-left transition-all border ${memoryScope === opt.value
                        ? ''
                        : isDark
                          ? 'border-zinc-700 bg-zinc-800/50'
                          : 'border-zinc-200 bg-zinc-50'
                        }`}
                      style={memoryScope === opt.value ? {
                        borderColor: currentAccent.color,
                        backgroundColor: `rgba(${currentAccent.rgb}, 0.1)`
                      } : undefined}
                    >
                      <div className="text-xs font-medium">{opt.label}</div>
                      <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* [E] 결과물 정의 (OUTPUT) */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-sm font-semibold mb-1" style={{ color: currentAccent.color }}>DELIVERABLES</h3>
                <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  회의 종료 후 자동 생성할 산출물을 선택합니다
                </p>
              </div>

              <div className="space-y-2">
                {[
                  { key: 'decisionSummary', label: '의사결정 요약', desc: '최종 결정사항과 근거 정리' },
                  { key: 'actionTasks', label: '실행 태스크 생성', desc: '구체적인 할일 목록 자동 생성' },
                  { key: 'agentOpinions', label: '에이전트별 의견 정리', desc: '각 AI의 관점과 제안 정리' },
                  { key: 'riskSummary', label: '반대/리스크 요약', desc: '식별된 위험요소와 대응방안' },
                  { key: 'nextAgenda', label: '다음 회의 안건 제안', desc: '후속 논의가 필요한 주제' },
                  { key: 'boardReflection', label: '워크플로우 반영', desc: '결과를 프로젝트 보드에 자동 반영' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => toggleOutput(item.key as keyof typeof outputs)}
                    className={`w-full p-3 rounded-xl text-left transition-all border flex items-center gap-3 ${outputs[item.key as keyof typeof outputs]
                      ? ''
                      : isDark
                        ? 'border-zinc-800 bg-zinc-800/50 hover:border-zinc-700'
                        : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                      }`}
                    style={outputs[item.key as keyof typeof outputs] ? {
                      borderColor: currentAccent.color,
                      backgroundColor: `rgba(${currentAccent.rgb}, 0.1)`
                    } : undefined}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center ${outputs[item.key as keyof typeof outputs]
                        ? ''
                        : isDark ? 'border-zinc-600' : 'border-zinc-300'
                        }`}
                      style={outputs[item.key as keyof typeof outputs] ? {
                        backgroundColor: currentAccent.color,
                        borderColor: currentAccent.color
                      } : undefined}
                    >
                      {outputs[item.key as keyof typeof outputs] && (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {item.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 - 소집 버튼 */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'}`}>
          <div className="flex gap-3">
            {currentStep > 0 && (
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-4"
              >
                이전
              </Button>
            )}

            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={currentStep === 0 && !purpose}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white"
              >
                다음
              </Button>
            ) : (
              <Button
                onClick={handleSummon}
                disabled={!purpose || agentConfigs.length === 0 || loading}
                className="flex-1 text-white font-bold"
                style={{
                  background: `linear-gradient(to right, ${currentAccent.color}, ${currentAccent.hoverColor})`
                }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span className="mr-2">▶</span>
                    AI 조직 소집
                  </>
                )}
              </Button>
            )}
          </div>

          {/* 요약 표시 */}
          {(purpose || agentConfigs.length > 0) && (
            <div className={`mt-3 pt-3 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <div className="flex flex-wrap gap-2 text-xs">
                {purpose && (
                  <span
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor: isDark ? '#27272a' : `rgba(${currentAccent.rgb}, 0.15)`,
                      color: currentAccent.color
                    }}
                  >
                    {purposeOptions.find(p => p.value === purpose)?.label}
                  </span>
                )}
                {agentConfigs.length > 0 && (
                  <span
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor: isDark ? '#27272a' : `rgba(${currentAccent.rgb}, 0.15)`,
                      color: currentAccent.hoverColor
                    }}
                  >
                    {agentConfigs.length}명 소집
                  </span>
                )}
                {discussionMode && (
                  <span className={`px-2 py-1 rounded ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'}`}>
                    {discussionModeOptions.find(m => m.value === discussionMode)?.label}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// 참여자 초대 모달
function InviteModal({
  isDark,
  roomId,
  onClose,
  onInvited
}: {
  isDark: boolean
  roomId: string
  onClose: () => void
  onInvited: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [invitables, setInvitables] = useState<{ users: any[]; agents: any[] }>({ users: [], agents: [] })
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)

  // 초대 가능한 목록 조회
  useEffect(() => {
    async function fetchInvitables() {
      try {
        const res = await fetch(`/api/chat/invitables?room_id=${roomId}&type=all`)
        if (res.ok) {
          const data = await res.json()
          setInvitables(data)
        }
      } catch (err) {
        console.error('Failed to fetch invitables:', err)
      }
    }
    fetchInvitables()
  }, [roomId])

  const handleInvite = async () => {
    if (!selectedUser && !selectedAgent) return
    setLoading(true)
    try {
      const body: any = {}
      if (selectedUser) body.user_id = selectedUser
      if (selectedAgent) body.agent_id = selectedAgent

      const res = await fetch(`/api/chat/rooms/${roomId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to invite')
      }

      onInvited()
    } catch (err) {
      console.error('Failed to invite:', err)
      alert(err instanceof Error ? err.message : '초대에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold">참여자 초대</h2>
        </div>

        {/* 사용자 목록 */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">사용자</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {invitables.users.length === 0 ? (
              <p className="text-sm text-zinc-400">초대할 수 있는 사용자가 없습니다</p>
            ) : (
              invitables.users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(selectedUser === user.id ? null : user.id)
                    setSelectedAgent(null)
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${selectedUser === user.id
                    ? 'bg-accent/10 border border-accent'
                    : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColorForId(user.id)} flex items-center justify-center text-white text-xs font-bold`}>
                    {user.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <span className="text-sm block">{user.name}</span>
                    <span className="text-xs text-zinc-500">{user.email}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 에이전트 목록 */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-2 text-zinc-500">AI 에이전트</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {invitables.agents.length === 0 ? (
              <p className="text-sm text-zinc-400">초대할 수 있는 에이전트가 없습니다</p>
            ) : (
              invitables.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(selectedAgent === agent.id ? null : agent.id)
                    setSelectedUser(null)
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${selectedAgent === agent.id
                    ? 'bg-accent/10 border border-accent'
                    : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    }`}
                >
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColorForId(agent.id)} flex items-center justify-center text-white`}>
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <span className="text-sm block">{agent.name}</span>
                    <span className="text-xs text-zinc-500">{agent.description}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleInvite}
            disabled={(!selectedUser && !selectedAgent) || loading}
            className="flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '초대하기'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// 확인 모달
function ConfirmModal({
  isDark,
  title,
  message,
  confirmText,
  confirmColor = 'red',
  onClose,
  onConfirm
}: {
  isDark: boolean
  title: string
  message: string
  confirmText: string
  confirmColor?: 'red' | 'orange'
  onClose: () => void
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-zinc-900' : 'bg-white'} shadow-xl`}
      >
        <div className="flex flex-col items-center text-center mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${confirmColor === 'red'
            ? isDark ? 'bg-red-500/20' : 'bg-red-100'
            : isDark ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
            {confirmColor === 'red' ? (
              <Trash2 className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
            ) : (
              <LogOut className={`w-6 h-6 ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
            )}
          </div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{title}</h2>
        </div>

        <p className={`mb-6 text-sm text-center ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {message}
        </p>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 ${confirmColor === 'red'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-orange-500 hover:bg-orange-600'
              } text-white`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
