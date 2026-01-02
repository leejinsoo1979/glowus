'use client'

import React from 'react'
import { LucideIcon, Plus, Download, Upload, Filter } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  // Common action buttons
  onAdd?: () => void
  addLabel?: string
  onExport?: () => void
  onImport?: () => void
  onFilter?: () => void
  filterActive?: boolean
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  onAdd,
  addLabel = '추가',
  onExport,
  onImport,
  onFilter,
  filterActive,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-theme bg-theme-secondary/50">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-accent/10 rounded-lg">
            <Icon className="w-5 h-5 text-accent" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold text-theme">{title}</h1>
          {subtitle && <p className="text-sm text-theme-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onFilter && (
          <button
            onClick={onFilter}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${filterActive ? 'bg-accent/20 text-accent' : 'text-theme-muted hover:text-theme hover:bg-theme-secondary'}`}
          >
            <Filter className="w-4 h-4" />
            필터
          </button>
        )}
        {onImport && (
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-theme-muted hover:text-theme hover:bg-theme-secondary rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            가져오기
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-theme-muted hover:text-theme hover:bg-theme-secondary rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
        )}
        {actions}
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}
