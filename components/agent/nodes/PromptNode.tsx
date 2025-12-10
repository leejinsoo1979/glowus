import { memo } from "react"
import { Handle, Position, NodeProps } from "reactflow"
import { FileText } from "lucide-react"
import { BaseAgentNode } from "./BaseAgentNode"
import { AgentNodeData } from "@/lib/agent/types"

export const PromptNode = memo((props: NodeProps<AgentNodeData>) => {
    return (
        <BaseAgentNode
            {...props}
            icon={<FileText className="w-5 h-5 text-white" />}
            color="#d946ef" // fuchsia-500
        >
            <div className="flex flex-col gap-3">
                {/* Input Text Label - mimicking the header part of the reference if needed, 
            but BaseAgentNode handles title. The reference shows a sublabel 'Input text' 
            but BaseAgentNode might not have sublabel prop yet. 
            We'll stick to the content body for now. 
        */}

                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Input text
                </div>

                <div className="text-sm text-zinc-700 dark:text-zinc-300 min-h-[60px] whitespace-pre-wrap font-medium">
                    {props.data.prompt || "Enter your prompt..."}
                </div>

                {/* Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="w-3 h-3 !bg-fuchsia-500 !border-2 !border-white dark:!border-zinc-950"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-3 h-3 !bg-fuchsia-500 !border-2 !border-white dark:!border-zinc-950"
                />
            </div>
        </BaseAgentNode>
    )
})

PromptNode.displayName = "PromptNode"
