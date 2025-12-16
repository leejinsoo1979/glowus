// Enhanced PPTX Parser with Position, Size, and Style Extraction
// Parses PowerPoint files to extract elements with accurate positioning

import JSZip from 'jszip'
import {
  ParsedSlideV2,
  ParsedPresentationV2,
  AnySlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  TextStyle,
  ShapeStyle,
  SlideBackground,
  Position,
  Size,
  ShapeType,
  createPosition,
  createSize,
  defaultTextStyle,
  defaultShapeStyle,
  EMU_PER_INCH,
} from '../types/slide-elements'

// MIME type mapping for media files
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'emf': 'image/emf',
    'wmf': 'image/wmf'
  }
  return mimeTypes[ext || ''] || 'image/png'
}

// Extract all media files from PPTX
async function extractMediaFiles(zip: JSZip): Promise<Map<string, string>> {
  const mediaMap = new Map<string, string>()

  const mediaFiles: string[] = []
  zip.forEach((relativePath) => {
    if (relativePath.startsWith('ppt/media/')) {
      mediaFiles.push(relativePath)
    }
  })

  for (const mediaPath of mediaFiles) {
    const file = zip.file(mediaPath)
    if (file) {
      try {
        const data = await file.async('base64')
        const mimeType = getMimeType(mediaPath)
        const dataUrl = `data:${mimeType};base64,${data}`
        const filename = mediaPath.split('/').pop() || mediaPath
        mediaMap.set(filename, dataUrl)
      } catch (e) {
        console.warn(`Failed to extract media: ${mediaPath}`, e)
      }
    }
  }

  return mediaMap
}

// Parse relationship file to map rId to media files
async function parseRelationships(zip: JSZip, slideIndex: number): Promise<Map<string, string>> {
  const relMap = new Map<string, string>()
  const relsPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`

  const relsFile = zip.file(relsPath)
  if (!relsFile) return relMap

  const relsXml = await relsFile.async('string')
  const relationshipRegex = /<Relationship[^>]+>/g
  let relMatch

  while ((relMatch = relationshipRegex.exec(relsXml)) !== null) {
    const relTag = relMatch[0]
    const idMatch = relTag.match(/Id="([^"]+)"/)
    const targetMatch = relTag.match(/Target="([^"]+)"/)

    if (idMatch && targetMatch) {
      const rId = idMatch[1]
      const target = targetMatch[1]
      if (target.includes('media/') || target.includes('image')) {
        const filename = target.split('/').pop() || target
        relMap.set(rId, filename)
      }
    }
  }

  return relMap
}

// Parse position from <a:off> element
function parsePosition(xml: string): Position {
  const offMatch = xml.match(/<a:off[^>]*x="(\d+)"[^>]*y="(\d+)"/)
  if (offMatch) {
    const x = parseInt(offMatch[1], 10)
    const y = parseInt(offMatch[2], 10)
    return createPosition(x, y)
  }
  return createPosition(0, 0)
}

// Parse size from <a:ext> element
function parseSize(xml: string): Size {
  const extMatch = xml.match(/<a:ext[^>]*cx="(\d+)"[^>]*cy="(\d+)"/)
  if (extMatch) {
    const width = parseInt(extMatch[1], 10)
    const height = parseInt(extMatch[2], 10)
    return createSize(width, height)
  }
  return createSize(914400, 457200) // Default 1" x 0.5"
}

// Parse rotation from <a:xfrm> element
function parseRotation(xml: string): number {
  const rotMatch = xml.match(/<a:xfrm[^>]*rot="(\d+)"/)
  if (rotMatch) {
    // PowerPoint stores rotation in 60000ths of a degree
    return parseInt(rotMatch[1], 10) / 60000
  }
  return 0
}

// Parse color value (handles srgbClr, schemeClr)
function parseColor(colorXml: string, defaultColor: string = '#000000'): string {
  // Direct RGB color
  const srgbMatch = colorXml.match(/<a:srgbClr[^>]*val="([A-Fa-f0-9]{6})"/)
  if (srgbMatch) {
    return `#${srgbMatch[1]}`
  }

  // Scheme color (simplified mapping)
  const schemeMatch = colorXml.match(/<a:schemeClr[^>]*val="([^"]+)"/)
  if (schemeMatch) {
    const schemeColors: Record<string, string> = {
      'tx1': '#000000',
      'tx2': '#44546A',
      'bg1': '#FFFFFF',
      'bg2': '#E7E6E6',
      'accent1': '#4472C4',
      'accent2': '#ED7D31',
      'accent3': '#A5A5A5',
      'accent4': '#FFC000',
      'accent5': '#5B9BD5',
      'accent6': '#70AD47',
      'lt1': '#FFFFFF',
      'dk1': '#000000',
    }
    return schemeColors[schemeMatch[1]] || defaultColor
  }

  return defaultColor
}

