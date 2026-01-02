"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Search,
    Plus,
    MoreVertical,
    Settings,
    Star,
    Users,
    FileText,
    Briefcase,
    LayoutGrid,
    Download,
    Upload,
    ChevronDown,
    FolderOpen,
    Home,
    Wrench,
    ArrowUpDown,
    List,
    Send,
    Bot,
    User,
    ArrowLeft,
    Loader2,
    Mail,
    Sheet,
    Sparkles,
    Globe,
    Presentation,
    Table2,
    Image,
    AppWindow,
    RefreshCw,
    X,
    ExternalLink,
    Maximize2,
    Minimize2,
    GripVertical,
    ChevronLeft,
    ChevronRight,
    Lock,
    Unlock
} from "lucide-react"
import { BsFiletypePpt, BsFiletypeDoc, BsFileEarmarkSpreadsheet, BsFileEarmarkImage } from "react-icons/bs"
import { AiOutlineAppstoreAdd } from "react-icons/ai"
import { RiSparkling2Fill } from "react-icons/ri"
import { FaRegFileCode } from "react-icons/fa6"
import { useThemeStore } from "@/stores/themeStore"
import { cn } from "@/lib/utils"
import { ToolsView } from "./tools-view"
import { useSearchParams, useRouter } from "next/navigation"
import { CreateWorkModal } from "./create-modal"

interface Message {
    role: 'user' | 'assistant'
    content: string
    screenshot?: string // 브라우저 스크린샷
    browserAction?: boolean // 브라우저 액션 여부
}

// 브라우저 자동화 액션 타입
interface BrowserAction {
    type: 'navigate' | 'search' | 'click' | 'type' | 'scroll' | 'screenshot'
    url?: string
    query?: string
    selector?: string
    text?: string
    direction?: 'up' | 'down'
}

