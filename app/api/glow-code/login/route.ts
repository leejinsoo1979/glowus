/**
 * Claude Code Login API
 * Just runs 'claude' - CLI handles OAuth automatically
 */

import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

export const runtime = 'nodejs'

export async function POST() {
  try {
    // Just spawn claude - it opens OAuth page automatically if not authenticated
    const child = spawn('/opt/homebrew/bin/claude', [], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
