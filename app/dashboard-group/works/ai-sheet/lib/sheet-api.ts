/**
 * AI Sheet API Wrapper
 * High-level API for Fortune-sheet operations with format conversion utilities
 */

import type {
    CellFormat,
    SingleRange,
    Range,
    CellAttr,
    HorizontalAlign,
    VerticalAlign,
    FillDirection,
    InsertDirection,
    RowColumnType,
    MergeType,
    Sheet,
    Cell,
    CellWithPosition,
    SpreadsheetAction,
    CommonOptions,
} from './types'
import {
    parseCellReference,
    parseRangeReference,
    formatCellReference,
    formatRangeReference,
} from './types'

// Re-export utility functions
export { parseCellReference, parseRangeReference, formatCellReference, formatRangeReference }

// ============================================================================
// Format Conversion Utilities
// ============================================================================

/** Convert horizontal align string to Fortune-sheet value */
export function alignToHt(align: HorizontalAlign): number {
    switch (align) {
        case 'left': return 0
        case 'center': return 1
        case 'right': return 2
        default: return 0
    }
}

/** Convert vertical align string to Fortune-sheet value */
export function alignToVt(align: VerticalAlign): number {
    switch (align) {
        case 'top': return 0
        case 'middle': return 1
        case 'bottom': return 2
        default: return 1
    }
}

/** Convert boolean to Fortune-sheet numeric value */
export function boolToNum(value: boolean | undefined): number | undefined {
    if (value === undefined) return undefined
    return value ? 1 : 0
}

/** Convert CellFormat to Fortune-sheet cell attributes */
export function formatToCell(format: CellFormat): Partial<Cell> {
    const cell: Partial<Cell> = {}

    if (format.bold !== undefined) cell.bl = boolToNum(format.bold)
    if (format.italic !== undefined) cell.it = boolToNum(format.italic)
    if (format.underline !== undefined) cell.un = boolToNum(format.underline)
    if (format.strikethrough !== undefined) cell.cl = boolToNum(format.strikethrough)
    if (format.fontFamily !== undefined) cell.ff = format.fontFamily
    if (format.fontSize !== undefined) cell.fs = format.fontSize
    if (format.fontColor !== undefined) cell.fc = format.fontColor
    if (format.backgroundColor !== undefined) cell.bg = format.backgroundColor
    if (format.horizontalAlign !== undefined) cell.ht = alignToHt(format.horizontalAlign)
    if (format.verticalAlign !== undefined) cell.vt = alignToVt(format.verticalAlign)
    if (format.textWrap !== undefined) cell.tb = format.textWrap

    return cell
}

/** Apply CellFormat to sheet API ref */
export function applyCellFormat(
    ref: any,
    row: number,
    col: number,
    format: CellFormat,
    options?: CommonOptions
): void {
    if (!ref) return

    const cellAttrs = formatToCell(format)

    for (const [attr, value] of Object.entries(cellAttrs)) {
        if (value !== undefined) {
            ref.setCellFormat(row, col, attr as CellAttr, value, options)
        }
    }

    // Handle border separately as it requires special format
    if (format.border) {
        ref.setCellFormat(row, col, 'bd' as CellAttr, format.border, options)
    }
}

/** Apply CellFormat to a range */
export function applyRangeFormat(
    ref: any,
    range: SingleRange,
    format: CellFormat,
    options?: CommonOptions
): void {
    if (!ref) return

    const cellAttrs = formatToCell(format)
    const fsRange: Range = {
        row: range.row,
        column: range.column
    }

    for (const [attr, value] of Object.entries(cellAttrs)) {
        if (value !== undefined) {
            ref.setCellFormatByRange(attr as CellAttr, value, fsRange, options)
        }
    }

    // Handle border separately
    if (format.border) {
        ref.setCellFormatByRange('bd' as CellAttr, format.border, fsRange, options)
    }
}

// ============================================================================
// Sheet API Class
// ============================================================================

/**
 * SheetAPIWrapper - Wraps Fortune-sheet ref with high-level operations
 */
export class SheetAPIWrapper {
    private ref: any

    constructor(ref: any) {
        this.ref = ref
    }

    /** Check if ref is valid */
    isValid(): boolean {
        return this.ref !== null && this.ref !== undefined
    }

    /** Update ref (useful when component remounts) */
    updateRef(ref: any): void {
        this.ref = ref
    }

    // -------------------------------------------------------------------------
    // Cell Operations
    // -------------------------------------------------------------------------

    /** Get cell value at position */
    getCellValue(row: number, col: number, options?: CommonOptions): any {
        if (!this.ref) return undefined
        return this.ref.getCellValue(row, col, options)
    }

