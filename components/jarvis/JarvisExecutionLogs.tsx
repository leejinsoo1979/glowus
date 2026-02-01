'use client'

/**
 * Jarvis 실행 로그 뷰어
 * 과거 실행 기록을 표시
 */

import { useEffect } from 'react'
import { useJarvisTools, ExecutionLog } from '@/hooks/useJarvisTools'
import { cn } from '@/lib/utils'

const STATUS_STYLES = {
  SUCCESS: 'text-green-400',
  FAILED: 'text-red-400',
  CANCELLED: 'text-zinc-400',
}

interface JarvisExecutionLogsProps {
  className?: string
  limit?: number
}

export function JarvisExecutionLogs({ className, limit = 20 }: JarvisExecutionLogsProps) {
  const { logs, loadLogs, isLoading } = useJarvisTools()

  useEffect(() => {
    loadLogs(limit)
  }, [loadLogs, limit])

  if (isLoading && logs.length === 0) {
    return (
      <div className={cn('bg-zinc-900/80 border border-zinc-800 rounded-lg p-4', className)}>
        <p className="text-zinc-500 text-sm">로딩 중...</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className={cn('bg-zinc-900/80 border border-zinc-800 rounded-lg p-4', className)}>
        <p className="text-zinc-500 text-sm">실행 기록이 없습니다</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-zinc-900/80 border border-zinc-800 rounded-lg p-4', className)}>
      <h3 className="text-sm font-medium text-zinc-200 mb-3">
        실행 기록 ({logs.length})
      </h3>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {logs.map((log) => (
          <LogItem key={log.id} log={log} />
        ))}
      </div>

      <button
        onClick={() => loadLogs(limit)}
        className="mt-3 w-full px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
      >
        새로고침
      </button>
    </div>
  )
}

function LogItem({ log }: { log: ExecutionLog }) {
  const time = new Date(log.createdAt).toLocaleString()
  const isSuccess = log.status === 'SUCCESS'

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-mono', STATUS_STYLES[log.status])}>
            {isSuccess ? '✓' : '✕'}
          </span>
          <span className="text-sm font-medium text-zinc-200">{log.toolName}</span>
        </div>
        <span className="text-xs text-zinc-500">{time}</span>
      </div>

      {log.error && (
        <p className="text-xs text-red-400 mt-1">{log.error}</p>
      )}

      {isSuccess && log.result && Object.keys(log.result).length > 0 && (
        <details className="mt-1">
          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-400">
            결과 보기
          </summary>
          <pre className="text-xs bg-zinc-900 rounded p-2 mt-1 overflow-x-auto text-zinc-400">
            {JSON.stringify(log.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
