"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft,
    Send,
    Bot,
    User,
    Loader2,
    FileSpreadsheet,
    Sparkles,
    Table,
    BarChart3,
    Calculator,
    Wand2,
    Paperclip,
    Mic,
    MoreHorizontal,
    FolderOpen,
    HardDrive,
    Upload,
    ChevronDown,
    Check
} from "lucide-react"
import { SiGoogledrive } from "react-icons/si"
import { cn } from "@/lib/utils"
import ExcelRibbon from "./excel-ribbon"
import type { SpreadsheetEditorAPI } from "./spreadsheet-editor"
import { createSheetAPI, SheetAPIWrapper } from "./lib/sheet-api"
import type { SpreadsheetAction, CellFormat, SingleRange, Range } from "./lib/types"

// Dynamic import for Fortune-sheet (client-side only)
const SpreadsheetEditor = dynamic(() => import("./spreadsheet-editor"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-white dark:bg-zinc-900">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
    )
})

interface Message {
    role: 'user' | 'assistant'
    content: string
    action?: SpreadsheetAction
}

const QUICK_PROMPTS = [
    { icon: Table, label: "샘플 데이터 생성", prompt: "A1:E10에 매출 데이터 샘플을 생성해줘. 월, 제품명, 수량, 단가, 총액 컬럼으로" },
    { icon: Calculator, label: "수식 추가", prompt: "E열에 수량*단가 합계 수식을 넣어줘" },
    { icon: BarChart3, label: "데이터 분석", prompt: "현재 데이터를 분석하고 인사이트를 알려줘" },
    { icon: Wand2, label: "서식 적용", prompt: "헤더 행에 파란색 배경과 굵은 글씨를 적용해줘" },
]

