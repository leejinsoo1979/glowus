// Global Electron API type definitions
// This file consolidates all window.electron interface declarations

import type { FileStats, TypeInfo, TableInfo, APIRoute } from '@/lib/neural-map/mermaid-generators'

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
        log?: (dirPath: string, options?: { maxCommits?: number }) => Promise<string>
        branches?: (dirPath: string) => Promise<string[]>
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
    }
  }
}

export { }
