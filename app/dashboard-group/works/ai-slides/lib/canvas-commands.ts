// AI Canvas Commands - Natural Language to Canvas Operations
// Converts AI-parsed commands to element modifications

import {
  ParsedSlideV2,
  ParsedPresentationV2,
  AnySlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  CanvasCommand,
  CanvasCommandType,
  createPosition,
  createSize,
  defaultTextStyle,
  defaultShapeStyle,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../types/slide-elements'

// Command result
export interface CommandResult {
  success: boolean
  message: string
  affectedElementIds?: string[]
  newPresentation?: ParsedPresentationV2
}

// Find element by name or ID
function findElement(
  slide: ParsedSlideV2,
  target: string
): AnySlideElement | undefined {
  // Try to find by ID first
  let element = slide.elements.find(el => el.id === target)
  if (element) return element

  // Try to find by name (case-insensitive)
  const targetLower = target.toLowerCase()
  element = slide.elements.find(el =>
    el.name?.toLowerCase().includes(targetLower) ||
    (el.type === 'text' && (el as TextElement).text.toLowerCase().includes(targetLower))
  )
  if (element) return element

  // Try to find by type + index (e.g., "text-1", "image-2")
  const typeMatch = target.match(/^(text|image|shape)-?(\d+)$/i)
  if (typeMatch) {
    const type = typeMatch[1].toLowerCase()
    const index = parseInt(typeMatch[2], 10) - 1
    const typeElements = slide.elements.filter(el => el.type === type)
    return typeElements[index]
  }

  // Try to find by position description
  if (target.includes('제목') || target.includes('title')) {
    return slide.elements.find(el =>
      el.type === 'text' && el.position.yPx < CANVAS_HEIGHT / 3
    )
  }

  if (target.includes('본문') || target.includes('body') || target.includes('content')) {
    const textElements = slide.elements.filter(el => el.type === 'text')
    if (textElements.length > 1) {
      return textElements[1] // Second text element is usually body
    }
  }

  return undefined
}

// Execute a single command
export function executeCommand(
  presentation: ParsedPresentationV2,
  slideIndex: number,
  command: CanvasCommand
): CommandResult {
  const slide = presentation.slides[slideIndex]
  if (!slide) {
    return { success: false, message: '슬라이드를 찾을 수 없습니다' }
  }

  const newPresentation = JSON.parse(JSON.stringify(presentation)) as ParsedPresentationV2
  const newSlide = newPresentation.slides[slideIndex]

  switch (command.type) {
    case 'select': {
      // Selection is handled by UI, just return success
      const element = command.target ? findElement(slide, command.target) : null
      return {
        success: true,
        message: element ? `'${element.name || element.id}' 선택됨` : '선택 해제됨',
        affectedElementIds: element ? [element.id] : [],
      }
    }

    case 'add': {
      const { elementType, content, x, y, width, height, style } = command.params

      const newId = `${elementType}-${Date.now()}`
      const posX = x ?? CANVAS_WIDTH / 2 - 100
      const posY = y ?? CANVAS_HEIGHT / 2 - 50
      const sizeW = width ?? 200
      const sizeH = height ?? (elementType === 'text' ? 50 : 100)

      let newElement: AnySlideElement

      if (elementType === 'text') {
        newElement = {
          id: newId,
          type: 'text',
          position: { ...createPosition(0, 0), xPx: posX, yPx: posY },
          size: { ...createSize(0, 0), widthPx: sizeW, heightPx: sizeH },
          rotation: 0,
          zIndex: newSlide.elements.length + 1,
          text: content || '새 텍스트',
          style: { ...defaultTextStyle, ...style },
          name: content?.substring(0, 20) || '새 텍스트',
        } as TextElement
      } else if (elementType === 'image') {
        newElement = {
          id: newId,
          type: 'image',
          position: { ...createPosition(0, 0), xPx: posX, yPx: posY },
          size: { ...createSize(0, 0), widthPx: sizeW, heightPx: sizeH },
          rotation: 0,
          zIndex: newSlide.elements.length + 1,
          src: content || '',
          name: '새 이미지',
        } as ImageElement
      } else {
        newElement = {
          id: newId,
          type: 'shape',
          position: { ...createPosition(0, 0), xPx: posX, yPx: posY },
          size: { ...createSize(0, 0), widthPx: sizeW, heightPx: sizeH },
          rotation: 0,
          zIndex: newSlide.elements.length + 1,
          shapeType: elementType === 'rect' ? 'rect' :
                     elementType === 'circle' ? 'ellipse' :
                     elementType === 'triangle' ? 'triangle' : 'rect',
          style: { ...defaultShapeStyle, ...style },
        } as ShapeElement
      }

      newSlide.elements.push(newElement)

      return {
        success: true,
        message: `새 ${elementType} 요소가 추가되었습니다`,
        affectedElementIds: [newId],
        newPresentation,
      }
    }

    case 'delete': {
      if (!command.target) {
        return { success: false, message: '삭제할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      newSlide.elements = newSlide.elements.filter(el => el.id !== element.id)

      return {
        success: true,
        message: `'${element.name || element.id}'이(가) 삭제되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'move': {
      if (!command.target) {
        return { success: false, message: '이동할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      const { x, y, dx, dy, position: positionName } = command.params
      const elementIndex = newSlide.elements.findIndex(el => el.id === element.id)

      // Handle named positions
      if (positionName) {
        const positions: Record<string, { x: number; y: number }> = {
          '왼쪽 상단': { x: 50, y: 50 },
          '오른쪽 상단': { x: CANVAS_WIDTH - element.size.widthPx - 50, y: 50 },
          '왼쪽 하단': { x: 50, y: CANVAS_HEIGHT - element.size.heightPx - 50 },
          '오른쪽 하단': { x: CANVAS_WIDTH - element.size.widthPx - 50, y: CANVAS_HEIGHT - element.size.heightPx - 50 },
          '중앙': { x: CANVAS_WIDTH / 2 - element.size.widthPx / 2, y: CANVAS_HEIGHT / 2 - element.size.heightPx / 2 },
          'top-left': { x: 50, y: 50 },
          'top-right': { x: CANVAS_WIDTH - element.size.widthPx - 50, y: 50 },
          'bottom-left': { x: 50, y: CANVAS_HEIGHT - element.size.heightPx - 50 },
          'bottom-right': { x: CANVAS_WIDTH - element.size.widthPx - 50, y: CANVAS_HEIGHT - element.size.heightPx - 50 },
          'center': { x: CANVAS_WIDTH / 2 - element.size.widthPx / 2, y: CANVAS_HEIGHT / 2 - element.size.heightPx / 2 },
        }

        const pos = positions[positionName]
        if (pos) {
          newSlide.elements[elementIndex].position = {
            ...newSlide.elements[elementIndex].position,
            xPx: pos.x,
            yPx: pos.y,
          }
        }
      } else if (x !== undefined || y !== undefined) {
        // Absolute position
        if (x !== undefined) newSlide.elements[elementIndex].position.xPx = x
        if (y !== undefined) newSlide.elements[elementIndex].position.yPx = y
      } else if (dx !== undefined || dy !== undefined) {
        // Relative movement
        if (dx !== undefined) newSlide.elements[elementIndex].position.xPx += dx
        if (dy !== undefined) newSlide.elements[elementIndex].position.yPx += dy
      }

      return {
        success: true,
        message: `'${element.name || element.id}'이(가) 이동되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'resize': {
      if (!command.target) {
        return { success: false, message: '크기를 변경할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      const { width, height, scale } = command.params
      const elementIndex = newSlide.elements.findIndex(el => el.id === element.id)

      if (scale !== undefined) {
        newSlide.elements[elementIndex].size.widthPx *= scale
        newSlide.elements[elementIndex].size.heightPx *= scale
      } else {
        if (width !== undefined) newSlide.elements[elementIndex].size.widthPx = width
        if (height !== undefined) newSlide.elements[elementIndex].size.heightPx = height
      }

      return {
        success: true,
        message: `'${element.name || element.id}'의 크기가 변경되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'rotate': {
      if (!command.target) {
        return { success: false, message: '회전할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      const { angle, delta } = command.params
      const elementIndex = newSlide.elements.findIndex(el => el.id === element.id)

      if (delta !== undefined) {
        newSlide.elements[elementIndex].rotation += delta
      } else if (angle !== undefined) {
        newSlide.elements[elementIndex].rotation = angle
      }

      return {
        success: true,
        message: `'${element.name || element.id}'이(가) 회전되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'style': {
      if (!command.target) {
        return { success: false, message: '스타일을 변경할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      const elementIndex = newSlide.elements.findIndex(el => el.id === element.id)
      const { color, fontSize, fontFamily, bold, italic, fill, stroke, strokeWidth, align } = command.params

      if (element.type === 'text') {
        const textEl = newSlide.elements[elementIndex] as TextElement
        if (color !== undefined) textEl.style.color = color
        if (fontSize !== undefined) textEl.style.fontSize = fontSize
        if (fontFamily !== undefined) textEl.style.fontFamily = fontFamily
        if (bold !== undefined) textEl.style.bold = bold
        if (italic !== undefined) textEl.style.italic = italic
        if (align !== undefined) textEl.style.align = align
      } else if (element.type === 'shape') {
        const shapeEl = newSlide.elements[elementIndex] as ShapeElement
        if (fill !== undefined) shapeEl.style.fill = fill
        if (stroke !== undefined) shapeEl.style.stroke = stroke
        if (strokeWidth !== undefined) shapeEl.style.strokeWidth = strokeWidth
      }

      return {
        success: true,
        message: `'${element.name || element.id}'의 스타일이 변경되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'text': {
      if (!command.target) {
        return { success: false, message: '텍스트를 변경할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element || element.type !== 'text') {
        return { success: false, message: `텍스트 요소 '${command.target}'을(를) 찾을 수 없습니다` }
      }

      const { content, append, prepend } = command.params
      const elementIndex = newSlide.elements.findIndex(el => el.id === element.id)
      const textEl = newSlide.elements[elementIndex] as TextElement

      if (append) {
        textEl.text += append
      } else if (prepend) {
        textEl.text = prepend + textEl.text
      } else if (content !== undefined) {
        textEl.text = content
      }

      return {
        success: true,
        message: `텍스트가 변경되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'order': {
      if (!command.target) {
        return { success: false, message: '순서를 변경할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      const { direction } = command.params // 'front', 'back', 'forward', 'backward'
      const elementIndex = newSlide.elements.findIndex(el => el.id === element.id)
      const maxZIndex = Math.max(...newSlide.elements.map(el => el.zIndex))
      const minZIndex = Math.min(...newSlide.elements.map(el => el.zIndex))

      switch (direction) {
        case 'front':
          newSlide.elements[elementIndex].zIndex = maxZIndex + 1
          break
        case 'back':
          newSlide.elements[elementIndex].zIndex = minZIndex - 1
          break
        case 'forward':
          newSlide.elements[elementIndex].zIndex += 1
          break
        case 'backward':
          newSlide.elements[elementIndex].zIndex -= 1
          break
      }

      // Re-sort elements by zIndex
      newSlide.elements.sort((a, b) => a.zIndex - b.zIndex)

      return {
        success: true,
        message: `'${element.name || element.id}'의 순서가 변경되었습니다`,
        affectedElementIds: [element.id],
        newPresentation,
      }
    }

    case 'duplicate': {
      if (!command.target) {
        return { success: false, message: '복제할 요소를 지정해주세요' }
      }

      const element = findElement(slide, command.target)
      if (!element) {
        return { success: false, message: `'${command.target}'을(를) 찾을 수 없습니다` }
      }

      const newElement = JSON.parse(JSON.stringify(element)) as AnySlideElement
      newElement.id = `${element.type}-${Date.now()}`
      newElement.position.xPx += 20
      newElement.position.yPx += 20
      newElement.zIndex = Math.max(...newSlide.elements.map(el => el.zIndex)) + 1

      newSlide.elements.push(newElement)

      return {
        success: true,
        message: `'${element.name || element.id}'이(가) 복제되었습니다`,
        affectedElementIds: [newElement.id],
        newPresentation,
      }
    }

    default:
      return { success: false, message: `지원하지 않는 명령: ${command.type}` }
  }
}

// Execute multiple commands
export function executeCommands(
  presentation: ParsedPresentationV2,
  slideIndex: number,
  commands: CanvasCommand[]
): CommandResult {
  let currentPresentation = presentation
  const allAffectedIds: string[] = []
  const messages: string[] = []

  for (const command of commands) {
    const result = executeCommand(currentPresentation, slideIndex, command)

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        affectedElementIds: allAffectedIds,
        newPresentation: currentPresentation,
      }
    }

    if (result.newPresentation) {
      currentPresentation = result.newPresentation
    }

    if (result.affectedElementIds) {
      allAffectedIds.push(...result.affectedElementIds)
    }

    messages.push(result.message)
  }

  return {
    success: true,
    message: messages.join(', '),
    affectedElementIds: Array.from(new Set(allAffectedIds)),
    newPresentation: currentPresentation,
  }
}

// Example AI prompt for command parsing
export const AI_COMMAND_PARSING_PROMPT = `당신은 슬라이드 편집 명령을 JSON으로 변환하는 AI입니다.

사용자의 자연어 명령을 다음 JSON 형식의 명령 배열로 변환하세요:

{
  "commands": [
    {
      "type": "select" | "add" | "delete" | "move" | "resize" | "rotate" | "style" | "text" | "order" | "duplicate",
      "target": "요소 ID, 이름, 또는 설명 (예: 'title', '제목', 'text-1', 'image-2')",
      "params": {
        // type에 따른 파라미터
      }
    }
  ]
}

각 type별 params:
- add: { elementType: "text"|"image"|"rect"|"circle"|"triangle", content?: string, x?: number, y?: number, width?: number, height?: number, style?: object }
- delete: (params 없음)
- move: { x?: number, y?: number, dx?: number, dy?: number, position?: "왼쪽 상단"|"오른쪽 상단"|"중앙"|... }
- resize: { width?: number, height?: number, scale?: number }
- rotate: { angle?: number, delta?: number }
- style: { color?: string, fontSize?: number, fontFamily?: string, bold?: boolean, italic?: boolean, fill?: string, stroke?: string, align?: "left"|"center"|"right" }
- text: { content?: string, append?: string, prepend?: string }
- order: { direction: "front"|"back"|"forward"|"backward" }
- duplicate: (params 없음)

예시:
사용자: "제목을 빨간색으로 바꿔줘"
응답: { "commands": [{ "type": "style", "target": "제목", "params": { "color": "#FF0000" } }] }

사용자: "로고를 왼쪽 상단으로 옮기고 크기를 50% 줄여줘"
응답: { "commands": [
  { "type": "move", "target": "로고", "params": { "position": "왼쪽 상단" } },
  { "type": "resize", "target": "로고", "params": { "scale": 0.5 } }
] }

현재 슬라이드 컨텍스트:
{slideContext}

사용자 명령: {userCommand}
`
