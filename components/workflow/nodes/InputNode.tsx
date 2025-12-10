"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Database } from "lucide-react"
import { BaseNode } from "./BaseNode"
import type { NodeData } from "@/lib/workflow"

function InputNodeComponent(props: NodeProps<NodeData>) {
  return (
    <BaseNode
      {...props}
      icon={<Database className="w-4 h-4" />}
      color="var(--accent-color)"
      showTargetHandle={false}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">소스:</span>
          <span className="px-2 py-0.5 bg-accent/20 text-accent rounded text-xs">
            {props.data.dataSource || "manual"}
          </span>
        </div>
        {props.data.sampleData && (
          <div className="p-2 bg-zinc-800 rounded text-[10px] font-mono text-zinc-400 max-h-16 overflow-hidden">
            {props.data.sampleData.substring(0, 50)}
            {props.data.sampleData.length > 50 && "..."}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const InputNode = memo(InputNodeComponent)
