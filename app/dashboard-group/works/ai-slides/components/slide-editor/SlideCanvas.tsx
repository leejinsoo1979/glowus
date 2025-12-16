'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from 'react'
import * as fabric from 'fabric'
import {
  ParsedSlideV2,
  AnySlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../../types/slide-elements'

// Fabric.js type augmentation for custom data property
declare module 'fabric' {
  interface FabricObject {
    data?: { elementId?: string }
  }
}

interface SlideCanvasProps {
  slide: ParsedSlideV2 | null
  selectedElementIds: string[]
  onElementSelect: (ids: string[]) => void
  onElementUpdate: (elementId: string, updates: Partial<AnySlideElement>) => void
  onElementAdd: (element: AnySlideElement) => void
  onElementDelete: (elementId: string) => void
  zoom: number
  gridEnabled?: boolean
  editable?: boolean
}

export function SlideCanvas({
  slide,
  selectedElementIds,
  onElementSelect,
  onElementUpdate,
  onElementAdd,
  onElementDelete,
  zoom = 1,
  gridEnabled = false,
  editable = true,
}: SlideCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const elementMapRef = useRef<Map<string, fabric.Object>>(new Map())
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#FFFFFF',
      selection: editable,
      preserveObjectStacking: true,
    })

    fabricRef.current = canvas
    setIsInitialized(true)

    // Handle selection changes
    canvas.on('selection:created', (e: any) => {
      const selectedIds = e.selected?.map((obj: any) => obj.data?.elementId).filter(Boolean) || []
      onElementSelect(selectedIds)
    })

    canvas.on('selection:updated', (e: any) => {
      const selectedIds = e.selected?.map((obj: any) => obj.data?.elementId).filter(Boolean) || []
      onElementSelect(selectedIds)
    })

    canvas.on('selection:cleared', () => {
      onElementSelect([])
    })

    // Handle object modifications
    canvas.on('object:modified', (e: any) => {
      const obj = e.target
      if (!obj || !obj.data?.elementId) return

      const elementId = obj.data.elementId
      const updates: Partial<AnySlideElement> = {
        position: {
          x: Math.round((obj.left || 0) / zoom * 914400 / CANVAS_WIDTH * 10),
          y: Math.round((obj.top || 0) / zoom * 914400 / CANVAS_HEIGHT * 7.5),
          xPx: Math.round(obj.left || 0),
          yPx: Math.round(obj.top || 0),
        },
        size: {
          width: Math.round((obj.getScaledWidth() || 100) / zoom * 914400 / CANVAS_WIDTH * 10),
          height: Math.round((obj.getScaledHeight() || 100) / zoom * 914400 / CANVAS_HEIGHT * 7.5),
          widthPx: Math.round(obj.getScaledWidth() || 100),
          heightPx: Math.round(obj.getScaledHeight() || 100),
        },
        rotation: obj.angle || 0,
      }

      onElementUpdate(elementId, updates)
    })

    // Handle text editing
    canvas.on('text:changed', (e: any) => {
      const obj = e.target as any
      if (!obj || !obj.data?.elementId) return

      onElementUpdate(obj.data.elementId, {
        text: obj.text || '',
      } as Partial<TextElement>)
    })

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editable) return

      // Delete selected elements
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObject = canvas.getActiveObject()
        if (activeObject && activeObject.data?.elementId) {
          // Don't delete if editing text
          if (activeObject.type === 'i-text' && (activeObject as fabric.IText).isEditing) {
            return
          }
          e.preventDefault()
          onElementDelete(activeObject.data.elementId)
          canvas.remove(activeObject)
          canvas.requestRenderAll()
        }
      }

      // Copy/Paste (Ctrl+C, Ctrl+V)
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a') {
          e.preventDefault()
          canvas.discardActiveObject()
          const selection = new fabric.ActiveSelection(canvas.getObjects(), { canvas })
          canvas.setActiveObject(selection)
          canvas.requestRenderAll()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      canvas.dispose()
      fabricRef.current = null
    }
  }, [editable])

  // Create Fabric object from element
  const createFabricObject = useCallback(async (element: AnySlideElement): Promise<fabric.Object | null> => {
    const commonOptions = {
      left: element.position.xPx,
      top: element.position.yPx,
      angle: element.rotation,
      selectable: editable,
      hasControls: editable,
      hasBorders: editable,
      data: { elementId: element.id },
    }

    switch (element.type) {
      case 'text': {
        const textElement = element as TextElement
        const text = new fabric.IText(textElement.text, {
          ...commonOptions,
          fontSize: textElement.style.fontSizePx || textElement.style.fontSize * 1.33,
          fontFamily: textElement.style.fontFamily,
          fontWeight: textElement.style.bold ? 'bold' : 'normal',
          fontStyle: textElement.style.italic ? 'italic' : 'normal',
          fill: textElement.style.color,
          textAlign: textElement.style.align,
          width: element.size.widthPx,
        })
        return text
      }

      case 'image': {
        const imageElement = element as ImageElement
        try {
          // Fabric.js v6 uses Promise-based API
          const img = await fabric.FabricImage.fromURL(imageElement.src, { crossOrigin: 'anonymous' })
          if (!img) {
            return null
          }
          img.set({
            ...commonOptions,
            scaleX: element.size.widthPx / (img.width || 1),
            scaleY: element.size.heightPx / (img.height || 1),
          })
          return img
        } catch {
          console.warn('Failed to load image:', imageElement.src)
          return null
        }
      }

      case 'shape': {
        const shapeElement = element as ShapeElement
        let shape: fabric.Object

        switch (shapeElement.shapeType) {
          case 'rect':
            shape = new fabric.Rect({
              ...commonOptions,
              width: element.size.widthPx,
              height: element.size.heightPx,
              fill: shapeElement.style.fill,
              stroke: shapeElement.style.stroke,
              strokeWidth: shapeElement.style.strokeWidth,
            })
            break

          case 'roundRect':
            shape = new fabric.Rect({
              ...commonOptions,
              width: element.size.widthPx,
              height: element.size.heightPx,
              fill: shapeElement.style.fill,
              stroke: shapeElement.style.stroke,
              strokeWidth: shapeElement.style.strokeWidth,
              rx: 10,
              ry: 10,
            })
            break

          case 'ellipse':
            shape = new fabric.Ellipse({
              ...commonOptions,
              rx: element.size.widthPx / 2,
              ry: element.size.heightPx / 2,
              fill: shapeElement.style.fill,
              stroke: shapeElement.style.stroke,
              strokeWidth: shapeElement.style.strokeWidth,
            })
            break

          case 'triangle':
            shape = new fabric.Triangle({
              ...commonOptions,
              width: element.size.widthPx,
              height: element.size.heightPx,
              fill: shapeElement.style.fill,
              stroke: shapeElement.style.stroke,
              strokeWidth: shapeElement.style.strokeWidth,
            })
            break

          case 'line':
            shape = new fabric.Line([0, 0, element.size.widthPx, element.size.heightPx], {
              ...commonOptions,
              stroke: shapeElement.style.stroke,
              strokeWidth: shapeElement.style.strokeWidth,
            })
            break

          default:
            shape = new fabric.Rect({
              ...commonOptions,
              width: element.size.widthPx,
              height: element.size.heightPx,
              fill: shapeElement.style.fill,
              stroke: shapeElement.style.stroke,
              strokeWidth: shapeElement.style.strokeWidth,
            })
        }

        // Add text inside shape if present
        if (shapeElement.text) {
          const textObj = new fabric.FabricText(shapeElement.text, {
            fontSize: shapeElement.textStyle?.fontSize || 14,
            fill: shapeElement.textStyle?.color || '#000000',
            originX: 'center',
            originY: 'center',
          })
          // In Fabric.js v6, create Group with both objects at once
          const group = new fabric.Group([shape, textObj], {
            ...commonOptions,
          })
          return group
        }

        return shape
      }

      default:
        return null
    }
  }, [editable])

  // Render slide elements
  useEffect(() => {
    if (!fabricRef.current || !isInitialized) return

    const canvas = fabricRef.current

    // Clear existing objects
    canvas.clear()
    elementMapRef.current.clear()

    // Set background
    if (slide?.background) {
      if (slide.background.type === 'solid' && slide.background.color) {
        canvas.backgroundColor = slide.background.color
      } else if (slide.background.type === 'image' && slide.background.image) {
        // Fabric.js v6: use Promise API and assign backgroundImage directly
        fabric.FabricImage.fromURL(slide.background.image, { crossOrigin: 'anonymous' })
          .then((img) => {
            if (img) {
              img.set({
                scaleX: CANVAS_WIDTH / (img.width || 1),
                scaleY: CANVAS_HEIGHT / (img.height || 1),
              })
              canvas.backgroundImage = img
              canvas.requestRenderAll()
            }
          })
          .catch((err) => {
            console.warn('Failed to load background image:', err)
          })
      }
    } else {
      canvas.backgroundColor = '#FFFFFF'
    }

    // Add elements
    if (slide?.elements) {
      const sortedElements = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex)

      Promise.all(sortedElements.map(element => createFabricObject(element)))
        .then(objects => {
          objects.forEach((obj, index) => {
            if (obj) {
              canvas.add(obj)
              elementMapRef.current.set(sortedElements[index].id, obj)
            }
          })
          canvas.requestRenderAll()
        })
    } else {
      canvas.requestRenderAll()
    }
  }, [slide, isInitialized, createFabricObject])

  // Update zoom
  useEffect(() => {
    if (!fabricRef.current) return
    fabricRef.current.setZoom(zoom)
    fabricRef.current.setDimensions({
      width: CANVAS_WIDTH * zoom,
      height: CANVAS_HEIGHT * zoom,
    })
  }, [zoom])

  // Sync selection with external state
  useEffect(() => {
    if (!fabricRef.current || !isInitialized) return

    const canvas = fabricRef.current
    const objects = selectedElementIds
      .map(id => elementMapRef.current.get(id))
      .filter((obj): obj is fabric.Object => obj !== undefined)

    if (objects.length === 0) {
      canvas.discardActiveObject()
    } else if (objects.length === 1) {
      canvas.setActiveObject(objects[0])
    } else {
      const selection = new fabric.ActiveSelection(objects, { canvas })
      canvas.setActiveObject(selection)
    }
    canvas.requestRenderAll()
  }, [selectedElementIds, isInitialized])

  // Draw grid overlay
  const renderGrid = useCallback(() => {
    if (!gridEnabled || !fabricRef.current) return null

    const gridSize = 20 * zoom
    const lines: JSX.Element[] = []

    for (let i = 0; i <= CANVAS_WIDTH * zoom / gridSize; i++) {
      lines.push(
        <line
          key={`v-${i}`}
          x1={i * gridSize}
          y1={0}
          x2={i * gridSize}
          y2={CANVAS_HEIGHT * zoom}
          stroke="#E5E7EB"
          strokeWidth={0.5}
        />
      )
    }

    for (let i = 0; i <= CANVAS_HEIGHT * zoom / gridSize; i++) {
      lines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={i * gridSize}
          x2={CANVAS_WIDTH * zoom}
          y2={i * gridSize}
          stroke="#E5E7EB"
          strokeWidth={0.5}
        />
      )
    }

    return (
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width={CANVAS_WIDTH * zoom}
        height={CANVAS_HEIGHT * zoom}
      >
        {lines}
      </svg>
    )
  }, [gridEnabled, zoom])

  return (
    <div className="relative inline-block" style={{ width: CANVAS_WIDTH * zoom, height: CANVAS_HEIGHT * zoom }}>
      <canvas
        ref={canvasRef}
        className="border border-gray-200 shadow-lg rounded"
      />
      {renderGrid()}
    </div>
  )
}

export default SlideCanvas
