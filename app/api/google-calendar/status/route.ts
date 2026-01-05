export const dynamic = 'force-dynamic'
/**
 * Google Calendar Connection Status
 * GET /api/google-calendar/status
 */

import { NextResponse } from 'next/server'
import { createClient, getAuthUser, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: connection, error } = await (adminClient as any)
      .from('google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error || !connection) {
      return NextResponse.json({
        connected: false,
        googleEmail: null,
        syncEnabled: false,
        lastSyncAt: null,
        selectedCalendars: [],
      })
    }

    return NextResponse.json({
      connected: true,
      googleEmail: connection.google_email,
      syncEnabled: connection.sync_enabled,
      lastSyncAt: connection.last_sync_at,
      selectedCalendars: connection.selected_calendars || [],
    })
  } catch (error) {
    console.error('Google Calendar status error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}
