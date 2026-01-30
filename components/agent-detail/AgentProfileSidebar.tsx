'use client'

import { useState, useRef, Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Loader2,
  MessageSquare,
  Camera,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Edit3,
  Save,
  Building,
  Phone,
  PhoneOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import type { AgentStatus } from '@/types/database'
import { formatDate, formatTimeAgo, generateRobotAvatar, type AgentWithMemory } from '@/components/agent-detail/utils'
import { TabType } from '@/components/agent-detail/constants'

interface ProviderInfo {
  name: string
  [key: string]: any
}

interface StatusConfig {
  label: string
  color: string
  bgColor: string
}

interface AgentProfileSidebarProps {
  agent: AgentWithMemory
  setAgent: (agent: AgentWithMemory) => void
  isDark: boolean
  mounted: boolean
  userAccentColor: string
  status: StatusConfig
  providerInfo: ProviderInfo | null
  // Voice call state
  isVoiceCallActive: boolean
  isVoiceConnecting: boolean
  startVoiceCall: () => void
  endVoiceCall: () => void
  // Tab control
  activeTab: TabType
  setActiveTab: Dispatch<SetStateAction<TabType>>
  // Status toggle
  onToggleStatus: () => void
}

export function AgentProfileSidebar({
  agent,
  setAgent,
  isDark,
  mounted,
  userAccentColor,
  status,
  providerInfo,
  isVoiceCallActive,
  isVoiceConnecting,
  startVoiceCall,
  endVoiceCall,
  activeTab,
  setActiveTab,
  onToggleStatus,
}: AgentProfileSidebarProps) {
  const router = useRouter()

  // Image upload states (internal to sidebar)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isGif, setIsGif] = useState(false)
  const [originalFile, setOriginalFile] = useState<File | null>(null)

  // Basic info editing states (internal to sidebar)
  const [isEditingBasic, setIsEditingBasic] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string; description: string; job_title: string }>({
    name: '',
    description: '',
    job_title: '',
  })
  const [saving, setSaving] = useState(false)

  // Image upload handlers
  const handleImageClick = () => {
    if (!editMode) {
      fileInputRef.current?.click()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // GIF 파일은 10MB까지, 다른 이미지는 5MB까지
    const maxSize = file.type === 'image/gif' ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert(file.type === 'image/gif'
        ? 'GIF 파일 크기는 10MB 이하여야 합니다.'
        : '파일 크기는 5MB 이하여야 합니다.')
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.')
      return
    }

    // GIF 파일인지 확인
    const gifFile = file.type === 'image/gif'
    setIsGif(gifFile)
    setOriginalFile(gifFile ? file : null)

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
    setIsGif(false)
    setOriginalFile(null)
  }

  const handleSave = async () => {
    if (!tempImage || !agent) return

    setUploading(true)

    try {
      const supabase = createClient()
      let uploadBlob: Blob
      let fileName: string

      // GIF 파일은 애니메이션 보존을 위해 원본 그대로 업로드
      if (isGif && originalFile) {
        uploadBlob = originalFile
        fileName = `agent-${agent.id}-${Date.now()}.gif`
      } else {
        // PNG/JPEG는 캔버스로 크롭 및 리사이즈
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context not available')

        const size = 400
        canvas.width = size
        canvas.height = size

        const img = document.createElement('img')
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

        uploadBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to create blob'))
            },
            'image/png',
            0.9
          )
        })
        fileName = `agent-${agent.id}-${Date.now()}.png`
      }

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, uploadBlob, {
          upsert: true,
          contentType: isGif ? 'image/gif' : 'image/png',
        })

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

  // Basic info editing handlers
  const startEditingBasic = () => {
    setIsEditingBasic(true)
    setEditForm({
      name: agent.name,
      description: agent.description || '',
      job_title: (agent as any).job_title || '',
    })
  }

  const cancelEditingBasic = () => {
    setIsEditingBasic(false)
    setEditForm({ name: '', description: '', job_title: '' })
  }

  const saveBasicInfo = async () => {
    if (!agent) return
    setSaving(true)

    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description,
        job_title: editForm.job_title || null,
      }

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) throw new Error('저장 실패')

      const updatedAgent = await res.json()
      setAgent({ ...agent, ...updatedAgent })
      cancelEditingBasic()
    } catch (error) {
      console.error('Save error:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside
      className={cn(
        'w-full lg:w-[320px] flex-shrink-0 rounded-2xl border p-6 overflow-y-auto',
        isDark ? 'bg-zinc-900/80 border-zinc-800/60 backdrop-blur-sm' : 'bg-white/80 border-zinc-200/60 backdrop-blur-sm'
      )}
    >
      {/* Back Button - Desktop */}
      <div className="hidden lg:block mb-6">
        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white -ml-2" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로가기
        </Button>
      </div>

      {/* Profile Image with Upload */}
      <div className="flex flex-col items-center">
        <div className="relative mb-5">
          <div
            className={cn(
              'relative w-36 h-36 cursor-pointer group',
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
              accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              className={cn(
                'w-full h-full rounded-full overflow-hidden flex items-center justify-center ring-4',
                isDark ? 'bg-zinc-800 ring-zinc-800/50' : 'bg-zinc-100 ring-zinc-100'
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
              <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <Camera className="w-5 h-5 text-white" />
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
        {isEditingBasic ? (
          <div className="w-full space-y-4">
            <input
              type="text"
              value={editForm.name || ''}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className={cn(
                'w-full text-lg md:text-xl font-bold text-center px-4 py-2 rounded-lg border',
                isDark
                  ? 'bg-zinc-900 border-zinc-700 text-white'
                  : 'bg-white border-zinc-200 text-zinc-900'
              )}
              placeholder="에이전트 이름"
            />
            <input
              type="text"
              value={editForm.job_title || ''}
              onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
              className={cn(
                'w-full text-sm text-center px-4 py-2 rounded-lg border',
                isDark
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                  : 'bg-white border-zinc-200 text-zinc-600'
              )}
              placeholder="직무/직함 (예: 마케팅 매니저, 개발팀장)"
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
                onClick={cancelEditingBasic}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm',
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                )}
              >
                취소
              </button>
              <button
                onClick={saveBasicInfo}
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
                  'text-lg md:text-xl font-bold text-center',
                  isDark ? 'text-white' : 'text-zinc-900'
                )}
              >
                {agent.name}
              </h1>
              <button
                onClick={startEditingBasic}
                className={cn(
                  'p-1.5 rounded-lg opacity-50 hover:opacity-100 transition-opacity',
                  isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                )}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            {(agent as any).job_title && (
              <p className={cn('text-sm text-center', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                {(agent as any).job_title}
              </p>
            )}
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
      <div className={cn('h-px my-6', isDark ? 'bg-zinc-800/60' : 'bg-zinc-200/60')} />

      {/* Team Info */}
      {agent.team && (
        <div className="mb-6">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-3', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            소속 팀
          </p>
          <div
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
              isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-zinc-50 hover:bg-zinc-100'
            )}
            onClick={() => router.push(`/dashboard-group/team/${agent.team!.id}`)}
          >
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', isDark ? 'bg-zinc-700' : 'bg-white shadow-sm')}>
              <Building className="w-4 h-4 text-zinc-500" />
            </div>
            <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{agent.team.name}</span>
          </div>
        </div>
      )}

      {/* Agent Info */}
      <div className="space-y-4">
        <p className={cn('text-[10px] font-semibold uppercase tracking-wider', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
          설정
        </p>
        <div className={cn('rounded-xl overflow-hidden', isDark ? 'bg-zinc-800/50' : 'bg-zinc-50')}>
          <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>제공자</span>
            <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{providerInfo?.name || agent.llm_provider || 'Ollama'}</span>
          </div>
          <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>모델</span>
            <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{agent.model || 'qwen2.5:3b'}</span>
          </div>
          <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>Temperature</span>
            <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{agent.temperature ?? 0.7}</span>
          </div>
          <div className={cn('flex justify-between items-center px-4 py-3', isDark ? 'border-b border-zinc-700/50' : 'border-b border-zinc-200/50')}>
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>생성일</span>
            <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{formatDate(agent.created_at, mounted)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className={cn('text-sm', isDark ? 'text-zinc-400' : 'text-zinc-500')}>마지막 활동</span>
            <span className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{formatTimeAgo(agent.last_active_at, mounted) || '없음'}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 mt-6">
        {/* 채팅 / 보이스 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className="flex-1 h-10 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            style={{ backgroundColor: userAccentColor }}
          >
            <MessageSquare className="w-4 h-4" />
            채팅
          </button>
          <button
            onClick={() => {
              setActiveTab('chat')
              // 🔥 통화 중이면 종료, 아니면 시작
              if (isVoiceCallActive) {
                // 통화 종료 - endVoiceCall() 사용으로 완전한 정리
                endVoiceCall()
              } else if (!isVoiceConnecting) {
                // 통화 시작
                startVoiceCall()
              }
            }}
            disabled={isVoiceConnecting}
            className="flex-1 h-10 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: isVoiceCallActive ? '#ef4444' : `${userAccentColor}20`,
              color: isVoiceCallActive ? 'white' : userAccentColor,
            }}
          >
            {isVoiceConnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isVoiceCallActive ? (
              <PhoneOff className="w-4 h-4" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
            {isVoiceConnecting ? '연결중...' : isVoiceCallActive ? '종료' : '보이스'}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleStatus}
            className={cn(
              'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors',
              agent.status !== 'ACTIVE' && (isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600')
            )}
            style={agent.status === 'ACTIVE' ? {
              backgroundColor: `${userAccentColor}15`,
              color: userAccentColor,
            } : undefined}
          >
            {agent.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {agent.status === 'ACTIVE' ? '중지' : '시작'}
          </button>
          <button
            onClick={() => router.push(`/agent-builder/${agent.id}`)}
            className={cn(
              'flex-1 h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors',
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
            )}
          >
            <Settings className="w-4 h-4" />
            편집
          </button>
        </div>
      </div>
    </aside>
  )
}
