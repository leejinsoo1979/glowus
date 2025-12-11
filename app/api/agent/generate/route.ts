import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createAgentNode } from '@/lib/agent'
import type { AgentType } from '@/lib/agent'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 노드 타입 정의
const NODE_TYPES = {
  start: '워크플로우 시작점',
  end: '워크플로우 종료점',
  prompt: '프롬프트/시스템 메시지 정의',
  llm: 'LLM 텍스트 생성 (GPT-4, Claude 등)',
  router: '조건 분기 (if/else 로직)',
  tool: 'HTTP API 호출',
  javascript: 'JavaScript 코드 실행',
  memory: '대화 기록 저장',
  rag: 'RAG 검색 (문서 검색)',
  image_generation: '이미지 생성',
  embedding: '텍스트 임베딩',
}

const SYSTEM_PROMPT = `당신은 AI 에이전트 워크플로우 설계 전문가입니다.
사용자의 설명을 분석하여 최적의 노드 구성을 JSON으로 반환합니다.

사용 가능한 노드 타입:
${Object.entries(NODE_TYPES).map(([type, desc]) => `- ${type}: ${desc}`).join('\n')}

규칙:
1. 항상 'start' 노드로 시작하고 'end' 노드로 끝나야 함
2. 노드들은 논리적 순서로 연결되어야 함
3. 각 노드에는 적절한 label과 config를 설정
4. 복잡한 로직은 router 노드로 분기 처리
5. 외부 API 호출이 필요하면 tool 노드 사용
6. 대화형이면 memory 노드 추가
7. 문서 검색이 필요하면 rag 노드 사용

JSON 형식으로만 응답하세요:
{
  "nodes": [
    {
      "type": "노드타입",
      "label": "노드 이름",
      "config": { "설정키": "설정값" }
    }
  ],
  "connections": [
    { "from": 0, "to": 1 }  // 노드 인덱스 기반 연결
  ]
}

예시 - "고객 문의 자동 응답":
{
  "nodes": [
    { "type": "start", "label": "시작" },
    { "type": "prompt", "label": "시스템 프롬프트", "config": { "systemPrompt": "고객 서비스 AI입니다. 친절하게 응답하세요." } },
    { "type": "llm", "label": "응답 생성", "config": { "model": "gpt-4", "temperature": 0.7 } },
    { "type": "end", "label": "종료" }
  ],
  "connections": [
    { "from": 0, "to": 1 },
    { "from": 1, "to": 2 },
    { "from": 2, "to": 3 }
  ]
}`

export async function POST(request: NextRequest) {
  try {
    const { name, description } = await request.json()

    if (!description) {
      return NextResponse.json(
        { error: '설명이 필요합니다' },
        { status: 400 }
      )
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `에이전트 이름: ${name}\n설명: ${description}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('AI 응답이 없습니다')
    }

    const parsed = JSON.parse(content)

    // 노드 생성 (위치 자동 계산)
    const nodes = parsed.nodes.map((node: { type: string; label: string; config?: Record<string, unknown> }, index: number) => {
      const xPos = 100 + (index * 220)
      const yPos = 200 + (Math.sin(index * 0.5) * 50) // 약간의 곡선 배치

      const agentNode = createAgentNode({
        type: node.type as AgentType,
        position: { x: xPos, y: yPos }
      })

      // 라벨과 설정 적용
      if (node.label) {
        agentNode.data.label = node.label
      }
      if (node.config) {
        Object.assign(agentNode.data, node.config)
      }

      return agentNode
    })

    // 엣지 생성
    const edges = parsed.connections.map((conn: { from: number; to: number }, index: number) => ({
      id: `e-${nodes[conn.from].id}-${nodes[conn.to].id}`,
      source: nodes[conn.from].id,
      target: nodes[conn.to].id,
      type: 'default',
      animated: false,
      style: { stroke: 'var(--edge-color)', strokeWidth: 1.5 }
    }))

    return NextResponse.json({ nodes, edges })
  } catch (error) {
    console.error('AI 생성 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 생성 실패' },
      { status: 500 }
    )
  }
}
