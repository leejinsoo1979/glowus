/**
 * AI Sheet File I/O Utilities
 * Excel (.xlsx, .xls) and CSV import/export functionality
 */

import * as XLSX from 'xlsx'
import type { CellWithPosition, Cell, Sheet } from './types'

// ============================================================================
// Types
// ============================================================================

export interface ImportResult {
    sheets: SheetData[]
    fileName: string
    fileType: 'xlsx' | 'xls' | 'csv'
}

export interface SheetData {
    name: string
    data: any[][]
    celldata: CellWithPosition[]
    rowCount: number
    colCount: number
}

export interface ExportOptions {
    fileName?: string
    sheetName?: string
    includeStyles?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert 2D array to Fortune-sheet celldata format
 */
function arrayToCelldata(data: any[][]): CellWithPosition[] {
    const celldata: CellWithPosition[] = []
    data.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== '' && value !== null && value !== undefined) {
                const cell: Cell = {
                    v: value,
                    m: String(value)
                }

                // Detect number type
                if (typeof value === 'number') {
                    cell.ct = { fa: 'General', t: 'n' }
                }
                // Detect date type
                else if (value instanceof Date) {
                    cell.v = value.toISOString()
                    cell.m = value.toLocaleDateString()
                    cell.ct = { fa: 'yyyy-MM-dd', t: 'd' }
                }
                // Detect formula
                else if (typeof value === 'string' && value.startsWith('=')) {
                    cell.f = value
                    cell.v = undefined
                    cell.m = value
                }

                celldata.push({ r, c, v: cell })
            }
        })
    })
    return celldata
}

/**
 * Convert Fortune-sheet celldata to 2D array
 */
function celldataToArray(celldata: CellWithPosition[], rows: number = 50, cols: number = 26): any[][] {
    const result: any[][] = Array(rows).fill(null).map(() => Array(cols).fill(''))
    celldata.forEach((cell) => {
        if (cell.r < rows && cell.c < cols && cell.v) {
            // Prioritize formula, then actual value, then display value
            if (cell.v.f) {
                result[cell.r][cell.c] = cell.v.f
            } else {
                result[cell.r][cell.c] = cell.v.v ?? cell.v.m ?? ''
            }
        }
    })
    return result
}

/**
 * Get dimensions of 2D array (actual data bounds)
 */
function getDataDimensions(data: any[][]): { rows: number; cols: number } {
    let maxRow = 0
    let maxCol = 0

    data.forEach((row, r) => {
        row.forEach((cell, c) => {
            if (cell !== '' && cell !== null && cell !== undefined) {
                maxRow = Math.max(maxRow, r + 1)
                maxCol = Math.max(maxCol, c + 1)
            }
        })
    })

    return { rows: Math.max(maxRow, 1), cols: Math.max(maxCol, 1) }
}

// ============================================================================
// Excel Import
// ============================================================================

/**
 * Import Excel file (.xlsx, .xls)
 */
export async function importExcel(file: File): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellStyles: true,
        cellFormula: true
    })

    const sheets: SheetData[] = workbook.SheetNames.map(name => {
        const worksheet = workbook.Sheets[name]

        // Convert to 2D array with header row
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
            header: 1,
            defval: '',
            raw: false
        })

        // Ensure we have at least an empty array
        const data = jsonData.length > 0 ? jsonData : [[]]

        // Get actual dimensions
        const { rows, cols } = getDataDimensions(data as any[][])

        // Pad data to ensure consistent dimensions
        const paddedData: any[][] = Array(Math.max(rows, 50))
            .fill(null)
            .map((_, r) =>
                Array(Math.max(cols, 26))
                    .fill('')
                    .map((_, c) => (data[r] && data[r][c] !== undefined) ? data[r][c] : '')
            )

        return {
            name,
            data: paddedData,
            celldata: arrayToCelldata(paddedData),
            rowCount: rows,
            colCount: cols
        }
    })

    const ext = file.name.split('.').pop()?.toLowerCase()

    return {
        sheets,
        fileName: file.name,
        fileType: ext === 'xls' ? 'xls' : 'xlsx'
    }
}

// ============================================================================
// Excel Export
// ============================================================================

/**
 * Export data to Excel file (.xlsx)
 */
