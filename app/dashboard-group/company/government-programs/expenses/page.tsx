'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, Plus, Calendar, Receipt, CreditCard,
  Check, X, Clock, Upload, Trash2
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Expense {
  id: string
  expense_date: string
  description: string
  amount: number
  vendor: string | null
  payment_method: string | null
  receipt_file_url: string | null
  status: string
  budget?: {
    id: string
    name: string
    category: string
  }
  contract?: {
    id: string
    contract_name: string
  }
}

interface Contract {
  id: string
  contract_name: string
}

interface Budget {
  id: string
  name: string
  category: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '검토대기', color: '#f59e0b', bgColor: '#451a03' },
  approved: { label: '승인', color: '#10b981', bgColor: '#064e3b' },
  rejected: { label: '반려', color: '#ef4444', bgColor: '#450a0a' },
}

const PAYMENT_METHODS = [
  { value: 'card', label: '법인카드' },
  { value: 'transfer', label: '계좌이체' },
  { value: 'cash', label: '현금' },
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    contract_id: '',
    budget_id: '',
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    vendor: '',
    payment_method: 'card'
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchContracts()
  }, [])

  useEffect(() => {
    if (selectedContract) {
      fetchExpenses()
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

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/government-programs/expenses?contract_id=${selectedContract}`)
      const data = await res.json()
      setExpenses(data.expenses || [])
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBudgets = async () => {
    try {
      const res = await fetch(`/api/government-programs/budgets?contract_id=${selectedContract}`)
      const data = await res.json()
      setBudgets(data.budgets || [])
    } catch (error) {
      console.error('Failed to fetch budgets:', error)
    }
  }

  const createExpense = async () => {
    if (!formData.contract_id || !formData.description || !formData.amount) return

    try {
      const res = await fetch('/api/government-programs/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()
      if (data.expense) {
        await fetchExpenses()
        setShowForm(false)
        setFormData({
          contract_id: selectedContract,
          budget_id: '',
          expense_date: new Date().toISOString().split('T')[0],
          description: '',
          amount: 0,
          vendor: '',
          payment_method: 'card'
        })
      }
    } catch (error) {
      console.error('Failed to create expense:', error)
    }
  }

  const deleteExpense = async (id: string) => {
    try {
      await fetch(`/api/government-programs/expenses?id=${id}`, { method: 'DELETE' })
      setExpenses(expenses.filter(e => e.id !== id))
    } catch (error) {
      console.error('Failed to delete expense:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const totalByStatus = (status: string) => {
    return expenses
      .filter(e => e.status === status)
      .reduce((sum, e) => sum + e.amount, 0)
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
            <DollarSign className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">지출 내역</h1>
            <p className="text-sm text-zinc-400">과제 지출 내역을 관리합니다</p>
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
            지출 등록
          </button>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, config], index) => (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: config.bgColor, color: config.color }}
              >
                {config.label}
              </span>
              <span className="text-zinc-400">
                {expenses.filter(e => e.status === status).length}건
              </span>
            </div>
            <div className="text-2xl font-bold" style={{ color: config.color }}>
              {formatCurrency(totalByStatus(status))}
            </div>
          </motion.div>
        ))}
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">지출 등록</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">지출일</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">예산항목</label>
              <select
                value={formData.budget_id}
                onChange={e => setFormData({ ...formData, budget_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                <option value="">항목 선택</option>
                {budgets.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">결제수단</label>
              <select
                value={formData.payment_method}
                onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">적요</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="지출 내용"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">거래처</label>
              <input
                type="text"
                value={formData.vendor}
                onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="거래처명"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">금액</label>
            <input
              type="number"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
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
              onClick={createExpense}
              disabled={!formData.description || !formData.amount}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              등록
            </button>
          </div>
        </motion.div>
      )}

      {/* 지출 목록 */}
      {expenses.length > 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">날짜</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">적요</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">거래처</th>
                <th className="text-left px-5 py-3 text-sm font-medium text-zinc-400">예산항목</th>
                <th className="text-right px-5 py-3 text-sm font-medium text-zinc-400">금액</th>
                <th className="text-center px-5 py-3 text-sm font-medium text-zinc-400">상태</th>
                <th className="text-center px-5 py-3 text-sm font-medium text-zinc-400">증빙</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(expense => {
                const statusConfig = STATUS_CONFIG[expense.status] || STATUS_CONFIG.pending

                return (
                  <tr key={expense.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                    <td className="px-5 py-4 text-zinc-400">{expense.expense_date}</td>
                    <td className="px-5 py-4 text-white">{expense.description}</td>
                    <td className="px-5 py-4 text-zinc-400">{expense.vendor || '-'}</td>
                    <td className="px-5 py-4 text-zinc-400">
                      {expense.budget?.name || '-'}
                    </td>
                    <td className="px-5 py-4 text-right font-medium" style={{ color: themeColor }}>
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {expense.receipt_file_url ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-zinc-600 mx-auto" />
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 text-zinc-400">
          <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>등록된 지출 내역이 없습니다</p>
        </div>
      )}
    </div>
  )
}