// Parse text style from <a:rPr> element
function parseTextStyle(rPrXml: string): Partial<TextStyle> {
  const style: Partial<TextStyle> = {}

  // Font size (in hundredths of a point)
  const szMatch = rPrXml.match(/sz="(\d+)"/)
  if (szMatch) {
    style.fontSize = parseInt(szMatch[1], 10) / 100
  }

  // Bold
  if (/\bb="1"/.test(rPrXml) || /\bb="true"/.test(rPrXml)) {
    style.bold = true
  }

  // Italic
  if (/\bi="1"/.test(rPrXml) || /\bi="true"/.test(rPrXml)) {
    style.italic = true
  }

  // Underline
  if (/\bu="sng"/.test(rPrXml) || /\bu="1"/.test(rPrXml)) {
    style.underline = true
  }

  // Font family
  const latinMatch = rPrXml.match(/<a:latin[^>]*typeface="([^"]+)"/)
  if (latinMatch) {
    style.fontFamily = latinMatch[1]
  }

  // Text color
  const solidFillMatch = rPrXml.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/)
  if (solidFillMatch) {
    style.color = parseColor(solidFillMatch[1])
  }

  return style
}

// Parse paragraph alignment
function parseAlignment(pPrXml: string): TextStyle['align'] {
  const algnMatch = pPrXml.match(/algn="([^"]+)"/)
  if (algnMatch) {
    const alignMap: Record<string, TextStyle['align']> = {
      'l': 'left',
      'ctr': 'center',
      'r': 'right',
      'just': 'justify',
    }
    return alignMap[algnMatch[1]] || 'left'
  }
  return 'left'
}

// Parse shape type from <a:prstGeom>
function parseShapeType(xml: string): ShapeType {
  const prstMatch = xml.match(/<a:prstGeom[^>]*prst="([^"]+)"/)
  if (prstMatch) {
    const typeMap: Record<string, ShapeType> = {
      'rect': 'rect',
      'roundRect': 'roundRect',
      'ellipse': 'ellipse',
      'triangle': 'triangle',
      'diamond': 'diamond',
      'pentagon': 'pentagon',
      'hexagon': 'hexagon',
      'rightArrow': 'arrow',
      'leftArrow': 'arrow',
      'line': 'line',
      'star5': 'star5',
      'star6': 'star6',
      'wedgeRoundRectCallout': 'callout',
      'wedgeRectCallout': 'callout',
    }
    return typeMap[prstMatch[1]] || 'rect'
  }
  return 'rect'
}

// Parse shape style from <p:spPr>
function parseShapeStyle(spPrXml: string): ShapeStyle {
  const style: ShapeStyle = { ...defaultShapeStyle }

  // Fill color
  const solidFillMatch = spPrXml.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/)
  if (solidFillMatch) {
    style.fill = parseColor(solidFillMatch[1], '#4F46E5')
  } else if (/<a:noFill/.test(spPrXml)) {
    style.fill = 'transparent'
  }

  // Line/stroke
  const lnMatch = spPrXml.match(/<a:ln[^>]*(?:w="(\d+)")?[^>]*>([\s\S]*?)<\/a:ln>/)
  if (lnMatch) {
    if (lnMatch[1]) {
      // Width in EMU, convert to points
      style.strokeWidth = parseInt(lnMatch[1], 10) / EMU_PER_INCH * 72
    }
    const lnFillMatch = lnMatch[2].match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/)
    if (lnFillMatch) {
      style.stroke = parseColor(lnFillMatch[1], '#3730A3')
    }
  }

  return style
}

// Extract text elements from paragraph
function extractTextFromParagraph(pXml: string): { text: string; style: Partial<TextStyle> }[] {
  const runs: { text: string; style: Partial<TextStyle> }[] = []

  // Match text runs <a:r>
  const runRegex = /<a:r>([\s\S]*?)<\/a:r>/g
  let runMatch

  while ((runMatch = runRegex.exec(pXml)) !== null) {
    const runContent = runMatch[1]

    // Get text content
    const textMatch = runContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/)
    if (textMatch && textMatch[1]) {
      const style: Partial<TextStyle> = {}

      // Parse run properties
      const rPrMatch = runContent.match(/<a:rPr[^>]*>([\s\S]*?)<\/a:rPr>/)
      if (rPrMatch) {
        Object.assign(style, parseTextStyle(rPrMatch[0] + rPrMatch[1]))
      }

      runs.push({ text: textMatch[1], style })
    }
  }

  return runs
}