export function exportToExcel(
    data: any[][] | CellWithPosition[],
    options: ExportOptions = {}
): void {
    const {
        fileName = 'spreadsheet',
        sheetName = 'Sheet1'
    } = options

    // Convert celldata to array if needed
    const arrayData = Array.isArray(data[0])
        ? data as any[][]
        : celldataToArray(data as CellWithPosition[])

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(arrayData)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Generate and download file
    XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

/**
 * Export multiple sheets to Excel file
 */
export function exportSheetsToExcel(
    sheets: Array<{ name: string; data: any[][] | CellWithPosition[] }>,
    fileName: string = 'spreadsheet'
): void {
    const workbook = XLSX.utils.book_new()

    sheets.forEach(sheet => {
        const arrayData = Array.isArray(sheet.data[0])
            ? sheet.data as any[][]
            : celldataToArray(sheet.data as CellWithPosition[])

        const worksheet = XLSX.utils.aoa_to_sheet(arrayData)
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
    })

    XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

// ============================================================================
// CSV Import
// ============================================================================

/**
 * Import CSV file
 */
export async function importCSV(file: File, delimiter: string = ','): Promise<ImportResult> {
    const text = await file.text()

    // Parse CSV manually to handle edge cases
    const lines = text.split(/\r?\n/)
    const data: any[][] = []

    lines.forEach(line => {
        if (line.trim() === '') return

        const row: any[] = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
            const char = line[i]

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"'
                    i++
                } else {
                    inQuotes = !inQuotes
                }
            } else if (char === delimiter && !inQuotes) {
                row.push(parseCSVValue(current.trim()))
                current = ''
            } else {
                current += char
            }
        }

        row.push(parseCSVValue(current.trim()))
        data.push(row)
    })

    // Get dimensions
    const { rows, cols } = getDataDimensions(data)

    // Pad data
    const paddedData: any[][] = Array(Math.max(rows, 50))
        .fill(null)
        .map((_, r) =>
            Array(Math.max(cols, 26))
                .fill('')
                .map((_, c) => (data[r] && data[r][c] !== undefined) ? data[r][c] : '')
        )

    return {
        sheets: [{
            name: file.name.replace(/\.csv$/i, ''),
            data: paddedData,
            celldata: arrayToCelldata(paddedData),
            rowCount: rows,
            colCount: cols
        }],
        fileName: file.name,
        fileType: 'csv'
    }
}

/**
 * Parse CSV value to appropriate type
 */
function parseCSVValue(value: string): any {
    // Remove surrounding quotes
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
    }

    // Try to parse as number
    if (/^-?\d+\.?\d*$/.test(value)) {
        const num = parseFloat(value)
        if (!isNaN(num)) return num
    }

    // Try to parse as date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        const date = new Date(value)
        if (!isNaN(date.getTime())) return value // Keep as string for display
    }

    return value
}

// ============================================================================
// CSV Export
// ============================================================================

/**
 * Export data to CSV file
 */
export function exportToCSV(
    data: any[][] | CellWithPosition[],
    options: ExportOptions = {}
): void {
    const { fileName = 'spreadsheet' } = options

    // Convert celldata to array if needed
    const arrayData = Array.isArray(data[0])
        ? data as any[][]
        : celldataToArray(data as CellWithPosition[])

    // Get actual data bounds
    const { rows, cols } = getDataDimensions(arrayData)

    // Build CSV string
    const csvContent = arrayData
        .slice(0, rows)
        .map(row =>
            row.slice(0, cols)
                .map(cell => formatCSVCell(cell))
                .join(',')
        )
        .join('\n')

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
}

/**
 * Format cell value for CSV
 */
function formatCSVCell(value: any): string {
    if (value === null || value === undefined || value === '') {
        return ''
    }

    const str = String(value)

    // Quote if contains comma, newline, or quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`
    }

    return str
}

// ============================================================================
// File Selection Helper
// ============================================================================

/**
 * Open file picker and import file
 */
export function openFilePicker(
    accept: string = '.xlsx,.xls,.csv'
): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept

        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            resolve(file || null)
        }

        input.oncancel = () => resolve(null)
        input.click()
    })
}

/**
 * Import file with auto-detection
 */
export async function importFile(file: File): Promise<ImportResult> {
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
        return importCSV(file)
    } else if (ext === 'xlsx' || ext === 'xls') {
        return importExcel(file)
    } else {
        throw new Error(`Unsupported file type: ${ext}`)
    }
}

// ============================================================================
// Clipboard Operations
// ============================================================================

/**
 * Copy data to clipboard as tab-separated values
 */
export async function copyToClipboard(data: any[][]): Promise<void> {
    const text = data
        .map(row => row.map(cell => cell ?? '').join('\t'))
        .join('\n')

    await navigator.clipboard.writeText(text)
}

/**
 * Paste from clipboard as 2D array
 */
export async function pasteFromClipboard(): Promise<any[][]> {
    const text = await navigator.clipboard.readText()

    return text
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.split('\t').map(cell => parseCSVValue(cell)))
}
