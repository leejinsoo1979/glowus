/**
 * Context Engineering System
 * Intelligent context gathering that surpasses Cursor and Claude Code
 *
 * Key Features:
 * 1. Relevance Scoring - 관련성 점수로 컨텍스트 우선순위 결정
 * 2. Dependency Graph - 파일 간 의존성 추적
 * 3. Symbol Resolution - 심볼 정의 및 참조 해결
 * 4. Smart Truncation - 토큰 제한 내에서 최대 정보량 유지
 * 5. Incremental Context - 대화 진행에 따른 컨텍스트 누적
 */

import { repoSearch, repoRead, repoSymbols, repoTree, type SearchResult, type FileReadResult, type SymbolInfo } from './repo-tools'
import { gitStatus, type GitStatus } from './git-tools'

// ============================================
// Types
// ============================================

export interface ContextItem {
  type: 'file' | 'symbol' | 'search' | 'git' | 'tree' | 'diagnostic'
  path?: string
  content: string
  relevanceScore: number
  tokenEstimate: number
  metadata?: Record<string, unknown>
}

export interface ContextWindow {
  items: ContextItem[]
  totalTokens: number
  maxTokens: number
  utilization: number
}

export interface ContextRequest {
  query: string
  projectPath: string
  currentFile?: string
  selectedText?: string
  recentFiles?: string[]
  maxTokens?: number
  includeGit?: boolean
  includeTree?: boolean
  depth?: 'shallow' | 'medium' | 'deep'
}

export interface DependencyNode {
  path: string
  imports: string[]
  importedBy: string[]
  depth: number
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>
  rootFile: string
}

// ============================================
// Token Estimation
// ============================================

const AVG_CHARS_PER_TOKEN = 4 // Claude/GPT average

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN)
}

// ============================================
// Relevance Scoring
// ============================================

interface RelevanceFactors {
  queryMatch: number      // 0-1: 검색어 매칭 정도
  pathMatch: number       // 0-1: 파일 경로 관련성
  importDistance: number  // 0-1: import 거리 (가까울수록 높음)
  recency: number         // 0-1: 최근 수정/열람 여부
  symbolImportance: number // 0-1: 심볼 중요도 (export > local)
}

function calculateRelevanceScore(factors: Partial<RelevanceFactors>): number {
  const weights = {
    queryMatch: 0.35,
    pathMatch: 0.20,
    importDistance: 0.20,
    recency: 0.15,
    symbolImportance: 0.10,
  }

  let score = 0
  for (const [key, weight] of Object.entries(weights)) {
    score += (factors[key as keyof RelevanceFactors] || 0) * weight
  }

  return Math.min(1, Math.max(0, score))
}

// ============================================
// Context Gathering Strategies
// ============================================

/**
 * 현재 파일과 관련된 컨텍스트 수집
 */
async function gatherFileContext(
  filePath: string,
  projectPath: string
): Promise<ContextItem[]> {
  const items: ContextItem[] = []

  // 1. 파일 내용 읽기
  const fileResult = await repoRead({ file: filePath })
  if (fileResult.success && fileResult.result) {
    items.push({
      type: 'file',
      path: filePath,
      content: formatFileContent(fileResult.result),
      relevanceScore: 1.0, // 현재 파일은 최고 관련성
      tokenEstimate: estimateTokens(fileResult.result.content),
    })

    // 2. 심볼 추출
    const symbols = await repoSymbols({ file: filePath })
    if (symbols.success && symbols.symbols.length > 0) {
      // 중요 심볼만 포함 (exported functions, classes)
      const importantSymbols = symbols.symbols.filter(s => s.exported)
      if (importantSymbols.length > 0) {
        items.push({
          type: 'symbol',
          path: filePath,
          content: formatSymbols(importantSymbols),
          relevanceScore: 0.9,
          tokenEstimate: estimateTokens(JSON.stringify(importantSymbols)),
          metadata: { symbolCount: importantSymbols.length },
        })
      }
    }
  }

  // 3. Import된 파일들 추적
  const imports = await extractImports(filePath)
  for (const importPath of imports.slice(0, 5)) { // 상위 5개만
    const importedFile = await repoRead({ file: importPath })
    if (importedFile.success && importedFile.result) {
      items.push({
        type: 'file',
        path: importPath,
        content: formatFileContent(importedFile.result),
        relevanceScore: 0.7,
        tokenEstimate: estimateTokens(importedFile.result.content),
        metadata: { relationship: 'imported' },
      })
    }
  }

  return items
}

/**
 * 검색 쿼리 기반 컨텍스트 수집
 */
