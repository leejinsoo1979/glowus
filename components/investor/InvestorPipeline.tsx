"use client"

import { useState, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { motion, AnimatePresence } from "framer-motion"
import { useThemeStore, accentColors } from "@/stores/themeStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
  Building2,
  DollarSign,
  Users,
  Calendar,
  Mail,
  Phone,
  Globe,
  Plus,
  Filter,
  Search,
  MoreHorizontal,
  ChevronRight,
  Star,
  StarOff,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  Briefcase,
} from "lucide-react"

export interface Investor {
  id: string
  name: string
  company: string
  email?: string
  phone?: string
  website?: string
  investmentStage: string[]
  focusAreas: string[]
  portfolioSize?: number
  avgCheckSize?: string
  lastContact?: Date
  notes?: string
  starred?: boolean
  stageId: string
}

export interface PipelineStage {
  id: string
  title: string
  color: string
  investors: Investor[]
}

interface InvestorPipelineProps {
  stages?: PipelineStage[]
  onInvestorMove?: (investorId: string, fromStage: string, toStage: string) => void
  onInvestorUpdate?: (investor: Investor) => void
}

const defaultStages: PipelineStage[] = [
  {
    id: "research",
    title: "리서치",
    color: "#71717a",
    investors: [
      {
        id: "inv-1",
        name: "김투자",
        company: "블루벤처스",
        email: "kim@bluevc.com",
        website: "https://bluevc.com",
        investmentStage: ["시드", "시리즈 A"],
        focusAreas: ["SaaS", "AI"],
        portfolioSize: 45,
        avgCheckSize: "5-10억",
        starred: true,
        stageId: "research",
      },
      {
        id: "inv-2",
        name: "박벤처",
        company: "퓨처파트너스",
        email: "park@future.vc",
        investmentStage: ["시리즈 A", "시리즈 B"],
        focusAreas: ["핀테크", "커머스"],
        portfolioSize: 32,
        avgCheckSize: "10-30억",
        stageId: "research",
      },
    ],
  },
  {
    id: "contacted",
    title: "컨택",
    color: "var(--accent-color)",
    investors: [
      {
        id: "inv-3",
        name: "이캐피탈",
        company: "스타트업캐피탈",
        email: "lee@startupvc.com",
        phone: "010-1234-5678",
        investmentStage: ["시드"],
        focusAreas: ["B2B", "SaaS"],
        lastContact: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        avgCheckSize: "1-5억",
        stageId: "contacted",
      },
    ],
  },
  {
    id: "meeting",
    title: "미팅 예정",
    color: "#f59e0b",
    investors: [
      {
        id: "inv-4",
        name: "최인베스트",
        company: "그로스벤처스",
        email: "choi@growth.vc",
        investmentStage: ["시리즈 A"],
        focusAreas: ["마켓플레이스", "SaaS"],
        portfolioSize: 28,
        avgCheckSize: "10-20억",
        lastContact: new Date(Date.now() - 1000 * 60 * 60 * 24),
        starred: true,
        stageId: "meeting",
      },
    ],
  },
  {
    id: "negotiation",
    title: "협상 중",
    color: "#8b5cf6",
    investors: [],
  },
  {
    id: "closed",
    title: "투자 완료",
    color: "#22c55e",
    investors: [],
  },
]

// Investor Card Component
function InvestorCard({
  investor,
  accentColor,
  isDragging = false,
}: {
  investor: Investor
  accentColor: string
  isDragging?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: investor.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const formatLastContact = (date?: Date) => {
    if (!date) return null
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return "오늘"
    if (days === 1) return "어제"
    return `${days}일 전`
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group bg-zinc-800 rounded-lg border border-zinc-700 p-4 cursor-grab active:cursor-grabbing transition-all duration-200 hover:border-zinc-600 ${
        isDragging || isSortableDragging
          ? "opacity-90 shadow-2xl scale-105 rotate-1 z-50"
          : "hover:shadow-lg"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: accentColor }}
          >
            {investor.company.charAt(0)}
          </div>
          <div>
            <h4 className="font-semibold text-zinc-100 text-sm">{investor.company}</h4>
            <p className="text-xs text-zinc-400">{investor.name}</p>
          </div>
        </div>
        <button
          className="p-1 text-zinc-500 hover:text-yellow-400 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {investor.starred ? (
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ) : (
            <StarOff className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Focus Areas */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {investor.focusAreas.slice(0, 3).map((area) => (
          <span
            key={area}
            className="px-2 py-0.5 text-xs rounded-full"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
            }}
          >
            {area}
          </span>
        ))}
      </div>

      {/* Info */}
      <div className="space-y-2 text-xs text-zinc-400">
        {investor.avgCheckSize && (
          <div className="flex items-center gap-2">
            <DollarSign className="h-3 w-3" />
            <span>투자 규모: {investor.avgCheckSize}</span>
          </div>
        )}
        {investor.investmentStage.length > 0 && (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3" />
            <span>{investor.investmentStage.join(", ")}</span>
          </div>
        )}
        {investor.portfolioSize && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3 w-3" />
            <span>포트폴리오: {investor.portfolioSize}개사</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-700">
        <div className="flex items-center gap-2">
          {investor.email && (
            <button
              className="p-1.5 bg-zinc-700 rounded hover:bg-zinc-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-3 w-3 text-zinc-400" />
            </button>
          )}
          {investor.website && (
            <button
              className="p-1.5 bg-zinc-700 rounded hover:bg-zinc-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-3 w-3 text-zinc-400" />
            </button>
          )}
          <button
            className="p-1.5 bg-zinc-700 rounded hover:bg-zinc-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className="h-3 w-3 text-zinc-400" />
          </button>
        </div>
        {investor.lastContact && (
          <span className="text-xs text-zinc-500">
            {formatLastContact(investor.lastContact)}
          </span>
        )}
      </div>
    </div>
  )
}

