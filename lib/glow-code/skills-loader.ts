/**
 * Claude Code Skills Loader
 *
 * 프로젝트의 .claude/skills/ 폴더에서 스킬 파일들을 로드하여
 * 시스템 프롬프트에 포함시킵니다.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'

// ============================================
// Types
// ============================================

export interface ProjectContext {
  projectName: string
  projectPath: string
  techStack: string[]
  structure: string
  gitStatus: string
  gitBranch: string
  recentFiles: string[]
  todos: string[]
  claudeMd: string | null
  skills: Skill[]
  commands: string | null
  personas: string | null
}

export interface Skill {
  name: string
  content: string
  category?: string
}

// ============================================
// File System Helpers
// ============================================

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

function safeExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return ''
  }
}

// ============================================
// Skills Loader
// ============================================

/**
 * .claude/skills/ 폴더에서 스킬 파일들을 로드
 */
export async function loadSkills(projectPath: string): Promise<Skill[]> {
  const skillsDir = path.join(projectPath, '.claude', 'skills')

  if (!(await fileExists(skillsDir))) {
    return []
  }

  try {
    const files = await fs.readdir(skillsDir)
    const skills: Skill[] = []

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const content = await safeReadFile(path.join(skillsDir, file))
      if (!content) continue

      const name = file.replace('.md', '')

      // 카테고리 추출 (파일 첫 줄에서 # Category: xxx 형식)
      const categoryMatch = content.match(/^#\s*(\w+)/m)
      const category = categoryMatch ? categoryMatch[1].toLowerCase() : undefined

      skills.push({ name, content, category })
    }

    return skills
  } catch (error) {
    console.error('[Skills Loader] Failed to load skills:', error)
    return []
  }
}

// ============================================
// Project Context Builder
// ============================================

/**
 * 전체 프로젝트 컨텍스트 수집
 */
export async function buildProjectContext(projectPath: string): Promise<ProjectContext> {
  const projectName = path.basename(projectPath)

  // 병렬로 정보 수집
  const [
    packageJson,
    claudeMd,
    skills,
    commands,
    personas,
    gitStatus,
    gitBranch,
    structure,
    todos
  ] = await Promise.all([
    safeReadFile(path.join(projectPath, 'package.json')),
    safeReadFile(path.join(projectPath, '.claude', 'CLAUDE.md')) ||
    safeReadFile(path.join(projectPath, 'CLAUDE.md')),
    loadSkills(projectPath),
    safeReadFile(path.join(projectPath, '.claude', 'COMMANDS.md')),
    safeReadFile(path.join(projectPath, '.claude', 'PERSONAS.md')),
    Promise.resolve(safeExec('git status --porcelain', projectPath)),
    Promise.resolve(safeExec('git rev-parse --abbrev-ref HEAD', projectPath)),
    Promise.resolve(safeExec('find . -maxdepth 2 -type d -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" | head -30', projectPath)),
    Promise.resolve(safeExec('grep -r "TODO\\|FIXME" --include="*.ts" --include="*.tsx" . 2>/dev/null | head -15', projectPath))
  ])

  // Tech stack 추출
  let techStack: string[] = []
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      techStack = Object.keys(deps).slice(0, 20)
    } catch {}
  }

  // 최근 수정된 파일
  const recentFiles = safeExec('ls -t | head -15', projectPath).split('\n').filter(Boolean)

  return {
    projectName,
    projectPath,
    techStack,
    structure,
    gitStatus,
    gitBranch,
    recentFiles,
    todos: todos.split('\n').filter(Boolean),
    claudeMd,
    skills,
    commands,
    personas
  }
}

// ============================================
// System Prompt Builder
// ============================================

/**
 * 시스템 프롬프트 생성
 */