async function gatherSearchContext(
  query: string,
  projectPath: string,
  depth: 'shallow' | 'medium' | 'deep'
): Promise<ContextItem[]> {
  const items: ContextItem[] = []
  const maxResults = depth === 'shallow' ? 5 : depth === 'medium' ? 15 : 30

  // 1. 코드 내용 검색
  const contentSearch = await repoSearch({
    query,
    path: projectPath,
    type: 'content',
    maxResults,
    includeContext: true,
  })

  if (contentSearch.success) {
    // 파일별로 그룹화
    const fileGroups = new Map<string, SearchResult[]>()
    for (const result of contentSearch.results) {
      const existing = fileGroups.get(result.file) || []
      existing.push(result)
      fileGroups.set(result.file, existing)
    }

    for (const [file, matches] of fileGroups) {
      const matchContent = matches.map(m =>
        `Line ${m.line}: ${m.content}\n${m.context.before.join('\n')}\n>>> ${m.content}\n${m.context.after.join('\n')}`
      ).join('\n---\n')

      items.push({
        type: 'search',
        path: file,
        content: `=== ${file} (${matches.length} matches) ===\n${matchContent}`,
        relevanceScore: calculateRelevanceScore({
          queryMatch: 0.9,
          pathMatch: file.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0.3,
        }),
        tokenEstimate: estimateTokens(matchContent),
        metadata: { matchCount: matches.length },
      })
    }
  }

  // 2. 심볼 검색
  const symbolSearch = await repoSearch({
    query,
    path: projectPath,
    type: 'symbol',
    maxResults: Math.floor(maxResults / 2),
  })

  if (symbolSearch.success) {
    for (const result of symbolSearch.results) {
      items.push({
        type: 'symbol',
        path: result.file,
        content: `${result.file}:${result.line} - ${result.content}`,
        relevanceScore: calculateRelevanceScore({
          queryMatch: 0.95,
          symbolImportance: result.content.includes('export') ? 0.9 : 0.5,
        }),
        tokenEstimate: estimateTokens(result.content),
      })
    }
  }

  return items
}

/**
 * 프로젝트 구조 컨텍스트
 */
async function gatherStructureContext(projectPath: string): Promise<ContextItem> {
  const tree = await repoTree({ path: projectPath, depth: 3 })

  return {
    type: 'tree',
    content: `=== Project Structure ===\n${tree.tree}`,
    relevanceScore: 0.5,
    tokenEstimate: estimateTokens(tree.tree),
    metadata: { fileCount: tree.files.length },
  }
}

/**
 * Git 상태 컨텍스트
 */
async function gatherGitContext(projectPath: string): Promise<ContextItem> {
  const status = await gitStatus(projectPath)

  const content = formatGitStatus(status)

  return {
    type: 'git',
    content,
    relevanceScore: 0.6,
    tokenEstimate: estimateTokens(content),
    metadata: {
      branch: status.branch,
      hasChanges: status.staged.length > 0 || status.unstaged.length > 0,
    },
  }
}

// ============================================
// Main Context Engine
// ============================================

export async function gatherContext(request: ContextRequest): Promise<ContextWindow> {
  const {
    query,
    projectPath,
    currentFile,
    selectedText,
    recentFiles = [],
    maxTokens = 100000, // 약 100K 토큰 (Claude의 context window 고려)
    includeGit = true,
    includeTree = true,
    depth = 'medium',
  } = request

  const allItems: ContextItem[] = []

  // 1. 현재 파일 컨텍스트 (최우선)
  if (currentFile) {
    const fileItems = await gatherFileContext(currentFile, projectPath)
    allItems.push(...fileItems)
  }

  // 2. 선택된 텍스트가 있으면 관련 검색
  if (selectedText) {
    const selectionItems = await gatherSearchContext(selectedText, projectPath, 'shallow')
    allItems.push(...selectionItems)
  }

  // 3. 쿼리 기반 검색
  const queryItems = await gatherSearchContext(query, projectPath, depth)
  allItems.push(...queryItems)

  // 4. 최근 파일들
  for (const recentFile of recentFiles.slice(0, 3)) {
    if (recentFile !== currentFile) {
      const recentItems = await gatherFileContext(recentFile, projectPath)
      recentItems.forEach(item => {
        item.relevanceScore *= 0.8 // 최근 파일은 약간 낮은 관련성
      })
      allItems.push(...recentItems)
    }
  }

  // 5. 프로젝트 구조
  if (includeTree) {
    allItems.push(await gatherStructureContext(projectPath))
  }

  // 6. Git 상태
  if (includeGit) {
    allItems.push(await gatherGitContext(projectPath))
  }

  // 중복 제거 및 정렬
  const uniqueItems = deduplicateItems(allItems)
  const sortedItems = uniqueItems.sort((a, b) => b.relevanceScore - a.relevanceScore)

  // 토큰 제한 내에서 최대한 포함
  return buildContextWindow(sortedItems, maxTokens)
}

// ============================================
// Helper Functions
// ============================================

