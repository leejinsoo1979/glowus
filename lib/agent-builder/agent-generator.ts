// Agent Generator - AI가 자연어 명령을 분석해 에이전트 설정을 생성
// 주의: 이 파일은 서버에서만 사용되어야 합니다

import { v4 as uuidv4 } from 'uuid'
import {
    CustomAgentConfig,
    AgentCapability,
    AgentToolConfig,
    AgentBuilderRequest,
    AgentBuilderResponse,
    AgentPreview,
    BUILTIN_TOOLS,
    AGENT_CATEGORIES
} from './types'

// Lazy initialization to avoid browser-side instantiation
let anthropic: any = null

function getAnthropicClient() {
    if (typeof window !== 'undefined') {
        throw new Error('Anthropic client cannot be used in browser')
    }
    if (!anthropic) {
        // Dynamic import to avoid browser bundling
        const Anthropic = require('@anthropic-ai/sdk').default
        anthropic = new Anthropic()
    }
    return anthropic
}

// 에이전트 생성 프롬프트
const AGENT_BUILDER_PROMPT = `당신은 AI 에이전트 빌더입니다. 사용자의 자연어 요청을 분석하여 커스텀 AI 에이전트 설정을 생성합니다.

## 사용 가능한 도구들:
${BUILTIN_TOOLS.map(t => `- ${t.id}: ${t.name} - ${t.description}`).join('\n')}

## 카테고리:
${AGENT_CATEGORIES.map(c => `- ${c.id}: ${c.name}`).join('\n')}

## 응답 형식 (JSON):
{
  "name": "에이전트 이름 (한국어, 간결하게)",
  "description": "에이전트 설명 (한국어, 1-2문장)",
  "icon": "Lucide 아이콘 이름 (예: Bot, MessageSquare, Zap, Shield, Users, Search, Code, Mail 등)",
  "iconColor": "Tailwind 색상 클래스 (예: text-blue-500, text-green-500)",
  "iconBg": "Tailwind 배경 클래스 (예: bg-blue-100)",
  "category": "카테고리 ID",
  "systemPrompt": "에이전트의 시스템 프롬프트 (상세하고 구체적으로)",
  "personality": "에이전트의 성격/말투 설명",
  "capabilities": ["필요한 도구 ID 배열"],
  "inputPlaceholder": "입력창 플레이스홀더",
  "suggestedQueries": ["추천 질문 3개"],
  "thumbnail": "썸네일 경로 추천 (예: /thumbnails/work.png)"
}

## 규칙:
1. 사용자의 요구사항을 정확히 파악하여 적절한 도구를 선택하세요
2. systemPrompt는 에이전트의 역할, 행동 방식, 제약사항을 상세히 기술하세요
3. personality는 친근하고 전문적인 톤으로 설정하세요
4. 한국어로 작성하되, 전문 용어는 그대로 사용하세요
5. JSON만 반환하세요 (마크다운 없이)`

