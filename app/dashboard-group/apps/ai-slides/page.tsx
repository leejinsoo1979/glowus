"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Loader2, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAIAppSync } from "@/hooks/useAIAppSync"

// Types
import type { SlideContent, Message, TodoItem, SavedPresentation, SourceFile, ResearchDoc } from "./types"
import { ParsedPresentationV2, TextElement } from "./types/slide-elements"

// Components
import { ChatPanel, ResearchPanel, SlidePreviewPanel, PreviewHeader, PreviewTabs } from "./components"
import { extractPresentationText } from "./components/slide-editor/SlideThumbnail"

// Helper functions for file type detection
const isPdfFile = (file: File): boolean => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

const isPptxFile = (file: File): boolean => {
    return file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        file.name.toLowerCase().endsWith('.pptx') ||
        file.name.toLowerCase().endsWith('.ppt')
}

// Dynamic imports for heavy libraries
const SlideEditor = dynamic(
    () => import("./components/slide-editor").then(mod => mod.SlideEditor),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div> }
)

export default function AISlidesPage() {
    // ===== STATE =====
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [slides, setSlides] = useState<SlideContent[]>([])
    const [currentSlide, setCurrentSlide] = useState(0)
    const [todos, setTodos] = useState<TodoItem[]>([])
    const [activeTab, setActiveTab] = useState<'preview' | 'research' | 'code' | 'thinking'>('preview')
    const [chatTab, setChatTab] = useState<'ai' | 'team'>('ai')
    const [presentationTitle, setPresentationTitle] = useState('새 프레젠테이션')
    const [editingSlide, setEditingSlide] = useState<number | null>(null)
    const [showLoadMenu, setShowLoadMenu] = useState(false)
    const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>([])
    const [editMode, setEditMode] = useState(false)
    const [presentationV2, setPresentationV2] = useState<ParsedPresentationV2 | null>(null)
    const [sources, setSources] = useState<SourceFile[]>([])
    const [researchDoc, setResearchDoc] = useState<ResearchDoc | null>(null)
    const [showResearch, setShowResearch] = useState(false)
    const [leftPanelWidth, setLeftPanelWidth] = useState(480)
    const [isResizing, setIsResizing] = useState(false)
    const [proMode, setProMode] = useState(true)

    // ===== REFS =====
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // ===== HOOKS =====
    const { saveMessage: saveToDb, updateThreadTitle, updateThreadMetadata } = useAIAppSync({
        appType: 'slides',
        autoCreateThread: true,
    })

    // ===== EFFECTS =====
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        const saved = localStorage.getItem('savedPresentations')
        if (saved) {
            setSavedPresentations(JSON.parse(saved))
        }
    }, [])

    // Resize handling
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return
            const containerRect = containerRef.current.getBoundingClientRect()
            const newWidth = e.clientX - containerRect.left
            const clampedWidth = Math.min(Math.max(newWidth, 320), 800)
            setLeftPanelWidth(clampedWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return
            }
            if (e.key === 'ArrowLeft') {
                setCurrentSlide(prev => Math.max(0, prev - 1))
            } else if (e.key === 'ArrowRight') {
                setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [slides.length])

    // ===== CALLBACKS =====
    const savePresentation = useCallback(() => {
        if (slides.length === 0) return

        const presentation: SavedPresentation = {
            id: Date.now().toString(),
            title: presentationTitle,
            slides,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const updated = [...savedPresentations, presentation]
        setSavedPresentations(updated)
        localStorage.setItem('savedPresentations', JSON.stringify(updated))

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `프레젠테이션 "${presentationTitle}"이 저장되었습니다.`
        }])
    }, [slides, presentationTitle, savedPresentations])

    const loadPresentation = useCallback((presentation: SavedPresentation) => {
        setSlides(presentation.slides)
        setPresentationTitle(presentation.title)
        setCurrentSlide(0)
        setShowLoadMenu(false)

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `프레젠테이션 "${presentation.title}"을 불러왔습니다. ${presentation.slides.length}개의 슬라이드가 있습니다.\n\n수정이 필요하시면 말씀해주세요!`
        }])
    }, [])

    const exportToPPTX = useCallback(async () => {
        if (slides.length === 0) return

        setIsLoading(true)
        try {
            const response = await fetch('/api/slides/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides, title: presentationTitle })
            })

            const data = await response.json()

            if (data.success && data.data) {
                const byteCharacters = atob(data.data)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })

                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = data.filename || `${presentationTitle}.pptx`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `PPTX 파일 "${presentationTitle}.pptx"가 다운로드되었습니다.`
                }])
            } else {
                throw new Error('Failed to generate PPTX')
            }
        } catch (error) {
            console.error('PPTX export error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'PPTX 내보내기 중 오류가 발생했습니다.'
            }])
        }
        setIsLoading(false)
    }, [slides, presentationTitle])

    const getAllSourcesText = useCallback(() => {
        return sources.map(s => `[${s.name}]\n${s.extractedText}`).join('\n\n---\n\n')
    }, [sources])

    const generateSlides = useCallback(async (prompt: string) => {
        setIsLoading(true)
        setSlides([])
        setResearchDoc(null)
        setShowResearch(true)
        setActiveTab('research')

        const countMatch = prompt.match(/(\d+)\s*장/)
        const slideCount = countMatch ? parseInt(countMatch[1]) : 15

        const sourcesText = getAllSourcesText()
        const contentWithSources = sourcesText
            ? `${prompt}\n\n=== 참고 자료 ===\n${sourcesText}`
            : prompt

        const initialTodos: TodoItem[] = [
            { id: '1', text: '입력 내용 분석', status: 'in_progress' },
            { id: '2', text: '시장 조사 및 리서치', status: 'pending' },
            { id: '3', text: '사업계획서 구조 설계', status: 'pending' },
            { id: '4', text: '슬라이드 콘텐츠 생성', status: 'pending' },
            { id: '5', text: '레이아웃 및 디자인 적용', status: 'pending' },
        ]
        setTodos(initialTodos)

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '사업계획서를 생성하고 있습니다. 실시간으로 진행 상황을 확인하세요.',
            type: 'progress'
        }])

        try {
            const response = await fetch('/api/slides/generate-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: contentWithSources,
                    slideCount,
                    businessType: prompt.includes('IT') ? 'IT 스타트업' :
                        prompt.includes('카페') ? '카페/외식업' :
                            prompt.includes('제조') ? '제조업' : '스타트업',
                    purpose: prompt.includes('투자') ? '투자 유치' :
                        prompt.includes('대출') ? '대출 심사' : '사업 소개',
                })
            })

            if (!response.body) {
                throw new Error('스트리밍을 지원하지 않습니다.')
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            const generatedSlides: SlideContent[] = []
            let currentEventType = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEventType = line.slice(7).trim()
                        continue
                    }
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))

                            switch (currentEventType) {
                                case 'progress':
                                    setTodos(prev => {
                                        const stepMap: Record<string, number> = {
                                            'analysis': 0, 'research': 1, 'outline': 2,
                                            'slides': 3, 'complete': 4
                                        }
                                        const idx = stepMap[data.step] ?? -1
                                        return prev.map((t, i) =>
                                            i < idx ? { ...t, status: 'completed' } :
                                                i === idx ? { ...t, status: 'in_progress' } : t
                                        )
                                    })
                                    setMessages(prev => {
                                        const lastIdx = prev.findIndex(m => m.type === 'progress')
                                        if (lastIdx >= 0) {
                                            const updated = [...prev]
                                            updated[lastIdx] = { ...updated[lastIdx], content: data.message }
                                            return updated
                                        }
                                        return prev
                                    })
                                    break

                                case 'analysis':
                                    setResearchDoc(prev => ({ ...prev, analysis: data }))
                                    setTodos(prev => prev.map((t, i) =>
                                        i === 0 ? { ...t, status: 'completed' } :
                                            i === 1 ? { ...t, status: 'in_progress' } : t
                                    ))
                                    break

                                case 'research':
                                    setResearchDoc(prev => ({ ...prev, research: data }))
                                    setTodos(prev => prev.map((t, i) =>
                                        i <= 1 ? { ...t, status: 'completed' } :
                                            i === 2 ? { ...t, status: 'in_progress' } : t
                                    ))
                                    break

                                case 'outline':
                                    setResearchDoc(prev => ({ ...prev, outline: data }))
                                    setPresentationTitle(data.title || '사업계획서')
                                    setTodos(prev => prev.map((t, i) =>
                                        i <= 2 ? { ...t, status: 'completed' } :
                                            i === 3 ? { ...t, status: 'in_progress' } : t
                                    ))
                                    break

                                case 'slide':
                                    const newSlide: SlideContent = {
                                        id: data.data.id,
                                        type: data.data.type as SlideContent['type'],
                                        title: data.data.title,
                                        subtitle: data.data.subtitle || '',
                                        content: data.data.content,
                                    }
                                    generatedSlides.push(newSlide)
                                    setSlides([...generatedSlides])
                                    setCurrentSlide(generatedSlides.length - 1)
                                    if (generatedSlides.length === 1) {
                                        setActiveTab('preview')
                                    }
                                    break

                                case 'complete':
                                    setTodos(prev => prev.map(t => ({ ...t, status: 'completed' })))
                                    const completeMessage = `사업계획서 ${data.totalSlides}장 생성 완료

**제목**: ${data.presentationTitle}
**슬라이드**: ${data.totalSlides}장

좌우 화살표 키로 슬라이드를 넘길 수 있습니다.
수정이 필요하면 말씀해주세요.`
                                    setMessages(prev => [...prev, {
                                        role: 'assistant',
                                        content: completeMessage,
                                        type: 'complete',
                                    }])
                                    setCurrentSlide(0)
                                    setActiveTab('preview')
                                    saveToDb({ role: 'assistant', content: completeMessage })
                                    updateThreadTitle(data.presentationTitle || '사업계획서')
                                    updateThreadMetadata({
                                        presentationTitle: data.presentationTitle,
                                        slideCount: data.totalSlides,
                                        slides: generatedSlides,
                                    })
                                    break

                                case 'error':
                                    throw new Error(data.message)
                            }
                        } catch {
                            // JSON parsing failed, ignore
                        }
                    }
                }
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            console.error('Slide generation error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `슬라이드 생성 중 오류가 발생했습니다: ${errorMessage}\n\n다시 시도해주세요.`
            }])
            setTodos([])
        }

        setIsLoading(false)
    }, [sources, getAllSourcesText, saveToDb, updateThreadTitle, updateThreadMetadata])

    const editSlide = useCallback(async (slideIndex: number, instruction: string) => {
        if (slideIndex < 0 || slideIndex >= slides.length) return

        setIsLoading(true)
        setEditingSlide(slideIndex)

        try {
            const response = await fetch('/api/slides/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slide: slides[slideIndex],
                    instruction
                })
            })

            const data = await response.json()

            if (data.success && data.slide) {
                const newSlides = [...slides]
                newSlides[slideIndex] = data.slide
                setSlides(newSlides)
                setCurrentSlide(slideIndex)

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `${slideIndex + 1}번 슬라이드가 수정되었습니다.`,
                    type: 'edit',
                    slideIndex
                }])
            }
        } catch (error) {
            console.error('Slide edit error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '슬라이드 수정 중 오류가 발생했습니다.'
            }])
        }

        setIsLoading(false)
        setEditingSlide(null)
    }, [slides])

    const parseEditCommand = useCallback((text: string): { slideIndex: number, instruction: string } | null => {
        const editKeywords = ['수정', '바꿔', '변경', '추가', '삭제', '제거', '편집', '만들어', '넣어', '빼', '교체', '업데이트']
        const hasEditIntent = editKeywords.some(keyword => text.includes(keyword))

        if (!hasEditIntent) {
            return null
        }

        const slideMatch = text.match(/(\d+)\s*(번\s*슬라이드|페이지|번째|번)/)
        if (slideMatch) {
            const slideIndex = parseInt(slideMatch[1]) - 1
            return { slideIndex, instruction: text }
        }

        if (text.includes('현재') || text.includes('이 슬라이드')) {
            return { slideIndex: currentSlide, instruction: text }
        }

        return null
    }, [currentSlide])

    const detectYouTubeUrl = (text: string): string | null => {
        const patterns = [
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
            /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        ]
        for (const pattern of patterns) {
            const match = text.match(pattern)
            if (match) return match[0]
        }
        return null
    }

    const executeYouTubeToPptWorkflow = async (url: string, instruction: string) => {
        setIsLoading(true)

        const workflowTodos: TodoItem[] = [
            { id: 'yt-1', text: 'YouTube 트랜스크립트 추출', status: 'in_progress' },
            { id: 'yt-2', text: 'AI 핵심 내용 요약', status: 'pending' },
            { id: 'yt-3', text: 'PPT 레이아웃 생성', status: 'pending' },
            { id: 'yt-4', text: '디자인 적용', status: 'pending' },
            { id: 'yt-5', text: 'PPTX 파일 생성', status: 'pending' },
        ]
        setTodos(workflowTodos)

        try {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'YouTube 영상의 트랜스크립트를 추출하고 있습니다...',
                type: 'progress'
            }])

            const transcriptRes = await fetch('/api/skills/youtube-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, lang: 'ko' })
            })
            const transcriptData = await transcriptRes.json()

            if (!transcriptData.success) {
                throw new Error(transcriptData.error || '트랜스크립트 추출 실패')
            }

            setTodos(prev => prev.map((t, i) =>
                i === 0 ? { ...t, status: 'completed' } :
                    i === 1 ? { ...t, status: 'in_progress' } : t
            ))

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `${transcriptData.transcript?.length || 0}자 분량의 내용을 요약하고 있습니다...`,
                type: 'progress'
            }])

            const summaryRes = await fetch('/api/ai/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcriptData.transcript,
                    maxLength: 2000,
                    format: 'bullet'
                })
            })
            const summaryData = await summaryRes.json()

            if (!summaryData.success) {
                throw new Error(summaryData.error || '요약 실패')
            }

            setTodos(prev => prev.map((t, i) =>
                i <= 1 ? { ...t, status: 'completed' } :
                    i === 2 ? { ...t, status: 'in_progress' } : t
            ))

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '프레젠테이션 레이아웃을 생성하고 있습니다...',
                type: 'progress'
            }])

            const pptRes = await fetch('/api/skills/ppt-pro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: summaryData.summary,
                    title: transcriptData.title || 'YouTube 영상 요약',
                    slideCount: 8,
                    theme: 'modern',
                    generateImages: false,
                    language: 'ko'
                })
            })
            const pptData = await pptRes.json()

            if (!pptData.success) {
                throw new Error(pptData.error || 'PPT 생성 실패')
            }

            setTodos(prev => prev.map((t, i) =>
                i <= 2 ? { ...t, status: 'completed' } :
                    i === 3 ? { ...t, status: 'in_progress' } : t
            ))

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '나노바나나로 프레젠테이션 디자인을 생성하고 있습니다...',
                type: 'progress'
            }])

            let coverImageUrl = null
            try {
                const imageRes = await fetch('/api/skills/nano-banana', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: `Professional presentation cover image for: ${transcriptData.title || 'YouTube Summary'}. Modern, minimalist, business style.`,
                        style: 'digital_art',
                        aspectRatio: '16:9'
                    })
                })
                const imageData = await imageRes.json()
                if (imageData.success) {
                    coverImageUrl = imageData.image_url
                }
            } catch (imgError) {
                console.log('[AI-Slides] 이미지 생성 스킵:', imgError)
            }

            setTodos(prev => prev.map((t, i) =>
                i <= 3 ? { ...t, status: 'completed' } :
                    i === 4 ? { ...t, status: 'in_progress' } : t
            ))

            const generatedSlides: SlideContent[] = pptData.presentation?.slides?.map((slide: { title: string; subtitle?: string; content?: string[] }, idx: number) => ({
                id: `slide-${idx}`,
                type: idx === 0 ? 'cover' :
                    idx === pptData.presentation.slides.length - 1 ? 'contact' : 'content',
                title: slide.title,
                subtitle: slide.subtitle || '',
                content: { points: slide.content || [] },
                images: idx === 0 && coverImageUrl ? [{
                    id: 'cover-img',
                    dataUrl: coverImageUrl,
                }] : undefined
            })) || []

            setSlides(generatedSlides)
            setPresentationTitle(transcriptData.title || 'YouTube 영상 요약')
            setCurrentSlide(0)

            setTodos(prev => prev.map(t => ({ ...t, status: 'completed' })))

            const downloadMessage = pptData.downloadUrl
                ? `\n\n[PPTX 파일 다운로드](${pptData.downloadUrl})`
                : ''

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `YouTube 영상 기반 프레젠테이션이 완성되었습니다.

**영상 제목**: ${transcriptData.title || 'YouTube 영상'}
**슬라이드 수**: ${generatedSlides.length}장
${coverImageUrl ? '**커버 디자인**: 나노바나나로 생성됨' : ''}

우측 미리보기에서 각 슬라이드를 확인하실 수 있습니다.
수정이 필요하시면 말씀해주세요!${downloadMessage}`,
                type: 'complete',
            }])

            if (pptData.pptxBase64) {
                const byteCharacters = atob(pptData.pptxBase64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
                const downloadUrl = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = downloadUrl
                a.download = `${transcriptData.title || 'presentation'}.pptx`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(downloadUrl)
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            console.error('[AI-Slides] Workflow error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `워크플로우 실행 중 오류가 발생했습니다: ${errorMessage}\n\n다시 시도해주세요.`
            }])
            setTodos([])
        }

        setIsLoading(false)
    }

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        saveToDb({ role: 'user', content: userMessage })

        const youtubeUrl = detectYouTubeUrl(userMessage)
        if (youtubeUrl) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `YouTube 영상을 감지했습니다.\n\n영상 내용을 분석하여 PPT 슬라이드를 자동으로 생성합니다...`,
                type: 'progress'
            }])
            await executeYouTubeToPptWorkflow(youtubeUrl, userMessage)
            return
        }

        if (
            (userMessage.includes('사업계획서') || userMessage.includes('슬라이드') || userMessage.includes('피치덱')) &&
            (userMessage.includes('만들어') || userMessage.includes('생성') || userMessage.includes('제작'))
        ) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `사업계획서를 제작하겠습니다.`,
                type: 'progress'
            }])
            await generateSlides(userMessage)
        } else if (slides.length > 0) {
            const editCommand = parseEditCommand(userMessage)
            if (editCommand && editCommand.slideIndex >= 0 && editCommand.slideIndex < slides.length) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `${editCommand.slideIndex + 1}번 슬라이드를 수정하겠습니다...`,
                    type: 'progress'
                }])
                await editSlide(editCommand.slideIndex, editCommand.instruction)
            } else {
                setIsLoading(true)

                const presentationContext = presentationV2
                    ? extractPresentationText(presentationV2.slides)
                    : slides.map((s, i) => `[슬라이드 ${i + 1}]\n제목: ${s.title}\n${s.subtitle || ''}\n${s.content?.points?.join('\n') || ''}`).join('\n\n')

                let currentSlideContent = ''
                if (presentationV2 && presentationV2.slides[currentSlide]) {
                    const { extractSlideText } = await import('./components/slide-editor/SlideThumbnail')
                    currentSlideContent = extractSlideText(presentationV2.slides[currentSlide])
                } else if (slides[currentSlide]) {
                    const s = slides[currentSlide]
                    currentSlideContent = `제목: ${s.title}\n${s.subtitle || ''}\n${s.content?.points?.join('\n') || ''}`
                }

                try {
                    const response = await fetch('/api/slides/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: userMessage,
                            presentationContext,
                            currentSlideContent,
                            currentSlideIndex: currentSlide,
                            totalSlides: slides.length,
                        }),
                    })

                    if (response.ok) {
                        const data = await response.json()
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: data.response || '슬라이드에 대해 무엇이든 물어보세요!'
                        }])
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `현재 프레젠테이션에는 ${slides.length}개의 슬라이드가 있습니다.\n\n어떤 슬라이드를 수정하시겠습니까? 예:\n\n• "3번 슬라이드 제목 수정해줘"\n• "현재 슬라이드에 내용 추가해줘"\n• "새 슬라이드 추가해줘"`
                        }])
                    }
                } catch {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: '어떤 슬라이드를 수정하시겠습니까? 예:\n\n• "3번 슬라이드 제목 수정해줘"\n• "현재 슬라이드에 내용 추가해줘"\n• "새 슬라이드 추가해줘"'
                    }])
                }
                setIsLoading(false)
            }
        } else {
            setIsLoading(true)
            await new Promise(r => setTimeout(r, 500))
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '아직 슬라이드가 없습니다. 먼저 슬라이드를 생성해주세요.\n\n예시:\n• "IT 스타트업 투자 유치용 사업계획서 15장으로 만들어줘"\n• "카페 창업 사업계획서를 은행 대출용으로 만들어줘"'
            }])
            setIsLoading(false)
        }
    }

    const convertV2ToSlideContent = (pres: ParsedPresentationV2): SlideContent[] => {
        return pres.slides.map((slide, idx) => {
            const textElements = slide.elements.filter(el => el.type === 'text') as TextElement[]
            const title = textElements[0]?.text || `슬라이드 ${idx + 1}`
            const subtitle = textElements[1]?.text

            const imageElements = slide.elements.filter(el => el.type === 'image')
            const images = imageElements.map((img) => ({
                id: img.id,
                dataUrl: (img as { src: string }).src,
                width: img.size.widthPx,
                height: img.size.heightPx,
                x: img.position.xPx,
                y: img.position.yPx,
            }))

            return {
                id: slide.id,
                type: idx === 0 ? 'cover' : 'content' as SlideContent['type'],
                title,
                subtitle,
                content: {
                    points: textElements.slice(2).map(t => t.text)
                },
                images: images.length > 0 ? images : undefined,
                backgroundColor: slide.background?.color,
            }
        })
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const isPdf = isPdfFile(file)
        const isPptx = isPptxFile(file)

        if (!isPdf && !isPptx) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'PPTX 또는 PDF 파일만 업로드할 수 있습니다.'
            }])
            return
        }

        setIsLoading(true)

        try {
            const { parseSlideFile } = await import('./lib/pdf-parser')
            const parsed = await parseSlideFile(file)

            if (parsed.slides.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '파일에서 내용을 찾을 수 없습니다. 파일이 손상되었거나 빈 파일일 수 있습니다.'
                }])
                return
            }

            const { extractSlideText } = await import('./components/slide-editor/SlideThumbnail')
            const allText = parsed.slides.map((slide, i) => {
                const text = extractSlideText(slide)
                return text ? `[슬라이드 ${i + 1}] ${text}` : ''
            }).filter(Boolean).join('\n\n')

            const newSource: SourceFile = {
                id: `source-${Date.now()}`,
                name: file.name,
                type: isPdf ? 'pdf' : 'pptx',
                extractedText: allText || parsed.title,
                uploadedAt: new Date(),
                slideCount: parsed.slides.length
            }

            setSources(prev => [...prev, newSource])
        } catch (error) {
            console.error('File parsing error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.'
            }])
        } finally {
            setIsLoading(false)
            if (e.target) {
                e.target.value = ''
            }
        }
    }

    const removeSource = (sourceId: string) => {
        setSources(prev => prev.filter(s => s.id !== sourceId))
    }

    const handlePresentationChange = (newPresentation: ParsedPresentationV2) => {
        setPresentationV2(newPresentation)
        const converted = convertV2ToSlideContent(newPresentation)
        setSlides(converted)
    }

    // ===== RENDER =====
    return (
        <div ref={containerRef} className="h-screen flex flex-row-reverse bg-white dark:bg-zinc-950 overflow-hidden">
            {/* Right Panel - Chat */}
            <ChatPanel
                messages={messages}
                input={input}
                isLoading={isLoading}
                todos={todos}
                chatTab={chatTab}
                proMode={proMode}
                showLoadMenu={showLoadMenu}
                savedPresentations={savedPresentations}
                sources={sources}
                slides={slides}
                presentationV2={presentationV2}
                leftPanelWidth={leftPanelWidth}
                messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
                fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                setInput={setInput}
                setChatTab={setChatTab}
                setProMode={setProMode}
                setShowLoadMenu={setShowLoadMenu}
                setCurrentSlide={setCurrentSlide}
                sendMessage={sendMessage}
                loadPresentation={loadPresentation}
                handleFileUpload={handleFileUpload}
                removeSource={removeSource}
                generateSlides={generateSlides}
                getAllSourcesText={getAllSourcesText}
            />

            {/* Resize Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={cn(
                    "w-2 hover:w-3 bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-accent/20 cursor-col-resize transition-all flex-shrink-0 group relative flex items-center justify-center",
                    isResizing && "w-3 bg-accent/30"
                )}
            >
                <div className="absolute inset-y-0 -left-2 -right-2" />
                <GripVertical className={cn(
                    "w-4 h-4 text-zinc-400 dark:text-zinc-600 group-hover:text-accent transition-colors",
                    isResizing && "text-accent"
                )} />
            </div>

            {/* Left Panel - Preview */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                <PreviewHeader
                    presentationTitle={presentationTitle}
                    setPresentationTitle={setPresentationTitle}
                    slides={slides}
                    editMode={editMode}
                    setEditMode={setEditMode}
                    isLoading={isLoading}
                    savePresentation={savePresentation}
                    exportToPPTX={exportToPPTX}
                />

                <PreviewTabs
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    slides={slides}
                    currentSlide={currentSlide}
                />

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    {activeTab === 'research' && (
                        <ResearchPanel researchDoc={researchDoc} />
                    )}

                    {activeTab === 'preview' && (
                        editMode && presentationV2 ? (
                            <SlideEditor
                                presentation={presentationV2}
                                onPresentationChange={handlePresentationChange}
                                onExport={exportToPPTX}
                                onAIChat={() => {
                                    const chatInput = document.querySelector('input[placeholder*="슬라이드"]') as HTMLInputElement
                                    chatInput?.focus()
                                }}
                            />
                        ) : (
                            <SlidePreviewPanel
                                slides={slides}
                                currentSlide={currentSlide}
                                editingSlide={editingSlide}
                                setCurrentSlide={setCurrentSlide}
                                setShowLoadMenu={setShowLoadMenu}
                                fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
                            />
                        )
                    )}
                </div>
            </div>
        </div>
    )
}
