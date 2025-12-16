/**
 * AI Sheet Conditional Formatting Utilities
 * Rules-based cell formatting based on values
 */

import type { CellFormat, SingleRange } from './types'

// ============================================================================
// Types
// ============================================================================

export type ConditionType =
    | 'greaterThan'
    | 'lessThan'
    | 'equals'
    | 'notEquals'
    | 'between'
    | 'notBetween'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'empty'
    | 'notEmpty'
    | 'duplicate'
    | 'unique'
    | 'top10'
    | 'bottom10'
    | 'aboveAverage'
    | 'belowAverage'

export interface ConditionalRule {
    id: string
    type: 'highlight' | 'colorScale' | 'dataBar' | 'iconSet'
    priority: number
    range: SingleRange
    condition?: {
        type: ConditionType
        value?: any
        value2?: any  // For 'between' conditions
    }
    format?: CellFormat
    // For color scale
    colorScale?: {
        minColor: string
        midColor?: string
        maxColor: string
        minType: 'min' | 'number' | 'percent' | 'percentile'
        midType?: 'number' | 'percent' | 'percentile'
        maxType: 'max' | 'number' | 'percent' | 'percentile'
        minValue?: number
        midValue?: number
        maxValue?: number
    }
    // For data bar
    dataBar?: {
        fillColor: string
        borderColor?: string
        showValue: boolean
        minType: 'min' | 'number' | 'percent'
        maxType: 'max' | 'number' | 'percent'
        minValue?: number
        maxValue?: number
    }
    // For icon set
    iconSet?: {
        icons: IconType
        reverseIcons: boolean
        showIconOnly: boolean
        thresholds: Array<{
            type: 'number' | 'percent' | 'percentile'
            value: number
            operator: '>=' | '>'
        }>
    }
    stopIfTrue?: boolean
}

export type IconType =
    | 'arrows3'
    | 'arrows4'
    | 'arrows5'
    | 'flags3'
    | 'trafficLights3'
    | 'signs3'
    | 'symbols3'
    | 'ratings3'
    | 'ratings4'
    | 'ratings5'

export interface ConditionalFormatState {
    rules: ConditionalRule[]
    appliedFormats: Map<string, CellFormat>  // key: "row,col"
}

// ============================================================================
// Rule Evaluation
// ============================================================================

/**
 * Evaluate if a cell value meets the condition
 */
export function evaluateCondition(
    value: any,
    condition: ConditionalRule['condition'],
    allValues?: any[]
): boolean {
    if (!condition) return true

    const { type, value: condValue, value2 } = condition

    // Handle empty/not empty first
    if (type === 'empty') {
        return value == null || value === ''
    }
    if (type === 'notEmpty') {
        return value != null && value !== ''
    }

    // Null/empty values don't match other conditions
    if (value == null || value === '') return false

    // Statistical conditions need all values
    if (allValues) {
        const numericValues = allValues.filter(v => typeof v === 'number' || !isNaN(parseFloat(v)))
            .map(v => typeof v === 'number' ? v : parseFloat(v))

        if (type === 'duplicate') {
            return allValues.filter(v => v === value).length > 1
        }
        if (type === 'unique') {
            return allValues.filter(v => v === value).length === 1
        }
        if (type === 'top10') {
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            if (isNaN(numValue)) return false
            const sorted = [...numericValues].sort((a, b) => b - a)
            const threshold = sorted[Math.min(9, sorted.length - 1)]
            return numValue >= threshold
        }
        if (type === 'bottom10') {
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            if (isNaN(numValue)) return false
            const sorted = [...numericValues].sort((a, b) => a - b)
            const threshold = sorted[Math.min(9, sorted.length - 1)]
            return numValue <= threshold
        }
        if (type === 'aboveAverage') {
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            if (isNaN(numValue)) return false
            const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
            return numValue > avg
        }
        if (type === 'belowAverage') {
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            if (isNaN(numValue)) return false
            const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length
            return numValue < avg
        }
    }

    // Numeric comparisons
    const numValue = typeof value === 'number' ? value : parseFloat(value)
    const numCondValue = typeof condValue === 'number' ? condValue : parseFloat(condValue)

    switch (type) {
        case 'greaterThan':
            return !isNaN(numValue) && !isNaN(numCondValue) && numValue > numCondValue
        case 'lessThan':
            return !isNaN(numValue) && !isNaN(numCondValue) && numValue < numCondValue
        case 'equals':
            if (!isNaN(numValue) && !isNaN(numCondValue)) {
                return numValue === numCondValue
            }
            return String(value).toLowerCase() === String(condValue).toLowerCase()
        case 'notEquals':
            if (!isNaN(numValue) && !isNaN(numCondValue)) {
                return numValue !== numCondValue
            }
            return String(value).toLowerCase() !== String(condValue).toLowerCase()
        case 'between':
            const numValue2 = typeof value2 === 'number' ? value2 : parseFloat(value2)
            return !isNaN(numValue) && !isNaN(numCondValue) && !isNaN(numValue2) &&
                numValue >= numCondValue && numValue <= numValue2
        case 'notBetween':
            const numVal2 = typeof value2 === 'number' ? value2 : parseFloat(value2)
            return !isNaN(numValue) && !isNaN(numCondValue) && !isNaN(numVal2) &&
                (numValue < numCondValue || numValue > numVal2)
        case 'contains':
            return String(value).toLowerCase().includes(String(condValue).toLowerCase())
        case 'notContains':
            return !String(value).toLowerCase().includes(String(condValue).toLowerCase())
        case 'startsWith':
            return String(value).toLowerCase().startsWith(String(condValue).toLowerCase())
        case 'endsWith':
            return String(value).toLowerCase().endsWith(String(condValue).toLowerCase())
        default:
            return false
    }
}

