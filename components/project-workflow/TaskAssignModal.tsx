'use client'

import { useState, useEffect } from 'react'
import { X, User, Bot, Play, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectTaskWithAssignee, User as UserType, DeployedAgent } from '@/types/database'

interface TaskAssignModalProps {
  task: ProjectTaskWithAssignee
  projectId: string
  onAssign: (taskId: string, assigneeType: 'human' | 'agent', assigneeId: string, autoExecute?: boolean) => void
  onClose: () => void
}

interface ProjectMember {
  id: string
  user_id: string
  role: string
  user: UserType
}

interface ProjectAgent {
  id: string
  agent_id: string
  role: string
  agent: DeployedAgent
}

export function TaskAssignModal({ task, projectId, onAssign, onClose }: TaskAssignModalProps) {
  const [tab, setTab] = useState<'human' | 'agent'>(task.assignee_type || 'human')
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [agents, setAgents] = useState<ProjectAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(
    task.assignee_type === 'human' ? task.assignee_user_id : task.assignee_agent_id
  )
  const [autoExecute, setAutoExecute] = useState(true)
  const [assigning, setAssigning] = useState(false)

  // Fetch project members and agents
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [membersRes, agentsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/members`),
          fetch(`/api/projects/${projectId}/agents`),
        ])

        if (membersRes.ok) {
          const data = await membersRes.json()
          setMembers(data || [])
        }

        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(data || [])
        }
      } catch (error) {
        console.error('Failed to fetch assignees:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId])

  const handleAssign = async () => {
    if (!selectedId) return

    setAssigning(true)
    try {
      await onAssign(task.id, tab, selectedId, tab === 'agent' && autoExecute)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              태스크 할당
            </h2>
            <p className="text-sm text-zinc-500 truncate">{task.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => {
              setTab('human')
              setSelectedId(null)
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              tab === 'human'
                ? 'text-accent border-b-2 border-accent'
                : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <User className="w-4 h-4" />
            팀원
          </button>
          <button
            onClick={() => {
              setTab('agent')
              setSelectedId(null)
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
              tab === 'agent'
                ? 'text-accent border-b-2 border-accent'
                : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <Bot className="w-4 h-4" />
            AI 에이전트
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : tab === 'human' ? (
            <div className="space-y-2">
              {members.length > 0 ? (
                members.map(member => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedId(member.user_id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                      selectedId === member.user_id
                        ? 'border-accent bg-accent/5'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-accent/50'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {member.user.avatar_url ? (
                        <img src={member.user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        {member.user.name}
                      </p>
                      <p className="text-xs text-zinc-500">{member.role}</p>
                    </div>
                    {selectedId === member.user_id && (
                      <Check className="w-5 h-5 text-accent" />
                    )}
                  </button>
                ))
              ) : (
                <p className="text-center text-zinc-500 py-8">
                  프로젝트에 할당된 팀원이 없습니다
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {agents.length > 0 ? (
                agents.map(pa => (
                  <button
                    key={pa.id}
                    onClick={() => setSelectedId(pa.agent_id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                      selectedId === pa.agent_id
                        ? 'border-accent bg-accent/5'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-accent/50'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden">
                      {pa.agent.avatar_url ? (
                        <img src={pa.agent.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-5 h-5 text-accent" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        {pa.agent.name}
                      </p>
                      <p className="text-xs text-zinc-500 line-clamp-1">
                        {pa.agent.description || pa.role}
                      </p>
                      {pa.agent.capabilities && pa.agent.capabilities.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {pa.agent.capabilities.slice(0, 3).map((cap, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedId === pa.agent_id && (
                      <Check className="w-5 h-5 text-accent" />
                    )}
                  </button>
                ))
              ) : (
                <p className="text-center text-zinc-500 py-8">
                  프로젝트에 할당된 에이전트가 없습니다
                </p>
              )}

              {/* Auto-execute option */}
              {agents.length > 0 && selectedId && (
                <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoExecute}
                      onChange={(e) => setAutoExecute(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-accent focus:ring-accent"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        즉시 실행
                      </p>
                      <p className="text-xs text-zinc-500">
                        할당 후 바로 에이전트가 태스크를 수행합니다
                      </p>
                    </div>
                    <Play className="w-4 h-4 text-green-500" />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedId || assigning}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-accent text-white hover:bg-accent/90 transition-colors',
              (!selectedId || assigning) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {assigning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : tab === 'agent' ? (
              <Bot className="w-4 h-4" />
            ) : (
              <User className="w-4 h-4" />
            )}
            {assigning ? '할당 중...' : '할당'}
          </button>
        </div>
      </div>
    </div>
  )
}
