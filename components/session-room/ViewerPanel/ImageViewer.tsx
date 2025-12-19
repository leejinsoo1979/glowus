'use client'

import { useState, useRef, useCallback } from 'react'
import { useTheme } from 'next-themes'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Move,
  Maximize2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Region {
  x: number
  y: number
  w: number
  h: number
}

interface ImageViewerProps {
  url: string
  region?: Region
  onRegionChange?: (region: Region) => void
}

export function ImageViewer({
  url,
  region,
  onRegionChange
}: ImageViewerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [tempRegion, setTempRegion] = useState<Region | null>(null)

  const handleZoom = (delta: number) => {
    setScale(s => Math.min(Math.max(s + delta, 0.25), 4))
  }

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360)
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }

  // Pan functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return

    if (e.shiftKey && onRegionChange) {
      // Start region selection
      setIsSelecting(true)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setSelectionStart({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        })
      }
    } else {
      // Start panning
      setIsDragging(true)
    }
  }, [onRegionChange])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition(p => ({
        x: p.x + e.movementX,
        y: p.y + e.movementY
      }))
    } else if (isSelecting && selectionStart) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const currentX = (e.clientX - rect.left) / rect.width
        const currentY = (e.clientY - rect.top) / rect.height

        setTempRegion({
          x: Math.min(selectionStart.x, currentX),
          y: Math.min(selectionStart.y, currentY),
          w: Math.abs(currentX - selectionStart.x),
          h: Math.abs(currentY - selectionStart.y)
        })
      }
    }
  }, [isDragging, isSelecting, selectionStart])

  const handleMouseUp = useCallback(() => {
    if (isSelecting && tempRegion && onRegionChange) {
      onRegionChange(tempRegion)
    }
    setIsDragging(false)
    setIsSelecting(false)
    setSelectionStart(null)
    setTempRegion(null)
  }, [isSelecting, tempRegion, onRegionChange])

  // Click to set focus point
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging || isSelecting || !onRegionChange) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    onRegionChange({
      x: Math.max(0, x - 0.1),
      y: Math.max(0, y - 0.1),
      w: 0.2,
      h: 0.2
    })
  }, [isDragging, isSelecting, onRegionChange])

  return (
    <div className={cn(
      'h-full flex flex-col',
      isDark ? 'bg-neutral-900' : 'bg-neutral-50'
    )}>
      {/* Toolbar */}
      <div className={cn(
        'flex-shrink-0 flex items-center justify-between px-3 py-2 border-b',
        isDark ? 'border-neutral-800' : 'border-neutral-200'
      )}>
        <div className={cn(
          'text-xs',
          isDark ? 'text-neutral-400' : 'text-neutral-600'
        )}>
          Shift + 드래그로 영역 선택
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => handleZoom(-0.25)}
            className={cn(
              'p-1.5 rounded transition-colors',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className={cn(
            'text-xs w-12 text-center',
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          )}>
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={() => handleZoom(0.25)}
            className={cn(
              'p-1.5 rounded transition-colors',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className={cn(
            'w-px h-4 mx-1',
            isDark ? 'bg-neutral-700' : 'bg-neutral-300'
          )} />

          <button
            onClick={handleRotate}
            className={cn(
              'p-1.5 rounded transition-colors',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleReset}
            className={cn(
              'p-1.5 rounded transition-colors',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <a
            href={url}
            download
            className={cn(
              'p-1.5 rounded transition-colors',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className={cn(
          'flex-1 overflow-hidden relative',
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`
          }}
        >
          <img
            ref={imageRef}
            src={url}
            alt="Viewer content"
            draggable={false}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease'
            }}
          />
        </div>

        {/* Region Highlight */}
        {region && (
          <div
            className="absolute border-2 border-amber-500 bg-amber-500/10 pointer-events-none"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.w * 100}%`,
              height: `${region.h * 100}%`
            }}
          />
        )}

        {/* Temp Selection */}
        {tempRegion && (
          <div
            className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              left: `${tempRegion.x * 100}%`,
              top: `${tempRegion.y * 100}%`,
              width: `${tempRegion.w * 100}%`,
              height: `${tempRegion.h * 100}%`
            }}
          />
        )}
      </div>
    </div>
  )
}
