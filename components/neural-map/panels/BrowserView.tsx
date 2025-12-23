'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Globe, MousePointer2, Terminal, MoreHorizontal, Plus, Eye, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { AIViewfinder, useViewfinder } from '../viewfinder'

export function BrowserView() {
    // 테마 설정
    const { resolvedTheme } = useTheme()

    // 상태 관리
    // 탭 상태 관리
    const [tabs, setTabs] = useState<{ id: string; url: string; title: string; favicon?: string }[]>([
        { id: '1', url: 'https://www.google.com', title: 'New Tab', favicon: '' }
    ])
    const [activeTabId, setActiveTabId] = useState('1')

    // 복구된 상태 변수들
    const [url, setUrl] = useState('https://www.google.com')
    const [inputUrl, setInputUrl] = useState('https://www.google.com')
    const [isLoading, setIsLoading] = useState(false)
    const [canGoBack, setCanGoBack] = useState(false)
    const [canGoForward, setCanGoForward] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 현재 활성 탭
    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

    // Webview Ref
    const webviewRef = useRef<any>(null)
    // Webview Node 상태 (useEffect 의존성용)
    const [webviewNode, setWebviewNode] = useState<any>(null)

    // 브라우저 컨테이너 ref (뷰파인더 bounds용)
    const browserContainerRef = useRef<HTMLDivElement>(null)

    // AI 뷰파인더 상태
    const viewfinder = useViewfinder({
        defaultActive: false,
        initialBounds: { x: 50, y: 50, width: 400, height: 300 },
        mode: 'manual'
    })

    // 분석 결과 표시용
    const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)

    // 탭 전환 핸들러
    const handleTabChange = (tabId: string) => {
        if (tabId === activeTabId) return
        setActiveTabId(tabId)
        const targetTab = tabs.find(t => t.id === tabId)
        if (targetTab) {
            // loadURL 호출 제거! src prop 변경이 네비게이션을 트리거함.
            // 중복 호출 시 ERR_ABORTED 발생 가능.
            setInputUrl(targetTab.url)
            setUrl(targetTab.url)
        }
    }

    // 탭 추가
    const handleAddTab = () => {
        const newId = Date.now().toString()
        const newTab = { id: newId, url: 'https://www.google.com', title: 'New Tab' }
        setTabs([...tabs, newTab])
        setActiveTabId(newId)
        // 여기서도 loadURL 명시적 호출 제거 (src가 바뀌면서 자동 로드됨)
    }

    // 탭 닫기
    const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation()
        const newTabs = tabs.filter(t => t.id !== tabId)
        if (newTabs.length === 0) {
            // 마지막 탭 닫으면 새 탭 하나 생성 (최소 1개 유지)
            const newId = Date.now().toString()
            setTabs([{ id: newId, url: 'https://www.google.com', title: 'New Tab' }])
            setActiveTabId(newId)
        } else {
            setTabs(newTabs)
            if (activeTabId === tabId) {
                // 닫은 탭이 활성 탭이었다면, 마지막 탭으로 이동
                const lastTab = newTabs[newTabs.length - 1]
                setActiveTabId(lastTab.id)
            }
        }
    }

    // Webview Ref Callback - 노드 저장만 담당
    const setWebviewRef = useCallback((node: any) => {
        webviewRef.current = node
        setWebviewNode(node)
    }, [])

    // 이벤트 리스너 관리 (activeTabId 변경 시 재설정 및 클린업)
    useEffect(() => {
        const node = webviewNode
        if (!node) return

        const onDidStartLoading = () => {
            setIsLoading(true)
            setError(null)
        }
        const onDidStopLoading = () => setIsLoading(false)
        const onDidFailLoad = (e: any) => {
            if (e.errorCode !== -3) setError(`Failed to load: ${e.errorDescription}`)
            setIsLoading(false)
        }
        const onDidNavigate = (e: any) => {
            setInputUrl(e.url)
            // 현재 활성 탭만 업데이트
            setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, url: e.url } : t))

            if (node.canGoBack) setCanGoBack(node.canGoBack())
            if (node.canGoForward) setCanGoForward(node.canGoForward())
        }
        const onPageTitleUpdated = (e: any) => {
            setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title: e.title } : t))
        }
        const onPageFaviconUpdated = (e: any) => {
            if (e.favicons && e.favicons.length > 0) {
                setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, favicon: e.favicons[0] } : t))
            }
        }
        const onNewWindow = (e: any) => {
            // 중요: 기본 팝업 동작 막기
            e.preventDefault()
            const newId = Date.now().toString()
            setTabs(prev => [...prev, { id: newId, url: e.url, title: 'New Tab' }])
            setActiveTabId(newId)
        }
        const onDomReady = () => {
            setIsLoading(false)
            if (node.canGoBack) setCanGoBack(node.canGoBack())
            if (node.canGoForward) setCanGoForward(node.canGoForward())
        }

        // 리스너 등록
        node.addEventListener('did-start-loading', onDidStartLoading)
        node.addEventListener('did-stop-loading', onDidStopLoading)
        node.addEventListener('did-fail-load', onDidFailLoad)
        node.addEventListener('did-navigate', onDidNavigate)
        node.addEventListener('page-title-updated', onPageTitleUpdated)
        node.addEventListener('page-favicon-updated', onPageFaviconUpdated)
        node.addEventListener('new-window', onNewWindow)
        node.addEventListener('dom-ready', onDomReady)

        // 클린업 (필수: 중복 리스너 방지)
        return () => {
            node.removeEventListener('did-start-loading', onDidStartLoading)
            node.removeEventListener('did-stop-loading', onDidStopLoading)
            node.removeEventListener('did-fail-load', onDidFailLoad)
            node.removeEventListener('did-navigate', onDidNavigate)
            node.removeEventListener('page-title-updated', onPageTitleUpdated)
            node.removeEventListener('page-favicon-updated', onPageFaviconUpdated)
            node.removeEventListener('new-window', onNewWindow)
            node.removeEventListener('dom-ready', onDomReady)
        }
    }, [webviewNode, activeTabId]) // activeTabId가 바뀔 때마다 정리하고 새로 등록

    // URL 입력 핸들러
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            let targetUrl = inputUrl.trim()
            if (!targetUrl) return
            if (!/^https?:\/\//i.test(targetUrl)) {
                targetUrl = 'https://' + targetUrl
            }
            if (webviewRef.current) {
                webviewRef.current.loadURL(targetUrl)
            } else {
                // Fallback
                setUrl(targetUrl)
            }
        }
    }

    const goBack = () => webviewRef.current?.canGoBack() && webviewRef.current.goBack()
    const goForward = () => webviewRef.current?.canGoForward() && webviewRef.current.goForward()
    const reload = () => webviewRef.current?.reload() && webviewRef.current.reload()

    const openDevTools = async () => {
        const webview = webviewRef.current
        if (webview && webview.openDevTools) {
            webview.openDevTools({ mode: 'right' })
        }
    }

    return (
        <div className="absolute inset-0 flex flex-col bg-zinc-50 dark:bg-zinc-950">
            {/* 탭 바 영역 */}
            <div className="flex items-center gap-1 px-2 pt-2 bg-zinc-100 dark:bg-zinc-900 overflow-x-auto no-scrollbar electron-no-drag border-b border-zinc-200 dark:border-zinc-800">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={cn(
                            "group relative flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] text-xs rounded-t-lg transition-colors cursor-pointer select-none border-t border-l border-r",
                            activeTabId === tab.id
                                ? "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm z-10 -mb-[1px]"
                                : "bg-zinc-100 dark:bg-zinc-900 border-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                        )}
                    >
                        {/* Favicon */}
                        {tab.favicon ? (
                            <img src={tab.favicon} alt="" className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                            <Globe className="w-3.5 h-3.5 shrink-0 opacity-50" />
                        )}

                        {/* Title */}
                        <span className="truncate flex-1">{tab.title}</span>

                        {/* Close Button (Hover) */}
                        <button
                            onClick={(e) => handleCloseTab(e, tab.id)}
                            className={cn(
                                "p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity",
                                tabs.length === 1 && "hidden" // 마지막 탭은 닫기 숨김
                            )}
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}

                {/* 탭 추가 버튼 */}
                <button
                    onClick={handleAddTab}
                    className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* 툴바 (주소창 등) */}
            <div className="h-10 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 px-3 bg-white dark:bg-zinc-950 shrink-0 electron-no-drag relative z-20 shadow-sm">
                <div className="flex items-center gap-1">
                    <button onClick={goBack} disabled={!canGoBack} className={cn("p-1.5 rounded-md transition-colors", canGoBack ? "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed")}><ArrowLeft className="w-3.5 h-3.5" /></button>
                    <button onClick={goForward} disabled={!canGoForward} className={cn("p-1.5 rounded-md transition-colors", canGoForward ? "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed")}><ArrowRight className="w-3.5 h-3.5" /></button>
                    <button onClick={reload} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"><RotateCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} /></button>
                </div>

                <div className="flex-1 flex items-center bg-zinc-100 dark:bg-zinc-800/50 rounded-full px-3 h-7 mx-2 border border-transparent focus-within:border-blue-500/50 transition-colors electron-no-drag">
                    <Globe className="w-3.5 h-3.5 text-zinc-400 mr-2" />
                    <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="no-focus-ring flex-1 bg-transparent border-none outline-none text-xs text-zinc-700 dark:text-zinc-200"
                    />
                </div>

                <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-2 ml-1 electron-no-drag">
                    {/* AI 뷰파인더 토글 */}
                    <button
                        onClick={viewfinder.toggle}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            viewfinder.isActive
                                ? "bg-blue-500/20 text-blue-500"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        )}
                        title="AI Viewfinder"
                    >
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                    {/* 분석 결과 패널 토글 */}
                    {viewfinder.lastAnalysis && (
                        <button
                            onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
                            className={cn(
                                "p-1.5 rounded-md transition-colors relative",
                                showAnalysisPanel
                                    ? "bg-purple-500/20 text-purple-500"
                                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            )}
                            title="분석 결과"
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {viewfinder.isStreaming && (
                                <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            )}
                        </button>
                    )}
                    <button className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" onClick={openDevTools} title="Inspect"><MousePointer2 className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" onClick={openDevTools} title="Terminal"><Terminal className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            <div ref={browserContainerRef} className="flex-1 relative bg-white dark:bg-zinc-950 overflow-hidden">
                {/* @ts-ignore */}
                <webview
                    ref={setWebviewRef}
                    src={activeTab.url} // 초기 로드용, 이후엔 loadURL로 제어
                    className="w-full h-full"
                // allowpopups removed to strictly block OS windows
                />

                {isLoading && <div className="absolute top-0 left-0 w-full h-0.5 z-10"><div className="h-full bg-blue-500 animate-[progress_1s_ease-in-out_infinite]" /></div>}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-sm z-20">
                        <div className="text-center p-6">
                            <X className="w-6 h-6 text-red-500 mx-auto mb-4" />
                            <p className="text-sm text-zinc-500 mb-4">{error}</p>
                            <button onClick={reload} className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm">Try Again</button>
                        </div>
                    </div>
                )}

                {/* AI 뷰파인더 */}
                <AIViewfinder
                    containerRef={browserContainerRef}
                    isActive={viewfinder.isActive}
                    onCapture={viewfinder.handleCapture}
                    onAnalysis={viewfinder.handleAnalysis}
                    onClose={viewfinder.close}
                    initialBounds={viewfinder.bounds}
                    mode="manual"
                />

                {/* 분석 결과 패널 */}
                {showAnalysisPanel && viewfinder.lastAnalysis && (
                    <div className="absolute bottom-4 right-4 w-80 max-h-64 bg-zinc-900/95 backdrop-blur rounded-lg shadow-2xl border border-zinc-700 overflow-hidden z-50">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
                            <div className="flex items-center gap-2 text-white text-xs font-medium">
                                <Eye className="w-3.5 h-3.5 text-blue-400" />
                                AI 분석 결과
                                {viewfinder.isStreaming && (
                                    <span className="flex items-center gap-1 text-green-400">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                        스트리밍
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setShowAnalysisPanel(false)}
                                className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="p-3 text-xs text-zinc-300 overflow-y-auto max-h-48 whitespace-pre-wrap">
                            {viewfinder.lastAnalysis}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
