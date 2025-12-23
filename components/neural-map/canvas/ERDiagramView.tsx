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

interface ERDiagramViewProps {
  className?: string
}

export default function ERDiagramView({ className }: ERDiagramViewProps) {
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
            'background-color': isDark ? '#1e293b' : '#f8fafc',
            'label': 'data(label)',
            'width': 200,
            'height': 140,
            'shape': 'rectangle',
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -60,
            'font-size': '14px',
            'font-weight': 'bold',
            'color': isDark ? '#e2e8f0' : '#0f172a',
            'border-width': 3,
            'border-color': isDark ? '#3b82f6' : '#2563eb',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': isDark ? '#64748b' : '#94a3b8',
            'source-arrow-shape': 'diamond',
            'target-arrow-shape': 'tee',
            'source-arrow-color': isDark ? '#64748b' : '#94a3b8',
            'target-arrow-color': isDark ? '#64748b' : '#94a3b8',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '12px',
            'color': isDark ? '#94a3b8' : '#64748b',
            'text-background-color': isDark ? '#0f172a' : '#ffffff',
            'text-background-opacity': 0.8,
            'text-background-padding': '3px',
          },
        },
      ],
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        padding: 50,
      } as any,
    })

    cyRef.current = cy

    // Example ER diagram data
    const entities = [
      {
        id: 'User',
        label: 'User\n─────\nPK: id\n─────\nusername\nemail\npassword\ncreated_at',
      },
      {
        id: 'Post',
        label: 'Post\n─────\nPK: id\nFK: user_id\n─────\ntitle\ncontent\npublished',
      },
      {
        id: 'Comment',
        label: 'Comment\n─────\nPK: id\nFK: post_id\nFK: user_id\n─────\ntext\ncreated_at',
      },
    ]

    const relationships = [
      { source: 'User', target: 'Post', label: '1:N (creates)' },
      { source: 'Post', target: 'Comment', label: '1:N (has)' },
      { source: 'User', target: 'Comment', label: '1:N (writes)' },
    ]

    cy.add(entities.map(e => ({ data: e })))
    cy.add(relationships.map(r => ({ data: r })))

    cy.layout({ name: 'dagre', rankDir: 'LR', padding: 50 } as any).run()
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
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            ER Diagram
          </span>
          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Example: Database Schema
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

      <div ref={containerRef} className="flex-1" />
    </div>
  )
}
