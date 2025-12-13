'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Play,
  Plus,
  Loader2,
  Link2,
  Settings2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeployedAgent, AgentChain, ChainRun, ChainRunStatus } from '@/types/database'

export default function AgentChainsPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [chains, setChains] = useState<AgentChain[]>([])
  const [recentRuns, setRecentRuns] = useState<ChainRun[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showExecuteModal, setShowExecuteModal] = useState(false)
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)
  const [initialInput, setInitialInput] = useState('')
  const [executing, setExecuting] = useState(false)

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, chainsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/agent-chains'),
      ])

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        setAgents(agentsData)
      }

      if (chainsRes.ok) {
        const chainsData = await chainsRes.json()
        setChains(chainsData)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 체이닝된 에이전트 찾기
  const getChainedAgents = (startAgentId: string): DeployedAgent[] => {
    const result: DeployedAgent[] = []
    const visited = new Set<string>()
    let currentId: string | null = startAgentId

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const agent = agents.find(a => a.id === currentId)
      if (agent) {
        result.push(agent)
        currentId = agent.next_agent_id
      } else {
        break
      }
    }

    return result
  }

  // 체인 실행
  const executeChain = async () => {
    if (!selectedChainId || !initialInput.trim()) return

    setExecuting(true)
    try {
      const res = await fetch('/api/agent-chains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          chain_id: selectedChainId,
          initial_input: initialInput,
        }),
      })

      if (res.ok) {
        setShowExecuteModal(false)
        setInitialInput('')
        // 페이지 새로고침 또는 실행 상태 모니터링
        alert('체인 실행이 시작되었습니다!')
      } else {
        const error = await res.json()
        alert(error.error || '체인 실행에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to execute chain:', error)
      alert('체인 실행에 실패했습니다')
    } finally {
      setExecuting(false)
    }
  }

  // 체인을 가진 에이전트들 필터링
  const agentsWithChains = agents.filter(a => a.next_agent_id)

  const getStatusIcon = (status: ChainRunStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'RUNNING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'CANCELLED':
        return <Clock className="w-4 h-4 text-zinc-400" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <Link2 className="w-7 h-7 text-emerald-500" />
            에이전트 체인
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            에이전트들을 연결하여 자동화된 워크플로우를 만들어보세요
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 체인 만들기
        </button>
      </div>

      {/* 연결된 에이전트 목록 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
          연결된 에이전트 ({agentsWithChains.length})
        </h2>

        {agentsWithChains.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <Link2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-zinc-500 mb-2">연결된 에이전트가 없습니다</p>
            <p className="text-sm text-zinc-400">
              에이전트 설정에서 &quot;다음 에이전트&quot;를 선택하여 체인을 만들어보세요
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {agentsWithChains.map((agent) => {
              const chainedAgents = getChainedAgents(agent.id)
              return (
                <div
                  key={agent.id}
                  className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🤖</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {agent.name}
                    </span>
                    <span className="text-xs text-zinc-400">
                      → {chainedAgents.length - 1}개 연결됨
                    </span>
                    <button
                      onClick={() => router.push(`/agent-builder/${agent.id}`)}
                      className="ml-auto p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 체인 시각화 */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {chainedAgents.map((chainAgent, idx) => (
                      <div key={chainAgent.id} className="flex items-center gap-2">
                        <div
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg',
                            idx === 0
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-zinc-100 dark:bg-zinc-800'
                          )}
                        >
                          <span className="text-lg">🤖</span>
                          <div>
                            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {chainAgent.name}
                            </div>
                            {chainAgent.capabilities?.length > 0 && (
                              <div className="text-xs text-zinc-500">
                                {chainAgent.capabilities.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        {idx < chainedAgents.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 체인 설정 요약 */}
                  {agent.chain_config && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full',
                        agent.chain_config.auto_trigger
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                      )}>
                        {agent.chain_config.auto_trigger ? '자동 실행' : '수동 실행'}
                      </span>
                      <span>
                        {agent.chain_config.input_mapping === 'full' && '전체 전달'}
                        {agent.chain_config.input_mapping === 'summary' && '요약만'}
                        {agent.chain_config.input_mapping === 'custom' && '커스텀'}
                      </span>
                      {agent.chain_config.delay_seconds > 0 && (
                        <span>{agent.chain_config.delay_seconds}초 딜레이</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 저장된 체인 목록 */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">
          저장된 체인 ({chains.length})
        </h2>

        {chains.length === 0 ? (
          <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <p className="text-zinc-500 text-sm">저장된 체인이 없습니다</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {chains.map((chain) => (
              <div
                key={chain.id}
                className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-zinc-800 dark:text-zinc-200">
                    {chain.name}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedChainId(chain.id)
                      setShowExecuteModal(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    실행
                  </button>
                </div>
                {chain.description && (
                  <p className="text-sm text-zinc-500 mb-2">{chain.description}</p>
                )}
                <div className="text-xs text-zinc-400">
                  생성: {new Date(chain.created_at).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 체인 실행 모달 */}
      {showExecuteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-6 w-[480px] shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-500" />
              체인 실행
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                초기 입력
              </label>
              <textarea
                value={initialInput}
                onChange={(e) => setInitialInput(e.target.value)}
                placeholder="첫 번째 에이전트에게 전달할 작업 내용을 입력하세요..."
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none h-32"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowExecuteModal(false)
                  setSelectedChainId(null)
                  setInitialInput('')
                }}
                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeChain}
                disabled={executing || !initialInput.trim()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-emerald-500 hover:bg-emerald-600 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    실행 중...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    실행
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
