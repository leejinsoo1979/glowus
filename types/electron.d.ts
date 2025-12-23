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
        selectDirectory?: () => Promise<string | null>
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
      }

      // Git operations
      git?: {
        log?: (dirPath: string, options?: { maxCommits?: number }) => Promise<string>
        branches?: (dirPath: string) => Promise<string[]>
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

export {}
