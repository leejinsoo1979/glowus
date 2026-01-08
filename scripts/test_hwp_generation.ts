import { generateHwp } from '../lib/business-plan/document-generator'
import { BusinessPlanSection } from '../lib/business-plan/types'
import fs from 'fs'
import path from 'path'

async function testHwpGeneration() {
    console.log('=== HWP Generation Test ===')

    // Mock Data
    const plan = {
        title: 'GlowUS HWP Test Plan',
        project_name: 'GlowUS Project',
        template_id: 'test-template-id'
    }

    const sections: any[] = [
        {
            section_key: '101',
            section_title: '아이템 개요',
            section_order: 1,
            content: '이것은 테스트용 아이템 개요입니다.\n줄바꿈이 잘 되는지 확인합니다.\nJava Bridge Test.'
        },
        {
            section_key: '102',
            section_title: '사업 배경',
            section_order: 2,
            content: '사업 배경 설명입니다. GlowUS는 AI 에이전트 오케스트레이션 플랫폼입니다.'
        }
    ]

    // Cast to BusinessPlanSection[] for the function call
    const fullSections = sections as BusinessPlanSection[]

    try {
        console.log('Generating HWP...')
        const result = await generateHwp(plan, fullSections, { format: 'hwp' })

        console.log('Generation Success!')
        console.log('Filename:', result.filename)
        console.log('Size:', result.size)

        const outputPath = path.resolve(process.cwd(), 'exports', result.filename)
        fs.writeFileSync(outputPath, result.buffer)
        console.log('Saved to:', outputPath)

    } catch (error) {
        console.error('Generation Failed:', error)
    }
}

testHwpGeneration()
