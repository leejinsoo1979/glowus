import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

export const runtime = 'nodejs'

interface ProjectContext {
  projectName: string
  projectPath: string
  packageJson?: {
    name: string
    version: string
    description?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    scripts?: Record<string, string>
  }
  gitInfo?: {
    branch: string
    status: string[]
    recentCommits: Array<{
      hash: string
      message: string
      date: string
    }>
    diff?: string
  }
  structure: {
    directories: string[]
    mainFiles: string[]
  }
  recentFiles?: Array<{
    path: string
    modified: string
  }>
  todos?: Array<{
    file: string
    line: number
    text: string
    type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE'
  }>
}

async function safeExec(command: string, cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command, { cwd, timeout: 10000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function getPackageJson(cwd: string): Promise<ProjectContext['packageJson'] | undefined> {
  const packagePath = path.join(cwd, 'package.json')
  if (await fileExists(packagePath)) {
    try {
      const content = await fs.readFile(packagePath, 'utf-8')
      const pkg = JSON.parse(content)
      return {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
        scripts: pkg.scripts
      }
    } catch {
      return undefined
    }
  }
  return undefined
}

async function getGitInfo(cwd: string): Promise<ProjectContext['gitInfo'] | undefined> {
  // Check if it's a git repo
  const isGit = await fileExists(path.join(cwd, '.git'))
  if (!isGit) return undefined

  const [branch, statusRaw, logRaw, diff] = await Promise.all([
    safeExec('git rev-parse --abbrev-ref HEAD', cwd),
    safeExec('git status --porcelain', cwd),
    safeExec('git log --oneline -10 --format="%h|%s|%ad" --date=relative', cwd),
    safeExec('git diff --stat HEAD~3 2>/dev/null || git diff --stat', cwd)
  ])

  const status = statusRaw.split('\n').filter(Boolean)
  const recentCommits = logRaw.split('\n').filter(Boolean).map(line => {
    const [hash, message, date] = line.split('|')
    return { hash, message, date }
  })

  return {
    branch,
    status,
    recentCommits,
    diff: diff || undefined
  }
}

async function getProjectStructure(cwd: string): Promise<ProjectContext['structure']> {
  // Get top-level directories
  const dirOutput = await safeExec('find . -maxdepth 2 -type d -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" | head -50', cwd)
  const directories = dirOutput.split('\n').filter(d => d && d !== '.')

  // Get main files
  const mainFiles: string[] = []
  const importantFiles = [
    'package.json', 'tsconfig.json', 'next.config.js', 'next.config.mjs',
    'tailwind.config.js', 'tailwind.config.ts', '.env.example',
    'README.md', 'CLAUDE.md', 'Dockerfile', 'docker-compose.yml'
  ]

  for (const file of importantFiles) {
    if (await fileExists(path.join(cwd, file))) {
      mainFiles.push(file)
    }
  }

  return { directories, mainFiles }
}

async function getRecentFiles(cwd: string): Promise<ProjectContext['recentFiles']> {
  const output = await safeExec(
    'find . -type f -mmin -60 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" -not -name "*.log" | head -20',
    cwd
  )

  if (!output) return []

  const files = output.split('\n').filter(Boolean)
  const result: ProjectContext['recentFiles'] = []

  for (const file of files) {
    try {
      const fullPath = path.join(cwd, file)
      const stat = await fs.stat(fullPath)
      result.push({
        path: file,
        modified: stat.mtime.toISOString()
      })
    } catch {
      // Skip files that can't be accessed
    }
  }

  return result.sort((a, b) =>
    new Date(b.modified).getTime() - new Date(a.modified).getTime()
  )
}

async function getTodos(cwd: string): Promise<ProjectContext['todos']> {
  const output = await safeExec(
    'grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -E "(TODO|FIXME|HACK|NOTE):" . 2>/dev/null | head -30',
    cwd
  )

  if (!output) return []

  return output.split('\n').filter(Boolean).map(line => {
    const match = line.match(/^\.\/(.+):(\d+):\s*.*?(TODO|FIXME|HACK|NOTE):\s*(.+)$/)
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        type: match[3] as 'TODO' | 'FIXME' | 'HACK' | 'NOTE',
        text: match[4].trim()
      }
    }
    return null
  }).filter(Boolean) as ProjectContext['todos']
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const cwd = searchParams.get('cwd') || process.cwd()

  try {
    // Validate path exists
    if (!await fileExists(cwd)) {
      return NextResponse.json({ error: 'Path not found' }, { status: 404 })
    }

    // Collect all context in parallel
    const [packageJson, gitInfo, structure, recentFiles, todos] = await Promise.all([
      getPackageJson(cwd),
      getGitInfo(cwd),
      getProjectStructure(cwd),
      getRecentFiles(cwd),
      getTodos(cwd)
    ])

    const context: ProjectContext = {
      projectName: path.basename(cwd),
      projectPath: cwd,
      packageJson,
      gitInfo,
      structure,
      recentFiles,
      todos
    }

    return NextResponse.json(context)
  } catch (error: any) {
    console.error('[Context API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to collect context' },
      { status: 500 }
    )
  }
}

