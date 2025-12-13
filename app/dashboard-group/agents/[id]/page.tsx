'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Loader2,
  Bot,
  MessageSquare,
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
  Camera,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  User,
  Briefcase,
  Edit3,
  Save,
  Plus,
  Trash2,
  Users,
  FolderOpen,
  Hash,
  Building,
  Mail,
  Link2,
  Video,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { PROVIDER_INFO, LLMProvider, AVAILABLE_MODELS } from '@/lib/llm/models'
import { createClient } from '@/lib/supabase/client'
import type { DeployedAgent, AgentStatus } from '@/types/database'

type TabType = 'about' | 'workspace' | 'memory' | 'workflow' | 'settings'

const tabs = [
  { id: 'about' as TabType, label: '소개', icon: User },
  { id: 'workspace' as TabType, label: '워크스페이스', icon: Briefcase },
  { id: 'memory' as TabType, label: '메모리', icon: Brain },
  { id: 'workflow' as TabType, label: '워크플로우', icon: Workflow },
  { id: 'settings' as TabType, label: '설정', icon: Settings },
]

const statusConfig: Record<AgentStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: '활성', color: '#22c55e', bgColor: '#22c55e20' },
  INACTIVE: { label: '비활성', color: '#64748b', bgColor: '#64748b20' },
  BUSY: { label: '작업 중', color: '#f59e0b', bgColor: '#f59e0b20' },
  ERROR: { label: '오류', color: '#ef4444', bgColor: '#ef444420' },
}

const logTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
  conversation: { label: '대화', icon: MessageSquare, color: '#3b82f6' },
  task_work: { label: '업무', icon: Target, color: '#22c55e' },
  decision: { label: '결정', icon: Lightbulb, color: '#f59e0b' },
  analysis: { label: '분석', icon: TrendingUp, color: '#8b5cf6' },
  learning: { label: '학습', icon: Brain, color: '#ec4899' },
  collaboration: { label: '협업', icon: Heart, color: '#ef4444' },
  error: { label: '오류', icon: Zap, color: '#ef4444' },
  milestone: { label: '이정표', icon: Star, color: '#f59e0b' },
}

const knowledgeTypeLabels: Record<string, string> = {
  project: '프로젝트',
  team: '팀/조직',
  domain: '도메인',
  preference: '선호도',
  procedure: '절차',
  decision_rule: '결정 규칙',
  lesson_learned: '교훈',
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  return `${diffDay}일 전`
}

