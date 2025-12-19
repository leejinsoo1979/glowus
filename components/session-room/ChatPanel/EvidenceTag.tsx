'use client'

import { useTheme } from 'next-themes'
import { FileText, Image as ImageIcon, Video, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Evidence {
  type: 'pdf' | 'image' | 'video'
  artifactId: string
  artifactName: string
  page?: number
  region?: { x: number; y: number; w: number; h: number }
  timestamp?: number // seconds for video
  excerpt?: string // 발췌 텍스트
}

interface EvidenceTagProps {
  evidence: Evidence
  onClick: () => void
  compact?: boolean
}

export function EvidenceTag({ evidence, onClick, compact = false }: EvidenceTagProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const getIcon = () => {
    switch (evidence.type) {
      case 'pdf': return FileText
      case 'image': return ImageIcon
      case 'video': return Video
      default: return FileText
    }
  }

  const getLocationText = () => {
    if (evidence.type === 'video' && evidence.timestamp !== undefined) {
      const mins = Math.floor(evidence.timestamp / 60)
      const secs = Math.floor(evidence.timestamp % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    if (evidence.page !== undefined) {
      const pageText = `p.${evidence.page}`
      if (evidence.region) {
        return `${pageText} (영역)`
      }
      return pageText
    }

    if (evidence.region) {
      return '영역 선택됨'
    }

    return null
  }

  const Icon = getIcon()
  const locationText = getLocationText()

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
          isDark
            ? 'bg-amber-900/30 text-amber-400 hover:bg-amber-900/50'
            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
        )}
      >
        <MapPin className="w-2.5 h-2.5" />
        {locationText || evidence.artifactName}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
        isDark
          ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300'
          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
      )}
    >
      <Icon className={cn(
        'w-3.5 h-3.5',
        isDark ? 'text-neutral-500' : 'text-neutral-400'
      )} />

      <div className="flex flex-col items-start">
        <span className="font-medium truncate max-w-[150px]">
          {evidence.artifactName}
        </span>

        {locationText && (
          <span className={cn(
            'text-[10px]',
            isDark ? 'text-amber-400' : 'text-amber-600'
          )}>
            {locationText}
          </span>
        )}
      </div>

      {evidence.excerpt && (
        <span className={cn(
          'text-[10px] italic truncate max-w-[100px]',
          isDark ? 'text-neutral-500' : 'text-neutral-400'
        )}>
          "{evidence.excerpt}"
        </span>
      )}
    </button>
  )
}

// Parse evidence from message content
export function parseEvidenceFromContent(content: string): Evidence[] {
  const evidences: Evidence[] = []

  // Pattern: [Evidence: docName p.X region(x,y,w,h)]
  // Pattern: [Evidence: videoName HH:MM:SS]
  // Pattern: [Evidence: imageName region(x,y,w,h)]

  const pdfPattern = /\[Evidence:\s*([^\]]+?)\s+p\.(\d+)(?:\s+region\(([0-9.,]+)\))?\]/gi
  const videoPattern = /\[Evidence:\s*([^\]]+?)\s+(\d+):(\d+)(?::(\d+))?\]/gi
  const imagePattern = /\[Evidence:\s*([^\]]+?)\s+region\(([0-9.,]+)\)\]/gi

  // PDF matches
  let match
  while ((match = pdfPattern.exec(content)) !== null) {
    const [, name, page, regionStr] = match
    const evidence: Evidence = {
      type: 'pdf',
      artifactId: name.toLowerCase().replace(/\s+/g, '-'),
      artifactName: name,
      page: parseInt(page)
    }

    if (regionStr) {
      const [x, y, w, h] = regionStr.split(',').map(Number)
      evidence.region = { x, y, w, h }
    }

    evidences.push(evidence)
  }

  // Video matches
  while ((match = videoPattern.exec(content)) !== null) {
    const [, name, mins, secs, hours] = match
    const timestamp = (hours ? parseInt(hours) * 3600 : 0) + parseInt(mins) * 60 + parseInt(secs)

    evidences.push({
      type: 'video',
      artifactId: name.toLowerCase().replace(/\s+/g, '-'),
      artifactName: name,
      timestamp
    })
  }

  // Image matches (without page)
  while ((match = imagePattern.exec(content)) !== null) {
    const [, name, regionStr] = match
    const [x, y, w, h] = regionStr.split(',').map(Number)

    evidences.push({
      type: 'image',
      artifactId: name.toLowerCase().replace(/\s+/g, '-'),
      artifactName: name,
      region: { x, y, w, h }
    })
  }

  return evidences
}

// Format evidence for display in message
export function formatEvidenceTag(evidence: Evidence): string {
  if (evidence.type === 'video' && evidence.timestamp !== undefined) {
    const mins = Math.floor(evidence.timestamp / 60)
    const secs = Math.floor(evidence.timestamp % 60)
    return `[Evidence: ${evidence.artifactName} ${mins}:${secs.toString().padStart(2, '0')}]`
  }

  if (evidence.page !== undefined) {
    let tag = `[Evidence: ${evidence.artifactName} p.${evidence.page}`
    if (evidence.region) {
      const { x, y, w, h } = evidence.region
      tag += ` region(${x},${y},${w},${h})`
    }
    return tag + ']'
  }

  if (evidence.region) {
    const { x, y, w, h } = evidence.region
    return `[Evidence: ${evidence.artifactName} region(${x},${y},${w},${h})]`
  }

  return `[Evidence: ${evidence.artifactName}]`
}
