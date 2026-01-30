'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import dynamic from 'next/dynamic'
import {
  ArrowLeft,
  Loader2,
  Bot,
  Brain,
  BookOpen,
  Workflow,
  Clock,
  Zap,
  Star,
  Target,
  TrendingUp,
  Calendar,
  Sparkles,
  Heart,
  Lightbulb,
  FileText,
  GitCommit,
  Cpu,
  Thermometer,
  Activity,
  X,
  User,
  Briefcase,
  Plus,
  Trash2,
  Users,
  FolderOpen,
  FolderPlus,
  Hash,
  Mail,
  Link2,
  Send,
  ImagePlus,
  Image,
  Wand2,
  Smile,
  Upload,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  CheckCircle,
  XCircle,
  LogOut,
  Mic,
  MicOff,
  Volume2,
  Square,
  Waves,
  UserCircle,
  Gauge,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PROVIDER_INFO, LLMProvider, AVAILABLE_MODELS } from '@/lib/llm/models'
import { createClient } from '@/lib/supabase/client'
import type { DeployedAgent, AgentStatus } from '@/types/database'
import { getAppLogo } from '@/components/icons/app-logos'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import { useAgentNotification } from '@/lib/contexts/AgentNotificationContext'
// 🔥 Types only - no runtime dependency (2309줄 agent-actions.ts 번들 방지)
import type { AgentAction, ToolAction } from '@/lib/ai/agent-actions-types'
// 🔥 Hook in separate file to avoid bundling WorkflowStepVisualizer (framer-motion + icons)
import { useWorkflowExecution, type WorkflowStep } from '@/lib/hooks/useWorkflowExecution'

// 🔥 Dynamic import helper for agent actions (loads 2309줄 file only when needed)
const getAgentActions = () => import('@/lib/ai/agent-actions')

// 🔥 Heavy components - Dynamic import for faster initial load
const AgentOSPanel = dynamic(() => import('@/components/agent/AgentOSPanel').then(m => m.AgentOSPanel), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>
})

const BrainMapLayout = dynamic(() => import('@/components/brain-map/BrainMapLayout').then(m => m.BrainMapLayout), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[600px]"><Loader2 className="w-8 h-8 animate-spin text-zinc-500" /></div>
})

const GrokVoiceChat = dynamic(() => import('@/components/voice/GrokVoiceChat').then(m => m.GrokVoiceChat), {
  ssr: false,
  loading: () => null
})

const GeminiVoiceChat = dynamic(() => import('@/components/voice/GeminiVoiceChat').then(m => m.GeminiVoiceChat), {
  ssr: false,
  loading: () => null
})

const WorkflowStepVisualizer = dynamic(() => import('@/components/chat/WorkflowStepVisualizer').then(m => m.WorkflowStepVisualizer), {
  ssr: false,
  loading: () => null
})

const PromptAssistant = dynamic(() => import('@/components/chat/PromptAssistant'), {
  ssr: false,
  loading: () => null
})

// 🔧 Core Components - Direct import for instant render (첫 화면에 보이는 것들)
import { AboutTab } from '@/components/agent-detail/tabs/AboutTab'
import { AgentProfileSidebar } from '@/components/agent-detail/AgentProfileSidebar'

// 🔧 Tab Components - Lazy loaded (탭 전환 시에만 로드)
const KnowledgeBaseTab = dynamic(() => import('@/components/agent-detail/tabs/KnowledgeBaseTab').then(m => ({ default: m.KnowledgeBaseTab })), { ssr: false })
const IntegrationsTab = dynamic(() => import('@/components/agent-detail/tabs/IntegrationsTab').then(m => ({ default: m.IntegrationsTab })), { ssr: false })
const ApiConnectionsTab = dynamic(() => import('@/components/agent-detail/tabs/ApiConnectionsTab').then(m => ({ default: m.ApiConnectionsTab })), { ssr: false })
const ChatHistoryView = dynamic(() => import('@/components/agent-detail/tabs/ChatHistoryView').then(m => ({ default: m.ChatHistoryView })), { ssr: false })
const WorkspaceTab = dynamic(() => import('@/components/agent-detail/tabs/WorkspaceTab').then(m => ({ default: m.WorkspaceTab })), { ssr: false })
const SettingsTab = dynamic(() => import('@/components/agent-detail/tabs/SettingsTab').then(m => ({ default: m.SettingsTab })), { ssr: false })
const ChatTab = dynamic(() => import('@/components/agent-detail/tabs/ChatTab').then(m => ({ default: m.ChatTab })), { ssr: false })

// 🔧 Modal Components - Lazy loaded (열릴 때만 로드)
const AddEmotionModal = dynamic(() => import('@/components/agent-detail/modals/EmotionModals').then(m => ({ default: m.AddEmotionModal })), { ssr: false })
const EditEmotionModal = dynamic(() => import('@/components/agent-detail/modals/EmotionModals').then(m => ({ default: m.EditEmotionModal })), { ssr: false })
const EmoticonModal = dynamic(() => import('@/components/agent-detail/modals/EmoticonModal').then(m => ({ default: m.EmoticonModal })), { ssr: false })
const MessageModal = dynamic(() => import('@/components/agent-detail/modals/MessageModal').then(m => ({ default: m.MessageModal })), { ssr: false })

// 🔧 Extracted utilities and constants
import {
  detectEmotion,
  detectEmotionsInOrder,
  formatDate,
  formatTimeAgo,
  generateRobotAvatar,
  type EmotionType,
  type CustomEmotion,
  type EmotionAvatars,
  type AgentWithMemory,
} from '@/components/agent-detail/utils'
import {
  tabs,
  TabType,
  getStatusConfig,
  logTypeLabels,
  knowledgeTypeLabels,
  VOICE_OPTIONS,
  CONVERSATION_STYLES,
  VAD_SENSITIVITY_OPTIONS,
  PROMPT_SECTIONS,
  DEFAULT_PROMPT_VALUES,
  DEFAULT_EMOTIONS,
} from '@/components/agent-detail/constants'
import { EditableTagInput } from '@/components/agent-detail/EditableTagInput'
import { useGrokVoiceCall } from '@/hooks/useGrokVoiceCall'

