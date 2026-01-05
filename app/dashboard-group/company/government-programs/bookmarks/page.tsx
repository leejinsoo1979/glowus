'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BookmarkCheck, Trash2, ExternalLink, Calendar, Building2,
  Star, Clock, AlertCircle
} from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Link from 'next/link'

interface Bookmark {
  id: string
  program_id: string
  notes: string | null
  priority: number
  created_at: string
  program: {
    id: string
    title: string
    organization: string
    category: string
    status: string
    apply_start_date: string | null
    apply_end_date: string | null
    support_amount: string | null
  }
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const { themeColor } = useThemeStore()

  useEffect(() => {
    fetchBookmarks()
  }, [])

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/government-programs/bookmarks')
      const data = await res.json()
      setBookmarks(data.bookmarks || [])
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error)
    } finally {
      setLoading(false)
    }
  }

  const removeBookmark = async (programId: string) => {
    try {
      await fetch(`/api/government-programs/bookmarks?program_id=${programId}`, {
        method: 'DELETE'
      })
      setBookmarks(bookmarks.filter(b => b.program_id !== programId))
    } catch (error) {
      console.error('Failed to remove bookmark:', error)
    }
  }

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const today = new Date()
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 2: return 'text-red-400 bg-red-500/20'
      case 1: return 'text-amber-400 bg-amber-500/20'
      default: return 'text-zinc-400 bg-zinc-500/20'
    }
  }

  if (loading) {
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
            <BookmarkCheck className="w-6 h-6" style={{ color: themeColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">북마크</h1>
            <p className="text-sm text-zinc-400">관심 공고를 저장하고 관리합니다</p>
          </div>
        </div>
        <span className="text-sm text-zinc-400">총 {bookmarks.length}개</span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <BookmarkCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>북마크한 공고가 없습니다</p>
          <Link
            href="/dashboard-group/company/government-programs"
            className="mt-4 inline-block px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
          >
            공고 탐색하기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {bookmarks.map((bookmark, index) => {
            const daysRemaining = getDaysRemaining(bookmark.program.apply_end_date)
            const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0
            const isExpired = daysRemaining !== null && daysRemaining < 0

            return (
              <motion.div
                key={bookmark.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-all ${
                  isExpired ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(bookmark.priority)}`}>
                        {bookmark.priority === 2 ? '매우중요' : bookmark.priority === 1 ? '중요' : '일반'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400">
                        {bookmark.program.category}
                      </span>
                      {isUrgent && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          D-{daysRemaining}
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-500">
                          마감됨
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2">
                      {bookmark.program.title}
                    </h3>

                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {bookmark.program.organization}
                      </span>
                      {bookmark.program.apply_end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          ~{bookmark.program.apply_end_date}
                        </span>
                      )}
                      {bookmark.program.support_amount && (
                        <span className="flex items-center gap-1">
                          💰 {bookmark.program.support_amount}
                        </span>
                      )}
                    </div>

                    {bookmark.notes && (
                      <p className="mt-3 text-sm text-zinc-500 bg-zinc-800/50 rounded-lg p-3">
                        {bookmark.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/dashboard-group/company/government-programs?id=${bookmark.program_id}`}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => removeBookmark(bookmark.program_id)}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
