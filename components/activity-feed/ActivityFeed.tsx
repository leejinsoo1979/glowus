'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  type: string
  icon: string
  title: string
  description: string
  project: string
  projectPath: string
  status: string
  statusColor: string
  duration: string
  filesChanged: number
  gitInfo: any
  timestamp: string
  completedAt: string
  source: string
  details: {
    filesCreated?: string[]
    filesModified?: string[]
    result?: string
    error?: string
  }
}

interface ActivityFeedProps {
  className?: string
  limit?: number
  projectId?: string
}

/**
 * GitHub 스타일 활동 피드
 * 텔레그램, 웹 등 모든 채널의 작업 기록 표시
 */
export function ActivityFeed({ className, limit = 20, projectId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [grouped, setGrouped] = useState<Record<string, Activity[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchActivities()
  }, [limit, projectId])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ limit: String(limit) })
      if (projectId) params.set('project_id', projectId)

      const res = await fetch(`/api/activity-feed?${params}`)
      if (!res.ok) throw new Error('Failed to fetch activities')

      const data = await res.json()
      setActivities(data.activities || [])
      setGrouped(data.grouped || {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("p-4", className)}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("p-4 text-red-500", className)}>
        오류: {error}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className={cn("p-8 text-center text-gray-500", className)}>
        <div className="text-4xl mb-2">📋</div>
        <div>아직 활동 기록이 없습니다</div>
        <div className="text-sm mt-1">텔레그램에서 작업을 시작해보세요</div>
      </div>
    )
  }

  return (
    <div className={cn("", className)}>
      {Object.entries(grouped).map(([date, dateActivities]) => (
        <div key={date} className="mb-6">
          {/* 날짜 헤더 */}
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {date}
            </h3>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* 활동 목록 */}
          <div className="space-y-1">
            {dateActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                expanded={expandedId === activity.id}
                onToggle={() => setExpandedId(
                  expandedId === activity.id ? null : activity.id
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityItem({
  activity,
  expanded,
  onToggle
}: {
  activity: Activity
  expanded: boolean
  onToggle: () => void
}) {
  const time = new Date(activity.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div
      className={cn(
        "group rounded-lg transition-colors cursor-pointer",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50",
        expanded && "bg-gray-50 dark:bg-gray-800/50"
      )}
      onClick={onToggle}
    >
      {/* 메인 라인 */}
      <div className="flex items-start gap-3 p-3">
        {/* 아이콘 */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg">
          {activity.icon}
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* 제목 */}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {activity.title}
            </span>

            {/* 상태 뱃지 */}
            <span className={cn(
              "px-1.5 py-0.5 text-xs rounded-full",
              activity.statusColor === 'green' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              activity.statusColor === 'yellow' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
              activity.statusColor === 'red' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              activity.statusColor === 'gray' && "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            )}>
              {activity.status === 'completed' ? '완료' :
               activity.status === 'in_progress' ? '진행중' :
               activity.status === 'failed' ? '실패' : '대기'}
            </span>

            {/* 소스 */}
            {activity.source === 'telegram' && (
              <span className="text-xs text-blue-500">via Telegram</span>
            )}
          </div>

          {/* 설명 */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1">
            {activity.description}
          </p>

          {/* 메타 정보 */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{time}</span>
            {activity.duration && <span>{activity.duration}</span>}
            {activity.filesChanged > 0 && (
              <span className="text-green-600 dark:text-green-400">
                +{activity.filesChanged} files
              </span>
            )}
            {activity.project && (
              <span className="text-purple-600 dark:text-purple-400">
                {activity.project}
              </span>
            )}
          </div>
        </div>

        {/* 확장 아이콘 */}
        <div className="flex-shrink-0 text-gray-400">
          <svg
            className={cn(
              "w-4 h-4 transition-transform",
              expanded && "rotate-180"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 확장된 상세 정보 */}
      {expanded && (
        <div className="px-3 pb-3 ml-11 space-y-2">
          {/* 파일 변경 내역 */}
          {activity.details.filesCreated && activity.details.filesCreated.length > 0 && (
            <div className="text-sm">
              <div className="text-green-600 dark:text-green-400 font-medium mb-1">
                생성된 파일:
              </div>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs space-y-0.5">
                {activity.details.filesCreated.slice(0, 10).map((file, i) => (
                  <li key={i} className="truncate">{file}</li>
                ))}
              </ul>
            </div>
          )}

          {activity.details.filesModified && activity.details.filesModified.length > 0 && (
            <div className="text-sm">
              <div className="text-yellow-600 dark:text-yellow-400 font-medium mb-1">
                수정된 파일:
              </div>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 text-xs space-y-0.5">
                {activity.details.filesModified.slice(0, 10).map((file, i) => (
                  <li key={i} className="truncate">{file}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Git 정보 */}
          {activity.gitInfo && (
            <div className="text-sm">
              <div className="text-purple-600 dark:text-purple-400 font-medium mb-1">
                Git:
              </div>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                {JSON.stringify(activity.gitInfo, null, 2)}
              </pre>
            </div>
          )}

          {/* 에러 메시지 */}
          {activity.details.error && (
            <div className="text-sm">
              <div className="text-red-600 dark:text-red-400 font-medium mb-1">
                오류:
              </div>
              <pre className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-2 rounded overflow-x-auto">
                {activity.details.error}
              </pre>
            </div>
          )}

          {/* 결과 요약 */}
          {activity.details.result && (
            <div className="text-sm">
              <div className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                결과:
              </div>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                {activity.details.result}
              </pre>
            </div>
          )}

          {/* 프로젝트 경로 */}
          {activity.projectPath && (
            <div className="text-xs text-gray-500">
              📂 {activity.projectPath}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ActivityFeed
