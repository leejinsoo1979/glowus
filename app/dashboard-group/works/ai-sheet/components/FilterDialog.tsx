'use client'

import { useState, useMemo } from 'react'
import { X, Search, Check, Filter } from 'lucide-react'
import type { SingleRange, FilterCondition } from '../lib/types'

interface FilterDialogProps {
    isOpen: boolean
    onClose: () => void
    onApply: (filters: Map<number, FilterCondition[]>) => void
    range: SingleRange
    data: any[][]
    columnIndex: number
    columnHeader?: string
    hasHeader?: boolean
}

type FilterTab = 'values' | 'condition'

export function FilterDialog({
    isOpen,
    onClose,
    onApply,
    range,
    data,
    columnIndex,
    columnHeader,
    hasHeader = true
}: FilterDialogProps) {
    const [activeTab, setActiveTab] = useState<FilterTab>('values')
    const [searchText, setSearchText] = useState('')
    const [selectedValues, setSelectedValues] = useState<Set<any>>(new Set())
    const [conditionType, setConditionType] = useState<FilterCondition['type']>('text')
    const [conditionOperator, setConditionOperator] = useState<FilterCondition['operator']>('contains')
    const [conditionValue, setConditionValue] = useState('')
    const [conditionValue2, setConditionValue2] = useState('')
    const [isInitialized, setIsInitialized] = useState(false)

    // Get unique values from the column
    const uniqueValues = useMemo(() => {
        const values = new Set<any>()
        const startRow = hasHeader ? range.row[0] + 1 : range.row[0]
        const endRow = Math.min(range.row[1], data.length - 1)

        for (let r = startRow; r <= endRow; r++) {
            const value = data[r]?.[columnIndex]
            if (value !== undefined && value !== null && value !== '') {
                values.add(value)
            }
        }

        return Array.from(values).sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') return a - b
            return String(a).localeCompare(String(b), 'ko')
        })
    }, [data, range, columnIndex, hasHeader])

    // Initialize selected values
    if (!isInitialized && uniqueValues.length > 0) {
        setSelectedValues(new Set(uniqueValues))
        setIsInitialized(true)
    }

    // Filter values by search text
    const filteredValues = useMemo(() => {
        if (!searchText) return uniqueValues
        const lowerSearch = searchText.toLowerCase()
        return uniqueValues.filter(v =>
            String(v).toLowerCase().includes(lowerSearch)
        )
    }, [uniqueValues, searchText])

    if (!isOpen) return null

    const columnLetter = String.fromCharCode(65 + columnIndex)
    const displayHeader = columnHeader || `열 ${columnLetter}`

    const toggleValue = (value: any) => {
        const newSelected = new Set(selectedValues)
        if (newSelected.has(value)) {
            newSelected.delete(value)
        } else {
            newSelected.add(value)
        }
        setSelectedValues(newSelected)
    }

    const selectAll = () => {
        setSelectedValues(new Set(filteredValues))
    }

    const deselectAll = () => {
        const newSelected = new Set(selectedValues)
        filteredValues.forEach(v => newSelected.delete(v))
        setSelectedValues(newSelected)
    }

    const handleApply = () => {
        const filters = new Map<number, FilterCondition[]>()

        if (activeTab === 'values') {
            // Value-based filter
            if (selectedValues.size < uniqueValues.length) {
                // Create filter for excluded values
                const excludedValues = uniqueValues.filter(v => !selectedValues.has(v))
                if (excludedValues.length > 0) {
                    filters.set(columnIndex, excludedValues.map(v => ({
                        type: 'text' as const,
                        operator: 'notEquals' as const,
                        value: String(v)
                    })))
                }
            }
        } else {
            // Condition-based filter
            if (conditionValue || conditionOperator === 'empty' || conditionOperator === 'notEmpty') {
                filters.set(columnIndex, [{
                    type: conditionType,
                    operator: conditionOperator,
                    value: conditionType === 'number' ? Number(conditionValue) : conditionValue,
                    value2: conditionValue2 ? (conditionType === 'number' ? Number(conditionValue2) : conditionValue2) : undefined
                }])
            }
        }

        onApply(filters)
        onClose()
    }

    const textOperators = [
        { value: 'equals', label: '같음' },
        { value: 'notEquals', label: '같지 않음' },
        { value: 'contains', label: '포함' },
        { value: 'notContains', label: '포함하지 않음' },
        { value: 'startsWith', label: '시작 문자' },
        { value: 'endsWith', label: '끝 문자' }
    ]

    const numberOperators = [
        { value: 'equals', label: '같음' },
        { value: 'notEquals', label: '같지 않음' },
        { value: 'greaterThan', label: '보다 큼' },
        { value: 'lessThan', label: '보다 작음' },
        { value: 'greaterOrEqual', label: '크거나 같음' },
        { value: 'lessOrEqual', label: '작거나 같음' },
        { value: 'between', label: '사이' }
    ]

    const dateOperators = [
        { value: 'equals', label: '같음' },
        { value: 'notEquals', label: '같지 않음' },
        { value: 'before', label: '이전' },
        { value: 'after', label: '이후' },
        { value: 'between', label: '사이' }
    ]

    const getOperators = () => {
        switch (conditionType) {
            case 'number': return numberOperators
            case 'date': return dateOperators
            default: return textOperators
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-[400px] max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <h2 className="text-lg font-semibold text-gray-800">
                            필터: {displayHeader}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('values')}
                        className={`flex-1 px-4 py-2 text-sm font-medium ${
                            activeTab === 'values'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        값으로 필터
                    </button>
                    <button
                        onClick={() => setActiveTab('condition')}
                        className={`flex-1 px-4 py-2 text-sm font-medium ${
                            activeTab === 'condition'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        조건으로 필터
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {activeTab === 'values' ? (
                        <div className="space-y-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="검색..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
                                />
                            </div>

                            {/* Select all / Deselect all */}
                            <div className="flex gap-2 text-sm">
                                <button
                                    onClick={selectAll}
                                    className="text-blue-600 hover:underline"
                                >
                                    모두 선택
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    onClick={deselectAll}
                                    className="text-blue-600 hover:underline"
                                >
                                    모두 해제
                                </button>
                            </div>

                            {/* Value list */}
                            <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                                {filteredValues.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-500">
                                        값이 없습니다
                                    </div>
                                ) : (
                                    filteredValues.map((value, index) => (
                                        <label
                                            key={index}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                selectedValues.has(value)
                                                    ? 'bg-blue-500 border-blue-500'
                                                    : 'border-gray-300'
                                            }`}>
                                                {selectedValues.has(value) && (
                                                    <Check className="w-3 h-3 text-white" />
                                                )}
                                            </div>
                                            <span className="text-sm text-gray-700 truncate">
                                                {String(value)}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>

                            <div className="text-xs text-gray-500">
                                {selectedValues.size}/{uniqueValues.length} 선택됨
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Condition type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    데이터 유형
                                </label>
                                <select
                                    value={conditionType}
                                    onChange={(e) => {
                                        setConditionType(e.target.value as FilterCondition['type'])
                                        setConditionOperator('equals')
                                    }}
                                    className="w-full px-3 py-2 text-sm border rounded-lg"
                                >
                                    <option value="text">텍스트</option>
                                    <option value="number">숫자</option>
                                    <option value="date">날짜</option>
                                </select>
                            </div>

                            {/* Operator */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    조건
                                </label>
                                <select
                                    value={conditionOperator}
                                    onChange={(e) => setConditionOperator(e.target.value as FilterCondition['operator'])}
                                    className="w-full px-3 py-2 text-sm border rounded-lg"
                                >
                                    {getOperators().map(op => (
                                        <option key={op.value} value={op.value}>
                                            {op.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Value input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    값
                                </label>
                                <input
                                    type={conditionType === 'number' ? 'number' : conditionType === 'date' ? 'date' : 'text'}
                                    value={conditionValue}
                                    onChange={(e) => setConditionValue(e.target.value)}
                                    placeholder="값 입력"
                                    className="w-full px-3 py-2 text-sm border rounded-lg"
                                />
                            </div>

                            {/* Second value for 'between' */}
                            {conditionOperator === 'between' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ~ 까지
                                    </label>
                                    <input
                                        type={conditionType === 'number' ? 'number' : conditionType === 'date' ? 'date' : 'text'}
                                        value={conditionValue2}
                                        onChange={(e) => setConditionValue2(e.target.value)}
                                        placeholder="두 번째 값 입력"
                                        className="w-full px-3 py-2 text-sm border rounded-lg"
                                    />
                                </div>
                            )}
                        </div>
                    )}
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
