'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Plus, Wallet, TrendingUp, ArrowRight,
  DollarSign, Package, Users, Truck, Briefcase
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Budget {
  id: string
  category: string
  subcategory: string | null
  name: string
  planned_amount: number
  executed_amount: number
  notes: string | null
}

interface BudgetSummary {
  byCategory: Record<string, { planned: number; executed: number }>
  total: {
    planned: number
    executed: number
    remaining: number
    executionRate: string | number
  }
}

interface Contract {
  id: string
  contract_name: string
  total_amount: number
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  personnel: { label: '인건비', icon: Users, color: '#3b82f6' },
  equipment: { label: '장비비', icon: Package, color: '#10b981' },
  materials: { label: '재료비', icon: Briefcase, color: '#f59e0b' },
  outsourcing: { label: '외주비', icon: Truck, color: '#8b5cf6' },
  travel: { label: '여비', icon: Truck, color: '#ec4899' },
  other: { label: '기타', icon: DollarSign, color: '#6b7280' },
}

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    contract_id: '',
    category: 'personnel',
    name: '',
    planned_amount: 0
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchContracts()
  }, [])

  useEffect(() => {
    if (selectedContract) {
      fetchBudgets()
    }
  }, [selectedContract])

  const fetchContracts = async () => {
    try {
      const res = await fetch('/api/government-programs/contracts')
      const data = await res.json()
      setContracts(data.contracts || [])
      if (data.contracts?.length > 0) {
        setSelectedContract(data.contracts[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    }
  }

  const fetchBudgets = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/government-programs/budgets?contract_id=${selectedContract}`)
      const data = await res.json()
      setBudgets(data.budgets || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error('Failed to fetch budgets:', error)
    } finally {
      setLoading(false)
    }
  }

  const createBudget = async () => {
    if (!formData.contract_id || !formData.name || !formData.planned_amount) return

    try {
      const res = await fetch('/api/government-programs/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.budget) {
        await fetchBudgets()
        setShowForm(false)
        setFormData({
          contract_id: selectedContract,
          category: 'personnel',
          name: '',
          planned_amount: 0
        })
      }
    } catch (error) {
      console.error('Failed to create budget:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  if (loading && !contracts.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: themeColor }} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}20` }}>
            <PieChart className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">예산 현황</h1>
            <p className="text-sm text-zinc-400">과제별 예산 집행 현황을 관리합니다</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedContract}
            onChange={e => setSelectedContract(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
          >
            {contracts.map(c => (
              <option key={c.id} value={c.id}>{c.contract_name}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setFormData({ ...formData, contract_id: selectedContract })
              setShowForm(!showForm)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: themeColor, color: 'white' }}
          >
            <Plus className="w-4 h-4" />
            예산항목 추가
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">총 예산</span>
              <Wallet className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(summary.total.planned)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">집행액</span>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {formatCurrency(summary.total.executed)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">잔액</span>
              <Wallet className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {formatCurrency(summary.total.remaining)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-zinc-400">집행률</span>
              <TrendingUp className="w-5 h-5" style={{ color: themeColor }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: themeColor }}>
              {summary.total.executionRate}%
            </div>
            <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${summary.total.executionRate}%`,
                  backgroundColor: themeColor
                }}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* 카테고리별 현황 */}
      {summary?.byCategory && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(summary.byCategory).map(([category, data], index) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
            const rate = data.planned > 0 ? ((data.executed / data.planned) * 100).toFixed(1) : 0

            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <config.icon className="w-4 h-4" style={{ color: config.color }} />
                  </div>
                  <span className="font-medium text-white">{config.label}</span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">계획</span>
                    <span className="text-white">{formatCurrency(data.planned)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">집행</span>
                    <span style={{ color: config.color }}>{formatCurrency(data.executed)}</span>
                  </div>
                </div>

                <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${rate}%`, backgroundColor: config.color }}
                  />
                </div>
                <div className="text-right text-xs text-zinc-500 mt-1">{rate}%</div>
              </motion.div>
            )
          })}
        </div>
      )}

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">새 예산항목 추가</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">비목</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">계획 금액</label>
              <input
                type="number"
                value={formData.planned_amount}
                onChange={e => setFormData({ ...formData, planned_amount: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">항목명</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="예: 연구원 인건비"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createBudget}
              disabled={!formData.name || !formData.planned_amount}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              추가
            </button>
          </div>
        </motion.div>
      )}

      {/* 예산 항목 목록 */}
      {budgets.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">비목</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">항목</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-zinc-400">계획</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-zinc-400">집행</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-zinc-400">잔액</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-zinc-400">집행률</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map(budget => {
                const remaining = budget.planned_amount - budget.executed_amount
                const rate = budget.planned_amount > 0
                  ? ((budget.executed_amount / budget.planned_amount) * 100).toFixed(1)
                  : 0
                const config = CATEGORY_CONFIG[budget.category] || CATEGORY_CONFIG.other

                return (
                  <tr key={budget.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-zinc-400">{config.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white">{budget.name}</td>
                    <td className="px-5 py-4 text-right text-white">
                      {formatCurrency(budget.planned_amount)}
                    </td>
                    <td className="px-5 py-4 text-right" style={{ color: config.color }}>
                      {formatCurrency(budget.executed_amount)}
                    </td>
                    <td className={`px-5 py-4 text-right ${remaining < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                      {formatCurrency(remaining)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-zinc-400">{rate}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {budgets.length === 0 && !loading && (
        <div className="text-center py-16 text-zinc-400">
          <PieChart className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>예산 항목이 없습니다</p>
        </div>
      )}
    </div>
  )
}
