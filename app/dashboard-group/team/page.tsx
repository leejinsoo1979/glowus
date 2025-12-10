'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, getInitials } from '@/lib/utils'
import type { Startup } from '@/types/database'
import {
  Users,
  Plus,
  Trash2,
  Mail,
  UserPlus,
  Loader2,
  X,
  Check,
  AlertCircle,
  Crown,
  Shield,
  User as UserIcon,
} from 'lucide-react'

interface TeamMember {
  id: string
  startup_id: string
  user_id: string
  role: string
  joined_at: string
  user: {
    id: string
    name: string
    email: string
    avatar_url?: string
    role: string
  }
}

const ROLE_OPTIONS = [
  { value: 'CTO', label: 'CTO', icon: Shield },
  { value: 'CPO', label: 'CPO', icon: Shield },
  { value: 'Developer', label: '개발자', icon: UserIcon },
  { value: 'Designer', label: '디자이너', icon: UserIcon },
  { value: 'Marketer', label: '마케터', icon: UserIcon },
  { value: 'Operations', label: '운영', icon: UserIcon },
  { value: 'Other', label: '기타', icon: UserIcon },
]

export default function TeamPage() {
  const { user } = useAuthStore()
  const [startups, setStartups] = useState<Startup[]>([])
  const [selectedStartup, setSelectedStartup] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'Developer',
  })

  const fetchStartups = useCallback(async () => {
    try {
      const response = await fetch('/api/startups')
      const result = await response.json()
      if (result.data && result.data.length > 0) {
        setStartups(result.data)
        setSelectedStartup(result.data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch startups:', err)
    }
  }, [])

  const fetchTeamMembers = useCallback(async () => {
    if (!selectedStartup) return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/team-members?startup_id=${selectedStartup}`)
      const result = await response.json()
      if (result.data) {
        setTeamMembers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err)
      setError('팀원 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedStartup])

  useEffect(() => {
    fetchStartups()
  }, [fetchStartups])

  useEffect(() => {
    if (selectedStartup) {
      fetchTeamMembers()
    }
  }, [selectedStartup, fetchTeamMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startup_id: selectedStartup,
          email: inviteData.email,
          role: inviteData.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '초대에 실패했습니다.')
      }

      await fetchTeamMembers()
      setShowInviteModal(false)
      setInviteData({ email: '', role: 'Developer' })
      setSuccessMessage('팀원이 성공적으로 추가되었습니다.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('정말 이 팀원을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(
        `/api/team-members?id=${memberId}&startup_id=${selectedStartup}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '삭제에 실패했습니다.')
      }

      await fetchTeamMembers()
      setSuccessMessage('팀원이 삭제되었습니다.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    }
  }

  const currentStartup = startups.find(s => s.id === selectedStartup)
  const isFounder = currentStartup?.founder_id === user?.id

  if (startups.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">팀 관리</h1>
          <p className="text-gray-500 mt-1">팀원을 초대하고 관리하세요</p>
        </div>
        <Card variant="default" className="py-16">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">스타트업을 먼저 등록하세요</h3>
              <p className="text-gray-500 mt-1">팀원을 관리하려면 먼저 스타트업을 등록해야 합니다.</p>
            </div>
            <Button onClick={() => window.location.href = '/dashboard-group/startup'}>
              스타트업 등록하기
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">팀 관리</h1>
          <p className="text-gray-500 mt-1">팀원을 초대하고 관리하세요</p>
        </div>
        {isFounder && (
          <Button onClick={() => setShowInviteModal(true)} leftIcon={<UserPlus className="w-4 h-4" />}>
            팀원 초대
          </Button>
        )}
      </div>

      {/* Startup Selector */}
      {startups.length > 1 && (
        <div className="flex gap-2">
          {startups.map(startup => (
            <button
              key={startup.id}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedStartup === startup.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setSelectedStartup(startup.id)}
            >
              {startup.name}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-danger-50 border border-danger-200 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-danger-500" />
          <p className="text-danger-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-danger-500" />
          </button>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3"
        >
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-700">{successMessage}</p>
        </motion.div>
      )}

      {/* Founder Card */}
      {currentStartup && (
        <Card variant="gradient" className="border-2 border-primary-100">
          <CardContent className="py-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/25">
                {currentStartup.founder?.name ? getInitials(currentStartup.founder.name) : 'F'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {currentStartup.founder?.name || '창업자'}
                  </h3>
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    창업자
                  </span>
                </div>
                <p className="text-sm text-gray-500">{currentStartup.founder?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : teamMembers.length === 0 ? (
        <Card variant="default" className="py-12">
          <div className="text-center space-y-3">
            <Users className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">아직 팀원이 없습니다</h3>
            <p className="text-gray-500">팀원을 초대하여 함께 일해보세요</p>
            {isFounder && (
              <Button onClick={() => setShowInviteModal(true)} leftIcon={<UserPlus className="w-4 h-4" />}>
                첫 팀원 초대하기
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member, index) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card variant="default" className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center text-gray-600 font-semibold">
                    {getInitials(member.user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{member.user.name}</h4>
                    <p className="text-sm text-gray-500 truncate">{member.user.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                        {member.role}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(member.joined_at)}
                      </span>
                    </div>
                  </div>
                  {isFounder && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="p-2 hover:bg-danger-50 rounded-lg text-gray-400 hover:text-danger-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-primary-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">팀원 초대</h2>
                  </div>
                  <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleInvite} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이메일 주소
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      className="w-full h-11 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                      placeholder="team@example.com"
                      value={inviteData.email}
                      onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    초대하려는 사용자가 이미 가입되어 있어야 합니다.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">역할</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map(role => (
                      <button
                        key={role.value}
                        type="button"
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          inviteData.role === role.value
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setInviteData({ ...inviteData, role: role.value })}
                      >
                        <role.icon className={`w-4 h-4 ${
                          inviteData.role === role.value ? 'text-primary-600' : 'text-gray-400'
                        }`} />
                        <span className={`text-sm font-medium ${
                          inviteData.role === role.value ? 'text-primary-700' : 'text-gray-600'
                        }`}>
                          {role.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg">
                    <p className="text-sm text-danger-700">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowInviteModal(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={isSubmitting}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    초대하기
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
