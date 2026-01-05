export const dynamic = 'force-dynamic'
/**
 * Google Calendar Events API
 * GET /api/google-calendar/events
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import {
  getValidAccessToken,
  getCalendarEvents,
  transformGoogleEvent,
} from '@/lib/google-calendar/client'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeMin = searchParams.get('timeMin')
    const timeMax = searchParams.get('timeMax')
    const calendarId = searchParams.get('calendarId') || 'primary'
    const useCache = searchParams.get('cache') !== 'false'

    // Get valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(user.id)

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', needsAuth: true },
        { status: 401 }
      )
    }

    // Check cache first if enabled
    if (useCache && timeMin && timeMax) {
      const { data: cachedEvents } = await (supabase as any)
        .from('google_calendar_events_cache')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', timeMin)
        .lte('end_time', timeMax)
        .order('start_time', { ascending: true })

      // Return cached if we have recent data (within 5 minutes)
      if (cachedEvents && cachedEvents.length > 0) {
        const { data: connection } = await (supabase as any)
          .from('google_calendar_connections')
          .select('last_sync_at')
          .eq('user_id', user.id)
          .single()

        if (connection?.last_sync_at) {
          const lastSync = new Date(connection.last_sync_at)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

          if (lastSync > fiveMinutesAgo) {
            return NextResponse.json({
              events: cachedEvents,
              fromCache: true,
              lastSync: connection.last_sync_at,
            })
          }
        }
      }
    }

    // Fetch fresh events from Google
    const googleEvents = await getCalendarEvents(
      accessToken,
      calendarId,
      timeMin || undefined,
      timeMax || undefined
    )

    // Transform events to our format
    const transformedEvents = googleEvents.map((event) =>
      transformGoogleEvent(event, calendarId)
    )

    // Get connection ID for caching
    const { data: connection } = await (supabase as any)
      .from('google_calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (connection) {
      // Update cache
      for (const event of transformedEvents) {
        await (supabase as any)
          .from('google_calendar_events_cache')
          .upsert(
            {
              ...event,
              connection_id: connection.id,
              user_id: user.id,
            },
            {
              onConflict: 'connection_id,google_event_id',
            }
          )
      }

      // Update last sync time
      await (supabase as any)
        .from('google_calendar_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', connection.id)
    }

    return NextResponse.json({
      events: transformedEvents,
      fromCache: false,
      lastSync: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Google Calendar events error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
