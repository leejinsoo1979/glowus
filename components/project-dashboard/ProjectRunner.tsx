"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Square,
  RefreshCw,
  Terminal,
  ChevronDown,
  ChevronUp,
  Package,
  X,
  Loader2,
  Check,
  AlertCircle,
  FolderOpen,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/Button"

interface ProjectRunnerProps {
  projectId: string
  folderPath?: string | null
  projectName: string
  githubRepo?: string | null  // e.g., "owner/repo"
  githubCloneUrl?: string | null
  onFolderLinked?: (path: string) => void
}

interface ProjectConfig {
  type: "node" | "python" | "unknown"
  hasPackageJson: boolean
  hasPyProject: boolean
  scripts: Record<string, string>
  mainScript?: string
}

type RunStatus = "idle" | "starting" | "running" | "stopping" | "error"

export function ProjectRunner({
  projectId,
  folderPath: initialFolderPath,
  projectName,
  githubRepo,
  githubCloneUrl,
  onFolderLinked
}: ProjectRunnerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [status, setStatus] = useState<RunStatus>("idle")
  const [output, setOutput] = useState<string[]>([])
  const [selectedScript, setSelectedScript] = useState<string>("dev")
  const [isElectron, setIsElectron] = useState(false)
  const [folderPath, setFolderPath] = useState<string | null | undefined>(initialFolderPath)
  const [isCloning, setIsCloning] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const runnerId = useRef<string>(`runner-${projectId}`)
  const outputRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Sync with prop changes
  useEffect(() => {
    setFolderPath(initialFolderPath)
  }, [initialFolderPath])

  // Auto-clone GitHub repo if no local folder
  const cloneAndSetup = useCallback(async () => {
    if (!githubCloneUrl || !window.electron?.git?.clone) return

    setIsCloning(true)
    setOutput([`> GitHub 저장소 클론 중...`, `> ${githubCloneUrl}`, ""])

    try {
      // Clone to temp directory
      const os = await import('os')
      const tempDir = `/tmp/glowus-projects/${projectId}`

      const result = await window.electron.git.clone(githubCloneUrl, tempDir)

      if (result.success) {
        setOutput(prev => [...prev, `> 클론 완료: ${tempDir}`, ""])
        setFolderPath(tempDir)

        // Save to database
        await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_path: tempDir })
        })

        onFolderLinked?.(tempDir)
      } else {
        setOutput(prev => [...prev, `> 클론 실패: ${result.error || 'Unknown error'}`])
      }
    } catch (error) {
      console.error('Clone failed:', error)
      setOutput(prev => [...prev, `> 오류: ${error}`])
    } finally {
      setIsCloning(false)
    }
  }, [githubCloneUrl, projectId, onFolderLinked])

  // Check if running in Electron
  useEffect(() => {
    setIsElectron(typeof window !== "undefined" && !!window.electron?.projectRunner)
  }, [])

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
        window.electron?.projectRunner?.stop(runnerId.current)
      }
    }
  }, [status, isElectron])

  const detectProjectConfig = async () => {
    if (!window.electron?.fs) return

    try {
      // Try to read package.json
      let hasPackageJson = false
      let scripts: Record<string, string> = {}

      try {
        const packageJsonContent = await window.electron.fs.readFile(`${folderPath}/package.json`)
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
        await window.electron.fs.readFile(`${folderPath}/pyproject.toml`)
        hasPyProject = true
      } catch {
        try {
          await window.electron.fs.readFile(`${folderPath}/requirements.txt`)
          hasPyProject = true
        } catch {
          // No Python project files
        }
      }

      const projectType = hasPackageJson ? "node" : hasPyProject ? "python" : "unknown"

      setConfig({
        type: projectType,
        hasPackageJson,
        hasPyProject,
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
    if (!folderPath || !isElectron || !window.electron?.projectRunner) return

    setStatus("starting")
    setOutput([`> Starting ${projectName}...`, `> Working directory: ${folderPath}`, ""])

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
      }

      if (command) {
        setOutput((prev) => [...prev, `> ${command}`, ""])
        const result = await window.electron.projectRunner.run?.(runnerId.current, folderPath, command)
        if (result?.success) {
          setStatus("running")
        } else {
          setOutput((prev) => [...prev, `> Error: ${result?.error || "Failed to start"}`])
          setStatus("error")
        }
      } else {
        setOutput((prev) => [...prev, "> No runnable script found"])
        setStatus("error")
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

  // Select and link a folder
  const selectFolder = async () => {
    if (!window.electron?.fs?.selectDirectory) return

    setIsLinking(true)
    try {
      const result = await window.electron.fs.selectDirectory()
      if (result?.path) {
        // Update local state
        setFolderPath(result.path)

        // Save to database via API
        const response = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder_path: result.path })
        })

        if (response.ok) {
          onFolderLinked?.(result.path)
        }
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    } finally {
      setIsLinking(false)
    }
  }

  // Don't render if not in Electron
  if (!isElectron) {
    return null
  }

  // Show source connection UI if no folder path
  if (!folderPath) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Terminal className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-1">프로젝트 실행 준비</h3>
            <p className="text-xs text-zinc-500">소스 코드를 연결하면 프로젝트를 실행할 수 있습니다</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
            {/* GitHub Clone Option */}
            {githubCloneUrl ? (
              <Button
                onClick={cloneAndSetup}
                disabled={isCloning}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    클론 중...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    GitHub에서 클론
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => window.open('/settings/github', '_blank')}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
              >
                <Package className="w-4 h-4 mr-2" />
                GitHub 연동
              </Button>
            )}

            {/* Local Folder Option */}
            <Button
              onClick={selectFolder}
              disabled={isLinking}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isLinking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  연결 중...
                </>
              ) : (
                <>
                  <FolderOpen className="w-4 h-4 mr-2" />
                  로컬 폴더
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Output area for clone progress */}
        {output.length > 0 && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="bg-black/50 rounded-lg p-3 font-mono text-xs text-zinc-400 max-h-32 overflow-y-auto">
              {output.map((line, idx) => (
                <div key={idx}>{line || "\u00A0"}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const statusColors = {
    idle: "text-zinc-500",
    starting: "text-amber-400",
    running: "text-emerald-400",
    stopping: "text-amber-400",
    error: "text-red-400",
  }

  const statusLabels = {
    idle: "대기",
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
          <div className={`w-2 h-2 rounded-full ${status === "running" ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">프로젝트 실행</span>
          <span className={`text-xs ${statusColors[status]}`}>({statusLabels[status]})</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "idle" ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                startProject()
              }}
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white"
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
                    Run 버튼을 눌러 프로젝트를 실행하세요
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
