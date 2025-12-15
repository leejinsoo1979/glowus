"use client"

import React, { useState } from 'react'
import { Youtube, FileText, Globe, Type, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
    { id: 'youtube', label: '유튜브', icon: Youtube },
    { id: 'document', label: '문서', icon: FileText },
    { id: 'website', label: '웹사이트', icon: Globe },
    { id: 'text', label: '텍스트', icon: Type },
]

interface SummarySidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
}

export function SummarySidebar({ activeTab, onTabChange }: SummarySidebarProps) {

    const renderSidebarContent = () => {
        switch (activeTab) {
            case 'youtube':
                return (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 mb-20 text-center">
                        <div className="w-16 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-4">
                            <Youtube className="w-8 h-8 text-red-500 opacity-80" />
                        </div>
                        <p className="text-sm font-medium text-zinc-400">클릭 한 번으로 유튜브 영상을<br />요약해 드려요!</p>
                    </div>
                )
            case 'document':
                return (
                    <div className="flex-1 flex flex-col pt-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-white mb-1">요약하고 싶은 문서를 업로드해 주세요</h3>
                            <p className="text-[10px] text-zinc-500">.pdf, .docx 파일 1개(100MB 이하) 업로드 가능</p>
                        </div>

                        <div className="flex-1 flex flex-col gap-2">
                            {/* File Input Mock */}
                            <div className="flex gap-2 h-10">
                                <div className="flex-1 bg-zinc-800 rounded-md px-3 flex items-center text-xs text-zinc-500 border border-zinc-700/50">
                                    파일을 업로드해 주세요
                                </div>
                                <button className="px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-md flex items-center gap-1.5 transition-colors">
                                    <Plus className="w-3 h-3 text-emerald-500" />
                                    <span className="text-xs font-medium text-white">파일 추가</span>
                                </button>
                            </div>
                        </div>

                        <button className="w-full h-10 mt-auto mb-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-xs rounded-lg transition-colors">
                            완벽 요약
                        </button>
                    </div>
                )
            case 'website':
                return (
                    <div className="flex-1 flex flex-col pt-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-white mb-1">요약하고 싶은 웹사이트 링크를 입력해 주세요</h3>
                        </div>

                        <div className="flex-1 flex flex-col gap-2">
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                    <Globe className="w-3.5 h-3.5" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="https://"
                                    className="w-full h-10 bg-zinc-800 border border-zinc-700/50 rounded-md pl-9 pr-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                                />
                            </div>
                        </div>

                        <button className="w-full h-10 mt-auto mb-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-xs rounded-lg transition-colors">
                            완벽 요약
                        </button>
                    </div>
                )
            case 'text':
                return (
                    <div className="flex-1 flex flex-col pt-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-bold text-white mb-1">요약하고 싶은 내용을 입력해 주세요</h3>
                        </div>

                        <div className="flex-1 flex flex-col gap-2 relative">
                            <textarea
                                placeholder="요약하고 싶은 내용을 입력해 주세요"
                                className="w-full flex-1 bg-zinc-800 border border-zinc-700/50 rounded-md p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all resize-none"
                            />
                            <div className="absolute bottom-3 right-3 text-[10px] text-zinc-500">
                                0/20000
                            </div>
                        </div>

                        <button className="w-full h-10 mt-6 mb-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium text-xs rounded-lg transition-colors">
                            완벽 요약
                        </button>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="w-[360px] bg-zinc-900 border-r border-zinc-800 flex flex-col h-full p-6 pt-8 flex-shrink-0">
            {/* Title */}
            <h1 className="text-xl font-bold text-white mb-2">AI 완벽요약</h1>

            {/* Tab Navigation */}
            <div className="flex w-full border-b border-zinc-800 mb-4 mt-4">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "flex-1 pb-3 text-sm font-medium transition-all relative text-center",
                            activeTab === tab.id
                                ? "text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Dynamic Content Area */}
            {renderSidebarContent()}

        </div>
    )
}
