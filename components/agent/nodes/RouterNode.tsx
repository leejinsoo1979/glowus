"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { GitBranch } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function RouterNodeComponent(props: NodeProps<AgentNodeData>) {
  return (
    <BaseAgentNode
      {...props}
      icon={<GitBranch className="w-5 h-5" />}
      color="#a855f7"
      bgColor="#a855f710"
      borderColor="#a855f740"
      inputHandles={1}
      outputHandles={3}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Condition:</label>
        <div className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono truncate">
          {props.data.condition || "input == 'value'"}
        </div>
      </div>
    </BaseAgentNode>
  )
}

export const RouterNode = memo(RouterNodeComponent)
