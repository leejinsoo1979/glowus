"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import {
  Building2,
  Users,
  TrendingUp,
  Calendar,
  MapPin,
  Globe,
  DollarSign,
  Heart,
  HeartOff,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart3,
  Target,
} from "lucide-react"

export interface Startup {
  id: string
  name: string
  logo?: string
  description: string
  industry: string[]
  stage: string
  fundingRaised?: string
  targetFunding?: string
  teamSize: number
  location: string
  website?: string
  foundedDate: string
  metrics?: {
    mrr?: string
    growth?: string
    users?: string
  }
  tags?: string[]
  isFavorite?: boolean
  matchScore?: number
}

interface StartupCardProps {
  startup: Startup
  onFavorite?: (id: string) => void
  onClick?: (startup: Startup) => void
  variant?: "default" | "compact" | "featured"
}

const stageColors: Record<string, string> = {
  "시드": "#71717a",
  "프리시드": "#6b7280",
  "시리즈 A": "var(--accent-color)",
  "시리즈 B": "#8b5cf6",
  "시리즈 C+": "#22c55e",
}

export function StartupCard({
  startup,
  onFavorite,
  onClick,
  variant = "default",
}: StartupCardProps) {
  const [mounted, setMounted] = useState(false)
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  const accentColorValue = mounted ? currentAccent.color : "var(--accent-color)"
  const stageColor = stageColors[startup.stage] || "#71717a"

  if (variant === "compact") {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="cursor-pointer"
        onClick={() => onClick?.(startup)}
      >
        <Card className="bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                style={{ backgroundColor: accentColorValue }}
              >
                {startup.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-zinc-100 truncate">
                    {startup.name}
                  </h4>
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: `${stageColor}20`,
                      color: stageColor,
                    }}
                  >
                    {startup.stage}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 truncate">{startup.description}</p>
              </div>

              {/* Match Score */}
              {startup.matchScore && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400">
                  <Sparkles className="h-3 w-3" />
                  <span className="text-sm font-medium">{startup.matchScore}%</span>
                </div>
              )}

              <ChevronRight className="h-5 w-5 text-zinc-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (variant === "featured") {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        className="cursor-pointer"
        onClick={() => onClick?.(startup)}
      >
        <Card className="bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700 hover:border-zinc-600 transition-all overflow-hidden">
          {/* Featured Badge */}
          <div
            className="h-1"
            style={{ backgroundColor: accentColorValue }}
          />

          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
                  style={{ backgroundColor: accentColorValue }}
                >
                  {startup.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-zinc-100">{startup.name}</h3>
                    {startup.matchScore && startup.matchScore >= 80 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        <Sparkles className="h-3 w-3" />
                        추천
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-xs font-medium rounded-full"
                      style={{
                        backgroundColor: `${stageColor}20`,
                        color: stageColor,
                      }}
                    >
                      {startup.stage}
                    </span>
                    <span className="text-sm text-zinc-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {startup.location}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-zinc-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  onFavorite?.(startup.id)
                }}
              >
                {startup.isFavorite ? (
                  <Heart className="h-5 w-5 fill-red-500 text-red-500" />
                ) : (
                  <HeartOff className="h-5 w-5 text-zinc-500" />
                )}
              </button>
            </div>

            <p className="text-zinc-400 mb-4 line-clamp-2">{startup.description}</p>

            {/* Industries */}
            <div className="flex flex-wrap gap-2 mb-4">
              {startup.industry.map((ind) => (
                <span
                  key={ind}
                  className="px-2 py-1 text-xs rounded-full"
                  style={{
                    backgroundColor: `${accentColorValue}20`,
                    color: accentColorValue,
                  }}
                >
                  {ind}
                </span>
              ))}
            </div>

            {/* Metrics */}
            {startup.metrics && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-zinc-800/50 rounded-xl">
                {startup.metrics.mrr && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-100">{startup.metrics.mrr}</p>
                    <p className="text-xs text-zinc-500">MRR</p>
                  </div>
                )}
                {startup.metrics.growth && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-400">{startup.metrics.growth}</p>
                    <p className="text-xs text-zinc-500">성장률</p>
                  </div>
                )}
                {startup.metrics.users && (
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-100">{startup.metrics.users}</p>
                    <p className="text-xs text-zinc-500">사용자</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {startup.teamSize}명
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {startup.targetFunding || startup.fundingRaised || "미공개"}
                </span>
              </div>
              <Button
                size="sm"
                className="gap-1"
                style={{ backgroundColor: accentColorValue }}
              >
                상세 보기
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Default variant
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="cursor-pointer"
      onClick={() => onClick?.(startup)}
    >
      <Card className="bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: accentColorValue }}
              >
                {startup.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-semibold text-zinc-100">{startup.name}</h4>
                <span
                  className="px-2 py-0.5 text-xs font-medium rounded-full inline-block mt-1"
                  style={{
                    backgroundColor: `${stageColor}20`,
                    color: stageColor,
                  }}
                >
                  {startup.stage}
                </span>
              </div>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onFavorite?.(startup.id)
              }}
            >
              {startup.isFavorite ? (
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              ) : (
                <HeartOff className="h-4 w-4 text-zinc-500" />
              )}
            </button>
          </div>

          <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{startup.description}</p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {startup.industry.slice(0, 3).map((ind) => (
              <span
                key={ind}
                className="px-2 py-0.5 text-xs rounded-full"
                style={{
                  backgroundColor: `${accentColorValue}20`,
                  color: accentColorValue,
                }}
              >
                {ind}
              </span>
            ))}
          </div>

          {/* Info Row */}
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {startup.location}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {startup.teamSize}명
              </span>
            </div>
            {startup.matchScore && (
              <div className="flex items-center gap-1 text-green-400">
                <Target className="h-3 w-3" />
                <span className="font-medium">{startup.matchScore}% 매칭</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
