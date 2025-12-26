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
        'h-full overflow-auto p-6',
        isDark ? 'bg-[#09090b]' : 'bg-gray-50',
        className
      )}
    >
      <article
        className={cn(
          'prose max-w-none',
          isDark ? 'prose-invert' : '',
          'prose-headings:font-semibold',
          'prose-h1:text-2xl prose-h1:border-b prose-h1:pb-2',
          isDark ? 'prose-h1:border-zinc-700' : 'prose-h1:border-zinc-300',
          'prose-h2:text-xl prose-h3:text-lg',
          'prose-p:leading-relaxed',
          'prose-a:text-purple-500 prose-a:no-underline hover:prose-a:underline',
          'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm',
          isDark ? 'prose-code:bg-zinc-800' : 'prose-code:bg-zinc-200',
          'prose-pre:rounded-lg prose-pre:p-4',
          isDark ? 'prose-pre:bg-zinc-900' : 'prose-pre:bg-zinc-100',
          'prose-blockquote:border-l-purple-500 prose-blockquote:italic',
          isDark ? 'prose-blockquote:text-zinc-400' : 'prose-blockquote:text-zinc-600',
          'prose-ul:list-disc prose-ol:list-decimal',
          'prose-li:my-1',
          'prose-table:border-collapse',
          'prose-th:border prose-th:p-2 prose-th:text-left',
          isDark ? 'prose-th:border-zinc-700 prose-th:bg-zinc-800' : 'prose-th:border-zinc-300 prose-th:bg-zinc-100',
          'prose-td:border prose-td:p-2',
          isDark ? 'prose-td:border-zinc-700' : 'prose-td:border-zinc-300',
          'prose-img:rounded-lg prose-img:max-w-full',
          'prose-hr:border-t',
          isDark ? 'prose-hr:border-zinc-700' : 'prose-hr:border-zinc-300',
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        .md-wikilink {
          color: ${isDark ? '#7f6df2' : '#705dcf'};
          cursor: pointer;
          text-decoration: none;
        }
        .md-wikilink:hover {
          text-decoration: underline;
        }
        .md-tag {
          color: ${isDark ? '#8db4d6' : '#4a8bc2'};
        }
        .md-checkbox {
          margin-right: 6px;
          accent-color: ${isDark ? '#7f6df2' : '#705dcf'};
        }
        .md-checkbox-checked {
          text-decoration: line-through;
          opacity: 0.5;
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
