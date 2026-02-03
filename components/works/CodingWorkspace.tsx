'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft,
    Play,
    RotateCcw,
    Download,
    Share2,
    ChevronRight,
    ChevronDown,
    File,
    Folder,
    FolderOpen,
    Plus,
    X,
    Send,
    Code2,
    Eye,
    Loader2,
    MessageSquare,
    PanelLeftClose,
    PanelLeft,
    Paperclip,
    FileUp,
    GripVertical,
    Bot,
    Sparkles,
    Wifi,
    WifiOff,
    MessageCircle,
    Copy,
    Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore, accentColors } from '@/stores/themeStore'
import Editor from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
// Claude Bridge 연동 (선택적 - 코드 도우미용)
// 왼쪽 AI 채팅: 코드 생성 (Planner → Coder → Reviewer → Fixer)
// 오른쪽 Claude 탭: 코드 분석/설명 (Claude CLI를 통한 빠른 Q&A)
import {
    initMonacoClaudePlugin,
    injectClaudeStyles,
    useClaudeBridgeStatus,
    type MonacoClaudePlugin,
    type StreamChunk,
    type ClaudeActionType
} from '@/lib/claude-bridge'

// 파일 타입 정의
interface FileNode {
    id: string
    name: string
    type: 'file' | 'folder'
    content?: string
    language?: string
    children?: FileNode[]
    isOpen?: boolean
}

// 프로젝트 타입별 환영 메시지
const getWelcomeMessage = (projectType: string): string => {
    const messages: Record<string, string> = {
        'simple-web': '어떤 웹사이트를 만들어볼까요?',
        'fullstack': '어떤 풀스택 앱을 만들어볼까요?',
        'native-app': '어떤 모바일 앱을 만들어볼까요?',
        'github-project': 'GitHub 저장소 URL을 입력해주세요.',
        'high-performance': '어떤 고성능 작업을 하시겠어요?',
        'ssh-server': 'SSH 서버 연결 정보를 입력해주세요.',
        'ai-suggest': '무엇을 만들고 싶은지 설명해주세요.'
    }
    return messages[projectType] || '무엇을 만들어볼까요?'
}

interface CodingWorkspaceProps {
    onBack: () => void
    projectType: string
    projectTitle: string
}

