'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useState, useMemo } from 'react'
import { EditorState, Extension, Compartment, StateEffect, StateField, RangeSetBuilder, Prec } from '@codemirror/state'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  keymap,
  WidgetType,
  placeholder as placeholderExt,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
  HighlightStyle,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import {
  autocompletion,
  completionKeymap,
  CompletionContext,
  CompletionResult,
  Completion,
  startCompletion,
} from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { lintKeymap } from '@codemirror/lint'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

export interface NoteFile {
  id: string
  name: string
  path: string
  content?: string
}

export interface MarkdownEditorProps {
  defaultValue?: string
  onChange?: (value: string) => void
  onWikiLinkClick?: (target: string) => void
  onTagClick?: (tag: string) => void
  onSave?: () => void
  onImageDrop?: (file: File) => Promise<string>
  isDark?: boolean
  placeholder?: string
  className?: string
  readOnly?: boolean
  files?: NoteFile[]
  existingTags?: string[]
}

export interface MarkdownEditorRef {
  getMarkdown: () => string
  setMarkdown: (value: string) => void
  focus: () => void
  insertText: (text: string) => void
  wrapSelection: (before: string, after: string) => void
  insertLink: () => void
  insertImage: (url: string, alt?: string) => void
}

// ============================================================
// Wiki Link & Tag Decorations
// ============================================================

const wikiLinkMark = Decoration.mark({ class: 'cm-wikilink' })
const wikiLinkBracketMark = Decoration.mark({ class: 'cm-wikilink-bracket' })
const tagMark = Decoration.mark({ class: 'cm-tag' })

interface LinkMatch {
  from: number
  to: number
  target: string
  type: 'wikilink' | 'tag'
  bracketStart?: number
  bracketEnd?: number
}

function findLinksAndTags(doc: string): LinkMatch[] {
  const matches: LinkMatch[] = []

  // Wiki links: [[target]] or [[target|alias]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  let match
  while ((match = wikiLinkRegex.exec(doc)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      target: match[1],
      type: 'wikilink'
    })
  }

  // Tags: #tagname (Korean, English, numbers, underscore, hyphen)
  const tagRegex = /(?:^|\s)#([a-zA-Z\uAC00-\uD7AF0-9_-]+)/g
  while ((match = tagRegex.exec(doc)) !== null) {
    const hashIndex = match[0].indexOf('#')
    const from = match.index + hashIndex
    const to = match.index + match[0].length
    matches.push({
      from,
      to,
      target: match[1],
      type: 'tag'
    })
  }

  return matches
}

function linkDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc.toString()
  const matches = findLinksAndTags(doc)

  matches.sort((a, b) => a.from - b.from)

  for (const match of matches) {
    const mark = match.type === 'wikilink' ? wikiLinkMark : tagMark
    builder.add(match.from, match.to, mark)
  }

  return builder.finish()
}

const linkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = linkDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = linkDecorations(update.view)
      }
    }
  },
  { decorations: v => v.decorations }
)

// ============================================================
// Click Handler
// ============================================================

function createClickHandler(
  onWikiLinkClick?: (target: string) => void,
  onTagClick?: (tag: string) => void
): Extension {
  return EditorView.domEventHandlers({
    click(event, view) {
      const target = event.target as HTMLElement

      if (target.classList.contains('cm-wikilink')) {
        const pos = view.posAtDOM(target)
        const line = view.state.doc.lineAt(pos)
        const lineText = line.text

        // Find the wiki link at this position
        const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
        let match
        while ((match = wikiLinkRegex.exec(lineText)) !== null) {
          const startPos = line.from + match.index
          const endPos = startPos + match[0].length
          if (pos >= startPos && pos <= endPos) {
            if (onWikiLinkClick) {
              event.preventDefault()
              onWikiLinkClick(match[1])
              return true
            }
          }
        }
      }

      if (target.classList.contains('cm-tag')) {
        const pos = view.posAtDOM(target)
        const line = view.state.doc.lineAt(pos)
        const lineText = line.text

        const tagRegex = /#([a-zA-Z\uAC00-\uD7AF0-9_-]+)/g
        let match
        while ((match = tagRegex.exec(lineText)) !== null) {
          const startPos = line.from + match.index
          const endPos = startPos + match[0].length
          if (pos >= startPos && pos <= endPos) {
            if (onTagClick) {
              event.preventDefault()
              onTagClick(match[1])
              return true
            }
          }
        }
      }

      return false
    }
  })
}

