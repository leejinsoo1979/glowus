'use client'

import { useState } from 'react'
import {
  MousePointer2,
  Type,
  Square,
  Circle,
  Triangle,
  Image,
  Minus,
  Undo,
  Redo,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Trash2,
  Copy,
  Layers,
} from 'lucide-react'

export type ToolType = 'select' | 'text' | 'rect' | 'ellipse' | 'triangle' | 'line' | 'image'

interface ToolbarProps {
  activeTool: ToolType
  onToolChange: (tool: ToolType) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  zoom: number
  onZoomChange: (zoom: number) => void
  gridEnabled: boolean
  onGridToggle: () => void
  onDelete: () => void
  onDuplicate: () => void
  hasSelection: boolean
}

const tools: { type: ToolType; icon: typeof MousePointer2; label: string }[] = [
  { type: 'select', icon: MousePointer2, label: '선택' },
  { type: 'text', icon: Type, label: '텍스트' },
  { type: 'rect', icon: Square, label: '사각형' },
  { type: 'ellipse', icon: Circle, label: '원' },
  { type: 'triangle', icon: Triangle, label: '삼각형' },
  { type: 'line', icon: Minus, label: '선' },
  { type: 'image', icon: Image, label: '이미지' },
]

export function Toolbar({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomChange,
  gridEnabled,
  onGridToggle,
  onDelete,
  onDuplicate,
  hasSelection,
}: ToolbarProps) {
  const [showZoomMenu, setShowZoomMenu] = useState(false)

  const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div className="flex items-center gap-1 p-2 bg-white border-b border-gray-200">
      {/* Drawing Tools */}
      <div className="flex items-center gap-1 border-r border-gray-200 pr-2">
        {tools.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => onToolChange(type)}
            className={`p-2 rounded transition-colors ${
              activeTool === type
                ? 'bg-indigo-100 text-indigo-600'
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </div>

      {/* History */}
      <div className="flex items-center gap-1 border-r border-gray-200 px-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded transition-colors ${
            canUndo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="실행 취소 (Ctrl+Z)"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded transition-colors ${
            canRedo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="다시 실행 (Ctrl+Y)"
        >
          <Redo className="w-5 h-5" />
        </button>
      </div>

      {/* Selection Actions */}
      <div className="flex items-center gap-1 border-r border-gray-200 px-2">
        <button
          onClick={onDuplicate}
          disabled={!hasSelection}
          className={`p-2 rounded transition-colors ${
            hasSelection ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="복제 (Ctrl+D)"
        >
          <Copy className="w-5 h-5" />
        </button>
        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className={`p-2 rounded transition-colors ${
            hasSelection ? 'hover:bg-gray-100 text-red-500' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="삭제 (Delete)"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          disabled={!hasSelection}
          className={`p-2 rounded transition-colors ${
            hasSelection ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="레이어 순서"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {/* View Controls */}
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="축소"
        >
          <ZoomOut className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowZoomMenu(!showZoomMenu)}
            className="px-2 py-1 min-w-[60px] text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
          >
            {Math.round(zoom * 100)}%
          </button>

          {showZoomMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10">
              {zoomLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    onZoomChange(level)
                    setShowZoomMenu(false)
                  }}
                  className={`block w-full px-4 py-2 text-sm text-left hover:bg-gray-100 ${
                    zoom === level ? 'bg-indigo-50 text-indigo-600' : ''
                  }`}
                >
                  {Math.round(level * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
          className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
          title="확대"
        >
          <ZoomIn className="w-5 h-5" />
        </button>

        <button
          onClick={onGridToggle}
          className={`p-2 rounded transition-colors ${
            gridEnabled ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-gray-100 text-gray-600'
          }`}
          title="그리드 표시"
        >
          <Grid3X3 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default Toolbar
