"use client"

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CanvasItem } from './CanvasItem'
import { cn } from '@/lib/utils'

interface BuilderCanvasProps {
    items: Array<{ id: string, type: string, label: string }>
    onDeleteItem: (id: string) => void
}

export function BuilderCanvas({ items, onDeleteItem }: BuilderCanvasProps) {
    const { setNodeRef } = useDroppable({
        id: 'canvas-droppable'
    })

    return (
        <div className="flex-1 h-full bg-zinc-50 dark:bg-zinc-950/50 flex flex-col overflow-hidden">
            {/* Top Breadcrumb & Header */}
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-6 gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="font-bold text-purple-600 dark:text-purple-400">새로운 앱</span>
                <span>&gt;</span>
                <span>관리</span>
                <span>&gt;</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">입력화면 관리</span>
            </div>

            {/* Action Bar */}
            <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center px-6 gap-6">
                <button className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100 h-full px-1">Main Form <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded text-zinc-500 dark:text-zinc-400 ml-1">main</span></button>
                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 font-bold text-lg pb-1">+</button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
                <div className="max-w-4xl mx-auto p-8 pb-32">
                    {/* App Title Input */}
                    <div className="mb-6 group">
                        <input
                            type="text"
                            placeholder="제목 없음"
                            className="w-full text-4xl font-bold bg-transparent placeholder:text-zinc-300 dark:placeholder:text-zinc-700 text-zinc-900 dark:text-zinc-100 border-none focus:ring-0 p-0 transition-colors"
                        />
                    </div>

                    {/* Drop Zone */}
                    <div
                        ref={setNodeRef}
                        className={cn(
                            "min-h-[500px] transition-colors pb-20",
                            items.length === 0 ? "flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50" : ""
                        )}
                    >
                        {items.length === 0 ? (
                            <div className="text-center space-y-2">
                                <p>좌측에서 컴포넌트를 드래그하여 추가하세요</p>
                                <p className="text-xs opacity-70">또는 '/'를 입력하여 메뉴를 호출할 수 있습니다</p>
                            </div>
                        ) : (
                            <SortableContext items={items} strategy={verticalListSortingStrategy}>
                                {items.map((item) => (
                                    <CanvasItem
                                        key={item.id}
                                        id={item.id}
                                        type={item.type}
                                        label={item.label}
                                        onDelete={onDeleteItem}
                                    />
                                ))}
                            </SortableContext>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Actions - Fixed at the bottom of the canvas pane */}
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-4 flex justify-end gap-2 z-10 transition-all">
                <button className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">취소</button>
                <button className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors">저장</button>
            </div>
        </div>
    )
}
