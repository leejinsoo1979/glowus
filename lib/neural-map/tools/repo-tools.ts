/**
 * Repository Tools - Real File System Operations
 * Cursor/Claude Code 수준의 코드베이스 조작 도구
 */

import { promises as fs } from 'fs'
import path from 'path'
import { glob } from 'glob'

// ============================================
// Types
// ============================================

export interface SearchResult {
  file: string
  line: number
  column: number
  content: string
  context: {
    before: string[]
    after: string[]
  }
}

export interface FileReadResult {
  path: string
  content: string
  language: string
  lines: number
  size: number
}

export interface SymbolInfo {
  name: string
  kind: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'method' | 'property' | 'import' | 'export'
  location: {
    file: string
    line: number
    column: number
    endLine?: number
  }
  signature?: string
  exported?: boolean
}

export interface PatchOperation {
  op: 'create' | 'modify' | 'delete' | 'rename'
  path: string
  oldPath?: string
  content?: string
  changes?: PatchChange[]
}

export interface PatchChange {
  oldText: string
  newText: string
  startLine?: number
  endLine?: number
}

export interface PatchResult {
  success: boolean
  filesModified: string[]
  errors: string[]
  diff: string
}

// ============================================
// File Search Tool
// ============================================

export async function repoSearch(params: {
  query: string
  path?: string
  type?: 'file' | 'content' | 'symbol'
  maxResults?: number
  includeContext?: boolean
}): Promise<{ success: boolean; results: SearchResult[]; totalMatches: number }> {
  const { query, path: searchPath = '.', type = 'content', maxResults = 50, includeContext = true } = params
  const results: SearchResult[] = []

  try {
    const basePath = path.resolve(searchPath)

    if (type === 'file') {
      // File name search using glob
      const pattern = `**/*${query}*`
      const files = await glob(pattern, {
        cwd: basePath,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'],
        maxDepth: 10,
      })

      for (const file of files.slice(0, maxResults)) {
        results.push({
          file: path.join(basePath, file),
          line: 0,
          column: 0,
          content: file,
          context: { before: [], after: [] },
        })
      }
    } else if (type === 'content') {
      // Content search using ripgrep-like approach
      const files = await glob('**/*.{ts,tsx,js,jsx,json,md,css,scss,py,go,rs}', {
        cwd: basePath,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'],
      })

      for (const file of files) {
        const filePath = path.join(basePath, file)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            const idx = line.toLowerCase().indexOf(query.toLowerCase())
            if (idx !== -1) {
              results.push({
                file: filePath,
                line: i + 1,
                column: idx + 1,
                content: line.trim(),
                context: includeContext
                  ? {
                      before: lines.slice(Math.max(0, i - 2), i).map((l) => l.trim()),
                      after: lines.slice(i + 1, Math.min(lines.length, i + 3)).map((l) => l.trim()),
                    }
                  : { before: [], after: [] },
              })

              if (results.length >= maxResults) break
            }
          }
        } catch {
          // Skip unreadable files
        }
        if (results.length >= maxResults) break
      }
    } else if (type === 'symbol') {
      // Symbol search - find function/class/variable definitions
      const symbolPatterns = [
        `function\\s+${query}`,
        `const\\s+${query}\\s*=`,
        `let\\s+${query}\\s*=`,
        `class\\s+${query}`,
        `interface\\s+${query}`,
        `type\\s+${query}\\s*=`,
        `export\\s+(default\\s+)?function\\s+${query}`,
        `export\\s+(default\\s+)?class\\s+${query}`,
        `export\\s+const\\s+${query}`,
      ]

      const regex = new RegExp(symbolPatterns.join('|'), 'i')

      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: basePath,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      })

      for (const file of files) {
        const filePath = path.join(basePath, file)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                file: filePath,
                line: i + 1,
                column: 1,
                content: lines[i].trim(),
                context: {
                  before: lines.slice(Math.max(0, i - 2), i).map((l) => l.trim()),
                  after: lines.slice(i + 1, Math.min(lines.length, i + 5)).map((l) => l.trim()),
                },
              })
              if (results.length >= maxResults) break
            }
          }
        } catch {
          // Skip
        }
        if (results.length >= maxResults) break
      }
    }

    return { success: true, results, totalMatches: results.length }
  } catch (error) {
    return { success: false, results: [], totalMatches: 0 }
  }
}

// ============================================
// File Read Tool
// ============================================

