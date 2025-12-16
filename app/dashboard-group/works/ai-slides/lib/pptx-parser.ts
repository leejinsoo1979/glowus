// PPTX File Parser using JSZip with Image Extraction
import JSZip from 'jszip'

export interface SlideImage {
    id: string
    dataUrl: string
    width?: number
    height?: number
    x?: number
    y?: number
}

export interface ParsedSlide {
    id: string
    type: 'cover' | 'content' | 'problem' | 'solution' | 'market' | 'business-model' | 'product' | 'competition' | 'gtm' | 'marketing' | 'team' | 'roadmap' | 'revenue' | 'financials' | 'investment' | 'contact'
    title: string
    subtitle?: string
    content: {
        heading?: string
        description?: string
        points?: string[]
        items?: Array<{ title: string; description: string }>
    }
    images?: SlideImage[]
    backgroundColor?: string
}

export interface ParsedPresentation {
    title: string
    slides: ParsedSlide[]
}

// Get MIME type from file extension
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

    const mediaFolder = zip.folder('ppt/media')
    if (!mediaFolder) return mediaMap

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
                // Store with just the filename as key (e.g., "image1.png")
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
    if (!relsFile) {
        return relMap
    }

    const relsXml = await relsFile.async('string')

    // Match Relationship tags - handle different attribute orders
    const relationshipRegex = /<Relationship[^>]+>/g
    let relMatch

    while ((relMatch = relationshipRegex.exec(relsXml)) !== null) {
        const relTag = relMatch[0]

        // Extract Id and Target attributes separately
        const idMatch = relTag.match(/Id="([^"]+)"/)
        const targetMatch = relTag.match(/Target="([^"]+)"/)

        if (idMatch && targetMatch) {
            const rId = idMatch[1]
            const target = targetMatch[1]

            // Check if it's a media file
            if (target.includes('media/') || target.includes('image')) {
                const filename = target.split('/').pop() || target
                relMap.set(rId, filename)
            }
        }
    }

    return relMap
}

// Extract image references from slide XML
function extractImageRefs(xml: string): string[] {
    const imageRefs: string[] = []

    // Match blip elements which reference images
    // <a:blip r:embed="rId2" /> or <a:blip r:link="rId3" />
    const blipRegex = /r:(?:embed|link)="([^"]+)"/g
    let match

    while ((match = blipRegex.exec(xml)) !== null) {
        imageRefs.push(match[1])
    }

    return imageRefs
}

// Extract text content from XML string
function extractTextFromXml(xml: string): string[] {
    const texts: string[] = []

    // Match <a:t> tags (PowerPoint text elements)
    const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g
    let match

    while ((match = textRegex.exec(xml)) !== null) {
        const text = match[1].trim()
        if (text) {
            texts.push(text)
        }
    }

    return texts
}

// Extract background color from slide XML
function extractBackgroundColor(xml: string): string | undefined {
    // Look for solid fill colors in background
    const bgColorRegex = /<a:srgbClr val="([A-Fa-f0-9]{6})"/g
    const match = bgColorRegex.exec(xml)
    if (match) {
        return `#${match[1]}`
    }
    return undefined
}