// POST: Generate context as system prompt for Claude
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { cwd, includeGit = true, includeTodos = true, includeRecent = true } = body

  const targetCwd = cwd || process.cwd()

  try {
    const [packageJson, gitInfo, structure, recentFiles, todos] = await Promise.all([
      getPackageJson(targetCwd),
      includeGit ? getGitInfo(targetCwd) : undefined,
      getProjectStructure(targetCwd),
      includeRecent ? getRecentFiles(targetCwd) : undefined,
      includeTodos ? getTodos(targetCwd) : undefined
    ])

    // Build system prompt
    let prompt = `# 프로젝트 컨텍스트\n\n`
    prompt += `**프로젝트**: ${path.basename(targetCwd)}\n`
    prompt += `**경로**: ${targetCwd}\n\n`

    if (packageJson) {
      prompt += `## Package Info\n`
      prompt += `- Name: ${packageJson.name}\n`
      prompt += `- Version: ${packageJson.version}\n`
      if (packageJson.description) {
        prompt += `- Description: ${packageJson.description}\n`
      }
      prompt += `\n### 주요 스크립트\n`
      if (packageJson.scripts) {
        Object.entries(packageJson.scripts).slice(0, 10).forEach(([name, cmd]) => {
          prompt += `- \`${name}\`: ${cmd}\n`
        })
      }
      prompt += `\n`
    }

    if (gitInfo) {
      prompt += `## Git 상태\n`
      prompt += `- 브랜치: ${gitInfo.branch}\n`
      if (gitInfo.status.length > 0) {
        prompt += `- 변경된 파일 (${gitInfo.status.length}개):\n`
        gitInfo.status.slice(0, 15).forEach(s => {
          prompt += `  - ${s}\n`
        })
      }
      if (gitInfo.recentCommits.length > 0) {
        prompt += `\n### 최근 커밋\n`
        gitInfo.recentCommits.slice(0, 5).forEach(c => {
          prompt += `- ${c.hash}: ${c.message} (${c.date})\n`
        })
      }
      prompt += `\n`
    }

    if (structure.directories.length > 0) {
      prompt += `## 프로젝트 구조\n`
      prompt += `주요 디렉토리:\n`
      structure.directories.slice(0, 20).forEach(d => {
        prompt += `- ${d}\n`
      })
      prompt += `\n주요 파일: ${structure.mainFiles.join(', ')}\n\n`
    }

    if (recentFiles && recentFiles.length > 0) {
      prompt += `## 최근 수정된 파일\n`
      recentFiles.slice(0, 10).forEach(f => {
        prompt += `- ${f.path}\n`
      })
      prompt += `\n`
    }

    if (todos && todos.length > 0) {
      prompt += `## TODO/FIXME 목록\n`
      todos.slice(0, 15).forEach(t => {
        prompt += `- [${t.type}] ${t.file}:${t.line} - ${t.text}\n`
      })
      prompt += `\n`
    }

    return NextResponse.json({
      systemPrompt: prompt,
      raw: {
        projectName: path.basename(targetCwd),
        projectPath: targetCwd,
        packageJson,
        gitInfo,
        structure,
        recentFiles,
        todos
      }
    })
  } catch (error: any) {
    console.error('[Context API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate context' },
      { status: 500 }
    )
  }
}