// ============================================================
// Autocomplete for Wiki Links
// ============================================================

function createWikiLinkCompletion(files: NoteFile[]): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext) => {
    // Check for [[ trigger
    const before = context.matchBefore(/\[\[([^\]|]*)$/)
    if (!before) return null

    const query = before.text.slice(2).toLowerCase()

    const options: Completion[] = files
      .filter(f => f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query))
      .slice(0, 20)
      .map(f => ({
        label: f.name.replace(/\.md$/i, ''),
        type: 'text',
        apply: (view, completion, from, to) => {
          const name = f.name.replace(/\.md$/i, '')
          view.dispatch({
            changes: { from: before.from, to: context.pos, insert: `[[${name}]]` },
            selection: { anchor: before.from + name.length + 4 }
          })
        },
        detail: f.path,
      }))

    if (options.length === 0) {
      // Allow creating new note
      if (query.length > 0) {
        options.push({
          label: query,
          type: 'text',
          apply: (view, completion, from, to) => {
            view.dispatch({
              changes: { from: before.from, to: context.pos, insert: `[[${query}]]` },
              selection: { anchor: before.from + query.length + 4 }
            })
          },
          detail: '새 노트 생성',
        })
      }
    }

    return {
      from: before.from,
      options,
      validFor: /^[^\]]*$/
    }
  }
}

// ============================================================
// Autocomplete for Tags
// ============================================================

