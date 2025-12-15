"use client"

import React, { useState } from 'react'
import {
    Type,
    AlignLeft,
    Hash,
    ChevronDown,
    CheckSquare,
    CircleDot,
    List,
    Calendar,
    Clock,
    Paperclip,
    User,
    Users,
    Table,
    UserPlus,
    CalendarCheck,
    UserCog,
    CalendarClock,
    Heading,
    Minus,
    Maximize,
    Columns,
    Calculator,
    Database,
    Link
} from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

// Component Categories
const CATEGORIES = [
    {
        id: 'data',
        title: '데이터 컴포넌트',
        items: [
            { type: 'text', label: '텍스트', icon: Type },
            { type: 'textarea', label: '멀티 텍스트', icon: AlignLeft },
            { type: 'number', label: '숫자', icon: Hash },
            { type: 'file', label: '파일첨부', icon: Paperclip },
            { type: 'date', label: '날짜', icon: Calendar },
            { type: 'time', label: '시간', icon: Clock },
            { type: 'checkbox', label: '체크박스', icon: CheckSquare },
            { type: 'select', label: '단일 선택', icon: CircleDot },
        ]
    },
    {
        id: 'design',
        title: '디자인 컴포넌트',
        items: [
            { type: 'label', label: '라벨', icon: Heading },
            { type: 'divider', label: '라인', icon: Minus },
            { type: 'spacer', label: '공백', icon: Maximize },
            { type: 'columns', label: '컬럼 (다단)', icon: Columns },
        ]
    },
    {
        id: 'advanced',
        title: '고급 컴포넌트',
        items: [
            { type: 'calc', label: '자동 계산', icon: Calculator },
            { type: 'data-link', label: '데이터 연동', icon: Database },
        ]
    }
]

export function BuilderSidebar() {
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['data', 'design', 'advanced']))

    const toggleCategory = (id: string) => {
        setOpenCategories(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <div className="w-64 bg-zinc-900 dark:bg-zinc-950 border-r border-zinc-800 dark:border-zinc-800 flex flex-col h-full text-zinc-300">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="font-semibold text-sm text-zinc-300 dark:text-zinc-200">컴포넌트</h2>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {CATEGORIES.map(category => (
                    <div key={category.id} className="space-y-1">
                        <button
                            onClick={() => toggleCategory(category.id)}
                            className="w-full flex items-center justify-between p-2 hover:bg-zinc-800 dark:hover:bg-zinc-800/50 rounded-md text-xs font-medium text-zinc-400 dark:text-zinc-500"
                        >
                            <span>{category.title}</span>
                            <ChevronDown
                                className={cn(
                                    "w-3 h-3 transition-transform",
                                    openCategories.has(category.id) ? "rotate-180" : ""
                                )}
                            />
                        </button>

                        {openCategories.has(category.id) && (
                            <div className="space-y-0.5 px-2">
                                {category.items.map(item => (
                                    <SidebarItem key={item.type} item={item} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function SidebarItem({ item }: { item: { type: string, label: string, icon: any } }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `sidebar-${item.type}`,
        data: {
            type: item.type,
            label: item.label,
            isSidebar: true
        }
    })

    const Icon = item.icon

    return (
        <button
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={cn(
                "w-full flex items-center gap-2 p-2 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-800 transition-colors text-left cursor-grab active:cursor-grabbing",
                isDragging ? "opacity-50" : ""
            )}
        >
            <Icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-sm text-zinc-300 dark:text-zinc-200">{item.label}</span>
        </button>
    )
}
