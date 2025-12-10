'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import {
  TrendingUp,
  Building2,
  Briefcase,
  Send,
  CheckCircle,
  Clock,
  Eye,
  ArrowRight,
  Target,
  DollarSign,
} from 'lucide-react'

interface DashboardStats {
  totalPipeline: number
  pendingRequests: number
  approvedAccess: number
  newStartups: number
  pipelineByStage: Record<string, number>
}

const QUICK_ACTIONS = [
  {
    title: '스타트업 탐색',
    description: '새로운 투자 기회를 발견하세요',
    href: '/dashboard-group/investor/explore',
    icon: Building2,
    color: 'bg-accent/20 text-accent',
  },
  {
    title: '파이프라인 관리',
    description: '관심 스타트업을 관리하세요',
    href: '/dashboard-group/investor/pipeline',
    icon: Briefcase,
    color: 'bg-accent/20 text-accent',
  },
  {
    title: '접근 요청',
    description: '대기중인 요청을 확인하세요',
    href: '/dashboard-group/investor/requests',
    icon: Send,
    color: 'bg-accent/20 text-accent',
  },
]

export default function InvestorDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPipeline: 0,
    pendingRequests: 0,
    approvedAccess: 0,
    newStartups: 0,
    pipelineByStage: {},
  })

  useEffect(() => {
    // 실제 데이터는 API에서 가져옴
    const fetchStats = async () => {
      try {
        const [pipelineRes, requestsRes] = await Promise.all([
          fetch('/api/investor/pipeline'),
          fetch('/api/investor/access-request'),
        ])

        if (pipelineRes.ok && requestsRes.ok) {
          const pipeline = await pipelineRes.json()
          const requests = await requestsRes.json()

          const pipelineByStage: Record<string, number> = {}
          pipeline.forEach((item: any) => {
            pipelineByStage[item.stage] = (pipelineByStage[item.stage] || 0) + 1
          })

          setStats({
            totalPipeline: pipeline.length,
            pendingRequests: requests.filter((r: any) => r.status === 'PENDING').length,
            approvedAccess: requests.filter((r: any) => r.status === 'APPROVED').length,
            newStartups: 0, // 별도 API 필요
            pipelineByStage,
          })
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-accent" />
          투자자 대시보드
        </h1>
        <p className="text-zinc-500 mt-1">
          투자 파이프라인을 한눈에 관리하세요
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-zinc-500">파이프라인</p>
                  <p className="text-2xl font-bold text-zinc-100">{stats.totalPipeline}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-zinc-500">대기중 요청</p>
                  <p className="text-2xl font-bold text-zinc-100">{stats.pendingRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-zinc-500">승인된 접근</p>
                  <p className="text-2xl font-bold text-zinc-100">{stats.approvedAccess}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Eye className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-zinc-500">열람 가능</p>
                  <p className="text-2xl font-bold text-zinc-100">{stats.approvedAccess}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100">빠른 액션</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUICK_ACTIONS.map((action, index) => (
                <Link key={action.href} href={action.href}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 hover:border-accent/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-zinc-500 group-hover:text-accent transition-colors" />
                    </div>
                    <h3 className="font-semibold text-zinc-100 mb-1">{action.title}</h3>
                    <p className="text-sm text-zinc-500">{action.description}</p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pipeline Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-zinc-100">파이프라인 현황</CardTitle>
              <Link href="/dashboard-group/investor/pipeline" className="text-sm text-accent hover:underline">
                전체 보기 →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.totalPipeline === 0 ? (
              <div className="text-center py-8">
                <Target className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 mb-2">파이프라인이 비어있습니다</p>
                <Link href="/dashboard-group/investor/explore" className="text-accent hover:underline text-sm">
                  스타트업 탐색하기 →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.pipelineByStage).map(([stage, count]) => (
                  <div key={stage} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-zinc-400">{stage}</div>
                    <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${(count / stats.totalPipeline) * 100}%` }}
                      />
                    </div>
                    <div className="w-8 text-sm text-zinc-400 text-right">{count}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
