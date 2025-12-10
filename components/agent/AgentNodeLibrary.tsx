"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  GitBranch,
  Database,
  Wrench,
  Search,
  MessageSquare,
  Send,
  Link,
  CheckCircle,
  Code,
  ChevronDown,
  Sparkles,
  Play,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Flag,
} from "lucide-react"
import { AGENT_NODE_CONFIGS, getCategoryLabel } from "@/lib/agent"
import type { AgentType, AgentNodeTypeConfig } from "@/lib/agent"

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Brain,
  GitBranch,
  Database,
  Wrench,
  Search,
  MessageSquare,
  Send,
  Link,
  CheckCircle,
  Code,
  Play,
  FileText,
  Globe,
  Image: ImageIcon,
  Layers,
  Flag,
}

interface AgentNodeLibraryProps {
  onDragStart: (event: React.DragEvent, nodeType: AgentType) => void
}

export function AgentNodeLibrary({ onDragStart }: AgentNodeLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  // Expand all by default to show everything
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    "core",
    "tools",
    "control",
    "memory",
    "io",
  ])

  // Custom ordering to match reference: Start, Prompt, Text Model, Image Gen, HTTP Request, Conditional, JS, Embedding, Tool, End
  // This logic reconstructs the list based on a priority queue if needed, or we rely on category grouping.
  // The reference image has mixed categories in one list. But the library groups by category.
  // We will respect category grouping but clear up the rendering.

  const categories = Array.from(
    new Set(Object.values(AGENT_NODE_CONFIGS).map((c) => c.category))
  ).sort((a, b) => {
    // Custom sort order for categories
    const order = ["core", "tools", "control", "memory", "io"]
    return order.indexOf(a) - order.indexOf(b)
  })

  const filteredNodes = (Object.values(AGENT_NODE_CONFIGS) as AgentNodeTypeConfig[]).filter(
    (config) =>
      config.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      config.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  return (
    <div className="w-[300px] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-violet-500 dark:text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Agent Nodes</h2>
        </div>
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-700 transition-colors"
        />
      </div>

      {/* Node Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {categories.map((category) => {
          const categoryNodes = filteredNodes.filter(
            (node) => node.category === category
          )
          if (categoryNodes.length === 0) return null

          const isExpanded = expandedCategories.includes(category)

          return (
            <div key={category} className="space-y-2">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                style={{ marginBottom: 8 }}
              >
                <span>{getCategoryLabel(category)}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {categoryNodes.map((config) => {
                      const IconComponent = iconMap[config.icon]
                      return (
                        <div
                          key={config.type}
                          draggable
                          onDragStart={(e) =>
                            onDragStart(
                              e as unknown as React.DragEvent,
                              config.type
                            )
                          }
                          className="group flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 cursor-grab active:cursor-grabbing transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 shadow-sm dark:shadow-none"
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                            style={{
                              backgroundColor: `${config.color}20`, // 20% opacity using hex
                            }}
                          >
                            {IconComponent && (
                              <IconComponent
                                className="w-5 h-5"
                                style={{ color: config.color }}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[14px] font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                              {config.label}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-500 truncate mt-0.5">
                              {config.description}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

