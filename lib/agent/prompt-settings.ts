import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PROMPT_SECTIONS, type PromptSections } from './shared-prompts'

// DB 레코드 타입
interface PromptSettingsRecord {
  id: string
  team_id: string
  work_operating_model: string
  human_communication: string
  professional_habits: string
  no_hallucination: string
  collaboration_conflict: string
  deliverable_templates: string
  context_anchor: string
  response_format: string
  messenger_rules: string
  meeting_tone: string
  created_at: string
  updated_at: string
}

/**
 * 팀의 프롬프트 설정을 DB에서 가져오기
 * @param teamId 팀 ID (옵션 - 없으면 기본값 반환)
 */
export async function getPromptSettings(teamId?: string | null): Promise<PromptSections> {
  if (!teamId) {
    return DEFAULT_PROMPT_SECTIONS
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('agent_prompt_settings' as any)
      .select('*')
      .eq('team_id', teamId)
      .single()

    const settings = data as PromptSettingsRecord | null

    if (error || !settings) {
      console.log('[getPromptSettings] No custom settings found, using defaults')
      return DEFAULT_PROMPT_SECTIONS
    }

    // 빈 값은 기본값으로 대체
    return {
      work_operating_model: settings.work_operating_model || DEFAULT_PROMPT_SECTIONS.work_operating_model,
      human_communication: settings.human_communication || DEFAULT_PROMPT_SECTIONS.human_communication,
      professional_habits: settings.professional_habits || DEFAULT_PROMPT_SECTIONS.professional_habits,
      no_hallucination: settings.no_hallucination || DEFAULT_PROMPT_SECTIONS.no_hallucination,
      collaboration_conflict: settings.collaboration_conflict || DEFAULT_PROMPT_SECTIONS.collaboration_conflict,
      deliverable_templates: settings.deliverable_templates || DEFAULT_PROMPT_SECTIONS.deliverable_templates,
      context_anchor: settings.context_anchor || DEFAULT_PROMPT_SECTIONS.context_anchor,
      response_format: settings.response_format || DEFAULT_PROMPT_SECTIONS.response_format,
      messenger_rules: settings.messenger_rules || DEFAULT_PROMPT_SECTIONS.messenger_rules,
      meeting_tone: settings.meeting_tone || DEFAULT_PROMPT_SECTIONS.meeting_tone,
    }
  } catch (error) {
    console.error('[getPromptSettings] Error fetching settings:', error)
    return DEFAULT_PROMPT_SECTIONS
  }
}

/**
 * 에이전트의 팀 ID를 가져오기
 * @param agentId 에이전트 ID
 */
export async function getAgentTeamId(agentId: string): Promise<string | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('agents')
      .select('team_id')
      .eq('id', agentId)
      .single()

    if (error || !data) {
      return null
    }

    return (data as any).team_id || null
  } catch (error) {
    console.error('[getAgentTeamId] Error:', error)
    return null
  }
}
