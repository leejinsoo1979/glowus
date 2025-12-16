'use client'

import { useMemo } from 'react'
import {
  ParsedSlideV2,
  AnySlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../../types/slide-elements'

interface SlideThumbnailProps {
  slide: ParsedSlideV2
  width?: number
  height?: number
  className?: string
}

// Scale factor for thumbnail
const THUMBNAIL_SCALE = 0.15

export function SlideThumbnail({
  slide,
  width = CANVAS_WIDTH * THUMBNAIL_SCALE,
  height = CANVAS_HEIGHT * THUMBNAIL_SCALE,
  className = '',
}: SlideThumbnailProps) {
  const scale = width / CANVAS_WIDTH

  // Render element based on type
  const renderElement = (element: AnySlideElement) => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: element.position.xPx * scale,
      top: element.position.yPx * scale,
      width: element.size.widthPx * scale,
      height: element.size.heightPx * scale,
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      transformOrigin: 'center center',
      overflow: 'hidden',
    }

    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement
        const fontSize = Math.max(4, (textEl.style.fontSizePx || textEl.style.fontSize * 1.33) * scale)
        return (
          <div
            key={element.id}
            style={{
              ...baseStyle,
              fontSize: `${fontSize}px`,
              fontFamily: textEl.style.fontFamily,
              fontWeight: textEl.style.bold ? 'bold' : 'normal',
              fontStyle: textEl.style.italic ? 'italic' : 'normal',
              color: textEl.style.color,
              textAlign: textEl.style.align as any,
              lineHeight: 1.2,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {textEl.text}
          </div>
        )
      }

      case 'image': {
        const imgEl = element as ImageElement
        return (
          <img
            key={element.id}
            src={imgEl.src}
            alt={imgEl.name || 'Image'}
            style={{
              ...baseStyle,
              objectFit: 'cover',
            }}
          />
        )
      }

      case 'shape': {
        const shapeEl = element as ShapeElement
        const shapeStyle: React.CSSProperties = {
          ...baseStyle,
          backgroundColor: shapeEl.style.fill,
          border: shapeEl.style.stroke ? `${Math.max(1, shapeEl.style.strokeWidth * scale)}px solid ${shapeEl.style.stroke}` : undefined,
        }

        switch (shapeEl.shapeType) {
          case 'ellipse':
            return (
              <div
                key={element.id}
                style={{
                  ...shapeStyle,
                  borderRadius: '50%',
                }}
              />
            )
          case 'roundRect':
            return (
              <div
                key={element.id}
                style={{
                  ...shapeStyle,
                  borderRadius: `${Math.max(2, 10 * scale)}px`,
                }}
              />
            )
          case 'triangle':
            return (
              <div
                key={element.id}
                style={{
                  ...baseStyle,
                  width: 0,
                  height: 0,
                  backgroundColor: 'transparent',
                  borderLeft: `${element.size.widthPx * scale / 2}px solid transparent`,
                  borderRight: `${element.size.widthPx * scale / 2}px solid transparent`,
                  borderBottom: `${element.size.heightPx * scale}px solid ${shapeEl.style.fill || '#ccc'}`,
                }}
              />
            )
          default:
            return (
              <div
                key={element.id}
                style={shapeStyle}
              />
            )
        }
      }

      default:
        return null
    }
  }

  // Sort elements by zIndex
  const sortedElements = useMemo(() => {
    return [...(slide.elements || [])].sort((a, b) => a.zIndex - b.zIndex)
  }, [slide.elements])

  // Background style
  const backgroundStyle: React.CSSProperties = useMemo(() => {
    if (slide.background?.type === 'image' && slide.background.image) {
      return {
        backgroundImage: `url(${slide.background.image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return {
      backgroundColor: slide.background?.color || '#FFFFFF',
    }
  }, [slide.background])

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        ...backgroundStyle,
      }}
    >
      {sortedElements.map(renderElement)}
    </div>
  )
}

// Extract text content from a slide for AI context
export function extractSlideText(slide: ParsedSlideV2): string {
  const texts: string[] = []

  // Extract text from elements
  for (const element of slide.elements || []) {
    if (element.type === 'text') {
      const textEl = element as TextElement
      if (textEl.text.trim()) {
        texts.push(textEl.text.trim())
      }
    } else if (element.type === 'shape') {
      const shapeEl = element as ShapeElement
      if (shapeEl.text?.trim()) {
        texts.push(shapeEl.text.trim())
      }
    }
  }

  // Include notes (for PDF extracted text)
  if (slide.notes?.trim()) {
    texts.push(`[추출된 텍스트] ${slide.notes.trim()}`)
  }

  return texts.join('\n')
}

// Extract all text from a presentation for AI context
export function extractPresentationText(slides: ParsedSlideV2[]): string {
  return slides
    .map((slide, index) => {
      const text = extractSlideText(slide)
      return text ? `[슬라이드 ${index + 1}]\n${text}` : `[슬라이드 ${index + 1}] (내용 없음)`
    })
    .join('\n\n')
}

export default SlideThumbnail
