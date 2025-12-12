import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { DeployedAgent } from '@/types/database'

// GET: List all deployed agents for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startupId = searchParams.get('startup_id')
    const teamId = searchParams.get('team_id')
    const status = searchParams.get('status')

    let query = (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (startupId) {
      query = query.eq('startup_id', startupId)
    }

    if (teamId) {
      query = query.eq('team_id', teamId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('에이전트 조회 오류:', error)
      // 테이블 없거나 에러 시 빈 배열 반환 (채팅 기능은 계속 작동)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('에이전트 API 오류:', error)
    // 에러 시에도 빈 배열 반환 (채팅 기능 유지)
    return NextResponse.json([])
  }
}

// POST: Deploy a new agent
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const adminClient = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      startup_id,
      team_id,
      workflow_nodes = [],
      workflow_edges = [],
      capabilities,
      avatar_url,
      system_prompt,
      model = 'gpt-4',
      temperature = 0.7,
      // 상호작용 설정
      interaction_mode = 'solo',
      llm_provider = 'openai',
      llm_model,
      speak_order = 0,
    } = body

    if (!name) {
      return NextResponse.json({ error: '에이전트 이름이 필요합니다' }, { status: 400 })
    }

    // Extract capabilities from workflow nodes (or use provided capabilities)
    const extractedCapabilities = capabilities || extractCapabilitiesFromNodes(workflow_nodes)

    // team_id를 capabilities 배열에 저장 (DB 스키마 변경 없이 팀 연결)
    const teamCapability = team_id ? [`team:${team_id}`] : []
    const allCapabilities = [...extractedCapabilities, ...teamCapability]

    const agentData: Record<string, unknown> = {
      name,
      description,
      owner_id: user.id,
      startup_id: startup_id || null,
      workflow_nodes,
      workflow_edges,
      capabilities: allCapabilities,
      status: 'ACTIVE',
      avatar_url: avatar_url || generateAvatarUrl(name),
      system_prompt: system_prompt || generateSystemPrompt(name, extractedCapabilities),
      model,
      temperature,
      // 상호작용 설정
      interaction_mode,
      llm_provider,
      llm_model: llm_model || (llm_provider === 'openai' ? 'gpt-4' : 'qwen-max'),
      speak_order,
    }

    const { data, error } = await (adminClient as any)
      .from('deployed_agents')
      .insert(agentData)
      .select()
      .single()

    if (error) {
      console.error('에이전트 배포 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('에이전트 배포 API 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// Helper: Extract capabilities from workflow nodes
function extractCapabilitiesFromNodes(nodes: Record<string, unknown>[]): string[] {
  const capabilities: string[] = []
  const nodeTypes = new Set<string>()

  for (const node of nodes) {
    const nodeType = (node.data as Record<string, unknown>)?.type as string
    if (nodeType) {
      nodeTypes.add(nodeType)
    }
  }

  // Map node types to capabilities
  const capabilityMap: Record<string, string> = {
    'llm': '텍스트 생성',
    'prompt': '프롬프트 처리',
    'router': '조건 분기',
    'tool': 'API 호출',
    'javascript': '코드 실행',
    'memory': '대화 기억',
    'rag': '문서 검색',
    'image_generation': '이미지 생성',
    'embedding': '임베딩 처리',
  }

  for (const type of Array.from(nodeTypes)) {
    if (capabilityMap[type]) {
      capabilities.push(capabilityMap[type])
    }
  }

  return capabilities
}

// Helper: Generate avatar URL
function generateAvatarUrl(name: string): string {
  const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899']
  const color = colors[Math.floor(Math.random() * colors.length)]
  const initials = name.slice(0, 2).toUpperCase()
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=128`
}

// Helper: Generate system prompt
function generateSystemPrompt(name: string, capabilities: string[]): string {
  return `당신은 "${name}"이라는 AI 에이전트입니다.

역할:
- 팀의 가상 멤버로서 업무를 수행합니다
- 다른 에이전트나 사용자와 협업합니다
- 할당된 작업을 성실히 완료합니다

보유 능력:
${capabilities.map(c => `- ${c}`).join('\n')}

지침:
1. 명확하고 간결하게 응답하세요
2. 작업 진행 상황을 투명하게 공유하세요
3. 불확실한 부분은 확인을 요청하세요
4. 다른 에이전트에게 작업을 위임받으면 최선을 다해 수행하세요`
}
