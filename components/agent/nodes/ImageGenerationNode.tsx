"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Image } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function ImageGenerationNodeComponent(props: NodeProps<AgentNodeData>) {
    return (
        <BaseAgentNode
            {...props}
            icon={<Image className="w-5 h-5" />}
            color="#6366f1"
            bgColor="#6366f110"
            borderColor="#6366f140"
            inputHandles={1}
            outputHandles={1}
        >
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Model</span>
                    <span className="text-[11px] text-zinc-200 font-medium">gemini-2.5-flash-image</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Aspect Ratio</span>
                    <span className="text-[11px] text-zinc-200 font-medium">1:1</span>
                </div>
            </div>
        </BaseAgentNode>
    )
}

export const ImageGenerationNode = memo(ImageGenerationNodeComponent)
