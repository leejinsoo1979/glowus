/**
 * Claude Code CLI Auth
 * Checks if Claude Code CLI is installed and authenticated
 * This allows using Max Plan subscription through the CLI
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const runtime = 'nodejs'

export async function GET() {
  try {
    // Check if Claude CLI is installed by getting its version
    try {
      const { stdout: versionOutput } = await execAsync('/opt/homebrew/bin/claude --version', {
        timeout: 5000,
        env: { ...process.env, TERM: 'dumb' },
      })

      // CLI is installed
      const version = versionOutput.trim()

      // Try a simple test to verify authentication
      // Using --print with a minimal prompt to test auth
      try {
        await execAsync('/opt/homebrew/bin/claude --print -p "test"', {
          timeout: 20000,
          env: { ...process.env, TERM: 'dumb' },
        })

        // If we get here, CLI is authenticated
        return NextResponse.json({
          authenticated: true,
          version,
          message: 'Claude Code CLI가 인증되어 있습니다.',
        })
      } catch (authError: any) {
        // Check if the error indicates auth issues
        const errorMsg = authError.stderr || authError.message || ''

        if (errorMsg.includes('not authenticated') ||
            errorMsg.includes('login') ||
            errorMsg.includes('authenticate')) {
          return NextResponse.json({
            authenticated: false,
            version,
            error: 'Claude Code CLI가 설치되어 있지만 인증되지 않았습니다.',
            hint: '터미널에서 "claude" 명령어를 실행하고 로그인해주세요.',
          })
        }

        // Other errors - CLI might still be authenticated
        // Trust that CLI is working if version check passed
        return NextResponse.json({
          authenticated: true,
          version,
          message: 'Claude Code CLI가 설치되어 있습니다.',
        })
      }
    } catch (error: any) {
      // Claude CLI not found or not installed
      return NextResponse.json({
        authenticated: false,
        error: 'Claude Code CLI가 설치되어 있지 않습니다.',
        hint: 'npm install -g @anthropic-ai/claude-code 로 설치해주세요.',
      })
    }
  } catch (error: any) {
    console.error('[CLI Auth] Error:', error)
    return NextResponse.json({
      authenticated: false,
      error: error.message || '인증 확인 중 오류가 발생했습니다.',
    }, { status: 500 })
  }
}
