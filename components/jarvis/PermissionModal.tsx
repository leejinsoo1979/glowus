'use client'

/**
 * PermissionModal - Claude Code 도구 실행 권한 승인 UI
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ShieldCheck, ShieldX, Terminal, FileEdit, FolderOpen, Globe, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PermissionRequest } from '@/hooks/useJarvis'

interface PermissionModalProps {
  requests: PermissionRequest[]
  onApprove: (requestId: string) => void
  onDeny: (requestId: string) => void
  onApproveAll?: () => void
  className?: string
}

// 도구 타입별 아이콘
const getToolIcon = (tool: string, action: string) => {
  const lowerAction = action.toLowerCase()

  if (lowerAction.includes('bash') || lowerAction.includes('run') || lowerAction.includes('execute')) {
    return Terminal
  }
  if (lowerAction.includes('write') || lowerAction.includes('edit')) {
    return FileEdit
  }
  if (lowerAction.includes('read') || lowerAction.includes('file')) {
    return FolderOpen
  }
  if (lowerAction.includes('web') || lowerAction.includes('fetch') || lowerAction.includes('http')) {
    return Globe
  }
  return Shield
}

// 위험도 판단
const getDangerLevel = (action: string): 'low' | 'medium' | 'high' => {
  const lowerAction = action.toLowerCase()

  // 고위험
  if (
    lowerAction.includes('rm ') ||
    lowerAction.includes('delete') ||
    lowerAction.includes('sudo') ||
    lowerAction.includes('chmod') ||
    lowerAction.includes('chown')
  ) {
    return 'high'
  }

  // 중위험
  if (
    lowerAction.includes('write') ||
    lowerAction.includes('install') ||
    lowerAction.includes('npm') ||
    lowerAction.includes('git push')
  ) {
    return 'medium'
  }

  return 'low'
}

const dangerColors = {
  low: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    button: 'bg-emerald-600 hover:bg-emerald-500',
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-500',
  },
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    button: 'bg-red-600 hover:bg-red-500',
  },
}

export function PermissionModal({
  requests = [],
  onApprove,
  onDeny,
  onApproveAll,
  className,
}: PermissionModalProps) {
  if (!requests || requests.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={cn(
          "fixed bottom-4 right-4 z-50 w-[400px] max-h-[500px] overflow-hidden",
          "bg-zinc-900/95 backdrop-blur-xl rounded-xl border border-zinc-700/50",
          "shadow-2xl shadow-black/50",
          className
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-white">권한 요청</span>
            <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
              {requests.length}
            </span>
          </div>
          {requests.length > 1 && onApproveAll && (
            <button
              onClick={onApproveAll}
              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              모두 허용
            </button>
          )}
        </div>

        {/* 요청 목록 */}
        <div className="max-h-[400px] overflow-y-auto">
          {requests.map((request, index) => {
            const Icon = getToolIcon(request.tool, request.action)
            const danger = getDangerLevel(request.action)
            const colors = dangerColors[danger]

            return (
              <motion.div
                key={request.requestId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "p-4 border-b border-zinc-800/50 last:border-b-0",
                  colors.bg
                )}
              >
                {/* 도구 정보 */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    colors.bg,
                    colors.border,
                    "border"
                  )}>
                    <Icon className={cn("w-5 h-5", colors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{request.tool}</span>
                      {danger === 'high' && (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 truncate">{request.action}</p>
                  </div>
                </div>

                {/* 상세 내용 (있는 경우) */}
                {request.fullText && (
                  <div className="mb-3 p-2 bg-black/30 rounded-lg">
                    <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
                      {request.fullText.slice(-200)}
                    </pre>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onApprove(request.requestId)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
                      "text-sm font-medium text-white transition-colors",
                      colors.button
                    )}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    허용
                  </button>
                  <button
                    onClick={() => onDeny(request.requestId)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
                      "text-sm font-medium text-white transition-colors",
                      "bg-zinc-700 hover:bg-zinc-600"
                    )}
                  >
                    <ShieldX className="w-4 h-4" />
                    거부
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PermissionModal
