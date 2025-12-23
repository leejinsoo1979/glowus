'use client'

import { useEffect, useRef, useCallback } from 'react'
import cytoscape, { Core } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

if (typeof cytoscape !== 'undefined') {
  cytoscape.use(dagre)
}

interface ClassDiagramViewProps {
  className?: string
}

export default function ClassDiagramView({ className }: ClassDiagramViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': isDark ? '#18181b' : '#ffffff',
            'label': 'data(label)',
            'width': 180,
            'height': 120,
            'shape': 'rectangle',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -50,
            'font-size': '14px',
            'font-weight': 'bold',
            'color': isDark ? '#fafafa' : '#18181b',
            'border-width': 2,
            'border-color': isDark ? '#3b82f6' : '#2563eb',
          },
        },
        {
          selector: 'node[type="interface"]',
          style: {
            'border-style': 'dashed',
            'border-color': isDark ? '#10b981' : '#059669',
          },
        },
        {
          selector: 'node[type="abstract"]',
          style: {
            'font-style': 'italic',
            'border-color': isDark ? '#f59e0b' : '#d97706',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': isDark ? '#52525b' : '#a1a1aa',
            'target-arrow-color': isDark ? '#52525b' : '#a1a1aa',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '11px',
            'color': isDark ? '#a1a1aa' : '#52525b',
          },
        },
        {
          selector: 'edge[type="extends"]',
          style: {
            'line-color': isDark ? '#3b82f6' : '#2563eb',
            'target-arrow-color': isDark ? '#3b82f6' : '#2563eb',
            'target-arrow-shape': 'triangle',
            'target-arrow-fill': 'hollow',
          },
        },
        {
          selector: 'edge[type="implements"]',
          style: {
            'line-color': isDark ? '#10b981' : '#059669',
            'target-arrow-color': isDark ? '#10b981' : '#059669',
            'line-style': 'dashed',
            'target-arrow-shape': 'triangle',
            'target-arrow-fill': 'hollow',
          },
        },
        {
          selector: 'edge[type="uses"]',
          style: {
            'line-color': isDark ? '#a1a1aa' : '#71717a',
            'target-arrow-shape': 'vee',
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

    // Example class diagram data
    const classes = [
      {
        id: 'Animal',
        label: 'Animal\n─────\n+name: string\n+age: number\n─────\n+makeSound()',
        type: 'abstract',
      },
      {
        id: 'Flyable',
        label: 'Flyable\n─────\n+fly()',
        type: 'interface',
      },
      {
        id: 'Dog',
        label: 'Dog\n─────\n+breed: string\n─────\n+bark()\n+fetch()',
        type: 'class',
      },
      {
        id: 'Bird',
        label: 'Bird\n─────\n+wingspan: number\n─────\n+chirp()',
        type: 'class',
      },
    ]

    const relationships = [
      { source: 'Dog', target: 'Animal', type: 'extends', label: 'extends' },
      { source: 'Bird', target: 'Animal', type: 'extends', label: 'extends' },
      { source: 'Bird', target: 'Flyable', type: 'implements', label: 'implements' },
      { source: 'Dog', target: 'Bird', type: 'uses', label: 'chases' },
    ]

    cy.add(classes.map(c => ({ data: c })))
    cy.add(relationships.map(r => ({ data: r })))

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
            Class Diagram
          </span>
          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Example: OOP Inheritance
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
