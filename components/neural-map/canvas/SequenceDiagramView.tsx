'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface SequenceMessage {
  from: string
  to: string
  message: string
  type: 'sync' | 'async' | 'return'
}

interface SequenceDiagramViewProps {
  className?: string
}

export default function SequenceDiagramView({ className }: SequenceDiagramViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const svgRef = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Example data
    const actors = ['User', 'Client', 'Server', 'Database']
    const messages: SequenceMessage[] = [
      { from: 'User', to: 'Client', message: 'click button', type: 'sync' },
      { from: 'Client', to: 'Server', message: 'POST /api/data', type: 'async' },
      { from: 'Server', to: 'Database', message: 'SELECT *', type: 'sync' },
      { from: 'Database', to: 'Server', message: 'rows[]', type: 'return' },
      { from: 'Server', to: 'Client', message: '{ data }', type: 'return' },
      { from: 'Client', to: 'User', message: 'render UI', type: 'sync' },
    ]

    const actorWidth = 120
    const actorHeight = 50
    const messageSpacing = 80
    const startY = 100

    const actorSpacing = (width - 100) / (actors.length - 1)

    // Draw actors
    const actorGroup = svg.append('g').attr('class', 'actors')

    actors.forEach((actor, i) => {
      const x = 50 + i * actorSpacing

      // Actor box
      actorGroup
        .append('rect')
        .attr('x', x - actorWidth / 2)
        .attr('y', 20)
        .attr('width', actorWidth)
        .attr('height', actorHeight)
        .attr('rx', 8)
        .attr('fill', isDark ? '#3b82f6' : '#2563eb')
        .attr('stroke', isDark ? '#1e40af' : '#1e3a8a')
        .attr('stroke-width', 2)

      // Actor label
      actorGroup
        .append('text')
        .attr('x', x)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', 14)
        .attr('font-weight', 600)
        .text(actor)

      // Lifeline
      actorGroup
        .append('line')
        .attr('x1', x)
        .attr('y1', 20 + actorHeight)
        .attr('x2', x)
        .attr('y2', startY + messages.length * messageSpacing + 50)
        .attr('stroke', isDark ? '#52525b' : '#a1a1aa')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
    })

    // Draw messages
    const messageGroup = svg.append('g').attr('class', 'messages')

    messages.forEach((msg, i) => {
      const fromIndex = actors.indexOf(msg.from)
      const toIndex = actors.indexOf(msg.to)
      const fromX = 50 + fromIndex * actorSpacing
      const toX = 50 + toIndex * actorSpacing
      const y = startY + i * messageSpacing

      const color = msg.type === 'return' ? (isDark ? '#10b981' : '#059669') : (isDark ? '#60a5fa' : '#3b82f6')

      // Message arrow
      messageGroup
        .append('line')
        .attr('x1', fromX)
        .attr('y1', y)
        .attr('x2', toX)
        .attr('y2', y)
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)')

      // Message label
      const midX = (fromX + toX) / 2
      messageGroup
        .append('rect')
        .attr('x', midX - 60)
        .attr('y', y - 25)
        .attr('width', 120)
        .attr('height', 20)
        .attr('fill', isDark ? '#27272a' : '#ffffff')
        .attr('stroke', color)
        .attr('stroke-width', 1)
        .attr('rx', 4)

      messageGroup
        .append('text')
        .attr('x', midX)
        .attr('y', y - 10)
        .attr('text-anchor', 'middle')
        .attr('fill', isDark ? '#fafafa' : '#18181b')
        .attr('font-size', 12)
        .text(msg.message)
    })

    // Define arrowhead marker
    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('refX', 9)
      .attr('refY', 3)
      .attr('orient', 'auto')
      .append('polygon')
      .attr('points', '0 0, 10 3, 0 6')
      .attr('fill', isDark ? '#60a5fa' : '#3b82f6')

    // Zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        svg.selectAll('g').attr('transform', event.transform)
        setZoom(event.transform.k)
      })

    svg.call(zoomBehavior as any)

  }, [isDark])

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current!)
    svg.transition().call((d3.zoom() as any).scaleBy, 1.2)
  }

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current!)
    svg.transition().call((d3.zoom() as any).scaleBy, 0.8)
  }

  const handleReset = () => {
    const svg = d3.select(svgRef.current!)
    svg.transition().call((d3.zoom() as any).transform, d3.zoomIdentity)
  }

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
            Sequence Diagram
          </span>
          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Example: API Call Flow
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <Maximize className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <svg ref={svgRef} className="flex-1 w-full h-full cursor-move" />
    </div>
  )
}
