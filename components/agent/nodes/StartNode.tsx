"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Play } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function StartNodeComponent(props: NodeProps<AgentNodeData>) {
    return (
        <BaseAgentNode
            {...props}
            icon={<Play className="w-5 h-5 ml-0.5" />} // Slight offset for Play icon visual balance
            color="#22c55e"
            bgColor="#22c55e10"
            borderColor="#22c55e40"
            inputHandles={0}
            outputHandles={1}
        />
    )
}

export const StartNode = memo(StartNodeComponent)
