"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Wrench } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function CustomToolNodeComponent(props: NodeProps<AgentNodeData>) {
    return (
        <BaseAgentNode
            {...props}
            icon={<Wrench className="w-5 h-5" />}
            color="#f97316"
            bgColor="#f9731610"
            borderColor="#f9731640"
            inputHandles={1}
            outputHandles={1}
        >
            <div className="text-[11px] text-zinc-400">
                A custom tool
            </div>
        </BaseAgentNode>
    )
}

export const CustomToolNode = memo(CustomToolNodeComponent)
