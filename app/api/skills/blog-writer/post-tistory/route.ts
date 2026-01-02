import { NextRequest, NextResponse } from 'next/server'
import { chromium, Browser, Page } from 'playwright'

/**
 * 티스토리 블로그 자동 포스팅 API
 *
 * Chrome 디버깅 모드 (9222 포트)에 연결하여
 * 실제 티스토리 블로그에 글을 작성합니다.
 */

interface PostTistoryRequest {
  action: 'connect' | 'login' | 'post' | 'status' | 'checkLogin'
  credentials?: {
    email: string
    password: string
  }
  post?: {
    blogName: string
    title: string
    content: string
    tags?: string[]
  }
  blogName?: string
}

// 전역 브라우저/페이지 상태 관리
let browser: Browser | null = null
let page: Page | null = null
let isLoggedIn = false

// 콘텐츠에서 이미지 마커 파싱
interface ContentPart {
  type: 'text' | 'image'
  content: string
}

function parseContentWithImages(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const imagePattern = /\[IMAGE:(data:image\/[^;]+;base64,[^\]]+)\]/g
  let lastIndex = 0
  let match

  while ((match = imagePattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        parts.push({ type: 'text', content: text })
      }
    }
    parts.push({ type: 'image', content: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      parts.push({ type: 'text', content: text })
    }
  }

  return parts
}

// Chrome CDP 연결
async function connectToChrome(): Promise<{ success: boolean; message: string }> {
  try {
    // 기존 연결이 유효한지 확인
    if (browser && page) {
      try {
        await Promise.race([
          page.evaluate(() => document.title),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ])
        console.log('[Tistory] 기존 연결 재사용')
        return { success: true, message: '연결됨' }
      } catch {
        console.log('[Tistory] 기존 연결 끊어짐, 재연결...')
        try { await browser.close() } catch {}
        browser = null
        page = null
      }
    }

    // 5초 타임아웃으로 연결
    console.log('[Tistory] Chrome CDP 연결 시도...')
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 5000 })

    const contexts = browser.contexts()
    if (contexts.length > 0) {
      const pages = contexts[0].pages()
      page = pages.length > 0 ? pages[0] : await contexts[0].newPage()
    } else {
      const context = await browser.newContext()
      page = await context.newPage()
    }

    console.log('[Tistory] Chrome CDP 연결 성공')
    return { success: true, message: 'Chrome 연결 성공!' }
  } catch (error: any) {
    console.error('[Tistory] Chrome 연결 실패:', error.message)
    try { if (browser) await browser.close() } catch {}
    browser = null
    page = null
    return {
      success: false,
      message: `Chrome 연결 실패. Chrome을 디버깅 모드로 실행하세요.`
    }
  }
}

// 티스토리 로그인 (카카오 계정)
async function loginTistory(email: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!page) {
    return { success: false, message: 'Chrome에 먼저 연결해주세요.' }
  }

  try {
    // 티스토리 로그인 페이지로 이동
    await page.goto('https://www.tistory.com/auth/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 이미 로그인되어 있는지 확인
    const currentUrl = page.url()
    if (currentUrl.includes('tistory.com') && !currentUrl.includes('auth/login')) {
      isLoggedIn = true
      return { success: true, message: '이미 로그인되어 있습니다.' }
    }

    // 카카오 로그인 버튼 클릭
    const kakaoBtn = page.locator('a.btn_login.link_kakao_id, .link_kakao_id, [class*="kakao"]').first()
    if (await kakaoBtn.count() > 0) {
      await kakaoBtn.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)
    }

    // 카카오 로그인 폼
    const emailInput = page.locator('input[name="loginId"], input[name="email"], #loginId, #email').first()
    if (await emailInput.count() > 0) {
      await emailInput.click()
      await page.waitForTimeout(300)

      // 이메일 입력
      for (const char of email) {
        await page.keyboard.type(char)
        await page.waitForTimeout(50 + Math.random() * 30)
      }
      await page.waitForTimeout(500)

      // 비밀번호 입력
      const pwInput = page.locator('input[name="password"], input[type="password"], #password').first()
      await pwInput.click()
      await page.waitForTimeout(300)

      for (const char of password) {
        await page.keyboard.type(char)
        await page.waitForTimeout(50 + Math.random() * 30)
      }
      await page.waitForTimeout(500)

      // 로그인 버튼 클릭
      const loginBtn = page.locator('button[type="submit"], .btn_login, .btn_confirm, button:has-text("로그인")').first()
      await loginBtn.click()
      await page.waitForTimeout(5000)
    }

    // 로그인 결과 확인
    const afterUrl = page.url()
    console.log('[Tistory] 로그인 후 URL:', afterUrl)

    // 카카오 로그인 페이지에 남아있으면 실패
    if (afterUrl.includes('accounts.kakao.com')) {
      return { success: false, message: '카카오 로그인 실패. Chrome에서 직접 로그인해주세요.' }
    }

    // 티스토리 로그인 페이지에 여전히 있으면 실패
    if (afterUrl.includes('auth/login')) {
      console.log('[Tistory] 로그인 실패 - 여전히 로그인 페이지')
      return { success: false, message: '로그인 실패. Chrome에서 직접 티스토리에 로그인해주세요.' }
    }

    isLoggedIn = true
    console.log('[Tistory] 로그인 성공')
    return { success: true, message: '티스토리 로그인 성공!' }
  } catch (error: any) {
    console.error('[Tistory] 로그인 실패:', error.message)
    return { success: false, message: `로그인 실패: ${error.message}` }
  }
}

