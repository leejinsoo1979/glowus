'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape, { Core } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { RefreshCw, Loader2, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

if (typeof cytoscape !== 'undefined') {
  cytoscape.use(dagre)
}

interface StateDiagramViewProps {
  projectPath?: string
  className?: string
}

export default function StateDiagramView({ projectPath, className }: StateDiagramViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': isDark ? '#3b82f6' : '#2563eb',
            'label': 'data(label)',
            'width': 120,
            'height': 60,
            'shape': 'round-rectangle',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '14px',
            'color': '#fff',
            'text-outline-width': 2,
            'text-outline-color': isDark ? '#1e40af' : '#1e3a8a',
            'border-width': 3,
            'border-color': isDark ? '#1e40af' : '#1e3a8a',
          },
        },
        {
          selector: 'node[type="initial"]',
          style: {
            'background-color': '#10b981',
            'shape': 'ellipse',
            'width': 80,
            'height': 80,
            'border-color': '#059669',
          },
        },
        {
          selector: 'node[type="final"]',
          style: {
            'background-color': '#ef4444',
            'shape': 'ellipse',
            'width': 80,
            'height': 80,
            'border-color': '#dc2626',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': isDark ? '#60a5fa' : '#3b82f6',
            'target-arrow-color': isDark ? '#60a5fa' : '#3b82f6',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '12px',
            'text-rotation': 'autorotate',
            'color': isDark ? '#a1a1aa' : '#52525b',
            'text-background-color': isDark ? '#18181b' : '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '4px',
          },
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        padding: 50,
      } as any,
    })

    cyRef.current = cy

    // Example state machine data
    const states = [
      { id: 'idle', label: 'Idle', type: 'initial' },
      { id: 'loading', label: 'Loading', type: 'normal' },
      { id: 'success', label: 'Success', type: 'normal' },
      { id: 'error', label: 'Error', type: 'normal' },
      { id: 'done', label: 'Done', type: 'final' },
    ]

    const transitions = [
      { source: 'idle', target: 'loading', label: 'fetch()' },
      { source: 'loading', target: 'success', label: 'success' },
      { source: 'loading', target: 'error', label: 'failure' },
      { source: 'success', target: 'done', label: 'complete' },
      { source: 'error', target: 'loading', label: 'retry()' },
      { source: 'error', target: 'idle', label: 'reset()' },
    ]

    cy.add(states.map(s => ({ data: { id: s.id, label: s.label, type: s.type } })))
    cy.add(transitions.map(t => ({ data: { source: t.source, target: t.target, label: t.label } })))

    cy.layout({ name: 'dagre', rankDir: 'TB', padding: 50 } as any).run()
    cy.fit(undefined, 50)

    return () => {
      cy.destroy()
    }
  }, [isDark])

  const handleZoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.2)
  }, [])

  const handleZoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 0.8)
  }, [])

  const handleFit = useCallback(() => {
    cyRef.current?.fit(undefined, 50)
  }, [])

  return (
    <div className={cn('flex flex-col h-full w-full', isDark ? 'bg-zinc-950' : 'bg-zinc-50', className)}>
      {/* Toolbar */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            State Diagram
          </span>
          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Example: App State Machine
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleFit}>
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1" />
    </div>
  )
}
