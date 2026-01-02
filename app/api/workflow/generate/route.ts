/**
 * AI 기반 워크플로우 생성 API
 * 사용자 지시를 분석하여 필요한 스킬을 조합한 워크플로우를 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '')

// 사용 가능한 스킬 목록
const AVAILABLE_SKILLS = [
  {
    id: 'youtube-transcript',
    name: 'YouTube 트랜스크립트',
    description: 'YouTube 영상의 자막/스크립트를 가져옵니다',
    keywords: ['유튜브', 'youtube', '영상', '비디오', '트랜스크립트', '자막'],
    endpoint: '/api/skills/youtube-transcript',
  },
  {
    id: 'web-search',
    name: '웹 검색',
    description: '인터넷에서 정보를 검색합니다 (외부 정보 검색용)',
    keywords: ['웹 검색', '인터넷 검색', '구글 검색', '조사해', 'web search', 'google search'],
    endpoint: '/api/tools/search',
  },
  {
    id: 'summarize',
    name: 'AI 요약',
    description: '긴 텍스트를 핵심 내용으로 요약합니다',
    keywords: ['요약', '정리', '핵심', 'summarize', '줄여'],
    endpoint: '/api/ai/summarize',
  },
  {
    id: 'z-image',
    name: '이미지 생성',
    description: 'AI로 이미지를 생성합니다',
    keywords: ['이미지', '그림', '그려', '생성', 'image'],
    endpoint: '/api/skills/z-image',
  },
  {
    id: 'get-emails',
    name: '이메일 조회',
    description: '받은편지함에서 이메일을 조회합니다',
    keywords: ['이메일 확인', '메일 확인', '메일 조회', '받은편지함', '읽지않은', '확인해', '읽어', '구글 메일', 'gmail', '받은 메일'],
    endpoint: '/api/tools/get-emails',
  },
  {
    id: 'send-email',
    name: '이메일 전송',
    description: '이메일을 작성하고 전송합니다',
    keywords: ['이메일 보내', '메일 보내', '메일 작성', '메일 발송', 'send email'],
    endpoint: '/api/tools/email',
  },
  {
    id: 'calendar',
    name: '캘린더 관리',
    description: '일정을 조회하거나 등록합니다',
    keywords: ['일정', '캘린더', '미팅', '회의', '약속'],
    endpoint: '/api/tools/calendar',
  },
  {
    id: 'notion-write',
    name: 'Notion 문서 작성',
    description: 'Notion에 페이지를 생성합니다',
    keywords: ['노션', 'notion', '문서', '페이지'],
    endpoint: '/api/integrations/notion',
  },
  {
    id: 'ppt-generator',
    name: 'PPT 슬라이드 생성',
    description: '젠스파크 수준의 프레젠테이션을 생성합니다 (PPTX 다운로드)',
    keywords: ['ppt', '슬라이드', '프레젠테이션', '발표자료', '파워포인트'],
    endpoint: '/api/skills/ppt-pro',
  },
  {
    id: 'file-read',
    name: '파일 읽기',
    description: '파일 내용을 읽습니다',
    keywords: ['파일', '문서', '읽어', '열어'],
    endpoint: '/api/tools/file-read',
  },
  {
    id: 'file-write',
    name: '파일 저장',
    description: '파일을 저장합니다',
    keywords: ['저장', '파일', '내보내기', 'export'],
    endpoint: '/api/tools/file-write',
  },
  {
    id: 'slack-notify',
    name: 'Slack 알림',
    description: 'Slack 채널에 메시지를 보냅니다',
    keywords: ['슬랙', 'slack', '알림', '공유'],
    endpoint: '/api/integrations/slack',
  },
  {
    id: 'data-analysis',
    name: '데이터 분석',
    description: '데이터를 분석하고 인사이트를 추출합니다',
    keywords: ['분석', '데이터', '통계', '차트', 'analysis'],
    endpoint: '/api/ai/analyze',
  },
  {
    id: 'translate',
    name: '번역',
    description: '텍스트를 다른 언어로 번역합니다',
    keywords: ['번역', '영어', '한국어', 'translate', '영문'],
    endpoint: '/api/ai/translate',
  },
]

export interface WorkflowStep {
  id: string
  name: string
  description: string
  type: 'tool' | 'api' | 'ai' | 'condition' | 'delay' | 'notify'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  skillId?: string
  endpoint?: string
  inputs?: Record<string, any>
  dependsOn?: string[]
}

export interface GeneratedWorkflow {
  title: string
  description: string
  steps: WorkflowStep[]
  estimatedTime: string
}

// 키워드 기반 스킬 매칭
function matchSkillsByKeywords(instruction: string): typeof AVAILABLE_SKILLS {
  const lowerInstruction = instruction.toLowerCase()
  return AVAILABLE_SKILLS.filter(skill =>
    skill.keywords.some(keyword => lowerInstruction.includes(keyword))
  )
}

// AI 기반 워크플로우 생성
async function generateWorkflowWithAI(
  instruction: string,
  availableSkills: typeof AVAILABLE_SKILLS
): Promise<GeneratedWorkflow> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  const skillsDescription = availableSkills.map(s =>
    `- ${s.id}: ${s.name} - ${s.description}`
  ).join('\n')

  const prompt = `당신은 업무 자동화 워크플로우 설계 전문가입니다.
사용자의 지시를 분석하여 실행 가능한 워크플로우를 설계해주세요.

사용 가능한 스킬:
${skillsDescription}

사용자 지시: "${instruction}"

다음 JSON 형식으로 워크플로우를 생성해주세요:
{
  "title": "워크플로우 제목 (20자 이내)",
  "description": "워크플로우 설명 (50자 이내)",
  "steps": [
    {
      "id": "step-1",
      "name": "단계 이름",
      "description": "단계 설명",
      "type": "tool 또는 ai 또는 api",
      "skillId": "사용할 스킬 ID (위 목록에서 선택)",
      "dependsOn": ["이전 단계 ID (있으면)"]
    }
  ],
  "estimatedTime": "예상 소요 시간 (예: 약 30초)"
}

규칙:
1. 사용 가능한 스킬만 사용하세요
2. 논리적인 순서로 단계를 배치하세요
3. 각 단계는 이전 단계의 결과를 활용할 수 있습니다
4. 마지막에는 항상 결과 정리 단계를 추가하세요 (skillId: "result-summary", type: "ai")
5. JSON만 출력하세요, 다른 텍스트 없이`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('JSON 형식을 찾을 수 없습니다')
    }

    const workflow = JSON.parse(jsonMatch[0]) as GeneratedWorkflow

    // 단계에 기본값 추가
    workflow.steps = workflow.steps.map((step, index) => ({
      ...step,
      id: step.id || `step-${index + 1}`,
      status: 'pending' as const,
      endpoint: AVAILABLE_SKILLS.find(s => s.id === step.skillId)?.endpoint,
    }))

    return workflow
  } catch (error) {
    console.error('[WorkflowGenerator] AI 생성 실패:', error)
    throw error
  }
}

// 키워드 기반 폴백 워크플로우 생성
function generateFallbackWorkflow(
  instruction: string,
  matchedSkills: typeof AVAILABLE_SKILLS
): GeneratedWorkflow {
  const steps: WorkflowStep[] = [
    {
      id: 'step-1',
      name: '업무 분석',
      description: '지시 내용을 분석합니다',
      type: 'ai',
      status: 'pending',
    },
  ]

  matchedSkills.forEach((skill, index) => {
    steps.push({
      id: `step-${index + 2}`,
      name: skill.name,
      description: skill.description,
      type: 'tool',
      status: 'pending',
      skillId: skill.id,
      endpoint: skill.endpoint,
      dependsOn: [`step-${index + 1}`],
    })
  })

  steps.push({
    id: `step-${steps.length + 1}`,
    name: '결과 정리',
    description: '실행 결과를 정리하여 보고합니다',
    type: 'ai',
    status: 'pending',
    skillId: 'result-summary',
    dependsOn: [`step-${steps.length}`],
  })

  return {
    title: instruction.substring(0, 20) + (instruction.length > 20 ? '...' : ''),
    description: `${matchedSkills.length}개 스킬을 조합한 워크플로우`,
    steps,
    estimatedTime: `약 ${matchedSkills.length * 5 + 10}초`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { instruction, useAI = true } = await request.json()

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: '지시 내용이 필요합니다' },
        { status: 400 }
      )
    }

    // 1. 키워드 기반 스킬 매칭
    const matchedSkills = matchSkillsByKeywords(instruction)

    // 스킬이 매칭되지 않으면 기본 스킬 추가
    const skillsToUse = matchedSkills.length > 0
      ? matchedSkills
      : AVAILABLE_SKILLS.filter(s => ['web-search', 'summarize'].includes(s.id))

    let workflow: GeneratedWorkflow

    // 2. AI 기반 워크플로우 생성 (옵션)
    if (useAI && process.env.GOOGLE_GEMINI_API_KEY) {
      try {
        workflow = await generateWorkflowWithAI(instruction, skillsToUse)
      } catch {
        // AI 실패 시 폴백
        workflow = generateFallbackWorkflow(instruction, skillsToUse)
      }
    } else {
      workflow = generateFallbackWorkflow(instruction, skillsToUse)
    }

    return NextResponse.json({
      success: true,
      workflow,
      matchedSkills: skillsToUse.map(s => ({ id: s.id, name: s.name })),
    })
  } catch (error: any) {
    console.error('[WorkflowGenerator] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '워크플로우 생성 실패' },
      { status: 500 }
    )
  }
}

// GET - 사용 가능한 스킬 목록 조회
export async function GET() {
  return NextResponse.json({
    success: true,
    skills: AVAILABLE_SKILLS.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      keywords: s.keywords,
    })),
  })
}
