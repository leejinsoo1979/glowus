"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Flag } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function EndNodeComponent(props: NodeProps<AgentNodeData>) {
    return (
        <BaseAgentNode
            {...props}
            icon={<Flag className="w-5 h-5" />}
            color="#ef4444"
            bgColor="#ef444410"
            borderColor="#ef444440"
            inputHandles={1}
            outputHandles={0}
        />
    )
}

export const EndNode = memo(EndNodeComponent)
