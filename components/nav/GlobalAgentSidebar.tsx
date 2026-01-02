"use client"

import React, { useState, useRef, useEffect } from 'react'
import {
    Send,
    Bot,
    User,
    Loader2,
    X,
    Sparkles,
    Trash2,
    MessageSquare,
    Zap,
    Cpu,
    ArrowDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
}

interface GlobalAgentSidebarProps {
    isOpen: boolean
    onToggle: () => void
}

export function GlobalAgentSidebar({
    isOpen,
    onToggle
}: GlobalAgentSidebarProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Load history from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('glowus_agent_chat_history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Convert string dates back to Date objects
                const restored = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(restored);
            } catch (e) {
                console.error('Failed to parse chat history', e);
            }
        } else {
            // Default first message if no history
            setMessages([
                {
                    id: '1',
                    role: 'assistant',
                    content: '안녕하세요! GlowUS AI 어시스턴트입니다. 무엇을 도와드릴까요?',
                    timestamp: new Date()
                }
            ]);
        }
    }, []);

    // Save history to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('glowus_agent_chat_history', JSON.stringify(messages));
        }
    }, [messages]);

    // 자동 스크롤
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        if (isOpen) {
            scrollToBottom()
        }
    }, [messages, isOpen])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        try {
            // Super Agent API 사용 (browser_automation 등 도구 포함)
            const response = await fetch('/api/agents/super/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.content,
                    chatHistory: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || '채팅 응답을 가져오지 못했습니다.')
            }

            const data = await response.json()

            // 도구 사용 정보 로그
            if (data.toolsUsed && data.toolsUsed.length > 0) {
                console.log('[GlobalAgentSidebar] Tools used:', data.toolsUsed)
            }

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response || data.content || '응답을 받지 못했습니다.',
                timestamp: new Date()
            }

            setMessages(prev => [...prev, assistantMessage])
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.',
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
    }

    const clearHistory = () => {
        if (confirm('대화 내역을 모두 삭제하시겠습니까?')) {
            const initialMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: '대화가 초기화되었습니다. 궁금한 점이 있으시면 질문해 주세요!',
                timestamp: new Date()
            };
            setMessages([initialMessage]);
            localStorage.setItem('glowus_agent_chat_history', JSON.stringify([initialMessage]));
        }
    }

    return (
        <>
            {/* 사이드바 패널 */}
            <div
                className={cn(
                    "fixed right-0 top-0 h-full w-[400px] bg-zinc-950 border-l border-zinc-800 z-[90]",
                    "transform transition-transform duration-300 ease-in-out shadow-[-10px_0_30px_rgba(0,0,0,0.5)]",
                    "flex flex-col flex-1",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* 헤더 */}
                <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-600/20 rounded-lg">
                            <Cpu className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white leading-tight">Super Agent</h2>
                            <p className="text-[10px] text-zinc-500 font-medium">ONLINE · CLAUDE + TOOLS</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={clearHistory}
                            className="p-2 hover:bg-zinc-900 rounded-lg transition-colors group"
                            title="내역 삭제"
                        >
                            <Trash2 className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
                        </button>
                        <button
                            onClick={onToggle}
                            className="p-2 hover:bg-zinc-900 rounded-lg transition-colors group"
                        >
                            <X className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                        </button>
                    </div>
                </div>

                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-6 custom-scrollbar scroll-smooth">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2",
                                msg.role === 'user' ? "items-end" : "items-start"
                            )}
                        >
                            <div className="flex items-center gap-2 px-1">
                                {msg.role === 'assistant' ? (
                                    <Sparkles className="w-3 h-3 text-blue-500" />
                                ) : (
                                    <User className="w-3 h-3 text-zinc-500" />
                                )}
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    {msg.role === 'assistant' ? 'AI Assistant' : 'You'}
                                </span>
                            </div>
                            <div
                                className={cn(
                                    "max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed select-text",
                                    msg.role === 'user'
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/10"
                                        : "bg-zinc-900 text-zinc-200 border border-zinc-800"
                                )}
                            >
                                {msg.content}
                            </div>
                            <span className="text-[10px] text-zinc-600 px-1">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex flex-col gap-2 items-start animate-pulse">
                            <div className="flex items-center gap-2 px-1">
                                <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    AI is thinking...
                                </span>
                            </div>
                            <div className="bg-zinc-900/50 border border-zinc-800 w-12 h-8 rounded-2xl flex items-center justify-center">
                                <div className="flex gap-1">
                                    <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce" />
                                    <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-1 h-1 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* 입력 영역 */}
                <div className="p-4 bg-zinc-950 border-t border-zinc-900">
                    <div className="relative group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSend()
                                }
                            }}
                            placeholder="메시지를 입력하세요 (Shift+Enter 줄바꿈)"
                            rows={1}
                            className={cn(
                                "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pb-12 text-sm text-zinc-200",
                                "placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50",
                                "resize-none transition-all duration-200",
                                "group-focus-within:border-blue-500/30"
                            )}
                            style={{ minHeight: '100px' }}
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-2">
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className={cn(
                                    "p-2 rounded-lg transition-all duration-200",
                                    input.trim() && !isLoading
                                        ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                                        : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                )}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="absolute bottom-3 left-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded-md">
                                <Zap className="w-3 h-3 text-purple-500" />
                                <span className="text-[10px] font-bold text-zinc-400">Claude + Browser</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 text-center mt-3 font-medium">
                        AI는 실수를 할 수 있습니다. 중요한 정보는 확인이 필요합니다.
                    </p>
                </div>
            </div>

            {/* 오버레이 (클릭 시 닫힘) */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-80 transition-opacity duration-300"
                    onClick={onToggle}
                />
            )}
        </>
    )
}
