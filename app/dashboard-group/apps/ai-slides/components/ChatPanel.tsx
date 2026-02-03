"use client"

import { RefObject } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Send,
    Bot,
    User,
    Loader2,
    Check,
    Circle,
    Mic,
    FileText,
    Upload,
    FolderOpen,
    Trash2,
    Plus,
    Play
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message, TodoItem, SavedPresentation, SourceFile } from "../types"
import type { ParsedPresentationV2 } from "../types/slide-elements"

interface ChatPanelProps {
    // State
    messages: Message[]
    input: string
    isLoading: boolean
    todos: TodoItem[]
    chatTab: 'ai' | 'team'
    proMode: boolean
    showLoadMenu: boolean
    savedPresentations: SavedPresentation[]
    sources: SourceFile[]
    slides: { length: number }
    presentationV2: ParsedPresentationV2 | null
    leftPanelWidth: number

    // Refs
    messagesEndRef: RefObject<HTMLDivElement>
    fileInputRef: RefObject<HTMLInputElement>

    // Callbacks
    setInput: (input: string) => void
    setChatTab: (tab: 'ai' | 'team') => void
    setProMode: (mode: boolean) => void
    setShowLoadMenu: (show: boolean) => void
    setCurrentSlide: (index: number) => void
    sendMessage: () => void
    loadPresentation: (presentation: SavedPresentation) => void
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
    removeSource: (sourceId: string) => void
    generateSlides: (prompt: string) => void
    getAllSourcesText: () => string
}

export const ChatPanel = ({
    messages,
    input,
    isLoading,
    todos,
    chatTab,
    proMode,
    showLoadMenu,
    savedPresentations,
    sources,
    slides,
    presentationV2,
    leftPanelWidth,
    messagesEndRef,
    fileInputRef,
    setInput,
    setChatTab,
    setProMode,
    setShowLoadMenu,
    setCurrentSlide,
    sendMessage,
    loadPresentation,
    handleFileUpload,
    removeSource,
    generateSlides,
    getAllSourcesText,
}: ChatPanelProps) => {
    return (
        <div
            className="flex flex-col border-r border-zinc-200 dark:border-zinc-800 h-full overflow-hidden bg-white dark:bg-zinc-950"
            style={{ width: leftPanelWidth, minWidth: 320, maxWidth: 800 }}
        >
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">슬라이드 AI</h2>
            </div>

            {/* Chat Tabs - 슬라이드 생성 후에만 표시 */}
            {(slides.length > 0 || presentationV2) && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
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
                    {/* Pro Mode Toggle */}
                    <button
                        onClick={() => setProMode(!proMode)}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                            proMode
                                ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        )}
                        title={proMode ? "Pro 모드: 아이콘 + 이미지 + 디자인 원칙" : "기본 모드"}
                    >
                        <span className={cn("w-3 h-3 rounded-full transition-colors", proMode ? "bg-white/30" : "bg-zinc-400")}>
                            {proMode && <span className="block w-full h-full rounded-full bg-white animate-pulse" />}
                        </span>
                        Pro
                    </button>
                </div>
            )}

            {/* Chat Content - Single Scroll Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Source Section (NotebookLM 스타일) */}
                {slides.length === 0 && !presentationV2 && (
                    <SourceSection
                        sources={sources}
                        fileInputRef={fileInputRef}
                        removeSource={removeSource}
                        generateSlides={generateSlides}
                        getAllSourcesText={getAllSourcesText}
                    />
                )}

                {/* Todo Progress */}
                {todos.length > 0 && (
                    <TodoProgress todos={todos} />
                )}

                {/* Messages */}
                <MessageList
                    messages={messages}
                    isLoading={isLoading}
                    setCurrentSlide={setCurrentSlide}
                />
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <ChatInputArea
                input={input}
                isLoading={isLoading}
                showLoadMenu={showLoadMenu}
                savedPresentations={savedPresentations}
                leftPanelWidth={leftPanelWidth}
                fileInputRef={fileInputRef}
                setInput={setInput}
                setShowLoadMenu={setShowLoadMenu}
                sendMessage={sendMessage}
                loadPresentation={loadPresentation}
                handleFileUpload={handleFileUpload}
            />
        </div>
    )
}

// Sub-components

const SourceSection = ({
    sources,
    fileInputRef,
    removeSource,
    generateSlides,
    getAllSourcesText,
}: {
    sources: SourceFile[]
    fileInputRef: RefObject<HTMLInputElement>
    removeSource: (id: string) => void
    generateSlides: (prompt: string) => void
    getAllSourcesText: () => string
}) => (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl mb-4">
        {sources.length === 0 ? (
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.add('border-accent', 'bg-accent/5')
                }}
                onDragLeave={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-accent', 'bg-accent/5')
                }}
                onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-accent', 'bg-accent/5')
                    const files = e.dataTransfer.files
                    if (files.length > 0 && fileInputRef.current) {
                        const dataTransfer = new DataTransfer()
                        dataTransfer.items.add(files[0])
                        fileInputRef.current.files = dataTransfer.files
                        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                    }
                }}
                className="w-full flex flex-col items-center cursor-pointer hover:bg-accent/5 p-4 rounded-xl transition-all"
            >
                <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-3">
                    <Upload className="w-7 h-7 text-zinc-400" />
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium mb-1">
                    클릭하여 선택하거나 파일을 드래그하세요
                </p>
                <p className="text-xs text-zinc-400">PDF, PPTX 지원</p>
            </div>
        ) : (
            <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        📚 소스 ({sources.length}개)
                    </span>
                </div>
                <div className="space-y-2 mb-4">
                    {sources.map(source => (
                        <div
                            key={source.id}
                            className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-lg flex-shrink-0">
                                    {source.type === 'pdf' ? 'PDF' : 'DATA'}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-zinc-800 dark:text-zinc-200 truncate">
                                        {source.name}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        {source.slideCount}장 · {source.extractedText.length.toLocaleString()}자
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => removeSource(source.id)}
                                className="p-1 text-zinc-400 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        소스 추가
                    </button>
                    <button
                        onClick={() => {
                            const sourcesContext = getAllSourcesText()
                            generateSlides(sourcesContext || '사업계획서를 만들어주세요')
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                    >
                        <Play className="w-4 h-4" />
                        슬라이드 생성
                    </button>
                </div>
            </div>
        )}
    </div>
)

const TodoProgress = ({ todos }: { todos: TodoItem[] }) => (
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
)

const MessageList = ({
    messages,
    isLoading,
    setCurrentSlide,
}: {
    messages: Message[]
    isLoading: boolean
    setCurrentSlide: (index: number) => void
}) => (
    <>
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
    </>
)

const ChatInputArea = ({
    input,
    isLoading,
    showLoadMenu,
    savedPresentations,
    leftPanelWidth,
    fileInputRef,
    setInput,
    setShowLoadMenu,
    sendMessage,
    loadPresentation,
    handleFileUpload,
}: {
    input: string
    isLoading: boolean
    showLoadMenu: boolean
    savedPresentations: SavedPresentation[]
    leftPanelWidth: number
    fileInputRef: RefObject<HTMLInputElement>
    setInput: (input: string) => void
    setShowLoadMenu: (show: boolean) => void
    sendMessage: () => void
    loadPresentation: (presentation: SavedPresentation) => void
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => (
    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            <div className="px-4 py-3">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="YouTube URL 붙여넣기 또는 슬라이드 요청..."
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
)
