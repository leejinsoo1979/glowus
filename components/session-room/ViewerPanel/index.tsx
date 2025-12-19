'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { FileText, Image as ImageIcon, Video, Presentation, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PdfViewer } from './PdfViewer'
import { ImageViewer } from './ImageViewer'
import { VideoViewer } from './VideoViewer'

export interface Artifact {
  id: string
  type: 'pdf' | 'image' | 'video'
  name: string
  url: string
  thumbnailUrl?: string
}

export interface ViewerFocus {
  artifactId: string
  page?: number
  region?: { x: number; y: number; w: number; h: number }
  timestamp?: number // seconds for video
}

interface ViewerPanelProps {
  artifacts: Artifact[]
  focus: ViewerFocus | null
  onFocusChange: (focus: ViewerFocus) => void
  onArtifactAdd?: () => void
  onArtifactRemove?: (id: string) => void
  syncEnabled?: boolean
  isPresenter?: boolean
}

export function ViewerPanel({
  artifacts,
  focus,
  onFocusChange,
  onArtifactAdd,
  onArtifactRemove,
  syncEnabled = true,
  isPresenter = false
}: ViewerPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [activeTab, setActiveTab] = useState<string | null>(
    artifacts.length > 0 ? artifacts[0].id : null
  )

  const activeArtifact = artifacts.find(a => a.id === activeTab)

  const getIcon = (type: Artifact['type']) => {
    switch (type) {
      case 'pdf': return FileText
      case 'image': return ImageIcon
      case 'video': return Video
      default: return FileText
    }
  }

  const handleFocusChange = (updates: Partial<ViewerFocus>) => {
    if (!activeArtifact) return
    onFocusChange({
      artifactId: activeArtifact.id,
      ...focus,
      ...updates
    })
  }

  return (
    <div className={cn(
      'h-full flex flex-col',
      isDark ? 'bg-neutral-900' : 'bg-white'
    )}>
      {/* Tab Bar */}
      <div className={cn(
        'flex-shrink-0 flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto',
        isDark ? 'border-neutral-800 bg-neutral-900/80' : 'border-neutral-200 bg-neutral-50/80'
      )}>
        {artifacts.map(artifact => {
          const Icon = getIcon(artifact.type)
          const isActive = activeTab === artifact.id

          return (
            <button
              key={artifact.id}
              onClick={() => setActiveTab(artifact.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap group',
                isActive
                  ? isDark
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'bg-white text-neutral-900 shadow-sm'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{artifact.name}</span>

              {onArtifactRemove && (
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onArtifactRemove(artifact.id)
                  }}
                  className={cn(
                    'ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                    isDark ? 'hover:bg-neutral-700' : 'hover:bg-neutral-200'
                  )}
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          )
        })}

        {onArtifactAdd && (
          <button
            onClick={onArtifactAdd}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded transition-colors',
              isDark
                ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
            )}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {/* Sync Status */}
        {syncEnabled && (
          <div className={cn(
            'ml-auto flex items-center gap-1.5 px-2 py-1 rounded text-xs',
            isDark ? 'bg-neutral-800/50 text-neutral-400' : 'bg-neutral-100 text-neutral-500'
          )}>
            <div className={cn(
              'w-1.5 h-1.5 rounded-full',
              isPresenter ? 'bg-emerald-500' : 'bg-amber-500'
            )} />
            {isPresenter ? 'Presenting' : 'Synced'}
          </div>
        )}
      </div>

      {/* Viewer Content */}
      <div className="flex-1 overflow-hidden">
        {!activeArtifact ? (
          <EmptyState onAdd={onArtifactAdd} isDark={isDark} />
        ) : activeArtifact.type === 'pdf' ? (
          <PdfViewer
            url={activeArtifact.url}
            currentPage={focus?.page || 1}
            region={focus?.region}
            onPageChange={(page) => handleFocusChange({ page })}
            onRegionChange={(region) => handleFocusChange({ region })}
          />
        ) : activeArtifact.type === 'image' ? (
          <ImageViewer
            url={activeArtifact.url}
            region={focus?.region}
            onRegionChange={(region) => handleFocusChange({ region })}
          />
        ) : activeArtifact.type === 'video' ? (
          <VideoViewer
            url={activeArtifact.url}
            currentTime={focus?.timestamp || 0}
            onTimeChange={(timestamp) => handleFocusChange({ timestamp })}
          />
        ) : null}
      </div>
    </div>
  )
}

function EmptyState({ onAdd, isDark }: { onAdd?: () => void; isDark: boolean }) {
  return (
    <div className={cn(
      'h-full flex flex-col items-center justify-center gap-4',
      isDark ? 'text-neutral-500' : 'text-neutral-400'
    )}>
      <div className={cn(
        'w-16 h-16 rounded-lg flex items-center justify-center',
        isDark ? 'bg-neutral-800' : 'bg-neutral-100'
      )}>
        <Presentation className="w-8 h-8" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">자료 없음</p>
        <p className="text-xs mt-1">PDF, 이미지, 영상을 추가하세요</p>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className={cn(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            isDark
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
          )}
        >
          자료 추가
        </button>
      )}
    </div>
  )
}

export { PdfViewer } from './PdfViewer'
export { ImageViewer } from './ImageViewer'
export { VideoViewer } from './VideoViewer'
