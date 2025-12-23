'use client'

import { create } from 'zustand'
import { type ChatModelId } from '@/lib/ai/models'

// Re-export for backward compatibility
export type ChatModel = ChatModelId

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    model?: string
    /** 첨부 이미지 (viewfinder 캡처 등) */
    imageDataUrl?: string
    /** 메타데이터 (viewfinder context, file context 등) */
    metadata?: Record<string, unknown>
}

interface ChatState {
    messages: ChatMessage[]
    input: string
    isLoading: boolean
    selectedModel: ChatModel
    isAgentMode: boolean
    /** 뷰파인더에서 공유된 대기 중인 이미지 */
    pendingImage: { dataUrl: string; timestamp: number } | null

    setInput: (input: string) => void
    setMessages: (messages: ChatMessage[]) => void
    addMessage: (message: ChatMessage) => void
    setIsLoading: (loading: boolean) => void
    setSelectedModel: (model: ChatModel) => void
    toggleAgentMode: () => void
    clearMessages: () => void
    /** 뷰파인더 이미지 설정 */
    setPendingImage: (image: { dataUrl: string; timestamp: number } | null) => void
    /** 이미지와 함께 메시지 전송 */
    sendMessageWithImage: (content: string, imageDataUrl: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
    messages: [],
    input: '',
    isLoading: false,
    selectedModel: 'gemini-3-flash',
    isAgentMode: false,
    pendingImage: null,

    setInput: (input) => set({ input }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    setIsLoading: (isLoading) => set({ isLoading }),
    setSelectedModel: (selectedModel) => set({ selectedModel }),
    toggleAgentMode: () => set((state) => ({ isAgentMode: !state.isAgentMode })),
    clearMessages: () => set({ messages: [] }),
    setPendingImage: (pendingImage) => set({ pendingImage }),
    sendMessageWithImage: (content, imageDataUrl) => {
        const state = get()
        const message: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: Date.now(),
            model: state.selectedModel,
            imageDataUrl,
            metadata: {
                source: 'viewfinder',
                capturedAt: Date.now()
            }
        }
        set((s) => ({
            messages: [...s.messages, message],
            pendingImage: null
        }))
    }
}))
