/**
 * AI Sheet Type Definitions
 * Fortune-sheet API wrapper types for comprehensive spreadsheet operations
 */

// ============================================================================
// Core Cell Types
// ============================================================================

export interface CellStyle {
    /** Bold (0 = normal, 1 = bold) */
    bl?: number
    /** Italic (0 = normal, 1 = italic) */
    it?: number
    /** Font family (name or index) */
    ff?: number | string
    /** Font size in pixels */
    fs?: number
    /** Font color (hex, e.g., "#FF0000") */
    fc?: string
    /** Horizontal alignment (0 = left, 1 = center, 2 = right) */
    ht?: number
    /** Vertical alignment (0 = top, 1 = middle, 2 = bottom) */
    vt?: number
    /** Text wrap ('overflow' | 'wrap' | 'clip') */
    tb?: string
    /** Strikethrough (0 = none, 1 = strikethrough) */
    cl?: number
    /** Underline (0 = none, 1 = underline) */
    un?: number
    /** Text rotation */
    tr?: string
}

export interface Cell extends CellStyle {
    /** Actual value */
    v?: string | number | boolean
    /** Display value (formatted) */
    m?: string | number
    /** Merge cell info */
    mc?: {
        r: number
        c: number
        rs?: number  // Row span
        cs?: number  // Column span
    }
    /** Formula (e.g., "=SUM(A1:A10)") */
    f?: string
    /** Cell type info */
    ct?: {
        fa?: string  // Format string (e.g., "0.00%", "yyyy-MM-dd")
        t?: string   // Type ('g' = general, 'n' = number, 'd' = date, 's' = string)
        s?: any      // Rich text segments
    }
    /** Background color (hex) */
    bg?: string
    /** Comment/note */
    ps?: {
        left: number | null
        top: number | null
        width: number | null
        height: number | null
        value: string
        isShow: boolean
    }
}

export interface CellWithPosition {
    r: number
    c: number
    v: Cell | null
}

// ============================================================================
// Range Types
// ============================================================================

export interface SingleRange {
    row: [number, number]     // [startRow, endRow]
    column: [number, number]  // [startCol, endCol]
}

export interface Range {
    row: number[]     // [startRow, endRow]
    column: number[]  // [startCol, endCol]
}

export interface Selection extends Range {
    row_focus?: number
    column_focus?: number
    row_select?: boolean
    column_select?: boolean
}

export interface CellPosition {
    r: number
    c: number
}

// ============================================================================
// Format Types
// ============================================================================

export type HorizontalAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface BorderStyle {
    borderType:
        | 'border-left'
        | 'border-right'
        | 'border-top'
        | 'border-bottom'
        | 'border-all'
        | 'border-outside'
        | 'border-inside'
        | 'border-horizontal'
        | 'border-vertical'
        | 'border-none'
    /** Border thickness (1-13) */
    style: number
    /** Border color (hex) */
    color: string
}

export interface CellFormat {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strikethrough?: boolean
    fontFamily?: string
    fontSize?: number
    fontColor?: string
    backgroundColor?: string
    horizontalAlign?: HorizontalAlign
    verticalAlign?: VerticalAlign
    textWrap?: 'overflow' | 'wrap' | 'clip'
    border?: BorderStyle
}

// ============================================================================
// Sheet Types
// ============================================================================

export interface SheetConfig {
    merge?: Record<string, {
        r: number
        c: number
        rs: number
        cs: number
    }>
    rowlen?: Record<string, number>
    columnlen?: Record<string, number>
    rowhidden?: Record<string, number>
    colhidden?: Record<string, number>
    borderInfo?: any[]
}

export interface Sheet {
    id?: string
    name: string
    status?: number
    order?: number
    color?: string
    data?: (Cell | null)[][]
    celldata?: CellWithPosition[]
    config?: SheetConfig
    row?: number
    column?: number
    zoomRatio?: number
    showGridLines?: boolean | number
    frozen?: {
        type: 'row' | 'column' | 'both' | 'rangeRow' | 'rangeColumn' | 'rangeBoth'
        range?: {
            row_focus: number
            column_focus: number
        }
    }
}

// ============================================================================
// API Option Types
// ============================================================================

export interface CommonOptions {
    /** Sheet ID (defaults to current sheet) */
    id?: string
    /** Sheet order/index */
    order?: number
}

export type CellAttr = keyof Cell

export type InsertDirection = 'lefttop' | 'rightbottom'
export type FillDirection = 'up' | 'down' | 'left' | 'right'
export type RowColumnType = 'row' | 'column'

// ============================================================================
// Merge Types
// ============================================================================

export type MergeType =
    | 'merge-all'        // Merge all cells
    | 'merge-horizontal' // Merge by row
    | 'merge-vertical'   // Merge by column

// ============================================================================
// Conditional Format Types
// ============================================================================

