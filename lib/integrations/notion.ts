/**
 * Notion Integration Client
 * 노션 연동 클라이언트
 */

import {
  IntegrationClient,
  OAuthCallbackResult,
  ResourceListResult,
  ContentFetchResult,
  ListResourcesOptions,
  ExternalResource,
  UserAppConnection,
} from './types'

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID!
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET!

export class NotionClient implements IntegrationClient {
  providerId = 'notion' as const

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state,
    })

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthCallbackResult> {
    try {
      const credentials = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString(
        'base64'
      )

      const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenRes.ok) {
        const error = await tokenRes.json()
        throw new Error(error.message || 'Token exchange failed')
      }

      const data = await tokenRes.json()

      return {
        success: true,
        account_info: {
          access_token: data.access_token,
          workspace_id: data.workspace_id,
          workspace_name: data.workspace_name,
          workspace_icon: data.workspace_icon,
          owner: data.owner,
        },
      }
    } catch (error) {
      console.error('[Notion] Callback error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async refreshToken(): Promise<{ access_token: string; expires_in: number }> {
    // Notion doesn't support refresh tokens - tokens don't expire
    throw new Error('Notion tokens do not expire')
  }

  async getAccountInfo(accessToken: string): Promise<UserAppConnection['account_info']> {
    const res = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    })

    if (!res.ok) {
      throw new Error('Failed to get user info')
    }

    const data = await res.json()
    return {
      name: data.name,
      email: data.person?.email,
      avatar_url: data.avatar_url,
      notion_id: data.id,
      type: data.type,
    }
  }

  async listResources(
    accessToken: string,
    options?: ListResourcesOptions
  ): Promise<ResourceListResult> {
    // 검색 API 사용
    const body: any = {
      page_size: options?.limit || 50,
    }

    if (options?.query) {
      body.query = options.query
    }

    if (options?.cursor) {
      body.start_cursor = options.cursor
    }

    // 특정 페이지 내의 블록들 또는 전체 검색
    const url = options?.folder_id
      ? `https://api.notion.com/v1/blocks/${options.folder_id}/children`
      : 'https://api.notion.com/v1/search'

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error('Failed to search Notion')
    }

    const data = await res.json()

    const resources: ExternalResource[] = data.results.map((item: any) => ({
      id: item.id,
      name: this.getPageTitle(item),
      type: item.object === 'database' ? 'database' : 'page',
      url: item.url,
      modified_at: item.last_edited_time,
      metadata: {
        object: item.object,
        parent: item.parent,
        icon: item.icon,
        cover: item.cover,
      },
    }))

    return {
      resources,
      next_cursor: data.next_cursor,
      has_more: data.has_more,
    }
  }

  async getContent(accessToken: string, resourceId: string): Promise<ContentFetchResult> {
    // 페이지 메타데이터 가져오기
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${resourceId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    })

    if (!pageRes.ok) {
      throw new Error('Failed to get page')
    }

    const page = await pageRes.json()
    const title = this.getPageTitle(page)

    // 페이지 블록 내용 가져오기
    const content = await this.getPageContent(accessToken, resourceId)

    return {
      content,
      title,
      metadata: {
        url: page.url,
        last_edited: page.last_edited_time,
        created: page.created_time,
      },
    }
  }

  private async getPageContent(accessToken: string, pageId: string): Promise<string> {
    const blocks: string[] = []
    let cursor: string | undefined

    do {
      const url = `https://api.notion.com/v1/blocks/${pageId}/children${cursor ? `?start_cursor=${cursor}` : ''}`

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28',
        },
      })

      if (!res.ok) break

      const data = await res.json()

      for (const block of data.results) {
        const text = this.extractBlockText(block)
        if (text) blocks.push(text)
      }

      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    return blocks.join('\n\n')
  }

  private getPageTitle(page: any): string {
    // 다양한 title 위치 확인
    if (page.properties?.title?.title?.[0]?.plain_text) {
      return page.properties.title.title[0].plain_text
    }
    if (page.properties?.Name?.title?.[0]?.plain_text) {
      return page.properties.Name.title[0].plain_text
    }
    if (page.title?.[0]?.plain_text) {
      return page.title[0].plain_text
    }
    return 'Untitled'
  }

  private extractBlockText(block: any): string {
    const type = block.type
    const data = block[type]

    if (!data) return ''

    // Rich text를 plain text로 변환
    if (data.rich_text) {
      const text = data.rich_text.map((t: any) => t.plain_text).join('')

      switch (type) {
        case 'heading_1':
          return `# ${text}`
        case 'heading_2':
          return `## ${text}`
        case 'heading_3':
          return `### ${text}`
        case 'bulleted_list_item':
          return `• ${text}`
        case 'numbered_list_item':
          return `1. ${text}`
        case 'to_do':
          return `[${data.checked ? 'x' : ' '}] ${text}`
        case 'code':
          return `\`\`\`${data.language || ''}\n${text}\n\`\`\``
        case 'quote':
          return `> ${text}`
        default:
          return text
      }
    }

    // 특수 블록 타입
    switch (type) {
      case 'divider':
        return '---'
      case 'child_page':
        return `📄 ${data.title}`
      case 'child_database':
        return `📊 ${data.title}`
      default:
        return ''
    }
  }
}

export const notionClient = new NotionClient()
