"use client"

import { forwardRef, useEffect, useRef, useImperativeHandle, useState, useCallback, type ComponentType } from "react"
import type { WorkbookInstance } from "@fortune-sheet/react/dist/components/Workbook"
import type { Sheet, CellWithPosition, Cell, SingleRange, Range, CellFormat, CommonOptions } from "./lib/types"

// Dynamically import Fortune-sheet only on client side
let WorkbookComponent: ComponentType<any> | null = null

// ============================================================================
// Types
// ============================================================================

interface SpreadsheetEditorProps {
    /** Initial data as 2D array */
    data: any[][]
    /** Callback when data changes */
    onChange: (data: any[][]) => void
    /** Callback when sheet is ready with API ref */
    onReady?: (api: SpreadsheetEditorAPI) => void
}

/** API exposed by SpreadsheetEditor via ref */
export interface SpreadsheetEditorAPI {
    // Raw Fortune-sheet ref access
    getWorkbookRef: () => WorkbookInstance | null

    // Legacy API (backward compatible)
    getData: () => any[][]
    setData: (data: any[][]) => void

    // Cell Operations
    getCellValue: (row: number, col: number, options?: CommonOptions) => any
    setCellValue: (row: number, col: number, value: any, options?: CommonOptions) => void
    setCellFormat: (row: number, col: number, attr: keyof Cell, value: any, options?: CommonOptions) => void
    clearCell: (row: number, col: number, options?: CommonOptions) => void
    autoFillCell: (copyRange: SingleRange, applyRange: SingleRange, direction: 'up' | 'down' | 'left' | 'right') => void

    // Range Operations
    setCellValuesByRange: (data: any[][], range: SingleRange, options?: CommonOptions) => void
    setCellFormatByRange: (attr: keyof Cell, value: any, range: SingleRange | Range, options?: CommonOptions) => void
    getSelection: () => Range[] | undefined
    setSelection: (range: Range, options?: CommonOptions) => void
    getCellsByRange: (range: Range, options?: CommonOptions) => (Cell | null)[][]

    // Row/Column Operations
    insertRowOrColumn: (type: 'row' | 'column', index: number, count: number, direction?: 'lefttop' | 'rightbottom', options?: CommonOptions) => void
    deleteRowOrColumn: (type: 'row' | 'column', start: number, end: number, options?: CommonOptions) => void
    setRowHeight: (rowInfo: Record<string, number>, options?: CommonOptions) => void
    setColumnWidth: (columnInfo: Record<string, number>, options?: CommonOptions) => void
    getRowHeight: (rows: number[], options?: CommonOptions) => Record<number, number>
    getColumnWidth: (columns: number[], options?: CommonOptions) => Record<number, number>
    hideRowOrColumn: (rowColInfo: string[], type: 'row' | 'column') => void
    showRowOrColumn: (rowColInfo: string[], type: 'row' | 'column') => void

    // Merge Operations
    mergeCells: (ranges: Range, type: string, options?: CommonOptions) => void
    cancelMerge: (ranges: Range, options?: CommonOptions) => void

    // Undo/Redo
    handleUndo: () => void
    handleRedo: () => void

    // Formula
    calculateFormula: (id?: string, range?: SingleRange) => void

    // Sheet Operations
    getAllSheets: () => Sheet[]
    getSheet: (options?: CommonOptions) => Sheet | null
    addSheet: (sheetId?: string) => void
    deleteSheet: (options?: CommonOptions) => void
    activateSheet: (options?: CommonOptions) => void
    setSheetName: (name: string, options?: CommonOptions) => void
    setSheetOrder: (orderList: Record<string, number>) => void
    scroll: (options: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }) => void

    // Freeze
    freeze: (type: 'row' | 'column' | 'both', range: { row: number; column: number }, options?: CommonOptions) => void

    // Data Conversion
    dataToCelldata: (data: (Cell | null)[][] | undefined) => CellWithPosition[]
    celldataToData: (celldata: CellWithPosition[], rowCount?: number, colCount?: number) => (Cell | null)[][] | null

    // Batch Operations
    batchCallApis: (apiCalls: { name: string; args: any[] }[]) => void
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Convert 2D array to Fortune-sheet celldata format */
function convertToCelldata(data: any[][]): CellWithPosition[] {
    const celldata: CellWithPosition[] = []
    data.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== '' && value !== null && value !== undefined) {
                celldata.push({
                    r,
                    c,
                    v: { v: value, m: String(value) }
                })
            }
        })
    })
    return celldata
}

