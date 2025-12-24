// Global Electron API type definitions
// This file consolidates all window.electron interface declarations

// Inline types (from mermaid-generators.ts) to avoid module/global scope issues
interface FileStats {
  name: string
  path: string
  extension: string
  size: number
  lines?: number
  imports?: string[]
  exports?: string[]
}

interface TypeInfo {
  name: string
  kind: 'interface' | 'type' | 'enum' | 'class'
  properties?: { name: string; type: string; optional?: boolean }[]
  extends?: string[]
  file: string
}

interface TableInfo {
  name: string
  columns: { name: string; type: string; nullable?: boolean; isPrimary?: boolean; isForeign?: boolean; references?: string }[]
  file: string
}

interface APIRoute {
  path: string
  method: string
  file: string
  handler?: string
}

declare global {
  interface Window {
    // PDF.js library
    pdfjsLib?: any

    electron?: {
      // Generic IPC invoke
      invoke?: (channel: string, ...args: any[]) => Promise<any>

      // File system operations
      fs?: {
        getCwd?: () => Promise<string>
        selectDirectory?: () => Promise<{ kind: string; name: string; path: string } | null>
        readDirectory?: (path: string, options: any) => Promise<any>
        scanTree?: (rootPath: string, options?: {
          includeSystemFiles?: boolean
          maxDepth?: number
          includeContent?: boolean
          contentExtensions?: string[]
        }) => Promise<any>
        readFile?: (path: string) => Promise<string>
        writeFile?: (path: string, content: string) => Promise<void>
        fileStats?: (dirPath: string) => Promise<FileStats[]>
        scanApiRoutes?: (dirPath: string) => Promise<APIRoute[]>
        scanTypes?: (dirPath: string, options?: { extensions?: string[] }) => Promise<TypeInfo[]>
        scanSchema?: (dirPath: string) => Promise<TableInfo[]>
        // Create directory
        mkdir?: (dirPath: string) => Promise<{ success: boolean; path?: string; error?: string }>
        // Delete file
        deleteFile?: (filePath: string) => Promise<{ success: boolean; error?: string }>
        // Read directory (alias)
        readDir?: (dirPath: string) => Promise<any>
        // Check if folder is empty
        isEmpty?: (dirPath: string) => Promise<boolean>
        // Listen for file system changes
        onChanged?: (callback: (data: { path: string; type: 'create' | 'change' | 'delete' }) => void) => () => void
        // File system watcher
        watchStart?: (dirPath: string) => Promise<{ success: boolean; path: string }>
        watchStop?: () => Promise<{ success: boolean }>
        // Copy file
        copyFile?: (src: string, dest: string) => Promise<{ success: boolean; error?: string }>
        // Rename/move file
        rename?: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>
      }

      // Shell operations
      shell?: {
        // Show item in Finder/Explorer
        showItemInFolder?: (path: string) => Promise<void>
        // Move item to trash
        trashItem?: (path: string) => Promise<{ success: boolean; error?: string }>
        // Open path with default application
        openPath?: (path: string) => Promise<string>
      }

      // Git operations
      git?: {
        // Existing (for visualization)
        log?: (dirPath: string, options?: { maxCommits?: number }) => Promise<string>
        branches?: (dirPath: string) => Promise<string[]>
        // New operations for GitHub integration
        clone?: (url: string, targetPath: string) => Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }>
        status?: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
        diff?: (cwd: string, staged?: boolean) => Promise<{ success: boolean; output?: string; error?: string }>
        add?: (cwd: string, files: string | string[]) => Promise<{ success: boolean; output?: string; error?: string }>
        commit?: (cwd: string, message: string) => Promise<{ success: boolean; output?: string; error?: string }>
        push?: (cwd: string, remote?: string, branch?: string) => Promise<{ success: boolean; output?: string; error?: string }>
        pull?: (cwd: string, remote?: string, branch?: string) => Promise<{ success: boolean; output?: string; error?: string }>
        init?: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
        remoteAdd?: (cwd: string, name: string, url: string) => Promise<{ success: boolean; output?: string; error?: string }>
        remoteList?: (cwd: string) => Promise<{ success: boolean; output?: string; error?: string }>
        config?: (cwd: string, key: string, value: string) => Promise<{ success: boolean; output?: string; error?: string }>
        fetch?: (cwd: string, remote?: string) => Promise<{ success: boolean; output?: string; error?: string }>
        stash?: (cwd: string, action?: 'push' | 'pop' | 'list') => Promise<{ success: boolean; output?: string; error?: string }>
        isRepo?: (cwd: string) => Promise<{ success: boolean; isRepo: boolean }>
        currentBranch?: (cwd: string) => Promise<{ success: boolean; branch?: string; error?: string }>
      }

      // Project operations
      project?: {
        // Create project workspace folder
        createWorkspace?: (projectName: string, customPath?: string) => Promise<{
          success: boolean
          path?: string
          error?: string
        }>
        // Get workspace root path
        getWorkspaceRoot?: () => Promise<string>
        // Scaffold project from template
        scaffold?: (params: {
          dirPath: string
          template: string
          options?: { typescript?: boolean; tailwind?: boolean; eslint?: boolean }
        }) => Promise<any>
        // Listen for scaffolding complete
        onScaffolded?: (callback: (data: {
          template: string
          projectName: string
          path: string
          results?: string[]
        }) => void) => () => void
      }

      // Terminal (PTY) operations
      terminal?: {
        create?: (id: string, cwd?: string) => Promise<{ success: boolean; id: string }>
        write?: (id: string, data: string) => Promise<{ success: boolean }>
        resize?: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>
        kill?: (id: string) => Promise<{ success: boolean }>
        onData?: (callback: (id: string, data: string) => void) => () => void
        onExit?: (callback: (id: string, exitCode: number, signal?: number) => void) => () => void
      }

      // Project Runner - 프로젝트 실행
      projectRunner?: {
        run?: (id: string, cwd: string, command: string) => Promise<{ success: boolean; pid?: number; error?: string }>
        stop?: (id: string) => Promise<{ success: boolean; error?: string }>
        status?: (id: string) => Promise<{ running: boolean }>
        onOutput?: (callback: (id: string, data: string) => void) => () => void
        onExit?: (callback: (id: string, exitCode: number) => void) => () => void
        onError?: (callback: (id: string, error: string) => void) => () => void
      }

      // Project Preview - HTML 파일 팝업 미리보기
      projectPreview?: {
        open?: (filePath: string, title?: string) => Promise<{ success: boolean; error?: string }>
      }

      // DevTools helper
      openWebviewDevTools?: (id?: number) => Promise<void>

      // Menu event listeners
      onMenuEvent?: (event: string, callback: () => void) => () => void

      // AI Viewfinder - 화면 공유
      viewfinder?: {
        captureWebview?: (webContentsId: number, rect?: {
          x: number
          y: number
          width: number
          height: number
        }) => Promise<{
          success: boolean
          dataUrl?: string
          width?: number
          height?: number
          timestamp?: number
          error?: string
        }>
        captureWindow?: (rect?: {
          x: number
          y: number
          width: number
          height: number
        }) => Promise<{
          success: boolean
          dataUrl?: string
          width?: number
          height?: number
          timestamp?: number
          error?: string
        }>
      }

      // AI Agent
      agent?: {
        execute?: (params: {
          messages: Array<{ role: string; content: string }>
          model: string
          context: {
            files: Array<{ id: string; name: string; path?: string; content?: string; type: string }>
            projectPath?: string
          }
        }) => Promise<{
          success: boolean
          content?: string
          toolCalls?: string[]
          error?: string
        }>
        onDesign?: (callback: (data: {
          type: 'flowchart' | 'schema' | 'logic'
          title: string
          mermaidCode?: string
          schema?: string
          pseudocode?: string
          functions?: string[]
          filePath: string
        }) => void) => () => void
        onSwitchTab?: (callback: (data: { tab: string }) => void) => () => void
      }
    }
  }
}

export { }
