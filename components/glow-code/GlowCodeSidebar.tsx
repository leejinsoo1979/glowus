'use client'

import React, { useState } from 'react'
import { useGlowCodeStore } from '@/stores/glowCodeStore'
import {
  MessageSquare,
  Settings,
  FolderOpen,
  Plus,
  Trash2,
  Check,
  Crown,
  ChevronDown,
  Wifi,
  WifiOff
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

// Model options
const MODEL_OPTIONS = [
  { value: 'claude-opus-4-5-20250514', label: 'Claude Opus 4.5', tier: 'flagship' },
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5', tier: 'balanced' },
  { value: 'claude-haiku-4-5-20250514', label: 'Claude Haiku 4.5', tier: 'fast' },
  { value: 'custom', label: 'Custom Model', tier: 'custom' },
] as const

// Settings Panel Component
const SettingsPanel = () => {
  const { settings, updateSettings } = useGlowCodeStore()
  const [showModelDropdown, setShowModelDropdown] = useState(false)

  const currentModel = MODEL_OPTIONS.find(m => m.value === settings.model) || MODEL_OPTIONS[0]

  return (
    <div className="p-4 space-y-4">
      {/* Connection Status */}
      <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">연결 상태</span>
          {settings.isConnected ? (
            <span className="flex items-center gap-1.5 text-green-400 text-sm">
              <Wifi className="w-4 h-4" />
              연결됨
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-zinc-500 text-sm">
              <WifiOff className="w-4 h-4" />
              연결 안됨
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-white">Max Plan 전용</span>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          API 키 없이 Claude Code CLI를 통해 연결
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label className="text-sm text-zinc-400">모델</label>
        <div className="relative">
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">{currentModel.label}</span>
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                currentModel.tier === 'flagship' && "bg-purple-500/20 text-purple-400",
                currentModel.tier === 'balanced' && "bg-blue-500/20 text-blue-400",
                currentModel.tier === 'fast' && "bg-green-500/20 text-green-400",
                currentModel.tier === 'custom' && "bg-zinc-500/20 text-zinc-400",
              )}>
                {currentModel.tier}
              </span>
            </div>
            <ChevronDown className={cn(
              "w-4 h-4 text-zinc-400 transition-transform",
              showModelDropdown && "rotate-180"
            )} />
          </button>

          {showModelDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden z-10">
              {MODEL_OPTIONS.map((model) => (
                <button
                  key={model.value}
                  onClick={() => {
                    updateSettings({ model: model.value })
                    setShowModelDropdown(false)
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-3 hover:bg-zinc-700 transition-colors",
                    settings.model === model.value && "bg-zinc-700/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">{model.label}</span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      model.tier === 'flagship' && "bg-purple-500/20 text-purple-400",
                      model.tier === 'balanced' && "bg-blue-500/20 text-blue-400",
                      model.tier === 'fast' && "bg-green-500/20 text-green-400",
                      model.tier === 'custom' && "bg-zinc-500/20 text-zinc-400",
                    )}>
                      {model.tier}
                    </span>
                  </div>
                  {settings.model === model.value && (
                    <Check className="w-4 h-4" style={{ color: CLAUDE_ORANGE }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Model ID */}
      {settings.model === 'custom' && (
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Custom Model ID</label>
          <input
            type="text"
            value={settings.customModelId}
            onChange={(e) => updateSettings({ customModelId: e.target.value })}
            placeholder="claude-3-opus-20240229"
            className="w-full p-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': CLAUDE_ORANGE } as React.CSSProperties}
          />
        </div>
      )}

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Temperature</label>
          <span className="text-sm text-white">{settings.temperature}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-orange-500"
        />
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-400">Max Tokens</label>
          <span className="text-sm text-white">{settings.maxTokens}</span>
        </div>
        <input
          type="range"
          min="1024"
          max="32768"
          step="1024"
          value={settings.maxTokens}
          onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) })}
          className="w-full accent-orange-500"
        />
      </div>

      {/* Toggle Options */}
      <div className="space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">자동 컨텍스트</span>
          <button
            onClick={() => updateSettings({ autoContext: !settings.autoContext })}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              settings.autoContext ? "bg-orange-500" : "bg-zinc-700"
            )}
          >
            <div className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              settings.autoContext ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">도구 호출 표시</span>
          <button
            onClick={() => updateSettings({ showToolCalls: !settings.showToolCalls })}
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              settings.showToolCalls ? "bg-orange-500" : "bg-zinc-700"
            )}
          >
            <div className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
              settings.showToolCalls ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </label>
      </div>
    </div>
  )
}

// Thread List Component
const ThreadList = () => {
  const { threads, activeThreadId, setActiveThread, createThread, deleteThread } = useGlowCodeStore()

  return (
    <div className="flex flex-col h-full">
      {/* New Thread Button */}
      <div className="p-3 border-b border-zinc-800">
        <button
          onClick={() => createThread()}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: CLAUDE_ORANGE }}
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">새 대화</span>
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-sm">
            대화 기록이 없습니다
          </div>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => setActiveThread(thread.id)}
              className={cn(
                "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                activeThreadId === thread.id
                  ? "bg-zinc-800"
                  : "hover:bg-zinc-800/50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <span className="text-sm text-white truncate">
                  {thread.title || 'New Chat'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteThread(thread.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-700 rounded transition-all"
              >
                <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// File Tree Component (placeholder)
const FileTree = () => {
  return (
    <div className="p-4">
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <FolderOpen className="w-12 h-12 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500">프로젝트 파일</p>
        <p className="text-xs text-zinc-600 mt-1">컨텍스트에 파일을 추가하세요</p>
      </div>
    </div>
  )
}

// Main Sidebar Component
export function GlowCodeSidebar() {
  const { sidebarTab, setSidebarTab } = useGlowCodeStore()

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setSidebarTab('threads')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition-colors",
            sidebarTab === 'threads'
              ? "text-white border-b-2"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          style={{ borderColor: sidebarTab === 'threads' ? CLAUDE_ORANGE : 'transparent' }}
        >
          <MessageSquare className="w-4 h-4" />
          대화
        </button>
        <button
          onClick={() => setSidebarTab('files')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition-colors",
            sidebarTab === 'files'
              ? "text-white border-b-2"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          style={{ borderColor: sidebarTab === 'files' ? CLAUDE_ORANGE : 'transparent' }}
        >
          <FolderOpen className="w-4 h-4" />
          파일
        </button>
        <button
          onClick={() => setSidebarTab('settings')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-3 text-sm transition-colors",
            sidebarTab === 'settings'
              ? "text-white border-b-2"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          style={{ borderColor: sidebarTab === 'settings' ? CLAUDE_ORANGE : 'transparent' }}
        >
          <Settings className="w-4 h-4" />
          설정
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {sidebarTab === 'threads' && <ThreadList />}
        {sidebarTab === 'files' && <FileTree />}
        {sidebarTab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  )
}

export default GlowCodeSidebar
