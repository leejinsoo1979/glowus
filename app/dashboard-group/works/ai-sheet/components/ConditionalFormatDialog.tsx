'use client'

import { useState } from 'react'
import { X, Palette, BarChart3, Star } from 'lucide-react'
import type { SingleRange } from '../lib/types'
import type { ConditionalRule, ConditionType, IconType } from '../lib/conditional-format'
import { PRESET_FORMATS, createHighlightRule, createColorScaleRule, createDataBarRule, createIconSetRule } from '../lib/conditional-format'

interface ConditionalFormatDialogProps {
    isOpen: boolean
    onClose: () => void
    onApply: (rule: ConditionalRule) => void
    range: SingleRange
}

type FormatType = 'highlight' | 'colorScale' | 'dataBar' | 'iconSet'

export function ConditionalFormatDialog({
    isOpen,
    onClose,
    onApply,
    range
}: ConditionalFormatDialogProps) {
    const [formatType, setFormatType] = useState<FormatType>('highlight')

    // Highlight options
    const [conditionType, setConditionType] = useState<ConditionType>('greaterThan')
    const [conditionValue, setConditionValue] = useState('')
    const [conditionValue2, setConditionValue2] = useState('')
    const [highlightPreset, setHighlightPreset] = useState<keyof typeof PRESET_FORMATS>('greenFill')

    // Color scale options
    const [colorScalePreset, setColorScalePreset] = useState<'greenYellowRed' | 'redYellowGreen' | 'greenWhite' | 'whiteGreen' | 'blueWhiteRed'>('greenYellowRed')

    // Data bar options
    const [dataBarColor, setDataBarColor] = useState<'blueBar' | 'greenBar' | 'redBar' | 'orangeBar'>('blueBar')
    const [showValue, setShowValue] = useState(true)

    // Icon set options
    const [iconSetType, setIconSetType] = useState<IconType>('arrows3')
    const [reverseIcons, setReverseIcons] = useState(false)
    const [showIconOnly, setShowIconOnly] = useState(false)

    if (!isOpen) return null

    const handleApply = () => {
        let rule: ConditionalRule

        switch (formatType) {
            case 'highlight':
                const format = PRESET_FORMATS[highlightPreset] as { backgroundColor: string; fontColor: string }
                rule = createHighlightRule(
                    range,
                    conditionType,
                    conditionType === 'empty' || conditionType === 'notEmpty'
                        ? undefined
                        : isNaN(Number(conditionValue)) ? conditionValue : Number(conditionValue),
                    format,
                    conditionValue2 ? (isNaN(Number(conditionValue2)) ? conditionValue2 : Number(conditionValue2)) : undefined
                )
                break

            case 'colorScale':
                const scalePreset = PRESET_FORMATS[colorScalePreset] as { minColor: string; midColor?: string; maxColor: string }
                rule = createColorScaleRule(
                    range,
                    scalePreset.minColor,
                    scalePreset.maxColor,
                    scalePreset.midColor
                )
                break

            case 'dataBar':
                const barPreset = PRESET_FORMATS[dataBarColor] as { fillColor: string }
                rule = createDataBarRule(range, barPreset.fillColor, showValue)
                break

            case 'iconSet':
                rule = createIconSetRule(range, iconSetType, reverseIcons, showIconOnly)
                break

            default:
                return
        }

        onApply(rule)
        onClose()
    }

    const conditionOptions: { value: ConditionType; label: string; needsValue: boolean; needsSecondValue?: boolean }[] = [
        { value: 'greaterThan', label: '보다 큼', needsValue: true },
        { value: 'lessThan', label: '보다 작음', needsValue: true },
        { value: 'equals', label: '같음', needsValue: true },
        { value: 'notEquals', label: '같지 않음', needsValue: true },
        { value: 'between', label: '사이', needsValue: true, needsSecondValue: true },
        { value: 'notBetween', label: '사이가 아님', needsValue: true, needsSecondValue: true },
        { value: 'contains', label: '포함', needsValue: true },
        { value: 'notContains', label: '포함하지 않음', needsValue: true },
        { value: 'duplicate', label: '중복 값', needsValue: false },
        { value: 'unique', label: '고유 값', needsValue: false },
        { value: 'top10', label: '상위 10개 항목', needsValue: false },
        { value: 'bottom10', label: '하위 10개 항목', needsValue: false },
        { value: 'aboveAverage', label: '평균 이상', needsValue: false },
        { value: 'belowAverage', label: '평균 미만', needsValue: false },
        { value: 'empty', label: '빈 셀', needsValue: false },
        { value: 'notEmpty', label: '비어 있지 않은 셀', needsValue: false }
    ]

    const selectedCondition = conditionOptions.find(c => c.value === conditionType)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800">조건부 서식</h2>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Format type tabs */}
                <div className="grid grid-cols-4 border-b">
                    <button
                        onClick={() => setFormatType('highlight')}
                        className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${
                            formatType === 'highlight'
                                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <Palette className="w-5 h-5" />
                        강조 표시
                    </button>
                    <button
                        onClick={() => setFormatType('colorScale')}
                        className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${
                            formatType === 'colorScale'
                                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <div className="w-5 h-5 rounded" style={{
                            background: 'linear-gradient(to right, #63BE7B, #FFEB84, #F8696B)'
                        }} />
                        색조
                    </button>
                    <button
                        onClick={() => setFormatType('dataBar')}
                        className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${
                            formatType === 'dataBar'
                                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <BarChart3 className="w-5 h-5" />
                        데이터 막대
                    </button>
                    <button
                        onClick={() => setFormatType('iconSet')}
                        className={`flex flex-col items-center gap-1 px-2 py-3 text-xs ${
                            formatType === 'iconSet'
                                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                        <Star className="w-5 h-5" />
                        아이콘 집합
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                    {formatType === 'highlight' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    조건
                                </label>
                                <select
                                    value={conditionType}
                                    onChange={(e) => setConditionType(e.target.value as ConditionType)}
                                    className="w-full px-3 py-2 text-sm border rounded-lg"
                                >
                                    {conditionOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedCondition?.needsValue && (
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            값
                                        </label>
                                        <input
                                            type="text"
                                            value={conditionValue}
                                            onChange={(e) => setConditionValue(e.target.value)}
                                            placeholder="값 입력"
                                            className="w-full px-3 py-2 text-sm border rounded-lg"
                                        />
                                    </div>
                                    {selectedCondition?.needsSecondValue && (
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ~ 까지
                                            </label>
                                            <input
                                                type="text"
                                                value={conditionValue2}
                                                onChange={(e) => setConditionValue2(e.target.value)}
                                                placeholder="두 번째 값"
                                                className="w-full px-3 py-2 text-sm border rounded-lg"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    서식 스타일
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['greenFill', 'yellowFill', 'redFill', 'blueFill'] as const).map(preset => {
                                        const style = PRESET_FORMATS[preset]
                                        return (
                                            <button
                                                key={preset}
                                                onClick={() => setHighlightPreset(preset)}
                                                className={`p-3 rounded-lg border-2 text-sm ${
                                                    highlightPreset === preset
                                                        ? 'border-blue-500'
                                                        : 'border-transparent hover:border-gray-300'
                                                }`}
                                                style={{
                                                    backgroundColor: style.backgroundColor,
                                                    color: style.fontColor
                                                }}
                                            >
                                                샘플
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {formatType === 'colorScale' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                색조 스타일
                            </label>
                            <div className="space-y-2">
                                {(['greenYellowRed', 'redYellowGreen', 'greenWhite', 'whiteGreen', 'blueWhiteRed'] as const).map(preset => {
                                    const style = PRESET_FORMATS[preset] as { minColor: string; midColor?: string; maxColor: string }
                                    const gradient = style.midColor
                                        ? `linear-gradient(to right, ${style.minColor}, ${style.midColor}, ${style.maxColor})`
                                        : `linear-gradient(to right, ${style.minColor}, ${style.maxColor})`

                                    return (
                                        <button
                                            key={preset}
                                            onClick={() => setColorScalePreset(preset)}
                                            className={`w-full h-10 rounded-lg border-2 ${
                                                colorScalePreset === preset
                                                    ? 'border-blue-500'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            style={{ background: gradient }}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {formatType === 'dataBar' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    막대 색상
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['blueBar', 'greenBar', 'redBar', 'orangeBar'] as const).map(preset => {
                                        const style = PRESET_FORMATS[preset]
                                        return (
                                            <button
                                                key={preset}
                                                onClick={() => setDataBarColor(preset)}
                                                className={`p-3 rounded-lg border-2 ${
                                                    dataBarColor === preset
                                                        ? 'border-blue-500'
                                                        : 'border-transparent hover:border-gray-300'
                                                }`}
                                            >
                                                <div
                                                    className="h-4 rounded"
                                                    style={{ backgroundColor: style.fillColor, width: '70%' }}
                                                />
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={showValue}
                                    onChange={(e) => setShowValue(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300"
                                />
                                <span className="text-gray-700">값 표시</span>
                            </label>
                        </>
                    )}

                    {formatType === 'iconSet' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    아이콘 유형
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { type: 'arrows3' as IconType, icons: ['↑', '→', '↓'] },
                                        { type: 'trafficLights3' as IconType, icons: ['🟢', '🟡', '🔴'] },
                                        { type: 'flags3' as IconType, icons: ['🟢', '🟡', '🔴'] },
                                        { type: 'ratings3' as IconType, icons: ['★', '◐', '☆'] },
                                        { type: 'symbols3' as IconType, icons: ['✔', '!', '✖'] },
                                        { type: 'signs3' as IconType, icons: ['✓', '!', '✗'] }
                                    ]).map(({ type, icons }) => (
                                        <button
                                            key={type}
                                            onClick={() => setIconSetType(type)}
                                            className={`p-3 rounded-lg border-2 text-center ${
                                                iconSetType === type
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <span className="text-lg">{icons.join(' ')}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={reverseIcons}
                                        onChange={(e) => setReverseIcons(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300"
                                    />
                                    <span className="text-gray-700">아이콘 순서 반전</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={showIconOnly}
                                        onChange={(e) => setShowIconOnly(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300"
                                    />
                                    <span className="text-gray-700">아이콘만 표시</span>
                                </label>
                            </div>
                        </>
                    )}
                </div>

                {/* Preview */}
                <div className="px-4 py-3 border-t bg-gray-50">
                    <div className="text-xs text-gray-500 mb-2">미리보기</div>
                    <div className="flex gap-1">
                        {formatType === 'highlight' && (
                            <div
                                className="flex-1 p-2 text-center text-sm rounded"
                                style={{
                                    backgroundColor: (PRESET_FORMATS[highlightPreset] as { backgroundColor: string; fontColor: string }).backgroundColor,
                                    color: (PRESET_FORMATS[highlightPreset] as { backgroundColor: string; fontColor: string }).fontColor
                                }}
                            >
                                조건에 맞는 셀
                            </div>
                        )}
                        {formatType === 'colorScale' && (() => {
                            const csStyle = PRESET_FORMATS[colorScalePreset] as { minColor: string; midColor?: string; maxColor: string }
                            return (
                                <div
                                    className="flex-1 h-8 rounded"
                                    style={{
                                        background: csStyle.midColor
                                            ? `linear-gradient(to right, ${csStyle.minColor}, ${csStyle.midColor}, ${csStyle.maxColor})`
                                            : `linear-gradient(to right, ${csStyle.minColor}, ${csStyle.maxColor})`
                                    }}
                                />
                            )
                        })()}
                        {formatType === 'dataBar' && (
                            <div className="flex-1 space-y-1">
                                {[80, 50, 30].map(width => (
                                    <div key={width} className="flex items-center gap-2">
                                        <div
                                            className="h-5 rounded"
                                            style={{
                                                backgroundColor: PRESET_FORMATS[dataBarColor].fillColor,
                                                width: `${width}%`
                                            }}
                                        />
                                        {showValue && <span className="text-xs text-gray-600">{width}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {formatType === 'iconSet' && (
                            <div className="flex-1 flex justify-around items-center text-2xl">
                                {iconSetType === 'arrows3' && (reverseIcons ? ['↓', '→', '↑'] : ['↑', '→', '↓']).map((icon, i) => (
                                    <span key={i} style={{ color: ['#00B050', '#FFC000', '#FF0000'][reverseIcons ? 2-i : i] }}>{icon}</span>
                                ))}
                                {iconSetType === 'trafficLights3' && ['🟢', '🟡', '🔴'].map((icon, i) => (
                                    <span key={i}>{reverseIcons ? ['🔴', '🟡', '🟢'][i] : icon}</span>
                                ))}
                                {iconSetType === 'flags3' && ['🟢', '🟡', '🔴'].map((icon, i) => (
                                    <span key={i}>{reverseIcons ? ['🔴', '🟡', '🟢'][i] : icon}</span>
                                ))}
                                {iconSetType === 'ratings3' && ['★', '◐', '☆'].map((icon, i) => (
                                    <span key={i} className="text-yellow-500">{reverseIcons ? ['☆', '◐', '★'][i] : icon}</span>
                                ))}
                                {iconSetType === 'symbols3' && (reverseIcons ? ['✖', '!', '✔'] : ['✔', '!', '✖']).map((icon, i) => (
                                    <span key={i} style={{ color: ['#00B050', '#FFC000', '#FF0000'][reverseIcons ? 2-i : i] }}>{icon}</span>
                                ))}
                                {iconSetType === 'signs3' && (reverseIcons ? ['✗', '!', '✓'] : ['✓', '!', '✗']).map((icon, i) => (
                                    <span key={i} style={{ color: ['#00B050', '#FFC000', '#FF0000'][reverseIcons ? 2-i : i] }}>{icon}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t">
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