function createTagCompletion(existingTags: string[]): (context: CompletionContext) => CompletionResult | null {
  return (context: CompletionContext) => {
    // Check for # trigger (not ##, ###, etc for headings)
    const before = context.matchBefore(/(?:^|\s)#([a-zA-Z\uAC00-\uD7AF0-9_-]*)$/)
    if (!before) return null

    // Skip if it's a heading
    const line = context.state.doc.lineAt(context.pos)
    if (line.text.trimStart().startsWith('##') || line.text.trimStart().match(/^#{1,6}\s/)) {
      return null
    }

    const hashIndex = before.text.lastIndexOf('#')
    const query = before.text.slice(hashIndex + 1).toLowerCase()

    const options: Completion[] = existingTags
      .filter(tag => tag.toLowerCase().includes(query))
      .slice(0, 15)
      .map(tag => ({
        label: `#${tag}`,
        type: 'keyword',
        apply: (view, completion, from, to) => {
          const insertFrom = before.from + hashIndex
          view.dispatch({
            changes: { from: insertFrom, to: context.pos, insert: `#${tag}` },
            selection: { anchor: insertFrom + tag.length + 1 }
          })
        },
      }))

    // Allow creating new tag
    if (query.length > 0 && !existingTags.some(t => t.toLowerCase() === query)) {
      options.push({
        label: `#${query}`,
        type: 'keyword',
        detail: '새 태그',
        apply: (view, completion, from, to) => {
          const insertFrom = before.from + hashIndex
          view.dispatch({
            changes: { from: insertFrom, to: context.pos, insert: `#${query}` },
            selection: { anchor: insertFrom + query.length + 1 }
          })
        },
      })
    }

    return {
      from: before.from + hashIndex,
      options,
      validFor: /^#?[a-zA-Z\uAC00-\uD7AF0-9_-]*$/
    }
  }
}

// ============================================================
// Markdown Shortcuts
// ============================================================

function createMarkdownKeymap(onSave?: () => void): Extension {
  return keymap.of([
    // Save
    {
      key: 'Mod-s',
      run: (view) => {
        onSave?.()
        return true
      }
    },
    // Bold
    {
      key: 'Mod-b',
      run: (view) => {
        wrapSelection(view, '**', '**')
        return true
      }
    },
    // Italic
    {
      key: 'Mod-i',
      run: (view) => {
        wrapSelection(view, '*', '*')
        return true
      }
    },
    // Strikethrough
    {
      key: 'Mod-Shift-s',
      run: (view) => {
        wrapSelection(view, '~~', '~~')
        return true
      }
    },
    // Code
    {
      key: 'Mod-e',
      run: (view) => {
        wrapSelection(view, '`', '`')
        return true
      }
    },
    // Link
    {
      key: 'Mod-k',
      run: (view) => {
        const selection = view.state.selection.main
        const selectedText = view.state.sliceDoc(selection.from, selection.to)
        if (selectedText) {
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: `[${selectedText}](url)` },
            selection: { anchor: selection.from + selectedText.length + 3, head: selection.from + selectedText.length + 6 }
          })
        } else {
          view.dispatch({
            changes: { from: selection.from, insert: '[](url)' },
            selection: { anchor: selection.from + 1 }
          })
        }
        return true
      }
    },
    // Wiki Link
    {
      key: 'Mod-Shift-k',
      run: (view) => {
        const selection = view.state.selection.main
        const selectedText = view.state.sliceDoc(selection.from, selection.to)
        if (selectedText) {
          view.dispatch({
            changes: { from: selection.from, to: selection.to, insert: `[[${selectedText}]]` },
            selection: { anchor: selection.from + selectedText.length + 4 }
          })
        } else {
          view.dispatch({
            changes: { from: selection.from, insert: '[[]]' },
            selection: { anchor: selection.from + 2 }
          })
          // Trigger autocomplete
          startCompletion(view)
        }
        return true
      }
    },
    // Heading 1
    {
      key: 'Mod-1',
      run: (view) => {
        toggleLinePrefix(view, '# ')
        return true
      }
    },
    // Heading 2
    {
      key: 'Mod-2',
      run: (view) => {
        toggleLinePrefix(view, '## ')
        return true
      }
    },
    // Heading 3
    {
      key: 'Mod-3',
      run: (view) => {
        toggleLinePrefix(view, '### ')
        return true
      }
    },
    // Bullet list
    {
      key: 'Mod-Shift-8',
      run: (view) => {
        toggleLinePrefix(view, '- ')
        return true
      }
    },
    // Numbered list
    {
      key: 'Mod-Shift-7',
      run: (view) => {
        toggleLinePrefix(view, '1. ')
        return true
      }
    },
    // Checkbox
    {
      key: 'Mod-Shift-c',
      run: (view) => {
        toggleLinePrefix(view, '- [ ] ')
        return true
      }
    },
    // Quote
    {
      key: 'Mod-Shift-.',
      run: (view) => {
        toggleLinePrefix(view, '> ')
        return true
      }
    },
    // Code block
    {
      key: 'Mod-Shift-e',
      run: (view) => {
        const selection = view.state.selection.main
        const selectedText = view.state.sliceDoc(selection.from, selection.to)
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: `\`\`\`\n${selectedText}\n\`\`\`` },
          selection: { anchor: selection.from + 3 }
        })
        return true
      }
    },
  ])
}

function wrapSelection(view: EditorView, before: string, after: string) {
  const selection = view.state.selection.main
  const selectedText = view.state.sliceDoc(selection.from, selection.to)

  // Check if already wrapped
  const docText = view.state.doc.toString()
  const beforeText = docText.slice(Math.max(0, selection.from - before.length), selection.from)
  const afterText = docText.slice(selection.to, selection.to + after.length)

  if (beforeText === before && afterText === after) {
    // Unwrap
    view.dispatch({
      changes: [
        { from: selection.from - before.length, to: selection.from, insert: '' },
        { from: selection.to, to: selection.to + after.length, insert: '' }
      ],
      selection: { anchor: selection.from - before.length, head: selection.to - before.length }
    })
  } else {
    // Wrap
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: `${before}${selectedText}${after}` },
      selection: { anchor: selection.from + before.length, head: selection.to + before.length }
    })
  }
}

