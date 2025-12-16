'use client'

import { useState, useCallback, useRef } from 'react'
import { SlideCanvas } from './SlideCanvas'
import { Toolbar, ToolType } from './Toolbar'
import { PropertyPanel } from './PropertyPanel'
import { SlideThumbnail } from './SlideThumbnail'
import {
  ParsedSlideV2,
  ParsedPresentationV2,
  AnySlideElement,
  TextElement,
  ShapeElement,
  ImageElement,
  createPosition,
  createSize,
  defaultTextStyle,
  defaultShapeStyle,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../../types/slide-elements'
import { ChevronLeft, ChevronRight, Plus, FileDown, MessageSquare } from 'lucide-react'

interface SlideEditorProps {
  presentation: ParsedPresentationV2 | null
  onPresentationChange: (presentation: ParsedPresentationV2) => void
  onExport?: () => void
  onAIChat?: () => void
}

export function SlideEditor({
  presentation,
  onPresentationChange,
  onExport,
  onAIChat,
}: SlideEditorProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([])
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [zoom, setZoom] = useState(1)
  const [gridEnabled, setGridEnabled] = useState(false)
  const [history, setHistory] = useState<{ past: ParsedPresentationV2[]; future: ParsedPresentationV2[] }>({
    past: [],
    future: [],
  })
  const [showPropertyPanel, setShowPropertyPanel] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentSlide = presentation?.slides[currentSlideIndex] || null
  const selectedElements = currentSlide?.elements.filter(el => selectedElementIds.includes(el.id)) || []

  // Save state for undo
  const saveHistory = useCallback(() => {
    if (!presentation) return
    setHistory(prev => ({
      past: [...prev.past, JSON.parse(JSON.stringify(presentation))].slice(-50),
      future: [],
    }))
  }, [presentation])

  // Undo
  const handleUndo = useCallback(() => {
    if (history.past.length === 0 || !presentation) return

    const newPast = [...history.past]
    const previousState = newPast.pop()!

    setHistory(prev => ({
      past: newPast,
      future: [JSON.parse(JSON.stringify(presentation)), ...prev.future],
    }))

    onPresentationChange(previousState)
  }, [history, presentation, onPresentationChange])

  // Redo
  const handleRedo = useCallback(() => {
    if (history.future.length === 0 || !presentation) return

    const newFuture = [...history.future]
    const nextState = newFuture.shift()!

    setHistory(prev => ({
      past: [...prev.past, JSON.parse(JSON.stringify(presentation))],
      future: newFuture,
    }))

    onPresentationChange(nextState)
  }, [history, presentation, onPresentationChange])

  // Update element
  const handleElementUpdate = useCallback((elementId: string, updates: Partial<AnySlideElement>) => {
    if (!presentation) return

    saveHistory()

    const newPresentation = { ...presentation }
    const slideIndex = newPresentation.slides.findIndex(s =>
      s.elements.some(e => e.id === elementId)
    )

    if (slideIndex === -1) return

    const elementIndex = newPresentation.slides[slideIndex].elements.findIndex(e => e.id === elementId)
    if (elementIndex === -1) return

    newPresentation.slides[slideIndex] = {
      ...newPresentation.slides[slideIndex],
      elements: newPresentation.slides[slideIndex].elements.map((el, idx) =>
        idx === elementIndex ? { ...el, ...updates } as AnySlideElement : el
      ),
    }

    onPresentationChange(newPresentation)
  }, [presentation, onPresentationChange, saveHistory])

  // Add element
  const handleElementAdd = useCallback((element: AnySlideElement) => {
    if (!presentation) return

    saveHistory()

    const newPresentation = { ...presentation }
    newPresentation.slides[currentSlideIndex] = {
      ...newPresentation.slides[currentSlideIndex],
      elements: [...newPresentation.slides[currentSlideIndex].elements, element],
    }

    onPresentationChange(newPresentation)
    setSelectedElementIds([element.id])
  }, [presentation, currentSlideIndex, onPresentationChange, saveHistory])

  // Delete element
  const handleElementDelete = useCallback((elementId: string) => {
    if (!presentation) return

    saveHistory()

    const newPresentation = { ...presentation }
    newPresentation.slides[currentSlideIndex] = {
      ...newPresentation.slides[currentSlideIndex],
      elements: newPresentation.slides[currentSlideIndex].elements.filter(e => e.id !== elementId),
    }

    onPresentationChange(newPresentation)
    setSelectedElementIds(prev => prev.filter(id => id !== elementId))
  }, [presentation, currentSlideIndex, onPresentationChange, saveHistory])

  // Delete selected elements
  const handleDeleteSelected = useCallback(() => {
    if (selectedElementIds.length === 0) return
    selectedElementIds.forEach(id => handleElementDelete(id))
  }, [selectedElementIds, handleElementDelete])

  // Duplicate selected elements
  const handleDuplicateSelected = useCallback(() => {
    if (!presentation || selectedElementIds.length === 0) return

    const elementsToDuplicate = currentSlide?.elements.filter(el => selectedElementIds.includes(el.id)) || []

    saveHistory()

    const newElements = elementsToDuplicate.map(el => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `${el.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: {
        ...el.position,
        xPx: el.position.xPx + 20,
        yPx: el.position.yPx + 20,
      },
    }))

    const newPresentation = { ...presentation }
    newPresentation.slides[currentSlideIndex] = {
      ...newPresentation.slides[currentSlideIndex],
      elements: [...newPresentation.slides[currentSlideIndex].elements, ...newElements],
    }

    onPresentationChange(newPresentation)
    setSelectedElementIds(newElements.map(el => el.id))
  }, [presentation, currentSlide, currentSlideIndex, selectedElementIds, onPresentationChange, saveHistory])

  // Handle tool change - create new element if drawing tool selected
  const handleToolChange = useCallback((tool: ToolType) => {
    setActiveTool(tool)

    if (tool === 'select' || tool === 'image') return

    // Create new element at center of canvas
    const centerX = CANVAS_WIDTH / 2 - 100
    const centerY = CANVAS_HEIGHT / 2 - 50
    const newId = `${tool}-${Date.now()}`

    let newElement: AnySlideElement

    if (tool === 'text') {
      newElement = {
        id: newId,
        type: 'text',
        position: createPosition(centerX * 914400 / CANVAS_WIDTH * 10, centerY * 914400 / CANVAS_HEIGHT * 7.5),
        size: createSize(200 * 914400 / CANVAS_WIDTH * 10, 50 * 914400 / CANVAS_HEIGHT * 7.5),
        rotation: 0,
        zIndex: (currentSlide?.elements.length || 0) + 1,
        text: '텍스트를 입력하세요',
        style: { ...defaultTextStyle },
      } as TextElement

      // Update pixel positions
      newElement.position.xPx = centerX
      newElement.position.yPx = centerY
      newElement.size.widthPx = 200
      newElement.size.heightPx = 50
    } else {
      // Shape element
      const shapeMap: Record<string, ShapeElement['shapeType']> = {
        rect: 'rect',
        ellipse: 'ellipse',
        triangle: 'triangle',
        line: 'line',
      }

      newElement = {
        id: newId,
        type: 'shape',
        position: createPosition(centerX * 914400 / CANVAS_WIDTH * 10, centerY * 914400 / CANVAS_HEIGHT * 7.5),
        size: createSize(200 * 914400 / CANVAS_WIDTH * 10, 100 * 914400 / CANVAS_HEIGHT * 7.5),
        rotation: 0,
        zIndex: (currentSlide?.elements.length || 0) + 1,
        shapeType: shapeMap[tool] || 'rect',
        style: { ...defaultShapeStyle },
      } as ShapeElement

      // Update pixel positions
      newElement.position.xPx = centerX
      newElement.position.yPx = centerY
      newElement.size.widthPx = 200
      newElement.size.heightPx = tool === 'line' ? 5 : 100
    }

    handleElementAdd(newElement)
    setActiveTool('select') // Return to select tool
  }, [currentSlide, handleElementAdd])

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const maxWidth = 400
        const maxHeight = 300
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }

        const centerX = CANVAS_WIDTH / 2 - width / 2
        const centerY = CANVAS_HEIGHT / 2 - height / 2

        const newElement: ImageElement = {
          id: `image-${Date.now()}`,
          type: 'image',
          position: createPosition(centerX * 914400 / CANVAS_WIDTH * 10, centerY * 914400 / CANVAS_HEIGHT * 7.5),
          size: createSize(width * 914400 / CANVAS_WIDTH * 10, height * 914400 / CANVAS_HEIGHT * 7.5),
          rotation: 0,
          zIndex: (currentSlide?.elements.length || 0) + 1,
          src: event.target?.result as string,
          originalWidth: img.width,
          originalHeight: img.height,
        }

        newElement.position.xPx = centerX
        newElement.position.yPx = centerY
        newElement.size.widthPx = width
        newElement.size.heightPx = height

        handleElementAdd(newElement)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [currentSlide, handleElementAdd])

  // Add new slide
  const handleAddSlide = useCallback(() => {
    if (!presentation) return

    saveHistory()

    const newSlide: ParsedSlideV2 = {
      id: `slide-${Date.now()}`,
      index: presentation.slides.length,
      elements: [],
      background: { type: 'solid', color: '#FFFFFF' },
    }

    const newPresentation = {
      ...presentation,
      slides: [...presentation.slides, newSlide],
    }

    onPresentationChange(newPresentation)
    setCurrentSlideIndex(newPresentation.slides.length - 1)
  }, [presentation, onPresentationChange, saveHistory])

  // Navigate slides
  const goToSlide = useCallback((index: number) => {
    if (!presentation) return
    setCurrentSlideIndex(Math.max(0, Math.min(index, presentation.slides.length - 1)))
    setSelectedElementIds([])
  }, [presentation])

  if (!presentation) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <p className="text-gray-500">프레젠테이션을 불러오세요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={(tool) => {
          if (tool === 'image') {
            fileInputRef.current?.click()
          } else {
            handleToolChange(tool)
          }
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        zoom={zoom}
        onZoomChange={setZoom}
        gridEnabled={gridEnabled}
        onGridToggle={() => setGridEnabled(!gridEnabled)}
        onDelete={handleDeleteSelected}
        onDuplicate={handleDuplicateSelected}
        hasSelection={selectedElementIds.length > 0}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Slide Thumbnails */}
        <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto p-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium text-gray-500">슬라이드</span>
            <button
              onClick={handleAddSlide}
              className="p-1 hover:bg-gray-100 rounded"
              title="새 슬라이드 추가"
            >
              <Plus className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="space-y-2">
            {presentation.slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`w-full aspect-[4/3] rounded border-2 overflow-hidden transition-all relative ${
                  index === currentSlideIndex
                    ? 'border-indigo-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <SlideThumbnail
                  slide={slide}
                  width={176}
                  height={132}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-0.5 text-center">
                  {index + 1}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-8">
          <SlideCanvas
            slide={currentSlide}
            selectedElementIds={selectedElementIds}
            onElementSelect={setSelectedElementIds}
            onElementUpdate={handleElementUpdate}
            onElementAdd={handleElementAdd}
            onElementDelete={handleElementDelete}
            zoom={zoom}
            gridEnabled={gridEnabled}
            editable={true}
          />
        </div>

        {/* Property Panel with integrated toggle */}
        <div className={`flex-shrink-0 transition-all duration-300 ${showPropertyPanel ? 'w-64' : 'w-10'}`}>
          <div className="h-full bg-white border-l border-gray-200 flex">
            {/* Toggle Button */}
            <button
              onClick={() => setShowPropertyPanel(!showPropertyPanel)}
              className="w-10 h-full flex items-center justify-center hover:bg-gray-50 border-r border-gray-100 transition-colors"
              title={showPropertyPanel ? '패널 접기' : '속성 패널 열기'}
            >
              {showPropertyPanel ? (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Panel Content */}
            {showPropertyPanel && (
              <div className="flex-1 overflow-hidden">
                <PropertyPanel
                  selectedElements={selectedElements}
                  onUpdate={handleElementUpdate}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSlide(currentSlideIndex - 1)}
            disabled={currentSlideIndex === 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600">
            {currentSlideIndex + 1} / {presentation.slides.length}
          </span>
          <button
            onClick={() => goToSlide(currentSlideIndex + 1)}
            disabled={currentSlideIndex === presentation.slides.length - 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onAIChat && (
            <button
              onClick={onAIChat}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              AI 편집
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors"
            >
              <FileDown className="w-4 h-4" />
              내보내기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SlideEditor