export async function generateAgentFromPrompt(
    request: AgentBuilderRequest
): Promise<AgentBuilderResponse> {
    try {
        const userMessage = request.refinements
            ? `${request.userPrompt}\n\n추가 요구사항:\n${request.refinements.join('\n')}`
            : request.userPrompt

        const response = await getAnthropicClient().messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: AGENT_BUILDER_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ]
        })

        const content = response.content[0]
        if (content.type !== 'text') {
            throw new Error('Unexpected response type')
        }

        // JSON 파싱
        let parsed: any
        try {
            // JSON 블록 추출 (```json ... ``` 형식 처리)
            let jsonStr = content.text.trim()
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
            }
            parsed = JSON.parse(jsonStr)
        } catch (e) {
            console.error('JSON parse error:', content.text)
            throw new Error('Failed to parse agent configuration')
        }

        // 에이전트 설정 생성
        const agentId = uuidv4()
        const now = new Date()

        const capabilities: AgentCapability[] = (parsed.capabilities || []).map((capId: string) => {
            const tool = BUILTIN_TOOLS.find(t => t.id === capId)
            return {
                id: capId,
                name: tool?.name || capId,
                description: tool?.description || '',
                type: capId as AgentCapability['type'],
                enabled: true
            }
        })

        const tools: AgentToolConfig[] = capabilities.map(cap => ({
            id: cap.id,
            name: cap.name,
            description: cap.description,
            type: 'builtin' as const,
            enabled: true
        }))

        const agent: CustomAgentConfig = {
            id: agentId,
            name: parsed.name,
            description: parsed.description,
            icon: parsed.icon || 'Bot',
            iconColor: parsed.iconColor || 'text-blue-500',
            iconBg: parsed.iconBg || 'bg-blue-100',
            category: parsed.category || 'custom',
            systemPrompt: parsed.systemPrompt,
            personality: parsed.personality,
            capabilities,
            tools,
            inputPlaceholder: parsed.inputPlaceholder,
            suggestedQueries: parsed.suggestedQueries || [],
            createdAt: now,
            updatedAt: now,
            createdBy: 'user', // TODO: 실제 사용자 ID
            status: 'draft',
            version: '1.0.0',
            deployedToApps: false,
            thumbnail: parsed.thumbnail || '/thumbnails/work.png'
        }

        // 미리보기 생성
        const preview: AgentPreview = {
            name: agent.name,
            description: agent.description,
            capabilities: capabilities.map(c => c.name),
            sampleConversation: [
                {
                    user: parsed.suggestedQueries?.[0] || '안녕하세요',
                    assistant: `안녕하세요! 저는 ${agent.name}입니다. ${agent.description} 무엇을 도와드릴까요?`
                }
            ]
        }

        return {
            success: true,
            agent,
            preview,
            suggestions: [
                '에이전트를 테스트해보시겠어요?',
                'Apps 메뉴에 배포하시겠어요?',
                '추가 기능을 설정하시겠어요?'
            ]
        }
    } catch (error) {
        console.error('Agent generation error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// 에이전트 배포 (Apps 메뉴에 추가)
export async function deployAgentToApps(agent: CustomAgentConfig): Promise<{
    success: boolean
    appRoute?: string
    error?: string
}> {
    try {
        // 1. 에이전트 설정을 DB에 저장 (여기서는 로컬 스토리지 사용)
        const deployedAgent: CustomAgentConfig = {
            ...agent,
            deployedToApps: true,
            appRoute: `/dashboard-group/apps/custom-agent/${agent.id}`,
            updatedAt: new Date(),
            status: 'active'
        }

        // 2. 커스텀 에이전트 목록에 추가
        // TODO: Supabase에 저장
        if (typeof window !== 'undefined') {
            const existingAgents = JSON.parse(localStorage.getItem('custom_agents') || '[]')
            const updatedAgents = existingAgents.filter((a: CustomAgentConfig) => a.id !== agent.id)
            updatedAgents.push(deployedAgent)
            localStorage.setItem('custom_agents', JSON.stringify(updatedAgents))
        }

        return {
            success: true,
            appRoute: deployedAgent.appRoute
        }
    } catch (error) {
        console.error('Deploy error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Deployment failed'
        }
    }
}

// 저장된 커스텀 에이전트 목록 가져오기
export function getCustomAgents(): CustomAgentConfig[] {
    if (typeof window === 'undefined') return []
    try {
        return JSON.parse(localStorage.getItem('custom_agents') || '[]')
    } catch {
        return []
    }
}

// 특정 에이전트 가져오기
export function getCustomAgentById(id: string): CustomAgentConfig | null {
    const agents = getCustomAgents()
    return agents.find(a => a.id === id) || null
}

// 에이전트 삭제
export function deleteCustomAgent(id: string): boolean {
    if (typeof window === 'undefined') return false
    try {
        const agents = getCustomAgents()
        const filtered = agents.filter(a => a.id !== id)
        localStorage.setItem('custom_agents', JSON.stringify(filtered))
        return true
    } catch {
        return false
    }
}