function toggleLinePrefix(view: EditorView, prefix: string) {
  const selection = view.state.selection.main
  const line = view.state.doc.lineAt(selection.from)

  if (line.text.startsWith(prefix)) {
    // Remove prefix
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' }
    })
  } else {
    // Check for other prefixes and remove them
    const prefixes = ['# ', '## ', '### ', '#### ', '##### ', '###### ', '- ', '* ', '1. ', '- [ ] ', '- [x] ', '> ']
    let existingPrefix = ''
    for (const p of prefixes) {
      if (line.text.startsWith(p)) {
        existingPrefix = p
        break
      }
    }

    if (existingPrefix) {
      view.dispatch({
        changes: [
          { from: line.from, to: line.from + existingPrefix.length, insert: '' },
          { from: line.from, insert: prefix }
        ]
      })
    } else {
      view.dispatch({
        changes: { from: line.from, insert: prefix }
      })
    }
  }
}

// ============================================================
// Image Drop Handler
// ============================================================

function createImageDropHandler(onImageDrop?: (file: File) => Promise<string>): Extension {
  return EditorView.domEventHandlers({
    drop(event, view) {
      if (!onImageDrop) return false

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return false

      const imageFile = Array.from(files).find(f => f.type.startsWith('image/'))
      if (!imageFile) return false

      event.preventDefault()

      // Handle async operation
      onImageDrop(imageFile).then(url => {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos !== null) {
          view.dispatch({
            changes: { from: pos, insert: `![${imageFile.name}](${url})` }
          })
        }
      }).catch(err => {
        console.error('Image drop failed:', err)
      })

      return true
    },
    paste(event, view) {
      if (!onImageDrop) return false

      const items = event.clipboardData?.items
      if (!items) return false

      const imageItem = Array.from(items).find(item => item.type.startsWith('image/'))
      if (!imageItem) return false

      const file = imageItem.getAsFile()
      if (!file) return false

      event.preventDefault()

      // Handle async operation
      onImageDrop(file).then(url => {
        const selection = view.state.selection.main
        view.dispatch({
          changes: { from: selection.from, insert: `![image](${url})` }
        })
      }).catch(err => {
        console.error('Image paste failed:', err)
      })

      return true
    }
  })
}

// ============================================================
// Themes
// ============================================================

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#18181b',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#18181b',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '15px',
    lineHeight: '1.75',
    padding: '20px 24px',
  },
  '.cm-cursor': {
    borderLeftColor: '#18181b',
    borderLeftWidth: '2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(124, 58, 237, 0.15) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#fafafa',
    color: '#a1a1aa',
    border: 'none',
    paddingRight: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    paddingLeft: '12px',
    minWidth: '32px',
  },
  '.cm-foldGutter': {
    width: '12px',
  },
  '.cm-wikilink': {
    color: '#7c3aed',
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    padding: '2px 6px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.15s ease',
  },
  '.cm-wikilink:hover': {
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    textDecoration: 'underline',
  },
  '.cm-tag': {
    color: '#16a34a',
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    padding: '2px 8px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.9em',
    fontWeight: '500',
    transition: 'all 0.15s ease',
  },
  '.cm-tag:hover': {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
  },
  '.cm-tooltip': {
    backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '14px',
    },
    '& > ul > li': {
      padding: '6px 12px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      color: '#18181b',
    },
  },
  '.cm-completionLabel': {
    fontWeight: '500',
  },
  '.cm-completionDetail': {
    color: '#71717a',
    marginLeft: '8px',
    fontSize: '0.85em',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-placeholder': {
    color: '#a1a1aa',
    fontStyle: 'italic',
  },
}, { dark: false })

