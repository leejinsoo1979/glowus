'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  Bot,
  User,
  Sparkles,
  Palette,
  Zap,
  ArrowLeft,
  Check,
  Upload,
  Loader2,
  Brain,
  MessageSquare,
  Volume2,
  Image as ImageIcon,
  X,
  Settings,
  Shield,
  Eye,
  Edit3,
  Trash2,
  Play,
  Globe,
  Database,
  Terminal,
  Mail,
  LayoutDashboard,
  Users,
  DollarSign,
  Network,
  Briefcase,
  Calendar,
  BarChart3,
  ChevronRight,
  Circle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

// ============================================
// Types
// ============================================

type CreationStep = 'profile' | 'llm' | 'personality' | 'permissions' | 'voice' | 'appearance' | 'review'

interface StepConfig {
  id: CreationStep
  label: string
  description: string
}

interface DataPermission {
  read: boolean
  write: boolean
  update: boolean
  delete: boolean
}

interface SuperAgentPermissions {
  pages: Record<string, boolean>
  data: DataPermission
  actions: Record<string, boolean>
  autoExecute: boolean
  systemSettings: boolean
  agentManagement: boolean
}

interface SuperAgentData {
  name: string
  description: string
  avatar_url: string | null
  llm_provider: string
  llm_model: string
  personality: string
  tone: string
  role: string
  user_title: string  // 🆕 사용자를 부르는 호칭
  capabilities: string[]
  permissions: SuperAgentPermissions
  voice_enabled: boolean
  voice_id: string
  voice_settings: { speed: number; pitch: number }
  chat_main_gif: string | null
  emotion_avatars: Record<string, string>
  theme_color: string
}

// ============================================
// Constants
// ============================================

const STEPS: StepConfig[] = [
  { id: 'profile', label: '프로필', description: '기본 정보' },
  { id: 'llm', label: 'LLM', description: '모델 선택' },
  { id: 'personality', label: '성격', description: '행동 설정' },
  { id: 'permissions', label: '권한', description: '접근 제어' },
  { id: 'voice', label: '음성', description: 'TTS 설정' },
  { id: 'appearance', label: '외형', description: '시각적 설정' },
  { id: 'review', label: '확인', description: '최종 검토' },
]

const LLM_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: '가장 강력한 모델' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '빠르고 저렴한 모델' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '고성능 모델' },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '최신 균형 모델' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '빠르고 스마트' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '가장 빠른 모델' },
    ]
  },
  {
    id: 'google',
    name: 'Google',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '최신 빠른 모델' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '고성능 모델' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '빠른 모델' },
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: '고성능 오픈소스' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: '초고속 추론' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'MoE 모델' },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '대화 최적화' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '추론 특화' },
    ]
  },
]

const PAGE_PERMISSIONS = [
  { id: 'dashboard', name: '대시보드', icon: LayoutDashboard },
  { id: 'agents', name: '에이전트', icon: Bot },
  { id: 'neural-map', name: '스킬 빌더', icon: Network },
  { id: 'messenger', name: '메신저', icon: MessageSquare },
  { id: 'finance', name: '재무', icon: DollarSign },
  { id: 'hr', name: '인사', icon: Users },
  { id: 'erp', name: 'ERP', icon: Briefcase },
  { id: 'calendar', name: '캘린더', icon: Calendar },
  { id: 'analytics', name: '분석', icon: BarChart3 },
  { id: 'settings', name: '설정', icon: Settings },
]

const ACTION_PERMISSIONS = [
  { id: 'web_search', name: '웹 검색', icon: Globe },
  { id: 'file_read', name: '파일 읽기', icon: Eye },
  { id: 'file_write', name: '파일 쓰기', icon: Edit3 },
  { id: 'file_delete', name: '파일 삭제', icon: Trash2 },
  { id: 'database', name: '데이터베이스', icon: Database },
  { id: 'api_call', name: 'API 호출', icon: Network },
  { id: 'code_execute', name: '코드 실행', icon: Terminal },
  { id: 'workflow_run', name: '워크플로우', icon: Play },
  { id: 'send_message', name: '메시지 전송', icon: Mail },
  { id: 'agent_control', name: '에이전트 제어', icon: Bot },
]

