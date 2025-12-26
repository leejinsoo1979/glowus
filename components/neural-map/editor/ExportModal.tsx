'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { X, FileText, FileCode, Download, Check, Loader2 } from 'lucide-react'

type ExportFormat = 'md' | 'html' | 'pdf'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
  title: string
  isDark?: boolean
}

// Simple markdown to HTML converter
function markdownToHtml(md: string, title: string): string {
  let html = md

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Headers
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // Wiki links
  html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a href="#$1">$2</a>')
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<a href="#$1">$1</a>')

  // Tags
  html = html.replace(/(?:^|\s)#([a-zA-Z\uAC00-\uD7AF0-9_-]+)/g, ' <span class="tag">#$1</span>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;" />')

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />')

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

  // Checkbox lists
  html = html.replace(/^- \[x\] (.+)$/gm, '<li class="task done"><input type="checkbox" checked disabled /> $1</li>')
  html = html.replace(/^- \[ \] (.+)$/gm, '<li class="task"><input type="checkbox" disabled /> $1</li>')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Wrap list items
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>)/g, '$1$2')
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  html = html.replace(/<\/ul>\n<ul>/g, '\n')

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map((c: string) => c.trim())
    if (cells.every((c: string) => /^-+$/.test(c))) {
      return '<!-- table separator -->'
    }
    return '<tr>' + cells.map((c: string) => `<td>${c}</td>`).join('') + '</tr>'
  })
  html = html.replace(/<!-- table separator -->/g, '')
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)(\n<tr>)/g, '$1$2')
  html = html.replace(/(<tr>[\s\S]*<\/tr>)/g, '<table>$1</table>')
  html = html.replace(/<\/table>\n<table>/g, '\n')

  // Paragraphs
  const lines = html.split('\n')
  const result: string[] = []
  let inParagraph = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (inParagraph) {
        result.push('</p>')
        inParagraph = false
      }
      result.push('')
      continue
    }

    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table|tr|hr)/.test(trimmed)) {
      if (inParagraph) {
        result.push('</p>')
        inParagraph = false
      }
      result.push(line)
      continue
    }

    if (!inParagraph) {
      result.push('<p>' + line)
      inParagraph = true
    } else {
      result.push('<br />' + line)
    }
  }

  if (inParagraph) {
    result.push('</p>')
  }

  const bodyContent = result.join('\n')

  // Full HTML document
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --text: #18181b;
      --bg: #ffffff;
      --link: #7c3aed;
      --tag-bg: rgba(22, 163, 74, 0.1);
      --tag-text: #16a34a;
      --code-bg: #f4f4f5;
      --border: #e4e4e7;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --text: #fafafa;
        --bg: #18181b;
        --link: #a78bfa;
        --tag-bg: rgba(34, 197, 94, 0.15);
        --tag-text: #4ade80;
        --code-bg: #27272a;
        --border: #3f3f46;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.75;
      color: var(--text);
      background: var(--bg);
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }

    a { color: var(--link); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .tag {
      color: var(--tag-text);
      background: var(--tag-bg);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.9em;
    }

    code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "SF Mono", Monaco, monospace;
      font-size: 0.9em;
    }

    pre {
      background: var(--code-bg);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid var(--link);
      margin: 1em 0;
      padding: 0.5em 1em;
      font-style: italic;
      color: #71717a;
    }

    ul, ol {
      padding-left: 1.5em;
    }

    li {
      margin: 0.25em 0;
    }

    li.task {
      list-style: none;
      margin-left: -1.5em;
    }

    li.done {
      text-decoration: line-through;
      opacity: 0.6;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2em 0;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }

    td, th {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    @media print {
      body {
        max-width: none;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`
}

export function ExportModal({ isOpen, onClose, content, title, isDark = true }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('md')
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setExportSuccess(false)

    try {
      const fileName = `${title.replace(/[^a-zA-Z0-9\uAC00-\uD7AF-_]/g, '_')}`
      let blob: Blob
      let extension: string

      switch (selectedFormat) {
        case 'md':
          blob = new Blob([content], { type: 'text/markdown' })
          extension = 'md'
          break

        case 'html':
          const htmlContent = markdownToHtml(content, title)
          blob = new Blob([htmlContent], { type: 'text/html' })
          extension = 'html'
          break

        case 'pdf':
          // PDF export: Create HTML and print to PDF
          const pdfHtml = markdownToHtml(content, title)
          const printWindow = window.open('', '_blank')
          if (printWindow) {
            printWindow.document.write(pdfHtml)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => {
              printWindow.print()
              printWindow.close()
            }, 250)
          }
          setIsExporting(false)
          setExportSuccess(true)
          setTimeout(() => setExportSuccess(false), 2000)
          return

        default:
          return
      }

      // Download file
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 2000)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [content, title, selectedFormat])

  const formats: { id: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
    { id: 'md', label: 'Markdown', icon: FileText, description: 'Raw markdown file (.md)' },
    { id: 'html', label: 'HTML', icon: FileCode, description: 'Styled HTML document (.html)' },
    { id: 'pdf', label: 'PDF', icon: Download, description: 'Print to PDF' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50',
              'rounded-xl shadow-2xl overflow-hidden',
              isDark ? 'bg-[#252526] border border-[#3c3c3c]' : 'bg-white border border-zinc-200'
            )}
          >
            {/* Header */}
            <div className={cn('flex items-center justify-between px-4 py-3 border-b', isDark ? 'border-[#3c3c3c]' : 'border-zinc-200')}>
              <h3 className={cn('font-medium', isDark ? 'text-zinc-200' : 'text-zinc-900')}>Export Note</h3>
              <button
                onClick={onClose}
                className={cn(
                  'p-1 rounded transition-colors',
                  isDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-zinc-100'
                )}
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              <div className={cn('text-sm mb-4', isDark ? 'text-zinc-400' : 'text-zinc-600')}>
                Choose export format for &quot;{title || 'Untitled'}&quot;
              </div>

              {formats.map((format) => {
                const Icon = format.icon
                const isSelected = selectedFormat === format.id

                return (
                  <button
                    key={format.id}
                    onClick={() => setSelectedFormat(format.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
                      isSelected
                        ? isDark ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-blue-50 border border-blue-200'
                        : isDark ? 'hover:bg-[#2d2d2d] border border-transparent' : 'hover:bg-zinc-50 border border-transparent'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      isSelected
                        ? isDark ? 'bg-blue-600/30' : 'bg-blue-100'
                        : isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    )}>
                      <Icon className={cn('w-5 h-5', isSelected ? 'text-blue-400' : 'text-zinc-500')} />
                    </div>
                    <div className="flex-1">
                      <div className={cn('text-sm font-medium', isDark ? 'text-zinc-200' : 'text-zinc-900')}>
                        {format.label}
                      </div>
                      <div className={cn('text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                        {format.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-blue-400" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className={cn('flex items-center justify-end gap-2 px-4 py-3 border-t', isDark ? 'border-[#3c3c3c]' : 'border-zinc-200')}>
              <button
                onClick={onClose}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  exportSuccess
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white',
                  isExporting && 'opacity-70 cursor-not-allowed'
                )}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : exportSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Exported!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
