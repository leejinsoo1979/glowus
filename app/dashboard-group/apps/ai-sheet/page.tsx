"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
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
import { useAIAppSync } from "@/hooks/useAIAppSync"
import { useJarvis } from "@/hooks/useJarvis"

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
    const [showModelDropdown, setShowModelDropdown] = useState(false)
    const [selectedModel, setSelectedModel] = useState<'grok' | 'claude'>('grok')
    const [iframeKey, setIframeKey] = useState(0)
    const [needsSheetsScope, setNeedsSheetsScope] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const modelDropdownRef = useRef<HTMLDivElement>(null)

    // Jarvis 연결 - Claude Code 모드용
    const executeActionsRef = useRef<(actions: any[], clearFirst?: boolean) => Promise<void>>()

    const [isStartingSession, setIsStartingSession] = useState(false)

    const {
        isConnected: jarvisConnected,
        isRunning: jarvisReady,
        sendMessage: jarvisSendMessage,
        connect: jarvisConnect,
        startSession: jarvisStartSession,
        registerAsBrowser,
    } = useJarvis({
        shared: true,
        onControl: (action, data) => {
            // MCP에서 보낸 AI Sheet 제어 명령 (Claude Code가 glowus_ai_sheet 도구 호출 시)
            if (action === 'ai_sheet_execute' && data) {
                const payload = data as { actions?: any[]; clearFirst?: boolean }
                if (payload.actions && Array.isArray(payload.actions) && executeActionsRef.current) {
                    console.log('[AI Sheet] Executing actions from Claude Code:', payload.actions.length)
                    executeActionsRef.current(payload.actions, payload.clearFirst)
                }
            }
        },
    })

    // Claude Code 사용 가능 여부
    const canUseClaudeCode = jarvisConnected && jarvisReady

    // Claude Code 세션 시작
    const startClaudeSession = async () => {
        if (isStartingSession) return
        setIsStartingSession(true)

        try {
            // 연결되어 있지 않으면 먼저 연결
            if (!jarvisConnected) {
                await jarvisConnect()
            }

            // 세션 시작
            const success = await jarvisStartSession(
                process.cwd(),  // 현재 디렉토리
                undefined,      // userName
                {
                    name: 'AI 시트 어시스턴트',
                    userTitle: '사용자님',
                    language: '한국어',
                },
                120,  // cols
                30    // rows
            )

            if (success) {
                setSelectedModel('claude')
                registerAsBrowser()
            }
        } catch (error) {
            console.error('[AI Sheet] Failed to start session:', error)
        } finally {
            setIsStartingSession(false)
        }
    }

    // 🔥 DB 동기화 훅
    const { saveMessage: saveToDb, updateThreadTitle, updateThreadMetadata } = useAIAppSync({
        appType: 'sheet',
        autoCreateThread: true,
    })

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
                localStorage.setItem('google_access_token_time', String(Date.now()))
                console.log('[AI Sheet] Provider token loaded from session')
            } else {
                // localStorage에서 이전에 저장한 토큰 확인
                const savedToken = localStorage.getItem('google_access_token')
                const savedTime = localStorage.getItem('google_access_token_time')

                // 토큰이 1시간 이상 지났으면 만료된 것으로 간주
                const isExpired = savedTime && (Date.now() - parseInt(savedTime, 10)) > 3600000

                if (savedToken && !isExpired) {
                    setProviderToken(savedToken)
                    console.log('[AI Sheet] Provider token loaded from localStorage')
                } else if (session) {
                    // 세션은 있지만 provider_token이 없거나 만료됨 = Sheets 스코프 필요
                    console.log('[AI Sheet] Token expired or missing, need Sheets scope')
                    localStorage.removeItem('google_access_token')
                    localStorage.removeItem('google_access_token_time')
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
                localStorage.setItem('google_access_token_time', String(Date.now()))
                setNeedsSheetsScope(false)
                console.log('[AI Sheet] Provider token updated from auth change')
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

    // 드롭다운 외부 클릭 감지
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false)
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

    // 메시지 전송 - 선택된 모델에 따라 분기
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

        // DB에 저장
        saveToDb({ role: 'user', content })

        if (selectedModel === 'claude') {
            await sendMessageViaClaude(content)
        } else {
            await sendMessageViaGrok(content)
        }
    }

    // Claude Code로 메시지 전송 (Max 플랜 - 무료)
    const sendMessageViaClaude = async (content: string) => {
        // Claude Code 세션이 없으면 자동 시작
        if (!canUseClaudeCode) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '🔄 Claude Code 세션을 시작합니다...'
            }])

            try {
                // 연결
                if (!jarvisConnected) {
                    await jarvisConnect()
                }
                // 세션 시작
                const success = await jarvisStartSession(
                    process.cwd(),
                    undefined,
                    {
                        name: 'AI 시트 어시스턴트',
                        userTitle: '사용자님',
                        language: '한국어',
                    },
                    120,
                    30
                )
                if (!success) {
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: '❌ Claude Code 세션 시작 실패. Jarvis 서버가 실행 중인지 확인해주세요.'
                    }])
                    setIsLoading(false)
                    return
                }
                registerAsBrowser()
                // 세션 시작 후 잠시 대기
                await new Promise(resolve => setTimeout(resolve, 2000))
            } catch (error) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '❌ Claude Code 연결 실패: ' + String(error)
                }])
                setIsLoading(false)
                return
            }
        }

        try {
            // Claude Code에게 glowus_ai_sheet 도구 사용 요청
            const prompt = `glowus_ai_sheet MCP 도구를 사용해서 Google Sheets 스프레드시트 작업을 수행해줘.

사용자 요청: ${content}

⚠️ 중요: 반드시 glowus_ai_sheet 도구를 호출하고, actions 배열에 아래 형식의 액션들을 JSON으로 전달해야 해.

지원되는 액션 타입:
1. set_cells - 셀 값과 서식 입력
2. set_row_height - 행 높이 설정
3. set_col_width - 열 너비 설정
4. merge_cells - 셀 병합
5. set_borders - 테두리 설정

예시:
{
  "actions": [
    { "type": "set_col_width", "data": { "widths": { "0": 100, "1": 200 } } },
    { "type": "set_cells", "data": { "cells": [{ "row": 0, "col": 0, "value": "제목", "format": { "bold": true } }] } }
  ]
}`

            const sent = jarvisSendMessage(prompt)
            if (!sent) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '❌ Claude Code에 메시지 전송 실패. 다시 시도해주세요.'
                }])
                setIsLoading(false)
                return
            }

            // Claude Code가 glowus_ai_sheet 도구를 호출하면 onControl 콜백이 실행됨
            setMessages(prev => {
                const updated = [...prev]
                // "세션을 시작합니다" 메시지 제거
                const filtered = updated.filter(m => !m.content.includes('세션을 시작합니다'))
                return [...filtered, {
                    role: 'assistant',
                    content: '🔄 Claude Code가 시트를 수정하고 있습니다...'
                }]
            })

            // 시트 새로고침 (Claude가 MCP 도구로 시트 수정 후)
            setTimeout(() => {
                setIframeKey(prev => prev + 1)
                // 마지막 메시지 업데이트
                setMessages(prev => {
                    const updated = [...prev]
                    if (updated.length > 0 && updated[updated.length - 1].content.includes('수정하고 있습니다')) {
                        updated[updated.length - 1] = {
                            role: 'assistant',
                            content: '✅ Claude Code 작업 완료! 시트를 확인해주세요.'
                        }
                    }
                    return updated
                })
                setIsLoading(false)
            }, 8000)

        } catch (error) {
            console.error('[AI Sheet] Claude error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ 오류: ${error}`
            }])
            setIsLoading(false)
        }
    }

    // Grok API로 메시지 전송
    const sendMessageViaGrok = async (content: string) => {
        try {
            // providerToken 체크
            if (!providerToken) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '⚠️ Google 인증이 필요합니다. 페이지를 새로고침하고 Google로 다시 로그인해주세요.'
                }])
                setIsLoading(false)
                return
            }

            const response = await fetch('/api/ai-sheet/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: content,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('[AI Sheet] Grok API error:', response.status, errorData)
                throw new Error(errorData.error || `AI API 호출 실패 (${response.status})`)
            }

            const data = await response.json()
            console.log('[AI Sheet] Grok Response:', data)

            // AI 응답 메시지 추가
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.message,
                actions: data.actions
            }
            setMessages(prev => [...prev, assistantMessage])

            // 🔥 AI 응답 DB에 저장
            saveToDb({ role: 'assistant', content: data.message, metadata: { actions: data.actions } })
            // 🔥 스프레드시트 ID를 메타데이터로 저장
            if (spreadsheetId) {
                updateThreadMetadata({ spreadsheetId, sheetId })
            }

            // Google Sheets에 액션 실행
            if (data.actions && data.actions.length > 0) {
                console.log('[AI Sheet] Executing', data.actions.length, 'actions on spreadsheet')
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
                    const execError = await executeResponse.json().catch(() => ({}))
                    const errorStr = JSON.stringify(execError).toLowerCase()
                    console.error('[AI Sheet] Failed to execute actions:', executeResponse.status, execError)

                    // 인증 관련 에러 감지 (401, token, auth, credential, OAuth 등)
                    const isAuthError = executeResponse.status === 401 ||
                        errorStr.includes('token') ||
                        errorStr.includes('auth') ||
                        errorStr.includes('credential') ||
                        errorStr.includes('oauth') ||
                        errorStr.includes('permission')

                    if (isAuthError) {
                        localStorage.removeItem('google_access_token')
                        localStorage.removeItem('google_access_token_time')
                        setProviderToken(null)
                        setNeedsSheetsScope(true)
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: '⚠️ Google 인증이 만료되었습니다. 상단의 "Google Sheets 연동" 버튼을 클릭해서 다시 인증해주세요.'
                        }])
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `⚠️ 시트 작업 실행 중 오류: ${execError.error || '알 수 없는 오류'}`
                        }])
                    }
                } else {
                    console.log('[AI Sheet] Actions executed successfully')
                }

                // iframe 새로고침하여 변경사항 반영
                setTimeout(() => {
                    refreshIframe()
                }, 500)
            } else if (data.actions && data.actions.length === 0) {
                console.log('[AI Sheet] No actions to execute (informational response)')
            }
        } catch (error) {
            console.error('[AI Sheet] Error:', error)
            const errorMessage = `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage
            }])
            saveToDb({ role: 'assistant', content: errorMessage })
        } finally {
            setIsLoading(false)
        }
    }

    // Jarvis에서 직접 액션 실행 (명령 없이 바로 실행)
    const executeActionsFromJarvis = useCallback(async (actions: any[], clearFirst?: boolean) => {
        if (!spreadsheetId || !providerToken) {
            console.log('[AI Sheet] Cannot execute: no spreadsheet or token')
            return
        }

        console.log('[AI Sheet] Executing actions from Jarvis:', actions.length)

        try {
            // 시트 초기화가 필요하면 먼저 실행
            if (clearFirst) {
                // TODO: 시트 초기화 로직
            }

            // Google Sheets에 액션 실행
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
                    data: { actions }
                })
            })

            if (!executeResponse.ok) {
                console.error('[AI Sheet] Failed to execute actions')
            } else {
                console.log('[AI Sheet] Actions executed successfully')
                // iframe 새로고침
                setTimeout(() => {
                    setIframeKey(prev => prev + 1)
                }, 500)
            }
        } catch (error) {
            console.error('[AI Sheet] Execute error:', error)
        }
    }, [spreadsheetId, providerToken, sheetId])

    // executeActionsFromJarvis를 ref에 저장 (useJarvis 콜백에서 사용)
    useEffect(() => {
        executeActionsRef.current = executeActionsFromJarvis
    }, [executeActionsFromJarvis])

    // Jarvis 연결 및 브라우저 등록
    useEffect(() => {
        // 공유 WebSocket에 연결하고 브라우저로 등록
        const initJarvis = async () => {
            const connected = await jarvisConnect()
            if (connected) {
                console.log('[AI Sheet] Connected to shared Jarvis session')
                registerAsBrowser()
            }
        }
        initJarvis()
    }, [jarvisConnect, registerAsBrowser])

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
        <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 overscroll-none overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
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
            <div className="flex flex-row-reverse flex-1 min-h-0 overflow-hidden">
                {/* Chat Panel - Right */}
                <div className="w-[400px] flex flex-col min-h-0 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
                    {/* Chat Messages */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
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
                        <div className="flex-shrink-0 px-4 pb-2">
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

                    {/* Google 재연결 버튼 - 인증 필요할 때만 표시 */}
                    {(needsSheetsScope || !providerToken) && (
                        <div className="flex-shrink-0 px-4 py-2 bg-amber-500/10 border-t border-amber-500/20">
                            <button
                                onClick={connectGoogleSheets}
                                className="w-full px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold"
                            >
                                🔗 Google Sheets 연결
                            </button>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="flex-shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            {/* Model Selector */}
                            <div ref={modelDropdownRef} className="relative">
                                <button
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-2 transition-colors rounded-t-xl",
                                        selectedModel === 'claude'
                                            ? "bg-orange-600 hover:bg-orange-700"
                                            : "bg-green-600 hover:bg-green-700"
                                    )}
                                >
                                    <span className="text-sm font-medium text-white flex items-center gap-2">
                                        {selectedModel === 'claude' ? (
                                            <>
                                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                                Claude Code (Max 플랜)
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-2 h-2 bg-white rounded-full" />
                                                Grok
                                            </>
                                        )}
                                    </span>
                                    <ChevronDown className={cn("w-4 h-4 text-white transition-transform", showModelDropdown && "rotate-180")} />
                                </button>

                                <AnimatePresence>
                                    {showModelDropdown && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scaleY: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                            exit={{ opacity: 0, y: 10, scaleY: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 overflow-hidden z-50 origin-bottom"
                                        >
                                            <div className="py-1">
                                                <button
                                                    onClick={() => { setSelectedModel('grok'); setShowModelDropdown(false) }}
                                                    className={cn(
                                                        "w-full px-3 py-2 flex items-center gap-3 hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors",
                                                        selectedModel === 'grok' && "bg-zinc-800 dark:bg-zinc-700"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                                                        <span className="text-white text-xs font-bold">G</span>
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="text-sm font-medium text-zinc-200">Grok</div>
                                                        <div className="text-xs text-zinc-400">xAI API</div>
                                                    </div>
                                                    {selectedModel === 'grok' && <Check className="w-4 h-4 text-green-500" />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (canUseClaudeCode) {
                                                            setSelectedModel('claude')
                                                            setShowModelDropdown(false)
                                                        } else {
                                                            // 세션 시작
                                                            startClaudeSession()
                                                            setShowModelDropdown(false)
                                                        }
                                                    }}
                                                    disabled={isStartingSession}
                                                    className={cn(
                                                        "w-full px-3 py-2 flex items-center gap-3 hover:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors",
                                                        selectedModel === 'claude' && "bg-zinc-800 dark:bg-zinc-700",
                                                        isStartingSession && "opacity-50"
                                                    )}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center">
                                                        {isStartingSession ? (
                                                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                                                        ) : (
                                                            <span className="text-white text-xs font-bold">C</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <div className="text-sm font-medium text-zinc-200">Claude Code</div>
                                                        <div className="text-xs text-zinc-400">
                                                            {isStartingSession ? '세션 시작 중...' : canUseClaudeCode ? 'Max 플랜 (무료)' : '클릭하여 세션 시작'}
                                                        </div>
                                                    </div>
                                                    {selectedModel === 'claude' && canUseClaudeCode && <Check className="w-4 h-4 text-orange-500" />}
                                                </button>
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
                                    placeholder={selectedModel === 'claude' ? "Claude Code에게 시트 작업 요청..." : "Grok에게 시트 작업 요청..."}
                                    disabled={!spreadsheetId || isLoading}
                                    className="w-full bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 outline-none border-none ring-0 focus:outline-none focus:border-none focus:ring-0 disabled:opacity-50"
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
