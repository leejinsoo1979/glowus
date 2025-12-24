'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import type { MermaidDiagramType } from '@/lib/neural-map/types'
import {
  generateFlowchartFromNodes,
  generateGitGraph,
  parseGitLog,
  generatePieChart,
  generateClassDiagram,
  generateERDiagram,
  generateStateDiagram,
  generateSequenceDiagram,
  generateGanttChart,
  type FileStats,
  type TypeInfo,
  type TableInfo,
  type APIRoute,
} from '@/lib/neural-map/mermaid-generators'
import {
  Play,
  Copy,
  Download,
  RotateCcw,
  Maximize2,
  Minimize2,
  Code,
  Eye,
  Zap,
  RefreshCw,
  FolderOpen,
  AlertCircle,
} from 'lucide-react'

// Default diagram templates for manual mode
const DIAGRAM_TEMPLATES: Record<MermaidDiagramType, string> = {
  flowchart: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[Deploy]`,

  sequence: `sequenceDiagram
    participant U as User
    participant C as Client
    participant S as Server
    U->>C: Click Button
    C->>S: API Request
    S-->>C: JSON Response
    C-->>U: Display Data`,

  class: `classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`,

  er: `erDiagram
    USER ||--o{ POST : creates
    USER {
        int id PK
        string username
    }
    POST {
        int id PK
        int user_id FK
        string title
    }`,

  gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Development
    Feature A :a1, 2024-01-01, 7d
    Feature B :a2, after a1, 14d`,

  pie: `pie showData
    title File Distribution
    "TypeScript" : 45
    "JavaScript" : 25
    "CSS" : 20
    "Other" : 10`,

  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch()
    Loading --> Success : done
    Loading --> Error : fail
    Success --> Idle : reset`,

  gitgraph: `gitGraph
    commit id: "Initial"
    branch develop
    commit id: "Feature"
    checkout main
    merge develop`,
}

interface MermaidViewProps {
  className?: string
}

export function MermaidView({ className }: MermaidViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const mermaidDiagramType = useNeuralMapStore((s) => s.mermaidDiagramType)
  const projectPath = useNeuralMapStore((s) => s.projectPath)

  const containerRef = useRef<HTMLDivElement>(null)
  const renderIdRef = useRef(0) // Prevent stale renders
  const [mounted, setMounted] = useState(false)
  const [mermaidReady, setMermaidReady] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showCode, setShowCode] = useState(true)
  const [svgContent, setSvgContent] = useState<string>('')
  const [isRendering, setIsRendering] = useState(false)
  const [autoMode, setAutoMode] = useState(true) // Start with auto mode by default
  const [isLoading, setIsLoading] = useState(false)

  // Debug logging for store state changes
  useEffect(() => {
    console.log('[MermaidView] Store state:', {
      projectPath,
      hasElectron: !!window.electron,
      mermaidDiagramType,
      autoMode
    })
  }, [projectPath, mermaidDiagramType, autoMode])
  const [dataSource, setDataSource] = useState<string>('Template')

  // Mount check
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Initialize mermaid (only on client) - separate from rendering
  useEffect(() => {
    if (!mounted) return

    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        themeVariables: isDark ? {
          primaryColor: '#3b82f6',
          primaryTextColor: '#f4f4f5',
          primaryBorderColor: '#52525b',
          lineColor: '#71717a',
          secondaryColor: '#27272a',
          tertiaryColor: '#18181b',
          background: '#09090b',
          mainBkg: '#18181b',
          nodeBorder: '#3f3f46',
          clusterBkg: '#27272a',
          titleColor: '#fafafa',
          edgeLabelBackground: '#27272a',
        } : {
          primaryColor: '#3b82f6',
          primaryTextColor: '#18181b',
          primaryBorderColor: '#d4d4d8',
          lineColor: '#71717a',
          secondaryColor: '#f4f4f5',
          tertiaryColor: '#fafafa',
          background: '#ffffff',
          mainBkg: '#fafafa',
          nodeBorder: '#d4d4d8',
          clusterBkg: '#f4f4f5',
          titleColor: '#09090b',
          edgeLabelBackground: '#f4f4f5',
        },
        flowchart: { curve: 'basis', padding: 20 },
        sequence: { diagramMarginX: 50, diagramMarginY: 10, actorMargin: 50, width: 150, height: 65 },
        gantt: { titleTopMargin: 25, barHeight: 20, barGap: 4, topPadding: 50, leftPadding: 75, fontSize: 11 },
      })
      setMermaidReady(true)
    } catch (err) {
      console.error('Mermaid init error:', err)
    }
  }, [mounted, isDark])

  // Set initial code once mounted
  useEffect(() => {
    if (mounted && !code) {
      setCode(DIAGRAM_TEMPLATES[mermaidDiagramType])
      setDataSource('Template')
    }
  }, [mounted, mermaidDiagramType, code])

  // Auto-generate diagram from project data
  const generateFromProject = useCallback(async () => {
    if (!autoMode || !mounted) return

    // projectPath 없으면 아무것도 생성하지 않음
    if (!projectPath) {
      console.log('[Mermaid] No project path - skipping generation')
      setCode('')
      setDataSource('')
      return
    }

    console.log('[Mermaid] Generating diagram:', {
      type: mermaidDiagramType,
      projectPath,
      autoMode,
      hasElectron: !!window.electron
    })

    setIsLoading(true)
    setError(null)

    try {
      let generatedCode = ''
      let source = ''

      // Get current graph from store (avoid dependency issues)
      const currentGraph = useNeuralMapStore.getState().graph

      switch (mermaidDiagramType) {
        case 'flowchart':
          // Use Neural Map nodes/edges
          if (currentGraph?.nodes?.length) {
            generatedCode = generateFlowchartFromNodes(currentGraph.nodes, currentGraph.edges || [])
            source = `Neural Map (${currentGraph.nodes.length} nodes)`
          }
          break

        case 'gitgraph':
          // Fetch git log from Electron IPC
          if (window.electron?.git?.log) {
            const gitLog = await window.electron.git.log!(projectPath, { maxCommits: 30 })
            if (gitLog) {
              generatedCode = generateGitGraph(parseGitLog(gitLog))
              source = `Git History (${projectPath.split('/').pop()})`
            }
          }
          break

        case 'pie':
          // Fetch file statistics and aggregate by extension
          if (window.electron?.fs?.fileStats) {
            const rawStats = await window.electron.fs.fileStats!(projectPath)
            if (rawStats?.length) {
              // Aggregate by extension: convert individual files to extension counts
              const extMap = new Map<string, { count: number; size: number }>()
              rawStats.forEach((file: any) => {
                const ext = file.extension || 'no-ext'
                const existing = extMap.get(ext) || { count: 0, size: 0 }
                extMap.set(ext, {
                  count: existing.count + 1,
                  size: existing.size + (file.size || 0)
                })
              })
              const aggregatedStats = Array.from(extMap.entries()).map(([extension, data]) => ({
                extension,
                count: data.count,
                size: data.size
              }))
              generatedCode = generatePieChart(aggregatedStats, { title: 'Codebase File Distribution', showData: true })
              source = `File Stats (${rawStats.length} files)`
            }
          }
          break

        case 'class':
          // Scan TypeScript types and transform to expected format
          if (window.electron?.fs?.scanTypes) {
            const rawTypes = await window.electron.fs.scanTypes!(projectPath)
            if (rawTypes?.length) {
              // Transform to TypeInfo format expected by generateClassDiagram
              const transformedTypes = rawTypes.slice(0, 20).map((t: any) => ({
                name: t.name,
                kind: t.kind as 'class' | 'interface' | 'type' | 'enum',
                properties: (t.properties || []).map((p: any) => ({
                  name: p.name,
                  type: p.type,
                  visibility: '+' as const // Default to public
                })),
                methods: [], // Electron API doesn't scan methods yet
                extends: Array.isArray(t.extends) ? t.extends[0] : t.extends,
                implements: []
              }))
              generatedCode = generateClassDiagram(transformedTypes)
              source = `TypeScript (${rawTypes.length} types)`
            }
          }
          break

        case 'er':
          // Scan database schema and transform to expected format
          if (window.electron?.fs?.scanSchema) {
            const rawTables = await window.electron.fs.scanSchema!(projectPath)
            if (rawTables?.length) {
              // Transform to TableInfo format expected by generateERDiagram
              const transformedTables = rawTables.map((t: any) => ({
                name: t.name,
                columns: (t.columns || []).map((c: any) => ({
                  name: c.name,
                  type: c.type,
                  isPrimary: c.isPrimary,
                  isForeign: c.isForeign,
                  // Convert string reference to { table, column } object
                  references: typeof c.references === 'string'
                    ? { table: c.references.split('.')[0] || c.references, column: c.references.split('.')[1] || 'id' }
                    : c.references
                }))
              }))
              generatedCode = generateERDiagram(transformedTables)
              source = `Database Schema (${rawTables.length} tables)`
            }
          }
          break

        case 'sequence':
          // Scan API routes
          if (window.electron?.fs?.scanApiRoutes) {
            const routes = await window.electron.fs.scanApiRoutes!(projectPath)
            if (routes?.length) {
              const apiRoutes: APIRoute[] = routes.map(r => ({
                path: r.path,
                method: r.method as any,
                handlers: []
              }))
              generatedCode = generateSequenceDiagram(apiRoutes)
              source = `API Routes (${routes.length} endpoints)`
            }
          }
          break

        case 'state':
          // Scan Zustand stores
          if (window.electron?.fs?.scanTree) {
            const files = await window.electron.fs.scanTree!(projectPath)
            const storeFiles = Array.isArray(files) ? files.filter((f: any) =>
              (f.path?.includes('/store') || f.path?.includes('/stores')) &&
              (f.path?.endsWith('.ts') || f.path?.endsWith('.tsx'))
            ) : []
            if (storeFiles.length > 0) {
              const storeNames = storeFiles.map((f: any) =>
                f.path.split('/').pop()?.replace(/\.(ts|tsx)$/, '') || 'store'
              )
              generatedCode = generateStateDiagram({
                name: 'App Stores',
                states: ['idle', ...storeNames.slice(0, 5), 'active'],
                actions: storeNames.slice(0, 5).map((name: string) => ({
                  name: `use${name}`,
                  from: 'idle',
                  to: name
                })),
                initialState: 'idle'
              })
              source = `Zustand Stores (${storeFiles.length} files)`
            }
          }
          break

        case 'gantt':
          // Git commits as timeline
          if (window.electron?.git?.log) {
            const gitLog = await window.electron.git.log!(projectPath, { maxCommits: 10 })
            if (gitLog) {
              const commits = parseGitLog(gitLog)
              if (commits.length) {
                // Convert commits to TaskInfo format
                const tasks = commits.slice(0, 10).map((c, i) => ({
                  id: `t${i}`,
                  title: c.message.slice(0, 30),
                  status: 'done' as const,
                  startDate: c.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                  duration: 1,
                  section: 'Commits'
                }))
                generatedCode = generateGanttChart(tasks, {
                  title: 'Recent Development Activity'
                })
                source = `Git Commits (${commits.length})`
              }
            }
          }
          break

        default:
          break
      }

      setCode(generatedCode)
      setDataSource(source)
    } catch (err: any) {
      console.error('Auto-generate error:', err)
      setError(err.message)
      setCode('')
      setDataSource('')
    } finally {
      setIsLoading(false)
    }
  }, [autoMode, mermaidDiagramType, projectPath, mounted])

  // Generate when diagram type changes or auto mode is enabled
  useEffect(() => {
    if (!mounted) return

    if (autoMode) {
      generateFromProject()
    } else {
      setCode(DIAGRAM_TEMPLATES[mermaidDiagramType])
      setDataSource('Template')
    }
  }, [mermaidDiagramType, autoMode, projectPath, mounted, generateFromProject])

  // Render diagram - stable function that reads current state
  const renderDiagram = useCallback(async () => {
    if (!mermaidReady) return

    const currentCode = code
    if (!currentCode.trim()) return

    const currentRenderId = ++renderIdRef.current
    setIsRendering(true)
    setError(null)

    try {
      const id = `mermaid-${currentRenderId}-${Date.now()}`
      await mermaid.parse(currentCode)
      const { svg } = await mermaid.render(id, currentCode)

      // Only update if this is still the latest render
      if (renderIdRef.current === currentRenderId) {
        setSvgContent(svg)
      }
    } catch (err: any) {
      if (renderIdRef.current === currentRenderId) {
        console.error('Mermaid render error:', err)
        setError(err.message || 'Failed to render diagram')
        setSvgContent('')
      }
    } finally {
      if (renderIdRef.current === currentRenderId) {
        setIsRendering(false)
      }
    }
  }, [code, mermaidReady])

  // Auto-render on code change (debounced) - only after mermaid is ready
  useEffect(() => {
    if (!mermaidReady || !code) return

    const timer = setTimeout(() => {
      renderDiagram()
    }, 300)

    return () => clearTimeout(timer)
  }, [code, mermaidReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render when theme changes (after mermaid re-initializes)
  useEffect(() => {
    if (!mermaidReady || !code) return
    renderDiagram()
  }, [isDark, mermaidReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [code])

  // Download SVG
  const handleDownload = useCallback(() => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${mermaidDiagramType}-diagram.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [svgContent, mermaidDiagramType])

  // Reset to template
  const handleReset = useCallback(() => {
    setCode(DIAGRAM_TEMPLATES[mermaidDiagramType])
    setDataSource('Template')
    setError(null)
  }, [mermaidDiagramType])

  return (
    <div
      className={cn(
        'flex flex-col h-full w-full overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50',
        isDark ? 'bg-zinc-950' : 'bg-zinc-50',
        className
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b shrink-0',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            {mermaidDiagramType.charAt(0).toUpperCase() + mermaidDiagramType.slice(1)}
          </span>

          {/* Auto/Manual Toggle */}
          <button
            onClick={() => setAutoMode(!autoMode)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              autoMode
                ? isDark
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : isDark
                  ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
            )}
          >
            <Zap className="w-3 h-3" />
            {autoMode ? 'Auto' : 'Manual'}
          </button>

          {/* Data Source Info */}
          {dataSource && (
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {dataSource}
            </span>
          )}

          {(isRendering || isLoading || !mermaidReady) && (
            <RefreshCw className={cn('w-3 h-3 animate-spin', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh */}
          {autoMode && (
            <button
              onClick={generateFromProject}
              disabled={isLoading}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isDark
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 disabled:opacity-50'
                  : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 disabled:opacity-50'
              )}
              title="Refresh from project"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowCode(!showCode)}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700',
              showCode && (isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700')
            )}
            title={showCode ? 'Hide Code' : 'Show Code'}
          >
            {showCode ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
          </button>

          <button
            onClick={renderDiagram}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title="Render (Ctrl+Enter)"
          >
            <Play className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopy}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title="Copy Code"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            disabled={!svgContent}
            className={cn(
              'p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title="Download SVG"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleReset}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title="Reset to Template"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className={cn('w-px h-4 mx-1', isDark ? 'bg-zinc-700' : 'bg-zinc-300')} />

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isDark
                ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* No Project - Full Screen Message */}
      {autoMode && !projectPath && (
        <div className="flex-1 flex items-center justify-center">
          <div className={cn('text-center', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">프로젝트 폴더를 먼저 선택하세요</p>
            <p className="text-xs mt-2">File → Open Folder (Cmd+O)</p>
          </div>
        </div>
      )}

      {/* Main Content - Only show if projectPath exists or manual mode */}
      {(projectPath || !autoMode) && (
      <div className="flex-1 flex overflow-hidden">
        {/* Code Editor */}
        {showCode && (
          <div
            className={cn(
              'w-1/3 min-w-[300px] max-w-[500px] border-r flex flex-col',
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            )}
          >
            <div
              className={cn(
                'px-3 py-1.5 text-xs font-medium border-b flex items-center justify-between',
                isDark ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
              )}
            >
              <span>Mermaid Code</span>
              {!autoMode && (
                <span className={cn('text-[10px]', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                  Editable
                </span>
              )}
            </div>
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                if (autoMode) setAutoMode(false) // Switch to manual if user edits
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  renderDiagram()
                }
              }}
              spellCheck={false}
              className={cn(
                'flex-1 p-3 font-mono text-sm resize-none focus:outline-none',
                isDark
                  ? 'bg-zinc-900 text-zinc-300 placeholder-zinc-600'
                  : 'bg-white text-zinc-700 placeholder-zinc-400'
              )}
              placeholder="Enter your Mermaid diagram code here..."
            />
          </div>
        )}

        {/* Diagram Preview */}
        <div
          ref={containerRef}
          className={cn(
            'flex-1 overflow-auto p-6 flex items-center justify-center',
            isDark ? 'bg-zinc-950' : 'bg-zinc-50'
          )}
        >
          {!mermaidReady ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className={cn('w-6 h-6 animate-spin', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                Initializing diagram renderer...
              </span>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className={cn('w-6 h-6 animate-spin', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
              <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                Loading project data...
              </span>
            </div>
          ) : error ? (
            <div
              className={cn(
                'max-w-md p-4 rounded-lg border',
                isDark
                  ? 'bg-red-950/50 border-red-900 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-600'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Syntax Error</span>
              </div>
              <p className="text-sm opacity-80 font-mono whitespace-pre-wrap">{error}</p>
            </div>
          ) : svgContent ? (
            <div
              className={cn(
                'mermaid-container p-4 rounded-lg max-w-full overflow-auto',
                isDark ? 'bg-zinc-900' : 'bg-white'
              )}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {autoMode ? 'Generating diagram...' : 'Enter Mermaid code to see the diagram preview'}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

export default MermaidView
