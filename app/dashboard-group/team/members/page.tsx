'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useThemeStore } from '@/stores/themeStore'
import { useTeamStore, Team } from '@/stores/teamStore'
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
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

// 더미 데이터
const dummyMembers = [
  { id: '1', name: '김진수', email: 'jinsu@example.com', role: 'admin', position: 'CEO', avatar: 'JK', isOnline: true },
  { id: '2', name: '이수진', email: 'sujin@example.com', role: 'member', position: '개발팀장', avatar: 'SL', isOnline: true },
  { id: '3', name: '박민호', email: 'minho@example.com', role: 'member', position: '프론트엔드', avatar: 'MH', isOnline: false },
  { id: '4', name: '정유진', email: 'yujin@example.com', role: 'member', position: '디자이너', avatar: 'YJ', isOnline: true },
  { id: '5', name: '최서연', email: 'seoyeon@example.com', role: 'viewer', position: '마케팅', avatar: 'CS', isOnline: false },
]

type ViewMode = 'album' | 'list'

export default function TeamMembersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const teamId = searchParams.get('teamId')
  const { accentColor } = useThemeStore()
  const { teams } = useTeamStore()
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null)

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

  const filteredMembers = dummyMembers.filter(member =>
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
        {/* Back Button & Team Name */}
        {currentTeam && (
          <button
            onClick={() => router.push('/dashboard-group/team')}
            className="flex items-center gap-2 text-zinc-500 dark:text-white/50 hover:text-zinc-700 dark:hover:text-white/70 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">팀 목록</span>
          </button>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {currentTeam ? `${currentTeam.name} 팀원` : '팀원 관리'}
            </h1>
            <p className="text-zinc-500 dark:text-white/50 mt-1">
              {currentTeam ? `${currentTeam.memberCount}명의 팀원` : `${dummyMembers.length}명의 팀원`}
            </p>
          </div>

        {/* View Toggle & Add Button (리스트 뷰에서만 추가 버튼 표시) */}
        <div className="flex items-center gap-3">
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
              onClick={() => router.push('/dashboard-group/team/members/new')}
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

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 이메일, 직책으로 검색..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all"
          />
        </div>
      </motion.div>

      {/* Album View */}
      {viewMode === 'album' && (
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
            onClick={() => router.push('/dashboard-group/team/members/new')}
            className={cn(
              "group rounded-2xl cursor-pointer min-h-[240px]",
              "border-2 border-dashed border-zinc-300 dark:border-zinc-700",
              "bg-zinc-50/50 dark:bg-zinc-800/30",
              "hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
              "transition-all duration-200"
            )}
          >
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
              <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors">
                <Plus className="w-7 h-7 text-zinc-500 dark:text-zinc-400" />
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
              className={cn(
                "group relative rounded-2xl cursor-pointer",
                "bg-white dark:bg-zinc-800/50",
                "border border-zinc-200 dark:border-zinc-700",
                "hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md",
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
              <div className="p-5 pt-6 flex flex-col items-center min-h-[240px]">
                {/* Avatar */}
                <div className="relative mb-4">
                  <div className={cn(
                    "w-18 h-18 rounded-full flex items-center justify-center text-lg font-semibold text-white",
                    "bg-gradient-to-br",
                    getAvatarGradient(index)
                  )}
                  style={{ width: '72px', height: '72px' }}
                  >
                    {member.avatar}
                  </div>

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

          {filteredMembers.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-zinc-500 dark:text-white/50">
                검색 결과가 없습니다
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {filteredMembers.map((member) => (
            <motion.div
              key={member.id}
              variants={item}
              className="group rounded-2xl bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-zinc-200/50 dark:border-white/10 p-4 hover:border-accent/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white",
                    getAccentBg()
                  )}>
                    {member.avatar}
                  </div>

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
                      <span className="text-sm text-zinc-500 dark:text-white/50">
                        {member.position}
                      </span>
                      <span className="text-zinc-300 dark:text-white/20">•</span>
                      <span className="text-sm text-zinc-400 dark:text-white/40 flex items-center gap-1">
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
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-zinc-400 dark:text-white/40" />
                  </button>

                  {activeMenu === member.id && (
                    <div className="absolute right-0 top-full mt-2 w-40 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 shadow-lg overflow-hidden z-10">
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-white/70 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                        <Edit2 className="w-4 h-4" />
                        수정
                      </button>
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-white/70 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                        <Shield className="w-4 h-4" />
                        역할 변경
                      </button>
                      <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-500 dark:text-white/50">
                검색 결과가 없습니다
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
