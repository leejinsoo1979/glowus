"use client"

import React from 'react'
import { Trash2, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

interface CanvasItemProps {
    id: string
    type: string
    label: string
    onDelete: (id: string) => void
}

export function CanvasItem({ id, type, label, onDelete }: CanvasItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 mb-2 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all",
                isDragging ? "opacity-50 z-50 shadow-lg" : ""
            )}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <GripVertical className="w-4 h-4" />
            </div>

            <div className="pl-8 pr-8">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {label}
                </label>

                {/* Mock Render based on Type */}
                <div className="pointer-events-none">
                    {type === 'text' && <input type="text" className="w-full h-9 px-3 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50" disabled />}
                    {type === 'textarea' && <textarea className="w-full h-20 p-3 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 resize-none" disabled />}
                    {type === 'number' && <input type="number" className="w-full h-9 px-3 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50" disabled />}
                    {type === 'date' && <div className="w-full h-9 px-3 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center text-zinc-400 dark:text-zinc-500">YYYY-MM-DD</div>}
                    {type === 'file' && <button className="px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-300">파일 첨부</button>}

                    {/* Fallback */}
                    {!['text', 'textarea', 'number', 'date', 'file'].includes(type) && (
                        <div className="w-full h-9 px-3 rounded border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex items-center text-zinc-400 dark:text-zinc-500 text-sm">
                            {label} 컴포넌트
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Button */}
            <button
                onClick={() => onDelete(id)}
                className="absolute right-2 top-2 p-1.5 text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    )
}
