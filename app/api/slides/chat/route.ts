import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const getOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export async function POST(request: Request) {
  try {
    const { message, presentationContext, currentSlideContent, currentSlideIndex, totalSlides } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const systemPrompt = `당신은 프레젠테이션 분석 및 편집 전문 AI 어시스턴트입니다.

## 현재 사용자가 보고 있는 슬라이드 (${(currentSlideIndex || 0) + 1}번째 / 총 ${totalSlides || 0}개)
${currentSlideContent || '(현재 슬라이드 내용 없음)'}

## 전체 프레젠테이션 내용
${presentationContext || '(프레젠테이션 내용이 없습니다)'}

## 당신의 역할
1. "이 슬라이드", "현재 슬라이드", "지금 보이는 거" 등의 질문은 위의 "현재 사용자가 보고 있는 슬라이드" 내용을 기준으로 답변합니다.
2. 사용자가 슬라이드 내용에 대해 질문하면 정확하게 답변합니다.
3. 슬라이드 수정이 필요하면 구체적인 수정 방법을 안내합니다.
4. 한국어로 친절하게 응답합니다.`

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || '응답을 생성할 수 없습니다.'

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
