export const dynamic = 'force-dynamic'
/**
 * Google Calendar OAuth - Initiate Auth Flow
 * GET /api/google-calendar/auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar/client'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { user } = await getAuthUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate state with user ID for security
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
    })).toString('base64')

    const authUrl = getGoogleAuthUrl(state)

    console.log('[GoogleCalendar Auth] Generated URL:', authUrl)
    console.log('[GoogleCalendar Auth] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING')

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Google Calendar auth error:', error)
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    )
  }
}