export function buildSystemPrompt(context: ProjectContext): string {
  const sections: string[] = []

  // 기본 지침
  sections.push(`
당신은 전문 소프트웨어 엔지니어입니다. 사용자의 코딩 프로젝트를 도와줍니다.

## 현재 환경
- **프로젝트**: ${context.projectName}
- **경로**: ${context.projectPath}
- **시간**: ${new Date().toISOString()}
${context.gitBranch ? `- **Git 브랜치**: ${context.gitBranch}` : ''}

## 규칙
1. 파일 수정 전 항상 현재 내용 확인
2. 큰 변경은 단계별로 진행
3. 에러 발생 시 원인 분석 후 해결책 제시
4. 코드 작성 시 한국어 주석 포함
5. 보안에 민감한 정보 노출 금지
6. ⚠️ **절대로** 응답 끝에 "더 궁금한 거 있으면 말씀해주세요", "무엇을 도와드릴까요?" 같은 뻔한 마무리 문구 금지. 필요한 내용만 전달하고 끝내라.
`.trim())

  // CLAUDE.md 포함
  if (context.claudeMd) {
    sections.push(`
## 프로젝트 지침 (CLAUDE.md)

${context.claudeMd}
`.trim())
  }

  // Tech stack
  if (context.techStack.length > 0) {
    sections.push(`
## 기술 스택

주요 의존성: ${context.techStack.slice(0, 15).join(', ')}
`.trim())
  }

  // 프로젝트 구조
  if (context.structure) {
    sections.push(`
## 프로젝트 구조

\`\`\`
${context.structure}
\`\`\`
`.trim())
  }

  // Git 상태
  if (context.gitStatus) {
    const changedFiles = context.gitStatus.split('\n').filter(Boolean)
    if (changedFiles.length > 0) {
      sections.push(`
## Git 변경 사항 (${changedFiles.length}개 파일)

\`\`\`
${changedFiles.slice(0, 15).join('\n')}
${changedFiles.length > 15 ? `... 외 ${changedFiles.length - 15}개` : ''}
\`\`\`
`.trim())
    }
  }

  // TODO 목록
  if (context.todos.length > 0) {
    sections.push(`
## TODO / FIXME

${context.todos.slice(0, 10).map(t => `- ${t.slice(0, 100)}`).join('\n')}
`.trim())
  }

  // Skills
  if (context.skills.length > 0) {
    sections.push(`
---

# 사용 가능한 스킬

작업 유형에 따라 아래 스킬 지침을 참고하세요.

${context.skills.map(skill => `
## Skill: ${skill.name}${skill.category ? ` (${skill.category})` : ''}

${skill.content}
`).join('\n\n---\n')}
`.trim())
  }

  // Custom commands
  if (context.commands) {
    sections.push(`
---

# 커스텀 명령어

${context.commands}
`.trim())
  }

  // Personas
  if (context.personas) {
    sections.push(`
---

# 페르소나 설정

${context.personas}
`.trim())
  }

  return sections.join('\n\n---\n\n')
}

// ============================================
// Memory System
// ============================================

export interface ConversationMemory {
  id: string
  type: 'fact' | 'preference' | 'context' | 'decision'
  content: string
  timestamp: number
  relevance: number
}

/**
 * 메모리 저장소 경로
 */
function getMemoryPath(projectPath: string): string {
  return path.join(projectPath, '.claude', 'memory.json')
}

/**
 * 메모리 로드
 */
export async function loadMemory(projectPath: string): Promise<ConversationMemory[]> {
  const memoryPath = getMemoryPath(projectPath)
  const content = await safeReadFile(memoryPath)

  if (!content) return []

  try {
    return JSON.parse(content)
  } catch {
    return []
  }
}

/**
 * 메모리 저장
 */
export async function saveMemory(
  projectPath: string,
  memories: ConversationMemory[]
): Promise<void> {
  const memoryPath = getMemoryPath(projectPath)
  const dir = path.dirname(memoryPath)

  try {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(memoryPath, JSON.stringify(memories, null, 2))
  } catch (error) {
    console.error('[Memory] Failed to save:', error)
  }
}

/**
 * 메모리 추가
 */
export async function addMemory(
  projectPath: string,
  memory: Omit<ConversationMemory, 'id' | 'timestamp'>
): Promise<void> {
  const memories = await loadMemory(projectPath)

  memories.push({
    ...memory,
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now()
  })

  // 최대 100개까지만 유지
  const trimmed = memories.slice(-100)
  await saveMemory(projectPath, trimmed)
}

/**
 * 관련 메모리 검색 (간단한 키워드 매칭)
 */