// 사용자 명령을 브라우저 액션으로 파싱
function parseBrowserCommand(text: string): BrowserAction | null {
    const lowerText = text.toLowerCase()

    // "네이버에서 OOO 검색해줘" 패턴
    const searchPatterns = [
        /(.+)에서\s+['"]?(.+?)['"]?\s*(검색|찾아|알려)/,
        /['"]?(.+?)['"]?\s*(검색|찾아).*?(.+)에서/,
        /(.+)에서\s+(.+)\s*(검색|찾아)/,
    ]

    for (const pattern of searchPatterns) {
        const match = text.match(pattern)
        if (match) {
            const site = match[1]
            const query = match[2]

            let baseUrl = 'https://www.google.com'
            if (site.includes('네이버') || site.includes('naver')) {
                baseUrl = 'https://search.naver.com/search.naver?query='
                return { type: 'search', url: baseUrl + encodeURIComponent(query), query }
            } else if (site.includes('구글') || site.includes('google')) {
                return { type: 'search', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, query }
            } else if (site.includes('유튜브') || site.includes('youtube')) {
                return { type: 'search', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, query }
            }
        }
    }

    // 스크롤 명령
    if (lowerText.includes('스크롤') || lowerText.includes('내려') || lowerText.includes('올려')) {
        const direction = (lowerText.includes('올려') || lowerText.includes('위')) ? 'up' : 'down'
        return { type: 'scroll', direction }
    }

    // 클릭 명령
    const clickMatch = text.match(/['"]?(.+?)['"]?\s*(클릭|눌러|선택)/)
    if (clickMatch) {
        return { type: 'click', text: clickMatch[1] }
    }

    // 입력 명령
    const typeMatch = text.match(/['"]?(.+?)['"]?\s*(입력|타이핑|써줘|적어)/)
    if (typeMatch) {
        return { type: 'type', text: typeMatch[1] }
    }

    // 단순 사이트 열기
    if (lowerText.includes('네이버') && (lowerText.includes('열어') || lowerText.includes('가줘') || lowerText.includes('이동'))) {
        return { type: 'navigate', url: 'https://www.naver.com' }
    }
    if (lowerText.includes('구글') && (lowerText.includes('열어') || lowerText.includes('가줘') || lowerText.includes('이동'))) {
        return { type: 'navigate', url: 'https://www.google.com' }
    }
    if (lowerText.includes('유튜브') && (lowerText.includes('열어') || lowerText.includes('가줘') || lowerText.includes('이동'))) {
        return { type: 'navigate', url: 'https://www.youtube.com' }
    }

    return null
}

// --- Icons for App Grid ---
const AppIcon = ({ icon: Icon, color, bg }: { icon: any, color: string, bg: string }) => (
    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", bg)}>
        <Icon className={cn("w-6 h-6", color)} />
    </div>
)

function AppCard({ title, icon, iconColor, iconBg }: { title: string, icon: any, iconColor: string, iconBg: string }) {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto sm:h-48 shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><Settings className="w-4 h-4" /></button>
            </div>
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-zinc-400 hover:text-yellow-400"><Star className="w-4 h-4" /></button>
            </div>

            <AppIcon icon={icon} color={iconColor} bg={iconBg} />

            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h3>
        </motion.div>
    )
}

// --- Electron Browser Panel Component with Real Webview ---
function BrowserPanel({
    currentUrl,
    isLoading,
    onClose,
    onUrlChange,
    isExpanded,
    onToggleExpand,
    onNavigate
}: {
    currentUrl: string
    isLoading: boolean
    onClose: () => void
    onUrlChange: (url: string) => void
    isExpanded: boolean
    onToggleExpand: () => void
    onNavigate: (url: string) => void
}) {
    const [inputUrl, setInputUrl] = useState(currentUrl)
    const [canGoBack, setCanGoBack] = useState(false)
    const [canGoForward, setCanGoForward] = useState(false)
    const [isSecure, setIsSecure] = useState(false)
    const [webviewLoading, setWebviewLoading] = useState(false)
    const [isElectron, setIsElectron] = useState(false)

    // Electron 환경 체크
    useEffect(() => {
        const isElectronEnv = typeof window !== 'undefined' && !!(window as any).electron
        setIsElectron(isElectronEnv)
        console.log('[BrowserPanel] isElectron:', isElectronEnv)
    }, [])

    // dom-ready 상태 및 대기 URL
    const [domReady, setDomReady] = useState(false)
    const pendingUrlRef = useRef<string>('')

    // currentUrl이 변경되면 inputUrl도 업데이트
    useEffect(() => {
        setInputUrl(currentUrl)
    }, [currentUrl])

    // 이벤트 리스너 설정 (한 번만)
    useEffect(() => {
        if (!isElectron) return

        // 약간의 지연 후 webview 찾기
        const timer = setTimeout(() => {
            const webview = document.getElementById('browser-webview') as any
            if (!webview) {
                console.log('[Webview] Element not found')
                return
            }

            console.log('[Webview] Setting up event listeners')

            // 🔥 AI Browser 시스템에 webview 등록
            const registerWithAIBrowser = () => {
                try {
                    const wcId = webview.getWebContentsId?.()
                    console.log('[Webview] WebContentsId:', wcId)

                    if (wcId && (window as any).electron?.aiBrowser) {
                        console.log('[Webview] 📡 Registering with AI Browser...')
                        ;(window as any).electron.aiBrowser.register(wcId)
                            .then((r: any) => console.log('[Webview] ✅ Registered with AI Browser:', r))
                            .catch((e: any) => console.error('[Webview] ❌ Register failed:', e))
                    }
                } catch (e) {
                    console.error('[Webview] Registration error:', e)
                }
            }

            const handleDomReady = () => {
                console.log('[Webview] DOM ready!')
                setDomReady(true)
                // 대기 중인 URL이 있으면 로드
                if (pendingUrlRef.current) {
                    console.log('[Webview] Loading pending URL:', pendingUrlRef.current)
                    webview.loadURL(pendingUrlRef.current)
                    pendingUrlRef.current = ''
                }
                // 🔥 DOM ready 시 AI Browser에 등록
                registerWithAIBrowser()
            }

            const handleDidNavigate = (e: any) => {
                const url = e.url || webview.getURL?.() || ''
                setInputUrl(url)
                if (webview.canGoBack) setCanGoBack(webview.canGoBack())
                if (webview.canGoForward) setCanGoForward(webview.canGoForward())
                setIsSecure(url.startsWith('https://'))
            }

            const handleDidStartLoading = () => setWebviewLoading(true)
            const handleDidStopLoading = () => setWebviewLoading(false)

            // 🔥 did-attach 이벤트로도 등록
            const handleDidAttach = () => {
                console.log('[Webview] 🔗 did-attach fired')
                registerWithAIBrowser()
            }

            webview.addEventListener('dom-ready', handleDomReady)
            webview.addEventListener('did-attach', handleDidAttach)
            webview.addEventListener('did-navigate', handleDidNavigate)
            webview.addEventListener('did-start-loading', handleDidStartLoading)
            webview.addEventListener('did-stop-loading', handleDidStopLoading)

            // 🔥 컴포넌트 언마운트 시 등록 해제
            return () => {
                if ((window as any).electron?.aiBrowser?.unregister) {
                    (window as any).electron.aiBrowser.unregister()
                        .catch((e: any) => console.warn('[Webview] Unregister failed:', e))
                }
            }
        }, 100)

        return () => clearTimeout(timer)
    }, [isElectron])

    // URL 변경 시 로드 (dom-ready 후에만)
    useEffect(() => {
        if (!isElectron || !currentUrl || currentUrl === 'about:blank') return

        const webview = document.getElementById('browser-webview') as any

        if (!domReady) {
            // dom-ready 전이면 대기
            console.log('[Webview] Waiting for dom-ready, pending:', currentUrl)
            pendingUrlRef.current = currentUrl
            return
        }

        if (!webview?.loadURL) return

        console.log('[Webview] Loading:', currentUrl)
        webview.loadURL(currentUrl)
    }, [isElectron, currentUrl, domReady])

    // 네비게이션 함수들 - DOM에서 직접 webview 요소 가져오기
    const getWebview = () => document.getElementById('browser-webview') as any

    const goBack = () => {
        const wv = getWebview()
        if (wv?.goBack) wv.goBack()
    }

    const goForward = () => {
        const wv = getWebview()
        if (wv?.goForward) wv.goForward()
    }

    const reload = () => {
        const wv = getWebview()
        if (wv?.reload) wv.reload()
    }

    // 브라우저 액션 실행 (스크롤, 클릭 등)
    const executeAction = async (action: BrowserAction): Promise<string> => {
        const wv = getWebview()
        if (!wv?.executeJavaScript) {
            return '브라우저가 준비되지 않았습니다.'
        }

        try {
            switch (action.type) {
                case 'scroll':
                    const scrollAmount = action.direction === 'up' ? -500 : 500
                    await wv.executeJavaScript(`window.scrollBy(0, ${scrollAmount})`)
                    return `${action.direction === 'up' ? '위로' : '아래로'} 스크롤했습니다.`

                case 'click':
                    if (action.text) {
                        const clickScript = `
                            (function() {
                                const elements = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
                                for (const el of elements) {
                                    if (el.textContent && el.textContent.includes('${action.text}')) {
                                        el.click();
                                        return '클릭 성공: ' + el.textContent.substring(0, 50);
                                    }
                                }
                                return '요소를 찾을 수 없습니다: ${action.text}';
                            })()
                        `
                        const result = await wv.executeJavaScript(clickScript)
                        return result
                    }
                    return '클릭할 텍스트가 지정되지 않았습니다.'

                case 'type':
                    if (action.text) {
                        const typeScript = `
                            (function() {
                                const input = document.activeElement;
                                if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                                    input.value = '${action.text}';
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    return '입력 완료: ${action.text}';
                                }
                                // 검색창 찾기
                                const searchInput = document.querySelector('input[type="search"], input[name="query"], input[name="q"], #query, .search-input');
                                if (searchInput) {
                                    searchInput.value = '${action.text}';
                                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    searchInput.form?.submit();
                                    return '검색 실행: ${action.text}';
                                }
                                return '입력창을 찾을 수 없습니다.';
                            })()
                        `
                        const result = await wv.executeJavaScript(typeScript)
                        return result
                    }
                    return '입력할 텍스트가 지정되지 않았습니다.'

                default:
                    return '알 수 없는 액션입니다.'
            }
        } catch (e) {
            console.error('[Webview] Action error:', e)
            return `액션 실행 오류: ${e}`
        }
    }

    // executeAction을 외부에서 접근할 수 있도록 전역에 저장
    useEffect(() => {
        (window as any).__browserExecuteAction = executeAction
    }, [domReady])

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        let url = inputUrl.trim()
        if (!url) return

        // URL 형식 자동 보정
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.includes('.') && !url.includes(' ')) {
                url = 'https://' + url
            } else {
                // 검색어로 처리
                url = `https://www.google.com/search?q=${encodeURIComponent(url)}`
            }
        }

        // DOM에서 webview 가져와서 loadURL
        const wv = getWebview()
        if (isElectron && wv?.loadURL) {
            console.log('[Webview] URL bar submit:', url)
            wv.loadURL(url)
        }
        onNavigate(url)
    }

    const openExternal = () => {
        if (currentUrl && typeof window !== 'undefined') {
            window.open(currentUrl, '_blank')
        }
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700">
            {/* Browser Header */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                {/* Traffic Lights */}
                <div className="flex items-center gap-1.5 mr-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 cursor-pointer hover:opacity-80" onClick={onClose} title="닫기" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500 cursor-pointer hover:opacity-80" onClick={onToggleExpand} title="최소화" />
                    <div className="w-3 h-3 rounded-full bg-green-500 cursor-pointer hover:opacity-80" onClick={onToggleExpand} title="최대화" />
                </div>

                {/* Navigation Buttons */}
                <button
                    onClick={goBack}
                    disabled={!canGoBack}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-30"
                    title="뒤로"
                >
                    <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
                <button
                    onClick={goForward}
                    disabled={!canGoForward}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors disabled:opacity-30"
                    title="앞으로"
                >
                    <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                </button>
                <button
                    onClick={reload}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    title="새로고침"
                >
                    <RefreshCw className={cn("w-4 h-4 text-zinc-600 dark:text-zinc-400", (isLoading || webviewLoading) && "animate-spin")} />
                </button>

                {/* URL Bar */}
                <form onSubmit={handleUrlSubmit} className="flex-1 mx-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-600">
                        {isSecure ? (
                            <Lock className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                            <Globe className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        )}
                        <input
                            type="text"
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="URL을 입력하거나 검색어를 입력하세요"
                            className="flex-1 text-xs bg-transparent text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none"
                        />
                    </div>
                </form>

                {/* Window Controls */}
                <button
                    onClick={openExternal}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    title="외부 브라우저에서 열기"
                >
                    <ExternalLink className="w-4 h-4 text-zinc-500" />
                </button>
                <button
                    onClick={onToggleExpand}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    title={isExpanded ? "축소" : "확대"}
                >
                    {isExpanded ? (
                        <Minimize2 className="w-4 h-4 text-zinc-500" />
                    ) : (
                        <Maximize2 className="w-4 h-4 text-zinc-500" />
                    )}
                </button>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                    title="브라우저 닫기"
                >
                    <X className="w-4 h-4 text-zinc-500" />
                </button>
            </div>

            {/* Browser Content - Webview or Fallback */}
            <div className="flex-1 relative bg-white dark:bg-zinc-950 overflow-hidden">
                {isElectron ? (
                    // Electron: 실제 webview 사용 - src 속성으로 직접 URL 설정
                    <>
                        <webview
                            id="browser-webview"
                            src={currentUrl || 'about:blank'}
                            style={{
                                width: '100%',
                                height: '100%',
                                display: 'inline-flex',
                                border: 'none'
                            }}
                            // @ts-ignore - webview는 Electron 전용 태그
                            allowpopups="true"
                            webpreferences="contextIsolation=no, nodeIntegration=no, javascript=yes, webSecurity=no"
                            useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                            partition="persist:browser"
                        />
                        {/* Debug: 현재 URL 표시 */}
                        <div className="absolute bottom-2 left-2 p-2 bg-black/80 text-green-400 text-[10px] font-mono rounded">
                            src: {currentUrl || 'about:blank'}
                        </div>
                    </>
                ) : (
                    // Web: 플레이스홀더 표시
                    <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                        <Globe className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-sm font-medium">Electron 앱에서만 사용 가능</p>
                        <p className="text-xs mt-2 opacity-70">데스크톱 앱을 실행하면 실제 브라우저를 사용할 수 있습니다</p>
                        {currentUrl && (
                            <button
                                onClick={openExternal}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                외부 브라우저에서 열기
                            </button>
                        )}
                    </div>
                )}

                {/* Loading Overlay */}
                {(isLoading || webviewLoading) && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
                        <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
                    </div>
                )}
            </div>
        </div>
    )
}

// --- Chat View Component ---
function ChatView({ onBack, initialQuery }: { onBack: () => void, initialQuery?: string }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const hasSentInitialRef = useRef(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // 브라우저 패널 상태
    const [browserOpen, setBrowserOpen] = useState(false)
    const [browserUrl, setBrowserUrl] = useState('')
    const [browserLoading, setBrowserLoading] = useState(false)
    const [browserExpanded, setBrowserExpanded] = useState(false)

    // 리사이즈 상태
    const [browserWidth, setBrowserWidth] = useState(50) // 퍼센트
    const [isResizing, setIsResizing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // 리사이즈 핸들러
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        // 드래그 중 전체 문서에 커서 스타일 적용
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return
            e.preventDefault()

            const containerRect = containerRef.current.getBoundingClientRect()
            const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100

            // 최소 25%, 최대 75% - 범위 조정
            const clampedWidth = Math.min(75, Math.max(25, newWidth))
            setBrowserWidth(clampedWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            // 커서 스타일 복원
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        // 항상 리스너 등록
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
    }, [isResizing])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // 브라우저 닫기
    const handleBrowserClose = () => {
        setBrowserOpen(false)
        setBrowserUrl('')
    }

    // 브라우저 제어가 필요한 요청인지 감지
    const isBrowserTask = (text: string): boolean => {
        const browserKeywords = [
            '브라우저', '웹사이트', '사이트', '페이지',
            '네이버', '구글', 'google', 'naver', '다음', 'daum',
            '접속', '열어', '가줘', '들어가', '검색해', '클릭',
            '예약', '로그인', '회원가입', '댓글', '좋아요',
            '크롤링', '스크래핑', '데이터 수집',
            'http://', 'https://', 'www.',
            '웹에서', '인터넷에서', '온라인으로',
            // 🔥 검색/조회 관련 키워드 추가
            '맛집', '추천', '날씨', '뉴스', '영화', '음식점',
            '카페', '병원', '약국', '호텔', '숙소', '항공',
            '쇼핑', '가격', '비교', '리뷰', '후기', '평점',
            '찾아줘', '알려줘', '보여줘', '검색', '조회',
            '유튜브', 'youtube', '인스타', 'instagram', '트위터',
            '스크롤', '내려', '올려', '클릭해'
        ]
        const lowerText = text.toLowerCase()
        return browserKeywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
    }

    // URL 추출 함수
    const extractUrlFromContent = (text: string): string | null => {
        const lowerText = text.toLowerCase()

        // 직접 URL이 있는 경우
        const urlMatch = text.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i)
        if (urlMatch) {
            let url = urlMatch[0]
            if (!url.startsWith('http')) url = 'https://' + url
            return url
        }

        // 사이트명으로 URL 추론
        if (lowerText.includes('네이버')) return 'https://www.naver.com'
        if (lowerText.includes('구글') || lowerText.includes('google')) return 'https://www.google.com'
        if (lowerText.includes('유튜브') || lowerText.includes('youtube')) return 'https://www.youtube.com'
        if (lowerText.includes('다음') || lowerText.includes('daum')) return 'https://www.daum.net'
        if (lowerText.includes('카카오')) return 'https://www.kakaocorp.com'
        if (lowerText.includes('쿠팡')) return 'https://www.coupang.com'
        if (lowerText.includes('11번가') || lowerText.includes('11st')) return 'https://www.11st.co.kr'
        if (lowerText.includes('지마켓') || lowerText.includes('g마켓') || lowerText.includes('gmarket')) return 'https://www.gmarket.co.kr'
        if (lowerText.includes('옥션') || lowerText.includes('auction')) return 'https://www.auction.co.kr'
        if (lowerText.includes('무신사') || lowerText.includes('musinsa')) return 'https://www.musinsa.com'
        if (lowerText.includes('올리브영')) return 'https://www.oliveyoung.co.kr'
        if (lowerText.includes('야놀자')) return 'https://www.yanolja.com'
        if (lowerText.includes('여기어때')) return 'https://www.goodchoice.kr'
        if (lowerText.includes('배달의민족') || lowerText.includes('배민')) return 'https://www.baemin.com'
        if (lowerText.includes('당근마켓') || lowerText.includes('당근')) return 'https://www.daangn.com'
        if (lowerText.includes('인스타그램') || lowerText.includes('instagram')) return 'https://www.instagram.com'
        if (lowerText.includes('페이스북') || lowerText.includes('facebook')) return 'https://www.facebook.com'
        if (lowerText.includes('트위터') || lowerText.includes('twitter') || lowerText.includes('x.com')) return 'https://x.com'

        // 검색어가 있는 경우 구글 검색
        const searchMatch = text.match(/['""]([^'""]+)['""]/)?.[1] ||
            text.match(/검색[해줘\s]*(.+?)($|로|을|를)/)?.[1]?.trim()
        if (searchMatch) {
            return `https://search.naver.com/search.naver?query=${encodeURIComponent(searchMatch)}`
        }

        // 🔥 맛집/추천/날씨 등 검색 의도 감지 시 네이버 검색
        const searchIntentKeywords = ['맛집', '추천', '날씨', '뉴스', '영화', '카페', '병원', '약국', '호텔', '가격', '리뷰', '후기']
        const actionKeywords = ['해줘', '해주세요', '알려줘', '알려주세요', '찾아줘', '찾아주세요', '보여줘', '보여주세요']

        const hasSearchIntent = searchIntentKeywords.some(k => lowerText.includes(k))
        const hasActionWord = actionKeywords.some(k => lowerText.includes(k))

        if (hasSearchIntent || hasActionWord) {
            // 조사와 동사를 제거하고 검색 키워드 추출
            let query = text
                .replace(/해줘|해주세요|알려줘|알려주세요|찾아줘|찾아주세요|보여줘|보여주세요|추천|좀|좀요|요/g, '')
                .trim()
            if (query.length > 1) {
                return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`
            }
        }

        return null
    }

    const sendMessageWithContent = async (content: string, currentMessages: Message[] = []) => {
        if (!content.trim() || isLoading) return

        const userMessage: Message = { role: 'user', content: content.trim() }
        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        try {
            // 🔥 브라우저 작업 감지 시 Stagehand 사용
            if (isBrowserTask(content)) {
                // 🔥 브라우저 패널 자동 열기 및 URL 설정
                const initialUrl = extractUrlFromContent(content)
                if (initialUrl) {
                    setBrowserOpen(true)
                    setBrowserUrl(initialUrl)
                }

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '🚀 브라우저를 제어하고 있습니다... 잠시만 기다려주세요.',
                    browserAction: true
                }])

                // Super Agent의 browser_automation 도구 사용 (Stagehand)
                const response = await fetch('/api/agents/super/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: content,
                        chatHistory: currentMessages.map(m => ({ role: m.role, content: m.content })),
                    })
                })

                const data = await response.json()

                // 🔥 Stagehand 결과에서 최종 URL 추출하여 BrowserPanel에 반영
                if (data.browserUrl) {
                    setBrowserUrl(data.browserUrl)
                } else if (data.toolResults) {
                    // toolResults에서 currentUrl 찾기
                    const browserResult = data.toolResults?.find((t: any) =>
                        t.type === 'browser_automation' || t.currentUrl
                    )
                    if (browserResult?.currentUrl) {
                        setBrowserUrl(browserResult.currentUrl)
                    }
                }

                // 마지막 "브라우저 제어 중" 메시지 제거하고 실제 결과로 교체
                setMessages(prev => {
                    const filtered = prev.filter((m, i) =>
                        !(i === prev.length - 1 && m.content.includes('브라우저를 제어하고 있습니다'))
                    )
                    if (data.error) {
                        return [...filtered, { role: 'assistant', content: `오류: ${data.error}` }]
                    } else if (data.response) {
                        return [...filtered, { role: 'assistant', content: data.response }]
                    } else {
                        return [...filtered, { role: 'assistant', content: '응답을 받지 못했습니다.' }]
                    }
                })
            } else {
                // 🔥 일반 Super Agent 채팅 (도구 사용 가능)
                const response = await fetch('/api/agents/super/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: content,
                        chatHistory: currentMessages.map(m => ({
                            role: m.role,
                            content: m.content
                        })),
                    })
                })

                const data = await response.json()
                if (data.error) {
                    console.error('API Error:', data.error)
                    setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${data.error}` }])
                } else if (data.response) {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
                } else if (data.content) {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: '응답을 받지 못했습니다.' }])
                }
            }
        } catch (error) {
            console.error('Chat error:', error)
            setMessages(prev => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' }])
        } finally {
            setIsLoading(false)
        }
    }

    // Send initial query if provided (use ref to prevent double-send in Strict Mode)
    useEffect(() => {
        if (initialQuery && !hasSentInitialRef.current) {
            hasSentInitialRef.current = true
            sendMessageWithContent(initialQuery, [])
        }
    }, [initialQuery])

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return
        const content = input.trim()
        setInput('')
        await sendMessageWithContent(content, messages)
    }

    return (
        <div ref={containerRef} className={cn("flex h-[calc(100vh-120px)]", isResizing && "select-none cursor-col-resize [&_webview]:pointer-events-none [&_iframe]:pointer-events-none")}>
            {/* Browser Panel (Left) */}
            <AnimatePresence>
                {browserOpen && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: `${browserWidth}%`, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{
                            duration: isResizing ? 0 : 0.2,
                            ease: "easeOut"
                        }}
                        className="h-full relative flex-shrink-0 overflow-hidden"
                        style={{ minWidth: '300px' }}
                    >
                        <BrowserPanel
                            currentUrl={browserUrl}
                            isLoading={browserLoading}
                            onClose={handleBrowserClose}
                            onUrlChange={setBrowserUrl}
                            isExpanded={browserExpanded}
                            onToggleExpand={() => setBrowserExpanded(!browserExpanded)}
                            onNavigate={(url) => setBrowserUrl(url)}
                        />
                        {/* 리사이징 중 이벤트 가로채기 방지 오버레이 */}
                        {isResizing && (
                            <div className="absolute inset-0 bg-transparent z-40 cursor-col-resize" />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Resize Handle - 얇고 호버시에만 표시 */}
            {browserOpen && (
                <div
                    className="w-0 flex-shrink-0 cursor-col-resize relative group z-50"
                    onMouseDown={handleMouseDown}
                    style={{ touchAction: 'none' }}
                >
                    {/* 넓은 히트 영역 (투명) */}
                    <div
                        className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize z-50"
                        onMouseDown={handleMouseDown}
                    />
                    {/* 호버/드래그 시에만 보이는 라인 */}
                    <div className={cn(
                        "absolute inset-y-0 -left-px w-0.5 transition-all duration-150",
                        isResizing
                            ? "bg-blue-500 w-1"
                            : "bg-transparent group-hover:bg-blue-500/70"
                    )} />
                </div>
            )}

            {/* Chat Area (Right) */}
            <div className="flex-1 flex flex-col min-w-0" style={{ minWidth: '350px' }}>
                {/* Chat Header */}
                <header className="flex items-center gap-4 h-16 px-4 border-b border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </button>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">GlowUS AI Chat</h2>
                    {!browserOpen && (
                        <button
                            onClick={() => setBrowserOpen(true)}
                            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        >
                            <Globe className="w-4 h-4" />
                            브라우저 열기
                        </button>
                    )}
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto py-6 px-4">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.map((message, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "flex gap-4",
                                    message.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                )}
                                <div className={cn(
                                    "max-w-[75%] rounded-2xl px-5 py-4 select-text",
                                    message.role === 'user'
                                        ? "bg-blue-500 text-white"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                )}>
                                    <p className="text-base whitespace-pre-wrap leading-relaxed select-text">{message.content}</p>
                                    {message.browserAction && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                                            <Globe className="w-3 h-3" />
                                            <span>브라우저에서 확인하세요 →</span>
                                        </div>
                                    )}
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-10 h-10 rounded-full bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                                        <User className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-5 py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Fixed Bottom Input Area */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-zinc-200 dark:border-zinc-700">
                                <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white border-r border-zinc-200 dark:border-zinc-600">
                                    <Sparkles className="w-4 h-4" />
                                    슈퍼 에이전트
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                                    <Globe className="w-4 h-4" />
                                    웹 브라우저
                                </button>
                            </div>

                            {/* Input Field */}
                            <div className="p-4">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                    placeholder="무엇이든 물어보고 만들어보세요 (예: 네이버에서 맛집 검색해줘)"
                                    className="w-full bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 text-base focus:outline-none"
                                />
                            </div>

                            {/* Bottom Actions */}
                            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-700">
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                        <Search className="w-4 h-4" />
                                        웹 검색
                                    </button>
                                    <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                        <FileText className="w-5 h-5 text-zinc-500" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                        <Upload className="w-5 h-5 text-zinc-500" />
                                    </button>
                                    <button
                                        onClick={sendMessage}
                                        disabled={isLoading || !input.trim()}
                                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-5 h-5 text-zinc-500" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- Genspark Style Home with Chat ---
