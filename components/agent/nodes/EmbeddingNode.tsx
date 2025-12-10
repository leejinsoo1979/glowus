"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Layers } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function EmbeddingNodeComponent(props: NodeProps<AgentNodeData>) {
    return (
        <BaseAgentNode
            {...props}
            icon={<Layers className="w-5 h-5" />}
            color="#06b6d4"
            bgColor="#06b6d410"
            borderColor="#06b6d440"
            inputHandles={1}
            outputHandles={1}
        >
            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5">
                    <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Dimensions:</span>
                    <span className="text-xs text-zinc-200 font-mono font-bold">1536</span>
                </div>
            </div>
        </BaseAgentNode>
    )
}

export const EmbeddingNode = memo(EmbeddingNodeComponent)
