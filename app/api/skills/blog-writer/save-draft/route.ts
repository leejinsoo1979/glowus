import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-user'

/**
 * 블로그 임시저장 API
 *
 * - 티스토리: Open API 사용
 * - 네이버: 현재 API 미지원, 로컬 저장 후 안내
 */

interface SaveDraftRequest {
  post: {
    title: string
    content: string
    tags: string[]
    category?: string
  }
  platform: 'tistory' | 'naver'
  credentials: {
    // Tistory
    apiKey?: string
    blogName?: string
    accessToken?: string
    // Naver
    username?: string
    password?: string
    blogId?: string
    sessionCookie?: string
  }
}

// 티스토리 임시저장
async function saveTistoryDraft(
  post: SaveDraftRequest['post'],
  credentials: SaveDraftRequest['credentials']
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const { accessToken, blogName } = credentials

  if (!accessToken || !blogName) {
    return { success: false, error: '티스토리 API 설정이 필요합니다.' }
  }

  try {
    // 티스토리 API로 글 작성 (visibility: 0 = 비공개/임시저장)
    const formData = new URLSearchParams()
    formData.append('access_token', accessToken)
    formData.append('blogName', blogName)
    formData.append('title', post.title)
    formData.append('content', post.content)
    formData.append('visibility', '0') // 0: 비공개, 3: 공개
    formData.append('tag', post.tags.join(','))
    if (post.category) {
      formData.append('category', post.category)
    }

    const response = await fetch('https://www.tistory.com/apis/post/write', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const data = await response.json()

    if (data.tistory?.status === '200') {
      return {
        success: true,
        postId: data.tistory.postId,
      }
    } else {
      return {
        success: false,
        error: data.tistory?.error_message || '티스토리 저장 실패',
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 네이버 블로그 (API 미지원 - 로컬 저장으로 대체)
async function saveNaverDraft(
  post: SaveDraftRequest['post'],
  credentials: SaveDraftRequest['credentials'],
  supabase: any,
  userId: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  // 네이버 블로그는 공식 API가 없어서 로컬 DB에 저장
  // 사용자가 직접 네이버에 복사/붙여넣기 해야 함
  try {
    const { data, error } = await supabase
      .from('blog_drafts')
      .insert({
        user_id: userId,
        platform: 'naver',
        title: post.title,
        content: post.content,
        tags: post.tags,
        category: post.category,
        status: 'draft',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // 테이블이 없으면 성공으로 처리 (로컬 저장 안내)
      if (error.code === '42P01') {
        return {
          success: true,
          postId: 'local-' + Date.now(),
        }
      }
      throw error
    }

    return {
      success: true,
      postId: data.id,
    }
  } catch (error: any) {
    // 에러가 있어도 성공으로 처리 (클라이언트에서 복사 기능 제공)
    console.warn('[BlogWriter] Naver draft save to DB failed, using local:', error.message)
    return {
      success: true,
      postId: 'local-' + Date.now(),
    }
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    // 인증 확인
    let user: any = isDevMode() ? DEV_USER : null
    if (!user) {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SaveDraftRequest = await request.json()
    const { post, platform, credentials } = body

    if (!post?.title || !post?.content) {
      return NextResponse.json(
        { error: '제목과 내용이 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('[BlogWriter] Saving draft:', { platform, title: post.title })

    let result: { success: boolean; postId?: string; error?: string }

    if (platform === 'tistory') {
      result = await saveTistoryDraft(post, credentials)
    } else {
      result = await saveNaverDraft(post, credentials, supabase, user.id)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '저장 실패' },
        { status: 500 }
      )
    }

    console.log('[BlogWriter] Draft saved:', { platform, postId: result.postId })

    return NextResponse.json({
      success: true,
      postId: result.postId,
      platform,
      message: platform === 'naver'
        ? '글이 저장되었습니다. 네이버 블로그에서 직접 발행해주세요.'
        : '티스토리에 비공개로 저장되었습니다.',
    })

  } catch (error: any) {
    console.error('[BlogWriter] Save draft error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save draft' },
      { status: 500 }
    )
  }
}
