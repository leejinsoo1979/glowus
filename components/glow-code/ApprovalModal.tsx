'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Check,
  XCircle,
  AlertTriangle,
  FileText,
  Terminal,
  Edit,
  Trash2,
  Shield,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useApprovalStore,
  type ApprovalRequest,
  RISK_COLORS,
  RISK_BG_COLORS,
  RISK_LABELS,
  getToolDescription,
  generateSimpleDiff,
} from '@/lib/glow-code/approval-system'

// Claude Code 브랜드 색상
const CLAUDE_ORANGE = '#D97757'

// 도구별 아이콘
const TOOL_ICONS: Record<string, React.ReactNode> = {
  Write: <FileText className="w-5 h-5" />,
  Edit: <Edit className="w-5 h-5" />,
  Delete: <Trash2 className="w-5 h-5" />,
  Bash: <Terminal className="w-5 h-5" />,
  MultiEdit: <Edit className="w-5 h-5" />,
}

interface ApprovalModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ApprovalModal({ isOpen, onClose }: ApprovalModalProps) {
  const {
    activeRequest,
    pendingRequests,
    approveRequest,
    rejectRequest,
    modifyRequest,
    setActiveRequest,
  } = useApprovalStore()

  const [showDiff, setShowDiff] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [copied, setCopied] = useState(false)

  // activeRequest가 변경되면 편집 내용 초기화
  useEffect(() => {
    if (activeRequest) {
      setEditedContent(activeRequest.newContent || activeRequest.command || '')
      setEditMode(false)
    }
  }, [activeRequest?.id])

  if (!isOpen || !activeRequest) return null

  const request = activeRequest
  const riskLevel = request.riskLevel || 'low'

  // diff 생성
  const diff = request.oldContent && request.newContent
    ? generateSimpleDiff(request.oldContent, request.newContent)
    : null

  const handleApprove = () => {
    if (editMode && editedContent !== (request.newContent || request.command)) {
      modifyRequest(request.id, editedContent)
    } else {
      approveRequest(request.id)
    }
  }

  const handleReject = () => {
    rejectRequest(request.id)
  }

  const handleCopy = () => {
    const content = request.newContent || request.command || ''
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5" style={{ color: CLAUDE_ORANGE }} />
            <span className="font-medium text-white">변경 승인 필요</span>
            {pendingRequests.length > 1 && (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                {pendingRequests.findIndex(r => r.id === request.id) + 1} / {pendingRequests.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Risk Badge & Tool Info */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-2 py-1 rounded border",
            RISK_BG_COLORS[riskLevel]
          )}>
            {riskLevel === 'critical' || riskLevel === 'high' ? (
              <AlertTriangle className={cn("w-4 h-4", RISK_COLORS[riskLevel])} />
            ) : null}
            <span className={cn("text-sm font-medium", RISK_COLORS[riskLevel])}>
              위험도: {RISK_LABELS[riskLevel]}
            </span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400">
            {TOOL_ICONS[request.toolName]}
            <span className="text-sm">{getToolDescription(request)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* File Path */}
          {request.filePath && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">파일 경로</div>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-2 py-1 rounded block">
                {request.filePath}
              </code>
            </div>
          )}

          {/* Command (Bash) */}
          {request.command && (
            <div>
              <div className="text-xs text-zinc-500 mb-1">실행할 명령어</div>
              <div className="relative">
                {editMode ? (
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full bg-zinc-800 text-green-400 font-mono text-sm p-3 rounded border border-zinc-700 focus:border-zinc-600 focus:outline-none resize-none"
                    rows={3}
                  />
                ) : (
                  <code className="text-sm text-green-400 bg-zinc-800 px-3 py-2 rounded block font-mono">
                    $ {request.command}
                  </code>
                )}
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-white"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Diff View */}
          {diff && (
            <div>
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-2 text-xs text-zinc-500 mb-2 hover:text-zinc-300"
              >
                {showDiff ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span>변경 내용 {showDiff ? '숨기기' : '보기'}</span>
              </button>

              {showDiff && (
                <div className="bg-zinc-800 rounded border border-zinc-700 overflow-hidden">
                  <pre className="text-xs font-mono p-3 overflow-x-auto max-h-60 overflow-y-auto">
                    {diff.split('\n').map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          line.startsWith('+') && !line.startsWith('+++') ? 'text-green-400 bg-green-900/20' :
                          line.startsWith('-') && !line.startsWith('---') ? 'text-red-400 bg-red-900/20' :
                          'text-zinc-400'
                        )}
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* New Content (Write) */}
          {request.toolName === 'Write' && request.newContent && !diff && (
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>새 파일 내용</span>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="text-zinc-400 hover:text-white"
                >
                  {editMode ? '미리보기' : '편집'}
                </button>
              </div>
              {editMode ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full bg-zinc-800 text-zinc-300 font-mono text-xs p-3 rounded border border-zinc-700 focus:border-zinc-600 focus:outline-none resize-none"
                  rows={15}
                />
              ) : (
                <pre className="text-xs font-mono bg-zinc-800 p-3 rounded border border-zinc-700 overflow-x-auto max-h-60 overflow-y-auto text-zinc-300">
                  {request.newContent}
                </pre>
              )}
            </div>
          )}

          {/* Description */}
          {request.description && (
            <div className="text-sm text-zinc-400 bg-zinc-800/50 p-3 rounded">
              💡 {request.description}
            </div>
          )}

          {/* Warning for high/critical */}
          {(riskLevel === 'high' || riskLevel === 'critical') && (
            <div className={cn(
              "flex items-start gap-3 p-3 rounded border",
              RISK_BG_COLORS[riskLevel]
            )}>
              <AlertTriangle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", RISK_COLORS[riskLevel])} />
              <div className="text-sm">
                <div className={cn("font-medium", RISK_COLORS[riskLevel])}>
                  {riskLevel === 'critical' ? '⚠️ 매우 위험한 작업입니다!' : '⚠️ 주의가 필요한 작업입니다'}
                </div>
                <div className="text-zinc-400 mt-1">
                  {riskLevel === 'critical'
                    ? '이 작업은 시스템에 심각한 영향을 줄 수 있습니다. 신중하게 검토해주세요.'
                    : '변경 내용을 꼼꼼히 확인한 후 승인해주세요.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
          {/* Skip to next */}
          {pendingRequests.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const currentIndex = pendingRequests.findIndex(r => r.id === request.id)
                  const nextRequest = pendingRequests[(currentIndex + 1) % pendingRequests.length]
                  setActiveRequest(nextRequest)
                }}
                className="text-sm text-zinc-400 hover:text-white"
              >
                다음으로 건너뛰기 →
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            {/* Reject */}
            <button
              onClick={handleReject}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>거부</span>
            </button>

            {/* Approve */}
            <button
              onClick={handleApprove}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors"
              style={{ backgroundColor: CLAUDE_ORANGE }}
            >
              <Check className="w-4 h-4" />
              <span>{editMode ? '수정 후 승인' : '승인'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 🔥 승인 요청 뱃지 (pending 개수 표시)
export function ApprovalBadge() {
  const pendingCount = useApprovalStore(state => state.pendingRequests.length)
  const setActiveRequest = useApprovalStore(state => state.setActiveRequest)
  const pendingRequests = useApprovalStore(state => state.pendingRequests)

  if (pendingCount === 0) return null

  return (
    <button
      onClick={() => setActiveRequest(pendingRequests[0])}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-colors animate-pulse"
    >
      <Shield className="w-4 h-4" />
      <span className="text-sm font-medium">{pendingCount}개 승인 대기</span>
    </button>
  )
}

export default ApprovalModal
