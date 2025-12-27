'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useNeuralMapStore } from '@/lib/neural-map/store'
import { useBlueprintSync } from '@/lib/neural-map/useBlueprintSync'
import type { BlueprintProgress, BlueprintNode as BPNode } from '@/lib/neural-map/blueprint-sync'
import {
    GitCommit,
    Terminal,
    Cpu,
    CheckCircle2,
    Circle,
    XSquare,
    Box,
    Zap,
    ZoomIn,
    ZoomOut,
    Maximize,
    Play,
    Pause,
    RotateCcw,
    Github
} from 'lucide-react'

// --- Types ---
interface StreamNode {
    id: string
    type: 'milestone' | 'feature' | 'fix' | 'decision' | 'release'
    title: string
    date: string
    status: 'done' | 'doing' | 'todo'
    description?: string
    codeSnippet?: string // For 'doing' terminal effect
}

export function LifeStreamView({ className }: { className?: string }) {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'
    const graph = useNeuralMapStore((s) => s.graph)
    const mapId = useNeuralMapStore((s) => s.mapId)

    // Blueprint Sync
    const {
        nodes: blueprintNodes,
        progress,
        isLoading: blueprintLoading,
        fetchBlueprint,
        updateNodeStatus,
        subscribeToUpdates,
    } = useBlueprintSync()

    // Agent 실행 상태
    const [isAgentRunning, setIsAgentRunning] = useState(false)

    // Zoom & Pan State
    const [scale, setScale] = useState(1)
    const [offset, setOffset] = useState({ x: 0, y: 0 })
    const containerRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)
    const lastMousePos = useRef({ x: 0, y: 0 })

    // 실시간 업데이트 구독
    useEffect(() => {
        if (mapId) {
            const unsubscribe = subscribeToUpdates()
            return () => unsubscribe()
        }
    }, [mapId, subscribeToUpdates])

    // Real Data Integration - Blueprint 노드 우선 사용
    const streamData = useMemo(() => {
        // Blueprint 노드가 있으면 우선 사용
        if (blueprintNodes.length > 0) {
            return blueprintNodes
                .sort((a, b) => a.position - b.position)
                .map(n => ({
                    id: n.id,
                    type: n.type as StreamNode['type'],
                    title: n.title,
                    date: new Date().toLocaleDateString(),
                    status: n.status,
                    description: n.description || 'No description provided.',
                    codeSnippet: n.status === 'doing' ? '> Executing task...\n> Processing...\n> Building...' : undefined,
                    taskId: n.taskId,
                    files: n.files,
                    gitCommit: n.gitCommit,
                }))
        }

        // 없으면 기존 graph.nodes 사용
        if (!graph?.nodes) return []

        const sortedNodes = [...graph.nodes]
            .filter(n => ['milestone', 'feature', 'release', 'decision'].includes(n.type) || n.tags?.includes('pipeline'))
            .sort((a, b) => {
                const ax = (a.position as any)?.x || 0
                const bx = (b.position as any)?.x || 0
                if (ax !== bx && ax !== 0 && bx !== 0) return ax - bx
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            })

        return sortedNodes.map(n => ({
            id: n.id,
            type: n.type as any,
            title: n.title,
            date: new Date(n.createdAt).toLocaleDateString(),
            status: (n.tags?.includes('done') ? 'done' : n.tags?.includes('doing') ? 'doing' : 'todo') as 'done' | 'doing' | 'todo',
            description: n.summary || 'No description provided.',
            codeSnippet: n.tags?.includes('doing') ? '> System initializing...\n> Loading dependencies...\n> Building modules...' : undefined
        }))
    }, [graph, blueprintNodes])

    // Seeder Logic
    const [isSeeding, setIsSeeding] = useState(false)
    const handleSeedData = async () => {
        if (!mapId) {
            alert("No Map ID found. Please create a map first.")
            return
        }
        setIsSeeding(true)
        try {
            const seedNodes = [
                { title: 'Project Kickoff', type: 'milestone', tags: ['pipeline', 'done'], summary: 'Initial setup completed', position: { x: 0, y: 0, z: 0 } },
                { title: 'Database Design', type: 'decision', tags: ['pipeline', 'done'], summary: 'Schema finalized', position: { x: 300, y: 0, z: 0 } },
                { title: 'Core Engine', type: 'feature', tags: ['pipeline', 'doing'], summary: 'Implementing core logic', position: { x: 600, y: 0, z: 0 } },
                { title: 'API Integration', type: 'feature', tags: ['pipeline', 'todo'], summary: 'Connecting endpoints', position: { x: 900, y: 0, z: 0 } },
                { title: 'Beta Release', type: 'release', tags: ['pipeline', 'todo'], summary: 'v0.1 Launch', position: { x: 1200, y: 0, z: 0 } },
            ]

            for (const node of seedNodes) {
                await fetch(`/api/neural-map/${mapId}/nodes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(node),
                })
            }
            // Force reload to see changes as store sync might take a moment
            window.location.reload()
        } catch (e) {
            console.error(e)
            alert("Failed to seed data.")
        } finally {
            setIsSeeding(false)
        }
    }

    // Zoom Handlers
    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2))
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.2))
    const handleReset = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

    // Wheel Zoom handler
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const delta = e.deltaY * -0.001
            setScale(prev => Math.min(Math.max(prev + delta, 0.2), 2))
        } else {
            // Pan on scroll if not zooming
            setOffset(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }))
        }
    }

    return (
        <div className={cn("relative w-full h-full overflow-hidden bg-[#050508]", className)}>
            {/* Background Grid (Blueprint) */}
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: `
            linear-gradient(to right, #333 1px, transparent 1px),
            linear-gradient(to bottom, #333 1px, transparent 1px)
          `,
                    backgroundSize: `${40 * scale}px ${40 * scale}px`,
                    transform: `translate(${offset.x % (40 * scale)}px, ${offset.y % (40 * scale)}px)`
                }}
            />

            {/* Title + Progress */}
            <div className="absolute top-6 left-8 z-10">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight pointer-events-none">
                    THE BLUEPRINT
                </h1>
                <div className="flex items-center gap-2 mt-1 pointer-events-none">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isAgentRunning ? "bg-green-500 animate-pulse" : "bg-cyan-500 animate-pulse"
                    )} />
                    <span className="text-xs font-mono text-cyan-500/80">
                        {isAgentRunning ? 'AGENT EXECUTING' : 'LIVE AGENT NAVIGATION SYSTEM'}
                    </span>
                </div>

                {/* Progress Bar */}
                {progress && (
                    <div className="mt-4 w-80 pointer-events-auto">
                        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span>Progress</span>
                            <span className="font-mono">{progress.percentage}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress.percentage}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 size={10} className="text-emerald-500" />
                                {progress.done} done
                            </span>
                            <span className="flex items-center gap-1">
                                <Zap size={10} className="text-cyan-500" />
                                {progress.doing} doing
                            </span>
                            <span className="flex items-center gap-1">
                                <Circle size={10} className="text-zinc-600" />
                                {progress.todo} todo
                            </span>
                        </div>
                    </div>
                )}

                {/* Agent Controls */}
                <div className="flex items-center gap-2 mt-4 pointer-events-auto">
                    <button
                        onClick={() => setIsAgentRunning(!isAgentRunning)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            isAgentRunning
                                ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
                        )}
                    >
                        {isAgentRunning ? (
                            <>
                                <Pause size={12} />
                                Stop Agent
                            </>
                        ) : (
                            <>
                                <Play size={12} />
                                Run Agent
                            </>
                        )}
                    </button>
                    <button
                        onClick={() => fetchBlueprint()}
                        disabled={blueprintLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-all"
                    >
                        <RotateCcw size={12} className={blueprintLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 transition-all"
                    >
                        <Github size={12} />
                        Sync
                    </button>
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute top-6 right-8 z-20 flex flex-col gap-2 bg-zinc-900/80 rounded-lg p-2 border border-zinc-800 backdrop-blur-md">
                <button onClick={handleZoomIn} className="p-2 hover:bg-zinc-700/50 rounded-md text-zinc-400 hover:text-white transition-colors"><ZoomIn size={18} /></button>
                <button onClick={handleReset} className="p-2 hover:bg-zinc-700/50 rounded-md text-zinc-400 hover:text-white transition-colors"><Maximize size={18} /></button>
                <button onClick={handleZoomOut} className="p-2 hover:bg-zinc-700/50 rounded-md text-zinc-400 hover:text-white transition-colors"><ZoomOut size={18} /></button>
                <div className="h-px bg-zinc-700 my-1" />
                <span className="text-[10px] text-center font-mono text-zinc-500">{Math.round(scale * 100)}%</span>
            </div>

            {/* Stream Container (Zoomable) */}
            <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center cursor-errors-grab active:cursor-grabbing"
                onWheel={handleWheel}
            >
                <motion.div
                    className="flex items-center gap-0 min-w-max pt-10 pb-20 origin-center"
                    animate={{ scale, x: offset.x, y: offset.y }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                    {streamData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center opacity-50 scale-150">
                            <Box size={48} className="text-zinc-600 mb-4" />
                            <p className="text-zinc-500 text-sm">No Blueprint Nodes Found</p>
                            <p className="text-zinc-700 text-xs mt-1 mb-4">The map is empty properly.</p>
                            <button
                                onClick={handleSeedData}
                                disabled={isSeeding}
                                className="px-4 py-2 bg-cyan-900/50 hover:bg-cyan-800/50 border border-cyan-500/30 rounded text-cyan-300 text-xs transition-colors cursor-pointer pointer-events-auto"
                            >
                                {isSeeding ? 'Initializing...' : 'Initialize Demo Blueprint'}
                            </button>
                        </div>
                    ) : (
                        streamData.map((node, i) => {
                            const isLast = i === streamData.length - 1
                            return (
                                <div key={node.id} className="flex items-center group relative">
                                    <StreamCard node={node} isDark={isDark} />
                                    {!isLast && (
                                        <ConnectionLine status={node.status} nextStatus={streamData[i + 1]?.status || 'todo'} />
                                    )}
                                </div>
                            )
                        })
                    )}
                </motion.div>
            </div>
        </div>
    )
}

// --- Specific Card Components (Unchanged logic, just ensure export is consistent) ---

function StreamCard({ node, isDark }: { node: StreamNode, isDark: boolean }) {
    if (node.status === 'done') {
        return (
            <div className="relative w-64 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
                <div className="absolute -top-3 left-6 flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-medium text-emerald-400 shadow-xl">
                    <CheckCircle2 size={12} /> <span>COMPLETED</span>
                </div>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">{node.title}</h3>
                <p className="text-xs text-zinc-500 font-mono mt-1">{node.date}</p>
                <p className="text-sm text-zinc-400 mt-3 leading-relaxed">{node.description}</p>
            </div>
        )
    }
    if (node.status === 'doing') {
        return (
            <div className="relative w-80 p-6 rounded-2xl mx-4 border border-cyan-500/50 bg-black/60 backdrop-blur-md shadow-[0_0_50px_-10px_rgba(6,182,212,0.3)] z-10 scale-110">
                <div className="absolute inset-0 rounded-2xl border border-cyan-400/30 animate-pulse" />
                <div className="absolute -top-4 left-6 flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-500 text-xs font-bold text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                    <Zap size={12} className="fill-cyan-300" /> <span>PROCESSING</span>
                </div>
                <h3 className="text-2xl font-bold text-white mt-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{node.title}</h3>
                <p className="text-xs text-cyan-200/60 font-mono mt-1 mb-4">{node.date} :: RUNNING</p>
                <div className="w-full h-32 rounded-lg bg-black/80 border border-zinc-800 p-3 font-mono text-xs overflow-hidden">
                    <div className="flex gap-1.5 mb-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500/50" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/50" /></div>
                    <div className="text-cyan-400/90 leading-relaxed whitespace-pre-wrap"><TypewriterText text={node.codeSnippet || '> Processing...'} /></div>
                </div>
            </div>
        )
    }
    return (
        <div className="relative w-64 h-40 mx-2 p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 flex flex-col items-center justify-center gap-3 group hover:border-zinc-700 transition-all cursor-not-allowed">
            <div className="text-center z-10 opacity-50 group-hover:opacity-100 transition-opacity">
                <Box size={32} className="mx-auto mb-2 text-zinc-700" />
                <h3 className="text-sm font-bold text-zinc-600">{node.title}</h3>
                <p className="text-[10px] text-zinc-700 font-mono mt-1">PENDING</p>
            </div>
            <div className="absolute top-2 right-2"><XSquare size={14} className="text-zinc-800" /></div>
        </div>
    )
}

function ConnectionLine({ status, nextStatus }: { status: string, nextStatus: string }) {
    if (status === 'done' && nextStatus === 'done') return <div className="w-16 h-0.5 bg-emerald-500/50" />
    if (status === 'done' && nextStatus === 'doing') return <div className="w-16 h-0.5 bg-gradient-to-r from-emerald-500/50 to-cyan-500" />
    if (status === 'doing') return <div className="w-16 h-0.5 bg-gradient-to-r from-cyan-500 to-zinc-800" />
    return <div className="w-12 border-t-2 border-dotted border-zinc-800 mx-2" />
}

function TypewriterText({ text }: { text: string }) {
    const [displayed, setDisplayed] = useState('')
    useEffect(() => {
        let index = 0
        const interval = setInterval(() => { setDisplayed(text.slice(0, index)); index++; if (index > text.length) index = 0 }, 50)
        return () => clearInterval(interval)
    }, [text])
    return <span>{displayed}<span className="animate-pulse opacity-70">_</span></span>
}
