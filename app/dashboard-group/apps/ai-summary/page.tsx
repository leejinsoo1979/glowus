"use client"

import React, { useState } from 'react'
import { SummarySidebar } from '@/components/tools/SummarySidebar'
import { YoutubeViewer } from '@/components/tools/YoutubeViewer'
import { useAIAppSync } from "@/hooks/useAIAppSync"

// 유튜브 URL에서 비디오 ID 추출
function extractYoutubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

// 임시 더미 데이터
const DUMMY_SUMMARIES = [
    {
        id: '1',
        title: 'AI 에이전트 도입하려면 꼭 알아야 할 것 (이주환 스윗테크놀러지스 대표)',
        channel: '티타임즈TV',
        createdAt: new Date().toISOString(),
    },
    {
        id: '2',
        title: 'n8n 유료 결제 하지 마세요. 평생 \'0원\'으로 쓰는 법 알려드립니다.',
        channel: '노코드로',
        createdAt: new Date().toISOString(),
    },
]

export default function AiSummaryPage() {
    const [activeTab, setActiveTab] = useState('youtube')
    const [videoId, setVideoId] = useState<string | null>(null)
    const [videoInfo, setVideoInfo] = useState<any>(null)
    const [transcript, setTranscript] = useState<any[]>([])
    const [comments, setComments] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [summary, setSummary] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    // 🔥 DB 동기화 훅
    const { saveMessage: saveToDb, updateThreadTitle, updateThreadMetadata } = useAIAppSync({
        appType: 'summary',
        autoCreateThread: true,
    })

    const handleYoutubeSubmit = async (url: string) => {
        const id = extractYoutubeId(url)
        if (!id) {
            alert('유효한 유튜브 링크를 입력해주세요')
            return
        }

        // 🔥 사용자 요청 DB에 저장
        saveToDb({ role: 'user', content: `YouTube 영상 요약: ${url}` })

        // 즉시 영상 보여주기
        setVideoId(id)
        setVideoInfo(null)
        setTranscript([])
        setComments([])
        setSummary(null)
        setError(null)
        setIsLoading(true)

        try {
            // 1단계: 영상 정보만 빠르게 가져오기
            const infoResponse = await fetch('/api/youtube/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: id })
            })

            if (infoResponse.ok) {
                const infoData = await infoResponse.json()
                setVideoInfo(infoData.videoInfo)
                setComments(infoData.comments || [])
            }

            // 2단계: 요약 가져오기 (백그라운드)
            const response = await fetch('/api/youtube/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, videoId: id })
            })

            const data = await response.json()

            if (response.ok) {
                setVideoInfo(data.videoInfo)
                setTranscript(data.transcript || [])
                setComments(data.comments || [])
                setSummary(data.summary)

                // 🔥 요약 완료 DB에 저장
                const videoTitle = data.videoInfo?.title || '영상 제목 없음'
                saveToDb({ role: 'assistant', content: `영상 요약 완료: ${videoTitle}`, metadata: { videoId: id, videoTitle, summary: data.summary } })
                updateThreadTitle(videoTitle.slice(0, 50))
                updateThreadMetadata({ videoId: id, videoInfo: data.videoInfo, summary: data.summary })
            } else {
                // 에러 메시지 표시
                setError(data.error || '요약 생성에 실패했습니다')
                console.error('Summarize API error:', data.error)
                // 🔥 에러 DB에 저장
                saveToDb({ role: 'assistant', content: `요약 생성 실패: ${data.error || '알 수 없는 오류'}` })
            }
        } catch (error) {
            console.error('Failed to fetch transcript:', error)
            setError('네트워크 오류가 발생했습니다')
            // 🔥 에러 DB에 저장
            saveToDb({ role: 'assistant', content: '네트워크 오류가 발생했습니다' })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex h-[calc(100vh-64px)] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">
            {/* 왼쪽: 영상 뷰어 + 스크립트 */}
            <div className="flex-1 h-full overflow-hidden">
                <YoutubeViewer
                    videoId={videoId}
                    videoInfo={videoInfo}
                    transcript={transcript}
                    chapters={summary?.timeline || []}
                    comments={comments}
                    isLoading={isLoading}
                    recentSummaries={DUMMY_SUMMARIES}
                />
            </div>

            {/* 오른쪽: 채팅창 + AI 요약 */}
            <div className="h-full flex-shrink-0">
                <SummarySidebar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onYoutubeSubmit={handleYoutubeSubmit}
                    summary={summary}
                    isLoading={isLoading}
                    error={error}
                />
            </div>
        </div>
    )
}
