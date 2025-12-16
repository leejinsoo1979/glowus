/**
 * AI Sheet Chart Utilities
 * Data extraction and chart configuration for recharts integration
 */

import type { SingleRange } from './types'

// ============================================================================
// Types
// ============================================================================

export type ChartType =
    | 'bar'
    | 'column'
    | 'line'
    | 'area'
    | 'pie'
    | 'doughnut'
    | 'scatter'
    | 'radar'
    | 'combo'

export interface ChartDataPoint {
    name: string
    [key: string]: string | number
}

export interface ChartSeries {
    dataKey: string
    name: string
    color: string
    type?: 'bar' | 'line' | 'area'  // For combo charts
}

export interface ChartConfig {
    id: string
    type: ChartType
    title: string
    data: ChartDataPoint[]
    series: ChartSeries[]
    xAxisKey: string
    showLegend: boolean
    showGrid: boolean
    showValues: boolean
    legendPosition: 'top' | 'bottom' | 'left' | 'right'
    colors: string[]
    // Position in the sheet
    position?: {
        left: number
        top: number
        width: number
        height: number
    }
}

export interface ChartOptions {
    type: ChartType
    title?: string
    dataRange: SingleRange
    labelRange?: SingleRange
    hasHeader?: boolean
    seriesInRows?: boolean  // true = series are in rows, false = series are in columns
    showLegend?: boolean
    showGrid?: boolean
    showValues?: boolean
    legendPosition?: 'top' | 'bottom' | 'left' | 'right'
    colors?: string[]
}

// ============================================================================
// Default Colors
// ============================================================================

export const CHART_COLORS = [
    '#4285F4',  // Blue
    '#EA4335',  // Red
    '#FBBC05',  // Yellow
    '#34A853',  // Green
    '#FF6D01',  // Orange
    '#46BDC6',  // Teal
    '#7B1FA2',  // Purple
    '#F06292',  // Pink
    '#00ACC1',  // Cyan
    '#8BC34A',  // Light Green
]

export const CHART_COLOR_PALETTES = {
    default: CHART_COLORS,
    pastel: ['#A8D8EA', '#AA96DA', '#FCBAD3', '#FFFFD2', '#B5EAD7', '#C7CEEA', '#FFD3B6', '#DCEDC1'],
    vibrant: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA'],
    mono: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#950740', '#c70039', '#ff5722'],
    earth: ['#5D4037', '#795548', '#8D6E63', '#A1887F', '#D7CCC8', '#3E2723', '#4E342E', '#6D4C41'],
    ocean: ['#006994', '#40A4D8', '#33CCFF', '#00CED1', '#20B2AA', '#3CB371', '#2E8B57', '#228B22'],
}

// ============================================================================
// Data Extraction
// ============================================================================

/**
 * Extract chart data from spreadsheet data
 */
export function extractChartData(
    sheetData: any[][],
    options: ChartOptions
): { data: ChartDataPoint[]; series: ChartSeries[]; xAxisKey: string } {
    const { dataRange, hasHeader = true, seriesInRows = false, colors = CHART_COLORS } = options

    const startRow = dataRange.row[0]
    const endRow = dataRange.row[1]
    const startCol = dataRange.column[0]
    const endCol = dataRange.column[1]

    const data: ChartDataPoint[] = []
    const series: ChartSeries[] = []

    if (seriesInRows) {
        // Series are in rows (each row is a series)
        const labels = hasHeader
            ? Array.from({ length: endCol - startCol }, (_, i) =>
                String(sheetData[startRow]?.[startCol + 1 + i] || `Col ${i + 1}`))
            : Array.from({ length: endCol - startCol }, (_, i) => `Col ${i + 1}`)

        const dataStartRow = hasHeader ? startRow + 1 : startRow

        // Create data points for each column
        labels.forEach((label, colIdx) => {
            const point: ChartDataPoint = { name: label }
            for (let r = dataStartRow; r <= endRow; r++) {
                const seriesName = String(sheetData[r]?.[startCol] || `Series ${r - dataStartRow + 1}`)
                const value = parseFloat(sheetData[r]?.[startCol + 1 + colIdx]) || 0
                point[seriesName] = value
            }
            data.push(point)
        })

        // Create series for each row
        for (let r = dataStartRow; r <= endRow; r++) {
            const seriesName = String(sheetData[r]?.[startCol] || `Series ${r - dataStartRow + 1}`)
            series.push({
                dataKey: seriesName,
                name: seriesName,
                color: colors[(r - dataStartRow) % colors.length]
            })
        }
    } else {
        // Series are in columns (each column is a series) - default
        const headerRow = hasHeader ? startRow : -1
        const dataStartRow = hasHeader ? startRow + 1 : startRow
        const labelCol = startCol
        const dataStartCol = startCol + 1

        // Create series for each data column
        for (let c = dataStartCol; c <= endCol; c++) {
            const seriesName = headerRow >= 0
                ? String(sheetData[headerRow]?.[c] || `Series ${c - dataStartCol + 1}`)
                : `Series ${c - dataStartCol + 1}`
            series.push({
                dataKey: seriesName,
                name: seriesName,
                color: colors[(c - dataStartCol) % colors.length]
            })
        }

        // Create data points for each row
        for (let r = dataStartRow; r <= endRow && r < sheetData.length; r++) {
            const row = sheetData[r]
            if (!row) continue

            const label = String(row[labelCol] || `Row ${r - dataStartRow + 1}`)
            const point: ChartDataPoint = { name: label }

            for (let c = dataStartCol; c <= endCol; c++) {
                const seriesName = series[c - dataStartCol]?.dataKey || `Series ${c - dataStartCol + 1}`
                const value = parseFloat(row[c]) || 0
                point[seriesName] = value
            }

            data.push(point)
        }
    }

    return {
        data,
        series,
        xAxisKey: 'name'
    }
}

