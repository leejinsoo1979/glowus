/**
 * Research Service - 사업계획서 심층 리서치 서비스
 *
 * 1. 입력 내용 분석
 * 2. 심층 리서치 문서 생성
 * 3. 사업계획서 목차/구조 구성
 * 4. 슬라이드 콘텐츠 생성
 */

import { repoRun } from '@/lib/neural-map/tools/terminal-tools'
import { randomUUID } from 'crypto'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

// 리서치 결과 타입
export interface ResearchResult {
  // 1단계: 분석
  analysis: {
    businessType: string      // 사업 유형 (IT, 카페, 제조업 등)
    targetMarket: string      // 목표 시장
    coreValue: string         // 핵심 가치
    competitors: string[]     // 경쟁사
    uniquePoints: string[]    // 차별화 포인트
  }

  // 2단계: 리서치 문서
  research: {
    marketSize: string        // 시장 규모
    marketTrend: string       // 시장 트렌드
    targetCustomer: string    // 목표 고객
    problemStatement: string  // 문제 정의
    solutionOverview: string  // 솔루션 개요
    businessModel: string     // 비즈니스 모델
    revenueStream: string     // 수익 구조
    competitiveAdvantage: string // 경쟁 우위
  }

  // 3단계: 사업계획서 구조
  outline: {
    title: string
    sections: {
      id: string
      name: string
      description: string
      keyPoints: string[]
    }[]
  }

  // 4단계: 슬라이드 콘텐츠
  slides: SlideData[]
}

export interface SlideData {
  slideNumber: number
  type: string
  title: string
  subtitle?: string
  content: string[]
  notes?: string
  layout: 'title' | 'content' | 'two-column' | 'image-right' | 'data-grid' | 'conclusion'
}

/**
 * 콘텐츠 심층 분석 및 리서치
 */
export async function generateResearchAndSlides(
  input: string,
  slideCount: number = 15,
  onProgress?: (step: string, detail: string) => void
): Promise<ResearchResult> {
  const tempId = randomUUID()
  const outputFile = join('/tmp', `research-${tempId}.json`)

  onProgress?.('분석 시작', '입력 내용을 분석하고 있습니다...')

  const prompt = `당신은 대한민국 최고의 IR 컨설턴트이자 사업계획서 전문가입니다.
다음 내용을 분석하여 투자자를 위한 완벽한 사업계획서를 작성해주세요.

=== 입력 내용 ===
${input.substring(0, 8000)}
=================

다음 JSON 형식으로 ${outputFile}에 저장해주세요:

{
  "analysis": {
    "businessType": "사업 유형 (예: AI 기반 B2B SaaS)",
    "targetMarket": "목표 시장 (예: 국내 중소기업 HR 시장)",
    "coreValue": "핵심 가치 제안",
    "competitors": ["경쟁사1", "경쟁사2", "경쟁사3"],
    "uniquePoints": ["차별점1", "차별점2", "차별점3"]
  },
  "research": {
    "marketSize": "시장 규모 (TAM/SAM/SOM 포함, 구체적 숫자)",
    "marketTrend": "시장 동향 및 성장률",
    "targetCustomer": "목표 고객 페르소나",
    "problemStatement": "고객이 겪는 핵심 문제 (구체적으로)",
    "solutionOverview": "우리 솔루션이 문제를 해결하는 방법",
    "businessModel": "비즈니스 모델 설명",
    "revenueStream": "수익 구조 (가격, 과금 방식)",
    "competitiveAdvantage": "지속 가능한 경쟁 우위"
  },
  "outline": {
    "title": "프레젠테이션 제목",
    "sections": [
      {
        "id": "cover",
        "name": "표지",
        "description": "첫인상을 결정짓는 표지",
        "keyPoints": ["회사명", "슬로건", "발표자"]
      }
    ]
  },
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "슬라이드 제목",
      "subtitle": "부제목",
      "content": ["핵심 포인트 1", "핵심 포인트 2"],
      "notes": "발표자 노트",
      "layout": "title"
    }
  ]
}

### 슬라이드 구성 규칙 ###

1. **총 ${slideCount}장** 슬라이드 생성
2. **모든 텍스트는 한글로** 작성 (영어 약어 제외)
3. 각 슬라이드는 **핵심 메시지 1개**에 집중
4. 포인트는 **3-4개**로 제한 (Rule of Three)
5. 숫자와 데이터는 **구체적으로** (예: "약 30%" → "32.5%")

### 필수 슬라이드 순서 ###

1. 표지 (cover) - 임팩트 있는 첫인상
2. 문제 정의 (problem) - 고객의 고통점
3. 솔루션 (solution) - 우리의 해결책
4. 제품/서비스 (product) - 주요 기능과 특징
5. 시장 기회 (market) - TAM/SAM/SOM
6. 비즈니스 모델 (business-model) - 수익 구조
7. 경쟁 분석 (competition) - 차별화 포인트
8. 팀 소개 (team) - 핵심 인력
9. 로드맵 (roadmap) - 향후 계획
10. 재무 전망 (financials) - 매출/비용 예측
11. 투자 제안 (investment) - 투자 요청
12. 마무리 (contact) - 연락처

### 레이아웃 가이드 ###

- title: 표지, 섹션 구분용
- content: 일반 내용 (포인트 나열)
- two-column: 비교, 장단점
- image-right: 제품 스크린샷, 다이어그램 설명
- data-grid: 시장 규모, 재무 데이터
- conclusion: 마무리, 투자 제안

반드시 유효한 JSON만 파일에 저장하세요. 설명이나 다른 텍스트는 제외하세요.`

  try {
    // Claude Code CLI 실행
    const claudeCommand = `claude --print "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/`/g, '\\`')}" > ${outputFile}`

    onProgress?.('리서치 진행', 'AI가 심층 분석 중입니다...')

    const result = await repoRun({
      command: claudeCommand,
      timeout: 180000, // 3분
      cwd: '/tmp',
    })

    // 결과 파일 확인
    if (existsSync(outputFile)) {
      const outputContent = readFileSync(outputFile, 'utf-8')
      const jsonMatch = outputContent.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const research = JSON.parse(jsonMatch[0]) as ResearchResult
        cleanup(outputFile)
        onProgress?.('완료', '리서치 및 슬라이드 생성 완료')
        return research
      }
    }

    // stdout에서 추출 시도
    if (result.stdout) {
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const research = JSON.parse(jsonMatch[0]) as ResearchResult
        cleanup(outputFile)
        return research
      }
    }

    // Fallback to OpenAI
    console.log('[ResearchService] Claude Code failed, using OpenAI fallback...')
    cleanup(outputFile)
    return await generateResearchWithOpenAI(input, slideCount, onProgress)

  } catch (error) {
    console.error('[ResearchService] Error:', error)
    cleanup(outputFile)
    return await generateResearchWithOpenAI(input, slideCount, onProgress)
  }
}

