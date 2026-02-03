/**
 * Business Plan Generator - 사업계획서 생성 엔진
 *
 * GlowUS 핵심 기능 - IR 수준의 사업계획서 자동 생성
 *
 * 특징:
 * - Claude Code CLI 사용 (Opus 4.5 모델)
 * - API 호출 없음 - 터미널 실행만
 * - 실시간 스트리밍 (진짜로)
 * - 5단계 프로세스: 분석 → 리서치 → 구조 → 슬라이드 → 디자인
 * - 한글 전용
 */

import { repoRun } from '../neural-map/tools/terminal-tools'
import { randomUUID } from 'crypto'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'

// ============================================
// Types
// ============================================

export interface BusinessAnalysis {
  businessType: string
  industry: string
  targetMarket: string
  coreValue: string
  competitors: string[]
  uniquePoints: string[]
  stage: string // seed, series-a, etc.
}

export interface MarketResearch {
  tam: { value: string; description: string }
  sam: { value: string; description: string }
  som: { value: string; description: string }
  cagr: string
  marketTrend: string[]
  targetCustomer: {
    persona: string
    painPoints: string[]
    needs: string[]
  }
  competitiveLandscape: {
    direct: string[]
    indirect: string[]
    ourAdvantage: string
  }
}

export interface BusinessPlanOutline {
  title: string
  subtitle: string
  sections: {
    id: string
    type: SlideType
    title: string
    description: string
  }[]
}

export type SlideType =
  | 'cover'
  | 'problem'
  | 'solution'
  | 'product'
  | 'market'
  | 'business-model'
  | 'competition'
  | 'traction'
  | 'team'
  | 'roadmap'
  | 'financials'
  | 'investment'
  | 'contact'

export interface SlideContent {
  id: string
  type: SlideType
  title: string
  subtitle?: string
  content: {
    points?: string[]
    metrics?: { label: string; value: string; description?: string }[]
    items?: { icon?: string; title: string; description: string }[]
    timeline?: { date: string; title: string; description?: string }[]
    team?: { name: string; role: string; background?: string }[]
  }
  speakerNotes?: string
  imagePrompt?: string
}

export interface GenerationProgress {
  stage: 'analysis' | 'research' | 'outline' | 'slides' | 'design' | 'complete'
  message: string
  percent: number
  data?: any
}

// ============================================
// Generator Class - Claude Code CLI 사용
// ============================================

export class BusinessPlanGenerator {
  private tempDir = '/tmp'

  constructor() {
    console.log('[BusinessPlanGenerator] Using Claude Code CLI')
  }

  /**
   * 메인 생성 함수 - 제너레이터로 실시간 진행 상황 반환
   */
  async *generate(
    input: string,
    options: {
      slideCount?: number
      purpose?: 'investment' | 'loan' | 'introduction'
      language?: 'ko' | 'en'
    } = {}
  ): AsyncGenerator<GenerationProgress> {
    const { slideCount = 12, purpose = 'investment', language = 'ko' } = options

    try {
      // 1단계: 사업 분석
      yield { stage: 'analysis', message: '사업 내용을 분석하고 있습니다...', percent: 5 }
      const analysis = await this.analyzeInput(input, purpose)
      yield {
        stage: 'analysis',
        message: `${analysis.businessType} 사업으로 분석되었습니다.`,
        percent: 15,
        data: analysis
      }

      // 2단계: 시장 리서치
      yield { stage: 'research', message: '시장 조사를 진행하고 있습니다...', percent: 20 }
      const research = await this.conductResearch(analysis)
      yield {
        stage: 'research',
        message: `시장 규모: ${research.tam.value}`,
        percent: 35,
        data: research
      }

      // 3단계: 구조 설계
      yield { stage: 'outline', message: '사업계획서 구조를 설계하고 있습니다...', percent: 40 }
      const outline = await this.createOutline(analysis, research, slideCount, purpose)
      yield {
        stage: 'outline',
        message: `${outline.sections.length}개 섹션으로 구성`,
        percent: 50,
        data: outline
      }

      // 4단계: 슬라이드 생성 (하나씩)
      yield { stage: 'slides', message: '슬라이드를 생성하고 있습니다...', percent: 55 }

      const slides: SlideContent[] = []
      for (let i = 0; i < outline.sections.length; i++) {
        const section = outline.sections[i]
        const slide = await this.generateSlide(section, analysis, research, i + 1, outline.sections.length)
        slides.push(slide)

        const progress = 55 + Math.round((i + 1) / outline.sections.length * 35)
        yield {
          stage: 'slides',
          message: `슬라이드 ${i + 1}/${outline.sections.length}: ${slide.title}`,
          percent: progress,
          data: { slideIndex: i, slide }
        }
      }

      // 5단계: 완료
      yield {
        stage: 'complete',
        message: '사업계획서 생성 완료!',
        percent: 100,
        data: {
          analysis,
          research,
          outline,
          slides,
        }
      }

    } catch (error) {
      console.error('[BusinessPlanGenerator] Error:', error)
      throw error
    }
  }

