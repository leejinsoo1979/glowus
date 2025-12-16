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
  Tag,
  X,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Emoticon {
  id: string
  name: string
  image_url: string
  image_urls: string[]
  category: string
  sort_order: number
  keywords: string[]
}

export default function EmoticonsPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addImageInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const [emoticons, setEmoticons] = useState<Emoticon[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // 편집 모달 상태
  const [editingEmoticon, setEditingEmoticon] = useState<Emoticon | null>(null)
  const [editKeywords, setEditKeywords] = useState<string[]>([])
  const [editImageUrls, setEditImageUrls] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingImage, setAddingImage] = useState(false)

  // 이모티콘 목록 불러오기
  const fetchEmoticons = async () => {
    try {
      setLoading(true)
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
      console.error('Fetch emoticons error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmoticons()
  }, [])

  // 새 이모티콘 카드 생성 (최대 3개 파일 선택 가능)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // 최대 4개까지만
    const selectedFiles = Array.from(files).slice(0, 4)
    if (files.length > 4) {
      alert('카드당 최대 4개의 GIF만 등록 가능합니다. 처음 4개만 업로드됩니다.')
    }

    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of selectedFiles) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name}: 파일 크기는 5MB 이하여야 합니다.`)
          continue
        }

        const fileName = `emoticon-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(`emoticons/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('profile-images')
          .getPublicUrl(`emoticons/${fileName}`)

        uploadedUrls.push(urlData.publicUrl)
      }

      if (uploadedUrls.length === 0) {
        alert('업로드된 파일이 없습니다.')
        return
      }

      // 첫 번째 파일 이름을 카드 이름으로 사용
      const cardName = selectedFiles[0].name.split('.')[0]

      const res = await fetch('/api/emoticons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cardName,
          image_url: uploadedUrls[0],
          image_urls: uploadedUrls,
          category: 'default',
        }),
      })

      if (res.ok) {
        await fetchEmoticons()
        alert(`${uploadedUrls.length}개의 GIF가 포함된 카드가 생성되었습니다!`)
      } else {
        const err = await res.json()
        alert(`저장 실패: ${err.error || '알 수 없는 오류'}`)
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 기존 카드에 이미지 추가
  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !editingEmoticon) return
    if (editImageUrls.length >= 4) {
      alert('카드당 최대 4개의 GIF만 등록 가능합니다.')
      return
    }

    setAddingImage(true)
    try {
      const file = files[0]
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.')
        return
      }

      const fileName = `emoticon-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(`emoticons/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        alert('업로드 실패: ' + uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(`emoticons/${fileName}`)

      setEditImageUrls([...editImageUrls, urlData.publicUrl])
    } catch (err) {
      console.error('Add image error:', err)
      alert('이미지 추가 중 오류가 발생했습니다.')
    } finally {
      setAddingImage(false)
      if (addImageInputRef.current) addImageInputRef.current.value = ''
    }
  }

  // 이미지 삭제
  const removeImage = (index: number) => {
    if (editImageUrls.length <= 1) {
      alert('최소 1개의 이미지가 필요합니다.')
      return
    }
    setEditImageUrls(editImageUrls.filter((_, i) => i !== index))
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

  // 편집 모달 열기
  const openEditModal = (emoticon: Emoticon) => {
    setEditingEmoticon(emoticon)
    setEditKeywords(emoticon.keywords || [])
    setEditImageUrls(emoticon.image_urls || [emoticon.image_url])
    setNewKeyword('')
  }

  // 키워드 추가
  const addKeyword = () => {
    const keyword = newKeyword.trim()
    if (!keyword) return
    if (editKeywords.includes(keyword)) {
      alert('이미 추가된 키워드입니다.')
      return
    }
    setEditKeywords([...editKeywords, keyword])
    setNewKeyword('')
  }

  // 키워드 삭제
  const removeKeyword = (keyword: string) => {
    setEditKeywords(editKeywords.filter((k) => k !== keyword))
  }

  // 저장
  const saveChanges = async () => {
    if (!editingEmoticon) return
    if (editImageUrls.length === 0) {
      alert('최소 1개의 이미지가 필요합니다.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/emoticons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEmoticon.id,
          keywords: editKeywords,
          image_urls: editImageUrls,
        }),
      })

      if (res.ok) {
        await fetchEmoticons()
        setEditingEmoticon(null)
      } else {
        const err = await res.json()
        alert(`저장 실패: ${err.error || '알 수 없는 오류'}`)
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
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
                  {emoticons.length}개의 이모티콘 카드
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
                  새 카드 추가
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
        accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
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
            <p className="text-sm mb-6">카드당 최대 4개의 GIF를 등록할 수 있어요!</p>
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {emoticons.map((emoticon) => (
              <div
                key={emoticon.id}
                onClick={() => isSelectionMode ? toggleSelect(emoticon.id) : openEditModal(emoticon)}
                className={cn(
                  'relative rounded-xl overflow-hidden transition-all group cursor-pointer',
                  isDark ? 'bg-zinc-800' : 'bg-zinc-100',
                  isSelectionMode && 'hover:ring-2 ring-accent ring-offset-2',
                  isSelectionMode && isDark && 'ring-offset-zinc-900',
                  isSelectionMode && !isDark && 'ring-offset-white',
                  selectedIds.includes(emoticon.id) && 'ring-2 ring-accent'
                )}
              >
                {/* 이미지 그리드 (1~4개, 2x2) */}
                <div className={cn(
                  'aspect-square grid gap-0.5 p-1',
                  emoticon.image_urls.length === 1 && 'grid-cols-1',
                  emoticon.image_urls.length >= 2 && 'grid-cols-2 grid-rows-2'
                )}>
                  {emoticon.image_urls.slice(0, 4).map((url, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'rounded-lg overflow-hidden',
                        emoticon.image_urls.length === 2 && 'row-span-1',
                        emoticon.image_urls.length === 3 && idx === 2 && 'col-span-2'
                      )}
                    >
                      <img
                        src={url}
                        alt={`${emoticon.name}-${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>

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

                {/* GIF 개수 뱃지 */}
                <div
                  className={cn(
                    'absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-0.5',
                    isDark ? 'bg-blue-500/80 text-white' : 'bg-blue-500/80 text-white'
                  )}
                >
                  <ImageIcon className="w-2.5 h-2.5" />
                  {emoticon.image_urls.length}
                </div>

                {/* 키워드 개수 뱃지 */}
                {emoticon.keywords?.length > 0 && (
                  <div
                    className={cn(
                      'absolute top-1.5 left-10 px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-0.5',
                      isDark ? 'bg-accent/80 text-white' : 'bg-accent/80 text-white'
                    )}
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {emoticon.keywords.length}
                  </div>
                )}

                {/* 이름 - 호버 시 표시 */}
                <div
                  className={cn(
                    'absolute inset-x-0 bottom-0 py-1.5 px-2 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity',
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
        <p>💡 카드당 최대 4개의 GIF를 등록하면 키워드 입력 시 랜덤으로 표시됩니다.</p>
        <p className="mt-1">💬 카드를 클릭하여 이미지와 키워드를 편집하세요.</p>
      </div>

      {/* 플로팅 + 버튼 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'fixed bottom-8 right-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all z-40',
          'bg-accent text-white hover:bg-accent/90 hover:scale-110',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </button>

      {/* 편집 모달 */}
      {editingEmoticon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingEmoticon(null)}>
          <div
            className={cn(
              'w-full max-w-lg mx-4 rounded-2xl border p-6 max-h-[90vh] overflow-y-auto',
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <h3 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
                {editingEmoticon.name} 편집
              </h3>
              <button
                onClick={() => setEditingEmoticon(null)}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 이미지 섹션 (2x2 그리드) */}
            <div className="mb-6">
              <label className={cn('text-sm font-medium mb-3 block', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                이미지 ({editImageUrls.length}/4)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {editImageUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={url} alt={`${editingEmoticon.name}-${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {editImageUrls.length < 4 && (
                  <button
                    onClick={() => addImageInputRef.current?.click()}
                    disabled={addingImage}
                    className={cn(
                      'aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors',
                      isDark
                        ? 'border-zinc-700 hover:border-zinc-600 text-zinc-500'
                        : 'border-zinc-300 hover:border-zinc-400 text-zinc-400'
                    )}
                  >
                    {addingImage ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span className="text-xs">추가</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={addImageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                onChange={handleAddImage}
                className="hidden"
              />
            </div>

            {/* 키워드 입력 */}
            <div className="mb-4">
              <label className={cn('text-sm font-medium mb-2 block', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                키워드 추가
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="예: ㅋㅋ, 웃음, 재밌어"
                  className={cn(
                    'flex-1 px-3 py-2 rounded-xl text-sm outline-none border',
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  )}
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 키워드 목록 */}
            <div className="mb-6">
              <label className={cn('text-sm font-medium mb-2 block', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                등록된 키워드 ({editKeywords.length}개)
              </label>
              <div className="flex flex-wrap gap-2 min-h-[48px]">
                {editKeywords.length === 0 ? (
                  <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    키워드가 없습니다
                  </p>
                ) : (
                  editKeywords.map((keyword) => (
                    <span
                      key={keyword}
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm',
                        isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'
                      )}
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center',
                          isDark ? 'hover:bg-zinc-700' : 'hover:bg-zinc-200'
                        )}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingEmoticon(null)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium',
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                )}
              >
                취소
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
