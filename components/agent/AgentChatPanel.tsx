'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, ArrowRight, Loader2, Users, Plus, ChevronDown } from 'lucide-react'
import type { DeployedAgent, AgentMessage, AgentConversation } from '@/types/database'

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
      handleSend()
    }
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

      {/* Input area */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex gap-2">
          {/* Delegate button */}
          <div className="relative">
            <button
              onClick={() => setShowDelegateSelector(!showDelegateSelector)}
              className={`p-2 rounded-lg transition-colors ${
                delegateAgent
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
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
              placeholder={
                delegateAgent
                  ? `${selectedAgent?.name}에게 ${delegateAgent.name}로 위임할 작업을 입력...`
                  : `${selectedAgent?.name || '에이전트'}에게 메시지 입력...`
              }
              className="w-full px-4 py-2 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedAgent || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              {isLoading ? (
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
