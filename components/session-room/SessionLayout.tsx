'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  GripVertical,
  Maximize2,
  Minimize2,
  LayoutPanelLeft,
  LayoutPanelTop
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

interface SessionLayoutProps {
  viewer: React.ReactNode
  chat: React.ReactNode
  topBar?: React.ReactNode
  sideDrawer?: React.ReactNode
  defaultSplit?: number // 0-100, viewer percentage
  direction?: 'horizontal' | 'vertical'
}

export function SessionLayout({
  viewer,
  chat,
  topBar,
  sideDrawer,
  defaultSplit = 55,
  direction: initialDirection = 'horizontal'
}: SessionLayoutProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { accentColor } = useThemeStore()

  const [split, setSplit] = useState(defaultSplit)
  const [direction, setDirection] = useState(initialDirection)
  const [isDragging, setIsDragging] = useState(false)
  const [viewerMaximized, setViewerMaximized] = useState(false)
  const [chatMaximized, setChatMaximized] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startPos = direction === 'horizontal' ? e.clientX : e.clientY
    const startSplit = split

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('session-container')
      if (!container) return

      const rect = container.getBoundingClientRect()
      const size = direction === 'horizontal' ? rect.width : rect.height
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = currentPos - startPos
      const deltaPercent = (delta / size) * 100

      const newSplit = Math.min(Math.max(startSplit + deltaPercent, 20), 80)
      setSplit(newSplit)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [direction, split])

  const toggleDirection = () => {
    setDirection(d => d === 'horizontal' ? 'vertical' : 'horizontal')
  }

  const getViewerSize = () => {
    if (viewerMaximized) return '100%'
    if (chatMaximized) return '0%'
    return `${split}%`
  }

  const getChatSize = () => {
    if (chatMaximized) return '100%'
    if (viewerMaximized) return '0%'
    return `${100 - split}%`
  }

  return (
    <div className={cn(
      'h-full flex flex-col overflow-hidden',
      isDark ? 'bg-neutral-950' : 'bg-neutral-50'
    )}>
      {/* Top Bar */}
      {topBar && (
        <div className={cn(
          'flex-shrink-0 h-12 border-b flex items-center px-4 gap-3',
          isDark ? 'border-neutral-800 bg-neutral-900/50' : 'border-neutral-200 bg-white/50'
        )}>
          {topBar}

          {/* Layout Controls */}
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleDirection}
              className={cn(
                'p-1.5 rounded transition-colors',
                isDark
                  ? 'hover:bg-neutral-800 text-neutral-400'
                  : 'hover:bg-neutral-100 text-neutral-600'
              )}
              title={direction === 'horizontal' ? '세로 분할' : '가로 분할'}
            >
              {direction === 'horizontal' ? (
                <LayoutPanelTop className="w-4 h-4" />
              ) : (
                <LayoutPanelLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div
        id="session-container"
        className={cn(
          'flex-1 flex overflow-hidden',
          direction === 'vertical' && 'flex-col'
        )}
      >
        {/* Viewer Panel */}
        <div
          style={{
            [direction === 'horizontal' ? 'width' : 'height']: getViewerSize(),
            display: chatMaximized ? 'none' : 'flex'
          }}
          className={cn(
            'relative flex-col overflow-hidden transition-all',
            isDragging ? 'duration-0' : 'duration-150'
          )}
        >
          <div className="flex-1 overflow-hidden">
            {viewer}
          </div>

          {/* Viewer maximize button */}
          {!chatMaximized && (
            <button
              onClick={() => setViewerMaximized(!viewerMaximized)}
              className={cn(
                'absolute top-2 right-2 p-1.5 rounded opacity-0 hover:opacity-100 transition-opacity',
                isDark
                  ? 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                  : 'bg-white/80 text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {viewerMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Resize Handle */}
        {!viewerMaximized && !chatMaximized && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'flex-shrink-0 flex items-center justify-center cursor-col-resize group',
              direction === 'horizontal' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize',
              isDark ? 'bg-neutral-800' : 'bg-neutral-200',
              isDragging && 'bg-opacity-80'
            )}
            style={{
              cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize'
            }}
          >
            <div className={cn(
              'rounded-full transition-colors',
              direction === 'horizontal' ? 'w-0.5 h-8' : 'h-0.5 w-8',
              isDark
                ? 'bg-neutral-600 group-hover:bg-neutral-500'
                : 'bg-neutral-400 group-hover:bg-neutral-500',
              isDragging && (isDark ? 'bg-neutral-400' : 'bg-neutral-600')
            )} />
          </div>
        )}

        {/* Chat Panel */}
        <div
          style={{
            [direction === 'horizontal' ? 'width' : 'height']: getChatSize(),
            display: viewerMaximized ? 'none' : 'flex'
          }}
          className={cn(
            'relative flex-col overflow-hidden transition-all',
            isDragging ? 'duration-0' : 'duration-150'
          )}
        >
          <div className="flex-1 overflow-hidden">
            {chat}
          </div>

          {/* Chat maximize button */}
          {!viewerMaximized && (
            <button
              onClick={() => setChatMaximized(!chatMaximized)}
              className={cn(
                'absolute top-2 left-2 p-1.5 rounded opacity-0 hover:opacity-100 transition-opacity',
                isDark
                  ? 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700'
                  : 'bg-white/80 text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {chatMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Side Drawer */}
        {sideDrawer && (
          <div className={cn(
            'flex-shrink-0 w-64 border-l overflow-hidden',
            isDark ? 'border-neutral-800 bg-neutral-900/30' : 'border-neutral-200 bg-neutral-50'
          )}>
            {sideDrawer}
          </div>
        )}
      </div>
    </div>
  )
}