const PERSONALITY_PRESETS = [
  { id: 'friendly', label: '친근한' },
  { id: 'professional', label: '전문적인' },
  { id: 'creative', label: '창의적인' },
  { id: 'analytical', label: '분석적인' },
  { id: 'empathetic', label: '공감하는' },
  { id: 'concise', label: '간결한' },
]

const TONE_PRESETS = [
  { id: 'formal', label: '격식체' },
  { id: 'casual', label: '반말' },
  { id: 'polite', label: '존댓말' },
]

const ROLE_PRESETS = [
  { id: 'assistant', label: '비서', icon: User },
  { id: 'developer', label: '개발자', icon: Terminal },
  { id: 'analyst', label: '분석가', icon: BarChart3 },
  { id: 'writer', label: '작가', icon: Edit3 },
  { id: 'designer', label: '디자이너', icon: Palette },
  { id: 'custom', label: '직접 입력', icon: Settings },
]

const USER_TITLE_PRESETS = [
  { id: 'boss', label: '사장님' },
  { id: 'ceo', label: '대표님' },
  { id: 'director', label: '이사님' },
  { id: 'manager', label: '부장님' },
  { id: 'team_leader', label: '팀장님' },
  { id: 'senior', label: '선배님' },
  { id: 'name', label: '이름+님' },  // 실제 이름은 런타임에 대체
  { id: 'custom', label: '직접 입력' },
]

const VOICE_PRESETS = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'shimmer', label: 'Shimmer' },
]

const THEME_COLORS = [
  { id: 'slate', color: '#64748b' },
  { id: 'zinc', color: '#71717a' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'violet', color: '#8b5cf6' },
  { id: 'emerald', color: '#10b981' },
  { id: 'amber', color: '#f59e0b' },
]

// Default JARVIS mode permissions
const defaultPermissions: SuperAgentPermissions = {
  pages: Object.fromEntries(PAGE_PERMISSIONS.map(p => [p.id, true])),
  data: { read: true, write: true, update: true, delete: true },
  actions: Object.fromEntries(ACTION_PERMISSIONS.map(a => [a.id, true])),
  autoExecute: true,
  systemSettings: true,
  agentManagement: true,
}

const initialAgentData: SuperAgentData = {
  name: '',
  description: '',
  avatar_url: null,
  llm_provider: 'openai',
  llm_model: 'gpt-4o-mini',
  personality: 'professional',
  tone: 'polite',
  role: 'assistant',
  user_title: 'boss',  // 기본값: 사장님
  capabilities: [],
  permissions: defaultPermissions,
  voice_enabled: false,
  voice_id: 'nova',
  voice_settings: { speed: 1.0, pitch: 1.0 },
  chat_main_gif: null,
  emotion_avatars: {},
  theme_color: '#64748b',
}

// ============================================
// Main Component
// ============================================