/**
 * Extract pie chart data (single series)
 */
export function extractPieChartData(
    sheetData: any[][],
    options: ChartOptions
): { data: Array<{ name: string; value: number; color: string }>; total: number } {
    const { dataRange, hasHeader = true, colors = CHART_COLORS } = options

    const startRow = dataRange.row[0]
    const endRow = dataRange.row[1]
    const startCol = dataRange.column[0]

    const dataStartRow = hasHeader ? startRow + 1 : startRow
    const labelCol = startCol
    const valueCol = startCol + 1

    const data: Array<{ name: string; value: number; color: string }> = []
    let total = 0

    for (let r = dataStartRow; r <= endRow && r < sheetData.length; r++) {
        const row = sheetData[r]
        if (!row) continue

        const name = String(row[labelCol] || `Item ${r - dataStartRow + 1}`)
        const value = Math.abs(parseFloat(row[valueCol]) || 0)

        if (value > 0) {
            data.push({
                name,
                value,
                color: colors[(r - dataStartRow) % colors.length]
            })
            total += value
        }
    }

    return { data, total }
}

/**
 * Extract scatter chart data (x, y pairs)
 */
export function extractScatterData(
    sheetData: any[][],
    options: ChartOptions
): { data: Array<{ x: number; y: number; name?: string }> } {
    const { dataRange, hasHeader = true } = options

    const startRow = dataRange.row[0]
    const endRow = dataRange.row[1]
    const startCol = dataRange.column[0]

    const dataStartRow = hasHeader ? startRow + 1 : startRow
    const xCol = startCol
    const yCol = startCol + 1
    const nameCol = startCol + 2  // Optional name column

    const data: Array<{ x: number; y: number; name?: string }> = []

    for (let r = dataStartRow; r <= endRow && r < sheetData.length; r++) {
        const row = sheetData[r]
        if (!row) continue

        const x = parseFloat(row[xCol]) || 0
        const y = parseFloat(row[yCol]) || 0
        const name = row[nameCol] ? String(row[nameCol]) : undefined

        data.push({ x, y, name })
    }

    return { data }
}

// ============================================================================
// Chart Configuration
// ============================================================================

let chartIdCounter = 0

/**
 * Create a new chart configuration
 */
export function createChartConfig(
    sheetData: any[][],
    options: ChartOptions
): ChartConfig {
    const chartId = `chart_${Date.now()}_${++chartIdCounter}`
    const { type, title = '', showLegend = true, showGrid = true, showValues = false, legendPosition = 'bottom', colors = CHART_COLORS } = options

    let data: ChartDataPoint[] = []
    let series: ChartSeries[] = []
    let xAxisKey = 'name'

    if (type === 'pie' || type === 'doughnut') {
        const pieData = extractPieChartData(sheetData, options)
        // Convert pie data to chart data format
        data = pieData.data.map(d => ({ name: d.name, value: d.value }))
        series = [{ dataKey: 'value', name: 'Value', color: colors[0] }]
    } else if (type === 'scatter') {
        const scatterData = extractScatterData(sheetData, options)
        data = scatterData.data.map(d => ({ name: d.name || '', x: d.x, y: d.y }))
        series = [{ dataKey: 'y', name: 'Y', color: colors[0] }]
        xAxisKey = 'x'
    } else {
        const extracted = extractChartData(sheetData, options)
        data = extracted.data
        series = extracted.series
        xAxisKey = extracted.xAxisKey
    }

    return {
        id: chartId,
        type,
        title,
        data,
        series,
        xAxisKey,
        showLegend,
        showGrid,
        showValues,
        legendPosition,
        colors
    }
}

