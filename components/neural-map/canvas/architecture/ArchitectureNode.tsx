'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import {
  Globe,
  Server,
  Database,
  Cloud,
  HardDrive,
  Zap,
  Layers,
  Layout,
  FileCode,
  GitBranch,
  Settings,
  Shield,
  Box,
  Component,
  Workflow,
} from 'lucide-react'
import type { ComponentType, LayerType } from '@/lib/architecture/analyzer'

// ============================================
// Types
// ============================================

interface ArchitectureNodeData {
  label: string
  type: ComponentType
  technology?: string
  layer: LayerType
  endpoints?: string[]
  description?: string
  fileCount?: number
  dependencyCount?: number
}

// ============================================
// Icons & Colors
// ============================================

const TYPE_CONFIG: Record<ComponentType, {
  icon: typeof Globe
  color: string
  bgColor: string
  borderColor: string
}> = {
  page: {
    icon: Layout,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  component: {
    icon: Component,
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  'api-route': {
    icon: Server,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  service: {
    icon: Workflow,
    color: '#a855f7',
    bgColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  hook: {
    icon: Zap,
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  utility: {
    icon: Settings,
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
    borderColor: 'rgba(107, 114, 128, 0.4)',
  },
  type: {
    icon: FileCode,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  config: {
    icon: Settings,
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.15)',
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  database: {
    icon: Database,
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  'external-service': {
    icon: Cloud,
    color: '#06b6d4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  'state-management': {
    icon: Box,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  middleware: {
    icon: Shield,
    color: '#14b8a6',
    bgColor: 'rgba(20, 184, 166, 0.15)',
    borderColor: 'rgba(20, 184, 166, 0.4)',
  },
}

// ============================================
// Component
// ============================================

function ArchitectureNodeComponent({ data, selected }: NodeProps<ArchitectureNodeData>) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const config = TYPE_CONFIG[data.type] || TYPE_CONFIG.utility
  const Icon = config.icon

  return (
    <div
      className={cn(
        'relative rounded-xl transition-all duration-200',
        'min-w-[200px] max-w-[240px]',
        selected && 'ring-2 ring-offset-2 ring-offset-zinc-950'
      )}
      style={{
        backgroundColor: isDark ? '#18181b' : '#ffffff',
        border: `2px solid ${selected ? config.color : config.borderColor}`,
        boxShadow: selected
          ? `0 0 20px ${config.color}40, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 2px 8px rgba(0,0,0,0.2)',
      }}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !rounded-full"
        style={{
          backgroundColor: isDark ? '#27272a' : '#ffffff',
          borderColor: config.color,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !border-2 !rounded-full"
        style={{
          backgroundColor: isDark ? '#27272a' : '#ffffff',
          borderColor: config.color,
        }}
      />

      {/* Header */}
      <div
        className="px-3 py-2 rounded-t-lg flex items-center gap-2"
        style={{ backgroundColor: config.bgColor }}
      >
        <div
          className="p-1.5 rounded-lg"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold truncate"
            style={{ color: isDark ? '#ffffff' : '#18181b' }}
            title={data.label}
          >
            {data.label}
          </div>
          <div className="text-[10px] text-zinc-500 truncate">
            {data.type.replace('-', ' ')}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {/* Technology */}
        {data.technology && (
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] text-zinc-500 w-14">기술:</div>
            <div
              className="text-[10px] truncate flex-1"
              style={{ color: isDark ? '#d4d4d8' : '#52525b' }}
            >
              {data.technology}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-[10px]">
          {data.fileCount !== undefined && data.fileCount > 0 && (
            <div className="flex items-center gap-1">
              <FileCode className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-400">{data.fileCount}</span>
            </div>
          )}
          {data.dependencyCount !== undefined && data.dependencyCount > 0 && (
            <div className="flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-zinc-500" />
              <span className="text-zinc-400">{data.dependencyCount}</span>
            </div>
          )}
          {data.endpoints && data.endpoints.length > 0 && (
            <div className="flex items-center gap-1">
              <Server className="w-3 h-3 text-green-500" />
              <span className="text-green-400">{data.endpoints.length}</span>
            </div>
          )}
        </div>

        {/* Endpoints Preview */}
        {data.endpoints && data.endpoints.length > 0 && (
          <div className="pt-1 border-t border-zinc-800">
            <div className="text-[9px] text-zinc-500 truncate font-mono">
              {data.endpoints[0]}
              {data.endpoints.length > 1 && ` +${data.endpoints.length - 1}`}
            </div>
          </div>
        )}
      </div>

      {/* Layer indicator */}
      <div
        className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full"
        style={{ backgroundColor: config.color }}
      />
    </div>
  )
}

export const ArchitectureNode = memo(ArchitectureNodeComponent)
