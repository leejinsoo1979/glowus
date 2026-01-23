'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MyNeuronNode, MyNeuronType } from '@/lib/my-neurons/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  X,
  ExternalLink,
  Calendar,
  Clock,
  Target,
  CheckCircle2,
  Circle,
  ChevronRight,
  FileText,
  User,
  Bot,
  Briefcase,
  Flag,
  Lightbulb,
  DollarSign,
  Milestone,
  Brain,
  Workflow,
  Edit3,
  Eye,
  Save,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link,
  Heading1,
  Heading2,
  Quote,
} from 'lucide-react'

// 노드 타입별 아이콘
const NODE_TYPE_ICONS: Record<MyNeuronType, React.ElementType> = {
  self: Brain,
  project: Briefcase,
  task: CheckCircle2,
  doc: FileText,
  person: User,
  agent: Bot,
  objective: Target,
  key_result: Flag,
  decision: Lightbulb,
  memory: Clock,
  workflow: Workflow,
  insight: Lightbulb,
  program: Briefcase,
  application: FileText,
  milestone: Milestone,
  budget: DollarSign,
}

// 노드 타입별 라벨
const NODE_TYPE_LABELS: Record<MyNeuronType, string> = {
  self: '나',
  project: '프로젝트',
  task: '작업',
  doc: '문서',
  person: '팀원',
  agent: '에이전트',
  objective: '목표',
  key_result: '핵심결과',
  decision: '의사결정',
  memory: '기록',
  workflow: '워크플로우',
  insight: '인사이트',
  program: '정부지원사업',
  application: '지원서',
  milestone: '마일스톤',
  budget: '예산',
}

// 상태별 색상
const STATUS_COLORS = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
  urgent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  waiting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  attention: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

// 우선순위 색상
const PRIORITY_COLORS = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-zinc-500/20 text-zinc-400',
}

interface NodeDetailPanelProps {
  node: MyNeuronNode | null
  connectedNodes: MyNeuronNode[]
  onClose: () => void
  onNavigate: (sourceTable: string, sourceId: string) => void
  onSelectNode: (nodeId: string) => void
  width?: number
}