  /**
   * 1단계: 입력 분석
   */
  private async analyzeInput(input: string, purpose: string): Promise<BusinessAnalysis> {
    const prompt = `당신은 대한민국 최고의 IR 컨설턴트입니다.

다음 내용을 분석하여 사업의 핵심 정보를 추출하세요:

"""
${input.substring(0, 5000)}
"""

목적: ${purpose === 'investment' ? '투자 유치' : purpose === 'loan' ? '대출 심사' : '사업 소개'}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "businessType": "사업 유형 (예: AI 기반 B2B SaaS, 이커머스 플랫폼)",
  "industry": "산업 분야 (예: HR Tech, FinTech, EdTech)",
  "targetMarket": "목표 시장 (예: 국내 중소기업 HR 시장)",
  "coreValue": "핵심 가치 제안 (한 문장)",
  "competitors": ["경쟁사1", "경쟁사2", "경쟁사3"],
  "uniquePoints": ["차별점1", "차별점2", "차별점3"],
  "stage": "투자 단계 (seed, pre-a, series-a, series-b 등)"
}

JSON만 출력하세요. 설명이나 마크다운 없이.`

    const response = await this.callLLM(prompt)
    return this.parseJSON<BusinessAnalysis>(response)
  }

  /**
   * 2단계: 시장 리서치
   */
  private async conductResearch(analysis: BusinessAnalysis): Promise<MarketResearch> {
    const prompt = `당신은 시장 조사 전문가입니다.

다음 사업에 대한 시장 조사를 수행하세요:
- 사업 유형: ${analysis.businessType}
- 산업: ${analysis.industry}
- 목표 시장: ${analysis.targetMarket}
- 핵심 가치: ${analysis.coreValue}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "tam": { "value": "100조원", "description": "전체 시장 규모 설명" },
  "sam": { "value": "10조원", "description": "유효 시장 규모 설명" },
  "som": { "value": "1,000억원", "description": "목표 시장 규모 설명" },
  "cagr": "연평균 성장률 (예: 15.3%)",
  "marketTrend": ["트렌드1", "트렌드2", "트렌드3"],
  "targetCustomer": {
    "persona": "목표 고객 페르소나",
    "painPoints": ["고통점1", "고통점2"],
    "needs": ["니즈1", "니즈2"]
  },
  "competitiveLandscape": {
    "direct": ["직접 경쟁사1", "직접 경쟁사2"],
    "indirect": ["간접 경쟁사1", "간접 경쟁사2"],
    "ourAdvantage": "우리만의 경쟁 우위"
  }
}

구체적인 숫자와 데이터를 포함하세요. JSON만 출력.`

    const response = await this.callLLM(prompt)
    return this.parseJSON<MarketResearch>(response)
  }

