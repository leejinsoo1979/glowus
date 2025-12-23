/**
 * AI Agent Tool Executor - 도구 실행 엔진
 */

import type { ToolCall, ToolResult } from './tools'

interface NeuralFile {
  id: string
  name: string
  path?: string
  content?: string
  type: string
}

interface ExecutorContext {
  files: NeuralFile[]
  projectPath?: string | null
  graph?: {
    title?: string
    nodes: Array<{
      id: string
      type: string
      title: string
      sourceRef?: { fileId: string }
    }>
  } | null
}

export class ToolExecutor {
  private files: NeuralFile[]
  private projectPath: string | null
  private graph: ExecutorContext['graph']

  constructor(context: ExecutorContext) {
    this.files = context.files
    this.projectPath = context.projectPath || null
    this.graph = context.graph
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const { name, arguments: args } = toolCall

    try {
      switch (name) {
        case 'read_file':
          return this.readFile(args.path as string)

        case 'search_files':
          return this.searchFiles(args.query as string, args.type as string)

        case 'get_file_structure':
          return this.getFileStructure(args.path as string, args.depth as number)

        case 'analyze_dependencies':
          return this.analyzeDependencies(args.path as string)

        case 'find_references':
          return this.findReferences(args.name as string)

        case 'get_project_summary':
          return this.getProjectSummary()

        default:
          return { success: false, error: `알 수 없는 도구: ${name}` }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  private readFile(path: string): ToolResult {
    // 경로로 찾기
    let file = this.files.find(f =>
      f.path === path ||
      f.path?.endsWith(path) ||
      f.name === path
    )

    // 부분 매칭
    if (!file) {
      file = this.files.find(f =>
        f.path?.toLowerCase().includes(path.toLowerCase()) ||
        f.name.toLowerCase().includes(path.toLowerCase())
      )
    }

    if (!file) {
      return {
        success: false,
        error: `파일을 찾을 수 없습니다: ${path}`,
        result: `사용 가능한 파일: ${this.files.slice(0, 20).map(f => f.path || f.name).join(', ')}`
      }
    }

    return {
      success: true,
      result: {
        path: file.path || file.name,
        content: file.content || '(내용 없음)',
        type: file.type,
        lines: file.content?.split('\n').length || 0
      }
    }
  }

  private searchFiles(query: string, type?: string): ToolResult {
    const results: Array<{
      path: string
      matches: string[]
      lineNumbers: number[]
    }> = []

    const queryLower = query.toLowerCase()

    for (const file of this.files) {
      const filePath = file.path || file.name
      const filePathLower = filePath.toLowerCase()
      const content = file.content || ''
      const contentLower = content.toLowerCase()

      // 파일명 검색
      if (!type || type === 'filename') {
        if (filePathLower.includes(queryLower)) {
          results.push({ path: filePath, matches: ['파일명 일치'], lineNumbers: [] })
          continue
        }
      }

      // 내용 검색
      if (!type || type === 'content' || type === 'function' || type === 'import') {
        const lines = content.split('\n')
        const matchedLines: string[] = []
        const lineNumbers: number[] = []

        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(queryLower)) {
            matchedLines.push(line.trim().slice(0, 100))
            lineNumbers.push(idx + 1)
          }
        })

        if (matchedLines.length > 0) {
          results.push({
            path: filePath,
            matches: matchedLines.slice(0, 5),
            lineNumbers: lineNumbers.slice(0, 5)
          })
        }
      }
    }

    return {
      success: true,
      result: {
        query,
        count: results.length,
        results: results.slice(0, 20)
      }
    }
  }

  private getFileStructure(basePath?: string, depth: number = 3): ToolResult {
    const structure: Record<string, string[]> = {}

    for (const file of this.files) {
      const filePath = file.path || file.name

      if (basePath && !filePath.startsWith(basePath)) continue

      const parts = filePath.split('/')
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '/'

      if (!structure[folder]) structure[folder] = []
      structure[folder].push(parts[parts.length - 1])
    }

    // depth 제한
    const filteredStructure: Record<string, string[]> = {}
    for (const [folder, files] of Object.entries(structure)) {
      if (folder.split('/').length <= depth) {
        filteredStructure[folder] = files
      }
    }

    return {
      success: true,
      result: {
        totalFiles: this.files.length,
        totalFolders: Object.keys(filteredStructure).length,
        structure: filteredStructure
      }
    }
  }

