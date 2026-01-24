'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  Bot,
  User,
  Sparkles,
  Mic,
  Palette,
  Zap,
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Loader2,
  Brain,
  MessageSquare,
  Volume2,
  Image as ImageIcon,
  Plus,
  X,
  Settings,
  Save,
  Shield,
  Key,
  Eye,
  Edit3,
  Trash2,
  Play,
  Globe,
  FileText,
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
  Lock,
  Unlock,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useThemeStore, accentColors } from '@/stores/themeStore'

// ============================================
// Types
// ============================================

type CreationStep = 'profile' | 'personality' | 'permissions' | 'voice' | 'appearance' | 'review'

interface StepConfig {
  id: CreationStep
  label: string
  icon: React.ElementType
  description: string
}


// Permission Types for Super Agent (JARVIS-like control)
interface PagePermission {
  id: string
  name: string
  icon: React.ElementType
  enabled: boolean
  description: string
}

interface DataPermission {
  read: boolean
  write: boolean
  update: boolean
  delete: boolean
}

interface ActionPermission {
  id: string
  name: string
  icon: React.ElementType
  enabled: boolean
  description: string
  dangerous?: boolean // 위험한 작업 표시
}

interface SuperAgentPermissions {
  // 페이지 접근 권한
  pages: Record<string, boolean>
  // 데이터 CRUD 권한
  data: DataPermission
  // 액션/도구 권한
  actions: Record<string, boolean>
  // 즉시 실행 권한 (유저 확인 없이 실행 가능)
  autoExecute: boolean
  // 시스템 설정 변경 권한
  systemSettings: boolean
  // 다른 에이전트 관리 권한
  agentManagement: boolean
}

interface SuperAgentData {
  // Profile
  name: string
  description: string
  avatar_url: string | null

  // Personality
  personality: string
  tone: string
  role: string

  // Capabilities (도구/액션 권한에서 파생됨)
  capabilities: string[]

  // Permissions (JARVIS-like full control)
  permissions: SuperAgentPermissions

  // Voice
  voice_enabled: boolean
  voice_id: string
  voice_settings: {
    speed: number
    pitch: number
  }

  // Appearance
  chat_main_gif: string | null
  emotion_avatars: Record<string, string>
  theme_color: string
}

// ============================================
// Constants
// ============================================

const STEPS: StepConfig[] = [
  { id: 'profile', label: '기본 정보', icon: User, description: '이름과 설명' },
  { id: 'personality', label: '성격', icon: Brain, description: '성격과 말투' },
  { id: 'permissions', label: '권한', icon: Shield, description: 'JARVIS 레벨 권한' },
  { id: 'voice', label: '음성', icon: Volume2, description: '음성 설정' },
  { id: 'appearance', label: '외형', icon: Palette, description: '아바타와 테마' },
  { id: 'review', label: '완료', icon: Check, description: '최종 확인' },
]

// Page/Menu Access Permissions
const PAGE_PERMISSIONS: PagePermission[] = [
  { id: 'dashboard', name: '대시보드', icon: LayoutDashboard, enabled: true, description: '메인 대시보드 접근' },
  { id: 'agents', name: '에이전트 라이브러리', icon: Bot, enabled: true, description: '에이전트 목록 및 관리' },
  { id: 'neural-map', name: '스킬 빌더', icon: Network, enabled: true, description: '워크플로우 생성/편집' },
  { id: 'messenger', name: '메신저', icon: MessageSquare, enabled: true, description: '채팅 및 통신' },
  { id: 'finance', name: '재무관리', icon: DollarSign, enabled: true, description: '거래내역, 예산, 재무분석' },
  { id: 'hr', name: '인사관리', icon: Users, enabled: true, description: '직원정보, 급여, 근태' },
  { id: 'erp', name: 'ERP', icon: Briefcase, enabled: true, description: '전사적 자원관리' },
  { id: 'calendar', name: '캘린더', icon: Calendar, enabled: true, description: '일정 관리' },
  { id: 'analytics', name: '분석', icon: BarChart3, enabled: true, description: '데이터 분석 및 리포트' },
  { id: 'settings', name: '설정', icon: Settings, enabled: true, description: '시스템 설정' },
]

