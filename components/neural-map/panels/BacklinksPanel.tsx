'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { findBacklinks, parseWikiLinks } from '@/lib/neural-map/markdown-parser'
import { Link2, ArrowUpRight, FileText, ChevronRight } from 'lucide-react'

interface BacklinksPanelProps {
  fileName: string
  className?: string
}

export function BacklinksPanel({ fileName, className }: BacklinksPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const files = useNeuralMapStore((s) => s.files)
  const openCodePreview = useNeuralMapStore((s) => s.openCodePreview)

  // 이 노트를 참조하는 백링크 찾기
  const backlinks = useMemo(() => {
    const filesWithContent = files.map(f => ({
      name: f.name,
      content: f.content,
      file: f,
    }))
    return findBacklinks(fileName, filesWithContent)
  }, [fileName, files])

  // 이 노트가 참조하는 아웃링크 찾기
  const outlinks = useMemo(() => {
    const currentFile = files.find(f => f.name === fileName)
    if (!currentFile?.content) return []

    const links = parseWikiLinks(currentFile.content)
    return links.map(link => {
      const targetFile = files.find(
        f => f.name.toLowerCase().replace(/\.md$/i, '') === link.target.toLowerCase()
      )
      return {
        ...link,
        file: targetFile,
        exists: !!targetFile,
      }
    })
  }, [fileName, files])

  const handleOpenFile = (name: string) => {
    const file = files.find(f => f.name === name)
    if (file) {
      openCodePreview(file)
    }
  }

  if (backlinks.length === 0 && outlinks.length === 0) {
    return null
  }

  return (
    <div className={cn('', className)}>
      {/* 백링크 (이 노트를 참조하는 노트들) */}
      {backlinks.length > 0 && (
        <div className="mb-4">
          <div className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-xs font-medium',
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          )}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>백링크 ({backlinks.length})</span>
          </div>
          <div className="space-y-1">
            {backlinks.map((name, i) => (
              <button
                key={i}
                onClick={() => handleOpenFile(name)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                  isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                )}
              >
                <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="truncate">{name.replace(/\.md$/i, '')}</span>
                <ChevronRight className="w-3 h-3 ml-auto text-zinc-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 아웃링크 (이 노트가 참조하는 노트들) */}
      {outlinks.length > 0 && (
        <div>
          <div className={cn(
            'flex items-center gap-2 px-2 py-1.5 text-xs font-medium',
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          )}>
            <Link2 className="w-3.5 h-3.5" />
            <span>링크 ({outlinks.length})</span>
          </div>
          <div className="space-y-1">
            {outlinks.map((link, i) => (
              <button
                key={i}
                onClick={() => link.exists && handleOpenFile(link.file!.name)}
                disabled={!link.exists}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors',
                  link.exists
                    ? isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <FileText className={cn(
                  'w-4 h-4 flex-shrink-0',
                  link.exists ? 'text-blue-500' : 'text-zinc-500'
                )} />
                <span className="truncate">
                  {link.alias || link.target}
                </span>
                {!link.exists && (
                  <span className="text-xs text-zinc-500 ml-auto">(없음)</span>
                )}
                {link.exists && (
                  <ChevronRight className="w-3 h-3 ml-auto text-zinc-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
