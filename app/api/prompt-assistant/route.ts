/**
 * Prompt Assistant API
 * 사용자의 불명확한 입력을 최적화된 프롬프트로 변환
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 프롬프트 최적화 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 사용자의 불명확한 요청을 명확하고 구체적인 프롬프트로 변환하는 전문가입니다.

**역할**:
- 사용자의 의도를 정확히 파악
- 모호한 표현을 구체적으로 변환
- 필요한 세부사항 추가
- 실행 가능한 명령으로 최적화

**변환 규칙**:
1. 짧고 모호한 입력 → 구체적이고 명확한 프롬프트
2. 누락된 정보 → 합리적인 기본값 추가
3. 비즈니스 컨텍스트 고려 (HR, 재무, 프로젝트 관리 등)
4. 한국어로 자연스럽게 표현

**출력 형식**:
- 최적화된 프롬프트만 출력
- 설명이나 부연 없이 프롬프트 텍스트만 반환
- 존댓말 사용

**예시**:
입력: "직원 뭐"
출력: "전체 직원 목록을 조회하고 부서별로 정리해서 보여주세요."

입력: "돈 얼마"
출력: "이번 달 수입과 지출 내역을 조회하고, 카테고리별 합계와 순이익을 정리해서 보여주세요."

입력: "할일 만들어"
출력: "새로운 태스크를 생성해주세요. 제목, 우선순위, 담당자, 마감일을 지정할 수 있습니다."

입력: "보고서"
출력: "오늘의 업무 현황을 분석하고 일일 요약 보고서를 생성해주세요."

입력: "워크플로우 실행"
출력: "등록된 워크플로우 목록을 보여주고, 실행할 워크플로우를 선택할 수 있게 해주세요."
`

export async function POST(request: NextRequest) {
  try {
    const { input, context } = await request.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { success: false, error: '입력이 필요합니다' },
        { status: 400 }
      )
    }

    // 입력이 이미 충분히 명확한 경우 (긴 문장) 그대로 반환
    if (input.length > 50 && input.includes(' ')) {
      return NextResponse.json({
        success: true,
        original: input,
        optimized: input,
        isAlreadyClear: true,
        message: '입력이 이미 충분히 명확합니다.',
      })
    }

    // 컨텍스트 정보 추가
    let contextInfo = ''
    if (context) {
      if (context.agentName) {
        contextInfo += `\n현재 대화 중인 에이전트: ${context.agentName}`
      }
      if (context.agentDescription) {
        contextInfo += `\n에이전트 역할: ${context.agentDescription}`
      }
      if (context.recentMessages && context.recentMessages.length > 0) {
        contextInfo += `\n최근 대화 주제: ${context.recentMessages.slice(-3).map((m: any) => m.content?.substring(0, 50)).join(', ')}`
      }
    }

    const userMessage = contextInfo
      ? `${input}\n\n[컨텍스트]${contextInfo}`
      : input

    // GPT로 프롬프트 최적화
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 300,
      temperature: 0.3,
    })

    const optimizedPrompt = completion.choices[0]?.message?.content?.trim()

    if (!optimizedPrompt) {
      return NextResponse.json({
        success: true,
        original: input,
        optimized: input,
        isAlreadyClear: true,
        message: '프롬프트 생성에 실패했습니다. 원본을 사용합니다.',
      })
    }

    // 제안 옵션들 생성 (다양한 버전)
    const suggestionsCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `사용자 입력: "${input}"

이 입력에 대해 3가지 다른 버전의 프롬프트를 생성하세요.
각 버전은 다른 관점이나 세부사항을 강조해야 합니다.

JSON 형식으로만 출력:
{
  "suggestions": [
    "첫 번째 버전 프롬프트",
    "두 번째 버전 프롬프트",
    "세 번째 버전 프롬프트"
  ]
}`
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    let suggestions: string[] = []
    try {
      const suggestionsData = JSON.parse(suggestionsCompletion.choices[0]?.message?.content || '{}')
      suggestions = suggestionsData.suggestions || []
    } catch {
      suggestions = []
    }

    return NextResponse.json({
      success: true,
      original: input,
      optimized: optimizedPrompt,
      suggestions,
      isAlreadyClear: false,
      message: '프롬프트가 최적화되었습니다.',
    })

  } catch (error: any) {
    console.error('[Prompt Assistant] Error:', error)

    // API 키 없거나 오류 시 간단한 룰 기반 변환
    const input = (await request.clone().json()).input || ''
    const fallbackPrompt = generateFallbackPrompt(input)

    return NextResponse.json({
      success: true,
      original: input,
      optimized: fallbackPrompt,
      suggestions: [],
      isAlreadyClear: false,
      message: '간단 모드로 최적화되었습니다.',
      fallback: true,
    })
  }
}

/**
 * AI 없이 간단한 규칙 기반 프롬프트 생성
 */
function generateFallbackPrompt(input: string): string {
  const lowerInput = input.toLowerCase()

  // 키워드 기반 매핑
  const mappings: Record<string, string> = {
    '직원': '전체 직원 목록을 조회하고 정리해서 보여주세요.',
    '거래': '최근 거래 내역을 조회하고 요약해서 보여주세요.',
    '수입': '이번 달 수입 내역을 조회하고 카테고리별로 정리해주세요.',
    '지출': '이번 달 지출 내역을 조회하고 카테고리별로 정리해주세요.',
    '태스크': '현재 진행 중인 태스크 목록을 보여주세요.',
    '할일': '오늘의 할 일 목록을 정리해서 보여주세요.',
    '보고서': '업무 현황을 분석하고 보고서를 생성해주세요.',
    '워크플로우': '사용 가능한 워크플로우 목록을 보여주세요.',
    '일정': '이번 주 일정을 조회해서 보여주세요.',
    '캘린더': '캘린더에 등록된 일정을 보여주세요.',
    '이미지': '요청하신 내용으로 이미지를 생성해드릴까요?',
    '만들어': '무엇을 만들어 드릴까요? 자세한 내용을 알려주세요.',
    '조회': '조회할 데이터의 종류를 알려주세요. (직원, 거래, 태스크 등)',
    '분석': '분석할 데이터나 주제를 알려주세요.',
    '예산': '예산 현황을 조회하고 지출 대비 예산 사용률을 분석해주세요.',
    '회사': '회사 정보를 조회해서 보여주세요.',
  }

  // 키워드 매칭
  for (const [keyword, prompt] of Object.entries(mappings)) {
    if (lowerInput.includes(keyword)) {
      return prompt
    }
  }

  // 매칭되는 키워드 없으면 기본 안내
  return `"${input}"에 대해 무엇을 도와드릴까요? 좀 더 자세히 설명해주시면 더 정확하게 도움을 드릴 수 있습니다.`
}
