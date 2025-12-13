'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, Link2, Unlink, ChevronDown, Loader2, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DeployedAgent, ChainConfig, ChainInputMapping } from '@/types/database'

interface AgentChainConfigProps {
  agentId: string
  currentAgent: DeployedAgent
  onUpdate?: (agent: DeployedAgent) => void
  className?: string
}

const INPUT_MAPPING_OPTIONS: { value: ChainInputMapping; label: string; description: string }[] = [
  { value: 'full', label: '전체 전달', description: '이전 에이전트의 결과 전체를 전달' },
  { value: 'summary', label: '요약만', description: '결과의 요약본만 전달' },
  { value: 'custom', label: '커스텀', description: '직접 정의한 형식으로 전달' },
]

export function AgentChainConfig({ agentId, currentAgent, onUpdate, className }: AgentChainConfigProps) {
  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nextAgentId, setNextAgentId] = useState<string | null>(currentAgent.next_agent_id)
  const [chainConfig, setChainConfig] = useState<ChainConfig>(
    currentAgent.chain_config || {
      auto_trigger: true,
      input_mapping: 'full',
      delay_seconds: 0,
    }
  )
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 모든 에이전트 목록 가져오기
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents')
        if (res.ok) {
          const data = await res.json()
          // 현재 에이전트를 제외하고, 순환 참조 방지
          const filteredAgents = data.filter((a: DeployedAgent) =>
            a.id !== agentId &&
            !wouldCreateCycle(agentId, a.id, data)
          )
          setAgents(filteredAgents)
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [agentId])

  // 순환 참조 체크
  function wouldCreateCycle(sourceId: string, targetId: string, allAgents: DeployedAgent[]): boolean {
    const visited = new Set<string>()
    let currentId: string | null = targetId

    while (currentId && !visited.has(currentId)) {
      if (currentId === sourceId) return true
      visited.add(currentId)
      const agent = allAgents.find(a => a.id === currentId)
      currentId = agent?.next_agent_id || null
    }

    return false
  }

  // 저장
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_agent_id: nextAgentId,
          chain_config: chainConfig,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
      }
    } catch (error) {
      console.error('Failed to save chain config:', error)
    } finally {
      setSaving(false)
    }
  }

  // 연결 해제
  const handleDisconnect = async () => {
    setNextAgentId(null)
    await handleSave()
  }

  const selectedAgent = agents.find(a => a.id === nextAgentId)

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <Link2 className="w-4 h-4" />
        <span>에이전트 체이닝</span>
      </div>

      <p className="text-xs text-zinc-500">
        이 에이전트의 작업이 완료되면 자동으로 다음 에이전트에게 결과를 전달합니다.
      </p>

      {/* 현재 연결 상태 */}
      <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-lg">
            🤖
          </div>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {currentAgent.name}
          </span>
        </div>

        <ArrowRight className="w-4 h-4 text-zinc-400" />

        {nextAgentId && selectedAgent ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-lg">
              🤖
            </div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {selectedAgent.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-400">
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
              <span className="text-sm">?</span>
            </div>
            <span className="text-sm">연결 없음</span>
          </div>
        )}

        {nextAgentId && (
          <button
            onClick={handleDisconnect}
            className="ml-auto p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
            title="연결 해제"
          >
            <Unlink className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 에이전트 선택 */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
          다음 에이전트 선택
        </label>
        <select
          value={nextAgentId || ''}
          onChange={(e) => setNextAgentId(e.target.value || null)}
          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
        >
          <option value="">연결 없음</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              🤖 {agent.name}
              {agent.capabilities?.length > 0 && ` (${agent.capabilities.slice(0, 2).join(', ')})`}
            </option>
          ))}
        </select>
      </div>

      {/* 고급 설정 토글 */}
      {nextAgentId && (
        <>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>고급 설정</span>
            <ChevronDown className={cn(
              'w-3.5 h-3.5 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
          </button>

          {showAdvanced && (
            <div className="space-y-3 p-3 bg-zinc-100 dark:bg-zinc-800/30 rounded-lg">
              {/* 자동 트리거 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chainConfig.auto_trigger}
                  onChange={(e) => setChainConfig(prev => ({ ...prev, auto_trigger: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">자동 실행</span>
                <span className="text-xs text-zinc-500">(작업 완료 시 자동으로 다음 에이전트 실행)</span>
              </label>

              {/* 입력 매핑 */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  결과 전달 방식
                </label>
                <div className="space-y-2">
                  {INPUT_MAPPING_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                        chainConfig.input_mapping === option.value
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                          : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
                      )}
                    >
                      <input
                        type="radio"
                        name="inputMapping"
                        value={option.value}
                        checked={chainConfig.input_mapping === option.value}
                        onChange={(e) => setChainConfig(prev => ({
                          ...prev,
                          input_mapping: e.target.value as ChainInputMapping
                        }))}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {option.label}
                        </span>
                        <p className="text-xs text-zinc-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 커스텀 프롬프트 */}
              {chainConfig.input_mapping === 'custom' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                    커스텀 프롬프트
                  </label>
                  <textarea
                    value={chainConfig.custom_prompt || ''}
                    onChange={(e) => setChainConfig(prev => ({ ...prev, custom_prompt: e.target.value }))}
                    placeholder="{{output}}, {{sources}}, {{agent_name}} 변수 사용 가능"
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none h-20"
                  />
                </div>
              )}

              {/* 딜레이 */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  실행 딜레이 (초)
                </label>
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={chainConfig.delay_seconds}
                  onChange={(e) => setChainConfig(prev => ({ ...prev, delay_seconds: parseInt(e.target.value) || 0 }))}
                  className="w-24 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* 조건 */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  실행 조건 (선택)
                </label>
                <select
                  value={chainConfig.condition || ''}
                  onChange={(e) => setChainConfig(prev => ({ ...prev, condition: e.target.value || null }))}
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">항상 실행</option>
                  <option value="success">성공 시에만</option>
                  <option value="has_sources">출처가 있을 때만</option>
                  <option value="has_output">출력이 충분할 때만</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors',
          'bg-emerald-500 hover:bg-emerald-600 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2'
        )}
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            저장 중...
          </>
        ) : (
          '저장'
        )}
      </button>
    </div>
  )
}
