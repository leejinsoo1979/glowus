/**
 * Agent Permissions System
 *
 * Controls which directories, applications, and system resources
 * agents can access based on their role.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

// ============================================
// Types
// ============================================

export type AgentRole = 'jeremy' | 'rachel' | 'amy' | 'antigravity'

export interface AgentPermissions {
  // File system access
  allowedDirectories: string[]
  deniedDirectories: string[]

  // Application access
  allowedApplications: string[]

  // Browser control
  allowBrowserControl: boolean
  allowedBrowsers: ('chrome' | 'firefox' | 'safari' | 'edge')[]

  // System commands
  allowedCommands: string[]
  deniedCommands: string[]

  // Network access
  allowNetworkAccess: boolean
  allowedDomains?: string[]
}

export interface PermissionsConfig {
  version: string
  roles: Record<AgentRole, AgentPermissions>
}

// ============================================
// Default Permissions
// ============================================

const DEFAULT_PERMISSIONS: PermissionsConfig = {
  version: '1.0.0',
  roles: {
    jeremy: {
      allowedDirectories: [
        join(homedir(), 'Documents'),
        join(homedir(), 'Desktop'),
        join(homedir(), 'Downloads'),
        join(homedir(), 'Projects'),
      ],
      deniedDirectories: [
        join(homedir(), '.ssh'),
        join(homedir(), '.aws'),
        '/System',
        '/Library',
      ],
      allowedApplications: [
        '/Applications/Visual Studio Code.app',
        '/Applications/Google Chrome.app',
        '/Applications/Notion.app',
        '/Applications/Slack.app',
        'code', // VS Code CLI
        'open', // macOS open command
        'cursor', // Cursor IDE
      ],
      allowBrowserControl: true,
      allowedBrowsers: ['chrome', 'firefox', 'safari', 'edge'],
      allowedCommands: [
        'npm', 'npx', 'node', 'git', 'tsc', 'eslint', 'prettier',
        'pnpm', 'yarn', 'bun', 'cat', 'ls', 'pwd', 'echo',
        'mkdir', 'touch', 'cp', 'mv', 'rm', 'find', 'grep',
      ],
      deniedCommands: [
        'sudo', 'su', 'chmod 777', 'rm -rf /', 'dd',
        'mkfs', 'fdisk', 'shutdown', 'reboot', 'killall',
      ],
      allowNetworkAccess: true,
    },
    rachel: {
      allowedDirectories: [
        join(homedir(), 'Documents/Research'),
        join(homedir(), 'Downloads'),
      ],
      deniedDirectories: [
        join(homedir(), '.ssh'),
        join(homedir(), '.aws'),
        '/System',
        '/Library',
      ],
      allowedApplications: [
        '/Applications/Notion.app',
        '/Applications/Google Chrome.app',
        'python3',
        'jupyter',
      ],
      allowBrowserControl: true,
      allowedBrowsers: ['chrome'],
      allowedCommands: [
        'curl', 'wget', 'jq', 'python', 'python3', 'pip',
        'cat', 'ls', 'head', 'tail', 'grep', 'wc',
      ],
      deniedCommands: [
        'sudo', 'su', 'chmod 777', 'rm -rf', 'dd',
        'shutdown', 'reboot',
      ],
      allowNetworkAccess: true,
    },
    amy: {
      allowedDirectories: [
        join(homedir(), 'Documents'),
      ],
      deniedDirectories: [
        join(homedir(), '.ssh'),
        join(homedir(), '.aws'),
        '/System',
        '/Library',
      ],
      allowedApplications: [
        '/Applications/Notion.app',
      ],
      allowBrowserControl: false,
      allowedBrowsers: [],
      allowedCommands: ['cat', 'ls', 'pwd'],
      deniedCommands: ['sudo', 'rm', 'mv', 'chmod'],
      allowNetworkAccess: false,
    },
    antigravity: {
      allowedDirectories: [
        join(homedir(), 'Projects'),
      ],
      deniedDirectories: [
        join(homedir(), '.ssh'),
        join(homedir(), '.aws'),
      ],
      allowedApplications: [
        'npm',
        'git',
        'docker',
      ],
      allowBrowserControl: false,
      allowedBrowsers: [],
      allowedCommands: ['npm', 'git', 'docker', 'docker-compose'],
      deniedCommands: ['sudo', 'rm -rf'],
      allowNetworkAccess: true,
    },
  },
}

// ============================================
// Config File Management
// ============================================

const CONFIG_DIR = join(homedir(), '.glowus')
const CONFIG_FILE = join(CONFIG_DIR, 'agent-permissions.json')

/**
 * Load permissions config from file or return defaults
 */
