"use client"

import { memo, useState } from "react"
import { motion } from "framer-motion"
import {
  Zap,
  Database,
  FileOutput,
  Settings,
  GitBranch,
  GitFork,
  Code,
  Brain,
  Clock,
  Globe,
  Bell,
  ChevronDown,
  Search,
  Webhook,
  Calendar,
  CalendarDays,
  Sparkles,
  Braces,
  Type,
  Calculator,
  List,
  PenLine,
  Repeat,
  Hourglass,
  AlertTriangle,
  Merge,
  Split,
  Layers,
  Sheet,
  File,
  MessageSquare,
  MessageCircle,
  Send,
  Mail,
  Reply,
} from "lucide-react"
import { NODE_CONFIGS } from "@/lib/workflow"

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  FileOutput: <FileOutput className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  GitBranch: <GitBranch className="w-4 h-4" />,
  GitFork: <GitFork className="w-4 h-4" />,
  Code: <Code className="w-4 h-4" />,
  Brain: <Brain className="w-4 h-4" />,
  Clock: <Clock className="w-4 h-4" />,
  Globe: <Globe className="w-4 h-4" />,
  Bell: <Bell className="w-4 h-4" />,
  Webhook: <Webhook className="w-4 h-4" />,
  Calendar: <Calendar className="w-4 h-4" />,
  CalendarDays: <CalendarDays className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Braces: <Braces className="w-4 h-4" />,
  Type: <Type className="w-4 h-4" />,
  Calculator: <Calculator className="w-4 h-4" />,
  List: <List className="w-4 h-4" />,
  PenLine: <PenLine className="w-4 h-4" />,
  Repeat: <Repeat className="w-4 h-4" />,
  Hourglass: <Hourglass className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  Merge: <Merge className="w-4 h-4" />,
  Split: <Split className="w-4 h-4" />,
  Layers: <Layers className="w-4 h-4" />,
  Sheet: <Sheet className="w-4 h-4" />,
  File: <File className="w-4 h-4" />,
  MessageSquare: <MessageSquare className="w-4 h-4" />,
  MessageCircle: <MessageCircle className="w-4 h-4" />,
  Send: <Send className="w-4 h-4" />,
  Mail: <Mail className="w-4 h-4" />,
  Reply: <Reply className="w-4 h-4" />,
}

const categoryLabels: Record<string, string> = {
  input: "입력",
  ai: "AI",
  data: "데이터 변환",
  process: "처리",
  control: "제어 흐름",
  integration: "통합",
  output: "출력",
}

const categoryOrder = ["input", "ai", "data", "process", "control", "integration", "output"]

interface NodeLibraryProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void
}

function NodeLibraryComponent({ onDragStart }: NodeLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(categoryOrder.map((c) => [c, true]))
  )

  const filteredNodes = NODE_CONFIGS.filter(
    (config) =>
      config.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      config.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const groupedNodes = categoryOrder.map((category) => ({
    category,
    label: categoryLabels[category],
    nodes: filteredNodes.filter((config) => config.category === category),
  }))

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const totalNodes = NODE_CONFIGS.length

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-100">노드 라이브러리</h2>
          <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
            {totalNodes}개
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="노드 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {groupedNodes.map(({ category, label, nodes }) => (
          <div key={category} className="bg-zinc-800/50 rounded-lg overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span>{label}</span>
                <span className="text-[10px] text-zinc-500">
                  {nodes.length}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  expandedCategories[category] ? "" : "-rotate-90"
                }`}
              />
            </button>

            {/* Nodes */}
            {expandedCategories[category] && nodes.length > 0 && (
              <div className="p-2 space-y-1">
                {nodes.map((config) => (
                  <motion.div
                    key={config.type}
                    draggable={!config.disabled}
                    onDragStart={(e) => {
                      if (config.disabled) return
                      onDragStart(e as unknown as React.DragEvent, config.type)
                    }}
                    whileHover={{ scale: config.disabled ? 1 : 1.02 }}
                    whileTap={{ scale: config.disabled ? 1 : 0.98 }}
                    className={`
                      flex items-center gap-3 p-2 rounded-lg border border-transparent
                      transition-colors
                      ${
                        config.disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-grab active:cursor-grabbing hover:bg-zinc-700/50 hover:border-zinc-600"
                      }
                    `}
                    title={config.disabled ? "준비 중" : config.description}
                  >
                    <div
                      className="p-1.5 rounded"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <div style={{ color: config.color }}>
                        {iconMap[config.icon] || <Settings className="w-4 h-4" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-200 flex items-center gap-1">
                        {config.label}
                        {config.beta && (
                          <span className="text-[8px] text-yellow-500 bg-yellow-500/10 px-1 rounded">
                            BETA
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {config.description}
                      </div>
                    </div>
                    {config.disabled && (
                      <span className="text-[9px] text-zinc-500 bg-zinc-700 px-1 rounded">
                        준비중
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {expandedCategories[category] && nodes.length === 0 && (
              <div className="p-3 text-xs text-zinc-500 text-center">
                검색 결과 없음
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Help */}
      <div className="p-3 border-t border-zinc-800 text-[10px] text-zinc-500">
        노드를 드래그하여 캔버스에 추가하세요
      </div>
    </div>
  )
}

export const NodeLibrary = memo(NodeLibraryComponent)
