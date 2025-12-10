"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Globe } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function ToolNodeComponent(props: NodeProps<AgentNodeData>) {
  return (
    <BaseAgentNode
      {...props}
      icon={<Globe className="w-5 h-5" />}
      color="#ec4899"
      bgColor="#ec489910"
      borderColor="#ec489940"
      inputHandles={1}
      outputHandles={1}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">URL:</label>
        <div className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono truncate">
          {props.data.url || "https://api.example.com/v1/..."}
        </div>
      </div>
    </BaseAgentNode>
  )
}

export const ToolNode = memo(ToolNodeComponent)
