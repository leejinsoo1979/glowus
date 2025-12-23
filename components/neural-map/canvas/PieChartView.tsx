'use client'

import { useEffect, useState, useCallback } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector } from 'recharts'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { RefreshCw, Loader2 } from 'lucide-react'

interface FileStats {
  extension: string
  count: number
  size: number
}

interface PieChartViewProps {
  projectPath?: string
  className?: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props

  return (
    <g>
      <text x={cx} y={cy} dy={-10} textAnchor="middle" fill={fill} className="text-2xl font-bold">
        {payload.name}
      </text>
      <text x={cx} y={cy} dy={15} textAnchor="middle" fill="#888" className="text-sm">
        {`${value} files (${(percent * 100).toFixed(1)}%)`}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  )
}

export default function PieChartView({ projectPath, className }: PieChartViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [data, setData] = useState<Array<{ name: string; value: number }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const loadStats = useCallback(async () => {
    if (!projectPath) return

    setIsLoading(true)
    try {
      // Try to get file stats from Electron
      if (window.electron?.fs?.scanTree) {
        const result = await window.electron.fs.scanTree(projectPath, {
          includeContent: false,
          includeSystemFiles: false,
        })

        // Count files by extension
        const stats = new Map<string, number>()

        const countFiles = (node: any) => {
          if (node.kind === 'file') {
            const ext = node.name.split('.').pop()?.toLowerCase() || 'no-ext'
            stats.set(ext, (stats.get(ext) || 0) + 1)
          } else if (node.kind === 'directory' && node.children) {
            node.children.forEach(countFiles)
          }
        }

        countFiles(result.tree)

        // Convert to chart data and sort by count
        const chartData = Array.from(stats.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10) // Top 10 file types

        setData(chartData)
      }
    } catch (error) {
      console.error('[PieChartView] Failed to load stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [projectPath])

  useEffect(() => {
    if (projectPath) {
      loadStats()
    }
  }, [projectPath, loadStats])

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index)
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
            File Distribution
          </span>
          {projectPath && (
            <span className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              {projectPath.split('/').pop()}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={loadStats}
          disabled={isLoading || !projectPath}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Chart */}
      <div className="flex-1 flex items-center justify-center p-8">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className={cn('w-8 h-8 animate-spin', isDark ? 'text-zinc-500' : 'text-zinc-400')} />
            <span className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
              Loading file statistics...
            </span>
          </div>
        ) : data.length === 0 ? (
          <div className={cn('text-center', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
            <p className="text-sm font-medium">프로젝트 폴더를 먼저 선택하세요</p>
            <p className="text-xs mt-2">File → Open Folder (Cmd+O)</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={100}
                outerRadius={160}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={onPieEnter}
                animationDuration={500}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#27272a' : '#ffffff',
                  border: `1px solid ${isDark ? '#3f3f46' : '#e4e4e7'}`,
                  borderRadius: '8px',
                  color: isDark ? '#fafafa' : '#18181b',
                }}
              />
              <Legend
                wrapperStyle={{
                  paddingTop: '20px',
                }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
