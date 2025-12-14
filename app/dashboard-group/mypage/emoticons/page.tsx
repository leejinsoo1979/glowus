'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Smile,
  Plus,
  Trash2,
  Loader2,
  Upload,
  Check,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Emoticon {
  id: string
  name: string
  image_url: string
  category: string
  sort_order: number
}

export default function EmoticonsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const [emoticons, setEmoticons] = useState<Emoticon[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // 이모티콘 목록 불러오기
  const fetchEmoticons = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/emoticons')
      if (res.ok) {
        const { data } = await res.json()
        setEmoticons(data || [])
      }
    } catch (err) {
      console.error('Fetch emoticons error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmoticons()
  }, [])

  // 이모티콘 업로드
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const file of Array.from(files)) {
        // 파일 크기 체크 (5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name}: 파일 크기는 5MB 이하여야 합니다.`)
          failCount++
          continue
        }

        // Supabase Storage에 업로드
        const fileName = `emoticon-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(`emoticons/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          alert(`${file.name}: 스토리지 업로드 실패 - ${uploadError.message}`)
          failCount++
          continue
        }

        // Public URL 가져오기
        const { data: urlData } = supabase.storage
          .from('profile-images')
          .getPublicUrl(`emoticons/${fileName}`)

        console.log('Uploaded URL:', urlData.publicUrl)

        // DB에 저장
        const res = await fetch('/api/emoticons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name.split('.')[0],
            image_url: urlData.publicUrl,
            category: 'default',
          }),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          console.error('DB save error:', errorData)
          alert(`${file.name}: DB 저장 실패 - ${errorData.error || res.statusText}`)
          failCount++
          continue
        }

        successCount++
      }

      // 목록 새로고침
      await fetchEmoticons()

      if (successCount > 0 && failCount === 0) {
        alert(`${successCount}개의 이모티콘이 업로드되었습니다!`)
      } else if (successCount > 0 && failCount > 0) {
        alert(`${successCount}개 성공, ${failCount}개 실패`)
      } else if (failCount > 0) {
        alert('업로드에 실패했습니다. 콘솔을 확인해주세요.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 선택 모드 토글
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedIds([])
  }

  // 이모티콘 선택 토글
  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  // 선택된 이모티콘 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`${selectedIds.length}개의 이모티콘을 삭제하시겠습니까?`)) return

    try {
      const res = await fetch('/api/emoticons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      })

      if (res.ok) {
        await fetchEmoticons()
        setSelectedIds([])
        setIsSelectionMode(false)
        alert('삭제되었습니다.')
      } else {
        alert('삭제 중 오류가 발생했습니다.')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 카드 */}
      <div
        className={cn(
          'rounded-2xl border p-6 mb-6',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
                isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                isDark ? 'bg-zinc-800' : 'bg-zinc-100'
              )}>
                <Smile className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h1 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                  이모티콘 라이브러리
                </h1>
                <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  {emoticons.length}개의 이모티콘
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors',
                    selectedIds.length > 0
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                  {selectedIds.length > 0 ? `${selectedIds.length}개 삭제` : '삭제'}
                </button>
                <button
                  onClick={toggleSelectionMode}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                  )}
                >
                  취소
                </button>
              </>
            ) : (
              <>
                {emoticons.length > 0 && (
                  <button
                    onClick={toggleSelectionMode}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                    )}
                  >
                    선택
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 flex items-center gap-2 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  이모티콘 추가
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.gif"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      {/* 컨텐츠 카드 */}
      <div
        className={cn(
          'rounded-2xl border p-6',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : emoticons.length === 0 ? (
          <div className={cn('text-center py-20', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            <div className={cn(
              'w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6',
              isDark ? 'bg-zinc-800' : 'bg-zinc-100'
            )}>
              <Smile className="w-10 h-10 opacity-50" />
            </div>
            <p className={cn('text-lg font-medium mb-2', isDark ? 'text-zinc-300' : 'text-zinc-600')}>
              이모티콘이 없어요
            </p>
            <p className="text-sm mb-6">이모티콘을 추가해서 채팅에서 사용해보세요!</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-6 py-3 rounded-xl bg-accent text-white hover:bg-accent/90 inline-flex items-center gap-2 font-medium transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              이모티콘 추가하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {emoticons.map((emoticon) => (
              <div
                key={emoticon.id}
                onClick={() => isSelectionMode && toggleSelect(emoticon.id)}
                className={cn(
                  'relative aspect-square rounded-xl overflow-hidden transition-all group',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100',
                  isSelectionMode && 'cursor-pointer hover:ring-2 ring-accent ring-offset-2',
                  isSelectionMode && isDark && 'ring-offset-zinc-900',
                  isSelectionMode && !isDark && 'ring-offset-white',
                  selectedIds.includes(emoticon.id) && 'ring-2 ring-accent'
                )}
              >
                <img
                  src={emoticon.image_url}
                  alt={emoticon.name}
                  className="w-full h-full object-cover"
                />
                {isSelectionMode && (
                  <div
                    className={cn(
                      'absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all',
                      selectedIds.includes(emoticon.id)
                        ? 'bg-accent text-white'
                        : isDark
                        ? 'bg-zinc-900/80 border border-zinc-600'
                        : 'bg-white/90 border border-zinc-300'
                    )}
                  >
                    {selectedIds.includes(emoticon.id) && <Check className="w-3 h-3" />}
                  </div>
                )}
                {/* 이름 툴팁 - 호버 시 표시 */}
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 py-1 px-2 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity',
                    isDark ? 'bg-zinc-900/90 text-zinc-300' : 'bg-white/90 text-zinc-700'
                  )}
                >
                  {emoticon.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 도움말 */}
      <div className={cn(
        'mt-4 p-4 rounded-xl text-sm',
        isDark ? 'bg-zinc-900/50 text-zinc-500' : 'bg-zinc-50 text-zinc-400'
      )}>
        <p>💡 이모티콘은 에이전트 채팅에서 사용할 수 있습니다. GIF 파일도 지원됩니다.</p>
      </div>
    </div>
  )
}
