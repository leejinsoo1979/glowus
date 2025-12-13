'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useThemeStore } from '@/stores/themeStore'
import { useTeamStore, Team } from '@/stores/teamStore'
import { MemberAddModal, MemberFormData } from '@/components/team/MemberAddModal'
import {
  UserPlus,
  Search,
  MoreVertical,
  Mail,
  Shield,
  Trash2,
  Edit2,
  LayoutGrid,
  List,
  Plus,
  MessageCircle,
  Phone,
  ArrowLeft,
  Users,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 멤버 타입 정의
interface Member {
  id: string
  name: string
  email: string
  role: string
  position: string
  avatar: string
  avatar_url?: string
  isOnline: boolean
  type: 'person' | 'agent'
  botType?: string
  description?: string
}

type ViewMode = 'album' | 'list'

export default function TeamMembersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamId = searchParams.get('teamId')
  const { accentColor } = useThemeStore()
  const { teams } = useTeamStore()
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 팀원 목록 불러오기
  const loadMembers = useCallback(async (teamIdToLoad: string) => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/teams/${teamIdToLoad}/members`)
      if (res.ok) {
        const { data } = await res.json()
        // API 응답을 Member 형식으로 변환
        const teamMembers: Member[] = (data || []).map((member: any) => ({
          id: member.id,
          name: member.name || 'Unknown',
          email: member.email || '',
          role: member.role || 'member',
          position: member.role === 'founder' ? '창립자' : member.role === 'agent' ? 'AI 에이전트' : '팀원',
          avatar: member.name?.substring(0, 2) || '??',
          avatar_url: member.avatar_url,
          isOnline: member.status === 'online',
          type: member.type === 'agent' ? 'agent' as const : 'person' as const,
          description: '',
        }))
        setMembers(teamMembers)
      }
    } catch (error) {
      console.error('팀원 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (teamId) {
      loadMembers(teamId)
    } else if (teams.length > 0) {
      // teamId가 없으면 첫 번째 팀 사용
      loadMembers(teams[0].id)
    }
  }, [teamId, teams, loadMembers])

  useEffect(() => {
    if (teamId) {
      const team = teams.find(t => t.id === teamId)
      setCurrentTeam(team || null)
    } else {
      setCurrentTeam(null)
    }
  }, [teamId, teams])

  const [searchQuery, setSearchQuery] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('album')
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)

  const handleAddMember = async (data: MemberFormData) => {
    const isBot = data.type === 'agent'

    if (isBot) {
      // BOT은 API를 통해 저장
      try {
        setIsSaving(true)
        const targetTeamId = teamId || (teams.length > 0 ? teams[0].id : null)
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            description: data.description || '',
            team_id: targetTeamId,
            capabilities: data.agentType ? [data.agentType] : ['일반'],
            workflow_nodes: [{ id: 'start', type: 'start', data: {} }],
            workflow_edges: [],
          }),
        })

        if (res.ok) {
          const newAgent = await res.json()
          const newMember: Member = {
            id: newAgent.id,
            name: newAgent.name,
            email: '',
            role: 'agent',
            position: newAgent.capabilities?.[0] || 'AI 에이전트',
            avatar: newAgent.name.substring(0, 2).toUpperCase(),
            avatar_url: newAgent.avatar_url,
            isOnline: true,
            type: 'agent',
            botType: newAgent.capabilities?.[0],
            description: newAgent.description,
          }
          setMembers(prev => [...prev, newMember])
        } else {
          const error = await res.json()
          alert(error.error || 'BOT 추가 실패')
        }
      } catch (error) {
        console.error('BOT 추가 실패:', error)
        alert('BOT 추가 중 오류가 발생했습니다')
      } finally {
        setIsSaving(false)
      }
    } else {
      // 일반 멤버는 로컬 상태에만 추가 (실제 구현 시 team_members API 사용)
      const newMember: Member = {
        id: String(Date.now()),
        name: data.name,
        email: data.email || '',
        role: data.role || 'member',
        position: data.position || '',
        avatar: data.name.substring(0, 2).toUpperCase(),
        isOnline: false,
        type: 'person',
        description: data.description,
      }
      setMembers(prev => [...prev, newMember])
    }

    setIsMemberModalOpen(false)
  }

  const handleMemberClick = (member: Member) => {
    // 에이전트는 에이전트 프로필 페이지로, 일반 멤버는 멤버 프로필 페이지로
    if (member.type === 'agent') {
      router.push(`/dashboard-group/agents/${member.id}`)
    } else {
      router.push(`/dashboard-group/team/members/${member.id}`)
    }
  }

  const getAccentBg = () => {
    switch (accentColor) {
      case 'purple': return 'bg-purple-500'
      case 'blue': return 'bg-blue-500'
      case 'green': return 'bg-green-500'
      case 'orange': return 'bg-orange-500'
      case 'pink': return 'bg-pink-500'
      case 'red': return 'bg-red-500'
      case 'yellow': return 'bg-yellow-500'
      case 'cyan': return 'bg-cyan-500'
      default: return 'bg-blue-500'
    }
  }

  const getAvatarGradient = (index: number) => {
    const gradients = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-500',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-amber-500',
      'from-pink-500 to-rose-500',
      'from-indigo-500 to-blue-500',
    ]
    return gradients[index % gradients.length]
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
      case 'member':
        return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
      case 'viewer':
        return 'bg-zinc-100 dark:bg-zinc-500/20 text-zinc-700 dark:text-zinc-400'
      default:
        return 'bg-zinc-100 dark:bg-zinc-500/20 text-zinc-700 dark:text-zinc-400'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '관리자'
      case 'member': return '멤버'
      case 'viewer': return '뷰어'
      default: return role
    }
  }

  const filteredMembers = members.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.position.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard-group/team')}
          className="flex items-center gap-2 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70 transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">팀 대시보드로 돌아가기</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {currentTeam ? `${currentTeam.name} 팀원` : '팀원 관리'}
            </h1>
            <p className="text-zinc-500 dark:text-white/50 mt-1">
              {currentTeam ? `${currentTeam.memberCount}명의 팀원` : `${members.length}명의 팀원`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="팀원 검색..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center rounded-xl bg-zinc-100 dark:bg-white/5 p-1">
              <button
                onClick={() => setViewMode('album')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  viewMode === 'album'
                    ? "bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                앨범
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  viewMode === 'list'
                    ? "bg-white dark:bg-white/10 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70"
                )}
              >
                <List className="w-4 h-4" />
                리스트
              </button>
            </div>

            {/* Add Button (리스트 뷰에서만) */}
            {viewMode === 'list' && (
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white transition-all",
                  getAccentBg(),
                  "hover:opacity-90"
                )}
              >
                <UserPlus className="w-4 h-4" />
                팀원 추가
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Album View */}
      {!isLoading && viewMode === 'album' && members.length > 0 && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {/* Add Member Card - 좌측 상단 고정 */}
          <motion.div
            variants={item}
            whileHover={{ y: -4 }}
            onClick={() => setIsMemberModalOpen(true)}
            className={cn(
              "group rounded-2xl cursor-pointer min-h-[280px]",
              "border-2 border-dashed border-zinc-300 dark:border-zinc-600",
              "bg-zinc-50 dark:bg-zinc-800/30",
              "hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
              "transition-all duration-200"
            )}
          >
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
              <div className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors">
                <Plus className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
              </div>
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                팀원 추가
              </span>
            </div>
          </motion.div>

          {/* Member Cards */}
          {filteredMembers.map((member, index) => (
            <motion.div
              key={member.id}
              variants={item}
              whileHover={{ y: -4 }}
              onClick={() => handleMemberClick(member)}
              className={cn(
                "group relative rounded-2xl cursor-pointer",
                "bg-white dark:bg-zinc-800/50",
                "border border-zinc-200 dark:border-zinc-700/50",
                "shadow-sm hover:shadow-lg dark:shadow-none",
                "hover:border-zinc-300 dark:hover:border-zinc-600",
                "transition-all duration-200"
              )}
            >
              {/* Menu Button */}
              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenu(activeMenu === member.id ? null : member.id)
                  }}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                >
                  <MoreVertical className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                </button>

                {activeMenu === member.id && (
                  <div className="absolute right-0 top-full mt-1 w-36 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg overflow-hidden z-20">
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                      수정
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors">
                      <Shield className="w-3.5 h-3.5" />
                      역할 변경
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {/* Card Content */}
              <div className="p-5 pt-6 flex flex-col items-center min-h-[280px]">
                {/* Avatar */}
                <div className="relative mb-4">
                  {member.avatar_url ? (
                    <div className="w-[96px] h-[96px] rounded-full overflow-hidden ring-2 ring-white dark:ring-zinc-800 shadow-lg">
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : member.type === 'agent' ? (
                    <div className={cn(
                      "w-[96px] h-[96px] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-zinc-800 shadow-lg",
                      "bg-gradient-to-br from-purple-500 to-pink-500"
                    )}>
                      <Users className="w-10 h-10 text-white" />
                    </div>
                  ) : (
                    <div className={cn(
                      "rounded-full flex items-center justify-center text-xl font-semibold text-white ring-2 ring-white dark:ring-zinc-800 shadow-lg",
                      "bg-gradient-to-br",
                      getAvatarGradient(index)
                    )}
                    style={{ width: '96px', height: '96px' }}
                    >
                      {member.avatar}
                    </div>
                  )}

                  {/* Online Status */}
                  <div className={cn(
                    "absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-800",
                    member.isOnline ? "bg-green-500" : "bg-zinc-400"
                  )} />
                </div>

                {/* Name */}
                <h3 className="font-semibold text-zinc-900 dark:text-white text-center">
                  {member.name}
                </h3>

                {/* Position */}
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 text-center">
                  {member.position}
                </p>

                {/* Role Badge */}
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium mt-3",
                  getRoleBadge(member.role)
                )}>
                  {getRoleLabel(member.role)}
                </span>

                {/* Quick Actions */}
                <div className="flex items-center gap-1.5 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    <Mail className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    <MessageCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                    <Phone className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredMembers.length === 0 && members.length > 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-zinc-500 dark:text-white/50">
                검색 결과가 없습니다
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">불러오는 중...</p>
        </div>
      )}

      {/* Empty State - 팀원이 없을 때 */}
      {!isLoading && members.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            등록된 팀원이 없습니다
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            팀원 또는 BOT을 추가해보세요
          </p>
          <button
            onClick={() => setIsMemberModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all",
              getAccentBg(),
              "hover:opacity-90"
            )}
          >
            <UserPlus className="w-4 h-4" />
            팀원 추가
          </button>
        </motion.div>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && members.length > 0 && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {filteredMembers.map((member, index) => (
            <motion.div
              key={member.id}
              variants={item}
              onClick={() => handleMemberClick(member)}
              className="group rounded-2xl bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 shadow-sm dark:shadow-none p-4 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  {member.avatar_url ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-zinc-100 dark:ring-zinc-700">
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : member.type === 'agent' ? (
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-zinc-100 dark:ring-zinc-700",
                      "bg-gradient-to-br from-purple-500 to-pink-500"
                    )}>
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0",
                      getAccentBg()
                    )}>
                      {member.avatar}
                    </div>
                  )}

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-zinc-900 dark:text-white">
                        {member.name}
                      </h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        getRoleBadge(member.role)
                      )}>
                        {getRoleLabel(member.role)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {member.position}
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-600">•</span>
                      <span className="text-sm text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {member.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === member.id ? null : member.id)}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                  </button>

                  {activeMenu === member.id && (
                    <div className="absolute right-0 top-full mt-2 w-40 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg overflow-hidden z-10">
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                        <Edit2 className="w-4 h-4" />
                        수정
                      </button>
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
                        <Shield className="w-4 h-4" />
                        역할 변경
                      </button>
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filteredMembers.length === 0 && members.length > 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-500 dark:text-white/50">
                검색 결과가 없습니다
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Member Add Modal */}
      <MemberAddModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onSubmit={handleAddMember}
      />
    </div>
  )
}
