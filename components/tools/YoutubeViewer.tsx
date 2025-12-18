"use client"

import React, { useState, useRef } from 'react'
import { Youtube, Clock, Eye, Calendar, Copy, Check, Search, X, MoreVertical, ChevronDown, MessageSquare, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TranscriptItem {
    timestamp: string
    text: string
}

interface VideoInfo {
    id: string
    title: string
    channel: string
    date: string
    views: string
    thumbnail: string
}

interface SummaryHistory {
    id: string
    title: string
    channel: string
    createdAt: string
}

interface ChapterItem {
    title: string
    timestamp: string
    content: string
    details?: string[]
}

interface CommentItem {
    id: string
    author: string
    authorImage: string
    text: string
    likes: number
    date: string
}

interface YoutubeViewerProps {
    videoId: string | null
    videoInfo?: VideoInfo | null
    transcript?: TranscriptItem[]
    chapters?: ChapterItem[]  // timeline 데이터
    comments?: CommentItem[]
    isLoading?: boolean
    recentSummaries?: SummaryHistory[]
}

export function YoutubeViewer({
    videoId,
    videoInfo,
    transcript = [],
    chapters = [],
    comments = [],
    isLoading = false,
    recentSummaries = []
}: YoutubeViewerProps) {
    const [activeTab, setActiveTab] = useState<'chapter' | 'script'>('script')
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [showTimestamps, setShowTimestamps] = useState(true)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // 검색 필터링
    const filteredTranscript = searchQuery
        ? transcript.filter(item =>
            item.text.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : transcript

    // 타임스탬프 클릭 시 영상 이동
    const handleTimestampClick = (timestamp: string) => {
        const parts = timestamp.split(':').map(Number)
        let seconds = 0
        if (parts.length === 3) {
            seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        } else if (parts.length === 2) {
            seconds = parts[0] * 60 + parts[1]
        }

        if (iframeRef.current && iframeRef.current.contentWindow) {
            // YouTube IFrame API로 시간 이동 (postMessage 사용)
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [seconds, true]
            }), '*')
            // 재생 시작
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'playVideo',
                args: []
            }), '*')
        }
    }

    // 전체 스크립트 복사
    const handleCopyAll = () => {
        const text = transcript.map(t => `${t.timestamp} ${t.text}`).join('\n')
        navigator.clipboard.writeText(text)
    }

    return (
        <div className="h-full flex bg-white dark:bg-zinc-950 overflow-hidden">
            {/* 왼쪽: 영상 (고정) + 댓글 (별도 스크롤) */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* 영상 제목 헤더 - 고정 */}
                <div className="flex-shrink-0 h-[49px] flex items-center px-4 border-b border-zinc-200 dark:border-zinc-800">
                    {videoInfo ? (
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-1">
                            {videoInfo.title}
                        </h2>
                    ) : (
                        <h2 className="text-sm font-semibold text-zinc-500">
                            유튜브 영상 요약
                        </h2>
                    )}
                </div>

                {/* 영상 플레이어 - 고정 */}
                <div className="flex-shrink-0 w-full bg-black">
                    <div className="w-full aspect-video">
                        {videoId ? (
                            <iframe
                                ref={iframeRef}
                                src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center">
                                <Youtube className="w-16 h-16 text-zinc-700 mb-4" />
                                <p className="text-zinc-500 text-sm">유튜브 링크를 입력하세요</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 영상 정보 (채널, 날짜, 조회수) - 고정 */}
                {videoInfo && (
                    <div className="flex-shrink-0 px-4 py-3 bg-zinc-100 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">{videoInfo.channel}</span>
                            {videoInfo.date && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {videoInfo.date}
                                </span>
                            )}
                            {videoInfo.views && (
                                <span className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    {videoInfo.views}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* 댓글 섹션 - 별도 스크롤 컨테이너 */}
                {videoId && (
                    <div className="flex-1 min-h-0 overflow-y-auto border-t border-zinc-200 dark:border-zinc-800">
                        <div className="p-4">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                댓글 {comments.length > 0 ? `${comments.length}개` : ''}
                            </h3>
                            {comments.length > 0 && (
                                <div className="space-y-4">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-3">
                                            <img
                                                src={comment.authorImage}
                                                alt={comment.author}
                                                className="w-8 h-8 rounded-full flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                                        {comment.author}
                                                    </span>
                                                    <span className="text-xs text-zinc-500">
                                                        {comment.date}
                                                    </span>
                                                </div>
                                                <p
                                                    className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap"
                                                    dangerouslySetInnerHTML={{ __html: comment.text }}
                                                />
                                                {comment.likes > 0 && (
                                                    <div className="flex items-center gap-1 mt-2 text-xs text-zinc-500">
                                                        <ThumbsUp className="w-3.5 h-3.5" />
                                                        <span>{comment.likes}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 오른쪽: 동영상 정보 패널 (Mapify 스타일) - videoId 있을 때만 표시 */}
            {videoId && (
            <div className="w-[340px] flex-shrink-0 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full">
                {/* 패널 헤더 - 왼쪽 제목과 같은 높이 */}
                <div className="flex items-center justify-between px-4 h-[49px] border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">동영상 정보</h3>
                    <div className="flex items-center gap-1">
                        <div className="relative">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                            >
                                <MoreVertical className="w-4 h-4 text-zinc-500" />
                            </button>
                            {isMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg z-20 py-1">
                                        <button
                                            onClick={() => {
                                                setShowTimestamps(!showTimestamps)
                                                setIsMenuOpen(false)
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                            타임스탬프 {showTimestamps ? '숨기기' : '표시'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                handleCopyAll()
                                                setIsMenuOpen(false)
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                                        >
                                            전체 복사
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors">
                            <X className="w-4 h-4 text-zinc-500" />
                        </button>
                    </div>
                </div>

                {/* 탭 버튼 */}
                <div className="flex px-4 pt-3 gap-2">
                    <button
                        onClick={() => setActiveTab('chapter')}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                            activeTab === 'chapter'
                                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                    >
                        챕터
                    </button>
                    <button
                        onClick={() => setActiveTab('script')}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                            activeTab === 'script'
                                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                    >
                        스크립트
                    </button>
                </div>

                {/* 검색창 */}
                <div className="px-4 py-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="동영상에서 검색"
                            className="w-full h-9 bg-zinc-100 dark:bg-zinc-800 border-0 rounded-lg pl-9 pr-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2"
                            >
                                <X className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 스크립트 목록 */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-sm text-zinc-500">스크립트를 불러오는 중...</p>
                            </div>
                        </div>
                    ) : activeTab === 'script' ? (
                        <div className="px-4 pb-4">
                            {filteredTranscript.length > 0 ? (
                                <div className="space-y-0.5">
                                    {filteredTranscript.map((item, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleTimestampClick(item.timestamp)}
                                            className={cn(
                                                "w-full flex items-start py-2 px-2 -mx-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-lg transition-colors text-left group",
                                                showTimestamps ? "gap-3" : "gap-0"
                                            )}
                                        >
                                            {showTimestamps && (
                                                <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded">
                                                    {item.timestamp}
                                                </span>
                                            )}
                                            <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                {searchQuery ? (
                                                    // 검색어 하이라이트
                                                    item.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                                                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                                                            <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 text-zinc-900 dark:text-white px-0.5 rounded">
                                                                {part}
                                                            </mark>
                                                        ) : part
                                                    )
                                                ) : (
                                                    item.text
                                                )}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Search className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-3" />
                                    <p className="text-sm text-zinc-500">"{searchQuery}"에 대한 검색 결과가 없습니다</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <p className="text-sm text-zinc-500">스크립트가 없습니다</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        // 챕터 탭 (타임라인 기반)
                        <div className="px-4 pb-4">
                            {chapters.length > 0 ? (
                                <div className="space-y-3">
                                    {chapters.map((chapter, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleTimestampClick(chapter.timestamp)}
                                            className="w-full text-left p-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors group"
                                        >
                                            <div className={cn("flex items-start", showTimestamps ? "gap-3" : "gap-0")}>
                                                {showTimestamps && (
                                                    <span className="flex-shrink-0 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded">
                                                        {chapter.timestamp}
                                                    </span>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-1">
                                                        {chapter.title}
                                                    </h4>
                                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                                                        {chapter.content}
                                                    </p>
                                                    {chapter.details && chapter.details.length > 0 && (
                                                        <ul className="mt-2 space-y-1">
                                                            {chapter.details.slice(0, 3).map((detail, i) => (
                                                                <li key={i} className="text-xs text-zinc-500 dark:text-zinc-500 flex items-start gap-1.5">
                                                                    <span className="text-zinc-400 mt-0.5">•</span>
                                                                    <span className="line-clamp-1">{detail}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Clock className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mb-3" />
                                    <p className="text-sm text-zinc-500">챕터 정보가 없습니다</p>
                                    <p className="text-xs text-zinc-400 mt-1">스크립트 탭에서 내용을 확인하세요</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 하단: 언어 정보 & 복사 버튼 */}
                <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">한국어 (자동 생성됨)</span>
                        <ChevronDown className="w-3 h-3 text-zinc-400" />
                    </div>
                    <button
                        onClick={handleCopyAll}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        전체 복사
                    </button>
                </div>
            </div>
            )}
        </div>
    )
}