// ============================================================================
// Color Scale
// ============================================================================

/**
 * Calculate color for a value in a color scale
 */
export function calculateColorScaleColor(
    value: number,
    min: number,
    max: number,
    colorScale: ConditionalRule['colorScale']
): string {
    if (!colorScale) return ''

    const { minColor, midColor, maxColor } = colorScale
    const range = max - min

    if (range === 0) return minColor

    const percent = (value - min) / range

    if (midColor) {
        // 3-color scale
        if (percent <= 0.5) {
            return interpolateColor(minColor, midColor, percent * 2)
        } else {
            return interpolateColor(midColor, maxColor, (percent - 0.5) * 2)
        }
    } else {
        // 2-color scale
        return interpolateColor(minColor, maxColor, percent)
    }
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, percent: number): string {
    const c1 = hexToRgb(color1)
    const c2 = hexToRgb(color2)

    if (!c1 || !c2) return color1

    const r = Math.round(c1.r + (c2.r - c1.r) * percent)
    const g = Math.round(c1.g + (c2.g - c1.g) * percent)
    const b = Math.round(c1.b + (c2.b - c1.b) * percent)

    return rgbToHex(r, g, b)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null
}

function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }).join('')
}

// ============================================================================
// Data Bar
// ============================================================================

/**
 * Calculate data bar width percentage
 */
export function calculateDataBarWidth(
    value: number,
    min: number,
    max: number,
    dataBar?: ConditionalRule['dataBar']
): number {
    if (!dataBar) return 0

    const effectiveMin = dataBar.minType === 'number' && dataBar.minValue !== undefined
        ? dataBar.minValue
        : min

    const effectiveMax = dataBar.maxType === 'number' && dataBar.maxValue !== undefined
        ? dataBar.maxValue
        : max

    const range = effectiveMax - effectiveMin
    if (range === 0) return 0

    const percent = ((value - effectiveMin) / range) * 100
    return Math.max(0, Math.min(100, percent))
}

// ============================================================================
// Icon Set
// ============================================================================

export interface IconInfo {
    name: string
    color: string
    symbol: string
}

