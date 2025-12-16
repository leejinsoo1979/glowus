'use client'

import { useState, useEffect } from 'react'
import {
  AnySlideElement,
  TextElement,
  ShapeElement,
  ImageElement,
  TextStyle,
} from '../../types/slide-elements'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Palette,
} from 'lucide-react'

interface PropertyPanelProps {
  selectedElements: AnySlideElement[]
  onUpdate: (elementId: string, updates: Partial<AnySlideElement>) => void
}

export function PropertyPanel({ selectedElements, onUpdate }: PropertyPanelProps) {
  const [localValues, setLocalValues] = useState<Record<string, any>>({})

  const element = selectedElements.length === 1 ? selectedElements[0] : null

  // Sync local values with selected element
  useEffect(() => {
    if (element) {
      setLocalValues({
        x: element.position.xPx,
        y: element.position.yPx,
        width: element.size.widthPx,
        height: element.size.heightPx,
        rotation: element.rotation,
        ...(element.type === 'text' && {
          fontSize: (element as TextElement).style.fontSize,
          fontFamily: (element as TextElement).style.fontFamily,
          color: (element as TextElement).style.color,
          bold: (element as TextElement).style.bold,
          italic: (element as TextElement).style.italic,
          align: (element as TextElement).style.align,
        }),
        ...(element.type === 'shape' && {
          fill: (element as ShapeElement).style.fill,
          stroke: (element as ShapeElement).style.stroke,
          strokeWidth: (element as ShapeElement).style.strokeWidth,
        }),
      })
    }
  }, [element])

  if (!element) {
    return (
      <div className="h-full p-4">
        <p className="text-sm text-gray-500 text-center">
          요소를 선택하면 속성을 편집할 수 있습니다
        </p>
      </div>
    )
  }

  const handleNumberChange = (key: string, value: string) => {
    const num = parseFloat(value) || 0
    setLocalValues(prev => ({ ...prev, [key]: num }))
  }

  const handleNumberBlur = (key: string) => {
    const value = localValues[key]

    if (key === 'x' || key === 'y') {
      onUpdate(element.id, {
        position: {
          ...element.position,
          [key === 'x' ? 'xPx' : 'yPx']: value,
        },
      })
    } else if (key === 'width' || key === 'height') {
      onUpdate(element.id, {
        size: {
          ...element.size,
          [key === 'width' ? 'widthPx' : 'heightPx']: value,
        },
      })
    } else if (key === 'rotation') {
      onUpdate(element.id, { rotation: value })
    }
  }

  const handleTextStyleChange = (styleKey: keyof TextStyle, value: any) => {
    if (element.type !== 'text') return

    const textElement = element as TextElement
    onUpdate(element.id, {
      style: {
        ...textElement.style,
        [styleKey]: value,
      },
    } as Partial<TextElement>)
  }

  const handleShapeStyleChange = (styleKey: string, value: any) => {
    if (element.type !== 'shape') return

    const shapeElement = element as ShapeElement
    onUpdate(element.id, {
      style: {
        ...shapeElement.style,
        [styleKey]: value,
      },
    } as Partial<ShapeElement>)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">속성</h3>
        <p className="text-xs text-gray-500 mt-1">
          {element.type === 'text' && '텍스트'}
          {element.type === 'image' && '이미지'}
          {element.type === 'shape' && '도형'}
        </p>
      </div>

      {/* Position & Size */}
      <div className="p-4 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">위치 및 크기</h4>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">X</label>
            <input
              type="number"
              value={localValues.x || 0}
              onChange={(e) => handleNumberChange('x', e.target.value)}
              onBlur={() => handleNumberBlur('x')}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={localValues.y || 0}
              onChange={(e) => handleNumberChange('y', e.target.value)}
              onBlur={() => handleNumberBlur('y')}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">너비</label>
            <input
              type="number"
              value={localValues.width || 0}
              onChange={(e) => handleNumberChange('width', e.target.value)}
              onBlur={() => handleNumberBlur('width')}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">높이</label>
            <input
              type="number"
              value={localValues.height || 0}
              onChange={(e) => handleNumberChange('height', e.target.value)}
              onBlur={() => handleNumberBlur('height')}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
            />
          </div>
        </div>

        <div className="mt-2">
          <label className="text-xs text-gray-500">회전 (°)</label>
          <input
            type="number"
            value={localValues.rotation || 0}
            onChange={(e) => handleNumberChange('rotation', e.target.value)}
            onBlur={() => handleNumberBlur('rotation')}
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          />
        </div>
      </div>

      {/* Text Properties */}
      {element.type === 'text' && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">텍스트 스타일</h4>

          {/* Font Family & Size */}
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500">폰트</label>
              <select
                value={localValues.fontFamily || 'Arial'}
                onChange={(e) => handleTextStyleChange('fontFamily', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
              >
                <option value="Arial">Arial</option>
                <option value="맑은 고딕">맑은 고딕</option>
                <option value="나눔고딕">나눔고딕</option>
                <option value="Pretendard">Pretendard</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Verdana">Verdana</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-500">크기</label>
              <input
                type="number"
                value={localValues.fontSize || 18}
                onChange={(e) => {
                  const size = parseFloat(e.target.value) || 18
                  setLocalValues(prev => ({ ...prev, fontSize: size }))
                  handleTextStyleChange('fontSize', size)
                }}
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
              />
            </div>
          </div>

          {/* Text Formatting */}
          <div className="flex items-center gap-1 mt-3">
            <button
              onClick={() => handleTextStyleChange('bold', !localValues.bold)}
              className={`p-2 rounded ${localValues.bold ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleTextStyleChange('italic', !localValues.italic)}
              className={`p-2 rounded ${localValues.italic ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleTextStyleChange('underline', !(element as TextElement).style.underline)}
              className={`p-2 rounded ${(element as TextElement).style.underline ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
            >
              <Underline className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-gray-200 mx-1" />

            <button
              onClick={() => handleTextStyleChange('align', 'left')}
              className={`p-2 rounded ${localValues.align === 'left' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleTextStyleChange('align', 'center')}
              className={`p-2 rounded ${localValues.align === 'center' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleTextStyleChange('align', 'right')}
              className={`p-2 rounded ${localValues.align === 'right' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100'}`}
            >
              <AlignRight className="w-4 h-4" />
            </button>
          </div>

          {/* Color */}
          <div className="mt-3">
            <label className="text-xs text-gray-500">색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={localValues.color || '#000000'}
                onChange={(e) => handleTextStyleChange('color', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localValues.color || '#000000'}
                onChange={(e) => handleTextStyleChange('color', e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Shape Properties */}
      {element.type === 'shape' && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">도형 스타일</h4>

          {/* Fill Color */}
          <div className="mb-3">
            <label className="text-xs text-gray-500">채우기 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={localValues.fill || '#4F46E5'}
                onChange={(e) => handleShapeStyleChange('fill', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localValues.fill || '#4F46E5'}
                onChange={(e) => handleShapeStyleChange('fill', e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
              />
            </div>
          </div>

          {/* Stroke Color */}
          <div className="mb-3">
            <label className="text-xs text-gray-500">테두리 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={localValues.stroke || '#3730A3'}
                onChange={(e) => handleShapeStyleChange('stroke', e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localValues.stroke || '#3730A3'}
                onChange={(e) => handleShapeStyleChange('stroke', e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
              />
            </div>
          </div>

          {/* Stroke Width */}
          <div>
            <label className="text-xs text-gray-500">테두리 두께</label>
            <input
              type="number"
              value={localValues.strokeWidth || 1}
              onChange={(e) => handleShapeStyleChange('strokeWidth', parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
              min={0}
              max={20}
              step={0.5}
            />
          </div>
        </div>
      )}

      {/* Image Properties */}
      {element.type === 'image' && (
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">이미지</h4>

          <button className="w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">
            이미지 교체
          </button>

          {(element as ImageElement).originalWidth && (
            <p className="text-xs text-gray-500 mt-2">
              원본 크기: {(element as ImageElement).originalWidth} × {(element as ImageElement).originalHeight}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default PropertyPanel
