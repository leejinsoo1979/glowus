"use client"

import {
    FileText,
    Download,
    Copy,
    Play,
    Eye,
    Code,
    Brain
} from "lucide-react"
import { Edit2, Eye as EyeIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SlideContent } from "../types"

interface PreviewHeaderProps {
    presentationTitle: string
    setPresentationTitle: (title: string) => void
    slides: SlideContent[]
    editMode: boolean
    setEditMode: (mode: boolean) => void
    isLoading: boolean
    savePresentation: () => void
    exportToPPTX: () => void
}

export const PreviewHeader = ({
    presentationTitle,
    setPresentationTitle,
    slides,
    editMode,
    setEditMode,
    isLoading,
    savePresentation,
    exportToPPTX,
}: PreviewHeaderProps) => {
    return (
        <div className="flex items-center justify-between h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-zinc-500" />
                <input
                    type="text"
                    value={presentationTitle}
                    onChange={(e) => setPresentationTitle(e.target.value)}
                    className="text-zinc-900 dark:text-white font-medium bg-transparent border-none outline-none"
                />
                {slides.length > 0 && (
                    <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                        저장 자동-{slides.length}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                {slides.length > 0 && (
                    <>
                        {/* Edit Mode Toggle */}
                        <button
                            onClick={() => setEditMode(!editMode)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors",
                                editMode
                                    ? "bg-accent text-white"
                                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            )}
                            title={editMode ? "미리보기 모드" : "편집 모드"}
                        >
                            {editMode ? <EyeIcon className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            {editMode ? "미리보기" : "편집"}
                        </button>
                        <button
                            onClick={savePresentation}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                        >
                            <Copy className="w-4 h-4" />
                            저장
                        </button>
                        <button
                            onClick={() => {/* TODO: Present mode */}}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                        >
                            <Play className="w-4 h-4" />
                            발표
                        </button>
                    </>
                )}
                <button
                    onClick={exportToPPTX}
                    disabled={slides.length === 0 || isLoading}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Download className="w-4 h-4" />
                    PPTX 내보내기
                </button>
            </div>
        </div>
    )
}

interface PreviewTabsProps {
    activeTab: 'preview' | 'research' | 'code' | 'thinking'
    setActiveTab: (tab: 'preview' | 'research' | 'code' | 'thinking') => void
    slides: SlideContent[]
    currentSlide: number
}

export const PreviewTabs = ({
    activeTab,
    setActiveTab,
    slides,
    currentSlide,
}: PreviewTabsProps) => {
    const tabs = [
        { id: 'preview' as const, label: '미리보기', icon: Eye },
        { id: 'research' as const, label: '리서치', icon: FileText },
        { id: 'code' as const, label: '코드', icon: Code },
        { id: 'thinking' as const, label: '생각 중', icon: Brain }
    ]

    return (
        <div className="flex items-center gap-4 px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors",
                        activeTab === tab.id
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    )}
                >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                </button>
            ))}
            {slides.length > 0 && (
                <span className="ml-auto text-sm text-zinc-500">
                    {currentSlide + 1} / {slides.length}
                </span>
            )}
        </div>
    )
}
