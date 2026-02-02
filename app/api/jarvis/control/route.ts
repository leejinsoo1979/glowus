/**
 * Jarvis GlowUS Control API
 * GlowUS 앱 전체 제어
 *
 * 인증 방식:
 * 1. 세션 기반 (브라우저에서 호출 시)
 * 2. _userId + Internal Secret (서버간 호출 - Telegram 등)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as glowusControl from '@/lib/jarvis/glowus-control'

// 내부 API 시크릿 (서버간 호출용)
const INTERNAL_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-internal-secret'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, params, _userId, _secret } = body

    let userId: string

    // 1. 내부 서버간 호출 (Telegram → Control API)
    if (_userId) {
      // 같은 서버 내 호출은 허용 (Telegram webhook → Control API)
      // 외부 호출시에는 시크릿 검증
      const isInternalCall = request.headers.get('host')?.includes('localhost') ||
                            request.headers.get('x-forwarded-host')?.includes(process.env.VERCEL_URL || '')

      if (!isInternalCall && _secret !== INTERNAL_SECRET) {
        return NextResponse.json({ error: '인증 실패' }, { status: 401 })
      }
      userId = _userId
    } else {
      // 2. 세션 기반 인증 (브라우저에서 호출)
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
      }
      userId = userId
    }

    if (!action) {
      return NextResponse.json({ error: 'action이 필요합니다' }, { status: 400 })
    }

    let result: any

    switch (action) {
      // ============================================
      // 네비게이션
      // ============================================
      case 'navigate':
        const route = glowusControl.getPageRoute(params?.page)
        if (!route) {
          return NextResponse.json({
            error: `알 수 없는 페이지: ${params?.page}`,
            availablePages: glowusControl.getAvailablePages(),
          }, { status: 400 })
        }
        result = { route, page: params.page }
        break

      case 'getPages':
        result = { pages: glowusControl.getAvailablePages() }
        break

      // ============================================
      // 에이전트 관리
      // ============================================
      case 'listAgents':
        result = { agents: await glowusControl.listAgents(userId) }
        break

      case 'getAgent':
        if (!params?.agentId) {
          return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 })
        }
        result = { agent: await glowusControl.getAgent(params.agentId, userId) }
        break

      case 'createAgent':
        if (!params?.name) {
          return NextResponse.json({ error: 'name이 필요합니다' }, { status: 400 })
        }
        result = { agent: await glowusControl.createAgent(userId, params) }
        break

      case 'updateAgent':
        if (!params?.agentId) {
          return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 })
        }
        result = { agent: await glowusControl.updateAgent(params.agentId, userId, params) }
        break

      case 'deleteAgent':
        if (!params?.agentId) {
          return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.deleteAgent(params.agentId, userId)
        break

      // ============================================
      // 스킬 관리
      // ============================================
      case 'listSkills':
        if (!params?.agentId) {
          return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 })
        }
        result = { skills: await glowusControl.listSkills(params.agentId) }
        break

      case 'addSkill':
        if (!params?.agentId || !params?.name) {
          return NextResponse.json({ error: 'agentId와 name이 필요합니다' }, { status: 400 })
        }
        result = { skill: await glowusControl.addSkill(params.agentId, params) }
        break

      case 'toggleSkill':
        if (!params?.skillId || params?.enabled === undefined) {
          return NextResponse.json({ error: 'skillId와 enabled가 필요합니다' }, { status: 400 })
        }
        result = { skill: await glowusControl.toggleSkill(params.skillId, params.enabled) }
        break

      case 'deleteSkill':
        if (!params?.skillId) {
          return NextResponse.json({ error: 'skillId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.deleteSkill(params.skillId)
        break

      // ============================================
      // 프로젝트 관리
      // ============================================
      case 'listProjects':
        result = { projects: await glowusControl.listProjects(userId) }
        break

      case 'getProject':
        if (!params?.projectId) {
          return NextResponse.json({ error: 'projectId가 필요합니다' }, { status: 400 })
        }
        result = { project: await glowusControl.getProject(params.projectId, userId) }
        break

      case 'createProject':
        if (!params?.name) {
          return NextResponse.json({ error: 'name이 필요합니다' }, { status: 400 })
        }
        result = { project: await glowusControl.createProject(userId, params) }
        break

      case 'updateProject':
        if (!params?.projectId) {
          return NextResponse.json({ error: 'projectId가 필요합니다' }, { status: 400 })
        }
        result = { project: await glowusControl.updateProject(params.projectId, userId, params) }
        break

      case 'deleteProject':
        if (!params?.projectId) {
          return NextResponse.json({ error: 'projectId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.deleteProject(params.projectId, userId)
        break

      // ============================================
      // 스킬 빌더
      // ============================================
      case 'getSkillBuilderState':
        if (!params?.agentId) {
          return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.getSkillBuilderState(params.agentId)
        break

      case 'addNode':
        if (!params?.agentId || !params?.type) {
          return NextResponse.json({ error: 'agentId와 type이 필요합니다' }, { status: 400 })
        }
        result = { node: await glowusControl.addSkillBuilderNode(params.agentId, params) }
        break

      case 'updateNode':
        if (!params?.agentId || !params?.nodeId) {
          return NextResponse.json({ error: 'agentId와 nodeId가 필요합니다' }, { status: 400 })
        }
        result = { node: await glowusControl.updateSkillBuilderNode(params.agentId, params.nodeId, params) }
        break

      case 'deleteNode':
        if (!params?.agentId || !params?.nodeId) {
          return NextResponse.json({ error: 'agentId와 nodeId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.deleteSkillBuilderNode(params.agentId, params.nodeId)
        break

      case 'connectNodes':
        if (!params?.agentId || !params?.source || !params?.target) {
          return NextResponse.json({ error: 'agentId, source, target가 필요합니다' }, { status: 400 })
        }
        result = { edge: await glowusControl.connectSkillBuilderNodes(params.agentId, params) }
        break

      case 'disconnectNodes':
        if (!params?.agentId || !params?.edgeId) {
          return NextResponse.json({ error: 'agentId와 edgeId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.disconnectSkillBuilderNodes(params.agentId, params.edgeId)
        break

      case 'getNodeTypes':
        result = { nodeTypes: glowusControl.SKILL_BUILDER_NODE_TYPES }
        break

      // ============================================
      // 채팅 & 워크플로우
      // ============================================
      case 'sendChat':
        if (!params?.agentId || !params?.message) {
          return NextResponse.json({ error: 'agentId와 message가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.sendChatToAgent(params.agentId, userId, params.message)
        break

      case 'triggerWorkflow':
        if (!params?.agentId) {
          return NextResponse.json({ error: 'agentId가 필요합니다' }, { status: 400 })
        }
        result = await glowusControl.triggerWorkflow(params.agentId, userId, params.input)
        break

      // ============================================
      // 상태 조회
      // ============================================
      case 'getState':
        result = await glowusControl.getGlowUSState(userId)
        break

      default:
        return NextResponse.json({
          error: `알 수 없는 action: ${action}`,
          availableActions: [
            'navigate', 'getPages',
            'listAgents', 'getAgent', 'createAgent', 'updateAgent', 'deleteAgent',
            'listSkills', 'addSkill', 'toggleSkill', 'deleteSkill',
            'listProjects', 'getProject', 'createProject', 'updateProject', 'deleteProject',
            'getSkillBuilderState', 'addNode', 'updateNode', 'deleteNode', 'connectNodes', 'disconnectNodes', 'getNodeTypes',
            'sendChat', 'triggerWorkflow',
            'getState',
          ],
        }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Jarvis Control API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * GET - 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const state = await glowusControl.getGlowUSState(user.id)
    return NextResponse.json({ success: true, ...state })
  } catch (error: any) {
    console.error('Jarvis Control GET Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
