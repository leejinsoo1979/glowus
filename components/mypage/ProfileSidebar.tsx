'use client'

import { useState, useRef, useCallback } from 'react'
import { Mail, Phone, Calendar, MapPin, Camera, Loader2, ZoomIn, ZoomOut, Check, X, Smile, ChevronRight } from 'lucide-react'
import { Github, Twitter, Linkedin } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { profileData } from '@/lib/mypage-data'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface ProfileSidebarProps {
  data?: typeof profileData
  className?: string
  onEdit?: () => void
}

export function ProfileSidebar({ data = profileData, className }: ProfileSidebarProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { user, updateUser } = useAuthStore()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 이미지 편집 상태
  const [editMode, setEditMode] = useState(false)
  const [tempImage, setTempImage] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      y: e.clientY - dragStart.y
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
      y: touch.clientY - dragStart.y
    })
  }

  const handleCancel = () => {
    setEditMode(false)
    setTempImage(null)
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleSave = async () => {
    if (!tempImage || !user) return

    setUploading(true)

    try {
      // Canvas에 크롭된 이미지 생성
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      const size = 400 // 출력 이미지 크기
      canvas.width = size
      canvas.height = size

      const img = new Image()
      img.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = tempImage
      })

      // 원형 클리핑
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()

      // 이미지 그리기 (미리보기와 동일하게)
      // 1. 먼저 이미지를 컨테이너에 cover 방식으로 맞춤
      const imgRatio = img.width / img.height
      let drawWidth, drawHeight

      if (imgRatio > 1) {
        // 가로가 더 긴 이미지
        drawHeight = size
        drawWidth = size * imgRatio
      } else {
        // 세로가 더 긴 이미지
        drawWidth = size
        drawHeight = size / imgRatio
      }

      // 2. 스케일 적용
      drawWidth *= scale
      drawHeight *= scale

      // 3. 중앙 정렬 + 위치 오프셋 적용
      const drawX = (size - drawWidth) / 2 + (position.x * scale)
      const drawY = (size - drawHeight) / 2 + (position.y * scale)

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

      // Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create blob'))
        }, 'image/png', 0.9)
      })

      const supabase = createClient()
      const fileName = `${user.id}-${Date.now()}.png`

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profile-images')
        .upload(fileName, blob, { upsert: true })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }
      console.log('Upload success:', uploadData)

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName)

      const avatarUrl = urlData.publicUrl
      console.log('Avatar URL:', avatarUrl)

      const { error: updateError, data: updateData } = await (supabase as any)
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
        .select()

      if (updateError) {
        console.error('DB update error:', updateError)
        throw updateError
      }
      console.log('DB update success:', updateData)

      updateUser({ avatar_url: avatarUrl })
      handleCancel()

    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <aside className={cn(
      'w-full rounded-2xl border p-6 md:p-8',
      isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200',
      className
    )}>
      {/* Profile Image */}
      <div className="flex flex-col items-center">
        <div className="relative mb-5 md:mb-8">
          <div
            className={cn(
              "relative w-32 h-32 md:w-40 md:h-40 cursor-pointer group",
              editMode && "cursor-move"
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
            <div className={cn(
              'absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
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
                    objectFit: 'cover'
                  }}
                  draggable={false}
                />
              ) : user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user?.name || data.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl md:text-4xl font-bold text-accent">
                  {getInitials(user?.name || data.name)}
                </span>
              )}
            </div>
            {/* 호버 오버레이 */}
            {!editMode && (
              <div className={cn(
                'absolute inset-[2px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
                'bg-black/50'
              )}>
                <Camera className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
            )}
          </div>

          {/* 편집 컨트롤 */}
          {editMode && (
            <div className="mt-4 flex flex-col items-center gap-3">
              {/* 줌 컨트롤 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
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
                  onClick={() => setScale(s => Math.min(3, s + 0.1))}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isDark ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'
                  )}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* 저장/취소 버튼 */}
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
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  저장
                </button>
              </div>

              <p className={cn(
                'text-xs',
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              )}>
                드래그하여 위치 조정, 슬라이더로 크기 조정
              </p>
            </div>
          )}
        </div>

        <h1 className={cn(
          'text-2xl md:text-3xl font-bold mb-2',
          isDark ? 'text-white' : 'text-zinc-900'
        )}>
          {user?.name || data.name}
        </h1>
        <p className={cn(
          'text-sm px-4 py-1.5 rounded-lg',
          isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
        )}>
          {data.title}
        </p>
      </div>

      {/* Divider */}
      <div className={cn('h-px my-6 md:my-8', isDark ? 'bg-zinc-800' : 'bg-zinc-200')} />

      {/* Contact Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-5">
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <Mail className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>이메일</p>
            <a
              href={`mailto:${user?.email || data.email}`}
              className={cn(
                'text-sm hover:text-accent transition-colors break-all',
                isDark ? 'text-zinc-200' : 'text-zinc-700'
              )}
            >
              {user?.email || data.email}
            </a>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <Phone className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>연락처</p>
            <a
              href={`tel:${data.phone.replace(/\s/g, '')}`}
              className={cn(
                'text-sm hover:text-accent transition-colors',
                isDark ? 'text-zinc-200' : 'text-zinc-700'
              )}
            >
              {data.phone}
            </a>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <Calendar className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>생년월일</p>
            <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{data.birthday}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
            isDark ? 'bg-zinc-800' : 'bg-zinc-100'
          )}>
            <MapPin className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className={cn('text-xs uppercase mb-1', isDark ? 'text-zinc-500' : 'text-zinc-400')}>위치</p>
            <p className={cn('text-sm', isDark ? 'text-zinc-200' : 'text-zinc-700')}>{data.location}</p>
          </div>
        </div>
      </div>

      {/* Social Links */}
      <div className={cn(
        'flex items-center justify-center gap-4 mt-6 md:mt-8 pt-6 md:pt-8 border-t',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <a
          href={data.social.github}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
              : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
          )}
          aria-label="GitHub"
        >
          <Github className="w-5 h-5" />
        </a>
        <a
          href={data.social.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
              : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
          )}
          aria-label="Twitter"
        >
          <Twitter className="w-5 h-5" />
        </a>
        <a
          href={data.social.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center transition-colors',
            isDark
              ? 'bg-zinc-800 hover:bg-accent hover:text-white text-zinc-400'
              : 'bg-zinc-100 hover:bg-accent hover:text-white text-zinc-600'
          )}
          aria-label="LinkedIn"
        >
          <Linkedin className="w-5 h-5" />
        </a>
      </div>

      {/* 이모티콘 라이브러리 링크 */}
      <div className={cn(
        'mt-6 pt-6 border-t',
        isDark ? 'border-zinc-800' : 'border-zinc-200'
      )}>
        <Link
          href="/dashboard-group/mypage/emoticons"
          className={cn(
            'flex items-center justify-between p-4 rounded-xl transition-colors group',
            isDark
              ? 'bg-zinc-800/50 hover:bg-zinc-800'
              : 'bg-zinc-50 hover:bg-zinc-100'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              isDark ? 'bg-zinc-700' : 'bg-white'
            )}>
              <Smile className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-zinc-900')}>
                이모티콘 라이브러리
              </p>
              <p className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                나만의 이모티콘 관리
              </p>
            </div>
          </div>
          <ChevronRight className={cn(
            'w-5 h-5 transition-transform group-hover:translate-x-1',
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          )} />
        </Link>
      </div>

    </aside>
  )
}