// Action/Tool Permissions
const ACTION_PERMISSIONS: ActionPermission[] = [
  { id: 'web_search', name: '웹 검색', icon: Globe, enabled: true, description: '인터넷 검색 및 정보 수집', dangerous: false },
  { id: 'file_read', name: '파일 읽기', icon: Eye, enabled: true, description: '로컬 파일 읽기 권한', dangerous: false },
  { id: 'file_write', name: '파일 쓰기', icon: Edit3, enabled: true, description: '파일 생성 및 수정', dangerous: true },
  { id: 'file_delete', name: '파일 삭제', icon: Trash2, enabled: true, description: '파일 삭제 권한', dangerous: true },
  { id: 'database', name: '데이터베이스', icon: Database, enabled: true, description: 'DB 직접 접근 및 쿼리', dangerous: true },
  { id: 'api_call', name: 'API 호출', icon: Network, enabled: true, description: '외부 API 호출', dangerous: false },
  { id: 'code_execute', name: '코드 실행', icon: Terminal, enabled: true, description: '코드/스크립트 실행', dangerous: true },
  { id: 'workflow_run', name: '워크플로우 실행', icon: Play, enabled: true, description: '스킬/워크플로우 자동 실행', dangerous: false },
  { id: 'send_message', name: '메시지 전송', icon: Mail, enabled: true, description: '이메일/알림 전송', dangerous: false },
  { id: 'agent_control', name: '에이전트 제어', icon: Bot, enabled: true, description: '다른 에이전트 관리', dangerous: true },
]

const PERSONALITY_PRESETS = [
  { id: 'friendly', label: '친근한', emoji: '😊', description: '편안하고 친근한 대화 스타일' },
  { id: 'professional', label: '전문적인', emoji: '💼', description: '정확하고 전문적인 응답' },
  { id: 'creative', label: '창의적인', emoji: '🎨', description: '독창적이고 영감을 주는 스타일' },
  { id: 'analytical', label: '분석적인', emoji: '📊', description: '논리적이고 데이터 기반 접근' },
  { id: 'empathetic', label: '공감하는', emoji: '💝', description: '감정을 이해하고 공감하는 스타일' },
  { id: 'humorous', label: '유머러스', emoji: '😄', description: '위트있고 재미있는 대화' },
]

const TONE_PRESETS = [
  { id: 'formal', label: '격식체', description: '~합니다, ~입니다' },
  { id: 'casual', label: '반말', description: '~해, ~야' },
  { id: 'polite', label: '존댓말', description: '~해요, ~이에요' },
]

const ROLE_PRESETS = [
  { id: 'assistant', label: '개인 비서', icon: User, description: '일정 관리, 할일 추적' },
  { id: 'developer', label: '개발자', icon: Zap, description: '코딩, 디버깅, 코드 리뷰' },
  { id: 'analyst', label: '데이터 분석가', icon: Brain, description: '데이터 분석, 인사이트 도출' },
  { id: 'writer', label: '작가', icon: MessageSquare, description: '콘텐츠 작성, 편집' },
  { id: 'designer', label: '디자이너', icon: Palette, description: 'UI/UX, 디자인 피드백' },
  { id: 'custom', label: '직접 입력', icon: Settings, description: '커스텀 역할 정의' },
]

const VOICE_PRESETS = [
  { id: 'alloy', label: 'Alloy', description: '중성적이고 균형 잡힌 목소리' },
  { id: 'echo', label: 'Echo', description: '따뜻하고 자연스러운 남성 목소리' },
  { id: 'fable', label: 'Fable', description: '표현력 있는 영국식 억양' },
  { id: 'onyx', label: 'Onyx', description: '깊고 권위 있는 목소리' },
  { id: 'nova', label: 'Nova', description: '밝고 활기찬 여성 목소리' },
  { id: 'shimmer', label: 'Shimmer', description: '부드럽고 차분한 여성 목소리' },
]

const THEME_COLORS = [
  { id: 'violet', color: '#8b5cf6', label: '바이올렛' },
  { id: 'blue', color: '#3b82f6', label: '블루' },
  { id: 'green', color: '#22c55e', label: '그린' },
  { id: 'orange', color: '#f97316', label: '오렌지' },
  { id: 'pink', color: '#ec4899', label: '핑크' },
  { id: 'cyan', color: '#06b6d4', label: '시안' },
]

// ============================================
// Initial State
// ============================================

// Default permissions - JARVIS mode (all enabled)
const defaultPermissions: SuperAgentPermissions = {
  pages: Object.fromEntries(PAGE_PERMISSIONS.map(p => [p.id, true])),
  data: { read: true, write: true, update: true, delete: true },
  actions: Object.fromEntries(ACTION_PERMISSIONS.map(a => [a.id, true])),
  autoExecute: true, // 즉시 실행 활성화
  systemSettings: true,
  agentManagement: true,
}

