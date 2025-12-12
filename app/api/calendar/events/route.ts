import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import type { CreateEventData, CalendarEvent } from '@/types/calendar'

// DEV 모드 설정
const DEV_MODE = process.env.NODE_ENV === 'development' && process.env.DEV_BYPASS_AUTH === 'true'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/calendar/events - Get events within date range
export async function GET(request: Request) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()

  let userId: string
  if (DEV_MODE) {
    userId = DEV_USER_ID
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const teamId = searchParams.get('team_id')
  const projectId = searchParams.get('project_id')
  const includeCancelled = searchParams.get('include_cancelled') === 'true'

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'start_date와 end_date가 필요합니다.' },
      { status: 400 }
    )
  }

  let query = adminSupabase
    .from('calendar_events' as any)
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', startDate)
    .lte('end_time', endDate)
    .order('start_time', { ascending: true })

  if (!includeCancelled) {
    query = query.neq('status', 'cancelled')
  }

  if (teamId) {
    query = query.eq('team_id', teamId)
  }

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch events:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/calendar/events - Create new event
export async function POST(request: Request) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()

  let userId: string
  if (DEV_MODE) {
    userId = DEV_USER_ID
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id
  }

  try {
    const body: CreateEventData = await request.json()

    if (!body.title || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { error: '제목, 시작 시간, 종료 시간이 필요합니다.' },
        { status: 400 }
      )
    }

    // Create event
    const { data: event, error: eventError } = await adminSupabase
      .from('calendar_events' as any)
      .insert({
        user_id: userId,
        title: body.title,
        description: body.description,
        location: body.location,
        location_type: body.location_type,
        meeting_url: body.meeting_url,
        start_time: body.start_time,
        end_time: body.end_time,
        all_day: body.all_day || false,
        timezone: body.timezone || 'Asia/Seoul',
        is_recurring: body.is_recurring || false,
        recurrence_rule: body.recurrence_rule,
        recurrence_end_date: body.recurrence_end_date,
        color: body.color || 'blue',
        status: body.status || 'confirmed',
        visibility: body.visibility || 'default',
        team_id: body.team_id,
        project_id: body.project_id,
      } as any)
      .select()
      .single()

    if (eventError) {
      console.error('Failed to create event:', eventError)
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    const eventData = event as any

    // Add organizer as attendee
    await adminSupabase.from('event_attendees' as any).insert({
      event_id: eventData.id,
      user_id: userId,
      is_organizer: true,
      response_status: 'accepted',
    } as any)

    // Add other attendees
    if (body.attendee_emails && body.attendee_emails.length > 0) {
      const attendeeInserts = body.attendee_emails.map((email) => ({
        event_id: eventData.id,
        email,
        response_status: 'needs_action',
      }))

      await adminSupabase.from('event_attendees' as any).insert(attendeeInserts as any)
    }

    // Add categories
    if (body.category_ids && body.category_ids.length > 0) {
      const categoryInserts = body.category_ids.map((categoryId) => ({
        event_id: eventData.id,
        category_id: categoryId,
      }))

      await adminSupabase.from('event_categories' as any).insert(categoryInserts as any)
    }

    // Add reminders
    if (body.reminder_minutes && body.reminder_minutes.length > 0) {
      const reminderInserts = body.reminder_minutes.map((minutes) => ({
        event_id: eventData.id,
        user_id: userId,
        minutes_before: minutes,
      }))

      await adminSupabase.from('event_reminders' as any).insert(reminderInserts as any)
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Failed to create event:', error)
    return NextResponse.json(
      { error: '이벤트 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PATCH /api/calendar/events - Update event
export async function PATCH(request: Request) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()

  let userId: string
  if (DEV_MODE) {
    userId = DEV_USER_ID
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: '이벤트 ID가 필요합니다.' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await adminSupabase
      .from('calendar_events' as any)
      .select('user_id')
      .eq('id', id)
      .single()

    const existingData = existing as any
    if (!existingData || existingData.user_id !== userId) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { data: event, error } = await (adminSupabase as any)
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Failed to update event:', error)
    return NextResponse.json(
      { error: '이벤트 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE /api/calendar/events - Delete event
export async function DELETE(request: Request) {
  const supabase = createClient()
  const adminSupabase = createAdminClient()

  let userId: string
  if (DEV_MODE) {
    userId = DEV_USER_ID
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: '이벤트 ID가 필요합니다.' }, { status: 400 })
  }

  // Verify ownership
  const { data: existing } = await adminSupabase
    .from('calendar_events' as any)
    .select('user_id')
    .eq('id', id)
    .single()

  const existingData = existing as any
  if (!existingData || existingData.user_id !== userId) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { error } = await adminSupabase
    .from('calendar_events' as any)
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
