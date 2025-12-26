'use client'

import { useRef, forwardRef, useImperativeHandle } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { nord } from '@milkdown/theme-nord'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { cn } from '@/lib/utils'

export interface MilkdownEditorProps {
  defaultValue?: string
  onChange?: (markdown: string) => void
  onWikiLinkClick?: (target: string) => void
  onTagClick?: (tag: string) => void
  isDark?: boolean
  placeholder?: string
  className?: string
  readOnly?: boolean
}

export interface MilkdownEditorRef {
  getMarkdown: () => string
  setMarkdown: (value: string) => void
  focus: () => void
}

// Wiki link decoration plugin
const wikiLinkPluginKey = new PluginKey('wikiLink')
const tagPluginKey = new PluginKey('tag')

function createWikiLinkPlugin(onWikiLinkClick?: (target: string) => void) {
  return new Plugin({
    key: wikiLinkPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        const doc = state.doc

        doc.descendants((node, pos) => {
          if (node.isText && node.text) {
            const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
            let match
            while ((match = wikiLinkRegex.exec(node.text)) !== null) {
              const start = pos + match.index
              const end = start + match[0].length
              const target = match[1]
              const alias = match[2]

              decorations.push(
                Decoration.inline(start, end, {
                  class: 'wiki-link',
                  'data-target': target,
                  'data-alias': alias || '',
                })
              )
            }
          }
        })

        return DecorationSet.create(doc, decorations)
      },
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement
        if (target.classList.contains('wiki-link')) {
          const linkTarget = target.getAttribute('data-target')
          if (linkTarget && onWikiLinkClick) {
            onWikiLinkClick(linkTarget)
            return true
          }
        }
        return false
      },
    },
  })
}

function createTagPlugin(onTagClick?: (tag: string) => void) {
  return new Plugin({
    key: tagPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        const doc = state.doc

        doc.descendants((node, pos) => {
          if (node.isText && node.text) {
            const tagRegex = /(?:^|\s)#([a-zA-Z가-힣0-9_-]+)/g
            let match
            while ((match = tagRegex.exec(node.text)) !== null) {
              const hashPos = match[0].indexOf('#')
              const start = pos + match.index + hashPos
              const end = start + match[0].length - hashPos

              decorations.push(
                Decoration.inline(start, end, {
                  class: 'md-tag',
                  'data-tag': match[1],
                })
              )
            }
          }
        })

        return DecorationSet.create(doc, decorations)
      },
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement
        if (target.classList.contains('md-tag')) {
          const tag = target.getAttribute('data-tag')
          if (tag && onTagClick) {
            onTagClick(tag)
            return true
          }
        }
        return false
      },
    },
  })
}

interface InnerEditorProps {
  defaultValue: string
  onChange?: (markdown: string) => void
  onWikiLinkClick?: (target: string) => void
  onTagClick?: (tag: string) => void
  contentRef: React.MutableRefObject<string>
}

