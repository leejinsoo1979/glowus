'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTheme } from 'next-themes'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Region {
  x: number
  y: number
  w: number
  h: number
}

interface PdfViewerProps {
  url: string
  currentPage: number
  region?: Region
  onPageChange: (page: number) => void
  onRegionChange?: (region: Region) => void
}

export function PdfViewer({
  url,
  currentPage,
  region,
  onPageChange,
  onRegionChange
}: PdfViewerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [pdf, setPdf] = useState<any>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  // Load PDF
  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError(null)

        // Dynamic import of pdfjs
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

        const loadingTask = pdfjsLib.getDocument(url)
        const pdfDoc = await loadingTask.promise

        if (cancelled) return

        setPdf(pdfDoc)
        setTotalPages(pdfDoc.numPages)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('PDF load error:', err)
        setError('PDF를 불러올 수 없습니다')
        setLoading(false)
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [url])

  // Render page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return

    let cancelled = false

    async function renderPage() {
      try {
        const page = await pdf.getPage(currentPage)
        if (cancelled) return

        const canvas = canvasRef.current
        if (!canvas) return

        const context = canvas.getContext('2d')
        if (!context) return

        const viewport = page.getViewport({ scale, rotation })
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport
        }).promise
      } catch (err) {
        console.error('Page render error:', err)
      }
    }

    renderPage()
    return () => { cancelled = true }
  }, [pdf, currentPage, scale, rotation])

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }

  const handleZoom = (delta: number) => {
    setScale(s => Math.min(Math.max(s + delta, 0.5), 3))
  }

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360)
  }

  // Region selection handler
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onRegionChange || !canvasRef.current) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    // Create a small region around click point
    onRegionChange({
      x: Math.max(0, x - 0.1),
      y: Math.max(0, y - 0.1),
      w: 0.2,
      h: 0.2
    })
  }, [onRegionChange])

  if (loading) {
    return (
      <div className={cn(
        'h-full flex items-center justify-center',
        isDark ? 'bg-neutral-900' : 'bg-neutral-50'
      )}>
        <Loader2 className={cn(
          'w-6 h-6 animate-spin',
          isDark ? 'text-neutral-500' : 'text-neutral-400'
        )} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        'h-full flex items-center justify-center',
        isDark ? 'bg-neutral-900 text-neutral-500' : 'bg-neutral-50 text-neutral-400'
      )}>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

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
        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className={cn(
              'p-1.5 rounded transition-colors disabled:opacity-30',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className={cn(
            'flex items-center gap-1 px-2 text-xs',
            isDark ? 'text-neutral-400' : 'text-neutral-600'
          )}>
            <input
              type="number"
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className={cn(
                'w-10 px-1 py-0.5 rounded text-center',
                isDark
                  ? 'bg-neutral-800 text-neutral-200 border-neutral-700'
                  : 'bg-white text-neutral-900 border-neutral-300',
                'border focus:outline-none focus:ring-1 focus:ring-neutral-500'
              )}
              min={1}
              max={totalPages}
            />
            <span>/</span>
            <span>{totalPages}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className={cn(
              'p-1.5 rounded transition-colors disabled:opacity-30',
              isDark
                ? 'hover:bg-neutral-800 text-neutral-400'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Tools */}
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

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={cn(
              'max-w-full shadow-lg cursor-crosshair',
              isDark ? 'shadow-neutral-950' : 'shadow-neutral-300'
            )}
          />

          {/* Region Highlight */}
          {region && canvasRef.current && (
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
        </div>
      </div>

      {/* Page Thumbnails (Mini) */}
      <div className={cn(
        'flex-shrink-0 h-16 border-t overflow-x-auto flex items-center gap-1 px-2',
        isDark ? 'border-neutral-800 bg-neutral-900/80' : 'border-neutral-200 bg-neutral-50/80'
      )}>
        {Array.from({ length: Math.min(totalPages, 20) }, (_, i) => i + 1).map(page => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={cn(
              'flex-shrink-0 w-10 h-12 rounded text-xs font-medium transition-colors',
              page === currentPage
                ? isDark
                  ? 'bg-neutral-700 text-neutral-100 ring-1 ring-neutral-600'
                  : 'bg-white text-neutral-900 ring-1 ring-neutral-300'
                : isDark
                  ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-750'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            )}
          >
            {page}
          </button>
        ))}
        {totalPages > 20 && (
          <span className={cn(
            'text-xs px-2',
            isDark ? 'text-neutral-500' : 'text-neutral-400'
          )}>
            +{totalPages - 20}
          </span>
        )}
      </div>
    </div>
  )
}
