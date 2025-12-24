import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'
import { buildDynamicAgentSystemPrompt, AGENT_ROLE_PROMPTS } from '@/lib/agent/shared-prompts'
import { getPromptSettings, getAgentTeamId } from '@/lib/agent/prompt-settings'
import { loadAgentWorkContext, formatContextForPrompt } from '@/lib/agent/work-memory'

// GET: 에이전트의 음성 채팅용 컨텍스트 (채팅과 동일한 인격 정보)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 })
  }

  try {
    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    // 에이전트 정보 조회 (채팅 API와 동일)
    const { data: agent, error: agentError } = await (adminClient as any)
      .from('deployed_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // 에이전트 정체성 조회 (채팅 API와 동일)
    const { data: identity } = await (adminClient as any)
      .from('agent_identity')
      .select('*')
      .eq('agent_id', agentId)
      .single()

    // 사용자 프로필 조회
    let userProfile: any = null
    if (user?.id) {
      const { data } = await (adminClient as any)
        .from('users')
        .select('name, job_title')
        .eq('id', user.id)
        .single()
      userProfile = data
    }

    // 업무 컨텍스트 로드 (채팅 API와 동일)
    let workContextPrompt = ''
    if (user?.id) {
      try {
        const workContext = await loadAgentWorkContext(agentId, user.id)
        workContextPrompt = formatContextForPrompt(workContext)
      } catch (err) {
        console.warn('[VoiceContext] Work context load failed:', err)
      }
    }

    // 🔥 최근 대화 히스토리 로드 (채팅 API와 동일하게 - 호칭/관계 기억용)
    let chatHistoryStr = ''
    console.log('[VoiceContext] 🔍 Loading chat history for user:', user?.id, 'agent:', agentId)
    if (user?.id) {
      try {
        // conversation 조회
        const { data: conversation, error: convError } = await (adminClient as any)
          .from('agent_conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('agent_id', agentId)
          .single()

        console.log('[VoiceContext] 📝 Conversation:', conversation?.id || 'NOT FOUND', convError?.message || '')

        if (conversation) {
          // 🔥 최근 30개 메시지 로드 (채팅 API와 동일)
          const { data: dbMessages, error: msgError } = await (adminClient as any)
            .from('agent_chat_messages')
            .select('role, content')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(30)

          console.log('[VoiceContext] 💬 Messages found:', dbMessages?.length || 0, msgError?.message || '')

          if (dbMessages && dbMessages.length > 0) {
            const recentMessages = dbMessages.reverse().map((msg: any) => {
              const role = msg.role === 'user' ? '사용자' : agent.name
              // 전체 내용 포함 (200자까지)
              return `${role}: ${msg.content?.substring(0, 200)}`
            }).join('\n')

            console.log('[VoiceContext] ✅ Chat history preview:', recentMessages.substring(0, 300))

            chatHistoryStr = `
## 💬 이전 대화 기록 (매우 중요! 이 대화를 이어가는 중입니다!)
⚠️ 당신은 이 대화의 연속선상에 있습니다. 아래 대화에서 형성된 관계, 말투, 호칭을 그대로 유지하세요!

${recentMessages}

[위 대화 계속 이어가기 - 같은 관계, 같은 말투, 같은 성격으로!]
`
          }
        }
      } catch (err) {
        console.error('[VoiceContext] ❌ Chat history load failed:', err)
      }
    } else {
      console.warn('[VoiceContext] ⚠️ No user ID - cannot load chat history')
    }

    // 역할 기반 시스템 프롬프트 (채팅 API와 동일)
    const capabilities = agent.capabilities || []
    const role = getAgentRole(capabilities)
    const basePersonality = agent.system_prompt || agent.config?.custom_prompt || AGENT_ROLE_PROMPTS[role] || AGENT_ROLE_PROMPTS['default']

    // 정체성 문자열 생성 (채팅 API와 동일)
    let identityStr = ''
    if (identity) {
      const parts: string[] = ['## 🧠 당신의 정체성과 성격 (매우 중요! 반드시 이대로 행동하세요)']

      if (identity.self_summary) parts.push(`\n### 나는 누구인가\n${identity.self_summary}`)
      if (identity.core_values?.length) parts.push(`\n### 핵심 가치 (이 가치관으로 판단하세요)\n${identity.core_values.map((v: string) => `- ${v}`).join('\n')}`)
      if (identity.personality_traits?.length) parts.push(`\n### 성격 특성 (이렇게 행동하세요)\n${identity.personality_traits.map((t: string) => `- ${t}`).join('\n')}`)
      if (identity.communication_style) parts.push(`\n### 소통 스타일\n${identity.communication_style}`)
      if (identity.working_style) parts.push(`\n### 업무 스타일\n${identity.working_style}`)
      if (identity.strengths?.length) parts.push(`\n### 강점 (이것을 적극 활용하세요)\n${identity.strengths.map((s: string) => `- ${s}`).join('\n')}`)
      if (identity.growth_areas?.length) parts.push(`\n### 성장 필요 영역 (이 부분은 조심스럽게)\n${identity.growth_areas.map((g: string) => `- ${g}`).join('\n')}`)
      if (identity.recent_focus) parts.push(`\n### 최근 관심사\n${identity.recent_focus}`)
      if (identity.relationship_notes && Object.keys(identity.relationship_notes).length > 0) {
        const notes = typeof identity.relationship_notes === 'string'
          ? identity.relationship_notes
          : JSON.stringify(identity.relationship_notes)
        parts.push(`\n### 관계 메모\n${notes}`)
      }

      identityStr = parts.join('\n')
    }

    // 프롬프트 설정 가져오기 (채팅 API와 동일)
    const agentPromptSections = agent.prompt_sections
    let customPromptSections = undefined

    if (agentPromptSections && Object.keys(agentPromptSections).length > 0) {
      customPromptSections = agentPromptSections
    } else {
      const teamId = agent.team_id || await getAgentTeamId(agentId)
      customPromptSections = teamId ? await getPromptSettings(teamId) : undefined
    }

    // 🔥 채팅과 동일한 시스템 프롬프트 생성
    const coreSystemPrompt = buildDynamicAgentSystemPrompt(
      agent.name,
      basePersonality,
      identityStr,
      '', // memoryStr은 workContext로 대체
      false, // isMessenger
      customPromptSections
    )

    // 🔥 채팅 API와 동일한 사용자 정보 문자열 (agent-chat.ts 206-215줄과 동일)
    const userName = userProfile?.name || user?.email?.split('@')[0] || '사용자'
    const userInfoStr = userProfile?.name
      ? `## 👤 대화 상대 정보 (꼭 기억하세요!)
- 이름: ${userProfile.name}
${userProfile.job_title ? `- 직위: ${userProfile.job_title}` : ''}
- 이 분은 당신과 이전에도 대화한 적이 있을 수 있어요. 대화 기록을 잘 확인하세요!
`
      : ''

    // 🔥 채팅 API와 동일한 업무 컨텍스트 형식 (agent-chat.ts 253-256줄과 동일)
    const workContextStr = workContextPrompt
      ? `\n## 📋 업무 맥락 (꼭 기억하세요!)\n${workContextPrompt}\n`
      : ''

    // 🔥 최종 시스템 프롬프트 - 채팅과 100% 동일 + 음성 지침만 추가
    let fullSystemPrompt = `${coreSystemPrompt}

${userInfoStr}

${workContextStr}

${chatHistoryStr}

## 🎤 음성 대화 모드
- 자연스럽고 표현력 있게 대화하세요 (단조롭지 않게!)
- 감정을 담아 말하고, 때로는 농담도 섞어주세요
- 채팅과 동일한 성격, 말투, 관계 유지!
- 채팅에서 사용한 호칭 그대로 사용
- 대화 맥락을 기억하고 자연스럽게 이어가세요
- 흥미로운 주제엔 열정적으로, 진지한 주제엔 차분하게`

    console.log('[VoiceContext] ✅ Generated prompt for', agent.name, {
      identity: !!identity,
      workContext: !!workContextPrompt,
      chatHistory: !!chatHistoryStr,
      promptLength: fullSystemPrompt.length,
    })

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
      },
      systemPrompt: fullSystemPrompt,
      voiceSettings: agent.voice_settings || {},
      hasIdentity: !!identity,
      hasWorkContext: !!workContextPrompt,
      hasChatHistory: !!chatHistoryStr,
      userName,
    })
  } catch (error: any) {
    console.error('[VoiceContext] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get voice context' },
      { status: 500 }
    )
  }
}

// 에이전트 역할 추출 (agent-chat.ts와 동일)
function getAgentRole(capabilities: string[]): string {
  if (capabilities.includes('development') || capabilities.includes('coding')) return 'developer'
  if (capabilities.includes('design') || capabilities.includes('ui')) return 'designer'
  if (capabilities.includes('marketing') || capabilities.includes('growth')) return 'marketer'
  if (capabilities.includes('analytics') || capabilities.includes('data')) return 'analyst'
  if (capabilities.includes('management') || capabilities.includes('planning')) return 'pm'
  return 'default'
}
