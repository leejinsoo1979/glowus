export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

// API 요구사항 타입
interface RequiredApi {
  name: string
  description?: string
  default?: string
  required?: boolean
}

// SKILL.md frontmatter 파싱
function parseSkillMd(content: string): {
  name: string
  description: string
  metadata: Record<string, any>
  body: string
  requires_api: RequiredApi[]
} {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!frontmatterMatch) {
    // frontmatter가 없는 경우
    const nameMatch = content.match(/^#\s+(.+)/m)
    return {
      name: nameMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '-') || 'unnamed-skill',
      description: '',
      metadata: {},
      body: content,
      requires_api: [],
    }
  }

  const [, frontmatter, body] = frontmatterMatch
  const metadata: Record<string, any> = {}
  const requires_api: RequiredApi[] = []

  // YAML-like frontmatter 파싱
  const lines = frontmatter.split('\n')
  let inRequiresApi = false
  let currentApiItem: Partial<RequiredApi> | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // requires_api 배열 시작
    if (line.match(/^requires_api:\s*$/)) {
      inRequiresApi = true
      continue
    }

    // requires_api 배열 항목
    if (inRequiresApi) {
      // 새 항목 시작 (- name: ...)
      const newItemMatch = line.match(/^\s*-\s*name:\s*(.+)$/)
      if (newItemMatch) {
        if (currentApiItem && currentApiItem.name) {
          requires_api.push(currentApiItem as RequiredApi)
        }
        currentApiItem = { name: newItemMatch[1].trim(), required: true }
        continue
      }

      // 현재 항목의 속성
      const propMatch = line.match(/^\s+(description|default|required):\s*(.+)$/)
      if (propMatch && currentApiItem) {
        const [, key, value] = propMatch
        if (key === 'required') {
          currentApiItem.required = value.trim() === 'true'
        } else {
          (currentApiItem as any)[key] = value.trim()
        }
        continue
      }

      // 배열 끝 (들여쓰기 없는 새 키)
      if (!line.startsWith(' ') && !line.startsWith('-') && line.includes(':')) {
        if (currentApiItem && currentApiItem.name) {
          requires_api.push(currentApiItem as RequiredApi)
        }
        currentApiItem = null
        inRequiresApi = false
      }
    }

    // 일반 키-값 파싱
    if (!inRequiresApi) {
      const match = line.match(/^(\w[\w-]*):\s*(.+)$/)
      if (match) {
        const [, key, value] = match
        // boolean 변환
        if (value === 'true') metadata[key] = true
        else if (value === 'false') metadata[key] = false
        else metadata[key] = value.trim()
      }
    }
  }

  // 마지막 API 항목 추가
  if (currentApiItem && currentApiItem.name) {
    requires_api.push(currentApiItem as RequiredApi)
  }

  return {
    name: metadata.name || 'unnamed-skill',
    description: metadata.description || '',
    metadata,
    body: body.trim(),
    requires_api,
  }
}

// GET: 에이전트의 스킬 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const adminClient = createAdminClient()

    const { data: skills, error } = await (adminClient as any)
      .from('agent_skills')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Skills fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ skills: skills || [] })
  } catch (error) {
    console.error('Skills API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// POST: 새 스킬 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 에이전트 소유권 확인 (dev 모드 제외)
    if (!isDevMode()) {
      const { data: agent } = await (adminClient as any)
        .from('deployed_agents')
        .select('owner_id')
        .eq('id', agentId)
        .single()

      if (!agent || agent.owner_id !== user.id) {
        return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { content, files, source, category } = body

    if (!content) {
      return NextResponse.json({ error: 'content가 필요합니다' }, { status: 400 })
    }

    // SKILL.md 파싱
    const parsed = parseSkillMd(content)

    // 스킬 삽입
    const { data: skill, error } = await (adminClient as any)
      .from('agent_skills')
      .insert({
        agent_id: agentId,
        name: parsed.name,
        description: parsed.description,
        content: content,
        files: files || [],
        source: source || 'local',
        category: category || null,
        keywords: parsed.metadata.keywords
          ? parsed.metadata.keywords.split(',').map((k: string) => k.trim())
          : [],
        metadata: {
          ...parsed.metadata,
          requires_api: parsed.requires_api,
        },
        enabled: true,
      })
      .select()
      .single()

    if (error) {
      // 중복 스킬 이름
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `"${parsed.name}" 스킬이 이미 존재합니다` },
          { status: 409 }
        )
      }
      console.error('Skill insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // API 요구사항이 있으면 빈 시크릿 레코드 생성
    if (parsed.requires_api.length > 0 && skill) {
      for (const api of parsed.requires_api) {
        await (adminClient as any)
          .from('agent_skill_secrets')
          .upsert({
            skill_id: skill.id,
            key_name: api.name,
            key_value: api.default || '',
            description: api.description || null,
            is_required: api.required ?? true,
            default_value: api.default || null,
          }, { onConflict: 'skill_id,key_name' })
      }
    }

    return NextResponse.json({ skill })
  } catch (error) {
    console.error('Skill create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// DELETE: 스킬 삭제 (body에 skillId 전달)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const skillId = searchParams.get('skillId')

    if (!skillId) {
      return NextResponse.json({ error: 'skillId가 필요합니다' }, { status: 400 })
    }

    // 스킬 삭제
    const { error } = await (adminClient as any)
      .from('agent_skills')
      .delete()
      .eq('id', skillId)
      .eq('agent_id', agentId)

    if (error) {
      console.error('Skill delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Skill delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}

// PATCH: 스킬 수정 (활성화/비활성화, 내용 수정 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { skillId, enabled, content, category } = body

    if (!skillId) {
      return NextResponse.json({ error: 'skillId가 필요합니다' }, { status: 400 })
    }

    const updates: Record<string, any> = {}

    if (typeof enabled === 'boolean') {
      updates.enabled = enabled
    }

    if (content) {
      const parsed = parseSkillMd(content)
      updates.content = content
      updates.name = parsed.name
      updates.description = parsed.description
      updates.metadata = parsed.metadata
      updates.keywords = parsed.metadata.keywords
        ? parsed.metadata.keywords.split(',').map((k: string) => k.trim())
        : []
    }

    if (category !== undefined) {
      updates.category = category
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: '수정할 내용이 없습니다' }, { status: 400 })
    }

    const { data: skill, error } = await (adminClient as any)
      .from('agent_skills')
      .update(updates)
      .eq('id', skillId)
      .eq('agent_id', agentId)
      .select()
      .single()

    if (error) {
      console.error('Skill update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ skill })
  } catch (error) {
    console.error('Skill update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    )
  }
}