    /** Set cell value at position */
    setCellValue(row: number, col: number, value: any, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.setCellValue(row, col, value, options)
    }

    /** Set cell value using A1 notation */
    setCellByRef(cellRef: string, value: any, options?: CommonOptions): void {
        const pos = parseCellReference(cellRef)
        if (pos) {
            this.setCellValue(pos.row, pos.col, value, options)
        }
    }

    /** Set cell format attribute */
    setCellFormat(row: number, col: number, attr: CellAttr, value: any, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.setCellFormat(row, col, attr, value, options)
    }

    /** Apply cell format using CellFormat object */
    setCellFormatObject(row: number, col: number, format: CellFormat, options?: CommonOptions): void {
        applyCellFormat(this.ref, row, col, format, options)
    }

    /** Clear cell at position */
    clearCell(row: number, col: number, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.clearCell(row, col, options)
    }

    /** Auto-fill cells from source to target */
    autoFill(copyRange: SingleRange, applyRange: SingleRange, direction: FillDirection): void {
        if (!this.ref) return
        this.ref.autoFillCell(copyRange, applyRange, direction)
    }

    // -------------------------------------------------------------------------
    // Range Operations
    // -------------------------------------------------------------------------

    /** Set multiple cell values by range */
    setCellsByRange(data: any[][], range: SingleRange, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.setCellValuesByRange(data, range, options)
    }

    /** Set format for entire range */
    setRangeFormat(range: SingleRange, format: CellFormat, options?: CommonOptions): void {
        applyRangeFormat(this.ref, range, format, options)
    }

    /** Set format attribute for range */
    setRangeFormatAttr(attr: CellAttr, value: any, range: SingleRange | Range, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.setCellFormatByRange(attr, value, range, options)
    }

    /** Get current selection */
    getSelection(): Range[] | undefined {
        if (!this.ref) return undefined
        return this.ref.getSelection()
    }

    /** Set selection range */
    setSelection(range: Range, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.setSelection(range, options)
    }

    /** Get cells in a range */
    getCellsByRange(range: Range, options?: CommonOptions): (Cell | null)[][] {
        if (!this.ref) return []
        return this.ref.getCellsByRange(range, options)
    }

