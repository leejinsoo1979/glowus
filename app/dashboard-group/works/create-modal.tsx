"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
    X,
    Layout,
    ArrowDownToLine,
    PencilRuler,
    FolderPlus,
    ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CreateWorkModalProps {
    isOpen: boolean
    onClose: () => void
}

export function CreateWorkModal({ isOpen, onClose }: CreateWorkModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }}
                        animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                        exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-40%" }}
                        transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-8 pb-4">
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white leading-tight">
                                원하는 앱을<br />
                                간편하게 만들어보세요!
                            </h2>
                        </div>

                        {/* List Options */}
                        <div className="p-4 space-y-2">

                            <OptionItem
                                icon={Layout}
                                title="템플릿 선택"
                                description="다양한 샘플 템플릿을 사용하여 앱을 생성합니다."
                            />

                            <OptionItem
                                icon={ArrowDownToLine}
                                title="파일 가져오기"
                                description="dwt 형식의 템플릿 파일을 가져와 앱을 생성합니다."
                            />

                            <OptionItem
                                icon={PencilRuler}
                                title="처음부터 만들기"
                                description="직접 컴포넌트를 추가하여 처음부터 앱을 생성합니다."
                                onClick={() => {
                                    window.location.href = '/dashboard-group/works/new'
                                }}
                            />

                            <div className="my-4 h-px bg-zinc-100 dark:bg-zinc-800" />

                            <OptionItem
                                icon={FolderPlus}
                                title="폴더 만들기"
                                description="앱을 그룹화시킬 수 있는 폴더를 생성합니다."
                            />

                        </div>

                        {/* Close Button (Optional, usually clicking backdrop is enough but X is good UX) */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

function OptionItem({
    icon: Icon,
    title,
    description,
    onClick
}: {
    icon: any,
    title: string,
    description: string,
    onClick?: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left group"
        >
            {/* Icon Circle */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 group-hover:bg-white group-hover:shadow-sm dark:group-hover:bg-zinc-700 transition-all">
                <Icon className="w-6 h-6" strokeWidth={1.5} />
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 mb-1">
                    {title}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-snug break-keep">
                    {description}
                </p>
            </div>
        </button>
    )
}
