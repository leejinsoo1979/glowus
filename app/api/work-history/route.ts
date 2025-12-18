import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface WorkItem {
    id: string
    title: string
    subtitle?: string
    type: 'chat' | 'youtube' | 'document' | 'code' | 'image' | 'analysis' | 'sheet' | 'email' | 'project'
    date: string
    timestamp: number // for sorting
    agentId?: string
    avatarUrl?: string
    url?: string
}

// 날짜 포맷팅 함수
function formatDate(dateStr: string): { formatted: string; timestamp: number } {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    let formatted = ''
    if (diffDays === 0) {
        formatted = '오늘'
    } else if (diffDays === 1) {
        formatted = '어제'
    } else if (diffDays < 7) {
        formatted = `${diffDays}일 전`
    } else {
        formatted = date.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        })
    }

    return { formatted, timestamp: date.getTime() }
}

export async function GET() {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const workHistory: WorkItem[] = []

        // 1. 에이전트 대화 기록
        const { data: conversations } = await supabase
            .from('agent_conversations')
            .select(`
                id,
                last_message_at,
                deployed_agents (
                    id,
                    name,
                    avatar_url
                ),
                agent_chat_messages (
                    content,
                    role
                )
            `)
            .eq('user_id', user.id)
            .order('last_message_at', { ascending: false })
            .limit(20)

        conversations?.forEach((conv: any) => {
            const lastMessage = conv.agent_chat_messages?.[0]
            const agent = conv.deployed_agents
            const { formatted, timestamp } = formatDate(conv.last_message_at)

            workHistory.push({
                id: conv.id,
                title: agent?.name || '대화',
                subtitle: lastMessage?.content?.slice(0, 50) || '',
                type: 'chat',
                date: formatted,
                timestamp,
                agentId: agent?.id,
                avatarUrl: agent?.avatar_url
            })
        })

        // 2. 프로젝트 문서 (YouTube 요약, 분석 등)
        const { data: documents } = await supabase
            .from('project_documents')
            .select(`
                id,
                title,
                summary,
                doc_type,
                source_type,
                source_url,
                created_at
            `)
            .or(`created_by_user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(20)

        documents?.forEach((doc: any) => {
            const { formatted, timestamp } = formatDate(doc.created_at)

            // doc_type에 따른 타입 매핑
            let type: WorkItem['type'] = 'document'
            if (doc.source_type === 'youtube') {
                type = 'youtube'
            } else if (doc.doc_type === 'analysis') {
                type = 'analysis'
            } else if (doc.doc_type === 'code' || doc.doc_type === 'deliverable') {
                type = 'code'
            }

            workHistory.push({
                id: doc.id,
                title: doc.title,
                subtitle: doc.summary?.slice(0, 50) || '',
                type,
                date: formatted,
                timestamp,
                url: doc.source_url
            })
        })

        // 3. 스프레드시트
        const { data: sheets } = await supabase
            .from('sheets')
            .select(`
                id,
                name,
                description,
                updated_at
            `)
            .eq('created_by', user.id)
            .eq('is_archived', false)
            .order('updated_at', { ascending: false })
            .limit(10)

        sheets?.forEach((sheet: any) => {
            const { formatted, timestamp } = formatDate(sheet.updated_at)

            workHistory.push({
                id: sheet.id,
                title: sheet.name,
                subtitle: sheet.description?.slice(0, 50) || '스프레드시트',
                type: 'sheet',
                date: formatted,
                timestamp
            })
        })

        // 4. 이메일 요약
        const { data: emailSummaries } = await supabase
            .from('email_summaries')
            .select(`
                id,
                summary_type,
                summary_text,
                total_emails,
                created_at
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10)

        emailSummaries?.forEach((summary: any) => {
            const { formatted, timestamp } = formatDate(summary.created_at)
            const typeLabel = summary.summary_type === 'daily' ? '일간' :
                            summary.summary_type === 'weekly' ? '주간' : '커스텀'

            workHistory.push({
                id: summary.id,
                title: `${typeLabel} 이메일 요약`,
                subtitle: `${summary.total_emails}개 이메일 분석`,
                type: 'email',
                date: formatted,
                timestamp
            })
        })

        // 5. 프로젝트
        const { data: projects } = await supabase
            .from('projects')
            .select(`
                id,
                name,
                description,
                status,
                updated_at
            `)
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(10)

        projects?.forEach((project: any) => {
            const { formatted, timestamp } = formatDate(project.updated_at)
            const statusMap: Record<string, string> = {
                planning: '계획 중',
                active: '진행 중',
                on_hold: '보류',
                completed: '완료',
                cancelled: '취소'
            }
            const statusLabel = statusMap[project.status] || project.status

            workHistory.push({
                id: project.id,
                title: project.name,
                subtitle: `${statusLabel} · ${project.description?.slice(0, 30) || ''}`,
                type: 'project',
                date: formatted,
                timestamp,
                url: `/dashboard-group/project/${project.id}`
            })
        })

        // 시간순 정렬 (최신순)
        workHistory.sort((a, b) => b.timestamp - a.timestamp)

        // 최대 50개로 제한
        const limitedHistory = workHistory.slice(0, 50)

        return NextResponse.json({ workHistory: limitedHistory })
    } catch (error) {
        console.error('Work history API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