    /** Clear range content */
    clearRange(range: SingleRange, type: 'all' | 'content' | 'format' = 'all', options?: CommonOptions): void {
        if (!this.ref) return

        for (let r = range.row[0]; r <= range.row[1]; r++) {
            for (let c = range.column[0]; c <= range.column[1]; c++) {
                if (type === 'all' || type === 'content') {
                    this.ref.clearCell(r, c, options)
                }
                if (type === 'format') {
                    // Clear formatting by setting default values
                    this.ref.setCellFormat(r, c, 'bg', null, options)
                    this.ref.setCellFormat(r, c, 'fc', null, options)
                    this.ref.setCellFormat(r, c, 'bl', 0, options)
                    this.ref.setCellFormat(r, c, 'it', 0, options)
                    this.ref.setCellFormat(r, c, 'un', 0, options)
                    this.ref.setCellFormat(r, c, 'cl', 0, options)
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // Row/Column Operations
    // -------------------------------------------------------------------------

    /** Insert row at index */
    insertRow(index: number, count: number = 1, direction: InsertDirection = 'rightbottom', options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.insertRowOrColumn('row', index, count, direction, options)
    }

    /** Insert column at index */
    insertColumn(index: number, count: number = 1, direction: InsertDirection = 'rightbottom', options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.insertRowOrColumn('column', index, count, direction, options)
    }

    /** Delete rows from start to end */
    deleteRows(start: number, end: number = start, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.deleteRowOrColumn('row', start, end, options)
    }

    /** Delete columns from start to end */
    deleteColumns(start: number, end: number = start, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.deleteRowOrColumn('column', start, end, options)
    }

    /** Set row height */
    setRowHeight(rowHeights: Record<number, number>, options?: CommonOptions): void {
        if (!this.ref) return
        const stringKeyHeights: Record<string, number> = {}
        for (const [key, value] of Object.entries(rowHeights)) {
            stringKeyHeights[key] = value
        }
        this.ref.setRowHeight(stringKeyHeights, options)
    }

    /** Set column width */
    setColumnWidth(colWidths: Record<number, number>, options?: CommonOptions): void {
        if (!this.ref) return
        const stringKeyWidths: Record<string, number> = {}
        for (const [key, value] of Object.entries(colWidths)) {
            stringKeyWidths[key] = value
        }
        this.ref.setColumnWidth(stringKeyWidths, options)
    }

    /** Get row heights */
    getRowHeight(rows: number[], options?: CommonOptions): Record<number, number> {
        if (!this.ref) return {}
        return this.ref.getRowHeight(rows, options)
    }

    /** Get column widths */
    getColumnWidth(columns: number[], options?: CommonOptions): Record<number, number> {
        if (!this.ref) return {}
        return this.ref.getColumnWidth(columns, options)
    }

    /** Hide rows */
    hideRows(rows: number[]): void {
        if (!this.ref) return
        this.ref.hideRowOrColumn(rows.map(String), 'row')
    }

    /** Show rows */
    showRows(rows: number[]): void {
        if (!this.ref) return
        this.ref.showRowOrColumn(rows.map(String), 'row')
    }

    /** Hide columns */
    hideColumns(columns: number[]): void {
        if (!this.ref) return
        this.ref.hideRowOrColumn(columns.map(String), 'column')
    }

    /** Show columns */
    showColumns(columns: number[]): void {
        if (!this.ref) return
        this.ref.showRowOrColumn(columns.map(String), 'column')
    }

    // -------------------------------------------------------------------------
    // Merge Operations
    // -------------------------------------------------------------------------

    /** Merge cells in range */
    mergeCells(range: SingleRange, type: MergeType = 'merge-all', options?: CommonOptions): void {
        if (!this.ref) return
        const fsRange: Range = { row: range.row, column: range.column }
        this.ref.mergeCells(fsRange, type, options)
    }

    /** Unmerge cells in range */
    unmergeCells(range: SingleRange, options?: CommonOptions): void {
        if (!this.ref) return
        const fsRange: Range = { row: range.row, column: range.column }
        this.ref.cancelMerge(fsRange, options)
    }

    // -------------------------------------------------------------------------
    // Undo/Redo
    // -------------------------------------------------------------------------

    /** Undo last action */
    undo(): void {
        if (!this.ref) return
        this.ref.handleUndo()
    }

    /** Redo last undone action */
    redo(): void {
        if (!this.ref) return
        this.ref.handleRedo()
    }

    // -------------------------------------------------------------------------
    // Formula
    // -------------------------------------------------------------------------

    /** Set formula at cell */
    setFormula(row: number, col: number, formula: string, options?: CommonOptions): void {
        if (!this.ref) return
        // Formula should start with '='
        const f = formula.startsWith('=') ? formula : `=${formula}`
        this.ref.setCellValue(row, col, { f }, options)
    }

    /** Set formula using A1 notation */
    setFormulaByRef(cellRef: string, formula: string, options?: CommonOptions): void {
        const pos = parseCellReference(cellRef)
        if (pos) {
            this.setFormula(pos.row, pos.col, formula, options)
        }
    }

    /** Calculate all formulas */
    calculateFormulas(sheetId?: string, range?: SingleRange): void {
        if (!this.ref) return
        this.ref.calculateFormula(sheetId, range)
    }

    // -------------------------------------------------------------------------
    // Sheet Operations
    // -------------------------------------------------------------------------

    /** Get all sheets */
    getAllSheets(): Sheet[] {
        if (!this.ref) return []
        return this.ref.getAllSheets()
    }

    /** Get current sheet */
    getSheet(options?: CommonOptions): Sheet | null {
        if (!this.ref) return null
        return this.ref.getSheet(options)
    }

    /** Add new sheet */
    addSheet(sheetId?: string): void {
        if (!this.ref) return
        this.ref.addSheet(sheetId)
    }

    /** Delete current sheet */
    deleteSheet(options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.deleteSheet(options)
    }

    /** Activate sheet */
    activateSheet(options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.activateSheet(options)
    }

    /** Set sheet name */
    setSheetName(name: string, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.setSheetName(name, options)
    }

    /** Set sheet order */
    setSheetOrder(orderList: Record<string, number>): void {
        if (!this.ref) return
        this.ref.setSheetOrder(orderList)
    }

    /** Scroll to position */
    scroll(options: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }): void {
        if (!this.ref) return
        this.ref.scroll(options)
    }

    // -------------------------------------------------------------------------
    // Freeze
    // -------------------------------------------------------------------------

    /** Freeze rows/columns */
    freeze(type: 'row' | 'column' | 'both', range: { row: number; column: number }, options?: CommonOptions): void {
        if (!this.ref) return
        this.ref.freeze(type, range, options)
    }

    // -------------------------------------------------------------------------
    // Batch Operations
    // -------------------------------------------------------------------------

    /** Execute multiple API calls in batch */
    batchExecute(apiCalls: { name: string; args: any[] }[]): void {
        if (!this.ref) return
        this.ref.batchCallApis(apiCalls)
    }

    // -------------------------------------------------------------------------
    // Data Conversion
    // -------------------------------------------------------------------------

    /** Convert 2D array to celldata format */
    dataToCelldata(data: (Cell | null)[][] | undefined): CellWithPosition[] {
        if (!this.ref) return []
        return this.ref.dataToCelldata(data)
    }

    /** Convert celldata to 2D array format */
    celldataToData(celldata: CellWithPosition[], rowCount?: number, colCount?: number): (Cell | null)[][] | null {
        if (!this.ref) return null
        return this.ref.celldataToData(celldata, rowCount, colCount)
    }

    // -------------------------------------------------------------------------
    // AI Action Execution
    // -------------------------------------------------------------------------

    /** Execute an AI-generated action */
    executeAction(action: SpreadsheetAction): void {
        if (!this.ref || !action) return

        switch (action.type) {
            case 'set_cells':
                if (action.data?.cells) {
                    action.data.cells.forEach((cell: any) => {
                        this.setCellValue(cell.row, cell.col, cell.value)
                        if (cell.format) {
                            this.setCellFormatObject(cell.row, cell.col, cell.format)
                        }
                    })
                }
                break

            case 'set_formula':
                if (action.data) {
                    this.setFormula(action.data.row, action.data.col, action.data.formula)
                }
                break

            case 'clear':
                if (action.data?.range) {
                    this.clearRange(action.data.range, action.data.type || 'all')
                } else {
                    // Clear all - need to get sheet dimensions
                    const sheet = this.getSheet()
                    if (sheet) {
                        const rows = sheet.row || 50
                        const cols = sheet.column || 26
                        this.clearRange({ row: [0, rows - 1], column: [0, cols - 1] })
                    }
                }
                break

            case 'format_cells':
                if (action.data?.range && action.data?.format) {
                    this.setRangeFormat(action.data.range, action.data.format)
                }
                break

            case 'insert_row':
                this.insertRow(
                    action.data?.index ?? 0,
                    action.data?.count ?? 1,
                    action.data?.direction ?? 'rightbottom'
                )
                break

            case 'insert_col':
                this.insertColumn(
                    action.data?.index ?? 0,
                    action.data?.count ?? 1,
                    action.data?.direction ?? 'rightbottom'
                )
                break

            case 'delete_row':
                this.deleteRows(
                    action.data?.start ?? 0,
                    action.data?.end ?? action.data?.start ?? 0
                )
                break

            case 'delete_col':
                this.deleteColumns(
                    action.data?.start ?? 0,
                    action.data?.end ?? action.data?.start ?? 0
                )
                break

            case 'merge_cells':
                if (action.data?.range) {
                    this.mergeCells(action.data.range, action.data.type || 'merge-all')
                }
                break

            case 'unmerge_cells':
                if (action.data?.range) {
                    this.unmergeCells(action.data.range)
                }
                break

            case 'auto_fill':
                if (action.data?.sourceRange && action.data?.targetRange && action.data?.direction) {
                    this.autoFill(action.data.sourceRange, action.data.targetRange, action.data.direction)
                }
                break

            case 'set_row_height':
                if (action.data?.heights) {
                    this.setRowHeight(action.data.heights)
                }
                break

            case 'set_col_width':
                if (action.data?.widths) {
                    this.setColumnWidth(action.data.widths)
                }
                break

            case 'hide_row':
                if (action.data?.rows) {
                    this.hideRows(action.data.rows)
                }
                break

            case 'hide_col':
                if (action.data?.columns) {
                    this.hideColumns(action.data.columns)
                }
                break

            case 'show_row':
                if (action.data?.rows) {
                    this.showRows(action.data.rows)
                }
                break

            case 'show_col':
                if (action.data?.columns) {
                    this.showColumns(action.data.columns)
                }
                break

            case 'add_sheet':
                this.addSheet(action.data?.sheetId)
                break

            case 'delete_sheet':
                this.deleteSheet(action.data)
                break

            case 'rename_sheet':
                if (action.data?.name) {
                    this.setSheetName(action.data.name, action.data)
                }
                break

            // Future: sort_range, filter_range, conditional_format, create_chart
            default:
                console.warn(`Unhandled action type: ${action.type}`)
        }
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/** Create a SheetAPIWrapper from a ref */
export function createSheetAPI(ref: any): SheetAPIWrapper {
    return new SheetAPIWrapper(ref)
}
