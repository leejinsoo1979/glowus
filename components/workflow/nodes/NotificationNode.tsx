"use client"

import { memo } from "react"
import { NodeProps } from "reactflow"
import { Bell, Mail, MessageSquare, Globe } from "lucide-react"
import { BaseNode } from "./BaseNode"
import type { NodeData } from "@/lib/workflow"

function NotificationNodeComponent(props: NodeProps<NodeData>) {
  const typeConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
    email: {
      icon: <Mail className="w-3 h-3" />,
      color: "text-accent",
      bgColor: "bg-accent/20",
    },
    slack: {
      icon: <MessageSquare className="w-3 h-3" />,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    webhook: {
      icon: <Globe className="w-3 h-3" />,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
    },
  }

  const type = props.data.notificationType || "slack"
  const config = typeConfig[type] || typeConfig.slack

  return (
    <BaseNode
      {...props}
      icon={<Bell className="w-4 h-4" />}
      color="#f97316"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.color} ${config.bgColor}`}>
            {config.icon}
            {type}
          </span>
        </div>
        {props.data.notificationMessage && (
          <div className="p-2 bg-zinc-800 rounded text-[10px] text-zinc-400">
            {props.data.notificationMessage.substring(0, 50)}
            {props.data.notificationMessage.length > 50 && "..."}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const NotificationNode = memo(NotificationNodeComponent)