  /**
   * 3단계: 아웃라인 생성
   */
  private async createOutline(
    analysis: BusinessAnalysis,
    research: MarketResearch,
    slideCount: number,
    purpose: string
  ): Promise<BusinessPlanOutline> {
    const prompt = `당신은 IR 사업계획서 전문가입니다.

다음 정보를 바탕으로 ${slideCount}장의 사업계획서 구조를 설계하세요:

사업 분석:
${JSON.stringify(analysis, null, 2)}

시장 리서치:
${JSON.stringify(research, null, 2)}

목적: ${purpose === 'investment' ? '투자 유치' : purpose === 'loan' ? '대출 심사' : '사업 소개'}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "title": "프레젠테이션 제목 (임팩트 있게)",
  "subtitle": "부제목",
  "sections": [
    { "id": "1", "type": "cover", "title": "표지 제목", "description": "섹션 설명" },
    { "id": "2", "type": "problem", "title": "문제 정의 제목", "description": "섹션 설명" }
  ]
}

슬라이드 타입 옵션:
- cover: 표지 (임팩트 있는 첫인상)
- problem: 문제 정의 (고객의 고통점)
- solution: 솔루션 (우리의 해결책)
- product: 제품/서비스 (주요 기능)
- market: 시장 기회 (TAM/SAM/SOM)
- business-model: 비즈니스 모델 (수익 구조)
- competition: 경쟁 분석 (차별화)
- traction: 트랙션 (성과, 고객사)
- team: 팀 소개 (핵심 인력)
- roadmap: 로드맵 (향후 계획)
- financials: 재무 전망 (매출 예측)
- investment: 투자 제안 (요청 금액)
- contact: 마무리 (연락처)

투자 유치용이면 investment와 traction이 중요합니다.
JSON만 출력.`

    const response = await this.callLLM(prompt)
    return this.parseJSON<BusinessPlanOutline>(response)
  }

  /**
   * 4단계: 개별 슬라이드 생성
   */
  private async generateSlide(
    section: { id: string; type: SlideType; title: string; description: string },
    analysis: BusinessAnalysis,
    research: MarketResearch,
    index: number,
    total: number
  ): Promise<SlideContent> {
    const contentGuide = this.getContentGuideForType(section.type)

    const prompt = `당신은 IR 프레젠테이션 전문가입니다.

슬라이드 ${index}/${total} 생성:
- 타입: ${section.type}
- 제목: ${section.title}
- 설명: ${section.description}

사업 정보:
${JSON.stringify(analysis, null, 2)}

시장 정보:
${JSON.stringify(research, null, 2)}

${contentGuide}

반드시 다음 JSON 형식으로만 응답하세요:
{
  "id": "${section.id}",
  "type": "${section.type}",
  "title": "슬라이드 제목 (간결하고 임팩트 있게)",
  "subtitle": "부제목 (선택사항)",
  "content": {
    ${this.getContentSchemaForType(section.type)}
  },
  "speakerNotes": "발표자를 위한 노트 (2-3문장)",
  "imagePrompt": "이 슬라이드에 어울리는 이미지 설명 (영어로, 상세하게)"
}

핵심 원칙:
1. 한 슬라이드에 한 가지 메시지만
2. 포인트는 3-4개로 제한 (Rule of Three)
3. 구체적인 숫자와 데이터 포함
4. 모든 텍스트는 한글로

JSON만 출력.`

    const response = await this.callLLM(prompt)
    return this.parseJSON<SlideContent>(response)
  }

  /**
   * 슬라이드 타입별 콘텐츠 가이드
   */
  private getContentGuideForType(type: SlideType): string {
    const guides: Record<SlideType, string> = {
      'cover': '표지는 회사명, 슬로건, 발표자 정보를 포함합니다.',
      'problem': '고객이 겪는 구체적인 문제 3가지를 제시합니다. 통계나 사례를 포함하세요.',
      'solution': '문제를 어떻게 해결하는지 명확하게 설명합니다. before/after 비교가 효과적입니다.',
      'product': '핵심 기능 3-4가지를 아이콘과 함께 설명합니다. 스크린샷이나 데모 이미지가 좋습니다.',
      'market': 'TAM/SAM/SOM을 구체적인 금액으로 제시합니다. 성장률(CAGR)도 포함하세요.',
      'business-model': '수익 모델을 명확히 설명합니다. 가격 체계나 수익 구조 다이어그램이 효과적입니다.',
      'competition': '경쟁사 대비 우리의 차별점을 표로 정리합니다. 우리가 이기는 영역을 강조하세요.',
      'traction': '현재까지의 성과를 숫자로 보여줍니다. 매출, 사용자 수, 성장률, 고객사 로고 등.',
      'team': '핵심 팀원 3-4명의 이름, 직책, 주요 경력을 간단히 소개합니다.',
      'roadmap': '향후 1-3년 마일스톤을 타임라인으로 보여줍니다.',
      'financials': '향후 3-5년 매출 예측을 차트로 보여줍니다. 주요 가정도 포함하세요.',
      'investment': '투자 요청 금액, 사용 계획, 기대 효과를 명확히 제시합니다.',
      'contact': '연락처와 감사 인사. 투자자가 연락할 수 있도록 정보를 제공합니다.',
    }
    return guides[type] || ''
  }

