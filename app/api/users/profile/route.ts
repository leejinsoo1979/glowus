import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { UserProfile } from '@/types'

// GET /api/users/profile - 현재 유저 프로필 가져오기
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 프로필 조회 (없으면 생성)
  let { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code === 'PGRST116') {
    // 프로필이 없으면 생성
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    profile = newProfile
  } else if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(profile)
}

// PATCH /api/users/profile - 프로필 업데이트
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // 허용된 필드만 업데이트
  const allowedFields = [
    'title', 'birthday', 'location',
    'github_url', 'twitter_url', 'linkedin_url', 'website_url',
    'bio', 'services', 'achievements',
    'education', 'experience', 'skills',
    'portfolio',
    'calendly_url', 'contact_email', 'contact_phone', 'contact_address'
  ]

  const updateData: Partial<UserProfile> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      (updateData as any)[field] = body[field]
    }
  }

  // upsert로 프로필 업데이트 (없으면 생성)
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: user.id, ...updateData },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(profile)
}