export async function findRelevantMemories(
  projectPath: string,
  query: string,
  limit: number = 10
): Promise<ConversationMemory[]> {
  const memories = await loadMemory(projectPath)
  const keywords = query.toLowerCase().split(/\s+/)

  const scored = memories.map(mem => {
    const content = mem.content.toLowerCase()
    const score = keywords.reduce((acc, kw) => {
      return acc + (content.includes(kw) ? 1 : 0)
    }, 0)
    return { ...mem, score }
  })

  return scored
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * 메모리 컨텍스트 문자열 생성
 */
export async function buildMemoryContext(
  projectPath: string,
  query: string
): Promise<string> {
  const relevant = await findRelevantMemories(projectPath, query, 5)

  if (relevant.length === 0) return ''

  return `
## 이전 대화에서 기억할 것들

${relevant.map(m => `- [${m.type}] ${m.content}`).join('\n')}
`.trim()
}

// ============================================
// Code Generation Templates
// ============================================

export interface CodeTemplate {
  name: string
  description: string
  files: Array<{
    path: string
    template: string
  }>
}

export const CODE_TEMPLATES: Record<string, CodeTemplate> = {
  component: {
    name: 'React Component',
    description: 'React 컴포넌트 생성',
    files: [
      {
        path: 'components/{name}/{name}.tsx',
        template: `'use client'

import React, { memo } from 'react'
import { cn } from '@/lib/utils'

interface {name}Props {
  className?: string
  children?: React.ReactNode
}

export const {name} = memo(function {name}({
  className,
  children,
}: {name}Props) {
  return (
    <div className={cn("", className)}>
      {children}
    </div>
  )
})

export default {name}
`
      },
      {
        path: 'components/{name}/index.ts',
        template: `export { {name} } from './{name}'
export type { {name}Props } from './{name}'
`
      }
    ]
  },

  api: {
    name: 'API Route',
    description: 'Next.js API Route 생성',
    files: [
      {
        path: 'app/api/{name}/route.ts',
        template: `import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface RequestBody {
  // TODO: Define request body type
}

interface ResponseData {
  success: boolean
  data?: unknown
  error?: string
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // TODO: Implement GET logic

    return NextResponse.json<ResponseData>({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('[API] GET /{name} error:', error)
    return NextResponse.json<ResponseData>(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json()

    // TODO: Implement POST logic

    return NextResponse.json<ResponseData>({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('[API] POST /{name} error:', error)
    return NextResponse.json<ResponseData>(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
`
      }
    ]
  },

  hook: {
    name: 'Custom Hook',
    description: '커스텀 훅 생성',
    files: [
      {
        path: 'hooks/use{Name}.ts',
        template: `import { useState, useEffect, useCallback } from 'react'

interface Use{Name}Options {
  // TODO: Define options
}

interface Use{Name}Return {
  data: unknown | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function use{Name}(options: Use{Name}Options = {}): Use{Name}Return {
  const [data, setData] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Implement fetch logic
      setData(null)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}
`
      }
    ]
  },

  store: {
    name: 'Zustand Store',
    description: 'Zustand 스토어 생성',
    files: [
      {
        path: 'stores/{name}Store.ts',
        template: `import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface {Name}State {
  // State
  items: string[]
  selectedId: string | null

  // Actions
  addItem: (item: string) => void
  removeItem: (item: string) => void
  setSelectedId: (id: string | null) => void
  reset: () => void
}

const initialState = {
  items: [],
  selectedId: null,
}

export const use{Name}Store = create<{Name}State>()(
  persist(
    (set) => ({
      ...initialState,

      addItem: (item) => set((state) => ({
        items: [...state.items, item]
      })),

      removeItem: (item) => set((state) => ({
        items: state.items.filter((i) => i !== item)
      })),

      setSelectedId: (id) => set({ selectedId: id }),

      reset: () => set(initialState),
    }),
    {
      name: '{name}-storage',
    }
  )
)
`
      }
    ]
  }
}

/**
 * 템플릿 적용
 */
export function applyTemplate(
  template: CodeTemplate,
  variables: Record<string, string>
): Array<{ path: string; content: string }> {
  return template.files.map(file => {
    let filePath = file.path
    let content = file.template

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g')
      filePath = filePath.replace(regex, value)
      content = content.replace(regex, value)

      // {Name} -> PascalCase
      const pascalRegex = new RegExp(`\\{${key.charAt(0).toUpperCase() + key.slice(1)}\\}`, 'g')
      const pascalValue = value.charAt(0).toUpperCase() + value.slice(1)
      filePath = filePath.replace(pascalRegex, pascalValue)
      content = content.replace(pascalRegex, pascalValue)
    }

    return { path: filePath, content }
  })
}
