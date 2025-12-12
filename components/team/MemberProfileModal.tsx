'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Mail,
  MessageCircle,
  Phone,
  Calendar,
  GitCommit,
  CheckCircle2,
  Clock,
  TrendingUp,
  MapPin,
  LinkIcon,
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

export interface TeamMember {
  id: string
  name: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  position: string
  avatar: string
  isOnline: boolean
  phone?: string
  location?: string
  joinedAt?: string
  bio?: string
  skills?: string[]
  stats?: {
    commits: number
    tasksCompleted: number
    hoursWorked: number
    streak: number
  }
  recentActivity?: {
    action: string
    target: string
    time: string
  }[]
}

interface MemberProfileModalProps {
  isOpen: boolean
  onClose: () => void
  member: TeamMember | null
  avatarGradient?: string
}

export function MemberProfileModal({ isOpen, onClose, member, avatarGradient }: MemberProfileModalProps) {
  const { accentColor } = useThemeStore()

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', bgLight: 'bg-purple-500/10', text: 'text-purple-500', gradient: 'from-purple-500 to-violet-600' }
      case 'blue': return { bg: 'bg-blue-500', bgLight: 'bg-blue-500/10', text: 'text-blue-500', gradient: 'from-blue-500 to-cyan-500' }
      case 'green': return { bg: 'bg-green-500', bgLight: 'bg-green-500/10', text: 'text-green-500', gradient: 'from-green-500 to-emerald-500' }
      case 'orange': return { bg: 'bg-orange-500', bgLight: 'bg-orange-500/10', text: 'text-orange-500', gradient: 'from-orange-500 to-amber-500' }
      case 'pink': return { bg: 'bg-pink-500', bgLight: 'bg-pink-500/10', text: 'text-pink-500', gradient: 'from-pink-500 to-rose-500' }
      case 'red': return { bg: 'bg-red-500', bgLight: 'bg-red-500/10', text: 'text-red-500', gradient: 'from-red-500 to-rose-500' }
      case 'yellow': return { bg: 'bg-yellow-500', bgLight: 'bg-yellow-500/10', text: 'text-yellow-500', gradient: 'from-yellow-500 to-amber-500' }
      case 'cyan': return { bg: 'bg-cyan-500', bgLight: 'bg-cyan-500/10', text: 'text-cyan-500', gradient: 'from-cyan-500 to-teal-500' }
      default: return { bg: 'bg-blue-500', bgLight: 'bg-blue-500/10', text: 'text-blue-500', gradient: 'from-blue-500 to-cyan-500' }
    }
  }

  const accent = getAccentClasses()

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', label: '관리자' }
      case 'member':
        return { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', label: '멤버' }
      case 'viewer':
        return { bg: 'bg-zinc-100 dark:bg-zinc-500/20', text: 'text-zinc-700 dark:text-zinc-400', label: '뷰어' }
      default:
        return { bg: 'bg-zinc-100 dark:bg-zinc-500/20', text: 'text-zinc-700 dark:text-zinc-400', label: role }
    }
  }

  if (!member) return null

  const roleBadge = getRoleBadge(member.role)

  // Default stats if not provided
  const stats = member.stats || {
    commits: Math.floor(Math.random() * 100) + 20,
    tasksCompleted: Math.floor(Math.random() * 50) + 10,
    hoursWorked: Math.floor(Math.random() * 200) + 100,
    streak: Math.floor(Math.random() * 14) + 1,
  }

  // Default activity if not provided
  const recentActivity = member.recentActivity || [
    { action: '커밋', target: 'feat: 새로운 기능 추가', time: '2시간 전' },
    { action: '완료', target: '버그 수정 태스크', time: '5시간 전' },
    { action: '리뷰', target: 'PR #42 코드 리뷰', time: '어제' },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header with gradient */}
            <div className={cn(
              "relative h-28 bg-gradient-to-r",
              avatarGradient || accent.gradient
            )}>
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }} />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Avatar */}
            <div className="relative px-6 -mt-14">
              <div className="relative inline-block">
                <div className={cn(
                  "w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-bold text-white",
                  "bg-gradient-to-br shadow-xl ring-4 ring-white dark:ring-zinc-900",
                  avatarGradient || accent.gradient
                )}>
                  {member.avatar}
                </div>
                {/* Online indicator */}
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-white dark:border-zinc-900",
                  member.isOnline ? "bg-green-500" : "bg-zinc-400"
                )} />
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pt-4 pb-6">
              {/* Name & Role */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
                    {member.name}
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {member.position}
                  </p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5",
                  roleBadge.bg, roleBadge.text
                )}>
                  <Shield className="w-3 h-3" />
                  {roleBadge.label}
                </span>
              </div>

              {/* Bio */}
              {member.bio && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  {member.bio}
                </p>
              )}

              {/* Contact Info */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-600 dark:text-zinc-300">{member.email}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">{member.phone}</span>
                  </div>
                )}
                {member.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">{member.location}</span>
                  </div>
                )}
                {member.joinedAt && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-600 dark:text-zinc-300">{member.joinedAt} 가입</span>
                  </div>
                )}
              </div>

              {/* Skills */}
              {member.skills && member.skills.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    스킬
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {member.skills.map((skill, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="text-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <GitCommit className={cn("w-4 h-4 mx-auto mb-1", accent.text)} />
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.commits}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">커밋</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-green-500" />
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.tasksCompleted}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">완료</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.hoursWorked}h</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">작업</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.streak}일</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">연속</div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mb-5">
                <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                  최근 활동
                </h4>
                <div className="space-y-2">
                  {recentActivity.map((activity, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-semibold",
                        accent.bgLight, accent.text
                      )}>
                        {activity.action.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-700 dark:text-zinc-300 truncate block">
                          {activity.target}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                        {activity.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button className={cn(
                  "flex-1 px-4 py-2.5 rounded-xl font-medium text-white flex items-center justify-center gap-2",
                  "bg-gradient-to-r", accent.gradient,
                  "hover:opacity-90 transition-opacity"
                )}>
                  <MessageCircle className="w-4 h-4" />
                  메시지 보내기
                </button>
                <button className="px-4 py-2.5 rounded-xl font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  이메일
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
