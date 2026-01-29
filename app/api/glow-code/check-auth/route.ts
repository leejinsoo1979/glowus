/**
 * Claude Code CLI Auth Check
 * Simple check if ~/.claude/ directory exists
 */

import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const claudeDir = join(homedir(), '.claude')
    const exists = existsSync(claudeDir)

    return NextResponse.json({
      hasClaudeDir: exists,
      path: claudeDir,
    })
  } catch (error: any) {
    console.error('[Check Auth] Error:', error)
    return NextResponse.json({
      hasClaudeDir: false,
      error: error.message,
    }, { status: 500 })
  }
}