export function NodeDetailPanel({
  node,
  connectedNodes,
  onClose,
  onNavigate,
  onSelectNode,
  width = 400,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'info' | 'connections'>('editor')
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // 노드 변경 시 content 초기화
  useEffect(() => {
    if (node) {
      console.log('[NodeDetailPanel] Node changed, setting content:', node.id, node.title, 'content:', node.content?.slice(0, 50), 'summary:', node.summary?.slice(0, 50))
      setContent(node.content || node.summary || '')
      setIsEditing(false) // 노드 변경 시 편집 모드 해제
    }
  }, [node?.id, node?.content, node?.summary])

  // 마크다운 툴바 버튼
  const insertMarkdown = useCallback((prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('node-content-editor') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newText = content.substring(0, start) + prefix + selectedText + suffix + content.substring(end)

    setContent(newText)

    // 커서 위치 조정
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length)
    }, 0)
  }, [content])

  // 저장 핸들러
  const handleSave = useCallback(async () => {
    if (!node) return
    setIsSaving(true)

    try {
      // TODO: API 호출하여 저장
      console.log('Saving content for node:', node.id, content)
      await new Promise(resolve => setTimeout(resolve, 500)) // 시뮬레이션
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }, [node, content])

  if (!node) return null

  const Icon = NODE_TYPE_ICONS[node.type] || Circle
  const typeLabel = NODE_TYPE_LABELS[node.type] || node.type

  return (
    <motion.div
      key="node-detail-panel"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="h-full border-l border-zinc-800 bg-zinc-900/95 flex flex-col overflow-hidden flex-shrink-0"
      style={{ width }}
    >
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${node.color || '#6b7280'}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: node.color || '#6b7280' }} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-white truncate">{node.title}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{typeLabel}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status & Priority Badges */}
          <div className="flex items-center gap-2 mt-3">
            <span
              className={cn(
                'px-2 py-0.5 rounded text-xs border',
                STATUS_COLORS[node.status] || STATUS_COLORS.active
              )}
            >
              {node.status === 'active' && '활성'}
              {node.status === 'blocked' && '차단됨'}
              {node.status === 'urgent' && '긴급'}
              {node.status === 'waiting' && '대기중'}
              {node.status === 'completed' && '완료'}
              {node.status === 'attention' && '주의필요'}
            </span>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-xs',
                PRIORITY_COLORS[node.priority] || PRIORITY_COLORS.medium
              )}
            >
              {node.priority === 'critical' && '최우선'}
              {node.priority === 'high' && '높음'}
              {node.priority === 'medium' && '보통'}
              {node.priority === 'low' && '낮음'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('editor')}
            className={cn(
              'flex-1 px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5',
              activeTab === 'editor'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            문서
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              'flex-1 px-3 py-2 text-sm transition-colors',
              activeTab === 'info'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            정보
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={cn(
              'flex-1 px-3 py-2 text-sm transition-colors',
              activeTab === 'connections'
                ? 'text-white border-b-2 border-blue-500'
                : 'text-zinc-400 hover:text-white'
            )}
          >
            연결 ({connectedNodes.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'editor' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Editor Toolbar */}
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => insertMarkdown('**', '**')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="굵게"
                      >
                        <Bold className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('*', '*')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="기울임"
                      >
                        <Italic className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('# ')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="제목1"
                      >
                        <Heading1 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('## ')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="제목2"
                      >
                        <Heading2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('- ')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="목록"
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('1. ')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="번호 목록"
                      >
                        <ListOrdered className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('`', '`')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="코드"
                      >
                        <Code className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('[', '](url)')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="링크"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => insertMarkdown('> ')}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="인용"
                      >
                        <Quote className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-zinc-500">미리보기</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        title="미리보기"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white text-sm disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? '저장 중...' : '저장'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      편집
                    </button>
                  )}
                </div>
              </div>

              {/* Editor / Preview */}
              <div className="flex-1 overflow-y-auto">
                {isEditing ? (
                  <textarea
                    id="node-content-editor"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="마크다운으로 내용을 작성하세요..."
                    className="w-full h-full p-4 bg-transparent text-zinc-300 text-sm font-mono resize-none focus:outline-none placeholder-zinc-600"
                    style={{ minHeight: '300px' }}
                  />
                ) : (
                  <div className="p-4 prose prose-invert prose-sm max-w-none">
                    {content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-zinc-500 italic">내용이 없습니다. 편집 버튼을 눌러 작성하세요.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'info' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Summary */}
              {node.summary && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">요약</h4>
                  <p className="text-sm text-zinc-300">{node.summary}</p>
                </div>
              )}

              {/* Progress */}
              {typeof node.progress === 'number' && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">진행률</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${node.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-zinc-400">{node.progress}%</span>
                  </div>
                </div>
              )}

              {/* Deadline */}
              {node.deadline && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">마감일</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    <span className="text-zinc-300">
                      {new Date(node.deadline).toLocaleDateString('ko-KR')}
                    </span>
                    {typeof node.daysUntilDeadline === 'number' && (
                      <span
                        className={cn(
                          'ml-2 px-2 py-0.5 rounded text-xs',
                          node.daysUntilDeadline <= 0
                            ? 'bg-red-500/20 text-red-400'
                            : node.daysUntilDeadline <= 3
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-zinc-500/20 text-zinc-400'
                        )}
                      >
                        {node.daysUntilDeadline <= 0
                          ? '마감됨'
                          : `D-${node.daysUntilDeadline}`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Last Activity */}
              {node.lastActivityAt && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">마지막 활동</h4>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Clock className="w-4 h-4" />
                    <span>
                      {new Date(node.lastActivityAt).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {node.tags && node.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-500 mb-2">태그</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {node.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigate to Source */}
              {node.sourceTable && node.sourceId && node.type !== 'self' && (
                <button
                  onClick={() => onNavigate(node.sourceTable, node.sourceId)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  원본으로 이동
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              {connectedNodes.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                  연결된 노드가 없습니다
                </div>
              ) : (
                <div className="space-y-1">
                  {connectedNodes.map((connectedNode) => {
                    const ConnectedIcon = NODE_TYPE_ICONS[connectedNode.type] || Circle
                    return (
                      <button
                        key={connectedNode.id}
                        onClick={() => onSelectNode(connectedNode.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 text-left transition-colors group"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${connectedNode.color || '#6b7280'}20` }}
                        >
                          <ConnectedIcon
                            className="w-4 h-4"
                            style={{ color: connectedNode.color || '#6b7280' }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-300 truncate group-hover:text-white">
                            {connectedNode.title}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {NODE_TYPE_LABELS[connectedNode.type] || connectedNode.type}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
  )
}

export default NodeDetailPanel
