"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import {
    ArrowLeft,
    Send,
    Bot,
    User,
    Loader2,
    FileSpreadsheet,
    Sparkles,
    Table,
    BarChart3,
    Calculator,
    Wand2,
    ExternalLink,
    RefreshCw,
    Plus,
    ChevronDown,
    Check,
    Link2
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Session } from "@supabase/supabase-js"

interface Message {
    role: 'user' | 'assistant'
    content: string
    actions?: any[]
}

const QUICK_PROMPTS = [
    { icon: Table, label: "견적서 만들기", prompt: "세련된 견적서 양식을 A4용지 기준으로 만들어줘" },
    { icon: Calculator, label: "예산표 만들기", prompt: "월별 예산 관리 테이블을 만들어줘" },
    { icon: BarChart3, label: "매출 데이터", prompt: "월별 매출 데이터 샘플과 합계를 만들어줘" },
    { icon: Wand2, label: "일정표 만들기", prompt: "주간 일정표 템플릿을 만들어줘" },
]

export default function AISheetPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const [session, setSession] = useState<Session | null>(null)
    const [providerToken, setProviderToken] = useState<string | null>(null)
    const [isLoadingSession, setIsLoadingSession] = useState(true)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null)
    const [sheetId, setSheetId] = useState<number | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [showModeModal, setShowModeModal] = useState(false)
    const [iframeKey, setIframeKey] = useState(0)
    const [needsSheetsScope, setNeedsSheetsScope] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const modeModalRef = useRef<HTMLDivElement>(null)

    const isAuthenticated = !!session

    // Supabase 세션 로드
    useEffect(() => {
        const loadSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setSession(session)

            // provider_token이 있으면 저장 (Google access token)
            if (session?.provider_token) {
                setProviderToken(session.provider_token)
                localStorage.setItem('google_access_token', session.provider_token)
            } else {
                // localStorage에서 이전에 저장한 토큰 확인
                const savedToken = localStorage.getItem('google_access_token')
                if (savedToken) {
                    setProviderToken(savedToken)
                } else if (session) {
                    // 세션은 있지만 provider_token이 없음 = Sheets 스코프 필요
                    setNeedsSheetsScope(true)
                }
            }
            setIsLoadingSession(false)
        }
        loadSession()

        // 세션 변경 리스너
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session?.provider_token) {
                setProviderToken(session.provider_token)
                localStorage.setItem('google_access_token', session.provider_token)
                setNeedsSheetsScope(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    // 스프레드시트 ID와 시트 ID를 로컬 스토리지에서 로드
    useEffect(() => {
        const savedId = localStorage.getItem('ai-sheet-spreadsheet-id')
        const savedSheetId = localStorage.getItem('ai-sheet-sheet-id')
        if (savedId) {
            setSpreadsheetId(savedId)
        }
        if (savedSheetId) {
            setSheetId(parseInt(savedSheetId, 10))
        }
    }, [])

    // 메시지 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // 모달 외부 클릭 감지
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modeModalRef.current && !modeModalRef.current.contains(event.target as Node)) {
                setShowModeModal(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Google Sheets 연동 (추가 스코프 요청)
    const connectGoogleSheets = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback?next=/dashboard-group/apps/ai-sheet`,
                scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        })
        if (error) {
            console.error('Failed to connect Google Sheets:', error)
            alert('Google Sheets 연동에 실패했습니다.')
        }
    }

    // 새 스프레드시트 생성
    const createNewSpreadsheet = async () => {
        if (!providerToken) {
            setNeedsSheetsScope(true)
            return
        }

        setIsCreating(true)
        try {
            const response = await fetch('/api/google-sheets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Google-Token': providerToken
                },
                body: JSON.stringify({
                    action: 'create',
                    data: { title: 'AI 스프레드시트 - ' + new Date().toLocaleDateString('ko-KR') }
                })
            })

            if (!response.ok) {
                const error = await response.json()
                if (error.error?.includes('scope') || error.error?.includes('permission')) {
                    setNeedsSheetsScope(true)
                    throw new Error('Google Sheets 권한이 필요합니다.')
                }
                throw new Error(error.error || 'Failed to create spreadsheet')
            }

            const { spreadsheetId: newId, sheetId: newSheetId } = await response.json()
            setSpreadsheetId(newId)
            setSheetId(newSheetId)
            localStorage.setItem('ai-sheet-spreadsheet-id', newId)
            localStorage.setItem('ai-sheet-sheet-id', String(newSheetId))
            setIframeKey(prev => prev + 1)
        } catch (error) {
            console.error('Failed to create spreadsheet:', error)
            alert(error instanceof Error ? error.message : '스프레드시트 생성에 실패했습니다.')
        } finally {
            setIsCreating(false)
        }
    }

    // iframe 새로고침
    const refreshIframe = () => {
        setIframeKey(prev => prev + 1)
    }

    // 메시지 전송
    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return
        if (!spreadsheetId) {
            alert('먼저 스프레드시트를 생성해주세요.')
            return
        }

        const userMessage: Message = { role: 'user', content }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            // AI API 호출
            const response = await fetch('/api/ai-sheet/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                })
            })

            if (!response.ok) {
                throw new Error('AI API 호출 실패')
            }

            const data = await response.json()
            console.log('AI Response:', data)

            // AI 응답 메시지 추가
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                actions: data.actions
            }
            setMessages(prev => [...prev, assistantMessage])

            // Google Sheets에 액션 실행
            if (data.actions && data.actions.length > 0 && providerToken) {
                const executeResponse = await fetch('/api/google-sheets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Google-Token': providerToken
                    },
                    body: JSON.stringify({
                        action: 'execute_actions',
                        spreadsheetId,
                        sheetId,
                        data: { actions: data.actions }
                    })
                })

                if (!executeResponse.ok) {
                    console.error('Failed to execute actions')
                }

                // iframe 새로고침하여 변경사항 반영
                setTimeout(() => {
                    refreshIframe()
                }, 500)
            }
        } catch (error) {
            console.error('AI Sheet error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '오류가 발생했습니다. 다시 시도해주세요.'
            }])
        } finally {
            setIsLoading(false)
        }
    }

    // 입력 핸들러
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(input)
        }
    }

    // Google Sheets 임베드 URL
    const getEmbedUrl = () => {
        if (!spreadsheetId) return ''
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`
    }

    // Google Sheets 링크
    const getSheetUrl = () => {
        if (!spreadsheetId) return ''
        return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }

    return (
        <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-900 overscroll-none overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <span className="font-semibold">AI 시트</span>
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                            Google Sheets
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAuthenticated && spreadsheetId && (
                        <>
                            <button
                                onClick={refreshIframe}
                                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                title="새로고침"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <a
                                href={getSheetUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                시트 열기
                            </a>
                        </>
                    )}
                    {isAuthenticated && (
                        <>
                            {needsSheetsScope ? (
                                <button
                                    onClick={connectGoogleSheets}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                    <Link2 className="w-4 h-4" />
                                    Google Sheets 연동
                                </button>
                            ) : (
                                <button
                                    onClick={createNewSpreadsheet}
                                    disabled={isCreating}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {isCreating ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Plus className="w-4 h-4" />
                                    )}
                                    새 시트
                                </button>
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="flex flex-row-reverse flex-1 overflow-hidden">
                {/* Chat Panel - Right */}
                <div className="w-[400px] flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <Sparkles className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                                <h3 className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    AI 스프레드시트
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    자연어로 명령하면 AI가 스프레드시트를 디자인합니다
                                </p>
                            </div>
                        )}

                        {messages.map((message, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "flex gap-3",
                                    message.role === 'user' && "flex-row-reverse"
                                )}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div className={cn(
                                    "rounded-2xl px-4 py-2 max-w-[280px]",
                                    message.role === 'user'
                                        ? "bg-green-600 text-white"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
                                )}>
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    {message.actions && message.actions.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
                                            ✓ Google Sheets에 적용됨
                                        </div>
                                    )}
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                    </div>
                                )}
                            </motion.div>
                        ))}

                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex gap-3"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center animate-pulse">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3 flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-sm text-zinc-500 dark:text-zinc-400">AI가 시트를 수정하고 있습니다...</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Prompts */}
                    {messages.length === 0 && (
                        <div className="px-4 pb-2">
                            <div className="grid grid-cols-2 gap-2">
                                {QUICK_PROMPTS.map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendMessage(item.prompt)}
                                        disabled={!spreadsheetId}
                                        className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <item.icon className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            {/* Mode Button */}
                            <div ref={modeModalRef} className="relative">
                                <button
                                    onClick={() => setShowModeModal(!showModeModal)}
                                    className="w-full flex items-center justify-between px-4 py-2 bg-green-600 hover:bg-green-700 transition-colors rounded-t-xl"
                                >
                                    <span className="text-sm font-medium text-white">AI 시트 모드</span>
                                    <ChevronDown className={cn("w-4 h-4 text-white transition-transform", showModeModal && "rotate-180")} />
                                </button>

                                <AnimatePresence>
                                    {showModeModal && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scaleY: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                            exit={{ opacity: 0, y: 10, scaleY: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 overflow-hidden z-50 origin-bottom"
                                        >
                                            <div className="py-2">
                                                <div className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer">
                                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                    <span className="text-sm text-zinc-200">Google Sheets와 연동된 AI 스프레드시트</span>
                                                </div>
                                                <div className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer">
                                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                    <span className="text-sm text-zinc-200">열 너비, 행 높이, 병합 등 모든 기능 지원</span>
                                                </div>
                                                <div className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer">
                                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                    <span className="text-sm text-zinc-200">자연어 명령으로 전문적인 문서 생성</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Input */}
                            <div className="p-3">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder=""
                                    disabled={!spreadsheetId || isLoading}
                                    className="w-full bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none disabled:opacity-50"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between px-3 pb-3">
                                <div className="flex items-center gap-1">
                                    {/* Future: Add file upload, voice input, etc. */}
                                </div>
                                <button
                                    onClick={() => sendMessage(input)}
                                    disabled={!input.trim() || isLoading || !spreadsheetId}
                                    className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Spreadsheet Panel - Left */}
                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 overscroll-none touch-none">
                    {isLoadingSession ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                        </div>
                    ) : needsSheetsScope ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <Link2 className="w-16 h-16 text-blue-400 mb-4" />
                            <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                Google Sheets 연동 필요
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
                                이미 로그인되어 있습니다. Google Sheets 권한을 추가로 허용해야
                                스프레드시트를 생성하고 AI로 편집할 수 있습니다.
                            </p>
                            <button
                                onClick={connectGoogleSheets}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                            >
                                <Link2 className="w-5 h-5" />
                                Google Sheets 연동하기
                            </button>
                        </div>
                    ) : spreadsheetId ? (
                        <div className="flex-1 relative overflow-hidden isolate">
                            <iframe
                                key={iframeKey}
                                src={getEmbedUrl()}
                                className="absolute inset-0 w-full h-full border-0"
                                title="Google Sheets"
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <FileSpreadsheet className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mb-4" />
                            <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                스프레드시트가 없습니다
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
                                '새 시트' 버튼을 클릭하여 Google Sheets 스프레드시트를 생성하세요.
                                AI가 자연어 명령으로 시트를 디자인합니다.
                            </p>
                            <button
                                onClick={createNewSpreadsheet}
                                disabled={isCreating}
                                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isCreating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Plus className="w-5 h-5" />
                                )}
                                새 스프레드시트 만들기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
