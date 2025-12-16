// Slide Element Types for WYSIWYG Editor
// Supports position/size in both EMU (PowerPoint) and pixel (canvas) units

// EMU to Pixel conversion constants
export const EMU_PER_INCH = 914400
export const DPI = 96 // Standard screen DPI
export const EMU_TO_PX = DPI / EMU_PER_INCH

// Standard PowerPoint slide dimensions (10 x 7.5 inches)
export const SLIDE_WIDTH_INCHES = 10
export const SLIDE_HEIGHT_INCHES = 7.5
export const SLIDE_WIDTH_EMU = SLIDE_WIDTH_INCHES * EMU_PER_INCH
export const SLIDE_HEIGHT_EMU = SLIDE_HEIGHT_INCHES * EMU_PER_INCH

// Canvas dimensions (scaled for screen)
export const CANVAS_WIDTH = 960
export const CANVAS_HEIGHT = 720
export const SCALE_X = CANVAS_WIDTH / SLIDE_WIDTH_EMU
export const SCALE_Y = CANVAS_HEIGHT / SLIDE_HEIGHT_EMU

// Position type with both EMU and pixel values
export interface Position {
  x: number      // EMU units (original PowerPoint)
  y: number      // EMU units
  xPx: number    // Pixel units (for canvas rendering)
  yPx: number    // Pixel units
}

// Size type with both EMU and pixel values
export interface Size {
  width: number    // EMU units
  height: number   // EMU units
  widthPx: number  // Pixel units
  heightPx: number // Pixel units
}

// Text style properties
export interface TextStyle {
  fontSize: number      // Points
  fontSizePx?: number   // Pixels (calculated)
  fontFamily: string
  bold: boolean
  italic: boolean
  underline?: boolean
  strikethrough?: boolean
  color: string         // Hex color (#RRGGBB)
  align: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number   // Multiplier (1.0 = normal)
}

// Shape style properties
export interface ShapeStyle {
  fill: string          // Hex color or 'transparent'
  stroke: string        // Hex color
  strokeWidth: number   // Points
  opacity?: number      // 0-1
  shadow?: {
    color: string
    blur: number
    offsetX: number
    offsetY: number
  }
}

// Base element interface
export interface SlideElement {
  id: string
  type: 'text' | 'image' | 'shape'
  position: Position
  size: Size
  rotation: number      // Degrees
  zIndex: number
  locked?: boolean
  name?: string         // User-friendly name for AI commands
}

// Text element
export interface TextElement extends SlideElement {
  type: 'text'
  text: string
  style: TextStyle
  paragraphs?: TextParagraph[]  // For multi-paragraph text
}

// Paragraph within text element
export interface TextParagraph {
  text: string
  style?: Partial<TextStyle>
  runs?: TextRun[]  // For mixed formatting within paragraph
}

// Text run (portion with consistent formatting)
export interface TextRun {
  text: string
  style?: Partial<TextStyle>
}

// Image element
export interface ImageElement extends SlideElement {
  type: 'image'
  src: string           // Base64 data URL or external URL
  originalWidth?: number
  originalHeight?: number
  cropArea?: {
    x: number
    y: number
    width: number
    height: number
  }
  filters?: {
    brightness?: number
    contrast?: number
    saturation?: number
  }
}

// Shape types from PowerPoint
export type ShapeType =
  | 'rect'          // Rectangle
  | 'roundRect'     // Rounded Rectangle
  | 'ellipse'       // Ellipse/Circle
  | 'triangle'      // Triangle
  | 'diamond'       // Diamond
  | 'pentagon'      // Pentagon
  | 'hexagon'       // Hexagon
  | 'arrow'         // Arrow
  | 'line'          // Line
  | 'star5'         // 5-point Star
  | 'star6'         // 6-point Star
  | 'callout'       // Callout/Speech Bubble
  | 'custom'        // Custom path

// Shape element
export interface ShapeElement extends SlideElement {
  type: 'shape'
  shapeType: ShapeType
  style: ShapeStyle
  text?: string         // Text inside shape
  textStyle?: TextStyle
  points?: { x: number; y: number }[]  // For custom shapes/lines
}

// Union type for all elements
export type AnySlideElement = TextElement | ImageElement | ShapeElement

// Slide background
export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image'
  color?: string        // For solid
  gradient?: {
    type: 'linear' | 'radial'
    angle?: number
    stops: { offset: number; color: string }[]
  }
  image?: string        // Base64 data URL
  opacity?: number
}

// Parsed slide with all elements
export interface ParsedSlideV2 {
  id: string
  index: number
  elements: AnySlideElement[]
  background?: SlideBackground
  notes?: string        // Speaker notes
  transition?: string   // Slide transition effect
}

// Full presentation
export interface ParsedPresentationV2 {
  title: string
  slides: ParsedSlideV2[]
  theme?: {
    colors: Record<string, string>
    fonts: {
      heading: string
      body: string
    }
  }
  metadata?: {
    author?: string
    created?: string
    modified?: string
    slideWidth?: number   // EMU
    slideHeight?: number  // EMU
  }
}

// Canvas command types for AI integration
export type CanvasCommandType =
  | 'select'      // Select element
  | 'add'         // Add new element
  | 'delete'      // Delete element
  | 'move'        // Move element
  | 'resize'      // Resize element
  | 'rotate'      // Rotate element
  | 'style'       // Change style
  | 'text'        // Edit text content
  | 'order'       // Change z-order
  | 'duplicate'   // Duplicate element
  | 'group'       // Group elements
  | 'ungroup'     // Ungroup elements

// Canvas command from AI
export interface CanvasCommand {
  type: CanvasCommandType
  target?: string       // Element ID or selector
  params: Record<string, any>
}

// Editor state
export interface EditorState {
  currentSlideIndex: number
  selectedElementIds: string[]
  clipboard?: AnySlideElement[]
  history: {
    past: ParsedSlideV2[][]
    future: ParsedSlideV2[][]
  }
  zoom: number
  gridEnabled: boolean
  snapToGrid: boolean
}

// Utility functions for conversions
export function emuToPx(emu: number): number {
  return Math.round(emu * SCALE_X)
}

export function pxToEmu(px: number): number {
  return Math.round(px / SCALE_X)
}

export function createPosition(xEmu: number, yEmu: number): Position {
  return {
    x: xEmu,
    y: yEmu,
    xPx: emuToPx(xEmu),
    yPx: emuToPx(yEmu)
  }
}

export function createSize(widthEmu: number, heightEmu: number): Size {
  return {
    width: widthEmu,
    height: heightEmu,
    widthPx: emuToPx(widthEmu),
    heightPx: emuToPx(heightEmu)
  }
}

// Default styles
export const defaultTextStyle: TextStyle = {
  fontSize: 18,
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  color: '#000000',
  align: 'left'
}

export const defaultShapeStyle: ShapeStyle = {
  fill: '#4F46E5',
  stroke: '#3730A3',
  strokeWidth: 1
}
