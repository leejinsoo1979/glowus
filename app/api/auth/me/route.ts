import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/auth/me - Get current user
export async function GET() {
  const supabase = createClient()
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  if (!authUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch user profile
  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (error) {
    // Return basic info from auth if profile doesn't exist
    return NextResponse.json({
      data: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || 'User',
        role: authUser.user_metadata?.role || 'founder',
        company: authUser.user_metadata?.company,
        created_at: authUser.created_at,
      }
    })
  }

  return NextResponse.json({ data: profile })
}
