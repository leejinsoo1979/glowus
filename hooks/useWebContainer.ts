"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { WebContainer } from '@webcontainer/api'

interface WebContainerFile {
  file_name: string
  file_path: string
  content: string
}

interface UseWebContainerOptions {
  projectId: string
  onOutput?: (data: string) => void
  onError?: (error: string) => void
  onServerReady?: (url: string, port: number) => void
}

interface UseWebContainerReturn {
  isBooting: boolean
  isRunning: boolean
  previewUrl: string | null
  boot: () => Promise<void>
  mountFiles: (files: WebContainerFile[]) => Promise<void>
  runCommand: (command: string) => Promise<number>
  installDependencies: () => Promise<boolean>
  startDevServer: (script?: string) => Promise<void>
  stop: () => void
  terminal: {
    write: (data: string) => void
  } | null
}

// WebContainer 싱글톤 (한 페이지에서 하나만 사용 가능)
let webContainerInstance: WebContainer | null = null
let webContainerPromise: Promise<WebContainer> | null = null

export function useWebContainer({
  projectId,
  onOutput,
  onError,
  onServerReady
}: UseWebContainerOptions): UseWebContainerReturn {
  const [isBooting, setIsBooting] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const containerRef = useRef<WebContainer | null>(null)
  const processRef = useRef<any>(null)
  const outputCallbackRef = useRef(onOutput)
  const errorCallbackRef = useRef(onError)
  const serverReadyCallbackRef = useRef(onServerReady)

  // Update refs when callbacks change
  useEffect(() => {
    outputCallbackRef.current = onOutput
    errorCallbackRef.current = onError
    serverReadyCallbackRef.current = onServerReady
  }, [onOutput, onError, onServerReady])

  const boot = useCallback(async () => {
    if (containerRef.current) return

    setIsBooting(true)

    try {
      // 싱글톤 패턴: 이미 부팅 중이거나 부팅된 인스턴스 재사용
      if (!webContainerPromise) {
        webContainerPromise = WebContainer.boot()
      }

      const container = await webContainerPromise
      webContainerInstance = container
      containerRef.current = container

      // 서버 준비 이벤트 리스너
      container.on('server-ready', (port, url) => {
        console.log('[WebContainer] Server ready:', { port, url })
        setPreviewUrl(url)
        serverReadyCallbackRef.current?.(url, port)
      })

      outputCallbackRef.current?.('> WebContainer booted successfully\n')
    } catch (err) {
      console.error('[WebContainer] Boot failed:', err)
      errorCallbackRef.current?.(`WebContainer boot failed: ${err}`)
      webContainerPromise = null
    } finally {
      setIsBooting(false)
    }
  }, [])

  const mountFiles = useCallback(async (files: WebContainerFile[]) => {
    const container = containerRef.current
    if (!container) {
      errorCallbackRef.current?.('WebContainer not booted')
      return
    }

    try {
      // 파일 구조를 WebContainer 형식으로 변환
      const fileTree: Record<string, any> = {}

      for (const file of files) {
        const parts = file.file_path.split('/').filter(Boolean)
        let current = fileTree

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          if (!current[part]) {
            current[part] = { directory: {} }
          }
          current = current[part].directory
        }

        const fileName = parts[parts.length - 1] || file.file_name
        current[fileName] = {
          file: {
            contents: file.content
          }
        }
      }

      await container.mount(fileTree)
      outputCallbackRef.current?.(`> Mounted ${files.length} files\n`)
    } catch (err) {
      console.error('[WebContainer] Mount failed:', err)
      errorCallbackRef.current?.(`Failed to mount files: ${err}`)
    }
  }, [])

  const runCommand = useCallback(async (command: string): Promise<number> => {
    const container = containerRef.current
    if (!container) {
      errorCallbackRef.current?.('WebContainer not booted')
      return 1
    }

    const [cmd, ...args] = command.split(' ')
    outputCallbackRef.current?.(`> ${command}\n`)

    try {
      const process = await container.spawn(cmd, args)

      // stdout 스트림 처리
      process.output.pipeTo(new WritableStream({
        write(data) {
          outputCallbackRef.current?.(data)
        }
      }))

      const exitCode = await process.exit
      return exitCode
    } catch (err) {
      console.error('[WebContainer] Command failed:', err)
      errorCallbackRef.current?.(`Command failed: ${err}`)
      return 1
    }
  }, [])

  const installDependencies = useCallback(async (): Promise<boolean> => {
    const container = containerRef.current
    if (!container) {
      errorCallbackRef.current?.('WebContainer not booted')
      return false
    }

    outputCallbackRef.current?.('> npm install\n')

    try {
      const process = await container.spawn('npm', ['install'])

      process.output.pipeTo(new WritableStream({
        write(data) {
          outputCallbackRef.current?.(data)
        }
      }))

      const exitCode = await process.exit
      return exitCode === 0
    } catch (err) {
      console.error('[WebContainer] npm install failed:', err)
      errorCallbackRef.current?.(`npm install failed: ${err}`)
      return false
    }
  }, [])

  const startDevServer = useCallback(async (script: string = 'dev') => {
    const container = containerRef.current
    if (!container) {
      errorCallbackRef.current?.('WebContainer not booted')
      return
    }

    setIsRunning(true)
    outputCallbackRef.current?.(`> npm run ${script}\n`)

    try {
      const process = await container.spawn('npm', ['run', script])
      processRef.current = process

      process.output.pipeTo(new WritableStream({
        write(data) {
          outputCallbackRef.current?.(data)
        }
      }))

      // 프로세스 종료 대기 (백그라운드에서)
      process.exit.then((exitCode) => {
        console.log('[WebContainer] Dev server exited:', exitCode)
        setIsRunning(false)
        processRef.current = null
      })
    } catch (err) {
      console.error('[WebContainer] Dev server failed:', err)
      errorCallbackRef.current?.(`Dev server failed: ${err}`)
      setIsRunning(false)
    }
  }, [])

  const stop = useCallback(() => {
    if (processRef.current) {
      processRef.current.kill()
      processRef.current = null
      setIsRunning(false)
      setPreviewUrl(null)
      outputCallbackRef.current?.('> Process stopped\n')
    }
  }, [])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (processRef.current) {
        processRef.current.kill()
      }
    }
  }, [])

  return {
    isBooting,
    isRunning,
    previewUrl,
    boot,
    mountFiles,
    runCommand,
    installDependencies,
    startDevServer,
    stop,
    terminal: null // TODO: 터미널 통합 시 구현
  }
}