function InnerEditor({ defaultValue, onChange, onWikiLinkClick, onTagClick, contentRef }: InnerEditorProps) {
  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, defaultValue)

        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          contentRef.current = markdown
          if (onChange && markdown !== prevMarkdown) {
            onChange(markdown)
          }
        })
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use($prose(() => createWikiLinkPlugin(onWikiLinkClick)))
      .use($prose(() => createTagPlugin(onTagClick)))
  )

  return <Milkdown />
}

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  function MilkdownEditor(
    {
      defaultValue = '',
      onChange,
      onWikiLinkClick,
      onTagClick,
      isDark = true,
      placeholder = '',
      className,
      readOnly = false,
    },
    ref
  ) {
    const contentRef = useRef(defaultValue)

    useImperativeHandle(ref, () => ({
      getMarkdown: () => contentRef.current,
      setMarkdown: (value: string) => {
        contentRef.current = value
      },
      focus: () => {
        const editorElement = document.querySelector('.milkdown .editor')
        if (editorElement instanceof HTMLElement) {
          editorElement.focus()
        }
      },
    }))

    return (
      <div
        className={cn(
          'milkdown-wrapper relative h-full',
          isDark ? 'milkdown-dark' : 'milkdown-light',
          className
        )}
      >
        <MilkdownProvider>
          <InnerEditor
            defaultValue={defaultValue}
            onChange={onChange}
            onWikiLinkClick={onWikiLinkClick}
            onTagClick={onTagClick}
            contentRef={contentRef}
          />
        </MilkdownProvider>

        <style jsx global>{`
          .milkdown-wrapper {
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }

          .milkdown-dark {
            --md-bg: #1e1e1e;
            --md-text: #e4e4e7;
            --md-text-muted: #71717a;
            --md-border: #3c3c3c;
            --md-link: #8b5cf6;
            --md-tag: #22c55e;
            --md-code-bg: #2d2d2d;
            --md-selection: rgba(139, 92, 246, 0.3);
          }

          .milkdown-light {
            --md-bg: #ffffff;
            --md-text: #18181b;
            --md-text-muted: #71717a;
            --md-border: #e4e4e7;
            --md-link: #7c3aed;
            --md-tag: #16a34a;
            --md-code-bg: #f4f4f5;
            --md-selection: rgba(124, 58, 237, 0.2);
          }

          .milkdown-wrapper .milkdown {
            height: 100%;
            background: var(--md-bg);
            color: var(--md-text);
          }

          .milkdown-wrapper .milkdown .editor {
            padding: 1rem;
            min-height: 100%;
            outline: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            line-height: 1.7;
          }

          .milkdown-wrapper .milkdown .editor:focus {
            outline: none;
          }

          .milkdown-wrapper .milkdown h1 {
            font-size: 1.875rem;
            font-weight: 700;
            margin: 1.5rem 0 1rem;
            border-bottom: 1px solid var(--md-border);
            padding-bottom: 0.5rem;
          }

          .milkdown-wrapper .milkdown h2 {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 1.25rem 0 0.75rem;
          }

          .milkdown-wrapper .milkdown h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 1rem 0 0.5rem;
          }

          .milkdown-wrapper .wiki-link {
            color: var(--md-link);
            background: rgba(139, 92, 246, 0.1);
            padding: 0.125rem 0.25rem;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.15s;
          }

          .milkdown-wrapper .wiki-link:hover {
            background: rgba(139, 92, 246, 0.2);
            text-decoration: underline;
          }

          .milkdown-wrapper .md-tag {
            color: var(--md-tag);
            background: rgba(34, 197, 94, 0.1);
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875em;
            transition: background 0.15s;
          }

          .milkdown-wrapper .md-tag:hover {
            background: rgba(34, 197, 94, 0.2);
          }

          .milkdown-wrapper .milkdown pre {
            background: var(--md-code-bg);
            border-radius: 8px;
            padding: 1rem;
            overflow-x: auto;
            margin: 0.75rem 0;
            font-family: var(--font-mono);
            font-size: 13px;
            line-height: 1.5;
          }

          .milkdown-wrapper .milkdown code {
            font-family: var(--font-mono);
            font-size: 0.9em;
          }

          .milkdown-wrapper .milkdown :not(pre) > code {
            background: var(--md-code-bg);
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
          }

          .milkdown-wrapper .milkdown blockquote {
            border-left: 3px solid var(--md-link);
            padding-left: 1rem;
            margin: 0.75rem 0;
            color: var(--md-text-muted);
            font-style: italic;
          }

          .milkdown-wrapper .milkdown ul,
          .milkdown-wrapper .milkdown ol {
            padding-left: 1.5rem;
            margin: 0.5rem 0;
          }

          .milkdown-wrapper .milkdown li {
            margin: 0.25rem 0;
          }

          .milkdown-wrapper .milkdown input[type="checkbox"] {
            margin-right: 0.5rem;
            cursor: pointer;
            accent-color: var(--md-link);
          }

          .milkdown-wrapper .milkdown table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.75rem 0;
          }

          .milkdown-wrapper .milkdown th,
          .milkdown-wrapper .milkdown td {
            border: 1px solid var(--md-border);
            padding: 0.5rem 0.75rem;
            text-align: left;
          }

          .milkdown-wrapper .milkdown th {
            background: var(--md-code-bg);
            font-weight: 600;
          }

          .milkdown-wrapper .milkdown a {
            color: var(--md-link);
            text-decoration: none;
          }

          .milkdown-wrapper .milkdown a:hover {
            text-decoration: underline;
          }

          .milkdown-wrapper .milkdown hr {
            border: none;
            border-top: 1px solid var(--md-border);
            margin: 1.5rem 0;
          }

          .milkdown-wrapper .milkdown ::selection {
            background: var(--md-selection);
          }

          .milkdown-wrapper .milkdown img {
            max-width: 100%;
            border-radius: 8px;
            margin: 0.75rem 0;
          }

          .milkdown-wrapper .milkdown strong {
            font-weight: 600;
          }

          .milkdown-wrapper .milkdown em {
            font-style: italic;
          }

          .milkdown-wrapper .milkdown del {
            text-decoration: line-through;
            color: var(--md-text-muted);
          }
        `}</style>
      </div>
    )
  }
)
