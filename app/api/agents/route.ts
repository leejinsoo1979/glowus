export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { initializeAgentIdentity } from '@/lib/agents/chat-integration'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import type { DeployedAgent } from '@/types/database'

// GET: List all deployed agents for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startupId = searchParams.get('startup_id')
    const teamId = searchParams.get('team_id')
    const status = searchParams.get('status')
    const projectId = searchParams.get('project_id')  // 🆕 프로젝트 필터

    // 🆕 프로젝트로 필터링하는 경우: Neural Map 노드에서 에이전트 ID 조회
    if (projectId) {
      try {
        // 1. 프로젝트의 Neural Map 찾기 (project_id로 먼저, 없으면 프로젝트명으로)
        let neuralMap: { id: string } | null = null

        // 1-1. project_id로 찾기
        const { data: mapByProjectId } = await (adminClient as any)
          .from('neural_maps')
          .select('id')
          .eq('project_id', projectId)
          .limit(1)

        if (mapByProjectId && mapByProjectId.length > 0) {
          neuralMap = mapByProjectId[0]
        }

        // 1-2. project_id로 못 찾으면 프로젝트명으로 찾기
        if (!neuralMap) {
          const { data: project } = await (adminClient as any)
            .from('projects')
            .select('name')
            .eq('id', projectId)
            .single()

          if (project) {
            const { data: mapByTitle } = await (adminClient as any)
              .from('neural_maps')
              .select('id')
              .eq('title', project.name)
              .order('created_at', { ascending: false })
              .limit(1)

            if (mapByTitle && mapByTitle.length > 0) {
              neuralMap = mapByTitle[0]
              console.log('[API] Found neural map by title:', project.name)
            }
          }
        }

        if (!neuralMap) {
          console.log('[API] No neural map for project:', projectId)
          return NextResponse.json([])
        }

        // 2. 해당 맵에서 에이전트 노드 찾기 (sourceRef.isAgent = true)
        const { data: agentNodes } = await (adminClient as any)
          .from('neural_nodes')
          .select('source_ref')
          .eq('map_id', neuralMap.id)

        // sourceRef에서 agentId 추출
        const agentIds = (agentNodes || [])
          .filter((n: any) => n.source_ref?.isAgent === true && n.source_ref?.agentId)
          .map((n: any) => n.source_ref.agentId)

        if (agentIds.length === 0) {
          console.log('[API] No agents in project neural map:', projectId)
          return NextResponse.json([])
        }

        // 3. 해당 에이전트 정보 조회
        const { data: agents, error } = await (adminClient as any)
          .from('deployed_agents')
          .select('*')
          .in('id', agentIds)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('[API] Error fetching project agents:', error)
          return NextResponse.json([])
        }

        console.log('[API] Loaded project agents:', agents?.length || 0, 'for project:', projectId)
        return NextResponse.json(agents || [])
      } catch (err) {
        console.error('[API] Project agent query error:', err)
        return NextResponse.json([])
      }
    }

    // 사용자가 속한 팀 목록 조회
    const { data: userTeams } = await (adminClient as any)
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)

    // 사용자가 소유한 팀 조회
    const { data: ownedTeams } = await (adminClient as any)
      .from('teams')
      .select('id')
      .eq('founder_id', user.id)

    // 팀 ID 목록 생성
    const teamIds = [
      ...(userTeams?.map((t: any) => t.team_id) || []),
      ...(ownedTeams?.map((t: any) => t.id) || []),
    ]

    // 조건 1: 사용자가 소유한 에이전트
    let query = (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .order('created_at', { ascending: false })

    // 개발 모드에서는 모든 에이전트 조회
    if (isDevMode()) {
      // DEV 모드: 필터 없이 모든 에이전트 조회
    } else {
      // 프로덕션: owner_id로 필터
      query = query.eq('owner_id', user.id)
    }

    if (startupId) {
      query = query.eq('startup_id', startupId)
    }

    if (teamId) {
      // 특정 팀 필터
      query = query.contains('capabilities', [`team:${teamId}`])
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
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 개발 모드: DEV_USER 사용
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      startup_id,
      team_id,
      project_id,  // 🆕 프로젝트 연결
      workflow_nodes = [],
      workflow_edges = [],
      capabilities,
      avatar_url,
      system_prompt,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      // 상호작용 설정
      interaction_mode = 'solo',
      llm_provider = 'openai',
      llm_model,
      speak_order = 0,
      // Super Agent 추가 필드
      voice_settings,
      chat_main_gif,
      emotion_avatars,
      permissions,
      agent_type,
      user_title,  // 🆕 사용자 호칭
      status = 'ACTIVE',
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
      status,
      avatar_url: avatar_url || generateAvatarUrl(name),
      system_prompt: system_prompt || generateSystemPrompt(name, extractedCapabilities),
      model,
      temperature,
      // 상호작용 설정
      interaction_mode,
      llm_provider,
      llm_model: llm_model || (llm_provider === 'openai' ? 'gpt-4o-mini' : 'qwen-max'),
      speak_order,
      // Super Agent 추가 필드
      ...(voice_settings && { voice_settings }),
      ...(chat_main_gif && { chat_main_gif }),
      ...(emotion_avatars && { emotion_avatars }),
      ...(permissions && { permissions }),
      ...(agent_type && { agent_type }),
      ...(user_title && { user_title }),  // 🆕 사용자 호칭
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

    // 에이전트 정체성 초기화 (메모리 시스템)
    try {
      await initializeAgentIdentity(
        adminClient,
        data.id,
        data.name,
        data.description || '',
        data.system_prompt || ''
      )
    } catch (identityError) {
      console.error('에이전트 정체성 초기화 실패:', identityError)
      // 정체성 초기화 실패해도 에이전트 생성은 성공
    }

    // 🆕 프로젝트에 연결된 경우 Neural Map에 에이전트 노드 추가
    if (project_id) {
      try {
        // 프로젝트의 Neural Map 찾기
        let neuralMap: { id: string; root_node_id: string | null } | null = null

        // 1. 먼저 프로젝트 정보 조회
        const { data: project } = await (adminClient as any)
          .from('projects')
          .select('name')
          .eq('id', project_id)
          .single()

        console.log('[Agent] Project lookup:', { project_id, project })

        if (project) {
          // 2. project_id로 먼저 찾기 (에러 무시)
          const mapByProjectResult = await (adminClient as any)
            .from('neural_maps')
            .select('id, root_node_id')
            .eq('project_id', project_id)
            .limit(1)

          console.log('[Agent] Map by project_id:', mapByProjectResult)

          if (mapByProjectResult.data && mapByProjectResult.data.length > 0) {
            neuralMap = mapByProjectResult.data[0]
          }

          // 3. project_id로 못 찾으면 title로 찾기
          if (!neuralMap) {
            const mapByTitleResult = await (adminClient as any)
              .from('neural_maps')
              .select('id, root_node_id')
              .eq('title', project.name)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)

            console.log('[Agent] Map by title:', mapByTitleResult)

            if (mapByTitleResult.data && mapByTitleResult.data.length > 0) {
              neuralMap = mapByTitleResult.data[0]
            }
          }
        }

        console.log('[Agent] Found neuralMap:', neuralMap)

        if (neuralMap) {
          // 에이전트 노드 생성
          // Note: 'agent' 타입은 DB 제약 조건에 없어서 'person' 타입 사용
          // TODO: Supabase 대시보드에서 제약 조건 업데이트 필요
          // ALTER TABLE neural_nodes DROP CONSTRAINT neural_nodes_type_check;
          // ALTER TABLE neural_nodes ADD CONSTRAINT neural_nodes_type_check CHECK (type IN ('self', 'concept', 'project', 'doc', 'idea', 'decision', 'memory', 'task', 'person', 'insight', 'folder', 'file', 'agent'));
          const nodeResult = await (adminClient as any)
            .from('neural_nodes')
            .insert({
              map_id: neuralMap.id,
              type: 'person',  // 임시: 'agent' 대신 'person' 사용
              title: data.name,
              summary: data.description || null,
              importance: 7,
              expanded: false,
              pinned: false,
              position: { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50, z: 0 },
              source_ref: { agentId: data.id, isAgent: true },  // 에이전트 표시
            })
            .select()
            .single()

          console.log('[Agent] Node insert result:', nodeResult)

          const agentNode = nodeResult.data
          if (nodeResult.error) {
            console.error('[Agent] Node insert error:', nodeResult.error)
          }

          // 프로젝트 루트 노드와 연결하는 엣지 생성
          if (agentNode && neuralMap.root_node_id) {
            const edgeResult = await (adminClient as any)
              .from('neural_edges')
              .insert({
                map_id: neuralMap.id,
                source_id: neuralMap.root_node_id,
                target_id: agentNode.id,
                type: 'parent_child',
                weight: 1,
              })

            console.log('[Agent] Edge insert result:', edgeResult)
          }

          console.log(`[Agent] Added to Neural Map: ${data.name} -> project ${project_id}`)
        }
      } catch (mapError) {
        console.warn('[Agent] Neural Map node creation warning:', mapError)
        // Neural Map 노드 생성 실패해도 에이전트 생성은 성공
      }
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

// 여성 에이전트 이름 목록
const FEMALE_AGENTS = ['레이첼', 'rachel', '애니', '에니', 'ani', 'annie', '소피아', 'sophia', '엠마', 'emma', '올리비아', 'olivia']

// Helper: Generate avatar URL (DiceBear lorelei avatars - 사람 얼굴 스타일)
function generateAvatarUrl(name: string): string {
  // DiceBear lorelei style - generates unique human-like avatars
  const nameLower = name.toLowerCase()
  const isFemale = FEMALE_AGENTS.some(n => nameLower.includes(n))

  // 여성 에이전트는 여성스러운 시드 사용
  const seed = isFemale
    ? `${name}-female`
    : name

  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`
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
