'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Eye, EyeOff, ChevronDown, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import type { EmailProvider } from '@/types/email'

interface EmailAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: EmailAccountFormData) => void
  isLoading?: boolean
}

export interface EmailAccountFormData {
  email_address: string
  password: string
  provider: EmailProvider
  display_name?: string
  imap_host?: string
  imap_port?: number
  smtp_host?: string
  smtp_port?: number
}

const PROVIDER_OPTIONS = [
  { value: 'gmail', label: 'Gmail', icon: '📧' },
  { value: 'whois', label: 'Whois Mail', icon: '📬' },
  { value: 'custom', label: '직접 설정', icon: '⚙️' },
]

export function EmailAccountModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: EmailAccountModalProps) {
  const { accentColor } = useThemeStore()
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState<EmailAccountFormData>({
    email_address: '',
    password: '',
    provider: 'gmail',
    display_name: '',
  })

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
    if (!formData.email_address.trim() || !formData.password || isLoading) return
    onSubmit(formData)
  }

  const handleClose = () => {
    if (isLoading) return
    setFormData({
      email_address: '',
      password: '',
      provider: 'gmail',
      display_name: '',
    })
    setShowPassword(false)
    onClose()
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
                    <Mail className={cn("w-6 h-6", accent.text)} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                      이메일 계정 연결
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Gmail 또는 Whois 메일을 연결하세요
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
                {/* Provider */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    이메일 서비스 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value as EmailProvider })}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all appearance-none cursor-pointer"
                    >
                      {PROVIDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.icon} {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    이메일 주소 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email_address}
                    onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                    placeholder="example@gmail.com"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    비밀번호 / 앱 비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="앱 비밀번호를 입력하세요"
                      required
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.provider === 'gmail' && (
                    <p className="mt-1.5 text-xs text-zinc-500">
                      Gmail은 앱 비밀번호가 필요합니다.
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("ml-1", accent.text, "hover:underline")}
                      >
                        앱 비밀번호 생성하기
                      </a>
                    </p>
                  )}
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                    표시 이름 <span className="text-zinc-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.display_name || ''}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="보내는 사람에 표시될 이름"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                  />
                </div>

                {/* Custom Server Settings */}
                {formData.provider === 'custom' && (
                  <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <Server className="w-4 h-4" />
                      서버 설정
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          IMAP 서버
                        </label>
                        <input
                          type="text"
                          value={formData.imap_host || ''}
                          onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                          placeholder="imap.example.com"
                          className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          IMAP 포트
                        </label>
                        <input
                          type="number"
                          value={formData.imap_port || 993}
                          onChange={(e) => setFormData({ ...formData, imap_port: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          SMTP 서버
                        </label>
                        <input
                          type="text"
                          value={formData.smtp_host || ''}
                          onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                          placeholder="smtp.example.com"
                          className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-white mb-1.5">
                          SMTP 포트
                        </label>
                        <input
                          type="number"
                          value={formData.smtp_port || 587}
                          onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 transition-all"
                        />
                      </div>
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
                  disabled={isLoading || !formData.email_address.trim() || !formData.password}
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
                    '연결'
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