export function CodingWorkspace({ onBack, projectType, projectTitle }: CodingWorkspaceProps) {
    // 테마 색상
    const { accentColor } = useThemeStore()
    const themeColorData = accentColors.find(c => c.id === accentColor)
    const themeColor = themeColorData?.color || '#3b82f6'

    // 파일 시스템 상태
    const [files, setFiles] = useState<FileNode[]>([])
    const [activeFile, setActiveFile] = useState<FileNode | null>(null)
    const [openTabs, setOpenTabs] = useState<FileNode[]>([])

    // 에디터 상태
    const [code, setCode] = useState('')
    const [previewKey, setPreviewKey] = useState(0)

    // UI 상태
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [rightPanelTab, setRightPanelTab] = useState<'code' | 'preview' | 'claude'>('code')
    const [chatPanelWidth, setChatPanelWidth] = useState(380)
    const [sidebarWidth, setSidebarWidth] = useState(200)
    const [isResizing, setIsResizing] = useState(false)
    const [isResizingSidebar, setIsResizingSidebar] = useState(false)

    // AI 채팅 상태
    const [chatInput, setChatInput] = useState('')
    const [isAiLoading, setIsAiLoading] = useState(false)
    const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', content: string}>>([])
    const [pastedImages, setPastedImages] = useState<Array<{id: string, dataUrl: string, file: File}>>([])
    const [attachedFiles, setAttachedFiles] = useState<Array<{id: string, name: string, size: number, file: File}>>([])
    const [streamingText, setStreamingText] = useState('') // 스트리밍 중인 AI 응답 텍스트
    const [currentPhase, setCurrentPhase] = useState<string>('') // 현재 에이전트 단계
    const [agentSteps, setAgentSteps] = useState<Array<{
        id: string
        agent: 'planner' | 'coder' | 'reviewer' | 'fixer'
        status: 'pending' | 'running' | 'done' | 'error'
        title: string
        content: string
        icon: string
        color: string
    }>>([])

    const welcomeMessage = getWelcomeMessage(projectType)

    const iframeRef = useRef<HTMLIFrameElement>(null)
    const editorRef = useRef<any>(null)
    const chatContainerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const resizeRef = useRef<HTMLDivElement>(null)
    const sidebarResizeRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const startXRef = useRef<number>(0)
    const startWidthRef = useRef<number>(380)
    const startSidebarWidthRef = useRef<number>(200)

    // Claude Bridge 상태
    const claudePluginRef = useRef<MonacoClaudePlugin | null>(null)
    const monacoRef = useRef<Monaco | null>(null)
    const [claudeResponse, setClaudeResponse] = useState<string>('')
    const [claudeLoading, setClaudeLoading] = useState(false)
    const [claudePanelOpen, setClaudePanelOpen] = useState(false)
    const [claudeActionType, setClaudeActionType] = useState<ClaudeActionType | null>(null)
    const [copiedCode, setCopiedCode] = useState(false)

    // Claude Bridge 연결 상태 (훅 사용)
    const {
        connected: claudeConnected,
        checking: claudeChecking,
        version: claudeVersion,
        recheck: recheckClaude
    } = useClaudeBridgeStatus('http://localhost:3333', true, 30000) // 30초마다 자동 재확인

    // Claude CSS 스타일 주입 (한 번만)
    useEffect(() => {
        injectClaudeStyles()
    }, [])

    // Claude 플러그인 정리 (컴포넌트 언마운트 시)
    useEffect(() => {
        return () => {
            if (claudePluginRef.current) {
                claudePluginRef.current.dispose()
                claudePluginRef.current = null
            }
        }
    }, [])

    // 채팅 패널 리사이즈 핸들러
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startXRef.current = e.clientX
        startWidthRef.current = chatPanelWidth
        setIsResizing(true)
    }, [chatPanelWidth])

    // 사이드바 리사이즈 핸들러
    const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        startXRef.current = e.clientX
        startSidebarWidthRef.current = sidebarWidth
        setIsResizingSidebar(true)
    }, [sidebarWidth])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing && !isResizingSidebar) return
            e.preventDefault()
            const delta = e.clientX - startXRef.current

            if (isResizing) {
                const newWidth = startWidthRef.current + delta
                if (newWidth >= 280 && newWidth <= 600) {
                    setChatPanelWidth(newWidth)
                }
            }

            if (isResizingSidebar) {
                const newWidth = startSidebarWidthRef.current + delta
                if (newWidth >= 120 && newWidth <= 400) {
                    setSidebarWidth(newWidth)
                }
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            setIsResizingSidebar(false)
        }

        if (isResizing || isResizingSidebar) {
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
    }, [isResizing, isResizingSidebar])

    // 파일이 생성되면 첫 번째 파일 선택
    useEffect(() => {
        if (files.length > 0 && !activeFile) {
            const findFirstFile = (nodes: FileNode[]): FileNode | null => {
                for (const node of nodes) {
                    if (node.type === 'file') return node
                    if (node.children) {
                        const found = findFirstFile(node.children)
                        if (found) return found
                    }
                }
                return null
            }
            const firstFile = findFirstFile(files)
            if (firstFile) {
                setActiveFile(firstFile)
                setOpenTabs([firstFile])
                setCode(firstFile.content || '')
            }
        }
    }, [files, activeFile])

    // 채팅 스크롤
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
        }
    }, [chatMessages])

    // 코드 변경
    const handleCodeChange = useCallback((value: string | undefined) => {
        if (!activeFile || !value) return
        setCode(value)

        setFiles(prev => {
            const updateFileContent = (nodes: FileNode[]): FileNode[] => {
                return nodes.map(node => {
                    if (node.id === activeFile.id) {
                        return { ...node, content: value }
                    }
                    if (node.children) {
                        return { ...node, children: updateFileContent(node.children) }
                    }
                    return node
                })
            }
            return updateFileContent(prev)
        })
    }, [activeFile])

    // 미리보기 생성
    const generatePreview = useCallback(() => {
        // HTML 파일 찾기 (index.html 또는 .html로 끝나는 파일)
        const htmlFile = files.find(f => f.name === 'index.html') ||
                         files.find(f => f.name.endsWith('.html'))

        // CSS 파일들 찾기
        const cssFiles = files.filter(f => f.name.endsWith('.css'))

        // JS 파일들 찾기
        const jsFiles = files.filter(f => f.name.endsWith('.js'))

        if (!htmlFile?.content) {
            // HTML 파일이 없으면 단일 파일 미리보기 시도
            const singleHtml = files.find(f => f.content?.includes('<!DOCTYPE') || f.content?.includes('<html'))
            if (singleHtml?.content) return singleHtml.content

            return ''
        }

        let html = htmlFile.content

        // CSS 파일 인라인 삽입
        cssFiles.forEach(cssFile => {
            if (cssFile.content) {
                // link 태그 교체 시도
                const linkRegex = new RegExp(`<link[^>]*href=["']${cssFile.name}["'][^>]*>`, 'gi')
                if (linkRegex.test(html)) {
                    html = html.replace(linkRegex, `<style>${cssFile.content}</style>`)
                } else if (!html.includes(cssFile.content)) {
                    // link 태그가 없으면 head에 삽입
                    html = html.replace('</head>', `<style>${cssFile.content}</style></head>`)
                }
            }
        })

        // JS 파일 인라인 삽입
        jsFiles.forEach(jsFile => {
            if (jsFile.content) {
                // script 태그 교체 시도
                const scriptRegex = new RegExp(`<script[^>]*src=["']${jsFile.name}["'][^>]*></script>`, 'gi')
                if (scriptRegex.test(html)) {
                    html = html.replace(scriptRegex, `<script>${jsFile.content}</script>`)
                } else if (!html.includes(jsFile.content)) {
                    // script 태그가 없으면 body 끝에 삽입
                    html = html.replace('</body>', `<script>${jsFile.content}</script></body>`)
                }
            }
        })

        return html
    }, [files])

    // 실행
    const handleRun = useCallback(() => {
        setPreviewKey(prev => prev + 1)
        setRightPanelTab('preview')
    }, [])

    // 파일 선택
    const handleFileSelect = useCallback((file: FileNode) => {
        if (file.type === 'folder') {
            setFiles(prev => {
                const toggleFolder = (nodes: FileNode[]): FileNode[] => {
                    return nodes.map(node => {
                        if (node.id === file.id) {
                            return { ...node, isOpen: !node.isOpen }
                        }
                        if (node.children) {
                            return { ...node, children: toggleFolder(node.children) }
                        }
                        return node
                    })
                }
                return toggleFolder(prev)
            })
        } else {
            setActiveFile(file)
            setCode(file.content || '')
            setOpenTabs(prev => {
                if (!prev.find(t => t.id === file.id)) {
                    return [...prev, file]
                }
                return prev
            })
        }
    }, [])

    // 탭 닫기
    const handleCloseTab = useCallback((file: FileNode, e: React.MouseEvent) => {
        e.stopPropagation()
        setOpenTabs(prev => {
            const newTabs = prev.filter(t => t.id !== file.id)
            if (activeFile?.id === file.id && newTabs.length > 0) {
                const lastTab = newTabs[newTabs.length - 1]
                setActiveFile(lastTab)
                setCode(lastTab.content || '')
            }
            return newTabs
        })
    }, [activeFile])

    // 이미지 붙여넣기
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (file) {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                        const dataUrl = event.target?.result as string
                        setPastedImages(prev => [...prev, {
                            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            dataUrl,
                            file
                        }])
                    }
                    reader.readAsDataURL(file)
                }
            }
        }
    }, [])

    // 이미지 제거
    const handleRemoveImage = useCallback((id: string) => {
        setPastedImages(prev => prev.filter(img => img.id !== id))
    }, [])

    // 파일 첨부 핸들러
    const handleFileAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader()
                reader.onload = (event) => {
                    const dataUrl = event.target?.result as string
                    setPastedImages(prev => [...prev, {
                        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        dataUrl,
                        file
                    }])
                }
                reader.readAsDataURL(file)
            } else {
                setAttachedFiles(prev => [...prev, {
                    id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    size: file.size,
                    file
                }])
            }
        })

        // 입력 초기화
        e.target.value = ''
    }, [])

    // 파일 제거
    const handleRemoveFile = useCallback((id: string) => {
        setAttachedFiles(prev => prev.filter(f => f.id !== id))
    }, [])

    // 파일 크기 포맷
    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // 코드 블록 파싱 함수
    const parseCodeBlocks = useCallback((content: string) => {
        const files: { name: string; content: string; language: string }[] = []
        // 패턴: ```html:index.html 또는 ```javascript:script.js
        const codeBlockRegex = /```(\w+):([^\s\n]+)\n([\s\S]*?)```/g
        let match

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const language = match[1] || 'plaintext'
            const filename = match[2] || ''
            const code = match[3]?.trim() || ''

            if (filename && code) {
                // 언어 매핑
                const langMap: Record<string, string> = {
                    'html': 'html',
                    'css': 'css',
                    'javascript': 'javascript',
                    'js': 'javascript',
                    'typescript': 'typescript',
                    'ts': 'typescript',
                    'json': 'json',
                    'python': 'python',
                    'py': 'python'
                }
                files.push({
                    name: filename,
                    content: code,
                    language: langMap[language.toLowerCase()] || language
                })
            }
        }

        return files
    }, [])

    // AI 메시지 전송 및 코드 생성 (스트리밍)
    const handleSendMessage = useCallback(async () => {
        const message = chatInput.trim()
        const images = [...pastedImages]
        const attachedFilesList = [...attachedFiles]

        if ((!message && images.length === 0 && attachedFilesList.length === 0) || isAiLoading) return

        // 즉시 입력 초기화
        setChatInput('')
        setPastedImages([])
        setAttachedFiles([])

        // 첨부 내용 표시
        let attachmentInfo = ''
        if (images.length > 0) attachmentInfo += ` [이미지 ${images.length}개]`
        if (attachedFilesList.length > 0) attachmentInfo += ` [파일 ${attachedFilesList.length}개: ${attachedFilesList.map(f => f.name).join(', ')}]`

        const messageContent = message + attachmentInfo
        setChatMessages(prev => [...prev, { role: 'user', content: messageContent }])
        setIsAiLoading(true)
        setStreamingText('') // 스트리밍 텍스트 초기화

        // 에이전트 스텝 초기화 - Genspark 스타일
        setAgentSteps([
            { id: 'planner', agent: 'planner', status: 'pending', title: 'Planner Agent', content: '요구사항 분석 대기 중...', icon: '📋', color: 'purple' },
            { id: 'coder', agent: 'coder', status: 'pending', title: 'Coder Agent', content: '코드 작성 대기 중...', icon: '🛠️', color: 'cyan' },
            { id: 'reviewer', agent: 'reviewer', status: 'pending', title: 'Reviewer Agent', content: '코드 리뷰 대기 중...', icon: '🔍', color: 'yellow' },
            { id: 'fixer', agent: 'fixer', status: 'pending', title: 'Fixer Agent', content: '수정 대기 중...', icon: '🔧', color: 'orange' },
        ])

        // 코드 탭으로 전환 및 스트리밍 코드 표시 준비
        setRightPanelTab('code')
        setCode('')

        let fullResponse = ''
        let plannerContent = ''
        let coderContent = ''
        let reviewerContent = ''
        let fixerContent = ''

        try {
            // AI API 호출 (스트리밍)
            const response = await fetch('/api/coding/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    projectType,
                    currentFiles: files,
                    images: images.map(img => img.dataUrl)
                })
            })

            if (!response.ok) throw new Error('API 호출 실패')

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) throw new Error('스트림 읽기 실패')

            // 스트리밍 읽기 (멀티 에이전트 지원)
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const parsed = JSON.parse(data)

                            // 에이전트 단계 업데이트
                            if (parsed.phase) {
                                setCurrentPhase(parsed.phase)

                                // Genspark 스타일 에이전트 스텝 상태 업데이트
                                if (parsed.phase === 'planning') {
                                    plannerContent = ''
                                    setAgentSteps(prev => prev.map(s =>
                                        s.agent === 'planner' ? { ...s, status: 'running', content: '요구사항 분석 중...' } : s
                                    ))
                                } else if (parsed.phase === 'coding') {
                                    coderContent = ''
                                    setAgentSteps(prev => prev.map(s => {
                                        if (s.agent === 'planner') return { ...s, status: 'done', content: plannerContent || '분석 완료' }
                                        if (s.agent === 'coder') return { ...s, status: 'running', content: '코드 작성 중...' }
                                        return s
                                    }))
                                } else if (parsed.phase === 'reviewing') {
                                    reviewerContent = ''
                                    setAgentSteps(prev => prev.map(s => {
                                        if (s.agent === 'coder') return { ...s, status: 'done', content: '코드 작성 완료' }
                                        if (s.agent === 'reviewer') return { ...s, status: 'running', content: '코드 검토 중...' }
                                        return s
                                    }))
                                } else if (parsed.phase === 'fixing') {
                                    fixerContent = ''
                                    setAgentSteps(prev => prev.map(s => {
                                        if (s.agent === 'reviewer') return { ...s, status: 'done', content: reviewerContent || '리뷰 완료' }
                                        if (s.agent === 'fixer') return { ...s, status: 'running', content: '이슈 수정 중...' }
                                        return s
                                    }))
                                } else if (parsed.phase === 'complete') {
                                    setAgentSteps(prev => prev.map(s => {
                                        if (s.status === 'running') return { ...s, status: 'done', content: '완료' }
                                        return s
                                    }))
                                } else if (parsed.phase === 'review_issues') {
                                    setAgentSteps(prev => prev.map(s =>
                                        s.agent === 'reviewer' ? { ...s, content: '⚠️ 이슈 발견' } : s
                                    ))
                                }
                            }

                            if (parsed.content) {
                                fullResponse += parsed.content

                                // 단계별 콘텐츠 수집 및 UI 업데이트
                                if (parsed.phase === 'planning') {
                                    plannerContent += parsed.content
                                    // Planner 스텝 콘텐츠 업데이트
                                    setAgentSteps(prev => prev.map(s =>
                                        s.agent === 'planner' ? { ...s, content: plannerContent.slice(0, 200) + (plannerContent.length > 200 ? '...' : '') } : s
                                    ))
                                    setStreamingText(fullResponse)
                                } else if (parsed.phase === 'coding') {
                                    coderContent += parsed.content
                                    // 코딩 단계: 코드 에디터에 실시간 표시
                                    const codeStartIndex = fullResponse.indexOf('```')
                                    if (codeStartIndex !== -1) {
                                        const afterCodeStart = fullResponse.slice(codeStartIndex)
                                        const firstNewline = afterCodeStart.indexOf('\n')
                                        if (firstNewline !== -1) {
                                            let codeContent = afterCodeStart.slice(firstNewline + 1)
                                            const closingIndex = codeContent.lastIndexOf('```')
                                            if (closingIndex !== -1) {
                                                codeContent = codeContent.slice(0, closingIndex)
                                            }
                                            setCode(codeContent)
                                        }
                                    }
                                    // 채팅창에는 코드 블록 제외하고 표시
                                    const displayText = fullResponse.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*/g, '').trim()
                                    setStreamingText(displayText || '🛠️ 코드 작성 중...')
                                } else if (parsed.phase === 'fixing') {
                                    // 수정 단계: 코드 에디터에 실시간 표시
                                    const codeStartIndex = fullResponse.indexOf('```')
                                    if (codeStartIndex !== -1) {
                                        const afterCodeStart = fullResponse.slice(codeStartIndex)
                                        const firstNewline = afterCodeStart.indexOf('\n')
                                        if (firstNewline !== -1) {
                                            let codeContent = afterCodeStart.slice(firstNewline + 1)
                                            const closingIndex = codeContent.lastIndexOf('```')
                                            if (closingIndex !== -1) {
                                                codeContent = codeContent.slice(0, closingIndex)
                                            }
                                            setCode(codeContent)
                                        }
                                    }
                                    const displayText = fullResponse.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*/g, '').trim()
                                    setStreamingText(displayText || '🔧 코드 수정 중...')
                                } else if (parsed.phase === 'reviewing' || parsed.phase === 'complete' || parsed.phase === 'review_issues') {
                                    // 리뷰 단계: 채팅창에 표시
                                    const displayText = fullResponse.replace(/```[\s\S]*?```/g, '').replace(/```[\s\S]*/g, '').trim()
                                    setStreamingText(displayText)
                                } else if (parsed.phase === 'error') {
                                    setStreamingText('❌ 오류가 발생했습니다: ' + parsed.content)
                                }
                            }
                        } catch {
                            // JSON 파싱 오류 무시
                        }
                    }
                }
            }

            // 스트리밍 완료 후 파일 파싱
            const parsedFiles = parseCodeBlocks(fullResponse)

            // AI 응답 메시지 (코드 블록 제외)
            const cleanMessage = fullResponse
                .replace(/```[\s\S]*?```/g, '')
                .trim() || `${parsedFiles.length}개의 파일을 생성했습니다`

            setChatMessages(prev => [...prev, { role: 'ai', content: cleanMessage }])

            // 파일 추가
            if (parsedFiles.length > 0) {
                const newFiles: FileNode[] = parsedFiles.map((file) => ({
                    id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    type: 'file' as const,
                    content: file.content,
                    language: file.language
                }))

                setFiles(prev => {
                    // 같은 이름의 파일이 있으면 업데이트, 없으면 추가
                    const updatedFiles = [...prev]
                    newFiles.forEach(newFile => {
                        const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name)
                        if (existingIndex >= 0) {
                            updatedFiles[existingIndex] = newFile
                        } else {
                            updatedFiles.push(newFile)
                        }
                    })
                    return updatedFiles
                })

                // 첫 번째 파일 선택
                const firstFile = newFiles[0]
                setActiveFile(firstFile)
                setOpenTabs(prev => {
                    const filtered = prev.filter(t => !newFiles.some(nf => nf.name === t.name))
                    return [...filtered, ...newFiles]
                })
                setCode(firstFile.content || '')
            }
        } catch (error) {
            console.error('AI error:', error)
            setChatMessages(prev => [...prev, {
                role: 'ai',
                content: '코드 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
            }])
        } finally {
            setIsAiLoading(false)
            setStreamingText('') // 스트리밍 완료 후 초기화
            setCurrentPhase('') // 에이전트 단계 초기화
        }
    }, [chatInput, pastedImages, attachedFiles, isAiLoading, projectType, files, parseCodeBlocks])

    // 파일 확장자별 아이콘 색상
    const getFileIconColor = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'ts':
            case 'tsx':
                return 'text-blue-400'
            case 'js':
            case 'jsx':
                return 'text-yellow-400'
            case 'css':
            case 'scss':
                return 'text-pink-400'
            case 'html':
                return 'text-orange-400'
            case 'json':
                return 'text-yellow-500'
            case 'md':
                return 'text-zinc-400'
            case 'py':
                return 'text-green-400'
            default:
                return 'text-zinc-500'
        }
    }

    // 파일 트리 렌더링 - VS Code 스타일
    const renderFileTree = useCallback((nodes: FileNode[], depth = 0) => {
        return nodes.map(node => (
            <div key={node.id}>
                <button
                    onClick={() => handleFileSelect(node)}
                    className={cn(
                        "w-full flex items-center h-[22px] text-[13px] transition-colors",
                        "hover:bg-zinc-700/50",
                        activeFile?.id === node.id && "bg-zinc-600/60"
                    )}
                    style={{ paddingLeft: `${depth * 8 + 4}px` }}
                >
                    {node.type === 'folder' ? (
                        <>
                            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                {node.isOpen ? (
                                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                                ) : (
                                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                                )}
                            </span>
                            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1">
                                {node.isOpen ? (
                                    <FolderOpen className="w-4 h-4 text-yellow-500" />
                                ) : (
                                    <Folder className="w-4 h-4 text-yellow-500" />
                                )}
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="w-4 h-4 flex-shrink-0" />
                            <span className={cn("w-4 h-4 flex items-center justify-center flex-shrink-0 mr-1", getFileIconColor(node.name))}>
                                <File className="w-4 h-4" />
                            </span>
                        </>
                    )}
                    <span className={cn(
                        "truncate",
                        activeFile?.id === node.id ? "text-white" : "text-zinc-300"
                    )}>{node.name}</span>
                </button>
                {node.type === 'folder' && node.isOpen && node.children && (
                    renderFileTree(node.children, depth + 1)
                )}
            </div>
        ))
    }, [activeFile, handleFileSelect])

    return (
        <div className="h-full flex flex-col bg-zinc-950">
            {/* 상단 툴바 */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-400" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Code2 className="w-5 h-5 text-cyan-400" />
                        <span className="font-medium text-zinc-200">{projectTitle}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRun}
                        className="flex items-center gap-2 px-3 py-1.5 text-white rounded-md transition-colors hover:opacity-90"
                        style={{ backgroundColor: themeColor }}
                    >
                        <Play className="w-4 h-4" />
                        실행
                    </button>
                    <button className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors">
                        <RotateCcw className="w-5 h-5 text-zinc-400" />
                    </button>
                    <button className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors">
                        <Download className="w-5 h-5 text-zinc-400" />
                    </button>
                    <button className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors">
                        <Share2 className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* 메인 영역: 왼쪽 채팅 + 오른쪽 뷰어 */}
            <div className="flex-1 flex overflow-hidden">
                {/* 왼쪽: AI 채팅 */}
                <div
                    className="flex flex-col bg-zinc-900 flex-shrink-0 relative"
                    style={{ width: chatPanelWidth }}
                >
                    {/* 채팅 헤더 */}
                    <div className="h-10 flex items-center px-4 border-b border-zinc-800">
                        <span className="text-sm font-medium text-zinc-300">AI 채팅</span>
                    </div>

                    {/* 채팅 메시지 영역 */}
                    <div
                        ref={chatContainerRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4"
                    >
                        {/* 환영 메시지 */}
                        {chatMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <h3 className="text-base font-semibold text-zinc-200 mb-2">
                                    {projectTitle}
                                </h3>
                                <p className="text-sm text-zinc-400 mb-4">
                                    {welcomeMessage}
                                </p>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <button
                                        onClick={() => setChatInput('간단한 웹페이지 만들어줘')}
                                        className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-colors"
                                    >
                                        웹페이지
                                    </button>
                                    <button
                                        onClick={() => setChatInput('Todo 앱 만들어줘')}
                                        className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-colors"
                                    >
                                        Todo 앱
                                    </button>
                                    <button
                                        onClick={() => setChatInput('계산기 만들어줘')}
                                        className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition-colors"
                                    >
                                        계산기
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 채팅 메시지 */}
                        {chatMessages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex gap-3",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                {msg.role === 'ai' && (
                                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-zinc-300" />
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        "max-w-[85%] px-3 py-2 rounded-2xl text-sm",
                                        msg.role === 'user'
                                            ? "bg-blue-600 text-white rounded-br-md"
                                            : "bg-zinc-800 text-zinc-200 rounded-bl-md"
                                    )}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {/* 🎯 Genspark 스타일 멀티 에이전트 UI */}
                        {isAiLoading && agentSteps.length > 0 && (
                            <div className="space-y-3">
                                {/* 에이전트 파이프라인 카드 */}
                                <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/50 rounded-2xl border border-white/10 p-4 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                            <Bot className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        <span className="text-sm font-semibold text-white">AI 에이전트 파이프라인</span>
                                        <div className="ml-auto flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] text-zinc-500">진행 중</span>
                                        </div>
                                    </div>

                                    {/* 에이전트 스텝 리스트 */}
                                    <div className="space-y-2">
                                        {agentSteps.map((step, idx) => (
                                            <motion.div
                                                key={step.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className={cn(
                                                    "relative flex items-start gap-3 p-3 rounded-xl transition-all duration-300",
                                                    step.status === 'running' && "bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/30",
                                                    step.status === 'done' && "bg-white/5 border border-white/5",
                                                    step.status === 'pending' && "bg-transparent border border-transparent opacity-50",
                                                    step.status === 'error' && "bg-red-500/10 border border-red-500/30"
                                                )}
                                            >
                                                {/* 스텝 아이콘 */}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all",
                                                    step.status === 'running' && "bg-gradient-to-br from-cyan-500/30 to-blue-600/30 shadow-lg shadow-cyan-500/20",
                                                    step.status === 'done' && "bg-gradient-to-br from-green-500/20 to-emerald-600/20",
                                                    step.status === 'pending' && "bg-zinc-800/50",
                                                    step.status === 'error' && "bg-red-500/20"
                                                )}>
                                                    {step.status === 'running' ? (
                                                        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                                                    ) : step.status === 'done' ? (
                                                        <span className="text-green-400">✓</span>
                                                    ) : step.status === 'error' ? (
                                                        <span>❌</span>
                                                    ) : (
                                                        <span className="opacity-50">{step.icon}</span>
                                                    )}
                                                </div>

                                                {/* 스텝 정보 */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-sm font-medium",
                                                            step.status === 'running' && "text-cyan-300",
                                                            step.status === 'done' && "text-green-300",
                                                            step.status === 'pending' && "text-zinc-500",
                                                            step.status === 'error' && "text-red-300"
                                                        )}>
                                                            {step.icon} {step.title}
                                                        </span>
                                                        {step.status === 'running' && (
                                                            <span className="px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 rounded-full">
                                                                실행 중
                                                            </span>
                                                        )}
                                                        {step.status === 'done' && (
                                                            <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-300 rounded-full">
                                                                완료
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={cn(
                                                        "text-xs mt-1 line-clamp-2",
                                                        step.status === 'running' && "text-zinc-300",
                                                        step.status === 'done' && "text-zinc-400",
                                                        step.status === 'pending' && "text-zinc-600",
                                                        step.status === 'error' && "text-red-300"
                                                    )}>
                                                        {step.content}
                                                    </p>
                                                </div>

                                                {/* 연결선 (마지막 제외) */}
                                                {idx < agentSteps.length - 1 && (
                                                    <div className={cn(
                                                        "absolute left-7 top-14 w-0.5 h-4",
                                                        step.status === 'done' ? "bg-gradient-to-b from-green-500/50 to-transparent" : "bg-zinc-700/30"
                                                    )} />
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 입력창 */}
                    <div className="p-3 border-t border-zinc-800 bg-zinc-900/50">
                        {/* 첨부된 파일/이미지 미리보기 */}
                        {(pastedImages.length > 0 || attachedFiles.length > 0) && (
                            <div className="flex gap-2 mb-3 flex-wrap">
                                {pastedImages.map((img) => (
                                    <div key={img.id} className="relative group">
                                        <img
                                            src={img.dataUrl}
                                            alt="첨부 이미지"
                                            className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                                        />
                                        <button
                                            onClick={() => handleRemoveImage(img.id)}
                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-lg"
                                        >
                                            <X className="w-3 h-3 text-white" />
                                        </button>
                                    </div>
                                ))}
                                {attachedFiles.map((file) => (
                                    <div key={file.id} className="relative group flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg border border-zinc-700">
                                        <FileUp className="w-4 h-4 text-zinc-400" />
                                        <div className="flex flex-col">
                                            <span className="text-xs text-zinc-300 max-w-[100px] truncate">{file.name}</span>
                                            <span className="text-[10px] text-zinc-500">{formatFileSize(file.size)}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFile(file.id)}
                                            className="ml-1 p-0.5 hover:bg-zinc-700 rounded"
                                        >
                                            <X className="w-3 h-3 text-zinc-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 메인 입력 영역 */}
                        <div className="bg-zinc-800/80 rounded-xl border border-zinc-700/50 focus-within:border-cyan-500/50 transition-colors">
                            <div className="flex items-center gap-2 px-3 py-2">
                                {/* 파일 첨부 버튼 */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={handleFileAttach}
                                    accept="*/*"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 hover:bg-zinc-700 rounded-lg transition-colors"
                                    title="파일 첨부"
                                >
                                    <Paperclip className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
                                </button>

                                {/* 텍스트 입력 */}
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                            e.preventDefault()
                                            handleSendMessage()
                                        }
                                    }}
                                    onPaste={handlePaste}
                                    placeholder="무엇을 만들어 드릴까요?"
                                    className="flex-1 bg-transparent text-zinc-200 placeholder-zinc-500 text-sm outline-none"
                                />

                                {/* 전송 버튼 */}
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isAiLoading || (!chatInput.trim() && pastedImages.length === 0 && attachedFiles.length === 0)}
                                    className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        (chatInput.trim() || pastedImages.length > 0 || attachedFiles.length > 0)
                                            ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                                            : "text-zinc-500"
                                    )}
                                >
                                    {isAiLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* 리사이즈 핸들 - 채팅/코드 경계 */}
                <div
                    ref={resizeRef}
                    onMouseDown={handleMouseDown}
                    className={cn(
                        "flex-shrink-0 cursor-col-resize transition-all relative z-50 group select-none",
                        isResizing ? "bg-cyan-500" : "bg-zinc-700 hover:bg-cyan-500/70"
                    )}
                    style={{ touchAction: 'none', width: 4 }}
                />

                {/* 오른쪽: 파일 트리 + 코드/미리보기 */}
                <div className="flex-1 flex overflow-hidden">
                    {/* 파일 사이드바 - 애니메이션 제거로 빠른 리사이즈 */}
                    {isSidebarOpen && (
                        <>
                            <div
                                className="bg-zinc-900/50 overflow-hidden flex-shrink-0"
                                style={{ width: sidebarWidth }}
                            >
                                <div className="h-full p-3 overflow-y-auto overflow-x-hidden">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-zinc-500 uppercase">파일</span>
                                        <div className="flex items-center gap-1">
                                            <button className="p-1 hover:bg-zinc-800 rounded" title="새 파일">
                                                <Plus className="w-4 h-4 text-zinc-400" />
                                            </button>
                                            <button
                                                onClick={() => setIsSidebarOpen(false)}
                                                className="p-1 hover:bg-zinc-800 rounded"
                                                title="사이드바 접기"
                                            >
                                                <PanelLeftClose className="w-4 h-4 text-zinc-400" />
                                            </button>
                                        </div>
                                    </div>
                                    {files.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {renderFileTree(files)}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 px-2">
                                            <Folder className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                                            <p className="text-xs text-zinc-600">
                                                파일 없음
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* 사이드바 리사이즈 핸들 */}
                            <div
                                ref={sidebarResizeRef}
                                onMouseDown={handleSidebarMouseDown}
                                className={cn(
                                    "flex-shrink-0 cursor-col-resize relative z-40 select-none",
                                    isResizingSidebar ? "bg-cyan-500" : "bg-zinc-800 hover:bg-cyan-500/70"
                                )}
                                style={{ touchAction: 'none', width: 1 }}
                            />
                        </>
                    )}

                    {/* 코드/미리보기 */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* 탭 헤더 */}
                        <div className="h-10 flex items-center justify-between px-3 border-b border-zinc-800 bg-zinc-900/80 flex-shrink-0">
                            <div className="flex items-center gap-1">
                                {/* 사이드바 닫혀있을 때만 열기 버튼 표시 */}
                                {!isSidebarOpen && (
                                    <button
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors mr-2"
                                        title="파일 목록 열기"
                                    >
                                        <PanelLeft className="w-4 h-4 text-zinc-400" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setRightPanelTab('code')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                        rightPanelTab === 'code'
                                            ? "bg-zinc-800 text-cyan-400"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                    )}
                                >
                                    <Code2 className="w-4 h-4" />
                                    코드
                                </button>
                                <button
                                    onClick={() => setRightPanelTab('preview')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                                        rightPanelTab === 'preview'
                                            ? "bg-zinc-800 text-cyan-400"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                    )}
                                >
                                    <Eye className="w-4 h-4" />
                                    미리보기
                                </button>
                                <button
                                    onClick={() => setRightPanelTab('claude')}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors relative",
                                        rightPanelTab === 'claude'
                                            ? "bg-zinc-800 text-orange-400"
                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                                    )}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Claude
                                    {claudeLoading && (
                                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                                    )}
                                </button>
                            </div>

                            {/* Claude 연결 상태 */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={recheckClaude}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors",
                                        claudeConnected
                                            ? "text-green-400 hover:bg-green-500/10"
                                            : "text-red-400 hover:bg-red-500/10"
                                    )}
                                    title={claudeConnected ? `Claude Bridge 연결됨 (${claudeVersion || 'unknown'})` : '연결 끊김 - 클릭하여 재연결'}
                                >
                                    {claudeChecking ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : claudeConnected ? (
                                        <Wifi className="w-3 h-3" />
                                    ) : (
                                        <WifiOff className="w-3 h-3" />
                                    )}
                                    <span className="hidden sm:inline">
                                        {claudeChecking ? '확인 중' : claudeConnected ? 'Claude' : '연결 끊김'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* 탭 컨텐츠 */}
                        <div className="flex-1 overflow-hidden">
                            {rightPanelTab === 'code' ? (
                                <div className="h-full flex flex-col">
                                    {openTabs.length > 0 && (
                                        <div className="h-9 flex items-center gap-1 px-2 border-b border-zinc-800 bg-zinc-900/50 overflow-x-auto flex-shrink-0">
                                            {openTabs.map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => {
                                                        setActiveFile(tab)
                                                        setCode(tab.content || '')
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-2 px-3 py-1 text-sm rounded-md transition-colors group",
                                                        activeFile?.id === tab.id
                                                            ? "bg-zinc-700 text-zinc-200"
                                                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                                                    )}
                                                >
                                                    <span>{tab.name}</span>
                                                    <X
                                                        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400"
                                                        onClick={(e) => handleCloseTab(tab, e)}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex-1">
                                        {activeFile ? (
                                            <Editor
                                                height="100%"
                                                language={activeFile.language || 'plaintext'}
                                                value={code}
                                                onChange={handleCodeChange}
                                                theme="vs-dark"
                                                options={{
                                                    fontSize: 14,
                                                    minimap: { enabled: false },
                                                    scrollBeyondLastLine: false,
                                                    padding: { top: 16 },
                                                    lineNumbers: 'on',
                                                    automaticLayout: true,
                                                }}
                                                onMount={(editor, monaco) => {
                                                    editorRef.current = editor
                                                    monacoRef.current = monaco

                                                    // Claude 플러그인 초기화 (연결 여부와 관계없이)
                                                    if (!claudePluginRef.current) {
                                                        claudePluginRef.current = initMonacoClaudePlugin(editor, {
                                                            bridgeUrl: 'http://localhost:3333',
                                                            onStart: (type) => {
                                                                setClaudeLoading(true)
                                                                setClaudeActionType(type)
                                                                setClaudeResponse('')
                                                                setClaudePanelOpen(true)
                                                            },
                                                            onStreaming: (chunk) => {
                                                                if (chunk.type === 'text' && chunk.content) {
                                                                    setClaudeResponse(chunk.content)
                                                                }
                                                            },
                                                            onResponse: (response, type) => {
                                                                setClaudeResponse(response)
                                                                setClaudeActionType(type)
                                                            },
                                                            onEnd: () => {
                                                                setClaudeLoading(false)
                                                            },
                                                            onError: (error) => {
                                                                setClaudeLoading(false)
                                                                setClaudeResponse(`❌ 오류: ${error.message}`)
                                                            },
                                                        })
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
                                                <Code2 className="w-16 h-16 text-zinc-700 mb-4" />
                                                <p className="text-zinc-500">
                                                    왼쪽 채팅창에서 AI에게<br/>코드를 요청하세요
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : rightPanelTab === 'preview' ? (
                                <div className="h-full bg-zinc-950">
                                    {files.length > 0 ? (
                                        <iframe
                                            key={previewKey}
                                            ref={iframeRef}
                                            srcDoc={generatePreview()}
                                            className="w-full h-full bg-white"
                                            sandbox="allow-scripts allow-same-origin"
                                        />
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                            <Eye className="w-16 h-16 text-zinc-700 mb-4" />
                                            <p className="text-zinc-500">
                                                코드가 생성되면<br/>미리보기가 표시됩니다
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Claude 응답 패널 */
                                <div className="h-full flex flex-col bg-zinc-950">
                                    {/* Claude 패널 헤더 */}
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-orange-400" />
                                            <span className="text-sm font-medium text-zinc-300">
                                                {claudeActionType ? `Claude: ${claudeActionType}` : 'Claude 응답'}
                                            </span>
                                            {claudeLoading && (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                                            )}
                                        </div>
                                        {claudeResponse && (
                                            <button
                                                onClick={async () => {
                                                    // 코드 블록만 추출하여 복사
                                                    const codeMatch = claudeResponse.match(/```[\s\S]*?\n([\s\S]*?)```/)
                                                    const textToCopy = codeMatch ? codeMatch[1].trim() : claudeResponse
                                                    await navigator.clipboard.writeText(textToCopy)
                                                    setCopiedCode(true)
                                                    setTimeout(() => setCopiedCode(false), 2000)
                                                }}
                                                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                                            >
                                                {copiedCode ? (
                                                    <>
                                                        <Check className="w-3 h-3 text-green-400" />
                                                        복사됨
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3 h-3" />
                                                        코드 복사
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Claude 응답 내용 */}
                                    <div className="flex-1 overflow-auto p-4">
                                        {claudeResponse ? (
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <pre className="whitespace-pre-wrap text-sm text-zinc-300 font-mono leading-relaxed">
                                                    {claudeResponse}
                                                </pre>
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center">
                                                <Sparkles className="w-16 h-16 text-zinc-700 mb-4" />
                                                <h3 className="text-lg font-medium text-zinc-400 mb-2">
                                                    Claude Code 도우미
                                                </h3>
                                                <p className="text-sm text-zinc-500 mb-4 max-w-md">
                                                    코드를 선택하고 단축키를 사용하세요
                                                </p>
                                                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600">
                                                    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg">
                                                        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">⌘⇧C</kbd>
                                                        <span>질문하기</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg">
                                                        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">⌘⇧E</kbd>
                                                        <span>코드 설명</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg">
                                                        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">⌘⇧R</kbd>
                                                        <span>리팩토링</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-2 rounded-lg">
                                                        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">⌘⇧B</kbd>
                                                        <span>버그 찾기</span>
                                                    </div>
                                                </div>
                                                {!claudeConnected && (
                                                    <div className="mt-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                                        <p className="font-medium mb-1">브릿지 서버 연결 필요</p>
                                                        <p className="text-xs text-red-400/70">
                                                            터미널에서 <code className="px-1 py-0.5 bg-red-500/20 rounded">node claude-bridge/bridge-server.js</code> 실행
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Claude 입력 영역 (선택적) */}
                                    {claudeConnected && (
                                        <div className="border-t border-zinc-800 p-3 bg-zinc-900/50">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Claude에게 직접 질문하기..."
                                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/50"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey && claudePluginRef.current) {
                                                            const input = e.currentTarget.value.trim()
                                                            if (input) {
                                                                claudePluginRef.current.ask(input)
                                                                e.currentTarget.value = ''
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        const input = document.querySelector<HTMLInputElement>('[placeholder="Claude에게 직접 질문하기..."]')
                                                        if (input && input.value.trim() && claudePluginRef.current) {
                                                            claudePluginRef.current.ask(input.value.trim())
                                                            input.value = ''
                                                        }
                                                    }}
                                                    disabled={claudeLoading}
                                                    className="p-2 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 rounded-lg transition-colors"
                                                >
                                                    {claudeLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                                    ) : (
                                                        <Send className="w-4 h-4 text-white" />
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-zinc-600 mt-1.5 text-center">
                                                코드 선택 후 질문하면 해당 코드에 대해 답변합니다
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