// Determine slide type based on content
function determineSlideType(texts: string[], slideIndex: number): ParsedSlide['type'] {
    const joinedText = texts.join(' ').toLowerCase()

    if (slideIndex === 0) return 'cover'

    if (joinedText.includes('problem') || joinedText.includes('문제') || joinedText.includes('challenge')) {
        return 'problem'
    }
    if (joinedText.includes('solution') || joinedText.includes('솔루션') || joinedText.includes('해결')) {
        return 'solution'
    }
    if (joinedText.includes('market') || joinedText.includes('시장') || joinedText.includes('tam') || joinedText.includes('sam')) {
        return 'market'
    }
    if (joinedText.includes('business model') || joinedText.includes('비즈니스 모델') || joinedText.includes('수익')) {
        return 'business-model'
    }
    if (joinedText.includes('product') || joinedText.includes('제품') || joinedText.includes('서비스')) {
        return 'product'
    }
    if (joinedText.includes('competition') || joinedText.includes('경쟁') || joinedText.includes('competitor')) {
        return 'competition'
    }
    if (joinedText.includes('go-to-market') || joinedText.includes('gtm') || joinedText.includes('진출')) {
        return 'gtm'
    }
    if (joinedText.includes('marketing') || joinedText.includes('마케팅')) {
        return 'marketing'
    }
    if (joinedText.includes('team') || joinedText.includes('팀') || joinedText.includes('구성원')) {
        return 'team'
    }
    if (joinedText.includes('roadmap') || joinedText.includes('로드맵') || joinedText.includes('timeline')) {
        return 'roadmap'
    }
    if (joinedText.includes('revenue') || joinedText.includes('매출') || joinedText.includes('재무')) {
        return 'financials'
    }
    if (joinedText.includes('investment') || joinedText.includes('투자') || joinedText.includes('funding')) {
        return 'investment'
    }
    if (joinedText.includes('contact') || joinedText.includes('연락') || joinedText.includes('감사')) {
        return 'contact'
    }

    return 'content'
}

// Parse a single slide with images
async function parseSlide(
    xml: string,
    slideIndex: number,
    relMap: Map<string, string>,
    mediaMap: Map<string, string>
): Promise<ParsedSlide> {
    const texts = extractTextFromXml(xml)
    const type = determineSlideType(texts, slideIndex)
    const backgroundColor = extractBackgroundColor(xml)

    // First text is usually the title
    const title = texts[0] || `슬라이드 ${slideIndex + 1}`
    const subtitle = texts.length > 1 && texts[1].length < 100 ? texts[1] : undefined

    // Remaining texts are content
    const contentTexts = subtitle ? texts.slice(2) : texts.slice(1)

    // Extract images
    const imageRefs = extractImageRefs(xml)
    const images: SlideImage[] = []

    for (const rId of imageRefs) {
        const mediaFilename = relMap.get(rId)
        if (mediaFilename) {
            const dataUrl = mediaMap.get(mediaFilename)
            if (dataUrl) {
                images.push({
                    id: `img-${slideIndex}-${images.length}`,
                    dataUrl
                })
            }
        }
    }

    return {
        id: `slide-${Date.now()}-${slideIndex}`,
        type,
        title,
        subtitle,
        content: {
            heading: title,
            description: subtitle,
            points: contentTexts.length > 0 ? contentTexts : undefined
        },
        images: images.length > 0 ? images : undefined,
        backgroundColor
    }
}

// Main parser function
export async function parsePptxFile(file: File): Promise<ParsedPresentation> {
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    const slides: ParsedSlide[] = []
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
            // Get relationships for this slide
            const relMap = await parseRelationships(zip, slideFile.index)

            const slide = await parseSlide(xmlContent, i, relMap, mediaMap)
            slides.push(slide)

            // Use first slide title as presentation title if it's a cover
            if (i === 0 && slide.type === 'cover' && slide.title) {
                presentationTitle = slide.title
            }
        }
    }

    return {
        title: presentationTitle,
        slides
    }
}

// Convert parsed slides to the app's SlideContent format
export function convertToSlideContent(parsed: ParsedPresentation): {
    title: string
    slides: Array<{
        id: string
        type: ParsedSlide['type']
        title: string
        subtitle?: string
        content: any
        images?: SlideImage[]
        backgroundColor?: string
    }>
} {
    return {
        title: parsed.title,
        slides: parsed.slides.map(slide => ({
            id: slide.id,
            type: slide.type,
            title: slide.title,
            subtitle: slide.subtitle,
            content: slide.content,
            images: slide.images,
            backgroundColor: slide.backgroundColor
        }))
    }
}
