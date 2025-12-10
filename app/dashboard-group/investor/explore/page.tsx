'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { StartupCard, Startup as StartupCardType } from '@/components/investor'
import {
  Search,
  Filter,
  Building2,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Plus,
  Eye,
  Send,
  CheckCircle,
  XCircle,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react'

type ViewMode = 'cards' | 'grid'

interface Startup {
  id: string
  name: string
  description?: string
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
  accessStatus: 'none' | 'PENDING' | 'APPROVED' | 'REJECTED'
}

const INDUSTRIES = ['전체', 'SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'AI/ML', 'EdTech', 'Entertainment', '기타']
const STAGES = ['전체', 'IDEA', 'MVP', 'EARLY', 'GROWTH', 'SCALE']

const stageColors: Record<string, string> = {
  IDEA: 'bg-zinc-700 text-zinc-300',
  MVP: 'bg-accent/20 text-accent',
  EARLY: 'bg-green-500/20 text-green-400',
  GROWTH: 'bg-orange-500/20 text-orange-400',
  SCALE: 'bg-purple-500/20 text-purple-400',
}

export default function ExplorePage() {
  const [startups, setStartups] = useState<Startup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('전체')
  const [selectedStage, setSelectedStage] = useState('전체')
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const fetchStartups = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (selectedIndustry !== '전체') params.set('industry', selectedIndustry)
      if (selectedStage !== '전체') params.set('stage', selectedStage)

      const res = await fetch(`/api/investor/startups?${params}`)
      if (res.ok) {
        const data = await res.json()
        setStartups(data)
      }
    } catch (error) {
      console.error('Failed to fetch startups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStartups()
  }, [selectedIndustry, selectedStage])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchStartups()
  }

  const handleAccessRequest = async (startupId: string) => {
    setRequestingId(startupId)
    try {
      const res = await fetch('/api/investor/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId }),
      })

      if (res.ok) {
        setStartups(prev =>
          prev.map(s => s.id === startupId ? { ...s, accessStatus: 'PENDING' } : s)
        )
      }
    } catch (error) {
      console.error('Access request failed:', error)
    } finally {
      setRequestingId(null)
    }
  }

  const handleAddToPipeline = async (startupId: string) => {
    try {
      const res = await fetch('/api/investor/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startupId, stage: 'INTERESTED' }),
      })

      if (res.ok) {
        alert('파이프라인에 추가되었습니다!')
      }
    } catch (error) {
      console.error('Add to pipeline failed:', error)
    }
  }

  const formatRevenue = (revenue?: number) => {
    if (!revenue) return '-'
    if (revenue >= 100000000) return `${(revenue / 100000000).toFixed(1)}억`
    if (revenue >= 10000) return `${(revenue / 10000).toFixed(0)}만`
    return revenue.toLocaleString()
  }

  // Convert Startup to StartupCardType
  const convertToCardStartup = (startup: Startup): StartupCardType => ({
    id: startup.id,
    name: startup.name,
    description: startup.description || '',
    industry: [startup.industry],
    stage: startup.stage === 'IDEA' ? '시드' :
           startup.stage === 'MVP' ? '프리시드' :
           startup.stage === 'EARLY' ? '시리즈 A' :
           startup.stage === 'GROWTH' ? '시리즈 B' : '시리즈 C+',
    fundingRaised: formatRevenue(startup.monthly_revenue),
    teamSize: startup.employee_count || 0,
    location: '대한민국',
    foundedDate: new Date().toISOString(),
    metrics: {
      mrr: formatRevenue(startup.monthly_revenue),
      growth: '+15%',
      users: '1.2K',
    },
    matchScore: Math.floor(Math.random() * 30) + 70, // Demo: random match score
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-accent" />
            스타트업 탐색
          </h1>
          <p className="text-zinc-500 mt-1">
            투자 기회를 발견하고 스타트업과 연결하세요
          </p>
        </div>
        <div className="flex bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'cards'
                ? 'bg-accent text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
            title="카드 뷰"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-accent text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
            title="그리드 뷰"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="스타트업 이름 또는 설명으로 검색..."
                className="w-full h-11 pl-10 pr-4 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-accent"
              />
            </div>
            <Button type="submit">검색</Button>
          </form>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">필터:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map(industry => (
                <button
                  key={industry}
                  onClick={() => setSelectedIndustry(industry)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedIndustry === industry
                      ? 'bg-accent text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {industry}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {STAGES.map(stage => (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(stage)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedStage === stage
                      ? 'bg-accent text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : startups.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="py-16 text-center">
            <Building2 className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-300 mb-2">
              검색 결과가 없습니다
            </h3>
            <p className="text-zinc-500">
              다른 키워드나 필터로 검색해보세요
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        /* New StartupCard Component View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {startups.map((startup) => (
            <StartupCard
              key={startup.id}
              startup={convertToCardStartup(startup)}
              variant="default"
              onFavorite={(id) => console.log('Favorited:', id)}
              onClick={(s) => console.log('Clicked:', s)}
            />
          ))}
        </div>
      ) : (
        /* Original Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {startups.map((startup, index) => (
            <motion.div
              key={startup.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                        {startup.logo_url ? (
                          <img src={startup.logo_url} alt={startup.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <Building2 className="w-6 h-6 text-zinc-500" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg text-zinc-100">{startup.name}</CardTitle>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs ${stageColors[startup.stage] || stageColors.IDEA}`}>
                          {startup.stage}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-zinc-400 line-clamp-2">
                    {startup.description || '설명이 없습니다'}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="px-2 py-1 bg-zinc-800 rounded">{startup.industry}</span>
                    {startup.founder?.name && (
                      <span className="px-2 py-1 bg-zinc-800 rounded">{startup.founder.name}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-zinc-800">
                    <div className="text-center">
                      <DollarSign className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <span className="text-sm font-medium text-zinc-200">
                        {formatRevenue(startup.monthly_revenue)}
                      </span>
                      <span className="block text-xs text-zinc-500">월매출</span>
                    </div>
                    <div className="text-center">
                      <Clock className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <span className="text-sm font-medium text-zinc-200">
                        {startup.runway_months || '-'}개월
                      </span>
                      <span className="block text-xs text-zinc-500">런웨이</span>
                    </div>
                    <div className="text-center">
                      <Users className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                      <span className="text-sm font-medium text-zinc-200">
                        {startup.employee_count || '-'}명
                      </span>
                      <span className="block text-xs text-zinc-500">팀원</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {startup.accessStatus === 'none' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleAccessRequest(startup.id)}
                        disabled={requestingId === startup.id}
                      >
                        {requestingId === startup.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-1" />
                            열람 요청
                          </>
                        )}
                      </Button>
                    )}
                    {startup.accessStatus === 'PENDING' && (
                      <Button size="sm" variant="outline" className="flex-1" disabled>
                        <Clock className="w-4 h-4 mr-1" />
                        승인 대기중
                      </Button>
                    )}
                    {startup.accessStatus === 'APPROVED' && (
                      <Button size="sm" variant="outline" className="flex-1 text-green-400 border-green-500/30">
                        <Eye className="w-4 h-4 mr-1" />
                        상세 보기
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleAddToPipeline(startup.id)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