const ICON_SETS: Record<IconType, IconInfo[]> = {
    arrows3: [
        { name: 'up', color: '#00B050', symbol: '↑' },
        { name: 'right', color: '#FFC000', symbol: '→' },
        { name: 'down', color: '#FF0000', symbol: '↓' }
    ],
    arrows4: [
        { name: 'up', color: '#00B050', symbol: '↑' },
        { name: 'upRight', color: '#92D050', symbol: '↗' },
        { name: 'downRight', color: '#FFC000', symbol: '↘' },
        { name: 'down', color: '#FF0000', symbol: '↓' }
    ],
    arrows5: [
        { name: 'up', color: '#00B050', symbol: '↑' },
        { name: 'upRight', color: '#92D050', symbol: '↗' },
        { name: 'right', color: '#FFC000', symbol: '→' },
        { name: 'downRight', color: '#FF8000', symbol: '↘' },
        { name: 'down', color: '#FF0000', symbol: '↓' }
    ],
    flags3: [
        { name: 'green', color: '#00B050', symbol: '🟢' },
        { name: 'yellow', color: '#FFC000', symbol: '🟡' },
        { name: 'red', color: '#FF0000', symbol: '🔴' }
    ],
    trafficLights3: [
        { name: 'green', color: '#00B050', symbol: '●' },
        { name: 'yellow', color: '#FFC000', symbol: '●' },
        { name: 'red', color: '#FF0000', symbol: '●' }
    ],
    signs3: [
        { name: 'check', color: '#00B050', symbol: '✓' },
        { name: 'warning', color: '#FFC000', symbol: '!' },
        { name: 'x', color: '#FF0000', symbol: '✗' }
    ],
    symbols3: [
        { name: 'check', color: '#00B050', symbol: '✔' },
        { name: 'exclaim', color: '#FFC000', symbol: '!' },
        { name: 'x', color: '#FF0000', symbol: '✖' }
    ],
    ratings3: [
        { name: 'full', color: '#FFC000', symbol: '★' },
        { name: 'half', color: '#FFC000', symbol: '◐' },
        { name: 'empty', color: '#CCCCCC', symbol: '☆' }
    ],
    ratings4: [
        { name: 'full', color: '#FFC000', symbol: '★' },
        { name: 'threeQuarter', color: '#FFC000', symbol: '◕' },
        { name: 'half', color: '#FFC000', symbol: '◐' },
        { name: 'empty', color: '#CCCCCC', symbol: '☆' }
    ],
    ratings5: [
        { name: 'full', color: '#FFC000', symbol: '★' },
        { name: 'threeQuarter', color: '#FFC000', symbol: '◕' },
        { name: 'half', color: '#FFC000', symbol: '◐' },
        { name: 'quarter', color: '#FFC000', symbol: '◔' },
        { name: 'empty', color: '#CCCCCC', symbol: '☆' }
    ]
}

/**
 * Get icon for a value based on icon set configuration
 */
export function getIconForValue(
    value: number,
    min: number,
    max: number,
    iconSet?: ConditionalRule['iconSet']
): IconInfo | null {
    if (!iconSet) return null

    const icons = ICON_SETS[iconSet.icons]
    if (!icons) return null

    const range = max - min
    if (range === 0) return icons[icons.length - 1]

    const percent = ((value - min) / range) * 100

    // Default thresholds if not specified
    const thresholds = iconSet.thresholds || icons.map((_, i) => ({
        type: 'percent' as const,
        value: ((icons.length - 1 - i) / (icons.length - 1)) * 100,
        operator: '>=' as const
    }))

    for (let i = 0; i < thresholds.length; i++) {
        const threshold = thresholds[i]
        const thresholdValue = threshold.type === 'percent'
            ? threshold.value
            : ((threshold.value - min) / range) * 100

        const matches = threshold.operator === '>='
            ? percent >= thresholdValue
            : percent > thresholdValue

        if (matches) {
            const iconIndex = iconSet.reverseIcons ? icons.length - 1 - i : i
            return icons[iconIndex]
        }
    }

    const lastIndex = iconSet.reverseIcons ? 0 : icons.length - 1
    return icons[lastIndex]
}

// ============================================================================
// Apply Conditional Formatting
// ============================================================================

/**
 * Apply conditional formatting rules to data
 */
export function applyConditionalFormatting(
    data: any[][],
    rules: ConditionalRule[]
): Map<string, { format?: CellFormat; colorScale?: string; dataBar?: number; icon?: IconInfo }> {
    const result = new Map<string, { format?: CellFormat; colorScale?: string; dataBar?: number; icon?: IconInfo }>()

    // Sort rules by priority
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority)

    for (const rule of sortedRules) {
        const { range, type } = rule
        const startRow = range.row[0]
        const endRow = range.row[1]
        const startCol = range.column[0]
        const endCol = range.column[1]

        // Collect all values in range for statistical conditions
        const allValues: any[] = []
        for (let r = startRow; r <= endRow && r < data.length; r++) {
            for (let c = startCol; c <= endCol && c < (data[r]?.length || 0); c++) {
                allValues.push(data[r][c])
            }
        }

        // Get numeric stats for color scale, data bar, icon set
        const numericValues = allValues
            .filter(v => v != null && v !== '' && !isNaN(parseFloat(v)))
            .map(v => parseFloat(v))

        const min = numericValues.length > 0 ? Math.min(...numericValues) : 0
        const max = numericValues.length > 0 ? Math.max(...numericValues) : 0

        // Apply to each cell in range
        for (let r = startRow; r <= endRow && r < data.length; r++) {
            for (let c = startCol; c <= endCol && c < (data[r]?.length || 0); c++) {
                const value = data[r][c]
                const key = `${r},${c}`

                // Skip if stopIfTrue and already has format
                if (rule.stopIfTrue && result.has(key)) continue

                switch (type) {
                    case 'highlight':
                        if (evaluateCondition(value, rule.condition, allValues)) {
                            const existing = result.get(key) || {}
                            result.set(key, { ...existing, format: rule.format })
                        }
                        break

                    case 'colorScale':
                        if (value != null && value !== '' && !isNaN(parseFloat(value))) {
                            const numValue = parseFloat(value)
                            const color = calculateColorScaleColor(numValue, min, max, rule.colorScale)
                            const existing = result.get(key) || {}
                            result.set(key, { ...existing, colorScale: color })
                        }
                        break

                    case 'dataBar':
                        if (value != null && value !== '' && !isNaN(parseFloat(value))) {
                            const numValue = parseFloat(value)
                            const width = calculateDataBarWidth(numValue, min, max, rule.dataBar)
                            const existing = result.get(key) || {}
                            result.set(key, { ...existing, dataBar: width })
                        }
                        break

                    case 'iconSet':
                        if (value != null && value !== '' && !isNaN(parseFloat(value))) {
                            const numValue = parseFloat(value)
                            const icon = getIconForValue(numValue, min, max, rule.iconSet)
                            if (icon) {
                                const existing = result.get(key) || {}
                                result.set(key, { ...existing, icon })
                            }
                        }
                        break
                }
            }
        }
    }

    return result
}