// Pipeline Column Component
function PipelineColumn({
  stage,
  children,
  accentColor,
}: {
  stage: PipelineStage
  children: React.ReactNode
  accentColor: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col bg-zinc-900/50 rounded-xl border transition-all duration-200 ${
        isOver ? "border-zinc-600 bg-zinc-800/50" : "border-zinc-800"
      }`}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold text-zinc-100">{stage.title}</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-800 text-zinc-400">
              {stage.investors.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Column Content */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px] max-h-[calc(100vh-350px)]">
        {children}
        {stage.investors.length === 0 && (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-zinc-700 rounded-lg">
            <p className="text-sm text-zinc-500">투자자를 여기로 이동</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function InvestorPipeline({
  stages = defaultStages,
  onInvestorMove,
  onInvestorUpdate,
}: InvestorPipelineProps) {
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(stages)
  const [activeInvestor, setActiveInvestor] = useState<Investor | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mounted, setMounted] = useState(false)
  const { accentColor } = useThemeStore()
  const currentAccent = accentColors.find((c) => c.id === accentColor) || accentColors[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  const accentColorValue = mounted ? currentAccent.color : "var(--accent-color)"

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const findStage = (investorId: string) => {
    return pipelineStages.find((stage) =>
      stage.investors.some((inv) => inv.id === investorId)
    )
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const stage = findStage(active.id as string)
    if (stage) {
      const investor = stage.investors.find((inv) => inv.id === active.id)
      if (investor) setActiveInvestor(investor)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeStage = findStage(activeId)
    const overStage =
      pipelineStages.find((s) => s.id === overId) || findStage(overId)

    if (!activeStage || !overStage || activeStage.id === overStage.id) return

    setPipelineStages((prev) => {
      const activeInvestorIndex = activeStage.investors.findIndex(
        (inv) => inv.id === activeId
      )
      const activeInvestorItem = {
        ...activeStage.investors[activeInvestorIndex],
        stageId: overStage.id,
      }

      return prev.map((stage) => {
        if (stage.id === activeStage.id) {
          return {
            ...stage,
            investors: stage.investors.filter((inv) => inv.id !== activeId),
          }
        }
        if (stage.id === overStage.id) {
          const overInvestorIndex = stage.investors.findIndex(
            (inv) => inv.id === overId
          )
          const newInvestors = [...stage.investors]
          if (overInvestorIndex >= 0) {
            newInvestors.splice(overInvestorIndex, 0, activeInvestorItem)
          } else {
            newInvestors.push(activeInvestorItem)
          }
          return { ...stage, investors: newInvestors }
        }
        return stage
      })
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveInvestor(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeStage = findStage(activeId)
    const overStage =
      pipelineStages.find((s) => s.id === overId) || findStage(overId)

    if (!activeStage || !overStage) return

    if (activeStage.id === overStage.id) {
      const oldIndex = activeStage.investors.findIndex((inv) => inv.id === activeId)
      const newIndex = activeStage.investors.findIndex((inv) => inv.id === overId)

      if (oldIndex !== newIndex) {
        setPipelineStages((prev) =>
          prev.map((stage) => {
            if (stage.id === activeStage.id) {
              return {
                ...stage,
                investors: arrayMove(stage.investors, oldIndex, newIndex),
              }
            }
            return stage
          })
        )
      }
    }

    if (onInvestorMove && activeStage.id !== overStage.id) {
      onInvestorMove(activeId, activeStage.id, overStage.id)
    }
  }

  // Filter stages based on search
  const filteredStages = pipelineStages.map((stage) => ({
    ...stage,
    investors: stage.investors.filter(
      (inv) =>
        inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.focusAreas.some((area) =>
          area.toLowerCase().includes(searchQuery.toLowerCase())
        )
    ),
  }))

  const totalInvestors = pipelineStages.reduce(
    (acc, stage) => acc + stage.investors.length,
    0
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl"
            style={{ backgroundColor: `${accentColorValue}20` }}
          >
            <Building2 className="h-5 w-5" style={{ color: accentColorValue }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">투자자 파이프라인</h2>
            <p className="text-sm text-zinc-500">총 {totalInvestors}명의 투자자</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="투자자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 bg-zinc-800 border-zinc-700 text-zinc-100"
            />
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100">
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            className="gap-2"
            style={{ backgroundColor: accentColorValue }}
          >
            <Plus className="h-4 w-4" />
            투자자 추가
          </Button>
        </div>
      </div>

      {/* Pipeline Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {filteredStages.map((stage) => (
            <PipelineColumn key={stage.id} stage={stage} accentColor={accentColorValue}>
              <SortableContext
                items={stage.investors.map((inv) => inv.id)}
                strategy={verticalListSortingStrategy}
              >
                {stage.investors.map((investor) => (
                  <InvestorCard
                    key={investor.id}
                    investor={investor}
                    accentColor={accentColorValue}
                  />
                ))}
              </SortableContext>
            </PipelineColumn>
          ))}
        </div>

        <DragOverlay>
          {activeInvestor ? (
            <InvestorCard
              investor={activeInvestor}
              accentColor={accentColorValue}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
