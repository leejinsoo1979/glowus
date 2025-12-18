'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  User,
  MessageSquare,
  Clock,
  Briefcase,
  Brain,
  BookOpen,
  Link2,
  Zap,
  Workflow,
  Settings,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { createClient } from '@/lib/supabase/client'
import type { DeployedAgent, AgentStatus } from '@/types/database'
import { ProfileSidebar } from '@/components/agent/profile/ProfileSidebar'
import { ProfileAboutTab } from '@/components/agent/profile/ProfileAboutTab'
import { KnowledgeBaseTab } from '@/components/agent/profile/KnowledgeBaseTab'
import { IntegrationsTab } from '@/components/agent/profile/IntegrationsTab'
import { ApiConnectionsTab } from '@/components/agent/profile/ApiConnectionsTab'
import { ProfileChatTab } from '@/components/agent/profile/ProfileChatTab'

type TabType = 'about' | 'chat' | 'history' | 'workspace' | 'memory' | 'knowledge' | 'integrations' | 'apis' | 'workflow' | 'settings'

const tabs = [
  { id: 'about' as TabType, label: '소개', icon: User },
  { id: 'chat' as TabType, label: '채팅', icon: MessageSquare },
  { id: 'history' as TabType, label: '대화기록', icon: Clock },
  //   { id: 'workspace' as TabType, label: '워크스페이스', icon: Briefcase },
  //   { id: 'memory' as TabType, label: '메모리', icon: Brain },
  { id: 'knowledge' as TabType, label: '지식베이스', icon: BookOpen },
  { id: 'integrations' as TabType, label: '앱 연동', icon: Link2 },
  { id: 'apis' as TabType, label: 'API 연결', icon: Zap },
  //   { id: 'workflow' as TabType, label: '워크플로우', icon: Workflow },
  //   { id: 'settings' as TabType, label: '설정', icon: Settings },
]

export default function AgentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string
  const { mode } = useThemeStore()
  const isDark = mode === 'dark'

  const [agent, setAgent] = useState<DeployedAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('about')

  useEffect(() => {
    fetchAgent()
  }, [agentId])

  const fetchAgent = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('deployed_agents')
        .select(`
          *,
          team:teams(*),
          chat_rooms(count),
          tasks(count),
          project_stats(
            total_conversations,
            total_tasks_completed,
            total_decisions_made
          )
        `)
        .eq('id', agentId)
        .single()

      if (error) throw error
      setAgent(data)
    } catch (error) {
      console.error('Failed to fetch agent:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-500">에이전트를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className={cn("flex h-screen overflow-hidden", isDark ? "bg-black" : "bg-white")}>

      {/* LEFT SIDEBAR PROFILE */}
      <ProfileSidebar
        agent={agent}
        isDark={isDark}
        onEdit={() => router.push(`/agent-builder/${agent.id}`)}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* TABS HEADER */}
        <div className={cn(
          "flex items-center px-6 pt-6 pb-2 border-b shrink-0",
          isDark ? "bg-black border-zinc-800" : "bg-white border-zinc-200"
        )}>
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 pb-3 px-1 border-b-2 transition-all whitespace-nowrap text-sm font-medium",
                  activeTab === tab.id
                    ? isDark ? "border-green-500 text-green-500" : "border-green-600 text-green-600"
                    : isDark ? "border-transparent text-zinc-400 hover:text-zinc-200" : "border-transparent text-zinc-500 hover:text-zinc-900"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENT SCROLLABLE AREA */}
        <div className={cn(
          "flex-1 overflow-y-auto p-6 md:p-8",
          isDark ? "bg-zinc-950/50" : "bg-zinc-50/50"
        )}>
          {activeTab === 'about' && (
            <ProfileAboutTab agent={agent} isDark={isDark} onEdit={() => router.push(`/agent-builder/${agent.id}`)} />
          )}
          {activeTab === 'chat' && (
            <div className="max-w-4xl h-[600px]">
              <ProfileChatTab agent={agent} isDark={isDark} />
            </div>
          )}
          {activeTab === 'knowledge' && (
            <div className="max-w-5xl">
              <KnowledgeBaseTab agentId={agent.id} isDark={isDark} />
            </div>
          )}
          {activeTab === 'integrations' && (
            <div className="max-w-5xl">
              <IntegrationsTab agentId={agent.id} isDark={isDark} />
            </div>
          )}
          {activeTab === 'apis' && (
            <div className="max-w-5xl">
              <ApiConnectionsTab agentId={agent.id} isDark={isDark} />
            </div>
          )}
          {activeTab === 'history' && (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <div className="text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>대화 기록 기능 준비 중입니다</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
