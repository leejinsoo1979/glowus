'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { InvestorPipeline } from '@/components/investor'
import {
  Briefcase,
  Building2,
  ChevronRight,
  DollarSign,
  Clock,
  Users,
  MoreVertical,
  Trash2,
  MessageSquare,
  Loader2,
  Kanban,
  List,
} from 'lucide-react'

type ViewMode = 'dnd' | 'simple'

interface PipelineItem {
  id: string
  stage: string
  notes?: string
  created_at: string
  updated_at: string
  startup: {
    id: string
    name: string
    industry: string
    stage: string
    logo_url?: string
    monthly_revenue?: number
    runway_months?: number
    employee_count?: number
    founder?: {
      name: string
      email: string
    }
  }
}

const PIPELINE_STAGES = [
  { key: 'INTERESTED', label: '관심', color: 'bg-zinc-700' },
  { key: 'CONTACTED', label: '컨택', color: 'bg-accent/30' },
  { key: 'MEETING', label: '미팅', color: 'bg-yellow-500/30' },
  { key: 'DUE_DILIGENCE', label: 'DD', color: 'bg-orange-500/30' },
  { key: 'NEGOTIATION', label: '협상', color: 'bg-purple-500/30' },
  { key: 'INVESTED', label: '투자', color: 'bg-green-500/30' },
  { key: 'PASSED', label: '패스', color: 'bg-red-500/30' },
]

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('dnd')

  const fetchPipeline = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/investor/pipeline')
      if (res.ok) {
        const data = await res.json()
        setPipeline(data)
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPipeline()
  }, [])

  const updateStage = async (pipelineId: string, newStage: string) => {
    try {
      const res = await fetch('/api/investor/pipeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId, stage: newStage }),
      })

      if (res.ok) {
        setPipeline(prev =>
          prev.map(item =>
            item.id === pipelineId ? { ...item, stage: newStage } : item
          )
        )
      }
    } catch (error) {
      console.error('Update stage failed:', error)
    }
  }

  const getItemsByStage = (stage: string) => {
    return pipeline.filter(item => item.stage === stage)
  }

  const formatRevenue = (revenue?: number) => {
    if (!revenue) return '-'
    if (revenue >= 100000000) return `${(revenue / 100000000).toFixed(1)}억`
    if (revenue >= 10000) return `${(revenue / 10000).toFixed(0)}만`
    return revenue.toLocaleString()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-accent" />
            투자 파이프라인
          </h1>
          <p className="text-zinc-500 mt-1">
            관심 스타트업을 단계별로 관리하세요
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('dnd')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'dnd'
                  ? 'bg-accent text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
              title="드래그앤드롭 뷰"
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('simple')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'simple'
                  ? 'bg-accent text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
              title="심플 뷰"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-zinc-400">
            총 {pipeline.length}개 스타트업
          </div>
        </div>
      </div>

      {/* Pipeline View */}
      {viewMode === 'dnd' ? (
        /* New Drag & Drop InvestorPipeline Component */
        <InvestorPipeline
          onInvestorMove={(investorId, fromStage, toStage) => {
            console.log('Investor moved:', investorId, fromStage, '->', toStage)
          }}
        />
      ) : (
        <>
          {/* Simple Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const items = getItemsByStage(stage.key)
              return (
                <div key={stage.key} className="flex-shrink-0 w-80">
                  <div className={`${stage.color} rounded-t-xl px-4 py-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-zinc-100">{stage.label}</h3>
                      <span className="text-sm text-zinc-400">{items.length}</span>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-b-xl min-h-[500px] p-2 space-y-2">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 cursor-pointer hover:border-zinc-600 transition-colors"
                        onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center">
                              {item.startup.logo_url ? (
                                <img src={item.startup.logo_url} alt="" className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <Building2 className="w-4 h-4 text-zinc-500" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-zinc-100 text-sm">
                                {item.startup.name}
                              </h4>
                              <span className="text-xs text-zinc-500">{item.startup.industry}</span>
                            </div>
                          </div>
                          <button className="p-1 hover:bg-zinc-700 rounded">
                            <MoreVertical className="w-4 h-4 text-zinc-500" />
                          </button>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-400">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatRevenue(item.startup.monthly_revenue)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.startup.runway_months || '-'}개월
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {item.startup.employee_count || '-'}명
                          </div>
                        </div>

                        {selectedItem === item.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 pt-3 border-t border-zinc-700"
                          >
                            <p className="text-xs text-zinc-400 mb-2">스테이지 변경:</p>
                            <div className="flex flex-wrap gap-1">
                              {PIPELINE_STAGES.filter(s => s.key !== stage.key).map(s => (
                                <button
                                  key={s.key}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updateStage(item.id, s.key)
                                  }}
                                  className={`${s.color} px-2 py-1 rounded text-xs text-zinc-200 hover:opacity-80`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                            {item.notes && (
                              <div className="mt-2 flex items-start gap-1 text-xs text-zinc-400">
                                <MessageSquare className="w-3 h-3 mt-0.5" />
                                <span>{item.notes}</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    ))}

                    {items.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                        <Building2 className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-sm">비어있음</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stats */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-100">파이프라인 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {PIPELINE_STAGES.map(stage => {
                  const count = getItemsByStage(stage.key).length
                  const percentage = pipeline.length > 0
                    ? Math.round((count / pipeline.length) * 100)
                    : 0
                  return (
                    <div key={stage.key} className="text-center">
                      <div className={`w-full h-2 ${stage.color} rounded-full mb-2`}>
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-2xl font-bold text-zinc-100">{count}</span>
                      <span className="block text-xs text-zinc-500">{stage.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
