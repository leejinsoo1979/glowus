/**
 * Google Drive Integration Client
 * 구글 드라이브 연동 클라이언트
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

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
]

export class GoogleDriveClient implements IntegrationClient {
  providerId = 'google_drive' as const

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async handleCallback(code: string, redirectUri: string): Promise<OAuthCallbackResult> {
    try {
      // 토큰 교환
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenRes.ok) {
        const error = await tokenRes.json()
        throw new Error(error.error_description || 'Token exchange failed')
      }

      const tokens = await tokenRes.json()

      // 사용자 정보 가져오기
      const accountInfo = await this.getAccountInfo(tokens.access_token)

      return {
        success: true,
        account_info: {
          ...accountInfo,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
        },
      }
    } catch (error) {
      console.error('[GoogleDrive] Callback error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await res.json()
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    }
  }

  async getAccountInfo(accessToken: string): Promise<UserAppConnection['account_info']> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error('Failed to get user info')
    }

    const data = await res.json()
    return {
      email: data.email,
      name: data.name,
      avatar_url: data.picture,
      google_id: data.id,
    }
  }

  async listResources(
    accessToken: string,
    options?: ListResourcesOptions
  ): Promise<ResourceListResult> {
    const params = new URLSearchParams({
      pageSize: String(options?.limit || 50),
      fields:
        'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents,iconLink)',
    })

    // 쿼리 구성
    const queryParts: string[] = ["trashed = false"]

    if (options?.folder_id) {
      queryParts.push(`'${options.folder_id}' in parents`)
    }

    if (options?.file_types && options.file_types.length > 0) {
      const mimeTypes = options.file_types.map((t) => this.getMimeType(t)).filter(Boolean)
      if (mimeTypes.length > 0) {
        queryParts.push(`(${mimeTypes.map((m) => `mimeType='${m}'`).join(' or ')})`)
      }
    }

    if (options?.query) {
      queryParts.push(`name contains '${options.query}'`)
    }

    params.set('q', queryParts.join(' and '))

    if (options?.cursor) {
      params.set('pageToken', options.cursor)
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error('Failed to list files')
    }

    const data = await res.json()

    const resources: ExternalResource[] = data.files.map((file: any) => ({
      id: file.id,
      name: file.name,
      type: file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file',
      url: file.webViewLink,
      mime_type: file.mimeType,
      size: file.size ? parseInt(file.size) : undefined,
      modified_at: file.modifiedTime,
      metadata: {
        parents: file.parents,
        icon_link: file.iconLink,
      },
    }))

    return {
      resources,
      next_cursor: data.nextPageToken,
      has_more: !!data.nextPageToken,
    }
  }

  async getContent(accessToken: string, resourceId: string): Promise<ContentFetchResult> {
    // 먼저 파일 메타데이터 가져오기
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${resourceId}?fields=id,name,mimeType,size`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!metaRes.ok) {
      throw new Error('Failed to get file metadata')
    }

    const metadata = await metaRes.json()

    // Google Docs, Sheets, Slides는 export 필요
    let content: string
    const mimeType = metadata.mimeType

    if (mimeType.startsWith('application/vnd.google-apps')) {
      // Google 문서 타입 → 텍스트로 export
      const exportMime = this.getExportMimeType(mimeType)
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${resourceId}/export?mimeType=${encodeURIComponent(exportMime)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!exportRes.ok) {
        throw new Error('Failed to export file')
      }

      content = await exportRes.text()
    } else {
      // 일반 파일 다운로드
      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${resourceId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!downloadRes.ok) {
        throw new Error('Failed to download file')
      }

      // 텍스트 기반 파일만 처리
      if (this.isTextBasedMimeType(mimeType)) {
        content = await downloadRes.text()
      } else {
        throw new Error('Binary files are not supported for content extraction')
      }
    }

    return {
      content,
      title: metadata.name,
      mime_type: mimeType,
      metadata,
    }
  }

  private getMimeType(fileType: string): string | null {
    const mimeTypes: Record<string, string> = {
      document: 'application/vnd.google-apps.document',
      spreadsheet: 'application/vnd.google-apps.spreadsheet',
      presentation: 'application/vnd.google-apps.presentation',
      pdf: 'application/pdf',
      text: 'text/plain',
      markdown: 'text/markdown',
    }
    return mimeTypes[fileType] || null
  }

  private getExportMimeType(googleMimeType: string): string {
    const exportTypes: Record<string, string> = {
      'application/vnd.google-apps.document': 'text/plain',
      'application/vnd.google-apps.spreadsheet': 'text/csv',
      'application/vnd.google-apps.presentation': 'text/plain',
      'application/vnd.google-apps.drawing': 'image/png',
    }
    return exportTypes[googleMimeType] || 'text/plain'
  }

  private isTextBasedMimeType(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/javascript'
    )
  }
}

export const googleDriveClient = new GoogleDriveClient()