// Obsidian-like dark theme
const darkThemeExtension = EditorView.theme({
  '&': {
    backgroundColor: '#09090b',
    color: '#dcddde',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#dcddde',
    fontFamily: 'var(--font-text, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    fontSize: '16px',
    lineHeight: '1.6',
    padding: '16px 20px',
  },
  '.cm-cursor': {
    borderLeftColor: '#dcddde',
    borderLeftWidth: '1.5px',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(82, 139, 255, 0.25) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#09090b',
    color: '#4a4a4a',
    border: 'none',
    paddingRight: '4px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    paddingLeft: '8px',
    minWidth: '28px',
    fontSize: '13px',
  },
  '.cm-foldGutter': {
    width: '12px',
  },
  // Obsidian-style wiki links
  '.cm-wikilink': {
    color: '#7f6df2',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  '.cm-wikilink:hover': {
    textDecoration: 'underline',
  },
  // Obsidian-style tags
  '.cm-tag': {
    color: '#8db4d6',
    cursor: 'pointer',
  },
  '.cm-tag:hover': {
    textDecoration: 'underline',
  },
  '.cm-tooltip': {
    backgroundColor: '#2b2b2b',
    border: '1px solid #404040',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: 'var(--font-text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
      fontSize: '14px',
    },
    '& > ul > li': {
      padding: '4px 10px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(82, 139, 255, 0.2)',
      color: '#dcddde',
    },
  },
  '.cm-completionLabel': {
    fontWeight: '400',
  },
  '.cm-completionDetail': {
    color: '#666',
    marginLeft: '8px',
    fontSize: '0.85em',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-placeholder': {
    color: '#555',
    fontStyle: 'normal',
  },
  // Markdown syntax - Obsidian style headings (not red!)
  '.cm-header': {
    color: '#dcddde !important',
  },
  '.cm-header-1': {
    fontSize: '1.6em',
    fontWeight: '600',
  },
  '.cm-header-2': {
    fontSize: '1.4em',
    fontWeight: '600',
  },
  '.cm-header-3': {
    fontSize: '1.2em',
    fontWeight: '600',
  },
  '.cm-header-4, .cm-header-5, .cm-header-6': {
    fontSize: '1.1em',
    fontWeight: '600',
  },
  // Make ## markers subtle
  '.cm-formatting-header': {
    color: '#5a5a5a !important',
  },
  '.cm-formatting': {
    color: '#5a5a5a !important',
  },
  // Bold, italic
  '.cm-strong': {
    color: '#dcddde',
    fontWeight: '600',
  },
  '.cm-em': {
    color: '#dcddde',
    fontStyle: 'italic',
  },
  // Code
  '.cm-inline-code, .cm-monospace': {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '3px',
    padding: '1px 4px',
    fontFamily: '"SF Mono", Monaco, "Cascadia Code", monospace',
    fontSize: '0.9em',
  },
  // Links
  '.cm-link': {
    color: '#7f6df2',
    textDecoration: 'none',
  },
  '.cm-url': {
    color: '#5a5a5a',
  },
  // Quote
  '.cm-quote': {
    color: '#888',
    fontStyle: 'italic',
  },
  // List markers
  '.cm-list': {
    color: '#7f6df2',
  },
}, { dark: true })

// Custom highlight style to override one-dark headings (Obsidian-like)
const obsidianHighlightStyle = HighlightStyle.define([
  // All headings - light gray like Obsidian
  { tag: tags.heading, color: '#dcddde', fontWeight: '600' },
  { tag: tags.heading1, color: '#dcddde', fontWeight: '600', fontSize: '1.6em' },
  { tag: tags.heading2, color: '#dcddde', fontWeight: '600', fontSize: '1.4em' },
  { tag: tags.heading3, color: '#dcddde', fontWeight: '600', fontSize: '1.2em' },
  { tag: tags.heading4, color: '#dcddde', fontWeight: '600', fontSize: '1.1em' },
  { tag: tags.heading5, color: '#dcddde', fontWeight: '600', fontSize: '1.1em' },
  { tag: tags.heading6, color: '#dcddde', fontWeight: '600', fontSize: '1.1em' },
  // Content tag used in markdown headings
  { tag: tags.contentSeparator, color: '#dcddde' },
  // Heading markers (##) - subtle gray
  { tag: tags.processingInstruction, color: '#5a5a5a' },
  // Bold
  { tag: tags.strong, color: '#dcddde', fontWeight: '600' },
  // Italic
  { tag: tags.emphasis, color: '#dcddde', fontStyle: 'italic' },
  // Code
  { tag: tags.monospace, color: '#a6e3a1' },
  // Links
  { tag: tags.link, color: '#7f6df2' },
  { tag: tags.url, color: '#5a5a5a' },
  // Quote
  { tag: tags.quote, color: '#888', fontStyle: 'italic' },
])