function WorksHome({ onOpenCreate, onStartChat }: { onOpenCreate: () => void, onStartChat: (query: string) => void }) {
    const router = useRouter()
    const [inputValue, setInputValue] = useState('')
    const [activeTab, setActiveTab] = useState<'agent' | 'general'>('agent')

    const agentTools = [
        { icon: LayoutGrid, label: "커스텀 슈퍼 에이전트", bg: "bg-zinc-700", color: "text-white" },
        { icon: FileText, label: "AI 슬라이드", bg: "bg-yellow-500", color: "text-white", href: "/dashboard-group/apps/ai-slides" },
        { icon: Sheet, label: "AI 시트", bg: "bg-emerald-500", color: "text-white", href: "/dashboard-group/apps/ai-sheet" },
        { icon: FileText, label: "AI 문서", bg: "bg-blue-600", color: "text-white", href: "/dashboard-group/apps/ai-docs" },
        { icon: Wrench, label: "AI 개발자", bg: "bg-zinc-700", color: "text-white" },
        { icon: Briefcase, label: "AI 디자이너", bg: "bg-zinc-700", color: "text-white" },
        { icon: Star, label: "클립 지니어스", bg: "bg-zinc-700", color: "text-white" },
        { icon: Bot, label: "AI 채팅", bg: "bg-blue-500", color: "text-white", badge: "무제한" },
        { icon: Download, label: "AI 이미지", bg: "bg-green-500", color: "text-white", badge: "무제한" },
        { icon: Upload, label: "AI 동영상", bg: "bg-zinc-700", color: "text-white" },
        { icon: FileText, label: "AI 회의 노트", bg: "bg-zinc-700", color: "text-white" },
        { icon: Briefcase, label: "모든 에이전트", bg: "bg-zinc-700", color: "text-white" },
    ]

    const generalTools: Array<{
        icon: any
        label: string
        bg: string
        shadow: string
        color: string
        active?: boolean
        href?: string
        badge?: string
    }> = [
        { icon: RiSparkling2Fill, label: "범용", bg: "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700", shadow: "shadow-blue-500/40 hover:shadow-blue-500/60", color: "text-white", active: true },
        { icon: BsFiletypeDoc, label: "문서", bg: "bg-gradient-to-br from-emerald-400 via-green-500 to-teal-600", shadow: "shadow-emerald-500/40 hover:shadow-emerald-500/60", color: "text-white", href: "/dashboard-group/apps/ai-docs" },
        { icon: BsFiletypePpt, label: "슬라이드", bg: "bg-gradient-to-br from-orange-400 via-orange-500 to-red-500", shadow: "shadow-orange-500/40 hover:shadow-orange-500/60", color: "text-white", href: "/dashboard-group/apps/ai-slides" },
        { icon: BsFileEarmarkSpreadsheet, label: "시트", bg: "bg-gradient-to-br from-green-400 via-emerald-500 to-green-700", shadow: "shadow-green-500/40 hover:shadow-green-500/60", color: "text-white", href: "/dashboard-group/apps/ai-sheet" },
        { icon: BsFileEarmarkImage, label: "포스터", bg: "bg-gradient-to-br from-pink-400 via-rose-500 to-pink-600", shadow: "shadow-pink-500/40 hover:shadow-pink-500/60", color: "text-white" },
        { icon: Globe, label: "웹사이트", bg: "bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600", shadow: "shadow-amber-500/40 hover:shadow-amber-500/60", color: "text-white" },
        { icon: FaRegFileCode, label: "코딩", bg: "bg-gradient-to-br from-cyan-400 via-teal-500 to-cyan-700", shadow: "shadow-cyan-500/40 hover:shadow-cyan-500/60", color: "text-white" },
        { icon: AiOutlineAppstoreAdd, label: "Apps +", bg: "bg-gradient-to-br from-purple-400 via-violet-500 to-purple-700", shadow: "shadow-purple-500/40 hover:shadow-purple-500/60", color: "text-white" },
    ]

    const handleToolClick = (tool: typeof generalTools[number]) => {
        if (tool.href) {
            router.push(tool.href)
        } else {
            onStartChat(tool.label)
        }
    }

    const handleSubmit = () => {
        if (inputValue.trim()) {
            onStartChat(inputValue.trim())
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            {/* Title */}
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-16">
                GlowUS AI 워크스페이스
            </h1>

            {/* Main Input */}
            <div className="w-full max-w-4xl mb-10 px-4">
                <div className="bg-white dark:bg-zinc-800/80 rounded-3xl p-6 border-2 border-zinc-300 dark:border-zinc-600 shadow-2xl focus-within:ring-0 focus-within:border-zinc-300 dark:focus-within:border-zinc-600">
                    <div className="flex items-center gap-4 mb-4">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            placeholder="요구사항을 입력하고, @를 입력하여 파일을 참조하세요"
                            className="flex-1 bg-transparent text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 text-base outline-none ring-0 border-0 focus:outline-none focus:ring-0 focus:border-0"
                            style={{ outline: 'none', boxShadow: 'none' }}
                        />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-3">
                            <button className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
                                <Home className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            </button>
                            <button className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
                                <Plus className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                            </button>
                        </div>
                        <button
                            onClick={handleSubmit}
                            className="p-3 bg-blue-500 hover:bg-blue-600 rounded-full transition-colors shadow-lg shadow-blue-500/25"
                        >
                            <Send className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>

            {/* General Tools */}
            <div className="w-full max-w-4xl flex flex-wrap justify-center gap-8 px-4">
                {generalTools.map((tool, idx) => (
                    <motion.button
                        key={idx}
                        whileHover={{ scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleToolClick(tool)}
                        className="flex flex-col items-center gap-3 group"
                    >
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                            tool.bg,
                            tool.shadow,
                            tool.active && "ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-950",
                            "group-hover:shadow-xl"
                        )}>
                            <tool.icon className={cn("w-7 h-7 drop-shadow-sm", tool.color)} />
                        </div>
                        <span className={cn(
                            "text-xs text-center font-medium transition-colors",
                            tool.active ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                        )}>
                            {tool.label}
                        </span>
                        {tool.badge && (
                            <span className={cn(
                                "absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded text-white",
                                tool.badge === 'Free' ? "bg-red-500" : "bg-pink-500"
                            )}>
                                {tool.badge}
                            </span>
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

export default function WorksPage() {
    const { accentColor } = useThemeStore()
    const searchParams = useSearchParams()
    const tab = searchParams.get('tab')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [initialQuery, setInitialQuery] = useState('')

    const handleStartChat = (query: string) => {
        setInitialQuery(query)
        setIsChatOpen(true)
    }

    return (
        <div className="flex h-[calc(100vh-64px)] -m-8">
            {/* --- Main Content Area --- */}
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 p-8 overflow-y-auto">
                {isChatOpen ? (
                    <ChatView onBack={() => { setIsChatOpen(false); setInitialQuery(''); }} initialQuery={initialQuery} />
                ) : tab === 'tools' ? (
                    <ToolsView />
                ) : (
                    <WorksHome
                        onOpenCreate={() => setIsCreateModalOpen(true)}
                        onStartChat={handleStartChat}
                    />
                )}
            </div>

            <CreateWorkModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    )
}
