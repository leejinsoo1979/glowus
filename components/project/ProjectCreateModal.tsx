'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FolderKanban, Users, ChevronDown, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { User } from '@/types/database'

interface ProjectCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ProjectFormData, members: string[]) => void
  isLoading?: boolean
  teams: { id: string; name: string }[]
  onTeamChange?: (teamId: string) => void
  teamMembers: User[]
}

export interface ProjectFormData {
  name: string
  description: string
  team_id: string
  status: string
  priority: string
  deadline: string
}

export function ProjectCreateModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  teams,
  onTeamChange,
  teamMembers,
}: ProjectCreateModalProps) {
  const { accentColor } = useThemeStore()
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    team_id: '',
    status: 'planning',
    priority: 'medium',
    deadline: '',
  })
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  // 팀은 선택사항이므로 자동 선택하지 않음

  useEffect(() => {
    if (formData.team_id && onTeamChange) {
      onTeamChange(formData.team_id)
    }
  }, [formData.team_id, onTeamChange])

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return { bg: 'bg-purple-500', hover: 'hover:bg-purple-600', light: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' }
      case 'blue': return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
      case 'green': return { bg: 'bg-green-500', hover: 'hover:bg-green-600', light: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400' }
      case 'orange': return { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', light: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' }
      case 'pink': return { bg: 'bg-pink-500', hover: 'hover:bg-pink-600', light: 'bg-pink-100 dark:bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400' }
      case 'red': return { bg: 'bg-red-500', hover: 'hover:bg-red-600', light: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400' }
      case 'yellow': return { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', light: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400' }
      case 'cyan': return { bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', light: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-600 dark:text-cyan-400' }
      default: return { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' }
    }
  }

  const accent = getAccentClasses()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || isLoading) return

    onSubmit(formData, selectedMembers)
  }

  const handleClose = () => {
    if (isLoading) return
    setFormData({
      name: '',
      description: '',
      team_id: '',
      status: 'planning',
      priority: 'medium',
      deadline: '',
    })
    setSelectedMembers([])
    onClose()
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", accent.light)}>
                    <FolderKanban className={cn("w-6 h-6", accent.text)} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      새 프로젝트
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      프로젝트 정보를 입력하세요
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 -m-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="px-6 space-y-4 overflow-y-auto flex-1">
                {/* Project Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    프로젝트 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="프로젝트 이름"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                  />
                </div>

                {/* Team & Deadline - 2 Column */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                      팀 <span className="text-zinc-400 font-normal">(선택)</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.team_id}
                        onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">팀 없음 (나중에 배치)</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                      마감일
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    설명 <span className="text-zinc-400 font-normal">(선택)</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="프로젝트에 대해 간단히 설명해주세요"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all resize-none"
                  />
                </div>

                {/* Team Members */}
                {teamMembers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-2">
                      <Users className="w-4 h-4 inline mr-1.5" />
                      팀원 추가
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {teamMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMember(member.id)}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            selectedMembers.includes(member.id)
                              ? cn(accent.bg, "text-white")
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          )}
                        >
                          <img
                            src={member.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}&backgroundColor=e4e4e7`}
                            alt=""
                            className="w-5 h-5 rounded-full"
                          />
                          {member.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-5 mt-2 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !formData.name.trim()}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-medium text-white transition-all",
                    "flex items-center justify-center gap-2 min-w-[100px]",
                    accent.bg, accent.hover,
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '생성'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