// Parse a text shape element
function parseTextShape(spXml: string, slideIndex: number, elementIndex: number): TextElement | null {
  // Extract transform
  const xfrmMatch = spXml.match(/<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/)
  if (!xfrmMatch) return null

  const xfrmContent = xfrmMatch[0] + xfrmMatch[1]
  const position = parsePosition(xfrmContent)
  const size = parseSize(xfrmContent)
  const rotation = parseRotation(xfrmContent)

  // Extract text body
  const txBodyMatch = spXml.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/)
  if (!txBodyMatch) return null

  const txBodyContent = txBodyMatch[1]

  // Extract all text
  const texts: string[] = []
  const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g
  let textMatch
  while ((textMatch = textRegex.exec(txBodyContent)) !== null) {
    if (textMatch[1].trim()) {
      texts.push(textMatch[1])
    }
  }

  if (texts.length === 0) return null

  // Get default style from first run
  let style: TextStyle = { ...defaultTextStyle }

  const pPrMatch = txBodyContent.match(/<a:pPr[^>]*>/)
  if (pPrMatch) {
    style.align = parseAlignment(pPrMatch[0])
  }

  const rPrMatch = txBodyContent.match(/<a:rPr[^>]*>([\s\S]*?)<\/a:rPr>/) ||
                   txBodyContent.match(/<a:defRPr[^>]*>([\s\S]*?)<\/a:defRPr>/)
  if (rPrMatch) {
    Object.assign(style, parseTextStyle(rPrMatch[0] + (rPrMatch[1] || '')))
  }

  return {
    id: `text-${slideIndex}-${elementIndex}`,
    type: 'text',
    position,
    size,
    rotation,
    zIndex: elementIndex,
    text: texts.join('\n'),
    style,
    name: texts[0].substring(0, 20) // First 20 chars as name
  }
}

// Parse a picture element
function parsePicture(
  picXml: string,
  slideIndex: number,
  elementIndex: number,
  relMap: Map<string, string>,
  mediaMap: Map<string, string>
): ImageElement | null {
  // Extract transform
  const xfrmMatch = picXml.match(/<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/)
  if (!xfrmMatch) return null

  const xfrmContent = xfrmMatch[0] + xfrmMatch[1]
  const position = parsePosition(xfrmContent)
  const size = parseSize(xfrmContent)
  const rotation = parseRotation(xfrmContent)

  // Get image reference
  const blipMatch = picXml.match(/r:embed="([^"]+)"/)
  if (!blipMatch) return null

  const rId = blipMatch[1]
  const mediaFilename = relMap.get(rId)
  if (!mediaFilename) return null

  const src = mediaMap.get(mediaFilename)
  if (!src) return null

  return {
    id: `image-${slideIndex}-${elementIndex}`,
    type: 'image',
    position,
    size,
    rotation,
    zIndex: elementIndex,
    src,
    name: `Image ${elementIndex + 1}`
  }
}

// Parse a shape element (non-text shapes)
function parseShapeElement(
  spXml: string,
  slideIndex: number,
  elementIndex: number
): ShapeElement | null {
  // Check if it's a shape (has prstGeom or custGeom)
  if (!/<a:prstGeom/.test(spXml) && !/<a:custGeom/.test(spXml)) {
    return null
  }

  // Extract transform
  const xfrmMatch = spXml.match(/<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/)
  if (!xfrmMatch) return null

  const xfrmContent = xfrmMatch[0] + xfrmMatch[1]
  const position = parsePosition(xfrmContent)
  const size = parseSize(xfrmContent)
  const rotation = parseRotation(xfrmContent)

  // Get shape type
  const shapeType = parseShapeType(spXml)

  // Get shape style from spPr
  const spPrMatch = spXml.match(/<p:spPr[^>]*>([\s\S]*?)<\/p:spPr>/)
  const style = spPrMatch ? parseShapeStyle(spPrMatch[1]) : { ...defaultShapeStyle }

  // Check for text inside shape
  const txBodyMatch = spXml.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/)
  let text: string | undefined
  let textStyle: TextStyle | undefined

  if (txBodyMatch) {
    const texts: string[] = []
    const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g
    let textMatch
    while ((textMatch = textRegex.exec(txBodyMatch[1])) !== null) {
      if (textMatch[1].trim()) {
        texts.push(textMatch[1])
      }
    }
    if (texts.length > 0) {
      text = texts.join('\n')
      textStyle = { ...defaultTextStyle }
    }
  }

  return {
    id: `shape-${slideIndex}-${elementIndex}`,
    type: 'shape',
    position,
    size,
    rotation,
    zIndex: elementIndex,
    shapeType,
    style,
    text,
    textStyle,
    name: `${shapeType} ${elementIndex + 1}`
  }
}

