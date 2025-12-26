import React, { memo, useEffect, useState } from 'react'
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
    // 시뮬레이션 상태
    isHighlighted?: boolean
    highlightColor?: string
    highlightIntensity?: number // 0-1
    // 가시성 상태 (시뮬레이션용)
    simulationMode?: boolean // 시뮬레이션 모드 활성화
    isVisited?: boolean // 데이터가 한번이라도 흐른 노드
    isActive?: boolean // 현재 활성화된 노드
    appearDelay?: number // 등장 딜레이 (ms)
}

const TableNode = ({ data, selected }: NodeProps<TableNodeData>) => {
    const {
        isHighlighted,
        highlightColor = '#22c55e',
        highlightIntensity = 1,
        simulationMode = false,
        isVisited = true,
        isActive = false,
        appearDelay = 0,
    } = data

    // 등장 애니메이션 상태
    const [hasAppeared, setHasAppeared] = useState(!simulationMode)
    const [isAppearing, setIsAppearing] = useState(false)

    // 시뮬레이션 모드에서 노드가 방문되면 등장 애니메이션
    useEffect(() => {
        if (simulationMode && isVisited && !hasAppeared) {
            const timer = setTimeout(() => {
                setIsAppearing(true)
                setTimeout(() => {
                    setHasAppeared(true)
                    setIsAppearing(false)
                }, 400)
            }, appearDelay)
            return () => clearTimeout(timer)
        }
        if (!simulationMode) {
            setHasAppeared(true)
        }
    }, [simulationMode, isVisited, hasAppeared, appearDelay])

    // 하이라이트 스타일 계산
    const highlightStyle = isHighlighted ? {
        boxShadow: `0 0 ${20 * highlightIntensity}px ${8 * highlightIntensity}px ${highlightColor}60,
                    0 0 ${40 * highlightIntensity}px ${16 * highlightIntensity}px ${highlightColor}30`,
        borderColor: highlightColor,
        transform: `scale(${1 + 0.02 * highlightIntensity})`,
    } : {}

    // 시뮬레이션 모드 스타일 (미방문 노드는 희미하게)
    const simulationStyle = simulationMode ? {
        opacity: hasAppeared ? 1 : 0.15,
        transform: isAppearing
            ? 'scale(1.1)'
            : hasAppeared
                ? (isActive ? 'scale(1.05)' : 'scale(1)')
                : 'scale(0.9)',
        filter: hasAppeared ? 'none' : 'grayscale(0.8)',
    } : {}

    // 병합된 스타일
    const mergedStyle = {
        ...simulationStyle,
        ...highlightStyle,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    }

    return (
        <div
            className={cn(
                'min-w-[240px] rounded-lg border bg-white shadow-sm dark:bg-zinc-900',
                selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-800',
                isHighlighted && 'z-10',
                isActive && 'schema-node-active ring-2 ring-green-500/50',
                isVisited && !isActive && simulationMode && 'schema-node-visited',
                isAppearing && 'animate-pulse'
            )}
            style={mergedStyle}
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