export default function SuperAgentCreatorPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [currentStep, setCurrentStep] = useState<CreationStep>('profile')
  const [agentData, setAgentData] = useState<SuperAgentData>(initialAgentData)
  const [isSaving, setIsSaving] = useState(false)
  const [customRole, setCustomRole] = useState('')
  const [customUserTitle, setCustomUserTitle] = useState('')  // 🆕 직접 입력 호칭
  const [uploadingType, setUploadingType] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const gifInputRef = useRef<HTMLInputElement>(null)
  const emotionInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const updateAgent = (updates: Partial<SuperAgentData>) => {
    setAgentData(prev => ({ ...prev, ...updates }))
  }

  const goToStep = (step: CreationStep) => setCurrentStep(step)
  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
  }
  const goPrev = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  // Image upload handler
  const handleImageUpload = async (file: File, type: 'avatar' | 'gif' | 'emotion', emotion?: string) => {
    if (!file) return
    setUploadingType(type === 'emotion' ? `emotion-${emotion}` : type)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      if (emotion) formData.append('emotion', emotion)

      const res = await fetch('/api/agents/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')

      const data = await res.json()
      if (type === 'avatar') updateAgent({ avatar_url: data.url })
      else if (type === 'gif') updateAgent({ chat_main_gif: data.url })
      else if (type === 'emotion' && emotion) {
        updateAgent({ emotion_avatars: { ...agentData.emotion_avatars, [emotion]: data.url } })
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploadingType(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'gif' | 'emotion', emotion?: string) => {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file, type, emotion)
    e.target.value = ''
  }

  // Save handler
  const handleSave = async () => {
    if (!agentData.name.trim()) {
      alert('에이전트 이름을 입력해주세요')
      setCurrentStep('profile')
      return
    }

    setIsSaving(true)
    try {
      const isJarvisMode =
        Object.values(agentData.permissions.pages).every(v => v) &&
        Object.values(agentData.permissions.actions).every(v => v) &&
        Object.values(agentData.permissions.data).every(v => v) &&
        agentData.permissions.autoExecute &&
        agentData.permissions.systemSettings &&
        agentData.permissions.agentManagement

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentData.name,
          description: agentData.description,
          avatar_url: agentData.avatar_url,
          llm_provider: agentData.llm_provider,
          llm_model: agentData.llm_model,
          capabilities: [
            agentData.personality,
            agentData.tone,
            agentData.role === 'custom' ? customRole : agentData.role,
            ...agentData.capabilities,
            ...(isJarvisMode ? ['jarvis-mode', 'super-agent', 'full-access'] : ['super-agent']),
          ],
          // 🆕 호칭 정보 (user_title)
          user_title: agentData.user_title === 'custom' ? customUserTitle : agentData.user_title,
          workflow_nodes: [],
          workflow_edges: [],
          voice_settings: agentData.voice_enabled ? {
            voice_id: agentData.voice_id,
            speed: agentData.voice_settings.speed,
            pitch: agentData.voice_settings.pitch,
          } : null,
          chat_main_gif: agentData.chat_main_gif,
          emotion_avatars: agentData.emotion_avatars,
          status: 'ACTIVE',
          permissions: agentData.permissions,
          agent_type: 'super-agent',
        }),
      })

      if (res.ok) {
        const created = await res.json()
        router.push(`/dashboard-group/agents/${created.id}`)
      } else {
        throw new Error('Save failed')
      }
    } catch (error) {
      console.error('Failed to save agent:', error)
      alert('에이전트 저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  // Permission helpers
  const togglePagePermission = (pageId: string) => {
    updateAgent({ permissions: { ...agentData.permissions, pages: { ...agentData.permissions.pages, [pageId]: !agentData.permissions.pages[pageId] } } })
  }
  const toggleActionPermission = (actionId: string) => {
    updateAgent({ permissions: { ...agentData.permissions, actions: { ...agentData.permissions.actions, [actionId]: !agentData.permissions.actions[actionId] } } })
  }
  const toggleDataPermission = (key: keyof DataPermission) => {
    updateAgent({ permissions: { ...agentData.permissions, data: { ...agentData.permissions.data, [key]: !agentData.permissions.data[key] } } })
  }
  const setAllPermissions = (enabled: boolean) => {
    updateAgent({
      permissions: {
        pages: Object.fromEntries(PAGE_PERMISSIONS.map(p => [p.id, enabled])),
        data: { read: enabled, write: enabled, update: enabled, delete: enabled },
        actions: Object.fromEntries(ACTION_PERMISSIONS.map(a => [a.id, enabled])),
        autoExecute: enabled,
        systemSettings: enabled,
        agentManagement: enabled,
      }
    })
  }

  const isJarvisMode = Object.values(agentData.permissions.pages).every(v => v) &&
    Object.values(agentData.permissions.actions).every(v => v) &&
    Object.values(agentData.permissions.data).every(v => v) &&
    agentData.permissions.autoExecute &&
    agentData.permissions.systemSettings &&
    agentData.permissions.agentManagement

  // ============================================
  // Step Renderers
  // ============================================

  const renderProfileStep = () => (
    <div className="space-y-6">
      <div className="flex items-start gap-8">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'avatar')}
          />
          <div
            onClick={() => avatarInputRef.current?.click()}
            className={cn(
              'w-28 h-28 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden',
              isDark ? 'border-zinc-700 bg-zinc-800 hover:border-zinc-600' : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300',
              uploadingType === 'avatar' && 'opacity-50 pointer-events-none'
            )}
          >
            {uploadingType === 'avatar' ? (
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            ) : agentData.avatar_url ? (
              <img src={agentData.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Upload className="w-6 h-6 text-zinc-400" />
            )}
          </div>
          {agentData.avatar_url && (
            <button
              onClick={() => updateAgent({ avatar_url: null })}
              className="mt-2 text-sm text-zinc-500 hover:text-zinc-400"
            >
              삭제
            </button>
          )}
        </div>

        {/* Name & Description */}
        <div className="flex-1 space-y-6">
          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={agentData.name}
              onChange={(e) => updateAgent({ name: e.target.value })}
              placeholder="에이전트 이름을 입력하세요"
              className={cn(
                'w-full px-4 py-3 rounded-lg border transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-zinc-500'
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400'
              )}
            />
          </div>
          <div>
            <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              설명
            </label>
            <textarea
              value={agentData.description}
              onChange={(e) => updateAgent({ description: e.target.value })}
              placeholder="이 에이전트가 어떤 역할을 하는지 설명해주세요"
              rows={3}
              className={cn(
                'w-full px-4 py-3 rounded-lg border resize-none transition-colors',
                isDark
                  ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-zinc-500'
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400'
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderLLMStep = () => {
    const selectedProvider = LLM_PROVIDERS.find(p => p.id === agentData.llm_provider)

    return (
      <div className="space-y-6">
        {/* Provider Selection */}
        <div>
          <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            LLM 제공자
          </label>
          <div className="grid grid-cols-5 gap-2">
            {LLM_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => {
                  updateAgent({
                    llm_provider: provider.id,
                    llm_model: provider.models[0].id
                  })
                }}
                className={cn(
                  'px-4 py-3 rounded-lg font-medium transition-colors text-center',
                  agentData.llm_provider === provider.id
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
              >
                {provider.name}
              </button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            모델
          </label>
          <div className="space-y-2">
            {selectedProvider?.models.map((model) => (
              <button
                key={model.id}
                onClick={() => updateAgent({ llm_model: model.id })}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors text-left',
                  agentData.llm_model === model.id
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
              >
                <div>
                  <div className="font-medium">{model.name}</div>
                  <div className={cn('text-sm', agentData.llm_model === model.id ? 'text-zinc-300' : 'text-zinc-500')}>
                    {model.description}
                  </div>
                </div>
                {agentData.llm_model === model.id && (
                  <Check className="w-5 h-5 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderPersonalityStep = () => (
    <div className="space-y-6">
      {/* Personality */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          성격
        </label>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateAgent({ personality: preset.id })}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                agentData.personality === preset.id
                  ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          말투
        </label>
        <div className="flex gap-2">
          {TONE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateAgent({ tone: preset.id })}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                agentData.tone === preset.id
                  ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Role */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          역할
        </label>
        <div className="grid grid-cols-3 gap-3">
          {ROLE_PRESETS.map((preset) => {
            const Icon = preset.icon
            return (
              <button
                key={preset.id}
                onClick={() => updateAgent({ role: preset.id })}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
                  agentData.role === preset.id
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                    : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                )}
              >
                <Icon className="w-5 h-5" />
                {preset.label}
              </button>
            )
          })}
        </div>
        {agentData.role === 'custom' && (
          <input
            type="text"
            value={customRole}
            onChange={(e) => setCustomRole(e.target.value)}
            placeholder="역할을 입력하세요"
            className={cn(
              'mt-4 w-full px-4 py-3 rounded-lg border transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400'
            )}
          />
        )}
      </div>

      {/* 🆕 User Title (호칭) */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          나를 부르는 호칭
        </label>
        <p className={cn('text-sm mb-3', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          에이전트가 당신을 어떻게 부를지 선택하세요
        </p>
        <div className="flex flex-wrap gap-2">
          {USER_TITLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateAgent({ user_title: preset.id })}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                agentData.user_title === preset.id
                  ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {agentData.user_title === 'custom' && (
          <input
            type="text"
            value={customUserTitle}
            onChange={(e) => setCustomUserTitle(e.target.value)}
            placeholder="예: 진수님, 대장님, 선생님..."
            className={cn(
              'mt-4 w-full px-4 py-3 rounded-lg border transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400'
            )}
          />
        )}
      </div>
    </div>
  )

  const renderPermissionsStep = () => (
    <div className="space-y-6">
      {/* JARVIS Mode Toggle */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border',
        isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
      )}>
        <div>
          <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>전체 접근 모드</div>
          <div className={cn('text-sm mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-500')}>모든 권한을 활성화합니다</div>
        </div>
        <button
          onClick={() => setAllPermissions(!isJarvisMode)}
          className={cn(
            'w-12 h-6 rounded-full transition-colors relative',
            isJarvisMode ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
          )}
        >
          <div className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
            isJarvisMode ? 'translate-x-7' : 'translate-x-1'
          )} />
        </button>
      </div>

      {/* Page Permissions */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          페이지 접근
        </label>
        <div className="grid grid-cols-5 gap-2">
          {PAGE_PERMISSIONS.map((perm) => {
            const Icon = perm.icon
            const enabled = agentData.permissions.pages[perm.id]
            return (
              <button
                key={perm.id}
                onClick={() => togglePagePermission(perm.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg text-sm transition-colors',
                  enabled
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-900'
                    : isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-50 text-zinc-400'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate w-full text-center text-xs">{perm.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Data Permissions */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          데이터 권한
        </label>
        <div className="flex gap-2">
          {(['read', 'write', 'update', 'delete'] as const).map((op) => {
            const enabled = agentData.permissions.data[op]
            const labels: Record<string, string> = { read: '읽기', write: '쓰기', update: '수정', delete: '삭제' }
            return (
              <button
                key={op}
                onClick={() => toggleDataPermission(op)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors',
                  enabled
                    ? op === 'delete' ? 'bg-red-500/20 text-red-400' : isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-900'
                    : isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-50 text-zinc-400'
                )}
              >
                {labels[op]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action Permissions */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          실행 권한
        </label>
        <div className="grid grid-cols-5 gap-2">
          {ACTION_PERMISSIONS.map((perm) => {
            const Icon = perm.icon
            const enabled = agentData.permissions.actions[perm.id]
            return (
              <button
                key={perm.id}
                onClick={() => toggleActionPermission(perm.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-lg text-sm transition-colors',
                  enabled
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-900'
                    : isDark ? 'bg-zinc-800/50 text-zinc-500' : 'bg-zinc-50 text-zinc-400'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate w-full text-center text-xs">{perm.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderVoiceStep = () => (
    <div className="space-y-6">
      {/* Voice Toggle */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border',
        isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
      )}>
        <div>
          <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>음성 출력</div>
          <div className={cn('text-sm mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-500')}>텍스트를 음성으로 변환합니다</div>
        </div>
        <button
          onClick={() => updateAgent({ voice_enabled: !agentData.voice_enabled })}
          className={cn(
            'w-12 h-6 rounded-full transition-colors relative',
            agentData.voice_enabled ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
          )}
        >
          <div className={cn(
            'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
            agentData.voice_enabled ? 'translate-x-7' : 'translate-x-1'
          )} />
        </button>
      </div>

      {agentData.voice_enabled && (
        <>
          {/* Voice Selection */}
          <div>
            <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
              음성 선택
            </label>
            <div className="grid grid-cols-3 gap-3">
              {VOICE_PRESETS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => updateAgent({ voice_id: voice.id })}
                  className={cn(
                    'px-4 py-3 rounded-lg font-medium transition-colors',
                    agentData.voice_id === voice.id
                      ? isDark ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-white'
                      : isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}
                >
                  {voice.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Settings */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                속도: {agentData.voice_settings.speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={agentData.voice_settings.speed}
                onChange={(e) => updateAgent({ voice_settings: { ...agentData.voice_settings, speed: parseFloat(e.target.value) } })}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                피치: {agentData.voice_settings.pitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={agentData.voice_settings.pitch}
                onChange={(e) => updateAgent({ voice_settings: { ...agentData.voice_settings, pitch: parseFloat(e.target.value) } })}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )

  const renderAppearanceStep = () => (
    <div className="space-y-6">
      {/* Theme Color */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          테마 색상
        </label>
        <div className="flex gap-3">
          {THEME_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => updateAgent({ theme_color: color.color })}
              className={cn(
                'w-10 h-10 rounded-lg transition-all',
                agentData.theme_color === color.color && 'ring-2 ring-offset-2',
                isDark ? 'ring-offset-zinc-900' : 'ring-offset-white'
              )}
              style={{ backgroundColor: color.color, '--tw-ring-color': color.color } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* GIF Upload */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          채팅 애니메이션 (선택사항)
        </label>
        <input
          ref={gifInputRef}
          type="file"
          accept="image/gif,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'gif')}
        />
        <div
          onClick={() => gifInputRef.current?.click()}
          className={cn(
            'h-40 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors',
            isDark ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-200 hover:border-zinc-300',
            uploadingType === 'gif' && 'opacity-50 pointer-events-none'
          )}
        >
          {uploadingType === 'gif' ? (
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          ) : agentData.chat_main_gif ? (
            <img src={agentData.chat_main_gif} alt="" className="h-full object-contain" />
          ) : (
            <div className="text-center">
              <ImageIcon className="w-6 h-6 mx-auto text-zinc-400 mb-2" />
              <span className="text-sm text-zinc-500">GIF 업로드</span>
            </div>
          )}
        </div>
        {agentData.chat_main_gif && (
          <button onClick={() => updateAgent({ chat_main_gif: null })} className="mt-2 text-sm text-zinc-500 hover:text-zinc-400">
            삭제
          </button>
        )}
      </div>

      {/* Emotion Avatars */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          감정 아바타 (선택사항)
        </label>
        <div className="grid grid-cols-4 gap-3">
          {(['happy', 'sad', 'angry', 'surprised'] as const).map((emotion) => {
            const labels: Record<string, string> = { happy: '기쁨', sad: '슬픔', angry: '화남', surprised: '놀람' }
            const hasImage = agentData.emotion_avatars[emotion]
            const isUploading = uploadingType === `emotion-${emotion}`

            return (
              <div key={emotion} className="relative">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  ref={(el) => { emotionInputRefs.current[emotion] = el }}
                  onChange={(e) => handleFileSelect(e, 'emotion', emotion)}
                />
                <div
                  onClick={() => emotionInputRefs.current[emotion]?.click()}
                  className={cn(
                    'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden',
                    isDark ? 'border-zinc-700 hover:border-zinc-600' : 'border-zinc-200 hover:border-zinc-300',
                    isUploading && 'opacity-50 pointer-events-none'
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                  ) : hasImage ? (
                    <img src={hasImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm text-zinc-500">{labels[emotion]}</span>
                  )}
                </div>
                {hasImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const newEmotions = { ...agentData.emotion_avatars }
                      delete newEmotions[emotion]
                      updateAgent({ emotion_avatars: newEmotions })
                    }}
                    className={cn(
                      'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center',
                      isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-300 text-zinc-600'
                    )}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderReviewStep = () => {
    const personalityLabels: Record<string, string> = { friendly: '친근한', professional: '전문적인', creative: '창의적인', analytical: '분석적인', empathetic: '공감하는', concise: '간결한' }
    const roleLabels: Record<string, string> = { assistant: '비서', developer: '개발자', analyst: '분석가', writer: '작가', designer: '디자이너', custom: '직접 입력' }
    const userTitleLabels: Record<string, string> = { boss: '사장님', ceo: '대표님', director: '이사님', manager: '부장님', team_leader: '팀장님', senior: '선배님', name: '이름+님', custom: customUserTitle || '직접 입력' }
    const pageLabels: Record<string, string> = { dashboard: '대시보드', agents: '에이전트', 'neural-map': '스킬 빌더', messenger: '메신저', finance: '재무', hr: '인사', erp: 'ERP', calendar: '캘린더', analytics: '분석', settings: '설정' }

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200')}>
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-medium"
              style={{ backgroundColor: agentData.theme_color }}
            >
              {agentData.avatar_url ? (
                <img src={agentData.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
              ) : (
                agentData.name.charAt(0).toUpperCase() || 'A'
              )}
            </div>
            <div>
              <div className={cn('text-lg font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                {agentData.name || '이름 없음'}
              </div>
              <div className={cn('text-sm mt-1', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                {agentData.description || '설명 없음'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>LLM</span>
              <div className={cn('font-medium mt-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                {LLM_PROVIDERS.find(p => p.id === agentData.llm_provider)?.name} / {LLM_PROVIDERS.find(p => p.id === agentData.llm_provider)?.models.find(m => m.id === agentData.llm_model)?.name}
              </div>
            </div>
            <div>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>성격</span>
              <div className={cn('font-medium mt-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{personalityLabels[agentData.personality] || agentData.personality}</div>
            </div>
            <div>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>역할</span>
              <div className={cn('font-medium mt-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{agentData.role === 'custom' ? customRole : roleLabels[agentData.role] || agentData.role}</div>
            </div>
            <div>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>호칭</span>
              <div className={cn('font-medium mt-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{userTitleLabels[agentData.user_title] || agentData.user_title}</div>
            </div>
            <div>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>음성</span>
              <div className={cn('font-medium mt-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{agentData.voice_enabled ? agentData.voice_id : '비활성'}</div>
            </div>
            <div>
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>접근 권한</span>
              <div className={cn('font-medium mt-1', isDark ? 'text-zinc-300' : 'text-zinc-700')}>{isJarvisMode ? '전체 접근' : '제한됨'}</div>
            </div>
          </div>
        </div>

        {/* Permissions Summary */}
        <div className={cn('p-5 rounded-xl border', isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200')}>
          <div className={cn('text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            활성화된 권한
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(agentData.permissions.pages).filter(([, v]) => v).map(([k]) => (
              <span key={k} className={cn('px-3 py-1.5 rounded-lg text-sm', isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-200 text-zinc-600')}>
                {pageLabels[k] || k}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-zinc-900' : 'bg-zinc-50')}>
      {/* Header */}
      <header className={cn('sticky top-0 z-10 border-b', isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200')}>
        <div className="h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100')}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>새 에이전트</h1>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !agentData.name.trim()}
            className="h-8 px-3"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : '생성'}
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Step Navigation */}
        <nav className="mb-6">
          <div className="flex items-center">
            {STEPS.map((step, index) => {
              const isActive = step.id === currentStep
              const isCompleted = index < currentStepIndex
              const isLast = index === STEPS.length - 1
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => goToStep(step.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap',
                      isActive
                        ? isDark ? 'bg-zinc-800 text-white' : 'bg-zinc-200 text-zinc-900'
                        : isCompleted
                          ? isDark ? 'text-emerald-400 hover:bg-zinc-800/50' : 'text-emerald-600 hover:bg-zinc-100'
                          : isDark ? 'text-zinc-500 hover:bg-zinc-800/50' : 'text-zinc-400 hover:bg-zinc-100'
                    )}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0',
                      isActive
                        ? isDark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
                        : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-300 text-zinc-500'
                    )}>
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                    </span>
                    <span className="font-medium">{step.label}</span>
                  </button>
                  {!isLast && (
                    <ChevronRight className={cn('w-4 h-4 mx-1', isDark ? 'text-zinc-600' : 'text-zinc-300')} />
                  )}
                </div>
              )
            })}
          </div>
        </nav>

        {/* Content */}
        <div className={cn('p-6 rounded-xl border', isDark ? 'bg-zinc-800/30 border-zinc-800' : 'bg-white border-zinc-200')}>
          {currentStep === 'profile' && renderProfileStep()}
          {currentStep === 'llm' && renderLLMStep()}
          {currentStep === 'personality' && renderPersonalityStep()}
          {currentStep === 'permissions' && renderPermissionsStep()}
          {currentStep === 'voice' && renderVoiceStep()}
          {currentStep === 'appearance' && renderAppearanceStep()}
          {currentStep === 'review' && renderReviewStep()}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={currentStepIndex === 0}
            className="h-10 px-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            이전
          </Button>
          {currentStepIndex < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={goNext}
              className="h-10 px-4"
            >
              다음
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !agentData.name.trim()}
              className="h-10 px-4"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              에이전트 생성
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
