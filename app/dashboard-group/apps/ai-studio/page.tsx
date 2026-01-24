"use client"

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import {
  FileText,
  Globe,
  Youtube,
  Plus,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Trash2,
  Send,
  Settings2,
  Search,
  Image as ImageIcon
} from 'lucide-react'
import StudioCardGrid from '@/components/ai-studio/StudioCardGrid'
import StudioPreviewPanel, { StudioContent, SlideData } from '@/components/ai-studio/StudioPreviewPanel'

// Types
interface SlideImage {
  pageNumber: number
  imageUrl: string
  title?: string
}

interface Source {
  id: string
  type: 'pdf' | 'web' | 'youtube' | 'text' | 'image' | 'doc' | 'ppt' | 'xls'
  title: string
  content?: string
  url?: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  summary?: string
  selected?: boolean
  slideImages?: SlideImage[] // PDF 페이지 이미지들
  imageDataUrl?: string // 이미지 파일의 base64 URL (슬라이드로 사용)
  metadata?: {
    pages?: number
    duration?: string
    author?: string
    date?: string
    wordCount?: number
  }
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  timestamp: Date
}

interface AudioOverview {
  id: string
  title: string
  audioUrl?: string
  status: 'idle' | 'generating' | 'ready' | 'error'
  duration?: string
  transcript?: string
}

// API에서 반환하는 슬라이드 타입 (TTS 오디오 포함)
interface APISlide {
  number: number
  title: string
  narration: string
  bulletPoints: string[]
  imageUrl: string
  audioUrl?: string
}

// 팟캐스트 대화 라인 타입
interface DialogueLine {
  speaker: string
  text: string
}

interface GeneratedContent {
  id: string
  type: 'faq' | 'study-guide' | 'briefing-doc' | 'timeline' | 'slides' | 'video-overview' | 'audio-overview' | 'mindmap' | 'report' | 'flashcard' | 'quiz' | 'infographic' | 'data-table'
  title: string
  content: string
  status: 'generating' | 'ready' | 'error'
  createdAt: Date
  slides?: APISlide[]  // video-overview 슬라이드 (TTS 오디오 포함)
  // Podcast-style video-overview (Gemini 2.5 TTS Multi-Speaker)
  podcastAudioUrl?: string  // 전체 팟캐스트 오디오
  dialogueLines?: DialogueLine[]  // 파싱된 대화 라인들
}

// Title mapping for studio content types
const studioTitleMap: Record<string, string> = {
  'audio-overview': 'AI 오디오 오버뷰',
  'video-overview': '동영상 개요',
  'slides': '슬라이드 자료',
  'mindmap': '마인드맵',
  'report': '보고서',
  'flashcard': '플래시카드',
  'quiz': '퀴즈',
  'infographic': '인포그래픽',
  'data-table': '데이터 표'
}

