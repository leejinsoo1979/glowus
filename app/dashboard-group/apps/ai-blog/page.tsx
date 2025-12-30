"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Send,
    Bot,
    Loader2,
    Settings,
    Save,
    Eye,
    Edit3,
    Upload,
    FileText,
    Image as ImageIcon,
    Tag,
    Globe,
    Check,
    AlertCircle,
    RefreshCw,
    Copy,
    ExternalLink,
    Key,
    User,
    Lock,
    Trash2,
    Plus,
    BookOpen,
    Sparkles,
    ChevronDown,
    Search,
    TrendingUp,
    Users,
    MessageCircle,
    Heart,
    Download,
    Play,
    Pause,
    BarChart3,
    Target,
    Zap,
    Clock,
    CheckCircle,
    XCircle,
    ArrowRight,
    Filter,
    SortAsc
} from "lucide-react"
import { cn } from "@/lib/utils"

// 블로그 플랫폼 타입
type BlogPlatform = 'tistory' | 'naver'
type ActiveTab = 'write' | 'keywords' | 'neighbors' | 'comments' | 'settings'

// 블로그 설정 타입
interface BlogSettings {
    tistory?: {
        apiKey: string
        blogName: string
        accessToken?: string
        connected: boolean
    }
    naver?: {
        username: string
        password: string
        blogId: string
        connected: boolean
        sessionCookie?: string
        apiClientId?: string
        apiClientSecret?: string
    }
}

// 블로그 포스트 타입
interface BlogPost {
    id?: string
    title: string
    content: string
    tags: string[]
    category?: string
    thumbnail?: string
    platform: BlogPlatform
    status: 'draft' | 'published' | 'scheduled'
    createdAt: Date
    publishedAt?: Date
}

// 키워드 타입
interface KeywordData {
    keyword: string
    pcSearch: number
    mobileSearch: number
    totalSearch: number
    docCount: number
    competition: number // 경쟁률 (낮을수록 좋음)
    isGolden: boolean // 황금 키워드 여부
}

// 이웃 타입
interface NeighborBlog {
    blogId: string
    blogName: string
    lastPost: string
    addedAt?: Date
    status: 'pending' | 'added' | 'failed'
}

// 댓글 타입
interface CommentTask {
    blogId: string
    blogName: string
    postTitle: string
    postUrl: string
    comment: string
    status: 'pending' | 'completed' | 'failed'
    completedAt?: Date
}

// 생성 단계
type GenerationStep = 'idle' | 'generating' | 'preview' | 'saving' | 'saved'

