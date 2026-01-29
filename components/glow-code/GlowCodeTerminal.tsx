'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon, Copy, Check, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerminalLine {
  id: string
  type: 'input' | 'output' | 'error' | 'system'
  content: string
  timestamp: number
}

export function GlowCodeTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: '1',
      type: 'system',
      content: 'GlowCode Terminal - Claude Code CLI Proxy',
      timestamp: Date.now()
    },
    {
      id: '2',
      type: 'system',
      content: 'Type "claude --help" for available commands',
      timestamp: Date.now()
    }
  ])
  const [input, setInput] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [copied, setCopied] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const addLine = (type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      timestamp: Date.now()
    }])
  }

  const executeCommand = async (command: string) => {
    if (!command.trim()) return

    // Add to history
    setHistory(prev => [...prev, command])
    setHistoryIndex(-1)

    // Show input
    addLine('input', `$ ${command}`)
    setInput('')
    setIsExecuting(true)

    try {
      // Handle built-in commands
      if (command === 'clear') {
        setLines([])
        setIsExecuting(false)
        return
      }

      if (command === 'help' || command === 'claude --help') {
        addLine('output', `
Claude Code CLI Commands:
  claude -p "prompt"     Send a prompt to Claude
  claude --print         Print mode (non-interactive)
  claude --version       Show version

GlowCode Commands:
  clear                  Clear terminal
  help                   Show this help
        `.trim())
        setIsExecuting(false)
        return
      }

      if (command === 'claude --version') {
        // Try to get actual version
        const response = await fetch('/api/glow-code/cli-auth')
        const data = await response.json()
        addLine('output', data.version || 'Claude Code CLI')
        setIsExecuting(false)
        return
      }

      // Handle claude commands
      if (command.startsWith('claude')) {
        // Extract prompt from command
        const promptMatch = command.match(/(?:-p|--print)\s+["'](.+?)["']/)
        if (promptMatch) {
          const prompt = promptMatch[1]

          const response = await fetch('/api/glow-code/cli-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [{ role: 'user', content: prompt }]
            })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Command failed')
          }

          // Handle SSE stream
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()

          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value)
              const dataLines = chunk.split('\n')

              for (const line of dataLines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6))
                    if (data.type === 'text') {
                      addLine('output', data.content)
                    } else if (data.type === 'error') {
                      addLine('error', data.content)
                    }
                  } catch {
                    // Skip invalid JSON
                  }
                }
              }
            }
          }
        } else {
          addLine('error', 'Usage: claude -p "your prompt" or claude --print -p "your prompt"')
        }
      } else {
        addLine('error', `Command not found: ${command.split(' ')[0]}`)
      }
    } catch (error: any) {
      addLine('error', `Error: ${error.message}`)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
      executeCommand(input)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(history[history.length - 1 - newIndex] || '')
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  const copyOutput = () => {
    const output = lines
      .filter(l => l.type !== 'system')
      .map(l => l.type === 'input' ? l.content : `  ${l.content}`)
      .join('\n')
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="h-full flex flex-col bg-zinc-950 font-mono text-sm"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Header Actions */}
      <div className="absolute top-1 right-2 flex items-center gap-1 z-10">
        <button
          onClick={copyOutput}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Copy output"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1"
      >
        {lines.map(line => (
          <div
            key={line.id}
            className={cn(
              'whitespace-pre-wrap break-all',
              line.type === 'input' && 'text-green-400',
              line.type === 'output' && 'text-zinc-300',
              line.type === 'error' && 'text-red-400',
              line.type === 'system' && 'text-zinc-500 italic'
            )}
          >
            {line.content}
          </div>
        ))}

        {/* Input Line */}
        <div className="flex items-center gap-2 text-green-400">
          <span>$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            className="flex-1 bg-transparent outline-none text-zinc-100 placeholder-zinc-600"
            placeholder={isExecuting ? 'Executing...' : 'Type a command...'}
            spellCheck={false}
            autoComplete="off"
          />
          {isExecuting && (
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}

export default GlowCodeTerminal