function generateRobotAvatar(name: string): string {
  const seed = encodeURIComponent(name)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}&backgroundColor=3B82F6,10B981,F59E0B,EF4444,8B5CF6,EC4899`
}

interface AgentWithMemory extends DeployedAgent {
  identity?: {
    id?: string
    core_values: string[]
    personality_traits: string[]
    communication_style: string
    expertise_areas: any[]
    working_style: string
    strengths: string[]
    growth_areas: string[]
    self_summary: string
    recent_focus: string
    total_conversations: number
    total_tasks_completed: number
    total_decisions_made: number
  }
  work_logs?: any[]
  knowledge?: any[]
  commits?: any[]
  team?: {
    id: string
    name: string
    description?: string
    logo_url?: string
    founder_id: string
  }
  chat_rooms?: any[]
  tasks?: any[]
  project_stats?: any[]
}

// 편집 가능한 태그 입력 컴포넌트
function EditableTagInput({
  tags,
  onChange,
  placeholder,
  color,
  isDark,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder: string
  color: string
  isDark: boolean
}) {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      if (!tags.includes(inputValue.trim())) {
        onChange([...tags, inputValue.trim()])
      }
      setInputValue('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="px-3 py-1 rounded-lg text-sm flex items-center gap-1"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm border',
          isDark
            ? 'bg-zinc-900 border-zinc-700 text-zinc-200 placeholder:text-zinc-500'
            : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
        )}
      />
    </div>
  )
}

export default function AgentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const agentId = params.id as string

  const [agent, setAgent] = useState<AgentWithMemory | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('about')

  // 편집 모드 상태
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // Image upload states
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Video upload states
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  useEffect(() => {
    fetchAgent()
  }, [agentId])

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
        case 'system_prompt':
          updateData = {
            system_prompt: editForm.system_prompt,
          }
          break
        case 'capabilities':
          updateData = {
            capabilities: editForm.capabilities || [],
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

  // Image upload handlers
  const handleImageClick = () => {
    if (!editMode) {
      fileInputRef.current?.click()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setTempImage(event.target?.result as string)
      setEditMode(true)
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !editMode) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!editMode) return
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !editMode) return
    const touch = e.touches[0]
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    })
  }

  const handleCancel = () => {
    setEditMode(false)
    setTempImage(null)
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleSave = async () => {
    if (!tempImage || !agent) return

    setUploading(true)

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      const size = 400
      canvas.width = size
      canvas.height = size

      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = tempImage
      })

      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()

      const imgRatio = img.width / img.height
      let drawWidth, drawHeight

      if (imgRatio > 1) {
        drawHeight = size
        drawWidth = size * imgRatio
      } else {
        drawWidth = size
        drawHeight = size / imgRatio
      }

      drawWidth *= scale
      drawHeight *= scale

      const drawX = (size - drawWidth) / 2 + position.x * scale
      const drawY = (size - drawHeight) / 2 + position.y * scale

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob'))
          },
          'image/png',
          0.9
        )
      })

      const supabase = createClient()
      const fileName = `agent-${agent.id}-${Date.now()}.png`

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, blob, { upsert: true })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName)

      const avatarUrl = urlData.publicUrl

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      })

      if (!res.ok) throw new Error('Failed to update agent avatar')

      setAgent({ ...agent, avatar_url: avatarUrl })
      handleCancel()
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // Video upload handlers
  const handleVideoClick = () => {
    videoInputRef.current?.click()
  }

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !agent) return

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('비디오 파일 크기는 50MB 이하여야 합니다.')
      return
    }

    // Check file type
    if (!file.type.startsWith('video/')) {
      alert('비디오 파일만 업로드 가능합니다.')
      return
    }

    setUploadingVideo(true)

    try {
      const supabase = createClient()
      const fileName = `agent-video-${agent.id}-${Date.now()}.mp4`

      const { error: uploadError } = await supabase.storage
        .from('profile-videos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        // If bucket doesn't exist, try profile-images bucket
        const { error: fallbackError } = await supabase.storage
          .from('profile-images')
          .upload(fileName, file, { upsert: true })

        if (fallbackError) {
          console.error('Storage upload error:', fallbackError)
          throw fallbackError
        }

        const { data: urlData } = supabase.storage.from('profile-images').getPublicUrl(fileName)
        const videoUrl = urlData.publicUrl

        const res = await fetch(`/api/agents/${agent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_url: videoUrl }),
        })

        if (!res.ok) throw new Error('Failed to update agent video')

        setAgent({ ...agent, video_url: videoUrl })
      } else {
        const { data: urlData } = supabase.storage.from('profile-videos').getPublicUrl(fileName)
        const videoUrl = urlData.publicUrl

        const res = await fetch(`/api/agents/${agent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_url: videoUrl }),
        })

        if (!res.ok) throw new Error('Failed to update agent video')

        setAgent({ ...agent, video_url: videoUrl })
      }
    } catch (error) {
      console.error('비디오 업로드 실패:', error)
      alert('비디오 업로드에 실패했습니다.')
    } finally {
      setUploadingVideo(false)
      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }
    }
  }

  const handleDeleteVideo = async () => {
    if (!agent?.video_url) return

    if (!confirm('프로필 비디오를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: null }),
      })

      if (!res.ok) throw new Error('Failed to delete agent video')

      setAgent({ ...agent, video_url: null })
      setIsVideoPlaying(false)
    } catch (error) {
      console.error('비디오 삭제 실패:', error)
      alert('비디오 삭제에 실패했습니다.')
    }
  }

  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsVideoPlaying(!isVideoPlaying)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
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
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-6">
      {/* Back Button - Mobile */}
      <div className="lg:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로가기
        </Button>
      </div>

      {/* Left Sidebar - Agent Profile */}
      <aside
        className={cn(
          'w-full lg:w-[35%] lg:min-w-[320px] lg:max-w-[400px] rounded-2xl border p-6 md:p-8',
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        {/* Back Button - Desktop */}
        <div className="hidden lg:block mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로가기
          </Button>
        </div>

        {/* Profile Image with Upload */}
        <div className="flex flex-col items-center">
          <div className="relative mb-5 md:mb-8">
            <div
              className={cn(
                'relative w-32 h-32 md:w-40 md:h-40 cursor-pointer group',
                editMode && 'cursor-move'
              )}
              onClick={handleImageClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-accent/20 via-accent/5 to-transparent animate-pulse" />
              <div
                className={cn(
                  'absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                ) : editMode && tempImage ? (
                  <img
                    src={tempImage}
                    alt="편집 중"
                    className="pointer-events-none"
                    style={{
                      transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                      transformOrigin: 'center',
                      minWidth: '100%',
                      minHeight: '100%',
                      objectFit: 'cover',
                    }}
                    draggable={false}
                  />
                ) : (
                  <img
                    src={agent.avatar_url || generateRobotAvatar(agent.name)}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              {/* Hover overlay */}
              {!editMode && (
                <div
                  className={cn(
                    'absolute inset-[2px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
                    'bg-black/50'
                  )}
                >
                  <Camera className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
              )}
              {/* Status indicator */}
              {!editMode && (
                <div
                  className="absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900"
                  style={{ backgroundColor: status.color }}
                />
              )}
            </div>

            {/* Edit controls */}
            {editMode && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-24 accent-accent"
                  />
                  <button
                    onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancel}
                    disabled={uploading}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={uploading}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    저장
                  </button>
                </div>

                <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  드래그하여 위치 조정, 슬라이더로 크기 조정
                </p>
              </div>
            )}
          </div>

          {/* Editable Name & Description */}
          {editingSection === 'basic' ? (
            <div className="w-full space-y-4">
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={cn(
                  'w-full text-2xl md:text-3xl font-bold text-center px-4 py-2 rounded-lg border',
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-white'
                    : 'bg-white border-zinc-200 text-zinc-900'
                )}
                placeholder="에이전트 이름"
              />
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className={cn(
                  'w-full text-sm text-center px-4 py-2 rounded-lg border resize-none',
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                    : 'bg-white border-zinc-200 text-zinc-600'
                )}
                placeholder="에이전트 설명"
                rows={3}
              />
              <div className="flex justify-center gap-2">
                <button
                  onClick={cancelEditing}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm',
                    isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                  )}
                >
                  취소
                </button>
                <button
                  onClick={() => saveSection('basic')}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1
                  className={cn(
                    'text-2xl md:text-3xl font-bold text-center',
                    isDark ? 'text-white' : 'text-zinc-900'
                  )}
                >
                  {agent.name}
                </h1>
                <button
                  onClick={() => startEditing('basic', { name: agent.name, description: agent.description })}
                  className={cn(
                    'p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity',
                    isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                  )}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              <span
                className="px-4 py-1.5 rounded-lg text-sm font-medium mt-2"
                style={{ backgroundColor: status.bgColor, color: status.color }}
              >
                {status.label}
              </span>
              {agent.description && (
                <p className={cn('text-sm text-center mt-3 px-2', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                  {agent.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* Divider */}
        <div className={cn('h-px my-6 md:my-8', isDark ? 'bg-zinc-800' : 'bg-zinc-200')} />

        {/* Team Info */}
        {agent.team && (
          <div className="mb-6">
            <p className={cn('text-xs uppercase mb-3', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              소속 팀
            </p>
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:border-accent transition-colors',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}
              onClick={() => router.push(`/dashboard-group/team/${agent.team!.id}`)}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                )}
              >
                <Building className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                  {agent.team.name}
                </p>
                {agent.team.description && (
                  <p className={cn('text-xs truncate', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    {agent.team.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Profile Video Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className={cn('text-xs uppercase', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              프로필 비디오
            </p>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg"
              onChange={handleVideoSelect}
              className="hidden"
            />
            {agent.video_url ? (
              <button
                onClick={handleDeleteVideo}
                className={cn(
                  'text-xs px-2 py-1 rounded flex items-center gap-1',
                  'text-red-500 hover:bg-red-500/10'
                )}
              >
                <Trash2 className="w-3 h-3" />
                삭제
              </button>
            ) : (
              <button
                onClick={handleVideoClick}
                disabled={uploadingVideo}
                className={cn(
                  'text-xs px-2 py-1 rounded flex items-center gap-1',
                  isDark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-zinc-500 hover:bg-zinc-100'
                )}
              >
                {uploadingVideo ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                업로드
              </button>
            )}
          </div>

          {agent.video_url ? (
            <div
              className={cn(
                'relative rounded-xl overflow-hidden border',
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
              )}
            >
              <video
                ref={videoRef}
                src={agent.video_url}
                className="w-full aspect-video object-cover"
                loop
                playsInline
                onEnded={() => setIsVideoPlaying(false)}
                onPause={() => setIsVideoPlaying(false)}
                onPlay={() => setIsVideoPlaying(true)}
              />
              <button
                onClick={toggleVideoPlay}
                className={cn(
                  'absolute inset-0 flex items-center justify-center transition-opacity',
                  isVideoPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100',
                  'bg-black/30 hover:bg-black/40'
                )}
              >
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                  {isVideoPlaying ? (
                    <Pause className="w-6 h-6 text-zinc-900" />
                  ) : (
                    <Play className="w-6 h-6 text-zinc-900 ml-1" />
                  )}
                </div>
              </button>
            </div>
          ) : (
            <div
              onClick={handleVideoClick}
              className={cn(
                'aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors',
                isDark
                  ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
                  : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50',
                uploadingVideo && 'pointer-events-none opacity-50'
              )}
            >
              {uploadingVideo ? (
                <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
              ) : (
                <>
                  <Video className={cn('w-8 h-8 mb-2', isDark ? 'text-zinc-600' : 'text-zinc-400')} />
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    MP4 비디오 업로드
                  </p>
                  <p className={cn('text-xs mt-1', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                    최대 50MB
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Agent Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                isDark ? 'bg-zinc-800' : 'bg-zinc-100'
              )}
            >
              <span className="text-lg">{providerInfo?.icon || '🤖'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                LLM 제공자
              </p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                {providerInfo?.name || agent.llm_provider || 'Ollama'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                isDark ? 'bg-zinc-800' : 'bg-zinc-100'
              )}
            >
              <Cpu className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>모델</p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                {agent.model || 'qwen2.5:3b'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                isDark ? 'bg-zinc-800' : 'bg-zinc-100'
              )}
            >
              <Thermometer className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                Temperature
              </p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                {agent.temperature ?? 0.7}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                isDark ? 'bg-zinc-800' : 'bg-zinc-100'
              )}
            >
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>생성일</p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                {formatDate(agent.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                isDark ? 'bg-zinc-800' : 'bg-zinc-100'
              )}
            >
              <Activity className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                마지막 활동
              </p>
              <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>
                {formatTimeAgo(agent.last_active_at) || '없음'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={cn(
            'flex items-center justify-center gap-3 mt-6 md:mt-8 pt-6 md:pt-8 border-t',
            isDark ? 'border-zinc-800' : 'border-zinc-200'
          )}
        >
          <button
            onClick={handleToggleStatus}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
              agent.status === 'ACTIVE'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 hover:bg-green-200 dark:hover:bg-green-900/50'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-accent hover:text-white'
            )}
            title={agent.status === 'ACTIVE' ? '비활성화' : '활성화'}
          >
            {agent.status === 'ACTIVE' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={() => router.push(`/agent-builder/${agentId}`)}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
              isDark
                ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
                : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
            )}
            title="편집"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={() => router.push(`/dashboard-group/messenger?invite=${agentId}`)}
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
              isDark
                ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
                : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
            )}
            title="대화하기"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Right Content */}
      <main
        className={cn(
          'flex-1 rounded-xl md:rounded-2xl border overflow-hidden',
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        {/* Tab Navigation */}
        <div className={cn('border-b', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
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

        <div className="p-6 md:p-8">
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-8 md:space-y-10">
              {/* About / Identity - Editable */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={cn('text-2xl md:text-3xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                    소개
                  </h2>
                  {editingSection !== 'identity' && (
                    <button
                      onClick={() =>
                        startEditing('identity', {
                          core_values: agent.identity?.core_values || [],
                          personality_traits: agent.identity?.personality_traits || [],
                          communication_style: agent.identity?.communication_style || '',
                          strengths: agent.identity?.strengths || [],
                          growth_areas: agent.identity?.growth_areas || [],
                          self_summary: agent.identity?.self_summary || '',
                          working_style: agent.identity?.working_style || '',
                          recent_focus: agent.identity?.recent_focus || '',
                        })
                      }
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />

                {editingSection === 'identity' ? (
                  <div className="space-y-6">
                    {/* Self Summary */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        자기 소개
                      </label>
                      <textarea
                        value={editForm.self_summary || ''}
                        onChange={(e) => setEditForm({ ...editForm, self_summary: e.target.value })}
                        className={cn(
                          'w-full px-4 py-3 rounded-lg border resize-none',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="이 에이전트를 소개하는 문장을 입력하세요..."
                        rows={3}
                      />
                    </div>

                    {/* Core Values */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        핵심 가치
                      </label>
                      <EditableTagInput
                        tags={editForm.core_values || []}
                        onChange={(tags) => setEditForm({ ...editForm, core_values: tags })}
                        placeholder="Enter를 눌러 추가 (예: 정확성, 창의성)"
                        color="#ec4899"
                        isDark={isDark}
                      />
                    </div>

                    {/* Personality Traits */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        성격 특성
                      </label>
                      <EditableTagInput
                        tags={editForm.personality_traits || []}
                        onChange={(tags) => setEditForm({ ...editForm, personality_traits: tags })}
                        placeholder="Enter를 눌러 추가 (예: 친절함, 분석적)"
                        color="#8b5cf6"
                        isDark={isDark}
                      />
                    </div>

                    {/* Communication Style */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        소통 스타일
                      </label>
                      <input
                        type="text"
                        value={editForm.communication_style || ''}
                        onChange={(e) => setEditForm({ ...editForm, communication_style: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="예: 친근하고 전문적인 톤"
                      />
                    </div>

                    {/* Strengths */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        강점
                      </label>
                      <EditableTagInput
                        tags={editForm.strengths || []}
                        onChange={(tags) => setEditForm({ ...editForm, strengths: tags })}
                        placeholder="Enter를 눌러 추가"
                        color="#22c55e"
                        isDark={isDark}
                      />
                    </div>

                    {/* Growth Areas */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        성장 필요 영역
                      </label>
                      <EditableTagInput
                        tags={editForm.growth_areas || []}
                        onChange={(tags) => setEditForm({ ...editForm, growth_areas: tags })}
                        placeholder="Enter를 눌러 추가"
                        color="#f59e0b"
                        isDark={isDark}
                      />
                    </div>

                    {/* Working Style */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        업무 스타일
                      </label>
                      <input
                        type="text"
                        value={editForm.working_style || ''}
                        onChange={(e) => setEditForm({ ...editForm, working_style: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="예: 꼼꼼하고 체계적인"
                      />
                    </div>

                    {/* Recent Focus */}
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        최근 집중 영역
                      </label>
                      <input
                        type="text"
                        value={editForm.recent_focus || ''}
                        onChange={(e) => setEditForm({ ...editForm, recent_focus: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                        placeholder="예: 마케팅 전략 분석"
                      />
                    </div>

                    {/* Save/Cancel Buttons */}
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('identity')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {agent.identity?.self_summary ? (
                      <p className={cn('text-sm md:text-base leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                        {agent.identity.self_summary}
                      </p>
                    ) : agent.system_prompt ? (
                      <p
                        className={cn(
                          'text-sm md:text-base leading-relaxed line-clamp-4',
                          isDark ? 'text-zinc-400' : 'text-zinc-600'
                        )}
                      >
                        {agent.system_prompt.slice(0, 300)}...
                      </p>
                    ) : (
                      <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        아직 소개 정보가 없습니다. 편집 버튼을 눌러 추가해보세요.
                      </p>
                    )}

                    {/* Identity Tags */}
                    {agent.identity && (
                      <div className="mt-6 space-y-4">
                        {agent.identity.core_values?.length > 0 && (
                          <div>
                            <p className={cn('text-xs uppercase mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              핵심 가치
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.core_values.map((value, idx) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    'px-3 py-1 rounded-lg text-sm',
                                    isDark ? 'bg-pink-900/20 text-pink-400' : 'bg-pink-50 text-pink-600'
                                  )}
                                >
                                  {value}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agent.identity.personality_traits?.length > 0 && (
                          <div>
                            <p className={cn('text-xs uppercase mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              성격 특성
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.personality_traits.map((trait, idx) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    'px-3 py-1 rounded-lg text-sm',
                                    isDark ? 'bg-purple-900/20 text-purple-400' : 'bg-purple-50 text-purple-600'
                                  )}
                                >
                                  {trait}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agent.identity.strengths?.length > 0 && (
                          <div>
                            <p className={cn('text-xs uppercase mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              강점
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {agent.identity.strengths.map((strength, idx) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    'px-3 py-1 rounded-lg text-sm',
                                    isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-600'
                                  )}
                                >
                                  {strength}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agent.identity.communication_style && (
                          <div>
                            <p className={cn('text-xs uppercase mb-2', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              소통 스타일
                            </p>
                            <p className={cn('text-sm', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                              {agent.identity.communication_style}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Stats */}
              <div>
                <h3 className={cn('text-xl md:text-2xl font-bold mb-6', isDark ? 'text-white' : 'text-zinc-900')}>
                  주요 통계
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  {[
                    { label: '대화 수', value: agent.identity?.total_conversations || 0 },
                    { label: '완료 태스크', value: agent.identity?.total_tasks_completed || 0 },
                    { label: '의사결정', value: agent.identity?.total_decisions_made || 0 },
                    { label: '워크플로우 노드', value: agent.workflow_nodes?.length || 0 },
                  ].map((stat, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-4 md:p-6 rounded-xl md:rounded-2xl border text-center',
                        isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                      )}
                    >
                      <p className="text-2xl md:text-3xl font-bold text-accent mb-1">{stat.value}</p>
                      <p className={cn('text-xs md:text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capabilities - Editable */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn('text-xl md:text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                    기능 & 역량
                  </h3>
                  {editingSection !== 'capabilities' && (
                    <button
                      onClick={() => startEditing('capabilities', { capabilities: agent.capabilities || [] })}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                {editingSection === 'capabilities' ? (
                  <div className="space-y-4">
                    <EditableTagInput
                      tags={(editForm.capabilities || []).filter((cap: string) => !cap.startsWith('team:'))}
                      onChange={(tags) => {
                        const teamTags = (editForm.capabilities || []).filter((cap: string) => cap.startsWith('team:'))
                        setEditForm({ ...editForm, capabilities: [...teamTags, ...tags] })
                      }}
                      placeholder="Enter를 눌러 기능 추가 (예: 마케팅 분석, 데이터 시각화)"
                      color="#3b82f6"
                      isDark={isDark}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('capabilities')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : agent.capabilities && agent.capabilities.filter((cap) => !cap.startsWith('team:')).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {agent.capabilities
                      .filter((cap) => !cap.startsWith('team:'))
                      .map((cap, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'flex gap-3 md:gap-4 p-4 md:p-6 rounded-xl md:rounded-2xl border transition-colors',
                            isDark
                              ? 'bg-zinc-800/50 border-zinc-800 hover:border-accent'
                              : 'bg-zinc-50 border-zinc-200 hover:border-accent'
                          )}
                        >
                          <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-xl bg-accent/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-accent" />
                          </div>
                          <div className="flex-1">
                            <h4
                              className={cn(
                                'text-base md:text-lg font-semibold',
                                isDark ? 'text-white' : 'text-zinc-900'
                              )}
                            >
                              {cap}
                            </h4>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    등록된 기능이 없습니다. 편집 버튼을 눌러 추가해보세요.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Workspace Tab */}
          {activeTab === 'workspace' && (
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  워크스페이스
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              {/* Team Info */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building className="w-5 h-5 text-blue-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>소속 팀</h4>
                </div>
                {agent.team ? (
                  <div
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl cursor-pointer hover:bg-opacity-80 transition',
                      isDark ? 'bg-zinc-900' : 'bg-white'
                    )}
                    onClick={() => router.push(`/dashboard-group/team/${agent.team!.id}`)}
                  >
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                      )}
                    >
                      <Building className="w-6 h-6 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                        {agent.team.name}
                      </p>
                      {agent.team.description && (
                        <p className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                          {agent.team.description}
                        </p>
                      )}
                    </div>
                    <ArrowLeft className="w-5 h-5 rotate-180 text-zinc-400" />
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    소속된 팀이 없습니다
                  </p>
                )}
              </div>

              {/* Active Chat Rooms */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>참여 중인 채팅방</h4>
                  <span
                    className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                    )}
                  >
                    {agent.chat_rooms?.length || 0}개
                  </span>
                </div>
                {agent.chat_rooms && agent.chat_rooms.length > 0 ? (
                  <div className="space-y-2">
                    {agent.chat_rooms.map((room: any) => (
                      <div
                        key={room.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-opacity-80 transition',
                          isDark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-white hover:bg-zinc-50'
                        )}
                        onClick={() => router.push(`/dashboard-group/messenger?room=${room.id}`)}
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                          )}
                        >
                          {room.type === 'group' ? (
                            <Users className="w-5 h-5 text-green-500" />
                          ) : (
                            <MessageSquare className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                            {room.name || '채팅방'}
                          </p>
                          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                            {formatTimeAgo(room.last_message_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    참여 중인 채팅방이 없습니다
                  </p>
                )}
              </div>

              {/* Related Tasks */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-purple-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>관련 태스크</h4>
                  <span
                    className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                    )}
                  >
                    {agent.tasks?.length || 0}개
                  </span>
                </div>
                {agent.tasks && agent.tasks.length > 0 ? (
                  <div className="space-y-2">
                    {agent.tasks.map((task: any) => (
                      <div
                        key={task.id}
                        className={cn('p-3 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded',
                              task.status === 'done'
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                : task.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                            )}
                          >
                            {task.status === 'done' ? '완료' : task.status === 'in_progress' ? '진행 중' : '대기'}
                          </span>
                          {task.project && (
                            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              {task.project.name}
                            </span>
                          )}
                        </div>
                        <p className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                          {task.title}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    관련 태스크가 없습니다
                  </p>
                )}
              </div>

              {/* Project Activity Stats */}
              {agent.project_stats && agent.project_stats.length > 0 && (
                <div
                  className={cn(
                    'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                    isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <FolderOpen className="w-5 h-5 text-orange-500" />
                    <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>프로젝트 활동</h4>
                  </div>
                  <div className="space-y-2">
                    {agent.project_stats.map((stat: any) => (
                      <div
                        key={stat.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          isDark ? 'bg-zinc-900' : 'bg-white'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center',
                              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                            )}
                          >
                            <FolderOpen className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                              {stat.name}
                            </p>
                            <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              마지막 활동: {formatTimeAgo(stat.lastActivity)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-accent">{stat.count}</p>
                          <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>활동 수</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity Timeline */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-cyan-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>최근 활동 타임라인</h4>
                </div>
                {agent.work_logs && agent.work_logs.length > 0 ? (
                  <div className="relative">
                    <div className={cn('absolute left-5 top-0 bottom-0 w-px', isDark ? 'bg-zinc-700' : 'bg-zinc-200')} />
                    <div className="space-y-4">
                      {agent.work_logs.slice(0, 10).map((log: any) => {
                        const logType = logTypeLabels[log.log_type] || {
                          label: log.log_type,
                          icon: FileText,
                          color: '#6b7280',
                        }
                        const LogIcon = logType.icon
                        return (
                          <div key={log.id} className="flex items-start gap-4 relative">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                              style={{ backgroundColor: `${logType.color}20` }}
                            >
                              <LogIcon className="w-5 h-5" style={{ color: logType.color }} />
                            </div>
                            <div className="flex-1 pb-4">
                              <div className="flex items-center justify-between">
                                <span className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-zinc-900')}>
                                  {log.title}
                                </span>
                                <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                                  {formatTimeAgo(log.created_at)}
                                </span>
                              </div>
                              {log.summary && (
                                <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                                  {log.summary}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    아직 활동 기록이 없습니다
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Memory Tab */}
          {activeTab === 'memory' && (
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  메모리
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Work Logs */}
                <div
                  className={cn(
                    'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                    isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>업무 로그</h4>
                    <span
                      className={cn(
                        'ml-auto text-xs px-2 py-0.5 rounded-full',
                        isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                      )}
                    >
                      {agent.work_logs?.length || 0}개
                    </span>
                  </div>
                  {agent.work_logs && agent.work_logs.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {agent.work_logs.map((log: any) => {
                        const logType = logTypeLabels[log.log_type] || {
                          label: log.log_type,
                          icon: FileText,
                          color: '#6b7280',
                        }
                        return (
                          <div key={log.id} className={cn('p-3 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: `${logType.color}20`, color: logType.color }}
                              >
                                {logType.label}
                              </span>
                              <span className={cn('text-xs ml-auto', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                                {formatTimeAgo(log.created_at)}
                              </span>
                            </div>
                            <p className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                              {log.title}
                            </p>
                            {log.summary && (
                              <p className={cn('text-xs mt-1 line-clamp-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                                {log.summary}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      아직 업무 로그가 없습니다
                    </p>
                  )}
                </div>

                {/* Knowledge Base */}
                <div
                  className={cn(
                    'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                    isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                  )}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-green-500" />
                    <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>지식 베이스</h4>
                    <span
                      className={cn(
                        'ml-auto text-xs px-2 py-0.5 rounded-full',
                        isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                      )}
                    >
                      {agent.knowledge?.length || 0}개
                    </span>
                  </div>
                  {agent.knowledge && agent.knowledge.length > 0 ? (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {agent.knowledge.map((item: any) => (
                        <div key={item.id} className={cn('p-3 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={cn(
                                'text-xs px-1.5 py-0.5 rounded',
                                isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
                              )}
                            >
                              {knowledgeTypeLabels[item.knowledge_type] || item.knowledge_type}
                            </span>
                            <span className={cn('text-xs ml-auto', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              신뢰도 {Math.round((item.confidence || 0.8) * 100)}%
                            </span>
                          </div>
                          <p className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
                            {item.subject}
                          </p>
                          <p className={cn('text-xs mt-1 line-clamp-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                            {item.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      아직 지식 베이스가 없습니다
                    </p>
                  )}
                </div>
              </div>

              {/* Commits */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center gap-2 mb-4">
                  <GitCommit className="w-5 h-5 text-purple-500" />
                  <h4 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>업무 커밋</h4>
                  <span
                    className={cn(
                      'ml-auto text-xs px-2 py-0.5 rounded-full',
                      isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
                    )}
                  >
                    {agent.commits?.length || 0}개
                  </span>
                </div>
                {agent.commits && agent.commits.length > 0 ? (
                  <div className="space-y-3">
                    {agent.commits.map((commit: any) => (
                      <div key={commit.id} className={cn('p-4 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                            )}
                          >
                            {commit.commit_type}
                          </span>
                          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                            {formatDate(commit.period_start)} ~ {formatDate(commit.period_end)}
                          </span>
                        </div>
                        <h5 className={cn('font-medium', isDark ? 'text-white' : 'text-zinc-900')}>{commit.title}</h5>
                        <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                          {commit.summary}
                        </p>
                        {commit.learnings && commit.learnings.length > 0 && (
                          <div className="mt-3">
                            <span className={cn('text-xs font-medium', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                              배운 점:
                            </span>
                            <ul className="mt-1 space-y-1">
                              {commit.learnings.map((learning: string, idx: number) => (
                                <li
                                  key={idx}
                                  className={cn(
                                    'text-xs flex items-start gap-1',
                                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                                  )}
                                >
                                  <span className="text-green-500">•</span>
                                  {learning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    아직 업무 커밋이 없습니다
                  </p>
                )}
              </div>
            </div>
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
            <div className="space-y-8">
              <div>
                <h2 className={cn('text-2xl md:text-3xl font-bold mb-4', isDark ? 'text-white' : 'text-zinc-900')}>
                  설정
                </h2>
                <div className="w-10 h-1 bg-accent rounded-full mb-6" />
              </div>

              {/* LLM Settings - Editable */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <Bot className="w-5 h-5 text-blue-500" />
                    LLM 설정
                  </h3>
                  {editingSection !== 'llm' && (
                    <button
                      onClick={() =>
                        startEditing('llm', {
                          llm_provider: agent.llm_provider || 'ollama',
                          model: agent.model || 'qwen2.5:3b',
                          temperature: agent.temperature ?? 0.7,
                        })
                      }
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                {editingSection === 'llm' ? (
                  <div className="space-y-4">
                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        Provider
                      </label>
                      <select
                        value={editForm.llm_provider || 'ollama'}
                        onChange={(e) => {
                          const newProvider = e.target.value as LLMProvider
                          const models = AVAILABLE_MODELS[newProvider]
                          setEditForm({
                            ...editForm,
                            llm_provider: newProvider,
                            model: models?.[0] || '',
                          })
                        }}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                      >
                        {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                          <option key={key} value={key}>
                            {info.icon} {info.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        Model
                      </label>
                      <select
                        value={editForm.model || ''}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          isDark
                            ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                            : 'bg-white border-zinc-200 text-zinc-900'
                        )}
                      >
                        {(AVAILABLE_MODELS[editForm.llm_provider as LLMProvider] || []).map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={cn('text-sm font-medium block mb-2', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                        Temperature: {editForm.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={editForm.temperature || 0.7}
                        onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                        className="w-full accent-accent"
                      />
                      <div className="flex justify-between text-xs mt-1">
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>정확한 (0)</span>
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>창의적 (2)</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('llm')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Provider', value: providerInfo?.name || agent.llm_provider || 'Ollama' },
                      { label: 'Model', value: agent.model || 'qwen2.5:3b' },
                      { label: 'Temperature', value: agent.temperature ?? 0.7 },
                      { label: '상태', value: status.label, color: status.color },
                    ].map((item, idx) => (
                      <div key={idx} className={cn('p-4 rounded-lg', isDark ? 'bg-zinc-900' : 'bg-white')}>
                        <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                          {item.label}
                        </p>
                        <p
                          className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-800')}
                          style={item.color ? { color: item.color } : undefined}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* System Prompt - Editable */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={cn('font-semibold flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                    시스템 프롬프트
                  </h3>
                  {editingSection !== 'system_prompt' && (
                    <button
                      onClick={() => startEditing('system_prompt', { system_prompt: agent.system_prompt || '' })}
                      className={cn(
                        'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
                        isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                      )}
                    >
                      <Edit3 className="w-4 h-4" />
                      편집
                    </button>
                  )}
                </div>

                {editingSection === 'system_prompt' ? (
                  <div className="space-y-4">
                    <textarea
                      value={editForm.system_prompt || ''}
                      onChange={(e) => setEditForm({ ...editForm, system_prompt: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg border resize-none font-mono text-sm',
                        isDark
                          ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          : 'bg-white border-zinc-200 text-zinc-900'
                      )}
                      placeholder="에이전트의 성격과 행동을 정의하는 시스템 프롬프트를 입력하세요..."
                      rows={15}
                    />
                    <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                      이 프롬프트는 에이전트가 대화할 때 기본 성격과 행동 방식을 결정합니다.
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={cancelEditing}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          isDark ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'
                        )}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveSection('system_prompt')}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm bg-accent text-white hover:bg-accent/90 flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        저장
                      </button>
                    </div>
                  </div>
                ) : agent.system_prompt ? (
                  <div className={cn('p-4 rounded-lg max-h-[300px] overflow-y-auto', isDark ? 'bg-zinc-900' : 'bg-white')}>
                    <pre className={cn('text-sm whitespace-pre-wrap font-mono', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                      {agent.system_prompt}
                    </pre>
                  </div>
                ) : (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    시스템 프롬프트가 설정되지 않았습니다. 편집 버튼을 눌러 추가해보세요.
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div
                className={cn(
                  'p-4 md:p-6 rounded-xl md:rounded-2xl border',
                  isDark ? 'bg-zinc-800/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                )}
              >
                <h3 className={cn('font-semibold mb-4 flex items-center gap-2', isDark ? 'text-white' : 'text-zinc-900')}>
                  <Briefcase className="w-5 h-5 text-zinc-500" />
                  메타데이터
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'ID', value: agent.id },
                    { label: '생성일', value: formatDate(agent.created_at) },
                    { label: '마지막 수정', value: formatDate(agent.updated_at) },
                    { label: '마지막 활동', value: formatDate(agent.last_active_at) },
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>{item.label}</span>
                      <span
                        className={cn(
                          'text-sm',
                          isDark ? 'text-zinc-300' : 'text-zinc-700',
                          item.label === 'ID' && 'font-mono text-xs'
                        )}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
