'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, UserPlus, Mail, Briefcase, Shield, ChevronDown, User, Bot, ArrowLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'

interface MemberAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (member: MemberFormData) => void
}

export interface MemberFormData {
  type: 'person' | 'agent'
  name: string
  email: string
  role: string
  position: string
  // AI Agent specific
  agentType?: string
  description?: string
}

type Step = 'select' | 'person-form' | 'agent-form'

export function MemberAddModal({ isOpen, onClose, onSubmit }: MemberAddModalProps) {
  const { accentColor } = useThemeStore()
  const [step, setStep] = useState<Step>('select')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<MemberFormData>({
    type: 'person',
    name: '',
    email: '',
    role: 'member',
    position: '',
    agentType: '',
    description: '',
  })

  const getAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return {
        bg: 'bg-purple-500', hover: 'hover:bg-purple-600', light: 'bg-purple-100 dark:bg-purple-500/20',
        text: 'text-purple-600 dark:text-purple-400', gradient: 'from-purple-500 to-violet-600',
        border: 'border-purple-500', ring: 'ring-purple-500/30', shadow: 'shadow-purple-500/20',
        hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-purple-500/10',
        groupHoverBorder: 'group-hover:border-purple-500',
        groupHoverBg: 'group-hover:bg-purple-500',
      }
      case 'blue': return {
        bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-cyan-500',
        border: 'border-blue-500', ring: 'ring-blue-500/30', shadow: 'shadow-blue-500/20',
        hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-blue-500/10',
        groupHoverBorder: 'group-hover:border-blue-500',
        groupHoverBg: 'group-hover:bg-blue-500',
      }
      case 'green': return {
        bg: 'bg-green-500', hover: 'hover:bg-green-600', light: 'bg-green-100 dark:bg-green-500/20',
        text: 'text-green-600 dark:text-green-400', gradient: 'from-green-500 to-emerald-500',
        border: 'border-green-500', ring: 'ring-green-500/30', shadow: 'shadow-green-500/20',
        hoverBorder: 'hover:border-green-500 dark:hover:border-green-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-green-500/10',
        groupHoverBorder: 'group-hover:border-green-500',
        groupHoverBg: 'group-hover:bg-green-500',
      }
      case 'orange': return {
        bg: 'bg-orange-500', hover: 'hover:bg-orange-600', light: 'bg-orange-100 dark:bg-orange-500/20',
        text: 'text-orange-600 dark:text-orange-400', gradient: 'from-orange-500 to-amber-500',
        border: 'border-orange-500', ring: 'ring-orange-500/30', shadow: 'shadow-orange-500/20',
        hoverBorder: 'hover:border-orange-500 dark:hover:border-orange-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-orange-500/10',
        groupHoverBorder: 'group-hover:border-orange-500',
        groupHoverBg: 'group-hover:bg-orange-500',
      }
      case 'pink': return {
        bg: 'bg-pink-500', hover: 'hover:bg-pink-600', light: 'bg-pink-100 dark:bg-pink-500/20',
        text: 'text-pink-600 dark:text-pink-400', gradient: 'from-pink-500 to-rose-500',
        border: 'border-pink-500', ring: 'ring-pink-500/30', shadow: 'shadow-pink-500/20',
        hoverBorder: 'hover:border-pink-500 dark:hover:border-pink-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-pink-500/10',
        groupHoverBorder: 'group-hover:border-pink-500',
        groupHoverBg: 'group-hover:bg-pink-500',
      }
      case 'red': return {
        bg: 'bg-red-500', hover: 'hover:bg-red-600', light: 'bg-red-100 dark:bg-red-500/20',
        text: 'text-red-600 dark:text-red-400', gradient: 'from-red-500 to-rose-500',
        border: 'border-red-500', ring: 'ring-red-500/30', shadow: 'shadow-red-500/20',
        hoverBorder: 'hover:border-red-500 dark:hover:border-red-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-red-500/10',
        groupHoverBorder: 'group-hover:border-red-500',
        groupHoverBg: 'group-hover:bg-red-500',
      }
      case 'yellow': return {
        bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', light: 'bg-yellow-100 dark:bg-yellow-500/20',
        text: 'text-yellow-600 dark:text-yellow-400', gradient: 'from-yellow-500 to-amber-500',
        border: 'border-yellow-500', ring: 'ring-yellow-500/30', shadow: 'shadow-yellow-500/20',
        hoverBorder: 'hover:border-yellow-500 dark:hover:border-yellow-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-yellow-500/10',
        groupHoverBorder: 'group-hover:border-yellow-500',
        groupHoverBg: 'group-hover:bg-yellow-500',
      }
      case 'cyan': return {
        bg: 'bg-cyan-500', hover: 'hover:bg-cyan-600', light: 'bg-cyan-100 dark:bg-cyan-500/20',
        text: 'text-cyan-600 dark:text-cyan-400', gradient: 'from-cyan-500 to-teal-500',
        border: 'border-cyan-500', ring: 'ring-cyan-500/30', shadow: 'shadow-cyan-500/20',
        hoverBorder: 'hover:border-cyan-500 dark:hover:border-cyan-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-cyan-500/10',
        groupHoverBorder: 'group-hover:border-cyan-500',
        groupHoverBg: 'group-hover:bg-cyan-500',
      }
      default: return {
        bg: 'bg-blue-500', hover: 'hover:bg-blue-600', light: 'bg-blue-100 dark:bg-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-cyan-500',
        border: 'border-blue-500', ring: 'ring-blue-500/30', shadow: 'shadow-blue-500/20',
        hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-blue-500/10',
        groupHoverBorder: 'group-hover:border-blue-500',
        groupHoverBg: 'group-hover:bg-blue-500',
      }
    }
  }

  const accent = getAccentClasses()

  // AI 에이전트용 보조 색상 클래스
  const getSecondaryAccentClasses = () => {
    switch (accentColor) {
      case 'purple': return {
        gradient: 'from-violet-500 to-purple-600', border: 'border-violet-500', shadow: 'shadow-violet-500/20',
        bg: 'bg-violet-500', hover: 'hover:bg-violet-600',
        hoverBorder: 'hover:border-violet-500 dark:hover:border-violet-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-violet-500/10',
      }
      case 'blue': return {
        gradient: 'from-indigo-500 to-blue-600', border: 'border-indigo-500', shadow: 'shadow-indigo-500/20',
        bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600',
        hoverBorder: 'hover:border-indigo-500 dark:hover:border-indigo-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-indigo-500/10',
      }
      case 'green': return {
        gradient: 'from-teal-500 to-green-600', border: 'border-teal-500', shadow: 'shadow-teal-500/20',
        bg: 'bg-teal-500', hover: 'hover:bg-teal-600',
        hoverBorder: 'hover:border-teal-500 dark:hover:border-teal-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-teal-500/10',
      }
      case 'orange': return {
        gradient: 'from-red-500 to-orange-600', border: 'border-red-500', shadow: 'shadow-red-500/20',
        bg: 'bg-red-500', hover: 'hover:bg-red-600',
        hoverBorder: 'hover:border-red-500 dark:hover:border-red-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-red-500/10',
      }
      case 'pink': return {
        gradient: 'from-purple-500 to-pink-600', border: 'border-purple-500', shadow: 'shadow-purple-500/20',
        bg: 'bg-purple-500', hover: 'hover:bg-purple-600',
        hoverBorder: 'hover:border-purple-500 dark:hover:border-purple-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-purple-500/10',
      }
      case 'red': return {
        gradient: 'from-pink-500 to-red-600', border: 'border-pink-500', shadow: 'shadow-pink-500/20',
        bg: 'bg-pink-500', hover: 'hover:bg-pink-600',
        hoverBorder: 'hover:border-pink-500 dark:hover:border-pink-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-pink-500/10',
      }
      case 'yellow': return {
        gradient: 'from-orange-500 to-yellow-600', border: 'border-orange-500', shadow: 'shadow-orange-500/20',
        bg: 'bg-orange-500', hover: 'hover:bg-orange-600',
        hoverBorder: 'hover:border-orange-500 dark:hover:border-orange-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-orange-500/10',
      }
      case 'cyan': return {
        gradient: 'from-blue-500 to-cyan-600', border: 'border-blue-500', shadow: 'shadow-blue-500/20',
        bg: 'bg-blue-500', hover: 'hover:bg-blue-600',
        hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-blue-500/10',
      }
      default: return {
        gradient: 'from-indigo-500 to-blue-600', border: 'border-indigo-500', shadow: 'shadow-indigo-500/20',
        bg: 'bg-indigo-500', hover: 'hover:bg-indigo-600',
        hoverBorder: 'hover:border-indigo-500 dark:hover:border-indigo-500',
        hoverShadow: 'hover:shadow-lg hover:shadow-indigo-500/10',
      }
    }
  }

  const secondaryAccent = getSecondaryAccentClasses()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 'person-form' && (!formData.name.trim() || !formData.email.trim())) return
    if (step === 'agent-form' && !formData.name.trim()) return

    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 500))

    onSubmit(formData)
    setIsSubmitting(false)
    resetAndClose()
  }

  const resetAndClose = () => {
    setFormData({ type: 'person', name: '', email: '', role: 'member', position: '', agentType: '', description: '' })
    setStep('select')
    onClose()
  }

  const handleSelectType = (type: 'person' | 'agent') => {
    setFormData({ ...formData, type })
    setStep(type === 'person' ? 'person-form' : 'agent-form')
  }

  const handleBack = () => {
    setStep('select')
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
            onClick={resetAndClose}
            className="absolute inset-0 bg-black/60"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Step 1: Type Selection */}
            <AnimatePresence mode="wait">
              {step === 'select' && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Header */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", accent.light)}>
                          <UserPlus className={cn("w-6 h-6", accent.text)} />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                            팀원 추가
                          </h2>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            추가할 팀원 유형을 선택하세요
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={resetAndClose}
                        className="p-2 -m-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Selection Cards */}
                  <div className="px-6 pb-6 grid grid-cols-2 gap-4">
                    {/* Person Card */}
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectType('person')}
                      className={cn(
                        "group relative p-6 rounded-2xl border-2 text-left transition-all",
                        "border-zinc-200 dark:border-zinc-700",
                        accent.hoverBorder,
                        accent.hoverShadow
                      )}
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4 shadow-lg",
                        accent.gradient,
                        accent.shadow
                      )}>
                        <User className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                        사람
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        실제 팀원을 초대합니다
                      </p>
                      <div className={cn(
                        "absolute top-4 right-4 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                        "border-zinc-300 dark:border-zinc-600",
                        accent.groupHoverBorder,
                        accent.groupHoverBg
                      )}>
                        <motion.div
                          initial={{ scale: 0 }}
                          whileHover={{ scale: 1 }}
                          className="w-2 h-2 bg-white rounded-full"
                        />
                      </div>
                    </motion.button>

                    {/* AI Agent Card */}
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectType('agent')}
                      className={cn(
                        "group relative p-6 rounded-2xl border-2 text-left transition-all",
                        "border-zinc-200 dark:border-zinc-700",
                        secondaryAccent.hoverBorder,
                        secondaryAccent.hoverShadow
                      )}
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-xl mb-4 shadow-lg ring-2 flex items-center justify-center",
                        "bg-gradient-to-br from-purple-500 to-pink-500",
                        secondaryAccent.shadow,
                        "ring-white/20"
                      )}>
                        <Sparkles className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                        AI 에이전트
                      </h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        AI 어시스턴트를 추가합니다
                      </p>
                      <div className="absolute top-3 right-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r text-white flex items-center gap-1",
                          secondaryAccent.gradient
                        )}>
                          <Sparkles className="w-3 h-3" />
                          NEW
                        </span>
                      </div>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Person Form */}
              {step === 'person-form' && (
                <motion.div
                  key="person-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Header */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleBack}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </button>
                        <div>
                          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                            팀원 초대
                          </h2>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            새로운 팀원 정보를 입력하세요
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={resetAndClose}
                        className="p-2 -m-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit}>
                    <div className="px-6 space-y-4">
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          이름 <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="팀원 이름"
                            required
                            autoFocus
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          이메일 <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="email@example.com"
                            required
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                          />
                        </div>
                      </div>

                      {/* Position & Role */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                            직책
                          </label>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                            <input
                              type="text"
                              value={formData.position}
                              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                              placeholder="예: 개발자"
                              className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                            역할
                          </label>
                          <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                            <select
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                              className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all appearance-none cursor-pointer"
                            >
                              <option value="member">멤버</option>
                              <option value="admin">관리자</option>
                              <option value="viewer">뷰어</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-5 mt-2 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        초대 링크가 이메일로 전송됩니다
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={resetAndClose}
                          className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          취소
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || !formData.name.trim() || !formData.email.trim()}
                          className={cn(
                            "px-6 py-2.5 rounded-xl font-medium text-white transition-all",
                            "flex items-center justify-center gap-2 min-w-[100px]",
                            accent.bg, accent.hover,
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            '초대'
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Step 2: AI Agent Form */}
              {step === 'agent-form' && (
                <motion.div
                  key="agent-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Header */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={handleBack}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                        </button>
                        <div className={cn(
                          "w-12 h-12 rounded-xl shadow-lg ring-2 flex items-center justify-center",
                          "bg-gradient-to-br from-purple-500 to-pink-500",
                          secondaryAccent.shadow,
                          "ring-white/20"
                        )}>
                          <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                            AI 에이전트 추가
                          </h2>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                            AI 어시스턴트 정보를 설정하세요
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={resetAndClose}
                        className="p-2 -m-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit}>
                    <div className="px-6 space-y-4">
                      {/* Agent Name */}
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          에이전트 이름 <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-white" />
                          </div>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="예: 업무 도우미"
                            required
                            autoFocus
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                          />
                        </div>
                      </div>

                      {/* Agent Type */}
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          에이전트 유형
                        </label>
                        <div className="relative">
                          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                          <select
                            value={formData.agentType}
                            onChange={(e) => setFormData({ ...formData, agentType: e.target.value })}
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all appearance-none cursor-pointer"
                          >
                            <option value="">유형 선택</option>
                            <option value="assistant">일반 어시스턴트</option>
                            <option value="developer">개발 도우미</option>
                            <option value="designer">디자인 도우미</option>
                            <option value="analyst">데이터 분석가</option>
                            <option value="writer">콘텐츠 작성자</option>
                            <option value="custom">커스텀</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                          placeholder="에이전트의 역할과 기능을 설명해주세요"
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all resize-none"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-6 py-5 mt-2 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        에이전트가 팀에 추가됩니다
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={resetAndClose}
                          className="px-5 py-2.5 rounded-xl font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          취소
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting || !formData.name.trim()}
                          className={cn(
                            "px-6 py-2.5 rounded-xl font-medium text-white transition-all",
                            "flex items-center justify-center gap-2 min-w-[100px]",
                            "bg-gradient-to-r",
                            secondaryAccent.gradient,
                            secondaryAccent.hover,
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              추가
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
