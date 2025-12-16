// PDF Parser using pdf.js with OCR support
// Converts PDF pages to slide images
// Note: This module should only be used on the client side

import {
  ParsedSlideV2,
  ParsedPresentationV2,
  ImageElement,
  createPosition,
  createSize,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  SLIDE_WIDTH_EMU,
  SLIDE_HEIGHT_EMU,
} from '../types/slide-elements'
import * as Tesseract from 'tesseract.js'

export interface PDFParseOptions {
  scale?: number           // Render scale (default: 2 for high quality)
  extractText?: boolean    // Whether to extract text layer (default: true)
  useOCR?: boolean         // Use OCR if text extraction fails (default: true)
  maxPages?: number        // Maximum pages to parse (default: all)
  ocrLang?: string         // OCR language (default: 'kor+eng')
}

const defaultOptions: PDFParseOptions = {
  scale: 2,
  extractText: true,
  useOCR: true,
  maxPages: 100,
  ocrLang: 'kor+eng'
}

// Global type declaration for pdf.js loaded via CDN
declare global {
  interface Window {
    pdfjsLib?: any
  }
}

// PDF.js CDN version
const PDFJS_VERSION = '2.6.347'
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`

// Load pdf.js from CDN
async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('PDF parsing is only available on the client side')
  }

  // If already loaded, return it
  if (window.pdfjsLib) {
    return window.pdfjsLib
  }

  // Load pdf.js from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${PDFJS_CDN_BASE}/pdf.min.js`
    script.type = 'text/javascript'

    script.onload = () => {
      // Wait for pdfjsLib to be available
      const checkInterval = setInterval(() => {
        if (window.pdfjsLib) {
          clearInterval(checkInterval)
          // Set worker source
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`
          resolve(window.pdfjsLib)
        }
      }, 50)

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('PDF.js failed to load'))
      }, 10000)
    }

    script.onerror = () => reject(new Error('Failed to load PDF.js from CDN'))

    document.head.appendChild(script)
  })
}

// Render a PDF page to canvas and return as data URL
async function renderPageToImage(
  page: any,
  scale: number
): Promise<string> {
  const viewport = page.getViewport({ scale })

  // Create canvas
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not get canvas context')

  canvas.width = viewport.width
  canvas.height = viewport.height

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport,
  }).promise

  // Convert to PNG data URL
  return canvas.toDataURL('image/png')
}

// Extract text from a PDF page using text layer
async function extractPageText(page: any): Promise<string> {
  const textContent = await page.getTextContent()
  const texts = textContent.items
    .filter((item: any) => 'str' in item)
    .map((item: any) => item.str as string)

  return texts.join(' ').trim()
}

// OCR: Extract text from image using Tesseract.js
async function ocrFromImage(imageDataUrl: string, lang: string = 'kor+eng'): Promise<string> {
  console.log(`[PDF Parser] Running OCR with language: ${lang}`)
  try {
    const result = await Tesseract.recognize(imageDataUrl, lang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`)
        }
      }
    })
    const text = result.data.text.trim()
    console.log(`[PDF Parser] OCR extracted ${text.length} characters`)
    return text
  } catch (error) {
    console.error('[PDF Parser] OCR failed:', error)
    return ''
  }
}

// Parse PDF file to slides
export async function parsePdfFile(
  file: File,
  options: PDFParseOptions = {}
): Promise<ParsedPresentationV2> {
  const pdfjsLib = await loadPdfJs()
  const opts = { ...defaultOptions, ...options }

  // Load PDF document
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const totalPages = Math.min(pdf.numPages, opts.maxPages || 100)
  const slides: ParsedSlideV2[] = []
  const presentationTitle = file.name.replace(/\.pdf$/i, '')

  console.log(`[PDF Parser] Parsing ${totalPages} pages from ${file.name}`)

  // Parse each page
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum)

    // Get page dimensions for proper aspect ratio
    const viewport = page.getViewport({ scale: 1 })
    const aspectRatio = viewport.width / viewport.height

    // Calculate scale to fit our slide canvas
    let targetWidth = CANVAS_WIDTH * (opts.scale || 2)
    let targetHeight = targetWidth / aspectRatio

    // If too tall, scale down
    if (targetHeight > CANVAS_HEIGHT * (opts.scale || 2)) {
      targetHeight = CANVAS_HEIGHT * (opts.scale || 2)
      targetWidth = targetHeight * aspectRatio
    }

    const renderScale = targetWidth / viewport.width

    // Render page to image
    const imageData = await renderPageToImage(page, renderScale)

    // Create image element that fills the slide
    const imageElement: ImageElement = {
      id: `pdf-page-${pageNum}`,
      type: 'image',
      position: createPosition(0, 0),
      size: createSize(SLIDE_WIDTH_EMU, SLIDE_HEIGHT_EMU),
      rotation: 0,
      zIndex: 0,
      src: imageData,
      name: `Page ${pageNum}`,
      originalWidth: viewport.width,
      originalHeight: viewport.height
    }

    // Extract text (try text layer first, then OCR if empty)
    let notes: string | undefined
    if (opts.extractText) {
      notes = await extractPageText(page)
      console.log(`[PDF Parser] Page ${pageNum} text layer: ${notes ? notes.length + ' chars' : 'empty'}`)

      // If no text found and OCR is enabled, use OCR
      if ((!notes || notes.length < 10) && opts.useOCR) {
        console.log(`[PDF Parser] Page ${pageNum}: Text layer empty, using OCR...`)
        notes = await ocrFromImage(imageData, opts.ocrLang)
        if (notes) {
          notes = `[OCR] ${notes}`
        }
      }
    }

    const slide: ParsedSlideV2 = {
      id: `slide-pdf-${Date.now()}-${pageNum}`,
      index: pageNum - 1,
      elements: [imageElement],
      notes,
      background: {
        type: 'solid',
        color: '#FFFFFF'
      }
    }

    slides.push(slide)
    console.log(`[PDF Parser] Parsed page ${pageNum}/${totalPages}`)
  }

  return {
    title: presentationTitle,
    slides,
    metadata: {
      author: 'PDF Import'
    }
  }
}

// Check if file is PDF
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

// Check if file is PPTX
export function isPptxFile(file: File): boolean {
  return file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
         file.name.toLowerCase().endsWith('.pptx') ||
         file.name.toLowerCase().endsWith('.ppt')
}

// Universal file parser
export async function parseSlideFile(file: File): Promise<ParsedPresentationV2> {
  if (isPdfFile(file)) {
    return parsePdfFile(file)
  } else if (isPptxFile(file)) {
    // Dynamically import PPTX parser to avoid circular dependency
    const { parsePptxFileV2 } = await import('./pptx-parser-v2')
    return parsePptxFileV2(file)
  } else {
    throw new Error(`Unsupported file type: ${file.type || file.name}`)
  }
}