export async function repoRead(params: {
  file: string
  startLine?: number
  endLine?: number
}): Promise<{ success: boolean; result: FileReadResult | null; error?: string }> {
  const { file, startLine, endLine } = params

  try {
    const filePath = path.resolve(file)
    const content = await fs.readFile(filePath, 'utf-8')
    const stats = await fs.stat(filePath)
    const lines = content.split('\n')

    let resultContent = content
    if (startLine !== undefined || endLine !== undefined) {
      const start = (startLine ?? 1) - 1
      const end = endLine ?? lines.length
      resultContent = lines.slice(start, end).join('\n')
    }

    // Detect language from extension
    const ext = path.extname(file).slice(1)
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      json: 'json',
      md: 'markdown',
      css: 'css',
      scss: 'scss',
      html: 'html',
      sql: 'sql',
    }

    return {
      success: true,
      result: {
        path: filePath,
        content: resultContent,
        language: languageMap[ext] || 'text',
        lines: lines.length,
        size: stats.size,
      },
    }
  } catch (error) {
    return {
      success: false,
      result: null,
      error: error instanceof Error ? error.message : 'Failed to read file',
    }
  }
}

// ============================================
// Symbol Extraction Tool
// ============================================

export async function repoSymbols(params: {
  file?: string
  name?: string
  kind?: string
}): Promise<{ success: boolean; symbols: SymbolInfo[]; error?: string }> {
  const { file, name, kind } = params
  const symbols: SymbolInfo[] = []

  try {
    const filesToAnalyze: string[] = []

    if (file) {
      filesToAnalyze.push(path.resolve(file))
    } else if (name) {
      // Search for symbol across codebase
      const searchResult = await repoSearch({ query: name, type: 'symbol', maxResults: 20 })
      filesToAnalyze.push(...searchResult.results.map((r) => r.file))
    }

    for (const filePath of filesToAnalyze) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const extractedSymbols = extractSymbolsFromCode(content, filePath)

        // Filter by name/kind if specified
        const filtered = extractedSymbols.filter((s) => {
          if (name && !s.name.toLowerCase().includes(name.toLowerCase())) return false
          if (kind && s.kind !== kind) return false
          return true
        })

        symbols.push(...filtered)
      } catch {
        // Skip unreadable files
      }
    }

    return { success: true, symbols }
  } catch (error) {
    return {
      success: false,
      symbols: [],
      error: error instanceof Error ? error.message : 'Failed to extract symbols',
    }
  }
}

function extractSymbolsFromCode(code: string, filePath: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = []
  const lines = code.split('\n')

  const patterns: { regex: RegExp; kind: SymbolInfo['kind']; exported?: boolean }[] = [
    { regex: /^export\s+(async\s+)?function\s+(\w+)/m, kind: 'function', exported: true },
    { regex: /^export\s+default\s+(async\s+)?function\s+(\w+)?/m, kind: 'function', exported: true },
    { regex: /^(async\s+)?function\s+(\w+)/m, kind: 'function' },
    { regex: /^export\s+class\s+(\w+)/m, kind: 'class', exported: true },
    { regex: /^class\s+(\w+)/m, kind: 'class' },
    { regex: /^export\s+interface\s+(\w+)/m, kind: 'interface', exported: true },
    { regex: /^interface\s+(\w+)/m, kind: 'interface' },
    { regex: /^export\s+type\s+(\w+)/m, kind: 'type', exported: true },
    { regex: /^type\s+(\w+)/m, kind: 'type' },
    { regex: /^export\s+const\s+(\w+)/m, kind: 'variable', exported: true },
    { regex: /^const\s+(\w+)\s*=/m, kind: 'variable' },
    { regex: /^export\s+let\s+(\w+)/m, kind: 'variable', exported: true },
    { regex: /^let\s+(\w+)\s*=/m, kind: 'variable' },
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const { regex, kind, exported } of patterns) {
      const match = line.match(regex)
      if (match) {
        const name = match[match.length - 1] || match[match.length - 2]
        if (name && !symbols.find((s) => s.name === name && s.location.line === i + 1)) {
          symbols.push({
            name,
            kind,
            location: { file: filePath, line: i + 1, column: 1 },
            signature: line.trim(),
            exported,
          })
        }
      }
    }
  }

  return symbols
}

// ============================================
// File Patch Tool (Create/Modify/Delete)
// ============================================

