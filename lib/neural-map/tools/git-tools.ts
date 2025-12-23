/**
 * Git Tools - Version Control Operations
 * Full git integration for the coding agent
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

// ============================================
// Types
// ============================================

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFileChange[]
  unstaged: GitFileChange[]
  untracked: string[]
  hasConflicts: boolean
}

export interface GitFileChange {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied'
  oldPath?: string
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  authorEmail: string
  date: string
  refs?: string[]
}

export interface GitDiff {
  files: GitDiffFile[]
  stats: {
    filesChanged: number
    insertions: number
    deletions: number
  }
}

export interface GitDiffFile {
  path: string
  additions: number
  deletions: number
  hunks: GitDiffHunk[]
}

export interface GitDiffHunk {
  header: string
  lines: GitDiffLine[]
}

export interface GitDiffLine {
  type: 'context' | 'addition' | 'deletion'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface GitResult {
  success: boolean
  output: string
  error?: string
}

// ============================================
// Git Status
// ============================================

export async function gitStatus(cwd: string = process.cwd()): Promise<GitStatus> {
  try {
    // Get branch info
    const { stdout: branchOutput } = await execPromise('git branch --show-current', { cwd })
    const branch = branchOutput.trim()

    // Get ahead/behind
    let ahead = 0, behind = 0
    try {
      const { stdout: trackingOutput } = await execPromise(
        'git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0 0"',
        { cwd }
      )
      const [a, b] = trackingOutput.trim().split(/\s+/).map(Number)
      ahead = a || 0
      behind = b || 0
    } catch {
      // No upstream
    }

    // Get status
    const { stdout: statusOutput } = await execPromise('git status --porcelain=v1', { cwd })
    const lines = statusOutput.split('\n').filter(Boolean)

    const staged: GitFileChange[] = []
    const unstaged: GitFileChange[] = []
    const untracked: string[] = []
    let hasConflicts = false

    for (const line of lines) {
      const indexStatus = line[0]
      const workTreeStatus = line[1]
      const path = line.slice(3).trim()

      // Check for conflicts
      if (indexStatus === 'U' || workTreeStatus === 'U' || (indexStatus === 'A' && workTreeStatus === 'A')) {
        hasConflicts = true
      }

      // Untracked
      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(path)
        continue
      }

      // Staged changes
      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({
          path,
          status: parseGitStatus(indexStatus),
        })
      }

      // Unstaged changes
      if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
        unstaged.push({
          path,
          status: parseGitStatus(workTreeStatus),
        })
      }
    }

    return {
      branch,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      hasConflicts,
    }
  } catch (error) {
    throw new Error(`Git status failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function parseGitStatus(char: string): GitFileChange['status'] {
  switch (char) {
    case 'A': return 'added'
    case 'M': return 'modified'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    case 'C': return 'copied'
    default: return 'modified'
  }
}

// ============================================
// Git Diff
// ============================================

export async function gitDiff(params: {
  cwd?: string
  staged?: boolean
  file?: string
}): Promise<GitDiff> {
  const { cwd = process.cwd(), staged = false, file } = params

  try {
    const stagedFlag = staged ? '--staged' : ''
    const fileArg = file ? `-- ${file}` : ''
    const { stdout } = await execPromise(
      `git diff ${stagedFlag} --stat --numstat ${fileArg}`,
      { cwd }
    )

    // Parse numstat for accurate counts
    const lines = stdout.split('\n').filter(Boolean)
    const files: GitDiffFile[] = []
    let totalInsertions = 0, totalDeletions = 0

    for (const line of lines) {
      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (match) {
        const additions = match[1] === '-' ? 0 : parseInt(match[1], 10)
        const deletions = match[2] === '-' ? 0 : parseInt(match[2], 10)
        files.push({
          path: match[3],
          additions,
          deletions,
          hunks: [],
        })
        totalInsertions += additions
        totalDeletions += deletions
      }
    }

    return {
      files,
      stats: {
        filesChanged: files.length,
        insertions: totalInsertions,
        deletions: totalDeletions,
      },
    }
  } catch (error) {
    throw new Error(`Git diff failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================
// Git Log
// ============================================

export async function gitLog(params: {
  cwd?: string
  maxCount?: number
  oneLine?: boolean
}): Promise<GitCommit[]> {
  const { cwd = process.cwd(), maxCount = 20, oneLine = false } = params

  try {
    const format = oneLine
      ? '%H|%h|%s'
      : '%H|%h|%s|%an|%ae|%ci|%D'

    const { stdout } = await execPromise(
      `git log -n ${maxCount} --format="${format}"`,
      { cwd }
    )

    const commits: GitCommit[] = []
    for (const line of stdout.split('\n').filter(Boolean)) {
      const parts = line.split('|')
      commits.push({
        hash: parts[0],
        shortHash: parts[1],
        message: parts[2],
        author: parts[3] || '',
        authorEmail: parts[4] || '',
        date: parts[5] || '',
        refs: parts[6] ? parts[6].split(',').map((r) => r.trim()).filter(Boolean) : [],
      })
    }

    return commits
  } catch (error) {
    throw new Error(`Git log failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ============================================
// Git Operations (Add, Commit, etc.)
// ============================================

export async function gitAdd(params: {
  files: string[]
  cwd?: string
}): Promise<GitResult> {
  const { files, cwd = process.cwd() } = params

  try {
    const fileArgs = files.length === 0 ? '.' : files.join(' ')
    const { stdout } = await execPromise(`git add ${fileArgs}`, { cwd })
    return { success: true, output: stdout || 'Files staged successfully' }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}

export async function gitCommit(params: {
  message: string
  cwd?: string
  amend?: boolean
}): Promise<GitResult> {
  const { message, cwd = process.cwd(), amend = false } = params

  try {
    const amendFlag = amend ? '--amend' : ''
    // Escape message for shell
    const escapedMessage = message.replace(/'/g, "'\\''")
    const { stdout } = await execPromise(
      `git commit ${amendFlag} -m '${escapedMessage}'`,
      { cwd }
    )
    return { success: true, output: stdout }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}

export async function gitReset(params: {
  files?: string[]
  hard?: boolean
  cwd?: string
}): Promise<GitResult> {
  const { files = [], hard = false, cwd = process.cwd() } = params

  try {
    const hardFlag = hard ? '--hard' : ''
    const fileArgs = files.length > 0 ? `-- ${files.join(' ')}` : ''
    const { stdout } = await execPromise(`git reset ${hardFlag} ${fileArgs}`, { cwd })
    return { success: true, output: stdout || 'Reset successful' }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}

export async function gitStash(params: {
  action: 'push' | 'pop' | 'list' | 'drop'
  message?: string
  cwd?: string
}): Promise<GitResult> {
  const { action, message, cwd = process.cwd() } = params

  try {
    let cmd = `git stash ${action}`
    if (action === 'push' && message) {
      cmd += ` -m '${message.replace(/'/g, "'\\''")}'`
    }
    const { stdout } = await execPromise(cmd, { cwd })
    return { success: true, output: stdout }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}

export async function gitBranch(params: {
  action: 'list' | 'create' | 'delete' | 'checkout'
  name?: string
  cwd?: string
}): Promise<GitResult> {
  const { action, name, cwd = process.cwd() } = params

  try {
    let cmd: string
    switch (action) {
      case 'list':
        cmd = 'git branch -a'
        break
      case 'create':
        cmd = `git checkout -b ${name}`
        break
      case 'delete':
        cmd = `git branch -d ${name}`
        break
      case 'checkout':
        cmd = `git checkout ${name}`
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    const { stdout } = await execPromise(cmd, { cwd })
    return { success: true, output: stdout }
  } catch (error: any) {
    return { success: false, output: '', error: error.message }
  }
}

// ============================================
// Unified Git Command Handler
// ============================================

export async function repoGit(params: {
  command: 'status' | 'add' | 'commit' | 'diff' | 'log' | 'branch' | 'stash' | 'reset'
  args?: string[]
  cwd?: string
}): Promise<GitResult & { data?: any }> {
  const { command, args = [], cwd = process.cwd() } = params

  try {
    switch (command) {
      case 'status': {
        const status = await gitStatus(cwd)
        return { success: true, output: JSON.stringify(status, null, 2), data: status }
      }
      case 'add': {
        return await gitAdd({ files: args, cwd })
      }
      case 'commit': {
        const message = args.find((a, i) => args[i - 1] === '-m') || args[0] || 'Auto-commit'
        return await gitCommit({ message, cwd })
      }
      case 'diff': {
        const staged = args.includes('--staged') || args.includes('--cached')
        const diff = await gitDiff({ cwd, staged })
        return { success: true, output: JSON.stringify(diff, null, 2), data: diff }
      }
      case 'log': {
        const maxCount = parseInt(args.find((a) => /^\d+$/.test(a)) || '20', 10)
        const commits = await gitLog({ cwd, maxCount })
        return { success: true, output: JSON.stringify(commits, null, 2), data: commits }
      }
      case 'branch': {
        const action = args[0] as 'list' | 'create' | 'delete' | 'checkout' || 'list'
        const name = args[1]
        return await gitBranch({ action, name, cwd })
      }
      case 'stash': {
        const action = (args[0] || 'push') as 'push' | 'pop' | 'list' | 'drop'
        const message = args[1]
        return await gitStash({ action, message, cwd })
      }
      case 'reset': {
        const hard = args.includes('--hard')
        const files = args.filter((a) => !a.startsWith('-'))
        return await gitReset({ files, hard, cwd })
      }
      default:
        return { success: false, output: '', error: `Unknown git command: ${command}` }
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export default {
  status: gitStatus,
  diff: gitDiff,
  log: gitLog,
  add: gitAdd,
  commit: gitCommit,
  reset: gitReset,
  stash: gitStash,
  branch: gitBranch,
  git: repoGit,
}
