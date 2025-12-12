'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Plus,
  Bell,
  Pin,
  Eye,
  Calendar,
  ChevronRight
} from 'lucide-react'

const noticesData = [
  {
    id: '1',
    title: '2024년 연말 휴무 안내',
    content: '12월 25일(수)~1월 1일(수)까지 연말 휴무입니다. 긴급 연락처는 공지사항을 참고해주세요.',
    author: '경영지원팀',
    date: '2024-12-10',
    views: 156,
    isPinned: true,
    category: '일반'
  },
  {
    id: '2',
    title: '12월 급여 지급일 변경 안내',
    content: '12월 급여는 연말 휴무로 인해 12월 23일(월)에 지급됩니다.',
    author: '인사팀',
    date: '2024-12-08',
    views: 98,
    isPinned: true,
    category: '인사'
  },
  {
    id: '3',
    title: '정보보안 교육 필수 이수 안내',
    content: '전 직원 정보보안 교육을 12월 31일까지 필수로 이수해주시기 바랍니다.',
    author: '보안팀',
    date: '2024-12-05',
    views: 234,
    isPinned: false,
    category: '교육'
  },
  {
    id: '4',
    title: '사무실 이전 안내',
    content: '2025년 1월 15일부터 새 사무실로 이전합니다. 상세 주소 및 이전 일정은 별도 안내 예정입니다.',
    author: '경영지원팀',
    date: '2024-12-03',
    views: 189,
    isPinned: false,
    category: '일반'
  },
  {
    id: '5',
    title: '연말 회식 일정 안내',
    content: '12월 27일(금) 저녁 6시 연말 회식이 예정되어 있습니다. 참석 여부를 회신해주세요.',
    author: '총무팀',
    date: '2024-12-01',
    views: 145,
    isPinned: false,
    category: '행사'
  }
]

export default function NoticesPage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = ['all', ...Array.from(new Set(noticesData.map(n => n.category)))]

  const filteredNotices = selectedCategory === 'all'
    ? noticesData
    : noticesData.filter(n => n.category === selectedCategory)

  const pinnedNotices = filteredNotices.filter(n => n.isPinned)
  const regularNotices = filteredNotices.filter(n => !n.isPinned)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard-group/company')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-zinc-900')}>
              공지사항
            </h1>
            <p className={cn('text-sm mt-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
              회사 공지사항을 확인하세요
            </p>
          </div>
        </div>
        <button className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
          'bg-accent text-white hover:bg-accent/90'
        )}>
          <Plus className="w-4 h-4" />
          공지 작성
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex items-center gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              selectedCategory === cat
                ? 'bg-accent text-white'
                : isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            )}
          >
            {cat === 'all' ? '전체' : cat}
          </button>
        ))}
      </div>

      {/* 고정 공지 */}
      {pinnedNotices.length > 0 && (
        <div className="space-y-3">
          <h2 className={cn('text-sm font-medium flex items-center gap-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            <Pin className="w-4 h-4" />
            고정 공지
          </h2>
          {pinnedNotices.map(notice => (
            <div
              key={notice.id}
              className={cn(
                'p-4 rounded-xl border cursor-pointer transition-colors',
                isDark ? 'bg-zinc-900 border-accent/30 hover:border-accent' : 'bg-white border-accent/30 hover:border-accent'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Pin className="w-4 h-4 text-accent" />
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                    )}>
                      {notice.category}
                    </span>
                    <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                      {notice.title}
                    </h3>
                  </div>
                  <p className={cn('text-sm mb-2 line-clamp-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                    {notice.content}
                  </p>
                  <div className={cn('flex items-center gap-4 text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                    <span>{notice.author}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {notice.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {notice.views}
                    </span>
                  </div>
                </div>
                <ChevronRight className={cn('w-5 h-5', isDark ? 'text-zinc-600' : 'text-zinc-400')} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 일반 공지 */}
      <div className="space-y-3">
        <h2 className={cn('text-sm font-medium flex items-center gap-2', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
          <Bell className="w-4 h-4" />
          일반 공지
        </h2>
        {regularNotices.map(notice => (
          <div
            key={notice.id}
            className={cn(
              'p-4 rounded-xl border cursor-pointer transition-colors',
              isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                  )}>
                    {notice.category}
                  </span>
                  <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-zinc-900')}>
                    {notice.title}
                  </h3>
                </div>
                <p className={cn('text-sm mb-2 line-clamp-1', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  {notice.content}
                </p>
                <div className={cn('flex items-center gap-4 text-xs', isDark ? 'text-zinc-500' : 'text-zinc-400')}>
                  <span>{notice.author}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {notice.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {notice.views}
                  </span>
                </div>
              </div>
              <ChevronRight className={cn('w-5 h-5', isDark ? 'text-zinc-600' : 'text-zinc-400')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
