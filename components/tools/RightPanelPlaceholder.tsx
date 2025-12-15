"use client"

import React from 'react'
import { FolderOpen, AppWindow, StickyNote } from 'lucide-react'

interface RightPanelPlaceholderProps {
    mode: 'document' | 'website' | 'text'
}

export function RightPanelPlaceholder({ mode }: RightPanelPlaceholderProps) {

    const getContent = () => {
        switch (mode) {
            case 'document':
                return {
                    icon: FolderOpen,
                    color: 'text-yellow-400',
                    bg: 'bg-yellow-400/10', // Just for subtle glow if needed, though screenshot shows clean icon
                    text: '클릭 한 번으로 문서 파일을\n요약해 드려요!'
                }
            case 'website':
                return {
                    icon: AppWindow, // Browser-like icon
                    color: 'text-blue-400',
                    bg: 'bg-blue-400/10',
                    text: '클릭 한 번으로 웹사이트를\n요약해 드려요!'
                }
            case 'text':
                return {
                    icon: StickyNote,
                    color: 'text-pink-400',
                    bg: 'bg-pink-400/10',
                    text: '클릭 한 번으로 긴 글을\n요약해 드려요!'
                }
        }
    }

    const content = getContent()
    const Icon = content.icon

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <div className={`w-20 h-16 rounded-xl flex items-center justify-center mb-6`}>
                <Icon className={`w-12 h-12 ${content.color} drop-shadow-lg`} strokeWidth={1.5} />
                {/* Simulated folder/file look with icon */}
            </div>
            <h3 className="text-sm font-bold text-zinc-300 whitespace-pre-line leading-relaxed">
                {content.text}
            </h3>
        </div>
    )
}