// Parse slide background
function parseBackground(slideXml: string): SlideBackground | undefined {
  // Check for background color
  const bgMatch = slideXml.match(/<p:bg>([\s\S]*?)<\/p:bg>/)
  if (!bgMatch) return undefined

  const bgContent = bgMatch[1]

  // Solid fill
  const solidFillMatch = bgContent.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/)
  if (solidFillMatch) {
    return {
      type: 'solid',
      color: parseColor(solidFillMatch[1], '#FFFFFF')
    }
  }

  // Gradient fill
  const gradFillMatch = bgContent.match(/<a:gradFill>([\s\S]*?)<\/a:gradFill>/)
  if (gradFillMatch) {
    const stops: { offset: number; color: string }[] = []
    const gsRegex = /<a:gs[^>]*pos="(\d+)"[^>]*>([\s\S]*?)<\/a:gs>/g
    let gsMatch

    while ((gsMatch = gsRegex.exec(gradFillMatch[1])) !== null) {
      stops.push({
        offset: parseInt(gsMatch[1], 10) / 100000, // Convert from percentage
        color: parseColor(gsMatch[2])
      })
    }

    return {
      type: 'gradient',
      gradient: {
        type: 'linear',
        stops
      }
    }
  }

  return undefined
}

// Parse a single slide
async function parseSlide(
  xml: string,
  slideIndex: number,
  relMap: Map<string, string>,
  mediaMap: Map<string, string>
): Promise<ParsedSlideV2> {
  const elements: AnySlideElement[] = []
  let elementIndex = 0

  // Parse background
  const background = parseBackground(xml)

  // Parse shape tree
  const spTreeMatch = xml.match(/<p:spTree>([\s\S]*?)<\/p:spTree>/)
  if (spTreeMatch) {
    const spTreeContent = spTreeMatch[1]

    // Parse text shapes (p:sp with txBody)
    const spRegex = /<p:sp(?:\s[^>]*)?>([\s\S]*?)<\/p:sp>/g
    let spMatch

    while ((spMatch = spRegex.exec(spTreeContent)) !== null) {
      const spContent = spMatch[0]

      // Check if it has text
      if (/<p:txBody/.test(spContent)) {
        const textElement = parseTextShape(spContent, slideIndex, elementIndex)
        if (textElement) {
          elements.push(textElement)
          elementIndex++
          continue
        }
      }

      // Check if it's a shape
      const shapeElement = parseShapeElement(spContent, slideIndex, elementIndex)
      if (shapeElement) {
        elements.push(shapeElement)
        elementIndex++
      }
    }

    // Parse pictures (p:pic)
    const picRegex = /<p:pic(?:\s[^>]*)?>([\s\S]*?)<\/p:pic>/g
    let picMatch

    while ((picMatch = picRegex.exec(spTreeContent)) !== null) {
      const picContent = picMatch[0]
      const imageElement = parsePicture(picContent, slideIndex, elementIndex, relMap, mediaMap)
      if (imageElement) {
        elements.push(imageElement)
        elementIndex++
      }
    }
  }

  return {
    id: `slide-${Date.now()}-${slideIndex}`,
    index: slideIndex,
    elements,
    background
  }
}

// Main parser function
export async function parsePptxFileV2(file: File): Promise<ParsedPresentationV2> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const slides: ParsedSlideV2[] = []
  let presentationTitle = file.name.replace(/\.pptx?$/i, '')

  // Extract all media files first
  const mediaMap = await extractMediaFiles(zip)

  // Find all slide files
  const slideFiles: { name: string; index: number }[] = []

  zip.forEach((relativePath) => {
    const slideMatch = relativePath.match(/ppt\/slides\/slide(\d+)\.xml$/)
    if (slideMatch) {
      slideFiles.push({
        name: relativePath,
        index: parseInt(slideMatch[1], 10)
      })
    }
  })

  // Sort by slide number
  slideFiles.sort((a, b) => a.index - b.index)

  // Parse each slide
  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i]
    const xmlContent = await zip.file(slideFile.name)?.async('string')

    if (xmlContent) {
      const relMap = await parseRelationships(zip, slideFile.index)
      const slide = await parseSlide(xmlContent, i, relMap, mediaMap)
      slides.push(slide)

      // Use first text element as presentation title if on first slide
      if (i === 0 && slide.elements.length > 0) {
        const firstText = slide.elements.find(e => e.type === 'text') as TextElement
        if (firstText) {
          presentationTitle = firstText.text.split('\n')[0]
        }
      }
    }
  }

  // Try to extract metadata from presentation.xml
  let metadata: ParsedPresentationV2['metadata'] = {}
  try {
    const presXml = await zip.file('ppt/presentation.xml')?.async('string')
    if (presXml) {
      const sldSzMatch = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/)
      if (sldSzMatch) {
        metadata.slideWidth = parseInt(sldSzMatch[1], 10)
        metadata.slideHeight = parseInt(sldSzMatch[2], 10)
      }
    }
  } catch (e) {
    console.warn('Could not extract presentation metadata', e)
  }

  return {
    title: presentationTitle,
    slides,
    metadata
  }
}

// Export for backwards compatibility
export { parsePptxFileV2 as parsePptxWithPositions }
