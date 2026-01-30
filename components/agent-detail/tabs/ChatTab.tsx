'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Bot,
  MessageSquare,
  BookOpen,
  FileText,
  FolderOpen,
  FolderPlus,
  Send,
  ImagePlus,
  Wand2,
  Smile,
  ChevronUp,
  ClipboardList,
  CheckCircle,
  XCircle,
  LogOut,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  Check,
  X,
  Loader2,
  Target,
  Cpu,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { executeActions, formatActionResultsForChat, convertToolAction, type AgentAction, type ToolAction } from '@/lib/ai/agent-actions'
import { useWorkflowExecution, type WorkflowStep } from '@/components/chat/WorkflowStepVisualizer'
import {
  detectEmotion,
  detectEmotionsInOrder,
  type EmotionType,
  type CustomEmotion,
  type EmotionAvatars,
} from '@/components/agent-detail/utils'

// Dynamic imports for heavy components
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

// Task mode models
const TASK_MODE_MODELS = [
  { id: 'grok-4-1-fast', name: 'Grok 4.1 Fast', provider: 'xai' },
  { id: 'grok-4-1', name: 'Grok 4.1', provider: 'xai' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', provider: 'anthropic' },
  { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', provider: 'anthropic' },
]

// Chat message type
interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: Date
  image?: string
  emotion?: EmotionType
  emotions?: EmotionType[]
  isTask?: boolean
  taskStatus?: 'pending' | 'running' | 'completed' | 'failed'
  taskResult?: {
    output: string
    sources: string[]
    toolsUsed: string[]
    error?: string
  }
  knowledgeSources?: Array<{ title: string; similarity: number }>
  workflow?: {
    title: string
    steps: WorkflowStep[]
  }
  createdProject?: {
    id: string
    name: string
  }
}

// Pending task type
interface PendingTask {
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
}

// Pending action type
interface PendingAction {
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
}

export interface ChatTabProps {
  agent: {
    id: string
    name: string
    description?: string | null
    avatar_url?: string | null
  }
  isDark: boolean
  allEmotions: CustomEmotion[]
  emotionAvatars: EmotionAvatars
  chatMainGif: string | null
  // Voice call props
  voiceCall: {
    isVoiceCallActive: boolean
    isVoiceConnecting: boolean
    useGeminiVoice: boolean
    isMuted: boolean
    isListening: boolean
    isAgentSpeaking: boolean
    startVoiceCall: () => void
    endVoiceCall: () => void
    toggleMute: () => void
    sendTextDuringCall: (text: string) => boolean
  }
  // Emoticon library
  emoticons: Array<{
    id: string
    name: string
    image_url: string
    image_urls: string[]
    category: string
    keywords: string[]
  }>
  fetchEmoticons: () => void
  // Callbacks
  onExit: () => void
  saveMessageToHistory: (role: 'user' | 'agent', content: string, imageUrl?: string, emotion?: string) => void
  setCurrentEmotion: (emotion: EmotionType) => void
}

export function ChatTab({
  agent,
  isDark,
  allEmotions,
  emotionAvatars,
  chatMainGif,
  voiceCall,
  emoticons,
  fetchEmoticons,
  onExit,
  saveMessageToHistory,
  setCurrentEmotion,
}: ChatTabProps) {
  const router = useRouter()
  const workflowExecution = useWorkflowExecution()

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatTypingStatus, setChatTypingStatus] = useState<'none' | 'read' | 'typing'>('none')
  const [chatImage, setChatImage] = useState<string | null>(null)
  const [chatImageFile, setChatImageFile] = useState<File | null>(null)

  // Prompt Assistant state
  const [showPromptAssistant, setShowPromptAssistant] = useState(false)

  // Tool menu states
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [selectedTool, setSelectedTool] = useState<'chat' | 'image' | 'code' | 'search'>('chat')

  // Task mode state
  const [isTaskMode, setIsTaskMode] = useState(false)
  const [isAnalyzingTask, setIsAnalyzingTask] = useState(false)
  const [selectedTaskModel, setSelectedTaskModel] = useState('grok-4-1-fast')
  const [isTaskModelDropdownOpen, setIsTaskModelDropdownOpen] = useState(false)
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null)
  const [isExecutingTask, setIsExecutingTask] = useState(false)

  // Action state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionFormData, setActionFormData] = useState<Record<string, string>>({})
  const [isExecutingAction, setIsExecutingAction] = useState(false)

  // Emoticon modal
  const [showEmoticonModal, setShowEmoticonModal] = useState(false)

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false)

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatFileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Destructure voice call
  const {
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
  } = voiceCall

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Load emoticons when modal opens
  useEffect(() => {
    if (showEmoticonModal && emoticons.length === 0) {
      fetchEmoticons()
    }
  }, [showEmoticonModal, emoticons.length, fetchEmoticons])

  // Get random emotion GIF
  const getRandomEmotionGif = useCallback((emotionId: string, seed?: string): string | undefined => {
    const avatarData = emotionAvatars[emotionId]
    if (!avatarData) return undefined
    if (Array.isArray(avatarData)) {
      if (avatarData.length === 0) return undefined
      if (avatarData.length === 1) return avatarData[0]
      if (seed) {
        let hash = 2166136261
        for (let i = 0; i < seed.length; i++) {
          hash ^= seed.charCodeAt(i)
          hash = Math.imul(hash, 16777619)
        }
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
  }, [emotionAvatars])

  // Find matching emoticons by keyword
  const findMatchingEmoticons = useCallback((message: string) => {
    if (!message || emoticons.length === 0) return []
    const messageLower = message.toLowerCase()
    return emoticons.filter(emoticon => {
      if (!emoticon.keywords || emoticon.keywords.length === 0) return false
      return emoticon.keywords.some(keyword => messageLower.includes(keyword.toLowerCase()))
    })
  }, [emoticons])

  // Send keyword emoticon
  const sendKeywordEmoticon = useCallback((message: string): boolean => {
    const matchingEmoticons = findMatchingEmoticons(message)
    if (matchingEmoticons.length === 0) return false

    const randomIndex = Math.floor(Math.random() * matchingEmoticons.length)
    const selectedEmoticon = matchingEmoticons[randomIndex]

    const imageUrls = selectedEmoticon.image_urls?.length > 0
      ? selectedEmoticon.image_urls
      : [selectedEmoticon.image_url]
    const randomImageIndex = Math.floor(Math.random() * imageUrls.length)
    const selectedImage = imageUrls[randomImageIndex]

    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        id: `emoticon-${Date.now()}`,
        role: 'user' as const,
        content: '',
        timestamp: new Date(),
        image: selectedImage,
      }])
    }, 100)
    return true
  }, [findMatchingEmoticons])

  // Detect task intent
  const detectTaskIntent = (message: string): boolean => {
    const taskKeywords = [
      '해줘', '해 줘', '작성해', '분석해', '검색해', '찾아줘', '찾아 줘',
      '만들어', '정리해', '요약해', '알려줘', '알려 줘', '조사해',
      '번역해', '계산해', '비교해', '추천해', '설명해',
      'please', 'search', 'find', 'create', 'analyze', 'summarize',
    ]
    const lowerMessage = message.toLowerCase()
    return taskKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  // Update workflow step
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

  // Execute task
  const executeTask = async (messageId: string, instruction: string) => {
    if (!agent) return

    const workflowMsgId = `workflow-${Date.now()}`

    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, taskStatus: 'running' as const } : msg
    ))

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

    const loadingMessage: ChatMessage = {
      id: workflowMsgId,
      role: 'agent',
      content: '',
      timestamp: new Date(),
      workflow: {
        title: instruction.substring(0, 50) + (instruction.length > 50 ? '...' : ''),
        steps: workflowSteps,
      },
    }
    setChatMessages(prev => [...prev, loadingMessage])

    try {
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

      if (!res.ok) throw new Error(`API 오류: ${res.status}`)

      const data = await res.json()
      let responseContent = data.response || '응답을 생성하지 못했습니다.'
      const toolsUsed: string[] = data.toolsUsed || []
      let createdProjectInfo: { id: string; name: string } | undefined = undefined

      if (data.superAgentMode && data.actions && data.actions.length > 0) {
        const projectAction = (data.actions as ToolAction[]).find(
          (action) => action.type === 'create_project' && action.data?.projectId
        )
        if (projectAction && projectAction.data) {
          createdProjectInfo = {
            id: projectAction.data.projectId as string,
            name: (projectAction.data.name as string) || '프로젝트',
          }
        }
      } else if (data.actions && data.actions.length > 0) {
        try {
          const agentActions = (data.actions as ToolAction[])
            .map((action) => convertToolAction(action))
            .filter((a): a is AgentAction => a !== null)

          const results = await executeActions(agentActions)
          const actionSummary = formatActionResultsForChat(results)

          if (actionSummary) {
            responseContent += '\n\n---\n**실행 결과:**\n' + actionSummary
          }

          const projectResult = results.find(r =>
            r.success && r.action.type === 'create_project' && r.result
          )
          if (projectResult && projectResult.result) {
            const projectData = (projectResult.result as { project?: { id: string; name: string } }).project
            if (projectData) {
              createdProjectInfo = { id: projectData.id, name: projectData.name }
            }
          }

          results.forEach(r => {
            if (r.success && !toolsUsed.includes(r.action.type)) {
              toolsUsed.push(r.action.type)
            }
          })
        } catch (actionError) {
          console.error('[TaskMode] ❌ Action error:', actionError)
          responseContent += '\n\n⚠️ 일부 작업 실행 중 오류가 발생했습니다.'
        }
      }

      updateWorkflowStep(workflowMsgId, 'step-execute', {
        status: 'completed',
        result: toolsUsed.length > 0 ? `사용된 도구: ${toolsUsed.join(', ')}` : '완료',
        completedAt: new Date().toISOString(),
      })

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

      setChatMessages(prev => prev.map(msg =>
        msg.id === workflowMsgId ? { ...msg, content: '' } : msg
      ))

      const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
      const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'happy'

      const resultMessage: ChatMessage = {
        id: `result-${Date.now()}`,
        role: 'agent',
        content: responseContent,
        timestamp: new Date(),
        emotion: detectedEmotion,
        emotions: detectedEmotions,
        createdProject: createdProjectInfo,
      }
      setChatMessages(prev => [...prev, resultMessage])
      saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)

    } catch (error) {
      console.error('[TaskMode] Error:', error)

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

      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: `❌ 업무 실행 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date(),
      }])
    }
  }

  // Handle task instruction
  const handleTaskInstruction = async () => {
    if (!chatInput.trim() || !agent) return

    const instruction = chatInput.trim()
    setChatInput('')

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `📋 [업무 지시] ${instruction}`,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMessage])

    await executeTask(userMessage.id, instruction)
  }

  // Handle confirm task
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

      if (!response.ok) throw new Error('업무 생성 실패')

      const task = await response.json()

      const resultMessage: ChatMessage = {
        id: `task-result-${Date.now()}`,
        role: 'agent',
        content: `✅ **업무 완료: ${pendingTask.analysis.title}**\n\n${task.result || '처리가 완료되었습니다.'}`,
        timestamp: new Date(),
      }
      setChatMessages(prev => [...prev, resultMessage])
      saveMessageToHistory('agent', resultMessage.content)

      setPendingTask(null)
      setIsTaskMode(false)
    } catch (error) {
      console.error('업무 실행 오류:', error)
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: '업무 실행 중 오류가 발생했습니다.',
        timestamp: new Date(),
      }])
    } finally {
      setIsExecutingTask(false)
    }
  }

  // Handle cancel task
  const handleCancelTask = () => {
    setPendingTask(null)
    setIsTaskMode(false)
    setChatMessages(prev => [...prev, {
      id: `cancel-${Date.now()}`,
      role: 'agent',
      content: '업무 지시를 취소했습니다. 다른 것을 도와드릴까요?',
      timestamp: new Date(),
    }])
  }

  // Handle confirm action
  const handleConfirmAction = async () => {
    if (!pendingAction || !agent) return

    setIsExecutingAction(true)

    try {
      if (pendingAction.action_type === 'project_create') {
        if (!actionFormData.name?.trim()) {
          alert('프로젝트 이름을 입력해주세요.')
          setIsExecutingAction(false)
          return
        }

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

        const successMessage: ChatMessage = {
          id: `action-success-${Date.now()}`,
          role: 'agent',
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

      setPendingAction(null)
      setActionFormData({})
      setIsTaskMode(false)
    } catch (error) {
      console.error('액션 실행 오류:', error)
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: `작업 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        timestamp: new Date(),
      }])
    } finally {
      setIsExecutingAction(false)
    }
  }

  // Handle cancel action
  const handleCancelAction = () => {
    setPendingAction(null)
    setActionFormData({})
    setIsTaskMode(false)
    setChatMessages(prev => [...prev, {
      id: `cancel-${Date.now()}`,
      role: 'agent',
      content: '작업을 취소했습니다. 다른 것을 도와드릴까요?',
      timestamp: new Date(),
    }])
  }

  // Handle action form change
  const handleActionFormChange = (fieldName: string, value: string) => {
    setActionFormData(prev => ({ ...prev, [fieldName]: value }))
  }

  // Handle generate image
  const handleGenerateImage = async (prompt: string) => {
    if (!prompt.trim() || !agent || isGeneratingImage) return

    setIsGeneratingImage(true)
    setChatInput('')

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: `🎨 이미지 생성: ${prompt}`,
      timestamp: new Date(),
    }
    setChatMessages(prev => [...prev, userMessage])

    const aiMessageId = `agent-${Date.now()}`
    setChatMessages(prev => [...prev, {
      id: aiMessageId,
      role: 'agent',
      content: '🖼️ Z-Image로 이미지를 생성하고 있어요... (약 5-10초 소요)',
      timestamp: new Date(),
    }])

    try {
      const response = await fetch('/api/skills/z-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          width: 1024,
          height: 1024,
          num_inference_steps: 8,
        }),
      })

      const data = await response.json()

      if (data.success && data.image_url) {
        setChatMessages(prev =>
          prev.map(msg =>
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
        setChatMessages(prev =>
          prev.map(msg =>
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
      setChatMessages(prev =>
        prev.map(msg =>
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
      setSelectedTool('chat')
    }
  }

  // Handle chat image select
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

  // Handle remove chat image
  const handleRemoveChatImage = () => {
    setChatImage(null)
    setChatImageFile(null)
  }

  // Handle select emoticon
  const handleSelectEmoticon = (emoticon: { image_url: string; name: string }) => {
    setChatMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: '',
      timestamp: new Date(),
      image: emoticon.image_url,
    }])
    setShowEmoticonModal(false)
  }

  // Handle send chat
  const handleSendChat = async () => {
    if ((!chatInput.trim() && !chatImage) || !agent || chatLoading) return

    const messageContent = chatInput.trim() || (chatImage ? '[이미지]' : '')
    const isTask = detectTaskIntent(messageContent)

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      image: chatImage || undefined,
      ...(isTask && { isTask: true, taskStatus: 'running' as const }),
    }

    setChatMessages(prev => [...prev, userMessage])

    if (isTask) {
      setChatInput('')
      setChatImage(null)
      setChatImageFile(null)
      executeTask(userMessage.id, messageContent)
      return
    }

    saveMessageToHistory('user', userMessage.content, userMessage.image)
    sendKeywordEmoticon(messageContent)

    const userEmotion = detectEmotion(userMessage.content, allEmotions)
    if (userEmotion !== 'neutral') {
      setCurrentEmotion(userEmotion)
    }

    const sentImage = chatImage
    setChatInput('')
    setChatImage(null)
    setChatImageFile(null)

    if (sendTextDuringCall(messageContent)) {
      return
    }

    setChatTypingStatus('read')
    const thinkingDelay = 1000 + Math.random() * 2000
    await new Promise(resolve => setTimeout(resolve, thinkingDelay))

    setChatTypingStatus('typing')
    setChatLoading(true)

    try {
      let apiMessageContent = userMessage.content
      if (sentImage && !userMessage.content) {
        apiMessageContent = '이 이미지에 대해 말해줘'
      }

      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: apiMessageContent,
          conversation_history: chatMessages.map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
          images: sentImage ? [sentImage] : [],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        let responseContent = data.response || '응답을 생성하지 못했습니다.'
        let createdProjectInfo: { id: string; name: string } | undefined = undefined

        if (data.actions && data.actions.length > 0) {
          try {
            const agentActions = (data.actions as ToolAction[])
              .map((action) => convertToolAction(action))
              .filter((a): a is AgentAction => a !== null)

            const results = await executeActions(agentActions)
            const actionSummary = formatActionResultsForChat(results)

            if (actionSummary) {
              responseContent += '\n\n---\n**실행 결과:**\n' + actionSummary
            }

            const projectResult = results.find(r =>
              r.success && r.action.type === 'create_project' && r.result
            )
            if (projectResult && projectResult.result) {
              const projectData = (projectResult.result as { project?: { id: string; name: string } }).project
              if (projectData) {
                createdProjectInfo = { id: projectData.id, name: projectData.name }
              }
            }
          } catch (actionError) {
            console.error('[AgentChat] ❌ Action execution error:', actionError)
            responseContent += '\n\n⚠️ 일부 작업 실행 중 오류가 발생했습니다.'
          }
        }

        if (data.action_type && data.requires_confirmation) {
          setChatMessages(prev => [...prev, {
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: responseContent,
            timestamp: new Date(),
          }])

          const initialFormData: Record<string, string> = {}
          if (data.extracted_data?.suggestedName) {
            initialFormData.name = data.extracted_data.suggestedName
          }
          setActionFormData(initialFormData)

          setPendingAction({
            action_type: data.action_type,
            confirmation_message: responseContent,
            input_fields: data.input_fields || [],
            extracted_data: data.extracted_data,
          })
        } else {
          const detectedEmotions = detectEmotionsInOrder(responseContent, allEmotions)
          const detectedEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'neutral'

          setChatMessages(prev => [...prev, {
            id: `agent-${Date.now()}`,
            role: 'agent',
            content: responseContent,
            timestamp: new Date(),
            emotion: detectedEmotion,
            emotions: detectedEmotions,
            knowledgeSources: data.knowledgeSources,
            createdProject: createdProjectInfo,
          }])
          setCurrentEmotion(detectedEmotion)
          saveMessageToHistory('agent', responseContent, undefined, detectedEmotion)
        }
      } else {
        let errorMessage = '응답 실패'
        try {
          const error = await res.json()
          errorMessage = error.error || errorMessage
        } catch {
          errorMessage = `서버 오류 (${res.status})`
        }
        setChatMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'agent',
          content: `오류: ${errorMessage}`,
          timestamp: new Date(),
        }])
      }
    } catch (err: any) {
      console.error('Chat error:', err)
      setChatMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: `네트워크 오류: ${err?.message || '알 수 없는 오류'}`,
        timestamp: new Date(),
      }])
    } finally {
      setChatLoading(false)
      setChatTypingStatus('none')
      setTimeout(() => chatInputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="relative flex flex-col h-full p-6 md:p-8">
      {/* Prompt Assistant Modal */}
      {showPromptAssistant && (
        <PromptAssistant
          onSubmit={async (prompt) => {
            setShowPromptAssistant(false)
            if (!agent) return

            const userMessage: ChatMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: prompt,
              timestamp: new Date(),
            }
            setChatMessages(prev => [...prev, userMessage])
            saveMessageToHistory('user', prompt)

            setChatLoading(true)

            try {
              const response = await fetch(`/api/agents/${agent.id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: prompt,
                  history: chatMessages.slice(-10).map(m => ({
                    role: m.role,
                    content: m.content,
                  })),
                }),
              })

              const data = await response.json()

              if (data.success && data.response) {
                const agentMessage: ChatMessage = {
                  id: `agent-${Date.now()}`,
                  role: 'agent',
                  content: data.response,
                  timestamp: new Date(),
                }
                setChatMessages(prev => [...prev, agentMessage])
                saveMessageToHistory('agent', data.response)
              }
            } catch (error) {
              console.error('Chat error:', error)
            } finally {
              setChatLoading(false)
            }
          }}
          onClose={() => setShowPromptAssistant(false)}
          agentContext={{
            agentName: agent?.name,
            agentDescription: agent?.description || undefined,
          }}
        />
      )}

      {/* Gemini Voice Chat Mode */}
      {useGeminiVoice && agent && (
        <div className="fixed inset-0 z-[100] bg-zinc-950">
          <GeminiVoiceChat
            agentId={agent.id}
            agentName={agent.name}
            avatarUrl={agent.avatar_url || undefined}
            onTranscript={(text, role) => {
              const messageRole: 'user' | 'agent' = role === 'user' ? 'user' : 'agent'
              setChatMessages(prev => [...prev, {
                id: `gemini-${role}-${Date.now()}`,
                role: messageRole,
                content: text,
                timestamp: new Date(),
                isVoice: true,
              } as ChatMessage & { isVoice: boolean }])
              saveMessageToHistory(role === 'user' ? 'user' : 'agent', text)
            }}
          />
          <button
            onClick={endVoiceCall}
            className="absolute top-4 right-4 z-10 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            통화 종료
          </button>
        </div>
      )}

      {/* Chat Messages Area */}
      <div
        className={cn(
          'flex-1 overflow-y-auto rounded-2xl border p-4 md:p-6 space-y-4 select-text',
          isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
        )}
      >
        {/* Initial loading animation */}
        {chatLoading && chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-2xl opacity-40 animate-pulse scale-110" />
              <div className="absolute inset-[-8px] border-4 border-transparent border-t-blue-500 border-r-purple-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
              <div className="absolute inset-[-16px] border-4 border-transparent border-b-pink-500 border-l-cyan-500 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-2xl">
                {agent?.avatar_url ? (
                  <img src={agent.avatar_url} alt={agent?.name || '에이전트'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                    <Bot className="w-16 h-16 text-white" />
                  </div>
                )}
              </div>
            </div>
            <h3 className={cn('text-xl font-bold mb-3', isDark ? 'text-white' : 'text-zinc-900')}>
              {agent?.name}
            </h3>
            <p className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              대화를 준비하고 있어요...
            </p>
            <div className="flex gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : !chatLoading && chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="mb-6">
              {chatMainGif || getRandomEmotionGif('neutral') || agent?.avatar_url ? (
                <img
                  src={chatMainGif || getRandomEmotionGif('neutral') || agent?.avatar_url || undefined}
                  alt={agent?.name || '에이전트'}
                  className="w-48 h-48 md:w-64 md:h-64 object-cover rounded-full shadow-xl"
                />
              ) : (
                <div className={cn(
                  'w-48 h-48 md:w-64 md:h-64 rounded-full flex items-center justify-center',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                )}>
                  <Bot className={cn('w-24 h-24', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                </div>
              )}
            </div>
            <h3 className={cn('text-xl font-bold mb-2', isDark ? 'text-white' : 'text-zinc-900')}>
              {agent?.name}
            </h3>
            <p className={cn('text-sm mb-6', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {agent?.description || '에이전트와 대화를 시작해보세요'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowMessageModal(true)}
                className={cn(
                  'px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2',
                  'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/25'
                )}
              >
                <Send className="w-4 h-4" />
                메시지 보내기
              </button>
              <button
                onClick={async () => {
                  if (!agent || chatLoading) return
                  setChatLoading(true)
                  await new Promise(resolve => setTimeout(resolve, 100))

                  let greetingContent = `안녕하세요! ${agent?.name || '에이전트'}입니다. 무엇을 도와드릴까요?`
                  let greetingEmotion = 'happy'

                  try {
                    const greetingPrompt = '[입장] 사용자가 채팅방에 들어왔습니다. 사용자 직위를 확인하고 그에 맞는 말투로 자연스럽게 인사해주세요. (도움 제안 X, 되묻기 X, 그냥 반가운 인사만)'
                    const res = await fetch(`/api/agents/${agent.id}/chat`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: greetingPrompt,
                        conversation_history: chatMessages
                          .filter(m => m.role !== 'system')
                          .map((m) => ({
                            role: m.role === 'user' ? 'user' : 'assistant',
                            content: m.content,
                          })),
                      }),
                    })

                    if (res.ok) {
                      const data = await res.json()
                      greetingContent = data.response || greetingContent
                      const detectedEmotions = detectEmotionsInOrder(greetingContent, allEmotions)
                      greetingEmotion = detectedEmotions.length > 0 ? detectedEmotions[0] : 'happy'
                    }
                  } catch (err) {
                    console.error('Greeting error:', err)
                  }

                  setChatMessages(prev => [...prev, {
                    id: `agent-${Date.now()}`,
                    role: 'agent',
                    content: greetingContent,
                    timestamp: new Date(),
                    emotion: greetingEmotion,
                    emotions: [greetingEmotion],
                  }])
                  setCurrentEmotion(greetingEmotion)
                  saveMessageToHistory('agent', greetingContent, undefined, greetingEmotion)
                  setChatLoading(false)
                  setChatTypingStatus('none')
                  setTimeout(() => chatInputRef.current?.focus(), 100)
                }}
                className={cn(
                  'px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2',
                  isDark
                    ? 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                    : 'bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200'
                )}
              >
                <MessageSquare className="w-4 h-4" />
                1:1 채팅하기
              </button>
            </div>
          </div>
        ) : (
          chatMessages.map((msg, msgIndex) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'
              )}
            >
              {msg.role === 'system' ? (
                <div className={cn(
                  'px-4 py-2 rounded-full text-xs',
                  isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-100 text-zinc-400'
                )}>
                  {msg.content}
                </div>
              ) : (
                <div className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start', 'max-w-[80%]')}>
                  <div className={cn(
                    'rounded-2xl px-4 py-3 select-text',
                    msg.role === 'user'
                      ? 'bg-accent text-white'
                      : isDark
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'bg-white text-zinc-900 border border-zinc-200'
                  )}>
                    {msg.role === 'agent' && (
                      <>
                        {(() => {
                          const emotionsWithGif = msg.emotions && msg.emotions.length > 0
                            ? msg.emotions.filter(e => emotionAvatars[e])
                            : (msg.emotion && emotionAvatars[msg.emotion] ? [msg.emotion] : [])

                          if (emotionsWithGif.length > 0) {
                            const selectedEmotion = emotionsWithGif[0]
                            const contentHash = msg.content ? msg.content.slice(0, 50) : ''
                            const msgSeed = `${msg.id || msg.timestamp}-${selectedEmotion}-${msgIndex}-${contentHash}`
                            const gifUrl = getRandomEmotionGif(selectedEmotion, msgSeed)
                            if (gifUrl) {
                              return (
                                <div className="mb-3">
                                  <img
                                    src={gifUrl}
                                    alt={allEmotions.find((e: CustomEmotion) => e.id === selectedEmotion)?.label || '감정'}
                                    className="rounded-xl max-w-full"
                                  />
                                </div>
                              )
                            }
                          }
                          return null
                        })()}
                        <div className="flex items-center gap-2 mb-2">
                          {!(msg.emotions?.some(e => emotionAvatars[e]) || (msg.emotion && emotionAvatars[msg.emotion])) && (
                            agent?.avatar_url ? (
                              <img src={agent.avatar_url} alt={agent?.name || '에이전트'} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                <span className="text-xs font-medium text-accent">{agent?.name?.substring(0, 1)}</span>
                              </div>
                            )
                          )}
                          <span className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            {agent?.name}
                          </span>
                        </div>
                      </>
                    )}
                    {msg.image && (
                      <img src={msg.image} alt="첨부 이미지" className="max-w-full max-h-48 rounded-lg mb-2 object-contain" />
                    )}
                    {msg.content && msg.content !== '[이미지]' && (
                      <div className="flex items-start gap-1.5">
                        {(msg as any).isVoice && (
                          <Mic className={cn(
                            'w-3 h-3 mt-0.5 flex-shrink-0',
                            msg.role === 'user' ? 'text-white/60' : isDark ? 'text-accent/60' : 'text-accent/60'
                          )} />
                        )}
                        <p className="text-sm whitespace-pre-wrap select-text">{msg.content}</p>
                      </div>
                    )}

                    {msg.createdProject && (
                      <button
                        onClick={() => router.push(`/dashboard-group/projects/${msg.createdProject!.id}`)}
                        className={cn(
                          'mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                          isDark
                            ? 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30'
                            : 'bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20'
                        )}
                      >
                        <FolderOpen className="w-4 h-4" />
                        프로젝트 확인
                      </button>
                    )}

                    {msg.isTask && msg.role === 'user' && (
                      <div className="mt-2 pt-2 border-t border-white/20">
                        {msg.taskStatus === 'running' && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            실행 중...
                          </div>
                        )}
                        {msg.taskStatus === 'completed' && (
                          <div className="flex items-center gap-1.5 text-xs text-green-300">
                            <Check className="w-3 h-3" />
                            완료
                            {msg.taskResult?.toolsUsed && msg.taskResult.toolsUsed.length > 0 && (
                              <span className="opacity-70">({msg.taskResult.toolsUsed.join(', ')})</span>
                            )}
                          </div>
                        )}
                        {msg.taskStatus === 'failed' && (
                          <div className="flex items-center gap-1.5 text-xs text-red-300">
                            <X className="w-3 h-3" />
                            실패: {msg.taskResult?.error || '알 수 없는 오류'}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.workflow && msg.workflow.steps.length > 0 && (
                      <div className="mt-3">
                        <WorkflowStepVisualizer
                          title={msg.workflow.title}
                          steps={msg.workflow.steps}
                          compact={false}
                        />
                      </div>
                    )}

                    {msg.knowledgeSources && msg.knowledgeSources.length > 0 && (
                      <div className={cn('mt-3 pt-2 border-t', isDark ? 'border-zinc-700' : 'border-zinc-200')}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <BookOpen className={cn('w-3 h-3', isDark ? 'text-accent/70' : 'text-accent/70')} />
                          <span className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            참조한 지식
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.knowledgeSources.slice(0, 3).map((source, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                                isDark ? 'bg-accent/10 text-accent/80' : 'bg-accent/5 text-accent/80'
                              )}
                              title={`유사도: ${Math.round(source.similarity * 100)}%`}
                            >
                              <FileText className="w-3 h-3" />
                              {source.title.length > 20 ? source.title.slice(0, 20) + '...' : source.title}
                            </span>
                          ))}
                          {msg.knowledgeSources.length > 3 && (
                            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              +{msg.knowledgeSources.length - 3}개 더
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className={cn('text-xs mt-1 px-1', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                    {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
            </div>
          ))
        )}

        {/* Agent speaking indicator */}
        {isAgentSpeaking && (
          <div className="flex justify-start">
            <div className={cn('rounded-2xl px-4 py-3', isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200')}>
              <div className="flex items-center gap-2">
                {getRandomEmotionGif('talking') || getRandomEmotionGif('happy') ? (
                  <img
                    src={getRandomEmotionGif('talking') || getRandomEmotionGif('happy') || ''}
                    alt="말하는 중"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : agent?.avatar_url ? (
                  <img src={agent.avatar_url} alt={agent?.name} className="w-10 h-10 rounded-full object-cover animate-pulse" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center animate-pulse">
                    <Volume2 className="w-5 h-5 text-accent" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-600')}>
                    🎤 말하는 중...
                  </span>
                  <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    음성으로 답변 중
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {chatTypingStatus !== 'none' && !isAgentSpeaking && (
          <div className="flex justify-start">
            <div className={cn('rounded-2xl px-4 py-3', isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200')}>
              <div className="flex items-center gap-2">
                {chatTypingStatus === 'read' ? (
                  <>
                    {agent?.avatar_url ? (
                      <img src={agent.avatar_url} alt={agent.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                        <span className="text-xs">👀</span>
                      </div>
                    )}
                    <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>읽음</span>
                  </>
                ) : (
                  <>
                    {getRandomEmotionGif('thinking') ? (
                      <img src={getRandomEmotionGif('thinking')} alt="입력중" className="w-8 h-8 rounded-full object-cover" />
                    ) : agent?.avatar_url ? (
                      <img src={agent.avatar_url} alt={agent.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    )}
                    <div className="flex items-center gap-1">
                      <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>입력중</span>
                      <span className="flex gap-0.5">
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', isDark ? 'bg-zinc-400' : 'bg-zinc-500')} style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', isDark ? 'bg-zinc-400' : 'bg-zinc-500')} style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                        <span className={cn('w-1.5 h-1.5 rounded-full animate-bounce', isDark ? 'bg-zinc-400' : 'bg-zinc-500')} style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 mt-3">
        {/* Image Preview */}
        {chatImage && (
          <div className={cn(
            'mb-2 p-2 rounded-xl border inline-flex items-center gap-2',
            isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
          )}>
            <img src={chatImage} alt="첨부 이미지" className="h-16 w-16 object-cover rounded-lg" />
            <button
              onClick={handleRemoveChatImage}
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center',
                isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600'
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Task mode indicator */}
        {isTaskMode && !pendingTask && (
          <div className={cn(
            'mb-3 p-4 rounded-2xl border backdrop-blur-sm',
            'bg-gradient-to-r shadow-lg',
            'animate-in slide-in-from-top-2 duration-300',
            isDark
              ? 'from-accent/20 to-accent/10 border-accent/30 shadow-accent/20'
              : 'from-accent/10 to-accent/5 border-accent/30 shadow-accent/20'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', 'bg-accent shadow-lg shadow-accent/30')}>
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className={cn('text-sm font-semibold block', isDark ? 'text-accent' : 'text-accent')}>
                  업무 지시 모드
                </span>
                <span className={cn('text-xs', isDark ? 'text-accent/70' : 'text-accent/80')}>
                  원하는 업무를 자유롭게 말씀하세요
                </span>
              </div>
              <button
                onClick={() => setIsTaskMode(false)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  'hover:scale-105 active:scale-95',
                  isDark
                    ? 'text-accent bg-accent/20 hover:bg-accent/30 border border-accent/30'
                    : 'text-accent bg-accent/10 hover:bg-accent/20 border border-accent/30'
                )}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* Analyzing indicator */}
        {isAnalyzingTask && (
          <div className={cn(
            'mb-3 p-4 rounded-2xl border backdrop-blur-sm overflow-hidden relative',
            'bg-gradient-to-r shadow-lg',
            'animate-in fade-in duration-300',
            isDark
              ? 'from-blue-950/40 to-indigo-950/40 border-blue-700/30 shadow-blue-900/20'
              : 'from-blue-50 to-indigo-50 border-blue-200/60 shadow-blue-200/50'
          )}>
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center gap-3 relative">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-lg shadow-blue-500/30',
                'animate-pulse'
              )}>
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
              <div className="flex-1">
                <span className={cn('text-sm font-semibold block', isDark ? 'text-blue-200' : 'text-blue-800')}>
                  업무 내용 분석 중
                </span>
                <span className={cn('text-xs', isDark ? 'text-blue-400/70' : 'text-blue-600/80')}>
                  AI가 업무를 이해하고 정리하고 있습니다...
                </span>
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        {/* Pending task confirmation */}
        {pendingTask && (
          <div className={cn(
            'mb-3 rounded-2xl border backdrop-blur-sm overflow-hidden',
            'shadow-xl animate-in slide-in-from-bottom-4 duration-500',
            isDark
              ? 'bg-gradient-to-br from-emerald-950/50 to-teal-950/50 border-emerald-700/30 shadow-emerald-900/30'
              : 'bg-gradient-to-br from-emerald-50/90 to-teal-50/90 border-emerald-200/60 shadow-emerald-200/60'
          )}>
            <div className={cn(
              'px-4 py-3 border-b flex items-center gap-3',
              isDark ? 'border-emerald-800/30 bg-emerald-900/20' : 'border-emerald-100 bg-emerald-100/50'
            )}>
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30'
              )}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className={cn('text-sm font-semibold', isDark ? 'text-emerald-200' : 'text-emerald-800')}>
                  업무 분석 완료
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>이해도</span>
                  <div className={cn('w-16 h-1.5 rounded-full overflow-hidden', isDark ? 'bg-zinc-700' : 'bg-zinc-200')}>
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        pendingTask.analysis.confidence > 0.8
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          : pendingTask.analysis.confidence > 0.5
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : 'bg-gradient-to-r from-red-400 to-red-500'
                      )}
                      style={{ width: `${pendingTask.analysis.confidence * 100}%` }}
                    />
                  </div>
                  <span className={cn(
                    'text-xs font-medium',
                    pendingTask.analysis.confidence > 0.8
                      ? isDark ? 'text-emerald-400' : 'text-emerald-600'
                      : pendingTask.analysis.confidence > 0.5
                        ? isDark ? 'text-amber-400' : 'text-amber-600'
                        : isDark ? 'text-red-400' : 'text-red-600'
                  )}>
                    {Math.round(pendingTask.analysis.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className={cn('text-sm whitespace-pre-wrap leading-relaxed select-text', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                {pendingTask.confirmation_message}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={handleCancelTask}
                  disabled={isExecutingTask}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    isDark
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                      : 'bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 shadow-sm'
                  )}
                >
                  <XCircle className="w-4 h-4" />
                  <span>반려</span>
                </button>
                <button
                  onClick={handleConfirmTask}
                  disabled={isExecutingTask}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg',
                    'text-sm font-semibold transition-all duration-200',
                    'bg-accent text-white',
                    'hover:bg-accent/90',
                    'hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02]',
                    'active:scale-[0.98]',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                  )}
                >
                  {isExecutingTask ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>실행 중...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>승인</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pending Action (project creation etc) */}
        {pendingAction && (
          <div className={cn(
            'p-4 rounded-2xl border-2',
            isDark
              ? 'bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-700/50'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
          )}>
            <div className={cn(
              'flex items-center gap-3 pb-3 mb-3 border-b',
              isDark ? 'border-blue-800/50' : 'border-blue-200'
            )}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                <FolderPlus className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <span className={cn('text-sm font-semibold', isDark ? 'text-blue-300' : 'text-blue-700')}>
                  프로젝트 생성
                </span>
              </div>
            </div>
            <div className={cn('text-sm whitespace-pre-wrap leading-relaxed mb-4 select-text', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
              {pendingAction.confirmation_message}
            </div>
            <div className="space-y-3 mb-4">
              {pendingAction.input_fields.map((field) => (
                <div key={field.name} className="flex flex-col gap-1">
                  <label className={cn('text-xs font-medium', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'text' && (
                    <input
                      type="text"
                      value={actionFormData[field.name] || ''}
                      onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                        isDark ? 'bg-zinc-800 border border-zinc-700 text-zinc-100' : 'bg-white border border-zinc-300 text-zinc-900'
                      )}
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      value={actionFormData[field.name] || ''}
                      onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      rows={2}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500',
                        isDark ? 'bg-zinc-800 border border-zinc-700 text-zinc-100' : 'bg-white border border-zinc-300 text-zinc-900'
                      )}
                    />
                  )}
                  {field.type === 'select' && field.options && (
                    <select
                      value={actionFormData[field.name] || ''}
                      onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                        isDark ? 'bg-zinc-800 border border-zinc-700 text-zinc-100' : 'bg-white border border-zinc-300 text-zinc-900'
                      )}
                    >
                      <option value="">선택하세요</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={actionFormData[field.name] || ''}
                      onChange={(e) => handleActionFormChange(field.name, e.target.value)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                        isDark ? 'bg-zinc-800 border border-zinc-700 text-zinc-100' : 'bg-white border border-zinc-300 text-zinc-900'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelAction}
                disabled={isExecutingAction}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  'hover:scale-[1.02] active:scale-[0.98]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                    : 'bg-white hover:bg-zinc-50 text-zinc-600 border border-zinc-200 shadow-sm'
                )}
              >
                <XCircle className="w-4 h-4" />
                <span>반려</span>
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isExecutingAction}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg',
                  'text-sm font-semibold transition-all duration-200',
                  'bg-accent text-white',
                  'hover:bg-accent/90',
                  'hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02]',
                  'active:scale-[0.98]',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                )}
              >
                {isExecutingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>생성 중...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>승인</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}>
          <input
            ref={chatFileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
            onChange={handleChatImageSelect}
            className="hidden"
          />
          <button
            onClick={() => chatFileInputRef.current?.click()}
            disabled={chatLoading}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-600'
            )}
            title="이미지 첨부"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowEmoticonModal(true)}
            disabled={chatLoading || isTaskMode}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-600',
              isTaskMode && 'opacity-50 cursor-not-allowed'
            )}
            title="이모티콘"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Tool Menu Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowToolMenu(!showToolMenu)}
              disabled={chatLoading || isGeneratingImage || isTaskMode}
              className={cn(
                'h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all',
                selectedTool === 'image'
                  ? isDark
                    ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 border border-purple-500/30'
                  : showToolMenu
                    ? isDark
                      ? 'bg-accent/30 text-accent border border-accent/50'
                      : 'bg-accent/20 text-accent border border-accent/30'
                    : isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200',
                (chatLoading || isGeneratingImage || isTaskMode) && 'opacity-50 cursor-not-allowed'
              )}
              title="도구 선택"
            >
              {selectedTool === 'image' ? <Wand2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              <span className="text-xs font-medium">{selectedTool === 'image' ? '이미지' : '도구'}</span>
              <ChevronUp className={cn('w-3 h-3 transition-transform', showToolMenu && 'rotate-180')} />
            </button>
            {showToolMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowToolMenu(false)} />
                <div className={cn(
                  'absolute bottom-full left-0 mb-2 py-2 rounded-xl shadow-lg border z-50 min-w-[200px]',
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
                )}>
                  <div className={cn('px-3 py-1.5 text-xs font-medium', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    AI 도구
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTool('chat')
                      setShowToolMenu(false)
                      chatInputRef.current?.focus()
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 flex items-center gap-3 transition-colors',
                      selectedTool === 'chat'
                        ? isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'
                        : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-zinc-500 to-zinc-600">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">일반 채팅</div>
                      <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>AI와 대화하기</div>
                    </div>
                    {selectedTool === 'chat' && <Check className="w-4 h-4 ml-auto text-accent" />}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTool('image')
                      setShowToolMenu(false)
                      chatInputRef.current?.focus()
                    }}
                    disabled={isGeneratingImage}
                    className={cn(
                      'w-full px-3 py-2.5 flex items-center gap-3 transition-colors',
                      selectedTool === 'image'
                        ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700'
                        : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-50',
                      isGeneratingImage && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                      {isGeneratingImage ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Wand2 className="w-4 h-4 text-white" />}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">이미지 생성</div>
                      <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>AI로 이미지 그리기</div>
                    </div>
                    {selectedTool === 'image' && <Check className="w-4 h-4 ml-auto text-purple-500" />}
                  </button>
                  <button disabled className={cn('w-full px-3 py-2.5 flex items-center gap-3 opacity-40 cursor-not-allowed', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
                      <Cpu className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">코드 실행</div>
                      <div className="text-xs">Coming soon</div>
                    </div>
                  </button>
                  <button disabled className={cn('w-full px-3 py-2.5 flex items-center gap-3 opacity-40 cursor-not-allowed', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-500">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">웹 검색</div>
                      <div className="text-xs">Coming soon</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Task mode button */}
          <button
            onClick={() => {
              setIsTaskMode(!isTaskMode)
              if (pendingTask) setPendingTask(null)
            }}
            disabled={chatLoading || isAnalyzingTask || !!pendingTask}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
              isTaskMode
                ? 'bg-accent text-white hover:bg-accent/90'
                : isDark
                  ? 'hover:bg-accent/20 text-zinc-400 hover:text-accent'
                  : 'hover:bg-accent/10 text-zinc-500 hover:text-accent',
              (chatLoading || isAnalyzingTask || !!pendingTask) && 'opacity-50 cursor-not-allowed'
            )}
            title={isTaskMode ? '업무 지시 모드 해제' : '업무 지시'}
          >
            <ClipboardList className="w-4 h-4" />
          </button>

          {/* Task model dropdown */}
          {isTaskMode && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setIsTaskModelDropdownOpen(!isTaskModelDropdownOpen)}
                disabled={chatLoading || isAnalyzingTask || !!pendingTask}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs border-none outline-none transition-all flex items-center gap-1',
                  isDark ? 'bg-accent/20 text-accent hover:bg-accent/30' : 'bg-accent/10 text-accent hover:bg-accent/20',
                  (chatLoading || isAnalyzingTask || !!pendingTask) && 'opacity-50 cursor-not-allowed'
                )}
                title="업무 분석 모델 선택"
              >
                {TASK_MODE_MODELS.find(m => m.id === selectedTaskModel)?.name || 'Model'}
                <ChevronUp className={cn('w-3 h-3 transition-transform', isTaskModelDropdownOpen && 'rotate-180')} />
              </button>
              {isTaskModelDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsTaskModelDropdownOpen(false)} />
                  <div className={cn(
                    'absolute bottom-full left-0 mb-1 py-1 rounded-lg shadow-lg border z-50 min-w-[160px]',
                    isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'
                  )}>
                    {TASK_MODE_MODELS.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedTaskModel(model.id)
                          setIsTaskModelDropdownOpen(false)
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-xs text-left transition-colors',
                          selectedTaskModel === model.id
                            ? isDark ? 'bg-accent/20 text-accent' : 'bg-accent/10 text-accent'
                            : isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                        )}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (isTaskMode) {
                  handleTaskInstruction()
                } else if (selectedTool === 'image') {
                  if (chatInput.trim()) handleGenerateImage(chatInput.trim())
                } else {
                  handleSendChat()
                }
              }
            }}
            placeholder={
              isTaskMode
                ? '업무를 자유롭게 말씀하세요... (예: "경쟁사 분석해줘")'
                : selectedTool === 'image'
                  ? '어떤 이미지를 그릴까요? (예: "해변의 고양이", "사이버펑크 도시")'
                  : `${agent?.name}에게 메시지 보내기...`
            }
            className={cn(
              'flex-1 bg-transparent border-none outline-none text-sm py-1',
              'focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0',
              '!outline-none !ring-0',
              isDark ? 'text-white placeholder:text-zinc-500' : 'text-zinc-900 placeholder:text-zinc-400',
              isTaskMode && 'placeholder:text-accent/70',
              selectedTool === 'image' && 'placeholder:text-purple-400'
            )}
            style={{ outline: 'none', boxShadow: 'none' }}
            disabled={chatLoading || isAnalyzingTask || !!pendingTask || isGeneratingImage}
            autoFocus
          />

          {/* Prompt Assistant Button */}
          <button
            onClick={() => setShowPromptAssistant(true)}
            disabled={chatLoading || isAnalyzingTask || !!pendingTask || isGeneratingImage}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
              isDark
                ? 'bg-zinc-800 text-zinc-400 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 hover:text-purple-400'
                : 'bg-zinc-100 text-zinc-500 hover:bg-purple-50 hover:text-purple-500'
            )}
            title="프롬프트 어시스턴트 (대충 입력해도 찰떡같이!)"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (isTaskMode) {
                handleTaskInstruction()
              } else if (selectedTool === 'image') {
                if (chatInput.trim()) handleGenerateImage(chatInput.trim())
              } else {
                handleSendChat()
              }
            }}
            disabled={(!chatInput.trim() && !chatImage) || chatLoading || isAnalyzingTask || !!pendingTask || isGeneratingImage}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
              (chatInput.trim() || chatImage) && !chatLoading && !isAnalyzingTask && !pendingTask && !isGeneratingImage
                ? selectedTool === 'image'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                  : isTaskMode
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'bg-accent text-white hover:bg-accent/90'
                : isDark
                  ? 'bg-zinc-800 text-zinc-500'
                  : 'bg-zinc-100 text-zinc-400'
            )}
            title={selectedTool === 'image' ? '이미지 생성' : '전송'}
          >
            {isAnalyzingTask || isGeneratingImage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : selectedTool === 'image' ? (
              <Wand2 className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>

          {/* Voice Call Button */}
          <button
            onClick={() => {
              if (isVoiceCallActive) {
                endVoiceCall()
              } else if (!isVoiceConnecting) {
                startVoiceCall()
              }
            }}
            disabled={chatLoading || isAnalyzingTask || !!pendingTask}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
              isVoiceCallActive
                ? 'bg-red-500 text-white hover:bg-red-600'
                : isVoiceConnecting
                  ? 'bg-accent/50 text-white'
                  : isDark
                    ? 'hover:bg-zinc-800 text-zinc-400 hover:text-accent'
                    : 'hover:bg-zinc-100 text-zinc-500 hover:text-accent'
            )}
            title={isVoiceCallActive ? '통화 종료' : isVoiceConnecting ? '연결 중...' : '음성 통화'}
          >
            {isVoiceConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isVoiceCallActive ? (
              <PhoneOff className="w-4 h-4" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
          </button>

          {/* Mute Button */}
          {isVoiceCallActive && (
            <button
              onClick={toggleMute}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                isMuted
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : isListening
                    ? 'bg-green-500 text-white'
                    : isDark
                      ? 'hover:bg-zinc-800 text-zinc-400'
                      : 'hover:bg-zinc-100 text-zinc-500'
              )}
              title={isMuted ? '음소거 해제' : '음소거'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className={cn('w-4 h-4', isListening && 'animate-pulse')} />}
            </button>
          )}

          {/* Exit Button */}
          <button
            onClick={() => {
              if (isVoiceCallActive) endVoiceCall()
              onExit()
            }}
            disabled={chatLoading}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-red-400'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-red-500'
            )}
            title="나가기"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
