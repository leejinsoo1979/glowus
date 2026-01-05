import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()

    const { data: bookmarks, error } = await supabase
      .from('government_program_bookmarks')
      .select(`
        *,
        program:government_programs(
          id, title, organization, category, status,
          apply_start_date, apply_end_date, support_amount
        )
      `)
      .eq('user_id', devUser.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ bookmarks })
  } catch (error: any) {
    console.error('Bookmarks fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { program_id, notes, priority } = body

    if (!program_id) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('government_program_bookmarks')
      .upsert({
        user_id: devUser.id,
        program_id,
        notes,
        priority: priority || 0
      }, {
        onConflict: 'user_id,program_id'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ bookmark: data })
  } catch (error: any) {
    console.error('Bookmark create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get('program_id')

    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('government_program_bookmarks')
      .delete()
      .eq('user_id', devUser.id)
      .eq('program_id', programId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Bookmark delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
