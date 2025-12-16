/**
 * AI Sheet Sort & Filter Utilities
 * Data sorting and filtering functionality
 */

import type { SingleRange, SortConfig, FilterCondition } from './types'

// ============================================================================
// Types
// ============================================================================

export interface SortOptions {
    column: number
    order: 'asc' | 'desc'
    caseSensitive?: boolean
    treatNumbersAsText?: boolean
}

export interface FilterOptions {
    column: number
    condition: FilterCondition
}

export interface FilterState {
    range: SingleRange
    filters: Map<number, FilterCondition[]>
    hiddenRows: Set<number>
}

// ============================================================================
// Sort Functions
// ============================================================================

/**
 * Sort 2D array data by specified column
 */
export function sortData(
    data: any[][],
    range: SingleRange,
    sorts: SortConfig[],
    hasHeader: boolean = true
): any[][] {
    const { row, column } = range
    const startRow = hasHeader ? row[0] + 1 : row[0]
    const endRow = row[1]

    // Extract rows to sort
    const rowsToSort: { index: number; data: any[] }[] = []
    for (let r = startRow; r <= endRow && r < data.length; r++) {
        rowsToSort.push({
            index: r,
            data: data[r].slice(column[0], column[1] + 1)
        })
    }

    // Multi-column sort
    rowsToSort.sort((a, b) => {
        for (const sort of sorts) {
            const colIndex = sort.column - column[0]
            const aVal = a.data[colIndex]
            const bVal = b.data[colIndex]

            const comparison = compareValues(aVal, bVal)
            if (comparison !== 0) {
                return sort.order === 'asc' ? comparison : -comparison
            }
        }
        return 0
    })

    // Create new sorted data array
    const result = data.map(row => [...row])
    rowsToSort.forEach((item, i) => {
        const targetRow = startRow + i
        for (let c = column[0]; c <= column[1] && c < result[targetRow].length; c++) {
            result[targetRow][c] = item.data[c - column[0]]
        }
    })

    return result
}

/**
 * Compare two values for sorting
 */
function compareValues(a: any, b: any): number {
    // Handle null/undefined/empty
    if (a == null || a === '') return b == null || b === '' ? 0 : 1
    if (b == null || b === '') return -1

    // Numeric comparison
    const numA = parseFloat(a)
    const numB = parseFloat(b)
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB
    }

    // Date comparison
    const dateA = new Date(a)
    const dateB = new Date(b)
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
        return dateA.getTime() - dateB.getTime()
    }

    // String comparison (case-insensitive)
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase(), 'ko')
}

/**
 * Get sort order for a column based on current data
 */
