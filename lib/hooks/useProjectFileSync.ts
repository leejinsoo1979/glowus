/**
 * useProjectFileSync - 실시간 프로젝트 파일 동기화 훅
 *
 * 기능:
 * 1. 프로젝트 폴더 경로가 있으면 자동으로 파일 워처 시작
 * 2. 파일 변경 시 파일 트리 + 그래프 자동 업데이트
 * 3. Electron과 웹 환경 모두 지원
 */

import { useEffect, useRef, useCallback } from 'react'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { NeuralFile } from '@/lib/neural-map/types'

interface UseProjectFileSyncOptions {
  projectId: string
  folderPath?: string | null
  projectName?: string
  enabled?: boolean
  debounceMs?: number
}

interface ScanResult {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: ScanResult[]
}

// 파일 타입 결정 함수 (NeuralFileType: 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary')
const getFileType = (fileName: string): 'pdf' | 'image' | 'video' | 'markdown' | 'code' | 'text' | 'binary' => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  // Image files
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff']
  if (imageExts.includes(ext)) return 'image'

  // Video files
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv']
  if (videoExts.includes(ext)) return 'video'

  // PDF
  if (ext === 'pdf') return 'pdf'

  // Markdown
  const mdExts = ['md', 'markdown', 'mdx']
  if (mdExts.includes(ext)) return 'markdown'

  // Code files
  const codeExts = [
    'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java',
    'cpp', 'c', 'cs', 'php', 'swift', 'kt', 'scala', 'dart',
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte',
    'json', 'yaml', 'yml', 'xml', 'toml', 'ini',
    'sh', 'bash', 'zsh', 'fish', 'sql', 'prisma',
    'env', 'gitignore', 'dockerignore'
  ]
  if (codeExts.includes(ext)) return 'code'

  // Text files
  const textExts = ['txt', 'csv', 'log', 'readme']
  if (textExts.includes(ext)) return 'text'

  // Default to text for unknown extensions
  return 'text'
}

export function useProjectFileSync({
  projectId,
  folderPath,
  projectName = 'My Project',
  enabled = true,
  debounceMs = 500,
}: UseProjectFileSyncOptions) {
  // Store actions
  const setProjectPath = useNeuralMapStore((s) => s.setProjectPath)
  const setLinkedProject = useNeuralMapStore((s) => s.setLinkedProject)
  const setFiles = useNeuralMapStore((s) => s.setFiles)
  const buildGraphFromFilesAsync = useNeuralMapStore((s) => s.buildGraphFromFilesAsync)
  const files = useNeuralMapStore((s) => s.files)

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)
  const lastFolderPathRef = useRef<string | null>(null)

  // 파일 스캔 함수
  const scanAndLoadFiles = useCallback(async (dirPath: string) => {
    const electron = (window as any).electron
    if (!electron?.fs?.scanTree) {
      console.warn('[useProjectFileSync] Electron API not available')
      return
    }

    try {
      console.log('[useProjectFileSync] 🔍 Scanning folder:', dirPath)

      const scanResult = await electron.fs.scanTree(dirPath, {
        showHidden: false,
        maxDepth: 10,
      })

      if (!scanResult?.tree) {
        console.warn('[useProjectFileSync] No tree in scan result')
        return
      }

      // 트리를 NeuralFile 배열로 변환
      const neuralFiles: NeuralFile[] = []
      const timestamp = Date.now()

      const flattenTree = (node: ScanResult, depth = 0) => {
        if (node.type === 'file') {
          neuralFiles.push({
            id: `local-${timestamp}-${neuralFiles.length}`,
            name: node.name,
            path: node.path,
            type: getFileType(node.name),
            mapId: '',
            url: '',
            size: 0,
            createdAt: new Date().toISOString(),
          })
        }
        if (node.children) {
          node.children.forEach((child) => flattenTree(child, depth + 1))
        }
      }

      flattenTree(scanResult.tree)

      console.log(`[useProjectFileSync] ✅ Scanned ${neuralFiles.length} files`)

      // 파일 설정 및 그래프 빌드
      setFiles(neuralFiles)
      await buildGraphFromFilesAsync()

      return neuralFiles
    } catch (error) {
      console.error('[useProjectFileSync] Scan error:', error)
    }
  }, [setFiles, buildGraphFromFilesAsync])

  // Debounced 리로드 함수
  const debouncedReload = useCallback((dirPath: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      console.log('[useProjectFileSync] 🔄 Reloading files after change...')
      await scanAndLoadFiles(dirPath)
    }, debounceMs)
  }, [scanAndLoadFiles, debounceMs])

  // 초기화 및 파일 워처 설정
  useEffect(() => {
    if (!enabled || !folderPath) {
      return
    }

    // 이미 같은 경로로 초기화됐으면 스킵
    if (lastFolderPathRef.current === folderPath && isInitializedRef.current) {
      return
    }

    const electron = (window as any).electron
    if (!electron?.fs) {
      console.warn('[useProjectFileSync] Not in Electron environment')
      return
    }

    console.log('[useProjectFileSync] 🚀 Initializing for:', folderPath)

    // Store 업데이트
    setProjectPath(folderPath)
    setLinkedProject(projectId, projectName)

    // 초기 파일 스캔
    scanAndLoadFiles(folderPath)

    // 파일 워처 시작
    if (electron.fs.watchStart) {
      electron.fs.watchStart(folderPath).then((result: { success: boolean; path: string }) => {
        if (result.success) {
          console.log('[useProjectFileSync] 👁️ File watcher started:', result.path)
        }
      }).catch((err: Error) => {
        console.warn('[useProjectFileSync] Watcher start failed:', err)
      })
    }

    // 파일 변경 이벤트 리스너
    let unsubscribe: (() => void) | undefined

    if (electron.fs.onChanged) {
      unsubscribe = electron.fs.onChanged((data: { path: string; type: 'create' | 'change' | 'delete' }) => {
        console.log('[useProjectFileSync] 📝 File changed:', data.type, data.path)
        debouncedReload(folderPath)
      })
    }

    isInitializedRef.current = true
    lastFolderPathRef.current = folderPath

    // Cleanup
    return () => {
      console.log('[useProjectFileSync] 🧹 Cleaning up...')

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      if (unsubscribe) {
        unsubscribe()
      }

      if (electron.fs.watchStop) {
        electron.fs.watchStop()
      }
    }
  }, [
    enabled,
    folderPath,
    projectId,
    projectName,
    setProjectPath,
    setLinkedProject,
    scanAndLoadFiles,
    debouncedReload,
  ])

  // 수동 새로고침 함수
  const refresh = useCallback(async () => {
    if (folderPath) {
      await scanAndLoadFiles(folderPath)
    }
  }, [folderPath, scanAndLoadFiles])

  return {
    files,
    refresh,
    isInitialized: isInitializedRef.current,
    folderPath: lastFolderPathRef.current,
  }
}

export default useProjectFileSync
