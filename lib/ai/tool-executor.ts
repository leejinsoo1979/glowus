/**
 * AI Agent Tool Executor - 도구 실행 엔진
 * Cursor/Antigravity 수준의 코딩 에이전트 도구
 */

import type { ToolCall, ToolResult } from './tools'
import type { AgentAction } from './agent-actions'

interface NeuralFile {
  id: string
  name: string
  path?: string
  content?: string
  type: string
}

// 파일 수정 결과를 저장할 인터페이스
interface FileModification {
  path: string
  oldContent: string
  newContent: string
  timestamp: number
}

// 터미널 명령 결과 인터페이스
interface TerminalResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

// 확장된 Tool 결과 - 액션 포함
export interface ToolResultWithAction extends ToolResult {
  pendingAction?: AgentAction
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
  private modifications: FileModification[] = []  // 수정 이력 추적
  private onFileChange?: (file: NeuralFile) => void  // 파일 변경 콜백
  private onTerminalCmd?: (cmd: string, cwd?: string) => Promise<TerminalResult>  // 터미널 명령 콜백

  constructor(context: ExecutorContext & {
    onFileChange?: (file: NeuralFile) => void
    onTerminalCmd?: (cmd: string, cwd?: string) => Promise<TerminalResult>
  }) {
    this.files = context.files
    this.projectPath = context.projectPath || null
    this.graph = context.graph
    this.onFileChange = context.onFileChange
    this.onTerminalCmd = context.onTerminalCmd
  }

