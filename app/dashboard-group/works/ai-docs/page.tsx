"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
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
    Heading1,
    Heading2,
    Heading3,
    Code,
    Quote,
    Minus,
    Users,
    UserPlus,
    Share2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
    role: 'user' | 'assistant' | 'system'
    content: string
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

    // Resizable panel
    const [leftPanelWidth, setLeftPanelWidth] = useState(480)
    const [isResizing, setIsResizing] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const editorRef = useRef<HTMLDivElement>(null)

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
                }
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `문서가 생성되었습니다.\n\n수정이 필요하시면 말씀해주세요:\n• "제목을 바꿔줘"\n• "내용을 더 추가해줘"\n• "형식을 바꿔줘"`
                }])
            } else {
                throw new Error('Failed to generate document')
            }
        } catch (error) {
            console.error('Document generation error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '문서 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
            }])
        }

        setIsLoading(false)
    }, [editorMode])

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
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '문서가 수정되었습니다.'
                }])
            }
        } catch (error) {
            console.error('Document edit error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '문서 수정 중 오류가 발생했습니다.'
            }])
        }

        setIsLoading(false)
    }, [documentContent, editorMode])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])

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
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '어떤 문서를 작성해드릴까요?\n\n예시:\n• "사업계획서 작성해줘"\n• "마케팅 제안서 만들어줘"\n• "회의록 양식 만들어줘"'
            }])
        }
    }

    // Copy document content
    const copyContent = () => {
        navigator.clipboard.writeText(documentContent)
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
            // Convert markdown to HTML (simple conversion)
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>${documentTitle}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        h1, h2, h3 { margin-top: 24px; }
        p { line-height: 1.6; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
        pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
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

    // Editor toolbar actions
    const insertMarkdown = (syntax: string, wrap?: boolean) => {
        const textarea = document.querySelector('textarea[data-editor]') as HTMLTextAreaElement
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selected = documentContent.substring(start, end)

        let newContent: string
        if (wrap && selected) {
            newContent = documentContent.substring(0, start) + syntax + selected + syntax + documentContent.substring(end)
        } else {
            newContent = documentContent.substring(0, start) + syntax + documentContent.substring(end)
        }

        setDocumentContent(newContent)
    }

    return (
        <div ref={containerRef} className="h-full flex bg-zinc-950 overflow-hidden">
            {/* Left Panel - Chat */}
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
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                                    >
                                        <Copy className="w-4 h-4" />
                                        복사
                                    </button>
                                    <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                                        <ThumbsUp className="w-4 h-4 text-zinc-500" />
                                    </button>
                                    <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                                        <ThumbsDown className="w-4 h-4 text-zinc-500" />
                                    </button>
                                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
                                        <span className="font-bold">N</span>
                                        Notion에 저장
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
                                        <div className={cn(
                                            "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                                            msg.role === 'user'
                                                ? "bg-accent text-white"
                                                : "bg-zinc-800 text-zinc-200"
                                        )}>
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
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
                                placeholder={chatTab === 'ai' ? "여기에 문서 요청을 입력하세요..." : "Chat with your team members here"}
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
                                <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Upload className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Mic className="w-5 h-5 text-zinc-500" />
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

            {/* Right Panel - Document Editor */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Editor Toolbar - Fixed at top */}
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 flex-shrink-0">
                    <div className="flex items-center gap-1">
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
                                <button onClick={() => insertMarkdown('![]()')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="이미지">
                                    <Image className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('```\n\n```')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="코드 블록">
                                    <Code className="w-4 h-4" />
                                </button>
                                <button onClick={() => insertMarkdown('[]()')} className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="링크">
                                    <Link className="w-4 h-4" />
                                </button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="테이블">
                                    <Table className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            /* Rich Text Toolbar */
                            <>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="실행 취소">
                                    <Undo className="w-4 h-4" />
                                </button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white" title="다시 실행">
                                    <Redo className="w-4 h-4" />
                                </button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <select className="bg-zinc-700 text-zinc-300 text-sm px-2 py-1 rounded">
                                    <option>Normal Text</option>
                                    <option>Heading 1</option>
                                    <option>Heading 2</option>
                                    <option>Heading 3</option>
                                </select>
                                <select className="bg-zinc-700 text-zinc-300 text-sm px-2 py-1 rounded ml-1">
                                    <option>Apple SD Gothic</option>
                                </select>
                                <input type="number" defaultValue={16} className="bg-zinc-700 text-zinc-300 text-sm w-12 px-2 py-1 rounded ml-1" />
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><Bold className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><Italic className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><Underline className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><Strikethrough className="w-4 h-4" /></button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><AlignLeft className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><AlignCenter className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><AlignRight className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><AlignJustify className="w-4 h-4" /></button>
                                <div className="w-px h-6 bg-zinc-600 mx-1" />
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><List className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><ListOrdered className="w-4 h-4" /></button>
                                <button className="p-2 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"><CheckSquare className="w-4 h-4" /></button>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => exportDocument('html')}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="새 창에서 열기"
                        >
                            <ExternalLink className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button
                            onClick={() => exportDocument('md')}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="다운로드"
                        >
                            <Download className="w-4 h-4 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Editor Content - Full height white background */}
                <div className="flex-1 overflow-hidden" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}>
                    {editorMode === 'markdown' ? (
                        <textarea
                            data-editor
                            value={documentContent}
                            onChange={(e) => setDocumentContent(e.target.value)}
                            placeholder="마크다운 내용을 입력하세요..."
                            className="w-full h-full p-8 text-gray-900 placeholder-gray-400 resize-none outline-none font-mono text-sm leading-relaxed"
                            style={{ backgroundColor: '#ffffff', color: '#111827', colorScheme: 'light' }}
                        />
                    ) : (
                        <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            className="w-full h-full p-8 text-gray-900 outline-none overflow-y-auto"
                            style={{ backgroundColor: '#ffffff', color: '#111827', colorScheme: 'light' }}
                            onInput={(e) => setDocumentContent(e.currentTarget.innerHTML)}
                            dangerouslySetInnerHTML={{ __html: documentContent || '<h1>문서 제목</h1><p>여기에 내용을 입력하세요...</p>' }}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