const initialAgentData: SuperAgentData = {
  name: '',
  description: '',
  avatar_url: null,
  personality: 'friendly',
  tone: 'polite',
  role: 'assistant',
  capabilities: [],
  permissions: defaultPermissions,
  voice_enabled: false,
  voice_id: 'nova',
  voice_settings: { speed: 1.0, pitch: 1.0 },
  chat_main_gif: null,
  emotion_avatars: {},
  theme_color: '#8b5cf6',
}

// ============================================
// Main Component
// ============================================

export default function SuperAgentCreatorPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { accentColor } = useThemeStore()
  const isDark = theme === 'dark'

  const [currentStep, setCurrentStep] = useState<CreationStep>('profile')
  const [agentData, setAgentData] = useState<SuperAgentData>(initialAgentData)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [customRole, setCustomRole] = useState('')

  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)


  const updateAgent = (updates: Partial<SuperAgentData>) => {
    setAgentData(prev => ({ ...prev, ...updates }))
  }

  const goToStep = (step: CreationStep) => {
    setCurrentStep(step)
  }

  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goPrev = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const handleSave = async () => {
    if (!agentData.name.trim()) {
      alert('에이전트 이름을 입력해주세요')
      setCurrentStep('profile')
      return
    }

    setIsSaving(true)
    try {
      // Check if JARVIS mode is enabled
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
          capabilities: [
            agentData.personality,
            agentData.tone,
            agentData.role === 'custom' ? customRole : agentData.role,
            ...agentData.capabilities,
            // Add JARVIS mode capability if all permissions enabled
            ...(isJarvisMode ? ['jarvis-mode', 'super-agent', 'full-access'] : ['super-agent']),
          ],
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
          // JARVIS-level permissions
          permissions: agentData.permissions,
          // Agent type marker
          agent_type: 'super-agent',
        }),
      })

      if (res.ok) {
        const created = await res.json()
        router.push(`/dashboard-group/agents/${created.id}`)
      } else {
        throw new Error('저장 실패')
      }
    } catch (error) {
      console.error('Failed to save agent:', error)
      alert('저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }


  // ============================================
  // Step Content Renderers
  // ============================================

  const renderProfileStep = () => (
    <div className="space-y-6">
      {/* Avatar Upload */}
      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            'w-32 h-32 rounded-3xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:scale-105',
            isDark ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50' : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50'
          )}
          onClick={() => {/* TODO: 이미지 업로드 */}}
        >
          {agentData.avatar_url ? (
            <img src={agentData.avatar_url} alt="Avatar" className="w-full h-full rounded-3xl object-cover" />
          ) : (
            <div className="text-center">
              <Upload className={cn('w-8 h-8 mx-auto mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>아바타 업로드</span>
            </div>
          )}
        </div>
        <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          권장: 512x512px, PNG 또는 JPG
        </p>
      </div>

      {/* Name Input */}
      <div>
        <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={agentData.name}
          onChange={(e) => updateAgent({ name: e.target.value })}
          placeholder="슈퍼 에이전트 이름"
          className={cn(
            'w-full px-4 py-3 rounded-xl border text-lg font-medium transition-all',
            isDark
              ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500 focus:border-accent'
              : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-accent'
          )}
        />
      </div>

      {/* Description Input */}
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
            'w-full px-4 py-3 rounded-xl border resize-none transition-all',
            isDark
              ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500 focus:border-accent'
              : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-accent'
          )}
        />
      </div>
    </div>
  )

  const renderPersonalityStep = () => (
    <div className="space-y-8">
      {/* Personality Selection */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          성격
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PERSONALITY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateAgent({ personality: preset.id })}
              className={cn(
                'p-4 rounded-xl border text-left transition-all',
                agentData.personality === preset.id
                  ? 'border-accent bg-accent/10'
                  : isDark
                    ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
              )}
            >
              <div className="text-2xl mb-2">{preset.emoji}</div>
              <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{preset.label}</div>
              <div className={cn('text-xs mt-1', isDark ? 'text-zinc-500' : 'text-zinc-500')}>{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tone Selection */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          말투
        </label>
        <div className="flex gap-3">
          {TONE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateAgent({ tone: preset.id })}
              className={cn(
                'flex-1 p-4 rounded-xl border text-center transition-all',
                agentData.tone === preset.id
                  ? 'border-accent bg-accent/10'
                  : isDark
                    ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
              )}
            >
              <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{preset.label}</div>
              <div className={cn('text-xs mt-1', isDark ? 'text-zinc-500' : 'text-zinc-500')}>{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Role Selection */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          역할
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ROLE_PRESETS.map((preset) => {
            const Icon = preset.icon
            return (
              <button
                key={preset.id}
                onClick={() => updateAgent({ role: preset.id })}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  agentData.role === preset.id
                    ? 'border-accent bg-accent/10'
                    : isDark
                      ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                      : 'border-zinc-200 hover:border-zinc-300 bg-white'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-2', agentData.role === preset.id ? 'text-accent' : isDark ? 'text-zinc-400' : 'text-zinc-500')} />
                <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{preset.label}</div>
                <div className={cn('text-xs mt-1', isDark ? 'text-zinc-500' : 'text-zinc-500')}>{preset.description}</div>
              </button>
            )
          })}
        </div>

        {/* Custom Role Input */}
        {agentData.role === 'custom' && (
          <div className="mt-4">
            <input
              type="text"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="커스텀 역할을 입력하세요"
              className={cn(
                'w-full px-4 py-3 rounded-xl border transition-all',
                isDark
                  ? 'bg-zinc-800/50 border-zinc-700 text-white placeholder-zinc-500'
                  : 'bg-white border-zinc-200 text-zinc-900 placeholder-zinc-400'
              )}
            />
          </div>
        )}
      </div>
    </div>
  )


  // Helper functions for permissions
  const togglePagePermission = (pageId: string) => {
    const newPages = { ...agentData.permissions.pages, [pageId]: !agentData.permissions.pages[pageId] }
    updateAgent({ permissions: { ...agentData.permissions, pages: newPages } })
  }

  const toggleActionPermission = (actionId: string) => {
    const newActions = { ...agentData.permissions.actions, [actionId]: !agentData.permissions.actions[actionId] }
    updateAgent({ permissions: { ...agentData.permissions, actions: newActions } })
  }

  const toggleDataPermission = (key: keyof DataPermission) => {
    const newData = { ...agentData.permissions.data, [key]: !agentData.permissions.data[key] }
    updateAgent({ permissions: { ...agentData.permissions, data: newData } })
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

  const renderPermissionsStep = () => {
    const allPagesEnabled = Object.values(agentData.permissions.pages).every(v => v)
    const allActionsEnabled = Object.values(agentData.permissions.actions).every(v => v)
    const allDataEnabled = Object.values(agentData.permissions.data).every(v => v)
    const isJarvisMode = allPagesEnabled && allActionsEnabled && allDataEnabled &&
      agentData.permissions.autoExecute && agentData.permissions.systemSettings && agentData.permissions.agentManagement

    return (
      <div className="space-y-8">
        {/* JARVIS Mode Toggle */}
        <div className={cn(
          'p-5 rounded-2xl border-2 transition-all',
          isJarvisMode
            ? 'border-accent bg-accent/10'
            : isDark ? 'border-zinc-700 bg-zinc-800/50' : 'border-zinc-200 bg-white'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl',
                isJarvisMode ? 'bg-accent text-white' : isDark ? 'bg-zinc-700' : 'bg-zinc-100'
              )}>
                {isJarvisMode ? <Unlock className="w-7 h-7" /> : <Lock className="w-7 h-7" />}
              </div>
              <div>
                <h3 className={cn('text-lg font-bold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                  JARVIS 모드
                  {isJarvisMode && <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white">활성화</span>}
                </h3>
                <p className={cn('text-sm mt-0.5', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  모든 권한 부여 - 읽기, 쓰기, 실행 모두 가능
                </p>
              </div>
            </div>
            <button
              onClick={() => setAllPermissions(!isJarvisMode)}
              className={cn(
                'px-5 py-2.5 rounded-xl font-medium transition-all',
                isJarvisMode
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : isDark
                    ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              {isJarvisMode ? '전체 해제' : '전체 활성화'}
            </button>
          </div>
        </div>

        {/* Auto Execute Toggle */}
        <div className={cn(
          'flex items-center justify-between p-4 rounded-xl border',
          agentData.permissions.autoExecute
            ? 'border-green-500/50 bg-green-500/10'
            : isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
        )}>
          <div className="flex items-center gap-3">
            <Play className={cn('w-6 h-6', agentData.permissions.autoExecute ? 'text-green-500' : isDark ? 'text-zinc-500' : 'text-zinc-400')} />
            <div>
              <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                즉시 실행 모드
              </div>
              <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                사용자 확인 없이 작업 즉시 실행 (시키면 바로 실행)
              </div>
            </div>
          </div>
          <button
            onClick={() => updateAgent({
              permissions: { ...agentData.permissions, autoExecute: !agentData.permissions.autoExecute }
            })}
            className={cn(
              'w-14 h-8 rounded-full transition-colors relative',
              agentData.permissions.autoExecute ? 'bg-green-500' : isDark ? 'bg-zinc-700' : 'bg-zinc-200'
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-full bg-white absolute top-1 transition-all shadow-sm',
              agentData.permissions.autoExecute ? 'right-1' : 'left-1'
            )} />
          </button>
        </div>

        {/* Page/Menu Access Permissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                페이지 접근 권한
              </h4>
              <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                에이전트가 열람/조작할 수 있는 메뉴
              </p>
            </div>
            <button
              onClick={() => {
                const newState = !allPagesEnabled
                const newPages = Object.fromEntries(PAGE_PERMISSIONS.map(p => [p.id, newState]))
                updateAgent({ permissions: { ...agentData.permissions, pages: newPages } })
              }}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg transition-all',
                allPagesEnabled
                  ? 'bg-accent/20 text-accent'
                  : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              )}
            >
              {allPagesEnabled ? '모두 해제' : '모두 선택'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {PAGE_PERMISSIONS.map((page) => {
              const Icon = page.icon
              const isEnabled = agentData.permissions.pages[page.id]
              return (
                <button
                  key={page.id}
                  onClick={() => togglePagePermission(page.id)}
                  className={cn(
                    'p-3 rounded-xl border text-center transition-all',
                    isEnabled
                      ? 'border-accent bg-accent/10 text-accent'
                      : isDark
                        ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50 text-zinc-400'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-500'
                  )}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1.5" />
                  <div className="text-xs font-medium truncate">{page.name}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Data CRUD Permissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                데이터 권한 (CRUD)
              </h4>
              <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                읽기, 쓰기, 수정, 삭제 권한
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { key: 'read' as const, label: '읽기', icon: Eye, color: 'blue' },
              { key: 'write' as const, label: '쓰기', icon: Edit3, color: 'green' },
              { key: 'update' as const, label: '수정', icon: Settings, color: 'yellow' },
              { key: 'delete' as const, label: '삭제', icon: Trash2, color: 'red' },
            ].map((perm) => {
              const Icon = perm.icon
              const isEnabled = agentData.permissions.data[perm.key]
              const colorClass = perm.color === 'blue' ? 'text-blue-500 bg-blue-500/10 border-blue-500/50'
                : perm.color === 'green' ? 'text-green-500 bg-green-500/10 border-green-500/50'
                : perm.color === 'yellow' ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50'
                : 'text-red-500 bg-red-500/10 border-red-500/50'

              return (
                <button
                  key={perm.key}
                  onClick={() => toggleDataPermission(perm.key)}
                  className={cn(
                    'p-4 rounded-xl border text-center transition-all',
                    isEnabled
                      ? colorClass
                      : isDark
                        ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50 text-zinc-400'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-500'
                  )}
                >
                  <Icon className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">{perm.label}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Action/Tool Permissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                도구/액션 권한
              </h4>
              <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                실행 가능한 도구와 작업
              </p>
            </div>
            <button
              onClick={() => {
                const newState = !allActionsEnabled
                const newActions = Object.fromEntries(ACTION_PERMISSIONS.map(a => [a.id, newState]))
                updateAgent({ permissions: { ...agentData.permissions, actions: newActions } })
              }}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg transition-all',
                allActionsEnabled
                  ? 'bg-accent/20 text-accent'
                  : isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              )}
            >
              {allActionsEnabled ? '모두 해제' : '모두 선택'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {ACTION_PERMISSIONS.map((action) => {
              const Icon = action.icon
              const isEnabled = agentData.permissions.actions[action.id]
              return (
                <button
                  key={action.id}
                  onClick={() => toggleActionPermission(action.id)}
                  className={cn(
                    'p-3 rounded-xl border text-left transition-all relative overflow-hidden',
                    isEnabled
                      ? action.dangerous
                        ? 'border-orange-500/50 bg-orange-500/10'
                        : 'border-accent bg-accent/10'
                      : isDark
                        ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  )}
                >
                  {action.dangerous && isEnabled && (
                    <div className="absolute top-1 right-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500 text-white">위험</span>
                    </div>
                  )}
                  <Icon className={cn(
                    'w-5 h-5 mb-1.5',
                    isEnabled
                      ? action.dangerous ? 'text-orange-500' : 'text-accent'
                      : isDark ? 'text-zinc-400' : 'text-zinc-500'
                  )} />
                  <div className={cn(
                    'text-xs font-medium',
                    isEnabled
                      ? action.dangerous ? 'text-orange-500' : 'text-accent'
                      : isDark ? 'text-zinc-400' : 'text-zinc-600'
                  )}>
                    {action.name}
                  </div>
                  <div className={cn('text-[10px] mt-0.5 line-clamp-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    {action.description}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* System Level Permissions */}
        <div className={cn(
          'p-4 rounded-xl border space-y-3',
          isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'
        )}>
          <h4 className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-zinc-900')}>
            시스템 레벨 권한
          </h4>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className={cn('w-5 h-5', agentData.permissions.systemSettings ? 'text-accent' : isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <div>
                <div className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>시스템 설정 변경</div>
                <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>앱 설정 수정 권한</div>
              </div>
            </div>
            <button
              onClick={() => updateAgent({
                permissions: { ...agentData.permissions, systemSettings: !agentData.permissions.systemSettings }
              })}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative',
                agentData.permissions.systemSettings ? 'bg-accent' : isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm',
                agentData.permissions.systemSettings ? 'right-1' : 'left-1'
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className={cn('w-5 h-5', agentData.permissions.agentManagement ? 'text-accent' : isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <div>
                <div className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>에이전트 관리</div>
                <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>다른 에이전트 생성/수정/삭제</div>
              </div>
            </div>
            <button
              onClick={() => updateAgent({
                permissions: { ...agentData.permissions, agentManagement: !agentData.permissions.agentManagement }
              })}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative',
                agentData.permissions.agentManagement ? 'bg-accent' : isDark ? 'bg-zinc-700' : 'bg-zinc-200'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full bg-white absolute top-1 transition-all shadow-sm',
                agentData.permissions.agentManagement ? 'right-1' : 'left-1'
              )} />
            </button>
          </div>
        </div>

        {/* Permission Summary */}
        <div className={cn(
          'p-4 rounded-xl text-sm',
          isJarvisMode
            ? 'bg-accent/10 text-accent border border-accent/30'
            : isDark ? 'bg-zinc-800/50 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
        )}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5" />
            <span className="font-medium">권한 요약</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>페이지 접근: {Object.values(agentData.permissions.pages).filter(v => v).length}/{PAGE_PERMISSIONS.length}</div>
            <div>데이터 권한: {Object.values(agentData.permissions.data).filter(v => v).length}/4</div>
            <div>도구 권한: {Object.values(agentData.permissions.actions).filter(v => v).length}/{ACTION_PERMISSIONS.length}</div>
            <div>즉시 실행: {agentData.permissions.autoExecute ? '활성화' : '비활성화'}</div>
          </div>
        </div>
      </div>
    )
  }

  const renderVoiceStep = () => (
    <div className="space-y-6">
      {/* Voice Toggle */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border',
        isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-center gap-3">
          <Volume2 className={cn('w-6 h-6', agentData.voice_enabled ? 'text-accent' : isDark ? 'text-zinc-500' : 'text-zinc-400')} />
          <div>
            <div className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>음성 활성화</div>
            <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>에이전트가 음성으로 응답합니다</div>
          </div>
        </div>
        <button
          onClick={() => updateAgent({ voice_enabled: !agentData.voice_enabled })}
          className={cn(
            'w-14 h-8 rounded-full transition-colors relative',
            agentData.voice_enabled ? 'bg-accent' : isDark ? 'bg-zinc-700' : 'bg-zinc-200'
          )}
        >
          <div className={cn(
            'w-6 h-6 rounded-full bg-white absolute top-1 transition-all',
            agentData.voice_enabled ? 'right-1' : 'left-1'
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {VOICE_PRESETS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => updateAgent({ voice_id: voice.id })}
                  className={cn(
                    'p-4 rounded-xl border text-left transition-all',
                    agentData.voice_id === voice.id
                      ? 'border-accent bg-accent/10'
                      : isDark
                        ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Mic className={cn('w-4 h-4', agentData.voice_id === voice.id ? 'text-accent' : isDark ? 'text-zinc-500' : 'text-zinc-400')} />
                    <span className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{voice.label}</span>
                  </div>
                  <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-500')}>{voice.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Voice Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                속도: {agentData.voice_settings.speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={agentData.voice_settings.speed}
                onChange={(e) => updateAgent({
                  voice_settings: { ...agentData.voice_settings, speed: parseFloat(e.target.value) }
                })}
                className="w-full accent-accent"
              />
            </div>
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                피치: {agentData.voice_settings.pitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={agentData.voice_settings.pitch}
                onChange={(e) => updateAgent({
                  voice_settings: { ...agentData.voice_settings, pitch: parseFloat(e.target.value) }
                })}
                className="w-full accent-accent"
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
        <div className="flex gap-3 flex-wrap">
          {THEME_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => updateAgent({ theme_color: color.color })}
              className={cn(
                'w-12 h-12 rounded-xl transition-all',
                agentData.theme_color === color.color && 'ring-2 ring-offset-2 ring-offset-zinc-900'
              )}
              style={{
                backgroundColor: color.color,
                '--tw-ring-color': color.color,
              } as React.CSSProperties}
              title={color.label}
            />
          ))}
        </div>
      </div>

      {/* Main GIF Upload */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          메인 애니메이션 (GIF)
        </label>
        <div
          className={cn(
            'h-48 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:scale-[1.02]',
            isDark ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50' : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50'
          )}
          onClick={() => {/* TODO: GIF 업로드 */}}
        >
          {agentData.chat_main_gif ? (
            <img src={agentData.chat_main_gif} alt="Main GIF" className="h-full object-contain" />
          ) : (
            <div className="text-center">
              <ImageIcon className={cn('w-10 h-10 mx-auto mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>GIF 업로드</span>
              <p className={cn('text-xs mt-1', isDark ? 'text-zinc-600' : 'text-zinc-400')}>채팅 시 표시될 애니메이션</p>
            </div>
          )}
        </div>
      </div>

      {/* Emotion Avatars */}
      <div>
        <label className={cn('block text-sm font-medium mb-3', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
          감정별 아바타 (선택)
        </label>
        <div className="grid grid-cols-4 gap-3">
          {['happy', 'sad', 'angry', 'surprised'].map((emotion) => (
            <div
              key={emotion}
              className={cn(
                'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105',
                isDark ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50' : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50'
              )}
              onClick={() => {/* TODO: 감정별 아바타 업로드 */}}
            >
              <span className="text-2xl mb-1">
                {emotion === 'happy' && '😊'}
                {emotion === 'sad' && '😢'}
                {emotion === 'angry' && '😠'}
                {emotion === 'surprised' && '😮'}
              </span>
              <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                {emotion === 'happy' && '기쁨'}
                {emotion === 'sad' && '슬픔'}
                {emotion === 'angry' && '화남'}
                {emotion === 'surprised' && '놀람'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* Preview Card */}
      <div className={cn(
        'p-6 rounded-2xl border',
        isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
      )}>
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: agentData.theme_color }}
          >
            {agentData.avatar_url ? (
              <img src={agentData.avatar_url} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
            ) : (
              agentData.name.charAt(0).toUpperCase() || 'A'
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              {agentData.name || '이름 없음'}
            </h2>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              {agentData.description || '설명 없음'}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${agentData.theme_color}20`, color: agentData.theme_color }}>
                {PERSONALITY_PRESETS.find(p => p.id === agentData.personality)?.label || agentData.personality}
              </span>
              <span className={cn('text-xs px-2 py-1 rounded-full', isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600')}>
                {TONE_PRESETS.find(t => t.id === agentData.tone)?.label || agentData.tone}
              </span>
              <span className={cn('text-xs px-2 py-1 rounded-full', isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600')}>
                {agentData.role === 'custom' ? customRole : ROLE_PRESETS.find(r => r.id === agentData.role)?.label || agentData.role}
              </span>
              {agentData.voice_enabled && (
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  음성 활성화
                </span>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Permissions Summary */}
      {(() => {
        const allPagesEnabled = Object.values(agentData.permissions.pages).every(v => v)
        const allActionsEnabled = Object.values(agentData.permissions.actions).every(v => v)
        const allDataEnabled = Object.values(agentData.permissions.data).every(v => v)
        const isJarvisMode = allPagesEnabled && allActionsEnabled && allDataEnabled &&
          agentData.permissions.autoExecute && agentData.permissions.systemSettings && agentData.permissions.agentManagement

        return (
          <div className={cn(
            'p-4 rounded-xl border',
            isJarvisMode
              ? 'border-accent bg-accent/10'
              : isDark ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-zinc-200'
          )}>
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                isJarvisMode ? 'bg-accent text-white' : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              )}>
                {isJarvisMode ? <Unlock className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
              </div>
              <div>
                <h3 className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                  {isJarvisMode ? 'JARVIS 모드 활성화' : '권한 설정'}
                </h3>
                <p className={cn('text-xs', isJarvisMode ? 'text-accent' : isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  {isJarvisMode ? '모든 권한 활성화 - 완전 자율 실행' : '일부 권한만 활성화됨'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className={cn(
                'px-3 py-2 rounded-lg text-xs text-center',
                isJarvisMode ? 'bg-accent/20 text-accent' : isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              )}>
                <div className="font-medium">{Object.values(agentData.permissions.pages).filter(v => v).length}/{PAGE_PERMISSIONS.length}</div>
                <div className="opacity-70">페이지</div>
              </div>
              <div className={cn(
                'px-3 py-2 rounded-lg text-xs text-center',
                isJarvisMode ? 'bg-accent/20 text-accent' : isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              )}>
                <div className="font-medium">{Object.values(agentData.permissions.data).filter(v => v).length}/4</div>
                <div className="opacity-70">CRUD</div>
              </div>
              <div className={cn(
                'px-3 py-2 rounded-lg text-xs text-center',
                isJarvisMode ? 'bg-accent/20 text-accent' : isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              )}>
                <div className="font-medium">{Object.values(agentData.permissions.actions).filter(v => v).length}/{ACTION_PERMISSIONS.length}</div>
                <div className="opacity-70">도구</div>
              </div>
              <div className={cn(
                'px-3 py-2 rounded-lg text-xs text-center',
                agentData.permissions.autoExecute
                  ? 'bg-green-500/20 text-green-500'
                  : isDark ? 'bg-zinc-700/50 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
              )}>
                <div className="font-medium">{agentData.permissions.autoExecute ? 'ON' : 'OFF'}</div>
                <div className="opacity-70">즉시실행</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Final Message */}
      <div className={cn(
        'p-4 rounded-xl text-center',
        isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-600'
      )}>
        <Sparkles className="w-8 h-8 mx-auto mb-2" />
        <p className="font-medium">모든 설정이 완료되었습니다!</p>
        <p className="text-sm opacity-80 mt-1">저장 버튼을 눌러 에이전트를 생성하세요</p>
      </div>
    </div>
  )

  // ============================================
  // Render
  // ============================================

  return (
    <div className={cn('min-h-screen', isDark ? 'bg-zinc-900' : 'bg-zinc-50')}>
      {/* Header */}
      <header className={cn(
        'sticky top-0 z-50 border-b backdrop-blur-xl',
        isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
      )}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </Button>
              <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
              <div>
                <h1 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  슈퍼 에이전트 생성
                </h1>
                <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  프로필 기반의 만능 AI 에이전트
                </p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving || !agentData.name.trim()}
              className="text-white"
              style={{ background: `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.hoverColor})` }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className={cn('border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = step.id === currentStep
              const isCompleted = index < currentStepIndex

              return (
                <button
                  key={step.id}
                  onClick={() => goToStep(step.id)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    isActive
                      ? 'bg-accent text-white'
                      : isCompleted
                        ? 'bg-green-500 text-white'
                        : isDark
                          ? 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700'
                          : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'
                  )}>
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={cn(
                    'text-xs font-medium hidden md:block',
                    isActive
                      ? 'text-accent'
                      : isCompleted
                        ? 'text-green-500'
                        : isDark ? 'text-zinc-500' : 'text-zinc-400'
                  )}>
                    {step.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step Title */}
            <div className="mb-8">
              <h2 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {STEPS[currentStepIndex].label}
              </h2>
              <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                {STEPS[currentStepIndex].description}
              </p>
            </div>

            {/* Step Content */}
            {currentStep === 'profile' && renderProfileStep()}
            {currentStep === 'personality' && renderPersonalityStep()}
            {currentStep === 'permissions' && renderPermissionsStep()}
            {currentStep === 'voice' && renderVoiceStep()}
            {currentStep === 'appearance' && renderAppearanceStep()}
            {currentStep === 'review' && renderReviewStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStepIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            이전
          </Button>

          {currentStepIndex < STEPS.length - 1 ? (
            <Button
              onClick={goNext}
              className="gap-2 text-white"
              style={{ background: `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.hoverColor})` }}
            >
              다음
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={isSaving || !agentData.name.trim()}
              className="gap-2 text-white"
              style={{ background: `linear-gradient(135deg, ${currentAccent.color}, ${currentAccent.hoverColor})` }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  생성 완료
                </>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  )
}