  /**
   * 슬라이드 타입별 콘텐츠 스키마
   */
  private getContentSchemaForType(type: SlideType): string {
    const schemas: Record<SlideType, string> = {
      'cover': '"tagline": "슬로건", "presenter": "발표자 이름 | 직책", "date": "2024년 1월"',
      'problem': '"items": [{"icon": "warning", "title": "문제1", "description": "설명"}]',
      'solution': '"points": ["해결책 포인트1", "해결책 포인트2", "해결책 포인트3"]',
      'product': '"items": [{"icon": "feature", "title": "기능1", "description": "설명"}]',
      'market': '"metrics": [{"label": "TAM", "value": "100조원", "description": "설명"}]',
      'business-model': '"items": [{"icon": "money", "title": "수익원1", "description": "설명"}]',
      'competition': '"points": ["차별점1", "차별점2", "차별점3"]',
      'traction': '"metrics": [{"label": "MAU", "value": "10만명", "description": "전월 대비 30% 성장"}]',
      'team': '"team": [{"name": "홍길동", "role": "CEO", "background": "전 카카오 PM"}]',
      'roadmap': '"timeline": [{"date": "2024 Q1", "title": "마일스톤1", "description": "설명"}]',
      'financials': '"metrics": [{"label": "2024년 매출", "value": "10억원"}, {"label": "2025년 매출", "value": "50억원"}]',
      'investment': '"metrics": [{"label": "투자 요청", "value": "30억원"}, {"label": "기업 가치", "value": "150억원"}], "points": ["자금 사용처1", "자금 사용처2"]',
      'contact': '"points": ["이메일: contact@company.com", "전화: 02-1234-5678", "웹사이트: www.company.com"]',
    }
    return schemas[type] || '"points": ["포인트1", "포인트2", "포인트3"]'
  }

  /**
   * Claude Code CLI로 LLM 호출
   */
  private async callLLM(prompt: string): Promise<string> {
    const tempId = randomUUID()
    const promptFile = join(this.tempDir, `prompt-${tempId}.txt`)
    const outputFile = join(this.tempDir, `output-${tempId}.txt`)

    try {
      // 프롬프트를 파일로 저장
      writeFileSync(promptFile, prompt, 'utf-8')

      // Claude Code CLI 실행 (Opus 4.5)
      const result = await repoRun({
        command: `claude --model claude-opus-4-5-20251101 --print "$(cat ${promptFile})" > ${outputFile}`,
        timeout: 120000,
        cwd: this.tempDir,
      })

      // 결과 파일 읽기
      if (existsSync(outputFile)) {
        const output = readFileSync(outputFile, 'utf-8')
        this.cleanup(promptFile, outputFile)
        return output
      }

      // stdout에서 결과 추출
      if (result.stdout) {
        this.cleanup(promptFile, outputFile)
        return result.stdout
      }

      throw new Error('Claude Code CLI 응답 없음')
    } catch (error) {
      this.cleanup(promptFile, outputFile)
      throw error
    }
  }

  private cleanup(...files: string[]) {
    for (const file of files) {
      try {
        if (existsSync(file)) unlinkSync(file)
      } catch { /* ignore */ }
    }
  }

  /**
   * JSON 파싱 (에러 처리 포함)
   */
  private parseJSON<T>(text: string): T {
    // JSON 블록 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('JSON을 찾을 수 없습니다.')
    }

    try {
      return JSON.parse(jsonMatch[0]) as T
    } catch (e) {
      console.error('[BusinessPlanGenerator] JSON parse error:', text.substring(0, 500))
      throw new Error('JSON 파싱 실패')
    }
  }
}

// Export singleton
let generator: BusinessPlanGenerator | null = null

export function getBusinessPlanGenerator(): BusinessPlanGenerator {
  if (!generator) {
    generator = new BusinessPlanGenerator()
  }
  return generator
}
