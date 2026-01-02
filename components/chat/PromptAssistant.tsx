'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, RefreshCw, X, Check, ChevronDown } from 'lucide-react'

interface PromptAssistantProps {
  onSubmit: (prompt: string) => void
  onClose: () => void
  agentContext?: {
    agentName?: string
    agentDescription?: string
  }
}

export default function PromptAssistant({
  onSubmit,
  onClose,
  agentContext,
}: PromptAssistantProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [optimizedPrompt, setOptimizedPrompt] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleOptimize = async () => {
    if (!input.trim()) return

    setIsLoading(true)
    setOptimizedPrompt('')
    setSuggestions([])

    try {
      const response = await fetch('/api/prompt-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          context: agentContext,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOptimizedPrompt(data.optimized)
        setSuggestions(data.suggestions || [])
        setSelectedIndex(0)
      } else {
        setOptimizedPrompt(input.trim())
      }
    } catch (error) {
      console.error('Prompt optimization failed:', error)
      setOptimizedPrompt(input.trim())
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = () => {
    const promptToSubmit = showSuggestions && suggestions[selectedIndex]
      ? suggestions[selectedIndex]
      : optimizedPrompt

    if (promptToSubmit) {
      onSubmit(promptToSubmit)
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (optimizedPrompt) {
        handleSubmit()
      } else {
        handleOptimize()
      }
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const selectSuggestion = (index: number) => {
    setSelectedIndex(index)
    setOptimizedPrompt(suggestions[index])
    setShowSuggestions(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">프롬프트 어시스턴트</h3>
              <p className="text-xs text-zinc-400">대충 입력해도 찰떡같이 알아듣습니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Input Section */}
        <div className="p-5">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="대충 입력하세요... (예: 직원 뭐, 돈 얼마, 보고서 만들어)"
              className="w-full h-24 px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={handleOptimize}
              disabled={!input.trim() || isLoading}
              className="absolute right-3 bottom-3 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isLoading ? '생성 중...' : '프롬프트 생성'}
            </button>
          </div>
        </div>

        {/* Optimized Result */}
        {optimizedPrompt && (
          <div className="px-5 pb-5">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-purple-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  최적화된 프롬프트
                </span>
                {suggestions.length > 0 && (
                  <button
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    다른 버전 보기
                    <ChevronDown className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {/* Main Optimized Prompt */}
              <p className="text-white leading-relaxed">{optimizedPrompt}</p>

              {/* Alternative Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-700 space-y-2">
                  <span className="text-xs text-zinc-500">다른 버전 선택:</span>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => selectSuggestion(index)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedIndex === index
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-700/50'
                      }`}
                    >
                      <span className={`text-sm ${selectedIndex === index ? 'text-white' : 'text-zinc-300'}`}>
                        {suggestion}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Send className="w-4 h-4" />
                이 프롬프트로 전송
              </button>
              <button
                onClick={handleOptimize}
                className="px-4 py-3 bg-zinc-700 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-zinc-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                다시 생성
              </button>
            </div>
          </div>
        )}

        {/* Tips */}
        {!optimizedPrompt && !isLoading && (
          <div className="px-5 pb-5">
            <div className="bg-zinc-800/30 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-3">💡 예시</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { short: '직원 뭐', full: '직원 목록 조회' },
                  { short: '돈 얼마', full: '재무 현황 분석' },
                  { short: '할일 만들어', full: '태스크 생성' },
                  { short: '보고서', full: '보고서 생성' },
                ].map((example, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(example.short)}
                    className="text-left p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors group"
                  >
                    <span className="text-sm text-zinc-400 group-hover:text-white">
                      "{example.short}"
                    </span>
                    <span className="text-xs text-zinc-600 ml-2">→ {example.full}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
