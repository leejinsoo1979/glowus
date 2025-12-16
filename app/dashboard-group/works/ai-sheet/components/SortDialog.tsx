'use client'

import { useState } from 'react'
import { X, Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import type { SortConfig, SingleRange } from '../lib/types'

interface SortDialogProps {
    isOpen: boolean
    onClose: () => void
    onApply: (sorts: SortConfig[], hasHeader: boolean) => void
    range: SingleRange
    columnHeaders?: string[]
}

interface SortLevel {
    id: string
    column: number
    order: 'asc' | 'desc'
}

export function SortDialog({
    isOpen,
    onClose,
    onApply,
    range,
    columnHeaders = []
}: SortDialogProps) {
    const [hasHeader, setHasHeader] = useState(true)
    const [sortLevels, setSortLevels] = useState<SortLevel[]>([
        { id: '1', column: range.column[0], order: 'asc' }
    ])

    if (!isOpen) return null

    const columnCount = range.column[1] - range.column[0] + 1
    const columns = Array.from({ length: columnCount }, (_, i) => {
        const colIndex = range.column[0] + i
        const letter = String.fromCharCode(65 + colIndex)
        const header = columnHeaders[i] || `열 ${letter}`
        return { index: colIndex, label: header, letter }
    })

    const addSortLevel = () => {
        const usedColumns = sortLevels.map(s => s.column)
        const availableColumn = columns.find(c => !usedColumns.includes(c.index))
        if (availableColumn) {
            setSortLevels([
                ...sortLevels,
                { id: String(Date.now()), column: availableColumn.index, order: 'asc' }
            ])
        }
    }

    const removeSortLevel = (id: string) => {
        if (sortLevels.length > 1) {
            setSortLevels(sortLevels.filter(s => s.id !== id))
        }
    }

    const updateSortLevel = (id: string, updates: Partial<SortLevel>) => {
        setSortLevels(sortLevels.map(s =>
            s.id === id ? { ...s, ...updates } : s
        ))
    }

    const handleApply = () => {
        const sorts: SortConfig[] = sortLevels.map(s => ({
            column: s.column,
            order: s.order
        }))
        onApply(sorts, hasHeader)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800">정렬</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Header row option */}
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={hasHeader}
                            onChange={(e) => setHasHeader(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-gray-700">데이터에 머리글 포함</span>
                    </label>

                    {/* Sort levels */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-600">정렬 기준</div>
                        {sortLevels.map((level, index) => (
                            <div
                                key={level.id}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                            >
                                <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />

                                <span className="text-sm text-gray-500 w-16">
                                    {index === 0 ? '정렬 기준' : '다음 기준'}
                                </span>

                                <select
                                    value={level.column}
                                    onChange={(e) => updateSortLevel(level.id, { column: Number(e.target.value) })}
                                    className="flex-1 px-2 py-1.5 text-sm border rounded bg-white"
                                >
                                    {columns.map(col => (
                                        <option key={col.index} value={col.index}>
                                            {hasHeader ? col.label : `열 ${col.letter}`}
                                        </option>
                                    ))}
                                </select>

                                <div className="flex border rounded overflow-hidden">
                                    <button
                                        onClick={() => updateSortLevel(level.id, { order: 'asc' })}
                                        className={`px-2 py-1.5 flex items-center gap-1 text-sm ${
                                            level.order === 'asc'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                        오름차순
                                    </button>
                                    <button
                                        onClick={() => updateSortLevel(level.id, { order: 'desc' })}
                                        className={`px-2 py-1.5 flex items-center gap-1 text-sm border-l ${
                                            level.order === 'desc'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-100'
                                        }`}
                                    >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                        내림차순
                                    </button>
                                </div>

                                <button
                                    onClick={() => removeSortLevel(level.id)}
                                    disabled={sortLevels.length <= 1}
                                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add level button */}
                    <button
                        onClick={addSortLevel}
                        disabled={sortLevels.length >= columns.length}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4" />
                        기준 추가
                    </button>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
                    >
                        적용
                    </button>
                </div>
            </div>
        </div>
    )
}
