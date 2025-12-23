'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape, { Core, NodeSingular } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { Button } from '@/components/ui/Button'
import { Upload, FolderOpen, Loader2 } from 'lucide-react'
import { buildDependencyGraph, DependencyGraph, planToGraph } from '@/lib/neural-map/code-analyzer'
import { useNeuralMapStore } from '@/lib/neural-map/store'

// Register dagre layout
if (typeof cytoscape !== 'undefined') {
  cytoscape.use(dagre)
}

interface CytoscapeViewProps {
  projectPath?: string
  mapId?: string
}

export default function CytoscapeView({ projectPath, mapId }: CytoscapeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [graph, setGraph] = useState<DependencyGraph | null>(null)
  const [mode, setMode] = useState<'forward' | 'backward'>('backward')
  const [autoScanned, setAutoScanned] = useState(false)

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#4F46E5',
            'label': 'data(label)',
            'width': 80,
            'height': 80,
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'color': '#fff',
            'text-outline-width': 2,
            'text-outline-color': '#4F46E5',
            'border-width': 2,
            'border-color': '#312E81',
          },
        },
        {
          selector: 'node[type="component"]',
          style: {
            'background-color': '#10B981',
            'shape': 'round-rectangle',
          },
        },
        {
          selector: 'node[type="api"]',
          style: {
            'background-color': '#F59E0B',
            'shape': 'diamond',
          },
        },
        {
          selector: 'node[type="database"]',
          style: {
            'background-color': '#EF4444',
            'shape': 'barrel',
          },
        },
        {
          selector: 'node[type="function"]',
          style: {
            'background-color': '#8B5CF6',
            'shape': 'ellipse',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#94A3B8',
            'target-arrow-color': '#94A3B8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '10px',
            'text-rotation': 'autorotate',
          },
        },
        {
          selector: 'edge[type="import"]',
          style: {
            'line-color': '#3B82F6',
            'target-arrow-color': '#3B82F6',
          },
        },
        {
          selector: 'edge[type="calls"]',
          style: {
            'line-color': '#8B5CF6',
            'target-arrow-color': '#8B5CF6',
            'line-style': 'dashed',
          },
        },
      ],
      layout: {
        name: 'dagre',
      },
    } as any) // Type assertion for dagre layout options

    cyRef.current = cy

    // Add interactivity
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular
      const msg = `[CytoscapeView] 🖱️ Node clicked: ${JSON.stringify(node.data())}`
      console.log(msg)
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.appendFile) {
        try {
          (window as any).electron.fs.appendFile('/tmp/cytoscape_debug.log', msg + '\n')
        } catch (e) {
          // Ignore
        }
      }
    })

    return () => {
      cy.destroy()
    }
  }, [])

  // Scan project folder (Backward mode)
  const handleScanProject = useCallback(async () => {
    if (!projectPath) {
      alert('프로젝트 경로가 설정되지 않았습니다.')
      console.error('[CytoscapeView] ❌ No project path set!')
      return
    }

    const log = (msg: string) => {
      console.log(msg)
      // Also write to file for debugging in packaged app
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.appendFile) {
        try {
          (window as any).electron.fs.appendFile('/tmp/cytoscape_debug.log', msg + '\n')
        } catch (e) {
          // Ignore
        }
      }
    }

    log('[CytoscapeView] 🔍 Starting project scan...')
    log('[CytoscapeView] 📂 Project path: ' + projectPath)

    setIsLoading(true)
    try {
      // Check if Electron API is available
      const electronFs = window.electron?.fs
      if (!electronFs?.scanTree) {
        throw new Error('Electron API not available')
      }

      // Scan files using Electron IPC with content included
      log('[CytoscapeView] 📋 Scanning project files...')
      const result = await (electronFs as any).scanTree(projectPath, {
        includeContent: true,
        contentExtensions: ['.ts', '.tsx', '.js', '.jsx'],
        includeSystemFiles: false,
      })

      log(`[CytoscapeView] ✅ Scanned ${result.stats.fileCount} files, ${result.stats.dirCount} directories in ${result.stats.elapsed}ms`)

      // Flatten tree structure to get all files with content
      const flattenTree = (node: any): any[] => {
        if (node.kind === 'file' && node.content) {
          return [{
            path: node.path,
            content: node.content,
          }]
        }
        if (node.kind === 'directory' && node.children) {
          return node.children.flatMap(flattenTree)
        }
        return []
      }

      const validFiles = flattenTree(result.tree).slice(0, 100) // Limit to 100 files for performance
      log(`[CytoscapeView] 📖 Found ${validFiles.length} code files with content`)

      // Build dependency graph
      log('[CytoscapeView] 🔗 Building dependency graph...')
      const dependencyGraph = buildDependencyGraph(validFiles, projectPath)
      log(`[CytoscapeView] 📊 Graph created: ${dependencyGraph.nodes.length} nodes, ${dependencyGraph.edges.length} edges`)

      if (dependencyGraph.nodes.length === 0) {
        alert(`⚠️ 분석 완료했지만 노드가 0개입니다.\n\n파일 ${validFiles.length}개를 읽었지만 파싱에 실패했거나 코드 파일이 없습니다.\n\n다음을 확인하세요:\n- TypeScript/JavaScript 파일이 있는지\n- node_modules가 아닌 프로젝트 폴더를 선택했는지`)
      }

      setGraph(dependencyGraph)
    } catch (error) {
      const errorMsg = `[CytoscapeView] ❌ Failed to scan project: ${(error as Error).message}`
      console.error(errorMsg)
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.appendFile) {
        try {
          (window as any).electron.fs.appendFile('/tmp/cytoscape_debug.log', errorMsg + '\n')
        } catch (e) {
          // Ignore
        }
      }
      alert('프로젝트 스캔 실패: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  // Auto-scan project when projectPath is set
  useEffect(() => {
    if (projectPath && !autoScanned && !isLoading && !graph) {
      const msg = `[CytoscapeView] 🚀 Auto-scanning project: ${projectPath}`
      console.log(msg)
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.appendFile) {
        try {
          (window as any).electron.fs.appendFile('/tmp/cytoscape_debug.log', msg + '\n')
        } catch (e) {
          // Ignore
        }
      }
      setAutoScanned(true)
      handleScanProject()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath])

  // Load graph data when available
  useEffect(() => {
    if (!cyRef.current || !graph) return

    const cy = cyRef.current

    // Clear existing elements
    cy.elements().remove()

    // Add nodes
    const nodes = graph.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        type: node.type,
        ...node.metadata,
      },
    }))

    // Create a set of valid node IDs
    const nodeIds = new Set(graph.nodes.map(n => n.id))

    // Add edges - only include edges with valid source and target nodes
    const edges = graph.edges
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          label: edge.label,
        },
      }))

    console.log(`[CytoscapeView] 🔗 Filtered ${graph.edges.length - edges.length} invalid edges (missing nodes)`)

    cy.add([...nodes, ...edges])

    // Apply layout
    cy.layout({
      name: 'dagre',
      animate: true,
      animationDuration: 500,
    } as any).run()

    // Fit to view
    cy.fit(undefined, 50)
  }, [graph])

  // Load AI-generated plan (Forward mode)
  const handleLoadPlan = () => {
    // Example AI-generated plan
    const examplePlan = {
      components: [
        { name: 'UserDashboard', type: 'component', props: ['userId', 'theme'] },
        { name: 'TaskList', type: 'component', props: ['tasks', 'onUpdate'] },
        { name: 'TaskCard', type: 'component', props: ['task'] },
      ],
      apis: [
        { name: 'getUserTasks', endpoint: '/api/tasks', method: 'GET' },
        { name: 'updateTask', endpoint: '/api/tasks/:id', method: 'PUT' },
      ],
      database: [
        { table: 'users', fields: ['id', 'name', 'email'] },
        { table: 'tasks', fields: ['id', 'userId', 'title', 'status'] },
      ],
      relationships: [
        { from: 'UserDashboard', to: 'TaskList', type: 'renders' },
        { from: 'TaskList', to: 'TaskCard', type: 'renders' },
        { from: 'TaskList', to: 'getUserTasks', type: 'calls' },
        { from: 'TaskCard', to: 'updateTask', type: 'calls' },
        { from: 'getUserTasks', to: 'tasks', type: 'uses' },
        { from: 'updateTask', to: 'tasks', type: 'saves' },
      ],
    }

    const planGraph = planToGraph(examplePlan)
    setGraph(planGraph)
    setMode('forward')
  }

  // Select project folder
  const handleSelectFolder = async () => {
    const electronFs = window.electron?.fs
    if (!electronFs?.selectDirectory) {
      alert('Electron API가 필요합니다. 데스크톱 앱에서 실행하세요.')
      return
    }

    try {
      const result = await electronFs.selectDirectory()
      if (result) {
        const msg = `[CytoscapeView] 📁 Selected folder: ${result.path}`
        console.log(msg)
        if (typeof window !== 'undefined' && (window as any).electron?.fs?.appendFile) {
          try {
            (window as any).electron.fs.appendFile('/tmp/cytoscape_debug.log', msg + '\n')
          } catch (e) {
            // Ignore
          }
        }
        // Update project path in store
        useNeuralMapStore.getState().setProjectPath(result.path)
      }
    } catch (error) {
      const errorMsg = `[CytoscapeView] ❌ Failed to select folder: ${error}`
      console.error(errorMsg)
      if (typeof window !== 'undefined' && (window as any).electron?.fs?.appendFile) {
        try {
          (window as any).electron.fs.appendFile('/tmp/cytoscape_debug.log', errorMsg + '\n')
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b p-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectFolder}
            disabled={isLoading}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            폴더 선택
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanProject}
            disabled={isLoading || !projectPath}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {graph ? '다시 분석' : '프로젝트 분석'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadPlan}
            disabled={isLoading}
          >
            AI 계획 불러오기 (예제)
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            모드: {mode === 'forward' ? '설계 (Forward)' : '분석 (Backward)'}
          </div>
        </div>
        {projectPath && (
          <div className="text-xs text-muted-foreground">
            📂 프로젝트: {projectPath.split('/').pop() || projectPath}
            {graph && ` • ${graph.nodes.length}개 노드, ${graph.edges.length}개 연결`}
          </div>
        )}
      </div>

      {/* Cytoscape Container */}
      <div ref={containerRef} className="flex-1 bg-background" />

      {/* Instructions */}
      {!graph && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground">
            <p className="mb-2">프로젝트 폴더를 선택하고 "프로젝트 분석"을 클릭하세요.</p>
            <p className="text-xs">
              또는 "AI 계획 불러오기"로 예제 설계도를 확인하세요.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
