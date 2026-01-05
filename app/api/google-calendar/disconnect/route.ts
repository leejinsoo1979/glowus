export const dynamic = 'force-dynamic'
/**
 * Google Calendar Disconnect
 * POST /api/google-calendar/disconnect
 */

import { NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection to revoke token
    const { data: connection } = await (supabase as any)
      .from('google_calendar_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single()

    if (connection?.access_token) {
      // Revoke Google token
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${connection.access_token}`,
          { method: 'POST' }
        )
      } catch {
        // Ignore revoke errors - token might already be invalid
      }
    }

    // Delete cached events
    await (supabase as any)
      .from('google_calendar_events_cache')
      .delete()
      .eq('user_id', user.id)

    // Delete connection
    const { error } = await (supabase as any)
      .from('google_calendar_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to disconnect:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Google Calendar disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
