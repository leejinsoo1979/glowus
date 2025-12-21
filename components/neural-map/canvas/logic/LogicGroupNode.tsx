import React, { memo } from 'react'
import { NodeProps, Handle, Position, NodeResizer } from 'reactflow'
import { cn } from '@/lib/utils'

export interface LogicGroupNodeData {
    label: string
}

const LogicGroupNode = ({ data, selected }: NodeProps<LogicGroupNodeData>) => {
    return (
        <>
            <NodeResizer
                isVisible={selected}
                minWidth={100}
                minHeight={100}
                handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
                lineStyle={{ border: '1px solid #735aff' }}
            />
            <div
                className={cn(
                    'w-full h-full rounded-xl border-2 transition-all p-4',
                    'bg-zinc-100/80 border-zinc-300 dark:bg-zinc-800/60 dark:border-zinc-600',
                    selected && 'border-blue-500 ring-2 ring-blue-500/20 dark:border-blue-500'
                )}
                style={{ zIndex: -1 }}
            >
                <div className="absolute -top-3 left-4 px-2 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700">
                    {data.label}
                </div>

                {/* Handles */}
                <Handle type="target" position={Position.Top} className="opacity-0 w-full h-full !bg-transparent rounded-none border-0" />
                <Handle type="source" position={Position.Bottom} className="opacity-0 w-full h-full !bg-transparent rounded-none border-0" />
            </div>
        </>
    )
}

export default memo(LogicGroupNode)