export function loadPermissionsConfig(): PermissionsConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('[Permissions] Failed to load config:', error)
  }

  return DEFAULT_PERMISSIONS
}

/**
 * Save permissions config to file
 */
export function savePermissionsConfig(config: PermissionsConfig): void {
  try {
    const fs = require('fs')
    if (!existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    console.log('[Permissions] Config saved to', CONFIG_FILE)
  } catch (error) {
    console.error('[Permissions] Failed to save config:', error)
    throw error
  }
}

/**
 * Get permissions for a specific role
 */
export function getPermissions(role: AgentRole): AgentPermissions {
  const config = loadPermissionsConfig()
  return config.roles[role]
}

/**
 * Update permissions for a specific role
 */
export function updatePermissions(role: AgentRole, permissions: Partial<AgentPermissions>): void {
  const config = loadPermissionsConfig()
  config.roles[role] = {
    ...config.roles[role],
    ...permissions,
  }
  savePermissionsConfig(config)
}

// ============================================
// Permission Checkers
// ============================================

/**
 * Check if a path is allowed for the given role
 */
export function isPathAllowed(path: string, role: AgentRole): boolean {
  const permissions = getPermissions(role)

  // Check denied directories first
  const isDenied = permissions.deniedDirectories.some(dir =>
    path.startsWith(dir)
  )
  if (isDenied) {
    return false
  }

  // Check allowed directories
  const isAllowed = permissions.allowedDirectories.some(dir =>
    path.startsWith(dir)
  )

  return isAllowed
}

/**
 * Check if an application is allowed for the given role
 */
export function isApplicationAllowed(app: string, role: AgentRole): boolean {
  const permissions = getPermissions(role)

  // Check full path or command name
  return permissions.allowedApplications.some(allowed =>
    app === allowed || app.includes(allowed) || allowed.includes(app)
  )
}

/**
 * Check if a command is allowed for the given role
 */
export function isCommandAllowed(command: string, role: AgentRole): boolean {
  const permissions = getPermissions(role)

  // Check denied commands first
  const isDenied = permissions.deniedCommands.some(denied =>
    command.includes(denied)
  )
  if (isDenied) {
    return false
  }

  // Extract command name (first word)
  const cmdName = command.trim().split(/\s+/)[0]

  // Check allowed commands
  return permissions.allowedCommands.includes(cmdName)
}

/**
 * Check if browser control is allowed for the given role
 */
export function isBrowserControlAllowed(role: AgentRole, browser?: 'chrome' | 'firefox' | 'safari' | 'edge'): boolean {
  const permissions = getPermissions(role)

  if (!permissions.allowBrowserControl) {
    return false
  }

  if (browser) {
    return permissions.allowedBrowsers.includes(browser)
  }

  return true
}

/**
 * Check if network access is allowed for the given role
 */
export function isNetworkAccessAllowed(role: AgentRole, domain?: string): boolean {
  const permissions = getPermissions(role)

  if (!permissions.allowNetworkAccess) {
    return false
  }

  // If no domain whitelist, allow all
  if (!permissions.allowedDomains || permissions.allowedDomains.length === 0) {
    return true
  }

  // Check domain whitelist
  if (domain) {
    return permissions.allowedDomains.some(allowed =>
      domain.includes(allowed) || allowed.includes(domain)
    )
  }

  return true
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize permissions config if it doesn't exist
 */
export function initializePermissions(): void {
  if (!existsSync(CONFIG_FILE)) {
    console.log('[Permissions] Initializing default permissions config')
    savePermissionsConfig(DEFAULT_PERMISSIONS)
  }
}