// Generated Contents List Component - 타입 추론 문제 해결을 위해 분리
function GeneratedContentsList({
  contents,
  isDark,
  selectedPreview,
  onSelectContent
}: {
  contents: StudioContent[]
  isDark: boolean
  selectedPreview: StudioContent | null
  onSelectContent: (content: StudioContent) => void
}) {
  // 완료된 컨텐츠만 목록에 표시 (생성 중인 건 위에 별도 로딩 UI로 표시됨)
  const readyContents = contents.filter(c => c.status === 'ready')

  if (readyContents.length === 0) return null

  const colorMap: Record<string, string> = {
    'audio-overview': '#8B5CF6',
    'video-overview': '#EC4899',
    'mindmap': '#10B981',
    'report': '#3B82F6',
    'flashcard': '#F59E0B',
    'quiz': '#8B5CF6',
    'infographic': '#F97316',
    'slides': '#0EA5E9',
    'data-table': '#64748B'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn("text-sm font-semibold", isDark ? "text-white" : "text-gray-900")}>
          생성된 노트북
        </h3>
        <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>
          {readyContents.length}개
        </span>
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {readyContents.map((content) => {
          const color = colorMap[content.type] || '#64748B'
          const sameTypeContents = readyContents.filter(c => c.type === content.type)
          const indexInType = sameTypeContents.findIndex(c => c.id === content.id) + 1
          const showIndex = sameTypeContents.length > 1

          return (
            <button
              key={content.id}
              onClick={() => onSelectContent(content)}
              className={cn(
                "w-full p-2.5 rounded-xl text-left transition-all flex items-center gap-3 group hover:scale-[1.01]",
                selectedPreview?.id === content.id
                  ? isDark
                    ? "bg-white/10 border-2"
                    : "bg-gray-100 border-2"
                  : isDark
                    ? "bg-white/5 hover:bg-white/10 border border-white/10"
                    : "bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"
              )}
              style={{
                borderColor: selectedPreview?.id === content.id ? color : undefined
              }}
            >
              <div
                className="w-1 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm font-medium block truncate", isDark ? "text-white" : "text-gray-900")}>
                  {content.title}
                  {showIndex && (
                    <span className={cn("ml-1.5 text-xs", isDark ? "text-zinc-500" : "text-gray-400")}>
                      #{indexInType}
                    </span>
                  )}
                </span>
                <span className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-500")}>
                  {content.duration || content.subtitle || new Date(content.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 transition-transform group-hover:translate-x-0.5",
                isDark ? "text-zinc-500" : "text-gray-400"
              )} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Parse slide content to SlideData array
function parseSlides(content: string): SlideData[] {
  // Split by "## 슬라이드" or "# 슬라이드" or "---" separator
  const slideParts = content.split(/(?=#{1,2}\s*슬라이드\s*\d+)/gim).filter(s => s.trim())

  const result: SlideData[] = []

  slideParts.forEach((block, idx) => {
    const lines = block.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return

    // Extract title from first line: "## 슬라이드 1: 제목" or "# 슬라이드 1: [제목]"
    const firstLine = lines[0] || ''
    let title = ''

    const titleMatch = firstLine.match(/#{1,2}\s*슬라이드\s*\d+[::]\s*(.+)/i)
    if (titleMatch) {
      title = titleMatch[1].replace(/^\*\*|\*\*$/g, '').replace(/^\[|\]$/g, '').trim()
    } else {
      title = firstLine.replace(/^#+\s*/, '').replace(/^\*\*|\*\*$/g, '').trim() || `슬라이드 ${idx + 1}`
    }

    // Extract content and notes
    const contentLines: string[] = []
    let notes: string | undefined

    lines.slice(1).forEach(line => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine === '---') return

      // Check for speaker notes: "📝 발표자 노트: ..."
      if (trimmedLine.startsWith('📝') || trimmedLine.includes('발표자 노트')) {
        notes = trimmedLine.replace(/📝\s*/, '').replace(/발표자 노트[::]\s*/i, '').replace(/^\[|\]$/g, '').trim()
      }
      // Check for bullet points: "- ", "• ", "* ", "1. " etc.
      else if (trimmedLine.match(/^[-•*]\s+/) || trimmedLine.match(/^[0-9]+\.\s+/)) {
        contentLines.push(trimmedLine.replace(/^[-•*]\s+/, '').replace(/^[0-9]+\.\s+/, '').trim())
      }
      // Check for bold subtitle: **text**
      else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        contentLines.push(trimmedLine.replace(/^\*\*|\*\*$/g, '').replace(/^\[|\]$/g, '').trim())
      }
      // Check for "부제목:" line
      else if (trimmedLine.startsWith('부제목:')) {
        contentLines.push(trimmedLine.replace('부제목:', '').replace(/^\[|\]$/g, '').trim())
      }
      // Regular text (not headers)
      else if (!trimmedLine.startsWith('#')) {
        // Check for inline [text] brackets and extract content
        const bracketMatch = trimmedLine.match(/^\[([^\]]+)\]$/)
        if (bracketMatch) {
          contentLines.push(bracketMatch[1].trim())
        } else {
          contentLines.push(trimmedLine)
        }
      }
    })

    result.push({
      id: `slide-${idx}`,
      number: idx + 1,
      title: title,
      content: contentLines.length > 0 ? contentLines : ['내용 없음'],
      bulletPoints: contentLines.length > 0 ? contentLines : undefined,  // SlidesPreview와 호환을 위해 추가
      notes,
      type: idx === 0 ? 'title' : 'content'
    })
  })

  return result
}

export default function AIStudioPage() {
  const { resolvedTheme } = useTheme()
  const { accentColor } = useThemeStore()
  const isDark = resolvedTheme === 'dark'
  const themeColor = accentColors.find(c => c.id === accentColor)?.color || '#6366f1'

  // State
  const [sources, setSources] = useState<Source[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [selectedSourceType, setSelectedSourceType] = useState<'pdf' | 'web' | 'youtube' | 'text' | null>(null)

  // Audio Overview state
  // 여러 개의 오디오 오버뷰를 유지하는 배열
  const [audioOverviews, setAudioOverviews] = useState<AudioOverview[]>([])

  // Generated contents state
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([])

  // Customize audio dialog
  const [showCustomize, setShowCustomize] = useState(false)
  const [audioInstructions, setAudioInstructions] = useState('')

  // View full content modal - now uses StudioContent for right sidebar preview
  const [selectedPreview, setSelectedPreview] = useState<StudioContent | null>(null)
  const [generatingTypes, setGeneratingTypes] = useState<string[]>([])

  // Preview panel width state for resizable sidebar
  const [previewWidth, setPreviewWidth] = useState(500)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Suggested questions based on sources
  const suggestedQuestions = React.useMemo(() => {
    if (sources.length === 0) return []
    return [
      "이 문서의 핵심 내용을 요약해줘",
      "가장 중요한 포인트 3가지는?",
      "이 내용의 배경 설명해줘",
      "실제 적용 방법은?"
    ]
  }, [sources])

  // File upload handler
  const handleFileUpload = useCallback(async (files: FileList) => {
    // 팝업 먼저 닫기
    setShowAddSource(false)
    setSelectedSourceType(null)

    // 지원되는 파일 형식
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/msword', // doc
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
      'application/vnd.ms-powerpoint', // ppt
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'text/plain', // txt
      'text/csv', // csv
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ]
    const supportedExtensions = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif']

    // 파일들 먼저 필터링하고 Source 객체 생성
    const filesToUpload: { file: File; source: Source }[] = []

    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().split('.').pop() || ''
      const isSupported = supportedTypes.includes(file.type) || supportedExtensions.includes(ext)

      if (!isSupported) {
        alert(`지원하지 않는 파일 형식입니다: ${file.name}\n지원 형식: PDF, DOCX, PPTX, XLSX, TXT, CSV, PNG, JPG`)
        continue
      }

      // 파일 타입 결정
      let fileType: Source['type'] = 'pdf'
      if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        fileType = 'image'
      } else if (['doc', 'docx'].includes(ext)) {
        fileType = 'doc'
      } else if (['ppt', 'pptx'].includes(ext)) {
        fileType = 'ppt'
      } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
        fileType = 'xls'
      } else if (['txt'].includes(ext)) {
        fileType = 'text'
      }
      const fileName = file.name.replace(/\.[^/.]+$/, '')

      const newSource: Source = {
        id: crypto.randomUUID(),
        type: fileType,
        title: fileName,
        status: 'uploading',
        selected: true
      }

      filesToUpload.push({ file, source: newSource })
    }

    // 모든 Source를 한번에 추가
    if (filesToUpload.length > 0) {
      setSources(prev => [...prev, ...filesToUpload.map(f => f.source)])
    }

    // 모든 파일 병렬 업로드
    await Promise.all(filesToUpload.map(async ({ file, source }) => {
      try {
        // 이미지 파일은 base64로 변환하여 저장 (슬라이드로 사용)
        let imageDataUrl: string | undefined
        if (source.type === 'image') {
          imageDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
        }

        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/ai-studio/upload', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (response.ok) {
          setSources(prev => prev.map(s =>
            s.id === source.id
              ? {
                  ...s,
                  status: 'ready',
                  content: data.content,
                  summary: data.summary,
                  imageDataUrl, // 이미지 base64 URL 저장
                  metadata: {
                    ...data.metadata,
                    wordCount: data.content?.length || 0
                  }
                }
              : s
          ))
        } else {
          setSources(prev => prev.map(s =>
            s.id === source.id ? { ...s, status: 'error' } : s
          ))
        }
      } catch {
        setSources(prev => prev.map(s =>
          s.id === source.id ? { ...s, status: 'error' } : s
        ))
      }
    }))
    setShowAddSource(false)
    setSelectedSourceType(null)
  }, [])

  const handleWebUrl = useCallback(async (url: string) => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      type: 'web',
      title: url,
      url,
      status: 'processing',
      selected: true
    }
    setSources(prev => [...prev, newSource])
    setShowAddSource(false)
    setSelectedSourceType(null)

    try {
      const response = await fetch('/api/ai-studio/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      const data = await response.json()

      if (response.ok) {
        setSources(prev => prev.map(s =>
          s.id === newSource.id
            ? { ...s, status: 'ready', title: data.title || url, content: data.content, summary: data.summary }
            : s
        ))
      } else {
        setSources(prev => prev.map(s =>
          s.id === newSource.id ? { ...s, status: 'error' } : s
        ))
      }
    } catch {
      setSources(prev => prev.map(s =>
        s.id === newSource.id ? { ...s, status: 'error' } : s
      ))
    }
  }, [])

  const handleYoutubeUrl = useCallback(async (url: string) => {
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    if (!videoIdMatch) {
      alert('유효한 YouTube URL이 아닙니다')
      return
    }

    const newSource: Source = {
      id: crypto.randomUUID(),
      type: 'youtube',
      title: 'YouTube 영상',
      url,
      status: 'processing',
      selected: true
    }
    setSources(prev => [...prev, newSource])
    setShowAddSource(false)
    setSelectedSourceType(null)

    try {
      const response = await fetch('/api/ai-studio/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, videoId: videoIdMatch[1] })
      })

      const data = await response.json()

      if (response.ok) {
        setSources(prev => prev.map(s =>
          s.id === newSource.id
            ? {
                ...s,
                status: 'ready',
                title: data.title || 'YouTube 영상',
                content: data.transcript,
                summary: data.summary,
                metadata: { duration: data.duration }
              }
            : s
        ))
      } else {
        setSources(prev => prev.map(s =>
          s.id === newSource.id ? { ...s, status: 'error' } : s
        ))
      }
    } catch {
      setSources(prev => prev.map(s =>
        s.id === newSource.id ? { ...s, status: 'error' } : s
      ))
    }
  }, [])

  const handleTextInput = useCallback(async (text: string) => {
    const newSource: Source = {
      id: crypto.randomUUID(),
      type: 'text',
      title: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
      content: text,
      status: 'processing',
      selected: true
    }
    setSources(prev => [...prev, newSource])
    setShowAddSource(false)
    setSelectedSourceType(null)

    try {
      const response = await fetch('/api/ai-studio/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      const data = await response.json()

      if (response.ok) {
        setSources(prev => prev.map(s =>
          s.id === newSource.id ? { ...s, status: 'ready', summary: data.summary } : s
        ))
      } else {
        setSources(prev => prev.map(s =>
          s.id === newSource.id ? { ...s, status: 'error' } : s
        ))
      }
    } catch {
      setSources(prev => prev.map(s =>
        s.id === newSource.id ? { ...s, status: 'error' } : s
      ))
    }
  }, [])

  const handleDeleteSource = useCallback((id: string) => {
    setSources(prev => prev.filter(s => s.id !== id))
  }, [])

  const toggleSourceSelection = useCallback((id: string) => {
    setSources(prev => prev.map(s =>
      s.id === id ? { ...s, selected: !s.selected } : s
    ))
  }, [])

  // Chat handler
  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || inputValue
    if (!text.trim() || sources.length === 0) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai-studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sources: sources.filter(s => s.status === 'ready' && s.selected !== false).map(s => ({
            id: s.id,
            type: s.type,
            title: s.title,
            content: s.content,
            summary: s.summary
          })),
          history: messages.slice(-10)
        })
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response || '응답을 생성하지 못했습니다',
        sources: data.sources,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      }])
    } finally {
      setIsGenerating(false)
    }
  }, [inputValue, sources, messages])

  // Audio Overview (Deep Dive) handler - 기존 오디오 유지하고 새로 추가
  const handleGenerateAudio = useCallback(async () => {
    if (sources.length === 0) return

    // 새 오디오 ID 생성
    const newAudioId = crypto.randomUUID()

    // 생성 중인 오디오를 배열에 추가
    setAudioOverviews(prev => [...prev, {
      id: newAudioId,
      title: 'Deep Dive conversation',
      status: 'generating'
    }])
    setGeneratingTypes(prev => [...prev, 'audio-overview'])
    setShowCustomize(false)

    try {
      const response = await fetch('/api/ai-studio/podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sources.filter(s => s.status === 'ready' && s.selected !== false).map(s => ({
            id: s.id,
            type: s.type,
            title: s.title,
            content: s.content,
            summary: s.summary
          })),
          instructions: audioInstructions || undefined
        })
      })

      const data = await response.json()

      if (response.ok) {
        // 해당 ID의 오디오를 ready 상태로 업데이트
        setAudioOverviews(prev => prev.map(audio =>
          audio.id === newAudioId
            ? {
                ...audio,
                status: 'ready' as const,
                audioUrl: data.audioUrl,
                duration: data.duration,
                transcript: data.transcript
              }
            : audio
        ))
      } else {
        // 해당 ID의 오디오를 error 상태로 업데이트
        setAudioOverviews(prev => prev.map(audio =>
          audio.id === newAudioId
            ? { ...audio, status: 'error' as const }
            : audio
        ))
      }
    } catch {
      setAudioOverviews(prev => prev.map(audio =>
        audio.id === newAudioId
          ? { ...audio, status: 'error' as const }
          : audio
      ))
    } finally {
      setGeneratingTypes(prev => prev.filter(t => t !== 'audio-overview'))
    }
  }, [sources, audioInstructions])

  // Handle content selection for preview panel
  const handleSelectContent = useCallback((content: StudioContent) => {
    setSelectedPreview(content)
  }, [])

  // Content generation handler - Now accepts StudioContent types
  const handleGenerateContent = useCallback(async (type: StudioContent['type']) => {
    // Map StudioContent types to GeneratedContent types where applicable
    const typeConfig: Record<string, { title: string; prompt: string }> = {
      'slides': {
        title: 'Slides',
        prompt: `이 자료들을 기반으로 프레젠테이션 슬라이드를 생성해주세요.

형식:
# 슬라이드 1: [제목]
- 핵심 포인트 1
- 핵심 포인트 2
- 핵심 포인트 3
[발표자 노트: 이 슬라이드에서 강조할 내용]

# 슬라이드 2: [제목]
...

10-15개의 슬라이드를 생성하고, 각 슬라이드에는 핵심 포인트 3-5개와 발표자 노트를 포함해주세요.
첫 슬라이드는 제목 슬라이드, 마지막 슬라이드는 요약/결론 슬라이드로 구성해주세요.`
      },
      'video-overview': {
        title: 'Video overview',
        prompt: `당신은 인기 유튜브 다큐멘터리 크리에이터입니다. 이 자료를 바탕으로 7-10분 분량의 몰입감 있는 영상 나레이션을 작성해주세요.

## 필수 형식 (NotebookLM 스타일)
- 모든 문장 앞에 타임스탬프를 붙여주세요: (0:00), (0:04), (0:08)...
- 타임스탬프는 3-5초 간격으로 자연스럽게 배치
- 한 문장은 2-4초 분량 (15-40자 정도)
- 7분(420초) 이상 분량으로 작성

## 말투 스타일 (매우 중요!)
- 유튜브 크리에이터처럼 친근하고 흥미진진하게
- "자, 오늘은~", "이거 보세요", "정말 대단하지 않나요?", "과연 어떨까요?"
- 감탄, 질문, 호기심 유발하는 표현 적극 사용
- 시청자에게 직접 말하는 것처럼: "여러분", "한번 보시죠", "같이 알아볼까요?"

## 스토리텔링 구조
1. **훅 (0:00-0:30)**: 강렬한 질문이나 놀라운 사실로 시작
2. **여정**: 정보 나열이 아닌, 탐험하듯 진행
   - "자, 첫 번째로 들어가 볼까요?"
   - "이제 한 발짝 물러나서 전체를 봅시다"
3. **시각적 언급**: 마치 영상을 보는 것처럼
   - "여기 보이는 이 다이어그램이", "이 장면이 딱 보여주는 거예요"
4. **감정 고조**: 핵심 포인트에서 감탄/강조
   - "정말 엄청난 아이디어 아닌가요?", "이게 바로 핵심이에요!"
5. **마무리**: 여운 남기는 질문이나 희망적 메시지

## 예시 출력
(0:00) 자, 오늘은 몽골의 그 광활한 초원에서 벌어지고 있는
(0:04) 아주 놀라운 농업혁명에 대해 이야기해보려고 합니다.
(0:08) 우리가 흔히 생각하는 농업의 모습,
(0:10) 그 모든 걸 완전히 뒤바꿀지도 모를 이야기,
(0:13) 지금부터 시작해볼게요.
(0:16) 이거 보세요.
(0:18) 정말 미래적인 돔구조물이죠?
(0:21) 꼭 무슨 화성에 세워진 농업기지 같지 않나요?
(0:25) 하지만 여긴 바로 지구, 몽골의 심장부에서
(0:28) 미래를 일구고 있는 현장입니다.
...

7분 이상의 나레이션을 타임스탬프 형식으로 작성해주세요.`
      },
      'mindmap': { title: '마인드맵', prompt: '이 자료들을 기반으로 계층적 마인드맵을 생성해주세요. 중심 주제에서 세부 주제로 확장되는 구조로 작성하세요.' },
      'report': { title: '보고서', prompt: '이 자료들을 기반으로 전문적인 보고서를 작성해주세요. 요약, 본문, 결론 구조로 작성하세요.' },
      'flashcard': { title: '플래시카드', prompt: '이 자료들을 기반으로 학습용 플래시카드 20개를 생성해주세요. 각 카드는 질문과 답변 형식입니다.' },
      'quiz': { title: '퀴즈', prompt: '이 자료들을 기반으로 객관식 퀴즈 15문제를 생성해주세요. 각 문제는 4개의 선택지와 정답을 포함합니다.' },
      'infographic': { title: '인포그래픽', prompt: '이 자료들을 기반으로 인포그래픽 콘텐츠를 생성해주세요. 핵심 통계, 시각화 제안, 주요 포인트를 포함합니다.' },
      'data-table': { title: '데이터 표', prompt: '이 자료들에서 핵심 데이터를 추출하여 정리된 표 형식으로 작성해주세요.' }
    }

    // Handle audio-overview separately
    if (type === 'audio-overview') {
      handleGenerateAudio()
      return
    }

    const config = typeConfig[type]
    if (!config) return

    // Add to generating types
    setGeneratingTypes(prev => [...prev, type])

    const newContent: GeneratedContent = {
      id: crypto.randomUUID(),
      type: type as GeneratedContent['type'],
      title: config.title,
      content: '',
      status: 'generating',
      createdAt: new Date()
    }

    setGeneratedContents(prev => [...prev, newContent])

    try {
      // 이미지 소스들의 base64 URL 수집 (video-overview일 때)
      const selectedImageSources = sources
        .filter(s => s.status === 'ready' && s.selected !== false && s.type === 'image' && s.imageDataUrl)
        .map(s => ({
          title: s.title,
          imageDataUrl: s.imageDataUrl
        }))

      const response = await fetch('/api/ai-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          prompt: config.prompt,
          sources: sources.filter(s => s.status === 'ready' && s.selected !== false).map(s => ({
            id: s.id,
            type: s.type,
            title: s.title,
            content: s.content,
            summary: s.summary
          })),
          // video-overview일 때 이미지 데이터 전달
          images: type === 'video-overview' ? selectedImageSources : undefined
        })
      })

      const data = await response.json()

      if (response.ok && data.content) {
        setGeneratedContents(prev => prev.map(c =>
          c.id === newContent.id ? {
            ...c,
            status: 'ready',
            content: data.content,
            // video-overview일 때 슬라이드 데이터 (TTS 오디오 포함) 저장
            slides: data.slides,
            // Podcast-style video-overview (Gemini 2.5 TTS Multi-Speaker)
            podcastAudioUrl: data.audioUrl,
            dialogueLines: data.dialogueLines
          } : c
        ))
      } else {
        setGeneratedContents(prev => prev.map(c =>
          c.id === newContent.id ? { ...c, status: 'error' } : c
        ))
      }
    } catch {
      setGeneratedContents(prev => prev.map(c =>
        c.id === newContent.id ? { ...c, status: 'error' } : c
      ))
    } finally {
      setGeneratingTypes(prev => prev.filter(t => t !== type))
    }
  }, [sources, handleGenerateAudio])

  const readySources = sources.filter(s => s.status === 'ready')
  const selectedSources = readySources.filter(s => s.selected !== false)

  // Convert generated contents and audio to StudioContent format
  const studioContents: StudioContent[] = React.useMemo(() => {
    const contents: StudioContent[] = []

    // Add all audio overviews - 여러 개의 오디오 오버뷰 지원
    audioOverviews.forEach((audio, index) => {
      if (audio.status === 'generating' || (audio.status === 'ready' && audio.audioUrl)) {
        contents.push({
          id: audio.id,
          type: 'audio-overview',
          title: `${studioTitleMap['audio-overview']}${audioOverviews.length > 1 ? ` #${index + 1}` : ''}`,
          subtitle: audio.status === 'generating' ? '생성 중...' : `소스 ${selectedSources.length}개 기반`,
          content: audio.transcript || '',
          status: audio.status,
          createdAt: new Date(),
          audioUrl: audio.audioUrl,
          duration: audio.duration,
          sourceCount: selectedSources.length
        })
      }
    })

    // 업로드된 이미지 소스들의 imageDataUrl 수집 (슬라이드로 사용)
    const sourceSlideImages: SlideImage[] = selectedSources
      .filter(s => s.type === 'image' && s.imageDataUrl)
      .map((s, idx) => ({
        pageNumber: idx + 1,
        imageUrl: s.imageDataUrl!,
        title: s.title
      }))

    // Add other generated contents - 생성 중인 콘텐츠도 포함 (로딩 UI 표시)
    generatedContents.filter(gc => gc.status === 'generating' || (gc.status === 'ready' && gc.content)).forEach(gc => {
      const typeMap: Record<string, StudioContent['type']> = {
        'slides': 'slides',
        'video-overview': 'video-overview',
        'audio-overview': 'audio-overview',
        'mindmap': 'mindmap',
        'report': 'report',
        'flashcard': 'flashcard',
        'quiz': 'quiz',
        'infographic': 'infographic',
        'data-table': 'data-table',
        'faq': 'report',
        'study-guide': 'report',
        'briefing-doc': 'report',
        'timeline': 'report'
      }
      const studioType = typeMap[gc.type] || 'report'

      // video-overview일 때 API에서 반환된 slides 데이터 변환 (TTS 오디오 포함)
      let videoSlides: SlideData[] | undefined
      if (studioType === 'video-overview' && gc.slides && gc.slides.length > 0) {
        videoSlides = gc.slides.map(s => ({
          number: s.number,
          title: s.title,
          narration: s.narration,
          bulletPoints: s.bulletPoints,
          imageUrl: s.imageUrl,
          audioUrl: s.audioUrl
        }))
      }

      contents.push({
        id: gc.id,
        type: studioType,
        title: studioTitleMap[studioType] || gc.title,
        subtitle: `소스 ${selectedSources.length}개 기반`,
        content: gc.content,
        status: gc.status,
        createdAt: gc.createdAt,
        slides: studioType === 'slides' ? parseSlides(gc.content) : videoSlides,
        // video-overview일 때 업로드된 이미지들을 슬라이드 이미지로 전달 (fallback)
        slideImages: studioType === 'video-overview' && !videoSlides ? sourceSlideImages : undefined,
        sourceCount: selectedSources.length,
        // Podcast-style video-overview (Gemini 2.5 TTS Multi-Speaker)
        podcastAudioUrl: gc.podcastAudioUrl,
        dialogueLines: gc.dialogueLines
      })
    })

    return contents
  }, [audioOverviews, generatedContents, selectedSources])

  return (
    <div className={cn("h-full flex", isDark ? "bg-[#1a1a2e]" : "bg-gray-50")}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
      />

      {/* Left Sidebar - Sources */}
      <div className={cn(
        "w-72 flex-shrink-0 border-r flex flex-col",
        isDark ? "bg-[#0f0f1a] border-white/10" : "bg-white border-gray-200"
      )}>
        <div className="p-4 border-b border-inherit">
          <div className="flex items-center justify-between mb-4">
            <h2 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
              Sources
            </h2>
            <span className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium",
              isDark ? "bg-white/10 text-zinc-400" : "bg-gray-100 text-gray-500"
            )}>
              {sources.length} / 50
            </span>
          </div>

          <button
            onClick={() => setShowAddSource(true)}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all",
              isDark
                ? "border-white/20 hover:border-white/40 text-zinc-400 hover:text-white hover:bg-white/5"
                : "border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Add source</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {sources.length === 0 ? (
            <div className={cn("text-center py-12 px-4", isDark ? "text-zinc-500" : "text-gray-400")}>
              <div className={cn(
                "w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center",
                isDark ? "bg-white/5" : "bg-gray-100"
              )}>
                <BookOpen className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-medium mb-1">No sources yet</p>
              <p className="text-xs opacity-70">
                Add PDFs, websites, YouTube videos, or paste text to get started
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sources.map(source => (
                <SourceItem
                  key={source.id}
                  source={source}
                  isDark={isDark}
                  themeColor={themeColor}
                  onDelete={() => handleDeleteSource(source.id)}
                  onToggle={() => toggleSourceSelection(source.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Source summary */}
        {readySources.length > 0 && (
          <div className={cn(
            "p-4 border-t",
            isDark ? "border-white/10" : "border-gray-200"
          )}>
            <div className="flex items-center justify-between text-xs">
              <span className={cn(isDark ? "text-zinc-500" : "text-gray-500")}>
                Selected: {selectedSources.length} / {readySources.length}
              </span>
              <button
                onClick={() => setSources(prev => prev.map(s => ({ ...s, selected: true })))}
                className="hover:underline"
                style={{ color: themeColor }}
              >
                Select all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                style={{ background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}10)` }}
              >
                <Search className="w-10 h-10" style={{ color: themeColor }} />
              </div>
              <h3 className={cn("text-2xl font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
                {selectedSources.length > 0 ? "Start exploring your sources" : "Add sources to get started"}
              </h3>
              <p className={cn("text-base max-w-lg mb-8", isDark ? "text-zinc-400" : "text-gray-500")}>
                {selectedSources.length > 0
                  ? "Ask questions, generate summaries, or create audio overviews from your uploaded content."
                  : "Upload PDFs, add website URLs, YouTube videos, or paste text to begin analyzing."}
              </p>

              {selectedSources.length > 0 && (
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(q)}
                      className={cn(
                        "px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105",
                        isDark
                          ? "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                          : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}
                  >
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl",
                      msg.role === 'user'
                        ? "text-white rounded-br-md"
                        : isDark
                          ? "bg-white/5 text-white rounded-bl-md"
                          : "bg-white text-gray-900 shadow-sm rounded-bl-md border border-gray-100"
                    )}
                    style={msg.role === 'user' ? { backgroundColor: themeColor } : undefined}
                    >
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-1">
                          <span className="text-xs opacity-60">Sources:</span>
                          {msg.sources.map((s, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/10">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="flex justify-start">
                    <div className={cn(
                      "p-4 rounded-2xl rounded-bl-md flex items-center gap-3",
                      isDark ? "bg-white/5" : "bg-white shadow-sm border border-gray-100"
                    )}>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: themeColor, animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: themeColor, animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: themeColor, animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className={cn("p-4 border-t", isDark ? "border-white/10" : "border-gray-200")}>
          <div className="max-w-3xl mx-auto">
            <div className={cn(
              "flex items-center gap-3 px-5 py-3 rounded-2xl border shadow-lg",
              isDark ? "bg-[#0f0f1a] border-white/10" : "bg-white border-gray-200"
            )}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder={selectedSources.length > 0 ? "Start typing to chat with your sources..." : "Add sources to start chatting"}
                disabled={selectedSources.length === 0 || isGenerating}
                className={cn(
                  "flex-1 bg-transparent outline-none text-base",
                  isDark ? "text-white placeholder:text-zinc-500" : "text-gray-900 placeholder:text-gray-400"
                )}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || selectedSources.length === 0 || isGenerating}
                className="p-2.5 rounded-xl text-white transition-all disabled:opacity-30 hover:scale-105 disabled:hover:scale-100"
                style={{ backgroundColor: themeColor }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Studio (NotebookLM Style 9-Card Grid) */}
      <div className={cn(
        "flex-shrink-0 flex",
        isDark ? "bg-[#0f0f1a]" : "bg-white"
      )}>
        {/* Main Studio Panel - 미리보기 열리면 숨김 */}
        {!selectedPreview && (
        <div className={cn(
          "w-80 flex flex-col flex-shrink-0 border-l",
          isDark ? "border-white/10" : "border-gray-200"
        )}>
          <div className={cn(
            "px-5 py-4 border-b flex items-center justify-between",
            isDark ? "border-white/10" : "border-gray-200"
          )}>
            <h2 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
              Studio
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCustomize(true)}
                disabled={selectedSources.length === 0}
                className={cn(
                  "p-2 rounded-lg transition-colors disabled:opacity-40",
                  isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
                )}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Header Info */}
            <div className={cn(
              "p-4 rounded-xl",
              isDark ? "bg-zinc-900/50 border border-white/10" : "bg-gray-50 border border-gray-200"
            )}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={cn("font-semibold text-sm", isDark ? "text-white" : "text-gray-900")}>
                  AI Studio
                </h3>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  isDark ? "bg-white/10 text-zinc-400" : "bg-gray-200 text-gray-600"
                )}>
                  소스 {selectedSources.length}개
                </span>
              </div>
              {selectedSources.length === 0 && (
                <p className={cn("text-xs", isDark ? "text-zinc-500" : "text-gray-400")}>
                  왼쪽에서 소스를 추가하면 콘텐츠를 생성할 수 있습니다
                </p>
              )}
            </div>

            {/* 9-Card Grid - NotebookLM Style */}
            <div>
              <h3 className={cn("text-sm font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
                콘텐츠 생성
              </h3>
              <StudioCardGrid
                contents={studioContents}
                generatingTypes={generatingTypes}
                isDark={isDark}
                themeColor={themeColor}
                onGenerate={handleGenerateContent}
                onSelect={handleSelectContent}
                disabled={selectedSources.length === 0}
              />
            </div>

            {/* 생성 중 로딩 표시 (카드 아래) */}
            {generatingTypes.length > 0 && (
              <div className={cn(
                "p-4 rounded-xl border",
                isDark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
              )}>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: themeColor }} />
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", isDark ? "text-white" : "text-gray-900")}>
                      {studioTitleMap[generatingTypes[0]] || generatingTypes[0]} 생성 중...
                    </p>
                    <p className={cn("text-xs mt-0.5", isDark ? "text-zinc-500" : "text-gray-500")}>
                      소스를 분석하고 콘텐츠를 생성하고 있습니다
                    </p>
                  </div>
                </div>
                {/* 프로그레스 바 */}
                <div className={cn(
                  "mt-3 h-1.5 rounded-full overflow-hidden",
                  isDark ? "bg-white/10" : "bg-gray-200"
                )}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: themeColor }}
                    initial={{ width: '0%' }}
                    animate={{ width: '70%' }}
                    transition={{ duration: 3, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* Generated Contents List - NotebookLM 스타일 */}
            <GeneratedContentsList
              contents={studioContents}
              isDark={isDark}
              selectedPreview={selectedPreview}
              onSelectContent={handleSelectContent}
            />
          </div>
        </div>
        )}

        {/* Preview Panel - Right Side (Resizable) */}
        <AnimatePresence>
          {selectedPreview && (
            <StudioPreviewPanel
              content={selectedPreview}
              isDark={isDark}
              themeColor={themeColor}
              onClose={() => setSelectedPreview(null)}
              onFeedback={(type) => console.log('Feedback:', type)}
              width={previewWidth}
              onResize={setPreviewWidth}
              minWidth={360}
              maxWidth={1200}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Add Source Modal */}
      <AnimatePresence>
        {showAddSource && (
          <AddSourceModal
            isDark={isDark}
            themeColor={themeColor}
            selectedType={selectedSourceType}
            onSelectType={setSelectedSourceType}
            onClose={() => { setShowAddSource(false); setSelectedSourceType(null) }}
            onFileUpload={() => fileInputRef.current?.click()}
            onWebUrl={handleWebUrl}
            onYoutubeUrl={handleYoutubeUrl}
            onTextInput={handleTextInput}
          />
        )}
      </AnimatePresence>

      {/* Customize Audio Modal */}
      <AnimatePresence>
        {showCustomize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCustomize(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "relative w-full max-w-md rounded-2xl p-6",
                isDark ? "bg-zinc-900" : "bg-white"
              )}
            >
              <h3 className={cn("text-lg font-semibold mb-2", isDark ? "text-white" : "text-gray-900")}>
                Customize Audio Overview
              </h3>
              <p className={cn("text-sm mb-4", isDark ? "text-zinc-400" : "text-gray-500")}>
                Tell the AI hosts what to focus on in the conversation.
              </p>
              <textarea
                value={audioInstructions}
                onChange={(e) => setAudioInstructions(e.target.value)}
                placeholder="e.g., Focus on the business model, market analysis, and key competitors..."
                rows={4}
                className={cn(
                  "w-full p-4 rounded-xl border resize-none outline-none text-sm mb-4",
                  isDark
                    ? "bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-white/30"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300"
                )}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCustomize(false)}
                  className={cn(
                    "flex-1 py-3 rounded-xl text-sm font-medium transition-colors",
                    isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateAudio}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white hover:scale-[1.02] transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  Generate Audio
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

// Source Item Component
function SourceItem({
  source,
  isDark,
  themeColor,
  onDelete,
  onToggle
}: {
  source: Source
  isDark: boolean
  themeColor: string
  onDelete: () => void
  onToggle: () => void
}) {
  const iconMap: Record<Source['type'], typeof FileText> = {
    pdf: FileText,
    web: Globe,
    youtube: Youtube,
    text: FileText,
    image: ImageIcon,
    doc: FileText,
    ppt: FileText,
    xls: FileText
  }
  const Icon = iconMap[source.type] || FileText
  const isSelected = source.selected !== false

  return (
    <div
      onClick={onToggle}
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all",
        isDark
          ? isSelected ? "bg-white/10" : "hover:bg-white/5 opacity-50"
          : isSelected ? "bg-gray-100" : "hover:bg-gray-50 opacity-50"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
        isDark ? "bg-white/10" : "bg-white"
      )}>
        <Icon className={cn("w-4 h-4", isDark ? "text-zinc-400" : "text-gray-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium block truncate", isDark ? "text-white" : "text-gray-900")}>
          {source.title}
        </span>
        <div className="flex items-center gap-1">
          {source.status === 'ready' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          ) : source.status === 'error' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: themeColor }} />
          )}
          <span className={cn("text-xs capitalize", isDark ? "text-zinc-500" : "text-gray-500")}>
            {source.type}
          </span>
        </div>
      </div>
      {source.status === 'uploading' || source.status === 'processing' ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: themeColor }} />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Add Source Modal
function AddSourceModal({
  isDark,
  themeColor,
  selectedType,
  onSelectType,
  onClose,
  onFileUpload,
  onWebUrl,
  onYoutubeUrl,
  onTextInput
}: {
  isDark: boolean
  themeColor: string
  selectedType: 'pdf' | 'web' | 'youtube' | 'text' | null
  onSelectType: (type: 'pdf' | 'web' | 'youtube' | 'text') => void
  onClose: () => void
  onFileUpload: () => void
  onWebUrl: (url: string) => void
  onYoutubeUrl: (url: string) => void
  onTextInput: (text: string) => void
}) {
  const [urlInput, setUrlInput] = useState('')
  const [textInput, setTextInput] = useState('')
  const [searchMode, setSearchMode] = useState<'web' | 'fast'>('web')

  // 웹 검색 핸들러
  const handleWebSearch = () => {
    if (urlInput.trim()) {
      // URL이면 웹사이트로, 아니면 검색어로 처리
      if (urlInput.startsWith('http://') || urlInput.startsWith('https://')) {
        onWebUrl(urlInput)
      } else {
        // 검색어를 Google 검색 URL로 변환
        onWebUrl(`https://www.google.com/search?q=${encodeURIComponent(urlInput)}`)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className={cn(
          "relative w-full max-w-2xl rounded-2xl overflow-hidden",
          isDark ? "bg-[#1a1a2e]" : "bg-white"
        )}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 p-2 rounded-full z-10 transition-colors",
            isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-100 text-gray-500"
          )}
        >
          <X className="w-5 h-5" />
        </button>

        {/* 헤더 - NotebookLM 스타일 */}
        <div className="pt-8 pb-4 px-8 text-center">
          <h2 className={cn(
            "text-xl font-semibold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}>
            <span style={{ color: themeColor }}>웹사이트</span>를 활용해 AI 오디오 및 동영상 오버뷰 만들기
          </h2>
        </div>

        {/* 검색바 */}
        <div className="px-8 pb-6">
          <div className={cn(
            "rounded-xl border overflow-hidden",
            isDark ? "bg-[#0d0d1a] border-white/10" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center px-4 py-3 gap-3">
              <Search className={cn("w-5 h-5 flex-shrink-0", isDark ? "text-zinc-500" : "text-gray-400")} />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
                placeholder="웹에서 새 소스를 검색하세요"
                className={cn(
                  "flex-1 bg-transparent outline-none text-sm",
                  isDark ? "text-white placeholder:text-zinc-500" : "text-gray-900 placeholder:text-gray-400"
                )}
              />
              <button
                onClick={handleWebSearch}
                disabled={!urlInput.trim()}
                className={cn(
                  "p-2 rounded-lg transition-colors disabled:opacity-30",
                  isDark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-gray-200 text-gray-500"
                )}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* 검색 옵션 */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 border-t",
              isDark ? "border-white/5" : "border-gray-100"
            )}>
              <button
                onClick={() => setSearchMode('web')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  searchMode === 'web'
                    ? isDark ? "bg-white/10 text-white" : "bg-gray-200 text-gray-900"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Globe className="w-3.5 h-3.5" />
                웹
              </button>
              <button
                onClick={() => setSearchMode('fast')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  searchMode === 'fast'
                    ? isDark ? "bg-white/10 text-white" : "bg-gray-200 text-gray-900"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Fast Research
              </button>
            </div>
          </div>
        </div>

        {/* 드롭존 */}
        <div className="px-8 pb-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
              isDark
                ? "border-white/10 hover:border-white/20 bg-white/[0.02]"
                : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
            )}
            onClick={onFileUpload}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              // 드롭된 파일 처리
              const files = e.dataTransfer.files
              if (files.length > 0) {
                onFileUpload()
              }
            }}
          >
            <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-500")}>
              or drop your files
            </p>
          </div>
        </div>

        {/* 소스 타입 버튼들 */}
        <div className="px-8 pb-8">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={onFileUpload}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              파일 업로드
            </button>

            <button
              onClick={() => onSelectType('web')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
              )}
            >
              <Globe className="w-4 h-4" />
              <Youtube className="w-4 h-4 text-red-500" />
              웹사이트
            </button>

            <button
              onClick={() => {/* Google Drive 연동 */}}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.433 22l3.103-5.333H22l-3.103 5.333H4.433zm14.97-7.333l-7.317-12.6L8.99 7.667l7.2 12.4 3.213-5.4zM2 16l3.467-6H12.9l-3.467 6H2z"/>
              </svg>
              Drive
            </button>

            <button
              onClick={() => onSelectType('text')}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all",
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
              )}
            >
              <FileText className="w-4 h-4" />
              복사된 텍스트
            </button>
          </div>
        </div>

        {/* URL/텍스트 입력 화면 */}
        {selectedType && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "absolute inset-0 p-8",
              isDark ? "bg-[#1a1a2e]" : "bg-white"
            )}
          >
            <button
              onClick={() => onSelectType(null as any)}
              className={cn(
                "flex items-center gap-1 text-sm font-medium mb-6",
                isDark ? "text-zinc-400 hover:text-white" : "text-gray-500 hover:text-gray-900"
              )}
            >
              <ChevronLeft className="w-4 h-4" /> 뒤로
            </button>

            {selectedType === 'text' ? (
              <div className="space-y-4">
                <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
                  텍스트 붙여넣기
                </h3>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="여기에 텍스트를 붙여넣으세요..."
                  rows={10}
                  autoFocus
                  className={cn(
                    "w-full p-4 rounded-xl border resize-none outline-none text-sm",
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-white/30"
                      : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300"
                  )}
                />
                <button
                  onClick={() => textInput && onTextInput(textInput)}
                  disabled={!textInput.trim()}
                  className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-40 transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  텍스트 추가
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-gray-900")}>
                  {selectedType === 'youtube' ? 'YouTube URL 입력' : '웹사이트 URL 입력'}
                </h3>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && urlInput.trim()) {
                      selectedType === 'youtube' ? onYoutubeUrl(urlInput) : onWebUrl(urlInput)
                    }
                  }}
                  placeholder={selectedType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://example.com'}
                  autoFocus
                  className={cn(
                    "w-full px-4 py-3.5 rounded-xl border outline-none text-sm",
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder:text-zinc-500 focus:border-white/30"
                      : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-gray-300"
                  )}
                />
                <button
                  onClick={() => urlInput && (selectedType === 'youtube' ? onYoutubeUrl(urlInput) : onWebUrl(urlInput))}
                  disabled={!urlInput.trim()}
                  className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-40 transition-all"
                  style={{ backgroundColor: themeColor }}
                >
                  {selectedType === 'youtube' ? '동영상 추가' : '웹사이트 추가'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