/** Convert Fortune-sheet celldata to 2D array */
function convertToArray(celldata: CellWithPosition[], rows: number = 50, cols: number = 26): any[][] {
    const result: any[][] = Array(rows).fill(null).map(() => Array(cols).fill(''))
    celldata.forEach((cell) => {
        if (cell.r < rows && cell.c < cols && cell.v) {
            result[cell.r][cell.c] = cell.v.v ?? cell.v.m ?? ''
        }
    })
    return result
}

// ============================================================================
// SpreadsheetEditor Component
// ============================================================================

const SpreadsheetEditor = forwardRef<SpreadsheetEditorAPI, SpreadsheetEditorProps>(
    ({ data, onChange, onReady }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null)
        const workbookRef = useRef<WorkbookInstance | null>(null)
        const [isMounted, setIsMounted] = useState(false)
        const [sheetData, setSheetData] = useState<Sheet[]>([{
            name: "Sheet1",
            color: "",
            status: 1,
            order: 0,
            celldata: [],
            config: {},
            id: "sheet_01",
        }])
        const [sheetKey, setSheetKey] = useState(0)
        const prevDataRef = useRef<string>('')
        const isReadyRef = useRef(false)

        // Ensure client-side only mounting and dynamic import
        useEffect(() => {
            let mounted = true

            const loadWorkbook = async () => {
                try {
                    if (!WorkbookComponent) {
                        // Import CSS first
                        const cssLink = document.createElement('link')
                        cssLink.rel = 'stylesheet'
                        cssLink.href = '/_next/static/css/fortune-sheet.css'

                        // Check if CSS is already loaded, if not try to load from node_modules
                        if (!document.querySelector('link[href*="fortune-sheet"]')) {
                            // The CSS is bundled, we just need to import the module
                        }

                        const module = await import("@fortune-sheet/react")
                        WorkbookComponent = module.Workbook
                    }
                    if (mounted) {
                        setIsMounted(true)
                    }
                } catch (error) {
                    console.error('Failed to load Fortune-sheet:', error)
                }
            }

            loadWorkbook()

            return () => {
                mounted = false
            }
        }, [])

        // Update sheetData when data prop changes
        useEffect(() => {
            const celldata = convertToCelldata(data)
            const dataHash = JSON.stringify(celldata.slice(0, 10)) // Simple hash of first 10 cells

            // Only update if data actually changed
            if (dataHash !== prevDataRef.current) {
                prevDataRef.current = dataHash

                if (celldata.length > 0) {
                    console.log('SpreadsheetEditor: Updating with', celldata.length, 'cells')

                    // Update sheet data and force re-mount by changing key
                    setSheetData([{
                        name: "Sheet1",
                        color: "",
                        status: 1,
                        order: 0,
                        celldata,
                        config: {},
                        id: "sheet_01",
                    }])

                    // Use setTimeout to ensure state update is committed before key change
                    setTimeout(() => {
                        setSheetKey(prev => prev + 1)
                    }, 50)
                }
            }
        }, [data])

        // Create API object
        const createAPI = useCallback((): SpreadsheetEditorAPI => {
            const getRef = () => workbookRef.current

            return {
                // Raw access
                getWorkbookRef: () => getRef(),

                // Legacy API
                getData: () => {
                    const ref = getRef()
                    if (!ref) {
                        // Fallback to current state
                        const result: any[][] = Array(50).fill(null).map(() => Array(26).fill(''))
                        sheetData[0]?.celldata?.forEach((cell: CellWithPosition) => {
                            if (cell.r < 50 && cell.c < 26 && cell.v) {
                                result[cell.r][cell.c] = cell.v.v ?? cell.v.m ?? ''
                            }
                        })
                        return result
                    }
                    try {
                        const sheet = ref.getSheet()
                        if (!sheet?.celldata) return Array(50).fill(null).map(() => Array(26).fill(''))
                        return convertToArray(sheet.celldata)
                    } catch (e) {
                        // Sheet not ready yet, fallback to state
                        const result: any[][] = Array(50).fill(null).map(() => Array(26).fill(''))
                        sheetData[0]?.celldata?.forEach((cell: CellWithPosition) => {
                            if (cell.r < 50 && cell.c < 26 && cell.v) {
                                result[cell.r][cell.c] = cell.v.v ?? cell.v.m ?? ''
                            }
                        })
                        return result
                    }
                },
                setData: (newData: any[][]) => {
                    onChange(newData)
                },

                // Cell Operations
                getCellValue: (row, col, options) => {
                    const ref = getRef()
                    if (!ref) return undefined
                    try {
                        return ref.getCellValue(row, col, options)
                    } catch (e) {
                        return undefined
                    }
                },
                setCellValue: (row, col, value, options) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.setCellValue(row, col, value, options)
                    } catch (e) {
                        console.warn('setCellValue failed:', e)
                    }
                },
                setCellFormat: (row, col, attr, value, options) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.setCellFormat(row, col, attr, value, options)
                    } catch (e) {
                        console.warn('setCellFormat failed:', e)
                    }
                },
                clearCell: (row, col, options) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.clearCell(row, col, options)
                    } catch (e) {
                        console.warn('clearCell failed:', e)
                    }
                },
                autoFillCell: (copyRange, applyRange, direction) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.autoFillCell(copyRange, applyRange, direction)
                },

                // Range Operations
                setCellValuesByRange: (rangeData, range, options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.setCellValuesByRange(rangeData, range, options)
                },
                setCellFormatByRange: (attr, value, range, options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.setCellFormatByRange(attr, value, range, options)
                },
                getSelection: () => {
                    const ref = getRef()
                    if (!ref) return undefined
                    try {
                        return ref.getSelection()
                    } catch (e) {
                        return undefined
                    }
                },
                setSelection: (range, options) => {
                    const ref = getRef()
                    if (!ref) return
                    // Fortune-sheet expects Range as SingleRange[], use type assertion
                    ref.setSelection(range as any, options)
                },
                getCellsByRange: (range, options) => {
                    const ref = getRef()
                    if (!ref) return []
                    // Fortune-sheet expects Range as SingleRange[], use type assertion
                    return ref.getCellsByRange(range as any, options)
                },

                // Row/Column Operations
                insertRowOrColumn: (type, index, count, direction = 'rightbottom', options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.insertRowOrColumn(type, index, count, direction, options)
                },
                deleteRowOrColumn: (type, start, end, options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.deleteRowOrColumn(type, start, end, options)
                },
                setRowHeight: (rowInfo, options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.setRowHeight(rowInfo, options)
                },
                setColumnWidth: (columnInfo, options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.setColumnWidth(columnInfo, options)
                },
                getRowHeight: (rows, options) => {
                    const ref = getRef()
                    if (!ref) return {}
                    return ref.getRowHeight(rows, options)
                },
                getColumnWidth: (columns, options) => {
                    const ref = getRef()
                    if (!ref) return {}
                    return ref.getColumnWidth(columns, options)
                },
                hideRowOrColumn: (rowColInfo, type) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.hideRowOrColumn(rowColInfo, type)
                },
                showRowOrColumn: (rowColInfo, type) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.showRowOrColumn(rowColInfo, type)
                },

                // Merge Operations
                mergeCells: (ranges, type, options) => {
                    const ref = getRef()
                    if (!ref) return
                    // Fortune-sheet expects Range as SingleRange[], use type assertion
                    ref.mergeCells(ranges as any, type, options)
                },
                cancelMerge: (ranges, options) => {
                    const ref = getRef()
                    if (!ref) return
                    // Fortune-sheet expects Range as SingleRange[], use type assertion
                    ref.cancelMerge(ranges as any, options)
                },

                // Undo/Redo
                handleUndo: () => {
                    const ref = getRef()
                    if (!ref) return
                    ref.handleUndo()
                },
                handleRedo: () => {
                    const ref = getRef()
                    if (!ref) return
                    ref.handleRedo()
                },

                // Formula
                calculateFormula: (id, range) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.calculateFormula(id, range)
                },

                // Sheet Operations
                getAllSheets: () => {
                    const ref = getRef()
                    if (!ref) return []
                    try {
                        return ref.getAllSheets()
                    } catch (e) {
                        return []
                    }
                },
                getSheet: (options) => {
                    const ref = getRef()
                    if (!ref) return null
                    try {
                        return ref.getSheet(options)
                    } catch (e) {
                        return null
                    }
                },
                addSheet: (sheetId) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.addSheet(sheetId)
                    } catch (e) {
                        console.warn('addSheet failed:', e)
                    }
                },
                deleteSheet: (options) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.deleteSheet(options)
                    } catch (e) {
                        console.warn('deleteSheet failed:', e)
                    }
                },
                activateSheet: (options) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.activateSheet(options)
                    } catch (e) {
                        console.warn('activateSheet failed:', e)
                    }
                },
                setSheetName: (name, options) => {
                    const ref = getRef()
                    if (!ref) return
                    try {
                        ref.setSheetName(name, options)
                    } catch (e) {
                        console.warn('setSheetName failed:', e)
                    }
                },
                setSheetOrder: (orderList) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.setSheetOrder(orderList)
                },
                scroll: (options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.scroll(options)
                },

                // Freeze
                freeze: (type, range, options) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.freeze(type, range, options)
                },

                // Data Conversion
                dataToCelldata: (dataMatrix) => {
                    const ref = getRef()
                    if (!ref) return []
                    return ref.dataToCelldata(dataMatrix)
                },
                celldataToData: (celldata, rowCount, colCount) => {
                    const ref = getRef()
                    if (!ref) return null
                    return ref.celldataToData(celldata, rowCount, colCount)
                },

                // Batch Operations
                batchCallApis: (apiCalls) => {
                    const ref = getRef()
                    if (!ref) return
                    ref.batchCallApis(apiCalls)
                },
            }
        }, [onChange, sheetData])

        // Expose API via ref
        useImperativeHandle(ref, createAPI, [createAPI])

        // Call onReady when workbook ref becomes available
        useEffect(() => {
            if (workbookRef.current && !isReadyRef.current && onReady) {
                isReadyRef.current = true
                onReady(createAPI())
            }
        })

        // Handle sheet changes
        const handleChange = useCallback((newData: Sheet[]) => {
            const sheet = newData[0]
            if (!sheet?.celldata) return

            const result = convertToArray(sheet.celldata)
            onChange(result)
        }, [onChange])

        // Show loading state until mounted and Workbook is loaded
        if (!isMounted || !WorkbookComponent) {
            return (
                <div ref={containerRef} className="h-full w-full fortune-sheet-container flex items-center justify-center bg-white">
                    <div className="text-gray-400">스프레드시트 로딩 중...</div>
                </div>
            )
        }

        return (
            <div ref={containerRef} className="h-full w-full fortune-sheet-container">
                <WorkbookComponent
                    ref={workbookRef}
                    key={sheetKey}
                    data={sheetData}
                    onChange={handleChange}
                    lang="ko"
                    showToolbar={false}
                    showFormulaBar={false}
                    showSheetTabs={true}
                    allowEdit={true}
                    row={50}
                    column={26}
                />
                <style jsx global>{`
                    .fortune-sheet-container {
                        height: 100%;
                        width: 100%;
                        background: white !important;
                    }

                    .fortune-sheet-container .luckysheet {
                        height: 100% !important;
                    }

                    .fortune-sheet-container .fortune-sheet-container-wrapper {
                        height: 100% !important;
                        background: white !important;
                    }

                    /* Force light mode - override dark mode */
                    .fortune-sheet-container,
                    .fortune-sheet-container * {
                        color-scheme: light !important;
                    }

                    /* Sheet tabs - always light */
                    .luckysheet-sheet-area {
                        background: #f1f5f9 !important;
                        border-top: 1px solid #e2e8f0 !important;
                    }

                    .luckysheet-sheet-content {
                        background: white !important;
                    }

                    /* Cell styling */
                    .luckysheet-cell-selected {
                        border: 2px solid #3b82f6 !important;
                    }

                    /* Ensure all text is dark */
                    .luckysheet-sheet-area button,
                    .luckysheet-sheet-area span {
                        color: #374151 !important;
                    }
                `}</style>
            </div>
        )
    }
)

SpreadsheetEditor.displayName = 'SpreadsheetEditor'

export default SpreadsheetEditor
