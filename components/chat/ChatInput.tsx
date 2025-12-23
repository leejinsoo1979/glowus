'use client'

import React, { useRef, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { getModelList, type ChatModelId } from '@/lib/ai/models'
import {
    Globe,
    Image as ImageIcon,
    Mic,
    ArrowUp,
    ChevronDown,
    Bot,
    Sparkles,
    AtSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// lib/ai/models.ts에서 동적으로 가져옴
const MODELS = getModelList()

export function ChatInput() {
    const { input, setInput, selectedModel, setSelectedModel, isAgentMode, toggleAgentMode, addMessage, setIsLoading } = useChatStore()
    const { projectPath, files, graph, selectedNodeIds, codePreviewFile, activeTab } = useNeuralMapStore()
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // 프로젝트 컨텍스트 생성 - 실제 분석 데이터 포함
    const getProjectContext = () => {
        if (!projectPath && files.length === 0) return null

        const projectName = graph?.title || projectPath?.split('/').pop() || '프로젝트'
        const sections: string[] = []

        // 1. 프로젝트 기본 정보
        const pkgJson = files.find(f => f.name === 'package.json')
        let projectType = '알 수 없음'
        let dependencies: string[] = []

        if (pkgJson?.content) {
            try {
                const pkg = JSON.parse(pkgJson.content)
                const deps = { ...pkg.dependencies, ...pkg.devDependencies }
                dependencies = Object.keys(deps).slice(0, 20)

                if (deps['next']) projectType = 'Next.js 앱'
                else if (deps['react']) projectType = 'React 앱'
                else if (deps['vue']) projectType = 'Vue 앱'
                else if (deps['express']) projectType = 'Express 서버'
                else if (deps['electron']) projectType = 'Electron 앱'
                else if (pkg.type === 'module') projectType = 'ES Module 프로젝트'

                sections.push(`프로젝트: ${pkg.name || projectName} (${projectType})
설명: ${pkg.description || '없음'}
주요 의존성: ${dependencies.join(', ')}`)
            } catch {}
        }

        // 2. 폴더 구조 분석
        const folderCounts: Record<string, number> = {}
        files.forEach(f => {
            const parts = (f.path || f.name).split('/')
            if (parts.length > 1) {
                const folder = parts[0]
                folderCounts[folder] = (folderCounts[folder] || 0) + 1
            }
        })
        const topFolders = Object.entries(folderCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => `${name}/ (${count})`)

        if (topFolders.length > 0) {
            sections.push(`폴더 구조: ${topFolders.join(', ')}`)
        }

        // 3. 현재 선택된 파일 (가장 중요)
        if (codePreviewFile?.content) {
            const content = codePreviewFile.content.slice(0, 4000)
            sections.push(`[현재 보고 있는 파일: ${codePreviewFile.path || codePreviewFile.name}]
\`\`\`
${content}${codePreviewFile.content.length > 4000 ? '\n... (생략)' : ''}
\`\`\``)
        } else if (selectedNodeIds.length > 0 && graph) {
            // 선택된 노드의 파일 찾기
            const selectedNode = graph.nodes.find(n => n.id === selectedNodeIds[0])
            if (selectedNode?.sourceRef?.fileId) {
                const selectedFile = files.find(f => f.id === selectedNode.sourceRef?.fileId)
                if (selectedFile?.content) {
                    const content = selectedFile.content.slice(0, 4000)
                    sections.push(`[현재 선택된 파일: ${selectedFile.path || selectedFile.name}]
\`\`\`
${content}${selectedFile.content.length > 4000 ? '\n... (생략)' : ''}
\`\`\``)
                }
            }
        }

        // 4. README 내용 (프로젝트 설명)
        const readme = files.find(f => f.name.toLowerCase() === 'readme.md')
        if (readme?.content && !codePreviewFile) {
            sections.push(`[README.md 요약]
${readme.content.slice(0, 1500)}${readme.content.length > 1500 ? '...' : ''}`)
        }

        // 5. 현재 뷰 상태
        sections.push(`현재 화면: ${activeTab === 'map' ? '파일 맵' : activeTab === 'logic' ? '로직 플로우' : activeTab === 'mermaid' ? '다이어그램' : activeTab}`)

        return sections.join('\n\n')
    }

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
        }
    }, [input])

    const handleKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Prevent double submission during IME composition (Korean)
            if (e.nativeEvent.isComposing) return

            e.preventDefault()
            if (!input.trim()) return

            // Save input and clear immediately
            const userInput = input.trim()
            setInput('')

            // Add user message
            addMessage({
                id: Date.now().toString(),
                role: 'user',
                content: userInput,
                timestamp: Date.now(),
                model: selectedModel
            })

            // Real API integration
            setIsLoading(true)

            try {
                // Agent 모드: 도구 사용 가능한 에이전트 API
                // 일반 모드: 기본 챗 API
                const apiEndpoint = isAgentMode ? '/api/agent' : '/api/chat'

                // 프로젝트 컨텍스트
                const projectContext = getProjectContext()
                const chatMessages = useChatStore.getState().messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))

                const messagesWithContext = projectContext
                    ? [{ role: 'system', content: projectContext }, ...chatMessages, { role: 'user', content: userInput }]
                    : [...chatMessages, { role: 'user', content: userInput }]

                // Agent 모드일 때 파일 컨텍스트 전달
                const body: Record<string, unknown> = {
                    messages: messagesWithContext,
                    model: selectedModel
                }

                if (isAgentMode) {
                    body.context = {
                        files: files.map(f => ({
                            id: f.id,
                            name: f.name,
                            path: f.path,
                            content: f.content,
                            type: f.type
                        })),
                        projectPath,
                        graph: graph ? {
                            title: graph.title,
                            nodes: graph.nodes.map(n => ({
                                id: n.id,
                                type: n.type,
                                title: n.title,
                                sourceRef: n.sourceRef
                            }))
                        } : null
                    }
                }

                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    throw new Error(errorData.error || `HTTP Error ${response.status}`)
                }

                const data = await response.json()

                // Agent 모드면 도구 호출 내역 포함
                let content = data.content
                if (isAgentMode && data.toolCalls?.length > 0) {
                    content = `${data.content}\n\n---\n사용된 도구: ${data.toolCalls.join(', ')}`
                }

                addMessage({
                    id: Date.now().toString(),
                    role: 'assistant',
                    content,
                    timestamp: Date.now(),
                    model: selectedModel,
                    metadata: data.toolCalls ? { toolCalls: data.toolCalls } : undefined
                })
            } catch (error: any) {
                console.error('Chat error:', error)
                addMessage({
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`,
                    timestamp: Date.now(),
                    model: selectedModel
                })
            } finally {
                setIsLoading(false)
            }
        }
    }

    const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[0]

    return (
        <div className="relative bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm transition-all duration-200">
            {/* Context & Input Area */}
            <div className="px-3 pt-2 pb-1">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지를 입력하세요..."
                    className="no-focus-ring w-full bg-transparent border-none outline-none resize-none text-sm leading-snug text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 min-h-[24px] max-h-[150px]"
                    rows={1}
                />
            </div>

            {/* Bottom Toolbar */}
            <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                    {/* Agent/Model Toggle Group */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-0.5 mr-2">
                        <button
                            onClick={toggleAgentMode}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                                isAgentMode
                                    ? "bg-blue-500 text-white shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                            )}
                        >
                            <Bot className="w-3.5 h-3.5" />
                            <span>Agent</span>
                        </button>

                        <div className="w-[1px] h-3 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
                                    <span>{currentModel.name}</span>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[200px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xl">
                                {MODELS.map((model) => (
                                    <DropdownMenuItem
                                        key={model.id}
                                        onClick={() => setSelectedModel(model.id as ChatModelId)}
                                        className="gap-2"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        {model.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Quick Actions */}
                    <button className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title="Read Context (@)">
                        <AtSign className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title="Browse Web">
                        <Globe className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title="Add Image">
                        <ImageIcon className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title="Voice Input">
                        <Mic className="w-4 h-4" />
                    </button>
                </div>

                {/* Submit Button */}
                <button
                    className={cn(
                        "p-1.5 rounded-lg transition-all duration-200",
                        input.trim()
                            ? "bg-blue-500 text-white shadow-md hover:bg-blue-600"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    )}
                    disabled={!input.trim()}
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
