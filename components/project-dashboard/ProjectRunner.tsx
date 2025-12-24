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
} from "lucide-react"
import { Button } from "@/components/ui/Button"

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

type RunStatus = "idle" | "starting" | "running" | "stopping" | "error" | "initializing"

export function ProjectRunner({
  projectId,
  folderPath: initialFolderPath,
  projectName,
  onFolderLinked
}: ProjectRunnerProps) {
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

  // Sync with prop changes
  useEffect(() => {
    setFolderPath(initialFolderPath)
  }, [initialFolderPath])

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electron?.projectRunner)
  }, [])

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
      if (status === "running" && isElectron) {
        window.electron?.projectRunner?.stop?.(runnerId.current)
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

  // Don't render if not in Electron
  if (!isElectron) {
    return null
  }

  const statusColors: Record<RunStatus, string> = {
    idle: "text-zinc-500",
    initializing: "text-blue-400",
    starting: "text-amber-400",
    running: "text-emerald-400",
    stopping: "text-amber-400",
    error: "text-red-400",
  }

  const statusLabels: Record<RunStatus, string> = {
    idle: "대기",
    initializing: "준비 중...",
    starting: "시작 중...",
    running: "실행 중",
    stopping: "중지 중...",
    error: "오류",
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            status === "running" ? "bg-emerald-500 animate-pulse" :
            status === "initializing" ? "bg-blue-500 animate-pulse" :
            "bg-zinc-600"
          }`} />
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">프로젝트 실행</span>
          <span className={`text-xs ${statusColors[status]}`}>({statusLabels[status]})</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "initializing" ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          ) : status === "idle" || status === "error" ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                startProject()
              }}
              disabled={!folderPath}
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
            >
              <Play className="w-3 h-3 mr-1.5" />
              Run
            </Button>
          ) : status === "running" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                stopProject()
              }}
              className="h-7 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Square className="w-3 h-3 mr-1.5" />
              Stop
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
              <div className="px-4 py-2 border-t border-zinc-800/50 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500">Script:</span>
                {Object.keys(config.scripts).slice(0, 6).map((script) => (
                  <button
                    key={script}
                    onClick={() => setSelectedScript(script)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      selectedScript === script
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {script}
                  </button>
                ))}
              </div>
            )}

            {/* Output Terminal */}
            <div className="border-t border-zinc-800/50">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80">
                <span className="text-xs text-zinc-500">Output</span>
                <button
                  onClick={clearOutput}
                  className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded hover:bg-zinc-800"
                >
                  Clear
                </button>
              </div>
              <div
                ref={outputRef}
                className="h-48 overflow-y-auto px-3 py-2 font-mono text-xs bg-black/50 text-zinc-300 space-y-0.5"
              >
                {output.length === 0 ? (
                  <div className="text-zinc-600 py-4 text-center">
                    {!folderPath ? "워크스페이스 생성 중..." : "Run 버튼을 눌러 프로젝트를 실행하세요"}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