function formatFileContent(result: FileReadResult): string {
  const header = `=== ${result.path} (${result.language}, ${result.lines} lines) ===`
  return `${header}\n\`\`\`${result.language}\n${result.content}\n\`\`\``
}

function formatSymbols(symbols: SymbolInfo[]): string {
  return symbols.map(s =>
    `${s.kind} ${s.name}${s.exported ? ' (exported)' : ''} @ ${s.location.file}:${s.location.line}`
  ).join('\n')
}

function formatGitStatus(status: GitStatus): string {
  const lines = [
    `=== Git Status ===`,
    `Branch: ${status.branch}`,
    status.ahead > 0 ? `Ahead: ${status.ahead}` : null,
    status.behind > 0 ? `Behind: ${status.behind}` : null,
    status.staged.length > 0 ? `Staged: ${status.staged.map(f => `${f.status[0].toUpperCase()} ${f.path}`).join(', ')}` : null,
    status.unstaged.length > 0 ? `Modified: ${status.unstaged.map(f => f.path).join(', ')}` : null,
    status.untracked.length > 0 ? `Untracked: ${status.untracked.join(', ')}` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

async function extractImports(filePath: string): Promise<string[]> {
  const imports: string[] = []

  try {
    const file = await repoRead({ file: filePath })
    if (!file.success || !file.result) return imports

    const content = file.result.content
    const importRegex = /(?:import|require)\s*(?:\(?\s*['"]([^'"]+)['"]|.*from\s*['"]([^'"]+)['"])/g

    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1] || match[2]
      if (importPath && !importPath.startsWith('.')) continue // Skip node_modules

      // Resolve relative path
      if (importPath) {
        const resolved = resolveImportPath(filePath, importPath)
        if (resolved) imports.push(resolved)
      }
    }
  } catch {
    // Ignore errors
  }

  return imports
}

function resolveImportPath(currentFile: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null

  const path = require('path')
  const dir = path.dirname(currentFile)
  let resolved = path.resolve(dir, importPath)

  // Add extension if missing
  if (!path.extname(resolved)) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']
    for (const ext of extensions) {
      const withExt = resolved + ext
      try {
        require('fs').accessSync(withExt)
        return withExt
      } catch {
        continue
      }
    }
  }

  return resolved
}

function deduplicateItems(items: ContextItem[]): ContextItem[] {
  const seen = new Map<string, ContextItem>()

  for (const item of items) {
    const key = `${item.type}:${item.path || item.content.slice(0, 100)}`

    if (!seen.has(key) || seen.get(key)!.relevanceScore < item.relevanceScore) {
      seen.set(key, item)
    }
  }

  return Array.from(seen.values())
}

function buildContextWindow(items: ContextItem[], maxTokens: number): ContextWindow {
  const result: ContextItem[] = []
  let totalTokens = 0

  for (const item of items) {
    if (totalTokens + item.tokenEstimate > maxTokens) {
      // 토큰 초과 시 truncate 시도
      const remainingTokens = maxTokens - totalTokens
      if (remainingTokens > 500) { // 최소 500 토큰은 있어야 의미있음
        const truncatedContent = truncateContent(item.content, remainingTokens)
        result.push({
          ...item,
          content: truncatedContent + '\n... (truncated)',
          tokenEstimate: remainingTokens,
        })
        totalTokens = maxTokens
      }
      break
    }

    result.push(item)
    totalTokens += item.tokenEstimate
  }

  return {
    items: result,
    totalTokens,
    maxTokens,
    utilization: totalTokens / maxTokens,
  }
}

function truncateContent(content: string, maxTokens: number): string {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN
  if (content.length <= maxChars) return content

  // 줄 단위로 truncate
  const lines = content.split('\n')
  let result = ''

  for (const line of lines) {
    if (result.length + line.length + 1 > maxChars) break
    result += line + '\n'
  }

  return result.trim()
}

// ============================================
// Context Formatter for LLM
// ============================================

export function formatContextForLLM(window: ContextWindow): string {
  const sections: string[] = [
    `<context utilization="${(window.utilization * 100).toFixed(1)}%" tokens="${window.totalTokens}">`,
  ]

  // 타입별로 그룹화
  const byType = new Map<string, ContextItem[]>()
  for (const item of window.items) {
    const existing = byType.get(item.type) || []
    existing.push(item)
    byType.set(item.type, existing)
  }

  // 순서: file → symbol → search → git → tree
  const typeOrder = ['file', 'symbol', 'search', 'git', 'tree', 'diagnostic']

  for (const type of typeOrder) {
    const items = byType.get(type)
    if (!items || items.length === 0) continue

    sections.push(`\n<${type}_context>`)
    for (const item of items) {
      sections.push(item.content)
    }
    sections.push(`</${type}_context>`)
  }

  sections.push('\n</context>')

  return sections.join('\n')
}

export default {
  gatherContext,
  formatContextForLLM,
  estimateTokens,
}