// 블로그 글 작성
async function postToBlog(
  blogName: string,
  title: string,
  content: string,
  tags: string[] = []
): Promise<{ success: boolean; message: string }> {
  if (!page) {
    return { success: false, message: 'Chrome에 먼저 연결해주세요.' }
  }

  if (!isLoggedIn) {
    return { success: false, message: '티스토리에 먼저 로그인해주세요.' }
  }

  try {
    // 블로그 글쓰기 페이지로 이동
    const writeUrl = `https://${blogName}.tistory.com/manage/newpost`
    console.log('[Tistory] 글쓰기 페이지로 이동:', writeUrl)
    await page.goto(writeUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(3000)

    // 에디터 로드 대기
    const currentUrl = page.url()
    console.log('[Tistory] 현재 URL:', currentUrl)

    // 제목 입력
    console.log('[Tistory] 제목 입력 중...')
    const titleSelectors = [
      '#post-title-inp',
      'input[placeholder*="제목"]',
      '.tit_post input',
      '#title',
      'input.txt_field'
    ]

    let titleInput = null
    for (const selector of titleSelectors) {
      const el = page.locator(selector).first()
      if (await el.count() > 0) {
        titleInput = el
        console.log('[Tistory] 제목 셀렉터 발견:', selector)
        break
      }
    }

    if (titleInput) {
      await titleInput.click()
      await page.waitForTimeout(300)

      // 제목 입력 (자연스러운 속도)
      for (const char of title) {
        await page.keyboard.type(char)
        await page.waitForTimeout(80 + Math.random() * 40)
      }
    } else {
      console.log('[Tistory] 제목 입력란을 찾지 못함')
    }

    await page.waitForTimeout(1000)

    // 본문 입력
    console.log('[Tistory] 본문 입력 중...')

    // 콘텐츠를 텍스트와 이미지로 파싱
    const contentParts = parseContentWithImages(content)
    console.log('[Tistory] 콘텐츠 파트 수:', contentParts.length)

    // 이미지 삽입 헬퍼 함수 - 파일 업로드 방식
    const insertImageViaUpload = async (imageDataUrl: string) => {
      if (!page) return false
      try {
        console.log('[Tistory] 이미지 버튼 찾는 중...')

        // 이미지 버튼 찾기 (티스토리 에디터)
        const imageButtonSelectors = [
          'button[data-name="image"]',
          '.btn_image',
          'button.tui-image',
          '[class*="image-button"]',
          'button[aria-label*="이미지"]',
          '.tool_image'
        ]

        let imageButtonClicked = false
        for (const selector of imageButtonSelectors) {
          try {
            const btn = page.locator(selector).first()
            if (await btn.count() > 0) {
              await btn.click()
              imageButtonClicked = true
              console.log('[Tistory] 이미지 버튼 클릭:', selector)
              break
            }
          } catch { continue }
        }

        if (imageButtonClicked) {
          await page.waitForTimeout(1000)

          // 파일 input 찾기
          const fileInput = page.locator('input[type="file"][accept*="image"]').first()
          if (await fileInput.count() > 0) {
            const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
            const buffer = Buffer.from(base64Data, 'base64')

            await fileInput.setInputFiles({
              name: `tistory_image_${Date.now()}.png`,
              mimeType: 'image/png',
              buffer: buffer
            })

            console.log('[Tistory] 이미지 업로드 완료')
            await page.waitForTimeout(2000)

            // 확인 버튼 클릭
            const confirmBtn = page.locator('button:has-text("확인"), button:has-text("완료"), button:has-text("삽입"), button:has-text("적용")').first()
            if (await confirmBtn.count() > 0) {
              await confirmBtn.click()
              await page.waitForTimeout(1000)
            }

            await page.keyboard.press('Enter')
            await page.keyboard.press('Enter')
            return true
          }
        }
        return false
      } catch (error: any) {
        console.log('[Tistory] 이미지 삽입 실패:', error.message)
        return false
      }
    }

    // 본문 에디터 찾기 (다양한 티스토리 에디터 버전 지원)
    const editorSelectors = [
      // 새 에디터 (SE Editor)
      'div.se-component-content',
      'div.se-module-text p',
      'div[data-placeholder]',
      'p.se-text-paragraph',
      '.se-content',
      '.se-text-paragraph-wrap',
      // 구 에디터 (TinyMCE)
      '.mce-content-body',
      '.editor-content',
      '#content',
      // 일반 에디터
      'textarea[name="content"]',
      '[contenteditable="true"]',
    ]

    // iframe 에디터 확인
    const hasIframe = await page.locator('iframe#editor-tistory_ifr, iframe[id*="editor"], iframe[id*="mce"]').count() > 0
    console.log('[Tistory] iframe 에디터 존재:', hasIframe)

    let editorFound = false

    if (hasIframe) {
      // TinyMCE iframe 에디터
      console.log('[Tistory] iframe 에디터 사용')
      const editorFrame = page.frameLocator('iframe#editor-tistory_ifr, iframe[id*="editor"], iframe[id*="mce"]').first()
      const body = editorFrame.locator('body')
      try {
        await body.click()
        await page.waitForTimeout(500)
        editorFound = true

        for (const part of contentParts) {
          if (part.type === 'text') {
            for (const char of part.content) {
              await page.keyboard.type(char)
              await page.waitForTimeout(50 + Math.random() * 50)
            }
            await page.keyboard.press('Enter')
            await page.keyboard.press('Enter')
            await page.waitForTimeout(300)
          } else if (part.type === 'image') {
            console.log('[Tistory] 이미지 삽입 중...')
            const inserted = await insertImageViaUpload(part.content)
            if (!inserted) {
              // 이미지 실패 시 스킵
              await page.keyboard.press('Enter')
            }
          }
        }
      } catch (err) {
        console.log('[Tistory] iframe 클릭 실패, 일반 에디터 시도')
      }
    }

    if (!editorFound) {
      // 일반 에디터 (contenteditable 또는 textarea)
      console.log('[Tistory] 일반 에디터 셀렉터 검색 중...')

      for (const selector of editorSelectors) {
        const el = page.locator(selector).first()
        const count = await el.count()
        console.log(`[Tistory] 셀렉터 "${selector}": ${count}개 발견`)

        if (count > 0) {
          console.log('[Tistory] 본문 셀렉터 발견:', selector)
          await el.click()
          await page.waitForTimeout(500)
          editorFound = true

          for (const part of contentParts) {
            if (part.type === 'text') {
              for (const char of part.content) {
                await page.keyboard.type(char)
                await page.waitForTimeout(50 + Math.random() * 50)
              }
              await page.keyboard.press('Enter')
              await page.keyboard.press('Enter')
            } else if (part.type === 'image') {
              const inserted = await insertImageViaUpload(part.content)
              if (!inserted) {
                await page.keyboard.press('Enter')
              }
            }
          }
          break
        }
      }
    }

    // 에디터를 찾지 못한 경우 Tab 키로 이동 시도
    if (!editorFound) {
      console.log('[Tistory] 에디터 셀렉터 실패, Tab 키로 본문 영역 이동 시도')
      // 제목에서 Tab으로 본문으로 이동
      await page.keyboard.press('Tab')
      await page.waitForTimeout(500)

      for (const part of contentParts) {
        if (part.type === 'text') {
          for (const char of part.content) {
            await page.keyboard.type(char)
            await page.waitForTimeout(50 + Math.random() * 50)
          }
          await page.keyboard.press('Enter')
          await page.keyboard.press('Enter')
        } else if (part.type === 'image') {
          const inserted = await insertImageViaUpload(part.content)
          if (!inserted) {
            await page.keyboard.type('[이미지]')
          }
        }
      }
    }

    await page.waitForTimeout(1000)

    // 태그 입력
    if (tags.length > 0) {
      console.log('[Tistory] 태그 입력 중...')
      const tagInput = page.locator('input[placeholder*="태그"], #tagText, .tag_input input').first()
      if (await tagInput.count() > 0) {
        for (const tag of tags) {
          await tagInput.click()
          await tagInput.fill(tag)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(300)
        }
      }
    }

    await page.waitForTimeout(1000)

    // 발행 버튼 클릭
    console.log('[Tistory] 발행 버튼 클릭...')
    const publishSelectors = [
      'button:has-text("발행")',
      'button:has-text("완료")',
      '.btn_publish',
      '#publish-btn',
      'button.btn_save'
    ]

    for (const selector of publishSelectors) {
      const btn = page.locator(selector).first()
      if (await btn.count() > 0) {
        console.log('[Tistory] 발행 버튼 발견:', selector)
        await btn.click()
        break
      }
    }

    await page.waitForTimeout(3000)

    // 발행 확인 모달 처리
    const confirmBtn = page.locator('button:has-text("발행"), button:has-text("확인"), .btn_ok').first()
    if (await confirmBtn.count() > 0) {
      await confirmBtn.click()
      await page.waitForTimeout(2000)
    }

    console.log('[Tistory] 포스팅 완료!')
    return { success: true, message: '티스토리에 글이 발행되었습니다!' }
  } catch (error: any) {
    console.error('[Tistory] 포스팅 실패:', error.message)
    return { success: false, message: `포스팅 실패: ${error.message}` }
  }
}

// 상태 확인
function getStatus(): { connected: boolean; loggedIn: boolean } {
  return {
    connected: browser !== null && page !== null,
    loggedIn: isLoggedIn
  }
}

// 로그인 상태 확인 (Chrome 세션 기반)
async function checkLoginStatus(): Promise<{ success: boolean; loggedIn: boolean; message: string }> {
  if (!page) {
    return { success: false, loggedIn: false, message: 'Chrome에 먼저 연결해주세요.' }
  }

  try {
    // 티스토리 관리 페이지로 이동하여 로그인 상태 확인 (5초 타임아웃)
    await page.goto('https://www.tistory.com/auth/login', { timeout: 5000, waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    const currentUrl = page.url()
    console.log('[Tistory] 로그인 확인 URL:', currentUrl)

    // 로그인 페이지가 아닌 곳으로 리다이렉트되면 이미 로그인됨
    if (!currentUrl.includes('auth/login') && !currentUrl.includes('accounts.kakao.com')) {
      isLoggedIn = true
      return { success: true, loggedIn: true, message: '이미 로그인되어 있습니다.' }
    }

    return { success: true, loggedIn: false, message: '로그인이 필요합니다. Chrome에서 티스토리에 로그인하세요.' }
  } catch (error: any) {
    console.error('[Tistory] 로그인 상태 확인 실패:', error.message)
    // 타임아웃이어도 현재 URL 확인 시도
    try {
      const currentUrl = page.url()
      if (currentUrl.includes('tistory.com') && !currentUrl.includes('auth/login')) {
        isLoggedIn = true
        return { success: true, loggedIn: true, message: '로그인 확인됨' }
      }
    } catch {}
    return { success: false, loggedIn: false, message: '로그인 상태 확인 실패' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PostTistoryRequest = await request.json()
    const { action, credentials, post, blogName } = body

    console.log('[Tistory] Action:', action)

    switch (action) {
      case 'connect':
        const connectResult = await connectToChrome()
        return NextResponse.json(connectResult)

      case 'login':
        if (!credentials?.email || !credentials?.password) {
          return NextResponse.json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' })
        }
        const loginResult = await loginTistory(credentials.email, credentials.password)
        return NextResponse.json(loginResult)

      case 'post':
        if (!post?.blogName || !post?.title || !post?.content) {
          return NextResponse.json({ success: false, message: '블로그명, 제목, 내용이 필요합니다.' })
        }
        const postResult = await postToBlog(post.blogName, post.title, post.content, post.tags || [])
        return NextResponse.json(postResult)

      case 'status':
        return NextResponse.json({ success: true, ...getStatus() })

      case 'checkLogin':
        const checkResult = await checkLoginStatus()
        return NextResponse.json(checkResult)

      default:
        return NextResponse.json({ success: false, message: '알 수 없는 action입니다.' })
    }
  } catch (error: any) {
    console.error('[Tistory] API Error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
