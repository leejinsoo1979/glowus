import React, { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { MoreHorizontal, Key, Link } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SchemaColumn {
    name: string
    type: string
    isPrimaryKey?: boolean
    isForeignKey?: boolean
}

export interface TableNodeData {
    label: string
    columns: SchemaColumn[]
    onEdit?: (id: string) => void
}

const TableNode = ({ data, selected }: NodeProps<TableNodeData>) => {
    return (
        <div
            className={cn(
                'min-w-[240px] rounded-lg border bg-white shadow-sm transition-all dark:bg-zinc-900',
                selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-800'
            )}
        >
            {/* Target Handle (Left) */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-zinc-400 !w-3 !h-3 !-ml-1.5 hover:!bg-blue-500 hover:!w-4 hover:!h-4 transition-all"
            />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {data.label}
                </span>
                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>

            {/* Columns */}
            <div className="p-2 space-y-1">
                {data.columns.map((col, i) => (
                    <div key={i} className="flex items-center text-xs group">
                        {/* Icons */}
                        <div className="w-5 flex-shrink-0 flex items-center justify-center">
                            {col.isPrimaryKey ? (
                                <Key className="h-3 w-3 text-amber-500" />
                            ) : col.isForeignKey ? (
                                <Link className="h-3 w-3 text-blue-500" />
                            ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                            )}
                        </div>

                        {/* Name */}
                        <span className={cn(
                            "flex-1 font-medium truncate ml-1",
                            col.isPrimaryKey ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"
                        )}>
                            {col.name}
                        </span>

                        {/* Type */}
                        <span className="text-[10px] text-zinc-400 ml-2 font-mono">
                            {col.type}
                        </span>
                    </div>
                ))}
                {data.columns.length === 0 && (
                    <div className="text-xs text-zinc-400 text-center py-2 italic">
                        No columns
                    </div>
                )}
            </div>

            {/* Source Handle (Right) */}
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-zinc-400 !w-3 !h-3 !-mr-1.5 hover:!bg-blue-500 hover:!w-4 hover:!h-4 transition-all"
            />
        </div>
    )
}

export default memo(TableNode)
