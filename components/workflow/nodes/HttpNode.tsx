"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Globe } from "lucide-react"
import { BaseNode } from "./BaseNode"
import type { NodeData } from "@/lib/workflow"

function HttpNodeComponent(props: NodeProps<NodeData>) {
  const methodColors: Record<string, string> = {
    GET: "text-green-400 bg-green-500/20",
    POST: "text-accent bg-accent/20",
    PUT: "text-amber-400 bg-amber-500/20",
    DELETE: "text-red-400 bg-red-500/20",
    PATCH: "text-purple-400 bg-purple-500/20",
  }

  const method = props.data.httpMethod || "GET"
  const colorClass = methodColors[method] || "text-zinc-400 bg-zinc-700"

  return (
    <BaseNode
      {...props}
      icon={<Globe className="w-4 h-4" />}
      color="#06b6d4"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-mono ${colorClass}`}>
            {method}
          </span>
        </div>
        {props.data.httpUrl && (
          <div className="p-2 bg-zinc-800 rounded text-[10px] font-mono text-cyan-400 truncate">
            {props.data.httpUrl}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const HttpNode = memo(HttpNodeComponent)
