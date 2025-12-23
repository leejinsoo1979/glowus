'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface GitGraphViewProps {
  className?: string
}

export default function GitGraphView({ className }: GitGraphViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Example git history
    const commits = [
      { id: 0, branch: 'main', message: 'Initial commit', x: 100, y: 100 },
      { id: 1, branch: 'main', message: 'Add feature A', x: 100, y: 200 },
      { id: 2, branch: 'develop', message: 'Start develop', x: 300, y: 200 },
      { id: 3, branch: 'develop', message: 'Feature B', x: 300, y: 300 },
      { id: 4, branch: 'feature-x', message: 'Experiment', x: 500, y: 300 },
      { id: 5, branch: 'develop', message: 'Merge feature-x', x: 300, y: 400 },
      { id: 6, branch: 'main', message: 'Merge develop', x: 100, y: 500 },
    ]

    const links = [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 3, target: 4 },
      { source: 4, target: 5 },
      { source: 3, target: 5 },
      { source: 1, target: 6 },
      { source: 5, target: 6 },
    ]

    const branchColors: Record<string, string> = {
      main: '#3b82f6',
      develop: '#10b981',
      'feature-x': '#f59e0b',
    }

    // Draw links
    svg
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('x1', (d: any) => commits[d.source].x)
      .attr('y1', (d: any) => commits[d.source].y)
      .attr('x2', (d: any) => commits[d.target].x)
      .attr('y2', (d: any) => commits[d.target].y)
      .attr('stroke', isDark ? '#52525b' : '#a1a1aa')
      .attr('stroke-width', 2)

    // Draw commits
    const commitGroups = svg
      .append('g')
      .selectAll('g')
      .data(commits)
      .enter()
      .append('g')
      .attr('transform', (d: any) => `translate(${d.x}, ${d.y})`)

    commitGroups
      .append('circle')
      .attr('r', 20)
      .attr('fill', (d: any) => branchColors[d.branch])
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)

    commitGroups
      .append('text')
      .attr('x', 30)
      .attr('y', 5)
      .attr('fill', isDark ? '#fafafa' : '#18181b')
      .attr('font-size', 12)
      .text((d: any) => d.message)

    commitGroups
      .append('text')
      .attr('x', 30)
      .attr('y', -10)
      .attr('fill', (d: any) => branchColors[d.branch])
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .text((d: any) => d.branch)

    // Zoom behavior
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        svg.selectAll('g').attr('transform', event.transform)
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
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2 border-b',
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-medium', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
            Git Graph
          </span>
          <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            Example: Branch History
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

      <svg ref={svgRef} className="flex-1 w-full h-full cursor-move" />
    </div>
  )
}
