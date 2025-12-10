"use client"

import dynamic from "next/dynamic"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"

// Dynamic import for AgentBuilder to ensure client-side rendering where needed
const AgentBuilder = dynamic(
    () => import("@/components/agent/AgentBuilder").then((mod) => mod.AgentBuilder),
    { ssr: false }
)

export default function AgentBuilderPage() {
    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-foreground">
            {/* Main Builder Area - now includes its own header */}
            <div className="flex-1 relative overflow-hidden">
                <AgentBuilder />
            </div>
        </div>
    )
}
