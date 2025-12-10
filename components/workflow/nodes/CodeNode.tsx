"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Code } from "lucide-react"
import { BaseNode } from "./BaseNode"
import type { NodeData } from "@/lib/workflow"

function CodeNodeComponent(props: NodeProps<NodeData>) {
  const languageColors: Record<string, string> = {
    javascript: "text-yellow-400 bg-yellow-500/20",
    typescript: "text-accent bg-accent/20",
    python: "text-green-400 bg-green-500/20",
  }

  const language = props.data.codeLanguage || "javascript"
  const colorClass = languageColors[language] || "text-zinc-400 bg-zinc-700"

  return (
    <BaseNode
      {...props}
      icon={<Code className="w-4 h-4" />}
      color="#6b7280"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">언어:</span>
          <span className={`px-2 py-0.5 rounded text-xs ${colorClass}`}>
            {language}
          </span>
        </div>
        {props.data.code && (
          <div className="p-2 bg-zinc-800 rounded font-mono text-[10px] text-zinc-300 max-h-24 overflow-hidden">
            <pre className="whitespace-pre-wrap">
              {props.data.code.substring(0, 100)}
              {props.data.code.length > 100 && "..."}
            </pre>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const CodeNode = memo(CodeNodeComponent)
