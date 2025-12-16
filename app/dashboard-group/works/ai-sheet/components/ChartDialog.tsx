'use client'

import { useState, useMemo } from 'react'
import { X, BarChart3, LineChart, PieChart, AreaChart, ScatterChart } from 'lucide-react'
import type { SingleRange } from '../lib/types'
import type { ChartType, ChartConfig, ChartOptions, CHART_COLOR_PALETTES } from '../lib/charts'
import { createChartConfig, CHART_TYPES, CHART_COLORS, getRecommendedChartType } from '../lib/charts'
import { ChartRenderer } from './ChartRenderer'

interface ChartDialogProps {
    isOpen: boolean
    onClose: () => void
    onApply: (config: ChartConfig) => void
    range: SingleRange | null
    data: any[][]
}

const COLOR_PALETTES = {
    default: CHART_COLORS,
    pastel: ['#A8D8EA', '#AA96DA', '#FCBAD3', '#FFFFD2', '#B5EAD7', '#C7CEEA', '#FFD3B6', '#DCEDC1'],
    vibrant: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA'],
    mono: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#950740', '#c70039', '#ff5722'],
    earth: ['#5D4037', '#795548', '#8D6E63', '#A1887F', '#D7CCC8', '#3E2723', '#4E342E', '#6D4C41'],
    ocean: ['#006994', '#40A4D8', '#33CCFF', '#00CED1', '#20B2AA', '#3CB371', '#2E8B57', '#228B22'],
}

type PaletteKey = keyof typeof COLOR_PALETTES

export function ChartDialog({ isOpen, onClose, onApply, range, data }: ChartDialogProps) {
    const [selectedType, setSelectedType] = useState<ChartType>('column')
    const [title, setTitle] = useState('')
    const [hasHeader, setHasHeader] = useState(true)
    const [seriesInRows, setSeriesInRows] = useState(false)
    const [showLegend, setShowLegend] = useState(true)
    const [showGrid, setShowGrid] = useState(true)
    const [showValues, setShowValues] = useState(false)
    const [legendPosition, setLegendPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom')
    const [selectedPalette, setSelectedPalette] = useState<PaletteKey>('default')

    // Get recommended chart type
    const recommendedType = useMemo(() => {
        if (!range || !data.length) return 'column'
        return getRecommendedChartType(data, range)
    }, [range, data])

    // Generate preview chart config
    const previewConfig = useMemo(() => {
        if (!range || !data.length) return null

        try {
            const options: ChartOptions = {
                type: selectedType,
                title,
                dataRange: range,
                hasHeader,
                seriesInRows,
                showLegend,
                showGrid,
                showValues,
                legendPosition,
                colors: COLOR_PALETTES[selectedPalette]
            }
            return createChartConfig(data, options)
        } catch (e) {
            console.error('Chart preview error:', e)
            return null
        }
    }, [range, data, selectedType, title, hasHeader, seriesInRows, showLegend, showGrid, showValues, legendPosition, selectedPalette])

    if (!isOpen) return null

    const handleApply = () => {
        if (previewConfig) {
            onApply(previewConfig)
            onClose()
        }
    }

    const getChartIcon = (type: ChartType) => {
        switch (type) {
            case 'line':
                return <LineChart className="w-6 h-6" />
            case 'pie':
            case 'doughnut':
                return <PieChart className="w-6 h-6" />
            case 'area':
                return <AreaChart className="w-6 h-6" />
            case 'scatter':
                return <ScatterChart className="w-6 h-6" />
            default:
                return <BarChart3 className="w-6 h-6" />
        }
    }

    const rangeText = range
        ? `${String.fromCharCode(65 + range.column[0])}${range.row[0] + 1}:${String.fromCharCode(65 + range.column[1])}${range.row[1] + 1}`
        : '선택 없음'

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold">차트 삽입</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left: Options */}
                        <div className="space-y-6">
                            {/* Data Range */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    데이터 범위
                                </label>
                                <div className="px-3 py-2 bg-gray-50 border rounded text-sm">
                                    {rangeText}
                                </div>
                            </div>

                            {/* Chart Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    차트 유형
                                    {recommendedType && (
                                        <span className="ml-2 text-xs text-blue-600">
                                            (추천: {CHART_TYPES.find(t => t.type === recommendedType)?.label})
                                        </span>
                                    )}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CHART_TYPES.map((chart) => (
                                        <button
                                            key={chart.type}
                                            onClick={() => setSelectedType(chart.type)}
                                            className={`flex flex-col items-center p-3 rounded-lg border-2 transition-colors ${
                                                selectedType === chart.type
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            {getChartIcon(chart.type)}
                                            <span className="text-xs mt-1">{chart.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    차트 제목
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="차트 제목 입력 (선택)"
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Data Options */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    데이터 옵션
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={hasHeader}
                                            onChange={(e) => setHasHeader(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm">첫 행을 헤더로 사용</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={seriesInRows}
                                            onChange={(e) => setSeriesInRows(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm">행 방향 시리즈</span>
                                    </label>
                                </div>
                            </div>

                            {/* Display Options */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    표시 옵션
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={showLegend}
                                            onChange={(e) => setShowLegend(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm">범례 표시</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={showGrid}
                                            onChange={(e) => setShowGrid(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm">격자선 표시</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={showValues}
                                            onChange={(e) => setShowValues(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm">값 레이블 표시</span>
                                    </label>
                                </div>
                            </div>

                            {/* Legend Position */}
                            {showLegend && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        범례 위치
                                    </label>
                                    <select
                                        value={legendPosition}
                                        onChange={(e) => setLegendPosition(e.target.value as 'top' | 'bottom' | 'left' | 'right')}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="top">상단</option>
                                        <option value="bottom">하단</option>
                                        <option value="left">좌측</option>
                                        <option value="right">우측</option>
                                    </select>
                                </div>
                            )}

                            {/* Color Palette */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    색상 팔레트
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(COLOR_PALETTES).map(([key, colors]) => (
                                        <button
                                            key={key}
                                            onClick={() => setSelectedPalette(key as PaletteKey)}
                                            className={`p-2 rounded border-2 transition-colors ${
                                                selectedPalette === key
                                                    ? 'border-blue-500'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex gap-0.5">
                                                {colors.slice(0, 5).map((color, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="w-4 h-4 rounded-sm"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-gray-600 mt-1 block capitalize">
                                                {key}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Preview */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                미리보기
                            </label>
                            <div className="border rounded-lg p-4 bg-gray-50 min-h-[400px] flex items-center justify-center">
                                {previewConfig ? (
                                    <ChartRenderer config={previewConfig} height={350} />
                                ) : (
                                    <div className="text-gray-400 text-sm">
                                        데이터를 선택하면 미리보기가 표시됩니다
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!previewConfig}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        차트 삽입
                    </button>
                </div>
            </div>
        </div>
    )
}