export default function AIBlogPage() {
    // 탭 상태
    const [activeTab, setActiveTab] = useState<ActiveTab>('write')
    const [platform, setPlatform] = useState<BlogPlatform>('naver')
    const [settings, setSettings] = useState<BlogSettings>({})
    const [settingsLoading, setSettingsLoading] = useState(true)

    // === 글 작성 관련 ===
    const [keyword, setKeyword] = useState('')
    const [generationStep, setGenerationStep] = useState<GenerationStep>('idle')
    const [generatedPost, setGeneratedPost] = useState<BlogPost | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [editTitle, setEditTitle] = useState('')
    const [editContent, setEditContent] = useState('')
    const [editTags, setEditTags] = useState<string[]>([])
    const [newTag, setNewTag] = useState('')
    const [bulkKeywords, setBulkKeywords] = useState<string[]>([])
    const [bulkProgress, setBulkProgress] = useState(0)
    const [isBulkMode, setIsBulkMode] = useState(false)

    // === 키워드 채굴 관련 ===
    const [seedKeyword, setSeedKeyword] = useState('')
    const [keywordCount, setKeywordCount] = useState(100)
    const [keywords, setKeywords] = useState<KeywordData[]>([])
    const [keywordLoading, setKeywordLoading] = useState(false)
    const [keywordProgress, setKeywordProgress] = useState(0)
    const [minSearch, setMinSearch] = useState(100)
    const [maxCompetition, setMaxCompetition] = useState(0.5)

    // === 서로이웃 관련 ===
    const [neighborKeyword, setNeighborKeyword] = useState('')
    const [neighborMessage, setNeighborMessage] = useState('안녕하세요! 좋은 글 잘 보고 갑니다. 서로이웃 신청드려요 :)')
    const [neighborCount, setNeighborCount] = useState(100)
    const [neighbors, setNeighbors] = useState<NeighborBlog[]>([])
    const [neighborLoading, setNeighborLoading] = useState(false)
    const [neighborProgress, setNeighborProgress] = useState(0)
    const [dailyNeighborCount, setDailyNeighborCount] = useState(0)

    // === AI 댓글 관련 ===
    const [commentLoading, setCommentLoading] = useState(false)
    const [commentTasks, setCommentTasks] = useState<CommentTask[]>([])
    const [commentProgress, setCommentProgress] = useState(0)
    const [autoCommentEnabled, setAutoCommentEnabled] = useState(false)
    const [commentCount, setCommentCount] = useState(30)

    // 설정 입력 상태
    const [tistoryApiKey, setTistoryApiKey] = useState('')
    const [tistoryBlogName, setTistoryBlogName] = useState('')
    const [naverUsername, setNaverUsername] = useState('')
    const [naverPassword, setNaverPassword] = useState('')
    const [naverBlogId, setNaverBlogId] = useState('')
    const [naverApiClientId, setNaverApiClientId] = useState('')
    const [naverApiClientSecret, setNaverApiClientSecret] = useState('')

    // 설정 로드
    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        setSettingsLoading(true)
        try {
            const saved = localStorage.getItem('glowus_blog_settings')
            if (saved) {
                const parsed = JSON.parse(saved)
                setSettings(parsed)
                if (parsed.tistory) {
                    setTistoryApiKey(parsed.tistory.apiKey || '')
                    setTistoryBlogName(parsed.tistory.blogName || '')
                }
                if (parsed.naver) {
                    setNaverUsername(parsed.naver.username || '')
                    setNaverBlogId(parsed.naver.blogId || '')
                    setNaverApiClientId(parsed.naver.apiClientId || '')
                    setNaverApiClientSecret(parsed.naver.apiClientSecret || '')
                }
            }
        } catch (e) {
            console.error('설정 로드 실패:', e)
        } finally {
            setSettingsLoading(false)
        }
    }

    const saveSettings = async () => {
        const newSettings: BlogSettings = {
            tistory: {
                apiKey: tistoryApiKey,
                blogName: tistoryBlogName,
                connected: !!tistoryApiKey && !!tistoryBlogName
            },
            naver: {
                username: naverUsername,
                password: naverPassword,
                blogId: naverBlogId,
                apiClientId: naverApiClientId,
                apiClientSecret: naverApiClientSecret,
                connected: !!naverUsername && !!naverPassword
            }
        }
        setSettings(newSettings)
        localStorage.setItem('glowus_blog_settings', JSON.stringify(newSettings))
        alert('설정이 저장되었습니다!')
    }

    // === 글 생성 함수 ===
    const generatePost = async () => {
        if (!keyword.trim()) return
        setGenerationStep('generating')

        try {
            const response = await fetch('/api/skills/blog-writer/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: keyword.trim(),
                    platform,
                    collectTop3: true // 상위 3개 글 수집 후 조합
                })
            })

            const data = await response.json()
            if (data.success) {
                const post: BlogPost = {
                    title: data.title,
                    content: data.content,
                    tags: data.tags || [],
                    platform,
                    status: 'draft',
                    createdAt: new Date()
                }
                setGeneratedPost(post)
                setEditTitle(post.title)
                setEditContent(post.content)
                setEditTags(post.tags)
                setGenerationStep('preview')
            } else {
                throw new Error(data.error || '글 생성 실패')
            }
        } catch (error) {
            console.error('글 생성 오류:', error)
            alert('글 생성 중 오류가 발생했습니다.')
            setGenerationStep('idle')
        }
    }

    // 임시저장
    const saveDraft = async () => {
        if (!generatedPost) return
        setGenerationStep('saving')

        try {
            const updatedPost: BlogPost = {
                ...generatedPost,
                title: editTitle,
                content: editContent,
                tags: editTags,
                status: 'draft'
            }

            const response = await fetch('/api/skills/blog-writer/save-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post: updatedPost,
                    platform,
                    credentials: platform === 'tistory' ? settings.tistory : settings.naver
                })
            })

            const data = await response.json()
            if (data.success) {
                setGenerationStep('saved')
                alert(`${platform === 'tistory' ? '티스토리' : '네이버 블로그'}에 임시저장되었습니다!`)
            } else {
                throw new Error(data.error || '임시저장 실패')
            }
        } catch (error) {
            console.error('임시저장 오류:', error)
            alert('임시저장 중 오류가 발생했습니다.')
            setGenerationStep('preview')
        }
    }

    // === 키워드 채굴 함수 ===
    const mineKeywords = async () => {
        if (!seedKeyword.trim()) return
        setKeywordLoading(true)
        setKeywordProgress(0)
        setKeywords([])

        try {
            const response = await fetch('/api/skills/blog-writer/mine-keywords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seedKeyword: seedKeyword.trim(),
                    count: keywordCount,
                    credentials: settings.naver
                })
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('스트림 읽기 실패')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (data.progress) {
                                setKeywordProgress(data.progress)
                            }
                            if (data.keyword) {
                                setKeywords(prev => [...prev, data.keyword])
                            }
                            if (data.complete) {
                                setKeywordLoading(false)
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (error) {
            console.error('키워드 채굴 오류:', error)
            alert('키워드 채굴 중 오류가 발생했습니다.')
        } finally {
            setKeywordLoading(false)
        }
    }

    // 키워드 엑셀 다운로드
    const downloadKeywordsExcel = () => {
        if (keywords.length === 0) return

        const header = '키워드,PC검색량,모바일검색량,총검색량,문서수,경쟁률,황금키워드\n'
        const rows = keywords.map(k =>
            `${k.keyword},${k.pcSearch},${k.mobileSearch},${k.totalSearch},${k.docCount},${k.competition.toFixed(2)},${k.isGolden ? 'O' : 'X'}`
        ).join('\n')

        const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `keywords_${seedKeyword}_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // === 서로이웃 자동화 함수 ===
    const startNeighborAutomation = async () => {
        if (!neighborKeyword.trim()) return
        setNeighborLoading(true)
        setNeighborProgress(0)

        try {
            const response = await fetch('/api/skills/blog-writer/add-neighbors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: neighborKeyword.trim(),
                    message: neighborMessage,
                    count: neighborCount,
                    credentials: settings.naver
                })
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('스트림 읽기 실패')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (data.progress) {
                                setNeighborProgress(data.progress)
                                setDailyNeighborCount(data.dailyCount || 0)
                            }
                            if (data.neighbor) {
                                setNeighbors(prev => [...prev, data.neighbor])
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (error) {
            console.error('이웃 추가 오류:', error)
            alert('이웃 추가 중 오류가 발생했습니다.')
        } finally {
            setNeighborLoading(false)
        }
    }

    // === AI 댓글 자동화 함수 ===
    const startCommentAutomation = async () => {
        setCommentLoading(true)
        setCommentProgress(0)

        try {
            const response = await fetch('/api/skills/blog-writer/auto-comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    count: commentCount,
                    credentials: settings.naver
                })
            })

            const reader = response.body?.getReader()
            if (!reader) throw new Error('스트림 읽기 실패')

            const decoder = new TextDecoder()
            let buffer = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (data.progress) {
                                setCommentProgress(data.progress)
                            }
                            if (data.task) {
                                setCommentTasks(prev => [...prev, data.task])
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (error) {
            console.error('댓글 자동화 오류:', error)
            alert('댓글 자동화 중 오류가 발생했습니다.')
        } finally {
            setCommentLoading(false)
        }
    }

    // 태그 관리
    const addTag = () => {
        if (newTag.trim() && !editTags.includes(newTag.trim())) {
            setEditTags([...editTags, newTag.trim()])
            setNewTag('')
        }
    }
    const removeTag = (tag: string) => setEditTags(editTags.filter(t => t !== tag))

    const resetToNew = () => {
        setKeyword('')
        setGeneratedPost(null)
        setEditTitle('')
        setEditContent('')
        setEditTags([])
        setGenerationStep('idle')
        setEditMode(false)
    }

    // 황금 키워드 필터
    const goldenKeywords = keywords.filter(k => k.isGolden)

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-zinc-950">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl">
                        <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">AI 블로그 자동화</h1>
                        <p className="text-xs text-zinc-500">글쓰기 · 키워드 · 이웃 · 댓글 올인원</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 bg-zinc-900 rounded-xl p-1">
                    {[
                        { id: 'write', label: '글 작성', icon: Edit3 },
                        { id: 'keywords', label: '키워드 채굴', icon: Search },
                        { id: 'neighbors', label: '서로이웃', icon: Users },
                        { id: 'comments', label: 'AI 댓글', icon: MessageCircle },
                        { id: 'settings', label: '설정', icon: Settings }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as ActiveTab)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === tab.id
                                    ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg"
                                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {/* ==================== 글 작성 탭 ==================== */}
                {activeTab === 'write' && (
                    <div className="h-full flex">
                        {/* 왼쪽: 입력 영역 */}
                        <div className="w-1/3 border-r border-zinc-800 p-6 flex flex-col">
                            {/* 플랫폼 선택 */}
                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">블로그 플랫폼</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPlatform('naver')}
                                        className={cn(
                                            "flex-1 py-3 rounded-lg font-medium transition-all",
                                            platform === 'naver'
                                                ? "bg-green-500 text-white shadow-lg shadow-green-500/25"
                                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                        )}
                                    >
                                        네이버
                                    </button>
                                    <button
                                        onClick={() => setPlatform('tistory')}
                                        className={cn(
                                            "flex-1 py-3 rounded-lg font-medium transition-all",
                                            platform === 'tistory'
                                                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                        )}
                                    >
                                        티스토리
                                    </button>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    {(platform === 'naver' ? settings.naver?.connected : settings.tistory?.connected) ? (
                                        <>
                                            <Check className="w-3 h-3 text-green-500" />
                                            <span className="text-green-500">연결됨</span>
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-3 h-3 text-yellow-500" />
                                            <span className="text-yellow-500">설정 필요</span>
                                            <button onClick={() => setActiveTab('settings')} className="text-blue-400 hover:underline ml-1">
                                                설정하기
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 키워드 입력 */}
                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">키워드/주제</label>
                                <textarea
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    placeholder="글을 작성할 키워드를 입력하세요&#10;예: 2024 여름 여행지 추천"
                                    className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 resize-none"
                                    disabled={generationStep === 'generating'}
                                />
                            </div>

                            {/* 상위 글 수집 옵션 */}
                            <div className="mb-6 p-4 bg-zinc-900 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <Target className="w-4 h-4 text-orange-400" />
                                    <span className="text-sm font-medium text-white">상위 노출 글 분석</span>
                                </div>
                                <p className="text-xs text-zinc-500">
                                    해당 키워드로 상위 노출된 3개의 글을 수집하고 AI가 분석하여 SEO 최적화된 글을 작성합니다.
                                </p>
                            </div>

                            {/* 생성 버튼 */}
                            <button
                                onClick={generatePost}
                                disabled={!keyword.trim() || generationStep === 'generating'}
                                className={cn(
                                    "w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all",
                                    generationStep === 'generating'
                                        ? "bg-zinc-700 cursor-not-allowed"
                                        : "bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 shadow-lg shadow-orange-500/25"
                                )}
                            >
                                {generationStep === 'generating' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        AI가 글을 작성 중...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        AI 글 생성하기
                                    </>
                                )}
                            </button>

                            {generationStep !== 'idle' && (
                                <button
                                    onClick={resetToNew}
                                    className="mt-3 w-full py-3 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    새 글 작성
                                </button>
                            )}
                        </div>

                        {/* 오른쪽: 미리보기/에디터 */}
                        <div className="flex-1 p-6 flex flex-col">
                            {generatedPost ? (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setEditMode(false)}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                                                    !editMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                                )}
                                            >
                                                <Eye className="w-4 h-4" />
                                                미리보기
                                            </button>
                                            <button
                                                onClick={() => setEditMode(true)}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                                                    editMode ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                                                )}
                                            >
                                                <Edit3 className="w-4 h-4" />
                                                수정
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigator.clipboard.writeText(editContent)}
                                                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center gap-2 text-sm"
                                            >
                                                <Copy className="w-4 h-4" />
                                                복사
                                            </button>
                                            <button
                                                onClick={saveDraft}
                                                disabled={generationStep === 'saving'}
                                                className="px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:from-green-600 hover:to-emerald-600 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                                            >
                                                {generationStep === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                임시저장
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden flex flex-col">
                                        {editMode ? (
                                            <div className="flex-1 flex flex-col p-6 overflow-auto">
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="text-2xl font-bold bg-transparent text-white border-b border-zinc-700 pb-3 mb-4 focus:outline-none focus:border-orange-500"
                                                    placeholder="제목을 입력하세요"
                                                />
                                                <div className="mb-4">
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {editTags.map(tag => (
                                                            <span key={tag} className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm flex items-center gap-1">
                                                                #{tag}
                                                                <button onClick={() => removeTag(tag)} className="hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={newTag}
                                                            onChange={(e) => setNewTag(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                                            placeholder="태그 추가"
                                                            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                                                        />
                                                        <button onClick={addTag} className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600"><Plus className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="flex-1 bg-transparent text-zinc-300 leading-relaxed resize-none focus:outline-none"
                                                    placeholder="본문 내용을 입력하세요"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-1 p-6 overflow-auto">
                                                <h1 className="text-2xl font-bold text-white mb-4">{editTitle}</h1>
                                                <div className="flex flex-wrap gap-2 mb-6">
                                                    {editTags.map(tag => (
                                                        <span key={tag} className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full text-sm">#{tag}</span>
                                                    ))}
                                                </div>
                                                <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                                    {editContent}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Sparkles className="w-12 h-12 text-zinc-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-zinc-400 mb-2">AI 블로그 글 생성</h3>
                                        <p className="text-zinc-500 max-w-md">
                                            키워드를 입력하면 상위 노출 글을 분석하여<br />
                                            SEO 최적화된 글을 자동으로 작성합니다.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ==================== 키워드 채굴 탭 ==================== */}
                {activeTab === 'keywords' && (
                    <div className="h-full flex">
                        {/* 왼쪽: 입력 */}
                        <div className="w-1/3 border-r border-zinc-800 p-6">
                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">시드 키워드</label>
                                <input
                                    type="text"
                                    value={seedKeyword}
                                    onChange={(e) => setSeedKeyword(e.target.value)}
                                    placeholder="예: 맛집, 여행, 육아"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">수집 개수</label>
                                <input
                                    type="number"
                                    value={keywordCount}
                                    onChange={(e) => setKeywordCount(Number(e.target.value))}
                                    min={10}
                                    max={10000}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                                />
                                <p className="text-xs text-zinc-500 mt-1">최대 10,000개까지 수집 가능</p>
                            </div>

                            <div className="mb-6 p-4 bg-zinc-900 rounded-xl space-y-4">
                                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-blue-400" />
                                    황금 키워드 필터
                                </h4>
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">최소 검색량</label>
                                    <input
                                        type="number"
                                        value={minSearch}
                                        onChange={(e) => setMinSearch(Number(e.target.value))}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 mb-1 block">최대 경쟁률</label>
                                    <input
                                        type="number"
                                        value={maxCompetition}
                                        onChange={(e) => setMaxCompetition(Number(e.target.value))}
                                        step={0.1}
                                        min={0}
                                        max={1}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={mineKeywords}
                                disabled={!seedKeyword.trim() || keywordLoading}
                                className={cn(
                                    "w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all",
                                    keywordLoading
                                        ? "bg-zinc-700 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/25"
                                )}
                            >
                                {keywordLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        채굴 중... {keywordProgress}%
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5" />
                                        키워드 채굴 시작
                                    </>
                                )}
                            </button>

                            {keywords.length > 0 && (
                                <button
                                    onClick={downloadKeywordsExcel}
                                    className="mt-3 w-full py-3 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    엑셀 다운로드 ({keywords.length}개)
                                </button>
                            )}
                        </div>

                        {/* 오른쪽: 결과 */}
                        <div className="flex-1 p-6 flex flex-col">
                            {/* 통계 */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="bg-zinc-900 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-white">{keywords.length}</p>
                                    <p className="text-xs text-zinc-500">전체 키워드</p>
                                </div>
                                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-yellow-400">{goldenKeywords.length}</p>
                                    <p className="text-xs text-yellow-500">황금 키워드</p>
                                </div>
                                <div className="bg-zinc-900 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-white">
                                        {keywords.length > 0 ? Math.round(keywords.reduce((a, k) => a + k.totalSearch, 0) / keywords.length) : 0}
                                    </p>
                                    <p className="text-xs text-zinc-500">평균 검색량</p>
                                </div>
                                <div className="bg-zinc-900 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-bold text-white">
                                        {keywords.length > 0 ? (keywords.reduce((a, k) => a + k.competition, 0) / keywords.length).toFixed(2) : 0}
                                    </p>
                                    <p className="text-xs text-zinc-500">평균 경쟁률</p>
                                </div>
                            </div>

                            {/* 키워드 테이블 */}
                            <div className="flex-1 bg-zinc-900 rounded-xl overflow-hidden">
                                <div className="grid grid-cols-7 gap-4 px-4 py-3 bg-zinc-800 text-xs font-medium text-zinc-400">
                                    <div className="col-span-2">키워드</div>
                                    <div className="text-right">PC</div>
                                    <div className="text-right">모바일</div>
                                    <div className="text-right">총검색량</div>
                                    <div className="text-right">문서수</div>
                                    <div className="text-right">경쟁률</div>
                                </div>
                                <div className="overflow-auto max-h-[calc(100vh-400px)]">
                                    {keywords.length > 0 ? (
                                        keywords.map((k, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    "grid grid-cols-7 gap-4 px-4 py-3 border-b border-zinc-800 text-sm",
                                                    k.isGolden && "bg-yellow-500/5"
                                                )}
                                            >
                                                <div className="col-span-2 flex items-center gap-2">
                                                    {k.isGolden && <Sparkles className="w-4 h-4 text-yellow-500" />}
                                                    <span className="text-white">{k.keyword}</span>
                                                </div>
                                                <div className="text-right text-zinc-400">{k.pcSearch.toLocaleString()}</div>
                                                <div className="text-right text-zinc-400">{k.mobileSearch.toLocaleString()}</div>
                                                <div className="text-right text-white font-medium">{k.totalSearch.toLocaleString()}</div>
                                                <div className="text-right text-zinc-400">{k.docCount.toLocaleString()}</div>
                                                <div className={cn("text-right font-medium", k.competition < 0.3 ? "text-green-400" : k.competition < 0.6 ? "text-yellow-400" : "text-red-400")}>
                                                    {k.competition.toFixed(2)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-center h-64 text-zinc-500">
                                            시드 키워드를 입력하고 채굴을 시작하세요
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== 서로이웃 탭 ==================== */}
                {activeTab === 'neighbors' && (
                    <div className="h-full flex">
                        <div className="w-1/3 border-r border-zinc-800 p-6">
                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">타겟 키워드</label>
                                <input
                                    type="text"
                                    value={neighborKeyword}
                                    onChange={(e) => setNeighborKeyword(e.target.value)}
                                    placeholder="해당 키워드로 글 쓴 블로거 찾기"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">이웃 신청 메시지</label>
                                <textarea
                                    value={neighborMessage}
                                    onChange={(e) => setNeighborMessage(e.target.value)}
                                    placeholder="이웃 신청 시 보낼 메시지"
                                    className="w-full h-24 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 resize-none"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">신청 개수</label>
                                <input
                                    type="number"
                                    value={neighborCount}
                                    onChange={(e) => setNeighborCount(Number(e.target.value))}
                                    min={1}
                                    max={100}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-xs text-zinc-500 mt-1">하루 최대 100명까지 가능</p>
                            </div>

                            <div className="mb-6 p-4 bg-zinc-900 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-zinc-400">오늘 추가한 이웃</span>
                                    <span className="text-lg font-bold text-white">{dailyNeighborCount}/100</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 transition-all" style={{ width: `${dailyNeighborCount}%` }} />
                                </div>
                            </div>

                            <button
                                onClick={startNeighborAutomation}
                                disabled={!neighborKeyword.trim() || neighborLoading || dailyNeighborCount >= 100}
                                className={cn(
                                    "w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all",
                                    neighborLoading || dailyNeighborCount >= 100
                                        ? "bg-zinc-700 cursor-not-allowed"
                                        : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25"
                                )}
                            >
                                {neighborLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        이웃 추가 중... {neighborProgress}%
                                    </>
                                ) : dailyNeighborCount >= 100 ? (
                                    <>
                                        <AlertCircle className="w-5 h-5" />
                                        오늘 한도 초과
                                    </>
                                ) : (
                                    <>
                                        <Users className="w-5 h-5" />
                                        서로이웃 자동 추가
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex-1 p-6">
                            <h3 className="text-lg font-bold text-white mb-4">추가된 이웃 목록</h3>
                            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-auto">
                                {neighbors.length > 0 ? (
                                    neighbors.map((n, idx) => (
                                        <div key={idx} className="bg-zinc-900 rounded-xl p-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-white font-medium">{n.blogName}</p>
                                                <p className="text-xs text-zinc-500">{n.lastPost}</p>
                                            </div>
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium",
                                                n.status === 'added' ? "bg-green-500/20 text-green-400" :
                                                    n.status === 'failed' ? "bg-red-500/20 text-red-400" :
                                                        "bg-zinc-700 text-zinc-400"
                                            )}>
                                                {n.status === 'added' ? '추가됨' : n.status === 'failed' ? '실패' : '대기중'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-zinc-500">
                                        키워드를 입력하고 이웃 추가를 시작하세요
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== AI 댓글 탭 ==================== */}
                {activeTab === 'comments' && (
                    <div className="h-full flex">
                        <div className="w-1/3 border-r border-zinc-800 p-6">
                            <div className="mb-6 p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bot className="w-5 h-5 text-cyan-400" />
                                    <span className="text-sm font-medium text-white">AI 자동 댓글</span>
                                </div>
                                <p className="text-xs text-zinc-400">
                                    서로이웃의 최근 글을 방문하여 AI가 글 내용을 분석하고 자연스러운 댓글을 자동으로 작성합니다.
                                </p>
                            </div>

                            <div className="mb-6">
                                <label className="text-sm font-medium text-zinc-400 mb-2 block">댓글 작성 개수</label>
                                <input
                                    type="number"
                                    value={commentCount}
                                    onChange={(e) => setCommentCount(Number(e.target.value))}
                                    min={1}
                                    max={100}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div className="mb-6 p-4 bg-zinc-900 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-zinc-400">완료된 댓글</span>
                                    <span className="text-lg font-bold text-white">{commentTasks.filter(t => t.status === 'completed').length}/{commentCount}</span>
                                </div>
                                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-500 transition-all" style={{ width: `${commentProgress}%` }} />
                                </div>
                            </div>

                            <button
                                onClick={startCommentAutomation}
                                disabled={commentLoading}
                                className={cn(
                                    "w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all",
                                    commentLoading
                                        ? "bg-zinc-700 cursor-not-allowed"
                                        : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25"
                                )}
                            >
                                {commentLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        댓글 작성 중... {commentProgress}%
                                    </>
                                ) : (
                                    <>
                                        <MessageCircle className="w-5 h-5" />
                                        AI 댓글 시작
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="flex-1 p-6">
                            <h3 className="text-lg font-bold text-white mb-4">댓글 작성 로그</h3>
                            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-auto">
                                {commentTasks.length > 0 ? (
                                    commentTasks.map((task, idx) => (
                                        <div key={idx} className="bg-zinc-900 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-white font-medium">{task.blogName}</p>
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-medium",
                                                    task.status === 'completed' ? "bg-green-500/20 text-green-400" :
                                                        task.status === 'failed' ? "bg-red-500/20 text-red-400" :
                                                            "bg-zinc-700 text-zinc-400"
                                                )}>
                                                    {task.status === 'completed' ? '완료' : task.status === 'failed' ? '실패' : '진행중'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-zinc-400 mb-2">{task.postTitle}</p>
                                            <p className="text-xs text-zinc-500 italic">"{task.comment}"</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-zinc-500">
                                        AI 댓글 자동화를 시작하세요
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== 설정 탭 ==================== */}
                {activeTab === 'settings' && (
                    <div className="p-6 max-w-3xl mx-auto">
                        <h2 className="text-lg font-bold text-white mb-6">블로그 연동 설정</h2>

                        {/* 네이버 설정 */}
                        <div className="bg-zinc-900 rounded-xl p-6 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-500 rounded-lg">
                                    <Globe className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">네이버 블로그</h3>
                                    <p className="text-xs text-zinc-500">로그인 + API 연동</p>
                                </div>
                                {settings.naver?.connected && (
                                    <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">연결됨</span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-zinc-400 mb-1 block">네이버 아이디</label>
                                    <input
                                        type="text"
                                        value={naverUsername}
                                        onChange={(e) => setNaverUsername(e.target.value)}
                                        placeholder="네이버 아이디"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-400 mb-1 block">비밀번호</label>
                                    <input
                                        type="password"
                                        value={naverPassword}
                                        onChange={(e) => setNaverPassword(e.target.value)}
                                        placeholder="비밀번호"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-400 mb-1 block">블로그 ID</label>
                                    <input
                                        type="text"
                                        value={naverBlogId}
                                        onChange={(e) => setNaverBlogId(e.target.value)}
                                        placeholder="blog.naver.com/xxx의 xxx"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-400 mb-1 block">API Client ID (키워드용)</label>
                                    <input
                                        type="text"
                                        value={naverApiClientId}
                                        onChange={(e) => setNaverApiClientId(e.target.value)}
                                        placeholder="네이버 개발자센터 Client ID"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm text-zinc-400 mb-1 block">API Client Secret</label>
                                    <input
                                        type="password"
                                        value={naverApiClientSecret}
                                        onChange={(e) => setNaverApiClientSecret(e.target.value)}
                                        placeholder="네이버 개발자센터 Client Secret"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-green-500"
                                    />
                                    <p className="text-xs text-zinc-600 mt-1">
                                        <a href="https://developers.naver.com/apps/#/register" target="_blank" className="text-green-400 hover:underline">
                                            네이버 개발자센터에서 API 키 발급받기 →
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 티스토리 설정 */}
                        <div className="bg-zinc-900 rounded-xl p-6 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-orange-500 rounded-lg">
                                    <Globe className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">티스토리</h3>
                                    <p className="text-xs text-zinc-500">Open API 연동</p>
                                </div>
                                {settings.tistory?.connected && (
                                    <span className="ml-auto px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">연결됨</span>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-zinc-400 mb-1 block">API 키 (Access Token)</label>
                                    <input
                                        type="password"
                                        value={tistoryApiKey}
                                        onChange={(e) => setTistoryApiKey(e.target.value)}
                                        placeholder="티스토리 API Access Token"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                                    />
                                    <p className="text-xs text-zinc-600 mt-1">
                                        <a href="https://www.tistory.com/guide/api/manage/register" target="_blank" className="text-orange-400 hover:underline">
                                            티스토리 API 키 발급받기 →
                                        </a>
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-zinc-400 mb-1 block">블로그 이름</label>
                                    <input
                                        type="text"
                                        value={tistoryBlogName}
                                        onChange={(e) => setTistoryBlogName(e.target.value)}
                                        placeholder="xxx.tistory.com의 xxx"
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={saveSettings}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold hover:from-blue-600 hover:to-purple-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Save className="w-5 h-5" />
                            설정 저장
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