export default function AgentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { accentColor: accentColorId } = useThemeStore()
  const { setVoiceCallActive } = useAgentNotification()  // 🔥 알림 TTS 제어용
  const [mounted, setMounted] = useState(false)
  const agentId = params.id as string

  // 사용자가 선택한 테마 색상
  const userAccentColor = accentColors.find(c => c.id === accentColorId)?.color || '#3b82f6'
  const statusConfig = getStatusConfig(userAccentColor)

  // Prevent hydration mismatch by waiting for client mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === 'dark' : false

  const [agent, setAgent] = useState<AgentWithMemory | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('about')

  // 편집 모드 상태
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // 프롬프트 섹션 확장 상태
  const [expandedPromptSections, setExpandedPromptSections] = useState<Record<string, boolean>>({})

  // 채팅 음성 모드 상태
  const [chatVoiceMode, setChatVoiceMode] = useState(false)

  // Chat states
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string
    role: 'user' | 'agent' | 'system' // system: 입장 알림 등
    content: string
    timestamp: Date
    image?: string
    emotion?: EmotionType // 단일 감정 (하위 호환성)
    emotions?: EmotionType[] // 다중 감정 (텍스트 순서대로)
    // 업무 실행 관련
    isTask?: boolean
    taskStatus?: 'pending' | 'running' | 'completed' | 'failed'
    taskResult?: {
      output: string
      sources: string[]
      toolsUsed: string[]
      error?: string
    }
    // 지식베이스 출처
    knowledgeSources?: Array<{ title: string; similarity: number }>
    // 워크플로우 시각화
    workflow?: {
      title: string
      steps: WorkflowStep[]
    }
    // 생성된 프로젝트 정보 (프로젝트 확인 버튼용)
    createdProject?: {
      id: string
      name: string
    }
  }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatTypingStatus, setChatTypingStatus] = useState<'none' | 'read' | 'typing'>('none')
  const [chatImage, setChatImage] = useState<string | null>(null)
  const [chatImageFile, setChatImageFile] = useState<File | null>(null)

  // Prompt Assistant state
  const [showPromptAssistant, setShowPromptAssistant] = useState(false)

  // Tool menu states (도구 버튼 - 이미지 생성 등)
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [selectedTool, setSelectedTool] = useState<'chat' | 'image' | 'code' | 'search'>('chat')

  // Workflow execution hook
  const workflowExecution = useWorkflowExecution()

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatFileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // 🔧 Voice call states moved to useGrokVoiceCall hook - initialized after allEmotions

  // 감정 아바타 상태
  const [emotionAvatars, setEmotionAvatars] = useState<EmotionAvatars>({})

  // 감정 GIF에서 랜덤으로 1개 선택하는 헬퍼 함수
  // seed를 전달하면 동일한 seed에 대해 동일한 결과 반환 (메시지별 고정용)
  const getRandomEmotionGif = (emotionId: string, seed?: string): string | undefined => {
    const avatarData = emotionAvatars[emotionId]
    if (!avatarData) return undefined
    if (Array.isArray(avatarData)) {
      if (avatarData.length === 0) return undefined
      if (avatarData.length === 1) return avatarData[0]
      if (seed) {
        // 더 분산된 해시를 위해 FNV-1a 해시 사용
        let hash = 2166136261
        for (let i = 0; i < seed.length; i++) {
          hash ^= seed.charCodeAt(i)
          hash = Math.imul(hash, 16777619)
        }
        // 추가 믹싱
        hash ^= hash >>> 16
        hash = Math.imul(hash, 0x85ebca6b)
        hash ^= hash >>> 13
        hash = Math.imul(hash, 0xc2b2ae35)
        hash ^= hash >>> 16
        const index = Math.abs(hash) % avatarData.length
        return avatarData[index]
      }
      return avatarData[Math.floor(Math.random() * avatarData.length)]
    }
    return avatarData as string
  }

  // 채팅 메인 GIF 상태
  const [chatMainGif, setChatMainGif] = useState<string | null>(null)
  const [uploadingChatMainGif, setUploadingChatMainGif] = useState(false)
  const chatMainGifInputRef = useRef<HTMLInputElement>(null)
  const [uploadingEmotion, setUploadingEmotion] = useState<string | null>(null)

  // 업무 지시 모드 상태
  const [isTaskMode, setIsTaskMode] = useState(false)
  const [isAnalyzingTask, setIsAnalyzingTask] = useState(false)

  // 업무지시 모드 모델 선택
  const TASK_MODE_MODELS = [
    { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', provider: 'xai' },
    { id: 'grok-4-1', name: 'Grok 4.1', provider: 'xai' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', provider: 'anthropic' },
  ]
  const [selectedTaskModel, setSelectedTaskModel] = useState('grok-4-1-fast')
  const [isTaskModelDropdownOpen, setIsTaskModelDropdownOpen] = useState(false)
  const [pendingTask, setPendingTask] = useState<{
    analysis: {
      title: string
      summary: string
      steps: string[]
      expected_output: string
      estimated_time: string
      clarifications: string[]
      confidence: number
    }
    confirmation_message: string
    original_instruction: string
  } | null>(null)
  const [isExecutingTask, setIsExecutingTask] = useState(false)

  // 특수 액션 상태 (프로젝트 생성 등)
  const [pendingAction, setPendingAction] = useState<{
    action_type: 'project_create' | 'task_create'
    confirmation_message: string
    input_fields: Array<{
      name: string
      label: string
      type: 'text' | 'textarea' | 'select' | 'date'
      required: boolean
      placeholder?: string
      options?: Array<{ value: string; label: string }>
    }>
    extracted_data?: any
  } | null>(null)
  const [actionFormData, setActionFormData] = useState<Record<string, string>>({})
  const [isExecutingAction, setIsExecutingAction] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>('neutral')
  const emotionFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // 커스텀 감정 상태
  const [customEmotions, setCustomEmotions] = useState<CustomEmotion[]>([])
  const [showAddEmotionModal, setShowAddEmotionModal] = useState(false)
  const [editingEmotion, setEditingEmotion] = useState<CustomEmotion | null>(null)
  const [newEmotion, setNewEmotion] = useState<Partial<CustomEmotion>>({
    label: '',
    emoji: '',
    description: '',
    keywords: [],
  })
  const [keywordInput, setKeywordInput] = useState('')

  // 이모티콘 라이브러리 상태
  const [showEmoticonModal, setShowEmoticonModal] = useState(false)
  const [emoticons, setEmoticons] = useState<Array<{
    id: string
    name: string
    image_url: string
    image_urls: string[]
    category: string
    keywords: string[]
  }>>([])
  const [emoticonsLoading, setEmoticonsLoading] = useState(false)

  // 채팅 히스토리 로딩 상태
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // 메시지 보내기 모달 상태
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')

  // 에이전트 ID가 변경되면 상태 초기화
  useEffect(() => {
    // 이전 에이전트의 채팅 기록 초기화
    setChatMessages([])
    setHistoryLoaded(false)
    fetchAgent()
  }, [agentId])

  // 채팅 히스토리는 자동으로 로드하지 않음 (대화기록 탭에서만 조회)

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const fetchAgent = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}`)
      if (!res.ok) throw new Error('에이전트를 불러오는데 실패했습니다')
      const data = await res.json()
      setAgent(data)
    } catch (error) {
      console.error('Agent fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 채팅 히스토리 불러오기
  const fetchChatHistory = async () => {
    try {
      console.log('[ChatHistory] Fetching history for agent:', agentId)
      const res = await fetch(`/api/agents/${agentId}/history`)
      if (res.ok) {
        const { data } = await res.json()
        console.log('[ChatHistory] Loaded messages:', data?.length || 0)
        if (data && data.length > 0) {
          const loadedMessages = data.map((msg: any) => ({
            id: msg.id,
            role: msg.role as 'user' | 'agent',
            content: msg.content,
            timestamp: new Date(msg.created_at),
            image: msg.image_url || undefined,
            emotion: msg.emotion as EmotionType | undefined,
          }))
          setChatMessages(loadedMessages)
        }
      } else {
        console.error('[ChatHistory] Failed to fetch:', res.status)
      }
    } catch (err) {
      console.error('Chat history fetch error:', err)
    } finally {
      setHistoryLoaded(true)
    }
  }

  // 메시지를 히스토리에 저장
  const saveMessageToHistory = async (role: 'user' | 'agent', content: string, imageUrl?: string, emotion?: string) => {
    try {
      console.log('[ChatHistory] Saving message:', { role, content: content.substring(0, 50) + '...' })
      const res = await fetch(`/api/agents/${agentId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          image_url: imageUrl,
          emotion,
        }),
      })
      if (res.ok) {
        console.log('[ChatHistory] Message saved successfully')
      } else {
        console.error('[ChatHistory] Failed to save:', res.status, await res.text())
      }
    } catch (err) {
      console.error('Save message error:', err)
    }
  }

  const handleToggleStatus = async () => {
    if (!agent) return
    const newStatus: AgentStatus = agent.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setAgent({ ...agent, status: newStatus })
      }
    } catch (err) {
      console.error('Status toggle error:', err)
    }
  }

  // 이모티콘 라이브러리 불러오기
  const fetchEmoticons = async () => {
    try {
      setEmoticonsLoading(true)
      const res = await fetch('/api/emoticons')
      if (res.ok) {
        const { data } = await res.json()
        // image_urls가 없는 경우 image_url로 대체
        const processed = (data || []).map((e: any) => ({
          ...e,
          image_urls: e.image_urls?.length > 0 ? e.image_urls : (e.image_url ? [e.image_url] : []),
        }))
        setEmoticons(processed)
      }
    } catch (err) {
      console.error('Emoticons fetch error:', err)
    } finally {
      setEmoticonsLoading(false)
    }
  }

  // 🔥 이모티콘은 채팅 탭에서만 lazy load (초기 로딩 최적화)
  useEffect(() => {
    if (activeTab === 'chat' && emoticons.length === 0) {
      fetchEmoticons()
    }
  }, [activeTab])

  useEffect(() => {
    if (showEmoticonModal && emoticons.length === 0) {
      fetchEmoticons()
    }
  }, [showEmoticonModal])

  // 이모티콘 선택 시 채팅에 전송
  const handleSelectEmoticon = (emoticon: { image_url: string; name: string }) => {
    // 이모티콘 이미지를 채팅 메시지로 전송
    const emoticonMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: '',
      timestamp: new Date(),
      image: emoticon.image_url,
    }
    setChatMessages((prev) => [...prev, emoticonMessage])
    setShowEmoticonModal(false)
  }

  // 키워드로 매칭되는 이모티콘 찾기 및 랜덤 선택
  const findMatchingEmoticons = (message: string): typeof emoticons => {
    if (!message || emoticons.length === 0) return []

    const messageLower = message.toLowerCase()
    const matchingEmoticons = emoticons.filter(emoticon => {
      if (!emoticon.keywords || emoticon.keywords.length === 0) return false
      return emoticon.keywords.some(keyword =>
        messageLower.includes(keyword.toLowerCase())
      )
    })

    return matchingEmoticons
  }

  // 랜덤으로 이모티콘 하나 선택
  const selectRandomEmoticon = (matchingEmoticons: typeof emoticons): typeof emoticons[0] | null => {
    if (matchingEmoticons.length === 0) return null
    const randomIndex = Math.floor(Math.random() * matchingEmoticons.length)
    return matchingEmoticons[randomIndex]
  }

  // 메시지에서 키워드 감지하고 이모티콘 자동 전송
  const sendKeywordEmoticon = (message: string): boolean => {
    const matchingEmoticons = findMatchingEmoticons(message)
    const selectedEmoticon = selectRandomEmoticon(matchingEmoticons)

    if (selectedEmoticon) {
      // 카드 내 이미지 중 랜덤 선택
      const imageUrls = selectedEmoticon.image_urls?.length > 0
        ? selectedEmoticon.image_urls
        : [selectedEmoticon.image_url]
      const randomImageIndex = Math.floor(Math.random() * imageUrls.length)
      const selectedImage = imageUrls[randomImageIndex]

      // 약간의 딜레이 후 이모티콘 메시지 추가
      setTimeout(() => {
        const emoticonMessage = {
          id: `emoticon-${Date.now()}`,
          role: 'user' as const,
          content: '',
          timestamp: new Date(),
          image: selectedImage,
        }
        setChatMessages((prev) => [...prev, emoticonMessage])
      }, 100)
      return true
    }
    return false
  }

  // 에이전트 로드 시 감정 아바타 및 커스텀 감정 설정
  useEffect(() => {
    if (agent?.emotion_avatars) {
      setEmotionAvatars(agent.emotion_avatars as EmotionAvatars)
    }
    if (agent?.custom_emotions) {
      setCustomEmotions(agent.custom_emotions as CustomEmotion[])
    }
    if ((agent as any)?.chat_main_gif) {
      setChatMainGif((agent as any).chat_main_gif)
    }
  }, [agent?.emotion_avatars, agent?.custom_emotions, (agent as any)?.chat_main_gif])

  // 감정 GIF 재생 후 기본 감정으로 복귀 (3초 후)
  useEffect(() => {
    if (currentEmotion !== 'neutral') {
      const timer = setTimeout(() => {
        setCurrentEmotion('neutral')
      }, 3000) // 3초 후 기본 감정으로 복귀

      return () => clearTimeout(timer)
    }
  }, [currentEmotion])

  // 모든 감정 목록 (기본 + 커스텀, 수정된 키워드 적용) - 메모이제이션으로 불필요한 재계산 방지
  const allEmotions = useMemo<CustomEmotion[]>(() => [
    // 기본 감정: customEmotions에 오버라이드가 있으면 그것을 사용
    ...DEFAULT_EMOTIONS.map(defaultE => {
      const override = customEmotions.find(c => c.id === defaultE.id && c.isDefault)
      return override ? { ...override } : { ...defaultE, keywords: [...defaultE.keywords] }
    }),
    // 커스텀 감정 (기본 감정 오버라이드 제외)
    ...customEmotions.filter(e => !e.isDefault),
  ], [customEmotions])

  // 🔧 Voice Call Hook (xAI Grok Realtime API)
  const voiceCall = useGrokVoiceCall({
    agent: agent as any,
    allEmotions,
    onMessageAdd: (message) => setChatMessages(prev => [...prev, message]),
    onEmotionChange: setCurrentEmotion,
    saveMessageToHistory: (role, content) => saveMessageToHistory(role, content),
    setVoiceCallActive,
  })
  const {
    isVoiceCallActive,
    isVoiceConnecting,
    useGeminiVoice,
    isMuted,
    isListening,
    isAgentSpeaking,
    previewingVoice,
    startVoiceCall,
    endVoiceCall,
    toggleMute,
    setMuted,
    previewVoice,
    stopVoicePreview,
    sendTextDuringCall,
  } = voiceCall

  // 감정 아바타 업로드 (최대 4개까지 추가)
  const handleEmotionAvatarUpload = async (emotionId: string, file: File) => {
    if (!agent) return

    // 현재 이미지 배열 가져오기
    const currentData = emotionAvatars[emotionId]
    const currentUrls: string[] = currentData
      ? (Array.isArray(currentData) ? currentData : [currentData])
      : []

    // 4개 제한 체크
    if (currentUrls.length >= 4) {
      alert('감정당 최대 4개의 GIF만 등록 가능합니다. 기존 이미지를 삭제하고 추가하세요.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 크기는 10MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    setUploadingEmotion(emotionId)

    try {
      const supabase = createClient()

      // 파일 확장자 결정
      const ext = file.type === 'image/gif' ? 'gif' : file.type === 'image/png' ? 'png' : 'jpg'
      const fileName = `emotion-${agent.id}-${emotionId}-${Date.now()}.${ext}`

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      // Public URL 가져오기
      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName)
      const url = urlData.publicUrl

      // 기존 배열에 새 URL 추가 (최대 4개)
      const newUrls = [...currentUrls, url].slice(0, 4)
      const newEmotionAvatars = { ...emotionAvatars, [emotionId]: newUrls }

      // 에이전트 데이터 업데이트
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion_avatars: newEmotionAvatars }),
      })

      if (!res.ok) throw new Error('에이전트 업데이트 실패')

      // 로컬 상태 업데이트
      setEmotionAvatars(newEmotionAvatars)
      setAgent({ ...agent, emotion_avatars: newEmotionAvatars })
    } catch (err: any) {
      console.error('Emotion avatar upload error:', err)
      alert(err.message || '업로드 실패')
    } finally {
      setUploadingEmotion(null)
    }
  }

  // 감정 아바타 삭제
  const handleEmotionAvatarDelete = async (emotionId: string) => {
    if (!agent || !emotionAvatars[emotionId]) return

    if (!confirm('이 감정 이미지를 삭제하시겠습니까?')) return

    try {
      const newEmotionAvatars = { ...emotionAvatars }
      delete newEmotionAvatars[emotionId]

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotion_avatars: newEmotionAvatars }),
      })

      if (res.ok) {
        setEmotionAvatars(newEmotionAvatars)
      }
    } catch (err) {
      console.error('Emotion avatar delete error:', err)
    }
  }

  // 감정 이미지 업로드 핸들러 (이벤트에서 파일 추출)
  const handleEmotionImageUpload = (emotionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleEmotionAvatarUpload(emotionId, file)
    }
  }

  // 감정 키워드 업데이트
  const handleUpdateEmotionKeywords = async (emotionId: string, newKeywords: string[]) => {
    if (!agent) return

    // 기본 감정인지 확인
    const isDefaultEmotion = DEFAULT_EMOTIONS.some(e => e.id === emotionId)
    const existsInCustom = customEmotions.some(e => e.id === emotionId)

    let newCustomEmotions: CustomEmotion[]

    if (isDefaultEmotion && !existsInCustom) {
      // 기본 감정을 처음 수정하는 경우 - customEmotions에 오버라이드 추가
      const defaultEmotion = DEFAULT_EMOTIONS.find(e => e.id === emotionId)
      if (!defaultEmotion) return
      newCustomEmotions = [...customEmotions, {
        id: emotionId,
        name: defaultEmotion.label,
        label: defaultEmotion.label,
        emoji: defaultEmotion.emoji,
        keywords: newKeywords,
        isDefault: true
      }]
    } else if (existsInCustom) {
      // 이미 customEmotions에 있는 경우 - 키워드만 업데이트
      newCustomEmotions = customEmotions.map(e =>
        e.id === emotionId ? { ...e, keywords: newKeywords } : e
      )
    } else {
      return // 해당 감정이 없음
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_emotions: newCustomEmotions }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setAgent({ ...agent, custom_emotions: newCustomEmotions })
      }
    } catch (err) {
      console.error('Update emotion keywords error:', err)
    }
  }

  // 채팅 메인 GIF 업로드
  const handleChatMainGifUpload = async (file: File) => {
    if (!agent) return

    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 크기는 10MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    setUploadingChatMainGif(true)

    try {
      const supabase = createClient()
      const fileName = `chat-main-${agent.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(`agents/${fileName}`, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(`agents/${fileName}`)
      const url = urlData.publicUrl

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_main_gif: url }),
      })

      if (!res.ok) throw new Error('에이전트 업데이트 실패')

      setChatMainGif(url)
      setAgent({ ...agent, chat_main_gif: url } as any)
    } catch (err: any) {
      console.error('Chat main GIF upload error:', err)
      alert(err.message || '업로드 실패')
    } finally {
      setUploadingChatMainGif(false)
    }
  }

  // 채팅 메인 GIF 삭제
  const handleChatMainGifDelete = async () => {
    if (!agent || !chatMainGif) return

    if (!confirm('채팅 메인 이미지를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_main_gif: null }),
      })

      if (res.ok) {
        setChatMainGif(null)
        setAgent({ ...agent, chat_main_gif: null } as any)
      }
    } catch (err) {
      console.error('Chat main GIF delete error:', err)
    }
  }

  // 커스텀 감정 추가
  const handleAddCustomEmotion = async () => {
    if (!agent) {
      alert('에이전트 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    if (!newEmotion.label?.trim()) {
      alert('감정 이름을 입력해주세요.')
      return
    }

    // 입력 중인 키워드도 자동 추가
    let finalKeywords = [...(newEmotion.keywords || [])]
    if (keywordInput.trim() && !finalKeywords.includes(keywordInput.trim())) {
      finalKeywords.push(keywordInput.trim())
    }

    // 키워드 필수 체크
    if (finalKeywords.length === 0) {
      alert('최소 1개의 키워드를 입력해주세요. (감정 감지에 사용됩니다)')
      return
    }

    const emotionId = `custom-${Date.now()}`
    const emotion: CustomEmotion = {
      id: emotionId,
      label: newEmotion.label.trim(),
      emoji: newEmotion.emoji?.trim() || '💭',
      description: newEmotion.description?.trim() || '',
      keywords: finalKeywords,
      isDefault: false,
    }

    const newCustomEmotions = [...customEmotions, emotion]

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_emotions: newCustomEmotions }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setAgent({ ...agent, custom_emotions: newCustomEmotions })
        setNewEmotion({ label: '', emoji: '', description: '', keywords: [] })
        setKeywordInput('')
        setShowAddEmotionModal(false)
        alert('감정이 추가되었습니다!')
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error('API error:', res.status, errorData)
        alert(`감정 추가 실패: ${errorData.error || res.statusText}`)
      }
    } catch (err) {
      console.error('Add custom emotion error:', err)
      alert('감정 추가 중 오류가 발생했습니다.')
    }
  }

  // 감정 수정 (기본 감정 + 커스텀 감정 모두 지원)
  const handleUpdateCustomEmotion = async () => {
    if (!agent || !editingEmotion) return

    let newCustomEmotions: CustomEmotion[]

    // 기본 감정인 경우: customEmotions에 오버라이드로 추가
    const isDefaultEmotion = DEFAULT_EMOTIONS.some(e => e.id === editingEmotion.id)
    const existsInCustom = customEmotions.some(e => e.id === editingEmotion.id)

    if (isDefaultEmotion && !existsInCustom) {
      // 기본 감정을 처음 수정하는 경우 - customEmotions에 추가
      newCustomEmotions = [...customEmotions, { ...editingEmotion, isDefault: true }]
    } else {
      // 이미 customEmotions에 있는 경우 - 업데이트
      newCustomEmotions = customEmotions.map(e =>
        e.id === editingEmotion.id ? editingEmotion : e
      )
    }

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_emotions: newCustomEmotions }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setAgent({ ...agent, custom_emotions: newCustomEmotions })
        setEditingEmotion(null)
      }
    } catch (err) {
      console.error('Update emotion error:', err)
      alert('감정 수정 실패')
    }
  }

  // 커스텀 감정 삭제
  const handleDeleteCustomEmotion = async (emotionId: string) => {
    if (!agent) return

    // 기본 감정은 삭제 불가
    if (DEFAULT_EMOTIONS.some(e => e.id === emotionId)) {
      alert('기본 감정은 삭제할 수 없습니다.')
      return
    }

    if (!confirm('이 감정을 삭제하시겠습니까? 관련된 이미지도 함께 삭제됩니다.')) return

    const newCustomEmotions = customEmotions.filter(e => e.id !== emotionId)
    const newEmotionAvatars = { ...emotionAvatars }
    delete newEmotionAvatars[emotionId]

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_emotions: newCustomEmotions,
          emotion_avatars: newEmotionAvatars,
        }),
      })

      if (res.ok) {
        setCustomEmotions(newCustomEmotions)
        setEmotionAvatars(newEmotionAvatars)
        setAgent({ ...agent, custom_emotions: newCustomEmotions, emotion_avatars: newEmotionAvatars })
      }
    } catch (err) {
      console.error('Delete custom emotion error:', err)
      alert('감정 삭제 실패')
    }
  }

  // 메시지 모달에서 전송
  const handleSendModalMessage = async () => {
    if (!modalMessage.trim() || !agent || chatLoading) return

    const messageToSend = modalMessage.trim()
    setShowMessageModal(false)
    setModalMessage('')

    // 메시지 전송
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: messageToSend,
      timestamp: new Date(),
    }
    setChatMessages((prev) => [...prev, userMessage])
    saveMessageToHistory('user', messageToSend)
    setChatLoading(true)

    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          conversation_history: chatMessages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        let responseContent = data.response || '응답을 생성하지 못했습니다.'

        // 🚀 Autonomous Agent 액션 실행
        let modalCreatedProject: { id: string; name: string } | undefined = undefined

        if (data.actions && data.actions.length > 0) {
          try {
            // 🔥 Dynamic import to avoid bundling 2309줄 agent-actions.ts
            const { convertToolAction, executeActions, formatActionResultsForChat } = await getAgentActions()
            // 🔥 ToolAction → AgentAction 변환
            const agentActions = (data.actions as ToolAction[])
              .map((action) => convertToolAction(action))
              .filter((a): a is AgentAction => a !== null)

            const results = await executeActions(agentActions)
            const actionSummary = formatActionResultsForChat(results)
            if (actionSummary) {
              responseContent += '\n\n---\n**실행 결과:**\n' + actionSummary
            }

            // 🚀 프로젝트 생성 액션 감지
            const projectResult = results.find(r =>
              r.success && r.action.type === 'create_project' && r.result
            )
            if (projectResult && projectResult.result) {
              const projectData = (projectResult.result as { project?: { id: string; name: string } }).project
              if (projectData) {
                modalCreatedProject = { id: projectData.id, name: projectData.name }
              }
            }
          } catch (actionError) {
            console.error('[AgentChat] Action error:', actionError)
          }
        }

        const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
        const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'neutral'
        const agentMessage = {
          id: `agent-${Date.now()}`,
          role: 'agent' as const,
          content: responseContent,
          timestamp: new Date(),
          emotion: detectedEmotion,
          emotions: detectedEmotions,
          createdProject: modalCreatedProject,
        }
        setChatMessages((prev) => [...prev, agentMessage])
        setCurrentEmotion(detectedEmotion)
        saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)
      }
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setChatLoading(false)
      setChatTypingStatus('none')
    }
  }

  // 키워드 추가 (새 감정)
  const handleAddKeyword = (isEditing: boolean = false) => {
    if (!keywordInput.trim()) return

    if (isEditing && editingEmotion) {
      if (!editingEmotion.keywords.includes(keywordInput.trim())) {
        setEditingEmotion({
          ...editingEmotion,
          keywords: [...editingEmotion.keywords, keywordInput.trim()],
        })
      }
    } else {
      if (!newEmotion.keywords?.includes(keywordInput.trim())) {
        setNewEmotion({
          ...newEmotion,
          keywords: [...(newEmotion.keywords || []), keywordInput.trim()],
        })
      }
    }
    setKeywordInput('')
  }

  // 키워드 삭제 (새 감정)
  const handleRemoveKeyword = (keyword: string, isEditing: boolean = false) => {
    if (isEditing && editingEmotion) {
      setEditingEmotion({
        ...editingEmotion,
        keywords: editingEmotion.keywords.filter(k => k !== keyword),
      })
    } else {
      setNewEmotion({
        ...newEmotion,
        keywords: (newEmotion.keywords || []).filter(k => k !== keyword),
      })
    }
  }

  // 채팅 이미지 선택
  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 첨부할 수 있습니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setChatImage(event.target?.result as string)
      setChatImageFile(file)
    }
    reader.readAsDataURL(file)

    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = ''
    }
  }

  // 채팅 이미지 제거
  const handleRemoveChatImage = () => {
    setChatImage(null)
    setChatImageFile(null)
  }

  // 업무 지시 감지 (키워드 기반)
  const detectTaskIntent = (message: string): boolean => {
    const taskKeywords = [
      '해줘', '해 줘', '작성해', '분석해', '검색해', '찾아줘', '찾아 줘',
      '만들어', '정리해', '요약해', '알려줘', '알려 줘', '조사해',
      '번역해', '계산해', '비교해', '추천해', '설명해',
      // 영어 키워드도 추가
      'please', 'search', 'find', 'create', 'analyze', 'summarize',
    ]
    const lowerMessage = message.toLowerCase()
    return taskKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  // AI 기반 워크플로우 생성 (스킬 조합)
  const generateWorkflowSteps = async (instruction: string): Promise<{
    title: string
    steps: WorkflowStep[]
    matchedSkills: { id: string; name: string }[]
  }> => {
    try {
      const res = await fetch('/api/workflow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, useAI: true }),
      })

      const data = await res.json()

      if (data.success && data.workflow) {
        return {
          title: data.workflow.title,
          steps: data.workflow.steps.map((step: any) => ({
            ...step,
            status: 'pending' as const,
          })),
          matchedSkills: data.matchedSkills || [],
        }
      }
    } catch (error) {
      console.error('[Workflow] AI 워크플로우 생성 실패, 폴백 사용:', error)
    }

    // 폴백: 간단한 키워드 기반 단계 생성
    const steps: WorkflowStep[] = [
      {
        id: 'step-1',
        name: '업무 분석',
        description: '지시 내용을 분석합니다',
        type: 'ai',
        status: 'pending',
      },
    ]

    const lowerInstruction = instruction.toLowerCase()

    if (lowerInstruction.includes('유튜브') || lowerInstruction.includes('youtube')) {
      steps.push({
        id: 'step-youtube',
        name: 'YouTube 분석',
        description: '유튜브 영상 내용을 가져옵니다',
        type: 'tool',
        status: 'pending',
      })
    }

    if (lowerInstruction.includes('검색') || lowerInstruction.includes('찾아') || lowerInstruction.includes('조회')) {
      steps.push({
        id: 'step-search',
        name: '정보 검색',
        description: '관련 정보를 검색합니다',
        type: 'tool',
        status: 'pending',
      })
    }

    if (lowerInstruction.includes('요약') || lowerInstruction.includes('정리')) {
      steps.push({
        id: 'step-summarize',
        name: '내용 요약',
        description: '수집한 정보를 요약합니다',
        type: 'ai',
        status: 'pending',
      })
    }

    if (lowerInstruction.includes('ppt') || lowerInstruction.includes('슬라이드') || lowerInstruction.includes('발표')) {
      steps.push({
        id: 'step-ppt',
        name: 'PPT 생성',
        description: '프레젠테이션 슬라이드를 생성합니다',
        type: 'tool',
        status: 'pending',
      })
    }

    if (lowerInstruction.includes('이메일') || lowerInstruction.includes('메일')) {
      steps.push({
        id: 'step-email',
        name: '이메일 작성',
        description: '이메일을 작성합니다',
        type: 'tool',
        status: 'pending',
      })
    }

    if (lowerInstruction.includes('일정') || lowerInstruction.includes('캘린더') || lowerInstruction.includes('미팅')) {
      steps.push({
        id: 'step-calendar',
        name: '일정 확인/등록',
        description: '캘린더를 확인하거나 일정을 등록합니다',
        type: 'tool',
        status: 'pending',
      })
    }

    steps.push({
      id: 'step-final',
      name: '결과 정리',
      description: '실행 결과를 정리하여 보고합니다',
      type: 'ai',
      status: 'pending',
    })

    return {
      title: instruction.substring(0, 30) + (instruction.length > 30 ? '...' : ''),
      steps,
      matchedSkills: [],
    }
  }

  // 워크플로우 단계 업데이트 헬퍼
  const updateWorkflowStep = (
    workflowMsgId: string,
    stepId: string,
    update: Partial<WorkflowStep>
  ) => {
    setChatMessages(prev => prev.map(msg => {
      if (msg.id === workflowMsgId && msg.workflow) {
        return {
          ...msg,
          workflow: {
            ...msg.workflow,
            steps: msg.workflow.steps.map(step =>
              step.id === stepId ? { ...step, ...update } : step
            ),
          },
        }
      }
      return msg
    }))
  }

  // 스킬별 파라미터 구성
  const buildSkillParams = (skillId: string, context: Record<string, any>): Record<string, any> => {
    switch (skillId) {
      case 'youtube-transcript':
        return { url: context.url, lang: 'ko' }
      case 'summarize':
        return { text: context.transcript || context.content || context.instruction, maxLength: 500 }
      case 'ppt-generator':
        return {
          content: context.summary || context.transcript || context.instruction,
          slideCount: 5,
          theme: 'modern',
          generateImages: false, // rate limit 방지
        }
      case 'web-search':
        return { query: context.instruction }
      case 'data-analysis':
        return { data: context.summary || context.transcript || context.instruction }
      case 'translate':
        return { text: context.summary || context.transcript, targetLang: 'ko' }
      default:
        return context
    }
  }

  // 최종 결과 생성
  const generateFinalOutput = (context: Record<string, any>): string => {
    const parts: string[] = []

    if (context.summary) {
      parts.push('📝 **요약**')
      parts.push(context.summary)
      parts.push('')
    }

    if (context.presentation) {
      parts.push('📊 **PPT 슬라이드**')
      if (context.downloadUrl) {
        parts.push(`\n🔗 **[PPTX 다운로드](${context.downloadUrl})**`)
      }
      const slides = context.presentation.slides || []
      slides.forEach((slide: any, i: number) => {
        parts.push(`\n**슬라이드 ${i + 1}: ${slide.title}**`)
        if (slide.content && slide.content.length > 0) {
          slide.content.forEach((item: string) => parts.push(`• ${item}`))
        }
      })
      parts.push('')
    }

    if (context.transcript && !context.summary) {
      parts.push('📄 **트랜스크립트**')
      parts.push(context.transcript.substring(0, 1000) + (context.transcript.length > 1000 ? '...' : ''))
    }

    if (parts.length === 0) {
      parts.push('✅ 워크플로우가 완료되었습니다.')
      parts.push(`\n원본 지시: ${context.instruction}`)
    }

    return parts.join('\n')
  }

  // 업무 실행 (실제 SuperAgent 모드로 동작)
  const executeTask = async (messageId: string, instruction: string) => {
    if (!agent) return

    const workflowMsgId = `workflow-${Date.now()}`

    // 상태를 running으로 변경
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, taskStatus: 'running' as const } : msg
    ))

    // 워크플로우 시각화 메시지 추가 (실제 진행 상황만 표시)
    const workflowSteps: WorkflowStep[] = [
      {
        id: 'step-execute',
        name: '작업 실행',
        description: 'AI가 요청을 처리합니다',
        type: 'ai',
        status: 'running',
        startedAt: new Date().toISOString(),
      },
    ]

    const loadingMessage = {
      id: workflowMsgId,
      role: 'agent' as const,
      content: '',  // 젠스파크 스타일: 도구 사용만 표시, 텍스트 없음
      timestamp: new Date(),
      workflow: {
        title: instruction.substring(0, 50) + (instruction.length > 50 ? '...' : ''),
        steps: workflowSteps,
      },
    }
    setChatMessages(prev => [...prev, loadingMessage])

    try {

      // 🚀 실제 Amy Chat API 호출 (SuperAgent 모드)
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: instruction,
          conversation_history: chatMessages.slice(-10).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      })

      if (!res.ok) {
        throw new Error(`API 오류: ${res.status}`)
      }

      const data = await res.json()
      let responseContent = data.response || '응답을 생성하지 못했습니다.'
      const toolsUsed: string[] = data.toolsUsed || []
      let createdProjectInfo: { id: string; name: string } | undefined = undefined

      // SuperAgent 모드에서는 서버에서 이미 도구가 실행됨
      // actions는 실행된 결과의 기록이므로, 클라이언트에서 중복 실행하지 않음
      if (data.superAgentMode && data.actions && data.actions.length > 0) {
        console.log('[TaskMode] 🤖 SuperAgent mode - actions already executed on server:', data.actions.length)

        // 프로젝트 생성 감지 (이미 실행된 결과에서 추출)
        const projectAction = (data.actions as ToolAction[]).find(
          (action) => action.type === 'create_project' && action.data?.projectId
        )
        if (projectAction && projectAction.data) {
          createdProjectInfo = {
            id: projectAction.data.projectId as string,
            name: (projectAction.data.name as string) || '프로젝트',
          }
          console.log('[TaskMode] ✅ Project detected from server response:', createdProjectInfo)
        }

      } else if (data.actions && data.actions.length > 0) {
        // 일반 모드에서는 클라이언트에서 액션 실행
        console.log('[TaskMode] 🤖 Executing actions on client:', data.actions.length)

        try {
          // 🔥 Dynamic import to avoid bundling 2309줄 agent-actions.ts
          const { convertToolAction, executeActions, formatActionResultsForChat } = await getAgentActions()
          const agentActions = (data.actions as ToolAction[])
            .map((action) => convertToolAction(action))
            .filter((a): a is AgentAction => a !== null)

          const results = await executeActions(agentActions)
          const actionSummary = formatActionResultsForChat(results)

          if (actionSummary) {
            responseContent += '\n\n---\n**실행 결과:**\n' + actionSummary
          }

          // 프로젝트 생성 감지
          const projectResult = results.find(r =>
            r.success && r.action.type === 'create_project' && r.result
          )
          if (projectResult && projectResult.result) {
            const projectData = (projectResult.result as { project?: { id: string; name: string } }).project
            if (projectData) {
              createdProjectInfo = { id: projectData.id, name: projectData.name }
            }
          }

          // 실행된 도구 추가
          results.forEach(r => {
            if (r.success && !toolsUsed.includes(r.action.type)) {
              toolsUsed.push(r.action.type)
            }
          })

          console.log('[TaskMode] ✅ Actions executed:', results.filter(r => r.success).length, 'succeeded')
        } catch (actionError) {
          console.error('[TaskMode] ❌ Action error:', actionError)
          responseContent += '\n\n⚠️ 일부 작업 실행 중 오류가 발생했습니다.'
        }
      }

      // 작업 실행 완료 (실제 API 응답 후)
      updateWorkflowStep(workflowMsgId, 'step-execute', {
        status: 'completed',
        result: toolsUsed.length > 0 ? `사용된 도구: ${toolsUsed.join(', ')}` : '완료',
        completedAt: new Date().toISOString(),
      })

      // 원본 메시지 상태 업데이트
      setChatMessages(prev => prev.map(msg =>
        msg.id === messageId ? {
          ...msg,
          taskStatus: 'completed' as const,
          taskResult: {
            output: responseContent,
            sources: [],
            toolsUsed,
          },
        } : msg
      ))

      // 워크플로우 메시지 내용 업데이트 (젠스파크 스타일: 텍스트 없이 도구 사용만 표시)
      setChatMessages(prev => prev.map(msg =>
        msg.id === workflowMsgId ? {
          ...msg,
          content: '',
        } : msg
      ))

      // 실행 결과를 별도 메시지로 추가
      const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
      const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'happy'

      const resultMessage = {
        id: `result-${Date.now()}`,
        role: 'agent' as const,
        content: responseContent,
        timestamp: new Date(),
        emotion: detectedEmotion,
        emotions: detectedEmotions,
        createdProject: createdProjectInfo, // 프로젝트 확인 버튼용
      }
      setChatMessages(prev => [...prev, resultMessage])
      saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)

    } catch (error) {
      console.error('[TaskMode] Error:', error)

      // 워크플로우 실패 표시
      setChatMessages(prev => prev.map(msg => {
        if (msg.id === workflowMsgId && msg.workflow) {
          return {
            ...msg,
            content: '❌ 업무 실행 중 오류가 발생했습니다.',
            workflow: {
              ...msg.workflow,
              steps: msg.workflow.steps.map(step =>
                step.status === 'running' || step.status === 'pending'
                  ? { ...step, status: 'failed' as const, error: '실행 중단됨' }
                  : step
              ),
            },
          }
        }
        return msg
      }))

      setChatMessages(prev => prev.map(msg =>
        msg.id === messageId ? {
          ...msg,
          taskStatus: 'failed' as const,
          taskResult: {
            output: '',
            sources: [],
            toolsUsed: [],
            error: error instanceof Error ? error.message : '실행 실패',
          },
        } : msg
      ))

      // 에러 메시지 추가
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'agent' as const,
        content: `❌ 업무 실행 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
  }

  // 업무 지시 분석 요청
  const handleTaskInstruction = async () => {
    if (!chatInput.trim() || !agent) return

    const instruction = chatInput.trim()
    setChatInput('')

    // 사용자 메시지를 먼저 추가
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: `📋 [업무 지시] ${instruction}`,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMessage])

    // 🚀 모든 업무 지시는 SuperAgent 모드로 자동 실행 (분석 API 호출 없이 바로 실행)
    // 특수 액션(create_project 등)도 폼 없이 바로 워크플로우 실행
    await executeTask(userMessage.id, instruction)
  }

  // 업무 실행 승인
  const handleConfirmTask = async () => {
    if (!pendingTask || !agent) return

    setIsExecutingTask(true)

    try {
      const response = await fetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingTask.analysis.title,
          description: pendingTask.analysis.summary,
          instructions: pendingTask.original_instruction,
          assignee_agent_id: agent.id,
          auto_execute: true,
        }),
      })

      if (!response.ok) {
        throw new Error('업무 생성 실패')
      }

      const task = await response.json()

      // 결과 메시지 추가
      const resultMessage = {
        id: `task-result-${Date.now()}`,
        role: 'agent' as const,
        content: `✅ **업무 완료: ${pendingTask.analysis.title}**\n\n${task.result || '처리가 완료되었습니다.'}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, resultMessage])
      saveMessageToHistory('agent', resultMessage.content)

      setPendingTask(null)
      setIsTaskMode(false)
    } catch (error) {
      console.error('업무 실행 오류:', error)
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'agent' as const,
        content: '업무 실행 중 오류가 발생했습니다.',
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsExecutingTask(false)
    }
  }

  // 업무 취소
  const handleCancelTask = () => {
    setPendingTask(null)
    setIsTaskMode(false)
    // 취소 메시지 추가
    const cancelMessage = {
      id: `cancel-${Date.now()}`,
      role: 'agent' as const,
      content: '업무 지시를 취소했습니다. 다른 것을 도와드릴까요?',
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, cancelMessage])
  }

  // 특수 액션 실행 (프로젝트 생성 등)
  const handleConfirmAction = async () => {
    if (!pendingAction || !agent) return

    setIsExecutingAction(true)

    try {
      if (pendingAction.action_type === 'project_create') {
        // 필수 필드 검증
        if (!actionFormData.name?.trim()) {
          alert('프로젝트 이름을 입력해주세요.')
          setIsExecutingAction(false)
          return
        }

        // 프로젝트 생성 API 호출
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: actionFormData.name.trim(),
            description: actionFormData.description?.trim() || null,
            priority: actionFormData.priority || 'medium',
            deadline: actionFormData.deadline || null,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '프로젝트 생성 실패')
        }

        const project = await response.json()

        // 성공 메시지 (프로젝트 확인 버튼 포함)
        const successMessage = {
          id: `action-success-${Date.now()}`,
          role: 'agent' as const,
          content: `✅ 프로젝트를 생성했습니다!\n\n**${project.name}**\n${project.description ? `설명: ${project.description}\n` : ''}우선순위: ${project.priority}${project.deadline ? `\n마감일: ${project.deadline}` : ''}`,
          timestamp: new Date(),
          createdProject: {
            id: project.id,
            name: project.name,
          },
        }
        setChatMessages(prev => [...prev, successMessage])
        saveMessageToHistory('agent', successMessage.content)
      }

      // 상태 초기화
      setPendingAction(null)
      setActionFormData({})
      setIsTaskMode(false)
    } catch (error) {
      console.error('액션 실행 오류:', error)
      const errorMessage = {
        id: `error-${Date.now()}`,
        role: 'agent' as const,
        content: `작업 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsExecutingAction(false)
    }
  }

  // 액션 취소
  const handleCancelAction = () => {
    setPendingAction(null)
    setActionFormData({})
    setIsTaskMode(false)
    const cancelMessage = {
      id: `cancel-${Date.now()}`,
      role: 'agent' as const,
      content: '작업을 취소했습니다. 다른 것을 도와드릴까요?',
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, cancelMessage])
  }

  // 액션 폼 필드 변경
  const handleActionFormChange = (fieldName: string, value: string) => {
    setActionFormData(prev => ({ ...prev, [fieldName]: value }))
  }


  // ========== Tool Functions (도구 버튼) ==========

  // 이미지 생성 도구 - Z-Image API (Replicate) 직접 호출
  const handleGenerateImage = async (prompt: string) => {
    if (!prompt.trim() || !agent || isGeneratingImage) return

    setIsGeneratingImage(true)
    setChatInput('') // 채팅 입력창 클리어

    // 사용자 메시지 추가
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: `🎨 이미지 생성: ${prompt}`,
      timestamp: new Date(),
    }
    setChatMessages((prev) => [...prev, userMessage])

    // AI 생성 중 메시지 추가
    const aiMessageId = `agent-${Date.now()}`
    const loadingMessage = {
      id: aiMessageId,
      role: 'agent' as const,
      content: '🖼️ Z-Image로 이미지를 생성하고 있어요... (약 5-10초 소요)',
      timestamp: new Date(),
    }
    setChatMessages((prev) => [...prev, loadingMessage])

    try {
      const response = await fetch('/api/skills/z-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_inference_steps: 8, // 초고속 생성
        }),
      })

      const data = await response.json()

      if (data.success && data.image_url) {
        // 성공: 이미지 URL과 함께 메시지 업데이트
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: `✨ "${prompt}" 이미지가 완성되었어요! (${data.metadata?.generation_time_ms || 0}ms)`,
                  image: data.image_url,
                }
              : msg
          )
        )
      } else {
        // 실패: 에러 메시지
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? {
                  ...msg,
                  content: `❌ 이미지 생성에 실패했어요: ${data.error || '알 수 없는 오류'}`,
                }
              : msg
          )
        )
      }
    } catch (error) {
      console.error('Image generation error:', error)
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: `❌ 이미지 생성 중 오류가 발생했어요: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
              }
            : msg
        )
      )
    } finally {
      setIsGeneratingImage(false)
      setSelectedTool('chat') // 이미지 생성 후 채팅 모드로 복귀
    }
  }

  // ========== End Tool Functions ==========

  // 채팅 메시지 전송
  const handleSendChat = async () => {
    if ((!chatInput.trim() && !chatImage) || !agent || chatLoading) return

    const messageContent = chatInput.trim() || (chatImage ? '[이미지]' : '')
    const isTask = detectTaskIntent(messageContent)

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      content: messageContent,
      timestamp: new Date(),
      image: chatImage || undefined,
      // 업무 지시인 경우 플래그 추가 (자동 실행)
      ...(isTask && { isTask: true, taskStatus: 'running' as const }),
    }

    setChatMessages((prev) => [...prev, userMessage])

    // 업무 지시인 경우 자동 실행 (워크플로우 모드)
    if (isTask) {
      setChatInput('')  // 🔥 입력창 즉시 클리어
      setChatImage(null)
      setChatImageFile(null)
      executeTask(userMessage.id, messageContent)
      // 워크플로우 실행 시 일반 채팅 API 호출하지 않음
      return
    }

    // 사용자 메시지 히스토리에 저장
    saveMessageToHistory('user', userMessage.content, userMessage.image)

    // 키워드 감지하여 이모티콘 자동 전송
    sendKeywordEmoticon(messageContent)

    // 사용자 입력에서 감정 감지 (즉시 반영)
    const userEmotion = detectEmotion(userMessage.content, allEmotions)
    if (userEmotion !== 'neutral') {
      setCurrentEmotion(userEmotion)
    }

    const sentImage = chatImage
    setChatInput('')
    setChatImage(null)
    setChatImageFile(null)

    // 🔥 음성통화 중이면 WebSocket으로 전송 (음성 API 사용)
    if (sendTextDuringCall(messageContent)) {
      return  // 음성모드에서는 여기서 끝 - 응답은 WebSocket 이벤트로 처리됨
    }

    // 텍스트 채팅 모드 - 기존 HTTP API 사용 (음성 API 비용 없음)
    // 자연스러운 딜레이: 먼저 "읽음" 표시, 랜덤 시간 후 "입력중" 표시
    setChatTypingStatus('read')

    // 1~3초 랜덤 딜레이 후 "입력중" 표시
    const thinkingDelay = 1000 + Math.random() * 2000
    await new Promise(resolve => setTimeout(resolve, thinkingDelay))

    setChatTypingStatus('typing')
    setChatLoading(true)

    try {
      // 이미지가 있으면 이미지를 API에 전달
      let messageContent = userMessage.content
      if (sentImage && !userMessage.content) {
        messageContent = '이 이미지에 대해 말해줘'
      }

      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          conversation_history: chatMessages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
          // 이미지가 있으면 API에 전달 (비전 모델이 처리)
          images: sentImage ? [sentImage] : [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        let responseContent = data.response || '응답을 생성하지 못했습니다.'

        // 🚀 Autonomous Agent 액션 실행
        let createdProjectInfo: { id: string; name: string } | undefined = undefined

        if (data.actions && data.actions.length > 0) {
          console.log('[AgentChat] 🤖 Executing autonomous actions:', data.actions.length)

          try {
            // 🔥 Dynamic import to avoid bundling 2309줄 agent-actions.ts
            const { convertToolAction, executeActions, formatActionResultsForChat } = await getAgentActions()
            // 🔥 ToolAction → AgentAction 변환 (autonomous agent는 ToolAction 형태로 반환)
            const agentActions = (data.actions as ToolAction[])
              .map((action) => convertToolAction(action))
              .filter((a): a is AgentAction => a !== null)

            console.log('[AgentChat] 📦 Converted actions:', agentActions.length)
            const results = await executeActions(agentActions)
            const actionSummary = formatActionResultsForChat(results)

            // 액션 결과를 응답에 추가
            if (actionSummary) {
              responseContent += '\n\n---\n**실행 결과:**\n' + actionSummary
            }

            // 🚀 프로젝트 생성 액션 감지 (프로젝트 확인 버튼용)
            const projectResult = results.find(r =>
              r.success && r.action.type === 'create_project' && r.result
            )
            if (projectResult && projectResult.result) {
              const projectData = (projectResult.result as { project?: { id: string; name: string } }).project
              if (projectData) {
                createdProjectInfo = { id: projectData.id, name: projectData.name }
                console.log('[AgentChat] 📂 Project created:', createdProjectInfo.name)
              }
            }

            console.log('[AgentChat] ✅ Actions executed:', results.filter(r => r.success).length, 'succeeded')
          } catch (actionError) {
            console.error('[AgentChat] ❌ Action execution error:', actionError)
            responseContent += '\n\n⚠️ 일부 작업 실행 중 오류가 발생했습니다.'
          }
        }

        // 프로젝트 생성 등 특수 액션 감지
        if (data.action_type && data.requires_confirmation) {
          // 에이전트 응답 메시지 먼저 표시
          const agentMessage = {
            id: `agent-${Date.now()}`,
            role: 'agent' as const,
            content: responseContent,
            timestamp: new Date(),
          }
          setChatMessages((prev) => [...prev, agentMessage])

          // 폼 초기값 설정
          const initialFormData: Record<string, string> = {}
          if (data.extracted_data?.suggestedName) {
            initialFormData.name = data.extracted_data.suggestedName
          }
          setActionFormData(initialFormData)

          // pendingAction 설정 (컨펌 폼 표시)
          setPendingAction({
            action_type: data.action_type,
            confirmation_message: responseContent,
            input_fields: data.input_fields || [],
            extracted_data: data.extracted_data,
          })
        } else {
          // 일반 응답 처리
          const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
          const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'neutral'

          const agentMessage = {
            id: `agent-${Date.now()}`,
            role: 'agent' as const,
            content: responseContent,
            timestamp: new Date(),
            emotion: detectedEmotion, // 하위 호환성
            emotions: detectedEmotions, // 다중 감정 (텍스트 순서)
            knowledgeSources: data.knowledgeSources, // 📚 지식베이스 출처
            createdProject: createdProjectInfo, // 🚀 생성된 프로젝트 정보 (버튼 표시용)
          }
          setChatMessages((prev) => [...prev, agentMessage])
          setCurrentEmotion(detectedEmotion)

          // 에이전트 응답 히스토리에 저장
          saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)
        }
      } else {
        // 에러 응답 처리 - JSON 파싱 실패 대비
        let errorMessage = '응답 실패'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch {
          errorMessage = `서버 오류 (${res.status})`
        }
        setChatMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'agent' as const,
            content: `오류: ${errorMessage}`,
            timestamp: new Date(),
          },
        ])
      }
    } catch (err: any) {
      console.error('Chat error:', err)
      const errorDetail = err?.message || '알 수 없는 오류'
      setChatMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'agent' as const,
          content: `네트워크 오류: ${errorDetail}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setChatLoading(false)
      setChatTypingStatus('none')
      // 메시지 전송 후 입력창에 포커스 유지
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }

  // 섹션 편집 시작
  const startEditing = (section: string, initialData: any) => {
    setEditingSection(section)
    setEditForm(initialData)
  }

  // 섹션 편집 취소
  const cancelEditing = () => {
    setEditingSection(null)
    setEditForm({})
  }

  // 섹션 저장
  const saveSection = async (section: string) => {
    if (!agent) return
    setSaving(true)

    try {
      let updateData: any = {}

      switch (section) {
        case 'basic':
          updateData = {
            name: editForm.name,
            description: editForm.description,
            job_title: editForm.job_title || null,
          }
          break
        case 'identity':
          updateData = {
            identity: {
              core_values: editForm.core_values || [],
              personality_traits: editForm.personality_traits || [],
              communication_style: editForm.communication_style || '',
              strengths: editForm.strengths || [],
              growth_areas: editForm.growth_areas || [],
              self_summary: editForm.self_summary || '',
              working_style: editForm.working_style || '',
              recent_focus: editForm.recent_focus || '',
            },
          }
          break
        case 'llm':
          updateData = {
            llm_provider: editForm.llm_provider,
            model: editForm.model,
            temperature: parseFloat(editForm.temperature) || 0.7,
          }
          break
        case 'prompt_sections':
          // 8섹션 프롬프트를 JSONB로 저장
          updateData = {
            prompt_sections: {
              work_operating_model: editForm.work_operating_model || '',
              human_communication: editForm.human_communication || '',
              professional_habits: editForm.professional_habits || '',
              no_hallucination: editForm.no_hallucination || '',
              collaboration_conflict: editForm.collaboration_conflict || '',
              deliverable_templates: editForm.deliverable_templates || '',
              context_anchor: editForm.context_anchor || '',
              response_format: editForm.response_format || '',
              messenger_rules: editForm.messenger_rules || '',
            },
          }
          break
        case 'capabilities':
          updateData = {
            capabilities: editForm.capabilities || [],
          }
          break
        case 'voice_settings':
          updateData = {
            voice_settings: {
              voice: editForm.voice || 'sol',
              conversation_style: editForm.conversation_style || 'friendly',
              vad_sensitivity: editForm.vad_sensitivity || 'medium',
            },
          }
          break
      }

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) throw new Error('저장 실패')

      const updatedAgent = await res.json()
      setAgent({ ...agent, ...updatedAgent })
      cancelEditing()
    } catch (error) {
      console.error('Save error:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // Prevent hydration mismatch - show simple loading until mounted
  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-zinc-950 z-50">
        {/* Neural Network Loading Animation */}
        <div className="relative w-32 h-32">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 border-r-purple-500 animate-spin" style={{ animationDuration: '2s' }} />

          {/* Middle pulsing ring */}
          <div className="absolute inset-2 rounded-full border border-cyan-500/30 animate-pulse" />

          {/* Inner core */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-600/20 backdrop-blur-sm flex items-center justify-center">
            {/* Central Brain Icon */}
            <div className="relative">
              <Brain className="w-10 h-10 text-cyan-400 animate-pulse" />
              {/* Sparkle effects */}
              <Sparkles className="absolute -top-2 -right-2 w-4 h-4 text-purple-400 animate-ping" style={{ animationDuration: '1.5s' }} />
              <Zap className="absolute -bottom-1 -left-2 w-3 h-3 text-cyan-300 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            </div>
          </div>

          {/* Floating particles */}
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan]" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDelay: '1.3s', animationDirection: 'reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_10px_purple]" />
          </div>
          <div className="absolute inset-0 animate-spin" style={{ animationDuration: '4s', animationDelay: '2.6s' }}>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full shadow-[0_0_10px_pink]" />
          </div>
        </div>

        {/* Loading text */}
        <div className="flex flex-col items-center gap-3">
          <p className="text-base font-medium bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            에이전트 로딩 중
          </p>
          <div className="flex gap-1.5">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce shadow-[0_0_8px_cyan]" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce shadow-[0_0_8px_purple]" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce shadow-[0_0_8px_pink]" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-400">
        <Bot className="w-12 h-12 mb-4" />
        <p>에이전트를 찾을 수 없습니다</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    )
  }

  const status = statusConfig[agent.status] || statusConfig.INACTIVE
  const providerInfo = PROVIDER_INFO[(agent.llm_provider || 'ollama') as LLMProvider]

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-6 h-[calc(100vh-120px)] overflow-hidden">
      {/* Back Button - Mobile */}
      <div className="lg:hidden flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로가기
        </Button>
      </div>

      {/* Left Sidebar - Agent Profile */}
      <AgentProfileSidebar
        agent={agent as any}
        setAgent={setAgent as any}
        isDark={isDark}
        mounted={mounted}
        userAccentColor={userAccentColor}
        status={status}
        providerInfo={providerInfo}
        isVoiceCallActive={isVoiceCallActive}
        isVoiceConnecting={isVoiceConnecting}
        startVoiceCall={startVoiceCall}
        endVoiceCall={endVoiceCall}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onToggleStatus={handleToggleStatus}
      />

      {/* Right Content */}
      <main
        className={cn(
          'flex-1 rounded-2xl border overflow-hidden flex flex-col',
          isDark ? 'bg-zinc-900/80 border-zinc-800/60 backdrop-blur-sm' : 'bg-white/80 border-zinc-200/60 backdrop-blur-sm'
        )}
      >
        {/* Tab Navigation */}
        <div className={cn('border-b flex-shrink-0', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
          <nav className="flex overflow-x-auto px-4 md:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-accent text-accent'
                      : cn(
                        'border-transparent',
                        isDark
                          ? 'text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                          : 'text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                      )
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className={cn(
          'flex-1',
          activeTab === 'chat' ? 'overflow-hidden' : 'p-6 md:p-8 overflow-y-auto'
        )}>
          {/* About Tab */}
          {activeTab === 'about' && (
            <AboutTab
              agent={agent as any}
              isDark={isDark}
              editingSection={editingSection}
              editForm={editForm}
              setEditForm={setEditForm}
              startEditing={startEditing}
              cancelEditing={cancelEditing}
              saveSection={saveSection}
              saving={saving}
            />
          )}


          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <ChatTab
              agent={agent as any}
              isDark={isDark}
              allEmotions={allEmotions}
              emotionAvatars={emotionAvatars}
              chatMainGif={chatMainGif}
              voiceCall={{
                isVoiceCallActive,
                isVoiceConnecting,
                useGeminiVoice,
                isMuted,
                isListening,
                isAgentSpeaking,
                startVoiceCall,
                endVoiceCall,
                toggleMute,
                sendTextDuringCall,
              }}
              emoticons={emoticons}
              fetchEmoticons={fetchEmoticons}
              onExit={() => {
                if (isVoiceCallActive) {
                  endVoiceCall()
                }
                setChatMessages([])
                setHistoryLoaded(false)
                setActiveTab('about')
              }}
              saveMessageToHistory={saveMessageToHistory}
              setCurrentEmotion={setCurrentEmotion}
            />
          )}

          {/* History Tab - 대화 기록 */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  대화 기록
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              <ChatHistoryView agentId={agentId} isDark={isDark} />
            </div>
          )}

          {/* Workspace Tab */}
          {activeTab === 'workspace' && (
            <WorkspaceTab agent={agent as any} isDark={isDark} mounted={mounted} />
          )}

          {/* Brain Map Tab */}
          {activeTab === 'brainmap' && (
            <div className="h-[calc(100vh-200px)] min-h-[600px]">
              <BrainMapLayout agentId={agent.id} isDark={isDark} />
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <KnowledgeBaseTab agentId={agentId} isDark={isDark} mounted={mounted} />
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <IntegrationsTab agentId={agentId} isDark={isDark} />
          )}

          {/* APIs Tab */}
          {activeTab === 'apis' && (
            <ApiConnectionsTab agentId={agentId} isDark={isDark} />
          )}

          {/* Workflow Tab */}
          {activeTab === 'workflow' && (
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  워크플로우
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              {agent.workflow_nodes && agent.workflow_nodes.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                      총 {agent.workflow_nodes.length}개의 노드
                    </p>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/agent-builder/${agentId}`)}>
                      편집하기
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {agent.workflow_nodes.map((node: any, idx: number) => (
                      <div
                        key={node.id}
                        className={cn(
                          'flex items-center gap-4 p-4 rounded-xl border',
                          isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                        )}
                      >
                        <span
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                            isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-700'
                          )}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <p className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                            {node.data?.label || node.type}
                          </p>
                          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{node.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Workflow className={cn('w-16 h-16 mx-auto mb-4', isDark ? 'text-zinc-700' : 'text-zinc-300')} />
                  <p className={cn('text-sm mb-4', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    워크플로우가 없습니다
                  </p>
                  <Button variant="outline" onClick={() => router.push(`/agent-builder/${agentId}`)}>
                    워크플로우 만들기
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab - Editable */}
          {activeTab === 'settings' && (
            <SettingsTab
              agent={agent as any}
              isDark={isDark}
              mounted={mounted}
              editingSection={editingSection}
              editForm={editForm}
              setEditForm={setEditForm}
              startEditing={startEditing}
              cancelEditing={cancelEditing}
              saveSection={saveSection}
              saving={saving}
              providerInfo={providerInfo}
              status={status}
              expandedPromptSections={expandedPromptSections}
              setExpandedPromptSections={setExpandedPromptSections}
              chatMainGif={chatMainGif}
              uploadingChatMainGif={uploadingChatMainGif}
              chatMainGifInputRef={chatMainGifInputRef}
              handleChatMainGifUpload={handleChatMainGifUpload}
              handleChatMainGifDelete={handleChatMainGifDelete}
              allEmotions={allEmotions}
              emotionAvatars={emotionAvatars}
              uploadingEmotion={uploadingEmotion}
              editingEmotion={editingEmotion}
              setEditingEmotion={setEditingEmotion}
              keywordInput={keywordInput}
              setKeywordInput={setKeywordInput}
              emotionFileInputRefs={emotionFileInputRefs}
              handleEmotionImageUpload={handleEmotionImageUpload}
              handleDeleteCustomEmotion={handleDeleteCustomEmotion}
              handleUpdateEmotionKeywords={handleUpdateEmotionKeywords}
              setShowAddEmotionModal={setShowAddEmotionModal}
              previewingVoice={previewingVoice}
              previewVoice={previewVoice}
            />
          )}
        </div>
      </main>

      {/* 새 감정 추가 모달 */}
      {showAddEmotionModal && (
        <AddEmotionModal
          isDark={isDark}
          newEmotion={newEmotion}
          setNewEmotion={setNewEmotion}
          keywordInput={keywordInput}
          setKeywordInput={setKeywordInput}
          onAddKeyword={() => handleAddKeyword(false)}
          onRemoveKeyword={(keyword) => {
            setNewEmotion({
              ...newEmotion,
              keywords: (newEmotion.keywords || []).filter(k => k !== keyword),
            })
          }}
          onClose={() => setShowAddEmotionModal(false)}
          onSubmit={handleAddCustomEmotion}
        />
      )}

      {/* 감정 편집 모달 */}
      {editingEmotion && (
        <EditEmotionModal
          isDark={isDark}
          editingEmotion={editingEmotion}
          setEditingEmotion={setEditingEmotion}
          keywordInput={keywordInput}
          setKeywordInput={setKeywordInput}
          onAddKeyword={() => handleAddKeyword(true)}
          onRemoveKeyword={(keyword) => {
            if (editingEmotion) {
              setEditingEmotion({
                ...editingEmotion,
                keywords: (editingEmotion.keywords || []).filter(k => k !== keyword),
              })
            }
          }}
          onClose={() => setEditingEmotion(null)}
          onSubmit={handleUpdateCustomEmotion}
        />
      )}

      {/* 이모티콘 라이브러리 모달 */}
      {showEmoticonModal && (
        <EmoticonModal
          isDark={isDark}
          emoticons={emoticons}
          emoticonsLoading={emoticonsLoading}
          onSelect={handleSelectEmoticon}
          onClose={() => setShowEmoticonModal(false)}
        />
      )}

      {/* 메시지 보내기 모달 */}
      {showMessageModal && (
        <MessageModal
          isDark={isDark}
          agent={agent}
          avatarUrl={chatMainGif || getRandomEmotionGif('neutral') || undefined}
          message={modalMessage}
          setMessage={setModalMessage}
          isLoading={chatLoading}
          onClose={() => setShowMessageModal(false)}
          onSubmit={handleSendModalMessage}
        />
      )}

    </div>
  )
}
