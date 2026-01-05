import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDevUser } from '@/lib/dev-user'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()

    const { data: alerts, error } = await supabase
      .from('government_program_alerts')
      .select('*')
      .eq('user_id', devUser.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ alerts })
  } catch (error: any) {
    console.error('Alerts fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { alert_type, keywords, categories, notification_channels } = body

    if (!alert_type) {
      return NextResponse.json({ error: 'alert_type is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('government_program_alerts')
      .insert({
        user_id: devUser.id,
        alert_type,
        keywords: keywords || [],
        categories: categories || [],
        notification_channels: notification_channels || ['in_app'],
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ alert: data })
  } catch (error: any) {
    console.error('Alert create error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const body = await request.json()

    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('government_program_alerts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', devUser.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ alert: data })
  } catch (error: any) {
    console.error('Alert update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const devUser = getDevUser()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('government_program_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', devUser.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Alert delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
