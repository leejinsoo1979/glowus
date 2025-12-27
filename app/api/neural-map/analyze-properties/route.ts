export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getOpenAI, AIResponse } from '@/lib/ai/openai'

// 추천 Property 타입
interface RecommendedProperty {
  key: string
  value: unknown
  type: 'text' | 'number' | 'checkbox' | 'date' | 'datetime' | 'tags' | 'list' | 'link' | 'select'
  confidence: number // 0-1
  reason: string
}

interface AnalysisResult {
  properties: RecommendedProperty[]
  summary: string
  relatedTopics: string[]
}

const ANALYZE_PROMPT = `당신은 노트/문서 분석 전문가입니다. 주어진 마크다운 내용을 분석하여 적절한 메타데이터(Properties)를 추천해주세요.

분석 기준:
1. 문서 유형 감지 (회의록, 일지, 아이디어, 프로젝트, 인물, 장소 등)
2. 핵심 개체 추출 (인물, 조직, 날짜, 장소, 개념 등)
3. 관계 파악 (다른 문서와의 연결고리)
4. 상태/진행도 파악 (해당되는 경우)

Property 타입 설명:
- text: 단순 텍스트
- number: 숫자 값
- checkbox: 불리언 (완료/미완료 등)
- date: 날짜 (YYYY-MM-DD)
- datetime: 날짜+시간
- tags: 태그 배열
- list: 문자열 배열
- link: [[문서명]] 형태의 위키 링크
- select: 선택 옵션

응답 형식 (JSON):
{
  "properties": [
    {
      "key": "property_name",
      "value": "property_value",
      "type": "property_type",
      "confidence": 0.9,
      "reason": "추천 이유"
    }
  ],
  "summary": "문서 요약 (1-2문장)",
  "relatedTopics": ["관련_주제1", "관련_주제2"]
}

주의사항:
- 한국어 문서는 한국어로 응답
- confidence는 0.7 이상인 것만 추천
- 최소 3개, 최대 10개의 properties 추천
- 실용적이고 검색/필터링에 유용한 속성 위주로`

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content, existingProperties } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // 내용이 너무 짧으면 분석 불가
    if (content.trim().length < 50) {
      return NextResponse.json({
        error: 'Content too short for analysis',
        minLength: 50
      }, { status: 400 })
    }

    const openai = getOpenAI()

    // 기존 properties 정보 포함
    const existingInfo = existingProperties && Object.keys(existingProperties).length > 0
      ? `\n\n기존 Properties:\n${JSON.stringify(existingProperties, null, 2)}`
      : ''

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: ANALYZE_PROMPT },
        {
          role: 'user',
          content: `다음 문서를 분석해주세요:\n\n${content.slice(0, 4000)}${existingInfo}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    })

    const resultText = response.choices[0]?.message?.content
    if (!resultText) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    let result: AnalysisResult
    try {
      result = JSON.parse(resultText)
    } catch (e) {
      console.error('Failed to parse AI response:', resultText)
      return NextResponse.json({ error: 'Invalid AI response format' }, { status: 500 })
    }

    // confidence 0.7 이상만 필터링
    result.properties = result.properties.filter(p => p.confidence >= 0.7)

    // 기존 properties와 중복 제거
    if (existingProperties) {
      result.properties = result.properties.filter(
        p => !(p.key in existingProperties)
      )
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('AI analyze properties error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
