'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
  content: string
  isDark?: boolean
  className?: string
}

export function MarkdownPreview({ content, isDark = true, className }: MarkdownPreviewProps) {
  const html = useMemo(() => {
    return parseMarkdown(content)
  }, [content])

  return (
    <div
      className={cn(
        'h-full overflow-auto',
        isDark ? 'bg-[#09090b]' : 'bg-white',
        className
      )}
    >
      <article
        className={cn(
          'prose max-w-none px-8 py-6',
          isDark ? 'prose-invert' : '',
          // Obsidian-like typography
          'prose-headings:font-semibold prose-headings:tracking-tight',
          // H1 - large with subtle bottom border
          'prose-h1:text-[1.8em] prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-6',
          'prose-h1:border-b prose-h1:pb-3',
          isDark ? 'prose-h1:border-zinc-800 prose-h1:text-zinc-100' : 'prose-h1:border-zinc-200 prose-h1:text-zinc-900',
          // H2 - clear section headers
          'prose-h2:text-[1.5em] prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-8',
          isDark ? 'prose-h2:text-zinc-200' : 'prose-h2:text-zinc-800',
          // H3-H6 - compact headers
          'prose-h3:text-[1.25em] prose-h3:font-semibold prose-h3:mb-2 prose-h3:mt-6',
          'prose-h4:text-[1.1em] prose-h4:font-medium prose-h4:mb-2 prose-h4:mt-4',
          'prose-h5:text-[1em] prose-h5:font-medium prose-h5:mb-1 prose-h5:mt-3',
          'prose-h6:text-[0.95em] prose-h6:font-medium prose-h6:mb-1 prose-h6:mt-3',
          isDark ? 'prose-h3:text-zinc-200 prose-h4:text-zinc-300 prose-h5:text-zinc-300 prose-h6:text-zinc-400' : 'prose-h3:text-zinc-800 prose-h4:text-zinc-700 prose-h5:text-zinc-700 prose-h6:text-zinc-600',
          // Paragraphs - comfortable reading
          'prose-p:leading-[1.75] prose-p:mb-4',
          isDark ? 'prose-p:text-zinc-300' : 'prose-p:text-zinc-700',
          // Links - purple accent
          'prose-a:no-underline hover:prose-a:underline prose-a:transition-colors',
          isDark ? 'prose-a:text-purple-400 hover:prose-a:text-purple-300' : 'prose-a:text-purple-600 hover:prose-a:text-purple-700',
          // Inline code - subtle background
          'prose-code:text-[0.9em] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none',
          isDark ? 'prose-code:bg-zinc-800 prose-code:text-emerald-400' : 'prose-code:bg-zinc-100 prose-code:text-emerald-700',
          // Code blocks - clean styling
          'prose-pre:rounded-lg prose-pre:p-4 prose-pre:text-sm prose-pre:leading-relaxed prose-pre:overflow-x-auto',
          isDark ? 'prose-pre:bg-[#0d0d0f] prose-pre:border prose-pre:border-zinc-800' : 'prose-pre:bg-zinc-50 prose-pre:border prose-pre:border-zinc-200',
          // Blockquotes - elegant left border
          'prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:not-italic prose-blockquote:font-normal',
          isDark ? 'prose-blockquote:border-purple-500/50 prose-blockquote:text-zinc-400 prose-blockquote:bg-zinc-900/30' : 'prose-blockquote:border-purple-400 prose-blockquote:text-zinc-600 prose-blockquote:bg-zinc-50',
          // Lists - clean spacing
          'prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-6 prose-ol:pl-6',
          'prose-li:my-1.5 prose-li:leading-relaxed',
          isDark ? 'prose-li:text-zinc-300' : 'prose-li:text-zinc-700',
          // Tables - clean modern look
          'prose-table:border-collapse prose-table:w-full',
          'prose-th:p-3 prose-th:text-left prose-th:font-semibold',
          isDark ? 'prose-th:border-zinc-700 prose-th:bg-zinc-800/50 prose-th:text-zinc-200' : 'prose-th:border-zinc-200 prose-th:bg-zinc-50 prose-th:text-zinc-800',
          'prose-td:p-3',
          isDark ? 'prose-td:border-zinc-800 prose-td:text-zinc-300' : 'prose-td:border-zinc-200 prose-td:text-zinc-700',
          // Images - rounded with shadow
          'prose-img:rounded-lg prose-img:max-w-full prose-img:my-4',
          isDark ? 'prose-img:shadow-lg prose-img:shadow-black/20' : 'prose-img:shadow-md prose-img:shadow-black/10',
          // Horizontal rule
          isDark ? 'prose-hr:border-zinc-800' : 'prose-hr:border-zinc-200',
          // Strong & emphasis
          isDark ? 'prose-strong:text-zinc-100 prose-em:text-zinc-200' : 'prose-strong:text-zinc-900 prose-em:text-zinc-800',
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        /* Force heading sizes - Tailwind prose wasn't working */
        .prose h1 {
          font-size: 2em !important;
          font-weight: 700 !important;
          margin-top: 1.5rem !important;
          margin-bottom: 1rem !important;
          line-height: 1.2 !important;
          border-bottom: 1px solid ${isDark ? '#27272a' : '#e4e4e7'};
          padding-bottom: 0.5rem;
        }
        .prose h2 {
          font-size: 1.5em !important;
          font-weight: 600 !important;
          margin-top: 1.5rem !important;
          margin-bottom: 0.75rem !important;
          line-height: 1.3 !important;
        }
        .prose h3 {
          font-size: 1.25em !important;
          font-weight: 600 !important;
          margin-top: 1.25rem !important;
          margin-bottom: 0.5rem !important;
          line-height: 1.4 !important;
        }
        .prose h4 {
          font-size: 1.1em !important;
          font-weight: 600 !important;
          margin-top: 1rem !important;
          margin-bottom: 0.5rem !important;
        }
        .prose h5 {
          font-size: 1em !important;
          font-weight: 600 !important;
          margin-top: 0.75rem !important;
          margin-bottom: 0.25rem !important;
        }
        .prose h6 {
          font-size: 0.9em !important;
          font-weight: 600 !important;
          margin-top: 0.75rem !important;
          margin-bottom: 0.25rem !important;
          color: ${isDark ? '#a1a1aa' : '#71717a'};
        }
        /* Obsidian-like wiki links */
        .md-wikilink {
          color: ${isDark ? '#a78bfa' : '#7c3aed'};
          cursor: pointer;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.15s ease;
        }
        .md-wikilink:hover {
          color: ${isDark ? '#c4b5fd' : '#6d28d9'};
          text-decoration: underline;
        }
        /* Obsidian-like tags */
        .md-tag {
          color: ${isDark ? '#93c5fd' : '#2563eb'};
          font-size: 0.9em;
          transition: color 0.15s ease;
        }
        .md-tag:hover {
          color: ${isDark ? '#bfdbfe' : '#1d4ed8'};
        }
        /* Checkboxes */
        .md-checkbox {
          margin-right: 8px;
          width: 16px;
          height: 16px;
          accent-color: ${isDark ? '#a78bfa' : '#7c3aed'};
          cursor: pointer;
        }
        .md-checkbox-checked {
          text-decoration: line-through;
          opacity: 0.6;
        }
        /* Smooth scrollbar */
        .prose::-webkit-scrollbar {
          width: 8px;
        }
        .prose::-webkit-scrollbar-track {
          background: transparent;
        }
        .prose::-webkit-scrollbar-thumb {
          background: ${isDark ? '#3f3f46' : '#d4d4d8'};
          border-radius: 4px;
        }
        .prose::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? '#52525b' : '#a1a1aa'};
        }
      `}</style>
    </div>
  )
}

// Simple markdown parser (no external dependencies)
function parseMarkdown(md: string): string {
  let html = md

  // Escape HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
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

  // Wiki links [[target]] or [[target|alias]]
  html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="md-wikilink" data-target="$1">$2</span>')
  html = html.replace(/\[\[([^\]]+)\]\]/g, '<span class="md-wikilink" data-target="$1">$1</span>')

  // Tags #tag
  html = html.replace(/(?:^|\s)#([a-zA-Z\uAC00-\uD7AF0-9_-]+)/g, ' <span class="md-tag">#$1</span>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr />')

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

  // Checkbox lists
  html = html.replace(/^- \[x\] (.+)$/gm, '<li><input type="checkbox" class="md-checkbox" checked disabled /><span class="md-checkbox-checked">$1</span></li>')
  html = html.replace(/^- \[ \] (.+)$/gm, '<li><input type="checkbox" class="md-checkbox" disabled />$1</li>')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)(\n<li>)/g, '$1$2')
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  html = html.replace(/<\/ul>\n<ul>/g, '\n')

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
    const cells = content.split('|').map((c: string) => c.trim())
    if (cells.every((c: string) => /^-+$/.test(c))) {
      return '<!-- table separator -->'
    }
    const isHeader = html.indexOf(match) === 0 || html.indexOf('\n' + match) < html.indexOf('<!-- table separator -->')
    const cellTag = isHeader ? 'th' : 'td'
    return '<tr>' + cells.map((c: string) => `<${cellTag}>${c}</${cellTag}>`).join('') + '</tr>'
  })
  html = html.replace(/<!-- table separator -->/g, '')
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)(\n<tr>)/g, '$1$2')
  html = html.replace(/(<tr>[\s\S]*<\/tr>)/g, '<table>$1</table>')
  html = html.replace(/<\/table>\n<table>/g, '\n')

  // Paragraphs - wrap remaining text
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

    // Skip if already wrapped in a block element
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

  return result.join('\n')
}
