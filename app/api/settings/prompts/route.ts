import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  WORK_OPERATING_MODEL,
  HUMAN_COMMUNICATION_RULES,
  PROFESSIONAL_HABITS,
  NO_HALLUCINATION_POLICY,
  COLLABORATION_CONFLICT_RULES,
  DELIVERABLE_TEMPLATES,
  CONTEXT_ANCHOR,
  RESPONSE_FORMAT_RULES,
  MESSENGER_CHAT_RULES,
  MEETING_TONE_MANNER,
} from '@/lib/agent/shared-prompts'

// 프롬프트 설정 타입
interface PromptSettings {
  id?: string
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
  created_at?: string
  updated_at?: string
}

// 기본값 (shared-prompts.ts에서 가져옴)
const DEFAULT_PROMPTS = {
  work_operating_model: WORK_OPERATING_MODEL,
  human_communication: HUMAN_COMMUNICATION_RULES,
  professional_habits: PROFESSIONAL_HABITS,
  no_hallucination: NO_HALLUCINATION_POLICY,
  collaboration_conflict: COLLABORATION_CONFLICT_RULES,
  deliverable_templates: DELIVERABLE_TEMPLATES,
  context_anchor: CONTEXT_ANCHOR,
  response_format: RESPONSE_FORMAT_RULES,
  messenger_rules: MESSENGER_CHAT_RULES,
  meeting_tone: MEETING_TONE_MANNER,
}

// GET - 프롬프트 설정 조회
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 유저의 팀 ID 가져오기
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .single()

    if (!teamMember) {
      // 팀이 없으면 기본값 반환
      return NextResponse.json(DEFAULT_PROMPTS)
    }

    // 팀의 프롬프트 설정 조회
    const { data, error } = await supabase
      .from('agent_prompt_settings' as any)
      .select('*')
      .eq('team_id', (teamMember as any).team_id)
      .single()

    const settings = data as PromptSettings | null

    if (error || !settings) {
      // 설정이 없으면 기본값 반환
      return NextResponse.json(DEFAULT_PROMPTS)
    }

    // 빈 값은 기본값으로 대체
    return NextResponse.json({
      work_operating_model: settings.work_operating_model || DEFAULT_PROMPTS.work_operating_model,
      human_communication: settings.human_communication || DEFAULT_PROMPTS.human_communication,
      professional_habits: settings.professional_habits || DEFAULT_PROMPTS.professional_habits,
      no_hallucination: settings.no_hallucination || DEFAULT_PROMPTS.no_hallucination,
      collaboration_conflict: settings.collaboration_conflict || DEFAULT_PROMPTS.collaboration_conflict,
      deliverable_templates: settings.deliverable_templates || DEFAULT_PROMPTS.deliverable_templates,
      context_anchor: settings.context_anchor || DEFAULT_PROMPTS.context_anchor,
      response_format: settings.response_format || DEFAULT_PROMPTS.response_format,
      messenger_rules: settings.messenger_rules || DEFAULT_PROMPTS.messenger_rules,
      meeting_tone: settings.meeting_tone || DEFAULT_PROMPTS.meeting_tone,
    })
  } catch (error) {
    console.error('Error fetching prompt settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - 프롬프트 설정 업데이트
export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // 유저의 팀 ID 가져오기
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'No team found' }, { status: 400 })
    }

    const teamId = (teamMember as any).team_id

    // upsert (있으면 업데이트, 없으면 생성)
    const { data, error } = await supabase
      .from('agent_prompt_settings' as any)
      .upsert({
        team_id: teamId,
        work_operating_model: body.work_operating_model,
        human_communication: body.human_communication,
        professional_habits: body.professional_habits,
        no_hallucination: body.no_hallucination,
        collaboration_conflict: body.collaboration_conflict,
        deliverable_templates: body.deliverable_templates,
        context_anchor: body.context_anchor,
        response_format: body.response_format,
        messenger_rules: body.messenger_rules,
        meeting_tone: body.meeting_tone,
      } as any, {
        onConflict: 'team_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating prompt settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating prompt settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - 기본값으로 초기화
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 유저의 팀 ID 가져오기
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'No team found' }, { status: 400 })
    }

    const teamId = (teamMember as any).team_id

    // 기본값으로 upsert
    const { data, error } = await supabase
      .from('agent_prompt_settings' as any)
      .upsert({
        team_id: teamId,
        ...DEFAULT_PROMPTS,
      } as any, {
        onConflict: 'team_id',
      })
      .select()
      .single()

    if (error) {
      console.error('Error resetting prompt settings:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error resetting prompt settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