export async function repoPatch(params: {
  operations: PatchOperation[]
  dryRun?: boolean
}): Promise<PatchResult> {
  const { operations, dryRun = false } = params
  const filesModified: string[] = []
  const errors: string[] = []
  const diffs: string[] = []

  for (const op of operations) {
    const filePath = path.resolve(op.path)

    try {
      switch (op.op) {
        case 'create': {
          if (!op.content) {
            errors.push(`${op.path}: No content provided for create operation`)
            continue
          }

          // Ensure directory exists
          const dir = path.dirname(filePath)
          if (!dryRun) {
            await fs.mkdir(dir, { recursive: true })
            await fs.writeFile(filePath, op.content, 'utf-8')
          }

          diffs.push(`+++ ${op.path}\n@@ -0,0 +1,${op.content.split('\n').length} @@\n${op.content
            .split('\n')
            .map((l) => `+ ${l}`)
            .join('\n')}`)
          filesModified.push(filePath)
          break
        }

        case 'modify': {
          if (!op.changes || op.changes.length === 0) {
            errors.push(`${op.path}: No changes provided for modify operation`)
            continue
          }

          let content = await fs.readFile(filePath, 'utf-8')
          const originalContent = content

          for (const change of op.changes) {
            if (!content.includes(change.oldText)) {
              errors.push(`${op.path}: Could not find text to replace: "${change.oldText.slice(0, 50)}..."`)
              continue
            }
            content = content.replace(change.oldText, change.newText)
          }

          if (!dryRun && content !== originalContent) {
            await fs.writeFile(filePath, content, 'utf-8')
          }

          // Generate diff
          diffs.push(generateDiff(originalContent, content, op.path))
          filesModified.push(filePath)
          break
        }

        case 'delete': {
          if (!dryRun) {
            await fs.unlink(filePath)
          }
          diffs.push(`--- ${op.path}\n(deleted)`)
          filesModified.push(filePath)
          break
        }

        case 'rename': {
          if (!op.oldPath) {
            errors.push(`${op.path}: No oldPath provided for rename operation`)
            continue
          }
          const oldFilePath = path.resolve(op.oldPath)
          if (!dryRun) {
            await fs.rename(oldFilePath, filePath)
          }
          diffs.push(`${op.oldPath} → ${op.path}`)
          filesModified.push(filePath)
          break
        }
      }
    } catch (error) {
      errors.push(`${op.path}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    success: errors.length === 0,
    filesModified,
    errors,
    diff: diffs.join('\n\n'),
  }
}

function generateDiff(oldContent: string, newContent: string, filePath: string): string {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const diff: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`]

  // Simple line-by-line diff (not a full unified diff, but shows changes)
  let i = 0, j = 0
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      diff.push(`+ ${newLines[j]}`)
      j++
    } else if (j >= newLines.length) {
      diff.push(`- ${oldLines[i]}`)
      i++
    } else if (oldLines[i] === newLines[j]) {
      diff.push(`  ${oldLines[i]}`)
      i++
      j++
    } else {
      diff.push(`- ${oldLines[i]}`)
      diff.push(`+ ${newLines[j]}`)
      i++
      j++
    }
  }

  return diff.join('\n')
}

// ============================================
// Directory Tree Tool
// ============================================

export async function repoTree(params: {
  path?: string
  depth?: number
  includeHidden?: boolean
}): Promise<{ success: boolean; tree: string; files: string[] }> {
  const { path: rootPath = '.', depth = 3, includeHidden = false } = params
  const basePath = path.resolve(rootPath)
  const files: string[] = []
  const lines: string[] = []

  async function walk(dir: string, prefix: string, currentDepth: number) {
    if (currentDepth > depth) return

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const filtered = entries.filter((e) => {
        if (!includeHidden && e.name.startsWith('.')) return false
        if (['node_modules', 'dist', '.next', '.git', '__pycache__'].includes(e.name)) return false
        return true
      })

      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i]
        const isLast = i === filtered.length - 1
        const connector = isLast ? '└── ' : '├── '
        const newPrefix = prefix + (isLast ? '    ' : '│   ')
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(basePath, fullPath)

        if (entry.isDirectory()) {
          lines.push(`${prefix}${connector}${entry.name}/`)
          await walk(fullPath, newPrefix, currentDepth + 1)
        } else {
          lines.push(`${prefix}${connector}${entry.name}`)
          files.push(relativePath)
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  await walk(basePath, '', 0)

  return {
    success: true,
    tree: lines.join('\n'),
    files,
  }
}

export default {
  search: repoSearch,
  read: repoRead,
  symbols: repoSymbols,
  patch: repoPatch,
  tree: repoTree,
}
