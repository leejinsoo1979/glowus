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

interface ClassDiagramViewProps {
  projectPath?: string
  className?: string
}

export default function ClassDiagramView({ projectPath, className }: ClassDiagramViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [classCount, setClassCount] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !projectPath) return

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

    // Load real TypeScript classes
    const loadClasses = async () => {
      setIsLoading(true)
      try {
        if (window.electron?.fs?.scanTypes) {
          const typesData = await window.electron.fs.scanTypes(projectPath, { extensions: ['.ts', '.tsx'] })

          if (typesData && Array.isArray(typesData)) {
            const classes: any[] = []
            const relationships: any[] = []

            typesData.slice(0, 20).forEach((item: any) => {
              const { name, type, properties, methods, extends: extendsClass, implements: implementsInterfaces } = item

              // Create class/interface node
              let label = `${name}\n─────\n`
              if (properties && properties.length > 0) {
                label += properties.slice(0, 3).map((p: any) => `+${p.name}: ${p.type || 'any'}`).join('\n')
                if (properties.length > 3) label += '\n...'
              }
              if (methods && methods.length > 0) {
                label += '\n─────\n'
                label += methods.slice(0, 3).map((m: any) => `+${m.name}()`).join('\n')
                if (methods.length > 3) label += '\n...'
              }

              classes.push({
                id: name,
                label,
                type: type === 'interface' ? 'interface' : type === 'abstract' ? 'abstract' : 'class',
              })

              // Add extends relationship
              if (extendsClass) {
                relationships.push({ source: name, target: extendsClass, type: 'extends', label: 'extends' })
              }

              // Add implements relationships
              if (implementsInterfaces && Array.isArray(implementsInterfaces)) {
                implementsInterfaces.forEach((impl: string) => {
                  relationships.push({ source: name, target: impl, type: 'implements', label: 'implements' })
                })
              }
            })

            setClassCount(classes.length)
            cy.add(classes.map(c => ({ data: c })))
            cy.add(relationships.map(r => ({ data: r })))

            cy.layout({ name: 'dagre', rankDir: 'TB', padding: 50 } as any).run()
            cy.fit(undefined, 50)
          }
        }
      } catch (error) {
        console.error('[ClassDiagramView] Failed to load types:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadClasses()

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
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
          {!isLoading && classCount > 0 && (
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {classCount} classes from your project
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={!projectPath}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={!projectPath}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleFit} disabled={!projectPath}>
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas or Empty State */}
      {!projectPath ? (
        <div className="flex-1 flex items-center justify-center">
          <div className={cn('text-center', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            <p className="text-sm font-medium">프로젝트 폴더를 먼저 선택하세요</p>
            <p className="text-xs mt-2">File → Open Folder (Cmd+O)</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1" />
      )}
    </div>
  )
}
