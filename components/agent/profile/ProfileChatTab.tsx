'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Loader2, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useChatRooms, useChatRoom } from '@/hooks/useChat'
import type { DeployedAgent } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

interface ProfileChatTabProps {
    agent: DeployedAgent
    isDark: boolean
}

export function ProfileChatTab({ agent, isDark }: ProfileChatTabProps) {
    const { user } = useAuthStore()
    const { rooms, fetchRooms, createRoom, loading: roomsLoading } = useChatRooms()
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null)

    // Find existing chat room with this agent
    useEffect(() => {
        if (roomsLoading || !rooms || !user) return

        const findRoom = async () => {
            // Find a direct chat where participants include this agent
            // Note: This logic depends on how participants are structured.
            // Assuming participants array contains agent_id or similar.
            const existingRoom = rooms.find(room =>
                room.type === 'direct' &&
                room.participants?.some(p => p.agent_id === agent.id)
            )

            if (existingRoom) {
                setActiveRoomId(existingRoom.id)
            } else {
                // If no room exists, we can create one automatically or wait for user action.
                // For now, let's create one automatically if we are sure.
                try {
                    // Check if we already tried to create to avoid loop
                    // But rooms lists comes from server, so if we just created, it should appear.
                } catch (e) {
                    console.error(e)
                }
            }
        }

        findRoom()
    }, [rooms, roomsLoading, agent.id, user])

    // If we have a room, use useChatRoom
    const {
        messages,
        sendMessage,
        loading: messagesLoading,
        sending,
        agentTyping
    } = useChatRoom(activeRoomId)

    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, agentTyping])

    const handleSend = async () => {
        if (!input.trim()) return

        if (!activeRoomId) {
            // Create room first
            try {
                const newRoom = await createRoom({
                    type: 'direct',
                    participant_ids: [
                        { type: 'user', id: user!.id },
                        { type: 'agent', id: agent.id }
                    ]
                })
                setActiveRoomId(newRoom.id)
                // Wait a bit for the hook to pick up the new room? 
                // useChatRoom depends on activeRoomId, so it should be automatic.

                // Logic to send message after room creation would be complex here because sendMessage comes from the hook which needs the ID first.
                // For simplicity, we just create the room. The user might need to click send again or we handle pending message.
                // Let's just create the room and let the user type, or better:
                // calling createRoom updates rooms list?
            } catch (e) {
                console.error("Failed to create room", e)
                return
            }
        } else {
            await sendMessage(input)
            setInput('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Create room handler
    const handleStartChat = async () => {
        if (!user) return
        try {
            const newRoom = await createRoom({
                type: 'direct',
                participant_ids: [
                    { type: 'user', id: user.id },
                    { type: 'agent', id: agent.id }
                ]
            })
            setActiveRoomId(newRoom.id)
        } catch (e) {
            console.error("Failed to create room", e)
        }
    }

    const isLoading = roomsLoading || (activeRoomId && messagesLoading)

    return (
        <div className={cn(
            "flex flex-col h-[600px] rounded-xl border opacity-95", // Fixed height for chat area
            isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
        )}>
            {/* Header */}
            <div className={cn(
                "flex items-center px-6 py-4 border-b shrink-0",
                isDark ? "border-zinc-800" : "border-zinc-100"
            )}>
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                <span className={cn("font-medium", isDark ? "text-zinc-100" : "text-zinc-900")}>
                    {agent.name}
                </span>
                <span className="mx-2 text-zinc-600">·</span>
                <span className="text-sm text-zinc-500">
                    {agentTyping ? "입력 중..." : "대화 가능"}
                </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!activeRoomId && !roomsLoading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4">
                        <div className={cn("p-4 rounded-full", isDark ? "bg-zinc-800" : "bg-zinc-100")}>
                            <Bot className={cn("w-8 h-8", isDark ? "text-zinc-400" : "text-zinc-500")} />
                        </div>
                        <p className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-500")}>
                            아직 대화 내역이 없습니다.
                        </p>
                        <button
                            onClick={handleStartChat}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                        >
                            대화 시작하기
                        </button>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, idx) => {
                            const isUser = msg.sender_type === 'user' // Adjust based on your Auth/Types
                            return (
                                <div
                                    key={msg.id || idx}
                                    className={cn("flex gap-4 max-w-3xl", isUser ? "ml-auto flex-row-reverse" : "")}
                                >
                                    <div className={cn(
                                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                                        isUser ? "bg-blue-500" : "bg-emerald-600"
                                    )}>
                                        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                                    </div>

                                    <div className={cn(
                                        "flex flex-col",
                                        isUser ? "items-end" : "items-start"
                                    )}>
                                        <div className={cn(
                                            "px-4 py-2 rounded-2xl max-w-lg shadow-sm whitespace-pre-wrap",
                                            isUser
                                                ? "bg-blue-500 text-white rounded-tr-none"
                                                : (isDark ? "bg-zinc-800 text-zinc-100" : "bg-white border border-zinc-100 text-zinc-800") + " rounded-tl-none"
                                        )}>
                                            {msg.content}
                                        </div>
                                        <span className={cn(
                                            "text-xs mt-1",
                                            isDark ? "text-zinc-500" : "text-zinc-400"
                                        )}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}

                        {agentTyping && (
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className={cn(
                                    "px-4 py-2 rounded-2xl rounded-tl-none flex items-center gap-1",
                                    isDark ? "bg-zinc-800" : "bg-white border border-zinc-100"
                                )}>
                                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className={cn(
                "p-4 border-t relative",
                isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-100"
            )}>
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={activeRoomId ? "메시지를 입력하세요..." : "대화를 시작하려면 버튼을 누르세요"}
                        disabled={!activeRoomId || sending}
                        className={cn(
                            "w-full px-4 py-3 pr-12 rounded-xl focus:outline-none focus:ring-2 transition-all",
                            isDark
                                ? "bg-zinc-800 text-zinc-100 placeholder-zinc-500 border-zinc-700 focus:ring-emerald-500/50"
                                : "bg-zinc-50 text-zinc-900 placeholder-zinc-400 border-zinc-200 focus:ring-emerald-500/20"
                        )}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!activeRoomId || !input.trim() || sending}
                        className={cn(
                            "absolute right-2 p-2 rounded-lg transition-colors",
                            (!activeRoomId || !input.trim() || sending)
                                ? "text-zinc-400 cursor-not-allowed"
                                : "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        )}
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>

                <div className="mt-2 text-center">
                    <p className={cn("text-xs", isDark ? "text-zinc-600" : "text-zinc-400")}>
                        AI는 실수를 할 수 있습니다. 중요한 정보는 확인해 주세요.
                    </p>
                </div>
            </div>
        </div>
    )
}
