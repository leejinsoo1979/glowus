'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, ArrowRight, Loader2, Users, Plus, ChevronDown, ClipboardList, CheckCircle, XCircle } from 'lucide-react'
import type { DeployedAgent, AgentMessage, AgentConversation } from '@/types/database'

interface TaskAnalysis {
  title: string
  summary: string
  steps: string[]
  expected_output: string
  estimated_time: string
  clarifications: string[]
  confidence: number
}

interface PendingTask {
  analysis: TaskAnalysis
  confirmation_message: string
  original_instruction: string
  agent_id: string
}

interface AgentChatPanelProps {
  agents: DeployedAgent[]
  currentConversation?: AgentConversation
  onNewConversation?: (agentIds: string[]) => Promise<AgentConversation>
  onSendMessage?: (message: string, receiverAgentId: string, delegateToAgentId?: string) => Promise<void>
  messages: AgentMessage[]
  isLoading?: boolean
}

export function AgentChatPanel({
  agents,
  currentConversation,
  onNewConversation,
  onSendMessage,
  messages,
  isLoading = false,
}: AgentChatPanelProps) {
  const [input, setInput] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<DeployedAgent | null>(null)
  const [delegateAgent, setDelegateAgent] = useState<DeployedAgent | null>(null)
  const [showAgentSelector, setShowAgentSelector] = useState(false)
  const [showDelegateSelector, setShowDelegateSelector] = useState(false)
  const [isTaskMode, setIsTaskMode] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null)
  const [isExecutingTask, setIsExecutingTask] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Set default selected agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      setSelectedAgent(agents[0])
    }
  }, [agents, selectedAgent])

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || !onSendMessage) return

    const message = input.trim()
    setInput('')

    await onSendMessage(
      message,
      selectedAgent.id,
      delegateAgent?.id
    )

    setDelegateAgent(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isTaskMode) {
        handleTaskInstruction()
      } else {
        handleSend()
      }
    }
  }

  // 업무 지시 분석 요청
  const handleTaskInstruction = async () => {
    if (!input.trim() || !selectedAgent) return

    const instruction = input.trim()
    setInput('')
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/agent-tasks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          agent_id: selectedAgent.id,
        }),
      })

      if (!response.ok) {
        throw new Error('업무 분석 실패')
      }

      const data = await response.json()
      setPendingTask({
        analysis: data.analysis,
        confirmation_message: data.confirmation_message,
        original_instruction: instruction,
        agent_id: selectedAgent.id,
      })
    } catch (error) {
      console.error('업무 분석 오류:', error)
      // Show error in chat
      if (onSendMessage && selectedAgent) {
        await onSendMessage(`[시스템] 업무 분석 중 오류가 발생했습니다: ${error}`, selectedAgent.id)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 업무 실행 승인
  const handleConfirmTask = async () => {
    if (!pendingTask || !selectedAgent) return

    setIsExecutingTask(true)

    try {
      const response = await fetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pendingTask.analysis.title,
          description: pendingTask.analysis.summary,
          instructions: pendingTask.original_instruction,
          assignee_agent_id: pendingTask.agent_id,
          conversation_id: currentConversation?.id,
          auto_execute: true,
        }),
      })

      if (!response.ok) {
        throw new Error('업무 생성 실패')
      }

      const task = await response.json()

      // Send confirmation message to chat
      if (onSendMessage) {
        await onSendMessage(
          `✅ 업무를 시작합니다!\n\n📋 **${pendingTask.analysis.title}**\n\n결과:\n${task.result || '처리 완료'}`,
          selectedAgent.id
        )
      }

      setPendingTask(null)
      setIsTaskMode(false)
    } catch (error) {
      console.error('업무 실행 오류:', error)
    } finally {
      setIsExecutingTask(false)
    }
  }

  // 업무 취소
  const handleCancelTask = () => {
    setPendingTask(null)
    setIsTaskMode(false)
  }

  const getAgentById = useCallback((id: string) => {
    return agents.find(a => a.id === id)
  }, [agents])

  const renderMessage = (msg: AgentMessage, index: number) => {
    const isUser = msg.sender_type === 'USER'
    const isAgentToAgent = msg.message_type === 'AGENT_TO_AGENT'
    const senderAgent = msg.sender_agent_id ? getAgentById(msg.sender_agent_id) : null

    return (
      <div
        key={msg.id || index}
        className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${isAgentToAgent ? 'opacity-80' : ''}`}
      >
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-500'
            : isAgentToAgent
            ? 'bg-purple-500'
            : 'bg-emerald-500'
        }`}>
          {isUser ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <Bot className="w-4 h-4 text-white" />
          )}
        </div>

        {/* Message content */}
        <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Sender name */}
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            {isUser ? '나' : senderAgent?.name || '에이전트'}
            {isAgentToAgent && (
              <span className="ml-1 text-purple-500">
                <ArrowRight className="inline w-3 h-3" />
                {msg.receiver_agent_id ? getAgentById(msg.receiver_agent_id)?.name : '에이전트'}
              </span>
            )}
          </span>

          {/* Message bubble */}
          <div className={`rounded-2xl px-4 py-2 ${
            isUser
              ? 'bg-blue-500 text-white'
              : isAgentToAgent
              ? 'bg-purple-100 dark:bg-purple-900/30 text-zinc-800 dark:text-zinc-200'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
          }`}>
            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
          </div>

          {/* Timestamp */}
          <span className="text-xs text-zinc-400 mt-1">
            {new Date(msg.created_at).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-zinc-500" />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {currentConversation?.title || '에이전트 채팅'}
          </span>
        </div>

        {/* Agent selector */}
        <div className="relative">
          <button
            onClick={() => setShowAgentSelector(!showAgentSelector)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {selectedAgent ? (
              <>
                <img
                  src={selectedAgent.avatar_url || ''}
                  alt={selectedAgent.name}
                  className="w-5 h-5 rounded-full"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {selectedAgent.name}
                </span>
              </>
            ) : (
              <span className="text-sm text-zinc-500">에이전트 선택</span>
            )}
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>

          {showAgentSelector && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-10">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgent(agent)
                    setShowAgentSelector(false)
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg"
                >
                  <img
                    src={agent.avatar_url || ''}
                    alt={agent.name}
                    className="w-6 h-6 rounded-full"
                  />
                  <div className="flex flex-col items-start">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {agent.name}
                    </span>
                    <span className={`text-xs ${
                      agent.status === 'ACTIVE' ? 'text-emerald-500' : 'text-zinc-400'
                    }`}>
                      {agent.status === 'ACTIVE' ? '활성' : '비활성'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <Bot className="w-12 h-12 mb-2" />
            <p className="text-sm">에이전트와 대화를 시작하세요</p>
            <p className="text-xs mt-1">다른 에이전트에게 작업을 위임할 수도 있습니다</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => renderMessage(msg, i))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Delegate agent indicator */}
      {delegateAgent && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <ArrowRight className="w-4 h-4 text-purple-500" />
          <span className="text-sm text-purple-600 dark:text-purple-400">
            {selectedAgent?.name}이(가) {delegateAgent.name}에게 작업을 위임합니다
          </span>
          <button
            onClick={() => setDelegateAgent(null)}
            className="ml-auto text-purple-500 hover:text-purple-600 text-sm"
          >
            취소
          </button>
        </div>
      )}

      {/* Task mode indicator */}
      {isTaskMode && !pendingTask && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            <strong>업무 지시 모드</strong> - 원하는 업무를 자유롭게 말씀하세요. 제가 정리해드릴게요!
          </span>
          <button
            onClick={() => setIsTaskMode(false)}
            className="ml-auto text-amber-600 hover:text-amber-700 text-sm"
          >
            취소
          </button>
        </div>
      )}

      {/* Analyzing indicator */}
      {isAnalyzing && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span className="text-sm text-blue-600 dark:text-blue-400">
            업무 내용을 분석하고 있습니다...
          </span>
        </div>
      )}

      {/* Pending task confirmation */}
      {pendingTask && (
        <div className="mx-4 mb-2 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                {pendingTask.confirmation_message}
              </div>

              {/* Confidence indicator */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-zinc-500">이해도:</span>
                <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden max-w-[100px]">
                  <div
                    className={`h-full rounded-full ${
                      pendingTask.analysis.confidence > 0.8 ? 'bg-emerald-500' :
                      pendingTask.analysis.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pendingTask.analysis.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500">{Math.round(pendingTask.analysis.confidence * 100)}%</span>
              </div>

              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleConfirmTask}
                  disabled={isExecutingTask}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isExecutingTask ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {isExecutingTask ? '실행 중...' : '네, 진행해주세요'}
                </button>
                <button
                  onClick={handleCancelTask}
                  disabled={isExecutingTask}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-2">
          {/* Delegate button */}
          <div className="relative">
            <button
              onClick={() => setShowDelegateSelector(!showDelegateSelector)}
              disabled={isTaskMode || !!pendingTask}
              className={`p-2 rounded-lg transition-colors ${
                delegateAgent
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="다른 에이전트에게 위임"
            >
              <Users className="w-5 h-5" />
            </button>

            {showDelegateSelector && (
              <div className="absolute left-0 bottom-full mb-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-10">
                <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500">작업 위임 대상 선택</span>
                </div>
                {agents
                  .filter(a => a.id !== selectedAgent?.id)
                  .map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setDelegateAgent(agent)
                        setShowDelegateSelector(false)
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <img
                        src={agent.avatar_url || ''}
                        alt={agent.name}
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {agent.name}
                      </span>
                    </button>
                  ))}
                {agents.filter(a => a.id !== selectedAgent?.id).length === 0 && (
                  <div className="px-3 py-2 text-sm text-zinc-400">
                    다른 에이전트가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!pendingTask || isAnalyzing}
              placeholder={
                isTaskMode
                  ? '업무 내용을 자유롭게 입력하세요... (예: "경쟁사 분석해줘", "보고서 작성해줘")'
                  : delegateAgent
                  ? `${selectedAgent?.name}에게 ${delegateAgent.name}로 위임할 작업을 입력...`
                  : `${selectedAgent?.name || '에이전트'}에게 메시지 입력...`
              }
              className={`w-full px-4 py-2 pr-24 rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                isTaskMode
                  ? 'border-amber-300 dark:border-amber-700 focus:ring-amber-500'
                  : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500'
              }`}
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />

            {/* Task mode button */}
            <button
              onClick={() => {
                if (isTaskMode) {
                  handleTaskInstruction()
                } else {
                  setIsTaskMode(true)
                  setDelegateAgent(null)
                }
              }}
              disabled={!selectedAgent || isAnalyzing || !!pendingTask || (isTaskMode && !input.trim())}
              className={`absolute right-12 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isTaskMode
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
              title={isTaskMode ? '업무 지시 전송' : '업무 지시 모드'}
            >
              <ClipboardList className="w-4 h-4" />
            </button>

            {/* Send button */}
            <button
              onClick={isTaskMode ? handleTaskInstruction : handleSend}
              disabled={!input.trim() || !selectedAgent || isLoading || isAnalyzing || !!pendingTask}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                isTaskMode
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isLoading || isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