  async execute(toolCall: ToolCall): Promise<ToolResultWithAction> {
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

        case 'edit_file':
          return this.editFile(
            args.path as string,
            args.old_content as string,
            args.new_content as string
          )

        case 'create_file':
          return this.createFile(args.path as string, args.content as string)

        case 'run_terminal_cmd':
          return this.runTerminalCmd(args.command as string, args.cwd as string)

        case 'web_search':
          return this.webSearch(args.query as string)

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

  // ============================================
  // 핵심 에이전트 도구: 파일 수정
  // ============================================
  private editFile(path: string, oldContent: string, newContent: string): ToolResultWithAction {
    // 파일 찾기
    const file = this.files.find(f =>
      f.path === path ||
      f.path?.endsWith(path) ||
      f.name === path
    )

    if (!file) {
      return {
        success: false,
        error: `파일을 찾을 수 없습니다: ${path}`,
        result: `사용 가능한 파일: ${this.files.slice(0, 10).map(f => f.path || f.name).join(', ')}`
      }
    }

    if (!file.content) {
      return { success: false, error: `파일 내용이 없습니다: ${path}` }
    }

    // 기존 내용이 파일에 존재하는지 확인
    if (!file.content.includes(oldContent)) {
      // 유사한 부분 찾기 시도
      const lines = file.content.split('\n')
      const oldLines = oldContent.split('\n')
      const firstOldLine = oldLines[0].trim()

      const similarLines = lines
        .map((line, idx) => ({ line: line.trim(), idx }))
        .filter(({ line }) => line.includes(firstOldLine.slice(0, 20)))
        .slice(0, 3)

      return {
        success: false,
        error: '교체할 코드를 찾을 수 없습니다',
        result: {
          hint: '정확한 코드를 제공해주세요',
          similarMatches: similarLines.map(({ line, idx }) => ({
            line: idx + 1,
            content: line.slice(0, 80)
          }))
        }
      }
    }

    // 새 내용 생성
    const updatedContent = file.content.replace(oldContent, newContent)
    const fullPath = this.projectPath
      ? `${this.projectPath}/${file.path || file.name}`
      : file.path || file.name

    // 수정 이력 저장
    this.modifications.push({
      path: file.path || file.name,
      oldContent: file.content,
      newContent: updatedContent,
      timestamp: Date.now()
    })

    // 메모리상 파일 내용 업데이트
    file.content = updatedContent

    // 콜백 호출 (있는 경우)
    if (this.onFileChange) {
      this.onFileChange(file)
    }

    return {
      success: true,
      result: {
        path: file.path || file.name,
        message: '파일 수정 준비 완료 - 실행 대기 중',
        linesChanged: newContent.split('\n').length - oldContent.split('\n').length,
        preview: newContent.slice(0, 200) + (newContent.length > 200 ? '...' : '')
      },
      // 실제 디스크 쓰기를 위한 액션
      pendingAction: {
        type: 'write_file',
        path: fullPath,
        content: updatedContent,
        originalContent: file.content
      }
    }
  }

  // ============================================
  // 핵심 에이전트 도구: 파일 생성
  // ============================================
  private createFile(path: string, content: string): ToolResultWithAction {
    // 이미 존재하는지 확인
    const existingFile = this.files.find(f =>
      f.path === path ||
      f.path?.endsWith(path)
    )

    if (existingFile) {
      return {
        success: false,
        error: `파일이 이미 존재합니다: ${path}. edit_file을 사용하세요.`
      }
    }

    const fullPath = this.projectPath
      ? `${this.projectPath}/${path}`
      : path

    // 새 파일 생성 (메모리)
    const newFile: NeuralFile = {
      id: `new-${Date.now()}`,
      name: path.split('/').pop() || path,
      path: path,
      content: content,
      type: this.detectFileType(path)
    }

    // 파일 목록에 추가
    this.files.push(newFile)

    // 콜백 호출
    if (this.onFileChange) {
      this.onFileChange(newFile)
    }

    return {
      success: true,
      result: {
        path: path,
        message: '파일 생성 준비 완료 - 실행 대기 중',
        lines: content.split('\n').length,
        size: content.length
      },
      pendingAction: {
        type: 'create_file',
        path: fullPath,
        content: content
      }
    }
  }

  private detectFileType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    const typeMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescriptreact',
      js: 'javascript',
      jsx: 'javascriptreact',
      py: 'python',
      css: 'css',
      scss: 'scss',
      json: 'json',
      md: 'markdown',
      html: 'html'
    }
    return typeMap[ext || ''] || 'text'
  }

  // ============================================
  // 핵심 에이전트 도구: 터미널 명령 실행
  // ============================================
  private async runTerminalCmd(command: string, cwd?: string): Promise<ToolResultWithAction> {
    // 위험한 명령어 필터링
    const dangerousPatterns = [
      /rm\s+-rf\s+[\/~]/i,
      /sudo\s+rm/i,
      /mkfs/i,
      /dd\s+if=/i,
      />\s*\/dev\//i,
      /chmod\s+777\s+\//i
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          success: false,
          error: '보안상 위험한 명령어는 실행할 수 없습니다',
          result: { blockedCommand: command }
        }
      }
    }

    const workingDir = cwd || this.projectPath || undefined

    return {
      success: true,
      result: {
        command,
        cwd: workingDir,
        message: '터미널 명령 실행 준비 완료 - 실행 대기 중'
      },
      pendingAction: {
        type: 'terminal_cmd',
        command: command,
        cwd: workingDir,
        waitForOutput: true
      }
    }
  }

  private simulateCommand(command: string): string {
    // 기본 명령어 시뮬레이션
    if (command.startsWith('npm ')) {
      if (command.includes('install')) return '+ installed packages successfully'
      if (command.includes('run')) return 'Script started...'
      if (command.includes('test')) return 'Tests passed'
    }
    if (command.startsWith('git ')) {
      if (command.includes('status')) return 'On branch main\nnothing to commit'
      if (command.includes('diff')) return 'No changes'
    }
    return '(시뮬레이션 결과)'
  }

  // ============================================
  // 핵심 에이전트 도구: 웹 검색
  // ============================================
  private async webSearch(query: string): Promise<ToolResultWithAction> {
    return {
      success: true,
      result: {
        query,
        message: '웹 검색 실행 준비 완료 - 실행 대기 중'
      },
      pendingAction: {
        type: 'web_search',
        query: query
      }
    }
  }

  // ============================================
  // 유틸리티: 수정 이력 조회
  // ============================================
  getModifications(): FileModification[] {
    return this.modifications
  }

  // 유틸리티: 마지막 수정 되돌리기
  undoLastModification(): ToolResult {
    const lastMod = this.modifications.pop()
    if (!lastMod) {
      return { success: false, error: '되돌릴 수정 내역이 없습니다' }
    }

    const file = this.files.find(f => (f.path || f.name) === lastMod.path)
    if (file) {
      file.content = lastMod.oldContent
      if (this.onFileChange) {
        this.onFileChange(file)
      }
    }

    return {
      success: true,
      result: {
        path: lastMod.path,
        message: '수정이 되돌려졌습니다'
      }
    }
  }
}