/**
 * OpenAI Fallback
 */
async function generateResearchWithOpenAI(
  input: string,
  slideCount: number,
  onProgress?: (step: string, detail: string) => void
): Promise<ResearchResult> {
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')
  }

  onProgress?.('분석 진행', 'OpenAI로 심층 분석 중...')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `당신은 대한민국 최고의 IR 컨설턴트입니다.
투자자를 설득하는 사업계획서를 작성합니다.
모든 텍스트는 반드시 한글로 작성하세요.
JSON 형식으로만 응답하세요.`
      },
      {
        role: 'user',
        content: `다음 내용을 분석하여 ${slideCount}장의 IR 사업계획서를 작성하세요.

입력: ${input.substring(0, 6000)}

JSON 형식:
{
  "analysis": {
    "businessType": "사업 유형",
    "targetMarket": "목표 시장",
    "coreValue": "핵심 가치",
    "competitors": ["경쟁사1", "경쟁사2"],
    "uniquePoints": ["차별점1", "차별점2"]
  },
  "research": {
    "marketSize": "시장 규모 (TAM 100조원, SAM 10조원, SOM 1조원 형식)",
    "marketTrend": "시장 트렌드",
    "targetCustomer": "목표 고객",
    "problemStatement": "문제 정의",
    "solutionOverview": "솔루션 개요",
    "businessModel": "비즈니스 모델",
    "revenueStream": "수익 구조",
    "competitiveAdvantage": "경쟁 우위"
  },
  "outline": {
    "title": "프레젠테이션 제목",
    "sections": [{"id": "cover", "name": "표지", "description": "설명", "keyPoints": ["포인트"]}]
  },
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "제목",
      "subtitle": "부제목",
      "content": ["포인트1", "포인트2", "포인트3"],
      "layout": "title"
    }
  ]
}

### 슬라이드 구성 (총 ${slideCount}장) ###
1. 표지 - 임팩트 있는 첫인상
2. 문제 정의 - 고객의 고통점
3. 솔루션 - 우리의 해결책
4. 제품/서비스 - 주요 기능
5. 시장 기회 - TAM/SAM/SOM
6. 비즈니스 모델 - 수익 구조
7. 경쟁 분석 - 차별화
8. 팀 소개 - 핵심 인력
9. 로드맵 - 향후 계획
10. 재무 전망 - 매출 예측
11. 투자 제안 - 요청 금액
12. 마무리 - 연락처

모든 텍스트는 한글로 작성하세요.`
      }
    ],
    temperature: 0.7,
    max_tokens: 8000,
  })

  const text = response.choices[0]?.message?.content || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('리서치 결과 파싱 실패')
  }

  onProgress?.('완료', '리서치 완료')
  return JSON.parse(jsonMatch[0]) as ResearchResult
}

/**
 * 임시 파일 정리
 */
function cleanup(...files: string[]) {
  for (const file of files) {
    try {
      if (existsSync(file)) unlinkSync(file)
    } catch { /* ignore */ }
  }
}
