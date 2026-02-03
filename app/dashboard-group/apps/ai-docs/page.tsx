"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import {
    Send,
    Bot,
    User,
    Loader2,
    Download,
    Copy,
    ThumbsUp,
    ThumbsDown,
    FileText,
    Upload,
    Mic,
    MicOff,
    MoreHorizontal,
    GripVertical,
    ExternalLink,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    CheckSquare,
    Image,
    Link,
    Table,
    Undo,
    Redo,
    Type,
    Code,
    Quote,
    Minus,
    Users,
    UserPlus,
    Check,
    X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAIAppSync } from "@/hooks/useAIAppSync"

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
    feedback?: 'like' | 'dislike'
}

type EditorMode = 'richtext' | 'markdown'

export default function AIDocsPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [chatTab, setChatTab] = useState<'ai' | 'team'>('ai')
    const [editorMode, setEditorMode] = useState<EditorMode>('markdown')
    const [documentTitle, setDocumentTitle] = useState('AI 문서')
    const [documentContent, setDocumentContent] = useState('')

    // 🔥 DB 동기화 훅
    const { saveMessage: saveToDb, updateThreadTitle, updateThreadMetadata } = useAIAppSync({
        appType: 'docs',
        autoCreateThread: true,
    })

    // Resizable panel
    const [leftPanelWidth, setLeftPanelWidth] = useState(480)
    const [isResizing, setIsResizing] = useState(false)

    // Voice recording
    const [isRecording, setIsRecording] = useState(false)
    const recognitionRef = useRef<any>(null)

    // Copy notification
    const [showCopyNotification, setShowCopyNotification] = useState(false)

    // File upload
    const fileInputRef = useRef<HTMLInputElement>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

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

    // Generate document with AI
    const generateDocument = useCallback(async (prompt: string) => {
        setIsLoading(true)

        try {
            const response = await fetch('/api/docs/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, format: editorMode })
            })

            const data = await response.json()

            if (data.success && data.content) {
                setDocumentContent(data.content)
                if (data.title) {
                    setDocumentTitle(data.title)
                    // 🔥 스레드 제목 업데이트
                    updateThreadTitle(data.title)
                }
                const assistantMessage = `문서가 생성되었습니다.\n\n수정이 필요하시면 말씀해주세요:\n• "제목을 바꿔줘"\n• "내용을 더 추가해줘"\n• "형식을 바꿔줘"`
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: assistantMessage
                }])
                // 🔥 DB에 저장
                saveToDb({ role: 'assistant', content: assistantMessage, metadata: { documentTitle: data.title } })
                // 🔥 문서 내용을 메타데이터로 저장
                updateThreadMetadata({ documentContent: data.content, documentTitle: data.title })
            } else {
                throw new Error('Failed to generate document')
            }
        } catch (error) {
            console.error('Document generation error:', error)
            const errorMessage = '문서 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage
            }])
            saveToDb({ role: 'assistant', content: errorMessage })
        }

        setIsLoading(false)
    }, [editorMode, saveToDb, updateThreadTitle, updateThreadMetadata])

    // Edit document with AI
    const editDocument = useCallback(async (instruction: string) => {
        if (!documentContent) return

        setIsLoading(true)

        try {
            const response = await fetch('/api/docs/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: documentContent,
                    instruction,
                    format: editorMode
                })
            })

            const data = await response.json()

            if (data.success && data.content) {
                setDocumentContent(data.content)
                const assistantMessage = '문서가 수정되었습니다.'
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: assistantMessage
                }])
                // 🔥 DB에 저장
                saveToDb({ role: 'assistant', content: assistantMessage })
                // 🔥 문서 내용 업데이트
                updateThreadMetadata({ documentContent: data.content })
            }
        } catch (error) {
            console.error('Document edit error:', error)
            const errorMessage = '문서 수정 중 오류가 발생했습니다.'
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errorMessage
            }])
            saveToDb({ role: 'assistant', content: errorMessage })
        }

        setIsLoading(false)
    }, [documentContent, editorMode, saveToDb, updateThreadMetadata])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])

        // 🔥 사용자 메시지 DB에 저장
        saveToDb({ role: 'user', content: userMessage })

        // Check if it's a document generation request
        if (
            (userMessage.includes('문서') || userMessage.includes('작성') || userMessage.includes('만들어')) &&
            !documentContent
        ) {
            await generateDocument(userMessage)
        } else if (documentContent) {
            // Edit existing document
            await editDocument(userMessage)
        } else {
            // Guide user
            const guideMessage = '어떤 문서를 작성해드릴까요?\n\n예시:\n• "사업계획서 작성해줘"\n• "마케팅 제안서 만들어줘"\n• "회의록 양식 만들어줘"'
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: guideMessage
            }])
            // 🔥 가이드 메시지도 DB에 저장
            saveToDb({ role: 'assistant', content: guideMessage })
        }
    }

    // Copy document content
    const copyContent = () => {
        navigator.clipboard.writeText(documentContent)
        setShowCopyNotification(true)
        setTimeout(() => setShowCopyNotification(false), 2000)
    }

    // Export document
    const exportDocument = async (format: 'md' | 'html' | 'pdf') => {
        if (format === 'md') {
            const blob = new Blob([documentContent], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${documentTitle}.md`
            a.click()
            URL.revokeObjectURL(url)
        } else if (format === 'html') {
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${documentTitle}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
        h1, h2, h3 { margin-top: 24px; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
        pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
        th { background: #f4f4f4; }
    </style>
</head>
<body>
${documentContent}
</body>
</html>`
            const blob = new Blob([htmlContent], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${documentTitle}.html`
            a.click()
            URL.revokeObjectURL(url)
        }
    }

    // ========== Markdown Toolbar Actions ==========
    const insertMarkdown = (syntax: string, wrap?: boolean) => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selected = documentContent.substring(start, end)

        let newContent: string
        let newCursorPos: number

        if (wrap && selected) {
            newContent = documentContent.substring(0, start) + syntax + selected + syntax + documentContent.substring(end)
            newCursorPos = end + syntax.length * 2
        } else if (wrap) {
            newContent = documentContent.substring(0, start) + syntax + syntax + documentContent.substring(end)
            newCursorPos = start + syntax.length
        } else {
            newContent = documentContent.substring(0, start) + syntax + documentContent.substring(end)
            newCursorPos = start + syntax.length
        }

        setDocumentContent(newContent)

        // Restore focus and cursor position
        setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
    }

    // Insert table
    const insertTable = () => {
        const tableMarkdown = `\n| 헤더 1 | 헤더 2 | 헤더 3 |\n|--------|--------|--------|\n| 셀 1   | 셀 2   | 셀 3   |\n| 셀 4   | 셀 5   | 셀 6   |\n`
        insertMarkdown(tableMarkdown)
    }

    // ========== Rich Text Toolbar Actions ==========
    const execCommand = (command: string, value?: string) => {
        if (editorMode !== 'richtext' || !editorRef.current) return

        editorRef.current.focus()
        document.execCommand(command, false, value)

        // Update content state
        setTimeout(() => {
            if (editorRef.current) {
                setDocumentContent(editorRef.current.innerHTML)
            }
        }, 0)
    }

    const handleUndo = () => execCommand('undo')
    const handleRedo = () => execCommand('redo')
    const handleBold = () => execCommand('bold')
    const handleItalic = () => execCommand('italic')
    const handleUnderline = () => execCommand('underline')
    const handleStrikethrough = () => execCommand('strikeThrough')
    const handleAlignLeft = () => execCommand('justifyLeft')
    const handleAlignCenter = () => execCommand('justifyCenter')
    const handleAlignRight = () => execCommand('justifyRight')
    const handleAlignJustify = () => execCommand('justifyFull')
    const handleInsertUnorderedList = () => execCommand('insertUnorderedList')
    const handleInsertOrderedList = () => execCommand('insertOrderedList')

    const handleFontSize = (size: string) => {
        execCommand('fontSize', size)
    }

    const handleHeading = (level: string) => {
        if (level === 'Normal Text') {
            execCommand('formatBlock', 'p')
        } else {
            execCommand('formatBlock', level.toLowerCase().replace(' ', ''))
        }
    }

    // ========== Voice Input ==========
    const toggleVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert('음성 인식이 지원되지 않는 브라우저입니다.')
            return
        }

        if (isRecording) {
            recognitionRef.current?.stop()
            setIsRecording(false)
        } else {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
            const recognition = new SpeechRecognition()

            recognition.lang = 'ko-KR'
            recognition.continuous = true
            recognition.interimResults = true

            recognition.onresult = (event: any) => {
                let finalTranscript = ''
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript
                    }
                }
                if (finalTranscript) {
                    setInput(prev => prev + finalTranscript)
                }
            }

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error)
                setIsRecording(false)
            }

            recognition.onend = () => {
                setIsRecording(false)
            }

            recognitionRef.current = recognition
            recognition.start()
            setIsRecording(true)
        }
    }

    // ========== File Upload ==========
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // For images, convert to base64 and insert
        if (file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = () => {
                const base64 = reader.result as string
                if (editorMode === 'markdown') {
                    insertMarkdown(`![${file.name}](${base64})`)
                } else {
                    execCommand('insertImage', base64)
                }
            }
            reader.readAsDataURL(file)
        } else if (file.type === 'text/plain' || file.type === 'text/markdown') {
            // For text files, read and append content
            const reader = new FileReader()
            reader.onload = () => {
                const content = reader.result as string
                setDocumentContent(prev => prev + '\n' + content)
            }
            reader.readAsText(file)
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // ========== Feedback ==========
    const handleFeedback = (messageIndex: number, feedback: 'like' | 'dislike') => {
        setMessages(prev => prev.map((msg, i) =>
            i === messageIndex ? { ...msg, feedback } : msg
        ))
    }

    // ========== Insert Link (Rich Text) ==========
    const handleInsertLink = () => {
        const url = prompt('링크 URL을 입력하세요:')
        if (url) {
            execCommand('createLink', url)
        }
    }

    // ========== Insert Image (Rich Text) ==========
    const handleInsertImage = () => {
        const url = prompt('이미지 URL을 입력하세요:')
        if (url) {
            execCommand('insertImage', url)
        }
    }

    return (
        <div ref={containerRef} className="h-full flex flex-row-reverse bg-zinc-950 overflow-hidden">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
            />

            {/* Right Panel - Chat */}
            <div
                className="flex flex-col border-r border-zinc-800 h-full overflow-hidden"
                style={{ width: leftPanelWidth, minWidth: 320, maxWidth: 800 }}
            >
                {/* Chat Tabs */}
                <div className="flex items-center gap-2 p-4 border-b border-zinc-800">
                    <button
                        onClick={() => setChatTab('ai')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                            chatTab === 'ai' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
                        )}
                    >
                        <FileText className="w-4 h-4" />
                        AI 문서
                    </button>
                    <button
                        onClick={() => setChatTab('team')}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                            chatTab === 'team' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        팀 채팅
                    </button>
                </div>

                {/* Chat Content */}
                <div className="flex-1 overflow-y-auto">
                    {chatTab === 'ai' ? (
                        <div className="p-4 space-y-4">
                            {/* Action Buttons */}
                            {documentContent && (
                                <div className="flex items-center gap-2 pb-4 border-b border-zinc-800">
                                    <button
                                        onClick={copyContent}
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors relative"
                                    >
                                        {showCopyNotification ? (
                                            <>
                                                <Check className="w-4 h-4 text-green-400" />
                                                복사됨
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                복사
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Messages */}
                            {messages.length === 0 ? (
                                <div className="text-center py-12 text-zinc-500">
                                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>문서 요청을 입력하세요</p>
                                    <p className="text-sm mt-2">예: "사업계획서 작성해줘"</p>
                                </div>
                            ) : (
                                messages.map((msg, i) => (
                                    <div key={i} className={cn("flex gap-3", msg.role === 'user' && "flex-row-reverse")}>
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                            msg.role === 'user' ? "bg-accent" : "bg-zinc-800"
                                        )}>
                                            {msg.role === 'user' ? (
                                                <User className="w-4 h-4 text-white" />
                                            ) : (
                                                <Bot className="w-4 h-4 text-white" />
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 max-w-[85%]">
                                            <div className={cn(
                                                "rounded-2xl px-4 py-3 text-sm",
                                                msg.role === 'user'
                                                    ? "bg-accent text-white"
                                                    : "bg-zinc-800 text-zinc-200"
                                            )}>
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                            {/* Feedback buttons for assistant messages */}
                                            {msg.role === 'assistant' && (
                                                <div className="flex items-center gap-1 ml-1">
                                                    <button
                                                        onClick={() => handleFeedback(i, 'like')}
                                                        className={cn(
                                                            "p-1.5 rounded transition-colors",
                                                            msg.feedback === 'like'
                                                                ? "bg-green-500/20 text-green-400"
                                                                : "hover:bg-zinc-800 text-zinc-500"
                                                        )}
                                                    >
                                                        <ThumbsUp className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleFeedback(i, 'dislike')}
                                                        className={cn(
                                                            "p-1.5 rounded transition-colors",
                                                            msg.feedback === 'dislike'
                                                                ? "bg-red-500/20 text-red-400"
                                                                : "hover:bg-zinc-800 text-zinc-500"
                                                        )}
                                                    >
                                                        <ThumbsDown className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    ) : (
                        /* Team Chat Tab */
                        <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <span className="text-sm font-medium text-white"># 팀 채팅</span>
                                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">멤버 0명</span>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <p className="text-zinc-400 mb-6">
                                    공동 작업을 통해 팀 효율성을 높이세요
                                </p>
                                <button className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
                                    <UserPlus className="w-4 h-4" />
                                    초대
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-zinc-800">
                    <div className="bg-zinc-800 rounded-xl">
                        <div className="px-4 py-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder={chatTab === 'ai' ? "여기에 문서 요청을 입력하세요..." : "팀 메시지를 입력하세요..."}
                                className="w-full bg-transparent text-white placeholder-zinc-500 text-sm outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-700">
                            <div className="flex items-center gap-1">
                                <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                                    <MoreHorizontal className="w-5 h-5 text-zinc-500" />
                                </button>
                                {/* Editor Mode Toggle */}
                                <div className="flex items-center bg-zinc-700 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setEditorMode('richtext')}
                                        className={cn(
                                            "px-3 py-1 text-xs rounded-md transition-colors",
                                            editorMode === 'richtext'
                                                ? "bg-zinc-600 text-white"
                                                : "text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        Rich Text
                                    </button>
                                    <button
                                        onClick={() => setEditorMode('markdown')}
                                        className={cn(
                                            "px-3 py-1 text-xs rounded-md transition-colors",
                                            editorMode === 'markdown'
                                                ? "bg-zinc-600 text-white"
                                                : "text-zinc-400 hover:text-white"
                                        )}
                                    >
                                        Markdown
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                                    title="파일 업로드"
                                >
                                    <Upload className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button
                                    onClick={toggleVoiceInput}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        isRecording
                                            ? "bg-red-500/20 text-red-400"
                                            : "hover:bg-zinc-700 text-zinc-500"
                                    )}
                                    title={isRecording ? "녹음 중지" : "음성 입력"}
                                >
                                    {isRecording ? (
                                        <MicOff className="w-5 h-5" />
                                    ) : (
                                        <Mic className="w-5 h-5" />
                                    )}
                                </button>
                                <button
                                    onClick={sendMessage}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 bg-accent hover:bg-accent/90 disabled:bg-zinc-600 rounded-lg transition-colors"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={cn(
                    "w-2 hover:w-3 bg-zinc-800/50 hover:bg-accent/20 cursor-col-resize transition-all flex-shrink-0 group relative flex items-center justify-center",
                    isResizing && "w-3 bg-accent/30"
                )}
            >
                <div className="absolute inset-y-0 -left-2 -right-2" />
                <GripVertical className={cn(
                    "w-4 h-4 text-zinc-600 group-hover:text-accent transition-colors",
                    isResizing && "text-accent"
                )} />
            </div>

            {/* Left Panel - Document Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Editor Toolbar */}
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 flex-shrink-0">
                    <div className="flex items-center gap-1 flex-wrap">
                        {editorMode === 'markdown' ? (
                            /* Markdown Toolbar */
                            <>
                                <button onClick={() => insertMarkdown('# ')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="제목">
                                    <Type className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('**', true)} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="굵게">
                                    <Bold className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('*', true)} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="기울임">
                                    <Italic className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('~~', true)} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="취소선">
                                    <Strikethrough className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={() => insertMarkdown('---\n')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="구분선">
                                    <Minus className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('> ')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="인용">
                                    <Quote className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={() => insertMarkdown('- ')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="목록">
                                    <List className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('1. ')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="번호 목록">
                                    <ListOrdered className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('- [ ] ')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="체크리스트">
                                    <CheckSquare className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={() => insertMarkdown('![이미지](url)')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="이미지">
                                    <Image className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('```\n코드\n```\n')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="코드 블록">
                                    <Code className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('[링크텍스트](url)')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="링크">
                                    <Link className="w-4 h-4" />
                                </button>
                                <button onClick={insertTable} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="테이블">
                                    <Table className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            /* Rich Text Toolbar */
                            <>
                                <button onClick={handleUndo} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="실행 취소">
                                    <Undo className="w-4 h-4" />
                                </button>
                                <button onClick={handleRedo} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="다시 실행">
                                    <Redo className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <select
                                    onChange={(e) => handleHeading(e.target.value)}
                                    className="bg-zinc-700 text-zinc-300 text-sm px-2 py-1 rounded cursor-pointer"
                                >
                                    <option value="Normal Text">본문</option>
                                    <option value="h1">제목 1</option>
                                    <option value="h2">제목 2</option>
                                    <option value="h3">제목 3</option>
                                </select>
                                <select
                                    onChange={(e) => handleFontSize(e.target.value)}
                                    className="bg-zinc-700 text-zinc-300 text-sm px-2 py-1 rounded ml-1 cursor-pointer"
                                >
                                    <option value="3">16px</option>
                                    <option value="1">12px</option>
                                    <option value="2">14px</option>
                                    <option value="4">18px</option>
                                    <option value="5">24px</option>
                                    <option value="6">32px</option>
                                    <option value="7">48px</option>
                                </select>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={handleBold} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="굵게">
                                    <Bold className="w-4 h-4" />
                                </button>
                                <button onClick={handleItalic} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="기울임">
                                    <Italic className="w-4 h-4" />
                                </button>
                                <button onClick={handleUnderline} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="밑줄">
                                    <Underline className="w-4 h-4" />
                                </button>
                                <button onClick={handleStrikethrough} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="취소선">
                                    <Strikethrough className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={handleAlignLeft} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="왼쪽 정렬">
                                    <AlignLeft className="w-4 h-4" />
                                </button>
                                <button onClick={handleAlignCenter} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="가운데 정렬">
                                    <AlignCenter className="w-4 h-4" />
                                </button>
                                <button onClick={handleAlignRight} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="오른쪽 정렬">
                                    <AlignRight className="w-4 h-4" />
                                </button>
                                <button onClick={handleAlignJustify} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="양쪽 정렬">
                                    <AlignJustify className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={handleInsertUnorderedList} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="글머리 기호">
                                    <List className="w-4 h-4" />
                                </button>
                                <button onClick={handleInsertOrderedList} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="번호 매기기">
                                    <ListOrdered className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button onClick={handleInsertLink} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="링크 삽입">
                                    <Link className="w-4 h-4" />
                                </button>
                                <button onClick={handleInsertImage} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="이미지 삽입">
                                    <Image className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => exportDocument('html')}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="HTML로 내보내기"
                        >
                            <ExternalLink className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button
                            onClick={() => exportDocument('md')}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Markdown으로 다운로드"
                        >
                            <Download className="w-4 h-4 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}>
                    {editorMode === 'markdown' ? (
                        <textarea
                            ref={textareaRef}
                            data-editor
                            value={documentContent}
                            onChange={(e) => setDocumentContent(e.target.value)}
                            placeholder="마크다운 내용을 입력하세요...

# 제목
## 소제목

**굵게** *기울임* ~~취소선~~

- 목록 항목
- 다른 항목

1. 번호 목록
2. 다른 항목

> 인용문

`인라인 코드`

```
코드 블록
```

[링크](url)
![이미지](url)"
                            className="w-full h-full p-8 text-gray-900 placeholder-gray-400 resize-none outline-none font-mono text-sm leading-relaxed"
                            style={{ backgroundColor: '#ffffff', color: '#111827', colorScheme: 'light' }}
                        />
                    ) : (
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            className="w-full h-full p-8 text-gray-900 outline-none overflow-y-auto prose prose-sm max-w-none"
                            style={{ backgroundColor: '#ffffff', color: '#111827', colorScheme: 'light' }}
                            onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
                            dangerouslySetInnerHTML={{
                                __html: documentContent || '<h1>문서 제목</h1><p>여기에 내용을 입력하세요...</p>'
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
