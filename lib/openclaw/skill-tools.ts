/**
 * OpenClaw Skill Tools
 * LangChain DynamicStructuredTool로 OpenClaw 스킬을 GlowUS 에이전트에서 사용
 */

import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { OpenClawBridge, createOpenClawBridge } from './index'
import type { AdaptedSkill, SkillResult } from './types'

// ============================================
// Global Bridge Instance (per agent)
// ============================================

const agentBridges: Map<string, OpenClawBridge> = new Map()

/**
 * 에이전트별 OpenClaw Bridge 가져오기/생성
 */
export async function getOrCreateBridge(
  userId: string,
  agentId: string,
  options?: { autoConnect?: boolean }
): Promise<OpenClawBridge> {
  const key = `${userId}_${agentId}`

  if (!agentBridges.has(key)) {
    const bridge = createOpenClawBridge({
      userId,
      agentId,
      url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
      autoReconnect: true,
      debug: process.env.NODE_ENV === 'development',
    })

    agentBridges.set(key, bridge)

    // 자동 연결
    if (options?.autoConnect !== false) {
      try {
        await bridge.connect()
      } catch (error) {
        console.warn('OpenClaw Gateway 연결 실패:', error)
        // 연결 실패해도 브릿지는 유지 (나중에 재연결 시도)
      }
    }
  }

  return agentBridges.get(key)!
}

/**
 * 에이전트 Bridge 정리
 */
export function cleanupBridge(userId: string, agentId: string): void {
  const key = `${userId}_${agentId}`
  const bridge = agentBridges.get(key)

  if (bridge) {
    bridge.disconnect()
    agentBridges.delete(key)
  }
}

// ============================================
// OpenClaw Skill Execution Tool
// ============================================

/**
 * OpenClaw 스킬 실행 도구
 * 에이전트가 등록된 OpenClaw 스킬을 호출할 수 있음
 */
export function createOpenClawSkillTool(
  userId: string,
  agentId: string
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'openclaw_skill',
    description: `OpenClaw 스킬을 실행합니다. 웹 검색, 스크래핑, 브라우저 자동화 등 100+ 스킬을 사용할 수 있습니다.

사용 가능한 주요 스킬:
- web_search: 웹 검색
- scrape_website: 웹사이트 스크래핑
- browser_automation: 브라우저 자동화
- github_api: GitHub API 호출
- code_interpreter: 코드 실행

스킬 목록을 확인하려면 action을 "list"로 설정하세요.`,

    schema: z.object({
      action: z.enum(['execute', 'list']).describe('실행할 액션 (execute: 스킬 실행, list: 스킬 목록)'),
      skill_name: z.string().optional().describe('실행할 스킬 이름 (action이 execute일 때 필수)'),
      params: z.record(z.string(), z.any()).optional().describe('스킬에 전달할 파라미터'),
    }),

    func: async (input) => {
      try {
        const bridge = await getOrCreateBridge(userId, agentId)

        if (input.action === 'list') {
          // 스킬 목록 조회
          if (bridge.isConnected()) {
            const skills = bridge.getAllSkills()
            return JSON.stringify({
              success: true,
              skills: skills.map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                source: s.source,
              })),
            })
          } else {
            // Gateway 미연결 시 DB에서 로드
            const adminClient = createAdminClient()
            const { data } = await (adminClient as any)
              .from('agent_skills')
              .select('id, name, description, source')
              .eq('agent_id', agentId)
              .eq('enabled', true)

            return JSON.stringify({
              success: true,
              skills: data || [],
              note: 'OpenClaw Gateway에 연결되지 않았습니다. DB에서 스킬 목록을 가져왔습니다.',
            })
          }
        }

        // 스킬 실행
        if (!input.skill_name) {
          return JSON.stringify({
            success: false,
            error: 'skill_name이 필요합니다',
          })
        }

        // Gateway 연결 확인
        if (!bridge.isConnected()) {
          return JSON.stringify({
            success: false,
            error: 'OpenClaw Gateway에 연결되지 않았습니다. 로컬에서 OpenClaw Gateway를 실행해주세요.',
          })
        }

        // 스킬 실행
        const result = await bridge.invokeSkill(
          input.skill_name,
          input.params || {}
        )

        return JSON.stringify(result)

      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  })
}

