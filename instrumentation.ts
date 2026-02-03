/**
 * Next.js Instrumentation
 * 서버 시작 시 Jarvis 서버 자동 실행
 */

export async function register() {
  // 서버 사이드에서만 실행
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { spawn } = await import('child_process')
    const path = await import('path')

    // Jarvis 서버 (PTY 기반 대화형 Claude Code)
    const jarvisPath = path.join(process.cwd(), 'server', 'jarvis-server.js')
    console.log('[Instrumentation] Starting Jarvis server...')

    const jarvis = spawn('node', [jarvisPath], {
      detached: true,
      stdio: 'inherit',
      env: { ...process.env }
    })
    jarvis.unref()
    console.log('[Instrumentation] Jarvis server started, PID:', jarvis.pid)

    // 기존 Claude CLI 서버도 함께 실행 (하위 호환)
    const cliPath = path.join(process.cwd(), 'server', 'claude-cli-server.js')
    console.log('[Instrumentation] Starting Claude CLI server...')

    const cli = spawn('node', [cliPath], {
      detached: true,
      stdio: 'inherit',
      env: { ...process.env }
    })
    cli.unref()
    console.log('[Instrumentation] Claude CLI server started, PID:', cli.pid)
  }
}
