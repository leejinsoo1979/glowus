import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 기본 도구 카탈로그 (DB에 없을 경우 사용)
const DEFAULT_TOOLS = [
  // 검색
  {
    id: 'serper',
    name: 'Serper (Google Search)',
    description: 'Google 검색 결과를 API로 가져옵니다',
    category: 'search',
    provider: 'serper',
    auth_type: 'api_key',
    base_url: 'https://google.serper.dev',
    documentation_url: 'https://serper.dev/docs',
    required_fields: ['api_key'],
    is_active: true,
  },
  {
    id: 'tavily',
    name: 'Tavily Search',
    description: 'AI 최적화 검색 엔진',
    category: 'search',
    provider: 'tavily',
    auth_type: 'api_key',
    base_url: 'https://api.tavily.com',
    documentation_url: 'https://docs.tavily.com',
    required_fields: ['api_key'],
    is_active: true,
  },
  {
    id: 'brave_search',
    name: 'Brave Search',
    description: 'Brave 검색 API',
    category: 'search',
    provider: 'brave',
    auth_type: 'api_key',
    base_url: 'https://api.search.brave.com',
    documentation_url: 'https://brave.com/search/api/',
    required_fields: ['api_key'],
    is_active: true,
  },

  // 날씨/데이터
  {
    id: 'openweather',
    name: 'OpenWeather',
    description: '날씨 정보 API',
    category: 'data',
    provider: 'openweather',
    auth_type: 'api_key',
    base_url: 'https://api.openweathermap.org',
    documentation_url: 'https://openweathermap.org/api',
    required_fields: ['api_key'],
    is_active: true,
  },

  // 생산성
  {
    id: 'notion',
    name: 'Notion',
    description: 'Notion 페이지 및 데이터베이스 연동',
    category: 'productivity',
    provider: 'notion',
    auth_type: 'bearer',
    base_url: 'https://api.notion.com',
    documentation_url: 'https://developers.notion.com',
    required_fields: ['api_key'],
    is_active: true,
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Airtable 데이터베이스 연동',
    category: 'productivity',
    provider: 'airtable',
    auth_type: 'bearer',
    base_url: 'https://api.airtable.com',
    documentation_url: 'https://airtable.com/developers/web/api',
    required_fields: ['api_key', 'base_id'],
    is_active: true,
  },

  // 커뮤니케이션
  {
    id: 'slack_webhook',
    name: 'Slack Webhook',
    description: 'Slack 채널에 메시지 전송',
    category: 'communication',
    provider: 'slack',
    auth_type: 'webhook',
    base_url: '',
    documentation_url: 'https://api.slack.com/messaging/webhooks',
    required_fields: ['webhook_url'],
    is_active: true,
  },
  {
    id: 'discord_webhook',
    name: 'Discord Webhook',
    description: 'Discord 채널에 메시지 전송',
    category: 'communication',
    provider: 'discord',
    auth_type: 'webhook',
    base_url: '',
    documentation_url: 'https://discord.com/developers/docs/resources/webhook',
    required_fields: ['webhook_url'],
    is_active: true,
  },

  // AI 서비스
  {
    id: 'replicate',
    name: 'Replicate',
    description: '다양한 AI 모델 실행',
    category: 'ai',
    provider: 'replicate',
    auth_type: 'bearer',
    base_url: 'https://api.replicate.com',
    documentation_url: 'https://replicate.com/docs',
    required_fields: ['api_key'],
    is_active: true,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Hugging Face 모델 추론',
    category: 'ai',
    provider: 'huggingface',
    auth_type: 'bearer',
    base_url: 'https://api-inference.huggingface.co',
    documentation_url: 'https://huggingface.co/docs/api-inference',
    required_fields: ['api_key'],
    is_active: true,
  },
]

// GET - 도구 카탈로그 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // DB에서 도구 카탈로그 조회 시도
    const { data: dbTools, error } = await (supabase as any)
      .from('api_tool_catalog')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.warn('Failed to fetch from DB, using defaults:', error.message)
      return NextResponse.json({ tools: DEFAULT_TOOLS })
    }

    // DB에 도구가 있으면 반환, 없으면 기본값 반환
    const tools = dbTools && dbTools.length > 0 ? dbTools : DEFAULT_TOOLS

    return NextResponse.json({ tools })
  } catch (error) {
    console.error('Get tool catalog error:', error)
    // 에러 시에도 기본 도구 반환
    return NextResponse.json({ tools: DEFAULT_TOOLS })
  }
}
