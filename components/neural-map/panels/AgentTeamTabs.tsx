'use client'

/**
 * AgentTeamTabs - 5개 전문 에이전트 탭 시스템
 *
 * 1. Orchestrator (Team Lead) - 요구사항 정리, 라우팅
 * 2. Planner (Architect) - 설계, 구조 결정
 * 3. Implementer (Coder) - 실제 코딩
 * 4. Tester (QA) - 테스트, 검증
 * 5. Reviewer (Critic) - 코드 리뷰, 품질 감시
 */

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import {
  Users,
  Map,
  Code2,
  TestTube,
  Eye,
  Send,
  Loader2,
  Bot,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  FileCode,
  GitBranch,
} from 'lucide-react'
import { useNeuralMapStore } from '@/lib/neural-map/store'

// 에이전트 역할 정의
export type AgentRole = 'orchestrator' | 'planner' | 'implementer' | 'tester' | 'reviewer'

interface AgentConfig {
  id: AgentRole
  name: string
  nameKr: string
  icon: typeof Users
  color: string
  description: string
  systemPrompt: string
}

export const AGENT_TEAM: AgentConfig[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    nameKr: '오케스트레이터',
    icon: Users,
    color: '#8B5CF6', // purple
    description: '요구사항 분석 및 작업 라우팅',
    systemPrompt: `당신은 Team Lead / Orchestrator 에이전트입니다.

## 역할
- 사용자의 대화 입력을 "요구사항/제약/수용기준/작업단위"로 정리
- 어떤 에이전트(Planner/Implementer/Tester/Reviewer)를 언제 호출할지 결정
- 작업 로그, 결정사항, 변경이력 유지

## 응답 형식
1. 요구사항 분석 결과
2. 작업 분배 계획 (어떤 에이전트가 무엇을 할지)
3. 예상 산출물

## 행동 규칙
- 모호한 요청은 구체화 질문
- 복잡한 작업은 단계별로 분리
- 각 에이전트의 역할에 맞게 작업 할당
- 진행 상황 추적 및 보고`,
  },
  {
    id: 'planner',
    name: 'Planner',
    nameKr: '플래너',
    icon: Map,
    color: '#3B82F6', // blue
    description: '설계 및 아키텍처 결정',
    systemPrompt: `당신은 Planner / Architect 에이전트입니다.

## 역할
- Plan-and-Act 기반으로 설계 먼저 확정
- 폴더 구조, 모듈 경계(관심사 분리), 데이터 흐름 정의
- 인터페이스 정의 (API, 컴포넌트 Props, DB 스키마)
- "작게 나눠서" 실행 가능한 작업 목록으로 쪼개기

## 응답 형식
1. 아키텍처 설계도 (폴더 구조, 모듈)
2. 데이터 흐름도
3. 인터페이스 정의 (TypeScript 타입)
4. 구현 작업 목록 (우선순위 순)

## 행동 규칙
- 코드 작성 전 반드시 설계 먼저
- SOLID, DRY 원칙 준수
- 확장성과 유지보수성 고려
- Implementer가 바로 작업할 수 있는 수준으로 상세화`,
  },
  {
    id: 'implementer',
    name: 'Implementer',
    nameKr: '임플리멘터',
    icon: Code2,
    color: '#10B981', // green
    description: '실제 코드 구현',
    systemPrompt: `당신은 Implementer / Builder / Coder 에이전트입니다.

## 역할
- 실제 코딩 담당 (기능 구현, 리팩토링)
- 최소 단위 PR/커밋으로 전진
- "지금 당장 돌아가게" 만드는 담당

## 응답 형식
\`\`\`typescript
// 실제 동작하는 코드를 작성합니다
\`\`\`

## 행동 규칙
- 설명 없이 바로 코드 작성
- write_file 도구로 파일 생성
- edit_file 도구로 파일 수정
- run_terminal로 npm install, 빌드 등 실행
- 작은 단위로 커밋 가능한 형태로 구현

## 금지사항
❌ "이렇게 하면 됩니다" 설명만 하기
❌ 기획서/가이드 작성
❌ 외부 도구 추천 (draw.io, Figma 등)

✅ 반드시 코드를 작성하고 파일을 생성할 것`,
  },
  {
    id: 'tester',
    name: 'Tester',
    nameKr: '테스터',
    icon: TestTube,
    color: '#F59E0B', // amber
    description: '테스트 및 검증',
    systemPrompt: `당신은 Tester / Verifier / QA 에이전트입니다.

## 역할
- 단위/통합 테스트 작성
- 엣지케이스 발견 및 테스트
- 회귀 방지 테스트
- "재현 → 원인 → 고정 테스트 → 수정" 루프 강제

## 응답 형식
1. 테스트 케이스 목록
2. 테스트 코드 (Jest, Vitest, Playwright 등)
3. 발견된 버그/이슈
4. 수정 제안

## 행동 규칙
- 모든 주요 기능에 테스트 작성
- 엣지케이스 적극 탐색
- 테스트 실패 시 원인 분석
- 버그 재현 스텝 명확히 기록

\`\`\`typescript
// 테스트 코드 예시
describe('기능명', () => {
  it('정상 케이스', () => {
    // ...
  })
  it('엣지 케이스', () => {
    // ...
  })
})
\`\`\``,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    nameKr: '리뷰어',
    icon: Eye,
    color: '#EF4444', // red
    description: '코드 리뷰 및 품질 감시',
    systemPrompt: `당신은 Reviewer / Critic 에이전트입니다.

## 역할
- 코드 품질, 보안, 성능, 아키텍처 위반 감시
- 환각/추측 방지 ("근거 없는 구현" 차단)
- 최종 머지 게이트 역할

## 응답 형식
### 코드 리뷰 결과

✅ **통과 항목**
- ...

⚠️ **경고 (수정 권장)**
- ...

❌ **블로커 (수정 필수)**
- ...

### 보안 체크
- [ ] SQL Injection
- [ ] XSS
- [ ] CSRF
- [ ] 인증/인가

### 성능 체크
- [ ] N+1 쿼리
- [ ] 메모리 누수
- [ ] 불필요한 리렌더링

### 최종 판정: ✅ APPROVE / ⚠️ REQUEST_CHANGES / ❌ REJECT

## 행동 규칙
- 근거 없는 코드는 거부
- 보안 취약점은 반드시 지적
- 성능 이슈 적극 발견
- 아키텍처 위반 차단`,
  },
]

interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentRole: AgentRole
  timestamp: number
  status?: 'pending' | 'complete' | 'error'
  toolCalls?: { name: string; result?: string }[]
}

interface AgentTeamTabsProps {
  isDark: boolean
}

export function AgentTeamTabs({ isDark }: AgentTeamTabsProps) {
  const [activeAgent, setActiveAgent] = useState<AgentRole>('orchestrator')
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const mapId = useNeuralMapStore((s) => s.mapId)

  const currentAgent = AGENT_TEAM.find((a) => a.id === activeAgent)!

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 메시지 전송
  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: AgentMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      agentRole: activeAgent,
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // API 호출 - 선택된 에이전트 역할 전달
      const response = await fetch('/api/neural-map/agent-team/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          agentRole: activeAgent,
          systemPrompt: currentAgent.systemPrompt,
          mapId,
          history: messages.filter((m) => m.agentRole === activeAgent).slice(-10),
        }),
      })

      if (!response.ok) throw new Error('API 호출 실패')

      const data = await response.json()

      const assistantMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message,
        agentRole: activeAgent,
        timestamp: Date.now(),
        status: 'complete',
        toolCalls: data.toolsUsed?.map((t: string) => ({ name: t })),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Agent chat error:', error)
      const errorMessage: AgentMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        agentRole: activeAgent,
        timestamp: Date.now(),
        status: 'error',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      handleSend()
    }
  }

  // 현재 에이전트의 메시지만 필터링
  const filteredMessages = messages.filter((m) => m.agentRole === activeAgent)

  return (
    <div className="h-full flex flex-col">
      {/* Agent Tabs - 5개 에이전트 */}
      <div className={cn('flex border-b overflow-x-auto', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        {AGENT_TEAM.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium transition-all relative',
              activeAgent === agent.id
                ? 'text-white'
                : isDark
                  ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100/50'
            )}
            style={{
              backgroundColor: activeAgent === agent.id ? agent.color : undefined,
            }}
          >
            <agent.icon className="w-4 h-4 mb-0.5" />
            <span className="truncate w-full text-center">{agent.name}</span>
          </button>
        ))}
      </div>

      {/* Agent Info */}
      <div
        className={cn('px-3 py-2 border-b text-xs', isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50')}
        style={{ borderLeftColor: currentAgent.color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <currentAgent.icon className="w-4 h-4" style={{ color: currentAgent.color }} />
          <span className={cn('font-semibold', isDark ? 'text-zinc-200' : 'text-zinc-800')}>
            {currentAgent.nameKr}
          </span>
        </div>
        <p className={cn('mt-0.5', isDark ? 'text-zinc-500' : 'text-zinc-500')}>{currentAgent.description}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
        {filteredMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <currentAgent.icon
                className="w-10 h-10 mx-auto"
                style={{ color: currentAgent.color, opacity: 0.5 }}
              />
              <p className={cn('text-sm', isDark ? 'text-zinc-500' : 'text-zinc-500')}>
                {currentAgent.nameKr}에게 질문하세요
              </p>
              <p className={cn('text-xs max-w-[200px]', isDark ? 'text-zinc-600' : 'text-zinc-400')}>
                {currentAgent.description}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'text-sm rounded-lg p-3',
                  msg.role === 'user'
                    ? isDark
                      ? 'bg-zinc-800 ml-8'
                      : 'bg-zinc-100 ml-8'
                    : isDark
                      ? 'bg-zinc-900 border border-zinc-800'
                      : 'bg-white border border-zinc-200'
                )}
                style={{
                  borderLeftColor: msg.role === 'assistant' ? currentAgent.color : undefined,
                  borderLeftWidth: msg.role === 'assistant' ? 3 : undefined,
                }}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs">
                    <Bot className="w-3 h-3" style={{ color: currentAgent.color }} />
                    <span style={{ color: currentAgent.color }} className="font-medium">
                      {currentAgent.name}
                    </span>
                    {msg.status === 'complete' && <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />}
                    {msg.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-500 ml-auto" />}
                  </div>
                )}
                <div className={cn('whitespace-pre-wrap', isDark ? 'text-zinc-300' : 'text-zinc-700')}>
                  {msg.content}
                </div>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className={cn('mt-2 pt-2 border-t flex flex-wrap gap-1', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
                    {msg.toolCalls.map((tool, i) => (
                      <span
                        key={i}
                        className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                          isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'
                        )}
                      >
                        <FileCode className="w-2.5 h-2.5" />
                        {tool.name}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: currentAgent.color }}>
            <Loader2 className="w-3 h-3 animate-spin" />
            {currentAgent.nameKr}가 작업 중...
          </div>
        )}
      </div>

      {/* Input */}
      <div className={cn('p-3 border-t', isDark ? 'border-zinc-800' : 'border-zinc-200')}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${currentAgent.nameKr}에게 메시지...`}
            disabled={isLoading}
            className={cn(
              'flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-colors',
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600'
                : 'bg-white border-zinc-200 text-zinc-800 placeholder:text-zinc-400',
              isLoading && 'opacity-50'
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-2 rounded-lg transition-colors text-white',
              !input.trim() || isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
            )}
            style={{ backgroundColor: currentAgent.color }}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AgentTeamTabs
