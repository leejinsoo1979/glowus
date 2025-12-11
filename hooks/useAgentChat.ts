'use client'

import { useState, useCallback, useEffect } from 'react'
import type { DeployedAgent, AgentMessage, AgentConversation } from '@/types/database'

interface UseAgentChatOptions {
  conversationId?: string
  autoFetch?: boolean
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { conversationId, autoFetch = true } = options

  const [agents, setAgents] = useState<DeployedAgent[]>([])
  const [conversations, setConversations] = useState<AgentConversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<AgentConversation | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch user's deployed agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('에이전트 조회 실패')
      const data = await res.json()
      setAgents(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : '에이전트 조회 오류')
      return []
    }
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-conversations')
      if (!res.ok) throw new Error('대화 조회 실패')
      const data = await res.json()
      setConversations(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : '대화 조회 오류')
      return []
    }
  }, [])

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/agent-messages?conversation_id=${convId}`)
      if (!res.ok) throw new Error('메시지 조회 실패')
      const data = await res.json()
      setMessages(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : '메시지 조회 오류')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Create a new conversation
  const createConversation = useCallback(async (
    agentIds: string[],
    title?: string
  ): Promise<AgentConversation | null> => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/agent-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_ids: agentIds, title }),
      })
      if (!res.ok) throw new Error('대화 생성 실패')
      const data = await res.json()
      setCurrentConversation(data)
      setConversations(prev => [data, ...prev])
      setMessages([])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : '대화 생성 오류')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Send a message
  const sendMessage = useCallback(async (
    content: string,
    receiverAgentId: string,
    delegateToAgentId?: string
  ) => {
    if (!currentConversation) {
      setError('대화가 선택되지 않았습니다')
      return
    }

    try {
      setIsLoading(true)

      // Optimistic update - add user message immediately
      const tempUserMessage: AgentMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: currentConversation.id,
        sender_type: 'USER',
        sender_user_id: 'temp',
        sender_agent_id: null,
        receiver_type: 'AGENT',
        receiver_user_id: null,
        receiver_agent_id: receiverAgentId,
        message_type: 'USER_TO_AGENT',
        content,
        metadata: null,
        task_id: null,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, tempUserMessage])

      const res = await fetch('/api/agent-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentConversation.id,
          content,
          receiver_agent_id: receiverAgentId,
          delegate_to_agent_id: delegateToAgentId,
        }),
      })

      if (!res.ok) throw new Error('메시지 전송 실패')
      const data = await res.json()

      // Replace temp message with real messages
      setMessages(prev => {
        const filtered = prev.filter(m => !m.id.startsWith('temp-'))
        return [...filtered, data.userMessage, data.agentMessage]
      })

      // If there was delegation, fetch all messages to get agent-to-agent messages
      if (delegateToAgentId) {
        await fetchMessages(currentConversation.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '메시지 전송 오류')
      // Remove temp message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')))
    } finally {
      setIsLoading(false)
    }
  }, [currentConversation, fetchMessages])

  // Select a conversation
  const selectConversation = useCallback(async (conversation: AgentConversation) => {
    setCurrentConversation(conversation)
    await fetchMessages(conversation.id)
  }, [fetchMessages])

  // Deploy a new agent
  const deployAgent = useCallback(async (agentData: {
    name: string
    description?: string
    workflow_nodes: Record<string, unknown>[]
    workflow_edges: Record<string, unknown>[]
    system_prompt?: string
  }): Promise<DeployedAgent | null> => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      })
      if (!res.ok) throw new Error('에이전트 배포 실패')
      const data = await res.json()
      setAgents(prev => [data, ...prev])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : '에이전트 배포 오류')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Assign task to agent
  const assignTask = useCallback(async (taskData: {
    title: string
    instructions: string
    assignee_agent_id: string
    assigner_agent_id?: string
    description?: string
  }) => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/agent-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskData,
          conversation_id: currentConversation?.id,
        }),
      })
      if (!res.ok) throw new Error('업무 할당 실패')
      const data = await res.json()

      // Refresh messages to see task result
      if (currentConversation) {
        await fetchMessages(currentConversation.id)
      }

      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : '업무 할당 오류')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [currentConversation, fetchMessages])

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchAgents()
      fetchConversations()
    }
  }, [autoFetch, fetchAgents, fetchConversations])

  // Load messages when conversationId changes
  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId)
      if (conv) {
        selectConversation(conv)
      }
    }
  }, [conversationId, conversations, selectConversation])

  return {
    // State
    agents,
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,

    // Actions
    fetchAgents,
    fetchConversations,
    fetchMessages,
    createConversation,
    sendMessage,
    selectConversation,
    deployAgent,
    assignTask,

    // Setters
    setError,
    setCurrentConversation,
  }
}
