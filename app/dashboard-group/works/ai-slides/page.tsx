"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Send,
    Bot,
    User,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    Code,
    Brain,
    Check,
    Circle,
    MoreHorizontal,
    Mic,
    Paperclip,
    Share2,
    FileText,
    Upload,
    FolderOpen,
    Edit3,
    Trash2,
    Plus,
    RefreshCw,
    Copy,
    Play,
    GripVertical
} from "lucide-react"
import { cn } from "@/lib/utils"
import { parsePptxFile, convertToSlideContent } from "./lib/pptx-parser"

// Helper functions for file type detection (inline to avoid SSR issues with pdfjs-dist)
const isPdfFile = (file: File): boolean => {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

const isPptxFile = (file: File): boolean => {
  return file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
         file.name.toLowerCase().endsWith('.pptx') ||
         file.name.toLowerCase().endsWith('.ppt')
}
import { SlideEditor, extractPresentationText } from "./components/slide-editor"
import { ParsedPresentationV2, ParsedSlideV2, AnySlideElement, TextElement, CANVAS_WIDTH, CANVAS_HEIGHT, createPosition, createSize } from "./types/slide-elements"
import { Edit2, Eye as EyeIcon } from "lucide-react"

// Slide Types
interface SlideImage {
    id: string
    dataUrl: string
    width?: number
    height?: number
    x?: number
    y?: number
}

interface SlideContent {
    id: string
    type: 'cover' | 'content' | 'problem' | 'solution' | 'market' | 'business-model' | 'product' | 'competition' | 'gtm' | 'marketing' | 'team' | 'roadmap' | 'revenue' | 'financials' | 'investment' | 'contact'
    title: string
    subtitle?: string
    content: any
    images?: SlideImage[]
    backgroundColor?: string
}

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
    type?: 'question' | 'progress' | 'complete' | 'edit'
    slideIndex?: number
}

interface TodoItem {
    id: string
    text: string
    status: 'pending' | 'in_progress' | 'completed'
}

interface SavedPresentation {
    id: string
    title: string
    slides: SlideContent[]
    createdAt: Date
    updatedAt: Date
}

// Slide Preview Components
const CoverSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-white p-12">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
        >
            <div className="w-20 h-20 bg-accent rounded-2xl mx-auto mb-8 flex items-center justify-center">
                <FileText className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold mb-4">{title}</h1>
            <p className="text-2xl text-zinc-400 mb-8">{subtitle}</p>
            <p className="text-lg text-accent mb-12">{content?.tagline}</p>
            <div className="text-sm text-zinc-500">
                <p>{content?.presenter}</p>
                <p>{content?.date}</p>
            </div>
        </motion.div>
    </div>
)

const ProblemSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— PROBLEM DEFINITION</p>
            <h2 className="text-3xl font-bold mb-2">{title}</h2>
            <p className="text-zinc-400 mb-8">{subtitle}</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
                {content?.issues?.map((issue: any, i: number) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                            "p-6 rounded-xl",
                            i === 0 ? "bg-red-500/20 border border-red-500/30" :
                            i === 1 ? "bg-orange-500/20 border border-orange-500/30" :
                            "bg-purple-500/20 border border-purple-500/30"
                        )}
                    >
                        <div className="text-xs text-zinc-400 mb-2">ISSUE #{i + 1}</div>
                        <div className="text-3xl mb-3">{issue.icon}</div>
                        <h3 className="text-lg font-bold mb-2">{issue.title}</h3>
                        <p className="text-sm text-zinc-400">{issue.desc}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800 rounded-xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                        <span className="text-accent text-xl">🎯</span>
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 mb-1">TARGET CUSTOMER (ICP)</p>
                        <p className="text-sm">{content?.targetCustomer}</p>
                    </div>
                </div>
                <div className="bg-zinc-800 rounded-xl p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                        <span className="text-green-400 text-xl">📈</span>
                    </div>
                    <div>
                        <p className="text-xs text-zinc-500 mb-1">MARKET OPPORTUNITY</p>
                        <p className="text-sm">{content?.opportunity}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

const SolutionSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— SOLUTION OVERVIEW</p>
            <h2 className="text-3xl font-bold mb-2">
                {subtitle?.split(' ').map((word, i) => (
                    <span key={i} className={word.includes('AI') || word.includes('자동화') ? 'text-accent' : ''}>
                        {word}{' '}
                    </span>
                ))}
            </h2>
            <p className="text-zinc-400 mb-12">{content?.mainDesc}</p>

            <div className="grid grid-cols-3 gap-6">
                {content?.features?.map((feature: any, i: number) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-zinc-800 rounded-xl p-6 text-center"
                    >
                        <div className="w-16 h-16 bg-accent/20 rounded-xl mx-auto mb-4 flex items-center justify-center">
                            <span className="text-3xl">{feature.icon}</span>
                        </div>
                        <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                        <p className="text-sm text-zinc-400">{feature.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    </div>
)

const MarketSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— MARKET OPPORTUNITY</p>
            <h2 className="text-3xl font-bold mb-8">{title} <span className="text-zinc-500 font-normal">{subtitle}</span></h2>

            <div className="flex items-end justify-center gap-8 mb-8">
                {[
                    { ...content?.tam, color: 'bg-blue-500', height: 'h-64' },
                    { ...content?.sam, color: 'bg-green-500', height: 'h-48' },
                    { ...content?.som, color: 'bg-accent', height: 'h-32' }
                ].map((market, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scaleY: 0 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        transition={{ delay: i * 0.2 }}
                        className="text-center origin-bottom"
                    >
                        <div className={cn("w-32 rounded-t-xl", market.height, market.color, "flex items-center justify-center")}>
                            <span className="text-2xl font-bold">{market.value}</span>
                        </div>
                        <div className="bg-zinc-800 p-4 rounded-b-xl">
                            <p className="text-xs text-zinc-500">{market.label}</p>
                            <p className="text-xs text-zinc-400 mt-1">{market.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="text-center">
                <span className="inline-block bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm">
                    {content?.cagr}
                </span>
            </div>
        </div>
    </div>
)

const BusinessModelSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— BUSINESS MODEL</p>
            <h2 className="text-3xl font-bold mb-2">{title}</h2>
            <p className="text-zinc-400 mb-8">{content?.model}</p>

            <div className="grid grid-cols-3 gap-4 mb-8">
                {content?.pricing?.map((tier: any, i: number) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn(
                            "p-6 rounded-xl border",
                            i === 1 ? "bg-accent/10 border-accent" : "bg-zinc-800 border-zinc-700"
                        )}
                    >
                        <h3 className="text-lg font-bold mb-2">{tier.tier}</h3>
                        <p className="text-2xl font-bold text-accent mb-4">{tier.price}</p>
                        <ul className="space-y-2">
                            {tier.features?.map((f: string, j: number) => (
                                <li key={j} className="text-sm text-zinc-400 flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-400" /> {f}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
                {Object.entries(content?.metrics || {}).map(([key, value], i) => (
                    <div key={i} className="bg-zinc-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-zinc-500 uppercase mb-1">{key}</p>
                        <p className="text-xl font-bold">{value as string}</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
)

const TeamSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— TEAM</p>
            <h2 className="text-3xl font-bold mb-8">{title}</h2>

            <div className="grid grid-cols-3 gap-6">
                {content?.founders?.map((founder: any, i: number) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-center"
                    >
                        <div className="w-24 h-24 bg-accent rounded-full mx-auto mb-4 flex items-center justify-center">
                            <User className="w-12 h-12 text-white" />
                        </div>
                        <h3 className="text-lg font-bold">{founder.name}</h3>
                        <p className="text-accent text-sm mb-2">{founder.role}</p>
                        <p className="text-zinc-400 text-sm">{founder.background}</p>
                    </motion.div>
                ))}
            </div>

            {content?.hiringPlan && (
                <div className="mt-8 bg-zinc-800 rounded-xl p-6">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">채용 계획</h4>
                    <p className="text-sm">{content.hiringPlan}</p>
                </div>
            )}
        </div>
    </div>
)

const InvestmentSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— INVESTMENT ASK</p>
            <h2 className="text-3xl font-bold mb-8">{title}</h2>

            <div className="grid grid-cols-3 gap-6 mb-8">
                {[
                    { label: '라운드', value: content?.round },
                    { label: '투자금액', value: content?.amount },
                    { label: '밸류에이션', value: content?.valuation }
                ].filter(d => d.value).map((item, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-zinc-800 rounded-xl p-6 text-center"
                    >
                        <p className="text-xs text-zinc-500 mb-2">{item.label}</p>
                        <p className="text-2xl font-bold text-accent">{item.value}</p>
                    </motion.div>
                ))}
            </div>

            {content?.progress && (
                <div className="bg-zinc-800 rounded-xl p-6">
                    <h4 className="text-sm font-medium text-zinc-400 mb-2">진행 현황</h4>
                    <p className="text-sm">{content.progress}</p>
                </div>
            )}
        </div>
    </div>
)

const ContactSlide = ({ content, title, subtitle }: { content: any, title: string, subtitle?: string }) => (
    <div className="h-full bg-zinc-900 text-white flex flex-col items-center justify-center p-8">
        <h2 className="text-5xl font-bold mb-8">Thank You</h2>
        <div className="text-center space-y-2 text-zinc-400">
            {content?.name && <p className="text-lg">{content.name} | {content.title}</p>}
            {content?.email && <p>📧 {content.email}</p>}
            {content?.phone && <p>📞 {content.phone}</p>}
            {content?.website && <p>🌐 {content.website}</p>}
        </div>
    </div>
)

const DefaultSlide = ({ content, title, subtitle, type }: { content: any, title: string, subtitle?: string, type: string }) => (
    <div className="h-full bg-zinc-900 text-white p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
            <p className="text-accent text-sm font-medium mb-2">— {type.toUpperCase().replace('-', ' ')}</p>
            <h2 className="text-3xl font-bold mb-2">{title}</h2>
            {subtitle && <p className="text-zinc-400 mb-8">{subtitle}</p>}

            {content && Object.keys(content).length > 0 && (
                <div className="bg-zinc-800 rounded-xl p-6">
                    <pre className="text-sm text-zinc-400 whitespace-pre-wrap">
                        {JSON.stringify(content, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    </div>
)

// Imported Slide with Images
const ImportedSlide = ({
    content,
    title,
    subtitle,
    images,
    backgroundColor
}: {
    content: any,
    title: string,
    subtitle?: string,
    images?: SlideImage[],
    backgroundColor?: string
}) => (
    <div
        className="h-full text-white p-8 overflow-auto"
        style={{ backgroundColor: backgroundColor || '#18181b' }}
    >
        <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-2">{title}</h2>
            {subtitle && <p className="text-zinc-400 mb-6">{subtitle}</p>}

            {/* Images Grid */}
            {images && images.length > 0 && (
                <div className={cn(
                    "mb-6",
                    images.length === 1 ? "flex justify-center" : "grid gap-4",
                    images.length === 2 && "grid-cols-2",
                    images.length >= 3 && "grid-cols-2 md:grid-cols-3"
                )}>
                    {images.map((img) => (
                        <div
                            key={img.id}
                            className="relative rounded-lg overflow-hidden bg-zinc-800"
                        >
                            <img
                                src={img.dataUrl}
                                alt=""
                                className="w-full h-auto max-h-[400px] object-contain"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Text Content */}
            {content?.points && content.points.length > 0 && (
                <div className="space-y-2">
                    {content.points.map((point: string, i: number) => (
                        <p key={i} className="text-zinc-300 text-lg">
                            {point}
                        </p>
                    ))}
                </div>
            )}
        </div>
    </div>
)

// Main Slide Renderer
const SlideRenderer = ({ slide }: { slide: SlideContent }) => {
    // If slide has images, use ImportedSlide renderer
    if (slide.images && slide.images.length > 0) {
        return <ImportedSlide {...slide} />
    }

    switch (slide.type) {
        case 'cover':
            return <CoverSlide {...slide} />
        case 'problem':
            return <ProblemSlide {...slide} />
        case 'solution':
            return <SolutionSlide {...slide} />
        case 'market':
            return <MarketSlide {...slide} />
        case 'business-model':
            return <BusinessModelSlide {...slide} />
        case 'team':
            return <TeamSlide {...slide} />
        case 'investment':
            return <InvestmentSlide {...slide} />
        case 'contact':
            return <ContactSlide {...slide} />
        default:
            return <DefaultSlide {...slide} type={slide.type} />
    }
}

export default function AISlidesPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: '안녕하세요! 사업계획서 슬라이드를 제작해드리겠습니다.\n\n먼저 몇 가지 정보가 필요합니다:\n\n1. **사업 분야** 또는 업종은 무엇인가요?\n2. **사업계획서의 목적**은 무엇인가요? (투자 유치, 은행 대출 등)\n3. **주요 포함 내용**이 있나요?\n4. **대략적인 슬라이드 분량**은? (10-15장, 20장 이상 등)\n\n예시:\n• "IT 스타트업 투자 유치용 사업계획서 15장으로 만들어줘"\n• "카페 창업 사업계획서를 은행 대출용으로 만들어줘"',
            type: 'question'
        }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [slides, setSlides] = useState<SlideContent[]>([])
    const [currentSlide, setCurrentSlide] = useState(0)
    const [todos, setTodos] = useState<TodoItem[]>([])
    const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'thinking'>('preview')
    const [chatTab, setChatTab] = useState<'ai' | 'team'>('ai')
    const [presentationTitle, setPresentationTitle] = useState('새 프레젠테이션')
    const [editingSlide, setEditingSlide] = useState<number | null>(null)
    const [showLoadMenu, setShowLoadMenu] = useState(false)
    const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>([])
    const [editMode, setEditMode] = useState(false)
    const [presentationV2, setPresentationV2] = useState<ParsedPresentationV2 | null>(null)

    // Resizable panel state
    const [leftPanelWidth, setLeftPanelWidth] = useState(480)
    const [isResizing, setIsResizing] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Load saved presentations from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('savedPresentations')
        if (saved) {
            setSavedPresentations(JSON.parse(saved))
        }
    }, [])

    // Handle panel resize
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsResizing(true)
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return

            const containerRect = containerRef.current.getBoundingClientRect()
            const newWidth = e.clientX - containerRect.left

            // Limit width between 320px and 800px
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

    // Save presentation
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

    // Load presentation
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

    // Export to PPTX
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
                // Convert base64 to blob and download
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

    // Generate slides with AI
    const generateSlides = useCallback(async (prompt: string) => {
        setIsLoading(true)

        // Extract slide count from prompt
        const countMatch = prompt.match(/(\d+)\s*장/)
        const slideCount = countMatch ? parseInt(countMatch[1]) : 15

        // Create initial todos
        const initialTodos: TodoItem[] = [
            { id: '1', text: '슬라이드 시스템 초기화', status: 'in_progress' },
            { id: '2', text: '관련 정보 조사 (트렌드, 투자자 관심사)', status: 'pending' },
            { id: '3', text: `${slideCount}장 슬라이드 구성 아웃라인 생성`, status: 'pending' },
        ]

        // Add todo for each slide
        for (let i = 1; i <= Math.min(slideCount, 15); i++) {
            initialTodos.push({
                id: String(i + 3),
                text: `페이지 ${i}: 슬라이드 제작`,
                status: 'pending'
            })
        }

        setTodos(initialTodos)

        // Simulate initial progress
        await new Promise(r => setTimeout(r, 500))
        setTodos(prev => prev.map((t, i) => i === 0 ? { ...t, status: 'completed' } : i === 1 ? { ...t, status: 'in_progress' } : t))

        try {
            // Call AI API
            const response = await fetch('/api/slides/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    slideCount,
                    businessType: prompt.includes('IT') ? 'IT 스타트업' : '스타트업',
                    purpose: prompt.includes('투자') ? '투자 유치' : prompt.includes('대출') ? '은행 대출' : '사업계획'
                })
            })

            const data = await response.json()

            if (data.success && data.slides) {
                // Update todos progressively
                for (let i = 2; i < initialTodos.length; i++) {
                    await new Promise(r => setTimeout(r, 300))
                    setTodos(prev => prev.map((t, idx) =>
                        idx < i ? { ...t, status: 'completed' } :
                        idx === i ? { ...t, status: 'in_progress' } : t
                    ))

                    // Add slides progressively
                    if (i >= 3) {
                        setSlides(data.slides.slice(0, i - 2))
                    }
                }

                // Final update
                setSlides(data.slides)
                setTodos(prev => prev.map(t => ({ ...t, status: 'completed' })))

                // Update title
                const titleMatch = prompt.match(/(IT\s*스타트업|카페|제조업|[가-힣]+)\s*(투자|대출|사업)/)
                if (titleMatch) {
                    setPresentationTitle(`${titleMatch[1]} ${titleMatch[2]} 사업계획서`)
                } else {
                    setPresentationTitle('사업계획서')
                }

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `사업계획서 ${data.slides.length}장을 제작했습니다.\n\n우측 미리보기에서 각 슬라이드를 확인하실 수 있습니다.\n\n수정이 필요하시면:\n• "3번 슬라이드 제목을 '핵심 문제'로 바꿔줘"\n• "팀 소개 슬라이드에 CTO 추가해줘"\n• "시장 규모를 200조원으로 수정해줘"`,
                    type: 'complete',
                }])
            } else {
                throw new Error('Failed to generate slides')
            }
        } catch (error) {
            console.error('Slide generation error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '슬라이드 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
            }])
            setTodos([])
        }

        setIsLoading(false)
    }, [])

    // Edit slide with AI
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

    // Parse edit commands - only match if it contains action keywords
    const parseEditCommand = useCallback((text: string): { slideIndex: number, instruction: string } | null => {
        // Action keywords that indicate an edit request (not just a question)
        const editKeywords = ['수정', '바꿔', '변경', '추가', '삭제', '제거', '편집', '만들어', '넣어', '빼', '교체', '업데이트']
        const hasEditIntent = editKeywords.some(keyword => text.includes(keyword))

        // If no edit intent, don't treat as edit command
        if (!hasEditIntent) {
            return null
        }

        // Match patterns like "3번 슬라이드", "슬라이드 3", "3페이지"
        const slideMatch = text.match(/(\d+)\s*(번\s*슬라이드|페이지|번째|번)/)
        if (slideMatch) {
            const slideIndex = parseInt(slideMatch[1]) - 1
            return { slideIndex, instruction: text }
        }

        // Match "현재 슬라이드", "이 슬라이드" only if edit intent is present
        if (text.includes('현재') || text.includes('이 슬라이드')) {
            return { slideIndex: currentSlide, instruction: text }
        }

        return null
    }, [currentSlide])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])

        // Check if it's a slide generation request
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
        }
        // Check if it's an edit request
        else if (slides.length > 0) {
            const editCommand = parseEditCommand(userMessage)
            if (editCommand && editCommand.slideIndex >= 0 && editCommand.slideIndex < slides.length) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `${editCommand.slideIndex + 1}번 슬라이드를 수정하겠습니다...`,
                    type: 'progress'
                }])
                await editSlide(editCommand.slideIndex, editCommand.instruction)
            } else {
                // General chat about slides with context
                setIsLoading(true)

                // Get presentation context for AI
                const presentationContext = presentationV2
                    ? extractPresentationText(presentationV2.slides)
                    : slides.map((s, i) => `[슬라이드 ${i + 1}]\n제목: ${s.title}\n${s.subtitle || ''}\n${s.content?.points?.join('\n') || ''}`).join('\n\n')

                // Get current slide content specifically
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
                        // Fallback response
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
            // No slides yet, guide user
            setIsLoading(true)
            await new Promise(r => setTimeout(r, 500))
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '아직 슬라이드가 없습니다. 먼저 슬라이드를 생성해주세요.\n\n예시:\n• "IT 스타트업 투자 유치용 사업계획서 15장으로 만들어줘"\n• "카페 창업 사업계획서를 은행 대출용으로 만들어줘"'
            }])
            setIsLoading(false)
        }
    }

    // Convert ParsedPresentationV2 to SlideContent[] for preview mode
    const convertV2ToSlideContent = (pres: ParsedPresentationV2): SlideContent[] => {
        return pres.slides.map((slide, idx) => {
            const textElements = slide.elements.filter(el => el.type === 'text') as TextElement[]
            const title = textElements[0]?.text || `슬라이드 ${idx + 1}`
            const subtitle = textElements[1]?.text

            const imageElements = slide.elements.filter(el => el.type === 'image')
            const images = imageElements.map((img, i) => ({
                id: img.id,
                dataUrl: (img as any).src,
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

    // Handle file upload (supports PPTX and PDF)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Check file type
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
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: `"${file.name}" 파일을 분석 중입니다... ${isPdf ? '(PDF 모드)' : '(PPTX 모드)'}`
        }])

        try {
            // Dynamically import parseSlideFile to avoid SSR issues with pdfjs-dist
            const { parseSlideFile } = await import('./lib/pdf-parser')
            const parsed = await parseSlideFile(file)

            if (parsed.slides.length === 0) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '파일에서 슬라이드를 찾을 수 없습니다. 파일이 손상되었거나 빈 파일일 수 있습니다.'
                }])
                return
            }

            // Store the V2 presentation for edit mode
            setPresentationV2(parsed)

            // Convert to SlideContent for preview mode
            const converted = convertV2ToSlideContent(parsed)
            setSlides(converted)
            setPresentationTitle(parsed.title)
            setCurrentSlide(0)

            // Auto-enable edit mode for better editing experience
            setEditMode(true)

            // Show extracted text for each slide
            const { extractSlideText } = await import('./components/slide-editor/SlideThumbnail')
            const extractedTexts = parsed.slides.map((slide, i) => {
                const text = extractSlideText(slide)
                return `**슬라이드 ${i + 1}**: ${text ? text.substring(0, 100) + (text.length > 100 ? '...' : '') : '(텍스트 없음)'}`
            }).join('\n')

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `"${parsed.title}" 프레젠테이션을 불러왔습니다!\n\n총 ${parsed.slides.length}개의 슬라이드가 있습니다.\n\n📄 **추출된 텍스트:**\n${extractedTexts}\n\n📝 슬라이드를 직접 클릭하여 수정하거나, AI에게 질문할 수 있습니다.`
            }])
        } catch (error) {
            console.error('File parsing error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '파일을 읽는 중 오류가 발생했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.'
            }])
        } finally {
            setIsLoading(false)
            // Reset file input
            if (e.target) {
                e.target.value = ''
            }
        }
    }

    // Handle presentation change from SlideEditor
    const handlePresentationChange = (newPresentation: ParsedPresentationV2) => {
        setPresentationV2(newPresentation)
        // Also update the preview mode slides
        const converted = convertV2ToSlideContent(newPresentation)
        setSlides(converted)
    }

    return (
        <div ref={containerRef} className="h-screen flex bg-white dark:bg-zinc-950 overflow-hidden">
            {/* Left Panel - Chat */}
            <div
                className="flex flex-col border-r border-zinc-200 dark:border-zinc-800 h-full overflow-hidden bg-white dark:bg-zinc-950"
                style={{ width: leftPanelWidth, minWidth: 320, maxWidth: 800 }}
            >
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">슬라이드 AI</h2>
                </div>

                {/* Chat Tabs */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setChatTab('ai')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            chatTab === 'ai' ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        )}
                    >
                        AI 채팅
                    </button>
                    <button
                        onClick={() => setChatTab('team')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            chatTab === 'team' ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        )}
                    >
                        팀 채팅
                    </button>
                </div>

                {/* Chat Content - Single Scroll Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Todo Progress */}
                    {todos.length > 0 && (
                        <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-4 mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-zinc-500">
                                    총: {todos.length}개의 할 일
                                </span>
                                <span className="text-xs text-zinc-500">
                                    남은 할 일 {todos.filter(t => t.status !== 'completed').length}개
                                </span>
                            </div>
                            <div className="space-y-2">
                                {todos.map(todo => (
                                    <div
                                        key={todo.id}
                                        className={cn(
                                            "flex items-center gap-2 text-sm",
                                            todo.status === 'completed' ? 'text-zinc-600 line-through' :
                                            todo.status === 'in_progress' ? 'text-white' : 'text-zinc-500'
                                        )}
                                    >
                                        {todo.status === 'completed' ? (
                                            <Check className="w-4 h-4 text-green-500" />
                                        ) : todo.status === 'in_progress' ? (
                                            <Loader2 className="w-4 h-4 text-accent animate-spin" />
                                        ) : (
                                            <Circle className="w-4 h-4" />
                                        )}
                                        {todo.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {messages.map((msg, i) => (
                        <div key={i} className={cn("flex gap-3", msg.role === 'user' && "flex-row-reverse")}>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                msg.role === 'user' ? "bg-accent" : "bg-zinc-200 dark:bg-zinc-800"
                            )}>
                                {msg.role === 'user' ? (
                                    <User className="w-4 h-4 text-white" />
                                ) : (
                                    <Bot className="w-4 h-4 text-zinc-600 dark:text-white" />
                                )}
                            </div>
                            <div className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                                msg.role === 'user'
                                    ? "bg-accent text-white"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
                            )}>
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                {msg.slideIndex !== undefined && (
                                    <button
                                        onClick={() => setCurrentSlide(msg.slideIndex!)}
                                        className="mt-2 text-xs text-accent hover:underline"
                                    >
                                        슬라이드 보기 →
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-zinc-600 dark:text-white" />
                            </div>
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
                                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                        <div className="px-4 py-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="슬라이드 요청을 여기에 입력하세요"
                                className="w-full bg-transparent text-zinc-900 dark:text-white placeholder-zinc-500 text-sm no-focus-ring"
                            />
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-700">
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setShowLoadMenu(!showLoadMenu)}
                                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors relative"
                                    title="불러오기"
                                >
                                    <FolderOpen className="w-5 h-5 text-zinc-500" />
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pptx,.ppt,.pdf"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                    title="파일 업로드"
                                >
                                    <Upload className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>
                            <div className="flex items-center gap-1">
                                <button className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Mic className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button
                                    onClick={sendMessage}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 bg-accent hover:bg-accent/90 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 rounded-lg transition-colors"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Load Menu */}
                    <AnimatePresence>
                        {showLoadMenu && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                style={{ width: leftPanelWidth - 32 }}
                                className="absolute bottom-24 left-4 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 max-h-64 overflow-y-auto z-50"
                            >
                                <div className="p-2">
                                    <p className="text-xs text-zinc-500 px-2 py-1">저장된 프레젠테이션</p>
                                    {savedPresentations.length === 0 ? (
                                        <p className="text-sm text-zinc-400 px-2 py-4 text-center">저장된 프레젠테이션이 없습니다</p>
                                    ) : (
                                        savedPresentations.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => loadPresentation(p)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors text-left"
                                            >
                                                <FileText className="w-5 h-5 text-accent" />
                                                <div>
                                                    <p className="text-sm text-zinc-900 dark:text-white">{p.title}</p>
                                                    <p className="text-xs text-zinc-500">{p.slides.length}개 슬라이드</p>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

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

            {/* Right Panel - Preview */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-zinc-500" />
                        <input
                            type="text"
                            value={presentationTitle}
                            onChange={(e) => setPresentationTitle(e.target.value)}
                            className="text-zinc-900 dark:text-white font-medium bg-transparent border-none outline-none"
                        />
                        {slides.length > 0 && (
                            <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                                저장 자동-{slides.length}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {slides.length > 0 && (
                            <>
                                {/* Edit Mode Toggle */}
                                <button
                                    onClick={() => setEditMode(!editMode)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors",
                                        editMode
                                            ? "bg-accent text-white"
                                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    )}
                                    title={editMode ? "미리보기 모드" : "편집 모드"}
                                >
                                    {editMode ? <EyeIcon className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                    {editMode ? "미리보기" : "편집"}
                                </button>
                                <button
                                    onClick={savePresentation}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                                >
                                    <Copy className="w-4 h-4" />
                                    저장
                                </button>
                                <button
                                    onClick={() => {/* TODO: Present mode */}}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                                >
                                    <Play className="w-4 h-4" />
                                    발표
                                </button>
                            </>
                        )}
                        <button
                            onClick={exportToPPTX}
                            disabled={slides.length === 0 || isLoading}
                            className="flex items-center gap-2 px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            PPTX 내보내기
                        </button>
                    </div>
                </div>

                {/* Preview Tabs */}
                <div className="flex items-center gap-4 px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                    {[
                        { id: 'preview', label: '미리보기', icon: Eye },
                        { id: 'code', label: '코드', icon: Code },
                        { id: 'thinking', label: '생각 중', icon: Brain }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors",
                                activeTab === tab.id
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                    {slides.length > 0 && (
                        <span className="ml-auto text-sm text-zinc-500">
                            {currentSlide + 1} / {slides.length}
                        </span>
                    )}
                </div>

                {/* Slide Preview or Edit Mode */}
                <div className="flex-1 overflow-hidden">
                    {/* Edit Mode - SlideEditor */}
                    {editMode && presentationV2 ? (
                        <SlideEditor
                            presentation={presentationV2}
                            onPresentationChange={handlePresentationChange}
                            onExport={exportToPPTX}
                            onAIChat={() => {
                                // Focus on chat input
                                const chatInput = document.querySelector('input[placeholder*="슬라이드"]') as HTMLInputElement
                                chatInput?.focus()
                            }}
                        />
                    ) : slides.length > 0 ? (
                        <div className="p-6 h-full overflow-y-auto">
                        <div className="h-full flex flex-col min-h-0">
                            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl relative">
                                {editingSlide === currentSlide && (
                                    <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-accent" />
                                    </div>
                                )}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentSlide}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="h-full"
                                    >
                                        <SlideRenderer slide={slides[currentSlide]} />
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Navigation */}
                            <div className="flex items-center justify-center gap-4 mt-4">
                                <button
                                    onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                                    disabled={currentSlide === 0}
                                    className="p-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-lg transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-white" />
                                </button>
                                <div className="flex items-center gap-2 overflow-x-auto max-w-md">
                                    {slides.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentSlide(i)}
                                            className={cn(
                                                "w-2 h-2 rounded-full transition-colors flex-shrink-0",
                                                i === currentSlide ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600"
                                            )}
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                                    disabled={currentSlide === slides.length - 1}
                                    className="p-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-lg transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-white" />
                                </button>
                            </div>

                            {/* Slide Thumbnails */}
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                                {slides.map((slide, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentSlide(i)}
                                        className={cn(
                                            "flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-colors",
                                            i === currentSlide ? "border-accent" : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                                        )}
                                    >
                                        <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-600 dark:text-zinc-400">
                                            {i + 1}. {slide.title.slice(0, 10)}...
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center p-6">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                                    <FileText className="w-10 h-10 text-zinc-400 dark:text-zinc-600" />
                                </div>
                                <h3 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">슬라이드 미리보기</h3>
                                <p className="text-zinc-500 text-sm mb-6">
                                    왼쪽 채팅창에서 슬라이드 생성을 요청하세요
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setShowLoadMenu(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg transition-colors"
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                        불러오기
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg transition-colors"
                                    >
                                        <Upload className="w-4 h-4" />
                                        파일 업로드
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
