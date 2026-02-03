"use client"

import { RefObject } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ChevronLeft,
    ChevronRight,
    Loader2,
    FileText,
    Upload,
    FolderOpen
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SlideRenderer } from "./SlideRenderer"
import type { SlideContent } from "../types"

interface SlidePreviewPanelProps {
    slides: SlideContent[]
    currentSlide: number
    editingSlide: number | null
    setCurrentSlide: (index: number) => void
    setShowLoadMenu: (show: boolean) => void
    fileInputRef: RefObject<HTMLInputElement>
}

export const SlidePreviewPanel = ({
    slides,
    currentSlide,
    editingSlide,
    setCurrentSlide,
    setShowLoadMenu,
    fileInputRef,
}: SlidePreviewPanelProps) => {
    if (slides.length === 0) {
        return <EmptyState setShowLoadMenu={setShowLoadMenu} fileInputRef={fileInputRef} />
    }

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="h-full flex flex-col min-h-0">
                {/* Main Slide View */}
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xl relative">
                    {editingSlide === currentSlide && (
                        <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-accent" />
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="h-full"
                        >
                            <SlideRenderer slide={slides[currentSlide]} />
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation */}
                <SlideNavigation
                    slides={slides}
                    currentSlide={currentSlide}
                    setCurrentSlide={setCurrentSlide}
                />

                {/* Slide Thumbnails */}
                <SlideThumbnails
                    slides={slides}
                    currentSlide={currentSlide}
                    setCurrentSlide={setCurrentSlide}
                />
            </div>
        </div>
    )
}

// Sub-components

const EmptyState = ({
    setShowLoadMenu,
    fileInputRef,
}: {
    setShowLoadMenu: (show: boolean) => void
    fileInputRef: RefObject<HTMLInputElement>
}) => (
    <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
            <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                <FileText className="w-10 h-10 text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-xl font-medium text-zinc-900 dark:text-white mb-2">슬라이드 미리보기</h3>
            <p className="text-zinc-500 text-sm mb-6">
                왼쪽 채팅창에서 슬라이드 생성을 요청하세요
            </p>
            <div className="flex gap-3 justify-center">
                <button
                    onClick={() => setShowLoadMenu(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg transition-colors"
                >
                    <FolderOpen className="w-4 h-4" />
                    불러오기
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white rounded-lg transition-colors"
                >
                    <Upload className="w-4 h-4" />
                    파일 업로드
                </button>
            </div>
        </div>
    </div>
)

const SlideNavigation = ({
    slides,
    currentSlide,
    setCurrentSlide,
}: {
    slides: SlideContent[]
    currentSlide: number
    setCurrentSlide: (index: number) => void
}) => (
    <div className="flex items-center justify-center gap-4 mt-4">
        <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-lg transition-colors"
        >
            <ChevronLeft className="w-5 h-5 text-zinc-700 dark:text-white" />
        </button>
        <div className="flex items-center gap-2 overflow-x-auto max-w-md">
            {slides.map((_, i) => (
                <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                        "w-2 h-2 rounded-full transition-colors flex-shrink-0",
                        i === currentSlide ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600"
                    )}
                />
            ))}
        </div>
        <button
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50 rounded-lg transition-colors"
        >
            <ChevronRight className="w-5 h-5 text-zinc-700 dark:text-white" />
        </button>
    </div>
)

const SlideThumbnails = ({
    slides,
    currentSlide,
    setCurrentSlide,
}: {
    slides: SlideContent[]
    currentSlide: number
    setCurrentSlide: (index: number) => void
}) => (
    <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
        {slides.map((slide, i) => (
            <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                    "flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden border-2 transition-colors",
                    i === currentSlide ? "border-accent" : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                )}
            >
                <div className="w-full h-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-600 dark:text-zinc-400">
                    {i + 1}. {slide.title.slice(0, 10)}...
                </div>
            </button>
        ))}
    </div>
)