// ============================================================================
// Rule Creation Helpers
// ============================================================================

let ruleIdCounter = 0

function generateRuleId(): string {
    return `cf_${Date.now()}_${++ruleIdCounter}`
}

/**
 * Create a highlight rule
 */
export function createHighlightRule(
    range: SingleRange,
    conditionType: ConditionType,
    value: any,
    format: CellFormat,
    value2?: any
): ConditionalRule {
    return {
        id: generateRuleId(),
        type: 'highlight',
        priority: 1,
        range,
        condition: { type: conditionType, value, value2 },
        format
    }
}

/**
 * Create a color scale rule
 */
export function createColorScaleRule(
    range: SingleRange,
    minColor: string,
    maxColor: string,
    midColor?: string
): ConditionalRule {
    return {
        id: generateRuleId(),
        type: 'colorScale',
        priority: 2,
        range,
        colorScale: {
            minColor,
            midColor,
            maxColor,
            minType: 'min',
            midType: midColor ? 'percentile' : undefined,
            maxType: 'max',
            midValue: midColor ? 50 : undefined
        }
    }
}

/**
 * Create a data bar rule
 */
export function createDataBarRule(
    range: SingleRange,
    fillColor: string,
    showValue: boolean = true
): ConditionalRule {
    return {
        id: generateRuleId(),
        type: 'dataBar',
        priority: 3,
        range,
        dataBar: {
            fillColor,
            showValue,
            minType: 'min',
            maxType: 'max'
        }
    }
}

/**
 * Create an icon set rule
 */
export function createIconSetRule(
    range: SingleRange,
    icons: IconType,
    reverseIcons: boolean = false,
    showIconOnly: boolean = false
): ConditionalRule {
    const iconCount = ICON_SETS[icons].length
    const thresholds = Array.from({ length: iconCount - 1 }, (_, i) => ({
        type: 'percent' as const,
        value: ((iconCount - 1 - i) / iconCount) * 100,
        operator: '>=' as const
    }))

    return {
        id: generateRuleId(),
        type: 'iconSet',
        priority: 4,
        range,
        iconSet: {
            icons,
            reverseIcons,
            showIconOnly,
            thresholds
        }
    }
}

// ============================================================================
// Preset Conditional Formats
// ============================================================================

export const PRESET_FORMATS = {
    // Highlight presets
    greenFill: { backgroundColor: '#C6EFCE', fontColor: '#006100' },
    yellowFill: { backgroundColor: '#FFEB9C', fontColor: '#9C5700' },
    redFill: { backgroundColor: '#FFC7CE', fontColor: '#9C0006' },
    blueFill: { backgroundColor: '#9BC2E6', fontColor: '#1F497D' },

    // Color scale presets
    greenYellowRed: { minColor: '#63BE7B', midColor: '#FFEB84', maxColor: '#F8696B' },
    redYellowGreen: { minColor: '#F8696B', midColor: '#FFEB84', maxColor: '#63BE7B' },
    greenWhite: { minColor: '#63BE7B', maxColor: '#FFFFFF' },
    whiteGreen: { minColor: '#FFFFFF', maxColor: '#63BE7B' },
    blueWhiteRed: { minColor: '#5A8AC6', midColor: '#FFFFFF', maxColor: '#F8696B' },

    // Data bar presets
    blueBar: { fillColor: '#638EC6' },
    greenBar: { fillColor: '#63BE7B' },
    redBar: { fillColor: '#FF555A' },
    orangeBar: { fillColor: '#FFB628' }
} as const
