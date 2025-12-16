"use client"

import React from 'react'
import { SummarySidebar } from '@/components/tools/SummarySidebar'
import { VideoGrid } from '@/components/tools/VideoGrid'
import { RightPanelPlaceholder } from '@/components/tools/RightPanelPlaceholder'
import { Globe, Search, Sparkles } from 'lucide-react'

export default function AiSummaryPage() {
    const [activeTab, setActiveTab] = React.useState('youtube')

    return (
        <div className="flex h-full bg-zinc-950 text-white overflow-hidden">
            {/* Sidebar */}
            <SummarySidebar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto">

                {/* Top Header (Nav) - Simplistic for now */}
                <div className="flex items-center justify-between px-8 py-4 bg-zinc-950 sticky top-0 z-10">
                    <h2 className="text-sm font-bold opacity-0">완벽 요약</h2> {/* Hidden Spacer or Title if needed */}
                </div>

                {/* Conditional Content based on Tab */}
                {activeTab === 'youtube' ? (
                    <div className="flex-1 max-w-5xl mx-auto w-full px-8 pb-20">
                        {/* Header Text */}
                        <div className="mt-8 mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-lg font-bold text-white">완벽 요약</h2>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <span>요약하고 싶은 유튜브 링크를 입력해 주세요</span>
                                <span className="flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/20">
                                    고급 모델 사용 중 <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                </span>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-zinc-300 transition-colors">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="https://"
                                    className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-lg pl-12 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                                />
                            </div>
                            <button className="px-6 h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm rounded-lg border border-zinc-700 transition-colors whitespace-nowrap">
                                완벽 요약
                            </button>
                        </div>

                        {/* Video Grid */}
                        <VideoGrid />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center p-8">
                        <RightPanelPlaceholder mode={activeTab as any} />
                    </div>
                )}
            </div>
        </div>
    )
}
