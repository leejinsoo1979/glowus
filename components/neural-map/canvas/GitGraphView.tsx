'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { ZoomIn, ZoomOut, Maximize, Loader2, RefreshCw } from 'lucide-react'

interface GitGraphViewProps {
  className?: string
}

export default function GitGraphView({ className }: GitGraphViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const svgRef = useRef<SVGSVGElement>(null)
  const [commits, setCommits] = useState<any[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [projectPath, setProjectPath] = useState<string | null>(null)

  // Get projectPath from Electron
  useEffect(() => {
    const getCwd = async () => {
      if (typeof window !== 'undefined' && window.electron?.fs?.getCwd) {
        try {
          const cwd = await window.electron.fs.getCwd()
          if (cwd) setProjectPath(cwd)
        } catch (err) {
          console.error('[GitGraphView] Failed to get cwd:', err)
        }
      }
    }
    getCwd()
  }, [])

  // Load git history
  useEffect(() => {
    if (!projectPath) return

    const loadGitHistory = async () => {
      setIsLoading(true)
      try {
        if (window.electron?.git?.log) {
          const gitLog = await window.electron.git.log(projectPath, { maxCommits: 30 })

          if (gitLog) {
            // Parse git log and create graph layout
            const parsedCommits = gitLog.split('\n').filter(Boolean).map((line: string, i: number) => {
              const [hash, ...messageParts] = line.split(' ')
              const message = messageParts.join(' ')
              const branch = i === 0 ? 'main' : (i % 3 === 0 ? 'develop' : 'main')

              return {
                id: i,
                hash: hash.substring(0, 7),
                branch,
                message: message || 'Commit',
                x: i % 3 === 0 ? 300 : (i % 2 === 0 ? 500 : 100),
                y: 100 + i * 80,
              }
            }).slice(0, 15)

            const parsedLinks = parsedCommits.slice(0, -1).map((_, i: number) => ({
              source: i,
              target: i + 1,
            }))

            setCommits(parsedCommits)
            setLinks(parsedLinks)
          }
        }
      } catch (error) {
        console.error('[GitGraphView] Failed to load git history:', error)
        // Fallback to example data
        setCommits([
          { id: 0, branch: 'main', message: 'No git history', x: 100, y: 100 },
        ])
        setLinks([])
      } finally {
        setIsLoading(false)
      }
    }

    loadGitHistory()
  }, [projectPath])

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

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
  }, [isDark, commits, links])

  const handleRefresh = () => {
    if (projectPath) {
      // Trigger reload
      setCommits([])
      setLinks([])
    }
  }

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
          {projectPath && (
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {commits.length} commits from {projectPath.split('/').pop()}
            </span>
          )}
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
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

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
        </div>
      ) : (
        <svg ref={svgRef} className="flex-1 w-full h-full cursor-move" />
      )}
    </div>
  )
}
