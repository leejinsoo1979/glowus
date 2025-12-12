'use client'

import React, { useRef, useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

// --- Live Mesh Gradient Background ---
export function LiveMeshGradient() {
    const { accentColor } = useThemeStore()

    const getGradientColors = () => {
        switch (accentColor) {
            case 'purple': return ['bg-purple-400 dark:bg-purple-600', 'bg-indigo-400 dark:bg-indigo-600', 'bg-blue-400 dark:bg-blue-600']
            case 'blue': return ['bg-blue-400 dark:bg-blue-600', 'bg-cyan-400 dark:bg-cyan-600', 'bg-teal-400 dark:bg-teal-600']
            case 'green': return ['bg-emerald-400 dark:bg-emerald-600', 'bg-green-400 dark:bg-green-600', 'bg-lime-400 dark:bg-lime-600']
            case 'orange': return ['bg-orange-400 dark:bg-orange-600', 'bg-amber-400 dark:bg-amber-600', 'bg-red-400 dark:bg-red-600']
            case 'pink': return ['bg-pink-400 dark:bg-pink-600', 'bg-rose-400 dark:bg-rose-600', 'bg-purple-400 dark:bg-purple-600']
            case 'red': return ['bg-red-400 dark:bg-red-600', 'bg-orange-400 dark:bg-orange-600', 'bg-rose-400 dark:bg-rose-600']
            case 'yellow': return ['bg-yellow-400 dark:bg-yellow-500', 'bg-amber-400 dark:bg-amber-500', 'bg-orange-400 dark:bg-orange-500']
            case 'cyan': return ['bg-cyan-400 dark:bg-cyan-500', 'bg-blue-400 dark:bg-blue-500', 'bg-teal-400 dark:bg-teal-500']
            default: return ['bg-blue-400 dark:bg-blue-600', 'bg-indigo-400 dark:bg-indigo-600', 'bg-violet-400 dark:bg-violet-600']
        }
    }

    const colors = getGradientColors()

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500">
            <div className="absolute inset-0 bg-white/40 dark:bg-black/40 z-10" /> {/* Dimmer/Lightener */}

            {/* Moving Blobs */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                    x: [-20, 20, -20],
                    y: [-20, 20, -20],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className={cn("absolute top-0 left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen transition-colors duration-500", colors[0])}
            />

            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2],
                    x: [20, -20, 20],
                    y: [20, -20, 20],
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className={cn("absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen transition-colors duration-500", colors[1])}
            />

            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3],
                    x: [0, 30, 0],
                    y: [0, 40, 0],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
                className={cn("absolute bottom-[-10%] left-[20%] w-[60vw] h-[40vw] rounded-full blur-[130px] mix-blend-multiply dark:mix-blend-screen transition-colors duration-500", colors[2])}
            />
        </div>
    )
}

// --- 3D Tilt Card ---
interface TiltCardProps {
    children: React.ReactNode
    className?: string
    glowColor?: string
    onClick?: () => void
}

export function TiltCard({ children, className, glowColor = "rgba(255,255,255,0.1)", onClick }: TiltCardProps) {
    const x = useMotionValue(0)
    const y = useMotionValue(0)

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 })
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 })

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["12deg", "-12deg"])
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-12deg", "12deg"])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const width = rect.width
        const height = rect.height
        const mouseXFromCenter = e.clientX - rect.left - width / 2
        const mouseYFromCenter = e.clientY - rect.top - height / 2
        x.set(mouseXFromCenter / width)
        y.set(mouseYFromCenter / height)
    }

    const handleMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.div
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            className={cn(
                "relative rounded-3xl transition-all duration-200 ease-out group",
                "bg-white dark:bg-white/5 backdrop-blur-xl", // Adaptive Glass
                "border border-zinc-300 dark:border-white/10", // Adaptive Border
                "shadow-[0_4px_20px_rgba(0,0,0,0.15)] dark:shadow-none", // Light mode shadow (강한 그림자)
                "hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]",
                "hover:border-zinc-400 dark:hover:border-white/20",
                className
            )}
        >
            <div
                style={{ transform: "translateZ(50px)" }}
                className="relative z-10 h-full"
            >
                {children}
            </div>

            {/* Glossy Reflection */}
            <div
                className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at 50% 0%, ${glowColor}, transparent 70%)`
                }}
            />
        </motion.div>
    )
}

// --- AI Pulsing Core Widget ---
export function AICoreWidget() {
    const { accentColor } = useThemeStore()

    const getGlowColor = () => {
        switch (accentColor) {
            case 'purple': return 'dark:shadow-[0_0_50px_rgba(168,85,247,0.5)] shadow-[0_0_50px_rgba(168,85,247,0.2)]'
            case 'blue': return 'dark:shadow-[0_0_50px_rgba(59,130,246,0.5)] shadow-[0_0_50px_rgba(59,130,246,0.2)]'
            default: return 'dark:shadow-[0_0_50px_rgba(59,130,246,0.5)] shadow-[0_0_50px_rgba(59,130,246,0.2)]'
        }
    }

    const getRingColor = () => {
        switch (accentColor) {
            case 'purple': return 'border-purple-500'
            case 'blue': return 'border-blue-500'
            default: return 'border-blue-500'
        }
    }

    return (
        <div className="relative flex items-center justify-center w-full h-full min-h-[200px]">
            {/* Core */}
            <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center animate-pulse relative z-10",
                "bg-indigo-50/50 dark:bg-white/10 backdrop-blur-md", // Adaptive core bg
                getGlowColor()
            )}>
                <div className="w-12 h-12 rounded-full bg-white dark:bg-white flex items-center justify-center shadow-lg">
                    <div className="w-8 h-8 rounded-full bg-zinc-900/90" />
                </div>
            </div>

            {/* Rings */}
            {[...Array(3)].map((_, i) => (
                <motion.div
                    key={i}
                    className={cn("absolute rounded-full border-2 opacity-30", getRingColor())}
                    animate={{
                        width: ["100px", "200px"],
                        height: ["100px", "200px"],
                        opacity: [0.5, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.6,
                        ease: "linear"
                    }}
                />
            ))}

            <div className="absolute bottom-4 text-center">
                <p className="text-sm font-light text-zinc-500 dark:text-white/50 tracking-[0.2em] mb-1">AI INSIGHT</p>
                <p className="text-zinc-900 dark:text-white text-lg font-medium">System Online</p>
            </div>
        </div>
    )
}
