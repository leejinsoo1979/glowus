import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization
let genAI: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not configured')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

interface Source {
  id: string
  type: 'pdf' | 'web' | 'youtube' | 'text'
  title: string
  content?: string
  summary?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: Request) {
  try {
    const { message, sources, history } = await req.json() as {
      message: string
      sources: Source[]
      history: ChatMessage[]
    }

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다' }, { status: 400 })
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({ error: '소스가 필요합니다' }, { status: 400 })
    }

    // Build context from sources
    const sourceContext = sources.map((s, i) => {
      const content = s.content || s.summary || ''
      return `
[소스 ${i + 1}: ${s.title}]
타입: ${s.type}
내용:
${content.slice(0, 10000)}
---`
    }).join('\n')

    // Build conversation history
    const historyContext = history.map(h =>
      `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`
    ).join('\n')

    // Use Gemini for RAG-based response
    const client = getGeminiClient()
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    })

    const prompt = `당신은 사용자가 업로드한 문서들을 기반으로 질문에 답변하는 AI 어시스턴트입니다.

## 소스 문서들
${sourceContext}

## 이전 대화
${historyContext || '(없음)'}

## 지침
1. 위의 소스 문서들을 참고하여 사용자의 질문에 답변해주세요.
2. 답변은 소스의 내용을 기반으로 하되, 자연스럽게 정리해주세요.
3. 소스에 없는 내용은 추측하지 말고, 해당 정보가 소스에 없다고 알려주세요.
4. 가능하면 어떤 소스에서 정보를 찾았는지 언급해주세요.
5. 한국어로 답변해주세요.

## 사용자 질문
${message}

## 답변`

    const result = await model.generateContent(prompt)
    const responseText = await result.response.text()

    // Find which sources were referenced
    const referencedSources: string[] = []
    sources.forEach(s => {
      if (responseText.toLowerCase().includes(s.title.toLowerCase().slice(0, 20))) {
        referencedSources.push(s.title)
      }
    })

    return NextResponse.json({
      success: true,
      response: responseText,
      sources: referencedSources.length > 0 ? referencedSources : undefined
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: '응답 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
