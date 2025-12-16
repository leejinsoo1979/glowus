import { NextRequest, NextResponse } from 'next/server'
import PptxGenJS from 'pptxgenjs'

interface SlideContent {
    id: string
    type: string
    title: string
    subtitle?: string
    content: any
}

// Color scheme
const COLORS = {
    primary: '2563EB',
    secondary: '1E40AF',
    accent: '3B82F6',
    dark: '1E293B',
    light: 'F8FAFC',
    text: '334155',
    muted: '64748B',
    success: '10B981',
    warning: 'F59E0B',
    danger: 'EF4444',
}

export async function POST(request: NextRequest) {
    try {
        const { slides, title } = await request.json()

        if (!slides || !Array.isArray(slides)) {
            return NextResponse.json({ error: 'Invalid slides data' }, { status: 400 })
        }

        const pptx = new PptxGenJS()

        // Set presentation properties
        pptx.author = 'StartupShow AI'
        pptx.title = title || '사업계획서'
        pptx.subject = 'AI Generated Business Plan'
        pptx.company = 'StartupShow'

        // Define slide master
        pptx.defineSlideMaster({
            title: 'MASTER_SLIDE',
            background: { color: COLORS.light },
            objects: [
                {
                    rect: {
                        x: 0, y: 0, w: '100%', h: 0.5,
                        fill: { color: COLORS.primary }
                    }
                },
                {
                    text: {
                        text: 'StartupShow',
                        options: {
                            x: 0.3, y: 5.2, w: 2, h: 0.3,
                            fontSize: 10, color: COLORS.muted
                        }
                    }
                }
            ]
        })

        // Generate slides
        slides.forEach((slideData: SlideContent, index: number) => {
            const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' })

            switch (slideData.type) {
                case 'cover':
                    addCoverSlide(slide, slideData)
                    break
                case 'problem':
                    addProblemSlide(slide, slideData)
                    break
                case 'solution':
                    addSolutionSlide(slide, slideData)
                    break
                case 'market':
                    addMarketSlide(slide, slideData)
                    break
                case 'business-model':
                    addBusinessModelSlide(slide, slideData)
                    break
                case 'team':
                    addTeamSlide(slide, slideData)
                    break
                case 'investment':
                    addInvestmentSlide(slide, slideData)
                    break
                case 'contact':
                    addContactSlide(slide, slideData)
                    break
                default:
                    addDefaultSlide(slide, slideData)
            }

            // Add slide number
            slide.addText(`${index + 1}`, {
                x: 9.2, y: 5.2, w: 0.5, h: 0.3,
                fontSize: 10, color: COLORS.muted, align: 'right'
            })
        })

        // Generate PPTX as base64
        const pptxData = await pptx.write({ outputType: 'base64' })

        return NextResponse.json({
            success: true,
            data: pptxData,
            filename: `${title || '사업계획서'}.pptx`
        })
    } catch (error) {
        console.error('[Slides Export API] Error:', error)
        return NextResponse.json({ error: 'Failed to generate PPTX' }, { status: 500 })
    }
}

// Slide generation functions
function addCoverSlide(slide: any, data: SlideContent) {
    slide.addText(data.title || '사업계획서', {
        x: 0.5, y: 1.5, w: 9, h: 1.2,
        fontSize: 44, bold: true, color: COLORS.dark, align: 'center'
    })

    if (data.subtitle) {
        slide.addText(data.subtitle, {
            x: 0.5, y: 2.7, w: 9, h: 0.6,
            fontSize: 24, color: COLORS.primary, align: 'center'
        })
    }

    if (data.content?.tagline) {
        slide.addText(data.content.tagline, {
            x: 0.5, y: 3.5, w: 9, h: 0.5,
            fontSize: 18, color: COLORS.muted, align: 'center', italic: true
        })
    }

    if (data.content?.presenter) {
        slide.addText(data.content.presenter, {
            x: 0.5, y: 4.3, w: 9, h: 0.4,
            fontSize: 16, color: COLORS.text, align: 'center'
        })
    }

    if (data.content?.date) {
        slide.addText(data.content.date, {
            x: 0.5, y: 4.7, w: 9, h: 0.3,
            fontSize: 14, color: COLORS.muted, align: 'center'
        })
    }
}

function addProblemSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    const issues = data.content?.issues || []
    issues.forEach((issue: any, idx: number) => {
        const yPos = 1.8 + idx * 1.0
        slide.addText(`${issue.icon || '•'} ${issue.title}`, {
            x: 0.5, y: yPos, w: 9, h: 0.4,
            fontSize: 18, bold: true, color: COLORS.dark
        })
        slide.addText(issue.desc || '', {
            x: 0.8, y: yPos + 0.4, w: 8.5, h: 0.4,
            fontSize: 14, color: COLORS.muted
        })
    })

    if (data.content?.targetCustomer) {
        slide.addText(`타겟 고객: ${data.content.targetCustomer}`, {
            x: 0.5, y: 4.5, w: 9, h: 0.3,
            fontSize: 12, color: COLORS.primary
        })
    }
}

function addSolutionSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    if (data.content?.mainDesc) {
        slide.addText(data.content.mainDesc, {
            x: 0.5, y: 1.5, w: 9, h: 0.6,
            fontSize: 16, color: COLORS.text
        })
    }

    const features = data.content?.features || []
    features.forEach((feature: any, idx: number) => {
        const xPos = 0.5 + (idx % 3) * 3.2
        const yPos = 2.3 + Math.floor(idx / 3) * 1.5

        slide.addText(`${feature.icon || '✓'} ${feature.title}`, {
            x: xPos, y: yPos, w: 3, h: 0.4,
            fontSize: 14, bold: true, color: COLORS.primary
        })
        slide.addText(feature.desc || '', {
            x: xPos, y: yPos + 0.4, w: 3, h: 0.6,
            fontSize: 11, color: COLORS.muted
        })
    })
}

function addMarketSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    const markets = [
        { key: 'tam', label: 'TAM', color: COLORS.primary },
        { key: 'sam', label: 'SAM', color: COLORS.secondary },
        { key: 'som', label: 'SOM', color: COLORS.accent }
    ]

    markets.forEach((market, idx) => {
        const xPos = 0.5 + idx * 3.2
        const marketData = data.content?.[market.key]

        slide.addShape('ellipse', {
            x: xPos + 0.5, y: 1.8, w: 2, h: 2,
            fill: { color: market.color, transparency: 20 },
            line: { color: market.color, width: 2 }
        })

        slide.addText(market.label, {
            x: xPos, y: 2.3, w: 3, h: 0.4,
            fontSize: 16, bold: true, color: market.color, align: 'center'
        })

        slide.addText(marketData?.value || '', {
            x: xPos, y: 2.7, w: 3, h: 0.5,
            fontSize: 20, bold: true, color: COLORS.dark, align: 'center'
        })

        slide.addText(marketData?.desc || '', {
            x: xPos, y: 4.0, w: 3, h: 0.4,
            fontSize: 10, color: COLORS.muted, align: 'center'
        })
    })

    if (data.content?.cagr) {
        slide.addText(`📈 ${data.content.cagr}`, {
            x: 0.5, y: 4.7, w: 9, h: 0.3,
            fontSize: 14, color: COLORS.success, align: 'center'
        })
    }
}

function addBusinessModelSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    if (data.content?.model) {
        slide.addText(`비즈니스 모델: ${data.content.model}`, {
            x: 0.5, y: 1.5, w: 9, h: 0.4,
            fontSize: 16, bold: true, color: COLORS.primary
        })
    }

    const pricing = data.content?.pricing || []
    pricing.forEach((tier: any, idx: number) => {
        const xPos = 0.5 + idx * 3.2

        slide.addShape('rect', {
            x: xPos, y: 2.0, w: 3, h: 2.5,
            fill: { color: idx === 1 ? COLORS.primary : COLORS.light },
            line: { color: COLORS.primary, width: 1 },
            shadow: { type: 'outer', blur: 3, offset: 2, angle: 45, opacity: 0.2 }
        })

        slide.addText(tier.tier || '', {
            x: xPos, y: 2.1, w: 3, h: 0.4,
            fontSize: 16, bold: true, color: idx === 1 ? COLORS.light : COLORS.dark, align: 'center'
        })

        slide.addText(tier.price || '', {
            x: xPos, y: 2.5, w: 3, h: 0.5,
            fontSize: 20, bold: true, color: idx === 1 ? COLORS.light : COLORS.primary, align: 'center'
        })

        const features = tier.features || []
        features.forEach((feature: string, fIdx: number) => {
            slide.addText(`• ${feature}`, {
                x: xPos + 0.2, y: 3.1 + fIdx * 0.35, w: 2.6, h: 0.3,
                fontSize: 10, color: idx === 1 ? COLORS.light : COLORS.text
            })
        })
    })
}

function addTeamSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    const founders = data.content?.founders || []
    founders.forEach((founder: any, idx: number) => {
        const xPos = 0.5 + idx * 3.2

        slide.addShape('ellipse', {
            x: xPos + 0.75, y: 1.6, w: 1.5, h: 1.5,
            fill: { color: COLORS.primary, transparency: 80 },
            line: { color: COLORS.primary, width: 2 }
        })

        slide.addText(founder.name || '', {
            x: xPos, y: 3.2, w: 3, h: 0.4,
            fontSize: 16, bold: true, color: COLORS.dark, align: 'center'
        })

        slide.addText(founder.role || '', {
            x: xPos, y: 3.6, w: 3, h: 0.3,
            fontSize: 12, color: COLORS.primary, align: 'center'
        })

        slide.addText(founder.background || '', {
            x: xPos, y: 3.95, w: 3, h: 0.5,
            fontSize: 10, color: COLORS.muted, align: 'center'
        })
    })

    if (data.content?.hiringPlan) {
        slide.addText(`채용 계획: ${data.content.hiringPlan}`, {
            x: 0.5, y: 4.7, w: 9, h: 0.3,
            fontSize: 12, color: COLORS.text
        })
    }
}

function addInvestmentSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    const fields = [
        { label: '투자 라운드', value: data.content?.round },
        { label: '목표 금액', value: data.content?.amount },
        { label: '기업가치', value: data.content?.valuation },
        { label: '투자 조건', value: data.content?.terms }
    ]

    fields.forEach((field, idx) => {
        if (field.value) {
            const yPos = 1.6 + idx * 0.8
            slide.addText(field.label, {
                x: 0.5, y: yPos, w: 2.5, h: 0.4,
                fontSize: 14, color: COLORS.muted
            })
            slide.addText(field.value, {
                x: 3, y: yPos, w: 6.5, h: 0.4,
                fontSize: 16, bold: true, color: COLORS.dark
            })
        }
    })

    if (data.content?.progress) {
        slide.addText(`현재 진행 상황: ${data.content.progress}`, {
            x: 0.5, y: 4.5, w: 9, h: 0.4,
            fontSize: 14, color: COLORS.success
        })
    }
}

function addContactSlide(slide: any, data: SlideContent) {
    slide.addText('감사합니다', {
        x: 0.5, y: 1.2, w: 9, h: 0.8,
        fontSize: 36, bold: true, color: COLORS.dark, align: 'center'
    })

    slide.addText('Thank You', {
        x: 0.5, y: 1.9, w: 9, h: 0.5,
        fontSize: 20, color: COLORS.muted, align: 'center'
    })

    const contactInfo = [
        { icon: '👤', value: data.content?.name },
        { icon: '📧', value: data.content?.email },
        { icon: '📱', value: data.content?.phone },
        { icon: '🌐', value: data.content?.website }
    ]

    contactInfo.forEach((info, idx) => {
        if (info.value) {
            slide.addText(`${info.icon}  ${info.value}`, {
                x: 3, y: 2.8 + idx * 0.5, w: 4, h: 0.4,
                fontSize: 14, color: COLORS.text, align: 'center'
            })
        }
    })
}

function addDefaultSlide(slide: any, data: SlideContent) {
    addSlideHeader(slide, data.title, data.subtitle)

    // Try to render content as text
    if (data.content) {
        const contentStr = typeof data.content === 'string'
            ? data.content
            : JSON.stringify(data.content, null, 2)

        slide.addText(contentStr.substring(0, 500), {
            x: 0.5, y: 1.5, w: 9, h: 3.5,
            fontSize: 12, color: COLORS.text, valign: 'top'
        })
    }
}

function addSlideHeader(slide: any, title: string, subtitle?: string) {
    slide.addText(title || '', {
        x: 0.5, y: 0.7, w: 9, h: 0.5,
        fontSize: 28, bold: true, color: COLORS.dark
    })

    if (subtitle) {
        slide.addText(subtitle, {
            x: 0.5, y: 1.2, w: 9, h: 0.3,
            fontSize: 14, color: COLORS.muted
        })
    }
}
