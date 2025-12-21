import React from 'react'
import { Lock, Unlock, Copy, Trash2, MoreHorizontal, MessageSquarePlus, PenLine, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectionToolbarProps {
    mode?: 'multi' | 'group'
    onGroup?: () => void
    onUngroup?: () => void
    onLock?: () => void
    onDuplicate?: () => void
    onDelete?: () => void
    isLocked?: boolean
}

export function SelectionToolbar({
    mode = 'multi',
    onGroup,
    onUngroup,
    onLock,
    onDuplicate,
    onDelete,
    isLocked = false,
}: SelectionToolbarProps) {
    if (mode === 'group') {
        return (
            <div className="flex items-center gap-1 p-1.5 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl text-white transform -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                {/* Ungroup Button (Main Action) */}
                <button
                    onClick={onUngroup}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-zinc-800 transition-colors text-sm font-medium pr-4"
                >
                    <Sparkles size={14} className="text-zinc-300" />
                    <span>그룹 해제</span>
                </button>

                <div className="w-px h-4 bg-zinc-700 mx-1" />

                {/* Comment */}
                <button className="p-2 rounded-full hover:bg-zinc-800 transition-colors" title="Comment">
                    <MessageSquarePlus size={16} />
                </button>

                {/* Lock */}
                <button
                    onClick={onLock}
                    className={cn(
                        "p-2 rounded-full hover:bg-zinc-800 transition-colors",
                        isLocked && "text-blue-400"
                    )}
                    title={isLocked ? "Unlock" : "Lock"}
                >
                    {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                </button>

                {/* Duplicate */}
                <button onClick={onDuplicate} className="p-2 rounded-full hover:bg-zinc-800 transition-colors" title="Duplicate">
                    <Copy size={16} />
                </button>

                {/* Delete */}
                <button onClick={onDelete} className="p-2 rounded-full hover:bg-zinc-800 transition-colors hover:text-red-400" title="Delete">
                    <Trash2 size={16} />
                </button>

                {/* More */}
                <button className="p-2 rounded-full hover:bg-zinc-800 transition-colors">
                    <MoreHorizontal size={16} />
                </button>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-1 p-1.5 rounded-full bg-zinc-900 border border-zinc-700 shadow-2xl text-white transform -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Group Button */}
            <button
                onClick={onGroup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-zinc-800 transition-colors text-sm font-medium"
            >
                <PenLine size={14} className="text-zinc-300" />
                <span>그룹화</span>
            </button>

            <div className="w-px h-4 bg-zinc-700 mx-1" />

            {/* Lock/Unlock */}
            <button
                onClick={onLock}
                className={cn(
                    "p-2 rounded-full hover:bg-zinc-800 transition-colors",
                    isLocked && "text-blue-400 bg-blue-900/30 hover:bg-blue-900/50"
                )}
                title={isLocked ? "Unlock" : "Lock"}
            >
                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>

            {/* Duplicate */}
            <button onClick={onDuplicate} className="p-2 rounded-full hover:bg-zinc-800 transition-colors" title="Duplicate">
                <Copy size={16} />
            </button>

            {/* Delete */}
            <button onClick={onDelete} className="p-2 rounded-full hover:bg-zinc-800 transition-colors hover:text-red-400" title="Delete">
                <Trash2 size={16} />
            </button>

            {/* More */}
            <button className="p-2 rounded-full hover:bg-zinc-800 transition-colors">
                <MoreHorizontal size={16} />
            </button>
        </div>
    )
}
