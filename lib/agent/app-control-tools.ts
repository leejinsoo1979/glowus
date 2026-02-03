/**
 * Application Control Tools
 *
 * Launch and control local applications with permission checks.
 */

import { exec, spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { isApplicationAllowed, type AgentRole } from './permissions'

const execAsync = promisify(exec)

// Track running processes
const runningProcesses = new Map<string, ChildProcess>()

// ============================================
// Application Launch
// ============================================

/**
 * Launch an application
 */
export async function launchApplication(
  app: string,
  args: string[] = [],
  role: AgentRole
): Promise<{ processId: string; message: string }> {
  if (!isApplicationAllowed(app, role)) {
    throw new Error(`Permission denied: ${role} cannot launch ${app}`)
  }

  try {
    let command: string

    // Handle macOS .app bundles
    if (app.endsWith('.app')) {
      command = `open -a "${app}"`
      if (args.length > 0) {
        command += ` --args ${args.join(' ')}`
      }
    } else {
      // Regular command
      command = app
      if (args.length > 0) {
        command += ` ${args.join(' ')}`
      }
    }

    const { stdout, stderr } = await execAsync(command)

    return {
      processId: `${app}-${Date.now()}`,
      message: `Launched ${app}${stdout ? `\n${stdout}` : ''}${stderr ? `\nWarnings: ${stderr}` : ''}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to launch ${app}: ${error.message}`)
  }
}

/**
 * Launch application and keep process handle for control
 */
export async function launchApplicationWithControl(
  app: string,
  args: string[] = [],
  role: AgentRole
): Promise<{ processId: string; pid: number }> {
  if (!isApplicationAllowed(app, role)) {
    throw new Error(`Permission denied: ${role} cannot launch ${app}`)
  }

  try {
    const process = spawn(app, args, {
      detached: false,
      stdio: 'pipe',
    })

    const processId = `${app}-${Date.now()}`
    runningProcesses.set(processId, process)

    // Clean up when process exits
    process.on('exit', () => {
      runningProcesses.delete(processId)
    })

    return {
      processId,
      pid: process.pid!,
    }
  } catch (error: any) {
    throw new Error(`Failed to launch ${app}: ${error.message}`)
  }
}

/**
 * Stop a running application
 */
export async function stopApplication(
  processId: string,
  role: AgentRole
): Promise<{ message: string }> {
  const process = runningProcesses.get(processId)

  if (!process) {
    throw new Error(`Process not found: ${processId}`)
  }

  try {
    process.kill()
    runningProcesses.delete(processId)

    return {
      message: `Stopped process ${processId}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to stop process: ${error.message}`)
  }
}

/**
 * Get list of running applications managed by this system
 */
export async function listRunningApplications(
  role: AgentRole
): Promise<{ processId: string; pid: number; alive: boolean }[]> {
  const result: { processId: string; pid: number; alive: boolean }[] = []

  for (const [processId, process] of runningProcesses.entries()) {
    result.push({
      processId,
      pid: process.pid!,
      alive: !process.killed && process.exitCode === null,
    })
  }

  return result
}

// ============================================
// Application Control
// ============================================

/**
 * Open file with default application
 */
export async function openFile(
  filePath: string,
  role: AgentRole
): Promise<{ message: string }> {
  // 'open' command is allowed for most roles
  if (!isApplicationAllowed('open', role)) {
    throw new Error(`Permission denied: ${role} cannot open files`)
  }

  try {
    const { stdout, stderr } = await execAsync(`open "${filePath}"`)

    return {
      message: `Opened ${filePath}${stdout ? `\n${stdout}` : ''}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to open file: ${error.message}`)
  }
}

/**
 * Open URL in default browser
 */
export async function openURL(
  url: string,
  role: AgentRole
): Promise<{ message: string }> {
  if (!isApplicationAllowed('open', role)) {
    throw new Error(`Permission denied: ${role} cannot open URLs`)
  }

  try {
    const { stdout } = await execAsync(`open "${url}"`)

    return {
      message: `Opened ${url}${stdout ? `\n${stdout}` : ''}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to open URL: ${error.message}`)
  }
}

/**
 * Execute AppleScript (macOS only)
 */
export async function executeAppleScript(
  script: string,
  role: AgentRole
): Promise<{ output: string }> {
  // Only jeremy role can execute AppleScript
  if (role !== 'jeremy') {
    throw new Error(`Permission denied: only jeremy can execute AppleScript`)
  }

  try {
    const { stdout, stderr } = await execAsync(`osascript -e '${script.replace(/'/g, "\\'")}'`)

    return {
      output: stdout || stderr || 'Script executed',
    }
  } catch (error: any) {
    throw new Error(`Failed to execute AppleScript: ${error.message}`)
  }
}

/**
 * Get list of installed applications (macOS)
 */
export async function getInstalledApplications(
  role: AgentRole
): Promise<{ name: string; path: string }[]> {
  try {
    const { stdout } = await execAsync('ls /Applications')
    const apps = stdout
      .split('\n')
      .filter(name => name.endsWith('.app'))
      .map(name => ({
        name: name.replace('.app', ''),
        path: `/Applications/${name}`,
      }))

    return apps
  } catch (error: any) {
    throw new Error(`Failed to list applications: ${error.message}`)
  }
}

/**
 * Check if application is running (macOS)
 */
export async function isApplicationRunning(
  appName: string,
  role: AgentRole
): Promise<{ running: boolean }> {
  try {
    const { stdout } = await execAsync(`pgrep -f "${appName}"`)
    return { running: stdout.trim().length > 0 }
  } catch (error) {
    // pgrep returns non-zero exit code if no process found
    return { running: false }
  }
}

/**
 * Bring application to front (macOS)
 */
export async function bringApplicationToFront(
  appName: string,
  role: AgentRole
): Promise<{ message: string }> {
  if (role !== 'jeremy') {
    throw new Error(`Permission denied: only jeremy can control application focus`)
  }

  try {
    await executeAppleScript(
      `tell application "${appName}" to activate`,
      role
    )

    return {
      message: `Brought ${appName} to front`,
    }
  } catch (error: any) {
    throw new Error(`Failed to bring application to front: ${error.message}`)
  }
}

/**
 * Quit application gracefully (macOS)
 */
export async function quitApplication(
  appName: string,
  role: AgentRole
): Promise<{ message: string }> {
  if (role !== 'jeremy') {
    throw new Error(`Permission denied: only jeremy can quit applications`)
  }

  try {
    await executeAppleScript(
      `tell application "${appName}" to quit`,
      role
    )

    return {
      message: `Quit ${appName}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to quit application: ${error.message}`)
  }
}
