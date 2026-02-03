"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Square,
  Terminal,
  ChevronDown,
  ChevronUp,
  Loader2,
  Eye,
  X,
  ExternalLink,
  Code2,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { useRouter } from "next/navigation"

interface ProjectRunnerProps {
  projectId: string
  folderPath?: string | null
  projectName: string
  onFolderLinked?: (path: string) => void
}

interface ProjectConfig {
  type: "node" | "python" | "static" | "unknown"
  hasPackageJson: boolean
  hasPyProject: boolean
  hasIndexHtml: boolean
  scripts: Record<string, string>
  mainScript?: string
}

interface DBFile {
  id: string
  file_name: string
  file_path: string
  content: string
  created_at: string
}

type RunStatus = "idle" | "starting" | "running" | "stopping" | "error" | "initializing" | "preview" | "booting" | "installing"

export function ProjectRunner({
  projectId,
  folderPath: initialFolderPath,
  projectName,
  onFolderLinked
}: ProjectRunnerProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [status, setStatus] = useState<RunStatus>("idle")
  const [output, setOutput] = useState<string[]>([])
  const [selectedScript, setSelectedScript] = useState<string>("dev")
  const [isElectron, setIsElectron] = useState(false)
  const [folderPath, setFolderPath] = useState<string | null | undefined>(initialFolderPath)
  const runnerId = useRef<string>(`runner-${projectId}`)
  const outputRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const workspaceCreatedRef = useRef(false)

  // DB에 저장된 파일 (웹 미리보기용)
  const [dbFiles, setDbFiles] = useState<DBFile[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // 웹 환경 터미널 WebSocket
  const webTerminalRef = useRef<WebSocket | null>(null)

  // Sync with prop changes
  useEffect(() => {
    setFolderPath(initialFolderPath)
  }, [initialFolderPath])

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electron?.projectRunner)
  }, [])

  // folder_path가 없으면 DB에서 파일 조회
  useEffect(() => {
    if (!initialFolderPath) {
      fetchDBFiles()
    }
  }, [projectId, initialFolderPath])

  const fetchDBFiles = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`)
      const data = await res.json()
      if (data.files && data.files.length > 0) {
        setDbFiles(data.files)
        // HTML 파일이 있는지 확인
        const htmlFile = data.files.find((f: DBFile) =>
          f.file_name.endsWith('.html') || f.file_name.endsWith('.htm')
        )
        if (htmlFile) {
          setConfig({
            type: "static",
            hasPackageJson: false,
            hasPyProject: false,
            hasIndexHtml: true,
            scripts: {},
          })
        }
      }
    } catch (err) {
      console.error('[ProjectRunner] Failed to fetch DB files:', err)
    }
  }

  // 웹 미리보기 (DB 파일용)
  const openWebPreview = useCallback(() => {
    const htmlFile = dbFiles.find((f) =>
      f.file_name.endsWith('.html') || f.file_name.endsWith('.htm')
    )
    if (htmlFile && htmlFile.content) {
      setPreviewContent(htmlFile.content)
      setShowPreview(true)
      setStatus("preview")
    }
  }, [dbFiles])

  // 새 창에서 미리보기
  const openInNewWindow = useCallback(() => {
    const htmlFile = dbFiles.find((f) =>
      f.file_name.endsWith('.html') || f.file_name.endsWith('.htm')
    )
    if (htmlFile && htmlFile.content) {
      const newWindow = window.open('', '_blank', 'width=800,height=600')
      if (newWindow) {
        newWindow.document.write(htmlFile.content)
        newWindow.document.close()
      }
    }
  }, [dbFiles])

  // 워크스페이스 자동 생성 (folder_path 없을 때)
  const autoCreateWorkspace = useCallback(async () => {
    if (folderPath || workspaceCreatedRef.current) return

    const createWorkspaceFn = window.electron?.project?.createWorkspace
    if (!createWorkspaceFn) return

    workspaceCreatedRef.current = true
    setStatus("initializing")

    try {
      const result = await createWorkspaceFn(projectName)

      if (result.success && result.path) {
        setFolderPath(result.path)

        // DB에 저장
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_path: result.path })
        })

        onFolderLinked?.(result.path)
        setStatus("idle")
      } else {
        setStatus("error")
      }
    } catch (err) {
      console.error('[ProjectRunner] Failed to create workspace:', err)
      setStatus("error")
      workspaceCreatedRef.current = false
    }
  }, [folderPath, projectName, projectId, onFolderLinked])

  // 마운트 시 자동으로 워크스페이스 생성
  useEffect(() => {
    if (isElectron && !folderPath) {
      autoCreateWorkspace()
    }
  }, [isElectron, folderPath, autoCreateWorkspace])

  // Detect project type and available scripts
  useEffect(() => {
    if (!folderPath || !isElectron) return
    detectProjectConfig()
  }, [folderPath, isElectron])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
      if (status === "running") {
        if (isElectron) {
          window.electron?.projectRunner?.stop?.(runnerId.current)
        } else if (webTerminalRef.current) {
          webTerminalRef.current.send('\x03')
          webTerminalRef.current.close()
        }
      }
    }
  }, [status, isElectron])

  const detectProjectConfig = async () => {
    if (!window.electron?.fs) {
      console.log('[ProjectRunner] No electron.fs available')
      return
    }

    console.log('[ProjectRunner] Detecting config for:', folderPath)

    try {
      // Try to read package.json
      let hasPackageJson = false
      let scripts: Record<string, string> = {}

      try {
        const packageJsonContent = await window.electron.fs.readFile?.(`${folderPath}/package.json`)
        if (packageJsonContent) {
          hasPackageJson = true
          const packageJson = JSON.parse(packageJsonContent)
          scripts = packageJson.scripts || {}
        }
      } catch {
        // No package.json
      }

      // Try to read pyproject.toml or requirements.txt
      let hasPyProject = false
      try {
        await window.electron.fs.readFile?.(`${folderPath}/pyproject.toml`)
        hasPyProject = true
      } catch {
        try {
          await window.electron.fs.readFile?.(`${folderPath}/requirements.txt`)
          hasPyProject = true
        } catch {
          // No Python project files
        }
      }

      // Check for index.html (static site)
      let hasIndexHtml = false
      try {
        await window.electron.fs.readFile?.(`${folderPath}/index.html`)
        hasIndexHtml = true
      } catch {
        // No index.html
      }

      const projectType = hasPackageJson ? "node" : hasPyProject ? "python" : hasIndexHtml ? "static" : "unknown"

      setConfig({
        type: projectType,
        hasPackageJson,
        hasPyProject,
        hasIndexHtml,
        scripts,
        mainScript: hasPackageJson ? (scripts.dev ? "dev" : scripts.start ? "start" : undefined) : undefined,
      })

      // Set default script
      if (scripts.dev) setSelectedScript("dev")
      else if (scripts.start) setSelectedScript("start")
    } catch (error) {
      console.error("Failed to detect project config:", error)
    }
  }

  const startProject = useCallback(async () => {
    console.log('[ProjectRunner] startProject called', { folderPath, isElectron, config })

    if (!folderPath || !isElectron || !window.electron?.projectRunner) {
      console.log('[ProjectRunner] Early return:', { folderPath, isElectron, hasRunner: !!window.electron?.projectRunner })
      return
    }

    setStatus("starting")
    setOutput([`> Starting ${projectName}...`, `> Working directory: ${folderPath}`, `> Project type: ${config?.type || 'unknown'}`, ""])

    try {
      // Setup output listener
      const unsubscribeOutput = window.electron.projectRunner.onOutput?.((id, data) => {
        if (id === runnerId.current) {
          // Parse ANSI codes roughly and add to output
          const cleanData = data.replace(/\x1b\[[0-9;]*m/g, "")
          setOutput((prev) => [...prev.slice(-500), ...cleanData.split("\n")])
        }
      })

      const unsubscribeExit = window.electron.projectRunner.onExit?.((id, exitCode) => {
        if (id === runnerId.current) {
          setOutput((prev) => [...prev, "", `> Process exited with code ${exitCode}`])
          setStatus("idle")
        }
      })

      const unsubscribeError = window.electron.projectRunner.onError?.((id, error) => {
        if (id === runnerId.current) {
          setOutput((prev) => [...prev, `> Error: ${error}`])
          setStatus("error")
        }
      })

      cleanupRef.current = () => {
        unsubscribeOutput?.()
        unsubscribeExit?.()
        unsubscribeError?.()
      }

      // Determine command to run
      let command = ""
      if (config?.type === "node" && config.scripts[selectedScript]) {
        command = `npm run ${selectedScript}`
      } else if (config?.type === "python") {
        command = "python main.py"
      } else if (config?.hasPackageJson) {
        command = `npm run ${selectedScript}`
      } else if (config?.type === "static") {
        // Static HTML project - just open in browser
        command = ""
      }

      if (config?.type === "static") {
        // Open index.html in Electron popup window
        const indexPath = `${folderPath}/index.html`
        console.log('[ProjectRunner] Opening static project:', indexPath)
        console.log('[ProjectRunner] projectPreview available:', !!window.electron?.projectPreview?.open)
        setOutput((prev) => [...prev, `> Opening ${indexPath}`, ""])

        try {
          const result = await window.electron?.projectPreview?.open?.(indexPath, projectName)
          console.log('[ProjectRunner] Preview result:', result)
          if (result?.success) {
            setOutput((prev) => [...prev, "> Opened in popup window"])
          } else {
            setOutput((prev) => [...prev, `> Error: ${result?.error || "Failed to open"}`])
          }
          setStatus("idle")
        } catch (err) {
          setOutput((prev) => [...prev, `> Error: ${err}`])
          setStatus("error")
        }
      } else if (command) {
        setOutput((prev) => [...prev, `> ${command}`, ""])
        const result = await window.electron.projectRunner.run?.(runnerId.current, folderPath, command)
        if (result?.success) {
          setStatus("running")
        } else {
          setOutput((prev) => [...prev, `> Error: ${result?.error || "Failed to start"}`])
          setStatus("error")
        }
      } else {
        setOutput((prev) => [...prev, "> No runnable script found. Add package.json with scripts."])
        setStatus("idle")
      }
    } catch (error) {
      console.error("Failed to start project:", error)
      setOutput((prev) => [...prev, `> Error: ${error}`])
      setStatus("error")
    }
  }, [folderPath, isElectron, config, selectedScript, projectName])

  const stopProject = useCallback(async () => {
    if (!isElectron || !window.electron?.projectRunner) return

    setStatus("stopping")
    setOutput((prev) => [...prev, "", "> Stopping..."])

    try {
      await window.electron.projectRunner.stop?.(runnerId.current)
      setStatus("idle")
      setOutput((prev) => [...prev, "> Stopped"])
    } catch (error) {
      console.error("Failed to stop project:", error)
      setStatus("idle")
    }
  }, [isElectron])

  const clearOutput = () => {
    setOutput([])
  }

  // 🔥 웹 환경에서 터미널 서버로 프로젝트 실행
  const startWebProject = useCallback(async () => {
    setIsExpanded(true)
    setStatus('starting')
    setOutput([`> Starting ${projectName}...`, '> Connecting to terminal server...'])

    try {
      // 터미널 서버에 WebSocket 연결
      const ws = new WebSocket('ws://localhost:3001')
      webTerminalRef.current = ws

      ws.onopen = () => {
        setOutput(prev => [...prev, '> Connected to terminal server'])

        // 프로젝트 폴더로 이동하고 npm run dev 실행
        // init 메시지로 cwd 설정
        ws.send(JSON.stringify({
          type: 'init',
          cwd: folderPath || `/tmp/glowus-projects/${projectId}`
        }))

        // 명령어 실행
        setTimeout(() => {
          const command = `npm run ${selectedScript}\r`
          ws.send(command)
          setOutput(prev => [...prev, `> npm run ${selectedScript}`])
          setStatus('running')
        }, 500)
      }

      ws.onmessage = (event) => {
        const data = event.data
        // ANSI 코드 제거하고 출력
        const cleanData = data.replace(/\x1b\[[0-9;]*m/g, '')
        if (cleanData.trim()) {
          setOutput(prev => [...prev.slice(-500), ...cleanData.split('\n').filter(Boolean)])
        }

        // 서버 URL 감지 (예: localhost:3000, localhost:5173 등)
        const urlMatch = data.match(/https?:\/\/localhost:\d+/i) ||
                         data.match(/Local:\s*(https?:\/\/[^\s]+)/i)
        if (urlMatch) {
          const url = urlMatch[1] || urlMatch[0]
          setPreviewUrl(url)
          setOutput(prev => [...prev, `> Server ready at ${url}`])
        }
      }

      ws.onerror = (error) => {
        console.error('[ProjectRunner] WebSocket error:', error)
        setOutput(prev => [...prev, '> Error: Failed to connect to terminal server'])
        setOutput(prev => [...prev, '> Make sure terminal server is running: npm run mcp:neural-map-ws'])
        setStatus('error')
      }

      ws.onclose = () => {
        setOutput(prev => [...prev, '> Disconnected from terminal server'])
        if (status === 'running') {
          setStatus('idle')
        }
      }
    } catch (err) {
      console.error('[ProjectRunner] Terminal connection error:', err)
      setOutput(prev => [...prev, `> Error: ${err}`])
      setStatus('error')
    }
  }, [projectName, folderPath, projectId, selectedScript, status])

  // 🔥 웹 환경에서 프로젝트 중지
  const stopWebProject = useCallback(() => {
    if (webTerminalRef.current) {
      // Ctrl+C 전송
      webTerminalRef.current.send('\x03')
      setTimeout(() => {
        webTerminalRef.current?.close()
        webTerminalRef.current = null
      }, 500)
    }
    setStatus('idle')
    setPreviewUrl(null)
    setOutput(prev => [...prev, '> Stopped'])
  }, [])

  // DB 파일이 있는지 확인 (HTML)
  const hasDBHtmlFile = dbFiles.some((f) =>
    f.file_name.endsWith('.html') || f.file_name.endsWith('.htm')
  )

  // 🔥 웹 환경에서도 AI 코딩 페이지로 이동 버튼 표시
  // Electron이 아니고 DB 파일도 없어도 "AI 코딩에서 열기" 버튼은 표시

  const statusColors: Record<RunStatus, string> = {
    idle: "text-zinc-500",
    initializing: "text-blue-500 dark:text-blue-400",
    booting: "text-blue-500 dark:text-blue-400",
    installing: "text-cyan-500 dark:text-cyan-400",
    starting: "text-amber-500 dark:text-amber-400",
    running: "text-emerald-500 dark:text-emerald-400",
    stopping: "text-amber-500 dark:text-amber-400",
    error: "text-red-500 dark:text-red-400",
    preview: "text-purple-500 dark:text-purple-400",
  }

  const statusLabels: Record<RunStatus, string> = {
    idle: "대기",
    initializing: "준비 중...",
    booting: "부팅 중...",
    installing: "설치 중...",
    starting: "시작 중...",
    preview: "미리보기",
    running: "실행 중",
    stopping: "중지 중...",
    error: "오류",
  }

  return (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${status === "running" ? "bg-emerald-500 animate-pulse" :
              status === "initializing" ? "bg-blue-500 animate-pulse" :
                "bg-zinc-400 dark:bg-zinc-600"
            }`} />
          <Terminal className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">프로젝트 실행</span>
          <span className={`text-xs ${statusColors[status]}`}>({statusLabels[status]})</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "initializing" || status === "booting" || status === "installing" || status === "starting" ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500 dark:text-blue-400" />
          ) : status === "idle" || status === "error" ? (
            // 웹 환경에서 HTML 파일이 있으면 Preview 버튼
            !isElectron && hasDBHtmlFile ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  openWebPreview()
                }}
                className="h-7 px-3 bg-purple-600 hover:bg-purple-500 text-white"
              >
                <Eye className="w-3 h-3 mr-1.5" />
                Preview
              </Button>
            ) : (
              // 🔥 Electron이거나 웹 환경 (HTML 없음) → Run + 편집 버튼
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isElectron) {
                      startProject()
                    } else {
                      // 웹 환경에서는 터미널 서버로 실행
                      startWebProject()
                    }
                  }}
                  disabled={isElectron && !folderPath}
                  className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                >
                  <Play className="w-3 h-3 mr-1.5" />
                  Run
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/dashboard-group/ai-coding?projectId=${projectId}`)
                  }}
                  className="h-7 px-3 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Code2 className="w-3 h-3 mr-1.5" />
                  편집
                </Button>
              </div>
            )
          ) : status === "running" ? (
            <div className="flex items-center gap-1.5">
              {/* Preview URL 링크 (웹 환경에서 WebContainer 실행 시) */}
              {!isElectron && previewUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(previewUrl, '_blank')
                  }}
                  className="h-7 px-3 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                >
                  <Globe className="w-3 h-3 mr-1.5" />
                  Open
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isElectron) {
                    stopProject()
                  } else {
                    stopWebProject()
                  }
                }}
                className="h-7 px-3 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Square className="w-3 h-3 mr-1.5" />
                Stop
              </Button>
            </div>
          ) : status === "preview" ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setShowPreview(false)
                setStatus("idle")
              }}
              className="h-7 px-3 bg-purple-600 hover:bg-purple-500 text-white"
            >
              <X className="w-3 h-3 mr-1.5" />
              Close
            </Button>
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Script Selector */}
            {config?.scripts && Object.keys(config.scripts).length > 0 && (
              <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800/50 flex items-center gap-2 flex-wrap bg-zinc-50/50 dark:bg-transparent">
                <span className="text-xs text-zinc-500">Script:</span>
                {Object.keys(config.scripts).slice(0, 6).map((script) => (
                  <button
                    key={script}
                    onClick={() => setSelectedScript(script)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${selectedScript === script
                        ? "bg-zinc-900 dark:bg-zinc-700 text-white"
                        : "bg-zinc-200 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                  >
                    {script}
                  </button>
                ))}
              </div>
            )}

            {/* Output Terminal - 모든 환경에서 표시 */}
            {(isElectron || output.length > 0) && (
              <div className="border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-500">Output</span>
                  <button
                    onClick={clearOutput}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2 py-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Clear
                  </button>
                </div>
                <div
                  ref={outputRef}
                  className="h-48 overflow-y-auto px-3 py-2 font-mono text-xs bg-zinc-50 dark:bg-black/50 text-zinc-700 dark:text-zinc-300 space-y-0.5"
                >
                  {output.length === 0 ? (
                    <div className="text-zinc-400 dark:text-zinc-600 py-4 text-center">
                      {isElectron
                        ? (!folderPath ? "워크스페이스 생성 중..." : "Run 버튼을 눌러 프로젝트를 실행하세요")
                        : "Run 버튼을 눌러 프로젝트를 실행하세요"
                      }
                    </div>
                  ) : (
                    output.map((line, idx) => (
                      <div key={idx} className={line.startsWith(">") ? "text-zinc-500" : ""}>
                        {line || "\u00A0"}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Web Preview - 웹 환경에서 DB HTML 미리보기 */}
            {!isElectron && hasDBHtmlFile && (
              <div className="border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-500">HTML 미리보기</span>
                  <button
                    onClick={openInNewWindow}
                    className="text-xs text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 px-2 py-0.5 rounded hover:bg-purple-50 dark:hover:bg-purple-500/10 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    새 창에서 열기
                  </button>
                </div>
                <div className="p-2 bg-zinc-50 dark:bg-black/50">
                  {showPreview ? (
                    <iframe
                      srcDoc={previewContent}
                      className="w-full h-64 bg-white rounded border border-zinc-200 dark:border-zinc-700"
                      title={`${projectName} Preview`}
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div className="h-32 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                      <Eye className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Preview 버튼을 눌러 미리보기</p>
                      <p className="text-xs mt-1">{dbFiles.find(f => f.file_name.endsWith('.html'))?.file_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 🔥 웹 환경에서 WebContainer 실행 중 - Preview iframe */}
            {!isElectron && previewUrl && status === "running" && (
              <div className="border-t border-zinc-200 dark:border-zinc-800/50">
                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800/50">
                  <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-emerald-500" />
                    Live Preview
                  </span>
                  <button
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="text-xs text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-0.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    새 창에서 열기
                  </button>
                </div>
                <div className="p-2 bg-zinc-50 dark:bg-black/50">
                  <iframe
                    src={previewUrl}
                    className="w-full h-80 bg-white rounded border border-zinc-200 dark:border-zinc-700"
                    title={`${projectName} Preview`}
                  />
                </div>
              </div>
            )}

            {/* 🔥 웹 환경에서 HTML 파일이 없고 실행 중이 아닐 때 - Run 안내 */}
            {!isElectron && !hasDBHtmlFile && status === "idle" && output.length === 0 && (
              <div className="border-t border-zinc-200 dark:border-zinc-800/50 p-4">
                <div className="text-center space-y-3">
                  <Play className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
                  <div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Run 버튼을 눌러 브라우저에서 직접 프로젝트를 실행하세요
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      WebContainer를 사용하여 Node.js 프로젝트를 실행합니다
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