// ============================================================
// Editor Component
// ============================================================

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      defaultValue = '',
      onChange,
      onWikiLinkClick,
      onTagClick,
      onSave,
      onImageDrop,
      isDark = true,
      placeholder = '',
      className,
      readOnly = false,
      files = [],
      existingTags = [],
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const themeCompartment = useRef(new Compartment())
    const completionCompartment = useRef(new Compartment())

    // Memoize completion sources
    const completionExtension = useMemo(() => {
      return autocompletion({
        override: [
          createWikiLinkCompletion(files),
          createTagCompletion(existingTags),
        ],
        activateOnTyping: true,
        maxRenderedOptions: 20,
      })
    }, [files, existingTags])

    // Create editor
    useEffect(() => {
      if (!containerRef.current) return

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString())
        }
      })

      const extensions: Extension[] = [
        // Core
        history(),
        drawSelection(),
        dropCursor(),
        bracketMatching(),
        indentOnInput(),
        highlightActiveLine(),
        highlightSelectionMatches(),

        // Keymaps
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),

        // Markdown
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),
        syntaxHighlighting(defaultHighlightStyle),

        // Custom features
        linkHighlighter,
        createClickHandler(onWikiLinkClick, onTagClick),
        createMarkdownKeymap(onSave),
        createImageDropHandler(onImageDrop),

        // Line numbers and folding
        lineNumbers(),
        foldGutter(),
        highlightActiveLineGutter(),

        // Autocomplete
        completionCompartment.current.of(completionExtension),

        // UI
        updateListener,
        EditorView.lineWrapping,
        themeCompartment.current.of(isDark ? [syntaxHighlighting(oneDarkHighlightStyle), darkThemeExtension] : lightTheme),
        // Obsidian-style headings (override one-dark)
        Prec.highest(syntaxHighlighting(obsidianHighlightStyle)),
      ]

      if (placeholder) {
        extensions.push(placeholderExt(placeholder))
      }

      if (readOnly) {
        extensions.push(EditorState.readOnly.of(true))
      }

      const state = EditorState.create({
        doc: defaultValue,
        extensions,
      })

      const view = new EditorView({
        state,
        parent: containerRef.current,
      })

      viewRef.current = view

      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, [])

    // Update theme
    useEffect(() => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: themeCompartment.current.reconfigure(
            isDark ? [syntaxHighlighting(oneDarkHighlightStyle), darkThemeExtension] : lightTheme
          )
        })
      }
    }, [isDark])

    // Update completion sources when files/tags change
    useEffect(() => {
      if (viewRef.current) {
        viewRef.current.dispatch({
          effects: completionCompartment.current.reconfigure(completionExtension)
        })
      }
    }, [completionExtension])

    // Expose methods
    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        return viewRef.current?.state.doc.toString() || ''
      },
      setMarkdown: (value: string) => {
        if (viewRef.current) {
          viewRef.current.dispatch({
            changes: {
              from: 0,
              to: viewRef.current.state.doc.length,
              insert: value,
            }
          })
        }
      },
      focus: () => {
        viewRef.current?.focus()
      },
      insertText: (text: string) => {
        if (viewRef.current) {
          const selection = viewRef.current.state.selection.main
          viewRef.current.dispatch({
            changes: { from: selection.from, to: selection.to, insert: text }
          })
        }
      },
      wrapSelection: (before: string, after: string) => {
        if (viewRef.current) {
          wrapSelection(viewRef.current, before, after)
        }
      },
      insertLink: () => {
        if (viewRef.current) {
          const selection = viewRef.current.state.selection.main
          viewRef.current.dispatch({
            changes: { from: selection.from, insert: '[[]]' },
            selection: { anchor: selection.from + 2 }
          })
          startCompletion(viewRef.current)
        }
      },
      insertImage: (url: string, alt?: string) => {
        if (viewRef.current) {
          const selection = viewRef.current.state.selection.main
          viewRef.current.dispatch({
            changes: { from: selection.from, insert: `![${alt || 'image'}](${url})` }
          })
        }
      },
    }))

    return (
      <div
        ref={containerRef}
        className={cn(
          'h-full overflow-hidden',
          isDark ? 'bg-[#09090b]' : 'bg-white',
          className
        )}
      />
    )
  }
)