// ============================================
// DB 기반 스킬 실행 도구
// ============================================

/**
 * DB에 저장된 스킬 기반 실행 도구
 * OpenClaw Gateway 없이도 스킬 내용을 참조하여 작업 수행
 */
export function createAgentSkillTool(
  userId: string,
  agentId: string
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'agent_skill',
    description: `에이전트에 장착된 스킬을 조회하고 활용합니다.

이 도구는 에이전트에 등록된 커스텀 스킬의 내용을 가져와서 해당 방법론을 따라 작업을 수행합니다.

action 옵션:
- list: 장착된 스킬 목록 조회
- get: 특정 스킬의 상세 내용 조회
- get_secrets: 스킬의 API 키 설정 조회`,

    schema: z.object({
      action: z.enum(['list', 'get', 'get_secrets']).describe('수행할 액션'),
      skill_name: z.string().optional().describe('스킬 이름 (get, get_secrets 액션에 필요)'),
    }),

    func: async (input) => {
      try {
        const adminClient = createAdminClient()

        if (input.action === 'list') {
          // 스킬 목록 조회
          const { data, error } = await (adminClient as any)
            .from('agent_skills')
            .select('id, name, description, enabled, source, category, metadata')
            .eq('agent_id', agentId)
            .order('name')

          if (error) throw error

          return JSON.stringify({
            success: true,
            skills: (data || []).map((s: any) => ({
              name: s.name,
              description: s.description,
              enabled: s.enabled,
              source: s.source,
              category: s.category,
              has_api_requirements: !!(s.metadata as any)?.requires_api?.length,
            })),
          })
        }

        if (input.action === 'get') {
          if (!input.skill_name) {
            return JSON.stringify({ success: false, error: 'skill_name이 필요합니다' })
          }

          // 특정 스킬 조회
          const { data, error } = await (adminClient as any)
            .from('agent_skills')
            .select('*')
            .eq('agent_id', agentId)
            .eq('name', input.skill_name)
            .single()

          if (error) throw error
          if (!data) {
            return JSON.stringify({ success: false, error: `스킬 '${input.skill_name}'을 찾을 수 없습니다` })
          }

          return JSON.stringify({
            success: true,
            skill: {
              name: data.name,
              description: data.description,
              content: data.content,
              enabled: data.enabled,
              source: data.source,
              metadata: data.metadata,
            },
          })
        }

        if (input.action === 'get_secrets') {
          if (!input.skill_name) {
            return JSON.stringify({ success: false, error: 'skill_name이 필요합니다' })
          }

          // 스킬 ID 조회
          const { data: skill } = await (adminClient as any)
            .from('agent_skills')
            .select('id')
            .eq('agent_id', agentId)
            .eq('name', input.skill_name)
            .single()

          if (!skill) {
            return JSON.stringify({ success: false, error: `스킬 '${input.skill_name}'을 찾을 수 없습니다` })
          }

          // 시크릿 조회 (값은 마스킹)
          const { data: secrets } = await (adminClient as any)
            .from('agent_skill_secrets')
            .select('key_name, description, is_required, key_value')
            .eq('skill_id', skill.id)

          return JSON.stringify({
            success: true,
            secrets: (secrets || []).map((s: any) => ({
              key_name: s.key_name,
              description: s.description,
              is_required: s.is_required,
              has_value: !!s.key_value,
              // 실제 값은 노출하지 않음
            })),
          })
        }

        return JSON.stringify({ success: false, error: '알 수 없는 action' })

      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    },
  })
}

// ============================================
// 스킬 기반 동적 도구 생성
// ============================================

