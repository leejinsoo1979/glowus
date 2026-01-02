'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, X, Globe, MousePointer2, Terminal, MoreHorizontal, Plus, Eye, MessageSquare, Share2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { AIViewfinder, useViewfinder } from '../viewfinder'

// Electron 환경인지 감지
const isElectron = typeof window !== 'undefined' && !!(window as any).electron

// AI 화면 공유 컨텍스트 타입
interface AIScreenContext {
    imageDataUrl: string
    timestamp: number
}

interface BrowserViewProps {
    /** AI에게 화면 공유 시 호출되는 콜백 */
    onShareToAI?: (context: AIScreenContext) => void
}

export function BrowserView({ onShareToAI }: BrowserViewProps = {}) {
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

    // Webview Ref (Electron)
    const webviewRef = useRef<any>(null)
    // iframe Ref (Web)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    // Webview Node 상태 (useEffect 의존성용)
    const [webviewNode, setWebviewNode] = useState<any>(null)
    // Webview의 webContentsId (Electron 캡처용)
    const [webContentsId, setWebContentsId] = useState<number | undefined>(undefined)

    // 브라우저 컨테이너 ref (뷰파인더 bounds용)
    const browserContainerRef = useRef<HTMLDivElement>(null)

    // AI 뷰파인더 상태
    const viewfinder = useViewfinder({
        defaultActive: false,
        initialBounds: { x: 50, y: 50, width: 400, height: 300 },
        mode: 'manual'
    })

    // AI 화면 공유 상태
    const [isAISharingActive, setIsAISharingActive] = useState(false)
    const [aiShareCount, setAiShareCount] = useState(0)

    // 분석 결과 표시용
    const [showAnalysisPanel, setShowAnalysisPanel] = useState(false)

    // AI에게 화면 공유 핸들러
    const handleShareToAI = useCallback((imageDataUrl: string, timestamp: number) => {
        setAiShareCount(prev => prev + 1)
        // 외부 콜백이 있으면 호출 (챗봇 컨텍스트로 전달)
        onShareToAI?.({ imageDataUrl, timestamp })

        // 콘솔에 로깅 (디버깅용)
        console.log('[AI Viewfinder] Screen shared to AI:', {
            timestamp: new Date(timestamp).toISOString(),
            imageSize: Math.round(imageDataUrl.length / 1024) + 'KB',
            shareCount: aiShareCount + 1
        })
    }, [onShareToAI, aiShareCount])

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

            // Webview의 webContentsId 가져오기 및 AI Browser 시스템에 등록
            const registerAiBrowser = async (retryCount = 0) => {
                try {
                    console.log('[BrowserView] 🔍 Checking webContentsId... (retry:', retryCount, ')')

                    // @ts-ignore - Electron webview method
                    const wcId = node.getWebContentsId?.()
                    console.log('[BrowserView] wcId:', wcId)

                    if (wcId) {
                        setWebContentsId(wcId)
                        console.log('[BrowserView] WebContentsId captured:', wcId)

                        // 🌐 AI Browser 시스템에 등록 (채팅 에이전트가 제어 가능하도록)
                        const electronApi = (window as any).electron?.aiBrowser
                        console.log('[BrowserView] 🌐 electron.aiBrowser:', !!electronApi)

                        if (electronApi) {
                            console.log('[BrowserView] 📡 Calling register...')
                            const result = await electronApi.register(wcId)
                            console.log('[BrowserView] ✅ Registered with AI Browser system:', result)
                        } else {
                            console.warn('[BrowserView] ⚠️ electron.aiBrowser not available!')
                        }
                    } else if (retryCount < 5) {
                        // webContentsId가 없으면 재시도
                        console.log('[BrowserView] ⏳ webContentsId not ready, retrying in 500ms...')
                        setTimeout(() => registerAiBrowser(retryCount + 1), 500)
                    } else {
                        console.warn('[BrowserView] ⚠️ Failed to get webContentsId after 5 retries')
                    }
                } catch (e) {
                    console.error('[BrowserView] ❌ Error:', e)
                    if (retryCount < 5) {
                        setTimeout(() => registerAiBrowser(retryCount + 1), 500)
                    }
                }
            }

            registerAiBrowser()
        }

        // 🌐 did-attach 이벤트 - webContentsId를 직접 받을 수 있음
        const onDidAttach = () => {
            console.log('[BrowserView] 🔗 did-attach fired')
            try {
                // @ts-ignore - Electron webview method
                const wcId = node.getWebContentsId?.()
                console.log('[BrowserView] wcId from did-attach:', wcId)

                if (wcId && (window as any).electron?.aiBrowser) {
                    console.log('[BrowserView] 📡 Registering from did-attach...')
                    ;(window as any).electron.aiBrowser.register(wcId)
                        .then((r: any) => console.log('[BrowserView] ✅ Registered:', r))
                        .catch((e: any) => console.error('[BrowserView] ❌ Register failed:', e))
                }
            } catch (e) {
                console.error('[BrowserView] did-attach error:', e)
            }
        }

        // 리스너 등록
        node.addEventListener('did-attach', onDidAttach)
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
            node.removeEventListener('did-attach', onDidAttach)
            node.removeEventListener('did-start-loading', onDidStartLoading)
            node.removeEventListener('did-stop-loading', onDidStopLoading)
            node.removeEventListener('did-fail-load', onDidFailLoad)
            node.removeEventListener('did-navigate', onDidNavigate)
            node.removeEventListener('page-title-updated', onPageTitleUpdated)
            node.removeEventListener('page-favicon-updated', onPageFaviconUpdated)
            node.removeEventListener('new-window', onNewWindow)
            node.removeEventListener('dom-ready', onDomReady)

            // 🌐 AI Browser 시스템에서 해제
            if ((window as any).electron?.aiBrowser) {
                (window as any).electron.aiBrowser.unregister()
                    .catch((e: any) => console.warn('[BrowserView] Failed to unregister from AI Browser:', e))
            }
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

            if (isElectron && webviewRef.current) {
                webviewRef.current.loadURL(targetUrl)
            } else {
                // 웹: 탭 URL 업데이트 (iframe src 변경)
                setTabs(prev => prev.map(t =>
                    t.id === activeTabId ? { ...t, url: targetUrl, title: targetUrl } : t
                ))
                setUrl(targetUrl)
                setIsLoading(true)
            }
        }
    }

    // 네비게이션 함수들
    const goBack = () => {
        if (isElectron) {
            webviewRef.current?.canGoBack() && webviewRef.current.goBack()
        } else {
            // 웹에서는 iframe history 접근 불가 - 버튼 비활성화됨
        }
    }
    const goForward = () => {
        if (isElectron) {
            webviewRef.current?.canGoForward() && webviewRef.current.goForward()
        }
    }
    const reload = () => {
        if (isElectron) {
            webviewRef.current?.reload()
        } else {
            // 웹: iframe 새로고침
            if (iframeRef.current) {
                setIsLoading(true)
                iframeRef.current.src = iframeRef.current.src
            }
        }
    }

    // 새 탭에서 열기 (웹용)
    const openInNewTab = () => {
        window.open(activeTab.url, '_blank')
    }

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
                    {/* Electron에서만 뒤로/앞으로 활성화 */}
                    <button onClick={goBack} disabled={!isElectron || !canGoBack} className={cn("p-1.5 rounded-md transition-colors", (isElectron && canGoBack) ? "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed")}><ArrowLeft className="w-3.5 h-3.5" /></button>
                    <button onClick={goForward} disabled={!isElectron || !canGoForward} className={cn("p-1.5 rounded-md transition-colors", (isElectron && canGoForward) ? "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed")}><ArrowRight className="w-3.5 h-3.5" /></button>
                    <button onClick={reload} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"><RotateCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} /></button>
                    {/* 웹에서 새 탭에서 열기 버튼 */}
                    {!isElectron && (
                        <button onClick={openInNewTab} className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors" title="새 탭에서 열기">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    )}
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
                            "p-1.5 rounded-md transition-colors relative",
                            viewfinder.isActive
                                ? "bg-blue-500/20 text-blue-500"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                        )}
                        title="AI Viewfinder"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        {/* AI 화면 공유 중 표시 */}
                        {aiShareCount > 0 && viewfinder.isActive && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-green-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                                {aiShareCount > 99 ? '99+' : aiShareCount}
                            </span>
                        )}
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
                {/* Electron: webview, Web: iframe */}
                {isElectron ? (
                    // @ts-ignore - Electron webview
                    <webview
                        ref={setWebviewRef}
                        src={activeTab.url}
                        className="w-full h-full"
                    />
                ) : (
                    // 웹 브라우저용 - iframe 제한 안내
                    <div className="w-full h-full flex flex-col">
                        {/* 안내 배너 */}
                        <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border-b border-amber-500/20">
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ 웹 브라우저에서는 보안 제한으로 일부 사이트가 표시되지 않을 수 있습니다
                            </span>
                            <button
                                onClick={() => window.open(activeTab.url, '_blank')}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                                <ExternalLink className="w-3 h-3" />
                                새 탭에서 열기
                            </button>
                        </div>
                        {/* iframe */}
                        <iframe
                            ref={iframeRef as any}
                            src={activeTab.url}
                            className="flex-1 w-full border-0"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
                            allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi"
                            referrerPolicy="no-referrer-when-downgrade"
                            onLoad={() => {
                                setIsLoading(false)
                                setError(null)
                            }}
                            onError={() => {
                                setError('이 사이트는 iframe 삽입을 차단합니다. 새 탭에서 열어주세요.')
                                setIsLoading(false)
                            }}
                        />
                    </div>
                )}

                {isLoading && <div className="absolute top-0 left-0 w-full h-0.5 z-10"><div className="h-full bg-blue-500 animate-[progress_1s_ease-in-out_infinite]" /></div>}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-sm z-20">
                        <div className="text-center p-6">
                            <Globe className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2 font-medium">페이지를 표시할 수 없습니다</p>
                            <p className="text-xs text-zinc-500 mb-4">{error}</p>
                            <div className="flex gap-2 justify-center">
                                <button
                                    onClick={() => window.open(activeTab.url, '_blank')}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm flex items-center gap-2 hover:bg-blue-600 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    새 탭에서 열기
                                </button>
                                <button onClick={reload} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md text-sm hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors">다시 시도</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI 뷰파인더 */}
                <AIViewfinder
                    webContentsId={webContentsId}
                    containerRef={browserContainerRef}
                    isActive={viewfinder.isActive}
                    onCapture={viewfinder.handleCapture}
                    onAnalysis={viewfinder.handleAnalysis}
                    onShareToAI={handleShareToAI}
                    onClose={viewfinder.close}
                    initialBounds={viewfinder.bounds}
                    mode="manual"
                    aiContextEnabled={true}
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