export function getSuggestedSortOrder(
    data: any[][],
    column: number,
    startRow: number = 0
): 'asc' | 'desc' {
    // Check if already sorted ascending
    let isAsc = true
    let isDesc = true

    for (let r = startRow + 1; r < Math.min(data.length, startRow + 10); r++) {
        const prev = data[r - 1][column]
        const curr = data[r][column]
        const cmp = compareValues(prev, curr)
        if (cmp > 0) isAsc = false
        if (cmp < 0) isDesc = false
    }

    // If already ascending, suggest descending, otherwise ascending
    return isAsc ? 'desc' : 'asc'
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Create a new filter state
 */
export function createFilterState(range: SingleRange): FilterState {
    return {
        range,
        filters: new Map(),
        hiddenRows: new Set()
    }
}

/**
 * Apply filter to data and return hidden row indices
 */
export function applyFilter(
    data: any[][],
    range: SingleRange,
    filters: Map<number, FilterCondition[]>,
    hasHeader: boolean = true
): Set<number> {
    const hiddenRows = new Set<number>()
    const startRow = hasHeader ? range.row[0] + 1 : range.row[0]
    const endRow = range.row[1]

    for (let r = startRow; r <= endRow && r < data.length; r++) {
        let shouldHide = false

        const filterEntries = Array.from(filters.entries())
        for (const [column, conditions] of filterEntries) {
            const cellValue = data[r][column]

            // All conditions in a column must pass (AND logic)
            for (const condition of conditions) {
                if (!evaluateCondition(cellValue, condition)) {
                    shouldHide = true
                    break
                }
            }

            if (shouldHide) break
        }

        if (shouldHide) {
            hiddenRows.add(r)
        }
    }

    return hiddenRows
}

/**
 * Evaluate a filter condition against a cell value
 */
export function evaluateCondition(value: any, condition: FilterCondition): boolean {
    const { type, operator, value: condValue, value2 } = condition

    // Handle null/empty values
    if (value == null || value === '') {
        return operator === 'equals' && (condValue == null || condValue === '')
    }

    switch (type) {
        case 'text':
            return evaluateTextCondition(String(value), operator, String(condValue))

        case 'number':
            const numValue = parseFloat(value)
            const numCondValue = parseFloat(condValue as any)
            const numCondValue2 = value2 ? parseFloat(value2 as any) : undefined
            if (isNaN(numValue) || isNaN(numCondValue)) return false
            return evaluateNumberCondition(numValue, operator, numCondValue, numCondValue2)

        case 'date':
            const dateValue = new Date(value)
            const dateCondValue = new Date(condValue as any)
            const dateCondValue2 = value2 ? new Date(value2 as any) : undefined
            if (isNaN(dateValue.getTime()) || isNaN(dateCondValue.getTime())) return false
            return evaluateDateCondition(dateValue, operator, dateCondValue, dateCondValue2)

        default:
            return true
    }
}

function evaluateTextCondition(
    value: string,
    operator: FilterCondition['operator'],
    condValue: string
): boolean {
    const lowerValue = value.toLowerCase()
    const lowerCondValue = condValue.toLowerCase()

    switch (operator) {
        case 'equals':
            return lowerValue === lowerCondValue
        case 'notEquals':
            return lowerValue !== lowerCondValue
        case 'contains':
            return lowerValue.includes(lowerCondValue)
        case 'notContains':
            return !lowerValue.includes(lowerCondValue)
        case 'startsWith':
            return lowerValue.startsWith(lowerCondValue)
        case 'endsWith':
            return lowerValue.endsWith(lowerCondValue)
        default:
            return true
    }
}

function evaluateNumberCondition(
    value: number,
    operator: FilterCondition['operator'],
    condValue: number,
    condValue2?: number
): boolean {
    switch (operator) {
        case 'equals':
            return value === condValue
        case 'notEquals':
            return value !== condValue
        case 'greaterThan':
            return value > condValue
        case 'lessThan':
            return value < condValue
        case 'greaterOrEqual':
            return value >= condValue
        case 'lessOrEqual':
            return value <= condValue
        case 'between':
            return condValue2 !== undefined && value >= condValue && value <= condValue2
        default:
            return true
    }
}

function evaluateDateCondition(
    value: Date,
    operator: FilterCondition['operator'],
    condValue: Date,
    condValue2?: Date
): boolean {
    const vTime = value.getTime()
    const cTime = condValue.getTime()
    const c2Time = condValue2?.getTime()

    switch (operator) {
        case 'equals':
            return vTime === cTime
        case 'notEquals':
            return vTime !== cTime
        case 'before':
            return vTime < cTime
        case 'after':
            return vTime > cTime
        case 'between':
            return c2Time !== undefined && vTime >= cTime && vTime <= c2Time
        default:
            return true
    }
}

/**
 * Get unique values in a column for filter dropdown
 */
export function getUniqueColumnValues(
    data: any[][],
    column: number,
    startRow: number = 0,
    endRow?: number
): any[] {
    const values = new Set<any>()
    const maxRow = endRow ?? data.length - 1

    for (let r = startRow; r <= maxRow && r < data.length; r++) {
        const value = data[r][column]
        if (value != null && value !== '') {
            values.add(value)
        }
    }

    return Array.from(values).sort((a, b) => compareValues(a, b))
}

/**
 * Create a text filter condition
 */
export function createTextFilter(
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith',
    value: string
): FilterCondition {
    return { type: 'text', operator, value }
}

/**
 * Create a number filter condition
 */
export function createNumberFilter(
    operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterOrEqual' | 'lessOrEqual' | 'between',
    value: number,
    value2?: number
): FilterCondition {
    return { type: 'number', operator, value, value2 }
}

/**
 * Create a date filter condition
 */
export function createDateFilter(
    operator: 'equals' | 'notEquals' | 'before' | 'after' | 'between',
    value: Date,
    value2?: Date
): FilterCondition {
    return { type: 'date', operator, value, value2 }
}

// ============================================================================
// Auto Filter (Excel-style)
// ============================================================================

export interface AutoFilterColumn {
    column: number
    selectedValues: Set<any>
    allValues: any[]
    isFiltered: boolean
}

export interface AutoFilterState {
    range: SingleRange
    columns: Map<number, AutoFilterColumn>
    hiddenRows: Set<number>
    isActive: boolean
}

/**
 * Create auto filter for a range
 */
export function createAutoFilter(
    data: any[][],
    range: SingleRange,
    hasHeader: boolean = true
): AutoFilterState {
    const columns = new Map<number, AutoFilterColumn>()
    const startRow = hasHeader ? range.row[0] + 1 : range.row[0]

    for (let c = range.column[0]; c <= range.column[1]; c++) {
        const allValues = getUniqueColumnValues(data, c, startRow, range.row[1])
        columns.set(c, {
            column: c,
            selectedValues: new Set(allValues),
            allValues,
            isFiltered: false
        })
    }

    return {
        range,
        columns,
        hiddenRows: new Set(),
        isActive: true
    }
}

/**
 * Apply auto filter selections
 */
export function applyAutoFilter(
    data: any[][],
    state: AutoFilterState,
    hasHeader: boolean = true
): Set<number> {
    const hiddenRows = new Set<number>()
    const startRow = hasHeader ? state.range.row[0] + 1 : state.range.row[0]

    for (let r = startRow; r <= state.range.row[1] && r < data.length; r++) {
        let shouldHide = false

        const columnEntries = Array.from(state.columns.entries())
        for (const [colIndex, column] of columnEntries) {
            if (column.isFiltered) {
                const cellValue = data[r][colIndex]
                if (!column.selectedValues.has(cellValue)) {
                    shouldHide = true
                    break
                }
            }
        }

        if (shouldHide) {
            hiddenRows.add(r)
        }
    }

    return hiddenRows
}

/**
 * Toggle value selection in auto filter
 */
export function toggleAutoFilterValue(
    state: AutoFilterState,
    column: number,
    value: any,
    selected: boolean
): AutoFilterState {
    const columnState = state.columns.get(column)
    if (!columnState) return state

    const newSelectedValues = new Set(columnState.selectedValues)
    if (selected) {
        newSelectedValues.add(value)
    } else {
        newSelectedValues.delete(value)
    }

    const newColumns = new Map(state.columns)
    newColumns.set(column, {
        ...columnState,
        selectedValues: newSelectedValues,
        isFiltered: newSelectedValues.size !== columnState.allValues.length
    })

    return { ...state, columns: newColumns }
}

/**
 * Select all values in auto filter column
 */
export function selectAllAutoFilterValues(
    state: AutoFilterState,
    column: number
): AutoFilterState {
    const columnState = state.columns.get(column)
    if (!columnState) return state

    const newColumns = new Map(state.columns)
    newColumns.set(column, {
        ...columnState,
        selectedValues: new Set(columnState.allValues),
        isFiltered: false
    })

    return { ...state, columns: newColumns }
}

/**
 * Clear all auto filter selections
 */
export function clearAutoFilter(state: AutoFilterState): AutoFilterState {
    const newColumns = new Map<number, AutoFilterColumn>()

    const columnEntries = Array.from(state.columns.entries())
    for (const [key, column] of columnEntries) {
        newColumns.set(key, {
            ...column,
            selectedValues: new Set(column.allValues),
            isFiltered: false
        })
    }

    return {
        ...state,
        columns: newColumns,
        hiddenRows: new Set()
    }
}