export interface ConditionalRule {
    type: 'highlight' | 'dataBar' | 'colorScale' | 'iconSet'
    condition: {
        type: 'greaterThan' | 'lessThan' | 'between' | 'equal' | 'text' | 'duplicate' | 'unique' | 'top10' | 'bottom10'
        value?: number | string
        value2?: number  // For 'between' condition
    }
    format?: CellFormat
    dataBar?: {
        minColor: string
        maxColor: string
        gradient?: boolean
    }
    colorScale?: {
        minColor: string
        midColor?: string
        maxColor: string
    }
    iconSet?: {
        icons: string[]
        reverse?: boolean
    }
}

// ============================================================================
// Sort/Filter Types
// ============================================================================

export interface SortConfig {
    column: number
    order: 'asc' | 'desc'
}

export interface FilterCondition {
    type: 'text' | 'number' | 'date' | 'color'
    operator:
        | 'equals'
        | 'notEquals'
        | 'contains'
        | 'notContains'
        | 'startsWith'
        | 'endsWith'
        | 'greaterThan'
        | 'lessThan'
        | 'greaterOrEqual'
        | 'lessOrEqual'
        | 'between'
        | 'before'
        | 'after'
        | 'empty'
        | 'notEmpty'
    value: string | number | Date
    value2?: string | number | Date  // For 'between' operator
}

// ============================================================================
// Chart Types
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

export interface ChartOptions {
    type: ChartType
    title?: string
    dataRange: SingleRange
    labelRange?: SingleRange
    legendPosition?: 'top' | 'bottom' | 'left' | 'right' | 'none'
    showValues?: boolean
    showLabels?: boolean
    colors?: string[]
}

// ============================================================================
// AI Action Types
// ============================================================================

export type AIActionType =
    // Cell operations
    | 'set_cells'
    | 'set_formula'
    | 'clear'
    | 'format_cells'
    // Row/Column operations
    | 'insert_row'
    | 'insert_col'
    | 'delete_row'
    | 'delete_col'
    | 'set_row_height'
    | 'set_col_width'
    | 'hide_row'
    | 'hide_col'
    | 'show_row'
    | 'show_col'
    // Merge operations
    | 'merge_cells'
    | 'unmerge_cells'
    // Data operations
    | 'sort_range'
    | 'filter_range'
    | 'auto_fill'
    | 'find_replace'
    // Formatting
    | 'conditional_format'
    | 'clear_format'
    // Chart
    | 'create_chart'
    | 'update_chart'
    | 'delete_chart'
    // Sheet operations
    | 'add_sheet'
    | 'delete_sheet'
    | 'rename_sheet'

export interface AIAction {
    type: AIActionType
    data?: any
}

export interface SetCellsAction extends AIAction {
    type: 'set_cells'
    data: {
        cells: Array<{
            row: number
            col: number
            value: string | number | boolean
            format?: CellFormat
        }>
    }
}

export interface SetFormulaAction extends AIAction {
    type: 'set_formula'
    data: {
        row: number
        col: number
        formula: string
    }
}

export interface ClearAction extends AIAction {
    type: 'clear'
    data: {
        range?: SingleRange
        type?: 'all' | 'content' | 'format'
    }
}

export interface FormatCellsAction extends AIAction {
    type: 'format_cells'
    data: {
        range: SingleRange
        format: CellFormat
    }
}

export interface InsertRowAction extends AIAction {
    type: 'insert_row'
    data: {
        index: number
        count?: number
        direction?: InsertDirection
    }
}

export interface InsertColAction extends AIAction {
    type: 'insert_col'
    data: {
        index: number
        count?: number
        direction?: InsertDirection
    }
}

export interface DeleteRowAction extends AIAction {
    type: 'delete_row'
    data: {
        start: number
        end?: number
    }
}

export interface DeleteColAction extends AIAction {
    type: 'delete_col'
    data: {
        start: number
        end?: number
    }
}

export interface MergeCellsAction extends AIAction {
    type: 'merge_cells'
    data: {
        range: SingleRange
        type?: MergeType
    }
}

export interface UnmergeCellsAction extends AIAction {
    type: 'unmerge_cells'
    data: {
        range: SingleRange
    }
}

export interface SortRangeAction extends AIAction {
    type: 'sort_range'
    data: {
        range: SingleRange
        sorts: SortConfig[]
    }
}

export interface AutoFillAction extends AIAction {
    type: 'auto_fill'
    data: {
        sourceRange: SingleRange
        targetRange: SingleRange
        direction: FillDirection
    }
}

export interface ConditionalFormatAction extends AIAction {
    type: 'conditional_format'
    data: {
        range: SingleRange
        rule: ConditionalRule
    }
}

export interface CreateChartAction extends AIAction {
    type: 'create_chart'
    data: ChartOptions & {
        position?: {
            left: number
            top: number
            width: number
            height: number
        }
    }
}

// Union type for all AI actions
export type SpreadsheetAction =
    | SetCellsAction
    | SetFormulaAction
    | ClearAction
    | FormatCellsAction
    | InsertRowAction
    | InsertColAction
    | DeleteRowAction
    | DeleteColAction
    | MergeCellsAction
    | UnmergeCellsAction
    | SortRangeAction
    | AutoFillAction
    | ConditionalFormatAction
    | CreateChartAction
    | AIAction

