"use client"

import { memo, ReactNode, useCallback, HTMLAttributes } from "react"
import { Handle, Position, NodeProps, NodeResizer, useStore, useNodeId, HandleProps, ReactFlowState } from "reactflow"
import { motion } from "framer-motion"
import type { AgentNodeData } from "@/lib/agent"

interface BaseAgentNodeProps extends NodeProps<AgentNodeData> {
  icon: ReactNode
  color: string
  bgColor?: string
  borderColor?: string
  inputHandles?: number
  outputHandles?: number
  children?: ReactNode
}

// Custom Handle component that lights up when connected
const SmartHandle = memo(({ color, ...props }: HandleProps & HTMLAttributes<HTMLDivElement> & { color: string }) => {
  const nodeId = useNodeId()
  const isConnected = useStore(
    useCallback(
      (s: ReactFlowState) => s.edges.some((e) => {
        if (props.type === "target") {
          return e.target === nodeId && (e.targetHandle === props.id || (!e.targetHandle && !props.id))
        } else {
          return e.source === nodeId && (e.sourceHandle === props.id || (!e.sourceHandle && !props.id))
        }
      }),
      [nodeId, props.id, props.type]
    )
  )

  return (
    <Handle
      {...props}
      className={`${props.className} flex items-center justify-center`}
      style={{
        ...props.style,
        backgroundColor: undefined, // Let CSS classes handle bg (white/dark)
        borderColor: isConnected ? color : undefined,
        // Remove outer glow to focus on radio effect, or keep it subtle
        boxShadow: isConnected ? `0 0 0 1px ${color}20` : undefined,
      }}
    >
      {isConnected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
    </Handle>
  )
})
SmartHandle.displayName = "SmartHandle"

function BaseAgentNodeComponent({
  data,
  selected,
  icon,
  color,
  inputHandles = 1,
  outputHandles = 1,
  children,
}: BaseAgentNodeProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`relative min-w-[200px] h-full rounded-xl shadow-lg transition-all duration-200 backdrop-blur-sm group 
        bg-white dark:bg-zinc-950 
        border 
        ${selected ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 border-dashed" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"}
      `}
      style={{
        boxShadow: selected ? `0 0 20px ${color}40` : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        ...(selected ? { borderColor: color } : {})
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={100}
        color={color}
        handleStyle={{ width: 8, height: 8, borderRadius: 4 }}
        lineStyle={{ borderStyle: 'dashed' }}
      />

      {/* Input Handles */}
      {inputHandles > 0 && (
        <SmartHandle
          type="target"
          position={Position.Left}
          color={color}
          className="!w-2.5 !h-2.5 !bg-white dark:!bg-zinc-800 !border-[1.5px] !border-zinc-400 dark:!border-zinc-600 group-hover:!border-zinc-500 dark:group-hover:!border-zinc-400 transition-colors z-20"
          style={{ left: -6 }}
        />
      )}

      {/* Header Section */}
      <div className="p-4 flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5"
          style={{ backgroundColor: color }}
        >
          <div className="text-white scale-90">{icon}</div>
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
            {data.label}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide mt-1">
            {data.description || data.agentType || "Agent Node"}
          </div>
        </div>
      </div>

      {children && (
        <>
          {/* Separator */}
          <div className="h-px bg-zinc-100 dark:bg-zinc-800 w-full" />

          {/* Body Section */}
          <div className="p-4 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-b-xl h-[calc(100%-80px)] overflow-y-auto scrollbar-thin">
            {children}
          </div>
        </>
      )}

      {/* Output Handles */}
      {outputHandles === 1 && (
        <SmartHandle
          type="source"
          position={Position.Right}
          color={color}
          className="!w-2.5 !h-2.5 !bg-white dark:!bg-zinc-800 !border-[1.5px] !border-zinc-400 dark:!border-zinc-600 group-hover:!border-zinc-500 dark:group-hover:!border-zinc-400 transition-colors z-20"
          style={{ right: -6 }}
        />
      )}

      {/* Multiple Output Handles */}
      {outputHandles > 1 && (
        <>
          {Array.from({ length: outputHandles }).map((_, i) => {
            const percentage = ((i + 1) / (outputHandles + 1)) * 100
            return (
              <SmartHandle
                key={`output-${i}`}
                type="source"
                position={Position.Right}
                id={String.fromCharCode(97 + i)}
                color={color}
                className="!w-2.5 !h-2.5 !bg-white dark:!bg-zinc-800 !border-[1.5px] !border-zinc-400 dark:!border-zinc-600 group-hover:!border-zinc-500 dark:group-hover:!border-zinc-400 transition-colors z-20"
                style={{ right: -6, top: `${percentage}%` }}
              />
            )
          })}
        </>
      )}
    </motion.div>
  )
}

export const BaseAgentNode = memo(BaseAgentNodeComponent)
