"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Code } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import type { AgentNodeData } from "@/lib/agent"

function JavaScriptNodeComponent(props: NodeProps<AgentNodeData>) {
    return (
        <BaseAgentNode
            {...props}
            icon={<Code className="w-5 h-5" />}
            color="#f59e0b"
            bgColor="#f59e0b10"
            borderColor="#f59e0b40"
            inputHandles={1}
            outputHandles={1}
        >
            <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Code:</label>
                <div className="bg-zinc-950 border border-zinc-800 rounded px-2 py-2 text-xs text-zinc-400 font-mono">
                    <div className="opacity-50 select-none">// Access inputs as input1, etc.</div>
                    <div className="text-zinc-300">return input1.toUpperCase()</div>
                </div>
            </div>
        </BaseAgentNode>
    )
}

export const JavaScriptNode = memo(JavaScriptNodeComponent)