// ============================================================================
// Sheet API Interface
// ============================================================================

export interface SheetAPI {
    // Cell operations
    getCellValue(row: number, col: number, options?: CommonOptions): any
    setCellValue(row: number, col: number, value: any, options?: CommonOptions): void
    setCellFormat(row: number, col: number, attr: CellAttr, value: any, options?: CommonOptions): void
    clearCell(row: number, col: number, options?: CommonOptions): void
    autoFillCell(copyRange: SingleRange, applyRange: SingleRange, direction: FillDirection): void

    // Range operations
    setCellValuesByRange(data: any[][], range: SingleRange, options?: CommonOptions): void
    setCellFormatByRange(attr: CellAttr, value: any, range: SingleRange | Range, options?: CommonOptions): void
    getSelection(): Range[] | undefined
    setSelection(range: Range, options?: CommonOptions): void
    getCellsByRange(range: Selection, options?: CommonOptions): (Cell | null)[][]

    // Row/Column operations
    insertRowOrColumn(type: RowColumnType, index: number, count: number, direction?: InsertDirection, options?: CommonOptions): void
    deleteRowOrColumn(type: RowColumnType, start: number, end: number, options?: CommonOptions): void
    setRowHeight(rowInfo: Record<string, number>, options?: CommonOptions): void
    setColumnWidth(columnInfo: Record<string, number>, options?: CommonOptions): void
    getRowHeight(rows: number[], options?: CommonOptions): Record<number, number>
    getColumnWidth(columns: number[], options?: CommonOptions): Record<number, number>
    hideRowOrColumn(rowColInfo: string[], type: RowColumnType): void
    showRowOrColumn(rowColInfo: string[], type: RowColumnType): void

    // Merge operations
    mergeCells(ranges: Range, type: string, options?: CommonOptions): void
    cancelMerge(ranges: Range, options?: CommonOptions): void

    // Undo/Redo
    handleUndo(): void
    handleRedo(): void

    // Formula
    calculateFormula(id?: string, range?: SingleRange): void

    // Sheet operations
    getAllSheets(): Sheet[]
    getSheet(options?: CommonOptions): Sheet
    addSheet(sheetId?: string): void
    deleteSheet(options?: CommonOptions): void
    activateSheet(options?: CommonOptions): void
    setSheetName(name: string, options?: CommonOptions): void
    setSheetOrder(orderList: Record<string, number>): void
    scroll(options: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }): void

    // Data conversion utilities
    dataToCelldata(data: (Cell | null)[][] | undefined): CellWithPosition[]
    celldataToData(celldata: CellWithPosition[], rowCount?: number, colCount?: number): (Cell | null)[][] | null

    // Freeze
    freeze(type: 'row' | 'column' | 'both', range: { row: number; column: number }, options?: CommonOptions): void

    // Batch operations
    batchCallApis(apiCalls: { name: string; args: any[] }[]): void
}

// ============================================================================
// Utility Types
// ============================================================================

/** Column letter to index (A=0, B=1, ..., Z=25, AA=26, etc.) */
export function columnLetterToIndex(letter: string): number {
    let result = 0
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
    }
    return result - 1
}

/** Index to column letter (0=A, 1=B, ..., 25=Z, 26=AA, etc.) */
export function indexToColumnLetter(index: number): string {
    let result = ''
    let n = index + 1
    while (n > 0) {
        n--
        result = String.fromCharCode('A'.charCodeAt(0) + (n % 26)) + result
        n = Math.floor(n / 26)
    }
    return result
}

/** Parse cell reference (e.g., "A1" -> { row: 0, col: 0 }) */
export function parseCellReference(ref: string): { row: number; col: number } | null {
    const match = ref.match(/^([A-Z]+)(\d+)$/i)
    if (!match) return null
    const col = columnLetterToIndex(match[1].toUpperCase())
    const row = parseInt(match[2], 10) - 1
    return { row, col }
}

/** Parse range reference (e.g., "A1:B10" -> SingleRange) */
export function parseRangeReference(ref: string): SingleRange | null {
    const parts = ref.split(':')
    if (parts.length !== 2) return null
    const start = parseCellReference(parts[0])
    const end = parseCellReference(parts[1])
    if (!start || !end) return null
    return {
        row: [start.row, end.row],
        column: [start.col, end.col]
    }
}

/** Format cell reference (e.g., { row: 0, col: 0 } -> "A1") */
export function formatCellReference(row: number, col: number): string {
    return `${indexToColumnLetter(col)}${row + 1}`
}

/** Format range reference (e.g., SingleRange -> "A1:B10") */
export function formatRangeReference(range: SingleRange): string {
    return `${formatCellReference(range.row[0], range.column[0])}:${formatCellReference(range.row[1], range.column[1])}`
}
