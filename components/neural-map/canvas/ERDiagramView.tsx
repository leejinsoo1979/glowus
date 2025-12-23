'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import cytoscape, { Core } from 'cytoscape'
import dagre from 'cytoscape-dagre'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ZoomIn, ZoomOut, Maximize, Loader2 } from 'lucide-react'

if (typeof cytoscape !== 'undefined') {
  cytoscape.use(dagre)
}

interface ERDiagramViewProps {
  projectPath?: string
  className?: string
}

export default function ERDiagramView({ projectPath, className }: ERDiagramViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [entityCount, setEntityCount] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !projectPath) return

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

    // Load real database schema
    const loadSchema = async () => {
      setIsLoading(true)
      try {
        if (window.electron?.fs?.scanSchema) {
          const schemaData = await window.electron.fs.scanSchema(projectPath)

          if (schemaData && Array.isArray(schemaData)) {
            const entities: any[] = []
            const relationships: any[] = []

            schemaData.slice(0, 15).forEach((entity: any) => {
              const { name, fields, primaryKey, foreignKeys } = entity

              // Build entity label
              let label = `${name}\n─────\n`
              if (primaryKey) {
                label += `PK: ${Array.isArray(primaryKey) ? primaryKey.join(', ') : primaryKey}\n`
              }
              if (foreignKeys && foreignKeys.length > 0) {
                foreignKeys.forEach((fk: any) => {
                  label += `FK: ${fk.field}\n`
                })
              }
              if (fields && fields.length > 0) {
                label += '─────\n'
                label += fields.slice(0, 5).map((f: any) => `${f.name}: ${f.type || 'any'}`).join('\n')
                if (fields.length > 5) label += '\n...'
              }

              entities.push({ id: name, label })

              // Add foreign key relationships
              if (foreignKeys && foreignKeys.length > 0) {
                foreignKeys.forEach((fk: any) => {
                  if (fk.references) {
                    relationships.push({
                      source: name,
                      target: fk.references,
                      label: `${fk.cardinality || 'N:1'}`,
                    })
                  }
                })
              }
            })

            setEntityCount(entities.length)
            cy.add(entities.map(e => ({ data: e })))
            cy.add(relationships.map(r => ({ data: r })))

            cy.layout({ name: 'dagre', rankDir: 'LR', padding: 50 } as any).run()
            cy.fit(undefined, 50)
          }
        }
      } catch (error) {
        console.error('[ERDiagramView] Failed to load schema:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSchema()

    return () => {
      cy.destroy()
    }
  }, [isDark, projectPath])

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
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
          {!isLoading && entityCount > 0 && (
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {entityCount} entities from your database
            </span>
          )}
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