export default function AISheetPage() {
    const router = useRouter()
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [spreadsheetData, setSpreadsheetData] = useState<any[][]>(() => {
        // Initialize with empty 50x26 grid (A-Z columns)
        return Array(50).fill(null).map(() => Array(26).fill(''))
    })
    const [isInputExpanded, setIsInputExpanded] = useState(true)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const [showModeModal, setShowModeModal] = useState(false)
    const [sheetApiReady, setSheetApiReady] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const spreadsheetRef = useRef<SpreadsheetEditorAPI | null>(null)
    const sheetApiRef = useRef<SheetAPIWrapper | null>(null)
    const fileMenuRef = useRef<HTMLDivElement>(null)
    const modeModalRef = useRef<HTMLDivElement>(null)

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
                setShowFileMenu(false)
            }
            if (modeModalRef.current && !modeModalRef.current.contains(event.target as Node)) {
                setShowModeModal(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Handle spreadsheet ready callback
    const handleSpreadsheetReady = useCallback((api: SpreadsheetEditorAPI) => {
        console.log('Spreadsheet API ready')
        spreadsheetRef.current = api
        sheetApiRef.current = createSheetAPI(api)
        setSheetApiReady(true)
    }, [])

    // Execute spreadsheet action using Fortune-sheet API directly
    const executeAction = useCallback((action: SpreadsheetAction) => {
        if (!action) return

        const api = spreadsheetRef.current
        if (!api) {
            console.warn('Spreadsheet API not ready, falling back to state-based approach')
            // Fallback to state-based approach for backward compatibility
            executeActionFallback(action)
            return
        }

        console.log('Executing action via Fortune-sheet API:', action.type)

        switch (action.type) {
            case 'set_cells':
                if (action.data?.cells) {
                    action.data.cells.forEach((cell: { row: number, col: number, value: any, format?: CellFormat }) => {
                        api.setCellValue(cell.row, cell.col, cell.value)
                        // Apply format if provided
                        if (cell.format) {
                            if (cell.format.bold) api.setCellFormat(cell.row, cell.col, 'bl', 1)
                            if (cell.format.italic) api.setCellFormat(cell.row, cell.col, 'it', 1)
                            if (cell.format.fontColor) api.setCellFormat(cell.row, cell.col, 'fc', cell.format.fontColor)
                            if (cell.format.backgroundColor) api.setCellFormat(cell.row, cell.col, 'bg', cell.format.backgroundColor)
                            if (cell.format.fontSize) api.setCellFormat(cell.row, cell.col, 'fs', cell.format.fontSize)
                        }
                    })
                }
                break

            case 'set_formula':
                if (action.data) {
                    const formula = action.data.formula.startsWith('=') ? action.data.formula : `=${action.data.formula}`
                    api.setCellValue(action.data.row, action.data.col, { f: formula })
                }
                break

            case 'clear':
                if (action.data?.range) {
                    const { row, column } = action.data.range
                    for (let r = row[0]; r <= row[1]; r++) {
                        for (let c = column[0]; c <= column[1]; c++) {
                            api.clearCell(r, c)
                        }
                    }
                } else {
                    // Clear all - clear entire sheet
                    for (let r = 0; r < 50; r++) {
                        for (let c = 0; c < 26; c++) {
                            api.clearCell(r, c)
                        }
                    }
                }
                break

            case 'format_cells':
                if (action.data?.range && action.data?.format) {
                    const { row, column } = action.data.range
                    const format = action.data.format
                    for (let r = row[0]; r <= row[1]; r++) {
                        for (let c = column[0]; c <= column[1]; c++) {
                            if (format.bold) api.setCellFormat(r, c, 'bl', 1)
                            if (format.italic) api.setCellFormat(r, c, 'it', 1)
                            if (format.underline) api.setCellFormat(r, c, 'un', 1)
                            if (format.strikethrough) api.setCellFormat(r, c, 'cl', 1)
                            if (format.fontColor) api.setCellFormat(r, c, 'fc', format.fontColor)
                            if (format.backgroundColor) api.setCellFormat(r, c, 'bg', format.backgroundColor)
                            if (format.fontSize) api.setCellFormat(r, c, 'fs', format.fontSize)
                            if (format.fontFamily) api.setCellFormat(r, c, 'ff', format.fontFamily)
                            if (format.horizontalAlign !== undefined) {
                                const ht = format.horizontalAlign === 'left' ? 0 : format.horizontalAlign === 'center' ? 1 : 2
                                api.setCellFormat(r, c, 'ht', ht)
                            }
                            if (format.verticalAlign !== undefined) {
                                const vt = format.verticalAlign === 'top' ? 0 : format.verticalAlign === 'middle' ? 1 : 2
                                api.setCellFormat(r, c, 'vt', vt)
                            }
                        }
                    }
                }
                break

            case 'insert_row':
                api.insertRowOrColumn('row', action.data?.index ?? 0, action.data?.count ?? 1, action.data?.direction ?? 'rightbottom')
                break

            case 'insert_col':
                api.insertRowOrColumn('column', action.data?.index ?? 0, action.data?.count ?? 1, action.data?.direction ?? 'rightbottom')
                break

            case 'delete_row':
                api.deleteRowOrColumn('row', action.data?.start ?? 0, action.data?.end ?? action.data?.start ?? 0)
                break

            case 'delete_col':
                api.deleteRowOrColumn('column', action.data?.start ?? 0, action.data?.end ?? action.data?.start ?? 0)
                break

            case 'merge_cells':
                if (action.data?.range) {
                    const range: Range = { row: action.data.range.row, column: action.data.range.column }
                    api.mergeCells(range, action.data.type || 'merge-all')
                }
                break

            case 'unmerge_cells':
                if (action.data?.range) {
                    const range: Range = { row: action.data.range.row, column: action.data.range.column }
                    api.cancelMerge(range)
                }
                break

            case 'auto_fill':
                if (action.data?.sourceRange && action.data?.targetRange && action.data?.direction) {
                    api.autoFillCell(action.data.sourceRange, action.data.targetRange, action.data.direction)
                }
                break

            case 'set_row_height':
                if (action.data?.heights) {
                    api.setRowHeight(action.data.heights)
                }
                break

            case 'set_col_width':
                if (action.data?.widths) {
                    api.setColumnWidth(action.data.widths)
                }
                break

            case 'hide_row':
                if (action.data?.rows) {
                    api.hideRowOrColumn(action.data.rows.map(String), 'row')
                }
                break

            case 'hide_col':
                if (action.data?.columns) {
                    api.hideRowOrColumn(action.data.columns.map(String), 'column')
                }
                break

            case 'show_row':
                if (action.data?.rows) {
                    api.showRowOrColumn(action.data.rows.map(String), 'row')
                }
                break

            case 'show_col':
                if (action.data?.columns) {
                    api.showRowOrColumn(action.data.columns.map(String), 'column')
                }
                break

            case 'add_sheet':
                api.addSheet(action.data?.sheetId)
                break

            case 'delete_sheet':
                api.deleteSheet(action.data)
                break

            case 'rename_sheet':
                if (action.data?.name) {
                    api.setSheetName(action.data.name, action.data)
                }
                break

            default:
                console.warn(`Unhandled action type: ${action.type}`)
        }
    }, [])

    // Fallback state-based action execution (for backward compatibility)
    const executeActionFallback = useCallback((action: SpreadsheetAction) => {
        setSpreadsheetData(prevData => {
            const newData = prevData.map(row => [...row])

            switch (action.type) {
                case 'set_cells':
                    if (action.data?.cells) {
                        action.data.cells.forEach((cell: { row: number, col: number, value: any }) => {
                            if (cell.row < newData.length && cell.col < newData[0].length) {
                                newData[cell.row][cell.col] = cell.value
                            }
                        })
                    }
                    break

                case 'clear':
                    if (action.data?.range) {
                        const { row, column } = action.data.range
                        for (let r = row[0]; r <= row[1] && r < newData.length; r++) {
                            for (let c = column[0]; c <= column[1] && c < newData[0].length; c++) {
                                newData[r][c] = ''
                            }
                        }
                    } else {
                        return Array(50).fill(null).map(() => Array(26).fill(''))
                    }
                    break

                case 'insert_row':
                    const insertRowIdx = action.data?.index ?? newData.length
                    newData.splice(insertRowIdx, 0, Array(26).fill(''))
                    break

                case 'insert_col':
                    const insertColIdx = action.data?.index ?? newData[0].length
                    newData.forEach(row => row.splice(insertColIdx, 0, ''))
                    break

                case 'delete_row':
                    const deleteRowIdx = action.data?.start ?? newData.length - 1
                    if (deleteRowIdx < newData.length) {
                        newData.splice(deleteRowIdx, 1)
                    }
                    break

                case 'delete_col':
                    const deleteColIdx = action.data?.start ?? newData[0].length - 1
                    newData.forEach(row => {
                        if (deleteColIdx < row.length) {
                            row.splice(deleteColIdx, 1)
                        }
                    })
                    break
            }

            return newData
        })
    }, [])

    const sendMessage = async (content?: string) => {
        const messageContent = content || input.trim()
        if (!messageContent || isLoading) return

        setInput('')
        const userMessage: Message = { role: 'user', content: messageContent }
        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        try {
            // Get current spreadsheet data for context
            const currentDataSummary = getDataSummary()

            const response = await fetch('/api/ai-sheet/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageContent,
                    currentData: currentDataSummary,
                    history: messages.slice(-6) // Last 6 messages for context
                })
            })

            const data = await response.json()
            console.log('API Response:', JSON.stringify(data, null, 2))

            if (data.error) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `오류가 발생했습니다: ${data.error}`
                }])
            } else {
                const assistantMessage: Message = {
                    role: 'assistant',
                    content: data.message || '작업을 완료했습니다.',
                    action: data.action
                }
                setMessages(prev => [...prev, assistantMessage])

                // Execute the action if present
                if (data.action) {
                    console.log('Executing action:', data.action.type)
                    executeAction(data.action)
                }
            }
        } catch (error) {
            console.error('AI Sheet error:', error)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '오류가 발생했습니다. 다시 시도해주세요.'
            }])
        } finally {
            setIsLoading(false)
        }
    }

    // Handle ribbon actions using Fortune-sheet API
    const handleRibbonAction = useCallback((action: string, data?: any) => {
        console.log('Ribbon action:', action, data)

        const api = spreadsheetRef.current
        if (!api) {
            console.warn('Spreadsheet API not ready')
            return
        }

        // Get current selection for context
        const selection = api.getSelection()
        const range: SingleRange | null = selection && selection.length > 0
            ? { row: [selection[0].row[0], selection[0].row[1] ?? selection[0].row[0]], column: [selection[0].column[0], selection[0].column[1] ?? selection[0].column[0]] }
            : null

        switch (action) {
            // Clipboard
            case 'cut':
            case 'copy':
            case 'paste':
                // These require browser clipboard API integration
                console.log(`Clipboard action: ${action}`)
                break

            // Undo/Redo
            case 'undo':
                api.handleUndo()
                break
            case 'redo':
                api.handleRedo()
                break

            // Font formatting
            case 'bold':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'bl', 1)
                        }
                    }
                }
                break
            case 'italic':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'it', 1)
                        }
                    }
                }
                break
            case 'underline':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'un', 1)
                        }
                    }
                }
                break
            case 'strikethrough':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'cl', 1)
                        }
                    }
                }
                break

            // Font settings
            case 'fontFamily':
                if (range && data?.value) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'ff', data.value)
                        }
                    }
                }
                break
            case 'fontSize':
                if (range && data?.value) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'fs', data.value)
                        }
                    }
                }
                break
            case 'fontColor':
                if (range && data?.value) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'fc', data.value)
                        }
                    }
                }
                break
            case 'fillColor':
            case 'backgroundColor':
                if (range && data?.value) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'bg', data.value)
                        }
                    }
                }
                break

            // Alignment
            case 'alignLeft':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'ht', 0)
                        }
                    }
                }
                break
            case 'alignCenter':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'ht', 1)
                        }
                    }
                }
                break
            case 'alignRight':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'ht', 2)
                        }
                    }
                }
                break
            case 'alignTop':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'vt', 0)
                        }
                    }
                }
                break
            case 'alignMiddle':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'vt', 1)
                        }
                    }
                }
                break
            case 'alignBottom':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'vt', 2)
                        }
                    }
                }
                break

            // Merge
            case 'merge-center':
            case 'merge-all':
                if (range) {
                    api.mergeCells({ row: range.row, column: range.column }, 'merge-all')
                }
                break
            case 'merge-horizontal':
                if (range) {
                    api.mergeCells({ row: range.row, column: range.column }, 'merge-horizontal')
                }
                break
            case 'merge-vertical':
                if (range) {
                    api.mergeCells({ row: range.row, column: range.column }, 'merge-vertical')
                }
                break
            case 'unmerge':
                if (range) {
                    api.cancelMerge({ row: range.row, column: range.column })
                }
                break

            // Row/Column operations
            case 'insert-row-above':
                if (range) {
                    api.insertRowOrColumn('row', range.row[0], 1, 'lefttop')
                }
                break
            case 'insert-row-below':
                if (range) {
                    api.insertRowOrColumn('row', range.row[1], 1, 'rightbottom')
                }
                break
            case 'insert-col-left':
                if (range) {
                    api.insertRowOrColumn('column', range.column[0], 1, 'lefttop')
                }
                break
            case 'insert-col-right':
                if (range) {
                    api.insertRowOrColumn('column', range.column[1], 1, 'rightbottom')
                }
                break
            case 'delete-row':
                if (range) {
                    api.deleteRowOrColumn('row', range.row[0], range.row[1])
                }
                break
            case 'delete-col':
                if (range) {
                    api.deleteRowOrColumn('column', range.column[0], range.column[1])
                }
                break

            // Clear
            case 'clear-all':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.clearCell(r, c)
                        }
                    }
                }
                break
            case 'clear-format':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellFormat(r, c, 'bg', null)
                            api.setCellFormat(r, c, 'fc', null)
                            api.setCellFormat(r, c, 'bl', 0)
                            api.setCellFormat(r, c, 'it', 0)
                            api.setCellFormat(r, c, 'un', 0)
                            api.setCellFormat(r, c, 'cl', 0)
                        }
                    }
                }
                break
            case 'clear-content':
                if (range) {
                    for (let r = range.row[0]; r <= range.row[1]; r++) {
                        for (let c = range.column[0]; c <= range.column[1]; c++) {
                            api.setCellValue(r, c, '')
                        }
                    }
                }
                break

            // Functions
            case 'sum':
                if (range) {
                    const rangeStr = `${String.fromCharCode(65 + range.column[0])}${range.row[0] + 1}:${String.fromCharCode(65 + range.column[1])}${range.row[1] + 1}`
                    api.setCellValue(range.row[1] + 1, range.column[0], { f: `=SUM(${rangeStr})` })
                }
                break
            case 'average':
                if (range) {
                    const rangeStr = `${String.fromCharCode(65 + range.column[0])}${range.row[0] + 1}:${String.fromCharCode(65 + range.column[1])}${range.row[1] + 1}`
                    api.setCellValue(range.row[1] + 1, range.column[0], { f: `=AVERAGE(${rangeStr})` })
                }
                break
            case 'count':
                if (range) {
                    const rangeStr = `${String.fromCharCode(65 + range.column[0])}${range.row[0] + 1}:${String.fromCharCode(65 + range.column[1])}${range.row[1] + 1}`
                    api.setCellValue(range.row[1] + 1, range.column[0], { f: `=COUNT(${rangeStr})` })
                }
                break
            case 'max':
                if (range) {
                    const rangeStr = `${String.fromCharCode(65 + range.column[0])}${range.row[0] + 1}:${String.fromCharCode(65 + range.column[1])}${range.row[1] + 1}`
                    api.setCellValue(range.row[1] + 1, range.column[0], { f: `=MAX(${rangeStr})` })
                }
                break
            case 'min':
                if (range) {
                    const rangeStr = `${String.fromCharCode(65 + range.column[0])}${range.row[0] + 1}:${String.fromCharCode(65 + range.column[1])}${range.row[1] + 1}`
                    api.setCellValue(range.row[1] + 1, range.column[0], { f: `=MIN(${rangeStr})` })
                }
                break

            // Fill
            case 'fill-down':
                if (range && range.row[1] > range.row[0]) {
                    api.autoFillCell(
                        { row: [range.row[0], range.row[0]], column: range.column },
                        { row: [range.row[0] + 1, range.row[1]], column: range.column },
                        'down'
                    )
                }
                break
            case 'fill-right':
                if (range && range.column[1] > range.column[0]) {
                    api.autoFillCell(
                        { row: range.row, column: [range.column[0], range.column[0]] },
                        { row: range.row, column: [range.column[0] + 1, range.column[1]] },
                        'right'
                    )
                }
                break

            // Sheet operations
            case 'add-sheet':
                api.addSheet()
                break
            case 'delete-sheet':
                api.deleteSheet()
                break

            // Sort (to be implemented in Phase 5)
            case 'sort':
            case 'sort-asc':
            case 'sort-desc':
                console.log('Sort action - to be implemented in Phase 5')
                break

            // Filter (to be implemented in Phase 5)
            case 'filter':
                console.log('Filter action - to be implemented in Phase 5')
                break

            // Conditional format (to be implemented in Phase 5)
            case 'conditional-format':
                console.log('Conditional format - to be implemented in Phase 5')
                break

            default:
                console.log(`Unhandled ribbon action: ${action}`)
        }
    }, [])

    const getDataSummary = () => {
        // Try to get data from Fortune-sheet API first
        const api = spreadsheetRef.current
        let data = spreadsheetData

        if (api) {
            try {
                data = api.getData()
            } catch (e) {
                // Fallback to state
            }
        }

        // Find the actual used range
        let maxRow = 0, maxCol = 0
        data.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell !== '' && cell !== null) {
                    maxRow = Math.max(maxRow, r)
                    maxCol = Math.max(maxCol, c)
                }
            })
        })

        if (maxRow === 0 && maxCol === 0 && !data[0][0]) {
            return { isEmpty: true, data: [] }
        }

        // Return first 20 rows and 10 cols max for context
        const limitedData = data
            .slice(0, Math.min(maxRow + 1, 20))
            .map(row => row.slice(0, Math.min(maxCol + 1, 10)))

        return {
            isEmpty: false,
            rowCount: maxRow + 1,
            colCount: maxCol + 1,
            data: limitedData
        }
    }

    return (
        <div className="flex h-[calc(100vh-64px)] -m-8 bg-zinc-100 dark:bg-zinc-950">
            {/* Left Panel - AI Chat */}
            <div className="w-[400px] min-w-[350px] max-w-[500px] flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
                {/* Header */}
                <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 h-[57px]">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                            <FileSpreadsheet className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-white">AI 시트</span>
                        {sheetApiReady && (
                            <span className="text-xs text-emerald-500 ml-2">● API Ready</span>
                        )}
                    </div>
                </header>

                {/* Welcome / Info */}
                {messages.length === 0 && (
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            AI 시트의 무한한 가능성을 경험하세요
                        </h2>
                        <ul className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
                            <li className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span>기업, 인물, 논문, 제품 등 모든 정보를 자동으로 검색합니다</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span>기존 데이터에서 놀라운 인사이트와 시각화 자료를 손쉽게 만들어냅니다</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <span>데이터 작업이 이제 자유롭습니다 - 검색부터 분석, 시각화까지 한 번에</span>
                            </li>
                        </ul>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex gap-3",
                                message.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            {message.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            )}
                            <div className={cn(
                                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                                message.role === 'user'
                                    ? "bg-blue-600 text-white"
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            )}>
                                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                {message.action && (
                                    <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400">
                                        ✓ 스프레드시트에 적용됨
                                    </div>
                                )}
                            </div>
                            {message.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3">
                                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                {messages.length === 0 && (
                    <div className="px-4 pb-2">
                        <div className="grid grid-cols-2 gap-2">
                            {QUICK_PROMPTS.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => sendMessage(item.prompt)}
                                    className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-300 transition-colors text-left"
                                >
                                    <item.icon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 relative">
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        {/* Mode Button with Dropdown Container */}
                        <div ref={modeModalRef} className="relative">
                            <button
                                onClick={() => setShowModeModal(!showModeModal)}
                                className="w-full flex items-center justify-between px-4 py-2 bg-accent hover:bg-accent/90 transition-colors rounded-t-xl"
                            >
                                <span className="text-sm font-medium text-white">AI 시트 모드</span>
                                <ChevronDown className={cn("w-4 h-4 text-white transition-transform", showModeModal && "rotate-180")} />
                            </button>

                            {/* Dropdown Menu - Opens Upward */}
                            <AnimatePresence>
                                {showModeModal && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scaleY: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                                        exit={{ opacity: 0, y: 10, scaleY: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 overflow-hidden z-50 origin-bottom"
                                    >
                                        <div className="py-2">
                                            <div className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer">
                                                <Check className="w-4 h-4 text-accent flex-shrink-0" />
                                                <span className="text-sm text-zinc-200">자동으로 작동하는 Excel - 필요한 것만 설명하세요</span>
                                            </div>
                                            <div className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer">
                                                <Check className="w-4 h-4 text-accent flex-shrink-0" />
                                                <span className="text-sm text-zinc-200">정보 자동 수집, 수식 자동 생성, 템플릿 자동 구축</span>
                                            </div>
                                            <div className="px-3 py-2 flex items-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-700 cursor-pointer">
                                                <Check className="w-4 h-4 text-accent flex-shrink-0" />
                                                <span className="text-sm text-zinc-200">원시 데이터에서 인사이트까지 몇 초 만에</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Input Field */}
                        <div className="px-4 py-3">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="무엇이든 물어보고 만들어보세요"
                                className="w-full bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0"
                                style={{ outline: 'none', boxShadow: 'none' }}
                            />
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-100 dark:border-zinc-700">
                            <div className="flex items-center gap-1">
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <MoreHorizontal className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <SiGoogledrive className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Wand2 className="w-5 h-5 text-zinc-500" />
                                </button>
                            </div>
                            <div className="flex items-center gap-1 relative" ref={fileMenuRef}>
                                {/* File Upload Menu */}
                                <AnimatePresence>
                                    {showFileMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute bottom-full right-0 mb-2 w-56 bg-zinc-800 rounded-xl shadow-xl border border-zinc-700 overflow-hidden z-50"
                                        >
                                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 text-left transition-colors">
                                                <FolderOpen className="w-5 h-5 text-zinc-400" />
                                                <span className="text-sm text-zinc-200">로컬 파일 찾기</span>
                                            </button>
                                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 text-left transition-colors">
                                                <HardDrive className="w-5 h-5 text-zinc-400" />
                                                <span className="text-sm text-zinc-200">AI 드라이브에서 선택</span>
                                            </button>
                                            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 text-left transition-colors">
                                                <SiGoogledrive className="w-5 h-5 text-zinc-400" />
                                                <span className="text-sm text-zinc-200">Google 드라이브에서 선택</span>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <button
                                    onClick={() => setShowFileMenu(!showFileMenu)}
                                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                >
                                    <Paperclip className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                    <Mic className="w-5 h-5 text-zinc-500" />
                                </button>
                                <button
                                    onClick={() => sendMessage()}
                                    disabled={isLoading || !input.trim()}
                                    className="p-2 bg-accent hover:bg-accent/90 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 rounded-lg transition-colors"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Spreadsheet (Full Excel UI) - Always Light Mode */}
            <div className="flex-1 flex flex-col bg-white overflow-visible" data-theme="light">
                {/* Korean Excel Ribbon Toolbar */}
                <ExcelRibbon onAction={handleRibbonAction} />

                {/* Spreadsheet Grid */}
                <div className="flex-1 overflow-hidden bg-white">
                    <SpreadsheetEditor
                        ref={spreadsheetRef}
                        data={spreadsheetData}
                        onChange={setSpreadsheetData}
                        onReady={handleSpreadsheetReady}
                    />
                </div>
            </div>
        </div>
    )
}