  private analyzeDependencies(path: string): ToolResult {
    const file = this.files.find(f =>
      f.path === path ||
      f.path?.endsWith(path) ||
      f.name === path
    )

    if (!file?.content) {
      return { success: false, error: `파일을 찾을 수 없습니다: ${path}` }
    }

    const content = file.content
    const imports: string[] = []
    const exports: string[] = []

    // Import 분석
    const importRegex = /(?:import|from|require)\s*(?:\(?\s*)?['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(content))) {
      imports.push(match[1])
    }

    // Export 분석
    const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type)?\s*(\w+)/g
    while ((match = exportRegex.exec(content))) {
      exports.push(match[1])
    }

    // 이 파일을 import하는 다른 파일 찾기
    const fileName = (file.path || file.name).split('/').pop()?.replace(/\.\w+$/, '')
    const importedBy: string[] = []

    for (const otherFile of this.files) {
      if (otherFile.id === file.id) continue
      if (otherFile.content?.includes(fileName || '')) {
        importedBy.push(otherFile.path || otherFile.name)
      }
    }

    return {
      success: true,
      result: {
        file: file.path || file.name,
        imports,
        exports,
        importedBy: importedBy.slice(0, 10)
      }
    }
  }

  private findReferences(name: string): ToolResult {
    const references: Array<{
      file: string
      line: number
      context: string
    }> = []

    for (const file of this.files) {
      if (!file.content) continue

      const lines = file.content.split('\n')
      lines.forEach((line, idx) => {
        // 단어 경계로 검색 (정확한 매칭)
        const regex = new RegExp(`\\b${name}\\b`, 'g')
        if (regex.test(line)) {
          references.push({
            file: file.path || file.name,
            line: idx + 1,
            context: line.trim().slice(0, 120)
          })
        }
      })
    }

    return {
      success: true,
      result: {
        symbol: name,
        count: references.length,
        references: references.slice(0, 30)
      }
    }
  }

  private getProjectSummary(): ToolResult {
    // 프로젝트 타입 감지
    const pkgJson = this.files.find(f => f.name === 'package.json')
    let projectInfo: Record<string, unknown> = {}

    if (pkgJson?.content) {
      try {
        const pkg = JSON.parse(pkgJson.content)
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        let framework = 'JavaScript/TypeScript'
        if (deps['next']) framework = 'Next.js'
        else if (deps['nuxt']) framework = 'Nuxt'
        else if (deps['react']) framework = 'React'
        else if (deps['vue']) framework = 'Vue'
        else if (deps['angular']) framework = 'Angular'
        else if (deps['express']) framework = 'Express'
        else if (deps['fastify']) framework = 'Fastify'
        else if (deps['electron']) framework = 'Electron'

        projectInfo = {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          framework,
          dependencies: Object.keys(deps).slice(0, 30),
          scripts: Object.keys(pkg.scripts || {})
        }
      } catch {}
    }

    // 파일 통계
    const extCounts: Record<string, number> = {}
    const folderCounts: Record<string, number> = {}

    for (const file of this.files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'other'
      extCounts[ext] = (extCounts[ext] || 0) + 1

      const folder = (file.path || file.name).split('/')[0]
      if (folder) folderCounts[folder] = (folderCounts[folder] || 0) + 1
    }

    // 주요 파일 찾기
    const importantFiles = this.files
      .filter(f => ['package.json', 'readme.md', 'tsconfig.json', 'index.ts', 'index.tsx', 'app.tsx', 'main.ts'].includes(f.name.toLowerCase()))
      .map(f => f.path || f.name)

    return {
      success: true,
      result: {
        projectPath: this.projectPath,
        projectName: this.graph?.title || projectInfo.name || '알 수 없음',
        ...projectInfo,
        totalFiles: this.files.length,
        fileTypes: Object.entries(extCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ext, count]) => `${ext}: ${count}`),
        mainFolders: Object.entries(folderCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([folder, count]) => `${folder}/ (${count})`),
        importantFiles
      }
    }
  }
}