/**
 * 에이전트의 스킬을 기반으로 동적 도구 생성
 * 각 스킬이 개별 도구로 변환됨
 */
export async function createDynamicSkillTools(
  userId: string,
  agentId: string
): Promise<DynamicStructuredTool[]> {
  const tools: DynamicStructuredTool[] = []

  try {
    const adminClient = createAdminClient()

    // 활성화된 스킬 로드
    const { data: skills } = await (adminClient as any)
      .from('agent_skills')
      .select('*')
      .eq('agent_id', agentId)
      .eq('enabled', true)

    if (!skills || skills.length === 0) {
      return tools
    }

    // OpenClaw Bridge 가져오기
    let bridge: OpenClawBridge | null = null
    try {
      bridge = await getOrCreateBridge(userId, agentId, { autoConnect: true })
    } catch (error) {
      console.warn('OpenClaw Bridge 생성 실패:', error)
    }

    // 각 스킬을 도구로 변환
    for (const skill of skills) {
      const toolName = `skill_${skill.name.replace(/[^a-zA-Z0-9_]/g, '_')}`
      const metadata = skill.metadata as any || {}

      // API 요구사항 확인
      const requiresApi = metadata.requires_api || []

      // 스킬 시크릿 로드
      let secrets: Record<string, string> = {}
      if (requiresApi.length > 0) {
        const { data: secretData } = await (adminClient as any)
          .from('agent_skill_secrets')
          .select('key_name, key_value')
          .eq('skill_id', skill.id)

        secrets = (secretData || []).reduce((acc: Record<string, string>, s: any) => {
          if (s.key_value) acc[s.key_name] = s.key_value
          return acc
        }, {} as Record<string, string>)
      }

      // 도구 생성
      const tool = new DynamicStructuredTool({
        name: toolName,
        description: `[${skill.source === 'openclaw' ? 'OpenClaw' : '커스텀'} 스킬] ${skill.description || skill.name}

스킬 내용을 참조하여 작업을 수행합니다.`,

        schema: z.object({
          query: z.string().optional().describe('스킬에 전달할 쿼리/입력'),
          params: z.record(z.string(), z.any()).optional().describe('추가 파라미터'),
        }),

        func: async (input) => {
          try {
            // OpenClaw 스킬이고 Gateway 연결됨
            if (skill.source === 'openclaw' && bridge?.isConnected()) {
              const result = await bridge.invokeSkill(skill.name, {
                ...input.params,
                query: input.query,
                // API 키 주입
                ...secrets,
              })

              return JSON.stringify(result)
            }

            // 그 외의 경우: 스킬 내용 반환 (에이전트가 참조용으로 사용)
            return JSON.stringify({
              success: true,
              type: 'skill_reference',
              skill_name: skill.name,
              skill_content: skill.content,
              input: input,
              secrets_available: Object.keys(secrets),
              note: 'OpenClaw Gateway에 연결되지 않았습니다. 스킬 내용을 참조하여 직접 작업을 수행하세요.',
            })

          } catch (error) {
            return JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        },
      })

      tools.push(tool)
    }

  } catch (error) {
    console.error('동적 스킬 도구 생성 실패:', error)
  }

  return tools
}

// ============================================
// Export All OpenClaw Tools
// ============================================

/**
 * 모든 OpenClaw 관련 도구 생성
 */
export function createOpenClawTools(
  userId: string,
  agentId: string
): DynamicStructuredTool[] {
  return [
    createOpenClawSkillTool(userId, agentId),
    createAgentSkillTool(userId, agentId),
  ]
}

/**
 * 동적 스킬 도구 포함 전체 OpenClaw 도구 생성
 */
export async function createAllOpenClawTools(
  userId: string,
  agentId: string
): Promise<DynamicStructuredTool[]> {
  const baseTools = createOpenClawTools(userId, agentId)
  const dynamicTools = await createDynamicSkillTools(userId, agentId)

  return [...baseTools, ...dynamicTools]
}
