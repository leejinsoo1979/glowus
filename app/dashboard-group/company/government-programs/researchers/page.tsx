'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Plus, Trash2, Mail, Phone, Building2,
  Award, GraduationCap, Briefcase
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'

interface Researcher {
  id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  department: string | null
  position: string | null
  specialization: string | null
  education: string | null
  career_years: number | null
  is_active: boolean
  contract?: {
    id: string
    contract_name: string
  }
}

const ROLES = [
  { value: 'lead', label: '연구책임자' },
  { value: 'co_lead', label: '공동연구책임자' },
  { value: 'researcher', label: '연구원' },
  { value: 'assistant', label: '연구보조원' },
  { value: 'external', label: '외부연구원' },
]

const ROLE_COLORS: Record<string, { color: string; bgColor: string }> = {
  lead: { color: '#f59e0b', bgColor: '#451a03' },
  co_lead: { color: '#3b82f6', bgColor: '#1e3a5f' },
  researcher: { color: '#10b981', bgColor: '#064e3b' },
  assistant: { color: '#8b5cf6', bgColor: '#3b0764' },
  external: { color: '#71717a', bgColor: '#27272a' },
}

export default function ResearchersPage() {
  const [researchers, setResearchers] = useState<Researcher[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    role: 'researcher',
    email: '',
    phone: '',
    department: '',
    position: '',
    specialization: '',
    education: '',
    career_years: 0,
    contract_id: ''
  })
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchContracts()
  }, [])

  useEffect(() => {
    if (selectedContract) {
      fetchResearchers()
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

  const fetchResearchers = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/government-programs/researchers?contract_id=${selectedContract}`)
      const data = await res.json()
      setResearchers(data.researchers || [])
    } catch (error) {
      console.error('Failed to fetch researchers:', error)
    } finally {
      setLoading(false)
    }
  }

  const createResearcher = async () => {
    if (!formData.name) return

    try {
      const res = await fetch('/api/government-programs/researchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          contract_id: selectedContract
        })
      })
      const data = await res.json()
      if (data.researcher) {
        await fetchResearchers()
        setShowForm(false)
        setFormData({
          name: '',
          role: 'researcher',
          email: '',
          phone: '',
          department: '',
          position: '',
          specialization: '',
          education: '',
          career_years: 0,
          contract_id: ''
        })
      }
    } catch (error) {
      console.error('Failed to create researcher:', error)
    }
  }

  const deleteResearcher = async (id: string) => {
    try {
      await fetch(`/api/government-programs/researchers?id=${id}`, { method: 'DELETE' })
      setResearchers(researchers.filter(r => r.id !== id))
    } catch (error) {
      console.error('Failed to delete researcher:', error)
    }
  }

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role
  }

  const getRoleColors = (role: string) => {
    return ROLE_COLORS[role] || ROLE_COLORS.researcher
  }

  // 역할별 통계
  const roleStats = ROLES.map(role => ({
    ...role,
    count: researchers.filter(r => r.role === role.value).length
  }))

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
            <Users className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">참여 연구원</h1>
            <p className="text-sm text-zinc-400">과제 참여 연구인력을 관리합니다</p>
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
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: themeColor, color: 'white' }}
          >
            <Plus className="w-4 h-4" />
            연구원 등록
          </button>
        </div>
      </div>

      {/* 역할별 통계 */}
      <div className="grid grid-cols-5 gap-4">
        {roleStats.map((role, index) => {
          const colors = getRoleColors(role.value)
          return (
            <motion.div
              key={role.value}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: colors.bgColor, color: colors.color }}
                >
                  {role.label}
                </span>
                <span className="text-2xl font-bold text-white">{role.count}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">연구원 등록</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">역할</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              >
                {ROLES.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">경력 (년)</label>
              <input
                type="number"
                value={formData.career_years}
                onChange={e => setFormData({ ...formData, career_years: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">이메일</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">연락처</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">소속 부서</label>
              <input
                type="text"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">직급/직위</label>
              <input
                type="text"
                value={formData.position}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-2">전공/전문분야</label>
              <input
                type="text"
                value={formData.specialization}
                onChange={e => setFormData({ ...formData, specialization: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">최종학력</label>
              <input
                type="text"
                value={formData.education}
                onChange={e => setFormData({ ...formData, education: e.target.value })}
                placeholder="예: 서울대학교 컴퓨터공학 박사"
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            >
              취소
            </button>
            <button
              onClick={createResearcher}
              disabled={!formData.name}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              등록
            </button>
          </div>
        </motion.div>
      )}

      {/* 연구원 목록 */}
      <div className="grid grid-cols-2 gap-4">
        {researchers.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-zinc-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>등록된 연구원이 없습니다</p>
          </div>
        ) : (
          researchers.map((researcher, index) => {
            const roleColors = getRoleColors(researcher.role)

            return (
              <motion.div
                key={researcher.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: roleColors.bgColor, color: roleColors.color }}
                    >
                      {researcher.name.charAt(0)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">{researcher.name}</h3>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: roleColors.bgColor, color: roleColors.color }}
                        >
                          {getRoleLabel(researcher.role)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-zinc-400">
                        {researcher.position && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4" />
                            {researcher.department && `${researcher.department} / `}
                            {researcher.position}
                          </div>
                        )}
                        {researcher.specialization && (
                          <div className="flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            {researcher.specialization}
                          </div>
                        )}
                        {researcher.education && (
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4" />
                            {researcher.education}
                          </div>
                        )}
                        {researcher.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {researcher.email}
                          </div>
                        )}
                        {researcher.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {researcher.phone}
                          </div>
                        )}
                      </div>

                      {researcher.career_years && researcher.career_years > 0 && (
                        <div className="mt-2 text-xs text-zinc-500">
                          경력 {researcher.career_years}년
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteResearcher(researcher.id)}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