// ============================================================================
// Chart Type Helpers
// ============================================================================

export const CHART_TYPES: Array<{ type: ChartType; label: string; icon: string; description: string }> = [
    { type: 'column', label: '세로 막대형', icon: '📊', description: '범주별 값 비교' },
    { type: 'bar', label: '가로 막대형', icon: '📊', description: '긴 레이블 데이터' },
    { type: 'line', label: '꺾은선형', icon: '📈', description: '시간에 따른 추세' },
    { type: 'area', label: '영역형', icon: '📉', description: '누적 변화량' },
    { type: 'pie', label: '원형', icon: '🥧', description: '전체 대비 비율' },
    { type: 'doughnut', label: '도넛형', icon: '🍩', description: '비율과 중앙 공간' },
    { type: 'scatter', label: '분산형', icon: '⚬', description: '두 변수간 관계' },
    { type: 'radar', label: '방사형', icon: '🕸️', description: '다중 변수 비교' },
    { type: 'combo', label: '콤보', icon: '📊📈', description: '막대 + 꺾은선' },
]

/**
 * Get recommended chart type based on data characteristics
 */
export function getRecommendedChartType(
    sheetData: any[][],
    range: SingleRange
): ChartType {
    const rowCount = range.row[1] - range.row[0]
    const colCount = range.column[1] - range.column[0]

    // Single data column - pie chart
    if (colCount === 1 && rowCount <= 10) {
        return 'pie'
    }

    // Two columns with numeric data - scatter
    if (colCount === 1) {
        const startCol = range.column[0] + 1
        const isNumericX = sheetData.slice(range.row[0] + 1, range.row[1] + 1)
            .every(row => !isNaN(parseFloat(row?.[range.column[0]])))
        if (isNumericX) {
            return 'scatter'
        }
    }

    // Time series data - line chart
    const firstLabel = String(sheetData[range.row[0] + 1]?.[range.column[0]] || '')
    const isTimeSeries = /\d{4}[-\/]\d{2}|\d{1,2}월|Q[1-4]|Week|주/.test(firstLabel)
    if (isTimeSeries) {
        return 'line'
    }

    // Multiple series with many categories - bar chart
    if (rowCount > 10) {
        return 'bar'
    }

    // Default - column chart
    return 'column'
}

// ============================================================================
// Chart Styling Helpers
// ============================================================================

/**
 * Get chart dimensions based on data size
 */
export function getChartDimensions(dataLength: number, seriesCount: number): { width: number; height: number } {
    const baseWidth = 400
    const baseHeight = 300

    const widthFactor = Math.min(1.5, 1 + (dataLength - 5) * 0.05)
    const heightFactor = Math.min(1.5, 1 + (seriesCount - 2) * 0.1)

    return {
        width: Math.round(baseWidth * widthFactor),
        height: Math.round(baseHeight * heightFactor)
    }
}

/**
 * Format number for chart display
 */
export function formatChartValue(value: number, compact: boolean = false): string {
    if (compact) {
        if (Math.abs(value) >= 1e9) {
            return (value / 1e9).toFixed(1) + 'B'
        }
        if (Math.abs(value) >= 1e6) {
            return (value / 1e6).toFixed(1) + 'M'
        }
        if (Math.abs(value) >= 1e3) {
            return (value / 1e3).toFixed(1) + 'K'
        }
    }
    return value.toLocaleString('ko-KR')
}

/**
 * Calculate nice axis ticks
 */
export function calculateAxisTicks(min: number, max: number, tickCount: number = 5): number[] {
    const range = max - min
    const roughStep = range / (tickCount - 1)
    const stepPower = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const normalizedStep = roughStep / stepPower

    let niceStep: number
    if (normalizedStep <= 1) niceStep = 1
    else if (normalizedStep <= 2) niceStep = 2
    else if (normalizedStep <= 5) niceStep = 5
    else niceStep = 10

    niceStep *= stepPower

    const niceMin = Math.floor(min / niceStep) * niceStep
    const niceMax = Math.ceil(max / niceStep) * niceStep

    const ticks: number[] = []
    for (let tick = niceMin; tick <= niceMax; tick += niceStep) {
        ticks.push(tick)
    }

    return ticks
}
